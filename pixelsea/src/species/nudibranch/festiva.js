import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Festive chromodoris",
  ja: "アオウミウシ",
  sci: "Hypselodoris festiva",
  region: "Japan, Korea (temperate rocky shores)",
  length: "3 cm",
  desc: "Japan's best-loved sea slug, found in any tide pool from Honshu south: a blue body with a yellow line and dots along the back, a yellow hem, and orange rhinophores and gills.",
  jadesc: "日本の磯でいちばん出会えるウミウシ。青い体の背中に黄色い線と点、縁は黄色、触角とエラはオレンジ。ウミウシの代名詞的存在。",
  tags: ["nudibranch", "dorid", "blue", "japan", "tidepool", "loop"],
  size: [60, 44],
  origin: [28, 26],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#0a2a70", "#1646b8", "#2c6ce0", "#5c98f0", "#a8ccff"],
    yellow: ["#6a4a00", "#b08a10", "#f0c020", "#ffe060", "#fff4a0"],
    orange: ["#6a2800", "#c05008", "#f07818", "#ffa040", "#ffd890"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -26, 60, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), Y = fit(o.yellow, 5), OR = fit(o.orange, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    if (Math.abs(v + 0.55) < 0.14 && u > 0.22 && u < 0.8) return Y;
    if (Math.abs(v + 0.05) < 0.2 && (Math.round(x) + 50) % 5 === 0 && u > 0.12 && u < 0.9) return Y;
    return C;
  };
  drawDorid(g, {
    L: 30, H: 10, hump: 0.3, foot: 2, skin,
    footCol: ["#0a2a70", "#2050a8", "#4078c8", "#70a0e0", "#a8c8f0"],
    margin: [[1, Y]],
    rhino: { x: 0.2, h: 5, col: OR },
    gill: { x: 0.22, n: 6, r: 4, col: OR },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 16, 2.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 4, 10, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -30, -26, 30, 18, hex("#8ee0c8"), 0.12);
}
