import { TAU, hex, Grid } from "../../../pixelsea/src/core/index.js";
import { drawFigure, guitar, stage, SKIN } from "../kit.js";
import { HAIR, pal, johnHair } from "./_lib.js";

export const meta = { name: "John", ja: "ジョン・フルシアンテ風", desc: "Dark wavy hair, a plain white tee, a sunburst Stratocaster with a white guard.", size: [64, 80], origin: [32, 74], duration: 2.0, fps: 30, bg: "black" };
const D = meta.duration, G = new Grid(-32, -74, 64, 80);

export function draw(p, time, o = {}) {
  const t = time % D, g = G.clear();
  drawFigure(g, {
    skin: SKIN.fair,
    hair: { rows: johnHair, pal: pal(HAIR.dark) },
    face: { eyes: "open", mouth: "flat", stubble: "#2a2020" },
    shirt: { kind: "tee", col: ["#9a9a98", "#c8c8c4", "#ececea", "#ffffff", "#ffffff"] },
    pants: ["#1a2438", "#2c3c58", "#3e5478", "#567098", "#7890b8"],
    pose: "guitar", bob: 1.5,
    extra: (g, t, S) => guitar(g, 2, -26 + S.bob, "strat", ["#2a1408", "#6a3018", "#b86030", "#e09a50", "#ffd090"], "#f4f0e8", false, 0.3),
  }, t, D, o.seed ?? 1);
  if (o.scene !== false) stage(p, -32, 32, 0, 6, "#a04a28");
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) p.glow(0, -46, 40, hex("#a04a28"), 0.04);
}
