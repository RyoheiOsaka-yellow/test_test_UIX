/* ============================================================
   CAMERA — chase, orbit, mast, photo

   The chase camera only drifts back behind the rover once you have
   left the mouse alone for about three seconds. Snapping it back the
   instant you stop moving the mouse makes the thing feel like it is
   fighting you.
   ============================================================ */

import {
  m4, m4lookAt, m4perspective, m4mul, clamp, approach, wrapPi,
  qRot, v3, DEG
} from '../core/math.js';

export const CAM_MODES = ['CHASE', 'ORBIT', 'MAST', 'FREE'];

export class Camera {
  constructor(terrain) {
    this.terrain = terrain;
    this.mode = 0;
    this.yaw = 0;
    this.pitch = 0.13;
    this.dist = 8.2;
    this.targetDist = 8.2;
    this.autoCentre = true;
    this.idle = 0;             // seconds since the operator last looked around
    this.fov = 58 * DEG;
    this.photo = false;

    this.pos = v3(0, 3, 12);
    this.target = v3(0, 0, 0);
    this.view = m4();
    this.proj = m4();
    this.viewProj = m4();
    this.shake = 0;
    this._smoothPos = v3(0, 3, 12);
    this._smoothTarget = v3(0, 0, 0);
    this._init = false;
  }

  cycle() { this.mode = (this.mode + 1) % CAM_MODES.length; }

  /* Point the free camera along a world direction, with no smoothing
     lag. Used to take reference shots of things that are 380 km away
     and hard to find by dragging a mouse. */
  lookAlong(dir, from) {
    this.mode = CAM_MODES.indexOf('FREE');
    if (from) { this.pos[0] = from[0]; this.pos[1] = from[1]; this.pos[2] = from[2]; }
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const v = [dir[0] / l, dir[1] / l, dir[2] / l];
    this.pitch = Math.asin(clamp(v[1], -1, 1));
    this.yaw = Math.atan2(-v[0], -v[2]);
    this.target[0] = this.pos[0] + v[0] * 10;
    this.target[1] = this.pos[1] + v[1] * 10;
    this.target[2] = this.pos[2] + v[2] * 10;
    for (let i = 0; i < 3; i++) {
      this._smoothPos[i] = this.pos[i];
      this._smoothTarget[i] = this.target[i];
    }
    this._init = true;
  }

  update(dt, rover, input, aspect) {
    const look = Math.abs(input.lookX) + Math.abs(input.lookY);
    if (look > 0.0004) this.idle = 0; else this.idle += dt;

    this.yaw = wrapPi(this.yaw - input.lookX);
    this.pitch = clamp(this.pitch + input.lookY, -0.62, 1.15);
    if (input.zoom) {
      this.targetDist = clamp(this.targetDist * (1 + input.zoom * 0.14), 2.4, 44);
    }
    this.dist = approach(this.dist, this.targetDist, 9, dt);

    const rp = rover.pos;
    const mode = CAM_MODES[this.mode];

    if (mode === 'CHASE') {
      if (this.autoCentre && this.idle > 3.0 && rover.speed > 0.35) {
        const want = rover.heading + Math.PI;
        const d = wrapPi(want - this.yaw);
        this.yaw = wrapPi(this.yaw + d * (1 - Math.exp(-1.4 * dt)));
      }
      const ch = Math.cos(this.pitch), sh = Math.sin(this.pitch);
      const ox = Math.sin(this.yaw) * ch * this.dist;
      const oz = Math.cos(this.yaw) * ch * this.dist;
      const oy = sh * this.dist + 1.15;
      this.target[0] = rp[0]; this.target[1] = rp[1] + 0.85; this.target[2] = rp[2];
      this.pos[0] = rp[0] + ox; this.pos[1] = rp[1] + oy; this.pos[2] = rp[2] + oz;
    } else if (mode === 'ORBIT') {
      const ch = Math.cos(this.pitch), sh = Math.sin(this.pitch);
      const d = this.dist * 1.5;
      this.target[0] = rp[0]; this.target[1] = rp[1] + 0.6; this.target[2] = rp[2];
      this.pos[0] = rp[0] + Math.sin(this.yaw) * ch * d;
      this.pos[1] = rp[1] + sh * d + 1.0;
      this.pos[2] = rp[2] + Math.cos(this.yaw) * ch * d;
    } else if (mode === 'MAST') {
      // Bolted to the rover: the camera the fiction says you are using.
      const local = [0.0, 1.62, 0.42];
      const w = qRot([0, 0, 0], rover.rot, local);
      this.pos[0] = rp[0] + w[0]; this.pos[1] = rp[1] + w[1]; this.pos[2] = rp[2] + w[2];
      const dir = qRot([0, 0, 0], rover.rot, [0, 0, 1]);
      const yaw = Math.atan2(dir[0], dir[2]) - this.yaw + rover.heading;
      const pv = -this.pitch;
      this.target[0] = this.pos[0] + Math.sin(this.yaw + rover.heading) * Math.cos(pv) * 10;
      this.target[1] = this.pos[1] + Math.sin(pv) * 10;
      this.target[2] = this.pos[2] + Math.cos(this.yaw + rover.heading) * Math.cos(pv) * 10;
      void yaw;
    } else {
      // FREE: a survey drone. Handy for looking at the basin, and how
      // every screenshot of the rim wall gets taken.
      const spd = 22 * (1 + this.dist * 0.1);
      const fx = Math.sin(this.yaw) * Math.cos(this.pitch);
      const fy = -Math.sin(this.pitch);
      const fz = Math.cos(this.yaw) * Math.cos(this.pitch);
      this.pos[0] -= fx * input.throttle * spd * dt;
      this.pos[1] -= fy * input.throttle * spd * dt;
      this.pos[2] -= fz * input.throttle * spd * dt;
      this.pos[0] += Math.cos(this.yaw) * input.steer * spd * dt;
      this.pos[2] -= Math.sin(this.yaw) * input.steer * spd * dt;
      this.target[0] = this.pos[0] - fx * 10;
      this.target[1] = this.pos[1] - fy * 10;
      this.target[2] = this.pos[2] - fz * 10;
    }

    if (mode !== 'FREE') {
      // Never let the camera end up under the regolith.
      const g = this.terrain.height(this.pos[0], this.pos[2]) + 0.55;
      if (this.pos[1] < g) this.pos[1] = g;
    }

    if (!this._init) {
      this._smoothPos[0] = this.pos[0]; this._smoothPos[1] = this.pos[1]; this._smoothPos[2] = this.pos[2];
      this._smoothTarget[0] = this.target[0]; this._smoothTarget[1] = this.target[1]; this._smoothTarget[2] = this.target[2];
      this._init = true;
    }
    const k = mode === 'MAST' ? 40 : 13;
    for (let i = 0; i < 3; i++) {
      this._smoothPos[i] = approach(this._smoothPos[i], this.pos[i], k, dt);
      this._smoothTarget[i] = approach(this._smoothTarget[i], this.target[i], k * 1.3, dt);
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.4);
    const sh2 = this.shake * this.shake * 0.06;
    const t = performance.now() * 0.001;
    const jx = Math.sin(t * 37.1) * sh2, jy = Math.sin(t * 29.7 + 1.3) * sh2;

    const eye = [this._smoothPos[0] + jx, this._smoothPos[1] + jy, this._smoothPos[2]];
    m4lookAt(this.view, eye, this._smoothTarget, [0, 1, 0]);
    m4perspective(this.proj, this.photo ? this.fov * 0.72 : this.fov, aspect, 0.09);
    m4mul(this.viewProj, this.proj, this.view);
    this.eye = eye;
    return eye;
  }
}
