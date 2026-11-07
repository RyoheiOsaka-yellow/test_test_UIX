import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Giant squid",
  ja: "ダイオウイカ",
  sci: "Architeuthis dux",
  region: "Deep oceans worldwide, 300–1000 m; Ogasawara, Sea of Japan",
  length: "13 m with tentacles",
  desc: "The kraken: a squid as long as a bus with eyes the size of dinner plates, the largest of any animal, and two tentacles that reach out ten metres to snatch prey. It was first filmed alive in the deep off Ogasawara in 2012.",
  jadesc: "クラーケンの正体。バスほどの長さで、目は動物界最大、皿ほどもある。10 mも伸びる2本の触腕で獲物をつかむ。2012年、小笠原の深海で初めて生きた姿が撮影された。",
  tags: ["squid", "cephalopod", "giant", "deep", "legend", "loop"],
  size: [128, 56],
  origin: [48, 28],
  duration: 5.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#3a0810", "#6a1420", "#9a2830", "#c04848", "#e08080"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -28, 128, 56);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const ph = (t / D) * TAU, W2 = 64, H2 = 28;
  const skin = (u, v, x, y, tt) => (v > 0.6 ? ["#6a2a30", "#9a4a50", "#c07878", "#e0a8a8", "#ffd8d8"] : spots(x, y, tt, 0.15, 2, 5) ? ["#2a0408", "#4a0c14", "#6a1820", "#8a2830", "#a84040"] : C);
  drawSquid(g, {
    L: 56, H: 7.5, shape: "torpedo", skin,
    fins: { kind: "tail", len: 14, h: 6 },
    head: { r: 7 }, eye: { r: 3.6, ring: "#e8e8f0", iris: "#0a0a10" },
    arms: { n: 8, L: 26, r: 2, curl: 0.5, suckers: "#f0d0d0" },
    tentacles: { L: 50, r: 1, club: 1.6 },
    outline: "#1a0408", lit: "#6a1420",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5);
  if (o.scene !== false) for (let i = 0; i < 12; i++) p.dot(-W2 + ((i * 37) % (W2 * 2)), -H2 + (((i * 0.31 + t / D) % 1) * (H2 * 2)), hex("#a8d0e0"), 0.3);
  bubbles(p, t, D, 1, o.seed * 7 + 113, -30, 0, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -26);
  p.glow(-4, 0, 36, hex("#9a2830"), 0.06);
}
