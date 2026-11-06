// The shell kit: bivalves and snails. A bivalve is seen from the side with its hinge at the back (left) and
// its two valves opening toward the front (right), the mantle and whatever lives in the gape showing between
// them. A snail is a stack of whorls riding on a crawling foot, head and tentacles out in front. Both face
// right, origin at the hinge (bivalve) or under the shell on the foot line (snail).

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);

/**
 * A bivalve. spec: { L (hinge to lip), bulge (valve depth, px), gape (opening angle, radians, often animated),
 * skin(u, v, x, y, which) -> ramp (u 0 hinge .. 1 lip, v 0 inner edge .. 1 outer crown, which "top" | "bottom"),
 * ribs (count of radial ribs, 0 none), lines (count of growth lines, 0 none), ribCol ramp, mantle ramp
 * (shown in the gape), inside(g, S) (anything drawn in the gape before the valves close over it),
 * extra(g, t, S), outline, lit, alpha, tilt (whole shell rotated, radians) }.
 */
export function drawBivalve(g, spec, t, D, seed = 1) {
  const S = { L: 24, bulge: 9, gape: 0.35, ribs: 0, lines: 4, alpha: 1, tilt: 0, ...spec };
  const skin = S.skin ?? (() => ["#3a2a1c", "#7a5a38", "#b89060", "#e0c090", "#fff0d0"]);
  const a = S.alpha, half = S.gape / 2, cs = Math.cos(S.tilt), sn = Math.sin(S.tilt);
  const W = (x, y) => [x * cs - y * sn, x * sn + y * cs];
  // the gape: a lens of mantle between the valves
  const M = R5(S.mantle ?? ["#3a1a28", "#7a3a50", "#c06a80", "#f0a0b0", "#ffe0e8"]);
  const lip = (which) => {
    const s = which === "top" ? -1 : 1;
    return (u) => W(u * S.L * Math.cos(half), s * u * S.L * Math.sin(half));
  };
  if (S.gape > 0.02) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push(lip("top")(i / 8));
    for (let i = 8; i >= 0; i--) pts.push(lip("bottom")(i / 8));
    g.poly(pts, (x, y) => (y < 0 ? M[1] : M[2]), a, 3);
    if (S.inside) S.inside(g, { L: S.L, half, W, M, lip });
  }
  // the valves: each a lens between its inner (lip) line and an outer curve bulging away from the gape
  for (const which of ["top", "bottom"]) {
    const s = which === "top" ? -1 : 1, ang = s * half;
    const c2 = Math.cos(ang), s2 = Math.sin(ang);
    // local valve frame: X along the lip from the hinge, Y outward (positive = away from the gape)
    const toW = (X, Y) => W(X * c2 - s * Y * s2, X * s2 + s * Y * c2);
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push(toW(u * S.L, S.bulge * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8) * (0.2 + 0.8 * Math.min(1, u * 6))));
    }
    pts.push(toW(S.L, 0));
    pts.push(toW(0, 0));
    g.poly(pts, (x, y) => {
      // back to valve coordinates
      const dx = x * cs + y * sn, dy = -x * sn + y * cs;
      const X = dx * c2 + s * dy * s2, Y = (-dx * s2 + dy * c2) * s;
      const u = clamp(X / S.L), top = S.bulge * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8) * (0.2 + 0.8 * Math.min(1, u * 6));
      const v = clamp(Y / Math.max(0.5, top));
      let ramp = R5(skin(u, v, x, y, which));
      if (S.ribs && Math.round(v * S.ribs * 1.4 + u * 2) % 2 === 0) ramp = R5(S.ribCol ?? ramp.map((c) => scale(c, 0.85)));
      if (S.lines && Math.abs(((u * S.lines) % 1) - 0.5) < 0.12 && u > 0.1) return pick(ramp, 0.6, 3);
      // the crown is lit, the inner edge in shade; the top valve catches more light than the bottom one
      const vv = which === "top" ? 1 - v * 2 : v * 2 - 1;
      return pick(ramp, vv * 0.85 + (which === "top" ? -0.1 : 0.25), v > 0.85 || v < 0.1 ? 1 : 3);
    }, a, which === "top" ? 1 : 2);
  }
  if (S.extra) S.extra(g, t, { L: S.L, half, W, lip });
  const O = R5(skin(0.5, 0.5, 0, 0, "bottom"));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { x0: -2, x1: S.L + 2, y0: -S.L * Math.sin(half) - S.bulge, y1: S.L * Math.sin(half) + S.bulge };
}

/**
 * A snail. spec: { whorls: [[cx, cy, rx, ry], ...] biggest first (the body whorl), pattern(x, y, i, nx, ny) ->
 * ramp for whorl i (nx, ny the normalized offset in it), lip: [[x, y] ...] polygon of the aperture lip or
 * null, foot: { L, H, col ramp, head (px the head sticks out past the shell) }, tentacles: { len, col, eyes },
 * spines(g, S) / extra(g, t, S), outline, lit, crawl (0 still .. 1), seed }.
 */
export function drawSnail(g, spec, t, D, seed = 1) {
  const S = { crawl: 1, alpha: 1, ...spec };
  const ph = (t / D) * TAU, a = S.alpha;
  const F = S.foot ?? { L: 30, H: 4, col: ["#3a2a20", "#7a5a40", "#b09060", "#d8c090", "#f0e0c0"], head: 6 };
  const FC = R5(F.col);
  // the foot: a flat sole with waves of muscle running back along it, the head end rounder
  const fx0 = -F.L * 0.55, fx1 = F.L * 0.45 + F.head;
  g.shade(fx0 - 1, -F.H - 1, fx1 + 2, 1, (x, y, o) => {
    const u = (x - fx0) / (fx1 - fx0);
    if (u < 0 || u > 1) return 0;
    const h = F.H * (u < 0.1 ? Math.sqrt(u / 0.1) : u > 0.82 ? Math.sqrt(Math.max(0, 1 - ((u - 0.82) / 0.18) ** 2)) : 1);
    const ripple = 0.5 * Math.sin(x * 0.5 - ph * 2) * S.crawl;
    if (y < -h + ripple || y > 0) return 0;
    o.a = a; o.t = 2;
    return y > -1 ? FC[1] : y < -h + 1.2 ? FC[3] : FC[2];
  });
  // the head: two tentacles up and forward, eyes at the tips or at their base
  const T = S.tentacles ?? { len: 5, col: F.col, eyes: "tip" };
  const TC = R5(T.col), hx = fx1 - 1, hy = -F.H * 0.6;
  for (const [k, dx] of [[0, -2.5], [1, 0]]) {
    const sw = lnoise(t, D, 2, k * 0.6, seed + 3) * 1.2;
    const ex = hx + dx + T.len * 0.5 + sw * 0.4, ey = hy - T.len * (k ? 1 : 0.85) + sw * 0.5;
    g.line(hx + dx, hy, ex, ey, TC[3], a, 7);
    if (T.eyes === "tip") g.set(ex, ey, hex("#0a0810"), a, 7);
  }
  if (T.eyes === "base") { g.set(hx - 1, hy - 1, hex("#0a0810"), a, 7); }
  // the shell: whorls from the body whorl up to the apex, each shaded as a ball
  const whorls = S.whorls ?? [[-4, -10, 12, 9], [2, -19, 6, 5], [5, -24, 3, 2.5]];
  const sway = Math.sin(ph) * 0.4 * S.crawl;
  if (S.under) S.under(g, t, { ph, whorls, sway });
  whorls.forEach(([cx, cy, rx, ry], i) => {
    g.ellipse(cx + sway * i * 0.3, cy, rx, ry, (nx, ny) => {
      const ramp = R5(S.pattern ? S.pattern(cx + nx * rx, cy + ny * ry, i, nx, ny) : ["#3a2a1c", "#7a5a38", "#b89060", "#e0c090", "#fff0d0"]);
      const l = (-nx * 0.5 - ny * 0.85);
      return pick(ramp, -l * 0.9, Math.hypot(nx, ny) > 0.88 ? 1 : 3);
    }, a, 1);
  });
  // the suture lines between whorls
  for (let i = 1; i < whorls.length; i++) {
    const [cx, cy, rx, ry] = whorls[i];
    for (let x = cx - rx; x <= cx + rx; x += 0.5) {
      const y = cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * 0.95;
      const c = g.get(x, y + 0.6);
      if (c) g.set(x, y + 0.6, scale(c, 0.72), a, 1);
    }
  }
  if (S.lip) g.poly(S.lip, (x, y) => pick(R5(S.lipCol ?? ["#5a3a30", "#a06a58", "#d8a090", "#f8d0c0", "#fff0e8"]), (y - whorls[0][1]) / whorls[0][3], 3), a, 1);
  if (S.extra) S.extra(g, t, { ph, whorls, sway, hx, hy });
  const O = R5(S.pattern ? S.pattern(whorls[0][0], whorls[0][1], 0, 0, 0.5) : ["#3a2a1c", "#7a5a38", "#b89060", "#e0c090", "#fff0d0"]);
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { x0: fx0, x1: fx1 + T.len, y0: whorls[whorls.length - 1][1] - whorls[whorls.length - 1][3] - 2, y1: 1 };
}

/** Two siphons (in and out) reaching from (x, y) toward dir (radians), len long, opening and closing with k (0 shut .. 1 out). */
export function siphons(g, x, y, dir, len, k, ramp, a = 1, gap = 3) {
  const C = R5(ramp);
  if (k < 0.05) return;
  for (const s of [-1, 1]) {
    const px = x + Math.cos(dir + Math.PI / 2) * s * gap * 0.5, py = y + Math.sin(dir + Math.PI / 2) * s * gap * 0.5;
    const L = len * k * (s < 0 ? 0.85 : 1), ex = px + Math.cos(dir) * L, ey = py + Math.sin(dir) * L;
    g.tube([[px, py], [ex, ey]], 1.2, (u, d) => (u > 0.85 ? C[4] : d > 0.65 ? C[1] : C[3]), a, 7);
    g.set(ex, ey, C[0], a, 7);
  }
}

/** A rock for things that cling: a lumpy dark mound with its top at y, from x0 to x1. */
export function rock(g, x0, x1, y, h, cols, seed = 1) {
  const C = cols.map(hex), cx = (x0 + x1) / 2, rx = (x1 - x0) / 2;
  g.shade(x0, y - 1, x1, y + h, (x, yy, o) => {
    const u = (x - cx) / rx, top = y + 2.5 * Math.sin(x * 0.7 + seed) + 1.5 * Math.sin(x * 0.23 + seed * 2) - 3 * (1 - u * u);
    if (yy < top) return 0;
    o.t = 9;
    return yy < top + 1.5 ? C[2] : ((x * 7 + yy * 3 + seed) % 11 < 2 ? C[0] : C[1]);
  });
}
