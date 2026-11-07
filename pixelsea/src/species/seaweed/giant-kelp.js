import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Giant kelp",
  ja: "ジャイアントケルプ",
  sci: "Macrocystis pyrifera",
  region: "California, Chile, South Africa, Australia, New Zealand",
  length: "30–45 m",
  desc: "The redwood of the sea, growing half a metre a day: a rope of stipe hung with blades, each held up by its own gas float, reaching from the rocks to a canopy on the surface. Sea otters wrap themselves in it to sleep.",
  jadesc: "海の巨木。一日に50 cmも伸び、葉のひとつひとつが自分の浮き袋で支えられ、岩から水面の天蓋まで届く。ラッコはこれに体を巻きつけて眠る。",
  tags: ["seaweed", "kelp", "brown", "forest", "california", "loop"],
  size: [64, 104],
  origin: [32, 96],
  floor: 0,
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#1c1a08", "#3a3410", "#605820", "#888030", "#b0a848"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -96, 64, 104), BG = new Grid(-32, -96, 64, 104);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x0, off, Hh, k] of [[-8, 0, 92, 1.1], [10, 1.1, 80, 1]]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const h = (i / 16) * Hh; pts.push([x0 + sway(t, D, h, k, off, o.seed), -1 - h]); }
    stipe(g, pts, 1, o.palette);
    for (let i = 2; i <= 15; i++) {
      const [x, y] = pts[i], side = i % 2 ? 1 : -1;
      bladder(g, x + side * 1.5, y, 1.6, ["#4a4018", "#7a6a30", "#a89448", "#d0bc60", "#f0e090"]);
      blade(g, x + side * 2.5, y - 0.5, 12, 3.2, side * 1.35, t, D, o.palette, { ripple: 0.8, freq: 3, taper: 0.8, k: 0.8, off: off + i, seed: o.seed, curl: side * -0.3 });
    }
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) { p.glowLine(-32, -96, 32, -96, 14, hex("#8ee0c8"), 0.1); bg.draw(p, 1); }
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, 0, -50, 4, ["#5a4a20", "#c0a050", "#ffe890"], o.seed, 12);
  bubbles(p, t, D, 3, o.seed * 7 + 76, 0, -40, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 16, -94);
  if (o.scene !== false) caustics(p, t, D, -32, -96, 32, 0, hex("#8ee0c8"), 0.08);
}
