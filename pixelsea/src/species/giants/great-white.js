import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Great white shark",
  ja: "ホホジロザメ",
  sci: "Carcharodon carcharias",
  region: "Temperate seas worldwide; South Africa, Australia, California, Japan",
  length: "6 m",
  desc: "Slate grey above, white below, a conical snout and three hundred serrated triangular teeth in rows that replace themselves for life. It can hold its body warmer than the sea, and breaches clean out of the water after seals.",
  jadesc: "背は灰色、腹は白、円錐形の鼻先と、一生生え替わる鋸歯状の三角の歯が300本。海水より高い体温を保ち、アザラシを追って海面から跳び出す。",
  tags: ["fish", "shark", "predator", "teeth", "worldwide", "loop"],
  size: [104, 52],
  origin: [52, 26],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#242a30", "#48525a", "#6c7880", "#94a0a8", "#b8c4cc"],
    white: ["#8a9aa0", "#c8d4d8", "#eef2f4", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-52, -26, 104, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const skin = (u, v) => (v > 0.15 ? W : C);
  drawFish(g, {
    L: 72, H: 10, peak: 0.38, nose: 0.3, stock: 0.14, skin,
    tail: { kind: "shark", span: 13, len: 13 },
    dorsal: [{ u: 0.48, h: 12, w: 13, kind: "tri" }, { u: 0.8, h: 3, w: 5, kind: "tri" }],
    pectoral: { u: 0.3, len: 15, w: 5, angle: 0.55, v: 0.5, flap: 0.12 },
    pelvic: { u: 0.62, h: 4, w: 6 },
    anal: { u: 0.82, h: 3, w: 4 },
    eye: { u: 0.1, v: -0.1, r: 1, ring: "#48525a" },
    mouth: { len: 10, open: (ph) => 0.35 + 0.3 * Math.max(0, Math.sin(ph)), v: 0.45, drop: 1.5, teeth: true },
    mouthCol: "#3a0c14",
    gills: 5, gillU: 0.2,
    swim: { kind: "fish", amp: 1 },
    finSkin: (u, v, kind) => (kind === "pectoral" || kind === "pelvic" ? C : C),
    outline: "#101418", lit: "#6c7880",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -52, 52, -26, hex("#5ab6d6"), 0.08);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 2, Math.sin((t / D) * TAU) * 1);
  bubbles(p, t, D, 2, o.seed * 7 + 57, 30, 2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
