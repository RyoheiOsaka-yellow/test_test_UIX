import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Painted felimare",
  ja: "フェリマレ・ピクタ（和名なし）",
  sci: "Felimare picta",
  region: "Mediterranean, eastern Atlantic",
  length: "20 cm",
  desc: "The Mediterranean's grand chromodorid: midnight blue laced with yellow lines and spots, a yellow hem, and gills and rhinophores in blue and gold. It can reach the length of a hand.",
  jadesc: "地中海を代表する大型のウミウシ。深い紺に黄色の線と斑点、黄色い縁取り、青と金のエラと触角。手のひらほどに育つ。",
  tags: ["nudibranch", "dorid", "blue", "yellow", "mediterranean", "loop"],
  size: [76, 46],
  origin: [36, 28],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#060c30", "#101c60", "#1c3090", "#3050b8", "#6080d8"],
    yellow: ["#6a5000", "#c09810", "#f0c828", "#ffe860", "#fff8c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -28, 76, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), Y = fit(o.yellow, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    if (u > 0.1 && u < 0.92 && (Math.abs(v + 0.5) < 0.08 || Math.abs(v + 0.05) < 0.08)) return Y;
    if (((Math.round(x) * 7 + Math.round(y) * 11 + 3) % 13 === 0) && Math.abs(v) < 0.85) return Y;
    return C;
  };
  drawDorid(g, {
    L: 48, H: 12, hump: 0.3, foot: 2.5, dome: 0.55, skin,
    footCol: ["#060c30", "#182870", "#2840a0", "#4060c0", "#7090e0"],
    margin: [[1, Y]],
    rhino: { x: 0.14, h: 6, col: ["#101c60", "#3050b8", "#f0c828", "#ffe860", "#fff8c0"] },
    gill: { x: 0.24, n: 7, r: 5.5, col: ["#101c60", "#3050b8", "#6080d8", "#f0c828", "#fff8c0"] },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 26, 3, hex("#02060e"), 0.4);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 16, 16, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -38, -28, 38, 18, hex("#5ab6d6"), 0.1);
}
