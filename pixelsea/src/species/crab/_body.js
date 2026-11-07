// The crab kit: a carapace seen from the front and a little above, four pairs of jointed legs splayed to
// the sides that step in turn as it scuttles, two claws held out in front, eyes on stalks. A hermit crab is
// the same front half, backed into a snail shell it drags along. The origin is the middle of the carapace;
// the floor is at y = floor.

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale, rand } from "../../core/index.js";
import { pick } from "../shrimp/_body.js";

const R5 = (r) => fit(r, 5);

/** A jointed leg: hip -> knee -> tip, r thick, cols; the knee is a bright dot, spines optional. */
export function leg(g, hip, knee, tip, r, cols, a = 1, spines = 0, hairy = false) {
  const C = R5(cols);
  g.tube([hip, knee], r, (u, d) => (d > 0.65 ? C[1] : C[3]), a, 1);
  g.tube([knee, tip], r * 0.8, (u, d) => (d > 0.65 ? C[1] : u > 0.7 ? C[2] : C[3]), a, 1);
  g.set(knee[0], knee[1], C[4], a, 1);
  g.set(tip[0], tip[1], C[0], a, 1);
  if (spines) for (let i = 1; i <= spines; i++) { const u = i / (spines + 1); g.set(lerp(hip[0], knee[0], u), lerp(hip[1], knee[1], u) - r - 0.5, C[4], a, 1); }
  if (hairy) for (let i = 1; i < 6; i++) { const u = i / 6; g.set(lerp(knee[0], tip[0], u) + (i % 2 ? 1 : -1), lerp(knee[1], tip[1], u), C[2], a * 0.8, 1); }
}

/** A claw (cheliped) from shoulder (x, y) reaching to (ex, ey): the arm, then a palm with two fingers opening by k. */
export function claw(g, x, y, ex, ey, size, cols, k = 0.3, a = 1, opts = {}) {
  const C = R5(opts.palm ?? cols), AC = R5(cols), dx = ex - x, dy = ey - y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
  g.tube([[x, y], [x + dx * 0.55, y + dy * 0.55]], size * 0.55, (u, d) => (d > 0.65 ? AC[1] : AC[3]), a, 1);
  const cx = x + dx * 0.55, cy = y + dy * 0.55;
  // the palm: a plump lens, then the fixed finger and the movable one
  g.ellipse(cx + ux * size * 0.9, cy + uy * size * 0.9, size * 1.1, size * 0.85, (nx, ny) => pick(C, ny * 0.9 - 0.1, Math.hypot(nx, ny) > 0.8 ? 1 : 3), a, 1);
  const tx = cx + ux * size * 1.9, ty = cy + uy * size * 1.9, open = k * size * 0.9;
  g.line(tx - px * size * 0.35, ty - py * size * 0.35, tx + ux * size * 1.4 - px * (size * 0.35 + open), ty + uy * size * 1.4 - py * (size * 0.35 + open), C[3], a, 1);
  g.line(tx + px * size * 0.35, ty + py * size * 0.35, tx + ux * size * 1.5 + px * size * 0.2, ty + uy * size * 1.5 + py * size * 0.2, C[2], a, 1);
  if (opts.spotted) g.set(cx + ux * size * 0.9, cy + uy * size * 0.9 - 1, C[4], a, 1);
}

/**
 * A crab at local time t of loop D. spec: { W (carapace half-width), H (half-height), shape "oval" |
 * "hex" | "round" | "trapezoid" | "square", skin(nx, ny, x, y) -> ramp, legs: { n (pairs), L, r, spines,
 * hairy, lift, cols }, claws: { size, L, cols, left (scale), right (scale), raise (radians the big one
 * waves up), open }, eyes: { stalk, r, x }, floor (y of the ground), scuttle (px it shuffles sideways),
 * bumps (density of tubercles), extra(g, t, S), outline, lit, a }.
 */
export function drawCrab(g, spec, t, D, seed = 1) {
  const S = { W: 14, H: 8, shape: "oval", floor: 12, scuttle: 2, bumps: 0, a: 1, ...spec };
  const ph = (t / D) * TAU, a = S.a;
  const skin = S.skin ?? (() => ["#3a1408", "#7a2c14", "#b85a30", "#e09060", "#ffc8a0"]);
  const LG = S.legs ?? { n: 4, L: 14, r: 1.6 }, LC = LG.cols ?? skin(0, 0.5, 0, 0);
  const W = S.W, H = S.H, floor = S.floor;
  // the body's side-to-side shuffle, and which legs are up
  const shuffle = Math.sin(ph) * S.scuttle;
  const stepping = (side, i) => Math.max(0, Math.sin(ph * 2 + i * 1.6 + (side > 0 ? 0 : Math.PI))) * (LG.lift ?? 3);
  // back legs first (the far pairs are drawn behind the carapace)
  const legsOf = (back) => {
    for (const side of [-1, 1])
      for (let i = 0; i < LG.n; i++) {
        const isBack = i >= Math.ceil(LG.n / 2);
        if (isBack !== back) continue;
        const L = LG.L * (1 - 0.1 * i) * (LG.lengths ? LG.lengths[i] : 1), up = stepping(side, i);
        // the front pairs reach forward and down, the back pairs up and away behind the shell
        const th = 0.2 + i * 0.32;
        const hip = [side * W * (0.9 - i * 0.06) + shuffle, H * 0.3 - i * H * 0.25];
        const knee = [hip[0] + side * Math.cos(th) * L * 0.5 + side * up * 0.3, hip[1] - Math.sin(th) * L * 0.6 - up];
        const tip = [side * (W * 0.9 + L * (0.9 - i * 0.1)) + shuffle, floor - i * 3 - up * 0.6];
        leg(g, hip, knee, tip, LG.r * (1 - 0.1 * i), isBack ? R5(LC).map((c) => mix(c, hex("#000000"), 0.3)) : LC, a, LG.spines ?? 0, LG.hairy);
      }
  };
  legsOf(true);
  // the carapace
  g.shade(-W - 1, -H - 1, W + 1, H + 1, (x, y, o) => {
    const nx = (x - shuffle) / W, ny = y / H;
    let inside;
    if (S.shape === "hex") inside = Math.abs(nx) <= 1 - Math.abs(ny) * 0.45 && Math.abs(ny) <= 1;
    else if (S.shape === "trapezoid") inside = Math.abs(nx) <= 1 - (ny + 1) * 0.2 && Math.abs(ny) <= 1;
    else if (S.shape === "square") inside = Math.abs(nx) ** 3 + Math.abs(ny) ** 3 <= 1;
    else if (S.shape === "round") inside = nx * nx + ny * ny <= 1;
    else inside = nx * nx + ny * ny * (ny < 0 ? 1.1 : 0.9) <= 1;
    if (!inside) return 0;
    o.a = a; o.t = 1;
    const ramp = R5(skin(nx, ny, x, y));
    const bump = S.bumps && rand(Math.round(x), Math.round(y), 80) < S.bumps ? 0.7 : 0;
    return pick(ramp, ny * 0.9 - 0.15 - bump, nx * nx + ny * ny > 0.78 ? 1 : 3);
  });
  // eyes on stalks at the front edge, the mouth frame below them
  const E = S.eyes ?? { stalk: 2, r: 1, x: 0.3 }, EC = R5(skin(0, -0.8, 0, 0));
  for (const side of [-1, 1]) {
    const ex = side * W * E.x + shuffle, ey = -H * 0.55;
    g.line(ex, ey + 2, ex, ey - E.stalk, EC[2], a, 1);
    g.ellipse(ex, ey - E.stalk - 0.5, E.r + 0.3, E.r + 0.3, hex("#0a0810"), a, 1);
    g.set(ex + 0.3, ey - E.stalk - 1, hex("#ffffff"), a, 1);
  }
  g.line(-W * 0.2 + shuffle, H * 0.75, W * 0.2 + shuffle, H * 0.75, EC[1], a, 1);
  legsOf(false);
  // claws in front, held low, the big one raised if the species waves it
  const CL = S.claws ?? { size: 2.2, L: 10, open: 0.3 }, CC = CL.cols ?? skin(0, 0.3, 0, 0);
  for (const side of [-1, 1]) {
    const sc = side < 0 ? CL.left ?? 1 : CL.right ?? 1;
    if (sc <= 0) continue;
    const raise = (side < 0 ? CL.raiseLeft : CL.raiseRight) ?? 0;
    const wave = raise ? raise * (0.6 + 0.4 * Math.sin(ph * 2)) : 0;
    const sx = side * W * 0.5 + shuffle, sy = H * 0.6;
    const ex = sx + side * Math.cos(0.5 - wave) * CL.L * sc * 0.9, ey = sy + Math.sin(0.5 - wave) * CL.L * sc * 0.9 - (raise ? CL.L * sc * 0.5 : 0);
    claw(g, sx, sy, ex, ey, CL.size * sc, CC, CL.open + 0.2 * Math.max(0, Math.sin(ph * 2 + side)), a, { palm: CL.palm, spotted: CL.spotted });
  }
  if (S.extra) S.extra(g, t, { W, H, floor, shuffle, ph });
  const O = R5(skin(0, 0.7, 0, 0));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), a);
  return { shuffle };
}

/**
 * A snail shell for a hermit crab: whorls [[cx, cy, rx, ry], ...] biggest first, its aperture facing right,
 * pattern(x, y, i) -> ramp. Dragged along: it rocks with the crab's steps.
 */
export function shell(g, whorls, pattern, t, D, rock = 1, a = 1) {
  const ph = (t / D) * TAU, tilt = Math.sin(ph * 2) * 0.6 * rock;
  whorls.forEach(([cx, cy, rx, ry], i) => {
    g.ellipse(cx + tilt * i, cy, rx, ry, (nx, ny) => pick(R5(pattern(cx + nx * rx, cy + ny * ry, i)), (-nx * 0.4 - ny * 0.9) * -0.9, Math.hypot(nx, ny) > 0.88 ? 1 : 3), a, 1);
  });
  for (let i = 1; i < whorls.length; i++) {
    const [cx, cy, rx, ry] = whorls[i];
    for (let x = cx - rx; x <= cx + rx; x += 0.5) { const y = cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * 0.95; const c = g.get(x, y + 0.6); if (c) g.set(x, y + 0.6, scale(c, 0.72), a, 1); }
  }
}

/**
 * A hermit crab: its shell at the left, the crab's front half out of the aperture on the right: two claws
 * (one bigger), two pairs of walking legs, eyes on long stalks, antennae. spec: { whorls, shellPattern,
 * skin, legs: { L, r, cols }, claws: { size, L, cols, left, right }, eyes: { stalk }, floor, bands(x, y)
 * -> ramp | 0 for banded legs, extra, outline, lit, land (true: no bubbles-worthy tilt) }.
 */
export function drawHermit(g, spec, t, D, seed = 1) {
  const S = { floor: 10, ...spec };
  const ph = (t / D) * TAU;
  const skin = S.skin ?? (() => ["#3a1408", "#7a2c14", "#b85a30", "#e09060", "#ffc8a0"]);
  const LG = S.legs ?? { L: 10, r: 1.3 }, LC = LG.cols ?? skin(0, 0.5, 0, 0);
  const walk = Math.sin(ph * 2) * 1.5, floor = S.floor;
  shell(g, S.whorls, S.shellPattern, t, D, 1);
  // the body emerging from the aperture (the shell's right side), the abdomen hidden inside
  const ax = S.aperture?.[0] ?? S.whorls[0][0] + S.whorls[0][2] * 0.7, ay = S.aperture?.[1] ?? S.whorls[0][1] + 2;
  const BC = R5(skin(0, 0, 0, 0));
  g.ellipse(ax + 3, ay + 1, 5, 3.5, (nx, ny) => pick(BC, ny * 0.9 - 0.1, Math.hypot(nx, ny) > 0.8 ? 1 : 3));
  // walking legs: two pairs reaching forward and down to the floor
  for (let i = 0; i < 2; i++) {
    const up = Math.max(0, Math.sin(ph * 2 + i * 2.2)) * 2.5, back = Math.max(0, Math.sin(ph * 2 + i * 2.2 + Math.PI)) * 2.5;
    const hip = [ax + 4 + i * 1.5, ay + 1 + i], knee = [ax + 8 + i * 4 - up * 0.3, ay - 3 - i * 2 - up], tip = [ax + 11 + i * 5 + walk, floor - up * 0.6];
    leg(g, hip, knee, tip, LG.r, LC, 1, 0, LG.hairy);
    const hip2 = [ax + 3 + i * 1.5, ay + 2 + i], knee2 = [ax + 6 + i * 3 - back * 0.3, ay - 1 - i - back * 0.6], tip2 = [ax + 7 + i * 4 - walk, floor - back * 0.5 + 0.5];
    leg(g, hip2, knee2, tip2, LG.r * 0.9, R5(LC).map((c) => mix(c, hex("#000000"), 0.3)), 1, 0, LG.hairy);
  }
  if (S.bands) g.recolor((x, y, c, al, tag) => { const r = S.bands(x, y); return r ? R5(r)[2] : c; });
  // eyes on long stalks, antennae flicking
  const E = S.eyes ?? { stalk: 5 }, EC = R5(skin(0, -0.8, 0, 0));
  for (const dx of [0, 2.5]) { const ex = ax + 6 + dx, ey = ay - 1; g.line(ex, ey, ex + 1, ey - E.stalk, EC[3]); g.ellipse(ex + 1, ey - E.stalk - 0.5, 1.2, 1.2, hex("#0a0810")); g.set(ex + 1.3, ey - E.stalk - 1, hex("#ffffff")); }
  for (const dy of [-0.5, 0.8]) g.line(ax + 8, ay + dy, ax + 18, ay + dy - 4 - dy * 2 + lnoise(t, D, 2, dy, seed) * 1.5, EC[3]);
  // claws: the big one in front covering the aperture, the small one behind it
  const CL = S.claws ?? { size: 2, L: 8 }, CC = CL.cols ?? skin(0, 0.3, 0, 0);
  claw(g, ax + 4, ay + 3, ax + 4 + CL.L * 0.9 * (CL.left ?? 0.75), ay + 5 + CL.L * 0.3, CL.size * (CL.left ?? 0.75), CC, 0.25, 1, { palm: CL.palm });
  claw(g, ax + 5, ay + 2, ax + 5 + CL.L * (CL.right ?? 1), ay + 3 + CL.L * 0.45 + Math.sin(ph * 2) * 0.5, CL.size * (CL.right ?? 1), CC, 0.3 + 0.2 * Math.max(0, Math.sin(ph)), 1, { palm: CL.palm });
  if (S.extra) S.extra(g, t, { ax, ay, floor, ph });
  const O = R5(skin(0, 0.7, 0, 0));
  g.outline((x, y, nx, ny) => (S.outline ? (ny < 0 && S.lit ? hex(S.lit) : hex(S.outline)) : ny < 0 ? O[1] : O[0]), 1);
}
