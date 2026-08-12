// The background drawing.
//
// It draws the synth, not the sequence. What the sequence is doing is already on the
// plane — the playheads say which step each runner is on — and that is a different
// question from what came out of it: a gate that did not fire, a note that lost its
// voice to a louder one, a limiter closing on a kick, none of which is visible on the
// plane and all of which is visible in a trace of the output and a row of the voice
// pool.
//
// The trace is triggered, like an oscilloscope's. Hung off the write cursor it slides
// sideways by whatever the block size happened to be each frame, so a held note comes
// out as a smear travelling across the screen; anchored to the last rising zero
// crossing before that point, the same note stands still and what moves is only what
// changed.
//
// The colours are faint on purpose. The faintest thing the plane draws is its lattice,
// and a trace brighter than the score's own guides is a background arguing with what is
// in front of it.

const Trace = 'rgba(232, 232, 228, 0.10)'
const Slots = 'rgba(232, 232, 228, 0.07)'

export class Visualizer {
  constructor(container) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'visualizer'
    container.appendChild(this.canvas)

    this.context = this.canvas.getContext('2d')
    this.enabled = false
  }

  draw(scope) {
    this.canvas.style.display = this.enabled ? 'block' : 'none'
    if (!this.enabled || scope == null) return

    const ratio = window.devicePixelRatio || 1
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight

    if (this.canvas.width !== Math.floor(width * ratio) ||
        this.canvas.height !== Math.floor(height * ratio)) {
      this.canvas.width = Math.floor(width * ratio)
      this.canvas.height = Math.floor(height * ratio)
    }

    const ctx = this.context
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const wave = scope.wave
    const length = wave.length

    // The last rising zero crossing before the write cursor, which is what holds a
    // held note still.
    let anchor = scope.cursor

    for (let i = 1; i < length / 2; i++) {
      const index = (scope.cursor - i + length) % length
      const previous = (index - 1 + length) % length
      if (wave[previous] <= 0 && wave[index] > 0) { anchor = index; break }
    }

    const columns = Math.min(width, 600)
    const span = Math.floor(length / 2)

    ctx.beginPath()

    for (let column = 0; column < columns; column++) {
      const index = (anchor - span + Math.floor(column / columns * span) + length) % length
      const x = column / columns * width
      const y = height / 2 - wave[index] * height * 0.4

      if (column === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.strokeStyle = Trace
    ctx.lineWidth = 1
    ctx.stroke()

    // A row of the voice pool under it: a level rather than a flag, because a voice is
    // not on or off — it is somewhere in its envelope — and taken from the samples
    // themselves rather than from the envelope, so what is drawn is what came out.
    const levels = scope.levels
    const slot = width / levels.length

    ctx.fillStyle = Slots

    for (let i = 0; i < levels.length; i++) {
      const bar = Math.min(levels[i], 1) * height * 0.25
      ctx.fillRect(i * slot + 1, height - bar, slot - 2, bar)
    }
  }
}
