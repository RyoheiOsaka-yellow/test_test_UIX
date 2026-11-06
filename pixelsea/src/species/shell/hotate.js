import { fit, TAU, hex, Grid, ease } from "../../core/index.js";
import { drawBivalve } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Yesso scallop",
  ja: "ホタテガイ",
  sci: "Mizuhopecten yessoensis",
  region: "Hokkaido, Tohoku, Sakhalin, Korea",
  length: "15 cm",
  desc: "The northern scallop: a purple-brown upper valve and a white lower one, ribbed like a fan, with a row of tiny blue eyes along the mantle edge. Startled, it claps its shell and jets away through the water, the only clam that really swims.",
  jadesc: "北の海のホタテ。上の殻は紫褐色、下の殻は白、扇のような放射肋。外套膜の縁には小さな青い目が並ぶ。驚くと殻を打ち鳴らして水を噴き、貝のくせに泳いで逃げる。",
  tags: ["shell", "bivalve", "scallop", "japan", "swim", "eyes", "food", "loop"],
  size: [72, 52],
  origin: [34, 28],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#2a1428", "#5a2c50", "#8a4a78", "#b878a0", "#e0b0c8"],
    white: ["#8a8080", "#c8c0b8", "#eee8e0", "#fffaf4", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-34, -28, 72, 50);
const EYE = ["#0a1430", "#1848a0", "#3090e0", "#80d0ff", "#ffffff"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const u = (t / D), clap = u < 0.18 ? 1 - ease.outCubic(u / 0.18) : u < 0.3 ? ease.inOutSine((u - 0.18) / 0.12) : 1;
  // claps shut and jets forward, then drifts and settles back
  const gape = 0.12 + 0.5 * clap;
  const jump = u < 0.6 ? ease.outCubic(Math.min(1, u / 0.5)) : ease.inOutSine(1 - (u - 0.6) / 0.4) ;
  const lift = -8 * Math.sin(Math.PI * Math.min(1, u / 0.9)) * (u < 0.9 ? 1 : 0), fwd = 6 * jump - 3;
  drawBivalve(g, {
    L: 26, bulge: 8, gape, tilt: -0.15, ribs: 9, lines: 0,
    skin: (u, v, x, y, which) => (which === "top" ? C : W),
    ribCol: null,
    mantle: ["#3a2a28", "#7a5a58", "#b09890", "#d8c8c0", "#f8f0e8"],
    inside: (g, S) => {
      // the mantle edge, fringed with tentacles and dotted with blue eyes
      for (let i = 1; i <= 7; i++) {
        const uu = 0.2 + i * 0.105;
        for (const which of ["top", "bottom"]) {
          const [x, y] = S.lip(which)(uu), s = which === "top" ? -1 : 1;
          g.set(x, y - s * 1.2, EYE[2]); g.set(x, y - s * 1.2 - 0.001, EYE[2]);
          g.line(x + 0.5, y - s * 1.8, x + 1.5, y - s * 3.5, S.M[3]);
        }
      }
    },
    outline: "#1a0c18", lit: "#6a3a60",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -34, 36, 16, 10, o.seed);
  if (o.scene !== false) shadow(p, 8 + fwd, 17, 14, 2.5, hex("#1a1408"), 0.3 * (1 + lift / 12));
  g.draw(p, 1, -12 + fwd, 10 + lift);
  // the jet of water out the hinge side
  if (clap < 0.5) for (let i = 0; i < 5; i++) p.dot(-16 + fwd - i * 2.5 - (1 - clap) * 4, 10 + lift + (i % 2) * 2 - 1, hex("#c4ecff"), 0.5 * (1 - clap) * (1 - i / 5));
  bubbles(p, t, D, 2, o.seed * 7 + 33, 0, 0, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 12, -26);
  if (o.scene !== false) caustics(p, t, D, -36, -28, 36, 22, hex("#e6cc96"), 0.1);
}
