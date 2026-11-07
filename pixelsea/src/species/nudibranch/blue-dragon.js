import { fit, TAU, hex, Grid, lnoise, mix } from "../../core/index.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Blue dragon",
  ja: "アオミノウミウシ",
  sci: "Glaucus atlanticus",
  region: "Open ocean worldwide, warm seas",
  length: "3 cm",
  desc: "A slug that lives at the sea's surface, floating upside down on a swallowed bubble: silver belly to the sky, blue back to the deep, cerata fanned out in three pairs of wings. It eats Portuguese man o' war and keeps the stings for itself.",
  jadesc: "外洋の水面を、飲み込んだ空気で逆さまに浮かんで暮らすウミウシ。空に向く腹は銀色、海に向く背は青。三対の翼のようなミノを広げ、カツオノエボシを食べてその毒針を自分の武器にする。",
  tags: ["nudibranch", "aeolid", "blue", "pelagic", "surface", "loop"],
  size: [80, 52],
  origin: [40, 28],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a1e5a", "#1640a0", "#2a6ad0", "#78aef0", "#c8e4ff"],
    silver: ["#5a6a80", "#9ab0c8", "#d8e8f4", "#f4fbff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -28, 80, 50);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.silver, 5), g = G.clear();
  const ph = (t / D) * TAU, L = 30, drift = Math.sin(ph) * 1.5;
  // seen from above: a tapered body, dark blue down the middle, silver-white along the sides,
  // three clusters of cerata fanning out each side like wings
  const clusters = [[0.2, 6, 13], [0.5, 4, 9], [0.74, 3, 6]];
  for (const side of [-1, 1])
    clusters.forEach(([u, n, len], ci) => {
      const bx = L / 2 - u * L, by = side * 1.2;
      for (let i = 0; i < n; i++) {
        // a fan from forward-sideways to backward-sideways, flapping slowly
        const spread = (i - (n - 1) / 2) / Math.max(1, n - 1), flap = 0.12 * Math.sin(ph + ci) + lnoise(t, D, 2, i * 0.3 + ci, o.seed) * 0.06;
        const a2 = side === 1 ? Math.PI / 2 + Math.PI * (spread * 0.42 + 0.12 + flap * 0.3) : -Math.PI / 2 - Math.PI * (spread * 0.42 + 0.12 + flap * 0.3);
        const l = len * (1 - 0.45 * Math.abs(spread));
        const ex = bx + Math.cos(a2) * l, ey = by + Math.sin(a2) * l;
        g.tube([[bx, by], [ex, ey]], (v) => (v > 0.8 ? 0.5 : 0.75), (v, d) => (v > 0.82 ? S[3] : v > 0.55 ? C[3] : C[2]), 1, 7);
      }
    });
  // the body
  g.shade(-L / 2 - 1, -4, L / 2 + 2, 4, (x, y, o2) => {
    const u = (L / 2 - x) / L;
    if (u < 0 || u > 1) return 0;
    const r = 3.2 * (u < 0.15 ? Math.sqrt(u / 0.15) * 0.9 + 0.1 : 1 - ((u - 0.15) / 0.85) ** 1.3 * 0.8);
    if (Math.abs(y) > r) return 0;
    const v = Math.abs(y) / r;
    return v < 0.3 ? C[1] : v < 0.55 ? C[2] : v < 0.8 ? S[3] : C[3];
  });
  // the head: two short tentacle pairs, eyes
  g.line(L / 2, -1, L / 2 + 4, -2.5, C[3]); g.line(L / 2, 1, L / 2 + 4, 2.5, C[3]);
  g.set(L / 2 - 2, -1.5, hex("#0a0810")); g.set(L / 2 - 2, 1.5, hex("#0a0810"));
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  // the surface above: a bright sheet of light with ripples, and the slug's own reflection-shadow
  for (let x = -40; x < (o.scene !== false ? 40 : -40); x++) {
    const wave = Math.sin(x * 0.3 + ph * 2) * 1.2 + Math.sin(x * 0.17 - ph) * 0.8;
    p.dot(x, -22 + wave, hex("#c8e4ff"), 0.5);
    p.dot(x, -23 + wave, hex("#ffffff"), 0.25);
  }
  if (o.scene !== false) p.glowLine(-40, -24, 40, -24, 14, hex("#78aef0"), 0.14);
  p.glow(0, -6, 30, hex("#2a6ad0"), 0.08);
  g.draw(p, 1, drift, -8 + Math.sin(ph * 2) * 0.6);
  bubbles(p, t, D, 2, o.seed * 7 + 20, 0, 6, [hex("#ffffff"), hex("#c8e4ff"), hex("#78aef0"), hex("#1640a0")], 12, -22);
}
