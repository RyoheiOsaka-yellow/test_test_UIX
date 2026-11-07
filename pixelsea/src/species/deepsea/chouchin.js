import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Footballfish",
  ja: "チョウチンアンコウ",
  sci: "Himantolophus sagamius",
  region: "Deep Pacific, 200–800 m; named for Sagami Bay",
  length: "female 40 cm, male 4 cm",
  desc: "The lantern-fish of the abyss: a black, warty ball of a fish with a glowing bulb on a stalk over its mouth, lit by bacteria, dangled to draw prey into a jaw of needle teeth. The thumb-sized male finds a female by smell and lives as a parasite on her side.",
  jadesc: "深海の提灯持ち。黒くイボだらけの球のような体で、口の上の柄の先に細菌の光る球をぶら下げ、針のような歯の口へ獲物を誘う。親指ほどの雄は匂いで雌を探し、その体に寄生して生きる。",
  tags: ["deepsea", "anglerfish", "glow", "lure", "japan", "loop"],
  size: [80,56],
  origin: [36,28],
  duration: 4.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a0a12", "#1c1a26", "#302c3c", "#484254", "#625c70"],
    glow: ["#1a4a30", "#30a060", "#60e090", "#b0ffd0", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -28, 80, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const GL = fit(o.glow, 5), k = 0.6 + 0.4 * Math.sin(ph * 2);
  let bulb = [0, 0];
  drawFish(g, {
    L: 36, H: 14, peak: 0.45, nose: 0.9, stock: 0.25,
    skin: (u, v, x, y) => (rand(Math.round(x), Math.round(y), 100) < 0.12 ? ["#201e2a", "#38344a", "#524c68", "#6a6486", "#8a84a4"] : C),
    tail: { kind: "round", span: 8, len: 8 },
    dorsal: [{ u: 0.7, h: 5, w: 8, kind: "lobe" }],
    pectoral: { u: 0.45, len: 7, w: 4, angle: 0.5, v: 0.5, flap: 0.3 },
    anal: { u: 0.72, h: 4, w: 6 },
    eye: { u: 0.2, v: -0.3, r: 1.3, ring: "#484254" },
    mouth: { len: 16, open: 0.5, v: 0.1, drop: 3, teeth: true }, mouthCol: "#1a0810",
    swim: { kind: "fish", amp: 0.4 },
    finSkin: () => C,
    extra: (g, t, S) => { bulb = lure(g, S.xOf(0.25), S.wave(0.25) - S.H * S.back(0.25) - 1, 14, t, D, GL, o.seed); for (let i = 0; i < 8; i++) g.set(S.xOf(0.02) - 1 - i * 1.6, S.wave(0) + 2.5 + (i % 2) * 2.5, hex("#ffffff")); },
    outline: "#040408", lit: "#302c3c",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1, Math.sin(ph * 0.5) * 1.5);
  p.glow(bulb[0] + Math.sin(ph) * 1, bulb[1] + Math.sin(ph * 0.5) * 1.5, 9, GL[2], 0.6 * k);
  p.glow(bulb[0] + Math.sin(ph) * 1, bulb[1] + Math.sin(ph * 0.5) * 1.5, 26, GL[1], 0.12 * k);
  if (o.scene !== false) snow(p, t, D, 80, 56);
}
