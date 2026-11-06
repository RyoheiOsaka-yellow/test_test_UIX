// The big-fish kit: one body plan for sharks, tunas, sunfish and whales. A fish faces right, its origin at
// the middle of the body on the midline. Species pass a spec: the body's profile, which fins it has and
// where, a skin(u, v, x, y) -> ramp (u 0 nose .. 1 tail base, v -1 back .. 1 belly), and how it swims
// ("fish": the tail fin sweeps in and out of view; "whale": the tail stock and flukes beat up and down).

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);
const call = (v, ...a) => (typeof v === "function" ? v(...a) : v);

export const BASE = {
  L: 56, // nose to tail base
  H: 11, // half-height at the deepest point
  peak: 0.38, // where the body is deepest (0 nose .. 1 tail)
  nose: 0.5, // 0 a sharp point .. 1 a blunt round nose
  stock: 0.14, // tail stock half-height as a fraction of H
  bellyK: 1.0, // belly depth as a fraction of the back's
  tail: { kind: "fork", span: 12, len: 10 },
  dorsal: [{ u: 0.45, h: 8, w: 12, kind: "tri" }],
  pectoral: { u: 0.3, len: 12, w: 4, angle: 0.5 },
  pelvic: null,
  anal: null,
  finlets: 0,
  eye: { u: 0.1, v: -0.25, r: 1.2 },
  mouth: { len: 7, open: 0 },
  gills: 0,
  swim: { kind: "fish", amp: 1 },
  alpha: 1,
};

/** Draw a fish into g at local time t of loop D. Returns the body's extent. */
export function drawFish(g, spec, t, D, seed = 1) {
  const S = { ...BASE, ...spec };
  const ph = (t / D) * TAU, a = S.alpha, L = S.L, H = S.H;
  const skin = S.skin ?? (() => ["#101828", "#203858", "#4878a0", "#90b8d0", "#e0f0f8"]);
  const whale = S.swim.kind === "whale";
  // the profile: back and belly curves, 0..1 of H
  const back = S.back ?? ((u) => (u < S.peak ? Math.pow(Math.sin((Math.PI / 2) * (u / S.peak)), 0.45 + 0.9 * (1 - S.nose)) : 1 - Math.pow((u - S.peak) / (1 - S.peak), 1.6) * (1 - S.stock)));
  const belly = S.belly ?? ((u) => S.bellyK * (u < S.peak * 1.1 ? Math.pow(Math.sin((Math.PI / 2) * Math.min(1, u / (S.peak * 1.1))), 0.4 + 0.8 * (1 - S.nose)) : 1 - Math.pow((u - S.peak * 1.1) / (1 - S.peak * 1.1), 1.5) * (1 - S.stock)));
  // swimming: a whale's tail beats up and down; a fish's body flexes a touch and its tail fin sweeps
  const wave = (u) => (whale ? S.swim.amp * 3.5 * Math.sin(ph * 2 - u * 2.2) * u * u : S.swim.amp * 0.8 * Math.sin(ph * 2 - u * 3) * u * u);
  const xOf = (u) => L / 2 - u * L;
  const uOf = (x) => clamp((L / 2 - x) / L);
  const col = (u, v, x, y, d = 3, k = 0) => pick(R5(skin(u, v, x, y)), v * 0.9 - 0.1, d, k);
  const mid = (u) => R5(skin(u, 0, xOf(u), 0))[2], dark = (u) => R5(skin(u, 0.2, xOf(u), 0))[1];
  const finCol = (u, v, kind) => (S.finSkin ? R5(S.finSkin(u, v, kind)) : R5(skin(u, v, xOf(u), 0)));

  // ---- fins behind the body: the far pectoral, pelvic, the tail if it sweeps away
  const tailBase = { x: xOf(1), y: wave(1), b: H * S.stock };
  const tailSweep = whale ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(ph * 2 + 0.6));
  drawTail(g, S, tailBase, tailSweep, ph, finCol, a);
  pectoral(g, S, xOf, back, belly, wave, ph, finCol, a, true);
  if (S.pelvic) smallFin(g, S, S.pelvic, xOf, belly, wave, finCol, a, "pelvic");

  // ---- the body
  g.shade(xOf(1) - 1, -H - 6, xOf(0) + 2, H + 6, (x, y, o) => {
    const u = uOf(x);
    if (x > xOf(0) + 0.5 || x < xOf(1) - 0.5) return 0;
    const yy = y - wave(u), top = -H * back(u), bot = H * belly(u);
    if (yy < top || yy > bot) return 0;
    const v = yy < 0 ? yy / -top : yy / bot;
    o.a = a; o.t = 1;
    const edge = yy < top + 1 || yy > bot - 1 ? 1 : 3;
    return col(u, v, x, yy, edge);
  });
  // gill slits, the mouth, the eye
  for (let i = 0; i < S.gills; i++) {
    const u = (S.gillU ?? 0.2) + i * 0.035, x = xOf(u);
    g.line(x, wave(u) - H * back(u) * 0.35, x - 1.5, wave(u) + H * belly(u) * 0.45, dark(u), a, 1);
  }
  if (S.mouth) {
    const m = S.mouth, open = call(m.open, ph), x0 = xOf(0) - 0.5, y0 = wave(0) + (m.v ?? 0.25) * H * belly(0.02);
    g.line(x0, y0, x0 - m.len, y0 + (m.drop ?? 1.5), dark(0.05), a, 1);
    if (open > 0.05) {
      g.poly([[x0, y0], [x0 - m.len * 0.9, y0 + 1], [x0 - m.len * 0.6, y0 + 1 + open * 4], [x0 - 0.5, y0 + open * 3]], S.mouthCol ? hex(S.mouthCol) : hex("#2a0c14"), a, 1);
      if (m.teeth) for (let k = 0; k < m.len * 0.8; k += 2) g.set(x0 - 1 - k, y0 + 0.8 + (k % 4 ? 0 : 0.5), hex("#ffffff"), a, 1);
    }
  }
  if (S.eye) {
    const e = S.eye, ex = xOf(e.u), ey = wave(e.u) + e.v * H * (e.v < 0 ? back(e.u) : belly(e.u)), r = e.r;
    g.ellipse(ex, ey, r + 0.6, r + 0.6, hex(e.ring ?? "#f0f0f0"), a, 1);
    g.ellipse(ex + 0.3, ey, r, r, hex("#0a0810"), a, 1);
    if (r >= 1.5) g.set(ex + r * 0.3, ey - r * 0.4, hex("#ffffff"), a, 1);
  }
  // ---- fins in front: dorsal(s), near pectoral, anal, finlets, extras
  for (const d of [].concat(S.dorsal ?? [])) dorsal(g, S, d, xOf, back, wave, ph, finCol, a);
  if (S.anal) smallFin(g, S, S.anal, xOf, belly, wave, finCol, a, "anal");
  if (S.finlets) {
    for (let i = 0; i < S.finlets; i++) {
      const u = 0.72 + (i * 0.2) / S.finlets, x = xOf(u);
      const c = S.finletCol ? hex(S.finletCol) : finCol(u, -0.8, "finlet")[3];
      g.poly([[x, wave(u) - H * back(u)], [x - 1.5, wave(u) - H * back(u) - 2.2], [x - 2.5, wave(u) - H * back(u) + 0.2]], c, a, 1);
      g.poly([[x, wave(u) + H * belly(u)], [x - 1.5, wave(u) + H * belly(u) + 2.2], [x - 2.5, wave(u) + H * belly(u) - 0.2]], c, a, 1);
    }
  }
  pectoral(g, S, xOf, back, belly, wave, ph, finCol, a, false);
  if (S.extra) S.extra(g, t, { L, H, xOf, uOf, back, belly, wave, ph, tailBase });

  const O = R5(skin(0.4, 0.6, 0, 0));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { x0: xOf(1) - (S.tail?.len ?? 0), x1: xOf(0) + (S.mouth?.len ?? 0), y0: -H - 10, y1: H + 8 };
}

function drawTail(g, S, base, sweep, ph, finCol, a) {
  const T = S.tail;
  if (!T || T.kind === "none") return;
  const { x, y, b } = base, len = T.len, span = T.span * sweep, c = (v) => finCol(1, v, "tail");
  const P = (dx, dy) => [x - dx, y + dy];
  let pts;
  if (T.kind === "fork") pts = [P(0, -b), P(len, -span), P(len * 0.55, 0), P(len, span), P(0, b)];
  else if (T.kind === "crescent") pts = [P(0, -b), P(len * 0.45, -span), P(len, -span * 1.05), P(len * 0.3, 0), P(len, span * 1.05), P(len * 0.45, span), P(0, b)];
  else if (T.kind === "shark") pts = [P(0, -b), P(len * 0.5, -span * 0.9), P(len, -span), P(len * 0.75, -span * 0.35), P(len * 0.55, 0.5), P(len * 0.7, span * 0.55), P(len * 0.3, span * 0.5), P(0, b)];
  else if (T.kind === "round") pts = [P(0, -b), P(len * 0.5, -span), P(len, -span * 0.6), P(len * 1.05, 0), P(len, span * 0.6), P(len * 0.5, span), P(0, b)];
  else if (T.kind === "fluke") {
    // seen from the side: a flat blade, tilting as the tail stock beats
    const tilt = S.swim.amp * 2.2 * Math.cos(ph * 2 - 2.2);
    pts = [P(0, -b), P(len * 0.6, -b * 0.6 - tilt * 0.5), P(len, -1.2 - tilt), P(len * 1.1, 0.2 - tilt), P(len, 1.6 - tilt * 0.8), P(len * 0.6, b * 0.8 - tilt * 0.4), P(0, b)];
  } else if (T.kind === "clavus") {
    pts = [P(0, -b)];
    for (let i = 0; i <= 8; i++) pts.push(P(len * (0.8 + 0.3 * (i % 2)), -b + ((2 * b) * i) / 8));
    pts.push(P(0, b));
  }
  g.poly(pts, (px, py) => c(clamp((py - y) / Math.max(1, span)))[py < y ? 3 : 2], a, 1);
  // rays
  if (T.rays !== false) for (let k = 1; k < 4; k++) {
    const v = (k / 4) * 2 - 1;
    g.line(x - 1, y + v * b * 0.6, x - len * 0.8, y + v * span * 0.8, c(v)[1], a * 0.8, 1);
  }
}

function dorsal(g, S, d, xOf, back, wave, ph, finCol, a) {
  if (!d || d.kind === "none") return;
  const x = xOf(d.u), y0 = wave(d.u) - S.H * back(d.u) + 0.5;
  const c = d.col ? R5(d.col) : finCol(d.u, -0.8, "dorsal");
  const flap = d.kind === "sail" ? 0.85 + 0.15 * Math.sin(ph) : 1;
  let pts;
  if (d.kind === "tri") pts = [[x + d.w * 0.5, y0], [x + d.w * 0.15, y0 - d.h], [x - d.w * 0.5, y0]];
  else if (d.kind === "falcate") pts = [[x + d.w * 0.5, y0], [x + d.w * 0.35, y0 - d.h * 0.7], [x + d.w * 0.05, y0 - d.h], [x - d.w * 0.2, y0 - d.h * 0.85], [x - d.w * 0.5, y0]];
  else if (d.kind === "sail") {
    pts = [[x + d.w * 0.5, y0]];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      pts.push([x + d.w * 0.5 - d.w * u, y0 - d.h * flap * Math.sin(Math.PI * Math.pow(u, 0.7)) * (0.5 + 0.5 * (1 - u * 0.4))]);
    }
    pts.push([x - d.w * 0.5, y0]);
  } else if (d.kind === "ridge") pts = [[x + d.w * 0.5, y0], [x + d.w * 0.3, y0 - d.h], [x - d.w * 0.3, y0 - d.h * 0.8], [x - d.w * 0.5, y0]];
  else if (d.kind === "lobe") pts = [[x + d.w * 0.5, y0], [x + d.w * 0.4, y0 - d.h * 0.6], [x, y0 - d.h], [x - d.w * 0.4, y0 - d.h * 0.6], [x - d.w * 0.5, y0]];
  g.poly(pts, (px, py) => (py < y0 - d.h * 0.5 ? c[3] : c[2]), a, 1);
  if (d.rays) for (let k = 1; k < d.rays; k++) {
    const u = k / d.rays, px = x + d.w * 0.5 - d.w * u;
    g.line(px, y0 - 1, px - 1, y0 - d.h * flap * Math.sin(Math.PI * Math.pow(u, 0.7)) * 0.9, c[1], a * 0.7, 1);
  }
}

function pectoral(g, S, xOf, back, belly, wave, ph, finCol, a, far) {
  const P = S.pectoral;
  if (!P) return;
  const u = P.u, x = xOf(u), y = wave(u) + (P.v ?? 0.45) * S.H * belly(u) + (far ? -2 : 0);
  const flap = P.flap ?? 0.2, ang = P.angle + flap * Math.sin(ph * 2 + (far ? Math.PI : 0)), len = P.len * (far ? 0.9 : 1);
  const c = finCol(u, 0.3, "pectoral");
  const tip = [x - Math.cos(ang) * len, y + Math.sin(ang) * len];
  const w = P.w;
  const pts = [[x + 1, y - 1], [tip[0] + Math.sin(ang) * w * 0.3, tip[1] + Math.cos(ang) * w * 0.2 - w * 0.6], [tip[0] - 1, tip[1] + 0.5], [x - w * 0.5, y + w * 0.9], [x - 1, y + 1]];
  g.poly(pts, (px, py) => (far ? mix(c[1], hex("#0a1a34"), 0.35) : py < y + 1 ? c[3] : c[2]), a, far ? 1 : 1);
  if (!far) g.line(x, y, tip[0] + 1, tip[1] - 0.5, c[1], a * 0.7, 1);
}

function smallFin(g, S, F, xOf, belly, wave, finCol, a, kind) {
  const x = xOf(F.u), y = wave(F.u) + S.H * belly(F.u) - 0.5;
  const c = F.col ? R5(F.col) : finCol(F.u, 0.8, kind);
  g.poly([[x + F.w * 0.5, y], [x + F.w * 0.1, y + F.h], [x - F.w * 0.5, y]], (px, py) => (py > y + F.h * 0.5 ? c[2] : c[3]), a, 1);
}

/** A whale's blow: a puff of spray rising from (x, y) for the first quarter of the loop. */
export function blow(p, x, y, t, D, lean = 0, h = 8) {
  const u = (t / D) % 1, k = u < 0.28 ? Math.sin((Math.PI * u) / 0.28) : 0;
  if (k <= 0) return;
  for (let i = 0; i < 7; i++) {
    const s = i / 7;
    p.dot(x + lean * s * h + (i % 2) * 1.5 - 0.5, y - s * h * (0.6 + k) - 1, hex("#d8ecff"), 0.55 * k * (1 - s * 0.6));
    p.dot(x + lean * s * h - (i % 3) + 1, y - s * h * (0.5 + k), hex("#ffffff"), 0.3 * k * (1 - s));
  }
  p.glow(x, y - h * 0.5, 6, hex("#c8e4ff"), 0.15 * k);
}

/** The light from the surface: a soft sheen across the top of the frame and shafts slanting down. */
export function surfaceLight(p, t, D, x0, x1, y, col, k = 0.08) {
  const ph = (t / D) * TAU;
  p.glowLine(x0, y, x1, y, 12, col, k);
  for (const [sx, w, off] of [[x0 + (x1 - x0) * 0.25, 7, 0], [x0 + (x1 - x0) * 0.6, 5, 2], [x0 + (x1 - x0) * 0.85, 8, 4]]) {
    const sw = Math.sin(ph + off) * 3;
    p.glowLine(sx + sw - 6, y, sx + sw + 4, y + 40, w, col, k * 0.5);
  }
}
