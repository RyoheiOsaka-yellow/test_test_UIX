import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Staghorn coral",
  ja: "スギノキミドリイシ",
  sci: "Acropora muricata",
  region: "Indo-Pacific reefs; Okinawa, Great Barrier Reef",
  length: "branches to 2 m",
  desc: "Antlers of coral: cylinders that branch and branch again, growing a hand's length a year, with a pale growing tip and a polyp in every bump. Thickets of it are nurseries for damselfish, and the first to be flattened by a typhoon.",
  jadesc: "鹿の角のようなサンゴ。円柱の枝が何度も分かれ、年に手のひら一枚分伸びる。先端は白っぽく、こぶの一つ一つがポリプ。茂みはスズメダイの保育所で、台風で真っ先になぎ倒される。",
  tags: ["coral", "hard coral", "acropora", "reef", "branching", "loop"],
  size: [72, 56],
  origin: [36, 50],
  floor: 0,
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a4a3a", "#7c7a5c", "#a8a680", "#cccaa4", "#ecead0"],
    tip: ["#4a6a98", "#6a90c0", "#98b8e0", "#c8e0f8", "#f0f8ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -50, 72, 56), BG = new Grid(-36, -50, 72, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), T = fit(o.tip, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, out = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -36, 36, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, off] of [[-14, -0.45, 0], [-2, -0.05, 1], [10, 0.3, 2], [20, 0.6, 3]])
    branch(g, x, -1, ang, 13, 3, t, D, {
      n: 2, spread: 0.42, shrink: 0.78, r: 2.4, rr: 0.9, cols: o.palette, k: 0, seed: o.seed + off, off,
      every: (g, bx, by, an, d, u) => { g.set(bx + Math.cos(an) * 1.8, by + Math.sin(an) * 1.8, out > 0.4 ? C[4] : C[3]); g.set(bx - Math.cos(an) * 1.8, by - Math.sin(an) * 1.8, C[1]); },
      tip: (g, tx, ty) => g.ellipse(tx, ty, 1.8, 2.2, (nx, ny) => (ny < -0.3 ? T[4] : T[3])),
    });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, 0, -20, 5, ["#1a3a5a", "#3a8ac8", "#a0d8ff"], o.seed, 12);
  bubbles(p, t, D, 2, o.seed * 7 + 91, 8, -24, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -48);
  if (o.scene !== false) caustics(p, t, D, -36, -50, 36, 0, hex("#8ee0c8"), 0.12);
}
