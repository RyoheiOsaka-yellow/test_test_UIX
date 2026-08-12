// Note names and frequencies.
//
// Pitches are MIDI note numbers throughout, with 60 spelled C4. Only sharps are
// used: sequencer.md drops flats so that one pitch has exactly one spelling and a
// cell therefore has exactly one look.

const Names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Floor modulo, so that negative note numbers still name correctly.
const mod = (a, b) => ((a % b) + b) % b

export const Lowest = 12   // C0
export const Highest = 120 // C9

export const toName = note => Names[mod(note, 12)] + (Math.floor(note / 12) - 1)

// Name without the octave, for the cell label where the two are typeset
// separately.
export const toClassName = note => Names[mod(note, 12)]

export const toOctave = note => Math.floor(note / 12) - 1

export const isSharp = note => Names[mod(note, 12)].length > 1

// Equal temperament, A4 = 440Hz. The note is a float rather than an int so that
// anything bending a pitch can ask for a frequency between two semitones.
export const toFrequency = note => 440 * Math.pow(2, (note - 69) / 12)

// Parses a name such as "C4", "F#4" or "G#-1". Flats are rejected.
export function tryParse(text) {
  if (!text) return null

  let index = Names.indexOf(text[0].toUpperCase())
  if (index < 0) return null

  let i = 1

  if (i < text.length && (text[i] === '#' || text[i] === 's')) {
    index++
    i++
  }

  if (i >= text.length) return null

  const octave = text.slice(i)
  if (!/^-?\d+$/.test(octave)) return null

  const note = (Number(octave) + 1) * 12 + index
  return note >= 0 && note < 128 ? note : null
}
