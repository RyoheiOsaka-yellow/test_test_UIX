import { TAU, hex, Grid } from "../../../pixelsea/src/core/index.js";
import { drawFigure, guitar, stage, SKIN } from "../kit.js";
import { HAIR, pal, jonnyHair } from "./_lib.js";

export const meta = { name: "Jonny", ja: "ジョニー・グリーンウッド風", desc: "Hunched over a Telecaster, long dark hair across the face, a white brace on the strumming arm.", size: [64, 80], origin: [32, 74], duration: 2.0, fps: 30, bg: "black" };
const D = meta.duration, G = new Grid(-32, -74, 64, 80);

export function draw(p, time, o = {}) {
  const t = time % D, g = G.clear(), ph = (t / D) * TAU;
  const S = drawFigure(g, {
    skin: SKIN.pale,
    hair: { rows: jonnyHair, pal: pal(HAIR.darkBrown), dy: 0 },
    face: { eyes: "half", mouth: "flat", brows: false },
    shirt: { kind: "shirt", col: ["#8a8a90", "#b8b8c0", "#dcdce0", "#f0f0f4", "#ffffff"] },
    pants: ["#0c0c12", "#18181e", "#26262e", "#36363e", "#4a4a54"],
    pose: "guitar", bob: 2,
    extra: (g, t, S) => {
      guitar(g, 2, -27 + S.bob + S.strum * 0.2, "tele", ["#3a2010", "#7a4018", "#c07030", "#e8a860", "#ffd8a0"], "#f0ece0", false, 0.3);
      // the forearm brace
      g.line(9, -31 + S.bob, 6, -28 + S.bob, hex("#f0f0f0")); g.line(10, -30 + S.bob, 7, -27 + S.bob, hex("#e0e0e0"));
    },
  }, t, D, o.seed ?? 1);
  if (o.scene !== false) stage(p, -32, 32, 0, 6, "#3a5a90");
  g.draw(p, 1, 0, 0);
  if (o.scene !== false) p.glow(0, -46, 40, hex("#3a5a90"), 0.04);
}
