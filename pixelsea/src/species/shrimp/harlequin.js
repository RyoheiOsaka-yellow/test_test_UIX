import { fit, mix, TAU, hex } from "../../core/index.js";
import { Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Harlequin shrimp",
  ja: "フリソデエビ",
  sci: "Hymenocera picta",
  region: "Indo-Pacific reefs",
  length: "5 cm",
  desc: "A cream-white shrimp dappled in blue-rimmed violet spots, waving two flat petal-like claws as it picks over the reef for the starfish it eats.",
  jadesc: "青紫の斑点をまとった白い体に、振袖のような平たいハサミ。ヒトデだけを食べるインド太平洋のサンゴ礁の住人。",
  tags: ["shrimp", "reef", "indo-pacific", "spots", "loop"],
  size: [72, 52],
  origin: [34, 26],
  floor: 14,
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#4a3a44", "#9a8a90", "#d8ccc8", "#f4ece4", "#ffffff"],
    spots: ["#2a1848", "#5a3a98", "#8a60d0", "#b494f0", "#e0d0ff"],
    seed: 1,
  },
};

const D = meta.duration, G = new Grid(-34, -24, 72, 44);
// spot centers over the body in local coordinates: [x, y, r]
const SPOTS = [[8, -1, 2.2], [3, 2.5, 1.6], [-3, 0, 2.4], [-9, 2.5, 1.9], [-14, 5, 2.1], [-18, 9, 1.6], [12, 2.5, 1.4], [-7, 4.5, 1.2], [-22, 12, 1.3]];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), SP = fit(o.spots, 5);
  const g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 1.2;
  const skin = (u, v, x, y) => {
    for (const [sx, sy, r] of SPOTS) {
      const d = Math.hypot(x - sx, (y - sy) * 1.1) / r;
      if (d < 0.72) return SP;
      if (d < 1) return ["#3a6ab0", "#5a8ad0", "#8ab0f0", "#a8c8ff", "#d0e8ff"];
    }
    return C;
  };
  drawShrimp(g, {
    Lc: 13, H: 5.5, L: 19, curl: 0.5, rostrum: 4, taper: 0.4, eye: 1,
    skin,
    legs: { n: 4, len: 6, col: "#c8b8c0", step: 0.8 },
    antennae: { n: 2, len: 16, up: -0.2, back: false, col: "#d8ccd4", alpha: 0.9 },
    antennules: { len: 6, col: "#e8e0e4" },
    claws: { kind: "flat", size: 1.1, col: "#9a8a90", ramp: (nx, ny) => (Math.hypot(nx * 1.2, ny) < 0.5 ? ["#2a1848", "#5a3a98", "#8a60d0", "#b494f0", "#e0d0ff"] : C) },
    swimmerets: { col: "#c8b8c0" },
    outline: "#3a2a38",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -34, 36, 14, 6, o.seed);
  if (o.scene !== false) shadow(p, -6, 15, 22, 3, hex("#1a1408"), 0.35);
  g.draw(p, 1, 0, bob + 2);
  bubbles(p, t, D, 2, o.seed * 7 + 3, 16, -4 + bob, [hex("#ffffff"), hex("#c4ecff"), hex("#78ccf4"), hex("#1c76bc")], 16, -26);
  if (o.scene !== false) caustics(p, t, D, -36, -26, 36, 20, hex("#8ee0c8"), 0.12);
}
