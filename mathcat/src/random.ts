import { type Vec2, type Vec3 } from './types.ts';

/**
 * Deterministic, seedable randomness. Interactive apps need reproducible
 * randomness (replays, tests, procedural generation), which Math.random
 * cannot provide.
 */

/** A function returning a uniform float in [0, 1). */
export type Rng = () => number;

/**
 * Creates a mulberry32 generator from a 32-bit integer seed. Fast, tiny, and
 * statistically solid for interactive use (not for cryptography). This is
 * the only allocating function in this module.
 */
export const createRng = (seed: number): Rng => {
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
export const range = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

/** A uniform integer in [min, max] inclusive. */
export const intRange = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

/** A uniform point on the unit circle. */
export const onCircle = (out: Vec2, rng: Rng): Vec2 => {
  const angle = rng() * Math.PI * 2;
  out[0] = Math.cos(angle);
  out[1] = Math.sin(angle);
  return out;
};

/** A uniform point on the unit sphere's surface. */
export const onSphere = (out: Vec3, rng: Rng): Vec3 => {
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
export const inSphere = (out: Vec3, rng: Rng): Vec3 => {
  onSphere(out, rng);
  // Cube root makes the radial distribution uniform by volume.
  const r = Math.cbrt(rng());
  out[0] *= r;
  out[1] *= r;
  out[2] *= r;
  return out;
};
