import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Red gorgonian",
  ja: "イソバナ",
  sci: "Melithaea japonica",
  region: "Japan (Sagami Bay, Izu, Kii), Korea",
  length: "30–60 cm",
  desc: "The 'shore flower' of Japanese dive sites: a red or orange fan of branches that bloom white when the polyps open, usually on a current-swept wall with a school of anthias in front of it.",
  jadesc: "ダイビングスポットでおなじみの「磯の花」。赤や橙の枝の扇が、ポリプの開く夜や流れのある時に白く花咲く。潮通しのよい壁に付き、前にはキンギョハナダイの群れ。",
  tags: ["coral", "gorgonian", "red", "japan", "wall", "loop"],
  size: [64, 56],
  origin: [32, 50],
  floor: 0,
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a0a14", "#a01828", "#d83040", "#f06060", "#ffa0a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -50, 64, 56), BG = new Grid(-32, -50, 64, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, open = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -32, 32, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x, ang, off] of [[-8, -0.5, 0], [0, -0.1, 1], [8, 0.4, 2]])
    branch(g, x, -1, ang, 11, 5, t, D, { n: 2, spread: 0.5, shrink: 0.76, r: 1.5, rr: 0.9, cols: o.palette, k: 0.4, seed: o.seed + off, off });
  g.recolor((x, y, c) => (rand(Math.round(x), Math.round(y), 65) < 0.22 * open ? hex("#fff0f0") : c));
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, -14, -30, 5, ["#8a3010", "#f08030", "#ffd0a0"], o.seed, 10);
  bubbles(p, t, D, 2, o.seed * 7 + 97, 0, -28, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -48);
  if (o.scene !== false) caustics(p, t, D, -32, -50, 32, 0, hex("#5ab6d6"), 0.08);
}
