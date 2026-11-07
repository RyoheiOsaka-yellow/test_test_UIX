import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Longnose lancetfish",
  ja: "ミズウオ",
  sci: "Alepisaurus ferox",
  region: "Oceans worldwide, 200–1800 m; washed up on Suruga Bay beaches in winter",
  length: "2 m",
  desc: "A two-metre spear of a fish with a sail of a dorsal fin, fangs, and watery flesh that gave it its name (mizu-uo, water fish). It swallows anything, including plastic, so stranded lancetfish on Suruga Bay beaches are used to survey ocean litter.",
  jadesc: "帆のような背びれと牙をもつ2 mの槍のような魚。身が水っぽいので「水魚」。何でも呑み込み、プラスチックも例外ではないため、冬に駿河湾の浜に打ち上がる個体は海洋ごみの調査に使われる。",
  tags: ["deepsea", "sail", "fangs", "japan", "plastic", "loop"],
  size: [128,56],
  origin: [60,30],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a3038", "#4a5460", "#728090", "#9aacbc", "#c8d8e4"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-60, -30, 128, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 104, H: 7, peak: 0.3, nose: 0.3, stock: 0.08,
    skin: (u, v) => (v > 0.3 ? ["#6a7a88", "#98a8b8", "#c4d4e0", "#e4eef4", "#ffffff"] : C),
    tail: { kind: "fork", span: 12, len: 10 },
    dorsal: [{ u: 0.4, h: 22, w: 56, kind: "sail", rays: 14, col: ["#1a2a40", "#2a4a70", "#3a6a98", "#5a90c0", "#90c0e0"] }],
    pectoral: { u: 0.25, len: 12, w: 3, angle: 0.4, v: 0.3, flap: 0.2 },
    pelvic: { u: 0.55, h: 6, w: 4 }, anal: { u: 0.82, h: 4, w: 10 },
    eye: { u: 0.08, v: -0.2, r: 1.8, ring: "#9aacbc" },
    mouth: { len: 14, open: 0.3, v: 0.2, drop: 2, teeth: true }, mouthCol: "#1a1018",
    swim: { kind: "fish", amp: 1.2 },
    finSkin: () => C,
    outline: "#12161c", lit: "#4a5460",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5 + 4);
  if (o.scene !== false) snow(p, t, D, 128, 56);
}
