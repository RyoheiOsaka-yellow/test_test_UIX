import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Sperm whale",
  ja: "マッコウクジラ",
  sci: "Physeter macrocephalus",
  region: "All deep oceans; Ogasawara, Kochi and Hokkaido waters",
  length: "18 m",
  desc: "Moby Dick: the largest toothed predator, with a block of a head a third of its length holding the biggest brain on Earth and an organ full of waxy oil for sonar. It dives two kilometres down, for an hour, to fight giant squid in the dark.",
  jadesc: "白鯨のモデル。最大の歯をもつ捕食者で、体長の3分の1を占める四角い頭には地球最大の脳と、音響探知に使う蝋状の油の器官が収まる。深さ2 kmまで1時間潜り、暗闇でダイオウイカと渡り合う。",
  tags: ["whale", "cetacean", "toothed", "deep", "squid", "loop"],
  size: [112, 56],
  origin: [56, 28],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a1614", "#36302c", "#584e48", "#7c7068", "#a09488"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -28, 112, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  // wrinkled skin behind the head
  const skin = (u, v, x, y) => (u > 0.35 && Math.round(x * 0.5 + y * 0.8) % 3 === 0 ? ["#1a1614", "#2c2824", "#443c36", "#5c524c", "#746860"] : v > 0.7 && u < 0.5 ? ["#36302c", "#584e48", "#7c7068", "#9a8e84", "#b8aca0"] : C);
  drawFish(g, {
    L: 86, H: 11, peak: 0.2, nose: 0.98, stock: 0.15, bellyK: 0.95, skin,
    // a square head: the back is flat and high from the nose
    back: (u) => (u < 0.03 ? Math.sqrt(u / 0.03) * 0.92 : u < 0.4 ? 0.92 + 0.08 * Math.sin((Math.PI * (u - 0.03)) / 0.37) : 1 - Math.pow((u - 0.4) / 0.6, 1.5) * 0.85),
    belly: (u) => (u < 0.04 ? Math.sqrt(u / 0.04) * 0.7 : u < 0.45 ? 0.7 + 0.3 * Math.sin((Math.PI * (u - 0.04)) / 0.41) ** 0.6 : 1 - Math.pow((u - 0.45) / 0.55, 1.4) * 0.85),
    tail: { kind: "fluke", span: 7, len: 15, rays: false },
    dorsal: [{ u: 0.66, h: 3.5, w: 10, kind: "ridge", col: o.palette }],
    pectoral: { u: 0.36, len: 10, w: 4, angle: 0.6, v: 0.7, flap: 0.12 },
    eye: { u: 0.3, v: 0.35, r: 0.8, ring: "#36302c" },
    mouth: { len: 26, open: 0, v: 0.92, drop: 0.3 },
    swim: { kind: "whale", amp: 0.9 },
    extra: (g, t, S) => {
      // the narrow lower jaw: a pale sliver under the head
      g.line(S.xOf(0.02), S.H * 0.68, S.xOf(0.32), S.H * 0.95, C[4], 1, 1);
      // the blowhole at the front-left of the head
      g.set(S.xOf(0.04), S.wave(0.04) - S.H * S.back(0.04) - 0.5, C[0]);
    },
    outline: "#0a0806", lit: "#584e48",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -56, 56, -28, hex("#2f7eae"), 0.05);
  g.draw(p, 1, 0, Math.sin((t / D) * TAU) * 1.5);
  blow(p, 40, -12 + Math.sin((t / D) * TAU) * 1.5, t, D, 0.9, 10);
  bubbles(p, t, D, 2, o.seed * 7 + 54, 24, 4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -26);
}
