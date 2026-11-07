import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Anna's chromodoris",
  ja: "アンナウミウシ",
  sci: "Chromodoris annae",
  region: "Western Pacific (Philippines, Indonesia, Okinawa)",
  length: "4 cm",
  desc: "The poster nudibranch of the Coral Triangle: a sky-blue mantle pricked with black, ruled with black lines and hemmed in white and orange, with orange rhinophores and gills to match.",
  jadesc: "コーラルトライアングルを代表するウミウシ。黒い点と線を散らした空色の外套膜を、白とオレンジの縁取りが囲む。触角とエラも同じオレンジ。",
  tags: ["nudibranch", "dorid", "blue", "reef", "loop"],
  size: [64, 44],
  origin: [30, 26],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0c2a6a", "#1c54b8", "#3a8ae0", "#6cb8f4", "#b8e4ff"],
    rim: ["#6a3000", "#c86a08", "#f09018", "#ffb840", "#ffe090"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -24, 64, 42);
const BLACK = ["#06080e", "#101420", "#1a2030", "#283040", "#384050"], WHITE = ["#8a9aa8", "#c8d4e0", "#eef4f8", "#ffffff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), RIM = fit(o.rim, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    // black speckles and two long black lines down the back
    if (Math.abs(v + 0.2) < 0.1 && u > 0.2 && u < 0.85) return BLACK;
    if (((Math.round(x) * 7 + Math.round(y) * 13) % 11 === 0) && Math.abs(v) < 0.75) return BLACK;
    return C;
  };
  drawDorid(g, {
    L: 38, H: 12, hump: 0.3, foot: 2.5, skin,
    footCol: ["#0c2a6a", "#2a5aa0", "#4a80c0", "#80b0e0", "#b0d8f0"],
    margin: [[1, RIM], [1, WHITE]],
    rhino: { x: 0.2, h: 6, col: RIM },
    gill: { x: 0.2, n: 7, r: 4.5, col: RIM },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 20, 3, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 1, 12, -8, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -22);
  if (o.scene !== false) caustics(p, t, D, -32, -24, 32, 18, hex("#8ee0c8"), 0.12);
}
