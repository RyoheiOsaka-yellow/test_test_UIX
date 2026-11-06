import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Pacific cleaner shrimp",
  ja: "アカシマシラヒゲエビ",
  sci: "Lysmata amboinensis",
  region: "Indo-Pacific, Red Sea",
  length: "6 cm",
  desc: "The reef's barber: a golden shrimp with a scarlet back split by a white stripe, waving long white antennae to call fish in for a cleaning.",
  jadesc: "黄金色の体に、白い筋を通した真紅の背中。長い白いヒゲを振って魚を呼び、口や体の寄生虫を掃除する「クリーナーシュリンプ」。",
  tags: ["shrimp", "reef", "cleaner", "indo-pacific", "loop"],
  size: [76, 52],
  origin: [36, 24],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#5a3410", "#a86a20", "#e0a040", "#f4cc70", "#fff0b8"],
    stripe: ["#4a0810", "#8c1420", "#d02830", "#ff5a50", "#ff9a8a"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -26, 76, 48);
const WHITE = ["#8a8a90", "#c8c8cc", "#eeeeee", "#ffffff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.stripe, 5), g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 1.3;
  const skin = (u, v) => {
    if (v < -0.3 && u > 0.08) return Math.abs(v + 0.68) < 0.14 && u > 0.18 ? WHITE : S;
    if (u > 0.9 && Math.abs(v) < 0.3) return WHITE;
    return C;
  };
  drawShrimp(g, {
    Lc: 13, H: 5, L: 20, curl: 0.45, rostrum: 5, taper: 0.4, eye: 1, skin,
    legs: { n: 5, len: 7, col: "#e8b860", step: 0.9 },
    antennae: { n: 2, len: 34, up: -0.55, back: false, col: "#ffffff", alpha: 0.95 },
    antennules: { len: 9, col: "#ffffff" },
    claws: { kind: "small", size: 1, col: "#e8b860" },
    swimmerets: { col: "#e0a040" },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, -4, 20, 20, 3, hex("#061a22"), 0.3);
  g.draw(p, 1, 0, bob);
  bubbles(p, t, D, 2, o.seed * 5 + 1, 18, -6 + bob, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 16, -26);
  if (o.scene !== false) caustics(p, t, D, -38, -26, 38, 26, hex("#8ee0c8"), 0.12);
}
