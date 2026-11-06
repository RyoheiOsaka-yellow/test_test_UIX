import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawDorid } from "./_body.js";
import { shift, shadow, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Spanish dancer",
  ja: "ミカドウミウシ",
  sci: "Hexabranchus sanguineus",
  region: "Indo-Pacific, Red Sea",
  length: "40 cm",
  desc: "The largest nudibranch, a blood-red giant that keeps its mantle rolled in when crawling and, disturbed, unfurls it and swims off in flamenco swirls. Its egg ribbon is a red rose.",
  jadesc: "最大級のウミウシ。血のように赤い巨体で、普段は外套膜を巻いて這い、驚くと縁を広げてフラメンコのように身をくねらせて泳ぐ。卵塊は赤いバラの形。",
  tags: ["nudibranch", "dorid", "red", "giant", "swim", "loop"],
  size: [84, 52],
  origin: [40, 30],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "reef",
  options: {
    palette: ["#4a0810", "#981820", "#d83030", "#ff6050", "#ffb0a0"],
    mottle: ["#8a1818", "#c84030", "#f07858", "#ffb090", "#ffe0d0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -30, 84, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), M = fit(o.mottle, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const skin = (u, v, x, y) => (((Math.round(x) * 3 + Math.round(y) * 5 + 2) % 7 < 2) && Math.abs(v) < 0.6 ? M : C);
  drawDorid(g, {
    L: 54, H: 15, hump: 0.3, foot: 3, dome: 0.55, skin,
    footCol: ["#4a0810", "#7a1820", "#a82830", "#d04040", "#ff8070"],
    margin: [[1, ["#8a2020", "#e05040", "#ff9070", "#ffd0b0", "#ffffff"]]],
    rhino: { x: 0.14, h: 6, col: C },
    gill: { x: 0.26, n: 6, r: 6, col: ["#5a0810", "#b02020", "#e85040", "#ff9070", "#ffe0d0"], spread: 1.1 },
    extra: (g, t, S) => {
      // the mantle's rolled edge ripples along the skirt
      for (let x = S.hx - S.L / 2 + 2; x < S.hx + S.L / 2 - 2; x++) {
        const u = S.uu(x), wave = Math.sin(x * 0.45 - ph * 2) * 1.2;
        const y = S.bot(u) + wave * Math.sqrt(1 - u * u);
        g.set(x, y, M[2]); g.set(x, y + 1, C[1]);
      }
    },
  }, t, D, o.seed);
  if (o.scene !== false) shadow(p, 0, 9, 30, 3.5, hex("#061a22"), 0.35);
  g.draw(p, 1, 0, 4);
  bubbles(p, t, D, 2, o.seed * 7 + 10, 20, -10, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -28);
  if (o.scene !== false) caustics(p, t, D, -42, -30, 42, 22, hex("#8ee0c8"), 0.12);
}
