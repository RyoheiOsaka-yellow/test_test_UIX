import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Electric blue hermit crab",
  ja: "ユビワサンゴヤドカリ",
  sci: "Calcinus elegans",
  region: "Indo-Pacific reefs; Okinawa",
  length: "shell 2 cm",
  desc: "A reef hermit crab dressed to be noticed: black legs ringed in electric blue, orange antennae and blue-and-black eyestalks, housed in a small cone or cerith shell. It picks algae off the rock and is a favourite of marine aquarists.",
  jadesc: "目立つ装いのサンゴ礁のヤドカリ。黒い脚に電気のような青の指輪模様、橙色の触角、青と黒の眼柄。小さな巻貝に住み、岩の藻をつまむ。マリンアクアリウムの人気者。",
  tags: ["hermit crab", "crustacean", "reef", "blue", "okinawa", "loop"],
  size: [56,40],
  origin: [26,22],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a0a14", "#1c1c2a", "#303044", "#484860", "#6a6a80"],
    blue: ["#102860", "#1850b8", "#2888f0", "#60c0ff", "#c0f0ff"],
    shell: ["#4a4030", "#8a7858", "#b8a880", "#d8cca8", "#f0e8d0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-26, -22, 56, 40), BG = new Grid(-26, -22, 56, 40);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const B = fit(o.blue, 5), SH = fit(o.shell, 5);
  drawHermit(g, {
    whorls: [[-12, 1, 10, 7], [-5, -7, 6, 4.5], [0, -12, 3.5, 2.8], [3, -15.5, 2, 1.6]],
    shellPattern: (x, y, i) => (((Math.round(x * 0.7 + y * 0.7) + i) % 3 === 0) ? ["#2a2418", "#5a4c38", "#7a6a58", "#9a8a78", "#b8a898"] : SH),
    skin: () => C,
    legs: { L: 9, r: 1.3, cols: C },
    claws: { size: 1.7, L: 7, cols: C, left: 1, right: 0.8 },
    eyes: { stalk: 5 },
    bands: (x, y) => (y > -6 && x > -2 && Math.round(y) % 3 === 0 ? B : 0),
    floor: 10,
    outline: "#040408", lit: "#303044",
  }, t, D, o.seed);
  g.recolor((x, y, c, al, tag) => (x > 6 && y < -8 && y > -15 && Math.abs(x - 11) < 2 ? B[3] : c));
  if (o.scene !== false) sandFloor(p, -26, 30, 10, 8, o.seed);
  if (o.scene !== false) shadow(p, 0, 10, 20, 2, hex("#000000"), 0.5);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 150, 8, -6, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 10, -20);
}
