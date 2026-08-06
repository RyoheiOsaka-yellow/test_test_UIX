import { EPSILON, type Quat, type Vec3 } from './types.ts';

/** Allocates a new identity quaternion. The only allocating function in this module. */
export const create = (): Quat => [0, 0, 0, 1];

export const identity = (out: Quat): Quat => {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
};

export const set = (out: Quat, x: number, y: number, z: number, w: number): Quat => {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
};

export const copy = (out: Quat, a: Quat): Quat => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
};

/** Sets `out` to a rotation of `rad` radians around the normalized `axis`. */
export const setAxisAngle = (out: Quat, axis: Vec3, rad: number): Quat => {
  const half = rad * 0.5;
  const s = Math.sin(half);
  out[0] = axis[0] * s;
  out[1] = axis[1] * s;
  out[2] = axis[2] * s;
  out[3] = Math.cos(half);
  return out;
};

/**
 * Sets `out` from euler angles in radians, applied in x-then-y-then-z
 * (intrinsic XYZ) order.
 */
export const fromEuler = (out: Quat, x: number, y: number, z: number): Quat => {
  const sx = Math.sin(x * 0.5), cx = Math.cos(x * 0.5);
  const sy = Math.sin(y * 0.5), cy = Math.cos(y * 0.5);
  const sz = Math.sin(z * 0.5), cz = Math.cos(z * 0.5);

  out[0] = sx * cy * cz + cx * sy * sz;
  out[1] = cx * sy * cz - sx * cy * sz;
  out[2] = cx * cy * sz + sx * sy * cz;
  out[3] = cx * cy * cz - sx * sy * sz;
  return out;
};

/** Hamilton product: the rotation `b` followed by the rotation `a`. */
export const multiply = (out: Quat, a: Quat, b: Quat): Quat => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];

  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
};

/** The inverse rotation of a normalized quaternion. */
export const conjugate = (out: Quat, a: Quat): Quat => {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
};

export const dot = (a: Quat, b: Quat): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

export const normalize = (out: Quat, a: Quat): Quat => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  out[2] = a[2] * inv;
  out[3] = a[3] * inv;
  return out;
};

/** Spherical linear interpolation between `a` and `b` by `t` in [0, 1]. */
export const slerp = (out: Quat, a: Quat, b: Quat, t: number): Quat => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];

  // Take the shortest arc: if the quaternions point away from each other,
  // negate one of them.
  let cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  // Fall back to linear interpolation when the arc is tiny, where the
  // spherical formula divides by ~0.
  let scale0 = 1 - t;
  let scale1 = t;
  if (1 - cosom > EPSILON) {
    const omega = Math.acos(cosom);
    const sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  }

  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
};

export const equals = (a: Quat, b: Quat, epsilon: number = EPSILON): boolean =>
  Math.abs(a[0] - b[0]) <= epsilon &&
  Math.abs(a[1] - b[1]) <= epsilon &&
  Math.abs(a[2] - b[2]) <= epsilon &&
  Math.abs(a[3] - b[3]) <= epsilon;
