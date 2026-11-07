import { fit, TAU, hex, Grid, rand, lnoise } from "../../core/index.js";
import { drawCrab, drawHermit, claw, leg } from "./_body.js";
import { rock } from "../shell/_body.js";
import { shift, bubbles, shadow, sandFloor, caustics, plants } from "../_lib.js";

export const meta = {
  name: "Coconut crab",
  ja: "ヤシガニ",
  sci: "Birgus latro",
  region: "Islands of the Indo-Pacific; Okinawa and Ogasawara",
  length: "legs span 1 m, 4 kg",
  desc: "The largest land animal with an exoskeleton: a hermit crab that outgrew every shell and now walks the forest floor in armour of blue and red, climbs palms, and cracks coconuts with claws that grip harder than a lion's bite. It returns to the sea only to release its larvae.",
  jadesc: "外骨格をもつ陸の動物では最大。どの貝殻にも収まらなくなったヤドカリで、青と赤の鎧で林床を歩き、ヤシの木に登り、ライオンの噛む力より強いハサミでココナッツを割る。海に戻るのは幼生を放つときだけ。",
  tags: ["crab", "anomura", "land", "giant", "okinawa", "loop"],
  size: [80,56],
  origin: [40,28],
  duration: 4.2,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#1a1c3a", "#2e3060", "#4a4c88", "#6c6eaa", "#9a98c8"],
    red: ["#4a1408", "#8a2810", "#c04820", "#e07040", "#ffa070"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-40, -28, 80, 56), BG = new Grid(-40, -28, 80, 56);
const ROCK = ["#1a1a22", "#2e2a34", "#4a4454"];

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), bg = BG.clear();
  const R = fit(o.red, 5);
  drawCrab(g, {
    W: 13, H: 9, shape: "oval", floor: 22, scuttle: 1.5, bumps: 0.15,
    skin: (nx, ny) => (ny > 0.3 ? R : C),
    legs: { n: 3, L: 22, r: 2.4, cols: C, lift: 3, spines: 2, lengths: [1, 1, 0.9] },
    claws: { size: 3, L: 14, cols: C, open: 0.35, left: 1.15, right: 0.9, palm: R },
    eyes: { stalk: 3, r: 1.1, x: 0.3 },
    extra: (g, t, S) => {
      // the soft abdomen tucked behind, armoured in plates, and the long antennae
      g.ellipse(-2 + S.shuffle, -S.H * 0.9, 10, 4, (nx, ny) => (ny < 0 ? R[3] : R[2]));
      for (const dx of [-1, 1]) g.line(dx * 3 + S.shuffle, -S.H * 0.6, dx * 10 + S.shuffle, -S.H - 10 + lnoise(t, D, 2, dx, o.seed) * 2, C[3]);
    },
    outline: "#0c0c1e", lit: "#2e3060",
  }, t, D, o.seed);
  // on land: sandy ground with a fallen coconut
  if (o.scene !== false) { sandFloor(p, -40, 42, 22, 8, o.seed); p.ellipse(-28, 20, 5, 4, hex("#5a3a18")); p.ellipse(-29, 19, 3, 2, hex("#7a5428")); }
  if (o.scene !== false) shadow(p, 0, 22, 30, 2.5, hex("#000000"), 0.5);
  g.draw(p, 1, 0, 0);
}
