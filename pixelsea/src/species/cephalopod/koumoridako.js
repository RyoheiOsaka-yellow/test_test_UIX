import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Vampire squid",
  ja: "コウモリダコ",
  sci: "Vampyroteuthis infernalis",
  region: "Deep oceans worldwide, 600–900 m, in the oxygen-minimum zone",
  length: "30 cm",
  desc: "Neither squid nor octopus but the last of its own order: a black-red body with the largest eyes for its size of any animal, two ear fins, and eight arms joined by a cloak lined with spines. Threatened, it turns the cloak inside out and lights up its arm tips.",
  jadesc: "イカでもタコでもない、独自の目の最後の生き残り。黒ずんだ赤い体に、体の大きさに対して動物界最大の目、二枚の耳ひれ、棘の並んだマントでつながる八本の腕。襲われるとマントを裏返し、腕の先を光らせる。",
  tags: ["cephalopod", "deep", "vampire", "glow", "fossil", "loop"],
  size: [72, 56],
  origin: [36, 30],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a0408", "#3a0c14", "#5a1820", "#7a2830", "#9a4048"],
    glow: ["#1040a0", "#3080e0", "#60c0ff", "#b0f0ff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -30, 72, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), GL = fit(o.glow, 5), g = G.clear();
  const ph = (t / D) * TAU, W2 = 36, H2 = 28, open = 0.6 + 0.4 * Math.sin(ph);
  // the cloak: a fan of webbed arms hanging below the body, spines inside; the body a dark bell above with ear fins and huge blue eyes
  const pts = [[0, 2]];
  for (let i = 0; i <= 8; i++) { const u = -1 + (i / 8) * 2, a = Math.PI / 2 + u * 1.1 * open; pts.push([Math.cos(a) * 22 * (0.9 + 0.1 * (i % 2)), 2 + Math.sin(a) * 20 * (0.9 + 0.1 * (i % 2))]); }
  g.poly(pts, (x, y) => (((Math.round(x) + Math.round(y)) % 3 === 0) ? C[2] : C[1]), 0.95);
  for (let i = 0; i <= 8; i++) { const u = -1 + (i / 8) * 2, a = Math.PI / 2 + u * 1.1 * open; g.line(0, 2, Math.cos(a) * 21, 2 + Math.sin(a) * 19, (k) => (k > 0.9 ? GL[3] : C[3])); }
  g.ellipse(0, -6, 13, 11, (nx, ny) => (ny < -0.2 ? C[3] : ny < 0.5 ? C[2] : C[1]));
  for (const s of [-1, 1]) g.ellipse(s * 10, -14 + Math.sin(ph * 2) * 1.5, 5, 3, (nx, ny) => (ny < 0 ? C[4] : C[3]));
  for (const s of [-1, 1]) { g.ellipse(s * 6, -3, 3.4, 3.4, GL[2]); g.ellipse(s * 6, -3, 2.2, 2.2, GL[0]); g.set(s * 6 + 1, -4, GL[4]); }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  g.draw(p, 1, Math.sin(ph * 0.5) * 1.5, Math.sin(ph) * 2);
  for (let i = 0; i <= 8; i++) { const u = -1 + (i / 8) * 2, a = Math.PI / 2 + u * 1.1 * open; p.glow(Math.cos(a) * 21 + Math.sin(ph * 0.5) * 1.5, 2 + Math.sin(a) * 19 + Math.sin(ph) * 2, 4, GL[2], 0.3 * (0.5 + 0.5 * Math.sin(ph * 2 + i))); }
  for (const s of [-1, 1]) p.glow(s * 6 + Math.sin(ph * 0.5) * 1.5, -3 + Math.sin(ph) * 2, 6, GL[2], 0.25);
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-W2 + ((i * 37) % (W2 * 2)), -H2 + (((i * 0.31 + t / D) % 1) * (H2 * 2)), hex("#a8d0e0"), 0.3);
  p.glow(0, 0, 24, hex("#3a0c14"), 0.08);
}
