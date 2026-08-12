// What a hand does to the score on its way to the synth.
//
// Everything else that colours a note is written on the plane: a lock is a tile, a
// gate is a tile, and what a channel sounds like is a patch the score carries. None
// of that can be played, because none of it can be held for two beats and let go.
// This is the layer that can. It sits between the sequencer and the synth, takes the
// events the runners produced and hands over something else for as long as a button
// is down.
//
// It reaches only what has not been handed over yet, which is also the whole of the
// promise it makes: a voice reads its event once and never again, so a note already
// sounding is not retuned, not shortened and not thrown into the reverb by anything
// pressed after it began. What a live effect changes is the next note.
//
// Nothing here is saved. A press is a gesture rather than a setting, so there is no
// file key, no version bump and no lock target.
//
// The grid it counts in is the project's sixteenth, from the sample the transport
// started on, and not the step of whichever lane a note came from.

// The twelve live effects, in the order the panel stands them in: each pair is a
// column, and the columns read as sends, gate, octave, ramp, and then two columns of
// roll. The number on a roll is how many sixteenths long it is, which is the only
// thing that separates the four of them.

export const LiveEffect = {
  Reverb: 0, Delay: 1,
  Stab: 2, Sustain: 3,
  OctaveDown: 4, OctaveUp: 5,
  Fall: 6, Rise: 7,
  Roll1: 8, Roll2: 9,
  Roll3: 10, Roll4: 11
}

// The names are a player's and not the code's: Stab is a gate of a tenth of a step
// with the tail cut back to match, Rise and Fall name what is heard, and the rolls
// are named by their length because the length is the only thing that tells them
// apart.
export const LiveEffectNames = [
  'Reverb', 'Delay', 'Stab', 'Sustain', 'Oct Down', 'Oct Up', 'Fall', 'Rise',
  'Roll 1/16', 'Roll 1/8', 'Roll 3/16', 'Roll 1/4'
]

const Count = 12

// What Stab leaves of a sixteenth, and the floor a note event already holds every
// gate to.
const StabGate = 0.1
const MinimumGate = 0.005

// What Stab leaves of the release. Ten milliseconds is short enough to be an edge and
// long enough not to click.
const StabRelease = 0.01

// Two bars of sixteenths, which is where a ramp turns over.
const RampLaps = 32

// How far back the record of what has sounded reaches. A roll window is four
// sixteenths at the longest, so twice that is already slack.
const HistoryLaps = 8

// How many sixteenths a roll is long, and zero for everything that is not one.
const rollSteps = fx => {
  switch (fx) {
    case LiveEffect.Roll1: return 1
    case LiveEffect.Roll2: return 2
    case LiveEffect.Roll3: return 3
    case LiveEffect.Roll4: return 4
    default: return 0
  }
}

const sixteenthSamples = (tempo, sampleRate) =>
  60 / Math.max(tempo, 1) / 4 * sampleRate

export class LiveFx {
  constructor() {
    this.held = new Array(Count).fill(false)
    this.pressed = new Array(Count).fill(0)
    this.sequence = new Array(Count).fill(0)
    this.rolls = new Array(Count).fill(null)

    this.queue = []
    this.history = []
    this.soundingNotes = []

    this.presses = 0
    this.origin = 0
    this.handedTo = 0
  }

  // Held effects

  isHeld(fx) { return this.held[fx] }

  // The sample is only the moment the hand arrived: what it means depends on the
  // tempo and the grid, neither of which this is told until the next handover.
  press(fx, sample) {
    this.held[fx] = true
    this.pressed[fx] = sample

    // Which press came last, which is the only thing that decides between two rolls.
    // Counted rather than read off the sample, so that two arriving in the same frame
    // still have an order.
    this.sequence[fx] = ++this.presses
  }

  release(fx) {
    this.held[fx] = false
    this.rolls[fx] = null
  }

  // Transport

  // The sample the first step of the sequence lands on, which is what the sixteenth
  // grid is counted from. Anything already held is stamped again, so a button held
  // across a stop starts its ramp and its roll where the music starts.
  start(originSample) {
    this.stop()

    this.origin = originSample
    this.handedTo = originSample

    for (let i = 0; i < Count; i++) if (this.held[i]) this.pressed[i] = originSample
  }

  stop() {
    this.queue.length = 0
    this.history.length = 0
    this.soundingNotes.length = 0

    for (let i = 0; i < Count; i++) this.rolls[i] = null
  }

  // Handover

  // Takes what the sequencer produced. Nothing is decided here: an event parked now
  // may be handed over under a live effect that has not been pressed yet.
  enqueue(notes) {
    for (const note of notes) this.queue.push(note)
  }

  // Hands over everything due before the horizon, coloured by whatever is held at
  // this moment rather than by whatever was held when the sequencer ran.
  //
  // With nothing held and no roll running this is a copy, which is what makes the
  // whole feature inert while the panel is down.
  handOver(horizon, tempo, sampleRate, output) {
    const sixteenth = sixteenthSamples(tempo, sampleRate)
    if (sixteenth <= 0) return

    this.arm(sixteenth)

    this.soundingNotes.length = 0

    const roll = this.owner()

    // Straight from the score, unless a roll has taken the score's place. A roll that
    // is still recording has not: it plays the sequence through once and stands in for
    // it only from the far end of what it recorded.
    const kept = []

    for (const note of this.queue) {
      if (note.startSample >= horizon) {
        kept.push(note)
        continue
      }

      if (roll == null || note.startSample < roll.end) this.soundingNotes.push(note)
    }

    this.queue = kept

    if (roll != null) this.repeat(roll, horizon)

    // Recording, remembering and colouring all read the event as the score wrote it,
    // so a roll caught under an octave holds the plain note and rises with the hand.
    for (const note of this.soundingNotes) {
      this.record(note)
      this.history.push(note)
      output.push(this.colour({ ...note }, sixteenth, sampleRate))
    }

    this.forget(horizon - sixteenth * HistoryLaps)

    this.handedTo = horizon
  }

  // Private

  gridIndex(sample, sixteenth) {
    return Math.floor((sample - this.origin) / sixteenth)
  }

  gridSample(index, sixteenth) {
    return this.origin + Math.round(index * sixteenth)
  }

  // The roll that is standing in for the score, which is the one pressed last: they
  // all answer the same question and there is one answer. Letting that one go leaves
  // whichever is still down and was pressed most recently before it.
  owner() {
    let owner = null
    let latest = 0

    for (let i = 0; i < Count; i++) {
      if (this.rolls[i] == null || this.sequence[i] <= latest) continue
      owner = this.rolls[i]
      latest = this.sequence[i]
    }

    return owner
  }

  // Gives every roll that has been pressed but not yet caught its window. All four
  // catch, whether or not they are the one standing in for the score, so that letting
  // go of the one on top hands over to a window that is already full.
  arm(sixteenth) {
    for (let i = 0; i < Count; i++) {
      const steps = rollSteps(i)
      if (steps > 0) this.armRoll(i, steps, sixteenth)
    }
  }

  armRoll(fx, steps, sixteenth) {
    if (!this.held[fx] || this.rolls[fx] != null) return

    const index = this.gridIndex(this.pressed[fx], sixteenth)

    const roll = {
      start: this.gridSample(index, sixteenth),
      end: this.gridSample(index + steps, sixteenth),
      notes: []
    }

    roll.caught = Math.min(roll.end, this.handedTo)

    // A window claimed late enough that its own far end is already behind the
    // handover has nothing to say about the past, so it stands in from here.
    roll.emittedTo = Math.max(roll.end, this.handedTo)

    // Whatever of the window is already behind us, out of what has sounded.
    for (const note of this.history)
      if (note.startSample >= roll.start && note.startSample < roll.caught)
        roll.notes.push(note)

    this.rolls[fx] = roll
  }

  // Writes a note into whichever windows are still open on it.
  record(note) {
    for (let i = 0; i < Count; i++) {
      const roll = this.rolls[i]
      if (roll == null) continue
      if (note.startSample < roll.caught || note.startSample >= roll.end) continue
      roll.notes.push(note)
    }
  }

  // Lays the window down again and again from the far end of itself. Each pass is the
  // recorded note with a new sample to start on and nothing else changed, so what a
  // roll sounds like is decided by whatever is held when it is handed over.
  repeat(roll, horizon) {
    const length = roll.end - roll.start
    if (length <= 0 || roll.notes.length === 0) return

    // Never behind the handover. A roll that was covered by one pressed over the top
    // of it stops being laid down while that lasts, so every pass it missed in between
    // would otherwise come out at once, in the past.
    const from = Math.max(Math.max(roll.emittedTo, roll.end), this.handedTo)
    if (from >= horizon) return

    const pass = Math.max(0, Math.floor((from - roll.end) / length))

    for (let start = roll.end + pass * length; start < horizon; start += length) {
      for (const note of roll.notes) {
        const at = start + (note.startSample - roll.start)
        if (at < from || at >= horizon) continue

        this.soundingNotes.push({ ...note, startSample: at })
      }
    }

    roll.emittedTo = horizon
  }

  forget(before) {
    this.history = this.history.filter(note => note.startSample >= before)
  }

  // Everything held, in one order, so that two that meet compose the same way every
  // time. Stab sets the gate and Sustain doubles whatever it finds, which is why the
  // two held together come out at a fifth of a sixteenth rather than at odds.
  //
  // Both of them reach the release as well as the gate, because how long a note lasts
  // is the two of them and not the gate alone. Stab only shortens, so a patch already
  // clipped stays where it is rather than being lengthened by a button that means
  // shorter.
  colour(note, sixteenth, sampleRate) {
    if (this.held[LiveEffect.Reverb]) note.reverbSend = 1
    if (this.held[LiveEffect.Delay]) note.delaySend = 1

    if (this.held[LiveEffect.Stab]) {
      note.duration = Math.max(sixteenth / sampleRate * StabGate, MinimumGate)
      note.carrierRelease = Math.min(note.carrierRelease, StabRelease)
    }

    if (this.held[LiveEffect.Sustain]) {
      note.duration *= 2
      note.carrierRelease *= 2
    }

    let semitones = 0

    if (this.held[LiveEffect.OctaveUp]) semitones += 12
    if (this.held[LiveEffect.OctaveDown]) semitones -= 12

    semitones += this.ramp(LiveEffect.Rise, note.startSample, sixteenth)
    semitones -= this.ramp(LiveEffect.Fall, note.startSample, sixteenth)

    // Once, from the total, so that an octave up against an octave down is silence
    // about the pitch rather than two multiplications that nearly cancel.
    if (semitones !== 0) note.frequency *= Math.pow(2, semitones / 12)

    return note
  }

  // A semitone per sixteenth from the step the hand arrived on, turning over after
  // two bars. Counted from the press rather than from the bar line: what a ramp is
  // for is the shape of the rise, and a rise that started halfway up because the hand
  // was late is not one.
  ramp(fx, sample, sixteenth) {
    if (!this.held[fx]) return 0

    const anchor = this.gridSample(this.gridIndex(this.pressed[fx], sixteenth), sixteenth)
    const laps = Math.floor((sample - anchor) / sixteenth)

    return ((laps % RampLaps) + RampLaps) % RampLaps
  }
}
