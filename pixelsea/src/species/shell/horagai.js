import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawSnail } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Triton's trumpet",
  ja: "ホラガイ",
  sci: "Charonia tritonis",
  region: "Indo-Pacific coral reefs",
  length: "50 cm",
  desc: "One of the largest snails in the sea, a half-metre spire of cream and chestnut crescents. It hunts the crown-of-thorns starfish that eat coral, so reefs with tritons stay healthier. Drilled at the tip, the shell is the conch that Japanese monks and generals blew.",
  jadesc: "海で最大級の巻貝。クリーム色に栗色の三日月模様が並ぶ50 cmの塔。サンゴを食い荒らすオニヒトデを襲う、サンゴ礁の守り手。先端に穴を開けたものが山伏や武将の吹く法螺貝。",
  tags: ["shell", "snail", "gastropod", "giant", "reef", "predator", "loop"],
  size: [88, 56],
  origin: [40, 34],
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a4028", "#9a7850", "#d0b088", "#eed8b8", "#fff4e0"],
    mark: ["#2a1810", "#5a3820", "#8a5830", "#b08050", "#d0a878"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -34, 88, 54);
const FOOT = ["#4a3020", "#8a6040", "#c09060", "#e0c090", "#f8e8c8"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), M = fit(o.mark, 5), g = G.clear();
  drawSnail(g, {
    whorls: [[-10, -11, 17, 11], [0, -22, 11, 7], [7, -30, 6.5, 4.5], [12, -35.5, 3.5, 2.5], [15, -39, 1.8, 1.5]],
    pattern: (x, y, i, nx, ny) => ((Math.round(x * 0.7 + y * 0.5) + i * 3) % 5 === 0 && Math.abs(ny) < 0.8 ? M : (Math.round(x * 0.7 + y * 0.5) + i * 3) % 5 === 1 && ny < 0.2 ? ["#8a6840", "#b89060", "#d8b890", "#f0d8b8", "#fff4e0"] : C),
    lip: [[6, -8], [26, -12], [28, -6], [24, 1], [6, 0]],
    lipCol: ["#8a4a30", "#c87850", "#f0a878", "#ffd0b0", "#fff0e8"],
    foot: { L: 50, H: 5, col: FOOT, head: 8 },
    tentacles: { len: 6, col: FOOT, eyes: "base" },
    extra: (g, t, S) => {
      // the siphonal canal: a short spout off the front of the body whorl, and brown dapples on the foot
      g.poly([[24, -12], [31, -14], [32, -11], [26, -8]], (x, y) => (y < -12 ? C[3] : C[2]), 1, 1);
      for (let x = -26; x < 24; x += 3) g.set(x + ((x / 3) % 2 ? 1 : 0), -3 - ((x / 3) % 3 === 0 ? 1 : 0), FOOT[1]);
    },
    outline: "#2a1810", lit: "#9a7850",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -40, 44, 2, 12, o.seed);
  if (o.scene !== false) shadow(p, 0, 2, 26, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1, 1);
  bubbles(p, t, D, 1, o.seed * 7 + 40, 14, -20, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 14, -32);
  if (o.scene !== false) caustics(p, t, D, -42, -34, 42, 8, hex("#8ee0c8"), 0.12);
}
