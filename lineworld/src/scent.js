// Scent. A drifting ribbon of motes along a curve the dog can only perceive
// while sniffing (Q). Between sniffs it is simply not there.

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import { GlowPoints, createGlowMaterial } from './render.js';
import { makeRng } from './noise.js';

const COUNT = 900;
const NEAR_COL = new THREE.Color(0.35, 1.0, 0.72);
const FAR_COL = new THREE.Color(1.0, 0.72, 0.30);

export class Scent {
  constructor(scene) {
    this.points = new GlowPoints(COUNT, createGlowMaterial({ lit: false }));
    scene.add(this.points.points);
    this.samples = [];
    this.amount = 0;      // 0..1 how strongly the trail is perceived
    this.active = false;
    const rng = makeRng(7717);
    this.u = new Float32Array(COUNT);
    this.off = new Float32Array(COUNT * 3);
    this.spd = new Float32Array(COUNT);
    this.ph = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.u[i] = rng();
      this.off[i * 3] = (rng() - 0.5) * 0.95;
      this.off[i * 3 + 1] = rng() * 0.85;
      this.off[i * 3 + 2] = (rng() - 0.5) * 0.95;
      this.spd[i] = 0.012 + rng() * 0.022;
      this.ph[i] = rng() * 6.283;
    }
    this._v = new THREE.Vector3();
  }

  /** @param {THREE.Vector3[]} waypoints */
  setPath(waypoints) {
    if (!waypoints || waypoints.length < 2) { this.active = false; this.samples = []; return; }
    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.4);
    const n = 260;
    this.samples = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n);
      p.y = terrainHeight(p.x, p.z) + 0.35;
      this.samples.push(p);
    }
    this.active = true;
  }

  clear() { this.active = false; this.samples = []; }

  _sample(u, out) {
    const s = this.samples;
    const f = Math.max(0, Math.min(0.9999, u)) * (s.length - 1);
    const i = f | 0;
    const t = f - i;
    const a = s[i], b = s[Math.min(s.length - 1, i + 1)];
    return out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  }

  /** Rough position of the dog along the trail, so the ribbon leads forward. */
  _nearestU(pos) {
    const s = this.samples;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < s.length; i += 4) {
      const dx = s[i].x - pos.x, dz = s[i].z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { u: best / (s.length - 1), dist: Math.sqrt(bestD) };
  }

  update(dt, dogPos, sniffing, time) {
    const target = sniffing ? 1 : 0;
    // scent lingers a moment after the nose comes up
    this.amount += (target - this.amount) * (1 - Math.exp(-(sniffing ? 5.5 : 1.1) * dt));

    const P = this.points;
    P.reset();
    if (!this.active || this.amount < 0.02) { P.commit(); return; }

    const near = this._nearestU(dogPos);
    const head = near.u;
    const v = this._v;
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      this.u[i] += this.spd[i] * dt;
      if (this.u[i] > 1) this.u[i] -= 1;
      let u = this.u[i];

      // fade in a window that starts at the dog and runs ahead
      let rel = u - head;
      if (rel < -0.02) rel += 1;
      const window = Math.max(0, 1 - Math.abs(rel - 0.14) / 0.46);
      if (window <= 0.001) continue;

      this._sample(u, v);
      const ph = this.ph[i] + time * 1.6;
      const x = v.x + this.off[i * 3] + Math.sin(ph) * 0.22;
      const y = v.y + this.off[i * 3 + 1] * (0.5 + 0.5 * Math.sin(ph * 0.7)) + Math.sin(ph * 1.3) * 0.1;
      const z = v.z + this.off[i * 3 + 2] + Math.cos(ph * 0.9) * 0.22;

      const dx = x - dogPos.x, dz = z - dogPos.z;
      const distFade = 1 - Math.min(1, Math.max(0, (Math.hypot(dx, dz) - 30) / 26));
      if (distFade <= 0.001) continue;

      c.copy(NEAR_COL).lerp(FAR_COL, Math.min(1, u * 1.15));
      const a = this.amount * window * distFade * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ph * 2.1)));
      P.push(x, y, z, c.r, c.g, c.b, 0.42 + Math.sin(ph) * 0.12, a * 1.15);
    }
    P.commit();
  }
}
