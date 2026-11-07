import { fit, TAU, hex, Grid, rand } from "../../core/index.js";
import { drawSquid, spots } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Bigfin reef squid",
  ja: "アオリイカ",
  sci: "Sepioteuthis lessoniana",
  region: "Indo-Pacific; Japan south of Hokkaido",
  length: "40 cm",
  desc: "The 'king of squid' to Japanese anglers: a glassy body wrapped in an oval fin that ripples along its whole length, skin flickering with chromatophores from clear to copper to green. Pairs hover over seagrass beds to lay their eggs in spring.",
  jadesc: "釣り人の憧れ「イカの王様」。ガラスのように透けた胴を楕円のひれがぐるりと囲み、波打ちながら泳ぐ。皮膚の色素胞は透明から銅色、緑へと瞬く。春にはつがいで藻場に卵を産む。",
  tags: ["squid", "cephalopod", "reef", "japan", "fins", "loop"],
  size: [96, 48],
  origin: [44, 24],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a3a40", "#8a6a70", "#c0a0a8", "#e0ccd0", "#fff4f4"],
    chrom: ["#3a1a10", "#8a4020", "#c86838", "#e8a060", "#ffd8a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-44, -24, 96, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), K = fit(o.chrom, 5), g = G.clear();
  const ph = (t / D) * TAU, jet = Math.max(0, Math.sin(ph)) ** 2;
  const skin = (u, v, x, y, tt) => (spots(x, y, tt, 0.28, 3, 1) ? K : v > 0.5 ? ["#8a8a90", "#c0c0c8", "#e8e8ee", "#f8f8ff", "#ffffff"] : C);
  drawSquid(g, {
    L: 46, H: 8, shape: "oval", alpha: 0.95, skin,
    fins: { kind: "ribbon", h: 5, from: 0.03, to: 0.97 },
    finSkin: ["#6a5a60", "#a08a90", "#c8b8c0", "#e8e0e4", "#fffafa"],
    head: { r: 6 }, eye: { r: 2.4, ring: "#f0f0f8", iris: "#101018" },
    arms: { n: 8, L: 16, r: 1.6, curl: 0.5, suckers: "#f0e0e0" },
    tentacles: { L: 22, r: 0.9, club: 1.3 },
    jet,
    outline: "#2a1c20", lit: "#8a6a70",
  }, t, D, o.seed);
  g.draw(p, 1, -6 * jet + 2, Math.sin(ph) * 1.5);
  bubbles(p, t, D, 2, o.seed * 7 + 110, -18 - 6 * jet, 4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -22);
  p.glow(0, 0, 30, hex("#c0a0a8"), 0.05);
}
