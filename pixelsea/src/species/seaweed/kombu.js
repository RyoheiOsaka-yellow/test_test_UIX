import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Kombu kelp",
  ja: "マコンブ",
  sci: "Saccharina japonica",
  region: "Hokkaido, northern Japan, Russian Far East",
  length: "3–6 m",
  desc: "The kelp of dashi: long leathery ribbons, olive-brown and wrinkled, anchored to cold rocks by a claw of a holdfast. Dried, it is the base of Japanese soup stock; alive, it is a forest where young fish and urchins live.",
  jadesc: "出汁の昆布。オリーブ褐色でしわの寄った革のような長いリボンが、爪のような付着器で冷たい岩に根を張る。乾けば和食の出汁の要、生きていれば稚魚やウニの住む森。",
  tags: ["seaweed", "kelp", "brown", "japan", "food", "loop"],
  size: [72, 72],
  origin: [36, 64],
  floor: 0,
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#1e1808", "#3e3214", "#6a5422", "#947a34", "#c0a450"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -64, 72, 72), BG = new Grid(-36, -64, 72, 72);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -36, 36, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // the holdfast, then three long ribbons leaning with the current, the back one dimmer
  for (const [x, ang, L, W, off, k] of [[4, 0.35, 58, 11, 2, 1.1], [-6, -0.1, 52, 10, 0, 1], [-1, 0.15, 60, 12, 1, 1.2]]) {
    const pts = blade(g, x, -1, L, W, ang, t, D, o.palette, { ripple: 1.6, freq: 4, taper: 0.5, k, off, seed: o.seed, curl: 0.25, midrib: true });
    // wrinkles along the blade
    for (let i = 2; i < 11; i += 2) g.set(pts[i][0] + 2, pts[i][1] + 1, C[1]);
  }
  for (let i = -5; i <= 5; i += 2) g.line(0, -1, i, 1.5, C[1]);
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 70, 8, -30, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -62);
  if (o.scene !== false) caustics(p, t, D, -36, -64, 36, 0, hex("#8ee0c8"), 0.1);
}
