// The scores the app can open without a file.
//
// The first is what it opens on; the original's own startup score is kept beside it
// unchanged, since it is the piece the port was checked against.

import { BeatAndBass } from './beat-and-bass.js'
import { StartupScore } from './startup.js'

export const Presets = [
  { name: 'Beat & Bass', text: BeatAndBass },
  { name: 'Electro Jam', text: StartupScore }
]
