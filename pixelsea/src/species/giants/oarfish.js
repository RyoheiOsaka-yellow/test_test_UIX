import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Giant oarfish",
  ja: "リュウグウノツカイ",
  sci: "Regalecus glesne",
  region: "Deep open ocean worldwide, 200–1000 m; washes up on the Sea of Japan coast",
  length: "8 m, to 11 m",
  desc: "The longest bony fish, a silver ribbon with a crimson fin running its whole length and a crest of long red rays on its head. It hangs vertically in the twilight zone, rippling its dorsal fin, and is the sea serpent of old maps and the 'messenger from the Dragon Palace' of Japanese lore.",
  jadesc: "最も長い硬骨魚。銀色のリボンのような体に全長を貫く深紅の背びれ、頭には長い赤い冠。薄明の深海に縦向きに漂い、背びれを波打たせて泳ぐ。古地図の海蛇の正体とも、竜宮の使いとも言われる。",
  tags: ["fish", "deep", "ribbon", "japan", "legend", "loop"],
  size: [128, 48],
  origin: [64, 26],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "night",
  options: {
    palette: ["#4a5460", "#8290a0", "#b8c4d0", "#e0e8f0", "#ffffff"],
    red: ["#5a0810", "#a81820", "#e03030", "#ff6050", "#ffa090"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-64, -26, 128, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), S = fit(o.palette, 5), R = fit(o.red, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const skin = (u, v, x, y) => (rand(Math.round(x / 3), Math.round(y / 2), 41) < 0.14 && u > 0.1 ? ["#1c2430", "#3a4654", "#5c6a7a", "#8290a0", "#a8b4c0"] : S);
  drawFish(g, {
    L: 112, H: 5.5, peak: 0.12, nose: 0.7, stock: 0.08, skin,
    back: (u) => (u < 0.06 ? Math.sqrt(u / 0.06) : 1 - Math.pow((u - 0.06) / 0.94, 1.3) * 0.9),
    belly: (u) => (u < 0.06 ? Math.sqrt(u / 0.06) : 1 - Math.pow((u - 0.06) / 0.94, 1.3) * 0.9),
    tail: { kind: "none" },
    dorsal: [],
    pectoral: { u: 0.1, len: 5, w: 2, angle: 0.4, v: 0.3, flap: 0.3 },
    eye: { u: 0.04, v: -0.1, r: 1.3 },
    mouth: { len: 3, open: 0.2, v: 0.2, drop: 0.5 },
    swim: { kind: "fish", amp: 0.4 },
    extra: (g, t, S2) => {
      // the dorsal fin: a red fringe the whole length, rippling in waves; the crest of long rays on the head
      for (let x = S2.xOf(1); x < S2.xOf(0.03); x += 1) {
        const u = S2.uOf(x), top = S2.wave(u) - S2.H * S2.back(u), h = 3 + 1.2 * Math.sin(x * 0.35 - ph * 2);
        g.line(x, top, x, top - h, (k) => (k > 0.6 ? R[3] : R[2]), 1, 1);
      }
      for (let k = 0; k < 6; k++) {
        const x = S2.xOf(0.02 + k * 0.025), top = S2.wave(0.03) - S2.H * S2.back(0.03), L = 14 - k * 1.5, sw = lnoise(t, D, 2, k * 0.4, o.seed) * 2;
        g.line(x, top, x + 3 + sw, top - L, (kk) => (kk > 0.7 ? R[4] : R[2]), 1, 1);
      }
      // the long pelvic streamers like oars
      g.line(S2.xOf(0.12), S2.H * 0.9, S2.xOf(0.12) - 6 + Math.sin(ph) * 2, S2.H + 12, (k) => (k > 0.8 ? R[3] : R[1]), 1, 1);
    },
    outline: "#202830", lit: "#8290a0",
  }, t, D, o.seed);
  g.draw(p, 1, 0, Math.sin(ph) * 1.5 + 2);
  if (o.scene !== false) for (let i = 0; i < 16; i++) p.dot(-64 + ((i * 37) % 128), -26 + (((i * 0.31 + t / D) % 1) * 48), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 2, o.seed * 7 + 62, 48, -4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
  p.glow(40, -2, 20, hex("#e03030"), 0.06);
}
