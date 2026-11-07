import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Kubary's nembrotha",
  ja: "クロスジリュウグウウミウシ",
  sci: "Nembrotha kubaryana",
  region: "Indo-West Pacific reefs",
  length: "12 cm",
  desc: "A big velvet-black slug striped in electric green, with red-orange rhinophores, gills and foot edge. It grazes on sea squirts and recycles their toxins into its own slime.",
  jadesc: "ビロードのような黒い体に電撃のような緑の縦縞、触角・エラ・足の縁は赤橙。ホヤを食べて、その毒を自分の粘液に蓄える大型種。",
  tags: ["nudibranch", "polycerid", "black", "green", "reef", "loop"],
  size: [72, 44],
  origin: [34, 26],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#040806", "#0c1410", "#162018", "#243028", "#3a4a3c"],
    stripe: ["#0a4a1a", "#1a8a30", "#30c848", "#70f080", "#c0ffc0"],
    red: ["#5a0808", "#a81810", "#e83018", "#ff6038", "#ffa070"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-34, -26, 72, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.stripe, 5), R = fit(o.red, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    if (u > 0.1 && u < 0.95 && (Math.abs(v + 0.6) < 0.1 || Math.abs(v + 0.1) < 0.1 || Math.abs(v - 0.45) < 0.1)) return S;
    return C;
  };
  drawDorid(g, {
    L: 44, H: 11, hump: 0.2, foot: 2.5, dome: 0.65, skin,
    footCol: R,
    margin: [],
    rhino: { x: 0.14, h: 6, col: R },
    gill: { x: 0.3, n: 5, r: 5, col: R },
    outline: "#020403", lit: "#1a2a1c",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 24, 3, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 6, 16, -8, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -36, -26, 36, 18, hex("#8ee0c8"), 0.12);
}
