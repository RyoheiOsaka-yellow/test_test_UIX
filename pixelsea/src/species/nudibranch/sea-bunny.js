import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Sea bunny",
  ja: "ゴマフビロードウミウシ",
  sci: "Jorunna parva",
  region: "Japan to the Indo-Pacific",
  length: "2 cm",
  desc: "The internet's rabbit: a fuzz of tiny papillae sprinkled with black, two black-tipped rhinophores for ears and a gill tuft for a tail. The 'fur' is how it tastes the water.",
  jadesc: "SNSで「海のうさぎ」として有名に。黒ゴマを散らしたビロードのような突起、黒い先端の触角が耳、エラが尻尾に見える。「毛」は水の匂いを感じる感覚器。",
  tags: ["nudibranch", "dorid", "fuzzy", "japan", "cute", "loop"],
  size: [56, 44],
  origin: [26, 26],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#8a7a60", "#c8b890", "#eee4c8", "#fcf8ea", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-26, -26, 56, 44);
const BLACK = ["#06080e", "#101420", "#1a2030", "#283040", "#384050"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  drawDorid(g, {
    L: 26, H: 11, hump: 0.4, foot: 2, dome: 0.45, skin: () => C,
    footCol: ["#8a7a60", "#b8a880", "#d8ccaa", "#f0e8d0", "#ffffff"],
    margin: [],
    bumps: (x, y, u, v) => (rand(Math.round(x), Math.round(y), 3) < 0.1 && Math.abs(v) < 0.85 ? BLACK : rand(Math.round(x), Math.round(y), 5) < 0.3 ? ["#c8b890", "#eee4c8", "#ffffff", "#ffffff", "#ffffff"] : 0),
    rhino: { x: 0.16, h: 6, col: ["#06080e", "#1a2030", "#c8b890", "#eee4c8", "#1a2030"] },
    gill: { x: 0.18, n: 5, r: 4, col: ["#4a4030", "#8a7a60", "#c8b890", "#eee4c8", "#ffffff"] },
    outline: "#5a4a38", lit: "#a89878",
    extra: (g, t, S) => {
      // the fuzz: a halo of little tufts around the body
      for (let x = S.hx - S.L / 2 + 1; x < S.hx + S.L / 2; x += 2) {
        const u = S.uu(x), ty = S.top(u);
        g.set(x + ((Math.round(x) % 4) ? 0 : 1), ty - 1, C[2], 0.9);
      }
    },
  }, t, D, o.seed);
  // the "ears": black tips on the rhinophores
  if (o.scene !== false) shadow(p, 0, 7, 14, 2.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 8, 8, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -28, -26, 28, 18, hex("#8ee0c8"), 0.12);
}
