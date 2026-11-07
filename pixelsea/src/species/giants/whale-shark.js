import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Whale shark",
  ja: "ジンベエザメ",
  sci: "Rhincodon typus",
  region: "Tropical and warm seas worldwide; Okinawa, Ningaloo, Cebu",
  length: "12 m",
  desc: "The biggest fish in the sea, and the gentlest: a grey giant checkered with white spots and lines, three ridges down each flank, and a mouth a metre and a half wide that strains plankton. The spots are a fingerprint; no two sharks share them.",
  jadesc: "海で最大の魚にして最もおとなしい。白い斑点と線の市松模様、体側に走る三本の畝、幅1.5 mの口でプランクトンを濾す。斑点の並びは指紋のように個体ごとに違う。",
  tags: ["fish", "shark", "giant", "spots", "plankton", "japan", "loop"],
  size: [120, 56],
  origin: [60, 28],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1c2a3a", "#2e4a60", "#4a7088", "#6c90a8", "#98b4c8"],
    spot: ["#8aa0b0", "#c0d0dc", "#eaf2f6", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-60, -28, 120, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.spot, 5), g = G.clear();
  const skin = (u, v, x, y) => {
    if (v > 0.6) return ["#6a8090", "#a0b4c0", "#d0dce4", "#eef2f6", "#ffffff"];
    const gx = Math.round(x / 4), gy = Math.round(y / 3.5);
    if ((gx + gy) % 2 === 0 && Math.round(x) % 4 === 2 && Math.round(y) % 3 === 1 && u > 0.06) return S;
    if (u > 0.1 && (Math.round(x) % 8 === 0 || Math.abs(v + 0.1) < 0.06 || Math.abs(v + 0.6) < 0.06)) return ["#4a6a80", "#7090a8", "#98b4c8", "#b8ccd8", "#d0e0e8"];
    return C;
  };
  drawFish(g, {
    L: 92, H: 11, peak: 0.4, nose: 0.9, stock: 0.16, skin,
    back: (u) => (u < 0.05 ? Math.sqrt(u / 0.05) * 0.85 : u < 0.4 ? 0.85 + 0.15 * Math.sin((Math.PI * (u - 0.05)) / 0.35) ** 0.5 : 1 - Math.pow((u - 0.4) / 0.6, 1.5) * 0.84),
    tail: { kind: "shark", span: 13, len: 14 },
    dorsal: [{ u: 0.55, h: 10, w: 14, kind: "tri" }, { u: 0.78, h: 4, w: 6, kind: "tri" }],
    pectoral: { u: 0.26, len: 16, w: 5, angle: 0.5, v: 0.5, flap: 0.12 },
    anal: { u: 0.8, h: 4, w: 6 },
    eye: { u: 0.06, v: 0.1, r: 0.8, ring: "#2e4a60" },
    mouth: { len: 12, open: 0.3, v: 0.2, drop: 0.2 },
    mouthCol: "#101820",
    gills: 5, gillU: 0.17,
    swim: { kind: "fish", amp: 0.7 },
    finSkin: () => C,
    outline: "#0c1620", lit: "#4a7088",
  }, t, D, o.seed);
  if (o.scene !== false) surfaceLight(p, t, D, -60, 60, -28, hex("#5ab6d6"), 0.08);
  g.draw(p, 1, 0, Math.sin((t / D) * TAU) * 1);
  // a few little fish riding along under it
  if (o.scene !== false) for (let i = 0; i < 3; i++) { const x = -10 + i * 8 + Math.sin((t / D) * TAU * 2 + i) * 1.5, y = 12 + i; p.dot(x, y, hex("#f0c020")); p.dot(x - 1, y, hex("#d0a010")); p.dot(x - 2, y + (i % 2), hex("#d0a010")); }
  bubbles(p, t, D, 2, o.seed * 7 + 56, 36, -4, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -26);
}
