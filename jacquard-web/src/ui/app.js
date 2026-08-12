// Ties the score, the runners, the synth and the chrome together.
//
// Timing comes from the audio clock, so this does not have to run at any particular
// rate: every step is handed over with the exact sample it is to start on, and a frame
// hitch delays the handover rather than the note.
//
// The sequencer runs a window ahead and LiveFx parks what it produces; a note leaves
// the queue only once it is nearly due, because what a live effect reaches is what has
// not been handed over yet. Nothing moves but the moment of the handover — the sample
// a note starts on was decided by the runner and is never touched.

import { Project } from '../core/project.js'
import * as ProjectFormat from '../core/format.js'
import { Sequencer } from '../core/sequencer.js'
import { LiveFx } from '../core/livefx.js'
import { ChannelMutes } from '../core/mutes.js'
import { AbsoluteParamTile, RelativeParamTile, ChannelTile } from '../core/tiles.js'
import { CellKind } from '../core/score.js'
import { FmSynth } from '../audio/synth.js'
import { ScoreView } from './score-view.js'
import { ScoreEditor } from './editor.js'
import { element, button, valueBar, stepper } from './controls.js'
import {
  tilePanel, soundPanel, lockPanel, sendFxPanels, globalPanel, channelsPanel, livePanel
} from './panels.js'
import { Visualizer } from './visualizer.js'
import { Presets } from '../../scores/presets.js'

// How far ahead of the audio clock the sequencer runs, and how far ahead of it a note
// is actually handed to the synth. The second is much the shorter of the two: at
// 129bpm a sixteenth is 116ms against a window of 120, so the two being one window is
// what would make a press take a step to be heard.
const Lookahead = 0.12
const LiveLead = 0.03

const StorageKey = 'jacquard.score'
const ThemeKey = 'jacquard.theme'

// Two looks, and the switch between them is the whole of the difference: the rack
// theme draws a module behind every lane, colours it by its channel and reads the
// jump links as patch cables, while the flat one is the monochrome the original is
// drawn in. Nothing in the score, the sequencer or the synth knows which is up.
const Themes = ['rack', 'flat']

export class JacquardApp {
  constructor(root) {
    this.root = root

    this.preset = 0
    this.theme = window.localStorage?.getItem(ThemeKey) ?? Themes[0]
    document.body.dataset.theme = this.theme

    this.project = this.readStartupScore()

    this.synth = new FmSynth(24)
    this.mutes = new ChannelMutes()
    this.sequencer = new Sequencer(this.project, this.mutes)
    this.live = new LiveFx()

    this.message = ''

    // Everything the transport row switches starts off: the plane is what the screen
    // is for, and a switch that starts on is a decision nobody made.
    this.showing = {
      sendFx: false, live: false, global: false, channels: false, visualizer: false
    }

    this.build()

    this.editor = new ScoreEditor(this)
    this.view.score = this.project.score
    this.view.sequencer = this.sequencer
    this.view.delegate = {
      dropTiles: (source, target) => { this.editor.dropTiles(source, target); this.refreshPanels() },
      dropLane: (lane, head) => { this.editor.dropLane(lane, head); this.refreshPanels() },
      placeNote: () => { this.editor.placeNote(); this.refreshPanels() },
      cursorMoved: () => this.refreshPanels()
    }

    this.view.rebuild()
    this.refreshPanels()

    this.bindKeys()

    requestAnimationFrame(() => this.frame())
  }

  // The score the app opens on. A file that will not read is not worth stopping for —
  // there is a whole app behind it that works without one — so it comes back as an
  // empty score with something to say.
  readStartupScore() {
    try {
      const saved = window.localStorage?.getItem(StorageKey)
      if (saved) {
        this.startupMessage = 'opened the saved score'
        return ProjectFormat.read(saved)
      }
    } catch (error) {
      this.startupMessage = 'could not read the saved score: ' + error.message
    }

    try {
      return ProjectFormat.read(Presets[this.preset].text)
    } catch (error) {
      this.startupMessage = 'could not read the startup score: ' + error.message
      return Project.createEmpty()
    }
  }

  // A preset is a score the app carries rather than a file, which is what the two
  // arrows on the transport step through. Loading one is the same path a file takes.
  selectPreset(delta) {
    this.preset = (this.preset + delta + Presets.length) % Presets.length
    this.open(Presets[this.preset].text, 'opened ' + Presets[this.preset].name)
  }

  toggleTheme() {
    this.theme = Themes[(Themes.indexOf(this.theme) + 1) % Themes.length]
    document.body.dataset.theme = this.theme
    window.localStorage?.setItem(ThemeKey, this.theme)
  }

  // Chrome

  build() {
    this.root.textContent = ''

    this.planeArea = element('div', 'plane-area')
    this.root.appendChild(this.planeArea)

    this.visualizer = new Visualizer(this.planeArea)
    this.view = new ScoreView(this.planeArea, {})

    this.leftColumn = element('div', 'column left')
    this.rightColumn = element('div', 'column right')
    this.innerColumn = element('div', 'column inner')
    this.centre = element('div', 'centre')
    this.bottom = element('div', 'bottom')

    this.root.append(this.leftColumn, this.innerColumn, this.rightColumn,
                     this.centre, this.bottom)

    this.rightColumn.appendChild(this.buildTransport())

    this.cursorPanels = element('div', 'stack-panels')
    this.rightColumn.appendChild(this.cursorPanels)
  }

  buildTransport() {
    const node = element('div', 'transport')

    this.playButton = button('Play', () => this.togglePlay(), 'play')
    node.appendChild(this.playButton)

    node.appendChild(valueBar({
      label: 'Tempo',
      min: 40, max: 240,
      get: () => this.project.tempo,
      set: value => { this.project.tempo = value; this.touch() },
      format: value => value.toFixed(1) + ' bpm'
    }))

    node.appendChild(stepper('Preset', Presets[this.preset].name,
      delta => this.selectPreset(delta)))

    const switches = element('div', 'switches')

    const toggle = (label, key, after = null) => {
      const control = button(label, () => {
        this.showing[key] = !this.showing[key]
        if (after) after()
        this.refreshPanels()
      }, 'small toggle' + (this.showing[key] ? ' on' : ''))
      switches.appendChild(control)
      return control
    }

    toggle('Send FX', 'sendFx')
    toggle('Live FX', 'live')
    toggle('Global', 'global')
    toggle('Channels', 'channels')
    toggle('Scope', 'visualizer')

    switches.appendChild(button(this.theme === 'rack' ? 'Rack' : 'Flat', () => {
      this.toggleTheme()
      this.refreshPanels()
    }, 'small toggle' + (this.theme === 'rack' ? ' on' : '')))

    node.appendChild(switches)

    const files = element('div', 'switches')

    files.appendChild(button('Save', () => this.save(), 'small'))
    files.appendChild(button('Load', () => this.load(), 'small'))
    files.appendChild(button('Export', () => this.exportFile(), 'small'))
    files.appendChild(button('Import', () => this.importFile(), 'small'))

    node.appendChild(files)

    this.status = element('div', 'status')
    node.appendChild(this.status)

    return node
  }

  // Whatever changed is in the model already; this is what the screen does about it.
  // A bar being dragged reaches here, which is why nothing in it rebuilds a panel: the
  // run of controls a hand is holding has to survive the value it is setting.
  touch() {
    this.view.rebuild()
  }

  // A structural change: the score is a different shape, so the panels are rebuilt
  // around the cell the cursor is now on.
  scoreChanged() {
    this.view.rebuild()
  }

  refreshPanels() {
    this.cursorPanels.textContent = ''
    this.innerColumn.textContent = ''
    this.leftColumn.textContent = ''
    this.centre.textContent = ''
    this.bottom.textContent = ''

    this.cursorPanels.appendChild(tilePanel(this))

    // Beside the tile panel comes up either the Sound panel, while a CHAN cell is
    // selected, or the Lock panel, while a lock is. No cell is both, which is why they
    // share a slot.
    const cell = this.editor.cell

    if (cell.tile instanceof AbsoluteParamTile || cell.tile instanceof RelativeParamTile)
      this.cursorPanels.appendChild(lockPanel(this))
    else if (cell.kind === CellKind.Head && cell.tile instanceof ChannelTile)
      this.cursorPanels.appendChild(soundPanel(this))

    if (this.showing.sendFx)
      for (const node of sendFxPanels(this)) this.innerColumn.appendChild(node)

    if (this.showing.channels) this.leftColumn.appendChild(channelsPanel(this))
    if (this.showing.global) this.centre.appendChild(globalPanel(this))
    if (this.showing.live) this.bottom.appendChild(livePanel(this))

    this.visualizer.enabled = this.showing.visualizer

    // The switches read their own state, so the row is rebuilt with them.
    const transport = this.rightColumn.firstChild
    this.rightColumn.replaceChild(this.buildTransport(), transport)
    this.rightColumn.appendChild(this.cursorPanels)
  }

  // Transport

  async togglePlay() {
    await this.synth.start()

    if (this.sequencer.isPlaying) {
      // What has already been handed over is left to sound: a note is a voice by then,
      // and cutting one is a different thing from stopping the sequence.
      this.sequencer.stop()
      this.live.stop()
    } else {
      // Read once, so that the grid a live effect counts its sixteenths from is the
      // sample the first step lands on and not one beside it.
      const now = this.synth.currentSample
      this.sequencer.play(now, this.lookaheadSamples)
      this.live.start(now + this.lookaheadSamples)
    }

    this.view.refreshPlayheads()
    this.refreshPanels()
  }

  get lookaheadSamples() {
    return Math.round(Lookahead * this.synth.sampleRate) + this.synth.minimumLead
  }

  get liveLeadSamples() {
    return Math.round(LiveLead * this.synth.sampleRate) + this.synth.minimumLead
  }

  frame() {
    const now = this.synth.currentSample

    const pending = []
    this.sequencer.schedule(now, this.lookaheadSamples, this.synth.sampleRate, pending)
    this.live.enqueue(pending)

    const released = []
    this.live.handOver(now + this.liveLeadSamples, this.project.tempo,
                       this.synth.sampleRate, released)

    this.synth.scheduleAll(released)

    // Handed over whenever they are not what was handed over last. One comparison
    // covers a bar being dragged, the tempo changing and a file being loaded.
    this.synth.updateFx(this.project.fx, this.project.limiter, this.project.tempo)

    this.view.refreshPlayheads()
    this.visualizer.draw(this.synth.scope)

    this.playButton.textContent = this.sequencer.isPlaying ? 'Stop' : 'Play'

    const status = this.synth.status
    this.status.textContent =
      (this.message || this.startupMessage || '') +
      (this.message || this.startupMessage ? ' · ' : '') +
      status.activeVoices + '/' + this.synth.maxVoices + ' voices'

    requestAnimationFrame(() => this.frame())
  }

  // Files
  //
  // The original writes plain text files to the persistent data path. A page has a
  // store of its own and a downloads folder, so a save is both: the score is kept where
  // the page will find it again, and Export hands over the same text as a file.

  save() {
    try {
      window.localStorage.setItem(StorageKey, ProjectFormat.write(this.project))
      this.setMessage('saved')
    } catch (error) {
      this.setMessage('could not save: ' + error.message)
    }
  }

  load() {
    const text = window.localStorage.getItem(StorageKey)

    if (text == null) {
      this.setMessage('nothing saved yet')
      return
    }

    this.open(text, 'loaded')
  }

  exportFile() {
    const blob = new Blob([ProjectFormat.write(this.project)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'score' + ProjectFormat.Extension + '.txt'
    link.click()

    URL.revokeObjectURL(url)
    this.setMessage('exported')
  }

  importFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.jacquard,text/plain'

    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      if (file == null) return
      this.open(await file.text(), 'imported ' + file.name)
    })

    input.click()
  }

  open(text, what) {
    let project

    try {
      project = ProjectFormat.read(text)
    } catch (error) {
      this.setMessage('could not read that score: ' + error.message)
      return
    }

    this.sequencer.stop()
    this.live.stop()
    this.synth.flush()

    this.project = project
    this.sequencer.project = project
    this.view.score = project.score

    this.view.rebuild()
    this.refreshPanels()
    this.setMessage(what)
  }

  setMessage(text) {
    this.message = text
    this.startupMessage = null
  }

  // Keys

  bindKeys() {
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement) return

      // A control that is focused has its own answer to the key, and a live effect
      // held with the space bar must not also work the transport.
      if (event.target instanceof HTMLButtonElement) return

      if (event.key === ' ') {
        event.preventDefault()
        this.togglePlay()
        return
      }

      if (this.editor.handleKey(event)) {
        event.preventDefault()
        this.refreshPanels()
      }
    })
  }
}
