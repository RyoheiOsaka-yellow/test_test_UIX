import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Kajime kelp",
  ja: "カジメ",
  sci: "Ecklonia cava",
  region: "Pacific coast of Japan, Korea",
  length: "1–2 m",
  desc: "A small tree of a kelp: a stiff stalk a metre tall topped with a crown of pinnate blades. Beds of it are the 'seaweed forests' (moba) where abalone, turban snails and rockfish grow up, and where urchin barrens begin when the forest dies.",
  jadesc: "小さな木のような海藻。1 mほどの硬い茎の上に羽状の葉が冠のように広がる。アワビやサザエ、根魚が育つ「藻場」をつくり、これが枯れると磯焼けが始まる。",
  tags: ["seaweed", "kelp", "brown", "japan", "forest", "loop"],
  size: [72, 72],
  origin: [36, 66],
  floor: 0,
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a160a", "#363012", "#5a5020", "#807430", "#a89c48"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -66, 72, 72), BG = new Grid(-36, -66, 72, 72);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -36, 36, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  for (const [x0, Hh, off, s] of [[-14, 22, 1.5, 0.8], [4, 32, 0, 1]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const h = (i / 6) * Hh; pts.push([x0 + sway(t, D, h, 0.4, off, o.seed), -1 - h]); }
    stipe(g, pts, 1.8 * s, ["#1a160a", "#2e2810", "#463c18", "#5e5224", "#766a30"]);
    const [cx, cy] = pts[6];
    // the crown: a central blade and side blades, each pinnate with bladelets
    for (const [ang, L] of [[-1.1, 16], [-0.55, 20], [0, 24], [0.5, 20], [1.05, 16]]) {
      const bp = blade(g, cx, cy, L * s, 4 * s, ang, t, D, o.palette, { ripple: 0.5, freq: 2, taper: 0.7, k: 1, off: off + ang, seed: o.seed, curl: ang * 0.3, midrib: true });
      for (let i = 2; i < 11; i += 2) {
        const [bx, by, an] = bp[i], side = (i / 2) % 2 ? 1 : -1;
        blade(g, bx, by, 6 * s, 2.2 * s, an + side * 1.2, t, D, o.palette, { ripple: 0.3, taper: 0.9, k: 0.6, off: off + i, seed: o.seed });
      }
    }
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, -20, -36, 2, ["#3a2a1a", "#8a6a40", "#e0c090"], o.seed, 8);
  bubbles(p, t, D, 2, o.seed * 7 + 79, 6, -30, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -64);
  if (o.scene !== false) caustics(p, t, D, -36, -66, 36, 0, hex("#8ee0c8"), 0.1);
}
