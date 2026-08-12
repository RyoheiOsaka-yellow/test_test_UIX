// The score plane.
//
// Cells are laid out at the pitch mockup.html settled on, the rails and the jump links
// are drawn under them, and the cursor is also the selection: there is no separate
// notion of a selected tile, so what a panel shows is whatever the cursor is standing
// on.
//
// A drag means whatever the cell under it holds. A tile or a lane head has something
// to carry, so a drag there carries it; free ground has nothing to carry, so a drag
// there moves the plane instead. That is what lets the plane be panned by a fingertip
// without a modifier: the modifier was never the point, only a way of telling a press
// that means move this from one that means edit this, and the cell answers that by
// itself.

import { CellKind } from '../core/score.js'
import {
  NoteTile, ParamTile, AbsoluteParamTile, CycleGateTile, ProbGateTile,
  JumpTile, ChannelTile, JumpDestTile
} from '../core/tiles.js'
import * as Pitch from '../core/pitch.js'
import * as Style from './style.js'
import { Icons, cycle, prob, Marker, roundedPath } from './icons.js'
import { point } from '../core/lane.js'

const Sharp = '♯'

// Four pixels of travel separate a pan from a tap, since a fingertip does not hold
// still.
const DragSlop = 4

export class ScoreView {
  constructor(container, delegate) {
    this.container = container
    this.delegate = delegate

    this.score = null
    this.sequencer = null

    this.cursor = point(1, 1)
    this.origin = { x: 0, y: 0 }

    this.plane = document.createElement('div')
    this.plane.className = 'plane'
    container.appendChild(this.plane)

    this.cells = new Map()
    this.playing = []

    this.cursorBox = document.createElement('div')
    this.cursorBox.className = 'cursor-box'

    this.dropBox = document.createElement('div')
    this.dropBox.className = 'drop-box'

    this.bindPointer()
  }

  // Layout

  rebuild() {
    const score = this.score

    // Room past what the score uses, since a lane carried by its head has to have
    // somewhere to land and a new one has to have somewhere to go.
    const columns = Math.max(score.width + 8, 28)
    const rows = Math.max(score.height + 8, 18)

    const size = Style.planeSize(columns, rows)

    this.plane.style.width = size.width + 'px'
    this.plane.style.height = size.height + 'px'
    this.plane.textContent = ''
    this.cells.clear()

    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    layer.setAttribute('class', 'links')
    layer.setAttribute('width', size.width)
    layer.setAttribute('height', size.height)

    // The rails first, so that the cells stand over them.
    for (const lane of score.lanes) this.plane.appendChild(rail(lane))

    // Route each link down out of its JUMP cell, across the row above the target lane,
    // then down into that lane's JDST cell.
    for (const lane of score.lanes) {
      if (lane.jumpSource == null) continue

      const from = score.locate(lane.jumpSource)
      if (from == null) continue

      const a = Style.cellCenter(from)
      const b = Style.cellCenter(lane.headPoint)
      const midY = Style.cellCenter(point(lane.headX, lane.y - 1)).y + Style.LinkOffset

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', roundedPath([
        [a.x + Style.LinkOffset, a.y],
        [a.x + Style.LinkOffset, midY],
        [b.x + Style.LinkOffset, midY],
        [b.x + Style.LinkOffset, b.y]
      ], Style.LinkRadius))

      layer.appendChild(path)
    }

    this.plane.appendChild(layer)

    const fragment = document.createDocumentFragment()

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const p = point(x, y)
        const node = this.buildCell(p)
        this.cells.set(x + ',' + y, node)
        fragment.appendChild(node)
      }

    this.plane.appendChild(fragment)
    this.plane.append(this.cursorBox, this.dropBox)

    this.refreshCursor()
    this.refreshPlayheads()
  }

  buildCell(p) {
    const node = document.createElement('div')
    const origin = Style.cellOrigin(p)

    node.className = 'cell'
    node.style.left = origin.x + 'px'
    node.style.top = origin.y + 'px'
    node.dataset.x = p.x
    node.dataset.y = p.y

    const cell = this.score.at(p)

    switch (cell.kind) {
      case CellKind.Tile:
        node.classList.add('tile')
        renderTile(node, cell.tile)
        // Chain lines are drawn only between cells of the same stack: joining whatever
        // happens to sit directly above would make two unrelated lanes look connected.
        if (cell.depth > 0) node.classList.add('linked')
        break

      case CellKind.Head:
        node.classList.add('tile', 'inverted', 'control-tile')
        if (cell.tile instanceof ChannelTile)
          node.innerHTML = '<span class="label">CH' + cell.tile.channel + '</span>'
        else
          node.innerHTML = Icons.JDST
        break

      case CellKind.Term:
        node.classList.add('tile', 'inverted', 'control-tile')
        node.innerHTML = Icons.TERM
        break

      case CellKind.Rail:
        // The marker shows up on a rail cell whose step holds nothing, which makes it
        // the mark of a beat the sequence passes straight through.
        node.classList.add('marker')
        node.innerHTML = Marker
        break

      default:
        node.classList.add('lattice')
        node.textContent = '・'
        break
    }

    return node
  }

  // Cursor and playheads

  setCursor(p) {
    this.cursor = point(Math.max(0, p.x), Math.max(0, p.y))
    this.refreshCursor()
    this.delegate.cursorMoved?.()
  }

  moveCursor(dx, dy) {
    this.setCursor(point(this.cursor.x + dx, this.cursor.y + dy))
    this.scrollIntoView(this.cursor)
  }

  refreshCursor() {
    const origin = Style.cellOrigin(this.cursor)
    this.cursorBox.style.left = origin.x + 'px'
    this.cursorBox.style.top = origin.y + 'px'
  }

  refreshPlayheads() {
    for (const node of this.playing) node.classList.remove('playing')
    this.playing = []

    if (this.sequencer == null || !this.sequencer.isPlaying) return

    for (const runner of this.sequencer.runners) {
      const lane = runner.playingLane
      if (lane == null || runner.playingStep < 0) continue
      if (!this.score.lanes.includes(lane)) continue

      const step = lane.stepAt(runner.playingStep)
      const depth = Math.max(step?.depth ?? 1, 1)

      for (let d = 0; d < depth; d++) {
        const p = lane.cellPoint(runner.playingStep, d)
        const node = this.cells.get(p.x + ',' + p.y)
        if (node == null) continue
        node.classList.add('playing')
        this.playing.push(node)
      }
    }
  }

  // Where the plane is

  pan(dx, dy) {
    this.origin.x += dx
    this.origin.y += dy
    this.plane.style.transform =
      'translate(' + this.origin.x + 'px,' + this.origin.y + 'px)'
  }

  scrollIntoView(p) {
    const origin = Style.cellOrigin(p)
    const view = this.container.getBoundingClientRect()

    const x = origin.x + this.origin.x
    const y = origin.y + this.origin.y

    const margin = Style.StrideX * 2

    if (x < margin) this.pan(margin - x, 0)
    else if (x > view.width - margin) this.pan(view.width - margin - x, 0)

    if (y < margin) this.pan(0, margin - y)
    else if (y > view.height - margin) this.pan(0, view.height - margin - y)
  }

  cellUnder(clientX, clientY) {
    const view = this.container.getBoundingClientRect()
    return Style.cellAt(clientX - view.left - this.origin.x,
                        clientY - view.top - this.origin.y)
  }

  // Input

  bindPointer() {
    let mode = null   // 'pan', 'tile', 'lane'
    let startX = 0, startY = 0, lastX = 0, lastY = 0
    let source = null
    let lane = null
    let started = false

    const target = this.container

    target.addEventListener('pointerdown', event => {
      if (event.button !== 0) return

      const p = this.cellUnder(event.clientX, event.clientY)
      const cell = this.score.at(p)

      startX = lastX = event.clientX
      startY = lastY = event.clientY
      started = false
      source = null
      lane = null

      if (cell.kind === CellKind.Tile) {
        mode = 'tile'
        source = cell
      } else if (cell.kind === CellKind.Head) {
        mode = 'lane'
        lane = cell.lane
      } else {
        mode = 'pan'
      }

      target.setPointerCapture(event.pointerId)
      event.preventDefault()
    })

    target.addEventListener('pointermove', event => {
      if (mode == null) return

      const dx = event.clientX - lastX
      const dy = event.clientY - lastY

      if (!started &&
          Math.hypot(event.clientX - startX, event.clientY - startY) < DragSlop) return

      started = true
      lastX = event.clientX
      lastY = event.clientY

      if (mode === 'pan') {
        this.pan(dx, dy)
        return
      }

      // What a drop would do, shown while it is in the air so that the answer the drop
      // acts on is the one that was lit up.
      const p = this.cellUnder(event.clientX, event.clientY)
      this.showDrop(mode === 'tile'
        ? (this.score.planMove(source, p) != null ? p : null)
        : (this.score.canMoveLane(lane, p) ? p : null))
    })

    const finish = event => {
      if (mode == null) return

      const p = this.cellUnder(event.clientX, event.clientY)

      if (!started) {
        this.setCursor(p)
      } else if (mode === 'tile') {
        this.delegate.dropTiles?.(source, p)
      } else if (mode === 'lane') {
        this.delegate.dropLane?.(lane, p)
      }

      this.showDrop(null)
      mode = null
      source = null
      lane = null

      target.releasePointerCapture?.(event.pointerId)
    }

    target.addEventListener('pointerup', finish)
    target.addEventListener('pointercancel', () => {
      this.showDrop(null)
      mode = null
    })

    // A double click on a cell that would take one is how a note is written, since the
    // cursor is already there.
    target.addEventListener('dblclick', event => {
      const p = this.cellUnder(event.clientX, event.clientY)
      this.setCursor(p)
      this.delegate.placeNote?.(p)
    })

    // Two axis scrolling, the way a trackpad already offers it.
    target.addEventListener('wheel', event => {
      event.preventDefault()
      this.pan(-event.deltaX, -event.deltaY)
    }, { passive: false })
  }

  showDrop(p) {
    if (p == null) {
      this.dropBox.style.display = 'none'
      return
    }

    const origin = Style.cellOrigin(p)
    this.dropBox.style.display = 'block'
    this.dropBox.style.left = origin.x + 'px'
    this.dropBox.style.top = origin.y + 'px'
  }
}

function rail(lane) {
  const node = document.createElement('div')
  const a = Style.cellCenter(lane.headPoint)
  const b = Style.cellCenter(lane.termPoint)

  node.className = 'rail'
  node.style.left = Math.min(a.x, b.x) + 'px'
  node.style.top = a.y + 'px'
  node.style.width = Math.abs(b.x - a.x) + 'px'

  return node
}

// What a cell shows: the tile's kind and the values a score cannot be read without.
// Everything else is the panel's, which is why an icon says which kind of lock a lock
// is and nothing about what it holds.
function renderTile(node, tile) {
  if (tile instanceof NoteTile) {
    const name = Pitch.toClassName(tile.note)
    const letter = name[0]
    const accidental = name.length > 1 ? '<span>' + Sharp + '</span>' : ''
    const octave = Pitch.toOctave(tile.note)

    // The accidental gutter stands only on the notes that have one: a name is read, it
    // is not aligned against the name it was a moment ago.
    const label = '<span class="label">' + letter +
      (accidental ? '<span class="accidental">' + accidental + '</span>' : '') +
      octave + '</span>'

    node.innerHTML = tile.hasDefaultLength ? label
      : '<span class="stack">' + label + '<span class="length">' +
        Math.round(tile.length * 1000) / 1000 + '</span></span>'

    node.setAttribute('aria-label', tile.token)
    return
  }

  node.classList.add('control-tile')

  if (tile instanceof ParamTile) {
    node.innerHTML = tile instanceof AbsoluteParamTile ? Icons.PABS : Icons.PREL
  } else if (tile instanceof CycleGateTile) {
    node.innerHTML = cycle(tile.period, tile.pattern)
  } else if (tile instanceof ProbGateTile) {
    node.innerHTML = prob(tile.percent)
  } else if (tile instanceof JumpTile) {
    node.classList.add('inverted')
    node.innerHTML = Icons.JUMP
  } else if (tile instanceof JumpDestTile) {
    node.classList.add('inverted')
    node.innerHTML = Icons.JDST
  } else {
    node.innerHTML = '<span class="label">' + tile.token + '</span>'
  }

  node.setAttribute('aria-label', tile.token)
}
