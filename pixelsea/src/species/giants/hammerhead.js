import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Scalloped hammerhead",
  ja: "アカシュモクザメ",
  sci: "Sphyrna lewini",
  region: "Warm seas worldwide; famous schools at Yonaguni, Galápagos, Cocos",
  length: "4 m",
  desc: "A shark whose head is a wing: eyes at the tips of a flat hammer that gives it wraparound vision and a wide sweep of electric sense for rays hidden in sand. Off Yonaguni and the Galápagos they gather by the hundred.",
  jadesc: "頭が翼のような形のサメ。平たい槌の両端に目があり、全方位の視界と、砂に隠れたエイを探る広い電気感覚をもつ。与那国島やガラパゴスでは数百匹の群れになる。",
  tags: ["fish", "shark", "hammerhead", "school", "japan", "loop"],
  size: [100, 52],
  origin: [48, 26],
  duration: 3.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a3038", "#4e5862", "#74828c", "#9aa8b0", "#c0ccd4"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -26, 100, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const skin = (u, v) => (v > 0.3 ? ["#7a8a90", "#b0bcc4", "#dce4e8", "#f4f8fa", "#ffffff"] : C);
  drawFish(g, {
    L: 62, H: 8.5, peak: 0.36, nose: 0.6, stock: 0.14, skin,
    tail: { kind: "shark", span: 12, len: 13 },
    dorsal: [{ u: 0.4, h: 14, w: 11, kind: "falcate" }, { u: 0.78, h: 3, w: 5, kind: "tri" }],
    pectoral: { u: 0.28, len: 12, w: 4.5, angle: 0.55, v: 0.5, flap: 0.12 },
    pelvic: { u: 0.62, h: 3.5, w: 5 },
    anal: { u: 0.8, h: 3, w: 4 },
    eye: null,
    mouth: null,
    gills: 5, gillU: 0.2,
    swim: { kind: "fish", amp: 1 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the hammer: a flat blade out in front of the body, the eye at its tip, the mouth well back underneath
      const x0 = S.xOf(0.02), y0 = S.wave(0);
      g.poly([[x0 - 2, y0 - 4], [x0 + 12, y0 - 3.5], [x0 + 13, y0 - 1], [x0 + 12, y0 + 1.5], [x0 - 2, y0 + 4.5]], (x, y) => (y < y0 - 1 ? C[3] : y < y0 + 1.5 ? C[2] : ["#7a8a90", "#b0bcc4", "#dce4e8", "#f4f8fa", "#ffffff"][2]), 1, 1);
      g.ellipse(x0 + 11, y0 - 1, 1.3, 1.3, hex("#0a0810"), 1, 1); g.set(x0 + 11.5, y0 - 1.5, hex("#ffffff"));
      g.line(x0 - 1, y0 + 4, x0 + 5, y0 + 4.5, C[0], 1, 1);
    },
    outline: "#12161c", lit: "#74828c",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -48, 52, -26, hex("#5ab6d6"), 0.08);
  // the school, faint and far
  if (o.scene !== false) for (let i = 0; i < 4; i++) { const x = -40 + i * 22 + Math.sin((t / D) * TAU + i) * 2, y = -18 + (i % 2) * 5; for (let k = 0; k < 7; k++) p.blend(x - k, y + (k === 3 ? -1 : 0), hex("#4e5862"), 0.35); p.blend(x - 3, y - 2, hex("#4e5862"), 0.35); }
  g.draw(p, 1, Math.sin((t / D) * TAU) * 2, Math.sin((t / D) * TAU) * 1);
  bubbles(p, t, D, 2, o.seed * 7 + 58, 30, 0, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
}
