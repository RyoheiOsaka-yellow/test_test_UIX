/**
 * mathcat v0.1.0 — A lean, allocation-free, data-oriented math kernel for interactive apps on the web.
 * Generated from src/ by scripts/build.mjs. Do not edit by hand.
 *
 * The usage contract: every operation is op(out, a, b) — writes into the
 * caller-owned `out`, returns it, never allocates. `out` may alias an
 * input. Keep call sites monomorphic (one array type per code path).
 */
/** The tolerance used by approximate comparisons. */
const EPSILON = 0.000001;

const vec2 = (() => {
/** Allocates a new zero vector. The only allocating function in this module. */
const create = () => [0, 0];

const set = (out, x, y) => {
  out[0] = x;
  out[1] = y;
  return out;
};

const copy = (out, a) => {
  out[0] = a[0];
  out[1] = a[1];
  return out;
};

const add = (out, a, b) => {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
};

const subtract = (out, a, b) => {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  return out;
};

const scale = (out, a, s) => {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  return out;
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

/** The z-component of the 3D cross product of two 2D vectors. */
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

const length = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1]);

const squaredLength = (a) => a[0] * a[0] + a[1] * a[1];

const distance = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
};

const normalize = (out, a) => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  return out;
};

const lerp = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  return out;
};

/** Rotates `a` around `origin` by `rad` radians, counter-clockwise. */
const rotate = (out, a, origin, rad) => {
  const x = a[0] - origin[0];
  const y = a[1] - origin[1];
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  out[0] = origin[0] + x * c - y * s;
  out[1] = origin[1] + x * s + y * c;
  return out;
};

const equals = (a, b, epsilon         = EPSILON) =>
  Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;

return Object.freeze({ create, set, copy, add, subtract, scale, dot, cross, length, squaredLength, distance, normalize, lerp, rotate, equals });
})();

const vec3 = (() => {
/** Allocates a new zero vector. The only allocating function in this module. */
const create = () => [0, 0, 0];

const set = (out, x, y, z) => {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
};

const copy = (out, a) => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
};

const add = (out, a, b) => {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
};

const subtract = (out, a, b) => {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
};

const multiply = (out, a, b) => {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
};

const scale = (out, a, s) => {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
};

/** out = a + b * s. The fused workhorse of integration loops. */
const scaleAndAdd = (out, a, b, s) => {
  out[0] = a[0] + b[0] * s;
  out[1] = a[1] + b[1] * s;
  out[2] = a[2] + b[2] * s;
  return out;
};

const dot = (a, b) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (out, a, b) => {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
};

const length = (a) =>
  Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);

const squaredLength = (a) =>
  a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

const distance = (a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const normalize = (out, a) => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  out[2] = a[2] * inv;
  return out;
};

const negate = (out, a) => {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
};

const lerp = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

/** Transforms `a` by the quaternion `q` (q must be normalized). */
const transformQuat = (out, a, q) => {
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
const transformMat4 = (out, a, m) => {
  const x = a[0], y = a[1], z = a[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
};

const equals = (a, b, epsilon         = EPSILON) =>
  Math.abs(a[0] - b[0]) <= epsilon &&
  Math.abs(a[1] - b[1]) <= epsilon &&
  Math.abs(a[2] - b[2]) <= epsilon;

return Object.freeze({ create, set, copy, add, subtract, multiply, scale, scaleAndAdd, dot, cross, length, squaredLength, distance, normalize, negate, lerp, transformQuat, transformMat4, equals });
})();

const quat = (() => {
/** Allocates a new identity quaternion. The only allocating function in this module. */
const create = () => [0, 0, 0, 1];

const identity = (out) => {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
};

const set = (out, x, y, z, w) => {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
};

const copy = (out, a) => {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
};

/** Sets `out` to a rotation of `rad` radians around the normalized `axis`. */
const setAxisAngle = (out, axis, rad) => {
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
const fromEuler = (out, x, y, z) => {
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
const multiply = (out, a, b) => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];

  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
};

/** The inverse rotation of a normalized quaternion. */
const conjugate = (out, a) => {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
};

const dot = (a, b) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

const normalize = (out, a) => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  out[2] = a[2] * inv;
  out[3] = a[3] * inv;
  return out;
};

/** Spherical linear interpolation between `a` and `b` by `t` in [0, 1]. */
const slerp = (out, a, b, t) => {
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

const equals = (a, b, epsilon         = EPSILON) =>
  Math.abs(a[0] - b[0]) <= epsilon &&
  Math.abs(a[1] - b[1]) <= epsilon &&
  Math.abs(a[2] - b[2]) <= epsilon &&
  Math.abs(a[3] - b[3]) <= epsilon;

return Object.freeze({ create, identity, set, copy, setAxisAngle, fromEuler, multiply, conjugate, dot, normalize, slerp, equals });
})();

const mat4 = (() => {
/** Allocates a new identity matrix. The only allocating function in this module. */
const create = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const identity = (out) => {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
};

const copy = (out, a) => {
  for (let i = 0; i < 16; i++) out[i] = a[i];
  return out;
};

/** out = a * b (b is applied first when transforming column vectors). */
const multiply = (out, a, b) => {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
};

/**
 * Composes a transform from a translation, a normalized rotation quaternion,
 * and a non-uniform scale — the standard TRS used by scene graphs.
 */
const compose = (out, translation, rotation, scale) => {
  const x = rotation[0], y = rotation[1], z = rotation[2], w = rotation[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = scale[0], sy = scale[1], sz = scale[2];

  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = translation[0];
  out[13] = translation[1];
  out[14] = translation[2];
  out[15] = 1;
  return out;
};

/** General inverse via the adjugate. Returns `out` zeroed if `a` is singular. */
const invert = (out, a) => {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (det === 0) {
    for (let i = 0; i < 16; i++) out[i] = 0;
    return out;
  }
  const inv = 1 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inv;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inv;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inv;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inv;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inv;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inv;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inv;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inv;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inv;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inv;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inv;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inv;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inv;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inv;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inv;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inv;
  return out;
};

/**
 * Right-handed perspective projection mapping z to clip-space [-1, 1]
 * (the WebGL convention). `fovy` is the vertical field of view in radians.
 */
const perspective = (
  out,
  fovy,
  aspect,
  near,
  far,
) => {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);

  out[0] = f / aspect;
  out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0; out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
};

/** Right-handed view matrix looking from `eye` toward `target`. */
const lookAt = (out, eye, target, up) => {
  // Forward (z), right (x), and true up (y) axes of the camera.
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
  if (len > 0) { zx /= len; zy /= len; zz /= len; }

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.sqrt(xx * xx + xy * xy + xz * xz);
  if (len > 0) { xx /= len; xy /= len; xz /= len; }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
};

const transpose = (out, a) => {
  if (out === a) {
    // In-place: swap the off-diagonal pairs.
    let t = a[1]; out[1] = a[4]; out[4] = t;
    t = a[2]; out[2] = a[8]; out[8] = t;
    t = a[3]; out[3] = a[12]; out[12] = t;
    t = a[6]; out[6] = a[9]; out[9] = t;
    t = a[7]; out[7] = a[13]; out[13] = t;
    t = a[11]; out[11] = a[14]; out[14] = t;
    return out;
  }
  out[0] = a[0]; out[1] = a[4]; out[2] = a[8]; out[3] = a[12];
  out[4] = a[1]; out[5] = a[5]; out[6] = a[9]; out[7] = a[13];
  out[8] = a[2]; out[9] = a[6]; out[10] = a[10]; out[11] = a[14];
  out[12] = a[3]; out[13] = a[7]; out[14] = a[11]; out[15] = a[15];
  return out;
};

const equals = (a, b, epsilon         = 0.000001) => {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
};

return Object.freeze({ create, identity, copy, multiply, compose, invert, perspective, lookAt, transpose, equals });
})();

const color = (() => {
/** Allocates a new black color. The only allocating function in this module. */
const create = () => [0, 0, 0];

const set = (out, r, g, b) => {
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
};

/** Parses a 0xRRGGBB integer (e.g. 0xff8800) into `out`. */
const fromHex = (out, hex) => {
  out[0] = ((hex >> 16) & 0xff) / 255;
  out[1] = ((hex >> 8) & 0xff) / 255;
  out[2] = (hex & 0xff) / 255;
  return out;
};

/** Packs `a` into a 0xRRGGBB integer, clamping each component to [0, 1]. */
const toHex = (a) => {
  const r = Math.round(Math.min(Math.max(a[0], 0), 1) * 255);
  const g = Math.round(Math.min(Math.max(a[1], 0), 1) * 255);
  const b = Math.round(Math.min(Math.max(a[2], 0), 1) * 255);
  return (r << 16) | (g << 8) | b;
};

/** Sets `out` from hue [0, 1), saturation [0, 1], and lightness [0, 1]. */
const fromHsl = (out, h, s, l) => {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    out[0] = out[1] = out[2] = l;
    return out;
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  out[0] = hue2rgb(p, q, h + 1 / 3);
  out[1] = hue2rgb(p, q, h);
  out[2] = hue2rgb(p, q, h - 1 / 3);
  return out;
};

const lerp = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

/** Converts sRGB components to linear-light, as GPUs expect for shading. */
const srgbToLinear = (out, a) => {
  for (let i = 0; i < 3; i++) {
    const c = a[i];
    out[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return out;
};

/** Converts linear-light components back to sRGB for display. */
const linearToSrgb = (out, a) => {
  for (let i = 0; i < 3; i++) {
    const c = a[i];
    out[i] = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  }
  return out;
};

return Object.freeze({ create, set, fromHex, toHex, fromHsl, lerp, srgbToLinear, linearToSrgb });
})();

const random = (() => {
/**
 * Creates a mulberry32 generator from a 32-bit integer seed. Fast, tiny, and
 * statistically solid for interactive use (not for cryptography). This is
 * the only allocating function in this module.
 */
const createRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A uniform float in [min, max). */
const range = (rng, min, max) =>
  min + rng() * (max - min);

/** A uniform integer in [min, max] inclusive. */
const intRange = (rng, min, max) =>
  min + Math.floor(rng() * (max - min + 1));

/** A uniform point on the unit circle. */
const onCircle = (out, rng) => {
  const angle = rng() * Math.PI * 2;
  out[0] = Math.cos(angle);
  out[1] = Math.sin(angle);
  return out;
};

/** A uniform point on the unit sphere's surface. */
const onSphere = (out, rng) => {
  // Uniform via z-slice: z uniform in [-1, 1], angle uniform in [0, 2pi).
  const z = rng() * 2 - 1;
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  out[0] = r * Math.cos(angle);
  out[1] = r * Math.sin(angle);
  out[2] = z;
  return out;
};

/** A uniform point inside the unit sphere. */
const inSphere = (out, rng) => {
  onSphere(out, rng);
  // Cube root makes the radial distribution uniform by volume.
  const r = Math.cbrt(rng());
  out[0] *= r;
  out[1] *= r;
  out[2] *= r;
  return out;
};

return Object.freeze({ createRng, range, intRange, onCircle, onSphere, inSphere });
})();

const easing = (() => {
const linear = (t) => t;

const quadIn = (t) => t * t;

const quadOut = (t) => t * (2 - t);

const quadInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

const cubicIn = (t) => t * t * t;

const cubicOut = (t) => 1 - (1 - t) ** 3;

const cubicInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const expoOut = (t) =>
  t === 1 ? 1 : 1 - 2 ** (-10 * t);

const elasticOut = (t) => {
  if (t === 0 || t === 1) return t;
  const c = (2 * Math.PI) / 3;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

const bounceOut = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
  if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
  t -= 2.625 / d;
  return n * t * t + 0.984375;
};

/** Hermite smoothing between two edges; the GLSL smoothstep. */
const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

const clamp = (x, min, max) =>
  Math.min(Math.max(x, min), max);

/** Linear interpolation between scalars. */
const mix = (a, b, t) => a + (b - a) * t;

/** Maps `x` from [inMin, inMax] to [outMin, outMax], without clamping. */
const remap = (
  x,
  inMin,
  inMax,
  outMin,
  outMax,
) => outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);

return Object.freeze({ linear, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut, expoOut, elasticOut, bounceOut, smoothstep, clamp, mix, remap });
})();

export { EPSILON, vec2, vec3, quat, mat4, color, random, easing };
