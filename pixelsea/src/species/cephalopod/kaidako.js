import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Paper nautilus",
  ja: "カイダコ（アオイガイ）",
  sci: "Argonauta argo",
  region: "Warm open seas worldwide; blown ashore on the Sea of Japan coast",
  length: "shell 20 cm (female); male 2 cm",
  desc: "An octopus that sails the open sea in a shell: the female secretes a paper-thin, ribbed white case from two web-spread arms, trapping a bubble of air to float. The thumb-sized male has no shell at all. The shells wash up on Japanese beaches after winter storms.",
  jadesc: "殻をもって外洋を漂うタコ。雌は膜のように広げた二本の腕から、紙のように薄い白い殻を分泌し、空気を閉じ込めて浮く。親指ほどの雄に殻はない。冬の嵐のあと、日本海の浜に殻が打ち上がる。",
  tags: ["octopus", "cephalopod", "shell", "pelagic", "float", "loop"],
  size: [64, 52],
  origin: [30, 28],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#8a8070", "#c0b8a8", "#e8e4d8", "#f8f8f0", "#ffffff"],
    body: ["#4a2a30", "#8a4a58", "#c08090", "#e8b8c0", "#fff0f0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -28, 64, 52);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), B = fit(o.body, 5), g = G.clear();
  const ph = (t / D) * TAU;
  // the shell: a ribbed spiral case, keel of dark knobs along its top, the body and eyes at the opening (right)
  g.ellipse(-4, -2, 20, 14, (nx, ny) => { const a = Math.atan2(ny, nx), d = Math.hypot(nx, ny); const rib = Math.round(a * 5 + d * 4) % 2 === 0; return d > 0.9 ? C[1] : rib ? C[2] : C[3]; });
  for (let a = 0; a < Math.PI * 2.5; a += 0.12) { const r = 3 * Math.exp(a * 0.28); if (r > 17) break; g.set(-4 + Math.cos(a) * r, -2 + Math.sin(a) * r * 0.7, C[1]); }
  for (let x = -22; x <= 10; x += 3) g.set(x, -2 - 14 * Math.sqrt(Math.max(0, 1 - ((x + 4) / 20) ** 2)) - 0.5, hex("#4a3020"));
  // the two web arms wrapped over the shell, the body and eyes at the opening
  for (const s of [-1, 1]) arm(g, 10, -2 + s * 4, Math.PI * (0.5 - s * 0.35), 24, 1.8, t, D, { curl: -s * 1.6, wave: 0.2, phase: s, seed: o.seed, cols: o.body, suckers: null, taper: 0.5 });
  g.ellipse(12, 0, 6, 5.5, (nx, ny) => (ny < -0.3 ? B[3] : B[2]));
  g.ellipse(14, -1, 2.2, 2.2, hex("#f8f0f8")); g.ellipse(14.3, -0.8, 1.2, 1.2, hex("#141018"));
  for (let i = 0; i < 4; i++) arm(g, 16, 1 + i * 0.8, 0.1 + i * 0.35, 12 - i, 1.1, t, D, { curl: 0.8, wave: 0.6, phase: i, seed: o.seed + i, cols: o.body, suckers: "#fff0f0" });
  g.outline((x, y, nx, ny) => (ny < 0 ? C[1] : C[0]));
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 2) * 1.5 - 2);
  // a line of bubbles trailing from the shell's trapped air
  bubbles(p, t, D, 2, o.seed * 7 + 121, -6, -16, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -28);
  p.glowLine(-30, -28, 34, -28, 10, hex("#5ab6d6"), 0.08);
}
