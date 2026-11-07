import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Crystal red shrimp",
  ja: "レッドビーシュリンプ",
  sci: "Caridina cf. cantonensis",
  region: "Bred in Japan (freshwater), from southern China stock",
  length: "2.5 cm",
  desc: "Bred in Japan in the 1990s from a black-and-white bee shrimp mutation: porcelain white and candy red in bands, graded by how much white it carries. Still one of the most prized aquarium shrimps.",
  jadesc: "1990年代に日本で黒白のビーシュリンプの突然変異から作出された、白と赤のバンド模様。白の面積でグレード分けされる、今も世界で愛される観賞エビ。",
  tags: ["shrimp", "freshwater", "aquarium", "japan", "bands", "loop"],
  size: [60, 48],
  origin: [28, 24],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a0810", "#b01820", "#e82828", "#ff5a50", "#ff9a90"],
    white: ["#9a8a90", "#d0c8cc", "#f0eeee", "#ffffff", "#ffffff"],
    plant: ["#143a18", "#2a7030", "#60b848"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -24, 60, 46), BG = new Grid(-28, -24, 60, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), R = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) plants(bg, t, D, -26, 26, 20, 4, o.plant, o.seed + 1);
  // red head, white band, red saddle, white, red tail tip
  const skin = (u, v, x) => (x > 6 ? R : x > 1.5 ? W : x > -4.5 ? R : x > -9 ? W : x > -12.5 ? R : W);
  drawShrimp(g, {
    Lc: 9, H: 4, L: 14, curl: 0.6, rostrum: 2, rostrumUp: 1, taper: 0.5, eye: 1, skin,
    legs: { n: 4, len: 5, col: "#f0e8e8", step: 0.9 },
    antennae: { n: 2, len: 16, up: -0.3, back: true, col: "#f0d0d0", alpha: 0.85 },
    antennules: { len: 5, col: "#f0d0d0" },
    claws: { kind: "small", size: 0.7, col: "#e8d0d0" },
    swimmerets: { col: "#f0d0d0" },
    outline: "#4a1018",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.9);
  if (o.scene !== false) sandFloor(p, -28, 30, 18, 6, o.seed);
  if (o.scene !== false) shadow(p, -2, 19, 14, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, Math.sin((t / D) * TAU + 1) * 1, 8);
  if (o.scene !== false) caustics(p, t, D, -30, -24, 30, 22, hex("#e6cc96"), 0.1);
}
