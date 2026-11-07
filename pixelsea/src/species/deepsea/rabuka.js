import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Frilled shark",
  ja: "ラブカ",
  sci: "Chlamydoselachus anguineus",
  region: "Deep slopes worldwide, 500–1000 m; Suruga Bay",
  length: "2 m",
  desc: "An eel of a shark with six frilly gill slits, a lizard's head and three hundred trident teeth in twenty-five rows, unchanged since the age of dinosaurs. It is thought to lunge like a snake, and carries its young for three and a half years, longest of any vertebrate.",
  jadesc: "六つのひだ状のえらと、トカゲのような頭、二十五列に並ぶ三百本の三叉の歯をもつウナギのようなサメ。恐竜の時代から姿を変えていない。ヘビのように身を縮めて襲うとされ、妊娠期間は脊椎動物で最長の3年半。",
  tags: ["deepsea", "shark", "fossil", "eel", "japan", "loop"],
  size: [120,44],
  origin: [60,22],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a2420", "#4a4038", "#6a5e52", "#8a7c6e", "#a89a8a"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-60, -22, 120, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 100, H: 6, peak: 0.15, nose: 0.85, stock: 0.2,
    back: (u) => (u < 0.08 ? Math.sqrt(u / 0.08) : 1 - Math.pow((u - 0.08) / 0.92, 1.4) * 0.75),
    belly: (u) => (u < 0.08 ? Math.sqrt(u / 0.08) : 1 - Math.pow((u - 0.08) / 0.92, 1.4) * 0.75),
    skin: (u, v) => (v > 0.5 ? ["#5a5048", "#8a7c6e", "#a89a8a", "#c8bcae", "#e0d8cc"] : C),
    tail: { kind: "shark", span: 7, len: 10 },
    dorsal: [{ u: 0.82, h: 4, w: 8, kind: "tri" }],
    pectoral: { u: 0.2, len: 7, w: 3, angle: 0.5, v: 0.5, flap: 0.2 },
    pelvic: { u: 0.7, h: 4, w: 6 }, anal: { u: 0.85, h: 4, w: 7 },
    eye: { u: 0.05, v: -0.2, r: 1, ring: "#4a4038" },
    mouth: { len: 7, open: 0.25, v: 0.3, drop: 0.5, teeth: true }, mouthCol: "#2a1018",
    gills: 6, gillU: 0.09,
    swim: { kind: "fish", amp: 1.4 },
    finSkin: () => C,
    extra: (g, t, S) => { for (let i = 0; i < 6; i++) { const x = S.xOf(0.09 + i * 0.035); g.line(x - 1, S.wave(0.1) + S.H * 0.3, x - 2.5, S.wave(0.1) + S.H * 0.95, C[3]); } },
    outline: "#141210", lit: "#4a4038",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5);
  if (o.scene !== false) snow(p, t, D, 120, 44);
}
