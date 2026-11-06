import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Red cherry shrimp",
  ja: "レッドチェリーシュリンプ",
  sci: "Neocaridina davidi",
  region: "Taiwan streams (freshwater), aquaria worldwide",
  length: "3 cm",
  desc: "A wild brown stream shrimp from Taiwan bred into solid cherry red: the beginner's aquarium shrimp, forever grazing algae on leaves and glass with a pair of fan-like front feet.",
  jadesc: "台湾の川のエビを品種改良した真紅の小さなエビ。水草やガラスの藻を一日中つまむ、アクアリウムの定番。",
  tags: ["shrimp", "freshwater", "aquarium", "red", "loop"],
  size: [60, 48],
  origin: [28, 24],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#5a0810", "#a81820", "#e03030", "#ff6050", "#ffa090"],
    plant: ["#143a18", "#2a7030", "#60b848"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -24, 60, 46), BG = new Grid(-28, -24, 60, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) plants(bg, t, D, -26, 26, 20, 4, o.plant, o.seed);
  drawShrimp(g, {
    Lc: 9, H: 4, L: 14, curl: 0.62, rostrum: 2, rostrumUp: 1, taper: 0.5, eye: 1, skin: () => C,
    legs: { n: 4, len: 5, col: "#c83030", step: 0.9 },
    antennae: { n: 2, len: 16, up: -0.3, back: true, col: "#e05050", alpha: 0.85 },
    antennules: { len: 5, col: "#e05050" },
    claws: { kind: "small", size: 0.7, col: "#c83030" },
    swimmerets: { col: "#e05050" },
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.9);
  if (o.scene !== false) sandFloor(p, -28, 30, 18, 6, o.seed);
  if (o.scene !== false) shadow(p, -2, 19, 14, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, 8);
  if (o.scene !== false) caustics(p, t, D, -30, -24, 30, 22, hex("#e6cc96"), 0.1);
}
