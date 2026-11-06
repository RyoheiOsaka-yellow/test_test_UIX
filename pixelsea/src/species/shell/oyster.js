import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawBivalve, rock } from "./_body.js";
import { shift, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Pacific oyster",
  ja: "マガキ",
  sci: "Crassostrea gigas",
  region: "Japan; farmed on every continent but Antarctica",
  length: "15 cm",
  desc: "The rough, fluted, grey-and-purple oyster of Hiroshima and Miyagi, cemented to the rock by its deep lower valve. It filters two hundred litres a day and was carried from Japan to farm the oyster beds of France, the Pacific coast and beyond.",
  jadesc: "広島や宮城の養殖カキ。ゴツゴツした灰色と紫の殻で、深い下の殻ごと岩に固着する。一日に200 Lの海水を濾し、日本からフランスや北米など世界中の養殖場に広まった。",
  tags: ["shell", "bivalve", "oyster", "rock", "japan", "food", "loop"],
  size: [64, 48],
  origin: [30, 30],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#2a2a30", "#5a5a60", "#8c8c90", "#bcbcc0", "#ececf0"],
    streak: ["#1a1020", "#3a2848", "#5a4870", "#7a6898", "#a898c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -30, 64, 46), BG = new Grid(-30, -30, 64, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.streak, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, open = Math.max(0, Math.sin(ph)) ** 0.7;
  if (o.scene !== false) rock(bg, -30, 34, 8, 14, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  drawBivalve(g, {
    L: 26, bulge: 9, gape: 0.06 + 0.18 * open, tilt: -0.75, ribs: 0, lines: 9,
    skin: (u, v, x, y) => (rand(Math.round(x), Math.round(y / 2), 2) < 0.25 && u > 0.2 ? S : C),
    mantle: ["#5a5048", "#8a8078", "#c0b8a8", "#e8e0d0", "#fffaf0"],
    extra: (g, t, S2) => {
      // a frilled, flaky lip: a few chips knocked off the edge
      for (let i = 0; i < 6; i++) {
        const [x, y] = S2.lip("top")(0.55 + i * 0.08);
        g.erase(x - 0.5 - Math.sin(i * 2) * 1.5, y - 2.5 - i * 0.6);
      }
    },
    outline: "#141418", lit: "#5a5a60",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, -8, 14);
  // a puff of filtered water out of the gape
  for (let i = 0; i < 4; i++) p.dot(14 + i * 2, 2 - i * 2 - open * 4, hex("#c4ecff"), 0.35 * open);
  bubbles(p, t, D, 2, o.seed * 7 + 36, 10, -8, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -28);
  if (o.scene !== false) caustics(p, t, D, -32, -30, 32, 12, hex("#8ee0c8"), 0.12);
}
