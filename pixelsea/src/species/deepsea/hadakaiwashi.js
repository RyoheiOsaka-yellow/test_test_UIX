import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Lanternfish",
  ja: "ハダカイワシ",
  sci: "Diaphus watasei",
  region: "Mesopelagic worldwide, 300–1000 m by day, near the surface by night",
  length: "10 cm",
  desc: "The most numerous fish on Earth, by weight more than all fisheries catch: a herring-like fish with silver scales that fall off at a touch and rows of blue-green lamps on its belly. Every night it rises to the surface to feed, the greatest migration on the planet.",
  jadesc: "地球でいちばん数の多い魚。重さにすれば全漁獲量を超える。触ると剥がれる銀の鱗とイワシのような体、腹には青緑のランプの列。毎晩海面へ上がって餌を食べる、地球最大の大移動の主役。",
  tags: ["deepsea", "glow", "migration", "silver", "worldwide", "loop"],
  size: [64,36],
  origin: [32,18],
  duration: 3.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1e2834", "#3a4a5c", "#5e7488", "#8aa0b4", "#c0d0dc"],
    glow: ["#0a4a60", "#1890b0", "#40d0e0", "#a0f8ff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -18, 64, 36);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const GL = fit(o.glow, 5), k = 0.6 + 0.4 * Math.sin(ph * 2);
  let pts = [];
  drawFish(g, {
    L: 32, H: 6, peak: 0.35, nose: 0.6, stock: 0.15,
    skin: (u, v, x, y) => (v > 0.2 ? ["#6a7e90", "#98acbc", "#c4d4e0", "#e4eef4", "#ffffff"] : C),
    tail: { kind: "fork", span: 6, len: 6 },
    dorsal: [{ u: 0.45, h: 4, w: 7, kind: "tri" }, { u: 0.82, h: 1.5, w: 3, kind: "lobe" }],
    pectoral: { u: 0.3, len: 6, w: 2.5, angle: 0.4, v: 0.3, flap: 0.3 },
    anal: { u: 0.7, h: 3, w: 6 },
    eye: { u: 0.1, v: -0.2, r: 1.8, ring: "#c0d0dc" },
    mouth: { len: 5, open: 0.1, v: 0.2, drop: 1 },
    swim: { kind: "fish", amp: 0.8 },
    finSkin: () => C,
    extra: (g, t, S) => { pts = []; for (let i = 0; i < 8; i++) { const u = 0.12 + i * 0.1; pts.push([S.xOf(u), S.wave(u) + S.H * S.belly(u) - 0.5]); } for (let i = 0; i < 4; i++) { const u = 0.25 + i * 0.12; pts.push([S.xOf(u), S.wave(u) + S.H * 0.2]); } },
    outline: "#0e141c", lit: "#3a4a5c",
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 2, dy = Math.sin(ph * 2) * 0.8;
  g.draw(p, 1, dx, dy);
  photophores(p, pts.map(([x, y]) => [x + dx, y + dy]), GL[2], 0.3 * k, 3);
  // the school around it, as points of light
  if (o.scene !== false) for (let i = 0; i < 8; i++) { const x = -32 + ((i * 23) % 64) + Math.sin(ph + i) * 2, y = -18 + ((i * 11) % 36); p.dot(x, y, GL[2], 0.5); p.glow(x, y, 3, GL[1], 0.2 * (0.5 + 0.5 * Math.sin(ph * 2 + i))); }
}
