import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Barreleye",
  ja: "デメニギス",
  sci: "Macropinna microstoma",
  region: "North Pacific, 600–800 m; Suruga Bay",
  length: "15 cm",
  desc: "A fish with a see-through head: two green tubular eyes sit inside a transparent dome filled with fluid, looking straight up through its own skull for the silhouettes of jellyfish, then rotating forward to eat. The dark spots over its tiny mouth are not the eyes.",
  jadesc: "頭が透けている魚。緑色の筒状の目が透明なドームの中にあり、自分の頭蓋を通して真上を見上げ、クラゲの影を探してから前に回して食べる。小さな口の上の黒い点は目ではなく鼻孔。",
  tags: ["deepsea", "transparent", "eyes", "japan", "pacific", "loop"],
  size: [72,44],
  origin: [36,22],
  duration: 4.4,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0e1414", "#1e2a2a", "#324444", "#4a6060", "#6a8080"],
    eye: ["#0a3a20", "#1a7a40", "#30c060", "#80f0a0", "#e0ffe8"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-36, -22, 72, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  const E = fit(o.eye, 5);
  drawFish(g, {
    L: 40, H: 8, peak: 0.4, nose: 0.85, stock: 0.2,
    skin: (u, v) => C,
    tail: { kind: "fork", span: 7, len: 7 },
    dorsal: [{ u: 0.7, h: 4, w: 8, kind: "ridge" }],
    pectoral: { u: 0.45, len: 10, w: 4, angle: 0.4, v: 0.3, flap: 0.3 },
    pelvic: { u: 0.5, h: 4, w: 5 }, anal: { u: 0.75, h: 3, w: 5 },
    eye: null,
    mouth: { len: 3, open: 0.1, v: 0.5, drop: 0.5 },
    swim: { kind: "fish", amp: 0.3 },
    finSkin: () => C,
    extra: (g, t, S) => {
      // the transparent dome over the head, the two green barrel eyes looking up inside it, the nostrils
      const hx = S.xOf(0.12), top = S.wave(0.12) - S.H * S.back(0.12);
      g.ellipse(hx - 2, top + 1, 9, 6, (nx, ny) => (ny < -0.5 ? hex("#b8e8f0") : hex("#6aa8b8")), 0.35, 7);
      for (const dx of [-5, 0]) { g.ellipse(hx + dx - 1, top - 1, 2.2, 3, (nx, ny) => (ny < -0.4 ? E[3] : E[2]), 1, 7); g.set(hx + dx - 1, top - 3.5, E[4], 1, 7); }
      g.set(S.xOf(0.02), S.wave(0) - 1, hex("#0a0a0a")); g.set(S.xOf(0.06), S.wave(0) - 1.5, hex("#0a0a0a"));
    },
    outline: "#060a0a", lit: "#324444",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1.5, Math.sin(ph * 0.5) * 1);
  p.glow(-10 + Math.sin(ph) * 1.5, -8, 10, E[2], 0.2);
  if (o.scene !== false) snow(p, t, D, 72, 44);
}
