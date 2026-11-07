import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Carnation tree coral",
  ja: "ウミトサカ（トゲトサカ）",
  sci: "Dendronephthya sp.",
  region: "Indo-Pacific; Izu, Okinawa, Red Sea walls and overhangs",
  length: "30 cm – 1 m",
  desc: "A soft coral like a tree of glass: translucent stems in pink, purple or orange, stiffened by spicules that show through as spines, with clusters of eight-armed polyps at every tip. It swells with water to feed in the current and shrinks to a nub when it stops.",
  jadesc: "ガラスの木のような軟質サンゴ。ピンクや紫、橙の半透明の幹に、骨片がトゲとなって透けて見え、枝先には八本腕のポリプの房。流れがあると水を吸って膨らみ、止まると小さくしぼむ。",
  tags: ["coral", "soft coral", "pink", "wall", "current", "loop"],
  size: [64, 60],
  origin: [32, 54],
  floor: 0,
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a1040", "#8a2878", "#c850b0", "#f088e0", "#ffc8f8"],
    polyp: ["#6a2a00", "#c06010", "#f09030", "#ffc060", "#fff0b0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -54, 64, 60), BG = new Grid(-32, -54, 64, 60);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), P = fit(o.polyp, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, swell = 0.85 + 0.15 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -32, 32, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  branch(g, 0, -1, 0, 16 * swell, 3, t, D, {
    n: 3, spread: 0.6, shrink: 0.7, r: 3.2, rr: 0.85, cols: o.palette, k: 0.5, seed: o.seed, a: 0.88,
    every: (g, bx, by, an, d, u) => { if (u > 0.5) { g.set(bx + Math.cos(an) * 2, by + Math.sin(an) * 2, C[4]); g.set(bx - Math.cos(an) * 2, by - Math.sin(an) * 2, C[4]); } },
    tip: (g, tx, ty, an) => { for (let k = 0; k < 5; k++) { const a2 = an - 1.2 + k * 0.6; g.line(tx, ty, tx + Math.sin(a2) * 3.5 * swell, ty - Math.cos(a2) * 3.5 * swell, (u) => (u > 0.6 ? P[4] : P[3]), 1, 1); } g.set(tx, ty, P[2]); },
  });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]), 0.9);
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  p.glow(0, -26, 24, hex("#c850b0"), 0.06);
  bubbles(p, t, D, 2, o.seed * 7 + 95, 4, -30, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -52);
  if (o.scene !== false) caustics(p, t, D, -32, -54, 32, 0, hex("#5ab6d6"), 0.08);
}
