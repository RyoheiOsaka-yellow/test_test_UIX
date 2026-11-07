import { fit, TAU, hex, Grid, rand, lnoise, ease } from "../../core/index.js";
import { drawFish } from "../giants/_body.js";
import { snow, photophores, lure } from "./_lib.js";
import { shift, bubbles } from "../_lib.js";

export const meta = {
  name: "Fangtooth",
  ja: "オニキンメ",
  sci: "Anoplogaster cornuta",
  region: "Deep oceans worldwide, 500–2000 m",
  length: "16 cm",
  desc: "The biggest teeth of any fish for its size: fangs so long the lower pair slide into sockets beside its brain when it shuts its mouth. A stubby black fish with armour-plated skin, it hunts by blundering into whatever it touches in the dark.",
  jadesc: "体の大きさの割に魚でいちばん大きな歯。下顎の牙は長すぎて、口を閉じると脳の横の穴に収まる。鎧のような皮膚のずんぐりした黒い魚で、暗闇で触れたものに食らいつく。",
  tags: ["deepsea", "fangs", "black", "worldwide", "loop"],
  size: [64,44],
  origin: [30,22],
  duration: 3.8,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    palette: ["#0a0a0c", "#1c1a1e", "#302c32", "#484248", "#625c62"],
    seed: 1,
  },
};
const D = meta.duration, G = new Grid(-30, -22, 64, 44);

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 5), g = G.clear(), ph = (t / D) * TAU;
  drawFish(g, {
    L: 32, H: 10, peak: 0.3, nose: 0.8, stock: 0.2,
    skin: (u, v, x, y) => (rand(Math.round(x / 2), Math.round(y / 2), 101) < 0.2 ? ["#1c1a1e", "#302c32", "#484248", "#625c62", "#7a747a"] : C),
    tail: { kind: "fork", span: 7, len: 6 },
    dorsal: [{ u: 0.6, h: 5, w: 10, kind: "ridge" }],
    pectoral: { u: 0.4, len: 7, w: 3, angle: 0.4, v: 0.4, flap: 0.3 },
    anal: { u: 0.75, h: 4, w: 6 },
    eye: { u: 0.15, v: -0.3, r: 1.2, ring: "#484248" },
    mouth: { len: 12, open: 0.5, v: 0.1, drop: 2.5 }, mouthCol: "#1a0810",
    swim: { kind: "fish", amp: 0.5 },
    finSkin: () => C,
    extra: (g, t, S) => { const x0 = S.xOf(0), y0 = S.wave(0); for (const [dx, dy, L] of [[-2, 0, 6], [-5, -0.5, 4], [-1, 5, 7], [-4, 5, 5]]) g.line(x0 + dx, y0 + dy, x0 + dx + 0.5, y0 + dy + (dy < 2 ? L : -L), hex("#ffffff")); },
    outline: "#040404", lit: "#302c32",
  }, t, D, o.seed);
  g.draw(p, 1, Math.sin(ph) * 1.5, Math.sin(ph * 0.5) * 1);
  if (o.scene !== false) snow(p, t, D, 64, 44);
}
