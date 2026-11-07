import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Arapaima",
  ja: "ピラルク",
  sci: "Arapaima gigas",
  region: "Amazon and Essequibo basins (freshwater)",
  length: "3 m",
  desc: "The giant of the Amazon, one of the largest freshwater fish: an olive torpedo whose scales flush red toward the tail (pirarucu, 'red fish'). It must surface to gulp air every few minutes, and its scales are armour tough enough to turn piranha teeth.",
  jadesc: "アマゾン最大級の淡水魚。オリーブ色の体は尾に向かって鱗が赤く染まる（ピラルク＝赤い魚）。数分おきに水面で空気を呑む必要があり、鱗はピラニアの歯も通さない鎧。",
  tags: ["fish", "freshwater", "giant", "amazon", "air-breather", "loop"],
  size: [112, 52],
  origin: [56, 28],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1c2a18", "#3a5030", "#5c7850", "#88a078", "#b8c8a8"],
    red: ["#5a1010", "#a02820", "#d84830", "#f07858", "#ffb090"],
    plant: ["#143a18", "#2a7030", "#60b848"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -28, 112, 52), BG = new Grid(-56, -28, 112, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), R = fit(o.red, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU;
  if (o.scene !== false) plants(bg, t, D, -54, 54, 22, 6, o.plant, o.seed + 7);
  const skin = (u, v, x, y) => {
    const scale = (Math.round(x / 3) + Math.round(y / 2)) % 2 === 0 && Math.round(y) % 2 === 0;
    if (u > 0.5 && scale) return R;
    if (scale) return ["#2a3a24", "#4a6040", "#6c8860", "#98b088", "#c8d8b8"];
    return v > 0.5 ? ["#4a5a40", "#7a8c68", "#a8b898", "#ccd8c0", "#e8f0e0"] : C;
  };
  drawFish(g, {
    L: 84, H: 10, peak: 0.45, nose: 0.6, stock: 0.35, skin,
    tail: { kind: "round", span: 10, len: 9 },
    dorsal: [{ u: 0.8, h: 5, w: 28, kind: "ridge", col: ["#3a1010", "#7a2820", "#b04030", "#d86848", "#f0a080"] }],
    anal: { u: 0.8, h: 5, w: 28, col: ["#3a1010", "#7a2820", "#b04030", "#d86848", "#f0a080"] },
    pectoral: { u: 0.24, len: 10, w: 4, angle: 0.5, v: 0.5, flap: 0.2 },
    pelvic: { u: 0.5, h: 4, w: 5 },
    eye: { u: 0.08, v: -0.15, r: 1.2 },
    mouth: { len: 9, open: 0.1, v: 0.25, drop: 0.5 },
    gills: 1, gillU: 0.2,
    swim: { kind: "fish", amp: 0.8 },
    finSkin: () => C,
    outline: "#0c1410", lit: "#5c7850",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.9);
  if (o.scene !== false) sandFloor(p, -56, 58, 22, 6, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1.5, Math.sin(ph) * 1);
  bubbles(p, t, D, 2, o.seed * 7 + 64, 36, -4, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -26);
  if (o.scene !== false) caustics(p, t, D, -58, -28, 58, 24, hex("#e6cc96"), 0.08);
}
