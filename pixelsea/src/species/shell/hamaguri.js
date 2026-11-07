import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawBivalve, siphons } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Common orient clam",
  ja: "ハマグリ",
  sci: "Meretrix lusoria",
  region: "Japan, Korea, China (tidal sand flats)",
  length: "8 cm",
  desc: "The smooth, glossy clam of Japanese sand flats, each shell a different wash of chestnut, cream and violet. It sits buried with two short siphons up in the water. No two shells match except their own pair, which is why hamaguri stand for a good marriage.",
  jadesc: "干潟の砂に潜む、つやのある滑らかな二枚貝。栗色・クリーム・紫の模様は一枚ごとに違い、ぴたりと合うのは元の相手だけ。それが夫婦円満の縁起物とされるゆえん。",
  tags: ["shell", "bivalve", "clam", "japan", "sand", "food", "loop"],
  size: [64, 48],
  origin: [30, 26],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a2418", "#8a5a40", "#c89868", "#e8d0a8", "#fff4e0"],
    band: ["#2a1830", "#5a3a60", "#8a6a90", "#b8a0c0", "#e0d0e8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -26, 64, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), B = fit(o.band, 5), g = G.clear();
  const ph = (t / D) * TAU;
  // the clam sits tilted up in the sand, lip to the upper right, siphons reaching up out of the gape
  const gape = 0.18 + 0.1 * Math.max(0, Math.sin(ph)), out = Math.max(0, Math.sin(ph - 0.4)) ** 0.6;
  drawBivalve(g, {
    L: 24, bulge: 9, gape, tilt: -0.35, lines: 5,
    skin: (u, v, x, y, which) => (Math.abs(((u * 2.6 + (which === "top" ? 0.3 : 0.1)) % 1) - 0.5) < 0.16 && u > 0.2 ? B : C),
    mantle: ["#4a2a20", "#8a5048", "#c08070", "#f0b8a8", "#ffe8e0"],
    extra: (g, t, S) => {
      const [lx, ly] = S.lip("top")(0.9), [bx, by] = S.lip("bottom")(0.9);
      siphons(g, (lx + bx) / 2 - 1, (ly + by) / 2, -1.1, 10, out, ["#4a2a20", "#8a5048", "#d09080", "#f0c0b0", "#fff0e8"], 1, 4);
    },
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -30, 32, 8, 14, o.seed);
  g.draw(p, 1, -12, 8);
  // half buried: sand in front of the lower shell
  if (o.scene !== false) sandFloor(p, -30, 32, 13, 9, o.seed + 1);
  // sand kicked up as the siphons breathe
  if (o.scene !== false) for (let i = 0; i < 4; i++) p.dot(8 + i * 2, 4 - out * 6 - i, hex("#e6cc96"), 0.3 * out);
  bubbles(p, t, D, 2, o.seed * 7 + 30, 12, -4, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -24);
  if (o.scene !== false) caustics(p, t, D, -32, -26, 32, 18, hex("#e6cc96"), 0.1);
}
