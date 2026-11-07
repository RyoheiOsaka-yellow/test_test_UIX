import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { drawDorid } from "../nudibranch/_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Emperor shrimp",
  ja: "ウミウシカクレエビ",
  sci: "Zenopontonia rex",
  region: "Indo-West Pacific",
  length: "2 cm",
  desc: "A tiny orange shrimp with a white stripe down its back and violet claws, riding a big nudibranch (here a Tryon's hypselodoris) like a mahout, picking food from the slug's slime as it goes.",
  jadesc: "背中に白い筋、紫のハサミをもつ小さなオレンジのエビ。大きなウミウシ（ここではホシゾラウミウシ）の背に乗り、その粘液についた餌をつまみながら旅をする。",
  tags: ["shrimp", "nudibranch", "symbiosis", "reef", "loop"],
  size: [80, 52],
  origin: [38, 30],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#7a2808", "#c85010", "#f08020", "#ffb050", "#ffe0a0"],
    host: ["#9a8a70", "#d4c8a8", "#f4ecd4", "#fff8ea", "#ffffff"],
    spots: ["#2a1848", "#5a3a98", "#8a60d0", "#b494f0", "#e0d0ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-38, -30, 80, 50), SH = new Grid(-38, -30, 80, 50);
const WHITE = ["#9a9aa0", "#d0d0d8", "#f0f0f4", "#ffffff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), H = fit(o.host, 5), SP = fit(o.spots, 5), g = G.clear(), s = SH.clear();
  // the host: cream mantle, violet spots, violet margin, orange-tipped gills and rhinophores
  drawDorid(g, {
    L: 54, H: 14, hump: 0.3, foot: 3, dome: 0.55,
    skin: (u, v, x, y) => (((Math.round(x) * 5 + Math.round(y) * 7 + 1) % 9 === 0) && Math.abs(v) < 0.8 ? SP : H),
    footCol: ["#5a3a98", "#8a60d0", "#a880e0", "#c8a8f0", "#e0d0ff"],
    margin: [[1, SP]],
    rhino: { x: 0.14, h: 6, col: ["#5a3a98", "#8a60d0", "#f0a040", "#ffd080", "#ffffff"] },
    gill: { x: 0.26, n: 6, r: 6, col: ["#5a3a98", "#8a60d0", "#b494f0", "#f0a040", "#ffffff"] },
  }, t, D, o.seed);
  // the rider, perched on the back
  drawShrimp(s, {
    Lc: 7, H: 3, L: 10, curl: 0.55, rostrum: 2, rostrumUp: 0.8, taper: 0.5, eye: 1,
    skin: (u, v) => (Math.abs(v + 0.75) < 0.2 && u > 0.1 && u < 0.9 ? WHITE : C),
    legs: { n: 3, len: 4, col: "#8a60d0", step: 0.5 },
    antennae: { n: 2, len: 10, up: -0.3, back: false, col: "#ffd080", alpha: 0.9 },
    antennules: { len: 4, col: "#ffd080" },
    claws: { kind: "fist", size: 0.8, col: "#8a60d0" },
    swimmerets: { col: "#f0a040" },
    outline: "#4a1808",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 9, 30, 3.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 4);
  s.draw(p, 1, 2 + Math.sin((t / D) * TAU) * 1, -12 + Math.sin((t / D) * TAU) * 0.4);
  bubbles(p, t, D, 2, o.seed * 7 + 22, 20, -10, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -40, -30, 40, 22, hex("#8ee0c8"), 0.12);
}
