// Everything that moves in the world but is not the dog: ground mist,
// fireflies, falling leaves, the dog's own footprints, ripples on the stream,
// and the birds that clatter out of the trees when you bark.

import * as THREE from 'three';
import { makeRng, terrainHeight, streamCenterZ, streamDist, waterLevel, waterDepth, CHANNEL_W } from './noise.js';
import { DynamicLines, GlowPoints, createLineMaterial, createGlowMaterial } from './render.js';

const MIST_COL = new THREE.Color(0.30, 0.44, 0.50);
const PRINT_COL = new THREE.Color(0.60, 0.52, 0.34);
const BIRD_COL = new THREE.Color(0.78, 0.84, 0.90);
const RIPPLE_COL = new THREE.Color(0.35, 0.75, 0.90);

const MIST_R = 26;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// scratch
const S1 = new THREE.Vector3();
const S2 = new THREE.Vector3();
const S3 = new THREE.Vector3();
const SC = new THREE.Color();

export class Ambience {
  constructor(scene) {
    this.lines = new DynamicLines(2400, createLineMaterial());
    scene.add(this.lines.mesh);
    this.glow = new GlowPoints(520, createGlowMaterial({ lit: false }));
    scene.add(this.glow.points);
    this.leaves = new GlowPoints(140, createGlowMaterial({ lit: true }));
    scene.add(this.leaves.points);

    const rng = makeRng(31337);
    this._rng = rng;

    this.mist = [];
    for (let i = 0; i < 170; i++) {
      this.mist.push({
        x: (rng() - 0.5) * 2 * MIST_R,
        z: (rng() - 0.5) * 2 * MIST_R,
        len: 0.9 + rng() * 2.4,
        a: rng() * Math.PI * 2,
        p: rng() * 6.28,
        h: 0.05 + rng() * 0.28,
      });
    }

    this.fireflies = [];
    for (let i = 0; i < 110; i++) {
      this.fireflies.push({
        x: (rng() - 0.5) * 2 * MIST_R,
        z: (rng() - 0.5) * 2 * MIST_R,
        y: 0.4 + rng() * 2.4,
        p: rng() * 6.28,
        sp: 0.25 + rng() * 0.55,
        rate: 0.35 + rng() * 0.75,
      });
    }

    this.leafList = [];
    for (let i = 0; i < 90; i++) {
      this.leafList.push({
        x: (rng() - 0.5) * 2 * MIST_R,
        z: (rng() - 0.5) * 2 * MIST_R,
        y: 2 + rng() * 8,
        p: rng() * 6.28,
        s: 0.05 + rng() * 0.05,
        fall: 0.3 + rng() * 0.5,
      });
    }

    this.prints = [];
    this.ripples = [];
    this.birds = [];
  }

  // --- events ------------------------------------------------------------

  footprint(x, z, yaw) {
    this.prints.push({ x, z, y: terrainHeight(x, z) + 0.02, yaw, age: 0 });
    if (this.prints.length > 150) this.prints.shift();
  }

  ripple(x, z, strength = 1) {
    this.ripples.push({ x, z, r: 0.15, max: 1.6 + strength * 2.2, age: 0, life: 1.4 + strength });
    if (this.ripples.length > 14) this.ripples.shift();
  }

  /** Startle whatever is roosting nearby. Returns how many took off. */
  flush(origin, trees) {
    const rng = this._rng;
    let n = 0;
    for (const t of trees) {
      const d2 = (t.x - origin.x) ** 2 + (t.z - origin.z) ** 2;
      if (d2 > 26 * 26 || rng() < 0.55) continue;
      const count = 2 + ((rng() * 3) | 0);
      for (let i = 0; i < count; i++) {
        if (this.birds.length > 34) break;
        const y = terrainHeight(t.x, t.z) + 4.5 + rng() * 3.5;
        const a = Math.atan2(t.z - origin.z, t.x - origin.x) + (rng() - 0.5) * 1.4;
        this.birds.push({
          p: V(t.x + (rng() - 0.5) * 2, y, t.z + (rng() - 0.5) * 2),
          v: V(Math.cos(a) * (5 + rng() * 5), 3.5 + rng() * 3, Math.sin(a) * (5 + rng() * 5)),
          flap: rng() * 6.28,
          rate: 11 + rng() * 7,
          age: 0,
          life: 5 + rng() * 3,
        });
        n++;
      }
      if (n > 9) break;
    }
    return n;
  }

  // --- frame -------------------------------------------------------------

  update(dt, time, focus) {
    const L = this.lines;
    const G = this.glow;
    const P = this.leaves;
    L.reset(); G.reset(); P.reset();

    const wrap = (o, key, centre) => {
      if (o[key] - centre > MIST_R) o[key] -= MIST_R * 2;
      else if (o[key] - centre < -MIST_R) o[key] += MIST_R * 2;
    };

    // ---- ground mist ----------------------------------------------------
    for (const m of this.mist) {
      m.x += Math.cos(m.a) * 0.35 * dt;
      m.z += Math.sin(m.a) * 0.35 * dt;
      wrap(m, 'x', focus.x); wrap(m, 'z', focus.z);
      const drift = Math.sin(time * 0.23 + m.p) * 0.5;
      const n = 3;
      // mist pools in the hollows, and above all along the stream
      // mist pools over the stream and thins out to almost nothing elsewhere
      const damp = Math.max(0, 1 - streamDist(m.x, m.z) / (CHANNEL_W * 3.5));
      const amount = 0.16 + damp * damp * 1.5;
      if (amount < 0.2) continue;
      SC.copy(MIST_COL).multiplyScalar(0.22 * amount);
      for (let i = 0; i <= n; i++) {
        const u = i / n - 0.5;
        const px = m.x + Math.cos(m.a) * m.len * u + Math.sin(time * 0.4 + m.p + i) * 0.25;
        const pz = m.z + Math.sin(m.a) * m.len * u + drift * 0.4;
        const py = terrainHeight(px, pz) + m.h * (1 + damp) + Math.sin(time * 0.6 + i + m.p) * 0.05;
        S2.set(px, py, pz);
        if (i > 0) L.segment(S1, S2, SC, 0.02);
        S1.copy(S2);
      }
    }

    // ---- footprints -----------------------------------------------------
    for (let i = this.prints.length - 1; i >= 0; i--) {
      const f = this.prints[i];
      f.age += dt;
      if (f.age > 26) { this.prints.splice(i, 1); continue; }
      const fade = Math.max(0, 1 - f.age / 26);
      SC.copy(PRINT_COL).multiplyScalar(fade * 0.7);
      const c = Math.cos(f.yaw) * 0.075, sn = Math.sin(f.yaw) * 0.075;
      S1.set(f.x - sn, f.y, f.z - c); S2.set(f.x + sn, f.y, f.z + c);
      L.segment(S1, S2, SC, 0.02);
      S1.set(f.x - c, f.y, f.z + sn); S2.set(f.x + c, f.y, f.z - sn);
      L.segment(S1, S2, SC, 0.02);
    }

    // ---- ripples --------------------------------------------------------
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      if (r.age > r.life) { this.ripples.splice(i, 1); continue; }
      const t = r.age / r.life;
      r.r = 0.15 + t * r.max;
      const y = waterLevel(r.x) + 0.03;
      SC.copy(RIPPLE_COL).multiplyScalar((1 - t) * 0.8);
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        S1.set(r.x + Math.cos(a0) * r.r, y, r.z + Math.sin(a0) * r.r);
        S2.set(r.x + Math.cos(a1) * r.r, y, r.z + Math.sin(a1) * r.r);
        L.segment(S1, S2, SC, 0.02);
      }
    }

    // ---- birds ----------------------------------------------------------
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.age += dt;
      if (b.age > b.life) { this.birds.splice(i, 1); continue; }
      b.flap += b.rate * dt;
      b.v.y += (1.2 - b.v.y) * dt * 0.8;
      b.v.multiplyScalar(1 - dt * 0.12);
      b.p.addScaledVector(b.v, dt);
      const fade = Math.min(1, (b.life - b.age) / 1.2);
      SC.copy(BIRD_COL).multiplyScalar(fade);
      const flap = Math.sin(b.flap);
      const dir = Math.atan2(b.v.z, b.v.x);
      const cx = Math.cos(dir), cz = Math.sin(dir);
      const span = 0.42;
      for (const side of [-1, 1]) {
        const wx = b.p.x - cz * side * span, wz = b.p.z + cx * side * span;
        S1.set(b.p.x, b.p.y, b.p.z);
        S2.set(
          b.p.x - cz * side * span * 0.5 - cx * 0.08,
          b.p.y + flap * 0.16,
          b.p.z + cx * side * span * 0.5 - cz * 0.08,
        );
        S3.set(wx - cx * 0.16, b.p.y + flap * 0.34, wz - cz * 0.16);
        L.segment(S1, S2, SC, 0.01);
        L.segment(S2, S3, SC, 0.01);
      }
      S1.set(b.p.x + cx * 0.16, b.p.y, b.p.z + cz * 0.16);
      S2.set(b.p.x - cx * 0.20, b.p.y - 0.04, b.p.z - cz * 0.20);
      L.segment(S1, S2, SC, 0.01);
    }

    L.commit();

    // ---- fireflies ------------------------------------------------------
    for (const f of this.fireflies) {
      f.p += dt * f.rate;
      f.x += Math.sin(f.p * 0.7) * f.sp * dt;
      f.z += Math.cos(f.p * 0.53) * f.sp * dt;
      wrap(f, 'x', focus.x); wrap(f, 'z', focus.z);
      const y = terrainHeight(f.x, f.z) + f.y + Math.sin(f.p * 0.9) * 0.35;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(f.p * 1.7), 6);
      if (blink < 0.02) continue;
      G.push(f.x, y, f.z, 1.0, 0.86, 0.35, 0.10 + blink * 0.16, blink * 0.9);
    }

    // ---- water sparkle --------------------------------------------------
    if (streamDist(focus.x, focus.z) < 46) {
      const rng = this._rng;
      for (let i = 0; i < 190; i++) {
        const x = focus.x + (rng() - 0.5) * 60;
        const cz = streamCenterZ(x);
        const z = cz + (rng() - 0.5) * 2 * CHANNEL_W * 0.9;
        if (waterDepth(x, z) < 0.05) continue;
        const y = waterLevel(x) + 0.04;
        const a = Math.pow(0.5 + 0.5 * Math.sin(time * 3.1 + x * 0.7 + z * 0.5), 8);
        if (a < 0.03) continue;
        G.push(x, y, z, 0.55, 0.85, 1.0, 0.07 + a * 0.10, a * 0.75);
      }
    }
    G.commit();

    // ---- falling leaves -------------------------------------------------
    for (const l of this.leafList) {
      l.p += dt;
      l.y -= l.fall * dt;
      l.x += Math.sin(l.p * 1.3) * 0.5 * dt;
      l.z += Math.cos(l.p * 1.1) * 0.5 * dt;
      wrap(l, 'x', focus.x); wrap(l, 'z', focus.z);
      const ground = terrainHeight(l.x, l.z);
      if (l.y < ground + 0.05) { l.y = 6 + this._rng() * 6; }
      P.push(l.x, ground + (l.y - ground), l.z, 0.85, 0.65, 0.38, l.s, 0.55);
    }
    P.commit();
  }
}
