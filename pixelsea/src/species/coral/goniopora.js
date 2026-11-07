import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Flowerpot coral",
  ja: "ハナガササンゴ",
  sci: "Goniopora sp.",
  region: "Indo-Pacific reefs, turbid lagoons",
  length: "colonies 20–50 cm",
  desc: "A stony coral that looks like a bouquet: by day every polyp stretches out on a long stalk, a ring of twenty-four tentacles opening at its tip like a daisy, so the whole dome becomes a swaying pot of flowers that vanishes into the rock when touched.",
  jadesc: "花束のような硬質サンゴ。昼間、ポリプの一つ一つが長い柄を伸ばし、先端に24本の触手がヒナギクのように開く。ドーム全体が揺れる花の鉢になり、触れると一瞬で岩の中に消える。",
  tags: ["coral", "hard coral", "flowers", "polyps", "reef", "loop"],
  size: [64, 48],
  origin: [32, 42],
  floor: 0,
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a3a24", "#4a6a3a", "#789a58", "#a8c880", "#d8f0b0"],
    flower: ["#6a2a50", "#a84a80", "#d878b0", "#f0a8d0", "#fff0f8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -42, 64, 48), BG = new Grid(-32, -42, 64, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), F = fit(o.flower, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, out = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(ph));
  if (o.scene !== false) rock(bg, -32, 32, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  dome(g, 0, 0, 26, 14, ["#3a3a30", "#5a5a48", "#7a7a60", "#9a9a78", "#b8b890"]);
  for (let i = 0; i < 16; i++) {
    const x = -24 + i * 3.2 + (i % 2) * 1, base = -14 * Math.sqrt(Math.max(0, 1 - (x / 26) ** 2)) + 1, L = (6 + 8 * ((i * 7) % 4) / 3) * out;
    const pts = [];
    for (let k = 0; k <= 3; k++) { const h = (k / 3) * L; pts.push([x + sway(t, D, h, 1.2, i * 0.5, o.seed), base - h]); }
    g.tube(pts, 0.9, (u, d) => (d > 0.6 ? C[1] : C[3]));
    const [tx, ty] = pts[3];
    polyp(g, tx, ty, 2.6 * out, F, 1, 7, 1, 1, -Math.PI / 2);
    g.set(tx, ty, F[1]);
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 101, 0, -28, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -32, -42, 32, 0, hex("#8ee0c8"), 0.12);
}
