import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Japanese spider crab",
  ja: "タカアシガニ",
  sci: "Macrocheira kaempferi",
  region: "Pacific coast of Japan, 150–600 m (Suruga Bay)",
  length: "legs span 3.8 m",
  desc: "The largest arthropod alive: an orange-and-white crab whose legs span nearly four metres, walking the deep slopes off Suruga Bay on stilts. Slow, gentle and a century old at most, it hides its spiny shell under sponges and anemones.",
  jadesc: "現生最大の節足動物。橙と白のまだらの脚を広げると4 m近く、駿河湾の深い斜面を竹馬のように歩く。動きは遅く穏やかで、寿命は100年ほど。トゲのある甲をカイメンやイソギンチャクで飾る。",
  tags: ["crab", "crustacean", "giant", "deep", "japan", "loop"],
  size: [128,72],
  origin: [64,26],
  duration: 5.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#5a2010", "#9a4020", "#d06838", "#f0a070", "#ffd8b8"],
    white: ["#8a7868", "#c0b0a0", "#e8dcd0", "#f8f0e8", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-64, -26, 128, 72), BG = new Grid(-64, -26, 128, 72);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const W = fit(o.white, 5);
  drawCrab(g, {
    W: 11, H: 9, shape: "round", floor: 40, scuttle: 1, bumps: 0.15,
    skin: (nx, ny, x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 82) < 0.3 ? W : C),
    legs: { n: 4, L: 54, r: 1.4, cols: C, lift: 4, lengths: [1, 1.05, 1, 0.9] },
    claws: { size: 1.6, L: 30, cols: C, open: 0.3 },
    eyes: { stalk: 2, r: 1, x: 0.3 },
    outline: "#2a0c04", lit: "#9a4020",
  }, t, D, o.seed);
  // the legs are banded orange and white
  g.recolor((x, y, c, al, tag) => (tag === 1 && (y > 8 || Math.abs(x) > 14) && ((Math.round(x / 4) + Math.round(y / 3)) % 3 === 0) ? W[2] : c));
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-64 + ((i * 37) % 128), -26 + (((i * 0.31 + t / D) % 1) * 72), hex("#a8d0e0"), 0.3);
  if (o.scene !== false) shadow(p, 0, 40, 50, 3, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 143, 0, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -24);
}
