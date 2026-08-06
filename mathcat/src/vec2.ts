import { EPSILON, type Vec2 } from './types.ts';

/** Allocates a new zero vector. The only allocating function in this module. */
export const create = (): Vec2 => [0, 0];

export const set = (out: Vec2, x: number, y: number): Vec2 => {
  out[0] = x;
  out[1] = y;
  return out;
};

export const copy = (out: Vec2, a: Vec2): Vec2 => {
  out[0] = a[0];
  out[1] = a[1];
  return out;
};

export const add = (out: Vec2, a: Vec2, b: Vec2): Vec2 => {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
};

export const subtract = (out: Vec2, a: Vec2, b: Vec2): Vec2 => {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  return out;
};

export const scale = (out: Vec2, a: Vec2, s: number): Vec2 => {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  return out;
};

export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];

/** The z-component of the 3D cross product of two 2D vectors. */
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

export const length = (a: Vec2): number => Math.sqrt(a[0] * a[0] + a[1] * a[1]);

export const squaredLength = (a: Vec2): number => a[0] * a[0] + a[1] * a[1];

export const distance = (a: Vec2, b: Vec2): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
};

export const normalize = (out: Vec2, a: Vec2): Vec2 => {
  const len = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  const inv = len > EPSILON ? 1 / len : 0;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  return out;
};

export const lerp = (out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  return out;
};

/** Rotates `a` around `origin` by `rad` radians, counter-clockwise. */
export const rotate = (out: Vec2, a: Vec2, origin: Vec2, rad: number): Vec2 => {
  const x = a[0] - origin[0];
  const y = a[1] - origin[1];
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  out[0] = origin[0] + x * c - y * s;
  out[1] = origin[1] + x * s + y * c;
  return out;
};

export const equals = (a: Vec2, b: Vec2, epsilon: number = EPSILON): boolean =>
  Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
