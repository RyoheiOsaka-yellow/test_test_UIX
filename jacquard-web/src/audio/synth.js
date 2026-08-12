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

import { mixFxRuntime, sameMixFx } from './dsp.js'

const ProcessorUrl = new URL('./synth-processor.js', import.meta.url)

export class FmSynth {
  constructor(maxVoices = 24, masterGain = 0.8, queueCapacity = 512) {
    this.maxVoices = maxVoices
    this.masterGain = masterGain
    this.queueCapacity = queueCapacity

    this.context = null
    this.node = null
    this.ready = false
    this.lastFx = null

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
  // being rendered and the hop a message takes to reach it.
  get minimumLead() { return Math.round(this.sampleRate * 0.02) }

  // Built on the first gesture, since that is when a browser will let one start.
  async start() {
    if (this.context != null) {
      if (this.context.state === 'suspended') await this.context.resume()
      return
    }

    this.context = new (window.AudioContext ?? window.webkitAudioContext)({
      latencyHint: 'interactive'
    })

    await this.context.audioWorklet.addModule(ProcessorUrl)

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

    this.node.port.postMessage({ type: 'note', note })
  }

  scheduleAll(notes) {
    if (notes.length === 0) return

    if (!this.ready) {
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
    if (this.ready) this.node.port.postMessage({ type: 'fx', fx: runtime })
  }

  // Drops whatever has not sounded yet. A note already under way runs out its own
  // envelope, which is what a transport stop sounds like on a hardware sequencer.
  flush() {
    this.pending.length = 0
    if (this.ready) this.node.port.postMessage({ type: 'flush' })
  }
}
