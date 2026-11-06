import { fit, TAU, hex, Grid, rand, ease } from "../../core/index.js";
import { drawSnail } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Queen conch",
  ja: "ピンクガイ",
  sci: "Aliger gigas",
  region: "Caribbean Sea, Bahamas, Florida",
  length: "30 cm",
  desc: "The pink-lipped conch of the Caribbean, with a crown of knobs on the spire and two eyes on stalks peering out from under the flared lip. It moves in hops, planting its claw-like foot and lurching the whole shell forward.",
  jadesc: "カリブ海のピンク色の唇をもつ巻貝。塔にはこぶの冠、広がった唇の下から二本の目が覗く。爪のような足を砂に突き立て、殻ごと飛び跳ねるように進む。",
  tags: ["shell", "snail", "gastropod", "caribbean", "sand", "pink", "loop"],
  size: [84, 54],
  origin: [38, 34],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#6a5838", "#a89060", "#d8c498", "#f0e0c0", "#fff8e8"],
    pink: ["#8a3048", "#d06080", "#f090a8", "#ffc0d0", "#ffe8f0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-38, -34, 84, 52);
const FOOT = ["#4a3828", "#8a6848", "#b89068", "#d8b890", "#f0d8b8"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), P = fit(o.pink, 5), g = G.clear();
  const u = t / D, hop = u < 0.3 ? ease.outCubic(u / 0.3) * (1 - ease.inQuad(u / 0.3)) * 4 : 0;
  const fwd = u < 0.3 ? ease.outCubic(u / 0.3) * 6 - 3 : u < 0.9 ? 3 - 6 * ease.inOutSine((u - 0.3) / 0.6) : -3;
  drawSnail(g, {
    whorls: [[-8, -11, 18, 11], [2, -22, 10, 6], [9, -29, 5.5, 4], [13, -34, 3, 2]],
    pattern: (x, y, i, nx, ny) => (rand(Math.round(x / 3), Math.round(y / 3), 11) < 0.25 ? ["#8a7048", "#b89868", "#d8c498", "#f0e0c0", "#fff8e8"] : C),
    lip: [[2, -4], [30, -20], [34, -14], [32, -2], [12, 2]],
    lipCol: P,
    foot: { L: 36, H: 4, col: FOOT, head: 10 },
    tentacles: { len: 7, col: FOOT, eyes: "tip" },
    crawl: 0.3,
    extra: (g, t, S) => {
      // the crown of knobs along the shoulder of the body whorl and the spire
      for (const [cx, cy, rx, ry, n] of [[-8, -11, 18, 11, 6], [2, -22, 10, 6, 4]])
        for (let k = 0; k < n; k++) {
          const ang = -Math.PI * 0.9 + (k / (n - 1)) * Math.PI * 0.8, bx = cx + Math.cos(ang) * rx * 0.9, by = cy + Math.sin(ang) * ry * 0.9;
          g.ellipse(bx, by - 1, 1.6, 1.8, (nx, ny) => (ny < -0.3 ? C[4] : C[2]), 1, 1);
        }
      // the inside of the lip glows pink
      g.poly([[8, -6], [28, -17], [30, -12], [26, -4], [12, 0]], (x, y) => (y < -10 ? P[3] : P[2]), 1, 1);
    },
    outline: "#3a2c18", lit: "#a89060",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -38, 42, 2, 12, o.seed);
  if (o.scene !== false) shadow(p, fwd, 2, 26, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, fwd, 1 - hop);
  bubbles(p, t, D, 1, o.seed * 7 + 42, 14, -22, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 14, -32);
  if (o.scene !== false) caustics(p, t, D, -40, -34, 40, 8, hex("#e6cc96"), 0.1);
}
