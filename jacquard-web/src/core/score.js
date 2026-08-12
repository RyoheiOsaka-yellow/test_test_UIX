// One grid plane holding every lane.
//
// Channels are not split across planes: several CHAN lanes on the same channel
// simply sit next to each other here.

import { Lane, point, same, offset } from './lane.js'
import { JumpTile, JumpDestTile, TerminatorTile } from './tiles.js'

// What a grid cell turns out to be. Rail means a cell on a lane's own rail row
// whose step holds nothing: that is where the pass-through marker shows up.

export const CellKind = {
  Empty: 'Empty', Rail: 'Rail', Head: 'Head', Term: 'Term', Tile: 'Tile'
}

const cellRef = (kind, lane, step, depth, tile) => ({ kind, lane, step, depth, tile })

export const EmptyCell = cellRef(CellKind.Empty, null, 0, 0, null)

export const isFlowCell = cell =>
  cell.kind === CellKind.Head || cell.kind === CellKind.Term

// A single shared instance is enough: the terminator carries no state and is never
// stored in a step.
export const Terminator = new TerminatorTile()

export class Score {
  constructor() {
    this.lanes = []
  }

  // Lookup

  // Resolves a cell the same way the mockup does: head, terminator, then the step
  // stack, taking the first lane that claims the position.
  at(p) {
    for (const lane of this.lanes) {
      if (same(p, lane.headPoint)) return cellRef(CellKind.Head, lane, -1, 0, lane.head)
      if (same(p, lane.termPoint))
        return cellRef(CellKind.Term, lane, lane.steps.length, 0, Terminator)

      const step = p.x - lane.x
      const depth = p.y - lane.y

      if (step < 0 || step >= lane.steps.length || depth < 0) continue

      const tile = lane.steps[step].at(depth)
      if (tile != null) return cellRef(CellKind.Tile, lane, step, depth, tile)

      if (depth === 0) return cellRef(CellKind.Rail, lane, step, 0, null)
    }

    return EmptyCell
  }

  // Ground no lane has a claim on. One lane can be excused, which is what lets a
  // lane be asked about ground it is standing on itself.
  isFree(p, except = null) {
    return !this.lanes.some(lane => lane !== except && lane.owns(p))
  }

  // Whether a lane can take one more step. Growing moves the terminator a column to
  // the right, so what has to be free is the cell it moves into.
  hasRoomToGrow(lane) {
    return this.isFree(offset(lane.termPoint, 1, 0), lane)
  }

  // Where a tile currently sits, which is what the jump links need in order to be
  // drawn.
  locate(tile) {
    for (const lane of this.lanes) {
      if (lane.head === tile) return lane.headPoint

      for (let i = 0; i < lane.steps.length; i++) {
        const depth = lane.steps[i].tiles.indexOf(tile)
        if (depth >= 0) return lane.cellPoint(i, depth)
      }
    }
    return null
  }

  laneOf(tile) {
    for (const lane of this.lanes) {
      if (lane.head === tile) return lane
      if (lane.steps.some(step => step.tiles.includes(tile))) return lane
    }
    return null
  }

  // Which channel a lane sounds on, which is what decides its timbre. A branch lane
  // has no CHAN of its own, so it takes the channel of whatever jumps into it,
  // following the chain until a CHAN lane turns up.
  channelOf(lane) {
    // Bounded so that a file whose links have been edited into a ring cannot hang
    // the editor.
    for (let guard = 0; lane != null && guard < 64; guard++) {
      if (lane.channel != null) return lane.channel.channel
      if (lane.jumpSource == null) break
      lane = this.laneOf(lane.jumpSource)
    }

    return 1
  }

  // The branch lane a jump hands over to. One to one, so there is never more than
  // one answer.
  destinationOf(jump) {
    return this.lanes.find(lane => lane.jumpSource === jump) ?? null
  }

  // Runners are born from CHAN lanes, earliest first, and a runner that sits higher
  // on the plane runs before one that sits lower.
  get channelLanes() {
    return this.lanes.filter(lane => lane.channel != null)
      .sort((a, b) => a.y - b.y || a.x - b.x)
  }

  // Extent of the used area, which is what the view sizes its plane from.
  get width() {
    return this.lanes.length === 0 ? 0
      : Math.max(...this.lanes.map(lane => lane.termX)) + 1
  }

  get height() {
    return this.lanes.length === 0 ? 0
      : Math.max(...this.lanes.map(bottomOf)) + 1
  }

  // Editing

  // Places a tile, growing the lane by one step when the terminator cell is
  // targeted. A stack has no holes in it, so the only depths that accept a tile are
  // the ones already filled and the one just past the end.
  place(p, tile) {
    const found = this.placementLane(p)
    if (found == null) return false

    const { lane, step, depth } = found

    if (step === lane.steps.length) lane.addStep()

    const tiles = lane.steps[step].tiles

    if (depth < tiles.length) tiles[depth] = tile
    else tiles.push(tile)

    return true
  }

  // The lane that would take a tile at this point, if any. The editor asks this
  // before offering a tile, so that the only cells offering one are the cells that
  // will take it.
  placementLane(p) {
    for (const lane of this.lanes) {
      const sx = p.x - lane.x
      const sy = p.y - lane.y

      if (sx < 0 || sx > lane.steps.length || sy < 0) continue

      // The terminator column only takes a tile on the rail row, where it becomes a
      // new step. The terminator itself has to have somewhere to go as well.
      if (sx === lane.steps.length) {
        if (sy !== 0) continue
        if (!this.hasRoomToGrow(lane)) continue
        return { lane, step: sx, depth: 0 }
      }

      if (sy > lane.steps[sx].depth) continue
      if (sy === lane.steps[sx].depth && !this.isFree(p, lane)) continue

      return { lane, step: sx, depth: sy }
    }

    return null
  }

  // Removes whatever tile is at this point. Tiles below it move up so that the chain
  // stays unbroken, and a jump takes its branch lane with it.
  remove(p) {
    const cell = this.at(p)
    if (cell.kind !== CellKind.Tile) return false

    if (cell.tile instanceof JumpTile) {
      const branch = this.destinationOf(cell.tile)
      if (branch != null) this.removeLane(branch, false)
    }

    cell.lane.steps[cell.step].tiles.splice(cell.depth, 1)
    return true
  }

  // Dragging

  // The step a dragged tile actually came off, or nothing if it is no longer there.
  // A cell reference is a reading of the score at some earlier moment, and this one
  // has been carried about by a hand since then.
  sourceStep(source) {
    const step = source.lane?.stepAt(source.step) ?? null
    return step != null && step.at(source.depth) === source.tile ? step : null
  }

  // Where a run of dragged tiles would land. This is not placementLane: a drop is
  // allowed onto a cell that already holds something, because opening a stack up to
  // take a tile is exactly what reordering one is.
  dropLane(p) {
    for (const lane of this.lanes) {
      const sx = p.x - lane.x
      const sy = p.y - lane.y

      if (sx < 0 || sx > lane.steps.length || sy < 0) continue

      if (sx === lane.steps.length) {
        if (sy !== 0) continue
        if (!this.hasRoomToGrow(lane)) continue
        return { lane, step: sx, depth: 0 }
      }

      if (sy > lane.steps[sx].depth) continue

      return { lane, step: sx, depth: sy }
    }

    return null
  }

  // What dropping the tile at a cell would do, or nothing if that cell will not have
  // it.
  //
  // Inside the step it came from, the one tile moves and the stack closes up behind
  // it: that is what changing the order within a stack is. Anywhere else the tiles
  // hanging below travel with it, since what a gate or a lock governs is precisely
  // what hangs under it.
  planMove(source, target) {
    if (source.kind !== CellKind.Tile) return null

    const from = this.sourceStep(source)
    if (from == null) return null

    const found = this.dropLane(target)
    if (found == null) return null

    let { lane, step, depth } = found

    const tiles = from.tiles
    const sameStep = lane === source.lane && step === source.step

    if (sameStep && depth === source.depth) return null

    const count = sameStep ? 1 : tiles.length - source.depth

    if (sameStep) {
      // One tile leaves before it comes back, so the stack it lands in is a cell
      // shorter than the one it was picked up from.
      depth = Math.min(depth, tiles.length - 1)
    } else {
      // Room for what the target stack grows by, on ground no other lane owns.
      const grown = lane.stepAt(step)?.depth ?? 0
      for (let i = 0; i < count; i++)
        if (!this.isFree(lane.cellPoint(step, grown + i), lane)) return null
    }

    return { lane, step, depth, count }
  }

  applyMove(source, move) {
    if (move == null) return false

    const from = this.sourceStep(source)
    if (from == null || source.depth + move.count > from.tiles.length) return false

    const moved = from.tiles.splice(source.depth, move.count)

    if (move.step === move.lane.steps.length) move.lane.addStep()

    const into = move.lane.steps[move.step].tiles
    into.splice(Math.min(move.depth, into.length), 0, ...moved)
    return true
  }

  // Moving a lane bodily is also how the execution order is changed: the runner of a
  // lane sitting lower down runs later. The position is given as the head cell, since
  // that is the cell a lane is dragged by.
  //
  // Ground another lane owns refuses the move.
  canMoveLane(lane, head) {
    if (lane == null || !this.lanes.includes(lane)) return false
    if (head.x < 0 || head.y < 0) return false

    const dx = head.x - lane.headX
    const dy = head.y - lane.y
    if (dx === 0 && dy === 0) return false

    for (const cell of lane.occupiedCells())
      if (!this.isFree(offset(cell, dx, dy), lane)) return false

    return true
  }

  moveLane(lane, head) {
    if (!this.canMoveLane(lane, head)) return false
    lane.x = head.x + 1
    lane.y = head.y
    return true
  }

  addLane(x, y, head, steps) {
    const lane = new Lane(x, y, head)
    for (let i = 0; i < steps; i++) lane.addStep()
    this.lanes.push(lane)
    return lane
  }

  // Creates the branch lane a jump hands over to. Placing the jump and its
  // destination in one action is what keeps the one to one rule true at every moment
  // of editing.
  addBranchLane(jump, near, steps) {
    const p = this.findFreeRow(near, steps)
    const lane = this.addLane(p.x, p.y, new JumpDestTile(), steps)
    lane.jumpSource = jump
    return lane
  }

  // Drops a lane. Branch lanes reachable from it go too, since a JDST with nothing
  // pointing at it cannot exist; removing a branch lane likewise takes out the jump
  // that fed it.
  removeLane(lane, removeJumpSource = true) {
    const index = this.lanes.indexOf(lane)
    if (index < 0) return
    this.lanes.splice(index, 1)

    if (removeJumpSource && lane.jumpSource != null) {
      const p = this.locate(lane.jumpSource)
      if (p != null) {
        const cell = this.at(p)
        if (cell.kind === CellKind.Tile)
          cell.lane.steps[cell.step].tiles.splice(cell.depth, 1)
      }
    }

    for (const step of lane.steps)
      for (const tile of [...step.tiles])
        if (tile instanceof JumpTile) {
          const branch = this.destinationOf(tile)
          if (branch != null) this.removeLane(branch, false)
        }
  }

  // Somewhere the given lane length fits, searched downwards from a hint. Used when
  // a new lane has to be put down without asking where.
  findFreeRow(hint, steps) {
    const x = Math.max(1, hint.x)

    for (let y = Math.max(1, hint.y); y < hint.y + 256; y++) {
      let free = true

      // One clear row above as well, so that an unrelated stack does not end up
      // looking chained to this lane's head.
      for (let i = -1; i <= steps + 1 && free; i++)
        for (let dy = -1; dy <= 0 && free; dy++)
          free = this.isFree(point(x - 1 + i, y + dy))

      if (free) return point(x, y)
    }

    return point(x, hint.y)
  }
}

function bottomOf(lane) {
  let depth = 1
  for (const step of lane.steps) depth = Math.max(depth, step.depth)
  return lane.y + depth
}
