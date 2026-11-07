import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Fiddler crab",
  ja: "シオマネキ",
  sci: "Tubuca arcuata",
  region: "Mud flats of western Japan (Ariake Sea), Korea, China",
  length: "shell 3.5 cm",
  desc: "The 'tide-beckoner': the male of this mud-flat crab has one claw grown absurdly large, half his weight, which he waves at low tide to call females and warn rivals. The other claw, small, is the one he eats with. The Ariake Sea flats are full of waving arms.",
  jadesc: "「潮を招く」カニ。雄は片方のハサミが体重の半分ほどに巨大化し、干潮の泥干潟でこれを振って雌を呼び、ライバルを威嚇する。小さいほうのハサミで食事をする。有明海の干潟は振られる腕でいっぱい。",
  tags: ["crab", "crustacean", "mudflat", "japan", "claw", "loop"],
  size: [64,44],
  origin: [32,22],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a2420", "#4a4038", "#6a6050", "#8a8070", "#b0a890"],
    red: ["#5a1408", "#a02810", "#e04820", "#ff8050", "#ffb890"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -22, 64, 44), BG = new Grid(-32, -22, 64, 44);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const R = fit(o.red, 5);
  drawCrab(g, {
    W: 9, H: 6, shape: "trapezoid", floor: 14, scuttle: 2,
    skin: (nx, ny) => (ny < -0.3 ? ["#1a3a50", "#2a5a78", "#4a80a0", "#78a8c0", "#b0d0e0"] : C),
    legs: { n: 4, L: 10, r: 1.2, cols: C, lift: 2.5 },
    claws: { size: 1.2, L: 6, cols: R, open: 0.3, left: 0.6, right: 3.2, raiseRight: 1.0 },
    eyes: { stalk: 5, r: 1, x: 0.2 },
    outline: "#141008", lit: "#4a4038",
  }, t, D, o.seed);
  if (o.scene !== false) { for (let yy = 14; yy < 22; yy++) for (let x = -32; x < 34; x++) p.dot(x, yy, (x * 7 + yy * 3) % 11 < 2 ? hex("#2a2418") : hex("#3a3424"), 0.9); for (let i = 0; i < 5; i++) p.ellipse(-28 + i * 14, 15, 2, 0.8, hex("#1a1810")); }
  if (o.scene !== false) shadow(p, 0, 14, 16, 2, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
}
