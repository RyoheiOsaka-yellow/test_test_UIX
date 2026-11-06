// Colors are 32-bit integers laid out like ImageData bytes (R, G, B, A in memory), so a frame's color buffer
// can be shown with new ImageData(new Uint8ClampedArray(buf.buffer), w, h). Adapted from pixelfx (MIT, Patch).

import { clamp } from "./math.js";

export const rgb = (r, g, b) => (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
export const red = (c) => c & 255;
export const green = (c) => (c >>> 8) & 255;
export const blue = (c) => (c >>> 16) & 255;

/** "#rgb" or "#rrggbb" (or a color number, passed through) to a color number. */
export function hex(h) {
  if (typeof h === "number") return h;
  let s = h.replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const v = parseInt(s.slice(0, 6), 16);
  return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255);
}
export const toHex = (c) => "#" + [red(c), green(c), blue(c)].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Linear mix of two colors. */
export function mix(a, b, t) {
  t = clamp(t);
  return rgb(red(a) + (red(b) - red(a)) * t, green(a) + (green(b) - green(a)) * t, blue(a) + (blue(b) - blue(a)) * t);
}
/** Multiply a color's brightness by k. */
export const scale = (c, k) => rgb(Math.min(255, red(c) * k), Math.min(255, green(c) * k), Math.min(255, blue(c) * k));
/** Perceived brightness 0..1. */
export const luma = (c) => (0.299 * red(c) + 0.587 * green(c) + 0.114 * blue(c)) / 255;

/** A list of hex strings (dark to bright) to color numbers. */
export const ramp = (list) => list.map(hex);
/** Resample a ramp to exactly n steps, keeping its ends, so a species can index steps by number whatever a caller passes. */
export function fit(r, n) {
  r = r.map(hex);
  if (r.length === n) return r;
  return Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / Math.max(1, n - 1))]);
}
/** The ramp step for t in 0..1, no blending: pixel art picks a color, it doesn't fade between two. */
export const at = (r, t) => r[clamp(Math.floor(t * r.length), 0, r.length - 1)];

export const WHITE = hex("#ffffff");
export const BLACK = hex("#000000");
export const INK = hex("#0b0a10");

/** Water ramps (dark to bright) for backdrops and recolors. */
export const PAL = {
  deep: ["#050c1c", "#0a1a34", "#10305a", "#1a4f82", "#2f7eae", "#5ab6d6", "#a8e6f0", "#ffffff"],
  reef: ["#0b1a26", "#133448", "#1d5a6a", "#2a8a8a", "#48b8a8", "#8ee0c8", "#d4f8ea", "#ffffff"],
  sand: ["#1c160c", "#3a2e18", "#6a5428", "#9c7e44", "#c8a868", "#e6cc96", "#f8ecc8", "#ffffff"],
  night: ["#03040c", "#070a1a", "#0c122c", "#141c40", "#1c2856", "#283a70"],
};
