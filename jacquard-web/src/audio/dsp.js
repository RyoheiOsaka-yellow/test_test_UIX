// The synth with nothing attached to its output: the voices, the two send buses, and
// the mix that joins them.
//
// Everything here is said in samples and frame counts, and nothing in it knows who is
// asking. That is what lets one piece of DSP serve the worklet that renders it in the
// browser and an offline check that renders it in Node: both arrive here as the same
// question — fill this many frames, starting at this sample.
//
// The mix is a dry bus and two send buses. A voice goes into the dry one at the pair
// of gains its pan asks for and into each of the others at whatever its note asked
// for, so the two effects hear a sum of exactly the notes that were sent to them and
// nothing else.

import {
  carrierLevel, modulatorLevel, pitchScale, panGains, totalDuration
} from '../core/patch.js'

const TwoPi = Math.PI * 2

const clamp = (value, low, high) => value < low ? low : value > high ? high : value
const saturate = value => clamp(value, 0, 1)

// Runtime state of one voice: a two operator FM pair (modulator into carrier) with
// modulator self-feedback.
//
// The note is the voice's only source of timbre information; everything else here
// exists because a sine wave has to remember its phase.

export class FmVoiceState {
  constructor() {
    this.note = null
    this.active = false
    this.carrierPhase = 0
    this.modulatorPhase = 0
    this.increment = 0
    this.feedback1 = 0
    this.feedback2 = 0
  }

  // All oscillator state is reset, so a given event always produces exactly the same
  // waveform.
  trigger(note, sampleRate) {
    this.note = note
    this.active = true
    this.carrierPhase = 0
    this.modulatorPhase = 0
    this.feedback1 = 0
    this.feedback2 = 0

    // The carrier is always 1:1, so this is its own increment and the modulator's is
    // this times its ratio.
    this.increment = note.frequency / sampleRate
  }

  release() { this.active = false }

  // Sample position at which this voice goes silent and frees its slot.
  endSample(sampleRate) {
    return this.note.startSample + Math.floor(totalDuration(this.note) * sampleRate)
  }

  // Renders one sample. time is the elapsed note time in seconds, which the caller
  // derives from the absolute sample position so that a note can start in the middle
  // of a buffer.
  next(time) {
    const note = this.note

    // The pitch envelope moves the frequency while the note sounds, so the increment
    // is per sample rather than settled at trigger time. Both operators follow it,
    // which is what makes a sweep sound like one voice bending rather than two
    // drifting apart.
    const increment = this.increment * pitchScale(note, time)

    // Feeding back the average of the last two modulator outputs keeps the loop from
    // breaking into noise.
    const mod = Math.sin(TwoPi * this.modulatorPhase +
                         note.feedback * (this.feedback1 + this.feedback2) * 0.5)
    this.feedback2 = this.feedback1
    this.feedback1 = mod

    const index = note.modulationIndex * modulatorLevel(note, time)
    const amplitude = note.level * carrierLevel(note, time)

    const output = Math.sin(TwoPi * this.carrierPhase + mod * index) * amplitude

    this.carrierPhase = frac(this.carrierPhase + increment)
    this.modulatorPhase = frac(this.modulatorPhase + increment * note.modulatorRatio)

    return output
  }
}

const frac = x => x - Math.floor(x)

// A fixed set of voices plus the queue of notes waiting to start.

export class FmVoicePool {
  constructor(maxVoices, queueCapacity) {
    this.voices = []
    for (let i = 0; i < maxVoices; i++) this.voices.push(new FmVoiceState())

    this.queue = []
    this.queueCapacity = queueCapacity
    this.levels = new Float32Array(maxVoices)

    this.dropped = 0
    this.stolen = 0
    this.cancelled = 0
  }

  get activeVoiceCount() {
    return this.voices.reduce((count, voice) => count + (voice.active ? 1 : 0), 0)
  }

  get queuedCount() { return this.queue.length }

  enqueue(note) {
    if (this.queue.length >= this.queueCapacity) {
      this.dropped++
      return
    }

    this.queue.push(note)
  }

  // Starts every queued note that falls inside this buffer, then renders all active
  // voices into the two sides of the dry bus, at the pair of gains their pan asks
  // for, and — in the proportion each note asks for — into the two send buses.
  //
  // A voice is rendered once and split four ways rather than being rendered again per
  // destination, and every gain it is split at is read off the note, which means all
  // of them are fixed for the life of the voice. That is the whole reason neither a
  // pan nor a send needs smoothing.
  //
  // The sends take the voice unpanned: each of those buses is a mono feed into an
  // effect that builds a stereo image of its own.
  render(dryL, dryR, reverbIn, delayIn, frameCount, bufferStart, sampleRate) {
    const bufferEnd = bufferStart + frameCount

    // Earliest first, so that the priority decisions come out the same regardless of
    // the order the notes arrived in.
    for (;;) {
      let next = -1

      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].startSample >= bufferEnd) continue
        if (next < 0 || this.queue[i].startSample < this.queue[next].startSample) next = i
      }

      if (next < 0) break

      this.trigger(this.queue[next], sampleRate)

      // Swap-remove, which is why the queue needs no ordering.
      this.queue[next] = this.queue[this.queue.length - 1]
      this.queue.pop()
    }

    const dt = 1 / sampleRate

    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i]

      if (!voice.active) {
        // A slot that has finished has to say so, or the last level it was seen at
        // would stand there for good.
        this.levels[i] = 0
        continue
      }

      const note = voice.note
      const total = totalDuration(note)

      // Once per voice per buffer, not per sample: the note holds still, so the pair
      // of gains it renders at does too.
      const [left, right] = panGains(note)

      let loudest = 0

      for (let frame = 0; frame < frameCount; frame++) {
        const time = (bufferStart + frame - note.startSample) * dt

        if (time < 0) continue                        // Starts later in this buffer
        if (time >= total) { voice.release(); break }

        const sample = voice.next(time)

        loudest = Math.max(loudest, Math.abs(sample))

        dryL[frame] += sample * left
        dryR[frame] += sample * right
        reverbIn[frame] += sample * note.reverbSend
        delayIn[frame] += sample * note.delaySend
      }

      this.levels[i] = loudest
    }
  }

  // Assigns a voice to a note: a free slot if there is one, otherwise the least
  // important voice is stolen, and a note less important than everything playing is
  // cancelled instead.
  trigger(note, sampleRate) {
    let target = this.voices.findIndex(voice => !voice.active)

    if (target < 0) {
      let lowest = Infinity
      let earliestEnd = Infinity

      for (let i = 0; i < this.voices.length; i++) {
        const priority = this.voices[i].note.priority
        const end = this.voices[i].endSample(sampleRate)
        if (priority > lowest) continue
        if (priority === lowest && end >= earliestEnd) continue
        target = i
        lowest = priority
        earliestEnd = end
      }

      // Equal priority still steals, otherwise a full pool would reject every
      // following note.
      if (note.priority < lowest) {
        this.cancelled++
        return
      }

      this.stolen++
    }

    this.voices[target].trigger(note, sampleRate)
  }
}

// The reverb the notes are sent to.
//
// A Schroeder network in the arrangement Freeverb settled on: eight comb filters in
// parallel, each with a one pole lowpass inside its feedback path, then four allpasses
// in series to smear what comes out of them. Two of everything, since the wet path is
// stereo, with the right hand set of lines a little longer so that the two sides
// decorrelate.
//
// Nothing here changes the length of a line, which is what makes the whole thing safe
// to sweep: size and damping are coefficients, so moving one alters how the signal
// already in the lines decays rather than where it is read from.

const CombTuning = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const AllpassTuning = [556, 441, 341, 225]

const CombCount = 8
const AllpassCount = 4
const PerChannel = CombCount + AllpassCount
const Lines = PerChannel * 2

const StereoSpread = 23
const ReferenceRate = 44100

// What the two normalized controls come to as coefficients. A room that never quite
// stops and one that stops immediately are both useless, so the feedback covers the
// span between them rather than reaching either end.
const MinFeedback = 0.70
const FeedbackSpan = 0.28
const DampSpan = 0.4

const AllpassFeedback = 0.5

// Freeverb's input trim and its matching output scale, which together come to roughly
// unity.
const InputGain = 0.015
const OutputGain = 3.0

// How fast a moved control arrives, as a time constant.
const SmoothingSeconds = 0.03

export class ReverbBus {
  constructor(sampleRate) {
    this.starts = new Int32Array(Lines + 1)
    this.cursors = new Int32Array(Lines)
    this.stores = new Float32Array(CombCount * 2)

    let total = 0

    for (let line = 0; line < Lines; line++) {
      this.starts[line] = total
      total += lineLength(line, sampleRate)
    }

    this.starts[Lines] = total
    this.lines = new Float32Array(total)

    // The controls start where they are rather than sliding up from nothing, so the
    // first note into a fresh bus already has the tail the panel shows.
    this.smooth = [-1, 0, 0]
  }

  // Adds the tail of what is in input to the two wet buffers. The controls are read
  // once for the block and then held.
  process(input, wetL, wetR, frameCount, sampleRate, size, damp, width) {
    this.approach(size, damp, width, frameCount / sampleRate)

    const feedback = MinFeedback + FeedbackSpan * saturate(this.smooth[0])
    const damping = DampSpan * saturate(this.smooth[1])
    const spread = saturate(this.smooth[2])

    // The pair is turned from two independent channels into one image: at a width of
    // zero both sides carry the mean and the tail sits in the middle, and at one each
    // side is entirely its own.
    const direct = OutputGain * (spread * 0.5 + 0.5)
    const crossed = OutputGain * (1 - spread) * 0.5

    for (let frame = 0; frame < frameCount; frame++) {
      const x = input[frame] * InputGain

      let left = 0
      let right = 0

      for (let i = 0; i < CombCount; i++) {
        left += this.comb(i, x, feedback, damping)
        right += this.comb(PerChannel + i, x, feedback, damping)
      }

      for (let i = 0; i < AllpassCount; i++) {
        left = this.allpass(CombCount + i, left)
        right = this.allpass(PerChannel + CombCount + i, right)
      }

      wetL[frame] += left * direct + right * crossed
      wetR[frame] += right * direct + left * crossed
    }
  }

  // One pole per control, toward whatever the panel last said. The first block after
  // a construction jumps instead, which is what the sentinel marks.
  approach(size, damp, width, blockSeconds) {
    if (this.smooth[0] < 0) {
      this.smooth = [size, damp, width]
      return
    }

    const rate = 1 - Math.exp(-blockSeconds / SmoothingSeconds)

    this.smooth[0] += (size - this.smooth[0]) * rate
    this.smooth[1] += (damp - this.smooth[1]) * rate
    this.smooth[2] += (width - this.smooth[2]) * rate
  }

  // A comb whose feedback path is dulled by a one pole, which is what makes the tail
  // lose its top as it decays rather than ringing on unchanged.
  comb(line, input, feedback, damping) {
    const index = this.starts[line] + this.cursors[line]
    const output = this.lines[index]

    const slot = store(line)
    const held = output * (1 - damping) + this.stores[slot] * damping
    this.stores[slot] = held

    this.lines[index] = input + held * feedback
    this.advance(line)

    return output
  }

  // Passes everything and delays nothing on average, which is how a comb's output is
  // smeared into something without a pitch of its own.
  allpass(line, input) {
    const index = this.starts[line] + this.cursors[line]
    const buffered = this.lines[index]

    this.lines[index] = input + buffered * AllpassFeedback
    this.advance(line)

    return buffered - input
  }

  advance(line) {
    const cursor = this.cursors[line] + 1
    this.cursors[line] =
      cursor >= this.starts[line + 1] - this.starts[line] ? 0 : cursor
  }
}

// Line order is the eight combs of the left channel, then its four allpasses, then
// the same again for the right.
function lineLength(line, sampleRate) {
  const channel = Math.floor(line / PerChannel)
  const index = line % PerChannel

  const tuning = index < CombCount ? CombTuning[index] : AllpassTuning[index - CombCount]

  const scaled = Math.floor(tuning * sampleRate / ReferenceRate) + channel * StereoSpread
  return Math.max(scaled, 1)
}

// The combs are the first eight lines of each channel, so their stores pack down into
// an array of their own rather than leaving four holes per channel.
const store = line => Math.floor(line / PerChannel) * CombCount + line % PerChannel

// The delay the notes are sent to, in time with the sequence.
//
// The tap moves while the delay is running, and a tap is a position rather than a
// coefficient: moved outright, the read pointer lands somewhere unrelated to where it
// was and the seam is a click. So the tap is never set, only approached, and the
// approach is rate limited rather than exponential — a constant speed, which is a
// constant interval of pitch for as long as the glide lasts and then nothing, the
// sound a tape delay makes when its head is moved.
//
// The tap is also fractional, so the two samples either side of it are mixed in
// proportion.

const MaxTapRate = 0.25
const MinTap = 2.0
export const MaxDelayFeedback = 0.95
const LongestDelaySeconds = 3

export class DelayBus {
  constructor(sampleRate) {
    // Sized for the longest the ladder can ask for: one beat at the slowest tempo the
    // transport offers.
    this.capacity = Math.floor(LongestDelaySeconds * sampleRate) + 4
    this.lines = new Float32Array(this.capacity * 2)
    this.cursor = 0
    this.tap = 0
    this.lowpassL = 0
    this.lowpassR = 0
  }

  // Adds the repeats of what is in input to the two wet buffers. Unlike the reverb the
  // tap is stepped per sample, since the whole point of the limit is that it is a
  // speed.
  process(input, wetL, wetR, frameCount, tapSamples, feedback, tone, spread) {
    const target = clamp(tapSamples, MinTap, this.capacity - MinTap)

    // A fresh bus starts at the tap rather than gliding out to it.
    if (this.tap <= 0) this.tap = target

    feedback = clamp(feedback, 0, MaxDelayFeedback)
    spread = saturate(spread)

    // Squared, so that the darkening is spread over the bar instead of happening all
    // at once near the top of it. Tone at zero passes the repeat through.
    const bright = 1 - saturate(tone)
    const cutoff = bright * bright * 0.98 + 0.02

    let write = this.cursor
    let tap = this.tap

    for (let frame = 0; frame < frameCount; frame++) {
      tap += clamp(target - tap, -MaxTapRate, MaxTapRate)

      let read = write - tap
      if (read < 0) read += this.capacity

      const left = this.read(0, read)
      const right = this.read(this.capacity, read)

      wetL[frame] += left
      wetR[frame] += right

      // Each repeat darker than the one before it, because the filter is inside the
      // loop and every lap passes through it again.
      this.lowpassL += (left - this.lowpassL) * cutoff
      this.lowpassR += (right - this.lowpassR) * cutoff

      const backL = this.lowpassL * feedback
      const backR = this.lowpassR * feedback

      // Spread does two things at once, which is what lets one number cover the span:
      // it takes the input off the right hand line, and it crosses the feedback over.
      const dry = input[frame]

      this.lines[write] = dry + backL * (1 - spread) + backR * spread
      this.lines[this.capacity + write] =
        dry * (1 - spread) + backR * (1 - spread) + backL * spread

      if (++write >= this.capacity) write = 0
    }

    this.cursor = write
    this.tap = tap
  }

  // The tap falls between two samples, so it reads both.
  read(origin, position) {
    const index = Math.floor(position)
    const fraction = position - index

    let next = index + 1
    if (next >= this.capacity) next -= this.capacity

    return this.lines[origin + index] * (1 - fraction) +
           this.lines[origin + next] * fraction
  }
}

// The limiter on the finished mix.
//
// It is a gain and nothing else: one number multiplying both sides, worked out from
// the loudest of the two so that the image cannot be pulled about by a peak on one
// side. The gain is what carries the attack and the release, rather than an envelope
// follower ahead of it — which is the difference between a limiter that lets the front
// of a kick through and one that does not. So a slow attack is a hole punched in the
// limiting for the length of the attack, and that hole is the punch.

export class LimiterBus {
  constructor() {
    this.peak = 0
    this.gain = 1
  }

  // Drives the mix into the ceiling and holds it there, in place.
  process(left, right, frameCount, settings) {
    let gain = this.gain
    if (gain <= 0) gain = 1

    let held = this.peak

    for (let frame = 0; frame < frameCount; frame++) {
      const l = left[frame] * settings.drive
      const r = right[frame] * settings.drive

      // The loudest of the two sides, held rather than followed: read sample by
      // sample the loudness of a tone goes to nothing twice a cycle, so a followed
      // peak would let the gain climb back between the peaks and meet each one too
      // high.
      const peak = Math.max(Math.abs(l), Math.abs(r))

      held = peak > held ? peak : held + (peak - held) * settings.release

      // What the gain would have to be for that peak to land on the ceiling. Anything
      // under it asks for no reduction at all.
      const target = held > settings.ceiling ? settings.ceiling / held : 1

      // Down at the attack and up at the release, which is the whole of the shape.
      gain += (target - gain) * (target < gain ? settings.attack : settings.release)

      left[frame] = l * gain
      right[frame] = r * gain
    }

    this.peak = held
    this.gain = gain
  }
}

// A Pade approximant of tanh, kept from the original for the shape rather than for the
// speed: the few samples a slow attack lets over the ceiling are rounded off rather
// than squared, which is what makes a lookahead unnecessary.
export function softClip(x) {
  const s = Math.min(x * x, 9)
  return clamp(x * (27 + s) / (27 + 9 * s), -1, 1)
}

// The whole synth: the pool, the three buses and the buffers they render into.

export class FmSynthCore {
  constructor(sampleRate, frameCount, maxVoices, queueCapacity, masterGain = 0.8) {
    this.sampleRate = sampleRate
    this.frameCount = frameCount
    this.masterGain = masterGain

    this.pool = new FmVoicePool(maxVoices, queueCapacity)
    this.reverb = new ReverbBus(sampleRate)
    this.delay = new DelayBus(sampleRate)
    this.limiter = new LimiterBus()

    this.dryL = new Float32Array(frameCount)
    this.dryR = new Float32Array(frameCount)
    this.reverbIn = new Float32Array(frameCount)
    this.delayIn = new Float32Array(frameCount)
  }

  schedule(note) { this.pool.enqueue(note) }

  // Fills outL and outR with the frames beginning at bufferStart.
  render(outL, outR, frameCount, bufferStart, fx) {
    this.dryL.fill(0, 0, frameCount)
    this.dryR.fill(0, 0, frameCount)
    this.reverbIn.fill(0, 0, frameCount)
    this.delayIn.fill(0, 0, frameCount)
    outL.fill(0, 0, frameCount)
    outR.fill(0, 0, frameCount)

    this.pool.render(this.dryL, this.dryR, this.reverbIn, this.delayIn,
                     frameCount, bufferStart, this.sampleRate)

    // In parallel rather than in series. Feeding the delay's repeats into the reverb
    // is a good sound and would be one line, but it is also a decision about how the
    // two are wired that the panel would then have to offer a number for.
    this.delay.process(this.delayIn, outL, outR, frameCount, fx.sends.delaySamples,
                       fx.sends.delayFeedback, fx.sends.delayTone, fx.sends.delaySpread)

    this.reverb.process(this.reverbIn, outL, outR, frameCount, this.sampleRate,
                        fx.sends.reverbSize, fx.sends.reverbDamp, fx.sends.reverbWidth)

    // The dry mix joins here, and the whole of it is what the limiter is across.
    for (let frame = 0; frame < frameCount; frame++) {
      outL[frame] = (this.dryL[frame] + outL[frame]) * this.masterGain
      outR[frame] = (this.dryR[frame] + outR[frame]) * this.masterGain
    }

    this.limiter.process(outL, outR, frameCount, fx.limiter)

    // Soft clip last, so that a dense chord cannot blow past 0dBFS however the
    // limiter is set.
    for (let frame = 0; frame < frameCount; frame++) {
      outL[frame] = softClip(outL[frame])
      outR[frame] = softClip(outR[frame])
    }
  }
}

// The effect settings, converted.
//
// The delay time arrives already converted into a distance in samples: the audio side
// has no business knowing what a tempo or a note value is. The limiter's two decibel
// figures arrive as the gains they stand for and its two times as the coefficients
// that smooth the gain by one sample, so what the render loop is handed is four
// multiplications.

const gainOf = decibels => Math.pow(10, decibels / 20)

// How much of the way to the target one sample covers. The time is a time constant
// rather than a distance travelled.
const coefficient = (seconds, sampleRate, low, high) =>
  1 - Math.exp(-1 / (clamp(seconds, low, high) * sampleRate))

export function mixFxRuntime(fx, limiter, tempo, sampleRate) {
  return {
    sends: {
      reverbSize: fx.reverbSize,
      reverbDamp: fx.reverbDamp,
      reverbWidth: fx.reverbWidth,
      delaySamples: fx.delayBeats * 60 / Math.max(tempo, 1) * sampleRate,
      delayFeedback: fx.delayFeedback,
      delayTone: fx.delayTone,
      delaySpread: fx.delaySpread
    },
    limiter: {
      drive: gainOf(clamp(limiter.drive, 0, 24)),
      ceiling: gainOf(clamp(limiter.ceiling, -24, 0)),
      attack: coefficient(limiter.attack, sampleRate, 0.0002, 0.05),
      release: coefficient(limiter.release, sampleRate, 0.01, 1.0)
    }
  }
}

export function sameMixFx(a, b) {
  if (a == null || b == null) return false
  const keys = ['reverbSize', 'reverbDamp', 'reverbWidth', 'delaySamples',
                'delayFeedback', 'delayTone', 'delaySpread']
  return keys.every(key => a.sends[key] === b.sends[key]) &&
         ['drive', 'ceiling', 'attack', 'release']
           .every(key => a.limiter[key] === b.limiter[key])
}
