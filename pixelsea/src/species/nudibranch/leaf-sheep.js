import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawAeolid } from "./_body.js";
import { shift, shadow, caustics } from "../_lib.js";

export const meta = {
  name: "Leaf sheep",
  ja: "テングモウミウシ",
  sci: "Costasiella kuroshimae",
  region: "Japan (Kuroshima), Indonesia, Philippines",
  length: "5 mm",
  desc: "A sea slug the size of a rice grain that looks like a cartoon sheep: a white face with two beady eyes, and a fleece of leaf-green cerata tipped in pink. It steals chloroplasts from the algae it eats and runs on sunlight for a while.",
  jadesc: "米粒ほどの小さなウミウシ。白い顔に黒い点の目、ピンクに染まる葉っぱのような緑のミノで「羊」そっくり。食べた藻の葉緑体を体に取り込み、しばらく光合成で生きる。",
  tags: ["sacoglossan", "sea slug", "green", "japan", "tiny", "cute", "loop"],
  size: [56, 44],
  origin: [26, 26],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#9a9a98", "#d0d0cc", "#f0f0ec", "#ffffff", "#ffffff"],
    leaf: ["#1a4a20", "#2a7a30", "#48b048", "#a8e060", "#f080b0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-26, -26, 56, 44), BG = new Grid(-26, -26, 56, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), LF = fit(o.leaf, 5), g = G.clear(), bg = BG.clear();
  // the algae it lives on: a dark green frond behind
  if (o.scene !== false) bg.ellipse(-4, 12, 26, 6, (nx, ny) => (ny < -0.4 ? hex("#2a6a38") : hex("#1a4a28")), 0.9);
  drawAeolid(g, {
    L: 20, H: 3.5, skin: () => C,
    cerata: { rows: 6, per: 3, len: 9, col: LF, tip: 0.22, fat: 0.85, lenK: (i, k) => 0.9 + 0.1 * ((i + k) % 2) },
    rhino: { h: 4, col: ["#2a2a28", "#4a4a48", "#8a8a88", "#d0d0cc", "#ffffff"] },
    oral: { len: 3, col: C },
    water: "#0b1a26",
    farCerata: true,
    extra: (g, t, S) => {
      // two black eyes close together on the white face
      g.set(S.L / 2 - 2, S.cy(0.06) - 0.5, hex("#0a0810")); g.set(S.L / 2 - 4.5, S.cy(0.1) - 0.5, hex("#0a0810"));
    },
    outline: "#4a6a40", lit: "#a0c080",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 6, 12, 2, hex("#061a22"), 0.3);
  g.draw(p, 1, 0, 2);
  if (o.scene !== false) caustics(p, t, D, -28, -26, 28, 16, hex("#8ee0c8"), 0.12);
}
