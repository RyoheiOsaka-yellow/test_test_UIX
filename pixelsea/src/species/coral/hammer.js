import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Hammer coral",
  ja: "ナガレハナサンゴ",
  sci: "Fimbriaphyllia ancora",
  region: "Indo-Pacific reefs, sheltered lagoons",
  length: "colonies to 1 m",
  desc: "A coral that hides its skeleton under a mop of long tentacles, each ending in a T-shaped anchor or hammer, in green, tan and cream, all swaying together in the current like a field of grass. The tentacles sting their neighbours to hold ground.",
  jadesc: "骨格を長い触手の房で覆い隠すサンゴ。触手の先はT字の錨や槌の形で、緑やベージュ、クリーム色。草原のようにいっせいに揺れ、隣のサンゴを刺して縄張りを守る。",
  tags: ["coral", "hard coral", "euphyllia", "tentacles", "reef", "loop"],
  size: [72, 44],
  origin: [36, 38],
  floor: 0,
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#2a3a1a", "#4a6a28", "#78a040", "#a8d060", "#e0f8a0"],
    tip: ["#6a6a40", "#a0a060", "#d0d090", "#f0f0c0", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -38, 72, 44), BG = new Grid(-36, -38, 72, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), T = fit(o.tip, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -36, 36, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // the skeleton base, then rows of tentacles, the back row darker, each with its hammer head
  dome(g, 0, 0, 30, 8, ["#4a4a40", "#7a7a6c", "#a0a090", "#c0c0b0", "#e0e0d0"]);
  for (const [row, dy, dim] of [[0, -4, 0.35], [1, -2, 0.15], [2, 0, 0]])
    for (let i = 0; i < 12; i++) {
      const x = -30 + i * 5.4 + (row % 2) * 2.5, Lh = 14 + 4 * Math.abs(Math.sin(i * 1.7 + row)), off = i * 0.4 + row;
      const pts = [];
      for (let k = 0; k <= 4; k++) { const h = (k / 4) * Lh; pts.push([x + sway(t, D, h, 1.6, off, o.seed), dy - 2 - h]); }
      const cols = o.palette.map((c) => c);
      g.tube(pts, 1.1, (u, d) => (d > 0.6 ? C[1] : C[2 + (u > 0.5 ? 1 : 0)]), 1 - dim * 0.1, 1);
      const [tx, ty] = pts[4];
      g.line(tx - 2.5, ty - 0.5, tx + 2.5, ty - 0.5, T[3]); g.line(tx - 2.5, ty - 1.5, tx + 2.5, ty - 1.5, T[4]); g.set(tx, ty - 2, T[4]);
      if (dim) for (const [px, py] of pts) g.recolor((xx, yy, c) => c);
    }
  g.recolor((x, y, c) => (y < -4 && rand(Math.round(x), Math.round(y), 63) < 0.05 ? C[4] : c));
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 94, 0, -22, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -36);
  if (o.scene !== false) caustics(p, t, D, -36, -38, 36, 0, hex("#8ee0c8"), 0.12);
}
