import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Nori laver",
  ja: "スサビノリ",
  sci: "Neopyropia yezoensis",
  region: "Japan, Korea, China (cultivated on nets)",
  length: "15–30 cm",
  desc: "The purple-red sheets of sushi nori, a single cell thick, that grow on rocks and nets where they are left high and dry at every low tide. Its whole life cycle was unknown until a British botanist found its hidden shell-boring stage in 1949.",
  jadesc: "寿司の海苔。細胞一層の紫紅色の膜で、干潮のたびに空気にさらされる岩や網に育つ。貝殻の中に潜む世代があることは1949年に英国の植物学者が発見するまで謎だった。",
  tags: ["seaweed", "red", "japan", "intertidal", "food", "loop"],
  size: [64, 48],
  origin: [32, 40],
  floor: 0,
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#1a0a1a", "#3a1838", "#602a58", "#884878", "#b070a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -40, 64, 48), BG = new Grid(-32, -40, 64, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, L, W, off] of [[-20, -0.6, 18, 9, 0], [-9, -0.25, 24, 11, 1], [3, 0.1, 26, 12, 2], [15, 0.4, 20, 10, 3], [24, 0.7, 14, 8, 4]])
    blade(g, x, -1, L, W, ang, t, D, o.palette, { ripple: 2, freq: 2.5, taper: 0.2, k: 1.4, off, seed: o.seed, curl: ang * 0.4, a: 0.8 });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]), 0.8);
  if (o.scene !== false) { p.glowLine(-32, -40, 32, -40, 10, hex("#a8e6f0"), 0.12); bg.draw(p, 1); }
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 77, 0, -14, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -38);
  if (o.scene !== false) caustics(p, t, D, -32, -40, 32, 0, hex("#8ee0c8"), 0.14);
}
