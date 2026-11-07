import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Boulder coral",
  ja: "ハマサンゴ",
  sci: "Porites lobata",
  region: "Indo-Pacific reefs",
  length: "to 6 m across, 1000 years old",
  desc: "A boulder that is alive: a dome of coral as big as a house, laid down a few millimetres a year by polyps the size of a pinhead, so its layers record centuries of sea temperature like tree rings. Christmas-tree worms burrow into it in bright spirals.",
  jadesc: "生きた岩の塊。家ほどの大きさのドームは、針の頭ほどのポリプが年に数 mmずつ積み上げたもので、年輪のように何世紀もの海水温を記録している。表面にはイバラカンザシが鮮やかならせんを立てる。",
  tags: ["coral", "hard coral", "massive", "reef", "old", "loop"],
  size: [72, 48],
  origin: [36, 42],
  floor: 0,
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a4a18", "#7a7a28", "#a8a63a", "#cccc58", "#ecec90"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -42, 72, 48), BG = new Grid(-36, -42, 72, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, out = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -36, 36, 0, 6, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // lumpy dome: lobes of different heights, a fine polyp texture over all of it
  dome(g, -12, 0, 22, 24, o.palette);
  dome(g, 12, 0, 20, 30, o.palette);
  dome(g, 0, 0, 16, 36, o.palette);
  g.recolor((x, y, c) => ((Math.round(x) + Math.round(y) * 3) % 4 === 0 ? (out > 0.5 ? C[4] : C[3]) : (Math.round(x) * 3 + Math.round(y)) % 5 === 0 ? C[1] : c));
  // Christmas-tree worms: two little spirals of colour
  for (const [wx, wy, col] of [[-10, -22, ["#8a2020", "#e04040", "#ff9090"]], [16, -18, ["#1a4a90", "#3a8ad0", "#a0d8ff"]]]) {
    const k = 0.5 + 0.5 * Math.sin(ph * 2 + wx);
    for (let i = 0; i < 4 * k; i++) { g.set(wx + (i % 2 ? 1 : -1) * (1 - i * 0.2), wy - i * 1.4, hex(col[1])); g.set(wx, wy - i * 1.4 - 0.5, hex(col[2])); }
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) smallFish(p, t, D, -24, -30, 2, ["#5a3a10", "#f0a020", "#ffe090"], o.seed, 8);
  bubbles(p, t, D, 2, o.seed * 7 + 92, 6, -30, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -40);
  if (o.scene !== false) caustics(p, t, D, -36, -42, 36, 0, hex("#8ee0c8"), 0.12);
}
