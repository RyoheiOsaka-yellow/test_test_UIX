import * as THREE from 'three';
import { resample, framePath, pathLength, samplePath } from './geom.js';

/** Chain connected elevated mainline ways into one long drive route. */
export function buildDriveRoute(data) {
  const d = data.site.drive || {};
  const cand = data.roads.filter((r) => r.elevated && r.kind === 'expressway' && (!d.ref || r.ref === d.ref || (d.nameMatch && r.name.includes(d.nameMatch))));
  const pool = cand.length ? cand : data.roads.filter((r) => r.elevated && r.kind === 'expressway');
  if (!pool.length) return null;
  const len = (r) => r.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - r.pts[i - 1][0], p[2] - r.pts[i - 1][2]) : 0), 0);
  pool.sort((a, b) => len(b) - len(a));
  const used = new Set([pool[0].id]);
  let pts = pool[0].pts.slice();
  const near = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]) < 1.5;
  for (let guard = 0; guard < 40; guard++) {
    const tail = pts[pts.length - 1];
    const next = pool.find((r) => !used.has(r.id) && near(r.pts[0], tail));
    if (!next) break;
    used.add(next.id); pts = pts.concat(next.pts.slice(1));
  }
  for (let guard = 0; guard < 40; guard++) {
    const head = pts[0];
    const prev = pool.find((r) => !used.has(r.id) && near(r.pts[r.pts.length - 1], head));
    if (!prev) break;
    used.add(prev.id); pts = prev.pts.slice(0, -1).concat(pts);
  }
  const path = framePath(resample(pts, 2));
  return { path, length: pathLength(path), name: pool[0].name || `首都高速 ${pool[0].ref}号`, ways: used.size };
}

export class Director {
  constructor(camera, controls) {
    this.camera = camera; this.controls = controls;
    this.mode = 'orbit';
    this.route = null;
    this.s = 0;
    this.speedKmh = 60;
    this.angle = 0.6;
    this._eye = new THREE.Vector3(); this._look = new THREE.Vector3();
    this.progress = 0;
  }
  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'drive' && this.route) {
      const p = samplePath(this.route.path, this.s);
      this._eye.set(p.x, p.y + 3.3, p.z);
    }
  }
  flyTo(pos, target, ms = 900) {
    if (![...pos.toArray(), ...target.toArray()].every(Number.isFinite)) return;
    if (pos.distanceTo(target) < 0.5) pos = target.clone().add(new THREE.Vector3(0, 10, 30));
    this.anim = { t0: performance.now(), ms, p0: this.camera.position.clone(), t0v: this.controls.target.clone(), p1: pos.clone(), t1: target.clone() };
  }
  update(dt) {
    if (this.anim) {
      const k = Math.min(1, (performance.now() - this.anim.t0) / this.anim.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.position.lerpVectors(this.anim.p0, this.anim.p1, e);
      this.controls.target.lerpVectors(this.anim.t0v, this.anim.t1, e);
      if (k >= 1) this.anim = null;
    }
    if (this.mode === 'drive' && this.route) {
      const L = this.route.length;
      this.s += (this.speedKmh / 3.6) * dt;
      if (this.s > L - 40) this.s = 0;
      this.progress = this.s / L;
      const p = samplePath(this.route.path, this.s), q = samplePath(this.route.path, Math.min(L, this.s + 32));
      const laneOff = 1.7;
      this._eye.lerp(new THREE.Vector3(p.x + p.nx * laneOff, p.y + 3.3, p.z + p.nz * laneOff), Math.min(1, dt * 4));
      this._look.lerp(new THREE.Vector3(q.x + q.nx * laneOff, q.y + 2.4, q.z + q.nz * laneOff), Math.min(1, dt * 4));
      this.camera.position.copy(this._eye);
      this.camera.lookAt(this._look);
      this.controls.target.copy(this._look);
    } else if (this.mode === 'flyover') {
      this.angle += dt * 0.045;
      const r = 540 + 90 * Math.sin(this.angle * 0.7), h = 300 + 70 * Math.sin(this.angle * 1.3 + 1);
      this.camera.position.set(Math.cos(this.angle) * r, h, Math.sin(this.angle) * r);
      this.controls.target.set(0, 12, 0);
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }
  }
}
