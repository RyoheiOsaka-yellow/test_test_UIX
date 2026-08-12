// Renders a score to a WAV file, offline and without a browser.
//
//   node tools/render-wav.mjs [preset] [seconds] [output.wav]
//
// It runs the same sequencer and the same DSP the page does — the whole of both is
// engine-free, which is the point of the layout — so what comes out is what the app
// plays, minus only the live effects, which are a hand rather than a score.
//
// It is also how a score written by hand is checked: the counts it prints say whether
// every lane is being reached and whether the mix is anywhere near the ceiling.

import { writeFile } from 'node:fs/promises'
import * as ProjectFormat from '../src/core/format.js'
import { Sequencer } from '../src/core/sequencer.js'
import { FmSynthCore, mixFxRuntime } from '../src/audio/dsp.js'
import { ChannelMutes } from '../src/core/mutes.js'
import { Presets } from '../scores/presets.js'

const SampleRate = 48000
const Block = 256

const name = process.argv[2] ?? Presets[0].name
const seconds = Number(process.argv[3] ?? 16)
const output = process.argv[4] ?? 'render.wav'

const preset = Presets.find(p => p.name.toLowerCase().startsWith(name.toLowerCase()))
if (preset == null) {
  console.error('no preset called ' + name + '; have ' +
                Presets.map(p => p.name).join(', '))
  process.exit(1)
}

const project = ProjectFormat.read(preset.text)
const sequencer = new Sequencer(project)
const core = new FmSynthCore(SampleRate, Block, 48, 4096, 0.8)
const fx = mixFxRuntime(project.fx, project.limiter, project.tempo, SampleRate)

const frames = Math.floor(seconds * SampleRate)
const left = new Float32Array(frames)
const right = new Float32Array(frames)

const outL = new Float32Array(Block)
const outR = new Float32Array(Block)

sequencer.play(0, 0)

let notes = 0

for (let position = 0; position < frames; position += Block) {
  const scheduled = []
  sequencer.schedule(position, SampleRate / 4, SampleRate, scheduled)

  for (const note of scheduled) {
    core.schedule(note)
    notes++
  }

  const count = Math.min(Block, frames - position)
  core.render(outL, outR, Block, position, fx)

  left.set(outL.subarray(0, count), position)
  right.set(outR.subarray(0, count), position)
}

// Diagnostics

let peak = 0
let sum = 0

for (let i = 0; i < frames; i++) {
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  sum += left[i] * left[i] + right[i] * right[i]
}

const rms = Math.sqrt(sum / (frames * 2))

// What each channel contributed, counted by soloing it and running the sequence
// again: a note event carries a timbre rather than a label, so the only honest way to
// ask is to ask the sequencer.
const perChannel = []

for (let channel = 1; channel <= 8; channel++) {
  const mutes = new ChannelMutes()
  mutes.setSoloed(channel, true)

  const solo = new Sequencer(ProjectFormat.read(preset.text), mutes)
  solo.play(0, 0)

  let count = 0

  for (let position = 0; position < frames; position += SampleRate / 4) {
    const scheduled = []
    solo.schedule(position, SampleRate / 4, SampleRate, scheduled)
    count += scheduled.length
  }

  if (count > 0) perChannel.push('CH' + channel + '=' + count)
}

console.log(preset.name + ': ' + notes + ' notes over ' + seconds + 's at ' +
            project.tempo + 'bpm')
console.log('  by channel: ' + perChannel.join(' '))
console.log('  peak ' + peak.toFixed(3) + '  rms ' + rms.toFixed(3) +
            '  (' + (20 * Math.log10(rms)).toFixed(1) + ' dBFS)')

// 16 bit stereo PCM, which is the whole of what a WAV needs to be.

const data = Buffer.alloc(frames * 4)

for (let i = 0; i < frames; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4)
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2)
}

const header = Buffer.alloc(44)

header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)            // PCM
header.writeUInt16LE(2, 22)            // stereo
header.writeUInt32LE(SampleRate, 24)
header.writeUInt32LE(SampleRate * 4, 28)
header.writeUInt16LE(4, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

await writeFile(output, Buffer.concat([header, data]))

console.log('  wrote ' + output)
