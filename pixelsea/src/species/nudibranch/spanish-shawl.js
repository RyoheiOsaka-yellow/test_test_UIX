import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawAeolid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Spanish shawl",
  ja: "スパニッシュショール",
  sci: "Flabellinopsis iodinea",
  region: "California to Baja California",
  length: "5 cm",
  desc: "A violet aeolid in a shawl of flame-orange cerata, with scarlet rhinophores. Nudged by a predator it lets go and swims off in violent twists, which is more than most slugs can manage.",
  jadesc: "紫の体に燃えるようなオレンジの背側突起（ミノ）、深紅の触角。カリフォルニア沿岸の種で、危険を感じると岩を離れ、体をくねらせて泳いで逃げる。",
  tags: ["nudibranch", "aeolid", "purple", "orange", "pacific", "loop"],
  size: [68, 48],
  origin: [32, 28],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a0a48", "#5a1a90", "#8a3ac8", "#b870e8", "#e0b0ff"],
    cerata: ["#7a2000", "#d04808", "#ff7818", "#ffa840", "#ffd890"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -28, 68, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), CE = fit(o.cerata, 5), g = G.clear();
  drawAeolid(g, {
    L: 36, H: 3.8, skin: () => C,
    cerata: { rows: 7, per: 3, len: 11, col: CE, tip: 0.25, fat: 0.15 },
    rhino: { h: 6, col: ["#5a0810", "#a81820", "#e03030", "#ff6050", "#ffa090"] },
    oral: { len: 8, col: C },
    water: "#0a1a34",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 6, 20, 2.5, hex("#02060e"), 0.4);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 2, 12, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 14, -26);
  if (o.scene !== false) caustics(p, t, D, -34, -28, 34, 18, hex("#5ab6d6"), 0.1);
}
