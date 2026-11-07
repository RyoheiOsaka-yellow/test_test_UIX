import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Asian shore crab",
  ja: "イソガニ",
  sci: "Hemigrapsus sanguineus",
  region: "Japan, Korea, China tide pools; invasive on US and European coasts",
  length: "shell 3.5 cm",
  desc: "The crab under every rock in a Japanese tide pool: a square green-brown shell banded on the legs, quick to scuttle and quicker to pinch. Carried in ballast water, it now swarms the shores of New England and the Netherlands.",
  jadesc: "日本の磯で石をひっくり返せば必ずいるカニ。四角い緑褐色の甲に縞模様の脚、素早く逃げ、すぐ挟む。バラスト水に乗って、今やニューイングランドやオランダの海岸にもあふれている。",
  tags: ["crab", "crustacean", "tidepool", "japan", "invasive", "loop"],
  size: [56,40],
  origin: [28,20],
  duration: 2.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1e2a1a", "#3a4a30", "#5c6a48", "#808a60", "#a8b080"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -20, 56, 40), BG = new Grid(-28, -20, 56, 40);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -28, 30, 12, 8, ROCK, o.seed);
  drawCrab(g, {
    W: 10, H: 6.5, shape: "square", floor: 12, scuttle: 2.5,
    skin: (nx, ny, x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 83) < 0.2 ? ["#5a3a30", "#8a5848", "#b07860", "#d0a080", "#e8c8a8"] : C),
    legs: { n: 4, L: 11, r: 1.3, cols: C, lift: 3 },
    claws: { size: 1.6, L: 7, cols: C, open: 0.4, palm: ["#5a3a30", "#8a5848", "#b07860", "#d0a080", "#e8c8a8"] },
    eyes: { stalk: 2, r: 1, x: 0.4 },
    outline: "#0e140c", lit: "#3a4a30",
  }, t, D, o.seed);
  g.recolor((x, y, c, al, tag) => (tag === 1 && Math.abs(x) > 11 && Math.round(y) % 3 === 0 ? C[1] : c));
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 12, 18, 2, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 147, 0, -8, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 10, -18);
}
