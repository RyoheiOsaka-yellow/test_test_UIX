import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Flamboyant cuttlefish",
  ja: "ハナイカ",
  sci: "Metasepia tullbergi",
  region: "Japan (Kyushu, Okinawa) to the South China Sea",
  length: "8 cm",
  desc: "A palm-sized cuttlefish that walks across the sand on its arms, pulsing bands of purple, yellow and white down its body as a warning: its flesh is poisonous. Too heavy to swim far, it struts instead.",
  jadesc: "手のひらサイズで、砂の上を腕で歩くイカ。紫・黄・白の縞を体に波のように走らせ、「有毒だ」と警告する。体が重く長くは泳げないので、歩いて移動する。",
  tags: ["cuttlefish", "cephalopod", "japan", "sand", "flash", "poison", "loop"],
  size: [64, 44],
  origin: [30, 26],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a1830", "#5a3060", "#8a4890", "#b870b8", "#e0a8e0"],
    yellow: ["#6a4a00", "#b08a10", "#f0c020", "#ffe060", "#fff4a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -26, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), Y = fit(o.yellow, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const WHITE = ["#9a9aa0", "#c8c8d0", "#eeeef2", "#ffffff", "#ffffff"];
  // bands of purple, white and yellow run back along the body
  const band = (x, tt) => (((Math.round(x + (tt / D) * 12) % 6) + 6) % 6);
  const skin = (u, v, x, y, tt) => { const b = band(x, tt); return b < 2 ? C : b < 3 ? WHITE : b < 5 ? Y : ["#3a1020", "#6a2040", "#9a3060", "#c05088", "#e080b0"]; };
  drawSquid(g, {
    L: 26, H: 8, shape: "oval", skin,
    fins: { kind: "ribbon", h: 3, from: 0.05, to: 0.95 }, finSkin: Y,
    head: { r: 6 }, eye: { r: 2.2, ring: "#e8e0d0", iris: "#806040", w: true },
    arms: { n: 8, L: 9, r: 1.8, curl: 0.9, suckers: null }, armSkin: ["#4a1020", "#8a2040", "#c04060", "#f0c020", "#fff4a0"],
    tentacles: null,
    outline: "#1a0c20", lit: "#5a3060",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -30, 32, 10, 8, o.seed);
  if (o.scene !== false) shadow(p, 2, 10, 20, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, Math.sin(ph) * 1, 2 + Math.abs(Math.sin(ph * 2)) * -1);
  p.glow(0, 0, 20, hex("#f0c020"), 0.05);
}
