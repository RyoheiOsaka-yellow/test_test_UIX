import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Japanese mitten crab",
  ja: "モクズガニ",
  sci: "Eriocheir japonica",
  region: "Rivers of Japan, Taiwan, Korea; spawns in the sea",
  length: "shell 8 cm",
  desc: "The river crab with mittens: claws furred in dense brown hair. It climbs rivers to live, then walks back down to the sea to spawn in autumn. Its Chinese cousin is the prized Shanghai hairy crab, and an invader of European rivers.",
  jadesc: "ハサミに濃い茶色の毛のミトンをはめた川のカニ。川を遡って育ち、秋に海へ下って産卵する。中国の近縁種が上海蟹で、欧州の川では外来種として問題に。",
  tags: ["crab", "crustacean", "river", "hairy", "japan", "food", "loop"],
  size: [64,44],
  origin: [32,22],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a2418", "#4e4430", "#766848", "#9a8c64", "#c0b088"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -22, 64, 44), BG = new Grid(-32, -22, 64, 44);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) plants(bg, t, D, -30, 30, 14, 4, ["#143a18", "#2a7030", "#60b848"], o.seed);
  drawCrab(g, {
    W: 11, H: 8, shape: "square", floor: 14, scuttle: 2,
    skin: () => C,
    legs: { n: 4, L: 12, r: 1.4, cols: C, lift: 2.5, hairy: true },
    claws: { size: 2, L: 8, cols: C, open: 0.3, palm: ["#2a1c10", "#4a3420", "#6a4c30", "#8a6440", "#a88050"] },
    eyes: { stalk: 2, r: 1, x: 0.35 },
    extra: (g, t, S) => { for (const side of [-1, 1]) for (let i = 0; i < 10; i++) g.set(side * (S.W * 0.5 + 4 + (i % 5)) + S.shuffle + (i > 4 ? 1 : -1), S.H * 0.6 + 4 + Math.floor(i / 5) * 2 + (i % 2), hex("#3a2816")); },
    outline: "#14100a", lit: "#4e4430",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 0.9);
  if (o.scene !== false) sandFloor(p, -32, 34, 14, 6, o.seed);
  if (o.scene !== false) shadow(p, 0, 14, 20, 2, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 149, 0, -8, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 10, -20);
}
