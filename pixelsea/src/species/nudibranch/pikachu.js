import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid, rhinophore } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Pikachu nudibranch",
  ja: "ウデフリツノザヤウミウシ",
  sci: "Thecacera pacifica",
  region: "Indo-West Pacific, Japan",
  length: "3 cm",
  desc: "Orange with black-and-blue tipped 'ears' and two matching horns behind the gills: the resemblance to a certain electric mouse has made it a diver favourite. It waves its arms (ude-furi) as it crawls.",
  jadesc: "オレンジの体に、黒と青に染まった「耳」の触角と、エラの後ろにそろいの二本の角。ある電気ネズミに似ているとダイバーに大人気。這いながら腕を振るのが名前の由来。",
  tags: ["nudibranch", "polycerid", "orange", "japan", "cute", "loop"],
  size: [60, 46],
  origin: [28, 28],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#7a3800", "#c86808", "#f09020", "#ffb848", "#ffe0a0"],
    tip: ["#06080e", "#101828", "#1a2840", "#2060b0", "#48a0ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -28, 60, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), T = fit(o.tip, 5), g = G.clear();
  const ph = (t / D) * TAU;
  drawDorid(g, {
    L: 30, H: 10, hump: 0.3, foot: 2.5, dome: 0.6, skin: () => C,
    footCol: ["#7a3800", "#a85008", "#d07818", "#f0a040", "#ffd080"],
    margin: [],
    rhino: { x: 0.16, h: 7, col: ["#06080e", "#101828", "#2060b0", "#48a0ff", "#1a2840"], sheath: C },
    gill: { x: 0.4, n: 5, r: 4.5, col: ["#7a3800", "#e08020", "#ffb040", "#ffe0a0", "#ffffff"] },
    extra: (g, t, S) => {
      // two horns behind the gills, black with blue tips, waving
      for (const [k, dx] of [[0, -3], [1, 0]]) {
        const x = S.hx - S.L / 2 + 0.2 * S.L + dx, y = S.top(S.uu(x)) + 0.5;
        const lean = -2.5 + Math.sin(ph + k) * 1.2;
        g.tube([[x, y], [x + lean * 0.5, y - 3.5], [x + lean, y - 7]], (u) => 0.9, (u, d) => (u > 0.55 ? (d > 0.6 ? T[3] : T[4]) : d > 0.6 ? T[1] : T[2]), 1, 7);
      }
    },
    outline: "#4a2000", lit: "#a86010",
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 7, 16, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, 0, 3);
  bubbles(p, t, D, 1, o.seed * 7 + 12, 10, -8, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 14, -26);
  if (o.scene !== false) caustics(p, t, D, -30, -28, 30, 18, hex("#e6cc96"), 0.1);
}
