import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, anemone, caustics, bubbles } from "../_lib.js";

export const meta = {
  name: "Glass anemone shrimp",
  ja: "イソギンチャクエビ",
  sci: "Ancylomenes holthuisi",
  region: "Indo-Pacific reefs",
  length: "2.5 cm",
  desc: "A shrimp made of glass: you see the anemone through its body. Only its saddles of white and violet, and the lilac bands on its tail and legs, give it away as it hovers among the tentacles.",
  jadesc: "体がほぼ透明で、向こうのイソギンチャクが透けて見える。白と紫の鞍模様と、尾や脚のライラック色の帯だけが居場所を教えてくれる。",
  tags: ["shrimp", "anemone", "transparent", "reef", "loop"],
  size: [68, 48],
  origin: [32, 24],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a8aa0", "#a8c4d4", "#d8e8f0", "#f0f8ff", "#ffffff"],
    accent: ["#3a1860", "#6a38a8", "#a070e0", "#c8a0ff", "#ece0ff"],
    tentacle: ["#5a5a3a", "#b0a870", "#f0e8c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -24, 68, 46), BG = new Grid(-32, -24, 68, 46);
const WHITE = ["#9a9aa0", "#d0d0d8", "#f0f0f4", "#ffffff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), A = fit(o.accent, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) anemone(bg, t, D, -30, 32, 20, 11, 28, o.tentacle, o.seed, 0.85);
  const skin = (u, v, x, y) => {
    if (u > 0.96) return A;
    if (Math.hypot((x - 3) / 2.6, (y + 1) / 2) < 1 || Math.hypot((x + 9) / 2.6, (y - 1) / 2) < 1) return WHITE;
    if (Math.hypot((x - 3) / 3.4, (y + 1) / 2.8) < 1 || Math.hypot((x + 9) / 3.4, (y - 1) / 2.8) < 1) return A;
    if (u > 0.6 && (Math.round(x) + 50) % 5 === 0) return A;
    return C;
  };
  drawShrimp(g, {
    Lc: 11, H: 4.5, L: 16, curl: 0.45, rostrum: 4, rostrumUp: 1.5, taper: 0.45, eye: 1, alpha: 0.55, translucent: true, skin,
    legs: { n: 4, len: 6, col: "#c8b0f0", step: 0.8 },
    antennae: { n: 2, len: 22, up: -0.4, back: false, col: "#e0e8f0", alpha: 0.7 },
    antennules: { len: 6, col: "#e0e8f0" },
    claws: { kind: "small", size: 0.8, col: "#c8b0f0" },
    swimmerets: { col: "#c8b0f0" },
    outline: "#8aa0b8",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.95);
  if (o.scene !== false) shadow(p, -2, 18, 14, 2.5, hex("#061a22"), 0.2);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, 3 + Math.sin((t / D) * TAU * 2) * 1);
  bubbles(p, t, D, 1, o.seed * 7 + 9, 14, -2, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 16, -24);
  if (o.scene !== false) caustics(p, t, D, -34, -24, 34, 22, hex("#8ee0c8"), 0.1);
}
