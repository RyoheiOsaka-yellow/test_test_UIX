/* ============================================================
   DUST — ballistic regolith

   There is no air, so there is no billowing cloud, no swirl and no
   settling haze. Every grain leaves the wheel on a clean parabola at
   1.62 m/s² and lands where the arithmetic says. That single fact is
   what makes a lunar rooster tail look lunar, and it is why this file
   is a hundred lines instead of a fluid solver.
   ============================================================ */

import { createProgram, buffer, vao } from '../core/gl.js';
import { makeRng } from '../core/rng.js';
import { GRAVITY } from '../game/rover.js';

const VS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec2 aLife;      // remaining life, size
uniform mat4 uViewProj;
uniform float uPixelScale;
out float vFade;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  // Grains are sub-millimetre; what you see is the glint, so the point
  // keeps a floor in pixels rather than shrinking away with distance.
  float d = max(gl_Position.w, 0.5);
  gl_PointSize = clamp(aLife.y * uPixelScale * 340.0 / d, 1.0, 22.0);
  vFade = clamp(aLife.x, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in float vFade;
uniform vec3 uSunColor;
uniform float uExposure;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float a = (1.0 - r2 * 4.0) * vFade;
  // Regolith in direct sun, seen against a black sky.
  fragColor = vec4(uSunColor * vec3(0.62, 0.60, 0.57) * a * 0.85 * uExposure, a * 0.75);
}`;

export class Dust {
  constructor(gl, terrain, { budget = 1800, seed = 7 } = {}) {
    this.gl = gl;
    this.terrain = terrain;
    this.n = budget;
    this.px = new Float32Array(budget);
    this.py = new Float32Array(budget);
    this.pz = new Float32Array(budget);
    this.vx = new Float32Array(budget);
    this.vy = new Float32Array(budget);
    this.vz = new Float32Array(budget);
    this.life = new Float32Array(budget);
    this.size = new Float32Array(budget);
    this.cursor = 0;
    this.alive = 0;
    this.rng = makeRng(seed);

    this.posData = new Float32Array(budget * 3);
    this.lifeData = new Float32Array(budget * 2);
    this.prog = createProgram(gl, VS, FS, 'dust');
    this.posBuf = buffer(gl, this.posData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.lifeBuf = buffer(gl, this.lifeData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.vao = vao(gl, [
      { buffer: this.posBuf, loc: this.prog.a.aPos, size: 3 },
      { buffer: this.lifeBuf, loc: this.prog.a.aLife, size: 2 }
    ]);
  }

  /* Throw a grain. Direction is the wheel's tangential velocity at the
     contact patch plus a cone; speed comes from how fast the rim is
     moving relative to the ground. */
  emit(x, y, z, dirX, dirZ, speed, spread = 0.5) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    const r = this.rng;
    const s = speed * (0.35 + r() * 0.9);
    const up = 0.35 + r() * 0.85;
    this.px[i] = x + (r() - 0.5) * 0.14;
    this.py[i] = y + 0.02;
    this.pz[i] = z + (r() - 0.5) * 0.14;
    this.vx[i] = dirX * s + (r() - 0.5) * spread * s;
    this.vy[i] = up * s * 0.72;
    this.vz[i] = dirZ * s + (r() - 0.5) * spread * s;
    // A grain thrown at 2 m/s at 1.62 m/s² is airborne for over a
    // second and lands ten metres away. That is not a bug.
    this.life[i] = 1;
    this.size[i] = 0.010 + r() * 0.030;
  }

  emitFromWheels(rover, dt) {
    let budget = 0;
    for (const w of rover.wheels) {
      if (!w.contact) continue;
      const rim = Math.abs(w.spin) * 0.40;
      const throwSpeed = Math.max(w.slip * 1.5, rim * 0.28);
      if (throwSpeed < 0.35) continue;
      // Rate rises with slip; a spinning wheel is a shovel.
      const rate = Math.min(90, (throwSpeed * 14 + w.slip * 60));
      let count = rate * dt;
      count = Math.floor(count) + (this.rng() < count % 1 ? 1 : 0);
      for (let k = 0; k < count && budget < 24; k++, budget++) {
        // Ejected backward along the wheel's direction of travel.
        const sgn = w.spin >= 0 ? -1 : 1;
        const fx = rover.forward[0] * sgn, fz = rover.forward[2] * sgn;
        this.emit(w.hit.x, w.hit.y, w.hit.z, fx, fz, throwSpeed, 0.55);
      }
    }
  }

  burst(x, y, z, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      this.emit(x, y, z, Math.cos(a), Math.sin(a), speed, 0.9);
    }
  }

  update(dt) {
    const T = this.terrain;
    let alive = 0;
    const pd = this.posData, ld = this.lifeData;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.vy[i] -= GRAVITY * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      // No drag, no settling: it either flies or it has landed.
      const g = T.height(this.px[i], this.pz[i]);
      if (this.py[i] <= g) { this.life[i] = 0; continue; }
      this.life[i] -= dt * 0.22;
      if (this.life[i] <= 0) continue;
      pd[alive * 3] = this.px[i];
      pd[alive * 3 + 1] = this.py[i];
      pd[alive * 3 + 2] = this.pz[i];
      ld[alive * 2] = Math.min(1, this.life[i] * 2.4);
      ld[alive * 2 + 1] = this.size[i];
      alive++;
    }
    this.alive = alive;
    if (!alive) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pd, 0, alive * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, ld, 0, alive * 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  render(ctx) {
    if (!this.alive) return;
    const gl = this.gl, p = this.prog;
    p.use();
    gl.uniformMatrix4fv(p.u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(p.u.uSunColor, ctx.sunColor);
    gl.uniform1f(p.u.uExposure, ctx.exposure);
    gl.uniform1f(p.u.uPixelScale, ctx.pixelScale);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.alive);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
