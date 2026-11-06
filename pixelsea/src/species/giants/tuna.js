import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawFish } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Pacific bluefin tuna",
  ja: "クロマグロ",
  sci: "Thunnus orientalis",
  region: "North Pacific, Japan to California",
  length: "3 m",
  desc: "A warm-blooded torpedo of a fish, steel-blue above and silver below, with yellow finlets and a sickle tail that drives it across the Pacific at highway speed. Prized for sushi beyond any other fish, and fished to a fraction of what it was.",
  jadesc: "温かい血をもつ魚雷のような魚。背は鋼のような青、腹は銀、黄色い小離鰭と三日月の尾で太平洋を高速で横断する。寿司で最も珍重され、乱獲で数が激減した。",
  tags: ["fish", "tuna", "pelagic", "japan", "fast", "food", "loop"],
  size: [96, 48],
  origin: [48, 24],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "deep",
  options: {
    palette: ["#061020", "#102848", "#1c4878", "#3a78a8", "#80b8d8"],
    silver: ["#5a6a78", "#9aaab8", "#d0dce4", "#f0f6f8", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -24, 96, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), B = fit(o.palette, 5), S = fit(o.silver, 5), g = G.clear();
  const skin = (u, v, x, y) => (v > 0.1 ? S : v > -0.35 ? ["#2a4a68", "#4a7898", "#7aa8c8", "#a8cce0", "#d0e8f0"] : B);
  drawFish(g, {
    L: 66, H: 10.5, peak: 0.38, nose: 0.35, stock: 0.1, skin,
    tail: { kind: "crescent", span: 11, len: 11 },
    dorsal: [{ u: 0.36, h: 8, w: 10, kind: "tri", col: ["#102848", "#1c4878", "#3a78a8", "#6aa0c8", "#a0c8e0"] }, { u: 0.62, h: 7, w: 5, kind: "falcate", col: ["#6a4a00", "#b08a10", "#f0c020", "#ffe060", "#fff4a0"] }],
    pectoral: { u: 0.26, len: 13, w: 3.5, angle: 0.35, v: 0.2, flap: 0.1 },
    anal: { u: 0.64, h: 6, w: 5, col: ["#6a4a00", "#b08a10", "#f0c020", "#ffe060", "#fff4a0"] },
    finlets: 7, finletCol: "#f0c020",
    eye: { u: 0.08, v: -0.15, r: 1.4 },
    mouth: { len: 8, open: 0.15, v: 0.2, drop: 2 },
    gills: 1, gillU: 0.18,
    swim: { kind: "fish", amp: 1 },
    finSkin: (u, v) => B,
    outline: "#040810", lit: "#1c4878",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 2, Math.sin((t / D) * TAU * 2) * 0.6);
  bubbles(p, t, D, 2, o.seed * 7 + 51, 30, 0, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 14, -22);
  p.glow(0, -14, 44, hex("#2f7eae"), 0.06);
}
