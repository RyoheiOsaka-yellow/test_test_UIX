import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawSnail, rock } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Horned turban",
  ja: "サザエ",
  sci: "Turbo sazae",
  region: "Japan, Korea (rocky shores)",
  length: "10 cm",
  desc: "The spiny turban snail of Japanese rocky shores, grazing seaweed by night with a green-black foot and a thick lid (operculum) that seals it shut. Wave-beaten shells grow long horns; calm-water ones stay smooth.",
  jadesc: "日本の磯の代表的な巻貝。夜に海藻を食べ、分厚いフタで殻を閉ざす。波の荒い場所では長いトゲが伸び、穏やかな場所では丸い殻になる。",
  tags: ["shell", "snail", "gastropod", "japan", "rock", "food", "loop"],
  size: [64, 48],
  origin: [30, 30],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#2a221c", "#5a4a3c", "#8a7a62", "#b8a890", "#e0d8c8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -30, 64, 46), BG = new Grid(-30, -30, 64, 46);
const GREEN = ["#0c140a", "#1e2e18", "#3a5028", "#5a7040", "#8aa060"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -30, 32, 2, 16, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  drawSnail(g, {
    whorls: [[-3, -11, 13, 10], [2, -21, 7, 5.5], [5, -27, 3.5, 2.8]],
    pattern: (x, y, i, nx, ny) => (((Math.round(x) * 3 + Math.round(y) * 5 + i) % 9 < 2) ? ["#1a2a10", "#3a5020", "#6a8838", "#a0c060", "#d8f0a0"] : C),
    foot: { L: 30, H: 4, col: GREEN, head: 6 },
    tentacles: { len: 5, col: GREEN, eyes: "base" },
    extra: (g, t, S) => {
      // horns along the shoulder of the body whorl and the whorl above
      for (const [cx, cy, rx, ry, n] of [[-3, -11, 13, 10, 5], [2, -21, 7, 5.5, 3]])
        for (let k = 0; k < n; k++) {
          const ang = -Math.PI * 0.95 + (k / (n - 1)) * Math.PI * 0.9, bx = cx + Math.cos(ang) * rx * 0.95, by = cy + Math.sin(ang) * ry * 0.95;
          const L = 3.5 + (k % 2), ex = bx + Math.cos(ang) * L, ey = by + Math.sin(ang) * L;
          g.tube([[bx, by], [ex, ey]], (u) => 1.2 - u * 0.8, (u) => (u > 0.7 ? C[4] : C[2]), 1, 1);
        }
    },
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 2, 18, 2.5, hex("#061a22"), 0.4);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, 2);
  bubbles(p, t, D, 1, o.seed * 7 + 31, 10, -14, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -32, -30, 32, 10, hex("#8ee0c8"), 0.12);
}
