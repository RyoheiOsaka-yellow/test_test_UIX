import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Moon jelly",
  ja: "ミズクラゲ",
  sci: "Aurelia coerulea",
  region: "Coastal seas worldwide; every Japanese harbour in summer",
  length: "20–30 cm",
  desc: "The jellyfish everyone has seen: a glassy saucer with four horseshoe gonads showing through like a clover, a fringe of short hair-fine tentacles, and four frilly oral arms. Harmless to the touch, and in late summer harbours fill with them.",
  jadesc: "誰もが見たことのあるクラゲ。ガラスのような皿に四つ葉のように透ける馬蹄形の生殖腺、縁には短い糸のような触手、中央には四本のひだ状の口腕。刺されてもほぼ平気で、晩夏の港を埋め尽くす。",
  tags: ["jellyfish", "cnidaria", "harbour", "worldwide", "translucent", "loop"],
  size: [64, 60],
  origin: [32, 22],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a7080", "#8aa8b8", "#b8d0dc", "#dceaf0", "#f4fbff"],
    gonad: ["#6a4a60", "#a07898", "#c8a0c0", "#e0c0d8", "#f0e0ec"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -22, 64, 60);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), GN = fit(o.gonad, 5), g = G.clear();
  const k = beat(t, D, 1), y = lift(t, D, 1, 0, 4);
  const pattern = (x, yy, nx, ny) => { for (const [gx, gy] of [[-7, -5], [7, -5], [-4, -10], [4, -10]]) { const d = Math.hypot((x - gx) / 4.5, (yy - gy) / 2.6); if (d > 0.55 && d < 1) return GN; } return 0; };
  const b = bell(g, 26, 14, k, o.palette, pattern, { a: 0.65, frill: 8, dome: 0.6 });
  tentacles(g, b.W, 22, 9, k, t, D, o.palette, { a: 0.5, spread: 2, seed: o.seed });
  oralArms(g, 4, 16, 1.4, k, t, D, ["#7a8a98", "#a8b8c4", "#d0dce4", "#e8f0f4", "#ffffff"], { a: 0.7, seed: o.seed });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.5);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, y);
  p.glow(0, -6 + y, 24, hex("#b8d0dc"), 0.07);
  bubbles(p, t, D, 1, o.seed * 7 + 130, 10, 10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -20);
}
