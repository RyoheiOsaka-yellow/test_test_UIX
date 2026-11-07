import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawOctopus, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow } from "../_lib.js";

export const meta = {
  name: "Common octopus",
  ja: "マダコ",
  sci: "Octopus sinensis",
  region: "Japan, Korea, China; the Atlantic has its twin O. vulgaris",
  length: "60 cm, arms to 1 m",
  desc: "The octopus of takoyaki and of Akashi's tide-run pots: a rust-red bag of a body with eight suckered arms and a brain in each, able to change colour and texture in a blink, squeeze through a bottle neck, and remember a face.",
  jadesc: "たこ焼きと明石のタコ壺のタコ。錆色の袋のような体に吸盤だらけの八本の腕、腕ごとに脳がある。一瞬で色と肌の質感を変え、瓶の口をすり抜け、人の顔を覚える。",
  tags: ["octopus", "cephalopod", "rock", "japan", "food", "clever", "loop"],
  size: [84, 56],
  origin: [42, 36],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a1408", "#7a2c14", "#b85a30", "#e09060", "#ffc8a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-42, -36, 84, 56), BG = new Grid(-42, -36, 84, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -42, 42, 12, 10, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  const skin = (u, v, x, y, tt) => (spots(x, y, tt, 0.12, 2, 3) ? ["#2a0c04", "#4a1a0a", "#6a2a14", "#8a3c20", "#a85030"] : C);
  drawOctopus(g, {
    R: 12, tilt: -0.2, head: { r: 6.5 }, eye: { r: 2.2, ring: "#e0c080" }, skin,
    arms: { n: 8, L: 26, r: 2.6, curl: 1.1, spread: 1 },
    suckers: "#f0d0c0", papillae: 0.12, breathe: 0.05,
    outline: "#1a0804", lit: "#7a2c14",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 12, 26, 3, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 4);
  bubbles(p, t, D, 2, o.seed * 7 + 111, -8, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -34);
}
