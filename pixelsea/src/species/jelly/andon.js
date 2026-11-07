import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Japanese box jelly",
  ja: "アンドンクラゲ",
  sci: "Carybdea brevipedalia",
  region: "Japan (Honshu south), Korea; shallow bays after mid-August",
  length: "bell 3 cm, tentacles 20 cm",
  desc: "A thumb-sized glass cube with one tentacle at each corner and real eyes, a fast and deliberate swimmer. The 'obon jellyfish' whose whip-like stings end the Japanese swimming season every August.",
  jadesc: "親指ほどのガラスの立方体で、四隅に一本ずつ触手、本物の目をもち、速く狙って泳ぐ。お盆の頃に現れて鞭のように刺し、海水浴シーズンを終わらせる「電気クラゲ」。",
  tags: ["jellyfish", "cubozoa", "box", "japan", "sting", "loop"],
  size: [56,60],
  origin: [28,16],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a7a80", "#8ab0b8", "#b8dce0", "#dcf4f4", "#f4ffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -16, 56, 60);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const k = beat(t, D, 2), y = lift(t, D, 2, 0, 5);
  const b = bell(g, 11, 14, k, o.palette, (x, yy, nx, ny) => (Math.abs(nx) > 0.8 ? ["#6a8a90", "#9ac0c8", "#c8e8ec", "#e8f8f8", "#ffffff"] : 0), { a: 0.6, frill: 0, dome: 1, box: true });
  for (const sx of [-1, 1]) { g.set(sx * 8, -8, hex("#0a0810"), 0.9); g.set(sx * 8, -7, hex("#0a0810"), 0.9); }
  tentacles(g, b.W, 2, 30, k, t, D, ["#6a8a90", "#9ac0c8", "#c8e8ec", "#e8f8f8", "#ffffff"], { a: 0.8, spread: 6, seed: o.seed, thick: 1.1 });
  tentacles(g, b.W * 0.7, 2, 26, k, t, D, ["#6a8a90", "#9ac0c8", "#c8e8ec", "#e8f8f8", "#ffffff"], { a: 0.6, spread: 5, seed: o.seed + 1, thick: 1 });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[3] : C[1]), 0.6);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 3, y);
  bubbles(p, t, D, 1, o.seed * 7 + 133, 6, 6, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -16);
}
