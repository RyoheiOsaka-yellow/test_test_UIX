import { type Color } from './types.ts';

/**
 * Colors are caller-owned [r, g, b] arrays with components in [0, 1],
 * following the same data-in, data-out contract as the vector modules.
 */

/** Allocates a new black color. The only allocating function in this module. */
export const create = (): Color => [0, 0, 0];

export const set = (out: Color, r: number, g: number, b: number): Color => {
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
};

/** Parses a 0xRRGGBB integer (e.g. 0xff8800) into `out`. */
export const fromHex = (out: Color, hex: number): Color => {
  out[0] = ((hex >> 16) & 0xff) / 255;
  out[1] = ((hex >> 8) & 0xff) / 255;
  out[2] = (hex & 0xff) / 255;
  return out;
};

/** Packs `a` into a 0xRRGGBB integer, clamping each component to [0, 1]. */
export const toHex = (a: Color): number => {
  const r = Math.round(Math.min(Math.max(a[0], 0), 1) * 255);
  const g = Math.round(Math.min(Math.max(a[1], 0), 1) * 255);
  const b = Math.round(Math.min(Math.max(a[2], 0), 1) * 255);
  return (r << 16) | (g << 8) | b;
};

/** Sets `out` from hue [0, 1), saturation [0, 1], and lightness [0, 1]. */
export const fromHsl = (out: Color, h: number, s: number, l: number): Color => {
  const hue2rgb = (p: number, q: number, t: number): number => {
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

export const lerp = (out: Color, a: Color, b: Color, t: number): Color => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

/** Converts sRGB components to linear-light, as GPUs expect for shading. */
export const srgbToLinear = (out: Color, a: Color): Color => {
  for (let i = 0; i < 3; i++) {
    const c = a[i];
    out[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return out;
};

/** Converts linear-light components back to sRGB for display. */
export const linearToSrgb = (out: Color, a: Color): Color => {
  for (let i = 0; i < 3; i++) {
    const c = a[i];
    out[i] = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  }
  return out;
};
