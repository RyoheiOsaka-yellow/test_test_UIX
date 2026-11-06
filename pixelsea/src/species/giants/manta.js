import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Giant oceanic manta",
  ja: "オニイトマキエイ",
  sci: "Mobula birostris",
  region: "Tropical and warm seas worldwide; Ishigaki, Ogasawara",
  length: "7 m across",
  desc: "A ray with a seven-metre wingspan that flies through open water on slow beats, rolling the two horn-like lobes on its head into a scoop for plankton. It has the biggest brain of any fish, and visits cleaning stations like a regular.",
  jadesc: "翼を広げると7 mになるエイ。ゆっくり羽ばたいて外洋を飛ぶように泳ぎ、頭の角のような二枚のヒレを丸めてプランクトンをすくう。魚で最大の脳をもち、クリーニングステーションに通う常連。",
  tags: ["fish", "ray", "manta", "giant", "plankton", "japan", "loop"],
  size: [112, 60],
  origin: [56, 30],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#06080e", "#121826", "#222c40", "#38465c", "#566680"],
    white: ["#8a98a8", "#c8d4dc", "#eef2f6", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -30, 112, 60);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), K = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const ph = (t / D) * TAU, beat = Math.sin(ph);
  drawFish(g, {
    L: 56, H: 6, peak: 0.3, nose: 0.9, stock: 0.08, bellyK: 1.2,
    skin: (u, v) => (v > 0.3 ? W : K),
    tail: { kind: "none" },
    dorsal: [{ u: 0.72, h: 3, w: 5, kind: "tri", col: o.palette }],
    pectoral: { u: 0.32, len: 34, w: 16, angle: 0.25 + 0.45 * beat, v: -0.2, flap: 0 },
    eye: { u: 0.08, v: 0.2, r: 1, ring: "#222c40" },
    mouth: null,
    gills: 5, gillU: 0.14,
    swim: { kind: "fish", amp: 0.3 },
    finSkin: (u, v, kind) => K,
    extra: (g, t, S) => {
      // the far wing rises as the near one falls; the cephalic lobes curl in front of the wide mouth; the whip tail
      const x0 = S.xOf(0.01), y0 = S.wave(0);
      for (const [dy, s] of [[-2.5, 1], [2, 0.8]]) g.tube([[x0, y0 + dy], [x0 + 5 * s, y0 + dy - 1 + beat * 0.5], [x0 + 7 * s, y0 + dy + 1.5 * s]], 1.1, (u, d) => (d > 0.7 ? K[1] : K[3]), 1, 1);
      g.line(x0 - 1, y0 + 3.5, x0 + 3, y0 + 3.5, K[0], 1, 1);
      const tx = S.xOf(1), ty = S.wave(1);
      g.line(tx, ty, tx - 22, ty + 2 + beat * 2, (u) => (u > 0.5 ? K[2] : K[1]), 1, 1);
    },
    outline: "#020306", lit: "#38465c",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -56, 56, -30, hex("#5ab6d6"), 0.08);
  g.draw(p, 1, 0, -beat * 2);
  bubbles(p, t, D, 2, o.seed * 7 + 59, 24, -2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -28);
}
