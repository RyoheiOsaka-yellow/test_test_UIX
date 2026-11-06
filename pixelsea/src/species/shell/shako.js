import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawBivalve } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Giant clam",
  ja: "オオシャコガイ",
  sci: "Tridacna gigas",
  region: "Coral reefs of the Indo-Pacific",
  length: "120 cm",
  desc: "The largest living shell, a metre across and two hundred kilos, wedged into the reef with its gape to the sun. Its mantle glows blue and green with the algae it farms in its own flesh, which feed it for a century.",
  jadesc: "現生最大の貝。幅1 m、重さ200 kgにもなり、サンゴ礁に殻を開けて太陽を仰ぐ。外套膜が青や緑に輝くのは、体内で育てている藻のせい。その藻に養われて百年生きる。",
  tags: ["shell", "bivalve", "giant", "reef", "symbiosis", "loop"],
  size: [76, 52],
  origin: [36, 30],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#4a4a40", "#8a8a78", "#c0c0a8", "#e0e0cc", "#fffff0"],
    mantle: ["#082838", "#105870", "#1898a8", "#40d8d0", "#b0fff0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -30, 76, 50);
const SPOT = ["#0a2048", "#1c3c90", "#3868d0", "#80a8f0", "#e0f0ff"], GREEN = ["#0c2a14", "#1a5828", "#30a040", "#80e070", "#e0ffd0"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), M = fit(o.mantle, 5), g = G.clear();
  const ph = (t / D) * TAU, breathe = 0.5 + 0.5 * Math.sin(ph);
  drawBivalve(g, {
    L: 30, bulge: 12, gape: 0.7 + 0.12 * breathe, tilt: -Math.PI / 2 + 0.1, ribs: 0, lines: 6,
    skin: (u, v, x, y) => (Math.abs(((u * 5 + 0.5) % 1) - 0.5) < 0.22 ? C : ["#5a5a50", "#9a9a88", "#c8c8b0", "#e8e8d8", "#ffffff"]),
    mantle: M,
    inside: (g, S) => {
      // the mantle spills past the lips in a scalloped sheet, blue with iridescent spots, a siphon hole in the middle
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const [x, y] = S.lip("top")(0.3 + 0.7 * (i / 12));
        pts.push([x - 2 - 2 * Math.sin(i * 1.3), y - 1]);
      }
      for (let i = 12; i >= 0; i--) {
        const [x, y] = S.lip("bottom")(0.3 + 0.7 * (i / 12));
        pts.push([x + 2 + 2 * Math.sin(i * 1.3), y + 1]);
      }
      g.poly(pts, (x, y) => {
        const n = rand(Math.round(x / 2), Math.round(y / 2), 8);
        const wave = lnoise(t, D, 2, x * 0.1, o.seed) * 0.4;
        return n < 0.12 ? SPOT[3 + (y % 2 === 0 ? 1 : 0)] : n < 0.3 ? GREEN[2] : n + wave < 0.5 ? M[2] : M[3];
      }, 1, 3);
      const [hx, hy] = S.lip("top")(0.6), [bx, by] = S.lip("bottom")(0.6);
      g.ellipse((hx + bx) / 2, (hy + by) / 2 - 2, 2.5, 1.6 + 0.4 * breathe, (nx, ny) => (Math.hypot(nx, ny) > 0.6 ? M[1] : M[0]), 1, 3);
    },
    outline: "#2a2a24", lit: "#8a8a78",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 18, 24, 3, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 16);
  bubbles(p, t, D, 2, o.seed * 7 + 34, 0, -14, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -28);
  p.glow(0, -6, 22, hex("#40d8d0"), 0.08 + 0.05 * breathe);
  if (o.scene !== false) caustics(p, t, D, -38, -30, 38, 20, hex("#8ee0c8"), 0.12);
}
