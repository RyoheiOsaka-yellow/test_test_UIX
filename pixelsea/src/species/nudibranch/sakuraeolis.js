import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawAeolid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Sakura aeolid",
  ja: "サクラミノウミウシ",
  sci: "Sakuraeolis enosimensis",
  region: "Japan (Pacific coast of Honshu)",
  length: "4 cm",
  desc: "Named for Enoshima and for the cherry blossom: a glassy white body under a cloud of pink cerata with white tips, each one holding the stinging cells it stole from the hydroids it eats.",
  jadesc: "江ノ島と桜に名をもらったミノウミウシ。透き通った白い体に、先端が白い桜色のミノ。ミノの中には、食べたヒドロ虫から奪った刺胞を蓄えている。",
  tags: ["nudibranch", "aeolid", "pink", "japan", "loop"],
  size: [68, 48],
  origin: [32, 28],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#a09aa0", "#d0ccd0", "#f0eef0", "#ffffff", "#ffffff"],
    cerata: ["#7a2040", "#c84070", "#f070a0", "#ffb0d0", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -28, 68, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), CE = fit(o.cerata, 5), g = G.clear();
  drawAeolid(g, {
    L: 34, H: 3.5, alpha: 0.95, skin: () => C,
    cerata: { rows: 7, per: 3, len: 10, col: CE, tip: 0.22, fat: 0.25 },
    rhino: { h: 6, col: ["#a09aa0", "#d0ccd0", "#f0b0c0", "#ffd0e0", "#ffffff"] },
    oral: { len: 9, col: C },
    water: "#0b1a26",
    outline: "#7a5a68", lit: "#c8b0c0",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 6, 20, 2.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 18, 12, -10, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -26);
  if (o.scene !== false) caustics(p, t, D, -34, -28, 34, 18, hex("#8ee0c8"), 0.12);
}
