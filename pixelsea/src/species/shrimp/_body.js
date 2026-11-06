// The shrimp kit: one body plan, many species. A shrimp faces right, its origin at the joint between the
// carapace and the abdomen. Species pass a spec: sizes, a skin(u, v, x, y) that picks a color ramp for each
// point (u 0 at the rostrum .. 1 at the tail, v -1 back .. 1 belly), the kind of claws and antennae.

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale } from "../../core/index.js";

const call = (v, ...a) => (typeof v === "function" ? v(...a) : v);

/** Shade a ramp (dark..bright, any length) by v (-1 top .. 1 bottom) and edge depth d (1 at the rim). */
export function pick(ramp, v, d = 3, k = 0) {
  const n = ramp.length;
  let i = (1 - (v + 1) / 2) * (n - 1) + k;
  if (d <= 1) i -= 0.9;
  return ramp[clamp(Math.round(i), 0, n - 1)];
}

/** Default spec, every field a species may override. */
export const BASE = {
  Lc: 13, // carapace length
  H: 5, // carapace half-height
  L: 20, // abdomen length
  curl: 0.55, // how far the abdomen bends down toward the tail (0 straight, 1 tucked)
  taper: 0.5, // tail half-height over carapace half-height
  rostrum: 5, // the beak's length
  rostrumUp: 1.5,
  eye: 1, // eye radius-ish (1 small, 2 big)
  antennae: { n: 2, len: 34, up: -0.45, back: true, col: null }, // long flagella
  antennules: { len: 7, col: null },
  legs: { n: 5, len: 7, col: null, step: 1 },
  claws: { kind: "small", size: 1, col: null },
  swimmerets: { col: null },
  fan: 1, // tail fan size
  alpha: 1,
  segs: 6,
  bob: 1.2,
  wag: 0.06, // abdomen flex amplitude (fraction of curl)
  outline: null, // color, default the darkest skin step
  translucent: false,
};

/**
 * Draw a shrimp into grid g at local time t of loop D. spec: BASE fields plus skin(u, v, x, y) -> ramp.
 * Returns the body's extent { x0, x1, y0, y1 } for shadows and bubbles.
 */
export function drawShrimp(g, spec, t, D, seed = 1) {
  const S = { ...BASE, ...spec };
  const ph = (t / D) * TAU;
  const wag = Math.sin(ph * 2) * S.wag;
  const curl = S.curl + wag;
  // the abdomen's centerline: from (0, 0) back to the tail at x = -L, dipping by curl
  const spine = (u) => (curl < 0 ? [-u * S.L * (1 - 0.5 * u * u), curl * 14 * Math.pow(u, 1.6)] : [-u * S.L * (1 - 0.22 * curl * u * u), curl * 12 * u * u * (1.15 - 0.15 * u)]);
  const half = (u) => S.H * lerp(0.88, S.taper, Math.pow(u, 1.3));
  const skin = S.skin ?? (() => ["#1a1020", "#60304a", "#b05070", "#e890a0", "#ffd8e0"]);
  const ramps = new Map();
  const R = (r) => {
    const k = r.join();
    let v = ramps.get(k);
    if (!v) ramps.set(k, (v = fit(r, 5)));
    return v;
  };
  const FRONT = S.Lc + S.rostrum, TOT = FRONT + S.L;
  const uOf = (x) => clamp((FRONT - x) / TOT);
  const col = (u, v, x, y, d, k = 0) => pick(R(skin(u, v, x, y)), v, d, k);
  const LEG = S.legs.col ? hex(S.legs.col) : null, ANT = S.antennae.col ? hex(S.antennae.col) : null;
  const dark = (x, y) => R(skin(uOf(x), 0.6, x, y))[1], mid = (x, y) => R(skin(uOf(x), 0, x, y))[2];
  const a = S.alpha;
  const [tx, ty] = spine(1);
  const tang = Math.atan2(spine(1)[1] - spine(0.92)[1], spine(1)[0] - spine(0.92)[0]);

  // ---- behind the body: far legs, far antenna, swimmerets' far side
  legs(g, S, t, D, ph, LEG, dark, 0.28, a);

  // ---- abdomen: segments back to front, each pleuron overlapping the next, the pleura's lower edge rounded
  for (let s = S.segs - 1; s >= 0; s--) {
    const u0 = s / S.segs, u1 = (s + 1) / S.segs, uu = (u0 + u1) / 2;
    const [x0, y0] = spine(u0), [x1, y1] = spine(u1), h0 = half(u0), h1 = half(u1), ang = Math.atan2(y1 - y0, x1 - x0);
    const cs = Math.cos(ang), sn = Math.sin(ang), len = Math.hypot(x1 - x0, y1 - y0) + 1.2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    g.shade(cx - len, cy - h0 - 2, cx + len, cy + h0 + 2, (x, y, o) => {
      const dx = x - cx, dy = y - cy, lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
      const w = Math.abs(lx) / (len / 2);
      if (w > 1) return 0;
      const hh = lerp(h1, h0, (lx / len + 0.5)) * (s === S.segs - 1 ? 0.92 : 1);
      const v = ly / hh;
      if (Math.abs(v) > 1) return 0;
      // the back is the arc's top; below the belly line the pleuron is a flap
      if (v > 0.72 && w > 0.82) return 0;
      o.a = a;
      const u = uOf(x);
      const edge = w > 0.86 && v > -0.3 ? 1 : 3;
      return col(u, v + 0.08, x, y, edge, w > 0.9 && lx < 0 ? -1 : 0);
    });
  }
  // the tail fan: telson in the middle, two uropod lobes above and below, fanned along the tangent
  {
    const fs = S.fan, fl = 7 * fs, fw = 3.2 * fs;
    const cs = Math.cos(tang), sn = Math.sin(tang);
    const P = (dx, dy) => [tx + dx * cs - dy * sn, ty + dx * sn + dy * cs];
    const lobe = (sgn) => g.poly([P(-1, 0), P(fl * 0.55, sgn * fw * 0.9), P(fl, sgn * fw * 0.55), P(fl * 0.85, sgn * 0.6), P(1, sgn * 0.3)], (x, y) => col(1, sgn * 0.5 + 0.15, x, y, 3, sgn < 0 ? 0 : -1), a);
    lobe(-1); lobe(1);
    g.poly([P(-1, -1.1), P(fl * 0.95, -0.9), P(fl * 0.95, 0.9), P(-1, 1.1)], (x, y) => col(1, 0, x, y, 3, 0), a);
    // ribs
    for (const sgn of [-1, 1]) g.line(...P(1, sgn * 0.8), ...P(fl * 0.8, sgn * fw * 0.6), (u) => scale(col(1, 0.5, 0, 0, 3), 0.75), a * 0.8);
  }
  // swimmerets under the abdomen, paddling back in sequence
  for (let s = 0; s < S.segs - 1; s++) {
    const u = (s + 0.55) / S.segs, [sx, sy] = spine(u), h = half(u) * 0.95;
    const sw = Math.sin(ph * 2 - s * 0.9) * 0.6 - 0.4;
    const c = S.swimmerets.col ? hex(S.swimmerets.col) : mid(sx, sy);
    const len = 3.2 * (1 - 0.3 * u);
    g.line(sx, sy + h, sx + sw * len * 0.8 - 0.8, sy + h + len, c, a * 0.9);
    g.line(sx + 1, sy + h, sx + 1 + sw * len * 0.8 - 0.6, sy + h + len * 0.9, scale(c, 0.8), a * 0.8);
  }

  // ---- carapace: an arched shell from x = 0 forward to Lc, deepest a third of the way back, rounded in front
  const Lc = S.Lc, H = S.H;
  g.shade(-1, -H * 1.3 - 1, Lc + 1, H + 1.5, (x, y, o) => {
    const u = x / Lc;
    if (u < -0.02 || u > 1.02) return 0;
    const top = -H * (0.9 + 0.28 * Math.sin(Math.PI * Math.pow(Math.max(0, u), 0.75)) - 0.25 * Math.max(0, u - 0.8) * 5);
    const bot = H * (1.05 - 0.55 * Math.max(0, u - 0.3) ** 1.6 * 2.1 - 0.2 * Math.max(0, 0.15 - u));
    if (y < top || y > bot) return 0;
    const cy = (top + bot) / 2, hh = (bot - top) / 2;
    if (u > 0.82 && Math.abs(y - cy) > hh * Math.sqrt(Math.max(0, 1 - ((u - 0.82) / 0.2) ** 2))) return 0;
    const v = (y - cy) / hh;
    o.a = a;
    return col(uOf(x), v, x, y, u > 0.9 || u < 0.05 ? 1 : 3);
  });
  // the cervical groove: a faint line across the carapace a third of the way back
  g.line(Lc * 0.55, -H * 0.9, Lc * 0.5, H * 0.3, (u) => scale(col(uOf(Lc * 0.5), -1 + 2 * u, Lc * 0.5, 0, 3), 0.8), a * 0.8);
  // the rostrum: a toothed beak sticking out above the eyes
  {
    const rx = Lc, ry = -H * 0.45 - S.rostrumUp, rl = S.rostrum;
    g.poly([[rx - 1, ry - 1.3], [rx + rl, ry - 1.2 - rl * 0.12], [rx + rl * 0.5, ry + 0.9], [rx - 1, ry + 1.6]], (x, y) => col(0, y < ry ? -0.7 : 0.4, x, y, 2), a);
    for (let i = 1; i < rl; i += 2) g.set(rx + i, ry - 1.5 - i * 0.12, col(0, -1, rx + i, ry, 3), a);
  }
  // the eye on a short stalk
  {
    const ex = Lc + 0.5, ey = -H * 0.1, r = S.eye;
    g.set(ex - 1, ey, dark(ex, ey), a);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 0.3) g.set(ex + dx + r * 0.5, ey + dy, hex("#0a0810"));
    g.set(ex + r * 0.5 - (r > 1 ? 1 : 0), ey - (r > 1 ? 1 : 0), hex("#ffffff"));
    if (r > 1) g.set(ex + r * 0.5, ey, hex("#404048"));
  }

  // ---- in front of the body: near legs, claws, antennules, antennae
  legs(g, S, t, D, ph, LEG, dark, 1, a, true);
  claws(g, S, t, D, ph, LEG, dark, mid, a);
  antennae(g, S, t, D, ph, ANT, mid, seed, a);

  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.outlineLit ? hex(S.outlineLit) : hex(S.outline)) : ny < 0 && !S.translucent ? R(skin(uOf(x), -0.8, x, y))[1] : R(skin(uOf(x), 0.5, x, y))[0]), S.translucent ? a * 0.9 : 1);
  return { x0: tx - 8, x1: FRONT + S.antennules.len, y0: -H - 4, y1: Math.max(H, ty) + S.legs.len };
}

// walking legs under the carapace: thin, jointed, stepping in turn. back: the far row, dim and offset.
function legs(g, S, t, D, ph, LEG, dark, k, a, front = false) {
  const n = S.legs.n, len = S.legs.len;
  for (let i = 0; i < n; i++) {
    const hx = S.Lc * (0.2 + (0.7 * i) / Math.max(1, n - 1)), hy = S.H * 0.85;
    const step = Math.sin(ph * 2 + i * 1.3 + (front ? 0 : Math.PI)) * S.legs.step;
    const kx = hx + 1.6 + step * 1.2 + (front ? 0 : -1), ky = hy + len * 0.45 + Math.max(0, -step) * 0.8;
    const fx = kx + 1.2 + step * 2.2, fy = hy + len - Math.abs(step) * 1.1;
    const c0 = LEG ?? dark(hx, hy), c = k < 1 ? mix(c0, hex("#0a1a30"), 0.45) : c0;
    g.line(hx, hy, kx, ky, c, a);
    g.line(kx, ky, fx, fy, c, a);
    if (front) g.set(kx, ky, scale(c, 1.4), a);
  }
}

// claws on the first legs, by kind: small pincers, long thin "boxer" arms, one big pistol claw, flat harlequin fans
function claws(g, S, t, D, ph, LEG, dark, mid, a) {
  const C = S.claws, kind = C.kind, sz = C.size ?? 1, c = C.col ? hex(C.col) : LEG ?? dark(S.Lc, 0);
  const hx = S.Lc * 0.78, hy = S.H * 0.75, open = 0.5 + 0.5 * Math.sin(ph * 2 + 1);
  if (kind === "none") return;
  if (kind === "small") {
    for (const d of [0, 1.5]) {
      const ex = hx + 4 * sz + d, ey = hy + 2.5 * sz;
      g.line(hx + d * 0.5, hy, ex, ey, c, a);
      g.set(ex + 1, ey - 1 * open, mid(ex, ey), a); g.set(ex + 1, ey + 1, mid(ex, ey), a); g.set(ex + 2, ey, mid(ex, ey), a);
    }
  } else if (kind === "long") {
    // Stenopus: long spiny arms held out and up, pincers at the end
    for (const [dy, side] of [[0, 1], [1.5, 0.6]]) {
      const L = 11 * sz, ex = hx + L, ey = hy - 3 - dy + Math.sin(ph + dy) * 0.8;
      const cc = typeof C.ramp === "function" ? null : c;
      const seg = (x0, y0, x1, y1) => g.tube([[x0, y0], [x1, y1]], 0.9 * side, (u) => (cc ?? hex(C.ramp(u)[1])), a);
      seg(hx, hy - 1 + dy, hx + L * 0.45, hy - 4 + dy);
      seg(hx + L * 0.45, hy - 4 + dy, ex, ey);
      g.line(ex, ey, ex + 3.5 * sz, ey - 2.5 - open * 1.5, c, a);
      g.line(ex, ey, ex + 3.5 * sz, ey + 0.8, c, a);
    }
  } else if (kind === "big") {
    // Alpheus: one claw a club as big as the head, held forward, snapping shut now and then
    const sx = hx + 2, sy = hy - 1, w = 7 * sz, h = 3.6 * sz, snap = Math.max(0, Math.sin(ph * 2 + 2)) ** 6;
    g.ellipse(sx + w * 0.55, sy + 0.5, w * 0.55, h * 0.75, (nx, ny) => pick(fit(C.ramp ? C.ramp(0.5) : [c, c, c], 5), ny * 0.9, 3), a);
    g.poly([[sx + w, sy - h * 0.5], [sx + w + 4 * sz, sy - h * 0.2 - 1.5 * (1 - snap)], [sx + w + 4 * sz, sy + h * 0.2], [sx + w, sy + h * 0.4]], mid(sx, sy), a);
    g.line(sx + w, sy - h * 0.3, sx + w + 3.5 * sz, sy - h * 0.5 - 1.5 * (1 - snap), c, a);
    // the small claw on the other side
    g.line(hx + 1, hy + 1, hx + 5, hy + 3.5, c, a);
    g.set(hx + 6, hy + 3, c, a); g.set(hx + 6, hy + 4.5, c, a);
  } else if (kind === "flat") {
    // Hymenocera: two broad flat claws like petals, held up in front
    for (const [dy, s] of [[1.2, 0.8], [0, 1]]) {
      const ex = hx + 5 * sz, ey = hy - 2 - dy * 3 + Math.sin(ph + dy) * 0.6;
      g.line(hx, hy - dy, ex - 2, ey + 1, c, a);
      g.ellipse(ex + 2.5 * s, ey - 1.5 * s, 3.2 * s * sz, 2.6 * s * sz, (nx, ny) => pick(fit(C.ramp ? C.ramp(nx, ny) : [c, c], 5), ny, 3), a);
    }
  } else if (kind === "fist") {
    // boxer crab-like / bumblebee: short stout claws tucked under
    for (const d of [0, 2]) {
      g.line(hx + d, hy, hx + 3 + d, hy + 3, c, a);
      g.ellipse(hx + 4 + d, hy + 3.5, 1.6, 1.3, mid(hx, hy), a);
    }
  }
}

// antennules (short, forward) and antennae (long flagella, swept back over the body or held forward)
function antennae(g, S, t, D, ph, ANT, mid, seed, a) {
  const fx = S.Lc + S.rostrum * 0.4, fy = -S.H * 0.15;
  const c = ANT ?? mid(fx, fy);
  const A = S.antennae, n = A.n ?? 2;
  for (let i = 0; i < n; i++) {
    const len = A.len * (i ? 0.85 : 1), up = A.up + (i ? 0.12 : 0), back = A.back;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10, sway = lnoise(t, D, 2, i * 0.37 + u, seed) * 1.4 * u;
      let x, y;
      if (back) {
        // sweeps back over the body from the head in a gentle arc, drooping toward the tip
        x = fx + 1 - u * len * 0.95 + sway * 0.3;
        y = fy - 1.5 - Math.sin(u * Math.PI) * len * 0.11 * (1 - up) + u * u * len * 0.1 + sway;
      } else {
        x = fx + 2 + u * len * 0.9 + sway * 0.3;
        y = fy - 1.5 + up * u * len * 0.9 - u * u * len * 0.1 + sway;
      }
      pts.push([x, y]);
    }
    for (let k = 1; k < pts.length; k++) g.line(...pts[k - 1], ...pts[k], typeof A.col === "function" ? hex(A.col(k / 10)) : c, a * (A.alpha ?? 0.95));
  }
  // antennules: two short stalks pointing forward, flicking
  const an = S.antennules, ac = an.col ? hex(an.col) : c;
  for (const dy of [-0.6, 0.9]) {
    const fl = Math.sin(ph * 3 + dy) * 0.5;
    g.line(fx + 1, fy + dy, fx + 2 + an.len, fy + dy - 1.5 - fl - (dy > 0 ? -2.2 : 0), ac, a);
  }
}
