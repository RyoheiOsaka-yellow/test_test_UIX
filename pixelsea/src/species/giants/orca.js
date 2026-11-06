import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawFish } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Orca",
  ja: "シャチ",
  sci: "Orcinus orca",
  region: "Every ocean, from the poles to the equator",
  length: "8 m",
  desc: "The sea's top predator: a black-and-white dolphin the size of a bus, with a dorsal fin as tall as a man on the bulls. Pods hunt by plan and by culture, some for herring, some for seals, some for great white sharks.",
  jadesc: "海の食物連鎖の頂点。バスほどの大きさの白黒のイルカで、雄の背びれは人の背丈ほど。群れは文化をもち、ニシンを狩る群れ、アザラシを狩る群れ、ホホジロザメを狩る群れもいる。",
  tags: ["whale", "cetacean", "orca", "predator", "worldwide", "loop"],
  size: [100, 52],
  origin: [50, 28],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#04060a", "#0e1218", "#1c2430", "#2e3a48", "#4a5868"],
    white: ["#8a9aa8", "#c8d4dc", "#eef2f4", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-50, -28, 100, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), K = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    // the eye patch, the white chin and belly, the grey saddle behind the fin
    if (u > 0.08 && u < 0.2 && v < -0.2 && v > -0.75) return W;
    if (v > 0.35 && u < 0.7) return W;
    if (u > 0.42 && u < 0.6 && v < -0.5 && v > -0.95) return ["#4a5868", "#6a7a8a", "#8a9aa8", "#a8b8c4", "#c8d4dc"];
    return K;
  };
  drawFish(g, {
    L: 72, H: 10, peak: 0.42, nose: 0.75, stock: 0.18, bellyK: 0.95, skin,
    tail: { kind: "fluke", span: 6, len: 12, rays: false },
    dorsal: [{ u: 0.5, h: 16, w: 12, kind: "falcate", col: o.palette }],
    pectoral: { u: 0.3, len: 11, w: 6, angle: 0.9, v: 0.6, flap: 0.15 },
    eye: { u: 0.1, v: -0.05, r: 0.8, ring: "#0e1218" },
    mouth: { len: 9, open: 0, v: 0.35, drop: 1 },
    swim: { kind: "whale", amp: 1 },
    finSkin: (u, v, kind) => K,
    outline: "#020304", lit: "#2e3a48",
  }, t, D, o.seed);
  g.draw(p, 1, 0, Math.sin((t / D) * TAU) * 1.5);
  // the blow: a puff of spray from the blowhole now and then
  const u = (t / D), blow = u < 0.25 ? Math.sin(Math.PI * u / 0.25) : 0;
  if (blow > 0) for (let i = 0; i < 6; i++) p.dot(28 - i * 1.2 + (i % 2) * 2, -12 - i * 1.6 - blow * 6, hex("#c8e4ff"), 0.5 * blow * (1 - i / 6));
  bubbles(p, t, D, 2, o.seed * 7 + 50, 30, -6, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 14, -26);
  p.glow(-10, -20, 40, hex("#2f7eae"), 0.06);
}
