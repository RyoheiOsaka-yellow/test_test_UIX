import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Organ pipe coral",
  ja: "クダサンゴ",
  sci: "Tubipora musica",
  region: "Indo-Pacific reefs; Okinawa, Red Sea",
  length: "colonies 10–30 cm",
  desc: "Under a fuzz of grey-green polyps hides a skeleton of blood-red tubes, bundled like the pipes of an organ and joined by floors. It is a soft coral that builds a hard one; the red skeleton washes up on beaches long after the polyps are gone.",
  jadesc: "灰緑色のポリプのふわふわの下に、血のように赤い管の束の骨格が隠れている。パイプオルガンのように並んだ管は床で繋がる。軟質サンゴなのに硬い骨を作り、赤い骨格は浜に打ち上げられる。",
  tags: ["coral", "soft coral", "red", "tubes", "reef", "loop"],
  size: [60, 44],
  origin: [30, 38],
  floor: 0,
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#5a0a0a", "#9a1a18", "#c83028", "#e05848", "#f09080"],
    polyp: ["#2a4a3a", "#4a7a5a", "#80ac88", "#b0d8b0", "#e8ffe0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -38, 60, 44), BG = new Grid(-30, -38, 60, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), P = fit(o.polyp, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU;
  if (o.scene !== false) rock(bg, -30, 30, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // a bundle of red tubes of different heights, floors joining them, a polyp crown opening on each
  const tubes = [];
  for (let i = 0; i < 13; i++) { const x = -24 + i * 4, h = 10 + 8 * Math.abs(Math.sin(i * 1.3 + o.seed)) + 4 * (i % 2); tubes.push([x, h]); }
  // the floors that join the tubes, only low down between neighbours
  for (let i = 0; i < tubes.length - 1; i++) for (let f = 4; f < Math.min(tubes[i][1], tubes[i + 1][1]) - 2; f += 5) g.line(tubes[i][0] + 1, -f, tubes[i + 1][0] - 1, -f, C[2]);
  for (const [x, h] of tubes) {
    g.tube([[x, 0], [x, -h]], 1.6, (u, d) => (d > 0.6 ? C[1] : C[3]));
    const k = 0.5 + 0.5 * Math.sin(ph + x * 0.3);
    polyp(g, x, -h - 1, 4, P, k, 8);
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 98, 0, -24, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -36);
  if (o.scene !== false) caustics(p, t, D, -30, -38, 30, 0, hex("#8ee0c8"), 0.12);
}
