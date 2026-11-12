import { TAU, hex, Grid } from "../../../pixelsea/src/core/index.js";
import { drawFigure, guitar, stage, SKIN } from "../kit.js";
import { HAIR, pal, kurtHair } from "./_lib.js";

export const meta = { name: "Kurt", ja: "カート・コバーン風", desc: "Shoulder-length fair hair, an olive cardigan over a striped jumper, a left-handed offset guitar slung low.", size: [64, 80], origin: [32, 74], duration: 2.0, fps: 30, bg: "black" };
const D = meta.duration, G = new Grid(-32, -74, 64, 80);

export function draw(p, time, o = {}) {
  const t = time % D, g = G.clear();
  drawFigure(g, {
    skin: SKIN.pale,
    hair: { rows: kurtHair, pal: pal(HAIR.blond) },
    face: { eyes: "half", mouth: "flat", stubble: "#8a6a30", eyeCol: "#3a6aa0", browCol: "#8a6a30" },
    shirt: { kind: "cardigan", col: ["#2a3018", "#485430", "#667848", "#849a60", "#a8bc80"], inner: ["#1a1418", "#2a2028", "#3a2c34", "#4a3840", "#5a4850"], innerStripes: ["#6a1818", "#a82828", "#d03838", "#f05050", "#ff8080"] },
    pants: ["#1a2438", "#2c3c58", "#3e5478", "#567098", "#7890b8"],
    shoes: ["#2a2a2a", "#505050", "#787878", "#a0a0a0", "#d0d0d0"],
    pose: "guitar", lefty: true, bob: 1,
    extra: (g, t, S) => guitar(g, -2, -24 + S.bob, "jag", ["#2a1408", "#6a3018", "#b86030", "#e09a50", "#ffd090"], "#e8ded0", true, 0.25),
  }, t, D, o.seed ?? 1);
  if (o.scene !== false) stage(p, -32, 32, 0, 6, "#8a3a50");
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) p.glow(0, -46, 40, hex("#8a3a50"), 0.04);
}
