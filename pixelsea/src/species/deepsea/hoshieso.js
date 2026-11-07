import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Stoplight loosejaw",
  ja: "オオクチホシエソ",
  sci: "Malacosteus niger",
  region: "Deep oceans worldwide, 500–1000 m",
  length: "25 cm",
  desc: "A black dragonfish with a jaw hinged so loosely it has no floor, and a trick no other fish has: a red searchlight under each eye. Almost nothing in the deep can see red, so it hunts shrimp by a light they cannot detect, seeing red with a pigment borrowed from the plants its prey ate.",
  jadesc: "顎の蝶番がゆるく、口の底がないドラゴンフィッシュ。ほかの魚にはない技をもつ。目の下に赤いサーチライトがあるのだ。深海の生き物のほとんどは赤を見られないので、獲物に気づかれない光で狩る。赤を見る色素は、獲物が食べた植物由来。",
  tags: ["deepsea", "red light", "dragonfish", "glow", "worldwide", "loop"],
  size: [80,36],
  origin: [40,18],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a0a0c", "#1a181c", "#2c282e", "#403a42", "#564e58"],
    red: ["#4a0808", "#a01010", "#f02020", "#ff6060", "#ffb0b0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -18, 80, 36);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const R = fit(o.red, 5), k = 0.5 + 0.5 * Math.sin(ph * 2);
  drawFish(g, {
    L: 60, H: 5, peak: 0.2, nose: 0.6, stock: 0.12,
    skin: () => C,
    tail: { kind: "fork", span: 5, len: 6 },
    dorsal: [{ u: 0.85, h: 4, w: 8, kind: "tri" }],
    pectoral: { u: 0.25, len: 5, w: 2, angle: 0.4, v: 0.3, flap: 0.3 },
    anal: { u: 0.85, h: 4, w: 8 },
    eye: { u: 0.08, v: -0.3, r: 1.5, ring: "#403a42" },
    mouth: null,
    swim: { kind: "fish", amp: 1 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the floorless jaw: just a bar of bone with fangs, hanging open; the red light under the eye
      const x0 = S.xOf(0), y0 = S.wave(0), op = 0.3 + 0.3 * Math.max(0, Math.sin(ph));
      g.line(x0, y0 + 1, x0 - 12, y0 + 2 + op * 6, C[3], 1, 1);
      g.line(x0, y0 + 1, x0 + 1, y0 + 1 + op * 6, C[3], 1, 1);
      for (let i = 0; i < 4; i++) { g.set(x0 - 2 - i * 2.5, y0 - 0.5, hex("#ffffff")); g.set(x0 - 2 - i * 2.5, y0 + 2.5 + op * 5, hex("#ffffff")); }
      g.ellipse(S.xOf(0.09), S.wave(0.09) + 1.5, 1.6, 1.1, R[3], 1, 7);
      g.set(S.xOf(0.03), S.wave(0.03) - 1.5, hex("#40c0ff"), 1, 7);
    },
    outline: "#040404", lit: "#2c282e",
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 2, dy = Math.sin(ph * 0.5) * 1;
  g.draw(p, 1, dx, dy);
  p.glow(24 + dx, 1.5 + dy, 10, R[2], 0.5 * k);
  p.glowLine(24 + dx, 1.5 + dy, 40 + dx, 4 + dy, 5, R[2], 0.2 * k);
  if (o.scene !== false) snow(p, t, D, 80, 36, 10);
}
