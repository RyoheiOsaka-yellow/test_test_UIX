import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Amano shrimp",
  ja: "ヤマトヌマエビ",
  sci: "Caridina multidentata",
  region: "Japan, Taiwan (freshwater rivers)",
  length: "5 cm",
  desc: "The algae-eater Takashi Amano made famous: glassy olive-grey with a row of rust dots down each side and a pale stripe along the back. Its larvae need the sea, so it is rarely bred in tanks.",
  jadesc: "天野尚が世界に広めた苔取りエビ。透けたオリーブ色の体に、側面には錆色の点列、背中には淡い一本筋。幼生は海水が必要で、水槽内の繁殖は難しい。",
  tags: ["shrimp", "freshwater", "aquarium", "japan", "loop"],
  size: [68, 48],
  origin: [32, 24],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a4030", "#6a7050", "#9aa078", "#c4c8a0", "#e8ecd0"],
    dots: ["#5a2810", "#8a4018", "#b05a28"],
    plant: ["#143a18", "#2a7030", "#60b848"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -24, 68, 46), BG = new Grid(-32, -24, 68, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), DT = fit(o.dots, 3), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) plants(bg, t, D, -30, 30, 20, 5, o.plant, o.seed + 2);
  const skin = (u, v, x, y) => {
    if (Math.abs(v + 0.95) < 0.12 && u > 0.15 && u < 0.95) return ["#b8c0a0", "#d8dcc0", "#f0f0e0", "#ffffff", "#ffffff"];
    if (u > 0.2 && u < 0.9 && Math.abs(v - 0.15) < 0.28 && (Math.round(x) + 40) % 4 === 0) return ["#5a2810", "#7a3818", "#8a4018", "#a05028", "#b05a28"];
    return C;
  };
  drawShrimp(g, {
    Lc: 11, H: 4.5, L: 17, curl: 0.55, rostrum: 3, rostrumUp: 1, taper: 0.45, eye: 1, alpha: 0.9, translucent: true, skin,
    legs: { n: 4, len: 6, col: "#a0a888", step: 0.9 },
    antennae: { n: 2, len: 22, up: -0.3, back: true, col: "#b8c0a0", alpha: 0.8 },
    antennules: { len: 6, col: "#b8c0a0" },
    claws: { kind: "small", size: 0.8, col: "#a0a888" },
    swimmerets: { col: "#b8c0a0" },
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.9);
  if (o.scene !== false) sandFloor(p, -32, 34, 18, 6, o.seed);
  if (o.scene !== false) shadow(p, -2, 19, 16, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, 7);
  if (o.scene !== false) caustics(p, t, D, -34, -24, 34, 22, hex("#e6cc96"), 0.1);
}
