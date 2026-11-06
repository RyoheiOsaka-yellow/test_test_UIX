import { fit, TAU, hex, Grid } from "../../core/index.js";
import { drawShrimp } from "./_body.js";
import { shift, shadow, bubbles, sandFloor, caustics } from "../_lib.js";

export const meta = {
  name: "Randall's pistol shrimp",
  ja: "ニシキテッポウエビ",
  sci: "Alpheus randalli",
  region: "Indo-Pacific sand flats",
  length: "3 cm",
  desc: "A snapping shrimp in red and white bands with one claw grown into a cannon: it snaps shut so fast the water cavitates with a crack. Nearly blind, it digs a burrow and keeps a goby as its lookout.",
  jadesc: "紅白の縞に、片方だけ大砲のように巨大化したハサミ。閉じる勢いで水中に衝撃波を起こす「テッポウ」。目が弱く、巣穴の見張り役としてハゼと共生する。",
  tags: ["shrimp", "sand", "snapping", "burrow", "loop"],
  size: [72, 48],
  origin: [34, 24],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "sand",
  options: {
    palette: ["#5a1418", "#a8282a", "#e04840", "#ff7a60", "#ffb0a0"],
    white: ["#8a8a90", "#c8c8cc", "#eeeeee", "#ffffff", "#ffffff"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-34, -22, 72, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), R = fit(o.palette, 5), W = fit(o.white, 5), g = G.clear();
  const band = (x, y) => ((x + 60 + y * 0.3) % 8 < 4 ? R : W);
  drawShrimp(g, {
    Lc: 11, H: 4.5, L: 16, curl: 0.4, rostrum: 2, rostrumUp: 0.5, taper: 0.5, eye: 1,
    skin: (u, v, x, y) => band(x, y),
    legs: { n: 4, len: 6, col: "#f0d8c8", step: 0.7 },
    antennae: { n: 2, len: 20, up: -0.25, back: true, col: "#f8e8e0", alpha: 0.85 },
    antennules: { len: 7, col: "#f8e8e0" },
    claws: { kind: "big", size: 1.25, col: "#a8282a", ramp: () => o.palette },
    swimmerets: { col: "#f0b0a0" },
  }, t, D, o.seed);
  if (o.scene !== false) sandFloor(p, -34, 36, 14, 8, o.seed);
  // the mouth of the burrow behind it
  if (o.scene !== false) {
    p.ellipse(-20, 15, 7, 2.2, hex("#3a2e18"));
    p.ellipse(-20, 14.5, 5, 1.2, hex("#1c160c"));
  }
  if (o.scene !== false) shadow(p, -2, 15, 18, 2.5, hex("#1a1408"), 0.35);
  g.draw(p, 1, 0, 4);
  bubbles(p, t, D, 2, o.seed * 11 + 2, 22, 0, [hex("#ffffff"), hex("#f8ecc8"), hex("#5ab6d6"), hex("#1a4f82")], 14, -24);
  if (o.scene !== false) caustics(p, t, D, -34, -24, 36, 22, hex("#e6cc96"), 0.1);
}
