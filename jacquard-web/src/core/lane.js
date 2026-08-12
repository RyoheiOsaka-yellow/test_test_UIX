// A grid coordinate, one column of a lane, and the lane itself.
//
// Cells are addressed in whole steps and rows; nothing in the model knows about
// pixels.

export const point = (x, y) => ({ x, y })
export const same = (a, b) => a.x === b.x && a.y === b.y
export const offset = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy })

// One column of a lane: everything that happens at the same instant, stacked
// downwards. The stack has no fixed depth — a step simply holds as many tiles as it
// needs, so a lane occupies only the cells it fills and not a rectangle.

export class Step {
  constructor() {
    this.tiles = []
  }

  get depth() { return this.tiles.length }
  get isEmpty() { return this.tiles.length === 0 }

  at(depth) {
    return depth >= 0 && depth < this.tiles.length ? this.tiles[depth] : null
  }

  find(type) {
    return this.tiles.find(tile => tile instanceof type) ?? null
  }
}

// A row of steps placed anywhere on the plane. What kind of lane it is comes from
// its head cell and never from where it sits; the one thing position decides is the
// order the runners execute in, which reads off the vertical position of the CHAN
// tile.

export class Lane {
  constructor(x, y, head) {
    // Grid position of the first step. The head sits one column to the left and the
    // terminator one column past the last step.
    this.x = x
    this.y = y
    this.head = head
    this.steps = []

    // For a branch lane, the jump that reaches it. The pairing lives here rather
    // than in a separate table so that one to one holds by construction: there is
    // nowhere to write a second jump, and a branch lane cannot exist without one.
    this.jumpSource = null
  }

  get channel() { return this.head && this.head.channel !== undefined ? this.head : null }
  get isBranch() { return this.head != null && this.head.token === 'JDST' }

  get headX() { return this.x - 1 }
  get termX() { return this.x + this.steps.length }

  get headPoint() { return point(this.headX, this.y) }
  get termPoint() { return point(this.termX, this.y) }

  cellPoint(step, depth) { return point(this.x + step, this.y + depth) }

  stepAt(index) {
    return index >= 0 && index < this.steps.length ? this.steps[index] : null
  }

  addStep() {
    const step = new Step()
    this.steps.push(step)
    return step
  }

  // Every cell this lane owns: the whole rail row, and whatever hangs under it.
  //
  // A step it owns even while empty. What a lane occupies is the run it plays
  // through rather than the tiles that happen to be written on it, so a step nothing
  // has been written on yet is still this lane's to write on — an empty cell is
  // where a lane is going, not ground going spare.
  *occupiedCells() {
    for (let x = this.headX; x <= this.termX; x++) yield point(x, this.y)

    for (let i = 0; i < this.steps.length; i++)
      for (let d = 1; d < this.steps[i].depth; d++)
        yield this.cellPoint(i, d)
  }

  // The same question asked of one cell. Overlap checks run this per lane rather
  // than walking the cells, which is what keeps a scan for free ground cheap however
  // long the lanes are.
  owns(p) {
    if (this.isOnRail(p)) return true

    const step = p.x - this.x
    const depth = p.y - this.y

    return step >= 0 && step < this.steps.length &&
           depth >= 1 && depth < this.steps[step].depth
  }

  // The row the rail runs along, from the head to the terminator inclusive.
  isOnRail(p) {
    return p.y === this.y && p.x >= this.headX && p.x <= this.termX
  }
}
