// The file format: a line of text per lane element, tokens separated by spaces.
//
// A token is not the data — sequencer.md is explicit about that — so the file has
// its own spellings, chosen to be unambiguous rather than to look like a cell. A
// jump is recorded as the coordinate of the JUMP cell on the branch lane that
// answers to it: there is nowhere to write a second jump, so one to one holds by
// construction.
//
//   jacquard 11
//   tempo 132
//   meter 4 4
//   fx rsize=0.5 rdamp=0.5 ...
//   limiter drive=0 ceiling=0 attack=0.005 release=0.15
//   patch 1 level=0.8 index=3 ...
//   lane 1 1 CHAN:1 div=16
//     step C4/4 E4 G4
//     step
//     step GCYC:4,0001 JUMP
//   lane 6 8 JDST from=10,2
//     step D#5 C5 G#4
//
// Version 11 adds the limiter; 10 makes the FM decay a slope rather than a length of
// time and converts an md= and an absolute lock on the way in; 9 gives a cycle gate a
// switch per lap; 8 adds a pan; 7 adds the two send effects; 6 lets one lock hold any
// number of parameters; 5 drops detune; 4 drops PACC; 3 gives every channel its own
// timbre; 2 was the two operator patch.

import { Project, PatchBank, Channels, defaultSendFx, defaultLimiter } from './project.js'
import {
  ChannelTile, JumpDestTile, JumpTile, NoteTile, CycleGateTile, ProbGateTile,
  AbsoluteParamTile, RelativeParamTile, ParamTile, clampChannel
} from './tiles.js'
import * as ParamTargets from './params.js'
import * as Pitch from './pitch.js'
import { point } from './lane.js'

export const Version = 11
export const Extension = '.jacquard'

// Matches C#'s "0.#####": up to five decimals, trailing zeros dropped.
const f = value => {
  const rounded = Math.round(value * 100000) / 100000
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

// Writing

export function write(project) {
  let text = ''

  text += 'jacquard ' + Version + '\n'
  text += 'tempo ' + f(project.tempo) + '\n'
  text += 'meter ' + project.beatsPerBar + ' ' + project.beatUnit + '\n'
  text += 'fx ' + writeFx(project.fx) + '\n'
  text += 'limiter ' + writeLimiter(project.limiter) + '\n'

  // Every channel gets a line, whether anything plays on it or not: a regular file
  // is worth more here than a short one, and a bank of eight is small.
  for (let channel = 1; channel <= Channels; channel++)
    text += 'patch ' + channel + ' ' + writePatch(project.patches.at(channel)) + '\n'

  for (const lane of project.score.lanes) text += writeLane(project.score, lane)

  return text
}

function writeLane(score, lane) {
  let text = 'lane ' + lane.x + ' ' + lane.y + ' '

  if (lane.channel != null) {
    text += 'CHAN:' + lane.channel.channel + ' div=' + lane.channel.division
  } else {
    text += 'JDST'

    // Where the jump that reaches this lane currently sits. A branch lane whose jump
    // has gone missing is written without one and is read back as unreachable rather
    // than dropped.
    const source = lane.jumpSource == null ? null : score.locate(lane.jumpSource)
    if (source != null) text += ' from=' + source.x + ',' + source.y
  }

  text += '\n'

  for (const step of lane.steps) {
    text += '  step'
    for (const tile of step.tiles) text += ' ' + writeTile(tile)
    text += '\n'
  }

  return text
}

function writeTile(tile) {
  if (tile instanceof NoteTile)
    return tile.hasDefaultLength ? Pitch.toName(tile.note)
      : Pitch.toName(tile.note) + '/' + f(tile.length)

  if (tile instanceof AbsoluteParamTile) return 'PABS' + writeLock(tile)
  if (tile instanceof RelativeParamTile) return 'PREL' + writeLock(tile)
  if (tile instanceof CycleGateTile) return 'GCYC:' + tile.period + ',' + tile.pattern
  if (tile instanceof ProbGateTile) return 'GPRB:' + f(tile.percent)
  if (tile instanceof JumpTile) return 'JUMP'

  return tile.token
}

// The parameters a lock has taken hold of, as key,value pairs. A lock holding none
// of them writes as the bare token: there is nothing to say about it, and a trailing
// colon would only look like something went missing.
function writeLock(tile) {
  let text = ''

  for (let target = 0; target < ParamTargets.Count; target++) {
    if (!tile.isEngaged(target)) continue
    text += (text.length === 0 ? ':' : ',') +
            ParamTargets.key(target) + ',' + f(tile.amount(target))
  }

  return text
}

const writePatch = patch =>
  'level=' + f(patch.level) +
  ' pan=' + f(patch.pan) +
  ' gate=' + f(patch.gateScale) +
  ' mratio=' + f(patch.modulatorRatio) +
  ' index=' + f(patch.modulationIndex) +
  ' fb=' + f(patch.feedback) +
  ' md=' + f(patch.modulatorDecay) +
  ' ca=' + f(patch.carrierAttack) +
  ' cr=' + f(patch.carrierRelease) +
  ' ps=' + f(patch.pitchSweep) +
  ' pd=' + f(patch.pitchDecay) +
  ' rsend=' + f(patch.reverbSend) +
  ' dsend=' + f(patch.delaySend)

const writeLimiter = limiter =>
  'drive=' + f(limiter.drive) +
  ' ceiling=' + f(limiter.ceiling) +
  ' attack=' + f(limiter.attack) +
  ' release=' + f(limiter.release)

const writeFx = fx =>
  'rsize=' + f(fx.reverbSize) +
  ' rdamp=' + f(fx.reverbDamp) +
  ' rwidth=' + f(fx.reverbWidth) +
  ' dbeats=' + f(fx.delayBeats) +
  ' dfb=' + f(fx.delayFeedback) +
  ' dtone=' + f(fx.delayTone) +
  ' dspread=' + f(fx.delaySpread)

// Reading

export function read(text) {
  const project = new Project()
  const score = project.score

  let lane = null

  // Resolved once every lane is in place, since a jump may well sit on a lane that
  // appears later in the file.
  const links = []

  const lines = text.split('\n')

  // What the file was written at, which decides whether a value needs converting on
  // the way in. A fragment without a version line is taken as current.
  let version = Version

  for (let number = 0; number < lines.length; number++) {
    const tokens = lines[number].split(/[ \t\r]+/).filter(token => token.length > 0)
    if (tokens.length === 0 || tokens[0].startsWith('#')) continue

    switch (tokens[0]) {
      case 'jacquard':
        if (tokens.length > 1) version = readInt(tokens[1])
        if (version > Version) throw fail(number, 'file is from a newer version')
        break

      case 'tempo':
        project.tempo = readFloat(arg(tokens, 1, number))
        break

      case 'meter':
        project.beatsPerBar = readInt(arg(tokens, 1, number))
        project.beatUnit = readInt(arg(tokens, 2, number))
        break

      case 'fx':
        readFx(project.fx, tokens)
        break

      case 'limiter':
        readLimiter(project.limiter, tokens)
        break

      case 'patch':
        readPatchLine(project, tokens, version)
        break

      case 'lane':
        lane = readLane(score, tokens, number, links)
        break

      case 'step':
        if (lane == null) throw fail(number, 'step outside a lane')
        readStep(lane.addStep(), tokens, number, version)
        break

      default:
        throw fail(number, 'unknown keyword ' + tokens[0])
    }
  }

  for (const [branch, p] of links) {
    const cell = score.at(p)
    if (cell.tile instanceof JumpTile) branch.jumpSource = cell.tile
  }

  return project
}

function readLane(score, tokens, number, links) {
  const x = readInt(arg(tokens, 1, number))
  const y = readInt(arg(tokens, 2, number))
  const head = arg(tokens, 3, number)

  let tile

  if (head.startsWith('CHAN')) {
    const channel = new ChannelTile()
    const colon = head.indexOf(':')
    if (colon >= 0) channel.channel = readInt(head.slice(colon + 1))
    tile = channel
  } else if (head === 'JDST') {
    tile = new JumpDestTile()
  } else {
    throw fail(number, 'a lane head must be CHAN or JDST')
  }

  const lane = score.addLane(x, y, tile, 0)

  for (let i = 4; i < tokens.length; i++) {
    const [key, value] = split(tokens[i])

    if (key === 'div' && tile instanceof ChannelTile) tile.division = readInt(value)
    else if (key === 'from') links.push([lane, readPoint(value, number)])
  }

  return lane
}

function readStep(step, tokens, number, version) {
  for (let i = 1; i < tokens.length; i++) {
    // A tile the synth has no answer for any more comes back as nothing, and the
    // step is simply one tile shorter than it was written with.
    const tile = readTile(tokens[i], number, version)
    if (tile != null) step.tiles.push(tile)
  }
}

// version reaches only as far as the locks: they are the one kind of tile that
// carries a synth parameter's own value, and so the one kind a change of units under
// the synth can leave holding the wrong number.
function readTile(token, number, version) {
  const colon = token.indexOf(':')
  const head = colon < 0 ? token : token.slice(0, colon)
  const args = colon < 0 ? '' : token.slice(colon + 1)

  switch (head) {
    case 'PABS': return readLock(new AbsoluteParamTile(), args, number, version)

    // A version 3 PACC becomes the relative lock it was a running total of, which is
    // as close as a file from before the change can get.
    case 'PREL':
    case 'PACC':
      return readLock(new RelativeParamTile(), args, number, version)

    case 'GCYC': {
      const parts = args.split(',')
      const gate = new CycleGateTile()
      if (parts.length > 0 && parts[0] !== '') gate.period = readInt(parts[0])
      if (parts.length > 1) readLaps(gate, parts[1])
      return gate
    }

    case 'GPRB':
      return new ProbGateTile(readFloat(args))

    case 'JUMP': return new JumpTile()
  }

  // Anything else has to be a note, which is the one tile whose token is its own
  // value.
  const slash = token.indexOf('/')
  const name = slash < 0 ? token : token.slice(0, slash)

  const note = Pitch.tryParse(name)
  if (note == null) throw fail(number, 'cannot read the tile ' + token)

  return new NoteTile(note, slash < 0 ? 1 : readFloat(token.slice(slash + 1)))
}

// The laps a cycle gate fires on, in either of the two spellings the format has had.
// A run of digits as long as the period is the pattern version 9 writes; anything
// else is the single lap a version 8 file names by number.
function readLaps(gate, text) {
  if (text.length === gate.period && /^[01]+$/.test(text)) {
    gate.pattern = text
    return
  }

  gate.pattern = ''
  gate.setFires(readInt(text), true)
}

// Targets a file may still name that the synth no longer has. This is every key
// ParamTargets has ever dropped, which is what it has to be: a target leaving
// ParamTargets belongs in this list in the same change.
const Retired = ['detune', 'cardecay', 'carsustain']

// A run of key,value pairs, or nothing at all for a lock that holds no parameter.
function readLock(tile, args, number, version) {
  if (args.length === 0) return tile

  const parts = args.split(',')

  for (let i = 0; i < parts.length; i += 2) {
    const target = ParamTargets.parse(parts[i])

    if (target < 0) {
      if (!Retired.includes(parts[i]))
        throw fail(number, 'unknown lock target ' + parts[i])
      continue
    }

    let value = i + 1 < parts.length ? readFloat(parts[i + 1]) : 0

    // An absolute lock holds the parameter itself, so version 10's change of units
    // reaches it exactly as it reaches the patch line. A relative one holds a shift
    // and is left as written.
    if (version < 10 && target === ParamTargets.ModDecay &&
        tile instanceof AbsoluteParamTile) value = decaySlope(value)

    tile.engage(target, value)
  }

  // A lock that named only retired parameters has nothing left to do, so it goes
  // rather than staying on the plane as an empty one. A lock written empty is a
  // different thing and was returned above.
  return tile.isEmpty ? null : tile
}

// Which channel the line is for. A version 2 file has one patch line for the whole
// project, so its first token is already a key=value pair; that line goes into every
// channel, which is exactly what it used to mean.
function readPatchLine(project, tokens, version) {
  if (tokens.length > 1 && !tokens[1].includes('=')) {
    const channel = clampChannel(readInt(tokens[1]))
    readPatch(project.patches.at(channel), tokens, 2, version)
    return
  }

  for (let channel = 1; channel <= Channels; channel++)
    readPatch(project.patches.at(channel), tokens, 1, version)
}

// A version 9 FM decay in seconds as the slope version 10 holds in its place.
//
// The old parameter was the time the modulation took to reach zero along a curve
// that spent five e-foldings getting there, so its time constant was a fifth of it.
// The new one is a plain exponential whose time constant is a tenth of a second at
// the middle of its travel. Equating the two gives this.
const decaySlope = seconds => seconds / (5 * 0.1 + seconds)

function readPatch(patch, tokens, from, version) {
  for (let i = from; i < tokens.length; i++) {
    const [key, text] = split(tokens[i])
    const value = readFloat(text)

    switch (key) {
      case 'level': patch.level = value; break
      case 'pan': patch.pan = value; break
      case 'gate': patch.gateScale = value; break
      case 'mratio': patch.modulatorRatio = value; break
      case 'index': patch.modulationIndex = value; break
      case 'fb': patch.feedback = value; break
      case 'md':
        patch.modulatorDecay = version < 10 ? decaySlope(value) : value
        break
      case 'ca': patch.carrierAttack = value; break
      case 'cr': patch.carrierRelease = value; break
      case 'ps': patch.pitchSweep = value; break
      case 'pd': patch.pitchDecay = value; break
      case 'rsend': patch.reverbSend = value; break
      case 'dsend': patch.delaySend = value; break
    }
  }
}

// The one fx line. Unknown keys are skipped and missing ones keep the default the
// project was created with: a version 6 file has no line here at all and reads as a
// project whose effects have never been touched.
function readFx(fx, tokens) {
  for (let i = 1; i < tokens.length; i++) {
    const [key, text] = split(tokens[i])
    const value = readFloat(text)

    switch (key) {
      case 'rsize': fx.reverbSize = value; break
      case 'rdamp': fx.reverbDamp = value; break
      case 'rwidth': fx.reverbWidth = value; break
      case 'dbeats': fx.delayBeats = value; break
      case 'dfb': fx.delayFeedback = value; break
      case 'dtone': fx.delayTone = value; break
      case 'dspread': fx.delaySpread = value; break
    }
  }
}

function readLimiter(limiter, tokens) {
  for (let i = 1; i < tokens.length; i++) {
    const [key, text] = split(tokens[i])
    const value = readFloat(text)

    switch (key) {
      case 'drive': limiter.drive = value; break
      case 'ceiling': limiter.ceiling = value; break
      case 'attack': limiter.attack = value; break
      case 'release': limiter.release = value; break
    }
  }
}

// Token helpers

function split(token) {
  const equals = token.indexOf('=')
  return equals < 0 ? [token, ''] : [token.slice(0, equals), token.slice(equals + 1)]
}

function arg(tokens, index, number) {
  if (index >= tokens.length) throw fail(number, 'missing argument')
  return tokens[index]
}

function readPoint(text, number) {
  const parts = text.split(',')
  if (parts.length !== 2) throw fail(number, 'expected x,y')
  return point(readInt(parts[0]), readInt(parts[1]))
}

const readInt = text => {
  const value = parseInt(text, 10)
  return Number.isFinite(value) ? value : 0
}

const readFloat = text => {
  const value = parseFloat(text)
  return Number.isFinite(value) ? value : 0
}

const fail = (line, message) => new Error('line ' + (line + 1) + ': ' + message)
