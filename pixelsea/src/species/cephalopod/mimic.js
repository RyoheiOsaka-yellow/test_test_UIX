import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Mimic octopus",
  ja: "ミミックオクトパス",
  sci: "Thaumoctopus mimicus",
  region: "Indonesia, Malaysia, Philippines (muddy sand flats)",
  length: "60 cm",
  desc: "A thin, banded octopus of muddy flats that impersonates other animals: it flattens into a flounder, trails two arms as a banded sea snake, fans out as a lionfish, depending on what has frightened it. Discovered only in 1998.",
  jadesc: "泥の浅瀬に住む、縞模様の細いタコ。相手に応じてヒラメに化け、二本の腕でウミヘビを演じ、腕を広げてミノカサゴになる物まね上手。1998年に見つかったばかり。",
  tags: ["octopus", "cephalopod", "mimic", "sand", "indonesia", "loop"],
  size: [96, 48],
  origin: [48, 30],
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a1c10", "#5a3c20", "#8a5c30", "#b88048", "#e0b070"],
    white: ["#8a8070", "#c0b8a0", "#e8e0c8", "#f8f4e8", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -30, 96, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const ph = (t / D) * TAU;
  const band = (x, y) => ((Math.round(x * 0.7 + y * 0.7) % 5) + 5) % 5 < 2;
  const skin = (u, v, x, y) => (band(x, y) ? W : C);
  drawOctopus(g, {
    R: 8, tilt: -0.1, head: { r: 5 }, eye: { r: 1.8, ring: "#e8e0c0" }, skin,
    arms: [
      { ang: -0.2, L: 36, r: 1.6, curl: -0.4, wave: 0.8 }, { ang: 0.2, L: 34, r: 1.6, curl: 0.5, wave: 0.8, far: true },
      { ang: 0.8, L: 26, r: 1.6, curl: 0.9, wave: 0.6 }, { ang: 1.3, L: 20, r: 1.6, curl: -0.6, wave: 0.6, far: true },
      { ang: 1.9, L: 20, r: 1.6, curl: 0.6, wave: 0.6 }, { ang: 2.4, L: 26, r: 1.6, curl: -0.9, wave: 0.6, far: true },
      { ang: 2.95, L: 34, r: 1.6, curl: -0.5, wave: 0.8 }, { ang: 3.35, L: 36, r: 1.6, curl: 0.4, wave: 0.8, far: true },
    ],
    armSkin: C, suckers: "#fff8e8", papillae: 0.02, breathe: 0.05,
    outline: "#1a1008", lit: "#5a3c20",
  }, t, D, o.seed);
  // stripes over the arms too
  g.recolor((x, y, c, al, tag) => (tag === 1 && band(x, y) ? W[2] : c));
  if (o.scene !== false) sandFloor(p, -48, 50, 10, 8, o.seed);
  if (o.scene !== false) shadow(p, 0, 10, 36, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 4);
  bubbles(p, t, D, 1, o.seed * 7 + 119, 6, -8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -28);
}
