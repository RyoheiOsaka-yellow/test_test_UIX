// Shared by every species: loop timing, bubbles, shadows, caustic light and a sandy floor.
// The bubble is adapted from Sprite Fusion's open-source bubbles via pixelfx (MIT).

import { wrap, clamp, TAU, hex, mix, cycle, lnoise } from "../core/index.js";

/** The loop time for this creature: seeds other than 1 start it elsewhere in its loop, so a crowd isn't in lockstep. */
export const shift = (t, D, seed = 1) => wrap(t + (seed - 1) * 0.618 * D, D);

/** A curve through keyframes [[x, value], ...], held flat before the first and after the last. */
export function curve(x, list) {
  if (x <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [x0, v0] = list[i - 1], [x1, v1] = list[i];
    if (x <= x1) {
      const u = (x - x0) / (x1 - x0 || 1);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return list[list.length - 1][1];
}

/** A bubble of radius r: a rim lit top-left, a white glint, light. cols: [highlight, lit, rim, shade]. */
export function bubble(p, cx, cy, r, cols, a = 1, wob = 0) {
  const [HI, LIT, RIM, SHADE] = cols;
  if (r < 0.9) return p.dot(cx, cy, r < 0.7 ? RIM : LIT, a);
  if (r < 1.5) {
    const px = Math.floor(cx), py = Math.floor(cy);
    p.dot(px, py, HI, a); p.dot(px + 1, py, LIT, a); p.dot(px, py + 1, RIM, a); p.dot(px + 1, py + 1, SHADE, a);
    p.glow(cx + 0.5, cy + 0.5, 3, LIT, 0.12 * a);
    return;
  }
  const rx = r * (1 + wob), ry = r * (1 - wob);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy) * r;
      if (d > r + 0.5) continue;
      const l = (-dx - dy) / Math.SQRT2 / Math.max(0.01, d / r);
      if (d > r - 0.6) p.dot(x, y, l > 0.45 ? LIT : l < -0.55 ? SHADE : RIM, a);
    }
  const hx = Math.round(cx - rx * 0.45), hy = Math.round(cy - ry * 0.45);
  p.dot(hx, hy, HI, a);
  if (r >= 2.5) p.dot(hx + 1, hy, LIT, a), p.dot(hx, hy + 1, LIT, a);
  p.glow(cx, cy, r * 2.4 + 2, RIM, 0.14 * a);
}

/** A few bubbles now and then rising from (x, y), looping. */
export function bubbles(p, t, D, n, seed, x, y, cols, rise = 18, top = -40) {
  cycle(t, D, n, seed, (r) => r.range(1.4, 2.4), (age, L, r) => {
    const rad = r.range(0.6, 1.5), ph = r.next() * TAU, dx = r.range(-3, 3);
    const bx = x + dx + Math.sin(age * (4 + 2 / rad) + ph) * (0.5 + rad * 0.7), by = y - rise * age * (0.8 + rad * 0.3);
    if (by < top) return;
    bubble(p, bx, by, rad, cols, Math.min(1, age * 4, (L - age) * 3));
  });
}

/** A soft shadow: an ellipse blended over what's there, a alpha at the center fading to nothing at the rim. */
export function shadow(p, cx, cy, rx, ry, c, a) {
  if (rx <= 0 || ry <= 0 || a <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d < 1) p.blend(x, y, c, a * (1 - d) ** 0.7);
    }
}

/** Caustics: the light that comes down through rippling water, as bright crossing lines, over a box. */
export function caustics(p, t, D, x0, y0, x1, y1, col, k = 0.25) {
  const a = (t / D) * TAU, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const fall = clamp(1 - (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
      if (fall <= 0) continue;
      const u = x * 0.3 + 1.6 * Math.sin(y * 0.17 + a), v = y * 0.34 + 1.6 * Math.sin(x * 0.15 - a);
      const n1 = Math.sin(u) + Math.sin(v);
      const f = Math.max(0, 1 - Math.abs(n1) * 5) * fall;
      if (f > 0.6) p.light(x, y, col, k);
      else if (f > 0.35) p.light(x, y, col, k * 0.4);
    }
}

/** A patch of sandy floor under a creature: pale grains with a few darker specks, its top edge at y. */
export function sandFloor(p, x0, x1, y, h, seed = 1) {
  const S = [hex("#c8a868"), hex("#b89858"), hex("#9c7e44"), hex("#e0c488")];
  for (let yy = 0; yy < h; yy++)
    for (let x = x0; x <= x1; x++) {
      const edge = clamp(1 - Math.max(0, (Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + 6)) / 6);
      const n = ((x * 7 + yy * 13 + seed * 31) % 17) / 17;
      const c = n < 0.08 ? S[2] : n < 0.2 ? S[1] : n < 0.26 ? S[3] : S[0];
      p.dot(x, y + yy, yy === 0 ? S[3] : c, edge * (1 - yy / h) * 0.9);
    }
}

/** Dim a grid into the water by distance (for things in the back). */
export const haze = (g, water, k) => g.recolor((x, y, c) => mix(c, water, k));

/** Anemone tentacles swaying behind a creature: n tubes rooted along y = base between x0 and x1. cols: [dark, mid, tip]. */
export function anemone(g, t, D, x0, x1, base, n, len, cols, seed = 1, a = 1) {
  const C = cols.map(hex);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, rx = x0 + (x1 - x0) * u, sw = lnoise(t, D, 1, i * 0.7, seed + 11) * 3, lean = (u - 0.5) * 6;
    const L = len * (0.75 + 0.25 * Math.abs(Math.sin(i * 2.3 + seed)));
    const pts = [[rx, base], [rx + lean * 0.4 + sw * 0.5, base - L * 0.5], [rx + lean + sw, base - L]];
    g.tube(pts, (v) => 1.3 - 0.5 * v, (v, d) => (v > 0.85 ? C[2] : d > 0.6 ? C[0] : C[1]), a);
  }
}

/** Aquarium plants: a few stems with leaves behind a freshwater shrimp, rooted on the floor at y = base. */
export function plants(g, t, D, x0, x1, base, n, cols, seed = 1) {
  const C = cols.map(hex);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.37) / n, rx = x0 + (x1 - x0) * u, sw = lnoise(t, D, 1, i * 0.5, seed + 5) * 2.2;
    const H = 18 + 10 * Math.abs(Math.sin(i * 1.7 + seed));
    const pts = [[rx, base], [rx + sw * 0.4, base - H * 0.5], [rx + sw, base - H]];
    g.tube(pts, 0.6, C[1]);
    for (let k = 1; k <= 4; k++) {
      const v = k / 5, px = rx + sw * v * v, py = base - H * v, side = k % 2 ? 1 : -1;
      g.poly([[px, py], [px + side * 5, py - 2.5 + sw * 0.2], [px + side * 1.5, py - 4]], (x, y) => (y < py - 2 ? C[2] : C[1]), 0.95);
    }
  }
}
