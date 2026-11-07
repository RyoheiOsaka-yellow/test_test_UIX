import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { sway, blade, stipe, branch, polyp, dome, bladder, sandBase, smallFish, rock } from "../flora/_body.js";
import { shift, bubbles, caustics, sandFloor } from "../_lib.js";

export const meta = {
  name: "Sea grapes",
  ja: "クビレヅタ（海ぶどう）",
  sci: "Caulerpa lentillifera",
  region: "Okinawa, Philippines, Southeast Asia",
  length: "5–10 cm",
  desc: "Green bunches of tiny bubbles on runners over sandy shallows, each the size of a caviar egg and popping the same way between the teeth. Farmed in Okinawa since the 1980s, it is one giant cell with no walls between its 'grapes'.",
  jadesc: "浅い砂地を這う匍匐枝に、キャビアほどの緑の粒が房になる。歯でぷちぷち弾ける食感が人気で、沖縄で1980年代から養殖されている。粒と粒の間に仕切りがない、巨大な一個の細胞。",
  tags: ["seaweed", "green", "okinawa", "sand", "food", "loop"],
  size: [56, 44],
  origin: [28, 38],
  floor: 0,
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#143a14", "#2a7028", "#48a840", "#80d860", "#c8ffa0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -38, 56, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  // a runner along the sand, with upright stalks beaded with grapes
  g.tube([[-26, -1], [-10, -2], [6, -1], [24, -2]], 0.9, (u, d) => (d > 0.6 ? C[1] : C[2]));
  for (const [x, Hh, off] of [[-18, 20, 0], [-7, 26, 1], [4, 30, 2], [14, 22, 3], [22, 16, 4]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const h = (i / 6) * Hh; pts.push([x + sway(t, D, h, 0.5, off, o.seed), -1 - h]); }
    stipe(g, pts, 0.8, o.palette);
    for (let i = 1; i <= 6; i++) for (const side of [-1, 1]) {
      const [px, py] = pts[i];
      g.ellipse(px + side * 1.8, py + (side > 0 ? 0 : -1.5), 1.4, 1.3, (nx, ny) => (nx + ny < -0.6 ? C[4] : nx + ny > 0.5 ? C[1] : C[3]));
    }
    g.ellipse(pts[6][0], pts[6][1] - 1.5, 1.4, 1.3, (nx, ny) => (nx + ny < -0.6 ? C[4] : C[3]));
  }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  if (o.scene !== false) sandFloor(p, -28, 30, 0, 8, o.seed);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 78, 0, -18, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -36);
  if (o.scene !== false) caustics(p, t, D, -28, -38, 28, 2, hex("#e6cc96"), 0.12);
}
