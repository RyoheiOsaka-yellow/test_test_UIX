import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Land hermit crab",
  ja: "オカヤドカリ",
  sci: "Coenobita purpureus",
  region: "Okinawa and the Nansei Islands (beaches and coastal forest)",
  length: "shell 3 cm",
  desc: "A purple land hermit crab of Okinawa's beaches, a protected natural monument, carrying a turban or nerite shell up from the tideline into the forest. It breathes air through damp gills, drinks from puddles, and walks down to the sea on summer nights to release its young.",
  jadesc: "沖縄の浜に住む紫色のオカヤドカリ。国の天然記念物で、サザエやアマオブネの殻を背負って汀線から林の中まで歩く。湿ったエラで空気を吸い、水たまりで水を飲み、夏の夜に海へ下りて幼生を放つ。",
  tags: ["hermit crab", "crustacean", "land", "okinawa", "protected", "loop"],
  size: [64,44],
  origin: [30,24],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a1a4a", "#4a3080", "#7050b0", "#9878d0", "#c8a8f0"],
    shell: ["#2a2418", "#5a4c38", "#8a7a60", "#b8a888", "#e0d4b8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -24, 64, 44), BG = new Grid(-30, -24, 64, 44);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const SH = fit(o.shell, 5);
  drawHermit(g, {
    whorls: [[-14, 0, 12, 9], [-6, -9, 7, 5], [-1, -14, 3.5, 2.8]],
    shellPattern: (x, y, i) => (rand(Math.round(x / 2), Math.round(y / 2), 84) < 0.2 ? ["#1a1410", "#3a2c20", "#5a4a38", "#7a6a58", "#9a8a78"] : SH),
    skin: () => C,
    legs: { L: 10, r: 1.4, cols: C },
    claws: { size: 2, L: 8, cols: C, left: 1.1, right: 0.75 },
    eyes: { stalk: 5 },
    floor: 10,
    outline: "#140c24", lit: "#4a3080",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -30, 34, 10, 10, o.seed);
  if (o.scene !== false) shadow(p, 0, 10, 22, 2, hex("#000000"), 0.5);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, 0);
}
