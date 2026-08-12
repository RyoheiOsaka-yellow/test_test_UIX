// The tile hierarchy.
//
// Four categories, as laid out in sequencer.md: notes sound, parameter locks
// operate on the timbre, gates decide whether what hangs below them fires, and
// flow tiles steer the sequence. A category word only appears in a concrete name
// when the modifier alone would not carry the meaning, so there is an
// AbsoluteParamTile and a CycleGateTile but a plain JumpTile.
//
// Token is the four character code a tile is spelled with, not the data. It is what
// a saved file writes and what this codebase calls a tile by; it is not what the UI
// shows, since a panel names a tile in words and a cell draws an icon. The note is
// the exception at both ends: its token is the pitch name itself.

import * as Pitch from './pitch.js'
import * as ParamTargets from './params.js'

const number = value => {
  const rounded = Math.round(value * 100000) / 100000
  return String(rounded)
}

export class Tile {
  get token() { return '????' }
}

// Notes

// Length is measured in steps, defaulting to one. What a step is worth in real time
// comes from the channel's division and the project tempo.

export class NoteTile extends Tile {
  constructor(note = 60, length = 1) {
    super()
    this.note = note
    this.length = length
  }

  get hasDefaultLength() { return Math.abs(this.length - 1) < 1e-4 }

  get token() {
    return this.hasDefaultLength ? Pitch.toName(this.note)
      : Pitch.toName(this.note) + '/' + number(this.length)
  }
}

// Parameter locks

// One tile reaches as many parameters as it likes. A parameter nothing has engaged
// is left entirely alone, which is why a lock that engages nothing does nothing at
// all — that is allowed, and it is what a lock looks like the moment it is placed.

export class ParamTile extends Tile {
  constructor() {
    super()
    this._engaged = new Array(ParamTargets.Count).fill(false)
    this._amounts = new Array(ParamTargets.Count).fill(0)
  }

  isEngaged(target) { return this.inRange(target) && this._engaged[target] }

  // What the lock moves the target to, or by. Zero when it has not taken hold of
  // that one, which is nothing to add and is never read as a value to set.
  amount(target) {
    return this.inRange(target) && this._engaged[target] ? this._amounts[target] : 0
  }

  engage(target, amount) {
    if (!this.inRange(target)) return
    this._engaged[target] = true
    this._amounts[target] = amount
  }

  // Letting go forgets the amount as well. A released slot shows what the channel
  // does without it, so a number kept behind the panel would only be a second value
  // with a claim on the same row.
  release(target) {
    if (!this.inRange(target)) return
    this._engaged[target] = false
    this._amounts[target] = 0
  }

  get isEmpty() { return !this._engaged.some(engaged => engaged) }

  inRange(target) { return target >= 0 && target < ParamTargets.Count }
}

export class AbsoluteParamTile extends ParamTile {
  get token() { return 'PABS' }
}

export class RelativeParamTile extends ParamTile {
  get token() { return 'PREL' }
}

// Gates

// A gate ends the walk down its stack when it does not fire, so it governs
// everything below it in the step and nothing above it.

export class GateTile extends Tile {
  // pass counts how many times the runner has been round its own channel, so a
  // cycle gate can pick a lap.
  evaluate(_pass, _random) { return true }
}

// Fires on whichever laps of the cycle are switched on, a lap being one time round
// the channel the gate stands on.
//
// A lap is a switch and not a number: every lap having a switch of its own costs
// the tile nothing — the whole cycle is one word — and it is what turns the period
// into a bar rather than a pointer. The period reaches 32, and the laps above it are
// kept rather than cleared, so a period pulled in and let back out finds its
// switches where it left them.

export class CycleGateTile extends GateTile {
  static MinPeriod = 2
  static MaxPeriod = 32

  constructor(period = 4, pattern = null) {
    super()
    this._period = CycleGateTile.clampPeriod(period)
    this._mask = 1
    if (pattern != null) this.pattern = pattern
  }

  get period() { return this._period }
  set period(value) { this._period = CycleGateTile.clampPeriod(value) }

  fires(lap) { return (this._mask & CycleGateTile.bit(lap)) !== 0 }

  setFires(lap, fires) {
    const bit = CycleGateTile.bit(lap)
    this._mask = fires ? (this._mask | bit) >>> 0 : (this._mask & ~bit) >>> 0
  }

  // The laps of the current period as one digit each, the first lap leftmost: the
  // order the cell draws them in and the order a file writes them in.
  get pattern() {
    let digits = ''
    for (let lap = 1; lap <= this._period; lap++) digits += this.fires(lap) ? '1' : '0'
    return digits
  }

  set pattern(value) {
    this._mask = 0
    for (let lap = 1; lap <= value.length; lap++) this.setFires(lap, value[lap - 1] === '1')
  }

  // A gate switched on nowhere never fires, which is inert rather than wrong.
  evaluate(pass) {
    return this.fires(((pass % this._period) + this._period) % this._period + 1)
  }

  get token() { return 'GCYC' + this._period + ':' + this.pattern }

  static clampPeriod(value) {
    return Math.min(Math.max(Math.round(value), CycleGateTile.MinPeriod),
                    CycleGateTile.MaxPeriod)
  }

  static bit(lap) {
    return lap < 1 || lap > CycleGateTile.MaxPeriod ? 0 : (1 << (lap - 1)) >>> 0
  }
}

// Fires with the given chance. Any percentage is allowed: the pie chart shows
// whatever fraction it is given, so there is no reason to quantize it.

export class ProbGateTile extends GateTile {
  constructor(percent = 50) {
    super()
    this.percent = percent
  }

  get percent() { return this._percent }
  set percent(value) { this._percent = Math.min(Math.max(value, 0), 100) }

  evaluate(_pass, random) { return random() * 100 < this._percent }

  get token() { return 'GPRB:' + number(this._percent) }
}

// Flow

export class FlowTile extends Tile {}

// Start of a channel's stream. Division is the note value of one step as a
// denominator, so 16 means a sixteenth note. The channel number picks the timbre as
// well as the stream.

export class ChannelTile extends FlowTile {
  // Powers of two from a whole note to a sixty-fourth, plus the triplet
  // denominators that make a lane swing against the others.
  static Divisions = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]
  static MaxChannels = 8

  constructor(channel = 1, division = 16) {
    super()
    this.channel = channel
    this.division = division
  }

  get channel() { return this._channel }
  set channel(value) { this._channel = clampChannel(value) }

  get division() { return this._division }
  set division(value) { this._division = ChannelTile.clampDivision(value) }

  get token() { return 'CHAN:' + this._channel }

  // Seconds taken by one step at the given tempo.
  stepSeconds(tempo) {
    return 60 / Math.max(tempo, 1) * 4 / this._division
  }

  static clampDivision(value) {
    let best = 16
    for (const d of ChannelTile.Divisions)
      if (Math.abs(d - value) < Math.abs(best - value)) best = d
    return best
  }
}

// Channel numbers are one based, and one from outside the bank is folded in rather
// than rejected: the editor cannot produce one, but a hand edited file can.
export const clampChannel = channel =>
  Math.min(Math.max(Math.round(channel), 1), ChannelTile.MaxChannels)

// End of a lane. Never stored: it is implied one column past the last step, and
// reaching it sends the runner back to the channel it started from.

export class TerminatorTile extends FlowTile {
  get token() { return 'TERM' }
}

// Leaves this lane for the one lane that answers to it. On its own it only
// duplicates a longer lane, so it earns its keep when a gate sits above it.

export class JumpTile extends FlowTile {
  get token() { return 'JUMP' }
}

// Where a jump lands, and the head of a branch lane. Exactly one jump reaches it,
// which the lane records rather than the tile.

export class JumpDestTile extends FlowTile {
  get token() { return 'JDST' }
}

// What can be asked for by name, which is only the tiles a user puts down: the
// terminator is implied and a jump destination arrives with the jump that reaches
// it, so neither is ever asked for. Deliberately not the file format's four
// character token — a token is a spelling for a file, and the panel that offers
// these names them in words.

export const TileKind = {
  Note: 'Note',
  AbsoluteLock: 'Absolute Lock',
  RelativeLock: 'Relative Lock',
  CycleGate: 'Cycle Gate',
  ChanceGate: 'Chance Gate',
  Jump: 'Jump'
}
