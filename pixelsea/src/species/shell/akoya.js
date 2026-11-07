import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawBivalve } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Akoya pearl oyster",
  ja: "アコヤガイ",
  sci: "Pinctada fucata",
  region: "Japan (Mie, Ehime, Nagasaki), Indo-Pacific",
  length: "7 cm",
  desc: "The oyster that made Mikimoto: a flat, rayed, greenish shell lined with nacre. Seeded with a bead, it coats the irritant in mother-of-pearl, layer by layer, into a round white Akoya pearl over a year or two.",
  jadesc: "真珠養殖の母貝。平たく放射状の模様がある殻の内側は真珠層。核を入れると、1〜2年かけて真珠層を何層も重ね、丸い白いアコヤ真珠を育てる。",
  tags: ["shell", "bivalve", "pearl", "japan", "loop"],
  size: [60, 46],
  origin: [28, 26],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a2e1c", "#5a5e3c", "#8a8a60", "#b8b890", "#e0e0c0"],
    ray: ["#141810", "#2a2e1c", "#3a3e2c", "#5a5e3c", "#7a7e5c"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -26, 60, 44);
const NACRE = ["#7a8a90", "#b8c8d0", "#e8f0f4", "#f8fcff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), R = fit(o.ray, 5), g = G.clear();
  const ph = (t / D) * TAU, open = 0.5 + 0.5 * Math.sin(ph - 1);
  drawBivalve(g, {
    L: 24, bulge: 6.5, gape: 0.1 + 0.42 * open, tilt: -0.3, ribs: 0, lines: 5,
    skin: (u, v, x, y) => (Math.abs(((v * 6) % 1) - 0.5) < 0.18 && u > 0.2 ? R : C),
    mantle: NACRE,
    inside: (g, S) => {
      // the pearl, sitting in the mantle near the hinge
      const [x, y] = S.lip("bottom")(0.42);
      g.ellipse(x + 1, y - 2.5, 2.6, 2.4, (nx, ny) => (Math.hypot(nx + 0.4, ny + 0.4) < 0.35 ? NACRE[4] : nx + ny < -0.2 ? NACRE[3] : nx + ny > 0.7 ? NACRE[1] : NACRE[2]), 1, 3);
      // a hint of iridescence on the nacre
      for (let i = 0; i < 5; i++) { const [px, py] = S.lip("top")(0.3 + i * 0.12); g.set(px + 1, py + 2, i % 2 ? hex("#d8c0f0") : hex("#c0f0e0"), 1, 3); }
    },
    outline: "#141810", lit: "#5a5e3c",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 12, 18, 2.5, hex("#061a22"), 0.35);
  g.draw(p, 1, -10, 10);
  const [px, py] = [-10 + 24 * 0.42 * Math.cos(0.3 + 0.1) + 1, 10 + 24 * 0.42 * Math.sin(0.0) - 2.5];
  p.glow(px, py - 1, 7, hex("#ffffff"), 0.25 * open);
  bubbles(p, t, D, 1, o.seed * 7 + 37, 8, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -24);
  if (o.scene !== false) caustics(p, t, D, -30, -26, 30, 16, hex("#8ee0c8"), 0.12);
}
