import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Varicose phyllidia",
  ja: "タテヒダイボウミウシ",
  sci: "Phyllidia varicosa",
  region: "Indo-West Pacific reefs",
  length: "8 cm",
  desc: "A tough, warty slug in grey-blue with black grooves between ridges of yellow-tipped bumps. It has no gill plume (its gills hide under the skirt) and smells of a toxin that can kill a tankful of fish.",
  jadesc: "灰青色の硬い体に黒い溝、黄色い先端のイボが並ぶ縦の畝。背中にエラの花はなく、外套膜の下に隠す。毒臭があり、水槽の魚を全滅させることも。",
  tags: ["nudibranch", "phyllidiid", "warty", "reef", "toxic", "loop"],
  size: [68, 42],
  origin: [32, 26],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a3a50", "#4a6080", "#7a98b8", "#a8c4d8", "#d8ecf4"],
    bump: ["#6a5000", "#c09810", "#f0c828", "#ffe860", "#fff8c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -26, 68, 42);
const BLACK = ["#06080e", "#101420", "#1a2030", "#283040", "#384050"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), B = fit(o.bump, 5), g = G.clear();
  const skin = (u, v, x, y) => (u > 0.08 && u < 0.92 && (Math.abs(v + 0.35) < 0.09 || Math.abs(v + 0.75) < 0.07 || Math.abs(v - 0.1) < 0.09) ? BLACK : C);
  drawDorid(g, {
    L: 40, H: 9, hump: 0.2, foot: 2, dome: 0.5, crawl: 0.5, skin,
    footCol: ["#2a3a50", "#405870", "#607890", "#8aa0b8", "#b0c8d8"],
    margin: [[1, C]],
    bumps: (x, y, u, v) => (u > 0.1 && u < 0.9 && (Math.round(x) + 40) % 3 === 1 && (Math.abs(v + 0.55) < 0.16 || Math.abs(v - 0.3) < 0.16 || v < -0.85) ? B : 0),
    rhino: { x: 0.18, h: 4, col: B },
    gill: null,
    outline: "#141c2c", lit: "#4a6080",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 22, 2.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 14, 12, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -34, -26, 34, 16, hex("#8ee0c8"), 0.12);
}
