// A few checks that are quicker to run than to reason about, ported from the
// original's Jacquard > Run Self Test: the file format has to round-trip, the runners
// have to produce the notes the mockup score describes, and the oscillator and the two
// effect buses have to make the shapes their parameters promise.
//
//   node tests/selftest.mjs

import { Project, DelayTime, Limiter, Channels, defaultLimiter } from '../src/core/project.js'
import {
  ChannelTile, NoteTile, CycleGateTile, ProbGateTile,
  AbsoluteParamTile, RelativeParamTile, ParamTile
} from '../src/core/tiles.js'
import * as ParamTargets from '../src/core/params.js'
import * as ProjectFormat from '../src/core/format.js'
import { Sequencer } from '../src/core/sequencer.js'
import { ChannelMutes } from '../src/core/mutes.js'
import { LiveFx, LiveEffect } from '../src/core/livefx.js'
import { panGains } from '../src/core/patch.js'
import {
  FmVoiceState, ReverbBus, DelayBus, LimiterBus, mixFxRuntime
} from '../src/audio/dsp.js'
import { StartupScore } from '../scores/startup.js'

const SampleRate = 48000

let failures = 0

// Upper case on failure, matching the original's log: a scan down the left edge is
// enough to see whether anything went wrong.
function check(name, ok, detail) {
  if (!ok) failures++
  console.log('  ' + (ok ? name + ': ' : name.toUpperCase() + ' FAILED: ') + detail)
}

const seconds = time => Math.floor(time * SampleRate)

console.log('Jacquard self test')

// Writing, reading and writing again has to give the same text, which is the cheapest
// way to know that nothing about a tile is being dropped.

{
  const original = Project.createSample()
  const first = ProjectFormat.write(original)
  const second = ProjectFormat.write(ProjectFormat.read(first))

  check('round trip', first === second, first === second ? 'identical' : 'mismatch')

  const reloaded = ProjectFormat.read(first)
  const branch = reloaded.score.lanes.find(lane => lane.isBranch)

  check('branch link', branch?.jumpSource != null,
        reloaded.score.lanes.length + ' lanes')
}

// The score the app opens on is a file rather than code, so nothing about it is
// checked by compiling. Reading it and writing it back says both things at once — that
// it still parses, and whether it is already what this build would write.

{
  try {
    const project = ProjectFormat.read(StartupScore)
    const rewritten = ProjectFormat.write(project)

    check('startup score', project.score.lanes.length > 0,
          project.score.lanes.length + ' lanes at ' + project.tempo + 'bpm')

    check('startup version', rewritten === StartupScore,
          rewritten === StartupScore ? 'current'
            : 'readable but not what this build writes')
  } catch (error) {
    check('startup score', false, error.message)
  }
}

// Runs the mockup score for four laps' worth of samples and counts what comes out,
// which exercises gates, locks, the branch and the accent lane.

{
  const project = Project.createSample()
  const sequencer = new Sequencer(project)
  const notes = []

  sequencer.play(0, 0)

  const length = 16 * 4 * 60 / project.tempo / 4 * SampleRate
  const window = SampleRate / 10

  for (let position = 0; position < length; position += window)
    sequencer.schedule(position, window, SampleRate, notes)

  const jumped = sequencer.runners.some(runner => runner.pass >= 4)

  check('laps counted', jumped,
        notes.length + ' notes over four laps from ' + sequencer.runners.length + ' runners')

  const plain = project.patches.at(1).level
  const loudest = Math.max(...notes.map(note => note.level))
  const untouched = notes.filter(note => Math.abs(note.level - plain) < 0.001).length

  // The accent lane's relative lock is the only thing that can push a note past the
  // patch level, and the accent lane sits above the main one, so seeing it proves the
  // pass runs down the plane.
  check('the accent reached the lane below it', loudest > plain + 0.01,
        'loudest=' + loudest.toFixed(3) + ' against a patch level of ' + plain)

  check('a lock is gone by the next step', untouched > 0,
        untouched + ' of ' + notes.length + ' notes at the patch level')
}

// A stack is read downwards, so a gate reaches what is below it and nothing above it.

{
  const laps = 8

  const project = new Project()
  const lane = project.score.addLane(1, 1, new ChannelTile(1), 4)

  lane.steps[0].tiles.push(new NoteTile(64))
  lane.steps[0].tiles.push(new CycleGateTile(4, '1000'))
  lane.steps[0].tiles.push(new NoteTile(60))

  const sequencer = new Sequencer(project)
  const notes = []

  sequencer.play(0, 0)

  const step = 60 / project.tempo * 4 / 16 * SampleRate
  const length = step * 4 * laps - step
  const window = SampleRate / 20

  for (let position = 0; position < length; position += window)
    sequencer.schedule(position, window, SampleRate, notes)

  const above = notes.filter(note => Math.abs(note.frequency - 329.628) < 1).length
  const below = notes.filter(note => Math.abs(note.frequency - 261.626) < 1).length

  check('a gate leaves the note above it alone', above === laps,
        above + ' of ' + laps + ' laps sounded the note on the rail')

  check('a gate governs the note below it', below === laps / 4,
        below + ' notes under a four lap gate over ' + laps + ' laps')
}

// One lock holding two parameters has to move both of them and leave the rest of the
// patch alone, and it has to survive a file.

{
  const project = new Project()
  const lane = project.score.addLane(1, 1, new ChannelTile(1), 1)

  const held = new AbsoluteParamTile()
  held.engage(ParamTargets.Level, 0.5)
  held.engage(ParamTargets.ModIndex, 9)

  lane.steps[0].tiles.push(new RelativeParamTile())
  lane.steps[0].tiles.push(held)
  lane.steps[0].tiles.push(new NoteTile(60))

  // Moved off its default so that a lock writing every target rather than the ones it
  // holds would show up as a zero here instead of matching by luck.
  project.patches.at(1).feedback = 4

  const sequencer = new Sequencer(project)
  const notes = []

  sequencer.play(0, 0)
  sequencer.schedule(0, SampleRate / 10, SampleRate, notes)

  const sounded = notes.length > 0

  check('a lock holding two parameters moved both',
        sounded && Math.abs(notes[0].level - 0.5) < 0.001 &&
        Math.abs(notes[0].modulationIndex - 9) < 0.001,
        sounded ? 'level=' + notes[0].level + ' index=' + notes[0].modulationIndex
                : 'nothing sounded')

  check('a lock left the parameters it does not hold alone',
        sounded && Math.abs(notes[0].feedback - 4) < 0.001,
        sounded ? 'feedback=' + notes[0].feedback : 'nothing sounded')

  const text = ProjectFormat.write(project)
  const reloaded = ProjectFormat.read(text).score.lanes[0].steps[0].tiles

  const back = reloaded.find(tile => tile instanceof AbsoluteParamTile)
  const empty = reloaded.find(tile => tile instanceof RelativeParamTile)

  const written = text.slice(text.lastIndexOf('  step')).trimEnd()

  check('both parameters came back from the file',
        back != null && back.isEngaged(ParamTargets.Level) &&
        back.isEngaged(ParamTargets.ModIndex) &&
        !back.isEngaged(ParamTargets.Feedback) &&
        Math.abs(back.amount(ParamTargets.ModIndex) - 9) < 0.001, written)

  check('a lock holding nothing survived the file',
        empty != null && empty.isEmpty, written)

  // A file naming a target the synth has since dropped has to open, losing the lock
  // rather than taking the score down with it.
  const legacy = 'jacquard 1\ntempo 120\npatch level=0.5\n' +
                 'lane 1 1 CHAN:1 div=16\n' +
                 '  step PREL:feedback,6.2 PREL:cardecay,-1.989 C5/0.25\n'

  let tiles = null
  let opened = true
  let detail = ''

  try { tiles = ProjectFormat.read(legacy).score.lanes[0].steps[0].tiles }
  catch (error) { opened = false; detail = error.message }

  const survivor = opened ? tiles.find(tile => tile instanceof ParamTile) : null

  check('a lock on a retired target is dropped, not refused',
        opened && tiles.length === 2 && survivor != null &&
        survivor.isEngaged(ParamTargets.Feedback) &&
        Math.abs(survivor.amount(ParamTargets.Feedback) - 6.2) < 0.001,
        opened ? tiles.length + ' tiles, feedback=' +
                 (survivor == null ? 'none' : survivor.amount(ParamTargets.Feedback))
               : detail)

  // A target that changed units rather than leaving. Version 10 turned the FM decay
  // from a time into a slope, so a version 9 patch line and the absolute lock over it
  // both have to arrive converted, while the relative lock keeps its shift.
  const older = ProjectFormat.read(
    'jacquard 9\ntempo 120\npatch 1 md=0.12\n' +
    'lane 1 1 CHAN:1 div=16\n' +
    '  step PABS:moddecay,0.3 PREL:moddecay,0.25 C5\n')

  const steps = older.score.lanes[0].steps[0].tiles
  const absolute = steps.find(tile => tile instanceof AbsoluteParamTile)
  const relative = steps.find(tile => tile instanceof RelativeParamTile)

  check('a version 9 FM decay comes back as the same slope',
        Math.abs(older.patches.at(1).modulatorDecay - 0.19355) < 0.001 &&
        absolute != null && Math.abs(absolute.amount(ParamTargets.ModDecay) - 0.375) < 0.001 &&
        relative != null && Math.abs(relative.amount(ParamTargets.ModDecay) - 0.25) < 0.001,
        'patch md=' + older.patches.at(1).modulatorDecay.toFixed(5))
}

// Two lanes on different channels, each with its own patch, playing the same note:
// what comes out has to differ, and differ per channel rather than per lane.

{
  const project = new Project()
  const score = project.score

  score.addLane(1, 1, new ChannelTile(1), 1)
  score.addLane(1, 3, new ChannelTile(2), 1)

  for (const lane of score.lanes) lane.steps[0].tiles.push(new NoteTile(60))

  project.patches.at(1).level = 0.25
  project.patches.at(2).level = 0.75

  const sequencer = new Sequencer(project)
  const notes = []

  sequencer.play(0, 0)
  sequencer.schedule(0, SampleRate / 10, SampleRate, notes)

  const quiet = notes.filter(note => Math.abs(note.level - 0.25) < 0.001).length
  const loud = notes.filter(note => Math.abs(note.level - 0.75) < 0.001).length

  check('each channel plays its own patch',
        notes.length === 2 && quiet === 1 && loud === 1,
        notes.length + ' notes, ' + quiet + ' at ch1, ' + loud + ' at ch2')

  const reloaded = ProjectFormat.read(ProjectFormat.write(project))

  check('the bank round trips',
        Math.abs(reloaded.patches.at(1).level - 0.25) < 0.001 &&
        Math.abs(reloaded.patches.at(2).level - 0.75) < 0.001,
        'ch1=' + reloaded.patches.at(1).level + ' ch2=' + reloaded.patches.at(2).level)

  // A version 2 file had one patch for everything, and that is what its single line
  // still means.
  const legacy = ProjectFormat.read('jacquard 2\ntempo 120\npatch level=0.5\n')

  check('a version 2 patch line fills the bank',
        Math.abs(legacy.patches.at(1).level - 0.5) < 0.001 &&
        Math.abs(legacy.patches.at(Channels).level - 0.5) < 0.001,
        'ch1=' + legacy.patches.at(1).level + ' ch' + Channels + '=' +
        legacy.patches.at(Channels).level)
}

// A mute drops notes and nothing else: the run is unchanged, and a solo overrules a
// mute rather than clearing it.

{
  const mutes = new ChannelMutes()
  const project = new Project()
  const score = project.score

  score.addLane(1, 1, new ChannelTile(1), 1)
  score.addLane(1, 3, new ChannelTile(2), 1)

  for (const lane of score.lanes) lane.steps[0].tiles.push(new NoteTile(60))

  project.patches.at(1).level = 0.25
  project.patches.at(2).level = 0.75

  const sequencer = new Sequencer(project, mutes)

  const play = () => {
    const notes = []
    sequencer.play(0, 0)
    sequencer.schedule(0, SampleRate / 10, SampleRate, notes)
    return notes
  }

  mutes.setMuted(1, true)

  const muted = play()

  check('a muted channel is silent and the other one is not',
        muted.length === 1 && Math.abs(muted[0].level - 0.75) < 0.001,
        muted.length + ' notes')

  const laps = sequencer.runners.find(runner => runner.channel === 1)?.pass ?? 0

  check('a muted channel goes on running', laps > 0, 'channel 1 is on lap ' + (laps + 1))

  mutes.setSoloed(1, true)

  const soloed = play()

  check('a solo overrules a mute rather than clearing it',
        soloed.length === 1 && Math.abs(soloed[0].level - 0.25) < 0.001 && mutes.isMuted(1),
        soloed.length + ' notes, and the mute is ' + (mutes.isMuted(1) ? 'kept' : 'GONE'))

  mutes.setSoloed(1, false)

  const restored = play()

  check('dropping the last solo gives the mutes back',
        restored.length === 1 && Math.abs(restored[0].level - 0.75) < 0.001,
        restored.length + ' notes')
}

// A send amount is a field of the patch, so a lock reaches it the way it reaches a
// timbre and the descent decides which notes it colours.

{
  const project = new Project()
  const lane = project.score.addLane(1, 1, new ChannelTile(1), 1)

  const wet = new AbsoluteParamTile()
  wet.engage(ParamTargets.ReverbSend, 0.8)

  lane.steps[0].tiles.push(new NoteTile(72))
  lane.steps[0].tiles.push(wet)
  lane.steps[0].tiles.push(new NoteTile(60))
  lane.steps[0].tiles.push(new NoteTile(64))

  const sequencer = new Sequencer(project)
  const notes = []

  sequencer.play(0, 0)
  sequencer.schedule(0, SampleRate / 10, SampleRate, notes)

  const dry = notes.filter(note => note.reverbSend < 0.001).length
  const sent = notes.filter(note => Math.abs(note.reverbSend - 0.8) < 0.001).length

  check('a send lock reaches the notes below it',
        notes.length === 3 && dry === 1 && sent === 2,
        notes.length + ' notes, ' + dry + ' dry and ' + sent + ' sent')

  project.fx.reverbSize = 0.9
  project.fx.delayBeats = DelayTime.Beats[DelayTime.Beats.length - 1]
  project.fx.delaySpread = 0.6
  project.patches.at(1).delaySend = 0.4

  const reloaded = ProjectFormat.read(ProjectFormat.write(project))

  check('the effects round trip',
        Math.abs(reloaded.fx.reverbSize - 0.9) < 0.001 &&
        Math.abs(reloaded.fx.delayBeats - project.fx.delayBeats) < 0.001 &&
        Math.abs(reloaded.fx.delaySpread - 0.6) < 0.001 &&
        Math.abs(reloaded.patches.at(1).delaySend - 0.4) < 0.001,
        'size=' + reloaded.fx.reverbSize + ' beats=' + reloaded.fx.delayBeats)

  const legacy = ProjectFormat.read('jacquard 6\ntempo 120\npatch 1 level=0.5\n')

  check('a version 6 file reads with the effects at their defaults',
        Math.abs(legacy.fx.delayBeats - DelayTime.Beats[DelayTime.Default]) < 0.001 &&
        legacy.patches.at(1).reverbSend === 0 &&
        Math.abs(legacy.patches.at(1).level - 0.5) < 0.001,
        'beats=' + legacy.fx.delayBeats + ' rsend=' + legacy.patches.at(1).reverbSend)
}

// The pan law: a centred note has to come out exactly as it did before there was a pan
// at all, and the pair of gains has to hold its power as it crosses.

{
  const [centreL, centreR] = panGains({ pan: 0 })

  check('a centred note renders as it did unpanned',
        Math.abs(centreL - 1) < 0.001 && Math.abs(centreR - 1) < 0.001,
        'L=' + centreL.toFixed(4) + ' R=' + centreR.toFixed(4))

  const [leftL, leftR] = panGains({ pan: -1 })
  const [rightL, rightR] = panGains({ pan: 1 })

  check('hard over is on one side only',
        leftR < 0.001 && rightL < 0.001 && Math.abs(leftL - rightR) < 0.001,
        'hard left=' + leftL.toFixed(3) + '/' + leftR.toFixed(3))

  let flattest = 0

  for (let i = 0; i <= 20; i++) {
    const [l, r] = panGains({ pan: i / 10 - 1 })
    flattest = Math.max(flattest, Math.abs(l * l + r * r - 2))
  }

  check('the power holds all the way across', flattest < 0.01,
        'largest departure ' + flattest.toExponential(2) + ' from a constant 2')

  const project = new Project()
  project.patches.at(1).pan = -0.75

  const reloaded = ProjectFormat.read(ProjectFormat.write(project))
  const legacy = ProjectFormat.read('jacquard 7\ntempo 120\npatch 1 level=0.5\n')

  check('a pan round trips and an older file comes back centred',
        Math.abs(reloaded.patches.at(1).pan + 0.75) < 0.001 &&
        legacy.patches.at(1).pan === 0,
        'pan=' + reloaded.patches.at(1).pan)
}

// The live effects, driven exactly the way the app drives them: the sequencer runs a
// window ahead and the handover follows at a much shorter one, and what a live effect
// reaches is precisely what has not been handed over yet.

{
  // 120bpm puts a sixteenth at exactly 6000 samples, so every boundary here is a whole
  // number and nothing is measured against a rounding.
  const Sixteenth = 6000
  const Lookahead = 6000
  const Lead = 1500
  const Frame = 800

  const span = Sixteenth * 40

  const liveScore = release => {
    const project = new Project()
    project.tempo = 120
    const lane = project.score.addLane(1, 1, new ChannelTile(1), 16)
    for (let i = 0; i < 16; i++) lane.steps[i].tiles.push(new NoteTile(60 + i))
    if (release > 0) project.patches.at(1).carrierRelease = release
    return project
  }

  const run = (hand, release = 0) => {
    const project = liveScore(release)
    const sequencer = new Sequencer(project)
    const live = new LiveFx()

    const output = []

    sequencer.play(0, Lookahead)
    live.start(Lookahead)

    for (let now = 0; now < span; now += Frame) {
      if (hand) hand(live, now)

      const pending = []
      sequencer.schedule(now, Lookahead, SampleRate, pending)
      live.enqueue(pending)
      live.handOver(now + Lead, project.tempo, SampleRate, output)
    }

    return output
  }

  const eventAt = (notes, step) =>
    notes.find(note => note.startSample === Lookahead + step * Sixteenth)

  const noteAt = (notes, step) => {
    const note = eventAt(notes, step)
    return note ? Math.round(69 + 12 * Math.log2(note.frequency / 440)) : -1
  }

  const plain = run(null)

  let inert = plain.length === 40
  for (let i = 0; i < 40 && inert; i++) inert = noteAt(plain, i) === 60 + i % 16

  check('nothing held hands the sequence over untouched', inert, plain.length + ' notes')

  const up = run((live, now) => { if (now === 0) live.press(LiveEffect.OctaveUp, Lookahead) })

  check('an octave up is an octave up',
        noteAt(up, 0) === 72 && noteAt(up, 5) === 77,
        noteAt(up, 0) + ' and ' + noteAt(up, 5))

  const flat = run((live, now) => {
    if (now > 0) return
    live.press(LiveEffect.OctaveUp, Lookahead)
    live.press(LiveEffect.OctaveDown, Lookahead)
  })

  check('an octave each way cancels', noteAt(flat, 3) === 63, String(noteAt(flat, 3)))

  const stab = run((live, now) => { if (now === 0) live.press(LiveEffect.Stab, Lookahead) })
  const stabbed = eventAt(stab, 3)

  check('a stab cuts the tail down with the gate',
        Math.abs(stabbed.duration - 0.0125) < 0.0001 &&
        Math.abs(stabbed.carrierRelease - 0.01) < 0.0001,
        stabbed.duration + 's over ' + stabbed.carrierRelease + 's')

  const sustain = run((live, now) => { if (now === 0) live.press(LiveEffect.Sustain, Lookahead) })
  const sustained = eventAt(sustain, 3)

  check('a sustain stretches the tail with the gate',
        Math.abs(sustained.duration - 0.25) < 0.0001 &&
        Math.abs(sustained.carrierRelease - 0.24) < 0.0001,
        sustained.duration + 's over ' + sustained.carrierRelease + 's')

  const gated = run((live, now) => {
    if (now > 0) return
    live.press(LiveEffect.Stab, Lookahead)
    live.press(LiveEffect.Sustain, Lookahead)
  })
  const both = eventAt(gated, 3)

  check('a stab held under a sustain is a fifth of a step',
        Math.abs(both.duration - 0.025) < 0.0001 &&
        Math.abs(both.carrierRelease - 0.02) < 0.0001,
        both.duration + 's over ' + both.carrierRelease + 's')

  const brief = run((live, now) => { if (now === 0) live.press(LiveEffect.Stab, Lookahead) },
                    0.004)

  check('a stab leaves a tail already shorter than it would make one',
        Math.abs(eventAt(brief, 3).carrierRelease - 0.004) < 0.0001,
        eventAt(brief, 3).carrierRelease + 's')

  const rise = run((live, now) => { if (now === 0) live.press(LiveEffect.Rise, Lookahead) })

  check('a rise climbs a semitone a step and resets after two bars',
        noteAt(rise, 0) === 60 && noteAt(rise, 1) === 62 &&
        noteAt(rise, 31) === 106 && noteAt(rise, 32) === 60,
        [0, 1, 31, 32].map(i => noteAt(rise, i)).join(' '))

  const wet = run((live, now) => { if (now === 0) live.press(LiveEffect.Reverb, Lookahead) })

  check('a throw puts every note in the reverb',
        wet.every(note => Math.abs(note.reverbSend - 1) < 0.0001),
        wet.length + ' notes')

  // Pressed a third of the way through the fifth step, which is the case the record of
  // what has sounded exists for.
  const roll = run((live, now) => {
    if (now === Lookahead + Sixteenth * 4 + 2000) live.press(LiveEffect.Roll1, now)
  })

  check('a sixteenth roll catches the step the hand was on and stands in for the rest',
        roll.length === 40 && noteAt(roll, 4) === 64 &&
        noteAt(roll, 5) === 64 && noteAt(roll, 10) === 64,
        roll.length + ' notes, ' + noteAt(roll, 5) + ' where 65 was')

  const released = run((live, now) => {
    if (now === Lookahead + Sixteenth * 4 + 2000) live.press(LiveEffect.Roll1, now)
    if (now === Lookahead + Sixteenth * 12 + 400) live.release(LiveEffect.Roll1)
  })

  check('letting a roll go gives the sequence back where it had got to',
        released.length === 40 && noteAt(released, 12) === 64 &&
        noteAt(released, 13) === 73 && noteAt(released, 21) === 65,
        [12, 13, 21].map(i => noteAt(released, i)).join(' '))

  // The three longer ones, which are also the other half of the mechanism: a window
  // that reaches past what has already sounded lets the sequence play on and writes it
  // down before anything stands in for it.
  for (const [fx, steps] of [[LiveEffect.Roll2, 2], [LiveEffect.Roll3, 3],
                             [LiveEffect.Roll4, 4]]) {
    const from = 7

    const trace = run((live, now) => {
      if (now === Lookahead + Sixteenth * from + 800) live.press(fx, now)
    })

    let ok = trace.length === 40

    for (let i = from; i < 40 && ok; i++) {
      const source = i < from + steps ? i : from + (i - from) % steps
      ok = noteAt(trace, i) === 60 + source % 16
    }

    check('a roll of ' + steps + ' records that many steps and then plays them', ok,
          noteAt(trace, from + steps) + ' where ' + (60 + (from + steps) % 16) + ' was')
  }

  // Two at once is the one thing here that does not stack, since both answer what
  // plays instead of the score.
  const over = run((live, now) => {
    if (now === Lookahead + Sixteenth * 4 + 2000) live.press(LiveEffect.Roll1, now)
    if (now === Lookahead + Sixteenth * 8 + 400) live.press(LiveEffect.Roll4, now)
    if (now === Lookahead + Sixteenth * 20 + 400) live.release(LiveEffect.Roll4)
  })

  check('the roll pressed last is the one that plays, and hands back on release',
        over.length === 40 && noteAt(over, 7) === 64 && noteAt(over, 9) === 69 &&
        noteAt(over, 13) === 69 && noteAt(over, 21) === 64,
        [7, 9, 13, 21].map(i => noteAt(over, i)).join(' '))
}

// Measurement helpers for the DSP checks.

function rms(buffer, from, to) {
  let sum = 0
  for (let i = from; i < to; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / (to - from))
}

// Pitch from the spacing of the upward zero crossings, which is all a sine needs and
// is what makes the pitch envelope measurable at all.
function frequency(buffer, from, to) {
  let first = -1, last = -1, count = 0

  for (let i = from + 1; i < to; i++) {
    if (buffer[i - 1] > 0 || buffer[i] <= 0) continue
    if (first < 0) first = i
    last = i
    count++
  }

  return count < 2 ? 0 : (count - 1) * SampleRate / (last - first)
}

// Harmonic content, as the size of the sample to sample difference relative to the
// signal itself: a plain sine scores low, a modulated one high.
function brightness(buffer, from, to) {
  let sum = 0

  for (let i = from + 1; i < to; i++) {
    const d = buffer[i] - buffer[i - 1]
    sum += d * d
  }

  return Math.sqrt(sum / (to - from - 1)) / Math.max(rms(buffer, from, to), 1e-9)
}

function renderVoice(note, length) {
  const buffer = new Float32Array(seconds(length))
  const voice = new FmVoiceState()

  voice.trigger(note, SampleRate)

  for (let i = 0; i < buffer.length; i++) buffer[i] = voice.next(i / SampleRate)

  return buffer
}

// The oscillator, which neither the round trip nor the note counts say anything about.

{
  const plain = {
    startSample: 0, frequency: 440, level: 1, pan: 0, duration: 1, priority: 8,
    modulatorRatio: 2, modulationIndex: 0, feedback: 0, modulatorDecay: 1,
    carrierAttack: 0.005, carrierRelease: 0.01,
    pitchSweep: 0, pitchDecay: 0, reverbSend: 0, delaySend: 0
  }

  const held = renderVoice(plain, 1)
  const early = rms(held, seconds(0.05), seconds(0.15))
  const late = rms(held, seconds(0.8), seconds(0.9))

  check('carrier holds level', Math.abs(late / early - 1) < 0.01,
        'late/early=' + (late / early).toFixed(5))

  const voiced = { ...plain, frequency: 220, modulationIndex: 4, modulatorDecay: 0.3 }

  const bite = renderVoice(voiced, 1)
  const onset = brightness(bite, seconds(0.008), seconds(0.04))
  const tail = brightness(bite, seconds(0.6), seconds(0.9))

  check('modulation decays away', onset > tail * 2,
        'brightness ' + onset.toFixed(4) + ' -> ' + tail.toFixed(4))

  const silent = brightness(renderVoice({ ...voiced, modulatorDecay: 0 }, 1),
                            seconds(0.008), seconds(0.04))
  const flatTrace = renderVoice({ ...voiced, modulatorDecay: 1 }, 1)
  const flatOnset = brightness(flatTrace, seconds(0.008), seconds(0.04))
  const flatTail = brightness(flatTrace, seconds(0.6), seconds(0.9))

  check('a decay of zero leaves no modulation at all', silent < tail * 1.1,
        'brightness ' + silent.toFixed(4) + ' against a decayed tail of ' + tail.toFixed(4))

  check('a decay of one holds it for the whole note',
        Math.abs(flatTail / flatOnset - 1) < 0.05,
        'brightness ' + flatOnset.toFixed(4) + ' -> ' + flatTail.toFixed(4))

  const falling = { ...plain, pitchSweep: 3, pitchDecay: 0.4 }
  const rising = { ...falling, pitchSweep: -3 }

  const down = renderVoice(falling, 0.5)
  const up = renderVoice(rising, 0.5)

  const from = seconds(0.005)
  const to = seconds(0.045)

  const high = frequency(down, from, to)
  const low = frequency(up, from, to)
  const settled = frequency(down, seconds(0.3), seconds(0.45))

  check('pitch bends the onset up', high > 900, high.toFixed(0) + 'Hz')
  check('a negative sweep bends it down', low < 300, low.toFixed(0) + 'Hz')
  check('pitch arrives at the note', Math.abs(settled - 440) < 5, settled.toFixed(1) + 'Hz')

  const kick = { ...plain, frequency: 880, pitchSweep: 2, pitchDecay: 0.05 }
  const rest = frequency(renderVoice(kick, 0.3), seconds(0.01), seconds(0.05))

  check('the sweep is home early in the decay', Math.abs(rest / 880 - 1) < 0.05,
        'over the last four fifths=' + rest.toFixed(0) + 'Hz')

  const whole = renderVoice(plain, plain.duration + plain.carrierRelease)

  check('the release ends in silence', Math.abs(whole[whole.length - 1]) < 0.001,
        'last sample=' + whole[whole.length - 1].toExponential(2))
}

// One block at a time, like the render job, so that anything a bus carries across a
// block boundary is exercised rather than skipped.

function renderBus(input, pass) {
  const block = 256

  const source = new Float32Array(block)
  const wetL = new Float32Array(block)
  const wetR = new Float32Array(block)
  const trace = new Float32Array(input.length)

  for (let position = 0; position < input.length; position += block) {
    const frames = Math.min(block, input.length - position)

    for (let i = 0; i < block; i++) {
      source[i] = i < frames ? input[position + i] : 0
      wetL[i] = 0
      wetR[i] = 0
    }

    pass(source, wetL, wetR, frames)

    for (let i = 0; i < frames; i++) trace[position + i] = wetL[i]
  }

  return trace
}

function peak(buffer, from, to) {
  let index = from
  let height = 0

  for (let i = Math.max(from, 0); i < Math.min(to, buffer.length); i++) {
    if (Math.abs(buffer[i]) <= height) continue
    index = i
    height = Math.abs(buffer[i])
  }

  return index
}

// The delay: a repeat has to land where the tempo says it should, and moving the time
// while it is running must not splice the signal.

{
  const tempo = 120
  const feedback = 0.35
  const tap = 0.5 * 60 / tempo * SampleRate

  const impulse = new Float32Array(Math.floor(tap * 3.5))
  impulse[0] = 1

  const bus = new DelayBus(SampleRate)
  const trace = renderBus(impulse, (i, l, r, n) =>
    bus.process(i, l, r, n, tap, feedback, 0, 0))

  const first = peak(trace, Math.floor(tap * 0.5), Math.floor(tap * 1.5))
  const second = peak(trace, Math.floor(tap * 1.5), Math.floor(tap * 2.5))

  check('a repeat lands on the beat it was asked for',
        Math.abs(first - tap) <= 2 && Math.abs(second - tap * 2) <= 3,
        'peaks at ' + first + ' and ' + second + ' against a tap of ' + tap)

  const fell = trace[second] / Math.max(trace[first], 1e-9)

  check('each repeat falls by the feedback', Math.abs(fell - feedback) < 0.02,
        'second/first=' + fell.toFixed(4))

  // The one the rate limit exists for. A tone held through a change of rung has to
  // stay a tone.
  const continuity = (from, to) => {
    const frames = Math.floor(from + to) * 3
    const input = new Float32Array(frames)

    for (let i = 0; i < frames; i++)
      input[i] = Math.sin(2 * Math.PI * 220 * i / SampleRate) * 0.5

    const line = new DelayBus(SampleRate)
    const change = Math.floor(frames / 3)
    const block = 256

    const source = new Float32Array(block)
    const wetL = new Float32Array(block)
    const wetR = new Float32Array(block)
    const out = new Float32Array(frames)

    for (let position = 0; position < frames; position += block) {
      const count = Math.min(block, frames - position)

      for (let i = 0; i < block; i++) {
        source[i] = i < count ? input[position + i] : 0
        wetL[i] = 0
        wetR[i] = 0
      }

      line.process(source, wetL, wetR, count, position < change ? from : to, 0, 0, 0)

      for (let i = 0; i < count; i++) out[position + i] = wetL[i]
    }

    let largest = 0
    for (let i = change; i < frames; i++)
      largest = Math.max(largest, Math.abs(out[i] - out[i - 1]))

    return largest
  }

  const steady = continuity(tap, tap)
  const moved = continuity(tap, tap * 2)

  check('changing the delay time does not splice the signal', moved < steady * 2,
        'largest step ' + moved.toFixed(5) + ' while moving against ' +
        steady.toFixed(5) + ' steady')
}

// The reverb, which is a feedback network and so has exactly one way of being wrong
// that matters: not settling.

{
  const input = new Float32Array(seconds(1.5))
  for (let i = 0; i < seconds(0.01); i++)
    input[i] = Math.sin(2 * Math.PI * 440 * i / SampleRate) * 0.5

  const renderReverb = (size, damp, width) => {
    const bus = new ReverbBus(SampleRate)
    return renderBus(input, (i, l, r, n) =>
      bus.process(i, l, r, n, SampleRate, size, damp, width))
  }

  const small = renderReverb(0.2, 0.5, 1)
  const middle = renderReverb(0.5, 0.5, 1)
  const large = renderReverb(1, 0.5, 1)

  const finite = large.every(Number.isFinite)

  const early = rms(large, seconds(0.02), seconds(0.1))
  const late = rms(large, seconds(1.2), seconds(1.5))

  check('the tail stays finite', finite, 'over ' + large.length + ' samples')

  check('the longest tail still settles', finite && late < early && early > 1e-4,
        'early=' + early.toFixed(5) + ' late=' + late.toFixed(5))

  const settling = rms(middle, seconds(0.02), seconds(0.1))
  const gone = rms(middle, seconds(1.2), seconds(1.5))

  check('a default sized tail dies away', gone < settling * 0.05,
        'early=' + settling.toFixed(5) + ' late=' + gone.toFixed(6))

  const tight = rms(small, seconds(1.2), seconds(1.5))

  check('a larger size decays more slowly', late > tight * 2,
        'late RMS ' + late.toFixed(6) + ' at size 1 against ' + tight.toFixed(6) +
        ' at size 0.2')
}

// The limiter, which has one promise per control.

{
  const tone = (frames, amplitude) => {
    const buffer = new Float32Array(frames)
    for (let i = 0; i < frames; i++)
      buffer[i] = Math.sin(2 * Math.PI * 220 * i / SampleRate) * amplitude
    return buffer
  }

  const renderLimiter = (input, settings) => {
    const block = 256
    const bus = new LimiterBus()
    const runtime = mixFxRuntime({ reverbSize: 0, reverbDamp: 0, reverbWidth: 0,
                                   delayBeats: 0.5, delayFeedback: 0, delayTone: 0,
                                   delaySpread: 0 }, settings, 120, SampleRate).limiter

    const left = new Float32Array(block)
    const right = new Float32Array(block)
    const trace = new Float32Array(input.length)

    for (let position = 0; position < input.length; position += block) {
      const frames = Math.min(block, input.length - position)

      for (let i = 0; i < block; i++) {
        left[i] = right[i] = i < frames ? input[position + i] : 0
      }

      bus.process(left, right, frames, runtime)

      for (let i = 0; i < frames; i++) trace[position + i] = left[i]
    }

    return trace
  }

  const settings = defaultLimiter()

  const open = renderLimiter(tone(seconds(0.2), 1), settings)
  const passed = rms(open, seconds(0.1), seconds(0.2))
  const plainRms = rms(tone(seconds(0.2), 1), seconds(0.1), seconds(0.2))

  check('a default limiter leaves the mix alone', Math.abs(passed / plainRms - 1) < 0.01,
        'out/in=' + (passed / plainRms).toFixed(5))

  settings.drive = 18
  settings.ceiling = -6

  const driven = renderLimiter(tone(seconds(0.5), 0.5), settings)
  const ceiling = Limiter.gain(settings.ceiling)
  let heldPeak = 0

  for (let i = seconds(0.2); i < seconds(0.5); i++)
    heldPeak = Math.max(heldPeak, Math.abs(driven[i]))

  check('the ceiling holds under a hard drive',
        heldPeak <= ceiling * 1.02 && heldPeak > ceiling * 0.9,
        'peak ' + heldPeak.toFixed(4) + ' against a ceiling of ' + ceiling.toFixed(4))

  const quiet = renderLimiter(tone(seconds(0.2), 0.02), settings)
  const lifted = rms(quiet, seconds(0.1), seconds(0.2)) /
                 rms(tone(seconds(0.2), 0.02), seconds(0.1), seconds(0.2))

  check('a quiet mix is driven rather than limited',
        Math.abs(lifted - Limiter.gain(settings.drive)) < 0.1,
        'lifted by ' + lifted.toFixed(3) + ' against a drive of ' +
        Limiter.gain(settings.drive).toFixed(3))

  settings.attack = Limiter.MinAttack
  const clamped = renderLimiter(tone(seconds(0.05), 0.5), settings)

  settings.attack = Limiter.MaxAttack
  const punched = renderLimiter(tone(seconds(0.05), 0.5), settings)

  const front = seconds(0.002)

  check('a slow attack lets the front of a transient through',
        rms(punched, 0, front) > rms(clamped, 0, front) * 1.5,
        'first 2ms ' + rms(punched, 0, front).toFixed(4) + ' slow against ' +
        rms(clamped, 0, front).toFixed(4) + ' fast')

  settings.attack = 0.005
  settings.release = 0.05

  const loudThenQuiet = (frames, loudFrames, loud, soft) => {
    const buffer = tone(frames, 1)
    for (let i = 0; i < frames; i++) buffer[i] *= i < loudFrames ? loud : soft
    return buffer
  }

  const recovered = renderLimiter(
    loudThenQuiet(seconds(0.5), seconds(0.1), 0.5, 0.02), settings)
  const after = rms(recovered, seconds(0.3), seconds(0.5))
  const target = 0.02 * Limiter.gain(settings.drive) / Math.SQRT2

  check('the gain comes back after a loud passage', after > target * 0.9,
        'tail RMS ' + after.toFixed(4) + ' against ' + target.toFixed(4) + ' at full gain')
}

console.log(failures === 0 ? '\nall checks passed'
                           : '\n' + failures + ' CHECK(S) FAILED')

process.exit(failures === 0 ? 0 : 1)
