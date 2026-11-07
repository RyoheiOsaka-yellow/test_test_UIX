import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Kuruma prawn",
  ja: "クルマエビ",
  sci: "Marsupenaeus japonicus",
  region: "Japan, Indo-West Pacific",
  length: "20 cm",
  desc: "Japan's prized prawn: a sandy cream body wrapped in brown bands like the spokes of a wheel (kuruma), a tail fan tipped blue and yellow. It buries itself in sand by day and forages at night.",
  jadesc: "淡いクリーム色の体に、車輪のように巡る茶色の縞。尾扇は青と黄色に染まる。昼は砂に潜り、夜に餌を探す日本を代表する高級エビ。",
  tags: ["shrimp", "sand", "japan", "prawn", "food", "loop"],
  size: [88, 52],
  origin: [40, 24],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a4a2a", "#b89060", "#e8cc98", "#f8e8c0", "#fffaf0"],
    band: ["#2a1a10", "#5a3a20", "#8a5c30", "#b08048", "#d0a870"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -24, 88, 48);
const BLUE = ["#102850", "#1c4a8a", "#2a78c0", "#58b0e8", "#a0e0ff"], YEL = ["#6a4a00", "#b08a10", "#e8c020", "#ffe060", "#fff4a0"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), B = fit(o.band, 5), g = G.clear();
  const bob = Math.sin((t / D) * TAU) * 1;
  const skin = (u, v, x, y) => {
    if (u > 0.97) return v > 0.2 ? YEL : BLUE;
    if (u > 0.12 && (x + 70 + y * 0.6) % 6.5 < 2.2) return B;
    return C;
  };
  drawShrimp(g, {
    Lc: 17, H: 6, L: 24, curl: 0.42, rostrum: 6, rostrumUp: 2, taper: 0.42, eye: 1.5, segs: 6, fan: 1.2, skin,
    legs: { n: 5, len: 7, col: "#d8b880", step: 0.6 },
    antennae: { n: 2, len: 44, up: -0.25, back: true, col: "#e0c898", alpha: 0.8 },
    antennules: { len: 8, col: "#d8b880" },
    claws: { kind: "small", size: 0.9, col: "#d8b880" },
    swimmerets: { col: "#d8b880" },
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -40, 44, 15, 8, o.seed);
  if (o.scene !== false) shadow(p, -4, 16, 26, 3, hex("#1a1408"), 0.35);
  g.draw(p, 1, 0, bob + 3);
  bubbles(p, t, D, 2, o.seed * 9 + 4, 24, -4 + bob, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -42, -24, 44, 24, hex("#e6cc96"), 0.1);
}
