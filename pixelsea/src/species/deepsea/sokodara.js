import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Pacific grenadier",
  ja: "ソコダラ（イバラヒゲ）",
  sci: "Coryphaenoides acrolepis",
  region: "North Pacific slopes, 300–3700 m; Japan",
  length: "90 cm",
  desc: "The rat-tail: a big-headed, big-eyed fish whose body tapers to a whip, the commonest large fish of the deep sea floor, cruising nose-down over the mud sniffing for carrion. Its enormous eyes catch the faintest glow; its swim bladder drums to call mates.",
  jadesc: "ネズミのような尾。大きな頭と大きな目をもち、体は鞭のように細くなる。深海底でいちばんふつうの大型魚で、泥の上を鼻を下にして漂い、死骸の匂いを探す。巨大な目はかすかな光を捉え、浮き袋を鳴らして仲間を呼ぶ。",
  tags: ["deepsea", "floor", "rattail", "japan", "pacific", "loop"],
  size: [112,48],
  origin: [48,24],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#2a2a2e", "#484850", "#6a6a74", "#8e8e98", "#b4b4bc"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-48, -24, 112, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 92, H: 10, peak: 0.18, nose: 0.75, stock: 0.03,
    back: (u) => (u < 0.1 ? Math.sqrt(u / 0.1) : 1 - Math.pow((u - 0.1) / 0.9, 1.1) * 0.97),
    belly: (u) => (u < 0.12 ? Math.sqrt(u / 0.12) * 0.9 : 0.9 - Math.pow((u - 0.12) / 0.88, 1.1) * 0.87),
    skin: (u, v) => (v > 0.5 ? ["#4a4a52", "#6a6a74", "#8e8e98", "#aaaab4", "#c8c8d0"] : C),
    tail: { kind: "none" },
    dorsal: [{ u: 0.2, h: 8, w: 6, kind: "tri" }, { u: 0.62, h: 2.5, w: 60, kind: "ridge" }],
    pectoral: { u: 0.2, len: 9, w: 3.5, angle: 0.5, v: 0.4, flap: 0.3 },
    anal: { u: 0.6, h: 3, w: 56 },
    eye: { u: 0.08, v: -0.1, r: 2.6, ring: "#8e8e98" },
    mouth: { len: 7, open: 0.15, v: 0.7, drop: 0.5 },
    swim: { kind: "fish", amp: 1.1 },
    finSkin: () => C,
    extra: (g, t, S) => { g.line(S.xOf(0.03), S.wave(0) + S.H * 0.8, S.xOf(0.03) - 1, S.wave(0) + S.H * 0.8 + 4, C[3]); },
    outline: "#141416", lit: "#484850",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 2, Math.sin(ph * 0.5) * 1.5);
  if (o.scene !== false) { for (let x = -48; x < 64; x++) p.dot(x, 20 + ((x * 7) % 3), hex("#2a2620"), 0.9); snow(p, t, D, 112, 48); }
}
