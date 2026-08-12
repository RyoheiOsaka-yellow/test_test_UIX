// The driver that carries the DSP to an output.
//
// The original has two of these — the Scriptable Audio Pipeline on native platforms,
// and a push driver on the Web that renders blocks from Update and hands them to the
// Web Audio API, which is what costs that build most of a tenth of a second. A worklet
// is the pipeline's counterpart rather than the push driver's: it is called on the
// audio thread with the clock it is to render against, so the same DSP runs here with
// no lead of its own beyond the block it is inside.
//
// Nothing about a note is state held here. An event carries its own timbre and the
// exact sample it starts on, which is what lets a parameter lock alter one note
// without anything having to be set beforehand. The one exception is the effect
// settings, which every note shares and so have nowhere else to live: they are
// replaced rather than scheduled.

import { FmSynthCore, mixFxRuntime } from './dsp.js'

// How much of the finished mix is kept for anything drawing it, and how often that is
// handed back. The two ends are not synchronised and deliberately not: what is at
// stake in the race is one column of a scope on a frame nobody will see again.
const ScopeFrames = 1024
const ScopeInterval = 8 // Render quanta between reports

class JacquardProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()

    const {
      maxVoices = 24, queueCapacity = 512, masterGain = 0.8
    } = options.processorOptions ?? {}

    // The render quantum, which is the only block size a worklet is ever asked for.
    this.frameCount = 128

    this.core = new FmSynthCore(sampleRate, this.frameCount, maxVoices, queueCapacity,
                                masterGain)

    // A silent default, so that a buffer rendered before the first settings arrive is
    // the mix without any effects rather than one with a NaN in it.
    this.fx = mixFxRuntime(
      { reverbSize: 0.5, reverbDamp: 0.5, reverbWidth: 1, delayBeats: 0.5,
        delayFeedback: 0, delayTone: 0.4, delaySpread: 0 },
      { drive: 0, ceiling: 0, attack: 0.005, release: 0.15 }, 120, sampleRate)

    this.scope = new Float32Array(ScopeFrames)
    this.scopeCursor = 0
    this.blocks = 0

    this.port.onmessage = event => this.receive(event.data)
  }

  receive(message) {
    switch (message.type) {
      case 'note':
        this.core.schedule(message.note)
        break

      case 'notes':
        for (const note of message.notes) this.core.schedule(note)
        break

      case 'fx':
        this.fx = message.fx
        break

      // Everything the sequencer had queued, dropped where it stands: what a stop
      // means is that nothing further is heard, and a note already sounding runs out
      // its own envelope rather than being cut.
      case 'flush':
        this.core.pool.queue.length = 0
        break
    }
  }

  process(inputs, outputs) {
    const output = outputs[0]
    const left = output[0]
    const right = output.length > 1 ? output[1] : output[0]

    // currentFrame is the context's own clock, which is what the main thread reads as
    // currentTime * sampleRate: the two agree to the sample, so a note scheduled
    // against one lands where the other put it.
    this.core.render(left, right, left.length, currentFrame, this.fx)

    for (let i = 0; i < left.length; i++) {
      this.scope[this.scopeCursor] = (left[i] + right[i]) * 0.5
      if (++this.scopeCursor >= ScopeFrames) this.scopeCursor = 0
    }

    if (++this.blocks >= ScopeInterval) {
      this.blocks = 0
      this.report()
    }

    return true
  }

  report() {
    const pool = this.core.pool

    this.port.postMessage({
      type: 'scope',
      wave: this.scope.slice(),
      cursor: this.scopeCursor,
      levels: pool.levels.slice(),
      activeVoices: pool.activeVoiceCount,
      queuedNotes: pool.queuedCount,
      droppedNotes: pool.dropped,
      stolenNotes: pool.stolen,
      cancelledNotes: pool.cancelled
    })
  }
}

registerProcessor('jacquard-synth', JacquardProcessor)
