// The nudibranch kit: two body plans. A dorid (Chromodoris, Jorunna, Hexabranchus...) is a mantle like a
// flattened dome over a foot, with two rhinophores in front and a rosette of gills behind. An aeolid
// (Flabellina, Glaucus, Hermissenda...) is a slender body bristling with cerata. Both face right, origin at
// the body's center on the foot line. Species pass a spec: sizes, skin(u, v, x, y) -> ramp (u 0 head .. 1
// tail, v -1 back ridge .. 1 mantle edge), margin bands, rhinophore and gill colors.

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);

/** A rhinophore: a ringed club on a short stalk at (x, y), h tall, leaning back by lean (px at the tip). */
export function rhinophore(g, x, y, h, lean, ramp, a = 1, sheath = null) {
  const C = R5(ramp), pts = [[x, y], [x + lean * 0.4, y - h * 0.5], [x + lean, y - h]];
  g.tube(pts, (u) => (u < 0.3 ? 0.6 : 0.9 + 0.35 * Math.sin((u - 0.3) / 0.7 * Math.PI)), (u, d) => (u > 0.3 && Math.round(u * h) % 2 === 0 ? C[2] : d > 0.7 ? C[1] : C[3]), a, 7);
  g.set(x + lean, y - h, C[4], a, 7);
  if (sheath) {
    const S = R5(sheath);
    g.tube([[x - 0.5, y + 0.5], [x + lean * 0.25, y - h * 0.3]], 1.1, (u, d) => (d > 0.7 ? S[1] : S[3]), a, 7);
  }
}

/** A gill plume: n feathery branches fanning up from (x, y), r long, pulsing by k (1 at rest). */
export function gills(g, x, y, n, r, ramp, k = 1, a = 1, spread = 1) {
  const C = R5(ramp);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI * 0.5 + ((i - (n - 1) / 2) / Math.max(1, n - 1)) * Math.PI * 0.85 * spread, L = r * k * (0.85 + 0.15 * Math.abs(Math.sin(i * 1.7)));
    const ex = x + Math.cos(ang) * L, ey = y + Math.sin(ang) * L * 0.9;
    g.line(x, y, ex, ey, (u) => (u > 0.75 ? C[4] : C[2]), a, 7);
    // pinnae: little side branches
    for (let s = 0.3; s < 0.95; s += 0.22) {
      const px = x + Math.cos(ang) * L * s, py = y + Math.sin(ang) * L * s * 0.9;
      g.set(px + Math.cos(ang + 1.3) * 1.2, py + Math.sin(ang + 1.3) * 1.2, C[3], a, 7);
      g.set(px + Math.cos(ang - 1.3) * 1.2, py + Math.sin(ang - 1.3) * 1.2, C[3], a, 7);
    }
  }
  g.set(x, y, C[1], a, 7);
}

/**
 * A dorid at local time t of loop D. spec: { L, H (mantle half-height), hump (how domed), foot (foot strip
 * height), skin(u, v, x, y) -> ramp, margin: [[width px, ramp], ...] from the edge inward, rhino: { x
 * (fraction of L from the front), h, col, sheath }, gill: { x (fraction from the rear), n, r, col } | null,
 * bumps(x, y, u, v) -> ramp | 0 (tubercles), extra(g, t, S) (anything before the outline), outline, lit }.
 * Returns the mantle extent.
 */
export function drawDorid(g, spec, t, D, seed = 1) {
  const S = { L: 36, H: 8, hump: 0.3, foot: 2, alpha: 1, ...spec };
  const ph = (t / D) * TAU, crawl = S.crawl ?? 1;
  // crawling: the body stretches forward and gathers, the foot rippling underneath
  const stretch = 1 + 0.035 * Math.sin(ph) * crawl, L = S.L * stretch, H = S.H, hx = 0.2 * Math.sin(ph) * crawl;
  // the side profile: a dome rising H above the foot line (y = 0), fuller toward the head, the mantle skirt
  // hanging a little below it; u runs -1 (tail) .. 1 (head)
  const uu = (x) => (2 * (x - hx)) / L;
  const top = (u) => -H * Math.pow(Math.max(0, 1 - u * u), S.dome ?? 0.5) * (1 + 0.1 * u) - (S.flat ?? 0);
  const bot = (u) => H * 0.28 * Math.sqrt(Math.max(0, 1 - u * u));
  const skin = S.skin ?? (() => ["#1a1020", "#60304a", "#b05070", "#e890a0", "#ffd8e0"]);
  const a = S.alpha;
  // the foot: a darker strip under the mantle, its edge rippling as waves of muscle pass back
  const F = R5(S.footCol ?? skin(0.5, 1, 0, 0));
  g.shade(hx - L / 2 - 1, -1, hx + L / 2 + 1, H * 0.3 + S.foot + 2, (x, y, o) => {
    const u = uu(x);
    if (Math.abs(u) > 0.94) return 0;
    const ripple = 0.6 * Math.sin(x * 0.55 - ph * 2) * crawl;
    const bottom = bot(u) + S.foot * Math.sqrt(1 - u * u) + ripple;
    if (y > bottom || y < bot(u) - 1) return 0;
    o.a = a; o.t = 2;
    return y > bottom - 1 ? F[1] : F[2];
  });
  // the mantle
  g.shade(hx - L / 2 - 1, -H * 1.15 - 2, hx + L / 2 + 1, H * 0.3 + 1, (x, y, o) => {
    const u = uu(x);
    if (Math.abs(u) > 1) return 0;
    const t0 = top(u), b0 = bot(u);
    if (y < t0 || y > b0) return 0;
    const v = ((y - t0) / Math.max(0.5, b0 - t0)) * 2 - 1, ua = clamp(0.5 - u / 2);
    o.a = a; o.t = 1;
    const ramp = R5(skin(ua, v, x, y));
    // lit from above: the ridge along the back is bright, the skirt falls into shade; a hump raises the middle
    const vv = v * (1 - S.hump) + S.hump * (Math.abs(v) * 2 - 1) * 0.6;
    return pick(ramp, vv - 0.1, 3);
  });
  // margin bands from the edge inward
  if (S.margin?.length) {
    const d = g.depths(6), W = g.w;
    const bands = S.margin.map(([w, r]) => [w, R5(r)]);
    g.recolor((x, y, c, al, tag) => {
      if (tag !== 1) return c;
      const dep = d[(Math.floor(y) - g.y0) * W + (Math.floor(x) - g.x0)];
      let acc = 0;
      for (const [w, r] of bands) {
        acc += w;
        if (dep <= acc + 0.01) return pick(r, y > 0 ? 0.4 : -0.4, 3);
      }
      return c;
    });
  }
  // tubercles or speckles over the mantle
  if (S.bumps) {
    g.recolor((x, y, c, al, tag) => {
      if (tag !== 1) return c;
      const u = clamp(0.5 - uu(x) / 2), v = ((y - top(uu(x))) / Math.max(0.5, bot(uu(x)) - top(uu(x)))) * 2 - 1, r = S.bumps(x, y, u, v);
      return r ? pick(R5(r), v - 0.4, 3) : c;
    });
  }
  // rhinophores: twitching, leaning back as it crawls
  const rh = S.rhino ?? { x: 0.22, h: 6, col: ["#1a1020", "#60304a", "#b05070", "#e890a0", "#ffd8e0"] };
  for (const [k, dx] of [[0, -2.5], [1, 1]]) {
    const rx = hx + L / 2 - rh.x * L + dx, ry = top(uu(rx)) + 0.5 + (k ? 0.5 : -0.3);
    const lean = -1.2 + lnoise(t, D, 2, k * 0.5, seed) * 1.2 - 0.6 * Math.sin(ph) * crawl;
    rhinophore(g, rx, ry, rh.h * (k ? 1 : 0.9), lean, rh.col, a, rh.sheath);
  }
  // the gill rosette near the tail, pulsing
  if (S.gill !== null) {
    const gl = S.gill ?? { x: 0.22, n: 6, r: 5, col: ["#1a1020", "#60304a", "#b05070", "#e890a0", "#ffd8e0"] };
    const gx = hx - L / 2 + gl.x * L, gy = top(uu(gx)) + 0.5;
    gills(g, gx, gy, gl.n, gl.r, gl.col, 1 + 0.1 * Math.sin(ph * 2 + 1), a, gl.spread ?? 1);
  }
  if (S.extra) S.extra(g, t, { L, H, hx, ph, top, bot, uu });
  const O = R5(skin(0.5, 0.8, 0, 0));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a >= 1 ? 1 : a);
  return { x0: hx - L / 2, x1: hx + L / 2, y0: -H - 8, y1: H * 0.3 + S.foot };
}

/**
 * An aeolid at local time t of loop D. spec: { L, H (body half-height at the head), skin(u, v, x, y) -> ramp,
 * cerata: { rows (clusters along the body), per (cerata per cluster), len, col ramp | fn(i, u) -> ramp,
 * tip (fraction of the length in the tip color), fat (0 thin .. 1 leafy) }, rhino: { h, col }, oral: { len,
 * col }, extra(g, t, S), outline, lit }.
 */
export function drawAeolid(g, spec, t, D, seed = 1) {
  const S = { L: 34, H: 3.5, alpha: 1, ...spec };
  const ph = (t / D) * TAU, crawl = S.crawl ?? 1;
  const L = S.L * (1 + 0.03 * Math.sin(ph) * crawl), H = S.H;
  const skin = S.skin ?? (() => ["#3a2040", "#7a4880", "#b080b8", "#e0b8e8", "#fff0ff"]);
  const a = S.alpha;
  // the body's centerline, head at x = L/2, tail at -L/2, a slow wave along it
  const cy = (u) => 0.6 * Math.sin(u * 4 - ph) * crawl + u * u * 1.2;
  const r = (u) => H * (u < 0.12 ? Math.sqrt(u / 0.12) * 0.95 + 0.05 : 1 - ((u - 0.12) / 0.88) ** 1.4 * 0.85);
  const xOf = (u) => L / 2 - u * L;
  const CE = S.cerata ?? { rows: 6, per: 3, len: 8, col: skin(0, 0, 0, 0), tip: 0.3, fat: 0 };
  const cer = (far) => {
    for (let i = 0; i < CE.rows; i++) {
      const u = 0.14 + (0.78 * i) / Math.max(1, CE.rows - 1);
      for (let k = 0; k < CE.per; k++) {
        const kk = far ? CE.per - 1 - k : k, side = far ? -1 : 1;
        const bx = xOf(u) + (kk - (CE.per - 1) / 2) * 1.6, by = cy(u) - r(u) * 0.6 + (far ? -0.8 : 0.4);
        const len = CE.len * (0.6 + 0.4 * (1 - Math.abs(kk - (CE.per - 1) / 2) / Math.max(1, (CE.per - 1) / 2))) * (1 - 0.35 * u) * (typeof CE.lenK === "function" ? CE.lenK(i, kk) : 1);
        const sway = lnoise(t, D, 2, i * 0.3 + kk * 0.17, seed + (far ? 3 : 0)) * 1.6 + 0.5 * Math.sin(ph - i * 0.6) * crawl;
        const lean = -0.35 - 0.1 * u + (kk - (CE.per - 1) / 2) * 0.22 * side;
        const ramp = R5(typeof CE.col === "function" ? CE.col(i, kk, u) : CE.col);
        const pts = [[bx, by], [bx + lean * len * 0.5 + sway * 0.4, by - len * 0.5], [bx + lean * len + sway, by - len]];
        const fat = CE.fat ?? 0, tipAt = 1 - (CE.tip ?? 0.3);
        g.tube(pts, (v) => 0.55 + fat * 1.6 * Math.sin(v * Math.PI) * (0.6 + 0.4 * v), (v, d) => (v > tipAt ? (d > 0.6 ? ramp[3] : ramp[4]) : d > 0.7 ? ramp[1] : v > 0.4 ? ramp[3] : ramp[2]), a, 7);
        if (far) {
          // dim the far row into the water
          for (let s = 0; s <= 1; s += 0.1) {
            // handled by caller's haze; nothing here
          }
        }
      }
    }
  };
  if (S.farCerata !== false) {
    cer(true);
    g.recolor((x, y, c, al, tag) => (tag === 7 ? mix(c, hex(S.water ?? "#0a1a34"), 0.4) : c));
  }
  // the body
  g.shade(-L / 2 - 1, -H - 3, L / 2 + 2, H + 3, (x, y, o) => {
    const u = clamp((L / 2 - x) / L);
    if (x > L / 2 + 0.5 || x < -L / 2 - 0.5) return 0;
    const rr = r(u), dy = y - cy(u);
    if (Math.abs(dy) > rr) return 0;
    const v = dy / rr;
    o.a = a; o.t = 1;
    return pick(R5(skin(u, v, x, y)), v - 0.1, Math.abs(v) > 0.8 ? 1 : 3);
  });
  // head: oral tentacles forward, rhinophores up, eyes
  const O = S.oral ?? { len: 7, col: skin(0, 0, 0, 0) }, OC = R5(O.col);
  for (const dy of [-0.8, 1.2]) {
    const fl = lnoise(t, D, 2, dy, seed + 9) * 1.2;
    g.line(L / 2 - 1, cy(0.02) + dy * 0.6, L / 2 + O.len, cy(0.02) + dy * 2 - 1.5 + fl, (u) => (u > 0.7 ? OC[4] : OC[3]), a, 7);
  }
  const RH = S.rhino ?? { h: 6, col: skin(0, 0, 0, 0) };
  for (const [k, dx] of [[0, -3.5], [1, -1]]) {
    const rx = L / 2 + dx, ry = cy(0.08) - r(0.08) + 0.5;
    rhinophore(g, rx, ry, RH.h * (k ? 1 : 0.9), -1 + lnoise(t, D, 2, k, seed) * 1.2, RH.col, a, RH.sheath);
  }
  g.set(L / 2 - 2.5, cy(0.06) - r(0.06) * 0.2, hex("#0a0810"), a);
  cer(false);
  if (S.extra) S.extra(g, t, { L, H, ph, cy, r });
  const OL = R5(skin(0.5, 0.8, 0, 0));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? OL[1] : OL[0]), a >= 1 ? 1 : a);
  return { x0: -L / 2, x1: L / 2 + O.len, y0: -H - CE.len - 2, y1: H + 2 };
}
