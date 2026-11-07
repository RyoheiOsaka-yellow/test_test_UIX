import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Sea lettuce",
  ja: "アオサ",
  sci: "Ulva (Monostroma) spp.",
  region: "Rocky shores worldwide",
  length: "10–30 cm",
  desc: "Bright green sheets only two cells thick, crumpled over rocks and tide pools everywhere in the world. It grows fast where the water is rich, and dried and crumbled it is the green aonori on okonomiyaki.",
  jadesc: "細胞二層の薄さの鮮やかな緑の膜。世界中の岩や潮だまりにしわくちゃに広がる。栄養の多い水で急速に増え、乾かして砕けばお好み焼きの青のり。",
  tags: ["seaweed", "green", "intertidal", "worldwide", "food", "loop"],
  size: [64, 48],
  origin: [32, 42],
  floor: 0,
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0e3a14", "#1e6a24", "#38a038", "#68cc50", "#b0f080"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -42, 64, 48), BG = new Grid(-32, -42, 64, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, L, W, off] of [[-18, -0.5, 14, 13, 0], [-6, -0.15, 18, 15, 1], [8, 0.2, 16, 14, 2], [20, 0.55, 12, 11, 3], [1, 0.05, 11, 9, 4]])
    blade(g, x, -1, L, W, ang, t, D, o.palette, { ripple: 2.2, freq: 3, taper: 0.1, k: 1.2, off, seed: o.seed, curl: ang * 0.5, a: 0.9 });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]), 0.9);
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 74, 0, -16, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -32, -42, 32, 0, hex("#8ee0c8"), 0.12);
}
