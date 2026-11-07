import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Wakame",
  ja: "ワカメ",
  sci: "Undaria pinnatifida",
  region: "Japan, Korea, China; invasive worldwide",
  length: "1–2 m",
  desc: "The seaweed in your miso soup: a feathery brown blade cut into lobes along a midrib, with a frilled, spore-bearing ruffle (mekabu) at its base. Native to Japan's coasts, it has ridden ships to Europe, New Zealand and California.",
  jadesc: "味噌汁のワカメ。中肋に沿って羽のように切れ込む褐色の葉と、根元のひだひだの胞子葉（めかぶ）。日本の海の在来種だが、船に乗って欧州やニュージーランド、カリフォルニアに広がった。",
  tags: ["seaweed", "kelp", "brown", "japan", "food", "loop"],
  size: [64, 68],
  origin: [32, 60],
  floor: 0,
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#182010", "#2e3e1c", "#4e6428", "#728c38", "#9ab050"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -60, 64, 68), BG = new Grid(-32, -60, 64, 68);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 32, 0, 8, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // the midrib runs up as a stipe; lobes fan off it on both sides; the mekabu ruffles at the foot
  const mid = [];
  for (let i = 0; i <= 10; i++) { const h = i * 5; mid.push([sway(t, D, h, 1, 0, o.seed) * 0.9 + h * 0.06, -2 - h]); }
  for (let i = 1; i <= 9; i++) {
    const [x, y] = mid[i], side = i % 2 ? 1 : -1, L = 14 - Math.abs(i - 5) * 1.2;
    blade(g, x, y, L, 5.5, side * (1.1 - i * 0.05), t, D, o.palette, { ripple: 0.6, freq: 1.5, taper: 0.8, k: 0.8, off: i * 0.5, seed: o.seed, curl: side * 0.2 });
  }
  stipe(g, mid, 1.3, o.palette);
  for (let k = 0; k < 6; k++) blade(g, -4 + k * 1.6, -1, 6, 4, (k - 2.5) * 0.5, t, D, ["#182010", "#2e3e1c", "#3e5424", "#5e7a30", "#86a048"], { ripple: 1.4, freq: 3, taper: 0.1, k: 0.5, off: k, seed: o.seed });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 71, 6, -30, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -58);
  if (o.scene !== false) caustics(p, t, D, -32, -60, 32, 0, hex("#8ee0c8"), 0.1);
}
