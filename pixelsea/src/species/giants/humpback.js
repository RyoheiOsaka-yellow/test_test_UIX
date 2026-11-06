import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Humpback whale",
  ja: "ザトウクジラ",
  sci: "Megaptera novaeangliae",
  region: "All oceans; Okinawa and Ogasawara in winter, Alaska in summer",
  length: "15 m",
  desc: "The acrobat and the singer: knobbly head, a back that humps as it dives, and pectoral fins a third of its length, the longest of any animal. Males sing hour-long songs that change year by year across an ocean.",
  jadesc: "海の曲芸師にして歌い手。こぶのある頭、潜るとき丸く盛り上がる背、体長の3分の1もある動物界最長の胸びれ。雄は1時間に及ぶ歌をうたい、その歌は毎年海全体で変わっていく。",
  tags: ["whale", "cetacean", "baleen", "song", "japan", "loop"],
  size: [112, 56],
  origin: [56, 28],
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#060a10", "#141c28", "#263244", "#3e4e62", "#60748a"],
    white: ["#7a8a98", "#b8c4cc", "#e4ecf0", "#fafcff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-56, -28, 112, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), K = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const skin = (u, v, x, y) => (v > 0.4 && u < 0.85 ? W : K);
  drawFish(g, {
    L: 84, H: 10.5, peak: 0.42, nose: 0.6, stock: 0.16, bellyK: 1.05, skin,
    tail: { kind: "fluke", span: 7, len: 16, rays: false },
    dorsal: [{ u: 0.66, h: 4, w: 10, kind: "lobe", col: o.palette }],
    pectoral: { u: 0.3, len: 26, w: 5, angle: 0.55, v: 0.6, flap: 0.3 },
    eye: { u: 0.16, v: 0.2, r: 0.8, ring: "#263244" },
    mouth: { len: 18, open: 0, v: 0.35, drop: 1 },
    swim: { kind: "whale", amp: 1 },
    finSkin: (u, v, kind) => (kind === "pectoral" ? W : K),
    extra: (g, t, S) => {
      // tubercles on the head and jaw, and throat grooves
      for (let k = 0; k < 7; k++) { const u = 0.03 + k * 0.03; g.set(S.xOf(u), S.wave(u) - S.H * S.back(u) - 0.6, K[4]); }
      for (let k = 0; k < 5; k++) g.line(S.xOf(0.08), 3 + k * 1.3, S.xOf(0.42), 6 + k * 0.8, W[1], 0.8, 1);
    },
    outline: "#020406", lit: "#3e4e62",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -56, 56, -28, hex("#5ab6d6"), 0.07);
  g.draw(p, 1, 0, Math.sin((t / D) * TAU) * 1.5);
  blow(p, 30, -12 + Math.sin((t / D) * TAU) * 1.5, t, D, 0, 11);
  bubbles(p, t, D, 2, o.seed * 7 + 53, 18, 2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -26);
}
