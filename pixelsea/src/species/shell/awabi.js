import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawSnail, rock } from "./_body.js";
import { shift, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Japanese abalone",
  ja: "クロアワビ",
  sci: "Haliotis discus discus",
  region: "Japan (Pacific coast), Korea",
  length: "20 cm",
  desc: "A snail that gave up the spiral: a flat ear of shell with a row of breathing holes, clamped over a huge muscular foot that grips rock against any wave. The ama divers of Mie and Chiba have taken it by hand for two thousand years.",
  jadesc: "らせんを捨てた巻貝。平たい耳形の殻に呼吸孔が一列に並び、その下の巨大な足で岩にしがみつく。三重や千葉の海女が二千年前から素潜りで獲ってきた。",
  tags: ["shell", "snail", "gastropod", "japan", "rock", "food", "loop"],
  size: [68, 44],
  origin: [32, 30],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#1e2418", "#3e4a30", "#607050", "#8a9878", "#b8c4a8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -30, 68, 42), BG = new Grid(-32, -30, 68, 42);
const FOOT = ["#0c0e0c", "#20241e", "#3a4036", "#585e52", "#8a908a"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -32, 36, 2, 14, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  drawSnail(g, {
    whorls: [[-2, -7, 18, 6.5], [11, -10, 5, 3]],
    pattern: (x, y, i, nx, ny) => (rand(Math.round(x / 2), Math.round(y), 6) < 0.2 ? ["#4a2a20", "#7a4a38", "#a06a50", "#c89070", "#e8c0a0"] : C),
    foot: { L: 40, H: 6, col: FOOT, head: 4 },
    tentacles: { len: 5, col: FOOT, eyes: "tip" },
    crawl: 0.6,
    extra: (g, t, S) => {
      // the row of respiratory holes along the shell's left edge, the last few open
      for (let k = 0; k < 6; k++) {
        const x = -14 + k * 3.2, y = -10.5 + k * 0.1 - Math.sqrt(Math.max(0, 1 - ((x + 2) / 18) ** 2)) * 1.2;
        g.set(x, y, k < 4 ? hex("#0a0c08") : C[1]); g.set(x, y - 1, k < 4 ? C[4] : C[2]);
      }
      // the foot's frilled edge, feeling along the rock
      for (let x = -22; x < 14; x += 2) g.set(x + (x % 4 ? 0 : 1), 0.4 * Math.sin(x * 0.8 + S.ph * 2), FOOT[3]);
    },
    outline: "#0e120c", lit: "#3e4a30",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 0.6, 2);
  bubbles(p, t, D, 1, o.seed * 7 + 39, 12, -10, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -34, -30, 34, 8, hex("#8ee0c8"), 0.12);
}
