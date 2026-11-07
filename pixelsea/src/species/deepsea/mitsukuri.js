import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Goblin shark",
  ja: "ミツクリザメ",
  sci: "Mitsukurina owstoni",
  region: "Deep slopes worldwide, 200–1300 m; Sagami Bay and Suruga Bay",
  length: "3–4 m",
  desc: "A living fossil shark, pink and flabby, with a blade of a snout and a jaw that shoots forward out of its face like a trap to seize squid and fish. First described from Sagami Bay in 1898, it is still most often caught off Japan.",
  jadesc: "ピンク色でたるんだ体の、生きた化石のサメ。刃のような吻の下に、罠のように顔から飛び出す顎をもち、イカや魚を捕らえる。1898年に相模湾の個体で記載され、今も日本近海で最も多く見つかる。",
  tags: ["deepsea", "shark", "fossil", "jaw", "japan", "loop"],
  size: [112,48],
  origin: [52,24],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a3040", "#8a5060", "#b87888", "#d8a0b0", "#f0c8d0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-52, -24, 112, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const snap = Math.max(0, Math.sin(ph * 2 - 1)) ** 6;
  drawFish(g, {
    L: 74, H: 8, peak: 0.4, nose: 0.5, stock: 0.14,
    skin: (u, v) => (v > 0.4 ? ["#8a6a78", "#b898a8", "#d8c0cc", "#f0e0e8", "#fff8fa"] : C),
    tail: { kind: "shark", span: 11, len: 13 },
    dorsal: [{ u: 0.5, h: 5, w: 8, kind: "tri" }, { u: 0.75, h: 4, w: 7, kind: "tri" }],
    pectoral: { u: 0.3, len: 10, w: 4, angle: 0.5, v: 0.5, flap: 0.1 },
    pelvic: { u: 0.6, h: 4, w: 6 }, anal: { u: 0.8, h: 4, w: 6 },
    eye: { u: 0.14, v: -0.2, r: 0.9, ring: "#8a5060" },
    mouth: null,
    gills: 5, gillU: 0.2,
    swim: { kind: "fish", amp: 0.8 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the blade of a snout, and the jaws that shoot forward from under it
      const x0 = S.xOf(0), y0 = S.wave(0);
      g.poly([[x0 - 2, y0 - 4], [x0 + 20, y0 - 5.5], [x0 + 22, y0 - 4.5], [x0 + 2, y0 - 1]], (x, y) => (y < y0 - 4 ? C[3] : C[2]), 1, 1);
      const jx = x0 + 2 + snap * 9, jy = y0 + 1;
      g.poly([[jx - 4, jy - 1.5], [jx + 5, jy - 2], [jx + 6, jy + 1], [jx + 5, jy + 4], [jx - 4, jy + 4]], (x, y) => (y < jy + 1 ? ["#a07888", "#c8a0b0", "#e0c0cc", "#f0e0e8", "#fff8fa"][2] : C[1]), 1, 1);
      for (let i = 0; i < 5; i++) { g.set(jx + 4 - i * 2, jy - 0.5, hex("#ffffff")); g.set(jx + 4 - i * 2, jy + 2.5, hex("#ffffff")); }
    },
    outline: "#2a1420", lit: "#8a5060",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5);
  if (o.scene !== false) snow(p, t, D, 112, 48);
}
