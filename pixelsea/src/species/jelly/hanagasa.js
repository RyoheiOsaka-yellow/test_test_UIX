import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Flower hat jelly",
  ja: "ハナガサクラゲ",
  sci: "Olindias formosus",
  region: "Japan (Honshu), Korea; shallow water in spring",
  length: "bell 15 cm",
  desc: "A flower-hat of a jellyfish: a clear bell pinstriped with colour and fringed with coiled tentacles tipped fluorescent pink and green that glow under blue light. It rests on the bottom by day, tentacles curled, and hunts small fish at night. Its sting is painful.",
  jadesc: "花笠のようなクラゲ。透明な傘に色の筋が走り、縁には巻いた触手。先端はピンクと緑に蛍光し、青い光の下で輝く。昼は底で触手を巻いて休み、夜に小魚を狩る。刺されると痛い。",
  tags: ["jellyfish", "hydrozoa", "fluorescent", "japan", "flower", "loop"],
  size: [64,52],
  origin: [32,18],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a5a70", "#8a8aa8", "#b8b8d0", "#dcdcec", "#f8f8ff"],
    tip: ["#6a1040", "#c02070", "#ff40a0", "#ff90d0", "#ffd0f0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -18, 64, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const T = fit(o.tip, 5), k = beat(t, D, 1), y = lift(t, D, 1, 0, 3), ph = (t / D) * TAU;
  const b = bell(g, 22, 12, k, o.palette, (x, yy, nx, ny) => (Math.round(Math.atan2(yy + 2, x) * 7) % 3 === 0 ? ["#4a3a60", "#7a5a98", "#a888c8", "#d0b8e8", "#f0e0ff"] : Math.round(Math.atan2(yy + 2, x) * 7) % 3 === 1 ? ["#3a5a50", "#5a8a78", "#88b8a0", "#b8e0c8", "#e8fff0"] : 0), { a: 0.6, frill: 0, dome: 0.65 });
  // tentacles that coil at the tips, glowing pink and green
  for (let i = 0; i < 16; i++) {
    const u = -1 + (i / 15) * 2, x0 = u * b.W * 0.95, L = 10 + 5 * rand(o.seed, i), sw = lnoise(t, D, 2, i * 0.3, o.seed) * 3;
    const pts = [[x0, 0], [x0 + u * 2 + sw * 0.5, L * 0.5], [x0 + u * 3 + sw, L], [x0 + u * 3 + sw + (i % 2 ? 2 : -2), L + 1.5], [x0 + u * 3 + sw + (i % 2 ? 1 : -1), L + 3]];
    g.tube(pts, 0.6, (v, d) => (v > 0.7 ? (i % 2 ? T[3] : hex("#60f0a0")) : C[2]), 0.8);
  }
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[3] : C[1]), 0.6);
  g.draw(p, 1, Math.sin(ph) * 1.5, y);
  for (let i = 0; i < 16; i++) { const u = -1 + (i / 15) * 2; p.glow(u * b.W * 0.95 + u * 3 + Math.sin(ph) * 1.5, 12 + 5 * rand(o.seed, i) + y, 3.5, i % 2 ? T[2] : hex("#40e080"), 0.3); }
  bubbles(p, t, D, 1, o.seed * 7 + 138, 8, 8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -16);
}
