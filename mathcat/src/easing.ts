/**
 * Timing functions. Every easing maps t in [0, 1] to a progress value that
 * starts at 0 and ends at 1. All are pure and allocation-free.
 */

export const linear = (t: number): number => t;

export const quadIn = (t: number): number => t * t;

export const quadOut = (t: number): number => t * (2 - t);

export const quadInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export const cubicIn = (t: number): number => t * t * t;

export const cubicOut = (t: number): number => 1 - (1 - t) ** 3;

export const cubicInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export const expoOut = (t: number): number =>
  t === 1 ? 1 : 1 - 2 ** (-10 * t);

export const elasticOut = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const c = (2 * Math.PI) / 3;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

export const bounceOut = (t: number): number => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
  if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
  t -= 2.625 / d;
  return n * t * t + 0.984375;
};

/** Hermite smoothing between two edges; the GLSL smoothstep. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

export const clamp = (x: number, min: number, max: number): number =>
  Math.min(Math.max(x, min), max);

/** Linear interpolation between scalars. */
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Maps `x` from [inMin, inMax] to [outMin, outMax], without clamping. */
export const remap = (
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);
