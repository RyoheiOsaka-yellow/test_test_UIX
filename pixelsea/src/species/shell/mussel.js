import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawBivalve, rock } from "./_body.js";
import { shift, bubbles, caustics } from "../_lib.js";

export const meta = {
  name: "Mediterranean mussel",
  ja: "ムラサキイガイ",
  sci: "Mytilus galloprovincialis",
  region: "Mediterranean and Atlantic Europe; introduced to Japan and worldwide",
  length: "8 cm",
  desc: "The moules of a thousand bistros: a blue-black wedge of shell tied to the rock by a beard of byssus threads, gaping just enough to show its orange flesh as it filters the tide. It reached Japan on ships' hulls a century ago.",
  jadesc: "ムール貝として知られる紫黒色のくさび形の二枚貝。足糸（ひげ）で岩にしがみつき、殻を少し開けてオレンジ色の身をのぞかせながら潮を濾す。日本には100年ほど前に船底について渡来した。",
  tags: ["shell", "bivalve", "mussel", "rock", "europe", "food", "loop"],
  size: [60, 48],
  origin: [28, 30],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a0a18", "#1c1838", "#34306a", "#5a5898", "#9898c8"],
    flesh: ["#6a3008", "#b85a10", "#f08820", "#ffb850", "#ffe0a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-28, -30, 60, 46), BG = new Grid(-28, -30, 60, 46);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), FL = fit(o.flesh, 5), g = G.clear(), bg = BG.clear();
  const ph = (t / D) * TAU, open = 0.5 + 0.5 * Math.sin(ph);
  if (o.scene !== false) rock(bg, -28, 32, 6, 14, ["#1a1a22", "#2e2a34", "#4a4454"], o.seed);
  // two mussels, the back one smaller and dimmer
  const one = (L, tilt) => drawBivalve(g, {
    L, bulge: L * 0.3, gape: 0.1 + 0.12 * open, tilt, ribs: 0, lines: 7,
    skin: (u, v) => (v > 0.7 ? ["#1c1838", "#34306a", "#5a5898", "#8080b8", "#b8b8e0"] : C),
    mantle: FL,
    outline: "#06060e", lit: "#34306a",
  }, t, D, o.seed);
  const far = new Grid(-28, -30, 60, 46);
  drawBivalve(far, { L: 18, bulge: 5.5, gape: 0.14, tilt: -1.35, lines: 6, skin: () => C, mantle: FL, outline: "#06060e" }, t, D, o.seed);
  far.recolor((x, y, c) => c && (c & 0xffffff) !== 0 ? c : c);
  one(24, -1.25);
  if (o.scene !== false) bg.draw(p, 1);
  far.draw(p, 0.8, -14, 10);
  g.draw(p, 1, -4, 12);
  // byssus threads down to the rock
  for (let i = 0; i < 4; i++) p.line(-4 + i, 12, -8 + i * 3, 16 + (i % 2), hex("#b8a070"), 0.8);
  bubbles(p, t, D, 2, o.seed * 7 + 35, 8, -10, [hex("#ffffff"), hex("#d4f8ea"), hex("#8ee0c8"), hex("#2a8a8a")], 12, -28);
  if (o.scene !== false) caustics(p, t, D, -30, -30, 30, 10, hex("#8ee0c8"), 0.12);
}
