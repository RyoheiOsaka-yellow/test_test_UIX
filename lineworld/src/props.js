// Dig sites, the red lights, and the transient effects (bark shockwaves,
// thrown dirt, dust in the lantern light).

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import { LineBuilder, DynamicLines, GlowPoints, createGlowMaterial, createLineMaterial } from './render.js';
import { makeRng } from './noise.js';

const DIG_COL = new THREE.Color(0.85, 0.72, 0.35);
const DIG_DONE = new THREE.Color(0.30, 0.34, 0.38);
const RED = new THREE.Color(1.0, 0.18, 0.20);
const AMBER = new THREE.Color(1.0, 0.66, 0.26);

function retint(mesh, color) {
  const a = mesh.geometry.attributes.aColor;
  for (let i = 0; i < a.count; i++) a.setXYZ(i, color.r, color.g, color.b);
  a.needsUpdate = true;
}

// ---------------------------------------------------------------------------

export class DigSite {
  constructor(scene, material, x, z, seed) {
    const rng = makeRng(seed);
    const lb = new LineBuilder();
    const y = () => 0;
    const R = 1.7;
    // dashed ring
    const n = 34;
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = new THREE.Vector3(x + Math.cos(a0) * R, terrainHeight(x + Math.cos(a0) * R, z + Math.sin(a0) * R) + 0.04, z + Math.sin(a0) * R);
      const p1 = new THREE.Vector3(x + Math.cos(a1) * R, terrainHeight(x + Math.cos(a1) * R, z + Math.sin(a1) * R) + 0.04, z + Math.sin(a1) * R);
      lb.segment(p0, p1, DIG_COL, 0.05, 0, 0, rng());
    }
    // scratches in the middle
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const r0 = rng() * 0.9;
      const len = 0.3 + rng() * 0.6;
      const x0 = x + Math.cos(a) * r0, z0 = z + Math.sin(a) * r0;
      const x1 = x0 + Math.cos(a + 0.4) * len, z1 = z0 + Math.sin(a + 0.4) * len;
      lb.segment(
        new THREE.Vector3(x0, terrainHeight(x0, z0) + 0.03, z0),
        new THREE.Vector3(x1, terrainHeight(x1, z1) + 0.03, z1),
        DIG_COL, 0.06, 0, 0, rng(),
      );
    }
    // three little stakes so it reads as a place, not a decal
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      const b = terrainHeight(px, pz);
      lb.segment(
        new THREE.Vector3(px, b, pz),
        new THREE.Vector3(px + Math.cos(a) * 0.1, b + 0.42 + rng() * 0.2, pz + Math.sin(a) * 0.1),
        DIG_COL, 0.05, 0, 0.02, rng(),
      );
    }
    this.mesh = lb.build(material);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.dug = false;
    this.progress = 0;
    void y;
  }

  setDug() {
    if (this.dug) return;
    this.dug = true;
    retint(this.mesh, DIG_DONE);
  }
}

// ---------------------------------------------------------------------------

export class Monument {
  constructor(scene, material, x, z, seed) {
    const rng = makeRng(seed);
    const lb = new LineBuilder();
    const base = terrainHeight(x, z);
    const h = 6.5 + rng() * 3.0;
    const w = 0.55;
    const top = [];
    const bot = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.785;
      bot.push(new THREE.Vector3(x + Math.cos(a) * w, base, z + Math.sin(a) * w));
      top.push(new THREE.Vector3(x + Math.cos(a) * w * 0.22, base + h, z + Math.sin(a) * w * 0.22));
    }
    for (let k = 0; k < 4; k++) {
      lb.segment(bot[k], top[k], RED, 0.03, 0, 0.05, rng());
      lb.segment(bot[k], bot[(k + 1) % 4], RED, 0.03, 0, 0, rng());
      lb.segment(top[k], top[(k + 1) % 4], RED, 0.03, 0.05, 0.05, rng());
    }
    // rungs
    for (let r = 1; r < 6; r++) {
      const t = r / 6;
      const ring = top.map((tp, k) => new THREE.Vector3().lerpVectors(bot[k], tp, t));
      for (let k = 0; k < 4; k++) lb.segment(ring[k], ring[(k + 1) % 4], RED, 0.03, 0, 0, rng());
    }
    // the light itself: a small diamond above the pylon
    const c = new THREE.Vector3(x, base + h + 0.85, z);
    const d = 0.42;
    const dia = [
      new THREE.Vector3(x, c.y + d, z), new THREE.Vector3(x + d, c.y, z),
      new THREE.Vector3(x, c.y - d, z), new THREE.Vector3(x - d, c.y, z),
      new THREE.Vector3(x, c.y, z + d), new THREE.Vector3(x, c.y, z - d),
    ];
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2], [2, 5], [5, 0], [1, 4], [4, 3], [3, 5], [5, 1]];
    for (const [a, b] of E) lb.segment(dia[a], dia[b], RED, 0.02, 0, 0, rng());

    this.mesh = lb.build(material);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, base, z);
    this.lightPos = c;
    this.active = false;
    this.flare = 0;
    this.phase = rng() * 6.28;
  }

  activate() {
    if (this.active) return false;
    this.active = true;
    this.flare = 1;
    retint(this.mesh, AMBER);
    return true;
  }

  update(dt) {
    if (this.flare > 0) this.flare = Math.max(0, this.flare - dt * 0.7);
  }

  /** colour + brightness of the floating light */
  sample(time) {
    const pulse = this.active
      ? 0.85 + 0.15 * Math.sin(time * 1.6 + this.phase)
      : 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.1 + this.phase), 3);
    const col = this.active ? AMBER : RED;
    return { pulse: pulse * (1 + this.flare * 3), col };
  }
}

// ---------------------------------------------------------------------------

export class Effects {
  constructor(scene) {
    this.rings = new DynamicLines(1400, createLineMaterial());
    scene.add(this.rings.mesh);
    this.particles = new GlowPoints(1400, createGlowMaterial({ lit: true }));
    scene.add(this.particles.points);
    this.motes = new GlowPoints(320, createGlowMaterial({ lit: true }));
    scene.add(this.motes.points);

    this.shockwaves = [];
    this.debris = [];
    this._rng = makeRng(4242);

    // slow drifting dust that only shows up inside the lantern
    this.dust = [];
    for (let i = 0; i < 300; i++) {
      this.dust.push({
        x: (this._rng() - 0.5) * 34,
        y: this._rng() * 5,
        z: (this._rng() - 0.5) * 34,
        p: this._rng() * 6.28,
        s: 0.03 + this._rng() * 0.07,
      });
    }
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  shockwave(pos, { maxR = 34, speed = 26, color = new THREE.Color(0.8, 0.92, 1.0), width = 2.6, intensity = 0.9 } = {}) {
    this.shockwaves.push({ pos: pos.clone(), r: 0.6, maxR, speed, color: color.clone(), width, intensity });
  }

  burstDirt(pos, dir, count = 22) {
    const rng = this._rng;
    for (let i = 0; i < count; i++) {
      this.debris.push({
        p: new THREE.Vector3(pos.x + (rng() - 0.5) * 0.4, pos.y + 0.05, pos.z + (rng() - 0.5) * 0.4),
        v: new THREE.Vector3(
          dir.x * (1.2 + rng() * 2.4) + (rng() - 0.5) * 1.6,
          1.6 + rng() * 3.4,
          dir.z * (1.2 + rng() * 2.4) + (rng() - 0.5) * 1.6,
        ),
        life: 0.7 + rng() * 0.8,
        age: 0,
        size: 0.05 + rng() * 0.09,
        c: new THREE.Color(0.7 + rng() * 0.3, 0.55 + rng() * 0.2, 0.30),
      });
    }
  }

  update(dt, time, focus, field) {
    // --- shockwaves ------------------------------------------------------
    const R = this.rings;
    R.reset();
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += s.speed * dt;
      const t = s.r / s.maxR;
      if (t >= 1) { this.shockwaves.splice(i, 1); continue; }
      const fade = Math.pow(1 - t, 1.6);
      field.addPulse(s.pos, s.r, s.width * (0.5 + t), s.intensity * fade, s.color);

      // three great circles so the wave reads as a sphere
      const n = 30;
      const col = this._tmpColor || (this._tmpColor = new THREE.Color());
      col.copy(s.color).multiplyScalar(0.10 + fade * 0.30);
      for (let axis = 0; axis < 3; axis++) {
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          const p = (a, out) => {
            const c = Math.cos(a) * s.r, si = Math.sin(a) * s.r;
            if (axis === 0) out.set(s.pos.x + c, s.pos.y + si * 0.35, s.pos.z + si);
            else if (axis === 1) out.set(s.pos.x + c, s.pos.y + si, s.pos.z);
            else out.set(s.pos.x, s.pos.y + si, s.pos.z + c);
            return out;
          };
          R.segment(p(a0, this._tmpA), p(a1, this._tmpB), col, 0.0);
        }
      }
    }
    R.commit();

    // --- debris ----------------------------------------------------------
    const P = this.particles;
    P.reset();
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      if (d.age > d.life) { this.debris.splice(i, 1); continue; }
      d.v.y -= 11 * dt;
      d.p.addScaledVector(d.v, dt);
      const ground = terrainHeight(d.p.x, d.p.z);
      if (d.p.y < ground) { d.p.y = ground; d.v.set(0, 0, 0); }
      const a = 1 - d.age / d.life;
      P.push(d.p.x, d.p.y, d.p.z, d.c.r, d.c.g, d.c.b, d.size, a * 0.8);
    }
    P.commit();

    // --- dust ------------------------------------------------------------
    const M = this.motes;
    M.reset();
    for (const m of this.dust) {
      // world-anchored, but recycled across the far edge as you walk
      m.x += Math.sin(time * 0.13 + m.p) * dt * 0.35;
      m.z += Math.cos(time * 0.11 + m.p * 1.7) * dt * 0.35;
      if (m.x - focus.x > 17) m.x -= 34; else if (m.x - focus.x < -17) m.x += 34;
      if (m.z - focus.z > 17) m.z -= 34; else if (m.z - focus.z < -17) m.z += 34;
      const y = terrainHeight(m.x, m.z) + 0.4 + m.y + Math.sin(time * 0.4 + m.p) * 0.35;
      const a = 0.20 + 0.2 * Math.sin(time * 1.7 + m.p);
      M.push(m.x, y, m.z, 0.85, 0.9, 1.0, m.s, a);
    }
    M.commit();
  }
}
