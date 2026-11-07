import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, anemone, caustics } from "../_lib.js";

export const meta = {
  name: "Sexy shrimp",
  ja: "イソギンチャクモエビ",
  sci: "Thor amboinensis",
  region: "Tropical seas worldwide",
  length: "1.5 cm",
  desc: "A thumbnail-sized shrimp living among anemone tentacles, chestnut with white saddles, famous for holding its tail high and swaying it side to side as it walks: the dance that named it.",
  jadesc: "イソギンチャクの触手の間に住む親指の爪ほどのエビ。栗色に白い鞍模様。尾を高く上げて左右に揺らして歩く「ダンス」が名前の由来。",
  tags: ["shrimp", "anemone", "tiny", "dance", "loop"],
  size: [64, 52],
  origin: [30, 28],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a1a08", "#7a3a14", "#c06a28", "#e89848", "#ffd090"],
    saddle: ["#6a5a80", "#b0a8c0", "#ece8f4", "#ffffff", "#ffffff"],
    tentacle: ["#5a3a8a", "#9a70c8", "#e0c8ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -28, 64, 50);
const SADDLES = [[6, -1, 3, 2.2], [-3, -2.5, 3, 2.4], [-9, -7, 2.4, 2]];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), W = fit(o.saddle, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    for (const [sx, sy, rx, ry] of SADDLES) {
      const d = Math.hypot((x - sx) / rx, (y - sy) / ry);
      if (d < 0.8) return W;
      if (d < 1.05) return ["#1a1030", "#3a2860", "#5a4890", "#8070b8", "#a898d8"];
    }
    return C;
  };
  if (o.scene !== false) anemone(g, t, D, -28, 30, 22, 9, 28, o.tentacle, o.seed, 0.8);
  g.recolor((x, y, c) => c);
  const body = new Grid(-30, -28, 64, 50);
  drawShrimp(body, {
    Lc: 9, H: 4, L: 13, curl: -0.8, rostrum: 2, rostrumUp: 1, taper: 0.5, eye: 1, wag: 0.16, skin,
    legs: { n: 4, len: 6, col: "#c08050", step: 1 },
    antennae: { n: 2, len: 10, up: -0.4, back: false, col: "#e0b080", alpha: 0.9 },
    antennules: { len: 5, col: "#e8c090" },
    claws: { kind: "small", size: 0.8, col: "#c08050" },
    swimmerets: { col: "#c08050" },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, -2, 21, 14, 2.5, hex("#061a22"), 0.3);
  g.draw(p, 0.9);
  body.draw(p, 1, Math.sin((t / D) * TAU * 2) * 1.5, 9 + Math.abs(Math.sin((t / D) * TAU * 2)) * -1);
  if (o.scene !== false) caustics(p, t, D, -32, -24, 32, 22, hex("#8ee0c8"), 0.1);
}
