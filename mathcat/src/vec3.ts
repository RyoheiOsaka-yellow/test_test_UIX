import { EPSILON, type Mat4, type Quat, type Vec3 } from './types.ts';

/** Allocates a new zero vector. The only allocating function in this module. */
export const create = (): Vec3 => [0, 0, 0];

export const set = (out: Vec3, x: number, y: number, z: number): Vec3 => {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
};

export const copy = (out: Vec3, a: Vec3): Vec3 => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
};

export const add = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
};

export const subtract = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
};

export const multiply = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
};

export const scale = (out: Vec3, a: Vec3, s: number): Vec3 => {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
};

/** out = a + b * s. The fused workhorse of integration loops. */
export const scaleAndAdd = (out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 => {
  out[0] = a[0] + b[0] * s;
  out[1] = a[1] + b[1] * s;
  out[2] = a[2] + b[2] * s;
  return out;
};

export const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
};

export const length = (a: Vec3): number =>
  Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);

export const squaredLength = (a: Vec3): number =>
  a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

export const distance = (a: Vec3, b: Vec3): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const normalize = (out: Vec3, a: Vec3): Vec3 => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  out[2] = a[2] * inv;
  return out;
};

export const negate = (out: Vec3, a: Vec3): Vec3 => {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
};

export const lerp = (out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

/** Transforms `a` by the quaternion `q` (q must be normalized). */
export const transformQuat = (out: Vec3, a: Vec3, q: Quat): Vec3 => {
  // t = 2 * cross(q.xyz, a); out = a + q.w * t + cross(q.xyz, t)
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const x = a[0], y = a[1], z = a[2];

  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);

  out[0] = x + qw * tx + qy * tz - qz * ty;
  out[1] = y + qw * ty + qz * tx - qx * tz;
  out[2] = z + qw * tz + qx * ty - qy * tx;
  return out;
};

/** Transforms the point `a` by the matrix `m` (with perspective divide). */
export const transformMat4 = (out: Vec3, a: Vec3, m: Mat4): Vec3 => {
  const x = a[0], y = a[1], z = a[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
};

export const equals = (a: Vec3, b: Vec3, epsilon: number = EPSILON): boolean =>
  Math.abs(a[0] - b[0]) <= epsilon &&
  Math.abs(a[1] - b[1]) <= epsilon &&
  Math.abs(a[2] - b[2]) <= epsilon;
