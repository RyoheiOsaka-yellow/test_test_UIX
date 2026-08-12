/* ============================================================
   MATH — vec3, mat3, mat4, quat

   Column-major matrices, the same layout GL wants, so uniform
   uploads never transpose. Every function takes an explicit
   output first so the hot paths allocate nothing.
   ============================================================ */

export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = lerp;
/* Frame-rate independent exponential approach. `rate` is the fraction
   of the remaining gap closed per second. */
export const approach = (cur, target, rate, dt) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const wrapPi = (a) => {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
};

/* ---------- vec3 (plain arrays of 3) ---------- */

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const v3set = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
export const v3copy = (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
export const v3add = (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
export const v3sub = (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
export const v3scale = (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
export const v3addScaled = (o, a, b, s) => {
  o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o;
};
export const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const v3len = (a) => Math.hypot(a[0], a[1], a[2]);
export const v3len2 = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
export const v3dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const v3cross = (o, a, b) => {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z; return o;
};
export const v3norm = (o, a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
};
export const v3lerp = (o, a, b, t) => {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
  return o;
};

/* ---------- mat4 ---------- */

export const m4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function m4ident(o) {
  o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
  o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
  o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
  o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
  return o;
}

export function m4mul(o, a, b) {
  const
    a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
    a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
    a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
    a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return o;
}

/* Infinite far plane, reverse-less standard depth. A lunar horizon is
   3 km away and the near plane has to stay at 0.1 m for the drill arm,
   so the far plane is pushed to infinity rather than fought with. */
export function m4perspective(o, fovy, aspect, near) {
  const f = 1 / Math.tan(fovy / 2);
  o.fill(0);
  o[0] = f / aspect; o[5] = f;
  o[10] = -1; o[11] = -1; o[14] = -2 * near;
  return o;
}

export function m4ortho(o, l, r, b, t, n, f) {
  o.fill(0);
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}

export function m4lookAt(o, eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
  o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  o[15] = 1;
  return o;
}

/* Rigid-body inverse: transpose the rotation, negate the rotated translation.
   Only valid for matrices built from a rotation and a translation. */
export function m4invRigid(o, m) {
  const r00 = m[0], r01 = m[4], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r21 = m[6], r22 = m[10];
  const tx = m[12], ty = m[13], tz = m[14];
  o[0] = r00; o[1] = r01; o[2] = r02; o[3] = 0;
  o[4] = r10; o[5] = r11; o[6] = r12; o[7] = 0;
  o[8] = r20; o[9] = r21; o[10] = r22; o[11] = 0;
  o[12] = -(r00 * tx + r10 * ty + r20 * tz);
  o[13] = -(r01 * tx + r11 * ty + r21 * tz);
  o[14] = -(r02 * tx + r12 * ty + r22 * tz);
  o[15] = 1;
  return o;
}

export function m4compose(o, pos, q, sx = 1, sy = sx, sz = sx) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0;
  o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
  o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0;
  o[12] = pos[0]; o[13] = pos[1]; o[14] = pos[2]; o[15] = 1;
  return o;
}

export function m4fromQuat(o, q) {
  return m4compose(o, ZERO3, q, 1, 1, 1);
}

/* Normal matrix for a uniformly-scaled rigid transform is just the rotation. */
export function m3fromM4(o, m) {
  o[0] = m[0]; o[1] = m[1]; o[2] = m[2];
  o[3] = m[4]; o[4] = m[5]; o[5] = m[6];
  o[6] = m[8]; o[7] = m[9]; o[8] = m[10];
  return o;
}

export function m4xform(o, m, a) {
  const x = a[0], y = a[1], z = a[2];
  o[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  o[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  o[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return o;
}

export function m4xformDir(o, m, a) {
  const x = a[0], y = a[1], z = a[2];
  o[0] = m[0] * x + m[4] * y + m[8] * z;
  o[1] = m[1] * x + m[5] * y + m[9] * z;
  o[2] = m[2] * x + m[6] * y + m[10] * z;
  return o;
}

const ZERO3 = [0, 0, 0];

/* ---------- quat (x, y, z, w) ---------- */

export const qt = () => new Float32Array([0, 0, 0, 1]);

export function qIdent(o) { o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 1; return o; }

export function qFromAxisAngle(o, ax, ay, az, ang) {
  const h = ang * 0.5, s = Math.sin(h);
  o[0] = ax * s; o[1] = ay * s; o[2] = az * s; o[3] = Math.cos(h);
  return o;
}

export function qMul(o, a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  o[0] = aw * bx + ax * bw + ay * bz - az * by;
  o[1] = aw * by - ax * bz + ay * bw + az * bx;
  o[2] = aw * bz + ax * by - ay * bx + az * bw;
  o[3] = aw * bw - ax * bx - ay * by - az * bz;
  return o;
}

export function qNorm(o, a = o) {
  const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1;
  o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; o[3] = a[3] / l;
  return o;
}

/* Rotate a vector by a quaternion: v + 2w(q×v) + 2(q×(q×v)). */
export function qRot(o, q, v) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  o[0] = vx + qw * tx + qy * tz - qz * ty;
  o[1] = vy + qw * ty + qz * tx - qx * tz;
  o[2] = vz + qw * tz + qx * ty - qy * tx;
  return o;
}

/* Conjugate is the inverse for unit quaternions — used constantly to take
   a world vector into the chassis frame. */
export function qRotInv(o, q, v) {
  const qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  o[0] = vx + qw * tx + qy * tz - qz * ty;
  o[1] = vy + qw * ty + qz * tx - qx * tz;
  o[2] = vz + qw * tz + qx * ty - qy * tx;
  return o;
}

/* Integrate an angular velocity for dt and renormalise. */
export function qIntegrate(o, q, w, dt) {
  const hx = w[0] * dt * 0.5, hy = w[1] * dt * 0.5, hz = w[2] * dt * 0.5;
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  o[0] = qx + (hx * qw + hy * qz - hz * qy);
  o[1] = qy + (-hx * qz + hy * qw + hz * qx);
  o[2] = qz + (hx * qy - hy * qx + hz * qw);
  o[3] = qw + (-hx * qx - hy * qy - hz * qz);
  return qNorm(o);
}

export function qSlerp(o, a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0, s1;
  if (cos > 0.9995) { s0 = 1 - t; s1 = t; }
  else {
    const th = Math.acos(cos), sn = Math.sin(th);
    s0 = Math.sin((1 - t) * th) / sn;
    s1 = Math.sin(t * th) / sn;
  }
  o[0] = a[0] * s0 + bx * s1;
  o[1] = a[1] * s0 + by * s1;
  o[2] = a[2] * s0 + bz * s1;
  o[3] = a[3] * s0 + bw * s1;
  return qNorm(o);
}

/* Shortest rotation taking `from` to `to`, both unit. */
export function qFromTo(o, from, to) {
  const d = v3dot(from, to);
  if (d > 0.999999) return qIdent(o);
  if (d < -0.999999) {
    // Antiparallel: any perpendicular axis will do.
    let ax = [1, 0, 0];
    if (Math.abs(from[0]) > 0.9) ax = [0, 1, 0];
    const c = v3cross([0, 0, 0], from, ax);
    v3norm(c, c);
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 0;
    return o;
  }
  const c = v3cross([0, 0, 0], from, to);
  o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; o[3] = 1 + d;
  return qNorm(o);
}

/* Yaw about +Y, then pitch about local +X. The rover's heading and the
   camera both live in this convention. */
export function qYawPitch(o, yaw, pitch) {
  const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
  o[0] = cy * sp; o[1] = sy * cp; o[2] = -sy * sp; o[3] = cy * cp;
  return o;
}
