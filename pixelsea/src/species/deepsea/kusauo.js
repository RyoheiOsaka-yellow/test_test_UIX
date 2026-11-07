import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Mariana snailfish",
  ja: "シンカイクサウオ",
  sci: "Pseudoliparis swirei",
  region: "Mariana Trench, 6000–8000 m; relatives off Japan to 8300 m",
  length: "25 cm",
  desc: "The deepest fish ever seen: a pink, scaleless, tadpole-shaped snailfish from eight kilometres down, where the pressure is eight hundred times the surface. It is soft, gelatinous and gentle, and eats the tiny shrimp that swarm the trench floor.",
  jadesc: "これまで見つかった中で最も深い場所に住む魚。水深8000 m、水圧800気圧の世界に住む、ピンク色で鱗のないオタマジャクシ形のクサウオ。柔らかくゼリーのような体で、海溝の底に群がる小さなエビを食べる。",
  tags: ["deepsea", "trench", "deepest", "pink", "loop"],
  size: [72,40],
  origin: [36,20],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a4050", "#a06878", "#d098a8", "#f0c0cc", "#fff0f4"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -20, 72, 40);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 50, H: 8, peak: 0.2, nose: 0.9, stock: 0.08, alpha: 0.92,
    back: (u) => (u < 0.1 ? Math.sqrt(u / 0.1) : 1 - Math.pow((u - 0.1) / 0.9, 1.2) * 0.92),
    belly: (u) => (u < 0.1 ? Math.sqrt(u / 0.1) : 1 - Math.pow((u - 0.1) / 0.9, 1.2) * 0.92),
    skin: (u, v) => (v > 0.6 ? ["#a07888", "#d0a8b8", "#f0d0dc", "#fff0f4", "#ffffff"] : C),
    tail: { kind: "round", span: 4, len: 4 },
    dorsal: [{ u: 0.55, h: 3, w: 40, kind: "ridge" }],
    anal: { u: 0.6, h: 3, w: 36 },
    pectoral: { u: 0.22, len: 9, w: 5, angle: 0.5, v: 0.4, flap: 0.3 },
    eye: { u: 0.08, v: -0.2, r: 1.3, ring: "#d098a8" },
    mouth: { len: 4, open: 0.1, v: 0.4, drop: 0.5 },
    swim: { kind: "fish", amp: 1.2 },
    finSkin: () => ["#a07888", "#d0a8b8", "#f0d0dc", "#fff0f4", "#ffffff"],
    outline: "#3a2030", lit: "#a06878",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5);
  // the amphipods it feeds on, hopping about the floor
  if (o.scene !== false) { for (let x = -36; x < 36; x++) p.dot(x, 17 + ((x * 5) % 3), hex("#2a2826"), 0.9); for (let i = 0; i < 5; i++) { const x = -30 + i * 14 + Math.sin(ph * 3 + i) * 2, y = 15 - Math.abs(Math.sin(ph * 3 + i)) * 3; p.dot(x, y, hex("#d8d0c0")); p.dot(x + 1, y, hex("#b0a890")); } snow(p, t, D, 72, 40, 10); }
}
