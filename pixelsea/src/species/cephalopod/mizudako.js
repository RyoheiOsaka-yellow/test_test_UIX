import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Giant Pacific octopus",
  ja: "ミズダコ",
  sci: "Enteroctopus dofleini",
  region: "North Pacific; Hokkaido, Alaska, British Columbia",
  length: "3–5 m across, 50 kg",
  desc: "The largest octopus, a red giant of cold northern water with arms five metres tip to tip and skin that raises into ridges and horns. It lives four years, and the female starves for months guarding her strings of eggs.",
  jadesc: "最大のタコ。北の冷たい海に住む赤い巨体で、腕を広げると5 m。皮膚を畝や角のように盛り上げる。寿命は4年ほどで、雌は何か月も食べずに卵を守って死ぬ。",
  tags: ["octopus", "cephalopod", "giant", "cold", "japan", "loop"],
  size: [112, 64],
  origin: [56, 40],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a0c08", "#8a1c14", "#c03828", "#e06848", "#ffa080"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -40, 112, 64), BG = new Grid(-56, -40, 112, 64);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -56, 56, 14, 10, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  const skin = (u, v, x, y, tt) => (spots(x, y, tt, 0.1, 1, 7) ? ["#2a0404", "#4a0c08", "#6a1410", "#8a2018", "#a83020"] : C);
  drawOctopus(g, {
    R: 17, tilt: -0.2, head: { r: 9 }, eye: { r: 2.8, ring: "#e8c890" }, skin,
    arms: { n: 8, L: 42, r: 3.4, curl: 1.0, spread: 1 },
    suckers: "#ffe0d0", papillae: 0.2, breathe: 0.04,
    outline: "#1a0404", lit: "#8a1c14",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 14, 40, 3, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 6);
  bubbles(p, t, D, 2, o.seed * 7 + 117, -10, -14, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -38);
}
