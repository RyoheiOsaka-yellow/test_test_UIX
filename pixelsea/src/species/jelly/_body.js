// The jellyfish kit: a bell that pulses (a quick squeeze that lifts it, a slow relax as it sinks), a frilled
// margin, tentacles that trail behind the beat, oral arms hanging from the middle, and whatever pattern the
// species paints inside. Everything is translucent: the bell is drawn with alpha, so what's behind shows
// through. The origin is the bell's centre at rest; it hangs downward (positive y).

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale, rand, ease } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);

/** The beat: 0 relaxed .. 1 squeezed, over one loop of D with n beats. Quick in, slow out. */
export function beat(t, D, n = 1, off = 0) {
  const u = (((t / D) * n + off) % 1 + 1) % 1;
  return u < 0.25 ? ease.outCubic(u / 0.25) : 1 - ease.inOutSine((u - 0.25) / 0.75);
}
/** How far up the bell has been pushed by the beat (px), so it rises on the squeeze and settles after. */
export function lift(t, D, n = 1, off = 0, h = 4) {
  const u = (((t / D) * n + off) % 1 + 1) % 1;
  return -h * (u < 0.4 ? ease.outCubic(u / 0.4) : 1 - ease.inOutSine((u - 0.4) / 0.6));
}

/**
 * A bell at (0, 0): W half-width, H height (dome above the margin line y = 0), squeezed by k (0..1).
 * cols dark..bright; pattern(x, y, nx, ny) -> ramp | 0 paints inside; opts: { a (alpha), frill (scallops
 * on the margin), dome (0.5 flat .. 1 tall), box (true for a cubomedusa), rim (ramp for the margin band) }.
 * Returns { W, H } as drawn (squeezed).
 */
export function bell(g, W, H, k, cols, pattern = null, opts = {}) {
  const { a = 0.75, frill = 6, dome = 0.7, box = false, rim = null, tag = 1 } = opts;
  const w = W * (1 - 0.22 * k), h = H * (1 + 0.18 * k);
  const C = R5(cols), RM = rim ? R5(rim) : null;
  g.shade(-w - 1, -h - 1, w + 1, 2, (x, y, o) => {
    const nx = x / w;
    if (Math.abs(nx) > 1) return 0;
    const top = box ? -h * (Math.abs(nx) > 0.85 ? 1 - ((Math.abs(nx) - 0.85) / 0.15) ** 2 * 0.3 : 1) : -h * Math.pow(Math.max(0, 1 - nx * nx), dome);
    const edge = frill ? 0.8 * Math.abs(Math.sin(nx * frill * Math.PI / 2)) : 0;
    const bottom = box ? 0 : edge - 0.5 + 0.6 * (1 - Math.abs(nx)) * (1 + k);
    if (y < top || y > bottom) return 0;
    const ny = (y - top) / Math.max(1, bottom - top);
    o.a = a; o.t = tag;
    const ramp = pattern ? R5(pattern(x, y, nx, ny) || cols) : C;
    const l = -nx * 0.3 - (1 - ny) * 0.9;
    if (RM && y > bottom - 1.5) return RM[3];
    return pick(ramp, l * 0.8 + 0.35, y < top + 1 || Math.abs(nx) > 0.9 ? 1 : 3);
  });
  return { W: w, H: h };
}

/**
 * Tentacles hanging from the margin: n of them from x = -w .. w at y = 0, L long, trailing the beat (k) and
 * swaying. cols; opts: { a, thick (0 hair-line .. 2 ropes), spread (px of sideways drift at the tip),
 * seed, lag }.
 */
export function tentacles(g, w, n, L, k, t, D, cols, opts = {}) {
  const { a = 0.8, thick = 0, spread = 4, seed = 1, lag = 0.5, y0 = 0, tag = 1 } = opts;
  const C = R5(cols), ph = (t / D) * TAU;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, x0 = u * w * 0.95, Li = L * (0.7 + 0.3 * rand(seed, i)), sw = lnoise(t, D, 2, i * 0.3, seed) * spread;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      const v = s / 6;
      // the tentacle streams in behind the bell: inward on the squeeze, out on the relax
      pts.push([x0 + u * (1 - k * lag) * v * 3 + sw * v * v + Math.sin(v * 3 - ph * 2 + i) * 1.2 * v, y0 + Li * v * (1 - 0.1 * k)]);
    }
    if (thick > 0) g.tube(pts, (v) => thick * (1 - v * 0.6), (v, d) => (d > 0.6 ? C[1] : v > 0.7 ? C[3] : C[2]), a, tag);
    else for (let s = 1; s <= 6; s++) g.line(...pts[s - 1], ...pts[s], (v) => (s > 4 ? C[3] : C[2]), a * (1 - (s / 6) * 0.4), tag);
  }
}

/** Oral arms: n frilly ribbons hanging from the middle, L long, r thick, swinging with the beat. */
export function oralArms(g, n, L, r, k, t, D, cols, opts = {}) {
  const { a = 0.85, seed = 1, y0 = 0, frilly = true, tag = 1 } = opts;
  const C = R5(cols), ph = (t / D) * TAU;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, pts = [];
    for (let s = 0; s <= 5; s++) {
      const v = s / 5;
      pts.push([u * 3 + u * v * 5 * (1 - 0.3 * k) + Math.sin(v * 2.5 - ph * 2 + i * 1.3) * 1.5 * v, y0 + 1 + L * v]);
    }
    g.tube(pts, (v) => r * (1 - 0.4 * v), (v, d) => (d > 0.6 ? C[1] : C[3]), a, tag);
    if (frilly) for (let s = 1; s <= 5; s++) { const [px, py] = pts[s]; g.set(px + (s % 2 ? 1.5 : -1.5) * r, py, C[4], a, tag); }
  }
}
