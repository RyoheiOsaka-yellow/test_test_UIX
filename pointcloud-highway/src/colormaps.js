import * as THREE from 'three';
import { CLS_INFO } from './synth.js';

// polynomial fits (Matt Zucker / Google turbo)
const POLY = {
  viridis: [[0.2777273272234177, 0.005407344544966578, 0.3340998053353061], [0.1050930431085774, 1.404613529898575, 1.384590162594685], [-0.3308618287255563, 0.214847559468213, 0.09509516302823659], [-4.634230498983486, -5.799100973351585, -19.33244095627987], [6.228269936347081, 14.17993336680509, 56.69055260068105], [4.776384997670288, -13.74514537774601, -65.35303263337234], [-5.435455855934631, 4.645852612178535, 26.3124352495832]],
  magma: [[-0.002136485053939582, -0.000749655052795221, -0.005386127855323933], [0.2516605407371642, 0.6775232436837668, 2.494026599312351], [8.353717279216625, -3.577719514958484, 0.3144679030132573], [-27.66873308576866, 14.26473078096533, -13.68921318265125], [52.17613981234068, -27.94360607168351, 12.94416944238394], [-50.76852536473588, 29.04658282127291, 4.23415299384598], [18.65570506591883, -11.48977351997711, -5.601961508734096]],
  inferno: [[0.0002189403691192265, 0.001651004631001012, -0.01948089843709184], [0.1065134194856116, 0.5639564367884091, 3.932712388889277], [11.60249308247187, -3.972853965665698, -15.9423941062914], [-41.70399613139459, 17.43639888205313, 44.35414519872813], [77.162935699427, -33.40235894210092, -81.80730925738993], [-71.31942824499214, 32.62606426397723, 73.20951985803202], [25.13112622477341, -12.24266895238567, -23.07032500287172]],
  plasma: [[0.05873234392399702, 0.02333670892565775, 0.5433401826748754], [2.176514634195958, 0.2383834171260182, 0.7539604599784036], [-2.689460476458034, -7.455851135738909, 3.110799939717086], [6.130348345893603, 42.3461881477227, -28.51885465332158], [-11.10743619062271, -82.66631109428045, 60.13984767418263], [10.02306557647065, 71.41361770095349, -54.07218655560067], [-3.658713842777788, -22.93153465461149, 18.19190778539828]],
};
function poly(name, t) {
  const c = POLY[name];
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    let v = 0, p = 1;
    for (let i = 0; i < c.length; i++) { v += c[i][k] * p; p *= t; }
    out[k] = Math.min(1, Math.max(0, v));
  }
  return out;
}
function turbo(x) {
  const r = 0.13572138 + 4.6153926 * x - 42.66032258 * x ** 2 + 132.13108234 * x ** 3 - 152.94239396 * x ** 4 + 59.28637943 * x ** 5;
  const g = 0.09140261 + 2.19418839 * x + 4.84296658 * x ** 2 - 14.18503333 * x ** 3 + 4.27729857 * x ** 4 + 2.82956604 * x ** 5;
  const b = 0.1066733 + 12.64194608 * x - 60.58204836 * x ** 2 + 110.36276771 * x ** 3 - 89.90310912 * x ** 4 + 27.34824973 * x ** 5;
  return [r, g, b].map((v) => Math.min(1, Math.max(0, v)));
}
function deviation(t) {
  // blue (-) → cyan → green (0) → yellow → red (+)
  const stops = [[0.1, 0.3, 1.0], [0.2, 0.85, 1.0], [0.25, 0.9, 0.35], [1.0, 0.9, 0.2], [1.0, 0.2, 0.15]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * u);
}
const REALISTIC = { 2: 0x6b6355, 3: 0x4f7a3a, 5: 0x3e7d3b, 6: 0xb9ad9d, 26: 0x8b8f93, 9: 0x1f3f66, 11: 0x4a4a4f, 17: 0x55555c, 20: 0xf4f1dc, 21: 0xb8b9b4, 23: 0x7d8b99, 22: 0xa8a6a0, 27: 0xa8a6a0, 24: 0xc84848, 25: 0xbdbdbd, 29: 0xd0d0d0, 18: 0x404040, 1: 0x777777 };

/** Reference-look colormap: purple pavement → cyan structures/buildings → yellow markings. No green band. */
function lidar(t) {
  const stops = [[0.11, 0.02, 0.22], [0.36, 0.08, 0.58], [0.58, 0.22, 0.86], [0.3, 0.58, 0.96], [0.16, 0.84, 0.9], [0.4, 0.97, 0.84], [0.93, 0.95, 0.45], [1.0, 1.0, 0.75]];
  const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), u = f - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * u);
}
export const LUT_ROWS = 16;
export const ROWS = { lidar: 0, viridis: 1, magma: 2, inferno: 3, plasma: 4, turbo: 5, realistic: 6, deviation: 7, classes: 8 };

export function buildLut() {
  const W = 256, H = LUT_ROWS;
  const data = new Uint8Array(W * H * 4);
  const put = (row, i, rgb) => { const k = (row * W + i) * 4; data[k] = rgb[0] * 255; data[k + 1] = rgb[1] * 255; data[k + 2] = rgb[2] * 255; data[k + 3] = 255; };
  const clsColor = new Map(CLS_INFO.map(([c, , hex]) => [c, hex]));
  for (let i = 0; i < W; i++) {
    const t = i / (W - 1);
    put(ROWS.lidar, i, lidar(t)); put(ROWS.viridis, i, poly('viridis', t)); put(ROWS.magma, i, poly('magma', t)); put(ROWS.inferno, i, poly('inferno', t)); put(ROWS.plasma, i, poly('plasma', t)); put(ROWS.turbo, i, turbo(t));
    const cls = Math.floor(i / 8);
    const hexR = REALISTIC[cls] ?? 0x777777, hexC = clsColor.get(cls) ?? 0x777777;
    put(ROWS.realistic, i, [(hexR >> 16) / 255, ((hexR >> 8) & 255) / 255, (hexR & 255) / 255]);
    put(ROWS.deviation, i, deviation(t));
    put(ROWS.classes, i, [(hexC >> 16) / 255, ((hexC >> 8) & 255) / 255, (hexC & 255) / 255]);
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** CSS gradient string for the legend bar. */
export function cssGradient(row) {
  const fn = row === 'turbo' ? turbo : row === 'deviation' ? deviation : row === 'lidar' ? lidar : (t) => poly(row, t);
  const stops = [];
  for (let i = 0; i <= 10; i++) { const [r, g, b] = fn(i / 10); stops.push(`rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0}) ${i * 10}%`); }
  return `linear-gradient(90deg, ${stops.join(',')})`;
}
