import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Pom-pom crab",
  ja: "キンチャクガニ",
  sci: "Lybia tessellata",
  region: "Indo-Pacific reefs; Okinawa",
  length: "shell 1.5 cm",
  desc: "A fingernail-sized crab in a tessellated coat of pink and brown that carries a tiny stinging anemone in each claw like a pair of pom-poms, and waves them at anything that comes close. If it loses one, it tears the other in half to grow two.",
  jadesc: "爪ほどの大きさで、ピンクと茶のモザイク模様。両方のハサミに小さなイソギンチャクを一つずつ持ち、ポンポンのように振って敵を追い払う。片方をなくすと、残りを半分に裂いて二つに増やす。",
  tags: ["crab", "crustacean", "anemone", "tiny", "reef", "cute", "loop"],
  size: [56,40],
  origin: [28,20],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a2838", "#9a4858", "#d08088", "#f0b0b0", "#ffe0e0"],
    pom: ["#5a4a10", "#a08a20", "#e0c840", "#ffe880", "#fff8c0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -20, 56, 40), BG = new Grid(-28, -20, 56, 40);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const P = fit(o.pom, 5);
  drawCrab(g, {
    W: 8, H: 5.5, shape: "trapezoid", floor: 11, scuttle: 1.5,
    skin: (nx, ny, x, y) => (((Math.round(x / 2) + Math.round(y / 2)) % 2 === 0) ? ["#3a1c28", "#6a3040", "#9a5060", "#c07888", "#e0a8b0"] : C),
    legs: { n: 4, L: 9, r: 1.1, cols: C, lift: 2 },
    claws: { size: 0.8, L: 5, cols: C, open: 0.2 },
    eyes: { stalk: 2, r: 0.9, x: 0.35 },
    extra: (g, t, S) => {
      // the anemones: a tuft of tentacles on each claw, shaken
      for (const side of [-1, 1]) { const x = side * (S.W * 0.5 + 5) + S.shuffle + Math.sin(S.ph * 4 + side) * 1, y = S.H * 0.6 + 3; for (let i = 0; i < 9; i++) { const a = -Math.PI + (i / 8) * Math.PI * 2; g.line(x, y, x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, (u) => (u > 0.6 ? P[4] : P[3])); } g.ellipse(x, y, 1.4, 1.4, P[2]); }
    },
    outline: "#2a1018", lit: "#9a4858",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -28, 30, 11, 6, o.seed);
  if (o.scene !== false) shadow(p, 0, 11, 14, 2, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 148, 0, -8, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 10, -18);
}
