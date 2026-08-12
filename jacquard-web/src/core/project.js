// The unit of file saving, sitting above the score, plus the two things that
// belong to everything rather than to a note: the send effects and the limiter.

import { Score } from './score.js'
import {
  ChannelTile, JumpDestTile, JumpTile, NoteTile, CycleGateTile, ProbGateTile,
  AbsoluteParamTile, RelativeParamTile, clampChannel
} from './tiles.js'
import { defaultPatch } from './patch.js'
import * as ParamTargets from './params.js'
import * as Pitch from './pitch.js'

// The note values a delay time is chosen from.
//
// A delay that is not in time with the sequence is a delay nobody reaches for, so
// the time is never a number of milliseconds: it is a note value, and what it comes
// to in seconds is whatever the project's tempo says. The rungs run from shortest to
// longest, because the control is a pair of arrows.

export const DelayTime = {
  Names: ['1/32', '1/16T', '1/16', '1/8T', '1/16D', '1/8', '1/4T', '1/8D', '1/4'],

  // In beats, so a rung times 60/tempo is a time in seconds.
  Beats: [0.125, 1 / 6, 0.25, 1 / 3, 0.375, 0.5, 2 / 3, 0.75, 1],

  Default: 5, // 1/8

  // The longest a rung can ask for, which is what sizes the delay line.
  LongestSeconds: 3,

  // Which rung a stored time is on. The time is kept as a number of beats rather
  // than as an index, so that the value in a file still means what it says if the
  // table is ever re-cut.
  nearest(beats) {
    let nearest = DelayTime.Default
    let distance = Infinity

    DelayTime.Beats.forEach((value, i) => {
      const d = Math.abs(value - beats)
      if (d >= distance) return
      nearest = i
      distance = d
    })

    return nearest
  }
}

// The two send effects, as the project holds them. Seven numbers for two effects,
// which is the whole of the design brief: a pair of controls that can be swept while
// the sequence plays, not a studio's worth of them.

export const MaxFeedback = 0.95

export const defaultSendFx = () => ({
  reverbSize: 0.5,   // Tail length, short room to long hall
  reverbDamp: 0.5,   // How fast the tail loses its top
  reverbWidth: 1.0,  // Correlated pair to fully spread
  delayBeats: DelayTime.Beats[DelayTime.Default],
  delayFeedback: 0.35,
  delayTone: 0.4,
  delaySpread: 0.0
})

// The delay time at a tempo. The same arithmetic a lane's step uses, since a beat
// is a beat.
export const delaySeconds = (fx, tempo) => fx.delayBeats * 60 / Math.max(tempo, 1)

// The one effect on the finished mix. Off, in the sense that matters: no drive and a
// ceiling at full scale leaves everything under it untouched, so a project that never
// opens the Global panel sounds exactly as it did before there was one.

export const Limiter = {
  MaxDrive: 24,
  MinCeiling: -24,
  MinAttack: 0.0002, MaxAttack: 0.05,
  MinRelease: 0.01, MaxRelease: 1.0,

  // Decibels as a gain. The only place either of the two is a multiplier.
  gain: decibels => Math.pow(10, decibels / 20)
}

export const defaultLimiter = () => ({
  drive: 0.0,   // How hard the mix is pushed into the ceiling, in dB
  ceiling: 0.0, // What the output is held under, in dB below full scale
  attack: 0.005,
  release: 0.15
})

// One timbre per channel. The bank is a set of starting values, not state: a lock
// never outlives the instant it sits in, so the sequencer copies the bank into a
// working one at the top of every instant and writes only that.

export const Channels = 8

export class PatchBank {
  constructor() {
    this.patches = []
    for (let i = 0; i < Channels; i++) this.patches.push(defaultPatch())
  }

  at(channel) { return this.patches[clampChannel(channel) - 1] }

  set(channel, patch) { this.patches[clampChannel(channel) - 1] = patch }
}

export class Project {
  constructor() {
    this.tempo = 132
    this.beatsPerBar = 4
    this.beatUnit = 4
    this.fx = defaultSendFx()
    this.limiter = defaultLimiter()
    this.score = new Score()
    this.patches = new PatchBank()
  }

  // An empty project still needs one lane to type into.
  static createEmpty() {
    const project = new Project()
    project.score.addLane(1, 1, new ChannelTile(), 16)
    return project
  }

  // The mockup score from mockup.html, which is also the demonstration case: three
  // lanes, a conditional jump into a variation, and an accent lane that has no notes
  // of its own. Kept as the self test's fixture, since a fixture is better as code
  // than as an asset that can be edited out from under a check.
  static createSample() {
    const project = new Project()
    const score = project.score

    const fill = (lane, step, ...tiles) => lane.steps[step].tiles.push(...tiles)

    const lock = (tile, target, amount) => {
      tile.engage(target, amount)
      return tile
    }

    const n = name => Pitch.tryParse(name)

    // Four steps against the main lane's sixteen, with no notes of its own: the
    // locks reach whatever this channel sounds later in the same instant, and later
    // means further down the plane, so this lane sits at the top.
    const accent = score.addLane(1, 1, new ChannelTile(1), 4)
    fill(accent, 0, lock(new RelativeParamTile(), ParamTargets.Level, 0.2))
    fill(accent, 2, lock(new RelativeParamTile(), ParamTargets.Level, -0.35))

    const main = score.addLane(1, 3, new ChannelTile(1), 16)

    fill(main, 0, new NoteTile(n('C4'), 4), new NoteTile(n('E4')), new NoteTile(n('G4')))
    fill(main, 2, new NoteTile(n('F#4'), 0.5))
    // Above the note it colours, which is the only place it can be.
    fill(main, 3, lock(new AbsoluteParamTile(), ParamTargets.ModIndex, 7),
                  new NoteTile(n('A4')))
    fill(main, 5, new NoteTile(n('G4')))
    // A lock partway down a chord, so the two notes under it are brighter than the
    // one above it: the stack is read downwards, so the split is legible.
    fill(main, 8, new CycleGateTile(4, '0010'),
                  new NoteTile(n('F4')),
                  lock(new RelativeParamTile(), ParamTargets.ModIndex, 3),
                  new NoteTile(n('G#4'), 1.5),
                  new NoteTile(n('C5')))

    const jump = new JumpTile()
    fill(main, 9, new CycleGateTile(4, '0001'), jump)

    fill(main, 10, new NoteTile(n('A#4')))
    fill(main, 11, new ProbGateTile(35), new NoteTile(n('B4')), new NoteTile(n('D5')))
    fill(main, 13, lock(new RelativeParamTile(), ParamTargets.ModDecay, 0.5),
                   new NoteTile(n('E5'), 2))

    // The branch lane, entered only through that one jump. Ten main steps plus six
    // here comes to sixteen either way, so a lap is the same length whether it jumps
    // or not.
    const variation = score.addLane(6, 9, new JumpDestTile(), 6)
    variation.jumpSource = jump

    fill(variation, 0, new NoteTile(n('D#5')), new NoteTile(n('C5')), new NoteTile(n('G#4')))
    fill(variation, 2, new NoteTile(n('A#4'), 0.5))
    fill(variation, 3, new ProbGateTile(70), new NoteTile(n('G4')))
    fill(variation, 4, new NoteTile(n('F4')))

    return project
  }
}
