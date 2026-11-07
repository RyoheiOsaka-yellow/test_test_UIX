import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Nomura's jellyfish",
  ja: "エチゼンクラゲ",
  sci: "Nemopilema nomurai",
  region: "Yellow Sea, East China Sea, Sea of Japan",
  length: "bell 2 m, 200 kg",
  desc: "A jellyfish the size of a refrigerator: a dull brown bell two metres across and two hundred kilos, with a cauliflower of oral arms below instead of long tentacles. In bloom years they drift into the Sea of Japan by the million and burst fishing nets.",
  jadesc: "冷蔵庫ほどの大きさのクラゲ。くすんだ茶色の傘は直径2 m、重さ200 kg。長い触手はなく、下にはカリフラワーのような口腕の塊。大発生の年には何百万匹が日本海に流れ込み、定置網を破る。",
  tags: ["jellyfish", "cnidaria", "giant", "japan", "bloom", "loop"],
  size: [96,80],
  origin: [48,28],
  duration: 5.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a2c20", "#6a5440", "#9a8060", "#c0a888", "#e0d0b8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -28, 96, 80);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const k = beat(t, D, 1), y = lift(t, D, 1, 0, 3);
  const b = bell(g, 40, 22, k, o.palette, (x, yy, nx, ny) => (rand(Math.round(x / 3), Math.round(yy / 3), 90) < 0.2 ? ["#4a3c30", "#7a6450", "#a89070", "#c8b098", "#e8d8c0"] : 0), { a: 0.9, frill: 12, dome: 0.75 });
  // the cauliflower of oral arms: lumpy clusters hanging under the bell
  for (let i = 0; i < 9; i++) { const u = -1 + (i / 8) * 2, x = u * 22, Lh = 18 + 10 * (1 - Math.abs(u)); g.tube([[x, 1], [x + u * 3 + Math.sin((t / D) * TAU * 2 + i) * 1.5, 1 + Lh]], (v) => 3.2 - v * 1.2, (v, d) => (d > 0.6 ? C[1] : C[2]), 0.9); for (let s = 0.3; s < 1; s += 0.2) g.ellipse(x + u * 3 * s + (i % 2 ? 2 : -2), 1 + Lh * s, 2.2, 1.8, (nx, ny) => (ny < -0.3 ? C[3] : C[2]), 0.9); }
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.8);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, y);
  // a diver for scale, far behind
  if (o.scene !== false) { for (let i = 0; i < 7; i++) p.blend(40 + (i > 4 ? 1 : 0), 14 + i, hex("#3a3a44"), 0.5); p.blend(41, 13, hex("#3a3a44"), 0.5); }
  bubbles(p, t, D, 2, o.seed * 7 + 132, 20, 14, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -26);
}
