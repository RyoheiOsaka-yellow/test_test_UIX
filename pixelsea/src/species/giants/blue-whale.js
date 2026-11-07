import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Blue whale",
  ja: "シロナガスクジラ",
  sci: "Balaenoptera musculus",
  region: "All oceans; feeds in polar seas, breeds in the tropics",
  length: "30 m",
  desc: "The largest animal that has ever lived, longer than three buses and heavier than any dinosaur. Mottled blue-grey with a tiny dorsal fin far down its back, it lives on krill, gulping a hundred tonnes of water at a time through pleated throat grooves.",
  jadesc: "史上最大の動物。バス3台分より長く、どの恐竜より重い。青灰色のまだら模様、背びれは尾の近くに小さく一つ。喉の畝を広げて一度に100 tの海水ごとオキアミを飲み込む。",
  tags: ["whale", "cetacean", "giant", "baleen", "krill", "loop"],
  size: [128, 48],
  origin: [64, 26],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#182838", "#2c4a60", "#4a7088", "#7898a8", "#a8c4d0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-64, -26, 128, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const skin = (u, v, x, y) => (v > 0.55 ? ["#4a6070", "#7a90a0", "#a8bcc8", "#d0dce4", "#f0f4f8"] : rand(Math.round(x / 3), Math.round(y / 2), 21) < 0.22 ? ["#2c4a60", "#4a7088", "#6a90a8", "#98b8c8", "#c0d8e4"] : C);
  drawFish(g, {
    L: 104, H: 9, peak: 0.4, nose: 0.55, stock: 0.14, bellyK: 1.05, skin,
    tail: { kind: "fluke", span: 6, len: 14, rays: false },
    dorsal: [{ u: 0.78, h: 3, w: 6, kind: "falcate", col: o.palette }],
    pectoral: { u: 0.28, len: 14, w: 4, angle: 0.5, v: 0.6, flap: 0.12 },
    eye: { u: 0.17, v: 0.15, r: 0.7, ring: "#2c4a60" },
    mouth: { len: 22, open: 0, v: 0.4, drop: 0.5 },
    swim: { kind: "whale", amp: 0.8 },
    extra: (g, t, S) => {
      // the throat grooves: pleats running back under the head
      for (let k = 0; k < 6; k++) g.line(S.xOf(0.06), 2 + k * 1.1, S.xOf(0.4), 5.5 + k * 0.6, C[1], 0.8, 1);
      // the blowhole ridge
      g.set(S.xOf(0.15), S.wave(0.15) - S.H * S.back(0.15) - 0.5, C[0]);
    },
    outline: "#0c1620", lit: "#4a7088",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -64, 64, -26, hex("#5ab6d6"), 0.07);
  g.draw(p, 1, 0, Math.sin((t / D) * TAU) * 1.5);
  blow(p, 36, -10 + Math.sin((t / D) * TAU) * 1.5, t, D, 0.1, 12);
  bubbles(p, t, D, 2, o.seed * 7 + 52, 20, 0, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
