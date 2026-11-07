import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawSquid, drawOctopus, arm, spots } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor } from "../_lib.js";

export const meta = {
  name: "Golden cuttlefish",
  ja: "コウイカ（スミイカ）",
  sci: "Sepia esculenta",
  region: "Japan, Korea, China (coastal, sandy bottoms)",
  length: "18 cm",
  desc: "The 'ink squid' of Tokyo Bay: a broad body stiffened by a chalky cuttlebone, a fin frill rippling all the way round, and W-shaped pupils. Its skin runs zebra stripes and waves of colour to hypnotise crabs, and it squirts a thick cloud of ink to vanish.",
  jadesc: "東京湾のスミイカ。胴には白い甲（イカの骨）が入り、ひれが縁をぐるりと波打つ。瞳はW字形。皮膚にしま模様や色の波を走らせてカニを惑わせ、濃い墨を吐いて消える。",
  tags: ["cuttlefish", "cephalopod", "japan", "sand", "ink", "loop"],
  size: [80, 48],
  origin: [40, 24],
  duration: 4.0,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a3a28", "#8a7050", "#b8a078", "#d8c8a0", "#f0e8d0"],
    stripe: ["#2a1c10", "#4a3420", "#6a4c30", "#8a6440", "#a88050"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -24, 80, 48);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), S = fit(o.stripe, 5), g = G.clear();
  const ph = (t / D) * TAU;
  // zebra stripes that drift along the body, and a wash of darker colour passing over it
  const skin = (u, v, x, y, tt) => (v > 0.6 ? ["#9a9a90", "#c8c8c0", "#e8e8e0", "#f8f8f4", "#ffffff"] : ((Math.round(x - (tt / D) * 8 + y * 0.3) % 5) + 5) % 5 === 0 && v < 0.3 ? S : C);
  drawSquid(g, {
    L: 38, H: 10, shape: "oval", skin,
    fins: { kind: "ribbon", h: 3, from: 0.04, to: 0.96 },
    finSkin: ["#6a5a48", "#a08a70", "#c8b898", "#e8dcc0", "#fff8e8"],
    head: { r: 7 }, eye: { r: 2.6, ring: "#e8e0d0", iris: "#b0a080", w: true },
    arms: { n: 8, L: 11, r: 2, curl: 0.7, suckers: "#f0e8e0" },
    tentacles: { L: 14, r: 0.9, club: 1.2 },
    outline: "#2a1c10", lit: "#8a7050",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1.5, Math.sin(ph * 2) * 0.8);
  // a puff of ink behind now and then
  const ink = Math.max(0, Math.sin(ph - 2.2)) ** 2;
  if (ink > 0.05) for (let i = 0; i < 6; i++) p.disc(-28 - i * 3 - ink * 6, (i % 3) * 3 - 3, 2 + ink * 2, hex("#101014"), 0.5 * ink * (1 - i / 6));
  bubbles(p, t, D, 1, o.seed * 7 + 114, -16, 0, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 10, -22);
}
