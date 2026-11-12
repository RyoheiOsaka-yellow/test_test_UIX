import { TAU, hex, Grid } from "../../../pixelsea/src/core/index.js";
import { drawFigure, micStand, stage, SKIN } from "../kit.js";
import { HAIR, pal, thomHair } from "./_lib.js";

export const meta = { name: "Thom", ja: "トム・ヨーク風", desc: "At the mic, eyes shut, messy fair hair, dark jacket over a white tee.", size: [64, 80], origin: [32, 74], duration: 2.4, fps: 30, bg: "black" };
const D = meta.duration, G = new Grid(-32, -74, 64, 80);

export function draw(p, time, o = {}) {
  const t = time % D, g = G.clear(), ph = (t / D) * TAU;
  const sway = Math.sin(ph) * 1.5;
  drawFigure(g, {
    skin: SKIN.pale,
    hair: { rows: thomHair, pal: pal(HAIR.blondMessy), dx: Math.round(sway * 0.3) },
    face: { eyes: "closed", mouth: "open", stubble: "#6a5030", browCol: "#7a6030" },
    shirt: { kind: "jacket", col: ["#141a14", "#24301f", "#36472e", "#4c6040", "#66805a"], inner: ["#9a9a98", "#c8c8c4", "#ececea", "#ffffff", "#ffffff"] },
    pants: ["#141418", "#222228", "#32323a", "#44444e", "#5a5a66"],
    pose: "mic", bob: 1.5,
    extra: (g, t, S) => micStand(g, 14, 0, S.HY + 4, -2),
  }, t, D, o.seed ?? 1);
  if (o.scene !== false) stage(p, -32, 32, 0, 6, "#6a4a90");
  g.draw(p, 1, sway, 0);
  if (o.scene !== false) p.glow(0, -46, 40, hex("#6a4a90"), 0.04);
}
