// The cephalopod kit: squids, cuttlefish and octopuses. A squid faces right: mantle to the left, head and
// arms to the right, fins at the tail or along the mantle. An octopus sits with its mantle up and back,
// eyes below it, eight arms spreading and curling around. Skin is a pattern(u, v, x, y, t) -> ramp, so
// chromatophores can flicker and bands can flash across the body.

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale, rand } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);

/**
 * One arm from (x, y) heading ang (radians, screen space: 0 right, positive down), L long, r0 thick at the
 * base. opts: { curl (how much it coils toward the tip, radians), wave (ripple amplitude), phase, k (sway),
 * seed, suckers (color for a row of suckers on the inner side), cols, a, tag, taper, club (a paddle at the
 * tip, for tentacles) }. Returns the points.
 */
export function arm(g, x, y, ang, L, r0, t, D, opts = {}) {
  const { curl = 1.2, wave = 0.4, phase = 0, k = 1, seed = 1, suckers = null, cols = ["#3a1a10", "#7a3a20", "#b86a40", "#e0a070", "#ffd0a0"], a = 1, tag = 1, taper = 0.85, club = 0, n = 14 } = opts;
  const C = R5(cols), ph = (t / D) * TAU, pts = [];
  let px = x, py = y, an = ang;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([px, py]);
    const bend = curl * Math.pow(u, 1.4) * (1 / n) * 2.2 + (wave * Math.sin(u * 5 - ph * 2 + phase) * 0.35 + lnoise(t, D, 2, phase + u, seed) * 0.25 * k) * (1 / n) * 3;
    an += bend;
    px += Math.cos(an) * (L / n);
    py += Math.sin(an) * (L / n);
  }
  g.tube(pts, (u) => Math.max(0.5, r0 * Math.pow(1 - u, taper) + (club && u > 0.85 ? club : 0)), (u, d) => (d > 0.7 ? C[1] : u > 0.7 ? C[3] : C[2]), a, tag);
  if (suckers) {
    const S = hex(suckers);
    for (let i = 1; i < n; i += 1) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const rr = r0 * Math.pow(1 - i / n, taper);
      if (rr < 0.8) break;
      // suckers sit on the inner (curling) side
      const sgn = curl >= 0 ? 1 : -1;
      g.set(ax + (-dy / len) * rr * 0.9 * sgn, ay + (dx / len) * rr * 0.9 * sgn, S, a, tag);
    }
  }
  return pts;
}

/**
 * A squid or cuttlefish at local time t of loop D. spec: { L (mantle length), H (half-height), shape
 * "torpedo" | "oval" | "round", fins: { kind: "tail" | "ribbon" | "ear", len, h }, head: { r }, eye: { r, w
 * (W-shaped pupil for cuttlefish) }, arms: { n, L, r, curl, suckers }, tentacles: { L, r, club } | null,
 * skin(u, v, x, y, t) -> ramp (u 0 tail .. 1 opening, v -1 top .. 1 belly), finSkin, jet (0..1 amount of
 * jetting right now), alpha, outline, lit, extra(g, t, S) }.
 */
export function drawSquid(g, spec, t, D, seed = 1) {
  const S = { L: 40, H: 7, shape: "torpedo", alpha: 1, ...spec };
  const ph = (t / D) * TAU, a = S.alpha, L = S.L, H = S.H;
  const skin = S.skin ?? (() => ["#4a2a30", "#8a4a58", "#c08090", "#e8b8c0", "#fff0f0"]);
  const prof = S.profile ?? ((u) => (S.shape === "torpedo" ? Math.pow(Math.sin(Math.PI * Math.pow(u, 0.55)), 0.45) * (u > 0.85 ? 1 : 1) : S.shape === "oval" ? Math.sqrt(Math.max(0, 1 - ((u - 0.5) * 2) ** 2)) : Math.sqrt(Math.max(0, 1 - ((u - 0.5) * 2) ** 2))));
  const xOf = (u) => -L / 2 + u * L, uOf = (x) => clamp((x + L / 2) / L);
  const top = (u) => -H * prof(u), bot = (u) => H * prof(u) * (S.bellyK ?? 1);
  const F = S.fins ?? { kind: "tail", len: 16, h: 9 }, FC = R5(S.finSkin ?? skin(0.1, -0.5, xOf(0.1), 0, t));
  // fins behind the mantle first
  if (F.kind === "tail") {
    const x0 = xOf(0), flap = Math.sin(ph * 2) * 1.5;
    g.poly([[x0 - 1, 0], [x0 + F.len * 0.35, -F.h - flap], [x0 + F.len, -top(F.len / L) * 0.2 - 0.5], [x0 + F.len * 0.5, 0]], (x, y) => (y < -F.h * 0.5 ? FC[3] : FC[2]), a, 1);
    g.poly([[x0 - 1, 0], [x0 + F.len * 0.35, F.h + flap], [x0 + F.len, bot(F.len / L) * 0.2 + 0.5], [x0 + F.len * 0.5, 0]], (x, y) => (y > F.h * 0.5 ? FC[1] : FC[2]), a, 1);
  } else if (F.kind === "ribbon") {
    const u0 = F.from ?? 0.02, u1 = F.to ?? 0.95, tp = [], bp = [];
    for (let i = 0; i <= 16; i++) {
      const u = u0 + (u1 - u0) * (i / 16), x = xOf(u), w = F.h * Math.sin(Math.PI * (i / 16)) ** 0.6 * (1 + 0.35 * Math.sin(x * 0.5 - ph * 2));
      tp.push([x, top(u) - w]); bp.push([x, bot(u) + w]);
    }
    const stripe = (x) => ((Math.round(x - (t / D) * 8) % 4) + 4) % 4 === 0;
    g.poly([[xOf(u0), top(u0)], ...tp, [xOf(u1), top(u1)]], (x, y) => (stripe(x) ? FC[2] : FC[3]), a, 1);
    g.poly([[xOf(u0), bot(u0)], ...bp, [xOf(u1), bot(u1)]], (x, y) => (stripe(x) ? FC[1] : FC[2]), a, 1);
  } else if (F.kind === "ear") {
    const u = F.at ?? 0.45, x = xOf(u), flap = Math.sin(ph * 2) * 2;
    g.ellipse(x, top(u) - F.h * 0.5 - flap * 0.5, F.len * 0.5, F.h * 0.6 + flap * 0.3, (nx, ny) => (ny < -0.2 ? FC[3] : FC[2]), a, 1);
  }
  // the mantle
  g.shade(xOf(0) - 1, -H - 2, xOf(1) + 1, H + 2, (x, y, o) => {
    const u = uOf(x);
    if (x < xOf(0) - 0.5 || x > xOf(1) + 0.5) return 0;
    const tp = top(u), bt = bot(u);
    if (y < tp || y > bt) return 0;
    const v = y < 0 ? y / -Math.max(0.5, tp) : y / Math.max(0.5, bt);
    o.a = a; o.t = 1;
    return pick(R5(skin(u, v, x, y, t)), v * 0.9 - 0.1, y < tp + 1 || y > bt - 1 ? 1 : 3);
  });
  // the head: a short round section past the mantle opening, with the eye
  const hd = S.head ?? { r: H * 0.75 }, hx = xOf(1) + hd.r * 0.7, hy = 0.5;
  g.ellipse(hx, hy, hd.r * 1.05, hd.r, (nx, ny) => pick(R5(skin(1, ny, hx + nx * hd.r, hy + ny * hd.r, t)), ny * 0.9 - 0.1, Math.hypot(nx, ny) > 0.85 ? 1 : 3), a, 1);
  const E = S.eye ?? { r: 2 }, ex = hx + hd.r * 0.15, ey = hy - hd.r * 0.1;
  g.ellipse(ex, ey, E.r + 0.8, E.r + 0.8, hex(E.ring ?? "#e8e8f0"), a, 1);
  g.ellipse(ex, ey, E.r, E.r, hex(E.iris ?? "#141418"), a, 1);
  if (E.w) { g.line(ex - E.r * 0.8, ey, ex + E.r * 0.8, ey, hex("#0a0810"), a, 1); g.set(ex - E.r * 0.5, ey - 1, hex("#0a0810"), a, 1); g.set(ex + E.r * 0.5, ey - 1, hex("#0a0810"), a, 1); }
  else g.set(ex + E.r * 0.3, ey - E.r * 0.4, hex("#ffffff"), a, 1);
  // the siphon under the head
  g.tube([[xOf(1) + 1, bot(0.98) * 0.6], [xOf(1) + 4 + (S.jet ?? 0) * 2, bot(0.98) * 0.8 + 1.5]], 1.1, (u, d) => (d > 0.7 ? R5(skin(1, 0.8, 0, 0, t))[1] : R5(skin(1, 0.8, 0, 0, t))[2]), a, 1);
  // arms: a fan from the front of the head, the far ones first and dim
  const A = S.arms ?? { n: 8, L: 18, r: 1.8, curl: 0.6, suckers: null }, ax = hx + hd.r * 0.85, ay = hy;
  const armCols = S.armSkin ?? skin(1, 0.2, ax, ay, t), farCols = R5(armCols).map((c) => mix(c, hex("#000000"), 0.35));
  const order = [];
  for (let i = 0; i < A.n; i++) order.push(i);
  for (const i of order) {
    const s = (i / Math.max(1, A.n - 1)) * 2 - 1, far = i % 2 === 0;
    arm(g, ax - 1, ay + s * hd.r * 0.7, s * 0.55 + 0.05, A.L * (0.8 + 0.2 * Math.abs(s)), A.r, t, D, { curl: s * A.curl, wave: 0.6, phase: i * 0.8, seed: seed + i, suckers: far ? null : A.suckers, cols: far ? farCols : armCols, a, taper: 0.8 });
  }
  if (S.tentacles) {
    const T = S.tentacles;
    for (const s of [-0.25, 0.25]) arm(g, ax, ay + s * hd.r, s * 0.4, T.L, T.r, t, D, { curl: s * 0.3, wave: 0.5, phase: s * 3, seed: seed + 20, cols: armCols, a, taper: 0.4, club: T.club ?? 1.2, n: 18 });
  }
  if (S.extra) S.extra(g, t, { L, H, xOf, uOf, top, bot, ph, hx, hy, ax, ay });
  const O = R5(skin(0.5, 0.7, 0, 0, t));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { x0: xOf(0) - 2, x1: ax + A.L + (S.tentacles?.L ?? 0), y0: -H - (F.h ?? 0) - 2, y1: H + (F.h ?? 0) + 2 };
}

/**
 * An octopus at local time t of loop D. spec: { R (mantle radius), tilt (mantle lean, radians), head: { r },
 * eye: { r }, arms: [{ ang, L, r, curl, wave }...] or { n, L, r, curl, spread }, skin(u, v, x, y, t) -> ramp,
 * suckers (color), papillae (0..1 bumpiness), breathe (mantle swell amplitude), alpha, outline, lit,
 * extra(g, t, S), fins: { len, h } (ear fins for deep-sea octopuses) }. The origin is the center of the
 * head, where the arms meet; the mantle rises above and behind it.
 */
export function drawOctopus(g, spec, t, D, seed = 1) {
  const S = { R: 11, tilt: -0.15, alpha: 1, breathe: 0.05, papillae: 0.1, ...spec };
  const ph = (t / D) * TAU, a = S.alpha;
  const skin = S.skin ?? (() => ["#3a1a10", "#7a3a20", "#b86a40", "#e0a070", "#ffd0a0"]);
  const R = S.R * (1 + S.breathe * Math.sin(ph));
  const hd = S.head ?? { r: S.R * 0.55 };
  const mx = -Math.sin(S.tilt) * (R + hd.r * 0.4), my = -Math.cos(S.tilt) * (R * 0.75 + hd.r * 0.5);
  // arms behind: the even ones, dim; then mantle and head; then the arms in front
  let arms = S.arms;
  if (!Array.isArray(arms)) {
    const A = { n: 8, L: 26, r: 2.4, curl: 1.4, spread: 1 };
    Object.assign(A, arms ?? {});
    arms = [];
    for (let i = 0; i < A.n; i++) {
      const s = (i / Math.max(1, A.n - 1)) * 2 - 1, ang = -0.35 + (i / Math.max(1, A.n - 1)) * (Math.PI + 0.7);
      arms.push({ ang: ang * A.spread + (1 - A.spread) * (Math.PI / 2), L: A.L * (0.8 + 0.2 * Math.abs(s)), r: A.r, curl: s * A.curl * (0.5 + 0.5 * Math.abs(s)) + (Math.abs(s) < 0.3 ? (i % 2 ? 0.6 : -0.6) : 0), wave: 0.5, far: i % 2 === 0 });
    }
  }
  const armCols = S.armSkin ?? skin(0.5, 0.5, 0, 0, t), farCols = R5(armCols).map((c) => mix(c, hex("#000000"), 0.35));
  const drawArms = (far) => arms.forEach((ar, i) => {
    if (!!ar.far !== far) return;
    arm(g, Math.cos(ar.ang) * hd.r * 0.7, Math.max(0, Math.sin(ar.ang)) * hd.r * 0.5 + hd.r * 0.4 + (far ? -1.5 : 0), ar.ang, ar.L, ar.r, t, D, { curl: ar.curl, wave: ar.wave ?? 0.5, phase: i * 0.9, seed: seed + i, suckers: far ? null : S.suckers ?? null, cols: far ? farCols : armCols, a, taper: 0.85 });
  });
  drawArms(true);
  if (S.fins) {
    const flap = Math.sin(ph * 2) * 2;
    for (const s of [-1, 1]) g.ellipse(mx + s * R * 0.75, my - R * 0.35 - flap * 0.4, S.fins.len * 0.5, S.fins.h * 0.5 + flap * 0.2, (nx, ny) => (ny < -0.2 ? R5(skin(0.5, -0.8, 0, 0, t))[3] : R5(skin(0.5, -0.8, 0, 0, t))[2]), a, 1);
  }
  // the mantle: a bag, lit from above, with papillae
  g.ellipse(mx, my, R * (S.wide ?? 0.9), R, (nx, ny) => {
    const rx = nx * Math.cos(S.tilt) - ny * Math.sin(S.tilt), ry = nx * Math.sin(S.tilt) + ny * Math.cos(S.tilt);
    const ramp = R5(skin(0.5 + rx * 0.5, ry, mx + nx * R, my + ny * R, t));
    const bump = S.papillae > 0 && rand(Math.round(mx + nx * R), Math.round(my + ny * R), 70) < S.papillae ? 0.8 : 0;
    return pick(ramp, ry * 0.9 - 0.1 - bump, Math.hypot(nx, ny) > 0.86 ? 1 : 3);
  }, a, 1);
  // the head: eyes bulging out on each side, horizontal pupils
  g.ellipse(0, 0, hd.r * 1.25, hd.r, (nx, ny) => pick(R5(skin(0.5, ny, nx * hd.r, ny * hd.r, t)), ny * 0.9 - 0.1, Math.hypot(nx, ny) > 0.85 ? 1 : 3), a, 1);
  const E = S.eye ?? { r: 2 }, ex = hd.r * 0.55, ey = -hd.r * 0.35;
  g.ellipse(ex, ey, E.r + 1, E.r + 0.8, R5(skin(0.5, -0.3, ex, ey, t))[3], a, 1);
  g.ellipse(ex, ey, E.r + 0.3, E.r, hex(E.ring ?? "#e0c080"), a, 1);
  g.line(ex - E.r * 0.8, ey, ex + E.r * 0.8, ey, hex("#0a0810"), a, 1);
  if (E.r > 1.6) g.line(ex - E.r * 0.8, ey + 1, ex + E.r * 0.8, ey + 1, hex("#0a0810"), a, 1);
  // the siphon: a short funnel under the head, puffing
  const jet = 0.5 + 0.5 * Math.sin(ph);
  g.tube([[-hd.r * 0.3, hd.r * 0.6], [-hd.r * 0.9 - jet, hd.r * 1.1]], 1.2, (u, d) => (d > 0.7 ? R5(armCols)[1] : R5(armCols)[2]), a, 1);
  drawArms(false);
  if (S.extra) S.extra(g, t, { R, mx, my, hd, ph, arms });
  const O = R5(skin(0.5, 0.7, 0, 0, t));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { x0: -30, x1: 30, y0: my - R - 2, y1: 20 };
}

/** Chromatophores: a speckle that flickers over time, for skin() patterns. Returns true where a spot is open. */
export const spots = (x, y, t, density = 0.2, rate = 3, seed = 0) => rand(Math.round(x), Math.round(y), Math.floor(t * rate) + seed) < density;
