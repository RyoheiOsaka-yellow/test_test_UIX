// The dog.
//
// A wireframe quadruped assembled from scratch every frame: a boxed spine, a
// head that can look and bark, four two-bone legs solved with analytic IK onto
// the terrain, and the lantern swinging from the collar -- which is, literally,
// the light source the whole world is rendered from.

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import { DynamicLines, createLineMaterial } from './render.js';

const BODY = new THREE.Color(0.95, 0.90, 0.80);
const BODY_DIM = new THREE.Color(0.55, 0.62, 0.72);
const LANTERN_FRAME = new THREE.Color(1.0, 0.78, 0.42);

const UPPER = 0.34;
const LOWER = 0.36;
const STAND_H = 0.68;

const HIPS = [
  { x: 0.17, y: -0.02, z: 0.40, front: true, phase: 0.0 },   // front left
  { x: -0.17, y: -0.02, z: 0.40, front: true, phase: 0.5 },  // front right
  { x: 0.16, y: 0.00, z: -0.44, front: false, phase: 0.5 },  // hind left
  { x: -0.16, y: 0.00, z: -0.44, front: false, phase: 0.0 },  // hind right
];

const RINGS = [
  { z: -0.60, w: 0.155, h: 0.145, y: 0.02 },
  { z: -0.26, w: 0.205, h: 0.200, y: 0.00 },
  { z: 0.12, w: 0.215, h: 0.215, y: 0.00 },
  { z: 0.46, w: 0.190, h: 0.185, y: 0.03 },
];

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function boxEdges(out, center, hx, hy, hz, quat) {
  const c = [];
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(
      (i & 1 ? hx : -hx),
      (i & 2 ? hy : -hy),
      (i & 4 ? hz : -hz),
    );
    if (quat) v.applyQuaternion(quat);
    v.add(center);
    c.push(v);
  }
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (const [a, b] of E) out.push([c[a], c[b]]);
  return c;
}

export class Dog {
  constructor(scene) {
    this.material = createLineMaterial();
    this.lines = new DynamicLines(220, this.material);
    this.root = new THREE.Object3D();
    this.root.add(this.lines.mesh);
    scene.add(this.root);

    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.speed = 0;
    this.vy = 0;
    this.airborne = false;
    this.groundY = 0;

    this.gait = 0;
    this.idleTime = 0;
    this.state = 'idle';

    // pose channels, all smoothed towards per-state targets
    this.p = {
      bodyH: STAND_H, pitch: 0, roll: 0,
      headH: 0.34, headFwd: 0.30, headPitch: 0,
      ear: 0.4, mouth: 0, tailUp: 0.5, wag: 0.25,
      sit: 0, dig: 0, crouch: 0,
    };

    this.lanternWorld = new THREE.Vector3();
    this.lanternSwing = 0;
    this.lanternSwingV = 0;
    this.mouthWorld = new THREE.Vector3();
    this.noseWorld = new THREE.Vector3();

    this.digTimer = 0;
    this.barkTimer = 0;
    this.sniffing = false;
    this.digging = false;

    this.onStep = null;
    this._stepFlags = [false, false, false, false];
    this._segs = [];
    this._tmp = new THREE.Vector3();
  }

  get forward() {
    return this._tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  bark() {
    this.barkTimer = 0.42;
  }

  /**
   * @param {number} dt
   * @param {{move:THREE.Vector2, run:boolean, jump:boolean, sniff:boolean, dig:boolean, camYaw:number}} input
   */
  update(dt, input, trees, resolve) {
    const p = this.p;

    // ---- locomotion -------------------------------------------------------
    const wants = input.move.lengthSq() > 0.0001;
    const maxSpeed = input.run ? 7.6 : 3.4;
    let targetSpeed = 0;

    if (wants && !this.digging) {
      // move relative to camera heading
      const mx = input.move.x, mz = input.move.y;
      const c = input.camYaw;
      const desiredYaw = Math.atan2(
        mz * Math.sin(c) - mx * Math.cos(c),
        mz * Math.cos(c) + mx * Math.sin(c),
      );
      let d = desiredYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += clamp(d, -7 * dt, 7 * dt);
      targetSpeed = maxSpeed * Math.min(1, input.move.length());
      if (this.sniffing) targetSpeed *= 0.45;
    }

    this.speed = damp(this.speed, targetSpeed, wants ? 6 : 8, dt);
    if (this.speed < 0.02) this.speed = 0;

    const fwd = this.forward.clone();
    this.pos.addScaledVector(fwd, this.speed * dt);
    resolve(trees, this.pos);

    this.groundY = terrainHeight(this.pos.x, this.pos.z);

    if (input.jump && !this.airborne && !this.digging) {
      this.vy = 4.6;
      this.airborne = true;
    }
    if (this.airborne) {
      this.vy -= 14.5 * dt;
      this.jumpY = (this.jumpY || 0) + this.vy * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; this.airborne = false; }
    } else {
      this.jumpY = 0;
    }

    this.root.position.set(this.pos.x, this.groundY + this.jumpY, this.pos.z);
    this.root.rotation.y = this.yaw;

    // ---- state ------------------------------------------------------------
    this.sniffing = !!input.sniff && !this.airborne;
    this.digging = !!input.dig && !this.airborne && this.speed < 0.4;
    if (this.barkTimer > 0) this.barkTimer -= dt;

    if (this.speed > 0.15 || this.airborne) this.idleTime = 0;
    else this.idleTime += dt;

    const sitting = this.idleTime > 4.5 && !this.sniffing && !this.digging;
    this.state = this.airborne ? 'jump'
      : this.digging ? 'dig'
        : this.sniffing ? 'sniff'
          : this.speed > 5.0 ? 'run'
            : this.speed > 0.2 ? 'walk'
              : sitting ? 'sit' : 'idle';

    // ---- pose targets -----------------------------------------------------
    const t = { bodyH: STAND_H, pitch: 0, headH: 0.34, headFwd: 0.30, headPitch: 0, ear: 0.45, mouth: 0, tailUp: 0.45, wag: 0.3, sit: 0, dig: 0, crouch: 0 };
    const sp = this.speed / 7.6;

    switch (this.state) {
      case 'run':
        t.bodyH = STAND_H - 0.05; t.headH = 0.26; t.headFwd = 0.40; t.headPitch = -0.12;
        t.ear = 0.15; t.tailUp = 0.9; t.wag = 0.15; t.mouth = 0.35; break;
      case 'walk':
        t.headH = 0.31; t.tailUp = 0.6; t.wag = 0.55; t.ear = 0.55; break;
      case 'sniff':
        t.bodyH = STAND_H - 0.09; t.headH = -0.34; t.headFwd = 0.46; t.headPitch = 0.95;
        t.ear = 0.85; t.tailUp = 0.25; t.wag = 0.7; break;
      case 'dig':
        t.bodyH = STAND_H - 0.12; t.pitch = -0.22; t.headH = -0.22; t.headFwd = 0.42;
        t.headPitch = 0.8; t.ear = 0.7; t.tailUp = 0.8; t.wag = 1.0; t.dig = 1; break;
      case 'sit':
        t.bodyH = STAND_H - 0.06; t.pitch = 0.34; t.headH = 0.40; t.headFwd = 0.26;
        t.headPitch = -0.12; t.ear = 0.5; t.tailUp = 0.2; t.wag = 0.35; t.sit = 1; break;
      case 'jump':
        t.bodyH = STAND_H + 0.02; t.pitch = clamp(-this.vy * 0.05, -0.3, 0.3);
        t.headH = 0.40; t.ear = 0.2; t.tailUp = 0.9; t.crouch = 1; break;
      default:
        t.wag = 0.35; break;
    }

    if (this.barkTimer > 0) {
      const b = this.barkTimer / 0.42;
      t.headPitch -= 0.55 * b;
      t.headH += 0.12 * b;
      t.mouth = Math.max(t.mouth, Math.sin(b * Math.PI) * 1.0);
      t.ear = 0.1;
      t.pitch += 0.10 * b;
    }

    // terrain-following pitch and roll
    const f = 0.55, s = 0.35;
    const hf = terrainHeight(this.pos.x + fwd.x * f, this.pos.z + fwd.z * f);
    const hb = terrainHeight(this.pos.x - fwd.x * f, this.pos.z - fwd.z * f);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const hl = terrainHeight(this.pos.x + rx * s, this.pos.z + rz * s);
    const hr = terrainHeight(this.pos.x - rx * s, this.pos.z - rz * s);
    const slopePitch = this.airborne ? 0 : Math.atan2(hb - hf, f * 2);
    const slopeRoll = this.airborne ? 0 : Math.atan2(hr - hl, s * 2);

    const k = 9;
    p.bodyH = damp(p.bodyH, t.bodyH, k, dt);
    p.pitch = damp(p.pitch, t.pitch + slopePitch, k, dt);
    p.roll = damp(p.roll, slopeRoll * 0.7, k, dt);
    p.headH = damp(p.headH, t.headH, k, dt);
    p.headFwd = damp(p.headFwd, t.headFwd, k, dt);
    p.headPitch = damp(p.headPitch, t.headPitch, 14, dt);
    p.ear = damp(p.ear, t.ear, 10, dt);
    p.mouth = damp(p.mouth, t.mouth, 22, dt);
    p.tailUp = damp(p.tailUp, t.tailUp, 7, dt);
    p.wag = damp(p.wag, t.wag, 6, dt);
    p.sit = damp(p.sit, t.sit, 7, dt);
    p.dig = damp(p.dig, t.dig, 12, dt);
    p.crouch = damp(p.crouch, t.crouch, 12, dt);

    // ---- gait clock -------------------------------------------------------
    const strideLen = lerp(1.05, 2.0, sp);
    this.gait += (this.speed / strideLen) * dt;
    if (this.state === 'dig') this.digTimer += dt;

    this._rebuild(dt, sp);
  }

  // -------------------------------------------------------------------------

  _rebuild(dt, sp) {
    const p = this.p;
    const L = this.lines;
    L.reset();
    this.root.updateMatrixWorld(true);

    const time = performance.now() / 1000;
    const breathe = Math.sin(time * 1.7) * (this.speed < 0.2 ? 0.012 : 0.004);
    const bound = this.state === 'run' ? Math.sin(this.gait * Math.PI * 2) * 0.055 : 0;
    const bodyY = p.bodyH + breathe + bound
      + (this.state === 'walk' ? Math.sin(this.gait * Math.PI * 4) * 0.018 : 0);

    // body frame
    const bodyQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, 0, p.roll, 'ZYX'));
    const bodyOrigin = new THREE.Vector3(0, bodyY, 0);
    const toLocal = (v) => v.clone().applyQuaternion(bodyQ).add(bodyOrigin);

    // ---- torso ------------------------------------------------------------
    const rings = RINGS.map((r, i) => {
      // the spine flexes a little when bounding
      const flex = this.state === 'run' ? Math.sin(this.gait * Math.PI * 2 + i * 0.7) * 0.02 : 0;
      const sitDrop = p.sit * (r.z < 0 ? -0.16 : 0.0);
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const sx = (k === 0 || k === 3) ? 1 : -1;
        const sy = (k < 2) ? 1 : -1;
        pts.push(toLocal(new THREE.Vector3(r.w * sx, r.y + r.h * sy + flex + sitDrop, r.z)));
      }
      return pts;
    });

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      for (let k = 0; k < 4; k++) L.segment(r[k], r[(k + 1) % 4], BODY);
      if (i > 0) for (let k = 0; k < 4; k++) L.segment(rings[i - 1][k], r[k], BODY_DIM);
    }

    // ---- head -------------------------------------------------------------
    const neckBase = toLocal(new THREE.Vector3(0, 0.12, 0.46));
    const headPos = toLocal(new THREE.Vector3(0, p.headH, 0.46 + p.headFwd));
    const headQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.headPitch, 0, 0)).premultiply(bodyQ);

    for (let k = 0; k < 4; k++) L.segment(rings[3][k], headPos, BODY_DIM);
    L.segment(neckBase, headPos, BODY);

    const segs = [];
    boxEdges(segs, headPos, 0.115, 0.115, 0.150, headQ);

    const snoutC = headPos.clone().add(new THREE.Vector3(0, -0.02, 0.24).applyQuaternion(headQ));
    boxEdges(segs, snoutC, 0.062, 0.055, 0.100, headQ);
    const nose = headPos.clone().add(new THREE.Vector3(0, -0.015, 0.36).applyQuaternion(headQ));
    segs.push([snoutC.clone().add(new THREE.Vector3(0, 0, 0.10).applyQuaternion(headQ)), nose]);
    this.noseWorld.copy(nose).applyMatrix4(this.root.matrixWorld);

    // jaw
    const jawA = headPos.clone().add(new THREE.Vector3(0, -0.09, 0.12).applyQuaternion(headQ));
    const jawDrop = -0.055 - p.mouth * 0.13;
    const jawB = headPos.clone().add(new THREE.Vector3(0, jawDrop - 0.03, 0.30 - p.mouth * 0.04).applyQuaternion(headQ));
    segs.push([jawA, jawB]);
    segs.push([jawB, nose]);
    this.mouthWorld.copy(jawB).applyMatrix4(this.root.matrixWorld);

    // ears -- two triangles that swivel forward when alert
    for (const side of [-1, 1]) {
      const base = headPos.clone().add(new THREE.Vector3(side * 0.085, 0.10, -0.05).applyQuaternion(headQ));
      const tipL = new THREE.Vector3(side * (0.10 + p.ear * 0.03), 0.24, -0.10 + p.ear * 0.16);
      const tip = headPos.clone().add(tipL.applyQuaternion(headQ));
      const back = headPos.clone().add(new THREE.Vector3(side * 0.055, 0.11, -0.12).applyQuaternion(headQ));
      segs.push([base, tip], [tip, back], [back, base]);
    }

    for (const [a, b] of segs) L.segment(a, b, BODY);

    // ---- tail -------------------------------------------------------------
    {
      const wagPhase = time * lerp(4.0, 11.0, p.wag);
      let prev = toLocal(new THREE.Vector3(0, 0.10, -0.60));
      const n = 5;
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        const swing = Math.sin(wagPhase - u * 2.0) * p.wag * 0.34 * u;
        const rise = lerp(-0.12, 0.55, p.tailUp) * Math.sin(u * 1.4);
        const local = new THREE.Vector3(swing * 0.55, 0.10 + rise * u, -0.60 - u * 0.46);
        const pt = toLocal(local);
        L.segment(prev, pt, i > 3 ? BODY_DIM : BODY);
        prev = pt;
      }
    }

    // ---- legs -------------------------------------------------------------
    const stride = lerp(0.30, 0.62, sp);
    const lift = lerp(0.09, 0.24, sp);
    const duty = lerp(0.62, 0.42, sp);
    const galloping = this.state === 'run';

    for (let i = 0; i < HIPS.length; i++) {
      const H = HIPS[i];
      let phase = H.phase;
      if (galloping) phase = [0.0, 0.12, 0.52, 0.64][i];

      const hip = toLocal(new THREE.Vector3(H.x, H.y, H.z));

      let fz, fy;
      if (this.speed > 0.12) {
        const tt = (this.gait + phase) % 1;
        if (tt < duty) {
          const u = tt / duty;
          fz = stride * (0.5 - u);
          fy = 0;
          if (u > 0.02 && !this._stepFlags[i]) {
            this._stepFlags[i] = true;
            if (this.onStep) this.onStep(Math.min(1, 0.3 + sp));
          }
        } else {
          const u = (tt - duty) / (1 - duty);
          fz = stride * (-0.5 + u);
          fy = Math.sin(u * Math.PI) * lift;
          this._stepFlags[i] = false;
        }
      } else {
        fz = H.front ? 0.02 : -0.02;
        fy = 0;
        this._stepFlags[i] = false;
      }

      // pose overrides
      if (p.sit > 0.01 && !H.front) {
        fz = lerp(fz, 0.24, p.sit);
        fy = lerp(fy, 0.10, p.sit);
      }
      if (p.crouch > 0.01) fy = lerp(fy, 0.30, p.crouch);
      if (p.dig > 0.01 && H.front) {
        const d = this.digTimer * 9 + (i === 0 ? 0 : Math.PI);
        fz = lerp(fz, 0.24 + Math.sin(d) * 0.16, p.dig);
        fy = lerp(fy, Math.max(0, Math.sin(d)) * 0.26, p.dig);
      }

      // foot in local space, resting on the terrain under it
      const footX = hip.x;
      const worldX = this.root.position.x + (footX * Math.cos(this.yaw) + (H.z + fz) * Math.sin(this.yaw));
      const worldZ = this.root.position.z + (-footX * Math.sin(this.yaw) + (H.z + fz) * Math.cos(this.yaw));
      const localGround = terrainHeight(worldX, worldZ) - this.root.position.y;

      const foot = new THREE.Vector3(footX, localGround + fy + 0.055, hip.z + fz);
      if (this.airborne) foot.y = hip.y - 0.30 + fy * 0.5;

      // two-bone IK in the sagittal plane
      let dz = foot.z - hip.z, dy = foot.y - hip.y;
      let d = Math.hypot(dz, dy);
      const maxD = (UPPER + LOWER) * 0.985;
      if (d > maxD) { const s2 = maxD / d; dz *= s2; dy *= s2; d = maxD; foot.z = hip.z + dz; foot.y = hip.y + dy; }
      if (d < 0.12) d = 0.12;
      const a = (UPPER * UPPER - LOWER * LOWER + d * d) / (2 * d);
      const hgt = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
      const uz = dz / d, uy = dy / d;
      const sign = H.front ? -1 : 1;
      const knee = new THREE.Vector3(
        hip.x,
        hip.y + uy * a + uz * hgt * sign,
        hip.z + uz * a - uy * hgt * sign,
      );

      L.segment(hip, knee, BODY);
      L.segment(knee, foot, BODY);
      const paw = foot.clone();
      paw.z += 0.11; paw.y += 0.005;
      L.segment(foot, paw, BODY);
    }

    // ---- collar and lantern ----------------------------------------------
    {
      const collarC = toLocal(new THREE.Vector3(0, 0.02, 0.40));
      const collarPts = [];
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        collarPts.push(toLocal(new THREE.Vector3(Math.cos(ang) * 0.20, 0.02 + Math.sin(ang) * 0.20, 0.40)));
      }
      for (let k = 0; k < 8; k++) L.segment(collarPts[k], collarPts[(k + 1) % 8], LANTERN_FRAME);

      // pendulum: the lantern lags behind acceleration and sway
      const targetSwing = clamp(-this.speed * 0.045 + Math.sin(this.gait * Math.PI * 2) * 0.10 * Math.min(1, this.speed), -0.7, 0.7);
      this.lanternSwingV += (targetSwing - this.lanternSwing) * 26 * dt;
      this.lanternSwingV *= Math.exp(-3.4 * dt);
      this.lanternSwing += this.lanternSwingV * dt;

      const hang = 0.24;
      const anchor = toLocal(new THREE.Vector3(0, -0.06, 0.44));
      const lc = anchor.clone().add(new THREE.Vector3(
        Math.sin(this.lanternSwing * 0.6) * hang * 0.4,
        -Math.cos(this.lanternSwing) * hang,
        Math.sin(this.lanternSwing) * hang * 0.9,
      ));
      L.segment(anchor, lc, LANTERN_FRAME);

      const cage = [];
      boxEdges(cage, lc, 0.075, 0.095, 0.075, null);
      for (const [x, y] of cage) L.segment(x, y, LANTERN_FRAME);
      // little hat
      L.segment(lc.clone().add(new THREE.Vector3(-0.10, 0.095, 0)), lc.clone().add(new THREE.Vector3(0.10, 0.095, 0)), LANTERN_FRAME);
      L.segment(lc.clone().add(new THREE.Vector3(0, 0.095, -0.10)), lc.clone().add(new THREE.Vector3(0, 0.095, 0.10)), LANTERN_FRAME);

      this.lanternLocal = lc;
      this.lanternWorld.copy(lc).applyMatrix4(this.root.matrixWorld);
    }

    // eye positions for the glow pass
    this.eyeL = headPos.clone().add(new THREE.Vector3(0.075, 0.045, 0.115).applyQuaternion(headQ)).applyMatrix4(this.root.matrixWorld);
    this.eyeR = headPos.clone().add(new THREE.Vector3(-0.075, 0.045, 0.115).applyQuaternion(headQ)).applyMatrix4(this.root.matrixWorld);
    this.headWorld = headPos.clone().applyMatrix4(this.root.matrixWorld);

    L.commit();
  }
}
