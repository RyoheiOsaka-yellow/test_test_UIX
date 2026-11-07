import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Mushroom coral",
  ja: "クサビライシ",
  sci: "Fungia fungites",
  region: "Indo-Pacific reefs, sandy lagoon floors",
  length: "10–20 cm",
  desc: "A coral that is one single polyp the size of a plate, lying loose on the sand with no colony and no attachment. Its skeleton is a disc of radiating blades like a mushroom's gills; it can inflate to right itself when flipped, and shuffle slowly across the bottom.",
  jadesc: "皿ほどの大きさの一個のポリプだけでできたサンゴ。群体をつくらず、何にも付かずに砂の上に転がっている。骨格はキノコのひだのように放射状の板の円盤。ひっくり返されると体を膨らませて起き上がり、ゆっくり砂の上を移動する。",
  tags: ["coral", "hard coral", "solitary", "sand", "lagoon", "loop"],
  size: [64, 40],
  origin: [32, 34],
  floor: 0,
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#5a4a2a", "#8a7a48", "#b8a870", "#d8cc98", "#f0e8c0"],
    tentacle: ["#3a4a3a", "#5a7a5a", "#88a888", "#b8d8b0", "#e8ffe0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -34, 64, 40);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), T = fit(o.tentacle, 5), g = G.clear();
  const ph = (t / D) * TAU, out = Math.max(0, Math.sin(ph - 0.6));
  // the disc, seen from a little above: an oval with septa radiating from a central slit
  g.ellipse(0, -5, 26, 9, (nx, ny) => (ny > 0.5 ? C[1] : ny > -0.2 ? C[2] : C[3]));
  for (let a = 0; a < TAU; a += 0.2) {
    const cs = Math.cos(a), sn = Math.sin(a);
    g.line(cs * 3, -5 + sn * 1, cs * 25, -5 + sn * 8.5, (u) => (u > 0.85 ? C[4] : Math.round(a * 10) % 2 ? C[1] : C[3]));
  }
  g.line(-4, -5, 4, -5, C[0]); g.line(-4, -6, 4, -6, C[1]);
  // tentacles poke up between the septa when it feeds
  if (out > 0.1) for (let a = 0.1; a < TAU; a += 0.4) {
    const cs = Math.cos(a), sn = Math.sin(a), x = cs * 16, y = -5 + sn * 5.5, L = 3 * out;
    g.line(x, y, x + sway(t, D, L, 1, a, o.seed) * 0.5, y - L, (u) => (u > 0.6 ? T[4] : T[3]));
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) sandFloor(p, -32, 34, 2, 6, o.seed);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 102, 0, -12, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 10, -32);
  if (o.scene !== false) caustics(p, t, D, -32, -34, 32, 4, hex("#e6cc96"), 0.12);
}
