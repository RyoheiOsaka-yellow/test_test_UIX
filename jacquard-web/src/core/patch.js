// The timbre, and the note event it is stamped into.
//
// The synth stores no patch of its own: this is stamped into every note event as
// it is scheduled, which is also why a parameter lock can alter one note without
// disturbing anything else. gateScale is not an oscillator setting but lives here
// so that every lock target is a plain field of one object — and every field is a
// lock target, which is what makes ParamTargets a list of these thirteen and
// nothing else.
//
// Three of them are not oscillator settings at all: where the note sits across the
// stereo image, and how much of it goes to each of the two send effects, whose own
// settings belong to the project rather than to a timbre. They are here because
// each is worth locking — a reverb on one note of a chord, or that note thrown to
// one side, is exactly the accent a lock exists for — and because a position and a
// send decided at note-on never have to be smoothed.
//
// The two operators get deliberately different envelope shapes. The carrier gates
// the output, so it is an AR; the modulator only colours the tone, so it is a
// single decay from full depth. A third envelope moves the pitch itself, which is
// what turns this patch into a kick drum.

import * as Pitch from './pitch.js'

// Exponential fades from 1 to 0 over x in [0,1], ported from the unity-sap-test
// prototype. Both are normalized so that they reach exactly 0 at x = 1, which is
// what lets a voice end in silence instead of being cut off.
//
// Snap is the same shape with a far steeper curve: a tenth of the way in it is
// already down to a fifth of its depth. That is too abrupt for a level and exactly
// what a pitch envelope needs to come out as a thump rather than as a sweep.

const Curve = 5, Tail = Math.exp(-5)
const SnapCurve = 16, SnapTail = Math.exp(-16)

export const fade = x => (Math.exp(-Curve * x) - Tail) / (1 - Tail)
export const snap = x => (Math.exp(-SnapCurve * x) - SnapTail) / (1 - SnapTail)

// The pitch envelope starts out at no depth and the sends start silent, so a
// project that never opens a panel sounds exactly as it did before there was one.
// Pan starts centred, which the pan law below is normalized to render exactly as
// an unpanned note used to.
export const defaultPatch = () => ({
  level: 0.8,           // Output level [0,1]
  pan: 0.0,             // Across the image, -1 hard left to +1 hard right
  gateScale: 1.0,       // Multiplies the note's gate length
  modulatorRatio: 2.0,  // Modulator frequency as a ratio of frequency
  modulationIndex: 3.0, // Peak modulation depth in radians
  feedback: 0.0,        // Modulator self-feedback depth in radians
  modulatorDecay: 0.2,  // How steeply the modulation falls away [0,1]
  carrierAttack: 0.005, // Time to reach full level (seconds)
  carrierRelease: 0.12, // Time to fall to silence after the gate
  pitchSweep: 0.0,      // Depth of the pitch envelope in octaves
  pitchDecay: 0.05,     // Time for the pitch to arrive at frequency
  reverbSend: 0.0,      // How much of the note reaches the reverb [0,1]
  delaySend: 0.0        // How much of it reaches the delay [0,1]
})

export const copyPatch = patch => ({ ...patch })

const clamp = (value, low, high) => value < low ? low : value > high ? high : value

// A note-on event: the complete patch alongside pitch, timing and the exact sample
// to start on. Nothing about how it sounds is stored anywhere else.
//
// Note that level is an output level, not a velocity: nothing in here describes how
// a note was played, only what comes out.

export function noteEvent(patch, note, gateSeconds, startSample) {
  const level = clamp(patch.level, 0, 1)

  return {
    startSample,
    frequency: Pitch.toFrequency(note),
    level,
    pan: clamp(patch.pan, -1, 1),
    duration: Math.max(gateSeconds * patch.gateScale, 0.005),
    // Louder notes outrank quieter ones when the pool runs out of voices, so an
    // accent survives a dense chord.
    priority: Math.round(level * 8),
    modulatorRatio: patch.modulatorRatio,
    modulationIndex: patch.modulationIndex,
    feedback: patch.feedback,
    modulatorDecay: patch.modulatorDecay,
    carrierAttack: patch.carrierAttack,
    carrierRelease: patch.carrierRelease,
    pitchSweep: patch.pitchSweep,
    pitchDecay: patch.pitchDecay,
    reverbSend: patch.reverbSend,
    delaySend: patch.delaySend
  }
}

// Total time the note occupies a voice, gate plus carrier release.
export const totalDuration = note => note.duration + note.carrierRelease

const Root2 = Math.SQRT2

// The two gains the dry signal is rendered at. Equal power: the pair is a point on
// a circle rather than on a line, so a note keeps its weight as it crosses instead
// of sagging in the middle the way a pair of straight fades does.
//
// The circle is scaled so that the centre is unity rather than the ends, which
// makes a patch that never touches pan render exactly as it did before there was
// one. What it costs is 3dB of headroom at the extremes, where the soft clip at the
// end of the mix is already what a dense chord relies on.
export function panGains(note) {
  const position = clamp(note.pan ?? 0, -1, 1)

  // A quarter turn of travel: hard left at zero and hard right at a right angle,
  // with the centre halfway between at 45 degrees.
  const angle = (position + 1) * (Math.PI / 4)

  return [Math.cos(angle) * Root2, Math.sin(angle) * Root2]
}

const attackLevel = (note, time) =>
  time < note.carrierAttack ? time / note.carrierAttack : 1

// Carrier level: rise over the attack, hold for the rest of the gate, then release
// from whatever level was actually reached, so a note shorter than its own attack
// still fades out without a discontinuity.
export function carrierLevel(note, time) {
  if (time < note.duration) return attackLevel(note, time)

  const t = time - note.duration
  if (t >= note.carrierRelease) return 0

  return attackLevel(note, note.duration) * fade(t / note.carrierRelease)
}

// What half the FM decay's travel is worth, and so where the useful part of that
// travel sits.
const DecayUnit = 0.1

// Modulation depth: full at the note start, falling away at whatever slope the
// patch asks for. It ignores the gate, so the tail of a long note settles into a
// plain sine, which is the classic two operator behaviour.
//
// modulatorDecay is the slope rather than a length: 0 stands the decay up
// vertically and the note is a plain sine, 1 lays it flat and the full depth holds
// for the life of the note, and between them it is an exponential with a time
// constant of DecayUnit * v / (1 - v).
export function modulatorLevel(note, time) {
  if (note.modulatorDecay >= 1) return 1
  if (note.modulatorDecay <= 0) return 0

  return Math.exp(-time * (1 - note.modulatorDecay) /
                  (note.modulatorDecay * DecayUnit))
}

// Pitch envelope, as a multiplier on the note frequency. Measured in octaves rather
// than in Hz, so one setting bends every note by the same interval. Past the decay
// it is exactly 1, which also covers a decay of zero.
export const pitchScale = (note, time) =>
  time >= note.pitchDecay ? 1
  : Math.pow(2, note.pitchSweep * snap(time / note.pitchDecay))
