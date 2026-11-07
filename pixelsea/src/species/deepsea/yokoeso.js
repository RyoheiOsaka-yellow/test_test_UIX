import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Bristlemouth",
  ja: "ヨコエソ",
  sci: "Cyclothone alba",
  region: "Mesopelagic worldwide, 300–1500 m",
  length: "3–5 cm",
  desc: "The most abundant vertebrate on Earth, by the hundred trillion, and almost nobody has heard of it: a finger-length, half-transparent fish with a wide mouth of bristle teeth and a row of lights along its belly, hanging in the dark of every ocean.",
  jadesc: "地球でいちばん個体数の多い脊椎動物。数百兆匹いるのに、ほとんど誰も知らない。指ほどの長さの半透明の魚で、ブラシのような歯の大きな口と腹の光の列をもち、あらゆる海の闇に漂う。",
  tags: ["deepsea", "tiny", "abundant", "glow", "worldwide", "loop"],
  size: [56,32],
  origin: [28,16],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a3438", "#5e5660", "#88808c", "#b0a8b4", "#d8d0dc"],
    glow: ["#1040a0", "#3080e0", "#60c0ff", "#b0f0ff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -16, 56, 32);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const GL = fit(o.glow, 5), k = 0.6 + 0.4 * Math.sin(ph * 2);
  let pts = [];
  drawFish(g, {
    L: 28, H: 3.5, peak: 0.3, nose: 0.5, stock: 0.15, alpha: 0.75,
    skin: () => C,
    tail: { kind: "fork", span: 4, len: 5 },
    dorsal: [{ u: 0.6, h: 2.5, w: 5, kind: "tri" }],
    pectoral: { u: 0.3, len: 4, w: 2, angle: 0.4, v: 0.3, flap: 0.3 },
    anal: { u: 0.7, h: 2.5, w: 6 },
    eye: { u: 0.1, v: -0.2, r: 0.9, ring: "#88808c" },
    mouth: { len: 8, open: 0.35, v: 0.1, drop: 1.5 }, mouthCol: "#2a1820",
    swim: { kind: "fish", amp: 0.6 },
    finSkin: () => C,
    extra: (g, t, S) => { pts = []; for (let i = 0; i < 9; i++) { const u = 0.1 + i * 0.09; pts.push([S.xOf(u), S.wave(u) + S.H * S.belly(u)]); } },
    outline: "#1c181c", lit: "#5e5660",
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 1.5, dy = Math.sin(ph * 2) * 0.6;
  g.draw(p, 1, dx, dy);
  photophores(p, pts.map(([x, y]) => [x + dx, y + dy]), GL[2], 0.25 * k, 2.5);
  if (o.scene !== false) snow(p, t, D, 56, 32, 8);
}
