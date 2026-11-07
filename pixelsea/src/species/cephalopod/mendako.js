import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Flapjack octopus",
  ja: "メンダコ",
  sci: "Opisthoteuthis depressa",
  region: "Japan, 200–1000 m deep (Sagami Bay, Suruga Bay)",
  length: "20 cm",
  desc: "A deep-sea octopus like a pink dumpling: a flattened umbrella of body with two ear-shaped fins, arms webbed to their tips, and no ink. It drifts just above the mud and pulses its web to move. Japan's most beloved deep-sea face.",
  jadesc: "ピンクの饅頭のような深海のタコ。平たい傘のような体に耳形のひれ、腕は先まで膜でつながり、墨袋はない。泥の上を漂い、傘を波打たせて進む。日本でいちばん愛される深海の顔。",
  tags: ["octopus", "cephalopod", "deep", "japan", "cute", "loop"],
  size: [72, 52],
  origin: [36, 30],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a2030", "#9a3a50", "#c86078", "#e898a8", "#ffd0d8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -30, 72, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU, W2 = 36, H2 = 26, pulse = 0.5 + 0.5 * Math.sin(ph);
  // the umbrella: a wide shallow dome of body and web, ear fins on top, eyes peeking, short arms at the rim
  const R = 22, Hh = 11 + 2 * pulse;
  g.ellipse(0, -2, R, Hh, (nx, ny) => (ny < -0.3 ? C[3] : ny < 0.4 ? C[2] : C[1]));
  for (const s of [-1, 1]) g.ellipse(s * 9, -Hh - 1 + Math.sin(ph * 2) * 1.5, 5, 3, (nx, ny) => (ny < 0 ? C[4] : C[3]));
  // the web's scalloped rim and the arm tips curling under it
  for (let i = 0; i < 9; i++) {
    const u = -1 + (i / 8) * 2, x = u * R * 0.95, y = -2 + Hh * Math.sqrt(Math.max(0, 1 - u * u)) * 0.9;
    arm(g, x, y - 1, Math.PI / 2 + u * 0.4, 7 + 2 * pulse, 1.4, t, D, { curl: -u * 1.2 - (u === 0 ? 0.5 : 0), wave: 0.3, phase: i, seed: o.seed + i, cols: o.palette, suckers: "#fff0f0" });
  }
  for (const s of [-1, 1]) { g.ellipse(s * 5, 0, 2.6, 2.6, hex("#f8f0f8")); g.ellipse(s * 5 + 0.3, 0.3, 1.5, 1.5, hex("#141018")); g.set(s * 5 + 0.8, -0.4, hex("#ffffff")); }
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  g.draw(p, 1, Math.sin(ph * 0.5) * 2, Math.sin(ph) * 2 - pulse * 2);
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-W2 + ((i * 37) % (W2 * 2)), -H2 + (((i * 0.31 + t / D) % 1) * (H2 * 2)), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 1, o.seed * 7 + 120, 0, -12, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -28);
  p.glow(0, -4, 26, hex("#c86078"), 0.06);
}
