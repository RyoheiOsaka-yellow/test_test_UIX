import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Firefly squid",
  ja: "ホタルイカ",
  sci: "Watasenia scintillans",
  region: "Western Pacific; Toyama Bay, Japan",
  length: "7 cm",
  desc: "A finger-length squid lit by a thousand blue photophores, with three bright lamps on the tip of each tentacle. Every spring millions rise to the surface of Toyama Bay to spawn and set the shoreline glowing blue.",
  jadesc: "指ほどの大きさで、千個の青い発光器をもつ。触腕の先には特に明るい3つの灯り。毎年春、産卵のために富山湾の海面に何百万匹も浮上し、海岸を青く光らせる。",
  tags: ["squid", "cephalopod", "glow", "japan", "deep", "loop"],
  size: [72, 44],
  origin: [34, 22],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#140a24", "#2c1a48", "#4a3470", "#705898", "#a090c0"],
    glow: ["#1040a0", "#3080e0", "#60c0ff", "#b0f0ff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-34, -22, 72, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), GL = fit(o.glow, 5), g = G.clear();
  const ph = (t / D) * TAU, k = 0.6 + 0.4 * Math.sin(ph * 2);
  const skin = (u, v, x, y, tt) => (spots(x, y, tt, 0.22, 2, 4) ? GL : C);
  const b = drawSquid(g, {
    L: 26, H: 5, shape: "torpedo", alpha: 0.9, skin,
    fins: { kind: "tail", len: 9, h: 5 },
    head: { r: 4 }, eye: { r: 1.8, ring: "#c0e0ff" },
    arms: { n: 8, L: 9, r: 1.1, curl: 0.5 },
    tentacles: { L: 13, r: 0.7, club: 1 },
    outline: "#0a0414", lit: "#4a3470",
    extra: (g, t, S) => { for (const x of [S.ax + 12, S.ax + 13]) { g.set(x, S.ay - 2, GL[4]); g.set(x, S.ay + 2.5, GL[4]); } },
  }, t, D, o.seed);
  const dx = Math.sin(ph) * 3, dy = Math.cos(ph) * 2;
  g.draw(p, 1, dx, dy);
  for (let i = 0; i < 10; i++) { const x = -12 + ((i * 7) % 26) + dx, y = -3 + ((i * 5) % 7) + dy; p.glow(x, y, 4, GL[2], 0.2 * k); }
  p.glow(14 + dx, -2 + dy, 6, GL[3], 0.5 * k); p.glow(14 + dx, 2.5 + dy, 6, GL[3], 0.5 * k);
  // the swarm: a few more lights drifting in the dark
  if (o.scene !== false) for (let i = 0; i < 8; i++) { const x = -34 + ((i * 29) % 72), y = -22 + ((i * 17) % 44) + Math.sin(ph + i) * 2; p.dot(x, y, GL[2], 0.5); p.glow(x, y, 4, GL[1], 0.25 * (0.5 + 0.5 * Math.sin(ph * 2 + i))); }
  p.glow(dx, dy, 24, GL[1], 0.08);
}
