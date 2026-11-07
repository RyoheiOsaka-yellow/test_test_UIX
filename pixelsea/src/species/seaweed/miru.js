import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Dead man's fingers",
  ja: "ミル",
  sci: "Codium fragile",
  region: "Japan and the North Pacific; spread worldwide",
  length: "20–40 cm",
  desc: "Dark green, velvety, forking fingers of weed, spongy to the touch: a single huge cell woven from countless filaments. The 'mirugai' clam is named for hiding under it, and its colour (miru-iro) was a dye shade of old Japan.",
  jadesc: "深緑でビロードのような手触りの、二股に分かれる指のような海藻。無数の糸が織りなす一個の巨大な細胞。ミルクイ（海松貝）の名はこの藻の下に隠れることから、海松色は平安の昔からの色名。",
  tags: ["seaweed", "green", "japan", "velvet", "loop"],
  size: [56, 52],
  origin: [28, 46],
  floor: 0,
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a1e0e", "#163a1a", "#265a28", "#3a7a38", "#58a050"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -46, 56, 52), BG = new Grid(-28, -46, 56, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -28, 28, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, off] of [[-8, -0.3, 0], [6, 0.2, 1]])
    branch(g, x, -1, ang, 11, 4, t, D, { n: 2, spread: 0.5, shrink: 0.8, r: 2.6, rr: 0.95, cols: o.palette, k: 0.4, seed: o.seed + off, off, tip: (g, tx, ty) => g.ellipse(tx, ty, 1.6, 1.6, (nx, ny) => (nx + ny < -0.5 ? C[4] : C[3])) });
  // velvet: a dusting of lighter dots
  g.recolor((x, y, c) => (rand(Math.round(x), Math.round(y), 61) < 0.12 ? C[4] : c));
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 80, 0, -22, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -44);
  if (o.scene !== false) caustics(p, t, D, -28, -46, 28, 0, hex("#8ee0c8"), 0.12);
}
