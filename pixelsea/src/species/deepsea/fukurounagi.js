import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Gulper eel",
  ja: "フクロウナギ",
  sci: "Eurypharynx pelecanoides",
  region: "Deep oceans worldwide, 500–3000 m",
  length: "75 cm",
  desc: "Mostly mouth: a pelican's pouch of a jaw a quarter of its length, hinged loosely to a tiny skull, trailing a whip of a tail with a pink light at the tip. It balloons the pouch open to engulf clouds of small crustaceans, having barely any teeth.",
  jadesc: "ほとんどが口。ペリカンの袋のような顎は体長の四分の一で、小さな頭骨にゆるくつながる。鞭のような尾の先にピンクの光をもつ。歯はほとんどなく、袋を風船のように広げて小さな甲殻類の群れを呑み込む。",
  tags: ["deepsea", "eel", "mouth", "glow", "worldwide", "loop"],
  size: [112,52],
  origin: [40,26],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1e1a26", "#38324a", "#524a68", "#6e6488", "#8a80a4"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -26, 112, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const gulp = Math.max(0, Math.sin(ph)) ** 2;
  drawFish(g, {
    L: 92, H: 5, peak: 0.1, nose: 0.9, stock: 0.05,
    back: (u) => (u < 0.06 ? Math.sqrt(u / 0.06) : 1 - Math.pow((u - 0.06) / 0.94, 1.1) * 0.95),
    belly: (u) => (u < 0.06 ? Math.sqrt(u / 0.06) : 1 - Math.pow((u - 0.06) / 0.94, 1.1) * 0.95),
    skin: () => C,
    tail: { kind: "none" },
    dorsal: [{ u: 0.5, h: 2, w: 60, kind: "ridge" }],
    pectoral: null,
    eye: { u: 0.02, v: -0.3, r: 1, ring: "#4a4256" },
    mouth: null,
    swim: { kind: "fish", amp: 1.2 },
    extra: (g, t, S) => {
      // the pouch: a huge jaw hinged behind the eye, opening wide
      const x0 = S.xOf(0.04), y0 = S.wave(0.04), W = 26, Hh = 6 + 12 * gulp;
      g.poly([[x0, y0 - 3], [x0 + W, y0 - 4 - gulp * 2], [x0 + W + 2, y0 + 1], [x0 + W * 0.7, y0 + Hh], [x0 + W * 0.3, y0 + Hh + 2], [x0 - 2, y0 + 4]], (x, y) => (y < y0 + 1 ? C[3] : y > y0 + Hh * 0.6 ? C[1] : C[2]), 1, 1);
      g.line(x0, y0 - 1, x0 + W + 1, y0 - 2 - gulp, C[0], 1, 1);
      g.set(S.xOf(1) - 1, S.wave(1), hex("#ff80c0"), 1, 7);
    },
    outline: "#0c0a12", lit: "#524a68",
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 2, dy = Math.sin(ph * 0.5) * 1.5;
  g.draw(p, 1, dx, dy);
  p.glow(-52 + dx, dy, 5, hex("#ff60b0"), 0.5);
  if (o.scene !== false) snow(p, t, D, 112, 52);
}
