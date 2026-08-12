// Application facing handle for the FM synth.
//
// The synth has no concept of a patch or of a currently selected sound: the only thing
// you can do with it is schedule a note event, which carries its own timbre and the
// exact sample position at which it should start. That is what lets a parameter lock
// alter one note without any state having to be set beforehand.
//
// The one exception is the send effects and the limiter, which are shared by every note
// and so have nowhere else to live. Even they are held rather than sequenced: setFx
// replaces what the audio thread is using, with no position and no schedule.

import { FmSynthCore, mixFxRuntime, sameMixFx } from './dsp.js'

// Where the worklet's own module is. The single file build has no separate module to
// point at, so it hands over a blob URL holding the same code before any of this runs.
const processorUrl = () =>
  globalThis.__jacquardProcessorUrl ?? new URL('./synth-processor.js', import.meta.url)

// What the fallback driver renders in one go, and how far past the clock a note may
// then be scheduled. A script processor runs on the main thread and is called for a
// buffer at a time, so the block it is inside is already committed: this is the same
// floor the original's Web driver has, for the same reason.
const FallbackFrames = 2048

export class FmSynth {
  constructor(maxVoices = 24, masterGain = 0.8, queueCapacity = 512) {
    this.maxVoices = maxVoices
    this.masterGain = masterGain
    this.queueCapacity = queueCapacity

    this.context = null
    this.node = null
    this.ready = false
    this.lastFx = null

    // Set only by the push driver, and the one thing that tells the two apart.
    this.core = null

    // What the mix looked like, for anything drawing it. Written whenever the audio
    // side gets round to saying so and read whenever a frame happens to want it.
    this.scope = null

    this.status = {
      activeVoices: 0, queuedNotes: 0,
      droppedNotes: 0, stolenNotes: 0, cancelledNotes: 0
    }

    // Notes scheduled before the context exists. A browser will not start one until a
    // hand has touched the page, so the alternative is losing whatever the first
    // gesture asked for.
    this.pending = []
  }

  get sampleRate() { return this.context?.sampleRate ?? 48000 }

  // Current position of the audio clock in samples. Scheduling is expressed against
  // this rather than against frame time.
  get currentSample() {
    return this.context == null ? 0 : Math.floor(this.context.currentTime * this.sampleRate)
  }

  // How far past currentSample the earliest schedulable note lies. A worklet renders
  // one quantum at a time against the same clock, so what this covers is the block
  // being rendered and the hop a message takes to reach it. The fallback driver has
  // already committed the buffer it is inside, which costs it a great deal more.
  get minimumLead() {
    return this.core != null ? FallbackFrames * 2 : Math.round(this.sampleRate * 0.02)
  }

  // Built on the first gesture, since that is when a browser will let one start.
  async start() {
    if (this.context != null) {
      if (this.context.state === 'suspended') await this.context.resume()
      return
    }

    this.context = new (window.AudioContext ?? window.webkitAudioContext)({
      latencyHint: 'interactive'
    })

    // Two drivers, and the DSP has none: a worklet is called on the audio thread with
    // the clock it is to render against, and where one cannot be loaded at all the
    // same core is pushed a buffer at a time from here instead.
    try {
      await this.context.audioWorklet.addModule(processorUrl())
    } catch (error) {
      this.startFallback()
      if (this.context.state === 'suspended') await this.context.resume()
      return
    }

    this.node = new AudioWorkletNode(this.context, 'jacquard-synth', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        maxVoices: this.maxVoices,
        queueCapacity: this.queueCapacity,
        masterGain: this.masterGain
      }
    })

    this.node.port.onmessage = event => this.receive(event.data)
    this.node.connect(this.context.destination)

    this.ready = true

    if (this.pending.length > 0) {
      this.node.port.postMessage({ type: 'notes', notes: this.pending })
      this.pending.length = 0
    }

    if (this.context.state === 'suspended') await this.context.resume()
  }

  // The push driver, for a page that cannot load a worklet module at all — which on a
  // file:// origin is what some browsers answer. It is the arrangement the original's
  // Web build has everywhere: the same core, rendered a buffer at a time from the
  // thread the app is on, against the clock the buffer says it starts at. What it
  // costs is the lead above and a frame that takes too long being audible.
  startFallback() {
    this.core = new FmSynthCore(this.sampleRate, FallbackFrames, this.maxVoices,
                                this.queueCapacity, this.masterGain)

    this.scopeWave = new Float32Array(1024)

    const node = this.context.createScriptProcessor(FallbackFrames, 0, 2)

    node.onaudioprocess = event => {
      const output = event.outputBuffer
      const left = output.getChannelData(0)
      const right = output.getChannelData(1)

      this.core.render(left, right, output.length,
                       Math.round(event.playbackTime * this.sampleRate), this.fxRuntime())

      // The tail of the buffer is what the scope draws, on the same terms as the
      // worklet's: a reading of the mix rather than a handshake with it.
      const from = Math.max(0, output.length - this.scopeWave.length)
      for (let i = 0; i < this.scopeWave.length; i++)
        this.scopeWave[i] = (left[from + i] + right[from + i]) * 0.5

      this.scope = {
        wave: this.scopeWave,
        cursor: this.scopeWave.length - 1,
        levels: this.core.pool.levels
      }

      this.status = {
        activeVoices: this.core.pool.activeVoiceCount,
        queuedNotes: this.core.pool.queuedCount,
        droppedNotes: this.core.pool.dropped,
        stolenNotes: this.core.pool.stolen,
        cancelledNotes: this.core.pool.cancelled
      }
    }

    node.connect(this.context.destination)

    this.node = node
    this.ready = true

    for (const note of this.pending) this.core.schedule(note)
    this.pending.length = 0
  }

  fxRuntime() {
    return this.lastFx ?? mixFxRuntime(
      { reverbSize: 0.5, reverbDamp: 0.5, reverbWidth: 1, delayBeats: 0.5,
        delayFeedback: 0, delayTone: 0.4, delaySpread: 0 },
      { drive: 0, ceiling: 0, attack: 0.005, release: 0.15 }, 120, this.sampleRate)
  }

  receive(message) {
    if (message.type !== 'scope') return

    this.scope = message
    this.status = {
      activeVoices: message.activeVoices,
      queuedNotes: message.queuedNotes,
      droppedNotes: message.droppedNotes,
      stolenNotes: message.stolenNotes,
      cancelledNotes: message.cancelledNotes
    }
  }

  // Schedules a note. startSample may be in the future; the synth starts it on that
  // exact sample.
  schedule(note) {
    if (!this.ready) {
      if (this.pending.length < this.queueCapacity) this.pending.push(note)
      return
    }

    if (this.core != null) this.core.schedule(note)
    else this.node.port.postMessage({ type: 'note', note })
  }

  scheduleAll(notes) {
    if (notes.length === 0) return

    if (!this.ready || this.core != null) {
      for (const note of notes) this.schedule(note)
      return
    }

    this.node.port.postMessage({ type: 'notes', notes })
  }

  // Hands over the mix settings whenever they are not what was handed over last. One
  // comparison covers every way they can change — a bar on the Send FX panel or the
  // Global one, the tempo the delay is locked to, a project loaded over the top of
  // this one — so none of those has to know that anything downstream cares.
  updateFx(fx, limiter, tempo) {
    const runtime = mixFxRuntime(fx, limiter, tempo, this.sampleRate)
    if (sameMixFx(runtime, this.lastFx)) return

    this.lastFx = runtime

    // The push driver reads it off this object as it renders, so there is nothing to
    // send: what a message buys under a worklet is a crossing this one does not make.
    if (this.ready && this.core == null)
      this.node.port.postMessage({ type: 'fx', fx: runtime })
  }

  // Drops whatever has not sounded yet. A note already under way runs out its own
  // envelope, which is what a transport stop sounds like on a hardware sequencer.
  flush() {
    this.pending.length = 0
    if (!this.ready) return

    if (this.core != null) this.core.pool.queue.length = 0
    else this.node.port.postMessage({ type: 'flush' })
  }
}
