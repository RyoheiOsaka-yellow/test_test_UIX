import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Immortal jellyfish",
  ja: "ベニクラゲ",
  sci: "Turritopsis dohrnii",
  region: "Mediterranean and Japan (Shirahama, Kagoshima); spreading worldwide",
  length: "4 mm",
  desc: "A jellyfish the size of a grain of rice, with a red stomach glowing through a clear bell and eighty hair-fine tentacles. Starved or hurt, it does what no other animal can: turns back into a polyp and starts life again. In theory, forever.",
  jadesc: "米粒ほどのクラゲ。透明な傘の中に赤い胃が透け、髪の毛のような触手が八十本。飢えたり傷ついたりすると、ほかのどんな動物にもできないこと、ポリプに若返ってやり直す。理屈の上では永遠に。",
  tags: ["jellyfish", "hydrozoa", "immortal", "tiny", "red", "loop"],
  size: [56,52],
  origin: [28,18],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a7a88", "#9ab0c0", "#c8dce8", "#e4f0f8", "#f8fcff"],
    red: ["#5a0810", "#a01820", "#e03030", "#ff6050", "#ffa090"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -18, 56, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const R = fit(o.red, 5), k = beat(t, D, 1), y = lift(t, D, 1, 0, 4);
  const b = bell(g, 14, 13, k, o.palette, (x, yy, nx, ny) => (Math.hypot(x / 4, (yy + 5) / 5) < 1 ? R : 0), { a: 0.55, frill: 0, dome: 0.9 });
  tentacles(g, b.W, 30, 14, k, t, D, o.palette, { a: 0.5, spread: 3, seed: o.seed });
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[3] : C[1]), 0.5);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, y);
  p.glow(0, -5 + y, 10, R[2], 0.2);
  bubbles(p, t, D, 1, o.seed * 7 + 134, 6, 6, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -16);
}
