import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Indo-Pacific sailfish",
  ja: "バショウカジキ",
  sci: "Istiophorus platypterus",
  region: "Indo-Pacific; Japan in summer and autumn",
  length: "3.5 m",
  desc: "Often called the fastest fish in the sea. A bill like a rapier, a body of blue and silver that flashes with bars when it hunts, and a sail of a dorsal fin, taller than its body, raised to herd sardines into a ball.",
  jadesc: "海で最速の魚と言われる。レイピアのような吻、狩りのときに縞が浮かぶ青と銀の体、そして体より高い帆のような背びれ。帆を立ててイワシの群れを追い込む。",
  tags: ["fish", "billfish", "fast", "sail", "japan", "loop"],
  size: [120, 56],
  origin: [56, 30],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#081428", "#123058", "#1c5088", "#3878b0", "#78b0d8"],
    silver: ["#5a6a78", "#9aaab8", "#d0dce4", "#f0f6f8", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -30, 120, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), B = fit(o.palette, 5), S = fit(o.silver, 5), g = G.clear();
  const skin = (u, v, x, y) => (v > 0.2 ? S : Math.round(x) % 7 === 0 && v > -0.6 ? ["#3a6a98", "#6a98c0", "#a0c8e0", "#c8e4f0", "#e8f4ff"] : B);
  drawFish(g, {
    L: 66, H: 8, peak: 0.3, nose: 0.25, stock: 0.1, skin,
    tail: { kind: "crescent", span: 13, len: 12 },
    dorsal: [{ u: 0.42, h: 20, w: 36, kind: "sail", rays: 11, col: ["#081428", "#143868", "#2060a0", "#4888c8", "#80b0e0"] }, { u: 0.86, h: 3, w: 4, kind: "tri" }],
    pectoral: { u: 0.26, len: 12, w: 3, angle: 0.45, v: 0.2, flap: 0.1 },
    pelvic: { u: 0.3, h: 9, w: 2 },
    anal: { u: 0.72, h: 5, w: 5 },
    eye: { u: 0.1, v: -0.1, r: 1.3 },
    mouth: { len: 6, open: 0, v: 0.1, drop: 0.5 },
    gills: 1, gillU: 0.2,
    swim: { kind: "fish", amp: 1 },
    finSkin: () => B,
    extra: (g, t, S2) => {
      // the bill: a long spear off the upper jaw; dark spots on the sail
      const x0 = S2.xOf(0), y0 = S2.wave(0) - 1;
      g.tube([[x0, y0], [x0 + 24, y0 - 1.2]], (u) => 1.1 - u * 0.7, (u, d) => (d > 0.7 ? B[1] : B[3]), 1, 1);
      g.recolor((x, y, c, al, tag) => (tag === 1 && y < -S2.H - 2 && rand(Math.round(x / 2), Math.round(y / 2), 33) < 0.12 ? hex("#0a1830") : c));
    },
    outline: "#040a18", lit: "#1c5088",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -56, 64, -30, hex("#5ab6d6"), 0.08);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 2.5, Math.sin((t / D) * TAU * 2) * 0.6 + 4);
  bubbles(p, t, D, 2, o.seed * 7 + 61, 40, 2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -28);
}
