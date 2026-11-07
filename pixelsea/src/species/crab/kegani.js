import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Horsehair crab",
  ja: "ケガニ",
  sci: "Erimacrus isenbeckii",
  region: "Hokkaido, Okhotsk, Bering Sea",
  length: "shell 12 cm",
  desc: "A squat, bristly crab furred in short stiff hairs, dull orange-brown, the pride of Hokkaido's fish markets for its sweet meat and rich kani-miso. It lives on sandy bottoms in cold water and is fished within strict quotas.",
  jadesc: "短く硬い毛に覆われた、ずんぐりした橙褐色のカニ。甘い身と濃厚なカニ味噌で北海道の市場の誇り。冷たい海の砂底に住み、漁獲は厳しく制限されている。",
  tags: ["crab", "crustacean", "hairy", "hokkaido", "food", "loop"],
  size: [72,48],
  origin: [36,22],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a2c14", "#8a5428", "#c08040", "#e0a868", "#f8d0a0"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -22, 72, 48), BG = new Grid(-36, -22, 72, 48);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  drawCrab(g, {
    W: 14, H: 10, shape: "square", floor: 20, scuttle: 2, bumps: 0.3,
    skin: () => C,
    legs: { n: 4, L: 14, r: 1.8, cols: C, lift: 2.5, hairy: true, lengths: [1, 0.95, 0.9, 0.8] },
    claws: { size: 2.2, L: 10, cols: C, open: 0.3 },
    eyes: { stalk: 2, r: 1, x: 0.3 },
    extra: (g, t, S) => { for (let x = -S.W; x <= S.W; x += 2) g.set(x + S.shuffle, -S.H - 0.5 - (x % 4 ? 0 : 1), C[2]); },
    outline: "#2a1408", lit: "#8a5428",
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -36, 38, 20, 6, o.seed);
  if (o.scene !== false) shadow(p, 0, 20, 28, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
  bubbles(p, t, D, 1, o.seed * 7 + 146, 0, -10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -20);
}
