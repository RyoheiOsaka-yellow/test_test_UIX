// The panels.
//
// A panel shows what the cursor is on, and nothing is toggled. The tile panel keeps
// the corner and follows the cursor; beside it comes up either the Sound panel, while
// a CHAN cell is selected, or the Lock panel, while a lock is. Those two are the same
// list of parameters read two ways — what a channel sounds like, and what one step
// does to it — and they share a slot because no cell is both.
//
// A panel's header is its subject, not its name: Note Tile, Cycle Gate Tile, Channel 1
// Sound, Channel 5 Lock — the kind of panel and the thing it is showing on one line,
// since which panel this is was never in doubt and the thing changes under the cursor.
//
// The send effects are the one exception, and they are the exception because they have
// to be: one reverb and one delay for the whole project answer to no cell, so there is
// no cursor position that could bring them up. They pay for the state they add by not
// being up unless asked for.

import { CellKind } from '../core/score.js'
import {
  TileKind, NoteTile, AbsoluteParamTile, RelativeParamTile,
  CycleGateTile, ProbGateTile, ChannelTile, JumpTile, JumpDestTile
} from '../core/tiles.js'
import * as ParamTargets from '../core/params.js'
import * as Pitch from '../core/pitch.js'
import { DelayTime, Limiter, MaxFeedback, Channels } from '../core/project.js'
import { LiveEffect, LiveEffectNames } from '../core/livefx.js'
import { element, button, holdButton, panel, heading, row, stepper, valueBar }
  from './controls.js'
import { channelHue, spread } from './style.js'

// Which targets read better on a geometric travel: a range that spans decades is a
// ratio at every point along it, and an exponent is the wrong shape for one.
const Geometric = new Set([
  ParamTargets.CarAttack, ParamTargets.CarRelease, ParamTargets.PitchDecay
])

const taperFor = target => Geometric.has(target) ? 'geometric' : 'linear'

// The tile panel

export function tilePanel(app) {
  const editor = app.editor
  const cell = editor.cell
  const tile = cell.tile

  const node = panel(headerFor(cell), 'tile-panel')

  if (cell.kind === CellKind.Tile && tile instanceof NoteTile) {
    node.appendChild(valueBar({
      label: 'Pitch',
      min: Pitch.Lowest, max: Pitch.Highest,
      get: () => tile.note,
      set: value => { tile.note = Math.round(value); editor.rememberNote(tile); app.touch() },
      settled: () => editor.preview(tile.note),
      format: value => Pitch.toName(Math.round(value))
    }))

    node.appendChild(valueBar({
      label: 'Length',
      min: 0.05, max: 8,
      get: () => tile.length,
      set: value => {
        tile.length = Math.max(0.05, Math.round(value * 100) / 100)
        editor.rememberNote(tile)
        app.touch()
      },
      settled: () => editor.preview(tile.note)
    }))
  }

  if (tile instanceof CycleGateTile) {
    node.appendChild(valueBar({
      label: 'Period',
      min: CycleGateTile.MinPeriod, max: CycleGateTile.MaxPeriod,
      get: () => tile.period,
      set: value => { tile.period = Math.round(value); app.touch(); refreshLaps() },
      format: value => String(Math.round(value))
    }))

    // The switches are all thirty-two of them, hidden rather than rebuilt: a run that
    // tore itself down as the period bar moved would take the drag that was moving it
    // with it.
    const laps = element('div', 'laps')
    const switches = []

    for (let lap = 1; lap <= CycleGateTile.MaxPeriod; lap++) {
      const box = button(String(lap), () => {
        tile.setFires(lap, !tile.fires(lap))
        app.touch()
        refreshLaps()
      }, 'lap')

      switches.push(box)
      laps.appendChild(box)
    }

    const refreshLaps = () => {
      switches.forEach((box, i) => {
        box.style.display = i < tile.period ? '' : 'none'
        box.classList.toggle('on', tile.fires(i + 1))
      })
    }

    refreshLaps()
    node.appendChild(laps)
  }

  if (tile instanceof ProbGateTile) {
    node.appendChild(valueBar({
      label: 'Chance',
      min: 0, max: 100,
      get: () => tile.percent,
      set: value => { tile.percent = value; app.touch() },
      format: value => value.toFixed(1) + '%'
    }))
  }

  if (tile instanceof JumpTile) {
    const branch = app.project.score.destinationOf(tile)
    node.appendChild(element('p', 'note',
      branch == null ? 'No destination lane.'
        : 'Hands the runner to the lane at ' + branch.headX + ',' + branch.y +
          ' from the next step. A gate above it is what makes a jump worth placing.'))
  }

  if (cell.kind === CellKind.Head || cell.kind === CellKind.Term) {
    const lane = cell.lane

    if (lane.channel != null) {
      node.appendChild(valueBar({
        label: 'Channel',
        min: 1, max: Channels,
        get: () => lane.channel.channel,
        set: value => { lane.channel.channel = Math.round(value); app.touch() },
        settled: () => app.refreshPanels(),
        format: value => 'CH' + Math.round(value)
      }))

      const divisions = ChannelTile.Divisions
      node.appendChild(stepper('Step', '1/' + lane.channel.division, delta => {
        const index = divisions.indexOf(lane.channel.division)
        const next = Math.min(Math.max(index + delta, 0), divisions.length - 1)
        lane.channel.division = divisions[next]
        app.touch()
        app.refreshPanels()
      }))
    } else {
      node.appendChild(element('p', 'note',
        'A branch lane, entered only through the jump that answers to it. Its ' +
        'terminator returns to the channel that called it rather than to this head.'))
    }

    node.appendChild(stepper('Steps', lane.steps.length, delta => {
      editor.resizeLane(delta)
      app.refreshPanels()
    }, delta => delta < 0 ? lane.steps.length > 1 : app.project.score.hasRoomToGrow(lane)))
  }

  // The panel is also where a tile is put down, since the cursor is already the answer
  // to where. A cell that will take one offers the tiles instead of a description of
  // nothing, and bare ground offers a lane to put one on.
  if (editor.canPlace) {
    node.appendChild(heading('Place'))

    const palette = element('div', 'palette')

    for (const kind of [TileKind.Note, TileKind.AbsoluteLock, TileKind.RelativeLock,
                        TileKind.CycleGate, TileKind.ChanceGate, TileKind.Jump])
      palette.appendChild(button(kind, () => {
        editor.put(kind)
        app.refreshPanels()
      }))

    node.appendChild(palette)
  } else if (cell.kind === CellKind.Empty) {
    node.appendChild(button('New Lane', () => {
      editor.newChannelLane()
      app.refreshPanels()
    }))
  }

  if (cell.kind === CellKind.Tile || cell.kind === CellKind.Head)
    node.appendChild(button(cell.kind === CellKind.Head ? 'Delete Lane' : 'Delete', () => {
      editor.delete()
      app.refreshPanels()
    }, 'danger'))

  return node
}

function headerFor(cell) {
  const tile = cell.tile

  if (cell.kind === CellKind.Head)
    return tile instanceof ChannelTile ? 'Channel ' + tile.channel + ' Lane' : 'Branch Lane'

  if (cell.kind === CellKind.Term) return 'Terminator'
  if (cell.kind === CellKind.Rail) return 'Empty Step'
  if (cell.kind === CellKind.Empty) return 'Plane'

  if (tile instanceof NoteTile) return 'Note Tile — ' + tile.token
  if (tile instanceof AbsoluteParamTile) return 'Absolute Lock Tile'
  if (tile instanceof RelativeParamTile) return 'Relative Lock Tile'
  if (tile instanceof CycleGateTile) return 'Cycle Gate Tile'
  if (tile instanceof ProbGateTile) return 'Chance Gate Tile'
  if (tile instanceof JumpTile) return 'Jump Tile'
  if (tile instanceof JumpDestTile) return 'Jump Destination'

  return 'Tile'
}

// The Sound panel, and the Lock panel that shares its slot: the same list of
// parameters read two ways.

export function soundPanel(app) {
  const channel = app.editor.channel
  const patch = app.project.patches.at(channel)

  const node = panel('Channel ' + channel + ' Sound', 'sound-panel')

  for (let target = 0; target < ParamTargets.Count; target++)
    node.appendChild(valueBar({
      label: ParamTargets.name(target),
      min: ParamTargets.min(target),
      max: ParamTargets.max(target),
      taper: taperFor(target),
      hue: spread(target, ParamTargets.Count),
      get: () => ParamTargets.get(patch, target),
      set: value => { ParamTargets.set(patch, target, value); app.touch() },
      // The audition hangs off the settled report: sounding a note per event turned a
      // drag down a bar into a burst of a hundred, none of which was the value being
      // chosen.
      settled: () => app.editor.preview(app.editor.notePitch, channel)
    }))

  return node
}

export function lockPanel(app) {
  const tile = app.editor.selected
  const channel = app.editor.channel
  const patch = app.project.patches.at(channel)
  const absolute = tile instanceof AbsoluteParamTile

  const node = panel('Channel ' + channel + (absolute ? ' Absolute Lock' : ' Relative Lock'),
                     'lock-panel')

  node.appendChild(element('p', 'note',
    absolute ? 'Sets the parameters it holds for this instant only. What it does not ' +
               'hold is left entirely to the channel.'
             : 'Shifts the parameters it holds from wherever the channel has them, ' +
               'for this instant only.'))

  // Every target is listed and the ones nothing has engaged are drawn faintly: a bar
  // moved is a parameter taken hold of, and a tap on the name lets it go, because a
  // value nobody has set is not a lock. The faint rows read what the channel would do
  // without this tile — the patch's own value for an absolute lock, and no shift at
  // all for a relative one.
  for (let target = 0; target < ParamTargets.Count; target++) {
    const span = ParamTargets.max(target) - ParamTargets.min(target)

    const bar = valueBar({
      label: ParamTargets.name(target),
      min: absolute ? ParamTargets.min(target) : -span,
      max: absolute ? ParamTargets.max(target) : span,
      taper: absolute ? taperFor(target) : 'linear',
      hue: spread(target, ParamTargets.Count),
      get: () => tile.isEngaged(target) ? tile.amount(target)
        : absolute ? ParamTargets.get(patch, target) : 0,
      set: value => { tile.engage(target, value); app.touch() },
      engaged: () => tile.isEngaged(target),
      onRelease: () => { tile.release(target); app.touch() }
    })

    node.appendChild(bar)
  }

  return node
}

// The send effects: one panel each, and not one panel with two headings in it. A panel
// is already the thing that says this group of rows is about that.

export function sendFxPanels(app) {
  const fx = app.project.fx

  const reverb = panel('Reverb', 'fx-panel')

  const add = (node, label, min, max, key, taper = 'linear', hue = 265) =>
    node.appendChild(valueBar({
      label, min, max, taper, hue,
      get: () => fx[key],
      set: value => { fx[key] = value; app.touch() }
    }))

  add(reverb, 'Size', 0, 1, 'reverbSize')
  add(reverb, 'Damping', 0, 1, 'reverbDamp')
  add(reverb, 'Width', 0, 1, 'reverbWidth')

  const delay = panel('Delay', 'fx-panel')

  // The time is never a number of milliseconds: it is a note value, and what it comes
  // to in seconds is whatever the tempo says.
  delay.appendChild(stepper('Time', DelayTime.Names[DelayTime.nearest(fx.delayBeats)],
    delta => {
      const index = DelayTime.nearest(fx.delayBeats)
      const next = Math.min(Math.max(index + delta, 0), DelayTime.Beats.length - 1)
      fx.delayBeats = DelayTime.Beats[next]
      app.touch()
      app.refreshPanels()
    }))

  add(delay, 'Feedback', 0, MaxFeedback, 'delayFeedback', 'linear', 190)
  add(delay, 'Tone', 0, 1, 'delayTone', 'linear', 190)
  add(delay, 'Spread', 0, 1, 'delaySpread', 'linear', 190)

  return [reverb, delay]
}

// The Global panel, which is a name for what will be on it rather than for what is on
// it now. It comes up in the middle of the screen: a limiter is set while listening to
// the whole mix with the eye nowhere in particular.

export function globalPanel(app) {
  const limiter = app.project.limiter
  const node = panel('Global', 'global-panel')

  node.appendChild(heading('Limiter'))

  const add = (label, min, max, key, taper = 'linear', format = null) =>
    node.appendChild(valueBar({
      label, min, max, taper, format, hue: 30,
      get: () => limiter[key],
      set: value => { limiter[key] = value; app.touch() }
    }))

  add('Drive', 0, Limiter.MaxDrive, 'drive', 'linear', v => v.toFixed(1) + ' dB')
  add('Ceiling', Limiter.MinCeiling, 0, 'ceiling', 'linear', v => v.toFixed(1) + ' dB')
  add('Attack', Limiter.MinAttack, Limiter.MaxAttack, 'attack', 'geometric',
      v => (v * 1000).toPrecision(3) + ' ms')
  add('Release', Limiter.MinRelease, Limiter.MaxRelease, 'release', 'geometric',
      v => (v * 1000).toPrecision(3) + ' ms')

  node.appendChild(element('p', 'note',
    'The drive is what is played: the ratio is infinite, and the attack is a hole in ' +
    'the limiting for as long as it lasts — which is the punch.'))

  return node
}

// The Channels panel, in the one corner the cursor's panels never reach.

export function channelsPanel(app) {
  const node = panel('Channels', 'channels-panel')

  for (let channel = 1; channel <= Channels; channel++) {
    const lane = app.project.score.lanes
      .find(lane => lane.channel?.channel === channel) ?? null

    const mute = button('M', () => {
      app.mutes.setMuted(channel, !app.mutes.isMuted(channel))
      app.refreshPanels()
    }, 'small toggle' + (app.mutes.isMuted(channel) ? ' on' : ''))

    const solo = button('S', () => {
      app.mutes.setSoloed(channel, !app.mutes.isSoloed(channel))
      app.refreshPanels()
    }, 'small toggle' + (app.mutes.isSoloed(channel) ? ' on' : ''))

    // Select is the row's way onto the plane rather than a second way of opening a
    // panel: it moves the cursor to the CHAN tile that names the channel, and the
    // Sound panel comes up because the cursor is on it.
    const select = button('CH' + channel, () => {
      if (lane == null) return
      app.view.setCursor(lane.headPoint)
      app.view.scrollIntoView(lane.headPoint)
      app.refreshPanels()
    }, 'small')

    select.disabled = lane == null

    // With anything soloed the mutes are not consulted at all, so they grey out rather
    // than clearing themselves: dropping the last solo gives back the mix underneath.
    mute.classList.toggle('idle', app.mutes.anySoloed)

    const line = row(select, mute, solo)
    line.style.setProperty('--hue', channelHue(channel))
    node.appendChild(line)
  }

  return node
}

// The Live FX panel: the one that is played rather than read, so it is the one in
// neither column. Six columns of two, and the top of a column is always the smaller of
// the pair — so where a button is says what it does before the word on it does.

export function livePanel(app) {
  const node = panel(null, 'live-panel')

  const columns = [
    [LiveEffect.Reverb, LiveEffect.Delay],
    [LiveEffect.Stab, LiveEffect.Sustain],
    [LiveEffect.OctaveDown, LiveEffect.OctaveUp],
    [LiveEffect.Fall, LiveEffect.Rise],
    [LiveEffect.Roll1, LiveEffect.Roll2],
    [LiveEffect.Roll3, LiveEffect.Roll4]
  ]

  for (const column of columns) {
    const box = element('div', 'live-column')

    for (const fx of column) {
      const control = holdButton(LiveEffectNames[fx],
        () => app.live.press(fx, app.synth.currentSample),
        () => app.live.release(fx))

      control.style.setProperty('--hue', spread(fx, 12, 300, 340))
      box.appendChild(control)
    }

    node.appendChild(box)
  }

  return node
}
