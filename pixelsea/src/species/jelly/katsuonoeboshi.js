import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Portuguese man o' war",
  ja: "カツオノエボシ",
  sci: "Physalia physalis",
  region: "Warm oceans worldwide; blown onto Japanese beaches in summer",
  length: "float 12 cm, tentacles 10 m",
  desc: "Not one animal but a colony: a gas-filled blue sail riding the surface, and beneath it tentacles tens of metres long that sting like fire. It cannot swim, only sail where the wind takes it, which is often a Shonan beach in August.",
  jadesc: "一匹ではなく群体。青いガス入りの帆で海面を漂い、その下に何十 mもの、火のように刺す触手を垂らす。泳げず風まかせで、8月の湘南の浜に流れ着く。",
  tags: ["jellyfish", "siphonophore", "surface", "sting", "blue", "loop"],
  size: [72,64],
  origin: [36,14],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a3a80", "#2860c0", "#4890e0", "#88c0f8", "#d8f0ff"],
    tent: ["#2a1858", "#4a2a98", "#7048d0", "#a080f0", "#d8c0ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -14, 72, 64);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const T = fit(o.tent, 5), ph = (t / D) * TAU, bob = Math.sin(ph) * 1.5;
  // the float: a crested bladder at the surface, pink-violet along the crest; the surface line and glare
  g.ellipse(0, 0, 18, 7, (nx, ny) => (ny < -0.5 ? C[4] : ny < 0.2 ? C[3] : C[2]), 0.9);
  for (let x = -14; x <= 14; x++) { const h = 4 + 3 * Math.sin((x + 14) / 28 * Math.PI) + Math.sin(x * 1.2 + ph) * 0.6; g.line(x, -5, x, -5 - h, (u) => (u > 0.7 ? hex("#f0a0e0") : C[3]), 0.85); }
  // the colony below: fishing tentacles long and beaded, feeding bodies in a cluster
  for (let i = 0; i < 7; i++) { const x = -12 + i * 4; g.ellipse(x, 8 + (i % 2) * 2, 2.2, 2.6, (nx, ny) => (ny < 0 ? T[3] : T[2]), 0.85); }
  tentacles(g, 14, 6, 40, 0.3 + 0.2 * Math.sin(ph), t, D, o.tent, { a: 0.8, spread: 6, seed: o.seed, y0: 9 });
  g.recolor((x, yy, c, al, tag) => (yy > 12 && Math.round(yy) % 3 === 0 && rand(Math.round(x), Math.round(yy), 91) < 0.5 ? T[4] : c));
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.7);
  if (o.scene !== false) { for (let x = -36; x < 36; x++) p.dot(x, -1 + Math.sin(x * 0.3 + ph * 2) * 1.2 + bob, hex("#c8e4ff"), 0.5); p.glowLine(-36, -2 + bob, 36, -2 + bob, 10, hex("#78aef0"), 0.14); }
  g.draw(p, 1, Math.sin(ph * 0.5) * 2, bob);
  p.glow(0, -2 + bob, 20, hex("#4890e0"), 0.08);
}
