// What a parameter lock can point at.
//
// sequencer.md leaves this set to the synth: the sequencer only carries an index
// and an amount, and everything about what the index means lives here alongside
// the patch it addresses.
//
// The set is exactly the fields of FmPatch, so there is no parameter a lock cannot
// reach. The names are the musician's rather than the synthesis textbook's; the
// constants and the file keys keep the older spellings, since renaming those would
// only be a way to make older files unopenable for the sake of a caption.

export const Level = 0
export const Pan = 1
export const Gate = 2
export const ModRatio = 3
export const ModIndex = 4
export const Feedback = 5
export const ModDecay = 6
export const CarAttack = 7
export const CarRelease = 8
export const PitchSweep = 9
export const PitchDecay = 10
export const ReverbSend = 11
export const DelaySend = 12

export const Count = 13

export const Names = [
  'Level', 'Pan', 'Gate ratio', 'FM ratio', 'FM amount', 'Feedback',
  'FM decay', 'Amp attack', 'Amp release', 'Pitch sweep', 'Pitch decay',
  'Reverb send', 'Delay send'
]

export const name = target =>
  target >= 0 && target < Count ? Names[target] : '?'

// Spelling used in a saved file, where a space would break the tokenizer.
export const Keys = [
  'level', 'pan', 'gate', 'ratio', 'index', 'feedback',
  'moddecay', 'carattack', 'carrelease', 'pitchsweep', 'pitchdecay',
  'rsend', 'dsend'
]

export const key = target =>
  target >= 0 && target < Count ? Keys[target] : 'level'

export const parse = key => Keys.indexOf(key)

// The field of FmPatch each target addresses. One table rather than three
// switches, since JavaScript has no ref to a struct field to hand around.
const Fields = [
  'level', 'pan', 'gateScale', 'modulatorRatio', 'modulationIndex', 'feedback',
  'modulatorDecay', 'carrierAttack', 'carrierRelease', 'pitchSweep',
  'pitchDecay', 'reverbSend', 'delaySend'
]

export const field = target => Fields[target]

// Ranges. The gate ratio is a multiplier on the note's own length and the pitch
// sweep is in octaves; the rest are the oscillator and envelope units.
export function min(target) {
  switch (target) {
    // A twentieth, which is barely a ratio any more. It stops well above zero
    // because a modulator that does not turn is not one.
    case ModRatio: return 0.05
    case Gate: return 0.05
    case CarAttack: return 0.001
    // Symmetric about the centre, which is also what tells the bar to draw itself
    // out from where the note is unpanned rather than from the left edge.
    case Pan: return -1
    case PitchSweep: return -8
    default: return 0
  }
}

export function max(target) {
  switch (target) {
    case Level: return 1
    case Gate: return 4
    case ModIndex: return 12
    case ModRatio: return 8
    case Feedback: return 8
    // Two seconds, which is a pad's swell rather than an instrument's attack.
    case CarAttack: return 2
    // Well past anything musical, because the release also decides how long a
    // note holds on to its voice.
    case CarRelease: return 4
    case PitchSweep: return 8
    case PitchDecay: return 2
    default: return 1
  }
}

const clamp = (value, low, high) => value < low ? low : value > high ? high : value

export const get = (patch, target) => patch[Fields[target]] ?? 0

export function set(patch, target, value) {
  if (target < 0 || target >= Count) return
  patch[Fields[target]] = clamp(value, min(target), max(target))
}

export const add = (patch, target, delta) => set(patch, target, get(patch, target) + delta)
