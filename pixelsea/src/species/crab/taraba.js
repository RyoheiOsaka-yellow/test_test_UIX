import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Red king crab",
  ja: "タラバガニ",
  sci: "Paralithodes camtschaticus",
  region: "Okhotsk, Bering Sea, Alaska; Hokkaido",
  length: "legs span 1.8 m",
  desc: "The king of the crab pots: a spiny red giant with three pairs of walking legs instead of four, because it is not a true crab at all but a hermit crab's cousin that gave up the shell. Alaskan fishers risk the Bering winter for it; Japanese buyers pay the most.",
  jadesc: "カニ鍋の王様。トゲだらけの赤い巨体だが、歩脚は4対ではなく3対。実はカニではなくヤドカリの仲間で、殻を捨てて進化した。アラスカの漁師はベーリング海の冬に命を懸け、日本が最高値で買う。",
  tags: ["crab", "anomura", "spiny", "cold", "food", "loop"],
  size: [96,56],
  origin: [48,24],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a0c08", "#8a1c14", "#c83828", "#e86848", "#ffa888"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -24, 96, 56), BG = new Grid(-48, -24, 96, 56);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  drawCrab(g, {
    W: 14, H: 11, shape: "round", floor: 26, scuttle: 1.5, bumps: 0.25,
    skin: (nx, ny) => (ny > 0.5 ? ["#8a5040", "#c08060", "#e0b090", "#f0d0b8", "#fff0e0"] : C),
    legs: { n: 3, L: 30, r: 2.2, cols: C, lift: 3, spines: 3, lengths: [1, 1, 0.9] },
    claws: { size: 2.6, L: 18, cols: C, open: 0.3, left: 0.8, right: 1.1 },
    eyes: { stalk: 2, r: 1, x: 0.3 },
    extra: (g, t, S) => { for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI; g.set(Math.cos(a) * S.W * 0.95 + S.shuffle, Math.sin(a) * S.H * 0.95 - 1, C[4]); } },
    outline: "#2a0604", lit: "#8a1c14",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -48, 50, 26, 6, o.seed);
  if (o.scene !== false) shadow(p, 0, 26, 40, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 145, 0, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -22);
}
