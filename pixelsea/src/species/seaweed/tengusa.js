import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Agar weed",
  ja: "マクサ（テングサ）",
  sci: "Gelidium elegans",
  region: "Japan, Korea (rocky subtidal)",
  length: "10–30 cm",
  desc: "A wiry, finely branched red weed from the rocks below the tide. Boiled and strained, its jelly sets into tokoroten and kanten (agar), the same gel every microbiology lab grows its cultures on.",
  jadesc: "潮下帯の岩に生える針金のように細かく枝分かれした紅藻。煮出して固めればところてんや寒天になり、同じ寒天が世界中の実験室で培地として使われている。",
  tags: ["seaweed", "red", "japan", "agar", "food", "loop"],
  size: [56, 48],
  origin: [28, 42],
  floor: 0,
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a0a12", "#5a1828", "#8a2c40", "#b84858", "#e07a88"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -42, 56, 48), BG = new Grid(-28, -42, 56, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -28, 28, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, off] of [[-12, -0.4, 0], [-3, -0.1, 1], [5, 0.15, 2], [13, 0.45, 3]])
    branch(g, x, -1, ang, 9, 5, t, D, { n: 2, spread: 0.45, shrink: 0.74, r: 1.1, rr: 0.9, cols: o.palette, k: 0.8, seed: o.seed + off, off });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 75, 0, -20, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -28, -42, 28, 0, hex("#8ee0c8"), 0.12);
}
