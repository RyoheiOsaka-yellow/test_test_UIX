import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Japanese blue crab",
  ja: "ガザミ（ワタリガニ）",
  sci: "Portunus trituberculatus",
  region: "Japan, Korea, China (sandy bays)",
  length: "shell 20 cm wide",
  desc: "The swimming crab of Japanese bays: a wide diamond of a shell with a spike at each corner, long blue-and-white claws, and the last pair of legs flattened into paddles that row it through the water at night. The most fished crab in the world.",
  jadesc: "日本の湾のワタリガニ。両端にトゲをもつ菱形の甲、青と白の長いハサミ、最後の脚はオールのように平たく、夜はこれで泳いで渡る。世界でもっとも漁獲量の多いカニ。",
  tags: ["crab", "crustacean", "swimming", "japan", "sand", "food", "loop"],
  size: [80, 48],
  origin: [40, 24],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a3a30", "#4a6450", "#7a9070", "#a8b898", "#d0dcc0"],
    blue: ["#1a3a70", "#2a60b0", "#4890e0", "#88c0f8", "#d0e8ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -24, 80, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), B = fit(o.blue, 5), g = G.clear();
  drawCrab(g, {
    W: 18, H: 7, shape: "hex", floor: 14, scuttle: 3,
    skin: (nx, ny, x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 81) < 0.15 ? ["#b8c8b0", "#d8e4d0", "#f0f8e8", "#ffffff", "#ffffff"] : C),
    legs: { n: 4, L: 16, r: 1.2, cols: B, lift: 2.5, lengths: [1, 0.95, 0.9, 0.7] },
    claws: { size: 2.4, L: 14, cols: B, palm: B, open: 0.3, spotted: true },
    eyes: { stalk: 2, r: 1, x: 0.25 },
    extra: (g, t, S) => {
      // the spikes at the shell's corners, and the paddles on the last legs
      for (const side of [-1, 1]) { g.line(side * S.W * 0.95 + S.shuffle, 0, side * (S.W + 4) + S.shuffle, -1, C[4]); }
      for (const side of [-1, 1]) g.ellipse(side * (S.W + 7) + S.shuffle, S.floor - 4 + Math.max(0, Math.sin(S.ph * 2 + (side > 0 ? 4.8 : 1.7))) * -1.5, 3.2, 1.8, (nx, ny) => (ny < 0 ? B[3] : B[2]));
    },
    outline: "#141c18", lit: "#4a6450",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -40, 42, 14, 8, o.seed);
  if (o.scene !== false) shadow(p, 0, 14, 30, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 2, o.seed * 7 + 140, 0, -10, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -22);
}
