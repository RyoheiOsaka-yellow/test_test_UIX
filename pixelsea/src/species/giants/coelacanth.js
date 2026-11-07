import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawFish, blow, surfaceLight } from "./_body.js";
import { shift, bubbles, plants, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Coelacanth",
  ja: "シーラカンス",
  sci: "Latimeria chalumnae",
  region: "Comoros, Mozambique Channel, South Africa, 150–700 m",
  length: "2 m",
  desc: "The fish that came back from the dead: thought extinct with the dinosaurs until one turned up in a South African net in 1938. Steel-blue with white flecks, it rows along on fleshy, limb-like lobed fins, and its three-lobed tail has a tuft in the middle.",
  jadesc: "恐竜とともに絶滅したと思われていたが、1938年に南アフリカの網にかかって甦った「生きた化石」。鋼のような青に白い斑点、手足のような肉質のヒレで漕ぐように泳ぎ、尾びれの真ん中には小さな房がある。",
  tags: ["fish", "fossil", "deep", "lobe-finned", "africa", "loop"],
  size: [100, 52],
  origin: [48, 26],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0e1e38", "#1c3860", "#2c5888", "#4878a8", "#78a0c8"],
    spot: ["#8aa0b0", "#c0d0dc", "#eaf2f6", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -26, 100, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), B = fit(o.palette, 5), S = fit(o.spot, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const skin = (u, v, x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 51) < 0.08 ? S : Math.round(x + y) % 4 === 0 ? ["#1c3860", "#2c5888", "#3c6898", "#5888b8", "#88b0d0"] : B);
  const lobe = (g, x, y, ang, len, w, ph0) => {
    const a = ang + 0.3 * Math.sin(ph + ph0);
    const ex = x - Math.cos(a) * len, ey = y + Math.sin(a) * len;
    g.tube([[x, y], [(x + ex) / 2, (y + ey) / 2]], w * 0.9, (u, d) => (d > 0.7 ? B[1] : B[3]), 1, 1);
    g.poly([[(x + ex) / 2, (y + ey) / 2 - w], [ex, ey - w * 0.5], [ex - 1, ey + w * 0.8], [(x + ex) / 2, (y + ey) / 2 + w]], (px, py) => (py < (y + ey) / 2 ? B[3] : B[2]), 1, 1);
  };
  drawFish(g, {
    L: 64, H: 12, peak: 0.4, nose: 0.7, stock: 0.3, skin,
    tail: { kind: "round", span: 10, len: 10 },
    dorsal: [{ u: 0.4, h: 7, w: 8, kind: "tri" }],
    pectoral: null,
    eye: { u: 0.08, v: -0.1, r: 1.6 },
    mouth: { len: 7, open: 0.2, v: 0.3, drop: 1.5 },
    gills: 1, gillU: 0.2,
    swim: { kind: "fish", amp: 0.5 },
    finSkin: () => B,
    extra: (g, t, S2) => {
      // lobed fins: pectoral, pelvic, second dorsal and anal on fleshy stalks; the tail's middle tuft
      lobe(g, S2.xOf(0.3), S2.H * 0.4, 0.6, 12, 3, 0);
      lobe(g, S2.xOf(0.55), S2.H * 0.85, 0.9, 9, 2.5, 1.5);
      lobe(g, S2.xOf(0.7), -S2.H * S2.back(0.7) * 0.9, -1.0, 9, 2.5, 2.5);
      lobe(g, S2.xOf(0.76), S2.H * S2.belly(0.76) * 0.9, 1.0, 9, 2.5, 3.5);
      const tx = S2.xOf(1), ty = S2.wave(1);
      g.poly([[tx + 1, ty - 1.5], [tx - 12, ty - 1], [tx - 12, ty + 1], [tx + 1, ty + 1.5]], B[3], 1, 1);
    },
    outline: "#060e1c", lit: "#2c5888",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1, Math.sin(ph * 2) * 0.6);
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-48 + ((i * 37) % 100), -26 + (((i * 0.31 + t / D) % 1) * 52), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 1, o.seed * 7 + 63, 30, -2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -24);
  p.glow(0, 0, 30, hex("#2c5888"), 0.06);
}
