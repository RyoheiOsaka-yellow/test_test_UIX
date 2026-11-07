import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Table coral",
  ja: "テーブル状ミドリイシ",
  sci: "Acropora hyacinthus",
  region: "Indo-Pacific reefs; Okinawa, Great Barrier Reef",
  length: "1–3 m across",
  desc: "A dinner table of coral on a short stalk, its top a lawn of tiny upturned branchlets, each tipped with a polyp. Fast-growing and first to bleach, it makes the roof under which half a reef's small fish shelter.",
  jadesc: "短い柱の上に広がる食卓のようなサンゴ。天板は上を向いた小枝の芝生で、その先端ひとつひとつにポリプがある。成長が速く白化にも弱いが、礁の小魚の半分がこの屋根の下に隠れる。",
  tags: ["coral", "hard coral", "acropora", "reef", "table", "loop"],
  size: [80, 48],
  origin: [40, 42],
  floor: 0,
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a4030", "#7a6c4a", "#a89a6c", "#cfc28e", "#eee4b8"],
    tip: ["#3a3070", "#5a50a8", "#8878d0", "#b0a0f0", "#e0d8ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -42, 80, 48), BG = new Grid(-40, -42, 80, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), T = fit(o.tip, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, out = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -40, 40, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // the stalk, then the plate: a flattened disc seen from a little above, branchlets as a stubble on top
  g.tube([[-2, 0], [0, -12]], 4, (u, d) => (d > 0.7 ? C[1] : C[2]));
  g.ellipse(0, -14, 34, 5.5, (nx, ny) => (ny > 0.4 ? C[1] : ny > -0.2 ? C[2] : C[3]));
  for (let x = -32; x <= 32; x += 2) {
    const ny = -Math.sqrt(Math.max(0, 1 - (x / 34) ** 2)) * 4.5 - 14 + ((x / 2) % 2) * 0.8;
    g.set(x, ny - 1, C[3]); g.set(x, ny - 2, Math.abs(x) > 24 ? T[3] : C[4]);
    if (out > 0.5 && (x / 2) % 3 === 0) g.set(x, ny - 3, T[4]);
  }
  for (let x = -33; x <= 33; x += 3) g.set(x, -14 + Math.sqrt(Math.max(0, 1 - (x / 34) ** 2)) * 5, C[1]);
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, 0, -5, 4, ["#1a3a5a", "#3a8ac8", "#a0d8ff"], o.seed, 14);
  bubbles(p, t, D, 2, o.seed * 7 + 90, 10, -20, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -40, -42, 40, 0, hex("#8ee0c8"), 0.12);
}
