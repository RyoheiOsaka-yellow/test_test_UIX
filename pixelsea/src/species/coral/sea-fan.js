import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Sea fan",
  ja: "ウミウチワ",
  sci: "Annella mollis",
  region: "Indo-Pacific; Okinawa, Andaman Sea, Red Sea",
  length: "1–2 m",
  desc: "A gorgonian that grows as a single flat fan set across the current, a lattice of branches that join and rejoin, every strand lined with tiny polyps sieving plankton. Pygmy seahorses live on its surface, disguised as its knobs.",
  jadesc: "流れを横切るように一枚の平たい扇に育つヤギ類。枝が繋がり合って格子になり、全ての枝に小さなポリプが並んでプランクトンを濾す。表面にはこぶに化けたピグミーシーホースが住む。",
  tags: ["coral", "gorgonian", "fan", "current", "wall", "loop"],
  size: [72, 64],
  origin: [36, 58],
  floor: 0,
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a2810", "#a04a18", "#d87028", "#f09848", "#ffc890"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -58, 72, 64), BG = new Grid(-36, -58, 72, 64);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -36, 36, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [ang, off] of [[-0.9, 0], [-0.45, 1], [0, 2], [0.45, 3], [0.9, 4]])
    branch(g, 0, -3, ang, 12, 5, t, D, { n: 2, spread: 0.38, shrink: 0.78, r: 1.3, rr: 0.9, cols: o.palette, k: 0.35, seed: o.seed + off, off, bend: 0.02 });
  g.tube([[0, 0], [0, -4]], 2, (u, d) => (d > 0.7 ? C[0] : C[1]));
  // cross links knit the fan into a lattice; polyps speckle it
  g.recolor((x, y, c) => (rand(Math.round(x), Math.round(y), 64) < 0.18 ? C[4] : c));
  for (let y = -52; y < -8; y += 5) for (let x = -34; x < 34; x += 2) if (g.get(x, y) && !g.get(x + 1, y) && g.get(x + 3, y)) { g.set(x + 1, y, C[2]); g.set(x + 2, y, C[2]); }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 96, 0, -30, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -56);
  if (o.scene !== false) caustics(p, t, D, -36, -58, 36, 0, hex("#5ab6d6"), 0.08);
}
