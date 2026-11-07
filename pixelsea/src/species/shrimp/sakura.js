import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift } from "../_lib.js";

export const meta = {
  name: "Sakura shrimp",
  ja: "サクラエビ",
  sci: "Lucensosergia lucens",
  region: "Suruga Bay, Japan; Taiwan",
  length: "4 cm",
  desc: "A glass-clear shrimp flushed cherry pink, studded with some 160 red light organs that glow in the dark. It rises from 200 m at night in swarms, and is fished in only two bays on Earth.",
  jadesc: "ガラスのように透き通った桜色の体に、約160個の赤い発光器を散りばめる。夜に深海から群れで浮上し、駿河湾と台湾沖でしか漁が行われない。",
  tags: ["shrimp", "deep", "japan", "glow", "swarm", "loop"],
  size: [72, 48],
  origin: [32, 24],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a2040", "#b84870", "#e880a0", "#f8b8c8", "#ffe8f0"],
    glow: ["#ff2040", "#ff6070", "#ffb0b0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-34, -24, 72, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), GL = fit(o.glow, 3), g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 2;
  drawShrimp(g, {
    Lc: 12, H: 4.5, L: 19, curl: 0.4, rostrum: 3, rostrumUp: 1, taper: 0.4, eye: 1.5, alpha: 0.62, translucent: true,
    skin: () => C,
    legs: { n: 5, len: 7, col: "#e890a8", step: 0.6 },
    antennae: { n: 2, len: 36, up: -0.3, back: true, col: "#f0a0b8", alpha: 0.7 },
    antennules: { len: 8, col: "#f0a0b8" },
    claws: { kind: "small", size: 0.7, col: "#e890a8" },
    swimmerets: { col: "#e890a8" },
  }, t, D, o.seed);
  // photophores: rows of red dots along the body and legs that pulse
  const k = 0.6 + 0.4 * Math.sin((t / D) * TAU * 2);
  const dots = [[10, 3], [6, 3.5], [2, 3.5], [-2, 4], [-6, 5], [-10, 6.5], [-14, 8.5], [-18, 11], [8, -1], [-4, 1], [0, 1.5], [-12, 5]];
  for (const [x, y] of dots) g.set(x, y, GL[1], 1);
  g.draw(p, 1, 0, bob);
  for (const [x, y] of dots) p.glow(x, y + bob, 3.5, GL[0], 0.3 * k);
  // the swarm behind, faint
  for (let i = 0; i < (o.scene !== false ? 6 : 0); i++) {
    const x = -30 + ((i * 23) % 64) + Math.sin((t / D) * TAU + i) * 2, y = -20 + ((i * 17) % 30);
    p.blend(x, y, C[2], 0.25); p.blend(x - 1, y, C[1], 0.2); p.blend(x - 2, y + 1, C[1], 0.15);
    p.glow(x, y, 3, GL[0], 0.08 * k);
  }
  p.glow(0, 2 + bob, 26, GL[0], 0.08);
}
