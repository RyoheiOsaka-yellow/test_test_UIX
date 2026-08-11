/**
 * Two clocks. `wall` never stops — the aim indicator, the editor and the UI ride
 * on it. `sim` is what every effect integrates against, and it is the one that
 * freezes when you hit P. Pausing therefore holds the eruption still while the
 * sliders keep repainting it.
 */
export class Time {
  constructor() {
    this.wall = 0;
    this.sim = 0;
    this.delta = 0;
    this.simDelta = 0;
    this.frame = 0;
    this.scale = 1;
    this.paused = false;
    this._last = performance.now() / 1000;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this.fps = 60;
  }

  tick() {
    const now = performance.now() / 1000;
    // A tab that was backgrounded should not teleport every particle. The cap
    // is deliberately loose: clamping too tightly turns a slow machine into
    // slow motion instead of a low framerate.
    this.delta = Math.min(now - this._last, 1 / 10);
    this._last = now;
    this.wall += this.delta;
    this.simDelta = this.paused ? 0 : this.delta * this.scale;
    this.sim += this.simDelta;
    this.frame++;

    this._fpsAccum += this.delta;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
    return this.simDelta;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }
}
