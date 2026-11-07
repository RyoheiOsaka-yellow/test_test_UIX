import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Blue-lined octopus",
  ja: "ヒョウモンダコ",
  sci: "Hapalochlaena fasciata",
  region: "Japan (south of Chiba), Australia (shallow reefs, tide pools)",
  length: "10 cm",
  desc: "A golf-ball octopus that flashes iridescent blue rings and lines when it is frightened, and means it: its bite carries tetrodotoxin, the pufferfish poison, with no antidote. Warming seas are bringing it north along the Japanese coast.",
  jadesc: "ゴルフボールほどの小さなタコ。驚くと虹色に光る青い輪と線を点滅させる。咬まれるとフグ毒と同じテトロドトキシンが入り、血清はない。海水温の上昇で日本沿岸を北上中。",
  tags: ["octopus", "cephalopod", "venom", "tiny", "japan", "rings", "loop"],
  size: [60, 44],
  origin: [30, 28],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a3a10", "#8a6a20", "#c0a040", "#e0c870", "#fff0b0"],
    ring: ["#0a2a60", "#1050b0", "#2090f0", "#60d0ff", "#c0f8ff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -28, 60, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), R = fit(o.ring, 5), g = G.clear();
  const ph = (t / D) * TAU, flash = 0.5 + 0.5 * Math.sin(ph * 3);
  // rings: cells of a grid, the ring where the distance to the cell centre is in a band
  const ring = (x, y) => { const gx = Math.round(x / 6), gy = Math.round(y / 6), d = Math.hypot(x - gx * 6, y - gy * 6); return d > 1.6 && d < 2.8; };
  const skin = (u, v, x, y, tt) => (ring(x, y) ? (flash > 0.5 ? R : ["#2a3a30", "#3a5a48", "#4a7a60", "#5a9a78", "#70b890"]) : spots(x, y, tt, 0.15, 2, 8) ? ["#2a1c08", "#4a3410", "#6a4c18", "#8a6420", "#a88030"] : C);
  drawOctopus(g, {
    R: 7, tilt: -0.2, head: { r: 4.5 }, eye: { r: 1.6, ring: "#e8e0c0" }, skin,
    arms: { n: 8, L: 16, r: 1.6, curl: 1.2, spread: 1 },
    suckers: "#fff8e0", papillae: 0.05, breathe: 0.06,
    outline: "#2a1c08", lit: "#8a6a20",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -30, 32, 10, 8, o.seed);
  if (o.scene !== false) shadow(p, 0, 10, 16, 2, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 3);
  p.glow(0, -2, 16, R[2], 0.12 * flash);
  bubbles(p, t, D, 1, o.seed * 7 + 118, 4, -8, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -26);
}
