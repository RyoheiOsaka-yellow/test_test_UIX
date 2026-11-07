import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Hijiki",
  ja: "ヒジキ",
  sci: "Sargassum fusiforme",
  region: "Japan, Korea, China (rocky intertidal)",
  length: "50 cm – 1 m",
  desc: "A bushy brown weed of wave-washed rocks, its branches strung with small swollen leaflets like beads. Harvested in spring, boiled and dried, it turns jet black and becomes the hijiki of simmered side dishes.",
  jadesc: "波の当たる岩に生える褐色の藻。枝には数珠のようにふくらんだ小さな葉が並ぶ。春に刈り取り、煮て干すと真っ黒になり、煮物のヒジキになる。",
  tags: ["seaweed", "brown", "japan", "intertidal", "food", "loop"],
  size: [64, 56],
  origin: [32, 50],
  floor: 0,
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#14100a", "#2c2414", "#4a3c20", "#6a5830", "#8c7644"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -50, 64, 56), BG = new Grid(-32, -50, 64, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, len, off] of [[-14, -0.25, 13, 0], [-5, -0.1, 16, 1], [4, 0.05, 15, 2], [13, 0.2, 12, 3]])
    branch(g, x, -1, ang, len, 3, t, D, {
      n: 2, spread: 0.22, shrink: 0.85, r: 1.1, cols: o.palette, k: 0.7, seed: o.seed + off, off,
      every: (g, bx, by, an, d, u) => { const side = Math.round(u * 10) % 2 ? 1 : -1; g.ellipse(bx + side * Math.cos(an) * 2, by + side * Math.sin(an) * 2, 1.3, 1, (nx, ny) => (nx + ny < -0.5 ? C[4] : C[3])); },
      tip: (g, tx, ty) => g.ellipse(tx, ty, 1.3, 1.2, (nx, ny) => (nx + ny < -0.5 ? C[4] : C[3])),
    });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 72, 4, -26, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -48);
  if (o.scene !== false) caustics(p, t, D, -32, -50, 32, 0, hex("#8ee0c8"), 0.1);
}
