import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Blobfish",
  ja: "ニュウドウカジカ（ブロブフィッシュ）",
  sci: "Psychrolutes marcidus",
  region: "Australia and New Zealand, 600–1200 m",
  length: "30 cm",
  desc: "Voted the world's ugliest animal, unfairly: at depth it is a normal-looking fish with a big head and drooping nose, held in shape by the pressure. Hauled to the surface, its gelatinous flesh sags into the famous pink blob. It sits on the bottom and eats what drifts past.",
  jadesc: "「世界一醜い動物」に選ばれたが、それは不当。深海では大きな頭と垂れた鼻の普通の魚で、水圧が形を保っている。水面に引き上げられると、ゼリーのような肉がしぼんであの有名なピンクの塊になる。海底に座り、流れてくるものを食べる。",
  tags: ["deepsea", "blob", "australia", "ugly", "cute", "loop"],
  size: [64,44],
  origin: [32,22],
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#6a4848", "#a07878", "#c8a0a0", "#e0c0c0", "#f4e0e0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -22, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 36, H: 13, peak: 0.3, nose: 0.95, stock: 0.3,
    back: (u) => (u < 0.3 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.3)), 0.35) : 1 - Math.pow((u - 0.3) / 0.7, 1.4) * 0.75),
    belly: (u) => (u < 0.2 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.2)), 0.4) * 0.8 : 0.8 - Math.pow((u - 0.2) / 0.8, 1.3) * 0.55),
    skin: () => C,
    tail: { kind: "round", span: 6, len: 5 },
    dorsal: [{ u: 0.6, h: 3, w: 16, kind: "ridge" }],
    pectoral: { u: 0.4, len: 8, w: 5, angle: 0.5, v: 0.6, flap: 0.15 },
    eye: { u: 0.18, v: -0.15, r: 1.6, ring: "#2a1818" },
    mouth: { len: 6, open: 0.08, v: 0.55, drop: 2 },
    swim: { kind: "fish", amp: 0.2 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the drooping nose, and the sagging jowls
      const x0 = S.xOf(0), y0 = S.wave(0);
      g.ellipse(x0 + 1, y0 + 2 + Math.sin(ph) * 0.3, 3.2, 3.6, (nx, ny) => (ny < -0.3 ? C[3] : C[2]), 1, 1);
      g.line(x0 - 6, y0 + 7, x0 - 1, y0 + 8.5, C[1], 1, 1);
    },
    outline: "#3a2020", lit: "#a07878",
  }, t, D, o.seed);
  g.draw(p, 1, 0, 4 + Math.sin(ph) * 0.5);
  if (o.scene !== false) { for (let x = -32; x < 32; x++) p.dot(x, 18 + ((x * 5) % 3), hex("#2a2826"), 0.9); snow(p, t, D, 64, 44, 10); }
}
