import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Common hermit crab",
  ja: "ホンヤドカリ",
  sci: "Pagurus filholi",
  region: "Japan, Korea (tide pools)",
  length: "1–2 cm",
  desc: "The hermit crab of every Japanese tide pool, hauling a borrowed periwinkle shell on a soft curled abdomen, its right claw bigger than its left to plug the door. When it outgrows the shell it inspects a new one, then swaps in a blink.",
  jadesc: "日本の潮だまりならどこにでもいるヤドカリ。柔らかく巻いた腹を借り物の巻貝に収め、右のハサミが大きくて扉の栓になる。殻が窮屈になると新しい殻を吟味し、一瞬で引っ越す。",
  tags: ["hermit crab", "crustacean", "tidepool", "japan", "shell", "loop"],
  size: [64, 44],
  origin: [30, 24],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a2810", "#6a4a20", "#9a7038", "#c89858", "#f0c890"],
    shell: ["#2a2420", "#5a4c40", "#8a7a68", "#b8a890", "#e0d4c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -24, 64, 44), BG = new Grid(-30, -24, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), SH = fit(o.shell, 5), g = G.clear(), bg = BG.clear();
  if (o.scene !== false) rock(bg, -30, 34, 10, 10, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  drawHermit(g, {
    whorls: [[-14, 1, 11, 8], [-8, -8, 6, 4.5], [-4, -13, 3, 2.5]],
    shellPattern: (x, y, i) => (((Math.round(x * 0.8 + y * 0.6) + i * 2) % 4 === 0) ? ["#1a1410", "#3a2c20", "#5a4a38", "#7a6a58", "#9a8a78"] : SH),
    skin: () => C,
    legs: { L: 10, r: 1.2, cols: C, hairy: true },
    claws: { size: 1.8, L: 8, cols: C, left: 0.7, right: 1.1 },
    eyes: { stalk: 5 },
    floor: 10,
    outline: "#1a1008", lit: "#6a4a20",
  }, t, D, o.seed);
  if (o.scene !== false) bg.draw(p, 1);
  if (o.scene !== false) shadow(p, 0, 10, 22, 2, hex("#000000"), 0.5);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 141, 8, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 10, -22);
}
