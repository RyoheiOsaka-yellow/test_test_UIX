import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Banded coral shrimp",
  ja: "オトヒメエビ",
  sci: "Stenopus hispidus",
  region: "Tropical seas worldwide",
  length: "6 cm",
  desc: "The boxer shrimp: white and scarlet bands, spiny arms held wide like a prizefighter's, and white antennae three times its length, usually seen as a pair under a ledge.",
  jadesc: "紅白の縞に、長く伸ばした棘だらけの腕。体の何倍もある白いヒゲをたなびかせ、岩陰でつがいで暮らす世界中の熱帯の海の「ボクサーシュリンプ」。",
  tags: ["shrimp", "reef", "cleaner", "bands", "loop"],
  size: [84, 56],
  origin: [36, 26],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a0810", "#8c1420", "#d02830", "#ff5a50", "#ff9a8a"],
    white: ["#8a8a90", "#c8c8cc", "#eeeeee", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -30, 84, 54);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), R = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 1.2;
  const band = (x, y) => ((x + 60 + y * 0.35) % 7.5 < 3.2 ? R : W);
  drawShrimp(g, {
    Lc: 12, H: 5, L: 18, curl: 0.5, rostrum: 4, taper: 0.45, eye: 1,
    skin: (u, v, x, y) => band(x, y),
    legs: { n: 4, len: 7, col: "#f0f0f0", step: 0.8 },
    antennae: { n: 2, len: 42, up: -0.6, back: false, col: "#ffffff", alpha: 0.9 },
    antennules: { len: 10, col: "#ffffff" },
    claws: { kind: "long", size: 1.1, col: "#d02830", ramp: (u) => ((u * 11 + 1) % 4 < 1.8 ? o.palette : o.white) },
    swimmerets: { col: "#f0c0c0" },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, -4, 20, 20, 3, hex("#061a22"), 0.3);
  g.draw(p, 1, 0, bob);
  bubbles(p, t, D, 2, o.seed * 3 + 2, 16, -8 + bob, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 16, -28);
  if (o.scene !== false) caustics(p, t, D, -40, -28, 44, 28, hex("#8ee0c8"), 0.12);
}
