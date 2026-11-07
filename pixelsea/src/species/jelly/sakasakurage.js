import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Upside-down jellyfish",
  ja: "サカサクラゲ",
  sci: "Cassiopea ornata",
  region: "Okinawa, Indo-Pacific mangroves and lagoons",
  length: "bell 15 cm",
  desc: "A jellyfish that lies on its back on the sand, bell down, waving its frilled arms up at the sun like a bed of blue-green flowers to feed the algae living in them. It pulses to keep water moving and stings with mucus it releases into the water.",
  jadesc: "砂の上に傘を下にして寝そべり、ひだ状の腕を太陽に向けて揺らす。腕の中の藻に光を与えるためで、青緑の花畑のように見える。寝たまま拍動して水を動かし、粘液を放って離れた相手を刺す。",
  tags: ["jellyfish", "rhizostome", "sand", "okinawa", "upside-down", "loop"],
  size: [64,44],
  origin: [32,32],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a4a40", "#4a7a68", "#78a890", "#a8d0b8", "#d8f0e0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -32, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const k = beat(t, D, 1), ph = (t / D) * TAU;
  // the bell lies flat on the sand, a shallow dish; the arms reach up from it, frilly and branching
  g.ellipse(0, 0, 22 * (1 - 0.08 * k), 4 + 1.5 * k, (nx, ny) => (ny < -0.3 ? C[3] : C[2]), 0.9);
  for (let i = 0; i < 9; i++) {
    const u = -1 + (i / 8) * 2, x = u * 16, Lh = 12 + 6 * (1 - Math.abs(u)) * (1 + 0.15 * k), sw = lnoise(t, D, 2, i * 0.4, o.seed) * 2;
    const pts = [[x, -1], [x + u * 2 + sw * 0.5, -1 - Lh * 0.5], [x + u * 4 + sw, -1 - Lh]];
    g.tube(pts, (v) => 1.6 - v * 0.6, (v, d) => (d > 0.6 ? C[1] : C[3]), 0.95);
    for (let s = 0.3; s <= 1; s += 0.23) { const px = x + u * 4 * s + sw * s * s, py = -1 - Lh * s; g.set(px + 1.5, py, C[4]); g.set(px - 1.5, py + 0.5, C[4]); }
  }
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.8);
  if (o.scene !== false) sandFloor(p, -32, 34, 2, 8, o.seed);
  g.draw(p, 1, 0, 0);
  p.glow(0, -8, 18, hex("#78a890"), 0.08);
  bubbles(p, t, D, 1, o.seed * 7 + 136, 6, -6, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 10, -30);
}
