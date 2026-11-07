import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawSnail } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Tiger cowrie",
  ja: "ホシダカラ",
  sci: "Cypraea tigris",
  region: "Indo-Pacific reefs, south to Okinawa",
  length: "10 cm",
  desc: "The glossy egg of the reef: a porcelain shell spotted like a leopard, kept polished because the snail's own mantle wraps up over it from both sides, bristling with papillae. Cowries were money across Asia and Africa for three thousand years.",
  jadesc: "サンゴ礁の磨かれた卵。ヒョウ柄の斑点をもつ陶器のような殻は、左右から外套膜が包み込んで磨き続けるためいつも艶やか。タカラガイはアジアやアフリカで三千年にわたり貨幣として使われた。",
  tags: ["shell", "snail", "gastropod", "cowrie", "reef", "spots", "loop"],
  size: [64, 44],
  origin: [30, 30],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a6050", "#b0a890", "#e0d8c0", "#f8f0e0", "#ffffff"],
    spot: ["#0c0a08", "#241c14", "#3a2c20", "#5a4030", "#8a6a50"],
    mantle: ["#2a2a28", "#4a4a44", "#6a6a60", "#8a8a80", "#b0b0a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -30, 64, 42);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.spot, 5), M = fit(o.mantle, 5), g = G.clear();
  const ph = (t / D) * TAU, cover = 0.18 + 0.18 * Math.sin(ph);
  drawSnail(g, {
    whorls: [[-1, -9, 16, 8]],
    pattern: (x, y, i, nx, ny) => (rand(Math.round(x / 2), Math.round(y / 2), 9) < 0.22 && Math.hypot(nx, ny) < 0.9 ? S : C),
    foot: { L: 34, H: 4.5, col: ["#2a2a28", "#4a4a44", "#7a7a70", "#a0a090", "#c8c8b8"], head: 6 },
    tentacles: { len: 5, col: ["#2a2a28", "#4a4a44", "#8a8a80", "#b0b0a0", "#d0d0c0"], eyes: "base" },
    extra: (g, t, S2) => {
      // the mantle lobes creeping up over the shell from both sides, dotted with papillae
      for (const side of [-1, 1]) {
        const reach = cover * (side < 0 ? 1 : 0.85);
        g.shade(-17, -17, 15, -1, (x, y, o2) => {
          const nx = (x + 1) / 16, ny = (y + 9) / 8;
          if (nx * nx + ny * ny > 1.05 || side * nx < 0.05) return 0;
          const top = -9 - 8 * Math.sqrt(Math.max(0, 1 - nx * nx)) * (1 - reach) - 0.8 * Math.sin(x * 1.1 + ph);
          if (y < top) return 0;
          o2.t = 1;
          return (Math.round(x) + Math.round(y) * 2) % 3 === 0 ? M[4] : y < top + 1 ? M[3] : M[2];
        });
      }
      // the shine along the top of the shell
      for (let x = -9; x < 5; x++) g.set(x, -16.2 + 0.02 * (x + 1) ** 2, C[4]);
    },
    outline: "#1c1814", lit: "#6a6050",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 2, 20, 2.5, hex("#061a22"), 0.4);
  g.draw(p, 1, Math.sin(ph) * 0.8, 1);
  bubbles(p, t, D, 1, o.seed * 7 + 41, 10, -14, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -32, -30, 32, 8, hex("#8ee0c8"), 0.12);
}
