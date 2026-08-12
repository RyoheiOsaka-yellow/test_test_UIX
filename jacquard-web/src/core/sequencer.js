// Drives the runners and turns the tiles they meet into note events.
//
// Timing is expressed against the audio clock: every step lands on an absolute
// sample position computed by looking ahead of the current audio position, so a
// dropped frame delays when notes are handed over but never when they sound.
//
// One instant of the timeline is a slice, and a slice is processed as a single
// downward pass: the runners that land on it go in the order of their CHAN tiles,
// topmost first, and each one reads its step from the rail row down. Everything a
// tile does reaches what is processed after it and nothing before it, which is the
// one rule behind gates, locks and notes alike.
//
// Locks last exactly as long as that pass, so every channel starts each slice from
// its own patch again.

import { GateTile, ParamTile, NoteTile, JumpTile, AbsoluteParamTile } from './tiles.js'
import { Channels } from './project.js'
import { copyPatch, noteEvent } from './patch.js'
import * as ParamTargets from './params.js'

// A runner scans a lane and executes the tiles it meets.
//
// The score is static data; a runner exists only while playing. One is born from each
// CHAN lane, and a JUMP never makes another — it only sends the one it has somewhere
// else. So the number of runners equals the number of CHAN lanes: running side by
// side adds runners, branching redirects them.
//
// Order comes from the vertical position of the CHAN tile it was born from, and it
// travels with the runner: moving to a branch lane placed anywhere on the plane does
// not change when this runner gets its turn.

export class Runner {
  constructor(origin, order, startSample) {
    this.originLane = origin
    this.order = order
    this.nextSample = startSample
    this.lane = origin
    this.stepIndex = 0

    // Laps completed around the origin channel, which is what a cycle gate picks
    // from.
    this.pass = 0

    // What is audible right now, as opposed to what has been scheduled. Lags the
    // scheduling position by the lookahead, so a highlight matches what is heard.
    this.playingLane = null
    this.playingStep = -1

    this.scheduled = []
  }

  get channel() { return this.originLane.channel?.channel ?? 1 }

  stepSeconds(tempo) {
    return this.originLane.channel?.stepSeconds(tempo) ?? 0.125
  }

  record(sample, lane, step) {
    this.scheduled.push({ sample, lane, step })
  }

  advancePlayhead(currentSample) {
    while (this.scheduled.length > 0 && this.scheduled[0].sample <= currentSample) {
      const marker = this.scheduled.shift()
      this.playingLane = marker.lane
      this.playingStep = marker.step
    }
  }

  clearPlayhead() {
    this.scheduled.length = 0
    this.playingLane = null
    this.playingStep = -1
  }
}

export class Sequencer {
  constructor(project = null, mutes = null) {
    this.project = project

    // Which channels are heard. Nothing about the run depends on it, and a sequencer
    // without one hears everything.
    this.mutes = mutes

    this.runners = []
    this.playing = false
    this.random = Math.random

    this.working = []
    for (let i = 0; i <= Channels; i++) this.working.push(null)
  }

  get isPlaying() { return this.playing }

  // Transport

  // The first step is placed one lookahead ahead of the current audio position so
  // that playback starts cleanly rather than part way through a step.
  play(currentSample, lookaheadSamples) {
    this.stop()

    const start = currentSample + lookaheadSamples
    let order = 0

    for (const lane of this.project.score.channelLanes)
      this.runners.push(new Runner(lane, order++, start))

    this.playing = this.runners.length > 0
  }

  stop() {
    this.playing = false
    this.runners = []
  }

  // Reconciles the runners with an edited score without interrupting the sound.
  // Runners whose CHAN lane survives keep their position and lap count; a new CHAN
  // lane joins in step with whoever is already running.
  resync() {
    if (!this.playing) return

    const previous = this.runners
    this.runners = []

    let order = 0

    for (const lane of this.project.score.channelLanes) {
      let runner = previous.find(r => r.originLane === lane) ?? null

      if (runner == null) {
        const start = previous.length > 0 ? previous[0].nextSample : 0
        runner = new Runner(lane, order, start)
      }

      // The lane the runner was visiting may be gone, or may have been shortened
      // under its feet.
      if (!this.project.score.lanes.includes(runner.lane)) runner.lane = lane
      if (runner.stepIndex >= runner.lane.steps.length) runner.stepIndex = 0

      runner.order = order++
      this.runners.push(runner)
    }

    this.playing = this.runners.length > 0
  }

  // Scheduling

  // Emits every note that starts within the lookahead window. Safe to call at any
  // rate: nothing here depends on the frame time.
  schedule(currentSample, lookaheadSamples, sampleRate, output) {
    for (const runner of this.runners) runner.advancePlayhead(currentSample)

    if (!this.playing) return

    const horizon = currentSample + lookaheadSamples

    // A slice can only ever consume time, so the bound is a safety net for a
    // degenerate score rather than an expected limit.
    for (let guard = 0; guard < 1024; guard++) {
      let next = Infinity

      for (const runner of this.runners)
        if (runner.nextSample < next) next = runner.nextSample

      if (next >= horizon) break

      this.runSlice(next, sampleRate, output)
    }
  }

  // One instant of the timeline.
  runSlice(time, sampleRate, output) {
    const startSample = Math.floor(time)

    // Half a sample of tolerance: two runners on different divisions can land on the
    // same instant with the accumulated position differing in the last bit.
    const slice = this.runners.filter(runner => runner.nextSample < time + 0.5)

    // Upper CHAN tiles go first, which is what puts an accent lane placed above the
    // main one in a position to colour it.
    slice.sort((a, b) => a.order - b.order)

    // A lock reaches no further than the instant it sits in, so nothing carries over:
    // the working bank is the patch bank again at the top of every slice.
    for (let channel = 1; channel <= Channels; channel++)
      this.working[channel] = copyPatch(this.project.patches.at(channel))

    for (const runner of slice) this.execute(runner, startSample, sampleRate, output)
  }

  // Reads the step the runner is sitting on, then moves the runner along.
  execute(runner, startSample, sampleRate, output) {
    const stepSeconds = runner.stepSeconds(this.project.tempo)
    const lane = runner.lane
    const step = lane.stepAt(runner.stepIndex)

    runner.record(startSample, lane, runner.stepIndex)

    const destination = step == null ? null
      : this.descend(step, runner, startSample, stepSeconds, output)

    if (destination != null) {
      runner.lane = destination
      runner.stepIndex = 0
    } else {
      advance(runner)
    }

    runner.nextSample += stepSeconds * sampleRate
  }

  // Walks one stack from the rail row down, which is the whole of a step's meaning. A
  // gate ends the walk, so what sits above one is already done and what sits below it
  // never happens; a lock colours the notes that follow, whether further down this
  // stack or in a lane below on the same channel; a note is stamped with the channel
  // as it stands at that depth.
  //
  // Returns the lane the runner should leave for, if it met a jump.
  descend(step, runner, startSample, stepSeconds, output) {
    const channel = runner.channel

    let destination = null

    for (const tile of step.tiles) {
      if (tile instanceof GateTile && !tile.evaluate(runner.pass, this.random)) break

      if (tile instanceof ParamTile) {
        this.apply(tile, channel)
      } else if (tile instanceof NoteTile) {
        // A muted channel is read exactly as an unmuted one and drops its notes on
        // the way out, which is the last thing that happens to one: the gates have
        // already turned over, the locks have already coloured the working patch and
        // the jump below is still taken.
        if (this.mutes != null && !this.mutes.sounds(channel)) continue

        // Every note of a chord takes the channel as it stands where it sits, so a
        // lock between two of them separates the two.
        output.push(noteEvent(this.working[channel], tile.note,
                              tile.length * stepSeconds, startSample))
      } else if (tile instanceof JumpTile) {
        // Where the runner goes next, decided here but taken afterwards: the rest of
        // the stack still belongs to this instant. A stack with two reachable jumps in
        // it hands the runner to the lower one.
        const branch = this.project.score.destinationOf(tile)
        if (branch != null && branch.steps.length > 0) destination = branch
      }
    }

    return destination
  }

  // A lock always reaches the whole channel and never more than this instant, so
  // there is nothing to resolve about where it applies: it writes the working patch,
  // and whoever comes later in the pass reads it.
  apply(param, channel) {
    const absolute = param instanceof AbsoluteParamTile

    for (let target = 0; target < ParamTargets.Count; target++) {
      if (!param.isEngaged(target)) continue

      if (absolute) ParamTargets.set(this.working[channel], target, param.amount(target))
      else ParamTargets.add(this.working[channel], target, param.amount(target))
    }
  }
}

// Moves one step right, or back to the origin channel when the terminator is
// reached. The terminator takes no time of its own, so a lap lasts exactly as many
// steps as the lane has.
function advance(runner) {
  runner.stepIndex++

  if (runner.stepIndex < runner.lane.steps.length) return

  runner.lane = runner.originLane
  runner.stepIndex = 0
  runner.pass++
}
