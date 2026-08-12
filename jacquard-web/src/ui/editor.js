// Editing operations, one place for every change the user can make to a score.
//
// The cursor is also the selection: there is no separate notion of a selected tile, so
// what the detail panel shows is whatever the cursor is standing on.
//
// A tile goes down on free ground only, which is what the panel offers one on. A stack
// is therefore written from the top down — the gate first, the note it governs in the
// cell underneath it — rather than by pushing a tile in above one that is already
// there.

import { CellKind } from '../core/score.js'
import {
  TileKind, NoteTile, ChannelTile, JumpTile,
  AbsoluteParamTile, RelativeParamTile, CycleGateTile, ProbGateTile
} from '../core/tiles.js'
import { point } from '../core/lane.js'
import { noteEvent } from '../core/patch.js'
import * as Pitch from '../core/pitch.js'

export class ScoreEditor {
  constructor(app) {
    this.app = app

    // A new note arrives at the pitch and length of the last one worked on, rather
    // than at a fixed middle C: notes come in runs that stay in a register and usually
    // keep a length.
    this.notePitch = 60
    this.noteLength = 1
  }

  get project() { return this.app.project }
  get score() { return this.app.project.score }
  get view() { return this.app.view }

  get cell() { return this.score.at(this.view.cursor) }
  get selected() { return this.cell.tile }

  get selectedLane() {
    const cell = this.cell
    if (cell.lane != null) return cell.lane

    // Standing next to a lane still counts, so that a lane can be worked on without
    // hunting for one of its cells.
    return this.score.lanes.find(lane => lane.isOnRail(this.view.cursor)) ?? null
  }

  // The channel being worked on, which is what picks the timbre the sound panel edits
  // and the one a preview is heard through.
  get channel() { return this.score.channelOf(this.selectedLane) }

  // Whether the cursor is standing on ground that will take a tile: a lane's empty
  // step, the cell under a stack, or the terminator, which takes one by growing the
  // lane.
  get canPlace() {
    const cell = this.cell
    if (cell.kind === CellKind.Tile || cell.kind === CellKind.Head) return false
    return this.score.placementLane(this.view.cursor) != null
  }

  // Places whatever the panel hands over. A jump brings its branch lane along, so that
  // one jump to one destination holds at every moment of editing rather than being
  // checked afterwards.
  put(kind) {
    let tile

    switch (kind) {
      // Holding nothing yet. Which parameters a lock takes is the whole of what there
      // is to say about one, so it is said on the panel rather than guessed at here.
      case TileKind.AbsoluteLock: tile = new AbsoluteParamTile(); break
      case TileKind.RelativeLock: tile = new RelativeParamTile(); break
      case TileKind.CycleGate: tile = new CycleGateTile(4, '1000'); break
      case TileKind.ChanceGate: tile = new ProbGateTile(50); break
      case TileKind.Jump: tile = new JumpTile(); break
      default: tile = new NoteTile(this.notePitch, this.noteLength); break
    }

    if (!this.canPlace || !this.score.place(this.view.cursor, tile)) return

    if (tile instanceof JumpTile) {
      const below = point(Math.max(1, this.view.cursor.x - 4), this.score.height + 1)
      this.score.addBranchLane(tile, below, 4)
    }

    if (tile instanceof NoteTile) this.preview(tile.note)

    this.commit()
  }

  // The shorthand for the Note button, since a note is what most cells get and a
  // double click is already on the cell that would take one.
  placeNote() { this.put(TileKind.Note) }

  delete() {
    const cell = this.cell

    // Deleting a lane's head is how a lane is removed, which also takes any branch
    // lanes it fed.
    if (cell.kind === CellKind.Head && cell.lane != null) {
      this.score.removeLane(cell.lane)
      this.commit()
      return
    }

    if (this.score.remove(this.view.cursor)) this.commit()
  }

  rememberNote(note) {
    this.notePitch = note.note
    this.noteLength = note.length
  }

  transpose(semitones) {
    const note = this.selected
    if (!(note instanceof NoteTile)) return

    note.note = Math.min(Math.max(note.note + semitones, Pitch.Lowest), Pitch.Highest)
    this.rememberNote(note)
    this.preview(note.note)
    this.commit()
  }

  // Lanes

  newChannelLane() {
    const p = this.score.findFreeRow(this.view.cursor, 16)
    this.score.addLane(p.x, p.y, new ChannelTile(this.channel), 16)
    this.commit()
  }

  resizeLane(delta) {
    const lane = this.selectedLane
    if (lane == null) return

    if (delta > 0) {
      // Only grow into free ground, so that lanes cannot be made to overlap.
      if (!this.score.hasRoomToGrow(lane)) return
      lane.addStep()
    } else if (lane.steps.length > 1) {
      lane.steps.pop()
    }

    this.commit()
  }

  // Dragging
  //
  // Where a tile goes is a question the plane can answer directly, so it is asked
  // there. That leaves nothing here to do but apply what the drop resolved to and
  // follow it with the cursor, so that the panel goes on showing what was just moved.

  dropTiles(source, target) {
    const move = this.score.planMove(source, target)
    if (!this.score.applyMove(source, move)) return

    this.commit()
    this.view.setCursor(move.lane.cellPoint(move.step, move.depth))
  }

  dropLane(lane, head) {
    if (!this.score.moveLane(lane, head)) return

    this.commit()
    this.view.setCursor(head)
  }

  // Playback

  // Sounds a note straight away, so that editing is audible. It goes out with the
  // timbre of the channel the cursor is on, so what a note sounds like here is what it
  // will sound like when the sequence reaches it.
  preview(note, channel = this.channel) {
    const synth = this.app.synth
    if (synth == null) return

    const patch = this.project.patches.at(channel)
    const start = synth.currentSample + synth.minimumLead + synth.sampleRate / 20
    const length = 60 / Math.max(this.project.tempo, 1) / 4

    synth.schedule(noteEvent(patch, note, length, start))
  }

  commit() {
    this.app.sequencer.resync()
    this.app.scoreChanged()
  }

  // Keyboard
  //
  // What is left to the keys is moving about and the two edits worth repeating:
  // deleting, and walking a note up or down. Putting a tile down is the panel's, so
  // that there is one way of doing it and it is the one on screen.
  handleKey(event) {
    const shift = event.shiftKey
    const command = event.metaKey || event.ctrlKey

    switch (event.key) {
      case 'ArrowLeft': this.view.moveCursor(-1, 0); return true
      case 'ArrowRight': this.view.moveCursor(1, 0); return true

      case 'ArrowUp':
        if (shift) this.transpose(command ? 12 : 1)
        else this.view.moveCursor(0, -1)
        return true

      case 'ArrowDown':
        if (shift) this.transpose(command ? -12 : -1)
        else this.view.moveCursor(0, 1)
        return true

      case 'Delete':
      case 'Backspace':
        this.delete()
        return true

      case 'Enter': {
        const note = this.selected
        if (note instanceof NoteTile) this.preview(note.note)
        return true
      }

      case '#':
      case '+':
        this.transpose(1)
        return true

      case '-':
        this.transpose(-1)
        return true
    }

    return false
  }
}
