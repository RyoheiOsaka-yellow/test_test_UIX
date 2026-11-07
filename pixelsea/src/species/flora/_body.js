// The flora kit: things that grow on the reef and sway in the current. Blades and fronds (kelp, wakame),
// stipes, recursive branches (staghorn, sea fans, red coral, bushy weeds), domes with a pattern (boulder and
// brain corals), polyps that reach out and pull in, and the rock or sand they stand on. Everything is drawn
// in local coordinates with the base on the floor line (y = 0) and grows upward (negative y).

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale, rand } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";
export { rock } from "../shell/_body.js";

const R5 = (r) => fit(r, 5);
const call = (v, ...a) => (typeof v === "function" ? v(...a) : v);

/**
 * The current: how far (px) a point h px up a frond is pushed sideways at time t. k is the frond's
 * flexibility, off its own phase. Loops cleanly over D.
 */
export function sway(t, D, h, k = 1, off = 0, seed = 1) {
  const ph = (t / D) * TAU;
  return k * (Math.sin(ph + off) * 0.25 * h * 0.12 + lnoise(t, D, 2, off * 0.3, seed) * h * 0.06) ;
}

/**
 * A blade: a leaf hanging off (x0, y0), L long, W wide at its widest, growing in direction ang (radians,
 * 0 straight up, positive leans right), bending with the current. cols dark..bright; opts: { ripple (edge
 * wave amplitude), freq, taper (0 strap .. 1 pointed tip), midrib (a darker line), k (flexibility), off, seed,
 * a, tag, curl (a steady bend, radians over the length) }.
 */
export function blade(g, x0, y0, L, W, ang, t, D, cols, opts = {}) {
  const C = R5(cols), { ripple = 1, freq = 2.5, taper = 0.6, midrib = false, k = 1, off = 0, seed = 1, a = 1, tag = 1, curl = 0.3 } = opts;
  const ph = (t / D) * TAU;
  // the centerline
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, h = u * L;
    const an = ang + curl * u + sway(t, D, h, k, off, seed) / Math.max(1, h) * 1.6;
    const px = i ? pts[i - 1][0] + Math.sin(an) * (L / 12) : x0, py = i ? pts[i - 1][1] - Math.cos(an) * (L / 12) : y0;
    pts.push([px, py, an]);
  }
  // the outline: both edges, rippled
  const left = [], right = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, [px, py, an] = pts[i];
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.7) * (u > 0.75 ? lerp(1, 0.15, ((u - 0.75) / 0.25) * taper) : 1) * Math.min(1, u * 8 + 0.15);
    const rip = ripple * Math.sin(u * freq * TAU + ph + off) * 0.6;
    left.push([px - Math.cos(an) * (w + rip), py - Math.sin(an) * (w + rip)]);
    right.push([px + Math.cos(an) * (w - rip), py + Math.sin(an) * (w - rip)]);
  }
  const poly = [...left, ...right.reverse()];
  const [tx, ty] = pts[12];
  g.poly(poly, (x, y) => {
    // lit from the upper right; darker toward the base and the shaded edge
    const i = Math.min(12, Math.max(0, Math.round(((y0 - y) / Math.max(1, y0 - ty)) * 12))), [px, py, an] = pts[i];
    const s = (x - px) * Math.cos(an) + (y - py) * Math.sin(an);
    const u = i / 12;
    return s > 1.5 ? C[3] : s < -1.5 ? C[1] : u > 0.5 ? C[3] : C[2];
  }, a, tag);
  if (midrib) for (let i = 1; i < 12; i++) g.set(pts[i][0], pts[i][1], C[1], a, tag);
  return pts;
}

/** A stipe or stem: a tube along pts (from blade() or your own), r thick, cols dark..bright. */
export function stipe(g, pts, r, cols, a = 1, tag = 1) {
  const C = R5(cols);
  g.tube(pts.map((p) => [p[0], p[1]]), r, (u, d) => (d > 0.65 ? C[1] : C[3]), a, tag);
}

/**
 * A branching structure from (x, y) growing at ang: len long, splitting depth times. opts: { n (branches
 * per split, 2), spread (radians), shrink (length per level, 0.68), r (thickness at the base), cols, k
 * (sway flexibility), seed, off, tip(g, x, y, ang, depth) called at each tip, every(g, x, y, ang, depth, u)
 * called along branches, plane (0 bushy .. 1 all in one plane), a, tag }.
 */
export function branch(g, x, y, ang, len, depth, t, D, opts = {}) {
  const { n = 2, spread = 0.55, shrink = 0.68, r = 1.6, cols = ["#2a1a10", "#5a3a20", "#8a5a30", "#b88050", "#e0b080"], k = 1, seed = 1, off = 0, tip = null, every = null, a = 1, tag = 1, rr = 1, bend = 0 } = opts;
  const C = R5(cols);
  const rec = (x, y, ang, len, d, i) => {
    const sw = sway(t, D, (depth - d + 1) * len * 0.6, k * (1 + (depth - d) * 0.5), off + i * 0.7, seed) / Math.max(4, len) * 0.5;
    const an = ang + sw + bend * (depth - d);
    const ex = x + Math.sin(an) * len, ey = y - Math.cos(an) * len;
    const w = Math.max(0.5, r * Math.pow(rr, depth - d) * (d / depth) ** 0.6);
    g.tube([[x, y], [ex, ey]], w, (u, dd) => (dd > 0.7 ? C[1] : u > 0.6 ? C[3] : C[2]), a, tag);
    if (every) for (let u = 0.3; u < 1; u += 0.35) every(g, x + (ex - x) * u, y + (ey - y) * u, an, d, u);
    if (d <= 1) {
      if (tip) tip(g, ex, ey, an, d);
      return;
    }
    const seedN = rand(seed, d, i, Math.round(x * 10), Math.round(y * 10));
    for (let j = 0; j < n; j++) {
      const s = n === 1 ? 0 : (j / (n - 1)) * 2 - 1;
      rec(ex, ey, an + s * spread * (0.8 + 0.4 * seedN), len * shrink * (0.85 + 0.3 * rand(seed, d, i, j)), d - 1, i * n + j + 1);
    }
  };
  rec(x, y, ang, len, depth, 0);
}

/** A crown of tentacles at (x, y): n short rays reaching out r, pulsing with k (0 pulled in .. 1 out). */
export function polyp(g, x, y, r, cols, k = 1, n = 6, a = 1, tag = 1, dir = -Math.PI / 2) {
  const C = R5(cols);
  if (k < 0.15) return g.set(x, y, C[1], a, tag);
  for (let i = 0; i < n; i++) {
    const an = dir + ((i - (n - 1) / 2) / Math.max(1, n - 1)) * Math.PI * 1.3, L = r * k * (0.75 + 0.25 * ((i * 7) % 3) / 2);
    g.line(x, y, x + Math.cos(an) * L, y + Math.sin(an) * L, (u) => (u > 0.6 ? C[4] : C[3]), a, tag);
  }
  g.set(x, y, C[2], a, tag);
}

/**
 * A dome: a massive coral or a cushion, cx, cy its base center, rx wide, ry tall. pattern(x, y, nx, ny) -> ramp
 * picks the ramp per cell (nx, ny normalized, ny 0 base .. -1 top). Lit from the upper right.
 */
export function dome(g, cx, cy, rx, ry, cols, pattern = null, a = 1, tag = 1) {
  const C = R5(cols);
  g.shade(cx - rx, cy - ry, cx + rx, cy, (x, y, o) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    if (nx * nx + ny * ny > 1 || ny > 0) return 0;
    const ramp = pattern ? R5(pattern(x, y, nx, ny) || cols) : C;
    const l = -nx * 0.4 + ny * 0.9;
    o.a = a; o.t = tag;
    return pick(ramp, l * 0.9 + 0.1, Math.hypot(nx, ny) > 0.9 ? 1 : 3);
  });
}

/** A float: a round air bladder with a glint, for Sargassum and giant kelp. */
export function bladder(g, x, y, r, cols, a = 1, tag = 1) {
  const C = R5(cols);
  g.ellipse(x, y, r, r * 0.9, (nx, ny) => (nx + ny < -0.6 ? C[4] : nx + ny > 0.5 ? C[1] : C[3]), a, tag);
}

/** A sandy patch for things that grow from sand: pale with a few grains, its top at y, from x0 to x1. */
export function sandBase(g, x0, x1, y, h, seed = 1) {
  const S = ["#c8a868", "#b89858", "#9c7e44", "#e0c488"].map(hex);
  g.shade(x0, y, x1, y + h, (x, yy, o) => {
    const edge = clamp(1 - Math.max(0, Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + 6) / 6);
    if (rand(Math.round(x), Math.round(yy), seed) > edge) return 0;
    const n = rand(Math.round(x), Math.round(yy), seed + 1);
    o.t = 9;
    return yy < y + 1 ? S[3] : n < 0.08 ? S[2] : n < 0.2 ? S[1] : S[0];
  });
}

/** A few little reef fish sheltering around (x, y): damselfish darting about, looping. */
export function smallFish(p, t, D, x, y, n, cols, seed = 1, spread = 10) {
  const C = cols.map(hex), ph = (t / D) * TAU;
  for (let i = 0; i < n; i++) {
    const ox = Math.sin(ph * (1 + (i % 3) * 0.5) + i * 2.1) * spread, oy = Math.cos(ph * (0.7 + (i % 2) * 0.4) + i) * spread * 0.5;
    const fx = x + ox, fy = y + oy, dir = Math.cos(ph * (1 + (i % 3) * 0.5) + i * 2.1) >= 0 ? 1 : -1;
    p.dot(fx, fy, C[1]); p.dot(fx - dir, fy, C[0]); p.dot(fx - 2 * dir, fy + ((i + Math.round(t * 6)) % 2 ? 1 : -1) * 0.6, C[0]);
    p.dot(fx + dir * 0.5, fy - 0.5, C[2]);
  }
}
