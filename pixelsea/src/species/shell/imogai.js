import { fit, TAU, hex, Grid, rand, ease } from "../../core/index.js";
import { drawSnail } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Geography cone",
  ja: "アンボイナガイ",
  sci: "Conus geographus",
  region: "Indo-Pacific reefs, north to Okinawa",
  length: "12 cm",
  desc: "The most dangerous snail alive. A cone the colour of old parchment, netted in brown, that hunts fish at night: it stretches out a pink proboscis and fires a venomous harpoon tooth. Its sting has killed divers who picked it up for the pretty shell.",
  jadesc: "最も危険な貝。古い羊皮紙のような色に茶色の網目模様。夜に魚を狩り、ピンクの吻を伸ばして毒の銛（歯舌）を撃ち込む。「ハブガイ」とも呼ばれ、殻を拾ったダイバーが刺されて亡くなった例もある。",
  tags: ["shell", "snail", "gastropod", "venom", "reef", "night", "loop"],
  size: [68, 44],
  origin: [32, 30],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a4a30", "#9a8458", "#d0b888", "#eedcb8", "#fff4e0"],
    net: ["#2a1c10", "#5a3c20", "#8a6030", "#b08848", "#d0a868"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -30, 68, 42);
const FOOT = ["#3a2a28", "#6a4a48", "#a07870", "#c8a098", "#e8d0c8"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), N = fit(o.net, 5), g = G.clear();
  const u = t / D, strike = u < 0.12 ? ease.outCubic(u / 0.12) : u < 0.5 ? 1 - ease.inOutSine((u - 0.12) / 0.38) : 0;
  drawSnail(g, {
    whorls: [[-4, -8, 18, 7.5], [9, -14, 7, 3]],
    pattern: (x, y, i, nx, ny) => ((Math.round(x) + Math.round(y) * 3) % 4 === 0 && rand(Math.round(x / 2), Math.round(y / 2), 12) < 0.75 ? N : C),
    lip: [[12, -14], [18, -12], [17, -3], [8, -1]],
    lipCol: ["#5a4a30", "#9a8458", "#d0b888", "#eedcb8", "#fff4e0"],
    foot: { L: 34, H: 4, col: FOOT, head: 6 },
    tentacles: { len: 4, col: FOOT, eyes: "tip" },
    crawl: 0.3,
    extra: (g, t, S) => {
      // the cone's shape: the body whorl narrows toward the front like a cone laid on its side
      g.poly([[14, -16], [26, -9], [26, -6], [14, 0]], (x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 12) < 0.4 ? N[2] : C[2]), 1, 1);
      // the siphon reaching forward, and the pink proboscis shooting out when it strikes
      g.tube([[22, -11], [28, -13]], 1, (uu, d) => (d > 0.7 ? FOOT[1] : FOOT[3]), 1, 7);
      if (strike > 0.05) {
        const L = 16 * strike;
        g.tube([[24, -5], [24 + L, -6 - L * 0.1]], 1.1, (uu, d) => (uu > 0.9 ? hex("#ffffff") : d > 0.7 ? hex("#b04060") : hex("#f090a8")), 1, 7);
      }
    },
    outline: "#2a1c10", lit: "#9a8458",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -32, 36, 2, 12, o.seed);
  if (o.scene !== false) shadow(p, 0, 2, 22, 2.5, hex("#02060e"), 0.4);
  g.draw(p, 1, 0, 1);
  bubbles(p, t, D, 1, o.seed * 7 + 43, 10, -14, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -28);
  p.glow(24, -8, 10, hex("#f090a8"), 0.12 * strike);
}
