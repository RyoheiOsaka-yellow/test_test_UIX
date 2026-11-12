import { TAU, hex, Grid } from "../../../pixelsea/src/core/index.js";
import { drawFigure, guitar, micStand, stage, SKIN } from "../kit.js";
import { HAIR, pal, thomHair, jonnyHair, shortDark, brushUp } from "./_lib.js";

export const meta = { name: "The band", ja: "レディオヘッド風・五人", desc: "Five on a stage: the singer at the mic, two guitars, the bass, the drums at the back.", size: [176, 88], origin: [88, 80], duration: 2.4, fps: 30, bg: "black" };
const D = meta.duration, G = new Grid(-88, -80, 176, 88);

export function draw(p, time, o = {}) {
  const t = time % D, g = G.clear(), ph = (t / D) * TAU;
  const at = (x, y, fn) => { const h = new Grid(-32, -80, 64, 86); fn(h); h.draw(p, 1, x, y); };
  if (o.scene !== false) stage(p, -88, 88, 0, 8, "#5a4a90");
  // the drummer at the back, behind a kit
  at(40, -8, (h) => {
    drawFigure(h, { skin: SKIN.pale, hair: null, face: { eyes: "open", mouth: "smile" }, shirt: { kind: "tee", col: ["#1a1a22", "#30303c", "#4a4a58", "#6a6a78", "#8a8a98"] }, pose: "drums", bob: 2 }, t, D, 5);
    for (const [cx, cy, rx, ry] of [[-10, -22, 6, 3], [10, -22, 6, 3], [0, -14, 10, 5]]) h.ellipse(cx, cy, rx, ry, (nx, ny) => (ny < -0.4 ? hex("#e8e4d8") : hex("#8a2030")));
    h.line(-16, -40, -14, -28, hex("#9a9aa0")); h.ellipse(-16, -41, 6, 1.5, (nx, ny) => (ny < 0 ? hex("#e0c060") : hex("#a08030")));
    h.line(16, -38, 14, -28, hex("#9a9aa0")); h.ellipse(16, -39, 6, 1.5, (nx, ny) => (ny < 0 ? hex("#e0c060") : hex("#a08030")));
  });
  // bass, stage left
  at(-62, 0, (h) => drawFigure(h, { skin: SKIN.fair, hair: { rows: shortDark, pal: pal(HAIR.dark) }, face: { eyes: "open", mouth: "flat" }, shirt: { kind: "tee", col: ["#1a2030", "#2c3850", "#405070", "#586c90", "#7888a8"] }, pose: "bass", bob: 1, extra: (h2, t2, S) => guitar(h2, 2, -26 + S.bob, "bass", ["#1a1410", "#2e2418", "#4a3a28", "#6a5438", "#8a7050"], null, false, 0.35) }, t, D, 3));
  // the tall guitarist, stage right
  at(68, 2, (h) => drawFigure(h, { skin: SKIN.fair, hair: { rows: brushUp, pal: pal(HAIR.dark), dy: -1 }, face: { eyes: "open", mouth: "flat", stubble: "#4a3a30" }, shirt: { kind: "shirt", col: ["#2a2a30", "#44444c", "#5e5e68", "#7a7a84", "#9a9aa4"] }, pose: "guitar", bob: 1, extra: (h2, t2, S) => guitar(h2, 2, -27 + S.bob, "strat", ["#8a1818", "#c03030", "#e05048", "#f07878", "#ffb0b0"], "#f4f0e8", false, 0.3) }, t, D, 4));
  // the singer in the middle, the lead guitarist at his side
  at(-24, 2, (h) => drawFigure(h, { skin: SKIN.pale, hair: { rows: jonnyHair, pal: pal(HAIR.darkBrown) }, face: { eyes: "half", mouth: "flat", brows: false }, shirt: { kind: "shirt", col: ["#8a8a90", "#b8b8c0", "#dcdce0", "#f0f0f4", "#ffffff"] }, pants: ["#0c0c12", "#18181e", "#26262e", "#36363e", "#4a4a54"], pose: "guitar", bob: 2, extra: (h2, t2, S) => { guitar(h2, 2, -27 + S.bob, "tele", ["#3a2010", "#7a4018", "#c07030", "#e8a860", "#ffd8a0"], "#f0ece0", false, 0.3); h2.line(9, -31 + S.bob, 6, -28 + S.bob, hex("#f0f0f0")); } }, t, D, 2));
  at(10, 0, (h) => drawFigure(h, { skin: SKIN.pale, hair: { rows: thomHair, pal: pal(HAIR.blondMessy) }, face: { eyes: "closed", mouth: "open", stubble: "#6a5030", browCol: "#7a6030" }, shirt: { kind: "jacket", col: ["#141a14", "#24301f", "#36472e", "#4c6040", "#66805a"], inner: ["#9a9a98", "#c8c8c4", "#ececea", "#ffffff", "#ffffff"] }, pose: "mic", bob: 1.5, extra: (h2, t2, S) => micStand(h2, 14, 0, S.HY + 4, -2) }, t, D, 1));
  if (o.scene !== false) p.glow(0, -46, 70, hex("#5a4a90"), 0.04);
}
