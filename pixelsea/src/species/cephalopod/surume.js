import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Japanese flying squid",
  ja: "スルメイカ",
  sci: "Todarodes pacificus",
  region: "Sea of Japan and the North Pacific around Japan",
  length: "30 cm",
  desc: "The everyday squid of Japan, of ika sashimi and dried surume: a red-brown torpedo with rhombic tail fins that jets so hard it can glide clear of the water. It lives one year, migrating the length of Japan and back, and dies after spawning.",
  jadesc: "刺身にも干物にも、日本でいちばん身近なイカ。赤褐色の魚雷のような胴にひし形の尾びれ。噴射が強く、海面から飛び出して滑空する。寿命は1年。日本列島を回遊し、産卵して一生を終える。",
  tags: ["squid", "cephalopod", "japan", "pelagic", "food", "loop"],
  size: [100, 44],
  origin: [48, 22],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a1810", "#8a3020", "#c05838", "#e09070", "#ffd0b8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -22, 100, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU, jet = Math.max(0, Math.sin(ph)) ** 2;
  const skin = (u, v, x, y, tt) => (v < -0.6 ? ["#2a0c08", "#5a1c14", "#8a3020", "#a84828", "#c06040"] : v > 0.5 ? ["#8a6a60", "#c0a098", "#e8d0c8", "#f8ece8", "#ffffff"] : spots(x, y, tt, 0.2, 2.5, 2) ? ["#2a0c08", "#6a2418", "#a04028", "#c86040", "#e89070"] : C);
  drawSquid(g, {
    L: 52, H: 6, shape: "torpedo", skin,
    fins: { kind: "tail", len: 20, h: 9 },
    head: { r: 5 }, eye: { r: 2, ring: "#f0f0f8" },
    arms: { n: 8, L: 14, r: 1.5, curl: 0.4, suckers: "#f0e0d8" },
    tentacles: { L: 20, r: 0.8, club: 1.1 },
    jet,
    outline: "#200806", lit: "#8a3020",
  }, t, D, o.seed);
  g.draw(p, 1, -8 * jet + 3, Math.sin(ph) * 1);
  bubbles(p, t, D, 2, o.seed * 7 + 112, -22 - 8 * jet, 2, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -20);
}
