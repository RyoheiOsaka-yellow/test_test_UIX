import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Humboldt squid",
  ja: "アメリカオオアカイカ",
  sci: "Dosidicus gigas",
  region: "Eastern Pacific, Chile to California; Japanese fleets fish it off Peru",
  length: "1.5 m",
  desc: "The red devil (diablo rojo) of the Humboldt Current: a squid as long as a man that hunts in packs of a thousand, flashing its whole body red and white several times a second to signal. It has a beak that can cut cable, and most of the 'ika' in Japanese ready meals is this.",
  jadesc: "フンボルト海流の「赤い悪魔」。人の背丈ほどの巨体で千匹の群れをつくり、全身を毎秒何回も赤と白に点滅させて仲間と交信する。ケーブルも切るくちばしをもち、日本の惣菜のイカの多くはこの種。",
  tags: ["squid", "cephalopod", "giant", "pacific", "flash", "pack", "loop"],
  size: [112, 52],
  origin: [52, 26],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a0c10", "#8a1820", "#c83030", "#e86058", "#ffa090"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-52, -26, 112, 52);
const WHITE = ["#8a8080", "#c0b8b8", "#e8e0e0", "#fff8f8", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU, flash = Math.floor(t * 6) % 2 === 0, jet = Math.max(0, Math.sin(ph)) ** 2;
  const skin = (u, v, x, y, tt) => (flash ? (v > 0.5 ? WHITE : C) : v > 0.5 ? ["#b89090", "#e0c0c0", "#f8e8e8", "#ffffff", "#ffffff"] : ["#9a6060", "#c89090", "#e8c0c0", "#f8e0e0", "#fff8f8"]);
  drawSquid(g, {
    L: 60, H: 9, shape: "torpedo", skin,
    fins: { kind: "tail", len: 24, h: 12 },
    head: { r: 7.5 }, eye: { r: 2.8, ring: "#f0f0f8" },
    arms: { n: 8, L: 22, r: 2.6, curl: 0.5, suckers: "#ffe0e0" },
    tentacles: { L: 30, r: 1.3, club: 1.6 },
    jet,
    outline: "#2a0608", lit: "#8a1820",
  }, t, D, o.seed);
  g.draw(p, 1, -6 * jet + 2, Math.sin(ph) * 1.2);
  // the pack: shapes in the dark behind
  if (o.scene !== false) for (let i = 0; i < 3; i++) { const x = -44 + i * 30 + Math.sin(ph + i) * 3, y = -20 + (i % 2) * 36; for (let k = 0; k < 16; k++) p.blend(x + k, y + (k > 12 ? (k - 12) * 0.5 : 0), hex(flash ? "#6a1820" : "#4a3030"), 0.35); }
  bubbles(p, t, D, 2, o.seed * 7 + 116, -28 - 6 * jet, 2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
