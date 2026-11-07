import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Brain coral",
  ja: "キクメイシ",
  sci: "Dipsastraea speciosa",
  region: "Indo-Pacific reefs; Okinawa, Kii Peninsula",
  length: "30 cm – 1 m",
  desc: "A dome tiled with chrysanthemum-eye cups (kikume-ishi), each a polyp's home with its own ring of tentacles, the walls between them brown and the centres green or grey. By night every cup blooms.",
  jadesc: "菊の花のような杯が敷き詰められたドーム。杯の一つ一つがポリプの住まいで、壁は褐色、中心は緑や灰色。夜になると杯のすべてが触手を広げて咲く。",
  tags: ["coral", "hard coral", "massive", "reef", "night", "loop"],
  size: [64, 44],
  origin: [32, 38],
  floor: 0,
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a2a18", "#6a5030", "#9a7848", "#c0a068", "#e0c898"],
    eye: ["#143a2a", "#2a6a48", "#48a070", "#80d0a0", "#c0f8d8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -38, 64, 44), BG = new Grid(-32, -38, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), E = fit(o.eye, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, bloom = Math.max(0, Math.sin(ph - 0.5));
  if (o.scene !== false) rock(bg, -32, 32, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // cells: a staggered grid of cups over the dome; walls brown, centres green; tentacles bloom out of them
  const cell = (x, y) => { const gy = Math.round(y / 4), gx = Math.round((x + (gy % 2) * 2.5) / 5); return [gx, gy]; };
  dome(g, 0, 0, 30, 30, o.palette, (x, y) => {
    const [gx, gy] = cell(x, y), cx = gx * 5 - (gy % 2) * 2.5, cy = gy * 4, d = Math.hypot((x - cx) / 2.6, (y - cy) / 2);
    return d < 0.45 ? ["#0c2a1c", "#143a2a", "#1e5038", "#2a6a48", "#3a8058"] : d < 0.85 ? E : o.palette;
  });
  if (bloom > 0.1) g.recolor((x, y, c) => {
    const [gx, gy] = cell(x, y), cx = gx * 5 - (gy % 2) * 2.5, cy = gy * 4, d = Math.hypot((x - cx) / 2.6, (y - cy) / 2);
    return d < 0.95 && d > 0.3 && rand(Math.round(x), Math.round(y), 62) < bloom * 0.7 ? E[4] : c;
  });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 93, 0, -26, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -36);
  if (o.scene !== false) caustics(p, t, D, -32, -38, 32, 0, hex("#8ee0c8"), 0.12);
}
