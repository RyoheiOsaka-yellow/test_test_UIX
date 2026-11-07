import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Lion's mane jellyfish",
  ja: "キタユウレイクラゲ（ライオンズメーン）",
  sci: "Cyanea capillata",
  region: "Arctic and cold northern seas; Hokkaido in winter",
  length: "bell 2 m, tentacles 30 m",
  desc: "The longest animal in the sea by some measures: a red-orange bell two metres across trailing a mane of hundreds of tentacles, thirty metres and more, in eight tangled clusters. It drifts the cold northern oceans, and young fish shelter among the stings.",
  jadesc: "触手を含めれば海で最も長い動物とも。赤橙色の傘は直径2 m、八つの房に分かれた何百本もの触手は30 m以上にたなびく。北の冷たい海を漂い、稚魚はその刺す触手の中に隠れて育つ。",
  tags: ["jellyfish", "cnidaria", "giant", "arctic", "mane", "loop"],
  size: [96,88],
  origin: [48,24],
  duration: 5.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a1c10", "#9a3820", "#d06030", "#f09050", "#ffc890"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -24, 96, 88);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const k = beat(t, D, 1), y = lift(t, D, 1, 0, 4);
  const b = bell(g, 40, 18, k, o.palette, (x, yy, nx, ny) => (Math.round(Math.atan2(yy + 3, x) * 8) % 2 === 0 && ny > 0.4 ? ["#4a1408", "#7a2810", "#a84018", "#d06030", "#f09050"] : 0), { a: 0.85, frill: 16, dome: 0.6 });
  for (let c = 0; c < 8; c++) { const u = -1 + (c / 7) * 2; tentacles(g, 4, 7, 50 + 10 * Math.abs(Math.sin(c * 1.9)), k, t, D, ["#6a2410", "#a04020", "#d07040", "#f0a070", "#ffd0a0"], { a: 0.7, spread: 7, seed: o.seed + c, y0: 1, lag: 0.6 }); g.recolor((x, yy, cc) => cc); }
  g.recolor((x, yy, c, al, tag) => c);
  oralArms(g, 6, 30, 2.4, k, t, D, ["#7a2c18", "#b05028", "#e08048", "#ffb080", "#ffe0c0"], { a: 0.85, seed: o.seed });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.7);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, y);
  p.glow(0, -6 + y, 30, hex("#d06030"), 0.07);
  bubbles(p, t, D, 2, o.seed * 7 + 139, 20, 20, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -22);
}
