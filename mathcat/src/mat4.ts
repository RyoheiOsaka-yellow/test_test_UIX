import { type Mat4, type Quat, type Vec3 } from './types.ts';

/**
 * Column-major 4x4 matrices, matching the memory layout WebGL, WebGPU and
 * Three.js expect. Element m[c * 4 + r] is column c, row r; translation
 * lives in m[12], m[13], m[14].
 */

/** Allocates a new identity matrix. The only allocating function in this module. */
export const create = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const identity = (out: Mat4): Mat4 => {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
};

export const copy = (out: Mat4, a: Mat4): Mat4 => {
  for (let i = 0; i < 16; i++) out[i] = a[i];
  return out;
};

/** out = a * b (b is applied first when transforming column vectors). */
export const multiply = (out: Mat4, a: Mat4, b: Mat4): Mat4 => {
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
export const compose = (out: Mat4, translation: Vec3, rotation: Quat, scale: Vec3): Mat4 => {
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
export const invert = (out: Mat4, a: Mat4): Mat4 => {
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
export const perspective = (
  out: Mat4,
  fovy: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 => {
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
export const lookAt = (out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 => {
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

export const transpose = (out: Mat4, a: Mat4): Mat4 => {
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

export const equals = (a: Mat4, b: Mat4, epsilon: number = 0.000001): boolean => {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
};
