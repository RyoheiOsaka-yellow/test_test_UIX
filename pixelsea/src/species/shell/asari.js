import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawBivalve, siphons } from "./_body.js";
import { shift, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Manila clam",
  ja: "アサリ",
  sci: "Ruditapes philippinarum",
  region: "Japan and East Asia; introduced worldwide",
  length: "4 cm",
  desc: "The little ribbed clam of miso soup, every shell printed with a different maze of brown, black and white. It lives a hand's depth under the sand with two siphons up, and has quietly colonized coasts from France to California.",
  jadesc: "味噌汁の定番。細かい放射肋に、黒・茶・白の迷路のような模様は一枚ずつ違う。砂に浅く潜って水管を出し、今では世界中の海岸に広がった。",
  tags: ["shell", "bivalve", "clam", "japan", "sand", "food", "loop"],
  size: [56, 44],
  origin: [26, 24],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#2a2018", "#6a5848", "#a89880", "#d8ccb8", "#f8f0e0"],
    dark: ["#0c0a08", "#2a221c", "#4a3e34", "#6a5c50", "#8a7c70"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-26, -24, 56, 42);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), K = fit(o.dark, 5), g = G.clear();
  const ph = (t / D) * TAU, out = Math.max(0, Math.sin(ph)) ** 0.5;
  drawBivalve(g, {
    L: 18, bulge: 7.5, gape: 0.16 + 0.08 * out, tilt: -0.4, ribs: 6, lines: 0,
    skin: (u, v, x, y) => (rand(Math.round(x * 1.5), Math.round(y), 4) < 0.4 && u > 0.15 ? K : C),
    mantle: ["#3a2a28", "#6a5050", "#a08080", "#d0b0a8", "#f0e0d8"],
    extra: (g, t, S) => {
      const [lx, ly] = S.lip("top")(0.9), [bx, by] = S.lip("bottom")(0.9);
      siphons(g, (lx + bx) / 2 - 1, (ly + by) / 2, -1.15, 8, out, ["#3a2a28", "#7a5a58", "#c0a098", "#e0d0c8", "#fff8f0"], 1, 3);
    },
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -26, 28, 6, 14, o.seed);
  g.draw(p, 1, -8, 7);
  if (o.scene !== false) sandFloor(p, -26, 28, 11, 9, o.seed + 1);
  // a second clam's siphons poking up behind
  if (o.scene !== false) { p.dot(-16, 5 - out * 2, hex("#c0a098"), 0.8); p.dot(-16, 4 - out * 2, hex("#e0d0c8"), 0.8); p.dot(-14, 5 - out * 2, hex("#c0a098"), 0.8); }
  bubbles(p, t, D, 2, o.seed * 7 + 32, 8, -2, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -22);
  if (o.scene !== false) caustics(p, t, D, -28, -24, 28, 16, hex("#e6cc96"), 0.1);
}
