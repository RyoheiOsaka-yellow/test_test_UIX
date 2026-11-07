import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Sargassum weed",
  ja: "アカモク（ホンダワラ類）",
  sci: "Sargassum horneri",
  region: "Japan, Korea, China; drifts across the North Pacific",
  length: "3–7 m",
  desc: "A brown weed that stands up from the bottom on strings of gas-filled floats, then tears free in spring and drifts in great rafts that shelter young fish, flying-fish eggs and sea turtles out in the open ocean.",
  jadesc: "ガスの入った浮き袋を連ねて海底から立ち上がる褐藻。春にちぎれて「流れ藻」となり、大きな筏になって外洋を漂い、稚魚やトビウオの卵、ウミガメの隠れ家になる。",
  tags: ["seaweed", "brown", "float", "japan", "drift", "loop"],
  size: [64, 80],
  origin: [32, 72],
  floor: 0,
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#1c160a", "#3a2e14", "#5e4c22", "#846a30", "#aa8c44"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -72, 64, 80), BG = new Grid(-32, -72, 64, 80);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // two main stems, each a stack of swaying segments with leaflets and a float every so often
  for (const [x0, off, Hh] of [[-6, 0, 64], [8, 1.3, 52]]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const h = (i / 12) * Hh; pts.push([x0 + sway(t, D, h, 1.3, off, o.seed), -1 - h]); }
    stipe(g, pts, 1, o.palette);
    for (let i = 1; i < 12; i++) {
      const [x, y] = pts[i], side = i % 2 ? 1 : -1;
      blade(g, x, y, 7, 2.4, side * 1.2, t, D, o.palette, { ripple: 0.3, taper: 0.9, k: 0.6, off: off + i, seed: o.seed, curl: side * 0.4 });
      if (i % 3 === 0) bladder(g, x - side * 2, y - 1.5, 1.8, ["#4a3a18", "#7a6030", "#a88a48", "#d0b060", "#f0dc90"]);
    }
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, 2, -40, 3, ["#1a3a5a", "#3a8ac8", "#a0d8ff"], o.seed, 9);
  bubbles(p, t, D, 2, o.seed * 7 + 73, 0, -40, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -70);
  if (o.scene !== false) caustics(p, t, D, -32, -72, 32, 0, hex("#8ee0c8"), 0.1);
}
