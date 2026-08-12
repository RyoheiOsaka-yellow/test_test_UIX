/* ============================================================
   ROVER — MU-7 CASSIOPEIA

   A rigid body with a real inertia tensor and six raycast wheels. Not
   a capsule with a speed value: each wheel has its own spring-damper,
   its own slip-based tyre force inside a friction circle, its own
   sinkage, and its own hub that can spin up and dig.

   The suspension is sized for lunar weight — 1458 N total, about 9 cm
   of static sag. Earth spring rates make the rover behave like a steel
   bar, and the first version of this file used them.
   ============================================================ */

import {
  v3, v3set, v3add, v3sub, v3scale, v3addScaled, v3dot, v3cross, v3norm,
  v3len, clamp, approach, m4, m4compose, m4mul, m4ident, qt, qIdent, qMul,
  qFromAxisAngle, qRot, qRotInv, qIntegrate, qNorm, qSlerp, qFromTo, lerp, smoothstep
} from '../core/math.js';
import { MeshBuilder } from '../core/mesh.js';

export const GRAVITY = 1.62;

const MASS = 900;
const INERTIA = [736, 975, 361];        // pitch, yaw, roll, kg·m²
const HALF_TRACK = 1.05;
const WHEEL_Z = [1.30, 0.0, -1.30];
const ATTACH_Y = -0.18;
const WHEEL_R = 0.40;
const WHEEL_W = 0.26;
const REST_LEN = 0.34;
const MAX_TRAVEL = 0.30;
const SPRING_K = 2700;                  // N/m per corner
const DAMP_C = 445;                     // N·s/m, about 0.35 critical
const WHEEL_I = 1.06;                   // kg·m², hub + rim
const MAX_TORQUE = 132;                 // N·m per hub
const MAX_BRAKE = 340;
const MAX_OMEGA = 13.0;                 // rad/s ≈ 5.2 m/s
const MU = 0.85;                        // peak traction / normal load
const C_LONG = 14;                      // longitudinal slip stiffness, per second
const C_LAT = 11;
const ROLL_RESIST = 0.06;               // fraction of normal load, ≈ Apollo
const BEARING = 12000;                  // Pa, top few cm of regolith
const MAX_STEER = 0.56;                 // rad

/* Ray against the height field. The field is a height map, so instead
   of marching we close the vertical gap and iterate — three or four
   passes is exact to a millimetre on anything you can drive on. */
function groundHit(terrain, ox, oy, oz, dx, dy, dz, maxT, out) {
  if (dy > -0.05) return false;
  let t = 0;
  for (let k = 0; k < 5; k++) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const h = terrain.height(x, z);
    const gap = y - h;
    if (Math.abs(gap) < 0.0015) break;
    t += gap / -dy;
    if (t < 0) { t = 0; break; }
    if (t > maxT) return false;
  }
  if (t > maxT) return false;
  out.t = t;
  out.x = ox + dx * t; out.y = oy + dy * t; out.z = oz + dz * t;
  terrain.normal(out.x, out.z, out.n);
  return true;
}

class Wheel {
  constructor(i, lx, lz) {
    this.i = i;
    this.local = [lx, ATTACH_Y, lz];
    this.side = Math.sign(lx);
    this.row = lz > 0.6 ? 0 : (lz < -0.6 ? 2 : 1);
    this.spin = 0;             // rad/s
    this.angle = 0;            // rendered rotation
    this.steer = 0;
    this.susp = REST_LEN;      // current suspension length
    this.load = 0;
    this.slip = 0;
    this.sink = 0;
    this.contact = false;
    this.centre = v3();
    this.hit = { t: 0, x: 0, y: 0, z: 0, n: [0, 1, 0] };
  }
}

export class Rover {
  constructor(terrain) {
    this.terrain = terrain;
    this.pos = v3(0, 0, 0);
    this.vel = v3(0, 0, 0);
    this.rot = qt();
    this.angVel = v3(0, 0, 0);
    this.wheels = [];
    let i = 0;
    for (const z of WHEEL_Z) {
      for (const s of [-1, 1]) this.wheels.push(new Wheel(i++, s * HALF_TRACK, z));
    }
    this.heading = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.steerCmd = 0;
    this.throttleCmd = 0;
    this.braking = false;
    this.odometer = 0;
    this.rollover = 0;
    this.righting = 0;
    this.integrity = 1;
    this.lastImpact = 0;

    // Deployables
    this.arm = { out: 0, want: 0, swing: 0, reach: 0.62, lift: 0.1, drill: 0, tip: v3(), aim: v3() };
    this.array = { out: 0, want: 1, angle: 0 };
    this.lamps = false;

    this.up = v3(0, 1, 0);
    this.forward = v3(0, 0, 1);
    this.right = v3(1, 0, 0);
    this.shadowSpheres = new Float32Array(48);
    this.shadowCount = 0;
    this.lampPos = v3();
    this.lampDir = v3(0, 0, 1);

    this._tmp = { a: v3(), b: v3(), c: v3(), f: v3(), r: v3(), n: v3(), v: v3() };
    this._force = v3();
    this._torque = v3();
    this._accum = 0;
    this.wheelSlipAvg = 0;
    this.motorLoad = 0;
  }

  placeAt(x, z, heading = 0) {
    /* Set the ride height off the HIGHEST ground under any wheel, not
       off the centre. Put it down on the average and one wheel starts
       the game bottomed out, which used to fire the whole rover into
       orbit on the first frame. */
    const c = Math.cos(heading), sn = Math.sin(heading);
    let h = -Infinity;
    for (const w of this.wheels) {
      const wx = x + w.local[0] * c + w.local[2] * sn;
      const wz = z - w.local[0] * sn + w.local[2] * c;
      h = Math.max(h, this.terrain.height(wx, wz));
    }
    v3set(this.pos, x, h + REST_LEN - ATTACH_Y + WHEEL_R - 0.09, z);
    v3set(this.vel, 0, 0, 0);
    v3set(this.angVel, 0, 0, 0);
    qFromAxisAngle(this.rot, 0, 1, 0, heading);
    this.heading = heading;
  }

  /* Righting the chassis after a rollover. Not a teleport: the frame is
     rotated upright over half a second and dropped from where it is. */
  rightSelf() {
    if (this.righting > 0) return false;
    this.righting = 0.55;
    return true;
  }

  get upright() { return this.up[1]; }

  step(dt, ctrl) {
    // Fixed sub-steps. The hub inertia is small next to the slip
    // stiffness, and a variable frame time walks the whole thing into
    // an oscillation you can hear in the motor.
    this._accum += Math.min(dt, 0.1);
    const h = 1 / 180;
    let n = 0;
    while (this._accum >= h && n < 32) { this._substep(h, ctrl); this._accum -= h; n++; }
    this._postStep(dt, ctrl);
  }

  _substep(dt, ctrl) {
    const T = this.terrain;
    const F = this._force, TQ = this._torque;
    v3set(F, 0, -GRAVITY * MASS, 0);
    v3set(TQ, 0, 0, 0);

    const up = qRot(this.up, this.rot, [0, 1, 0]);
    const fwd = qRot(this.forward, this.rot, [0, 0, 1]);
    const rgt = qRot(this.right, this.rot, [1, 0, 0]);

    if (this.righting > 0) {
      this.righting -= dt;
      const flat = qFromTo(qt(), up, [0, 1, 0]);
      const want = qMul(qt(), flat, this.rot);
      qSlerp(this.rot, this.rot, qNorm(want), Math.min(1, dt * 7));
      v3scale(this.angVel, this.angVel, 0.02);
    }

    const arm = this.arm.out > 0.4;
    const steerInput = arm ? 0 : ctrl.steer;
    const throttleInput = arm ? 0 : ctrl.throttle;

    // Four-wheel steering: the outer rows turn opposite ways, which is
    // what lets a six-wheeler turn inside its own length.
    const steerTarget = steerInput * MAX_STEER;
    this.steerCmd = approach(this.steerCmd, steerTarget, 7, dt);
    // Pivot on the spot when you are not asking to go anywhere.
    const pivot = (Math.abs(throttleInput) < 0.05 && Math.abs(this.forwardSpeed) < 0.7)
      ? steerInput : 0;

    const bodyOmega = v3set(this._tmp.v, this.angVel[0], this.angVel[1], this.angVel[2]);
    let slipSum = 0, loadSum = 0, contacts = 0, torqueSum = 0;

    for (const w of this.wheels) {
      w.steer = w.row === 0 ? this.steerCmd : (w.row === 2 ? -this.steerCmd : 0);

      // Suspension attach point in world space.
      const a = qRot(this._tmp.a, this.rot, w.local);
      const ax = this.pos[0] + a[0], ay = this.pos[1] + a[1], az = this.pos[2] + a[2];

      const maxT = REST_LEN + MAX_TRAVEL + WHEEL_R;
      const hit = groundHit(T, ax, ay, az, -up[0], -up[1], -up[2], maxT, w.hit);

      // Velocity of the attach point: v + ω × r
      const rvx = a[0], rvy = a[1], rvz = a[2];
      const vax = this.vel[0] + bodyOmega[1] * rvz - bodyOmega[2] * rvy;
      const vay = this.vel[1] + bodyOmega[2] * rvx - bodyOmega[0] * rvz;
      const vaz = this.vel[2] + bodyOmega[0] * rvy - bodyOmega[1] * rvx;

      if (!hit) {
        w.contact = false;
        w.load = 0; w.slip = 0; w.sink = 0;
        w.susp = approach(w.susp, REST_LEN + MAX_TRAVEL, 12, dt);
        v3set(w.centre, ax - up[0] * w.susp, ay - up[1] * w.susp, az - up[2] * w.susp);
        // Free wheel: torque still spins it up, and the drag is small.
        const tq = this._hubTorque(w, throttleInput, pivot, ctrl.brake);
        w.spin += (tq / WHEEL_I) * dt;
        w.spin *= Math.exp(-0.7 * dt);
        continue;
      }

      w.contact = true;
      const suspLen = w.hit.t - WHEEL_R;
      let comp = REST_LEN - suspLen;
      let bottomed = 0;
      if (comp > MAX_TRAVEL) { bottomed = comp - MAX_TRAVEL; comp = MAX_TRAVEL; }
      if (comp < 0) comp = 0;
      w.susp = REST_LEN - comp;

      const compRate = -(vax * up[0] + vay * up[1] + vaz * up[2]);
      let Fn = SPRING_K * comp + DAMP_C * compRate;
      // Bump stop. Progressive rather than a wall: a hard stop the width
      // of one physics step is an impulse, and an impulse at the end of a
      // 1 m lever is how a 900 kg rover ends up on its roof.
      if (bottomed > 0) Fn += bottomed * bottomed * 60000 + Math.max(0, compRate) * 1800;
      if (Fn < 0) Fn = 0;
      // Nothing on this vehicle can push harder than a few g at a corner.
      if (Fn > 9000) Fn = 9000;
      w.load = Fn;
      loadSum += Fn;
      contacts++;

      // Contact point and its velocity.
      const cx = w.hit.x, cy = w.hit.y, cz = w.hit.z;
      const rx = cx - this.pos[0], ry = cy - this.pos[1], rz = cz - this.pos[2];
      const vcx = this.vel[0] + bodyOmega[1] * rz - bodyOmega[2] * ry;
      const vcy = this.vel[1] + bodyOmega[2] * rx - bodyOmega[0] * rz;
      const vcz = this.vel[2] + bodyOmega[0] * ry - bodyOmega[1] * rx;

      v3set(w.centre, ax - up[0] * w.susp, ay - up[1] * w.susp, az - up[2] * w.susp);

      // Wheel axes projected into the contact plane.
      const sc = Math.cos(w.steer), ss = Math.sin(w.steer);
      const wf = this._tmp.f;
      wf[0] = fwd[0] * sc + rgt[0] * ss;
      wf[1] = fwd[1] * sc + rgt[1] * ss;
      wf[2] = fwd[2] * sc + rgt[2] * ss;
      const nrm = w.hit.n;
      const dn = v3dot(wf, nrm);
      wf[0] -= nrm[0] * dn; wf[1] -= nrm[1] * dn; wf[2] -= nrm[2] * dn;
      v3norm(wf, wf);
      const wr = v3cross(this._tmp.r, nrm, wf);

      const vLong = vcx * wf[0] + vcy * wf[1] + vcz * wf[2];
      const vLat = vcx * wr[0] + vcy * wr[1] + vcz * wr[2];

      // Semi-implicit hub integration. Explicit blows up here: the slip
      // stiffness times dt over the hub inertia is well above one.
      const K = C_LONG * Fn;
      const tq = this._hubTorque(w, throttleInput, pivot, ctrl.brake);
      torqueSum += Math.abs(tq);
      const denom = 1 + (dt * K * WHEEL_R * WHEEL_R) / WHEEL_I;
      w.spin = (w.spin + (dt * tq) / WHEEL_I + (dt * K * WHEEL_R * vLong) / WHEEL_I) / denom;

      let Fx = K * (w.spin * WHEEL_R - vLong);
      let Fy = -C_LAT * Fn * vLat;

      // Friction circle. Spin a wheel up and it has nothing left to
      // hold the back end with, which is exactly the failure mode.
      const grip = MU * Fn;
      const mag = Math.hypot(Fx, Fy);
      if (mag > grip && mag > 1e-6) { const s = grip / mag; Fx *= s; Fy *= s; }

      w.slip = Math.abs(w.spin * WHEEL_R - vLong);
      slipSum += w.slip;

      // Rolling resistance: about 6% of load, which is what Apollo measured.
      const rr = ROLL_RESIST * Fn * (1 + w.sink * 6);
      if (Math.abs(vLong) > 0.02) Fx -= Math.sign(vLong) * Math.min(rr, Math.abs(Fx) + rr);

      // Sinkage from contact pressure over the bearing strength of the
      // top few centimetres. A saturating linear model, not Bekker.
      const patch = WHEEL_W * (0.10 + Math.sqrt(Math.max(w.sink, 0.001) * WHEEL_R) * 2);
      const pressure = Fn / Math.max(patch, 0.01);
      const sinkTarget = clamp(pressure / BEARING, 0, 1.6) * 0.030;
      w.sink = approach(w.sink, sinkTarget, 6, dt);

      // Accumulate on the body.
      F[0] += nrm[0] * Fn + wf[0] * Fx + wr[0] * Fy;
      F[1] += nrm[1] * Fn + wf[1] * Fx + wr[1] * Fy;
      F[2] += nrm[2] * Fn + wf[2] * Fx + wr[2] * Fy;
      const tfx = nrm[0] * Fn + wf[0] * Fx + wr[0] * Fy;
      const tfy = nrm[1] * Fn + wf[1] * Fx + wr[1] * Fy;
      const tfz = nrm[2] * Fn + wf[2] * Fx + wr[2] * Fy;
      TQ[0] += ry * tfz - rz * tfy;
      TQ[1] += rz * tfx - rx * tfz;
      TQ[2] += rx * tfy - ry * tfx;
    }

    this.wheelSlipAvg = contacts ? slipSum / contacts : 0;
    this.motorLoad = clamp(torqueSum / (MAX_TORQUE * 6), 0, 1);
    this.contacts = contacts;

    // Integrate the body.
    const inv = 1 / MASS;
    v3addScaled(this.vel, this.vel, F, dt * inv);
    v3addScaled(this.pos, this.pos, this.vel, dt);

    // Torque in body space, divided by the tensor, back to world.
    const tb = qRotInv(this._tmp.b, this.rot, TQ);
    tb[0] /= INERTIA[0]; tb[1] /= INERTIA[1]; tb[2] /= INERTIA[2];
    const tw = qRot(this._tmp.c, this.rot, tb);
    v3addScaled(this.angVel, this.angVel, tw, dt);
    // A little angular drag; six contact patches in loose soil are not
    // a frictionless pivot.
    v3scale(this.angVel, this.angVel, Math.exp(-0.9 * dt));
    // Hard limits. Not physics — a backstop, so one bad contact cannot
    // put the simulation somewhere it can never come back from.
    const aw = v3len(this.angVel);
    if (aw > 6) v3scale(this.angVel, this.angVel, 6 / aw);
    const lv = v3len(this.vel);
    if (lv > 28) v3scale(this.vel, this.vel, 28 / lv);
    qIntegrate(this.rot, this.rot, this.angVel, dt);

    // Belly contact. The chassis is not allowed inside the regolith.
    const belly = this.terrain.height(this.pos[0], this.pos[2]) + 0.36;
    if (this.pos[1] < belly) {
      const pen = belly - this.pos[1];
      this.pos[1] = belly;
      if (this.vel[1] < 0) {
        this.lastImpact = Math.max(this.lastImpact, -this.vel[1]);
        this.vel[1] *= -0.15;
      }
      this.vel[0] *= Math.exp(-8 * dt);
      this.vel[2] *= Math.exp(-8 * dt);
      void pen;
    }
  }

  _hubTorque(w, throttle, pivot, brake) {
    // Torque falls off as the hub approaches its no-load speed.
    const headroom = clamp(1 - Math.abs(w.spin) / MAX_OMEGA, 0, 1);
    let tq = throttle * MAX_TORQUE * (throttle * w.spin > 0 ? headroom : 1);
    if (pivot) tq += -w.side * pivot * MAX_TORQUE * 0.8 * headroom;
    if (brake) {
      const b = Math.min(MAX_BRAKE, Math.abs(w.spin) * WHEEL_I * 240 + 40);
      tq -= Math.sign(w.spin) * b;
    } else if (Math.abs(throttle) < 0.03 && !pivot) {
      // Harmonic drives are not meaningfully back-drivable. With no
      // command the hubs hold, which is why a parked rover on a six per
      // cent slope stays parked instead of creeping away all afternoon.
      tq -= clamp(w.spin * 95, -MAX_BRAKE, MAX_BRAKE);
    }
    return tq;
  }

  _postStep(dt, ctrl) {
    const fwd = this.forward;
    this.forwardSpeed = v3dot(this.vel, fwd);
    this.speed = Math.hypot(this.vel[0], this.vel[2]);
    this.heading = Math.atan2(fwd[0], fwd[2]);
    this.odometer += this.speed * dt;
    this.rollover = this.up[1] < 0.25 ? this.rollover + dt : 0;

    for (const w of this.wheels) w.angle += w.spin * dt;

    if (this.lastImpact > 2.2) {
      this.integrity = clamp(this.integrity - (this.lastImpact - 2.2) * 0.012, 0, 1);
    }
    this.lastImpact = 0;

    // Deployables.
    this.array.want = ctrl.arrayOut ? 1 : 0;
    this.array.out = approach(this.array.out, this.array.want, 2.2, dt);
    this.arm.want = ctrl.armOut ? 1 : 0;
    this.arm.out = approach(this.arm.out, this.arm.want, 2.6, dt);
    if (this.arm.out > 0.5 && ctrl.armOut) {
      this.arm.reach = clamp(this.arm.reach + ctrl.throttle * dt * 0.55, 0.30, 1.02);
      this.arm.swing = clamp(this.arm.swing - ctrl.steer * dt * 1.1, -0.9, 0.9);
    }
    this._solveArm();

    // Cut the ruts. Once per frame, not once per sub-step: the field is
    // CPU-authoritative and every touched texel costs an upload.
    if (this.righting <= 0) this._cutRuts(dt);

    this._updateShadowSpheres();

    const lp = qRot(this.lampPos, this.rot, [0, 0.86, 1.42]);
    this.lampPos[0] += this.pos[0]; this.lampPos[1] += this.pos[1]; this.lampPos[2] += this.pos[2];
    qRot(this.lampDir, this.rot, [0, -0.30, 1]);
    v3norm(this.lampDir, this.lampDir);
  }

  _cutRuts(dt) {
    const T = this.terrain;
    for (const w of this.wheels) {
      if (!w.contact || w.load < 12) continue;
      // A spinning wheel stops settling and starts excavating.
      const dig = clamp((w.slip - 0.30) * 0.28, 0, 0.42);
      const depth = w.sink + dig;
      const rate = 0.16 + dig * 2.2;
      // Wider than the tyre: the trough a 26 cm wheel leaves in loose
      // regolith is not 26 cm across, and at 25 cm per texel a rut the
      // exact width of the wheel is one texel and reads as nothing.
      T.excavate(w.hit.x, w.hit.z, 0.22, depth, rate * dt, dig > 0.01 ? 0.6 : 0);
    }
  }

  /* Two-link IK. Shoulder is fixed on the front deck; you aim the tip
     and the elbow follows, which is why the arm reads as a machine
     being commanded rather than an animation being played. */
  _solveArm() {
    const a = this.arm;
    const L1 = 0.64, L2 = 0.58;
    const base = [0, 0.20, 1.34];
    const swing = a.swing;
    const reach = lerp(0.34, a.reach, a.out);
    const drop = lerp(0.10, -0.62 + a.lift, a.out);
    const tx = Math.sin(swing) * reach;
    const tz = Math.cos(swing) * reach;
    const local = [base[0] + tx, base[1] + drop, base[2] + tz];
    const dx = local[0] - base[0], dy = local[1] - base[1], dz = local[2] - base[2];
    let d = Math.hypot(dx, dy, dz);
    d = clamp(d, 0.12, L1 + L2 - 0.01);
    // Law of cosines for the elbow.
    const cosE = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
    a.elbow = Math.PI - Math.acos(cosE);
    const cosS = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    a.shoulderOffset = Math.acos(cosS);
    a.yaw = Math.atan2(dx, dz);
    a.pitch = Math.asin(clamp(dy / d, -1, 1));
    a.localTip = local;
    a.L1 = L1; a.L2 = L2; a.base = base;

    const w = qRot(v3(), this.rot, local);
    v3set(a.tip, this.pos[0] + w[0], this.pos[1] + w[1], this.pos[2] + w[2]);
    // The point on the ground the drill is over.
    v3set(a.aim, a.tip[0], this.terrain.height(a.tip[0], a.tip[2]), a.tip[2]);
  }

  /* The rover's own shadow, without a shadow map: the terrain shader
     tests the sun ray against these spheres. Twelve is the whole
     vehicle and it costs one loop in the fragment shader. */
  _updateShadowSpheres() {
    const s = this.shadowSpheres;
    let n = 0;
    const push = (lx, ly, lz, r) => {
      if (n >= 12) return;
      const w = qRot(this._tmp.a, this.rot, [lx, ly, lz]);
      s[n * 4] = this.pos[0] + w[0];
      s[n * 4 + 1] = this.pos[1] + w[1];
      s[n * 4 + 2] = this.pos[2] + w[2];
      s[n * 4 + 3] = r;
      n++;
    };
    push(0, 0.10, 0.95, 0.62);
    push(0, 0.10, 0.0, 0.66);
    push(0, 0.10, -0.95, 0.62);
    push(0, 0.95, -0.30, 0.42);
    for (const w of this.wheels) {
      const c = w.centre;
      if (n >= 12) break;
      s[n * 4] = c[0]; s[n * 4 + 1] = c[1]; s[n * 4 + 2] = c[2]; s[n * 4 + 3] = WHEEL_R * 0.92;
      n++;
    }
    this.shadowCount = n;
  }

  /* ---------- geometry ---------- */

  buildMeshes(solid) {
    const PANEL = [0.80, 0.80, 0.83];
    const DARK = [0.20, 0.21, 0.24];
    const GOLD = [0.72, 0.55, 0.20];
    const ACCENT = [0.16, 0.62, 0.72];

    /* Chassis: a warm-white equipment box on a dark frame, gold MLI
       under the belly, radiator fins down the flanks. */
    const b = new MeshBuilder();
    b.mat(DARK, 0.55, 0.35).box(1.86, 0.14, 3.02, 0, -0.12, 0);
    b.mat(GOLD, 0.30, 0.25).box(1.72, 0.06, 2.86, 0, -0.20, 0);
    b.mat(PANEL, 0.45, 0.55).box(1.62, 0.44, 2.44, 0, 0.14, 0.02);
    b.mat(PANEL, 0.40, 0.5).box(1.30, 0.16, 1.10, 0, 0.42, -0.35);
    b.mat(DARK, 0.35, 0.3).box(1.10, 0.10, 0.62, 0, 0.51, -0.35);
    // Radiator fins.
    b.mat([0.86, 0.87, 0.88], 0.22, 0.15);
    for (let i = 0; i < 7; i++) {
      const z = -0.95 + i * 0.30;
      b.box(1.70, 0.20, 0.035, 0, 0.10, z);
    }
    // Instrument bay and the sample carousel on the front deck.
    b.mat(DARK, 0.5, 0.4).box(0.72, 0.20, 0.24, 0, 0.44, 0.98);
    b.mat(ACCENT, 0.3, 0.2).box(0.20, 0.06, 0.20, -0.42, 0.42, 0.98);
    b.mat([0.55, 0.56, 0.6], 0.3, 0.3);
    b.translate(0.40, 0.45, 0.96).cylinder(0.17, 0.10, 14).pop();
    // Handrails, because everything on a real vehicle has a handrail.
    b.mat([0.62, 0.63, 0.66], 0.3, 0.2);
    b.strut([-0.80, 0.40, 1.14], [-0.80, 0.40, -1.14], 0.022);
    b.strut([0.80, 0.40, 1.14], [0.80, 0.40, -1.14], 0.022);
    // Suspension rockers.
    b.mat(DARK, 0.4, 0.35);
    for (const s of [-1, 1]) {
      b.strut([s * 0.86, -0.12, 1.30], [s * 0.86, -0.12, -1.30], 0.045);
      for (const z of WHEEL_Z) b.strut([s * 0.86, -0.12, z], [s * HALF_TRACK, ATTACH_Y - 0.12, z], 0.038);
    }
    // High-gain antenna.
    b.mat([0.9, 0.9, 0.92], 0.2, 0.35);
    b.strut([0.56, 0.50, -1.02], [0.56, 1.16, -1.02], 0.030);
    b.translate(0.56, 1.22, -1.02).rotate(1, 0, 0, -0.5).scale(1, 0.28, 1)
      .sphere(0.30, 18, 8).pop().pop().pop();
    // Mast and camera head.
    b.mat([0.75, 0.76, 0.78], 0.3, 0.3);
    b.strut([0, 0.42, -0.30], [0, 1.42, -0.30], 0.036);
    b.mat(DARK, 0.35, 0.2).box(0.42, 0.16, 0.16, 0, 1.50, -0.30);
    b.mat([0.05, 0.06, 0.08], 0.08, 0.0);
    b.translate(-0.13, 1.50, -0.215).rotate(1, 0, 0, Math.PI / 2).cylinder(0.045, 0.03, 12).pop().pop();
    b.translate(0.13, 1.50, -0.215).rotate(1, 0, 0, Math.PI / 2).cylinder(0.045, 0.03, 12).pop().pop();
    // Headlamp bar, bolted across the front of the deck. The first
    // version had the lamps hovering half a metre in front of the
    // chassis with nothing holding them up.
    b.mat([0.42, 0.43, 0.46], 0.4, 0.3).box(0.92, 0.05, 0.05, 0, 0.40, 1.24);
    b.mat([0.9, 0.9, 0.95], 0.15, 0.1);
    for (const x of [-0.34, 0.34]) {
      b.strut([x, 0.38, 1.24], [x, 0.38, 1.33], 0.030, 6);
      b.translate(x, 0.38, 1.36).rotate(1, 0, 0, Math.PI / 2).cylinder(0.072, 0.06, 14).pop().pop();
    }
    this.mChassis = solid.mesh(b.build());

    /* Wheel: a wire mesh drum with chevron grousers, which is what you
       build when rubber would freeze and outgas. */
    const wb = new MeshBuilder();
    wb.mat([0.70, 0.71, 0.74], 0.42, 0.75);
    wb.rotate(0, 0, 1, Math.PI / 2).cylinder(WHEEL_R, WHEEL_W, 22, false).pop();
    wb.mat([0.42, 0.43, 0.46], 0.35, 0.6);
    wb.rotate(0, 0, 1, Math.PI / 2).cylinder(WHEEL_R * 0.34, WHEEL_W + 0.02, 14).pop();
    // Grousers.
    wb.mat([0.30, 0.31, 0.34], 0.5, 0.8);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      wb.translate(0, c * WHEEL_R * 1.01, s * WHEEL_R * 1.01)
        .rotate(1, 0, 0, a).box(WHEEL_W * 0.92, 0.035, 0.070).pop().pop();
    }
    // Spokes.
    wb.mat([0.58, 0.59, 0.62], 0.4, 0.5);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      wb.strut([-WHEEL_W * 0.42, 0, 0], [WHEEL_W * 0.30, c * WHEEL_R * 0.95, s * WHEEL_R * 0.95], 0.016, 5);
    }
    this.mWheel = solid.mesh(wb.build());

    /* Solar array: four hinged panels that fold over the rear deck. */
    const ab = new MeshBuilder();
    ab.mat([0.09, 0.13, 0.30], 0.16, 0.45).box(1.50, 0.022, 0.78, 0, 0, 0.39);
    ab.mat([0.35, 0.37, 0.42], 0.3, 0.3);
    for (let i = 1; i < 5; i++) ab.box(1.50, 0.026, 0.012, 0, 0.014, i * 0.156);
    ab.box(0.020, 0.030, 0.78, -0.74, 0.005, 0.39);
    ab.box(0.020, 0.030, 0.78, 0.74, 0.005, 0.39);
    this.mArray = solid.mesh(ab.build());

    /* Sampling arm: two links and a coring drill. */
    const l1 = new MeshBuilder();
    l1.mat([0.72, 0.73, 0.76], 0.35, 0.3).strut([0, 0, 0], [0, 0, 0.64], 0.048, 10);
    l1.mat([0.3, 0.31, 0.34], 0.4, 0.2).translate(0, 0, 0).rotate(1, 0, 0, Math.PI / 2)
      .cylinder(0.075, 0.10, 12).pop().pop();
    this.mArm1 = solid.mesh(l1.build());

    const l2 = new MeshBuilder();
    l2.mat([0.66, 0.67, 0.70], 0.35, 0.3).strut([0, 0, 0], [0, 0, 0.46], 0.038, 10);
    l2.mat([0.20, 0.21, 0.24], 0.3, 0.15).box(0.14, 0.14, 0.16, 0, 0, 0.52);
    l2.mat([0.85, 0.72, 0.35], 0.18, 0.1).translate(0, 0, 0.66).rotate(1, 0, 0, Math.PI / 2)
      .cylinder(0.030, 0.20, 10, true, 0.012).pop().pop();
    this.mArm2 = solid.mesh(l2.build());

    this._m = m4();
    this._mm = m4();
    this._q = qt();
  }

  render(solid, ctx) {
    const M = this._m, MM = this._mm, Q = this._q;
    m4compose(M, this.pos, this.rot);
    solid.draw(this.mChassis, M);

    for (const w of this.wheels) {
      // chassis · translate(attach + suspension) · yaw(steer) · pitch(spin)
      const local = [w.local[0], w.local[1] - w.susp, w.local[2]];
      qFromAxisAngle(Q, 0, 1, 0, w.steer);
      m4compose(MM, local, Q);
      const spinM = m4();
      qFromAxisAngle(Q, 1, 0, 0, w.angle);
      m4compose(spinM, [0, 0, 0], Q);
      m4mul(MM, MM, spinM);
      m4mul(MM, M, MM);
      solid.draw(this.mWheel, MM);
    }

    // Solar array, hinged up off the rear deck.
    const ang = -0.06 - this.array.out * 1.42;
    qFromAxisAngle(Q, 1, 0, 0, ang);
    m4compose(MM, [0, 0.54, -1.28], Q);
    m4mul(MM, M, MM);
    solid.draw(this.mArray, MM, { occlude: 1.2 });

    // Arm.
    if (this.arm.out > 0.01) {
      const a = this.arm;
      const shoulderPitch = a.pitch + a.shoulderOffset;
      const q1 = qt(), q2 = qt(), tmp = qt();
      qFromAxisAngle(q1, 0, 1, 0, a.yaw);
      qFromAxisAngle(tmp, 1, 0, 0, -shoulderPitch);
      qMul(q1, q1, tmp);
      m4compose(MM, a.base, q1);
      m4mul(MM, M, MM);
      solid.draw(this.mArm1, MM);

      qFromAxisAngle(q2, 1, 0, 0, a.elbow);
      const elbowM = m4();
      m4compose(elbowM, [0, 0, a.L1], q2);
      const armM = m4();
      m4mul(armM, MM, elbowM);
      solid.draw(this.mArm2, armM, { emissive: a.drill, emissiveColor: [0.9, 0.45, 0.12] });
    }
  }
}

export const ROVER_SPEC = {
  MASS, WHEEL_R, WHEEL_W, HALF_TRACK, REST_LEN, MAX_TRAVEL,
  SPRING_K, DAMP_C, MU, MAX_TORQUE, MAX_OMEGA, GRAVITY
};

export { smoothstep };
