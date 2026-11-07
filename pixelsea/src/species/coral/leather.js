import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Mushroom leather coral",
  ja: "ウミキノコ",
  sci: "Sarcophyton sp.",
  region: "Indo-Pacific reefs; Okinawa lagoons",
  length: "20 cm – 1 m",
  desc: "A soft coral shaped like a mushroom: a thick stalk and a folded leathery cap that is bare one hour and furred with thousands of extended polyps the next. It sheds its skin in a waxy sheet every few weeks to stay clean.",
  jadesc: "キノコの形の軟質サンゴ。太い柄の上の革のような傘は、ある時はつるりと裸で、次の時は何千本ものポリプの毛に覆われる。数週間ごとに蝋のような薄皮を脱いで体を清める。",
  tags: ["coral", "soft coral", "leather", "lagoon", "reef", "loop"],
  size: [64, 48],
  origin: [32, 42],
  floor: 0,
  duration: 5.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a5020", "#8a7c34", "#b4a850", "#d4c878", "#ecE4a8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -42, 64, 48), BG = new Grid(-32, -42, 64, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, out = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -32, 32, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  g.tube([[0, 0], [1, -14]], 6, (u, d) => (d > 0.7 ? C[1] : C[2]));
  // the cap: a wide folded disc; its edge dips and rises in lobes
  g.shade(-30, -26, 30, -10, (x, y, o2) => {
    const nx = x / 29, lobe = 2 * Math.sin(x * 0.4 + o.seed), top = -20 - 4 * Math.sqrt(Math.max(0, 1 - nx * nx)) + lobe * 0.3, bot = -14 + 3 * Math.sqrt(Math.max(0, 1 - nx * nx)) + lobe;
    if (Math.abs(nx) > 1 || y < top || y > bot) return 0;
    return y < top + 2 ? C[3] : y > bot - 1.5 ? C[1] : C[2];
  });
  // polyps: a fur of short stalks with star tips, out when the current runs
  if (out > 0.2) for (let x = -28; x <= 28; x += 2) {
    const nx = x / 29, top = -20 - 4 * Math.sqrt(Math.max(0, 1 - nx * nx)), L = (2 + 3 * out) * (0.7 + 0.3 * ((x / 2) % 2));
    const sw = sway(t, D, L, 0.8, x * 0.3, o.seed) * 0.3;
    g.line(x, top, x + sw, top - L, (u) => (u > 0.7 ? C[4] : C[3]));
    g.set(x + sw - 1, top - L, C[4]); g.set(x + sw + 1, top - L, C[4]);
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, 0, -32, 2, ["#5a3a10", "#f0a020", "#ffe090"], o.seed, 10);
  bubbles(p, t, D, 2, o.seed * 7 + 100, 0, -26, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -32, -42, 32, 0, hex("#8ee0c8"), 0.12);
}
