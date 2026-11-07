import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { beat, lift, bell, tentacles, oralArms } from "./_body.js";
import { shift, bubbles, sandFloor } from "../_lib.js";

export const meta = {
  name: "Spotted jelly",
  ja: "タコクラゲ",
  sci: "Mastigias papua",
  region: "Western Pacific; Palau lakes, Okinawa, Japan in autumn",
  length: "bell 10 cm",
  desc: "A dome speckled with white spots over eight thick, club-ended oral arms, with no fringe of tentacles at all. It farms algae inside its body and swims toward the sun to feed them, so a lake in Palau fills with millions following the light.",
  jadesc: "白い斑点の傘の下に、先が棍棒のように太い八本の口腕。縁の触手はない。体内に藻を飼い、藻に光を与えるため太陽を追って泳ぐ。パラオの湖では何百万匹が光を追って動く。",
  tags: ["jellyfish", "rhizostome", "spots", "palau", "japan", "loop"],
  size: [64,60],
  origin: [32,20],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#4a3a28", "#8a6a48", "#b89068", "#d8b890", "#f0d8b8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-32, -20, 64, 60);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear();
  const k = beat(t, D, 1), y = lift(t, D, 1, 0, 4);
  const b = bell(g, 22, 13, k, o.palette, (x, yy, nx, ny) => (rand(Math.round(x / 3), Math.round(yy / 3), 92) < 0.2 ? ["#b8b8b0", "#d8d8d0", "#f0f0ec", "#ffffff", "#ffffff"] : 0), { a: 0.9, frill: 0, dome: 0.65 });
  oralArms(g, 8, 20, 2.2, k, t, D, ["#5a4a30", "#9a7a50", "#c8a070", "#e8c898", "#fff0d0"], { a: 0.95, seed: o.seed, frilly: true });
  for (let i = 0; i < 8; i++) { const u = -1 + (i / 7) * 2; g.ellipse(u * 3 + u * 5 * (1 - 0.3 * k) + Math.sin(2.5 - (t / D) * TAU * 2 + i * 1.3) * 1.5, 23, 2.4, 2, (nx, ny) => (ny < 0 ? C[3] : C[2]), 0.95); }
  g.outline((x, yy, nx, ny) => (ny < 0 ? C[2] : C[1]), 0.8);
  g.draw(p, 1, Math.sin((t / D) * TAU) * 1.5, y);
  bubbles(p, t, D, 1, o.seed * 7 + 135, 10, 10, [hex("#ffffff"), hex("#a8e6f0"), hex("#2f7eae"), hex("#10305a")], 12, -18);
}
