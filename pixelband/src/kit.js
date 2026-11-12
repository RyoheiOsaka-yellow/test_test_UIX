// The figure kit: a small pixel person, three and a half heads tall, facing a little to the right. Built
// from a skin head, a hair sprite laid over it, a face, a torso in whatever clothes, arms posed for a
// guitar or a microphone, legs and shoes. Guitars and mic stands are drawn on top. The origin is on the
// floor under the figure's centre; everything grows upward (negative y). Uses pixelsea's core.

import { TAU, clamp, lerp, fit, mix, hex, lnoise, scale, rand } from "../../pixelsea/src/core/index.js";

const R5 = (r) => fit(r, 5);
export const SKIN = {
  pale: ["#8a5a48", "#c08868", "#e8b090", "#f8d0b8", "#fff0e8"],
  fair: ["#8a5040", "#c88a70", "#eab898", "#f8d8c0", "#fff4ec"],
  tan: ["#6a3a28", "#a86848", "#d09070", "#e8b898", "#f8dcc8"],
};
const pick = (ramp, v, d = 3) => { const n = ramp.length; let i = (1 - (v + 1) / 2) * (n - 1); if (d <= 1) i -= 0.9; return ramp[clamp(Math.round(i), 0, n - 1)]; };

/** Lay a string sprite (rows, pal: char -> hex) with its top-left at (x, y). */
export function sprite(g, rows, pal, x, y, flip = false) {
  g.sprite(rows, pal, x, y, { flip });
}

/**
 * The figure. spec: { skin (ramp), hair: { rows, pal, dx, dy }, face: { eyes: "open" | "closed" | "half",
 * brows, stubble, beard, glasses, mouth: "flat" | "open" | "smile" }, shirt: { col ramp, kind: "tee" |
 * "shirt" | "cardigan" | "jacket", inner (ramp for a cardigan's inner shirt), stripes (ramp) }, pants ramp,
 * shoes ramp, pose: "guitar" | "mic" | "idle" | "bass" | "drums", lefty, extra(g, t, S), bob (head bob px) }.
 */
export function drawFigure(g, spec, t, D, seed = 1) {
  const S = { skin: SKIN.fair, pose: "idle", bob: 1, ...spec };
  const ph = (t / D) * TAU, bob = Math.round(Math.sin(ph * 2) * S.bob * 0.5) ;
  const SK = R5(S.skin), SH = R5(S.shirt?.col ?? ["#1a1a22", "#30303c", "#4a4a58", "#6a6a78", "#8a8a98"]), PT = R5(S.pants ?? ["#101420", "#1c2438", "#2c3850", "#405068", "#5a6a80"]), SO = R5(S.shoes ?? ["#0a0a0a", "#1c1c1c", "#303030", "#444444", "#5a5a5a"]);
  const HY = -46 + bob; // head centre y
  // legs and shoes
  for (const s of [-1, 1]) {
    g.poly([[s * 2 - 3, -24 + bob], [s * 2 + 3, -24 + bob], [s * 4 + 2.5, -2], [s * 4 - 2.5, -2]], (x, y) => (x < s * 4 - 0.5 ? PT[2] : PT[3]));
    g.poly([[s * 4 - 3, -2], [s * 4 + 3.5, -2], [s * 4 + 4, 0], [s * 4 - 3, 0]], (x, y) => (y < -1 ? SO[3] : SO[1]));
  }
  // torso
  const K = S.shirt?.kind ?? "tee";
  g.poly([[-8, -40 + bob], [8, -40 + bob], [9, -22 + bob], [-9, -22 + bob]], (x, y) => {
    if (S.shirt?.stripes && Math.round(y) % 4 < 2) return R5(S.shirt.stripes)[2];
    return x < -3 ? SH[1] : x < 4 ? SH[2] : SH[3];
  });
  if (K === "cardigan" || K === "jacket") {
    const IN = R5(S.shirt.inner ?? ["#1a1a22", "#30303c", "#4a4a58", "#6a6a78", "#8a8a98"]);
    g.poly([[-3, -40 + bob], [3, -40 + bob], [3, -22 + bob], [-3, -22 + bob]], (x, y) => (S.shirt.innerStripes && Math.round(y) % 3 === 0 ? R5(S.shirt.innerStripes)[3] : IN[2]));
    g.line(-3, -40 + bob, -3, -22 + bob, SH[0]); g.line(3, -40 + bob, 3, -22 + bob, SH[0]);
    if (K === "jacket") { g.line(-8, -40 + bob, -3, -36 + bob, SH[4]); g.line(8, -40 + bob, 3, -36 + bob, SH[4]); }
  }
  if (K === "shirt") { g.line(-2, -40 + bob, 0, -36 + bob, SK[2]); g.line(2, -40 + bob, 0, -36 + bob, SK[2]); g.line(0, -36 + bob, 0, -23 + bob, SH[1]); }
  // neck and head
  g.rect ? null : null;
  g.poly([[-2.5, -42 + bob], [2.5, -42 + bob], [2.5, -38 + bob], [-2.5, -38 + bob]], SK[2]);
  g.ellipse(0, HY, 7, 8, (nx, ny) => pick(SK, ny * 0.6 - nx * 0.3 - 0.1, Math.hypot(nx, ny) > 0.85 ? 1 : 3));
  // ears
  g.ellipse(-6.5, HY + 0.5, 1.4, 2, SK[2]); g.ellipse(6.5, HY + 0.5, 1.4, 2, SK[2]);
  // face
  const F = S.face ?? {};
  const ey = HY + 0.5;
  if (F.eyes === "closed") { g.line(-4, ey, -2, ey, hex("#2a1810")); g.line(2, ey, 4, ey, hex("#2a1810")); }
  else { for (const s of [-1, 1]) { g.set(s * 3, ey, hex("#f8f8f8")); g.set(s * 3 + (s < 0 ? 0.5 : -0.5), ey, F.eyeCol ? hex(F.eyeCol) : hex("#1a1a2a")); if (F.eyes === "half") g.set(s * 3, ey - 1, SK[1]); } }
  if (F.brows !== false) { g.line(-4.5, ey - 2.5, -2, ey - 2.2, F.browCol ? hex(F.browCol) : hex("#3a2818")); g.line(2, ey - 2.2, 4.5, ey - 2.5, F.browCol ? hex(F.browCol) : hex("#3a2818")); }
  g.set(0.5, ey + 2, SK[1]); g.set(0, ey + 2.5, SK[1]);
  if (F.mouth === "open") { g.ellipse(0, ey + 5, 1.8, 1.4, hex("#4a1818")); }
  else if (F.mouth === "smile") { g.line(-1.5, ey + 4.5, 1.5, ey + 4.5, hex("#6a3028")); g.set(-2, ey + 4, hex("#6a3028")); g.set(2, ey + 4, hex("#6a3028")); }
  else g.line(-1.5, ey + 4.5, 1.5, ey + 4.5, hex("#7a4038"));
  if (F.stubble) g.shade(-5, ey + 2, 5, ey + 7, (x, y, o) => (Math.hypot(x / 6, (y - HY) / 8) < 0.98 && y > ey + 2.5 && (Math.round(x) + Math.round(y)) % 2 === 0 ? mix(SK[2], hex(F.stubble), 0.5) : 0));
  if (F.beard) g.shade(-5.5, ey + 3, 5.5, ey + 8.5, (x, y, o) => (Math.hypot(x / 6.5, (y - HY) / 8.5) < 1.02 && y > ey + 3 && Math.abs(x) + (y - ey - 3) * 0.6 > 2 ? hex(F.beard) : 0));
  if (F.glasses) { g.line(-5.5, ey, -1, ey, hex(F.glasses)); g.line(1, ey, 5.5, ey, hex(F.glasses)); g.set(-5.5, ey - 1, hex(F.glasses)); g.set(5.5, ey - 1, hex(F.glasses)); }
  // hair
  if (S.hair) sprite(g, S.hair.rows, S.hair.pal, -Math.floor(S.hair.rows[0].length / 2) + (S.hair.dx ?? 0), HY - 9 + (S.hair.dy ?? 0), S.hair.flip);
  // arms by pose
  const AC = K === "tee" ? SK : SH, ac = R5(AC);
  const arm = (x0, y0, x1, y1, x2, y2) => { g.tube([[x0, y0], [x1, y1]], 1.6, (u, d) => (d > 0.7 ? ac[1] : ac[3])); g.tube([[x1, y1], [x2, y2]], 1.5, (u, d) => (d > 0.7 ? ac[1] : ac[3])); g.ellipse(x2, y2, 1.8, 1.8, (nx, ny) => (ny < 0 ? SK[3] : SK[2])); };
  const strum = Math.sin(ph * 4) * 1.5;
  if (S.pose === "guitar" || S.pose === "bass") {
    const L = S.lefty ? -1 : 1;
    arm(-8 * L, -37 + bob, -14 * L, -31 + bob, -13 * L, -25 + bob); // fretting hand out to the side
    arm(8 * L, -37 + bob, 10 * L, -28 + bob, 3 * L, -27 + bob + strum); // strumming hand over the body
  } else if (S.pose === "mic") {
    arm(-8, -37 + bob, -11, -30 + bob, -9, -24 + bob);
    arm(8, -37 + bob, 10, -32 + bob, 6, -39 + bob);
  } else if (S.pose === "drums") {
    arm(-8, -37 + bob, -13, -32 + bob, -14, -26 + bob - strum);
    arm(8, -37 + bob, 13, -32 + bob, 14, -26 + bob + strum);
  } else {
    arm(-8, -37 + bob, -10, -30 + bob, -9, -23 + bob);
    arm(8, -37 + bob, 10, -30 + bob, 9, -23 + bob);
  }
  if (S.extra) S.extra(g, t, { bob, HY, strum, ph });
  return { bob, strum };
}

/**
 * A guitar across the body at (x, y) (the bridge), kind "strat" | "tele" | "jag" | "lp" | "bass", body
 * ramp, guard hex, neck ramp, lefty (mirrored), angle (radians, neck up to the left when positive).
 */
export function guitar(g, x, y, kind, body, guard, lefty = false, angle = 0.35, neckCol = ["#3a2a18", "#6a4a28", "#9a7040", "#c09060", "#e0b888"]) {
  const B = R5(body), N = R5(neckCol), L = lefty ? -1 : 1;
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const sc = 0.85;
  const P = (dx, dy) => [x + (dx * cs - dy * sn) * L * sc, y + (dx * sn + dy * cs) * sc];
  // the body: two bouts, a waist; the shapes differ a little by kind
  const shape = kind === "tele" ? [[-9, -5], [-7, -7], [2, -7], [8, -5], [9, 0], [8, 5], [2, 7], [-7, 7], [-9, 5]]
    : kind === "lp" ? [[-8, -4], [-5, -7], [3, -7], [8, -5], [9, 0], [8, 5], [3, 7], [-5, 7], [-8, 4]]
    : kind === "bass" ? [[-10, -4], [-6, -7], [3, -6], [8, -5], [9, 0], [8, 5], [3, 6], [-6, 7], [-10, 4]]
    : kind === "jag" ? [[-10, -4], [-7, -8], [-1, -6], [4, -8], [9, -5], [10, 0], [9, 5], [4, 8], [-1, 6], [-7, 8], [-10, 4]]
    : [[-9, -4], [-6, -8], [-1, -6], [4, -8], [8, -5], [9, 0], [8, 5], [4, 8], [-1, 6], [-6, 8], [-9, 4]];
  g.poly(shape.map(([dx, dy]) => P(dx, dy)), (px, py) => (py < y - 2 ? B[3] : py > y + 3 ? B[1] : B[2]));
  g.line(...P(-8, -1), ...P(-8, 1), B[4]);
  if (guard) g.poly([P(-6, -2), P(3, -5), P(7, -1), P(5, 4), P(-4, 5)].map((q) => q), hex(guard));
  // pickups and bridge
  g.line(...P(0, -2.5), ...P(0, 2.5), hex("#1a1a1a")); g.line(...P(4, -2.5), ...P(4, 2.5), hex("#1a1a1a")); g.line(...P(6.5, -2), ...P(6.5, 2), hex("#8a8a90"));
  // neck and headstock, up and away to the fretting side
  const NL = kind === "bass" ? 30 : 24;
  g.poly([P(-9, -1.6), P(-9 - NL, -1.3), P(-9 - NL, 1.3), P(-9, 1.6)].map((q) => q), (px, py) => N[2]);
  for (let i = 1; i < 8; i++) { const [fx, fy] = P(-9 - i * NL / 8, 0); g.set(fx, fy, N[1]); }
  g.poly([P(-9 - NL, -3), P(-13 - NL, -3.5), P(-14 - NL, 1.5), P(-9 - NL, 2)].map((q) => q), (px, py) => (py < y ? N[3] : N[2]));
  // strings: a bright line down the middle
  g.line(...P(-9 - NL, 0), ...P(6, 0), hex("#e0e0e0"), 0.7);
  // a strap over the shoulder
  g.line(...P(0, -7), x - 7 * L, y - 16, hex("#2a2420"));
}

/** A microphone on a stand at (x, floor), reaching up to mouth height my, leaning toward the singer. */
export function micStand(g, x, floor, my, lean = 0) {
  g.line(x, floor, x + lean, my + 4, hex("#8a8a90"));
  g.line(x - 4, floor, x + 4, floor, hex("#5a5a60"));
  g.line(x + lean, my + 4, x + lean - 3, my, hex("#8a8a90"));
  g.ellipse(x + lean - 3.5, my - 0.5, 1.8, 2, (nx, ny) => (ny < -0.3 ? hex("#b0b0b8") : hex("#505058")));
}

/** A stage floor: dark boards with a strip of light where the figure stands. */
export function stage(p, x0, x1, y, h, glowCol = "#5a4a80") {
  for (let yy = 0; yy < h; yy++) for (let x = x0; x <= x1; x++) p.dot(x, y + yy, ((x + yy * 3) % 9 === 0) ? hex("#141418") : hex("#1c1c22"), 1 - yy / h);
  p.glowLine(x0, y - 1, x1, y - 1, 8, hex(glowCol), 0.12);
}
