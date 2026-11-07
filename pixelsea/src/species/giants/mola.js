import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Ocean sunfish",
  ja: "マンボウ",
  sci: "Mola mola",
  region: "Temperate and tropical seas worldwide",
  length: "3 m, up to 2 tonnes",
  desc: "The heaviest bony fish, a great grey disc that seems to end halfway, with a tall fin above and below and a frilled rudder instead of a tail. It sculls along on jellyfish and basks on its side at the surface to warm up after deep dives.",
  jadesc: "最も重い硬骨魚。途中で切れたような灰色の円盤で、上下に高いヒレ、尾の代わりにひらひらした舵（舵鰭）をもつ。クラゲを食べ、深く潜ったあとは水面に横たわって体を温める。",
  tags: ["fish", "sunfish", "giant", "jellyfish", "worldwide", "loop"],
  size: [84, 64],
  origin: [42, 32],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2c3038", "#525a66", "#7c8694", "#a6b0bc", "#ccd4dc"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-42, -32, 84, 64);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU, scull = Math.sin(ph * 2);
  const skin = (u, v, x, y) => (rand(Math.round(x / 3), Math.round(y / 3), 31) < 0.25 ? ["#3c4048", "#626a76", "#8c96a4", "#b6c0cc", "#dce4ec"] : v > 0.6 ? ["#5c6670", "#8c96a0", "#b6c0c8", "#dce4ea", "#f4f8fa"] : C);
  drawFish(g, {
    L: 44, H: 16, peak: 0.55, nose: 0.85, stock: 0.75, bellyK: 1, skin,
    back: (u) => (u < 0.55 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.55)), 0.5) : 1 - Math.pow((u - 0.55) / 0.45, 2) * 0.25),
    belly: (u) => (u < 0.6 ? Math.pow(Math.sin((Math.PI / 2) * (u / 0.6)), 0.5) : 1 - Math.pow((u - 0.6) / 0.4, 2) * 0.25),
    tail: { kind: "clavus", span: 14, len: 5, rays: false },
    dorsal: [{ u: 0.78, h: 14, w: 11, kind: "lobe", col: o.palette }],
    anal: { u: 0.78, h: 14, w: 11 },
    pectoral: { u: 0.4, len: 6, w: 4, angle: 0.3, v: -0.3, flap: 0.5 },
    eye: { u: 0.14, v: -0.1, r: 1.5 },
    mouth: { len: 3, open: 0.3, v: 0.1, drop: 0.5 },
    gills: 1, gillU: 0.26,
    swim: { kind: "fish", amp: 0.3 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the dorsal and anal fins scull together: shift their tips with the stroke (drawn as a shear of the lobes)
      g.recolor((x, y, c, al, tag) => c);
    },
    outline: "#14181e", lit: "#7c8694",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -42, 42, -32, hex("#5ab6d6"), 0.08);
  g.draw(p, 1, Math.sin(ph) * 1, scull * 1.2);
  // a jellyfish drifting by for lunch
  if (o.scene !== false) { const jx = -30 + Math.sin(ph) * 2, jy = 10 + Math.cos(ph) * 2; p.ellipse(jx, jy, 3.5, 2.2, hex("#c8c8e8"), 0.6); for (let k = 0; k < 4; k++) p.line(jx - 2 + k * 1.3, jy + 2, jx - 2.5 + k * 1.3 + Math.sin(ph + k), jy + 7 + k % 2, hex("#c8c8e8"), 0.4); }
  bubbles(p, t, D, 2, o.seed * 7 + 60, 18, -8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -30);
}
