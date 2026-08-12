// Which channels are heard, held apart from the score.
//
// A mute is not an edit. The runners go on running whatever this says — a muted lane
// keeps its place in the bar, its laps go on counting, its cycle gates go on turning
// over and its jumps are still taken — and the one thing that changes is that the
// notes it reaches are not handed to the synth. So letting a channel back in is
// hearing it from where the sequence has got to.
//
// Solo is a mute of everything else, which is why the two live in one object: with
// anything soloed the question a channel is asked is whether it is one of them, and
// the mutes are simply not consulted. They are kept rather than cleared, so that
// dropping the last solo gives back the mix that was there before it.
//
// None of this is saved. What a file holds is the piece, and a hand held over one
// channel of it is a performance.

import { Channels } from './project.js'
import { clampChannel } from './tiles.js'

const index = channel => clampChannel(channel) - 1

export class ChannelMutes {
  constructor() {
    this.muted = new Array(Channels).fill(false)
    this.soloed = new Array(Channels).fill(false)
  }

  isMuted(channel) { return this.muted[index(channel)] }
  setMuted(channel, muted) { this.muted[index(channel)] = muted }

  isSoloed(channel) { return this.soloed[index(channel)] }
  setSoloed(channel, soloed) { this.soloed[index(channel)] = soloed }

  // Whether anything at all is soloed, which is what decides which of the two sets is
  // being read.
  get anySoloed() { return this.soloed.some(soloed => soloed) }

  // The one question the sequencer asks.
  sounds(channel) {
    return this.anySoloed ? this.isSoloed(channel) : !this.isMuted(channel)
  }
}
