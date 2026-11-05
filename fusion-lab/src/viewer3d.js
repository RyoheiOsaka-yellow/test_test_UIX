/* ANGLEX FUSION — 概念 3D ビューア
   合成結果（規模・寸法・技術の割当）から部品構成をパラメトリックに組み立てる。
   グローバル T / FAC（part3_data.js）を参照し、globalThis.FX3D を公開する。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

/* global T, FAC */
const ROLE_VAR = { 材料:'--r-material', 成形:'--r-form', 加工:'--r-machining', 接合:'--r-join', 表面:'--r-surface', 機能:'--r-func', 計測:'--r-measure', 組立:'--r-assembly' };
const ROLE_WORK = { 材料:'素材と基本特性を決める', 成形:'主要形状を一度につくる', 加工:'精度が必要な部位を仕上げる', 接合:'部品・異材をつなぐ', 表面:'機能・意匠・耐久を表面で与える', 機能:'電気・制御・センシングを担う', 計測:'品質を測り個体ごとに記録する', 組立:'製品として組み上げる' };
const COAT = ['研磨','鏡面','アルマイト','めっき','DLC','抗菌','親水','撥水','溶射','肉盛','耐摩耗','低摩擦','防曇'];
const ANOD_PAL = [0xb34a2a, 0x3d5a80, 0x3e6b4a, 0x6b5b95, 0xb8862a, 0x2a7d8c];
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let ANOD = 0x3d5a80;

const cssv = n => (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim() || '#888888';
const tcol = n => new THREE.Color().setStyle(cssv(n));
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]));
const short = (s, n = 15) => { const x = String(s).replace(/（.*?）/g, ''); return x.length > n ? x.slice(0, n - 1) + '…' : x; };
function hs(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- 形状ヘルパ ---------- */
function rrShape(w, h, r) {
  const s = new THREE.Shape(); r = Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function circ(x, y, r) { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, false); return p; }
function circShape(r) { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s; }
function slabY(shape, thick, bevel = 0, seg = 32) { // y=0..thick に押し出し
  const b = Math.min(bevel, thick * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick - 2 * b, 1e-4), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.85, bevelSegments: 3, curveSegments: seg });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return g;
}
function slabZ(shape, thick, bevel = 0, seg = 32) { // z=-t/2..t/2 に押し出し
  const b = Math.min(bevel, thick * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick - 2 * b, 1e-4), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.85, bevelSegments: 3, curveSegments: seg });
  g.translate(0, 0, -(thick - 2 * b) / 2); return g;
}
function rbox(w, h, d, r, seg = 4) { r = Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)); return new RoundedBoxGeometry(w, h, d, seg, r); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 32) => new THREE.CylinderGeometry(r1, r2, h, s);
function M(geo, mat, p = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(p.x || 0, p.y || 0, p.z || 0);
  if (p.rx) m.rotation.x = p.rx; if (p.ry) m.rotation.y = p.ry; if (p.rz) m.rotation.z = p.rz;
  if (p.sx) m.scale.set(p.sx, p.sy || p.sx, p.sz || p.sx);
  m.castShadow = p.cast !== false && !(mat.transmission > 0.5); m.receiveShadow = true;
  if (p.noHL) m.userData.noHL = true; return m;
}

/* ---------- テクスチャ ---------- */
function texCanvas(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const carbonTex = () => texCanvas(128, 128, (g, W) => {
  g.fillStyle = '#1c1d20'; g.fillRect(0, 0, W, W); const n = 8, c = W / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = (i + j) % 2; const gr = v ? g.createLinearGradient(i * c, 0, i * c + c, 0) : g.createLinearGradient(0, j * c, 0, j * c + c);
    gr.addColorStop(0, '#2e3034'); gr.addColorStop(0.5, '#4a4d53'); gr.addColorStop(1, '#25272a'); g.fillStyle = gr; g.fillRect(i * c + 1, j * c + 1, c - 2, c - 2);
  }
}, [5, 5]);
const fabricTex = () => texCanvas(128, 128, (g, W) => {
  g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, W, W); g.strokeStyle = 'rgba(120,110,90,0.18)'; g.lineWidth = 1;
  for (let i = 0; i < W; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, W); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
}, [10, 10]);
const dispTex = code => texCanvas(512, 288, (g, W, H) => {
  g.fillStyle = '#0e0f0c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(184,166,122,0.18)'; for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.fillStyle = '#c9b88a'; g.font = '600 30px "JetBrains Mono", monospace'; g.fillText(code, 28, 52);
  g.fillStyle = '#8fd4a0'; g.font = '500 22px "JetBrains Mono", monospace'; g.fillText('● READY', W - 150, 52);
  const R = rng(hs(code)); g.fillStyle = '#8fd4a0';
  for (let i = 0; i < 14; i++) { const bh = 30 + R() * 120; g.globalAlpha = 0.55 + 0.45 * R(); g.fillRect(28 + i * 32, H - 40 - bh, 20, bh); }
  g.globalAlpha = 1; g.fillStyle = '#ece8dc'; g.font = '400 16px "JetBrains Mono", monospace'; g.fillText('THROUGHPUT  ·  YIELD 99.2%', 28, H - 14);
});
function engrTex(code, ar, dark) {
  const W = 1024, H = Math.max(256, Math.round(1024 * ar));
  return texCanvas(W, H, g => {
    const ink = dark ? 'rgba(22,22,20,0.95)' : 'rgba(246,243,236,0.96)';
    g.clearRect(0, 0, W, H); g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 4; roundRect(g, 18, 18, W - 36, H - 36, 36); g.stroke();
    g.lineWidth = 1.2; g.globalAlpha = 0.45;
    for (let k = 0; k < 16; k++) {
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.02) {
        const f = 0.62 + 0.38 * Math.cos(7 * a + k * 0.2);
        const x = W / 2 + W * 0.44 * f * Math.cos(a), y = H / 2 + H * 0.4 * f * Math.sin(a);
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(H * 0.24)}px "IBM Plex Sans JP", sans-serif`; g.fillText(code, W / 2, H * 0.5);
    g.font = `500 ${Math.round(H * 0.075)}px "JetBrains Mono", monospace`; g.fillText('A N G L E X   F U S I O N', W / 2, H * 0.2);
    g.fillText('No. 001 / 500', W / 2, H * 0.8);
  });
}
function bandTex(code) {
  return texCanvas(2048, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(22,22,20,0.9)'; g.fillStyle = 'rgba(22,22,20,0.92)'; g.lineWidth = 2;
    for (const y of [20, 236]) { g.beginPath(); for (let x = 0; x <= W; x += 4) { const yy = y + 8 * Math.sin(x / 18); x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); }
    g.font = '600 64px "IBM Plex Sans JP", sans-serif'; g.textBaseline = 'middle';
    const txt = `${code}  ·  ANGLEX FUSION  ·  No.001/500  ·  `, tw = g.measureText(txt).width, n = Math.max(1, Math.round(W / tw)); g.save(); g.scale(W / (n * tw), 1); for (let i = 0; i < n; i++) g.fillText(txt, i * tw, H / 2); g.restore();
  });
}
function qrTex(seed) {
  const N = 21, q = 2, S = 10, R = rng(seed);
  return texCanvas((N + 2 * q) * S, (N + 2 * q) * S, (g, W) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, W); g.fillStyle = '#111111';
    const finder = (cx, cy) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const e = i === 0 || j === 0 || i === 6 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4); if (e) g.fillRect((cx + i + q) * S, (cy + j + q) * S, S, S); } };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const inF = (i < 8 && j < 8) || (i > N - 9 && j < 8) || (i < 8 && j > N - 9); if (!inF && R() > 0.52) g.fillRect((i + q) * S, (j + q) * S, S, S); }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  });
}

/* ---------- 材質 ---------- */
const std = o => new THREE.MeshStandardMaterial(o), phy = o => new THREE.MeshPhysicalMaterial(o);
const MAT = {
  steel: mirror => std({ color: 0xc4c7cb, metalness: 1, roughness: mirror ? 0.07 : 0.3 }),
  alu: () => std({ color: 0xc9cdd2, metalness: 0.85, roughness: 0.36 }),
  anod: c => std({ color: c, metalness: 0.6, roughness: 0.32 }),
  ti: () => std({ color: 0x93918b, metalness: 0.85, roughness: 0.38 }),
  iron: () => std({ color: 0x5c6066, metalness: 0.6, roughness: 0.55 }),
  brass: mirror => std({ color: 0xcaa064, metalness: 1, roughness: mirror ? 0.1 : 0.3 }),
  gold: () => std({ color: 0xd8b25a, metalness: 1, roughness: 0.22 }),
  chrome: () => std({ color: 0xeeeeee, metalness: 1, roughness: 0.05 }),
  resin: (c = 0xdcd8ce) => std({ color: c, metalness: 0, roughness: 0.55 }),
  resinDark: () => std({ color: 0x2f3236, metalness: 0, roughness: 0.5 }),
  peek: () => std({ color: 0xbca677, metalness: 0, roughness: 0.48 }),
  silicone: (c = 0xeee4d2) => phy({ color: c, metalness: 0, roughness: 0.48, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), transmission: 0.12, thickness: 0.4 }),
  rubber: () => std({ color: 0x262626, metalness: 0, roughness: 0.88 }),
  ceramic: () => phy({ color: 0xf4f1ea, metalness: 0, roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
  glass: (tint = 0xe2eff3) => phy({ color: tint, metalness: 0, roughness: 0.04, transmission: 0.94, thickness: 0.12, ior: 1.5, transparent: true }),
  carbon: () => phy({ color: 0xffffff, map: carbonTex(), metalness: 0.2, roughness: 0.36, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
  fabric: () => std({ color: 0xf3efe4, map: fabricTex(), metalness: 0, roughness: 0.92, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  pcb: () => std({ color: 0x1d5c38, metalness: 0.1, roughness: 0.5 }),
  chip: () => std({ color: 0x18191b, metalness: 0.2, roughness: 0.4 }),
  dark: () => std({ color: 0x2c2e32, metalness: 0.45, roughness: 0.55 }),
  wood: () => std({ color: 0x5a3d2a, metalness: 0, roughness: 0.62 }),
  concrete: () => std({ color: 0x9c9a92, metalness: 0, roughness: 0.95 }),
  paint: (c = 0xd8d2c2) => std({ color: c, metalness: 0.15, roughness: 0.5 }),
  led: c => std({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.3 }),
};
function matByName(x, has) {
  const mirror = has('鏡面', '研磨'), is = (...k) => k.some(y => x.includes(y));
  if (is('CFRP', 'GFRP', 'CFRTP', 'GFRTP')) return MAT.carbon();
  if (is('ガラス', '石英', 'PMMA', 'COP')) return MAT.glass();
  if (is('LSR', 'HTV', 'シリコーン', 'TPE', 'TPU', 'PDMS')) return MAT.silicone();
  if (is('EPDM', 'FKM', 'FFKM', 'EVA', 'ゲル') || x === 'NR' || x === 'PU') return MAT.rubber();
  if (is('Al2O3', 'ZrO2', 'SiC', 'YAG', 'PZT', '圧電', 'セラミック', 'コバール')) return MAT.ceramic();
  if (is('FR-4', 'フレキ') || x === 'PI') return MAT.pcb();
  if (is('PET', 'PVC', 'PTFE')) return MAT.fabric();
  if (is('PEEK', 'PPS', 'PEI')) return MAT.peek();
  if (is('銅', '真鍮')) return MAT.brass(mirror);
  if (x === 'TI') return MAT.ti();
  if (x === 'AL') return has('アルマイト') ? MAT.anod(ANOD) : MAT.alu();
  if (is('SUS', '工具鋼', '超硬', 'インコネル')) return MAT.steel(mirror);
  if (is('鉄', '鋳鉄')) return MAT.iron();
  if (x === 'Si') return std({ color: 0x5d6470, metalness: 0.6, roughness: 0.25 });
  if (is('PP', 'PC', 'POM', 'PA', 'ABS', 'PBT', '樹脂')) return MAT.resin();
  if (is('モジュール')) return MAT.pcb();
  return null;
}
function matOf(t, fb) {
  if (!t) return fb ? fb() : MAT.resin();
  const L = (t.mat || []).filter(x => x !== '*'), has = (...k) => k.some(x => (t.tags || []).includes(x));
  if (has('光学', '透明', 'レンズ', '導光')) return MAT.glass();
  for (const x of L) { const m = matByName(x, has); if (m) return m; }
  return fb ? fb() : MAT.resin();
}
function coat(baseFn, t) {
  if (!t) return baseFn();
  const has = (...k) => k.some(x => t.tags.includes(x));
  if (has('アルマイト')) return MAT.anod(ANOD);
  if (has('樹脂めっき')) return MAT.chrome();
  if (has('めっき', '接点')) return MAT.gold();
  if (has('DLC', '低摩擦')) return std({ color: 0x2a2b2f, metalness: 0.75, roughness: 0.18 });
  if (has('鏡面', '研磨')) { const b = baseFn(); return b.metalness > 0.5 ? MAT.steel(true) : Object.assign(b, { roughness: 0.08 }); }
  if (has('溶射', '肉盛')) return std({ color: 0x8d8a84, metalness: 0.3, roughness: 0.9 });
  if (has('光学', '薄膜', '反射防止')) return MAT.glass(0xd8e8f5);
  if (has('抗菌', '親水', '防曇', '撥水', '耐候', '防水', '難燃')) { const b = baseFn(); return phy({ color: b.color, map: b.map || null, metalness: b.metalness, roughness: Math.max(0.1, b.roughness * 0.6), clearcoat: 1, clearcoatRoughness: 0.06 }); }
  if (has('シボ', 'テクスチャ', '無塗装')) { const b = baseFn(); b.roughness = 0.85; return b; }
  if (has('刻印', 'マーキング', 'エンボス', '意匠')) return baseFn();
  return matOf(t, baseFn);
}
function partMat(ts, fb) {
  const shape = ts.find(t => !['表面', '計測', '組立'].includes(t.role)) || null;
  const surf = ts.find(t => t.role === '表面') || null;
  return coat(() => matOf(shape, fb), surf);
}

/* ---------- 技術 → 部位の割当 ---------- */
function assign(slots, techs) {
  const A = {}; slots.forEach(s => { A[s.key] = []; s._n = 0; });
  for (const t of techs) {
    let best = null, bs = -Infinity;
    for (const s of slots) {
      const i = s.roles.indexOf(t.role); if (i < 0) continue;
      const tag = !!(s.tags && s.tags.some(x => t.tags.includes(x)));
      const v = 10 + (tag ? 4 : 0) + (s._n ? 0 : 2) + (1 - i / s.roles.length) - (s.need && !tag ? 20 : 0);
      if (v > bs) { bs = v; best = s; }
    }
    if (!best || bs < 0) best = slots[0];
    A[best.into || best.key].push(t); best._n++;
  }
  return A;
}

/* ---------- 部位 ---------- */
function partFactory(root) {
  const parts = [];
  const P = (key, name, techs, ex = [0, 0, 0]) => {
    const g = new THREE.Group(); g.name = key;
    g.userData = { isPart: true, key, name, techs: techs || [], explode: new THREE.Vector3(...ex), base: new THREE.Vector3() };
    root.add(g); parts.push(g); return g;
  };
  return { parts, P };
}
function envelope(w, h, d) {
  const g = new THREE.Group();
  const ls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.02, h * 1.02, d * 1.02)), new THREE.LineDashedMaterial({ color: tcol('--r-measure'), dashSize: 0.05, gapSize: 0.035 }));
  ls.computeLineDistances(); ls.position.y = h / 2; ls.userData.themeVar = '--r-measure'; g.add(ls);
  const s = Math.min(w, h, d) * 0.035;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) g.add(M(new THREE.OctahedronGeometry(s), MAT.led(0xc8936a), { x: x * 1.02, y: 0, z: z * 1.02, cast: false }));
  return g;
}
function boardInto(p, x0, y0, z0, bw, bd, bt, techs) {
  const tags = new Set(techs.flatMap(t => t.tags)); const chip = MAT.chip(), gold = MAT.gold();
  p.add(M(box(bw, bt, bd), MAT.pcb(), { x: x0, y: y0 + bt / 2, z: z0 }));
  const top = y0 + bt;
  p.add(M(box(bw * 0.26, bt * 0.9, bd * 0.32), chip, { x: x0 - bw * 0.14, y: top + bt * 0.45, z: z0 - bd * 0.08 }));
  for (let i = 0; i < 5; i++) p.add(M(box(bw * 0.06, bt * 0.5, bd * 0.07), chip, { x: x0 + bw * (0.06 + 0.075 * i), y: top + bt * 0.25, z: z0 + bd * 0.3 }));
  for (let i = 0; i < 8; i++) p.add(M(box(bw * 0.03, bt * 0.15, bd * 0.02), gold, { x: x0 - bw * 0.42 + i * bw * 0.035, y: top + 0.0005, z: z0 - bd * 0.42, cast: false }));
  if (tags.has('無線') || tags.has('通信')) for (let i = 0; i < 5; i++) p.add(M(box(bw * 0.012, bt * 0.15, bd * 0.18), gold, { x: x0 + bw * 0.3 + i * bw * 0.025, y: top + 0.0005, z: z0 - bd * 0.22, cast: false }));
  if (tags.has('センサ') || tags.has('計測')) p.add(M(cyl(bd * 0.08, bd * 0.08, bt * 1.6), MAT.steel(false), { x: x0 + bw * 0.22, y: top + bt * 0.8, z: z0 - bd * 0.12 }));
  if (tags.has('圧電') || tags.has('振動')) p.add(M(cyl(bd * 0.14, bd * 0.14, bt * 0.6, 40), MAT.ceramic(), { x: x0 + bw * 0.22, y: top + bt * 0.3, z: z0 + bd * 0.05 }));
  if (tags.has('発電') || tags.has('電池レス')) p.add(M(box(bw * 0.3, bt * 0.4, bd * 0.26), std({ color: 0x1d2b4a, metalness: 0.5, roughness: 0.2 }), { x: x0 + bw * 0.25, y: top + bt * 0.2, z: z0 - bd * 0.12 }));
  if (tags.has('AI') || tags.has('カメラ') || tags.has('画像認識')) { p.add(M(box(bw * 0.12, bt * 1.2, bw * 0.12), chip, { x: x0 - bw * 0.36, y: top + bt * 0.6, z: z0 + bd * 0.22 })); p.add(M(cyl(bw * 0.035, bw * 0.035, bt * 0.8), MAT.glass(0x9fb7d0), { x: x0 - bw * 0.36, y: top + bt * 1.5, z: z0 + bd * 0.22 })); }
}
function chanInto(p, x0, y0, cw, cd, techs) {
  const tags = new Set(techs.flatMap(t => t.tags)); const m = Math.min(cw, cd);
  if (['流路', '深穴', 'MEMS', '微細'].some(x => tags.has(x))) {
    const r = m * 0.035, y = y0 + r, pts = [], n = 4;
    for (let i = 0; i < n; i++) { const z = -cd * 0.34 + (cd * 0.68 * i) / (n - 1); const a = i % 2 ? 1 : -1; pts.push(new THREE.Vector3(x0 + a * cw * 0.38, y, z), new THREE.Vector3(x0 - a * cw * 0.38, y, z)); }
    p.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 220, r, 12, false), phy({ color: 0x7fb6d6, roughness: 0.08, transmission: 0.55, thickness: 0.2, ior: 1.33 })));
    for (const q of [pts[0], pts[pts.length - 1]]) p.add(M(cyl(r * 1.8, r * 1.8, r * 3.2, 20), MAT.steel(false), { x: q.x, y: y + r, z: q.z }));
  }
  if (['圧電', '超音波', '振動'].some(x => tags.has(x))) {
    const R = m * 0.2, hh = m * 0.035, cx = x0 + cw * 0.18;
    p.add(M(cyl(R, R, hh, 48), MAT.ceramic(), { x: cx, y: y0 + hh / 2 }));
    p.add(M(cyl(R * 0.8, R * 0.8, hh * 0.2, 48), MAT.gold(), { x: cx, y: y0 + hh * 1.1 }));
  }
}
function gripperInto(p, o) { // o: {cx,cz,y0,yTop,m,mat,alu}
  const { cx, cz, y0, yTop, m, mat } = o; const al = MAT.alu();
  const colR = m * 0.045, boomH = m * 0.08, yB = yTop - boomH / 2;
  p.add(M(cyl(colR * 1.4, colR * 1.6, m * 0.05), MAT.dark(), { x: cx, y: y0 + m * 0.025, z: cz }));
  p.add(M(cyl(colR, colR, yB - y0), al, { x: cx, y: (y0 + yB) / 2, z: cz }));
  const L = Math.hypot(cx, cz) + m * 0.06, ang = Math.atan2(-cz, -cx);
  const boom = M(rbox(L, boomH, m * 0.09, m * 0.02), al, { x: cx + Math.cos(ang) * L / 2, y: yB, z: cz + Math.sin(ang) * L / 2 }); boom.rotation.y = -ang; p.add(boom);
  const yW = y0 + (yTop - y0) * 0.5;
  p.add(M(cyl(m * 0.035, m * 0.035, yB - yW), MAT.dark(), { x: 0, y: (yB + yW) / 2, z: 0 }));
  p.add(M(cyl(m * 0.09, m * 0.07, m * 0.04, 40), al, { x: 0, y: yW - m * 0.02, z: 0 }));
  const fl = (yW - m * 0.04) - (y0 + (yTop - y0) * 0.12), r0 = m * 0.055;
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), yS = yW - m * 0.04;
    const pts = [[r0, 0], [r0 * 1.9, fl * 0.35], [r0 * 1.7, fl * 0.72], [r0 * 0.7, fl]].map(([r, dy]) => new THREE.Vector3(r * ca, yS - dy, r * sa));
    const curve = new THREE.CatmullRomCurve3(pts);
    p.add(M(new THREE.TubeGeometry(curve, 40, m * 0.024, 14, false), mat));
    const e = pts[pts.length - 1]; p.add(M(new THREE.SphereGeometry(m * 0.024, 16, 12), mat, { x: e.x, y: e.y, z: e.z }));
    for (let i = 1; i < 4; i++) { const q = curve.getPoint(i / 4.4); p.add(M(new THREE.TorusGeometry(m * 0.026, m * 0.004, 8, 24), mat, { x: q.x, y: q.y, z: q.z, rx: Math.PI / 2 })); }
  }
}
function nozzleInto(p, o) { // ディスペンス・駆動ヘッド
  const { cx, cz, y0, yTop, m, mat } = o; const al = MAT.alu(), colR = m * 0.04, boomH = m * 0.07, yB = yTop - boomH / 2;
  p.add(M(cyl(colR * 1.5, colR * 1.7, m * 0.05), MAT.dark(), { x: cx, y: y0 + m * 0.025, z: cz }));
  p.add(M(cyl(colR, colR, yB - y0), al, { x: cx, y: (y0 + yB) / 2, z: cz }));
  const L = Math.hypot(cx, cz) + m * 0.06, ang = Math.atan2(-cz, -cx);
  const boom = M(rbox(L, boomH, m * 0.08, m * 0.02), al, { x: cx + Math.cos(ang) * L / 2, y: yB, z: cz + Math.sin(ang) * L / 2 }); boom.rotation.y = -ang; p.add(boom);
  const yH = y0 + (yTop - y0) * 0.45;
  p.add(M(rbox(m * 0.12, yB - yH, m * 0.12, m * 0.02), mat, { y: (yB + yH) / 2 }));
  p.add(M(cyl(m * 0.07, m * 0.07, m * 0.02, 40), MAT.ceramic(), { y: yH - m * 0.01 }));
  p.add(M(new THREE.ConeGeometry(m * 0.03, (yH - y0) * 0.5, 24), MAT.steel(true), { y: yH - m * 0.02 - (yH - y0) * 0.25, rx: Math.PI }));
  const pts = [new THREE.Vector3(m * 0.06, yB - m * 0.02, 0), new THREE.Vector3(m * 0.16, yB - m * 0.1, m * 0.05), new THREE.Vector3(m * 0.12, yH + m * 0.06, m * 0.07), new THREE.Vector3(m * 0.05, yH + m * 0.02, 0)];
  p.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, m * 0.012, 10, false), MAT.silicone(0xf3ece0)));
  p.add(M(new THREE.SphereGeometry(m * 0.012, 12, 10), MAT.led(0x5ad07a), { x: m * 0.065, y: yH + m * 0.04, z: m * 0.061, cast: false }));
}
function cameraInto(p, o) { // o:{x,z,y0,yTop,m,tx,tz}
  const { x, z, y0, yTop, m } = o; const dk = MAT.dark();
  p.add(M(cyl(m * 0.018, m * 0.018, yTop - y0 - m * 0.04), MAT.alu(), { x, y: (y0 + yTop - m * 0.04) / 2, z }));
  const hx = x * 0.82, hz = z * 0.82, yh = yTop - m * 0.045;
  const arm = M(box(Math.hypot(x - hx, z - hz) + m * 0.03, m * 0.025, m * 0.025), MAT.alu(), { x: (x + hx) / 2, y: yh, z: (z + hz) / 2 }); arm.rotation.y = -Math.atan2(hz - z, hx - x); p.add(arm);
  p.add(M(rbox(m * 0.11, m * 0.08, m * 0.11, m * 0.015), dk, { x: hx, y: yh, z: hz }));
  p.add(M(cyl(m * 0.032, m * 0.036, m * 0.04, 24), MAT.glass(0x9fb7d0), { x: hx, y: yh - m * 0.055, z: hz }));
  p.add(M(new THREE.SphereGeometry(m * 0.008, 10, 8), MAT.led(0x5ad07a), { x: hx + m * 0.04, y: yh + m * 0.02, z: hz + m * 0.056, cast: false }));
}

/* ---------- テンプレート: 部品・モジュール ---------- */
function buildComponent(ctx) {
  const { w, d, h, c } = ctx; const m = Math.min(w, d);
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'body', roles: ['成形', '材料', '加工', '表面'], tags: COAT },
    { key: 'cover', roles: ['表面', '成形', '材料'], tags: ['光学', '透明', '薄膜', '反射防止', '意匠', 'シボ', '樹脂めっき'] },
    { key: 'func', roles: ['機能'] },
    { key: 'chan', roles: ['加工', '成形', '機能'], tags: ['流路', '深穴', 'MEMS', '圧電', '超音波'], need: 1 },
    { key: 'join', roles: ['接合'] },
    { key: 'port', roles: ['接合', '機能', '組立', '成形'], tags: ['導通', 'インサート', '異材一体', '防水'], need: 1 },
    { key: 'asm', roles: ['組立', '接合'] },
    { key: 'meas', roles: ['計測'] },
  ], ctx.techs);
  const fbBody = () => matOf({ mat: c.materials || [], tags: [] }, () => MAT.resin(0xe4e0d5));
  const hasPort = A.port.length > 0, hasJoin = A.join.length > 0;
  const portL = hasPort ? Math.min(w * 0.1, m * 0.2) : 0, wb = w - portL, xb = -portL / 2, mb = Math.min(wb, d);
  const hb = h * 0.46, hj = hasJoin ? h * 0.05 : 0, hc = h - hb - hj;
  const inset = mb * 0.12, hr = mb * 0.042, r0 = mb * 0.14;
  const holes = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (wb / 2 - inset), sz * (d / 2 - inset)]);
  const cw = wb - 2 * (inset + hr * 2.2), cd = d - 2 * (inset + hr * 2.2);
  { const p = P('body', '本体ベース', A.body); const sh = rrShape(wb, d, r0); holes.forEach(([x, z]) => sh.holes.push(circ(x, z, hr)));
    p.add(M(slabY(sh, hb, Math.min(hb * 0.1, mb * 0.03)), partMat(A.body, fbBody), { x: xb })); }
  const yT = hb;
  if (hasJoin) { const p = P('join', 'シール・接合層', A.join, [0, 0.25, 0]); const sh = rrShape(cw * 1.04, cd * 1.04, r0 * 0.8); sh.holes.push(rrShape(cw * 0.92, cd * 0.92, r0 * 0.6));
    const metal = A.join.some(t => ['溶接', '異材接合', '気密', '真空'].some(x => t.tags.includes(x))); p.add(M(slabY(sh, hj), metal ? MAT.steel(false) : partMat(A.join, MAT.rubber), { x: xb, y: yT })); }
  const yC = yT + hj;
  if (A.func.length) { const p = P('func', '機能基板', A.func, [0, 0.5, 0]); boardInto(p, xb, yC, 0, cw * 0.86, cd * 0.8, Math.min(hc * 0.1, mb * 0.025), A.func); }
  if (A.chan.length) { const p = P('chan', '流路・駆動層', A.chan, [0, 0.36, 0]); chanInto(p, xb, yC + Math.min(hc * 0.12, mb * 0.03), cw * 0.9, cd * 0.85, A.chan); }
  { const p = P('cover', 'トップカバー', A.cover, [0, 0.85, 0]);
    const inner = A.func.length || A.chan.length; const cm = A.cover.length ? partMat(A.cover, MAT.resin) : inner ? MAT.glass(0xe8f0f2) : MAT.resin(0xe9e6de);
    p.add(M(rbox(cw, hc, cd, Math.min(hc * 0.4, mb * 0.07)), cm, { x: xb, y: yC + hc / 2 })); }
  { const p = P('asm', '締結ねじ', A.asm, [0, 1.15, 0]); const sm = MAT.steel(false), dk = MAT.dark(), hh = Math.min(hc * 0.2, mb * 0.035);
    holes.forEach(([x, z]) => { p.add(M(cyl(hr * 1.6, hr * 1.6, hh, 28), sm, { x: xb + x, y: yT + hh / 2, z })); p.add(M(cyl(hr * 0.6, hr * 0.6, hh * 0.3, 6), dk, { x: xb + x, y: yT + hh * 0.9, z })); p.add(M(cyl(hr * 0.8, hr * 0.8, hb * 0.9, 16), sm, { x: xb + x, y: yT - hb * 0.45, z })); }); }
  if (hasPort) { const p = P('port', 'コネクタ', A.port, [0.4, 0, 0]); const pr = Math.min(hb * 0.32, d * 0.15), px = xb + wb / 2 + portL / 2;
    p.add(M(cyl(pr, pr, portL, 32), partMat(A.port, MAT.resinDark), { x: px, y: hb * 0.5, rz: Math.PI / 2 }));
    p.add(M(cyl(pr * 0.5, pr * 0.5, portL * 1.02, 24), MAT.gold(), { x: px, y: hb * 0.5, rz: Math.PI / 2 })); }
  if (A.meas.length) { const p = P('meas', '検査エンベロープ', A.meas); p.add(envelope(w, h, d)); }
  return { root, parts };
}

/* ---------- テンプレート: アーム（部品の派生） ---------- */
function buildArm(ctx) {
  const { w, d, h, c } = ctx;
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'body', roles: ['成形', '材料', '加工', '表面'], tags: COAT.concat(['ラティス', '金属AM', '軽量', '一体化', '複合材']) },
    { key: 'mount', roles: ['加工', '成形'], tags: ['高精度', '切削', '微細', '複雑形状', '放電'] },
    { key: 'design', roles: ['機能'], tags: ['設計', '最適化', 'CAE', '軽量化'], need: 1, into: 'body' },
    { key: 'func', roles: ['機能'] },
    { key: 'join', roles: ['接合', '組立'] },
    { key: 'asm', roles: ['組立'] },
    { key: 'meas', roles: ['計測'] },
  ], ctx.techs);
  const Rp = Math.min(d / 2, w * 0.3), xm = w / 2 - Rp, Rm = Rp * 0.4, clampL = w * 0.1, x0 = -w / 2 + clampL * 0.6;
  const hb = h * 0.16, wr = Math.min(d * 0.36, Rm * 2.2), wt = Rm * 1.15;
  { const p = P('body', 'アーム本体（ラティス）', A.body); const sh = new THREE.Shape();
    sh.moveTo(x0, -wr / 2); sh.lineTo(xm, -wt / 2); sh.lineTo(xm, wt / 2); sh.lineTo(x0, wr / 2); sh.lineTo(x0, -wr / 2);
    const n = 6; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (xm - Rm * 1.1 - x0) * t, wi = wr + (wt - wr) * ((x - x0) / (xm - x0)); sh.holes.push(circ(x, 0, wi * 0.28)); }
    p.add(M(slabY(sh, hb, hb * 0.12), partMat(A.body, () => matOf({ mat: c.materials || [], tags: [] }, MAT.ti)), {})); }
  const hm = hb * 1.25;
  { const p = P('mount', 'モータマウント', A.mount, [0.25, 0.25, 0]); const sh = circShape(Rm); sh.holes.push(circ(0, 0, Rm * 0.32)); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; sh.holes.push(circ(Math.cos(a) * Rm * 0.66, Math.sin(a) * Rm * 0.66, Rm * 0.08)); }
    p.add(M(slabY(sh, hm, hm * 0.1, 48), partMat(A.mount, () => MAT.alu()), { x: xm })); }
  const yMot = hm, motH = (h - hm) * 0.62;
  { const p = P('func', 'モータ・プロペラ', A.func, [0.25, 0.7, 0]); const dk = MAT.dark();
    p.add(M(cyl(Rm * 0.85, Rm * 0.85, motH * 0.55, 40), dk, { x: xm, y: yMot + motH * 0.275 }));
    p.add(M(cyl(Rm * 0.9, Rm * 0.88, motH * 0.4, 40), MAT.anod(ANOD), { x: xm, y: yMot + motH * 0.75 }));
    p.add(M(cyl(Rm * 0.12, Rm * 0.12, (h - yMot) - motH, 16), MAT.steel(false), { x: xm, y: yMot + motH + ((h - yMot) - motH) / 2 }));
    const yP = h - (h - yMot - motH) * 0.45, ph = Math.min((h - yMot - motH) * 0.35, Rp * 0.05);
    for (const s of [1, -1]) { const b = M(box(Rp * 0.92, ph, Rp * 0.14), MAT.carbon(), { x: xm + s * Rp * 0.5, y: yP }); b.rotation.x = s * 0.22; p.add(b); }
    p.add(M(cyl(Rm * 0.3, Rm * 0.3, ph * 2.4, 24), dk, { x: xm, y: yP })); }
  { const p = P('join', 'クランプ', A.join, [-0.35, 0, 0]); p.add(M(rbox(clampL, hb * 2.2, wr * 1.25, hb * 0.3), partMat(A.join, () => MAT.alu()), { x: -w / 2 + clampL / 2, y: hb * 1.1 })); }
  { const p = P('asm', '締結ボルト', A.asm, [0, 0.5, 0]); const sm = MAT.steel(false);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; p.add(M(cyl(Rm * 0.11, Rm * 0.11, hm * 0.25, 16), sm, { x: xm + Math.cos(a) * Rm * 0.66, y: hm + hm * 0.12, z: Math.sin(a) * Rm * 0.66 })); }
    for (const z of [-wr * 0.3, wr * 0.3]) p.add(M(cyl(hb * 0.25, hb * 0.25, hb * 0.3, 16), sm, { x: -w / 2 + clampL / 2, y: hb * 2.2 + hb * 0.15, z })); }
  if (A.meas.length) { const p = P('meas', '検査エンベロープ', A.meas); p.add(envelope(w, h, d)); }
  return { root, parts };
}

/* ---------- テンプレート: 装置・機器 ---------- */
function buildDevice(ctx) {
  const { w, d, h, c, tagsAll } = ctx; const m = Math.min(w, d);
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const grip = /ハンド|グリッパ|アーム|把持/.test(c.name) || ['把持', 'ソフトロボ'].some(x => tagsAll.has(x));
  const A = assign([
    { key: 'body', roles: ['成形', '加工', '材料', '表面'], tags: COAT },
    { key: 'lid', roles: ['表面', '成形'], tags: ['アルマイト', '意匠', 'シボ', '樹脂めっき', '鏡面', '研磨'] },
    { key: 'disp', roles: ['機能'], tags: ['AI', 'エッジ', '制御', 'PLC', 'IoT', 'ダッシュボード', '基板', '実装', 'モーション', 'クラウド'] },
    { key: 'eff', roles: ['機能', '成形', '材料'], tags: ['ソフトロボ', '把持', '柔軟', 'シリコーン', '導電ゴム', '圧電', '振動', '生体適合'], need: 1 },
    { key: 'meas', roles: ['計測', '機能'], tags: ['検査', '画像', 'カメラ', '画像認識', 'CT', 'センサ'] },
    { key: 'join', roles: ['接合'] },
    { key: 'asm', roles: ['組立'] },
  ], ctx.techs);
  const hasEff = grip || A.eff.length > 0, hasCam = A.meas.length > 0;
  const topEq = (hasEff || hasCam) ? h * 0.36 : h * 0.16;
  const H0 = h - topEq, fH = H0 * 0.035, bH = H0 * 0.07, lH = H0 * 0.06, yH = H0 - fH - bH - lH;
  { const p = P('asm', 'ベース・脚', A.asm); p.add(M(rbox(w, bH, d, bH * 0.3), partMat(A.asm, MAT.dark), { y: fH + bH / 2 }));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.add(M(cyl(m * 0.035, m * 0.04, fH, 20), MAT.rubber(), { x: sx * (w / 2 - m * 0.08), y: fH / 2, z: sz * (d / 2 - m * 0.08) })); }
  const y1 = fH + bH;
  { const p = P('body', '筐体', A.body); p.add(M(rbox(w * 0.96, yH, d * 0.94, m * 0.03), partMat(A.body, () => MAT.paint(0xe6e2d6)), { y: y1 + yH / 2 }));
    const dk = MAT.dark(); for (let i = 0; i < 7; i++) p.add(M(box(m * 0.006, yH * 0.035, d * 0.5), dk, { x: w * 0.48 + m * 0.002, y: y1 + yH * (0.22 + i * 0.075), cast: false })); }
  const y2 = y1 + yH;
  { const p = P('lid', '天板・外装', A.lid, [0, 0.32, 0]); p.add(M(rbox(w * 0.97, lH, d * 0.95, lH * 0.35), partMat(A.lid, () => MAT.anod(0x3a3d42)), { y: y2 + lH / 2 }));
    p.add(M(cyl(m * 0.022, m * 0.022, lH * 0.6, 20), MAT.led(0xd9704f), { x: w * 0.42, y: y2 + lH * 1.3, z: d * 0.4, cast: false })); }
  const y3 = y2 + lH;
  { const p = P('disp', '操作・制御パネル', A.disp, [0, 0, 0.5]); const pw = w * 0.5, ph = yH * 0.36, pz = d * 0.47, py = y1 + yH * 0.66;
    p.add(M(rbox(pw * 1.08, ph * 1.16, m * 0.02, m * 0.008), MAT.dark(), { y: py, z: pz + m * 0.01 }));
    const tx = dispTex(ctx.c.code); p.add(M(new THREE.PlaneGeometry(pw, ph), std({ color: 0x111111, map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.9, roughness: 0.25 }), { y: py, z: pz + m * 0.0205, noHL: true, cast: false }));
    for (let i = 0; i < 4; i++) p.add(M(cyl(m * 0.022, m * 0.022, m * 0.02, 24), i === 0 ? MAT.led(0x5ad07a) : MAT.dark(), { x: -pw * 0.3 + i * pw * 0.2, y: y1 + yH * 0.28, z: pz + m * 0.01, rx: Math.PI / 2 })); }
  if (hasEff) {
    const p = P('eff', grip ? 'エンドエフェクタ' : '駆動・ディスペンスヘッド', A.eff, [0, 0.75, 0]);
    (grip ? gripperInto : nozzleInto)(p, { cx: -w * 0.33, cz: -d * 0.28, y0: y3, yTop: h, m, mat: partMat(A.eff, grip ? MAT.silicone : MAT.alu) });
    const q = P('work', grip ? 'ワークトレー' : 'ワークステージ', [], [0, 0.18, 0]);
    q.add(M(rbox(w * 0.4, topEq * 0.07, d * 0.42, topEq * 0.02), MAT.steel(true), { y: y3 + topEq * 0.035, x: w * 0.04 }));
    const foods = [0xd9a05b, 0x9cbf5a, 0xc0543a, 0xe8d3a0];
    if (grip) for (let i = 0; i < 4; i++) q.add(M(new THREE.SphereGeometry(m * 0.05, 20, 14), std({ color: foods[i], roughness: 0.75 }), { x: w * 0.04 + (i % 2 ? 1 : -1) * w * 0.09, y: y3 + topEq * 0.07 + m * 0.025, z: (i < 2 ? -1 : 1) * d * 0.09, sx: 1.2, sy: 0.55, sz: 0.9 }));
  } else if (!hasCam) {
    const q = P('mods', '機能モジュール', [], [0, 0.45, 0]); const fy = y3 + topEq * 0.08;
    q.add(M(rbox(w * 0.72, topEq * 0.08, d * 0.62, topEq * 0.02), MAT.alu(), { y: y3 + topEq * 0.04 }));
    [[-0.22, 0xd8d2c2], [0, 0x2f3236], [0.22, ANOD]].forEach(([x, col]) => q.add(M(rbox(w * 0.18, topEq * 0.7, d * 0.4, m * 0.015), std({ color: col, roughness: 0.45, metalness: col === ANOD ? 0.6 : 0.1 }), { x: w * x, y: fy + topEq * 0.35 })));
  }
  if (hasCam) { const p = P('meas', '計測カメラ', A.meas, [0.3, 0.55, 0]); cameraInto(p, { x: w * 0.38, z: -d * 0.34, y0: y3, yTop: h, m }); }
  if (A.join.length) { const p = P('join', '溶接・接合部', A.join, [0.4, 0, 0]); const jm = partMat(A.join, () => MAT.steel(false));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.add(M(cyl(m * 0.012, m * 0.012, yH, 12), jm, { x: sx * w * 0.475, y: y1 + yH / 2, z: sz * d * 0.465 })); }
  return { root, parts };
}

/* ---------- テンプレート: 大型（膜構造） ---------- */
function buildCanopy(ctx) {
  const { w, d, h } = ctx; const m = Math.min(w, d);
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'frame', roles: ['材料', '成形', '加工', '表面'], tags: COAT.concat(['複合材', '軽量', '高剛性', '大型', '構造']) },
    { key: 'memb', roles: ['表面', '材料', '成形'], tags: ['耐候', '防水', '難燃', '織物', 'メッシュ', '通気'] },
    { key: 'join', roles: ['接合'] },
    { key: 'sens', roles: ['機能', '計測'], tags: ['センサ', '計測', '振動'] },
    { key: 'gw', roles: ['機能'], tags: ['IoT', 'クラウド', 'ダッシュボード', '予知保全', '無線', '低電力', '発電'] },
    { key: 'asm', roles: ['組立'] },
    { key: 'meas', roles: ['計測'] },
  ], ctx.techs);
  const cr = m * 0.022, hc = h * 0.58, rise = h - hc - cr * 2.2;
  const f = z => 0.86 + 0.14 * (1 - (z / (d / 2)) ** 2);
  const my = (x, z) => hc + rise * (1 - (x / (w / 2)) ** 2) * f(z);
  const xs = [-(w / 2 - cr), w / 2 - cr], zs = [-(d / 2 - cr), 0, d / 2 - cr];
  { const p = P('frame', '骨格フレーム', A.frame); const fm = partMat(A.frame, () => MAT.paint(0xdedad0));
    for (const x of xs) for (const z of zs) p.add(M(cyl(cr, cr, hc, 20), fm, { x, y: hc / 2, z }));
    for (const x of xs) p.add(M(box(cr * 1.6, cr * 2, d - 2 * cr), fm, { x, y: hc - cr, z: 0 }));
    for (const z of zs) { const pts = []; for (let i = 0; i <= 24; i++) { const x = -w / 2 + cr + (w - 2 * cr) * i / 24; pts.push(new THREE.Vector3(x, my(x, z) - cr * 0.3, z)); } p.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, cr * 0.9, 12, false), fm)); } }
  { const p = P('memb', '膜屋根', A.memb, [0, 0.55, 0]); const g = new THREE.PlaneGeometry(w, d, 64, 32); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, my(x, z) + cr * 0.9); } g.computeVertexNormals();
    const mm = MAT.fabric(); if (A.memb.some(t => t.mat.some(x => /CFRP|GFRP|SUS|AL/.test(x)))) mm.color.setHex(0xe6e2d6); p.add(M(g, mm)); }
  if (A.join.length) { const p = P('join', '溶着シーム', A.join, [0, 0.6, 0]); const jm = partMat(A.join, () => std({ color: 0xcabf9f, roughness: 0.8 }));
    for (let k = -2; k <= 2; k++) { const x = k * w * 0.18, pts = []; for (let i = 0; i <= 16; i++) { const z = -d / 2 + d * i / 16; pts.push(new THREE.Vector3(x, my(x, z) + cr * 1.05, z)); } p.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, m * 0.004, 6, false), jm)); } }
  if (A.sens.length) { const p = P('sens', '荷重・劣化センサ', A.sens, [0, 0.25, 0]); const sm = MAT.resinDark();
    for (const z of zs) { const y = my(0, z) - cr * 2.8; p.add(M(rbox(m * 0.05, m * 0.03, m * 0.05, m * 0.006), sm, { y, z })); p.add(M(new THREE.SphereGeometry(m * 0.007, 10, 8), MAT.led(0x5ad07a), { x: m * 0.026, y, z, cast: false })); }
    for (const x of xs) p.add(M(rbox(m * 0.03, m * 0.06, m * 0.03, m * 0.006), sm, { x: x - Math.sign(x) * cr * 1.6, y: hc * 0.7, z: 0 })); }
  if (A.gw.length) { const p = P('gw', 'IoT ゲートウェイ', A.gw, [0.3, 0, 0.25]); const gx = xs[1] - cr - m * 0.03, gz = zs[0] + cr + m * 0.06;
    p.add(M(rbox(m * 0.05, m * 0.12, m * 0.08, m * 0.008), MAT.resin(0xe8e4da), { x: gx, y: hc * 0.42, z: gz }));
    p.add(M(cyl(m * 0.004, m * 0.004, m * 0.1, 8), MAT.dark(), { x: gx, y: hc * 0.42 + m * 0.11, z: gz }));
    if (A.gw.concat(A.sens).some(t => t.tags.includes('発電') || t.tags.includes('電池レス'))) { const sp = M(box(m * 0.1, m * 0.006, m * 0.08), std({ color: 0x1d2b4a, metalness: 0.5, roughness: 0.2 }), { x: gx - m * 0.03, y: hc * 0.42 + m * 0.07, z: gz }); sp.rotation.z = 0.5; p.add(sp); } }
  { const p = P('asm', '基礎・アンカー', A.asm); const cm = MAT.concrete(), sm = MAT.steel(false);
    for (const x of xs) for (const z of zs) { p.add(M(box(m * 0.08, hc * 0.015, m * 0.08), sm, { x, y: hc * 0.0075, z })); p.add(M(box(m * 0.11, m * 0.06, m * 0.11), cm, { x: x - Math.sign(x) * m * 0.12, y: m * 0.03, z })); } }
  if (A.meas.length) { const p = P('meas', '検査エンベロープ', A.meas); p.add(envelope(w, h, d)); }
  return { root, parts };
}

/* ---------- テンプレート: 大型（門型自動化機） ---------- */
function buildGantry(ctx) {
  const { w, d, h, tagsAll } = ctx; const m = Math.min(w, d);
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'frame', roles: ['材料', '成形', '加工', '表面'], tags: COAT.concat(['大型', 'フレーム', '厚板', '構造', '複合材']) },
    { key: 'table', roles: ['成形', '加工', '表面', '材料'] },
    { key: 'carr', roles: ['機能', '組立'], tags: ['制御', 'モーション', '搬送', 'AGV'] },
    { key: 'eff', roles: ['機能', '成形'], tags: ['ソフトロボ', '把持', '柔軟', 'レーザー', '溶接', '画像認識'], need: 1 },
    { key: 'ctrl', roles: ['機能'], tags: ['PLC', 'IoT', 'AI', 'エッジ', 'ダッシュボード', 'クラウド', '予知保全'] },
    { key: 'meas', roles: ['計測'] },
    { key: 'join', roles: ['接合'] },
    { key: 'surf', roles: ['表面'] },
    { key: 'asm', roles: ['組立'] },
  ], ctx.techs);
  const rh = h * 0.035, rw = m * 0.06, beamH = m * 0.12, xp = w * 0.0, zr = d / 2 - rw / 2, colW = m * 0.08;
  const tH = h * 0.26, xt = -w * 0.08;
  { const p = P('asm', 'レール・据付', A.asm); const rm = partMat(A.asm, MAT.iron); for (const s of [-1, 1]) p.add(M(box(w, rh, rw), rm, { y: rh / 2, z: s * zr })); }
  { const p = P('frame', '門型フレーム', A.frame); const fm = partMat(A.frame, () => MAT.paint(0xc9a24a)); const colH = h - rh - beamH;
    for (const s of [-1, 1]) { p.add(M(box(colW, colH, colW), fm, { x: xp, y: rh + colH / 2, z: s * zr })); p.add(M(box(m * 0.18, rh * 1.4, rw * 1.25), MAT.dark(), { x: xp, y: rh + rh * 0.7, z: s * zr })); }
    p.add(M(box(m * 0.1, beamH, d), fm, { x: xp, y: h - beamH / 2 })); }
  { const p = P('table', 'ワークテーブル', A.table, [0, 0, 0.5]); p.add(M(rbox(w * 0.6, tH, d * 0.56, m * 0.01), partMat(A.table, MAT.iron), { x: xt, y: tH / 2 }));
    p.add(M(rbox(w * 0.26, h * 0.06, d * 0.26, m * 0.01), MAT.alu(), { x: xt, y: tH + h * 0.03 })); }
  const cz = d * 0.1, cx = xp + m * 0.13, yZb = tH + h * 0.22;
  { const p = P('carr', '駆動キャリッジ', A.carr, [0, 0.45, 0]); p.add(M(rbox(m * 0.15, m * 0.16, m * 0.18, m * 0.015), MAT.anod(ANOD), { x: cx, y: h - beamH / 2, z: cz }));
    p.add(M(box(m * 0.06, h - beamH * 0.2 - yZb, m * 0.06), MAT.alu(), { x: cx, y: (h - beamH * 0.2 + yZb) / 2, z: cz })); }
  { const soft = ['ソフトロボ', '把持', '柔軟'].some(x => tagsAll.has(x)), laser = ['レーザー', '溶接', '肉盛'].some(x => tagsAll.has(x));
    const p = P('eff', soft ? 'ソフトハンド' : laser ? 'レーザーヘッド' : 'ツールヘッド', A.eff, [0, 0.25, 0]);
    if (soft) gripperInto(p, { cx: 0, cz: 0, y0: tH + h * 0.06, yTop: yZb + m * 0.04, m, mat: partMat(A.eff, MAT.silicone) }), p.children.slice(0, 3).forEach(o => { p.remove(o); o.geometry.dispose(); }), p.position.set(cx, 0, cz);
    else if (laser) { p.add(M(cyl(m * 0.04, m * 0.04, m * 0.1, 24), MAT.dark(), { x: cx, y: yZb - m * 0.05, z: cz })); p.add(M(new THREE.ConeGeometry(m * 0.035, m * 0.08, 24), MAT.brass(false), { x: cx, y: yZb - m * 0.14, z: cz, rx: Math.PI })); p.add(M(new THREE.SphereGeometry(m * 0.01, 10, 8), MAT.led(0xff7a3a), { x: cx, y: yZb - m * 0.19, z: cz, cast: false })); }
    else { p.add(M(rbox(m * 0.12, m * 0.05, m * 0.06, m * 0.01), MAT.dark(), { x: cx, y: yZb - m * 0.025, z: cz })); for (const s of [-1, 1]) p.add(M(box(m * 0.02, m * 0.09, m * 0.05), MAT.alu(), { x: cx + s * m * 0.04, y: yZb - m * 0.09, z: cz })); } }
  { const p = P('ctrl', '制御盤', A.ctrl, [0.35, 0, 0]); const cw = w * 0.12, ch = h * 0.55, cxx = w / 2 - cw / 2, cd = d * 0.3;
    p.add(M(rbox(cw, ch, cd, m * 0.01), MAT.paint(0xd9d4c7), { x: cxx, y: ch / 2, z: 0 }));
    const tx = dispTex(ctx.c.code); p.add(M(new THREE.PlaneGeometry(cw * 0.7, ch * 0.22), std({ color: 0x111111, map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.9 }), { x: cxx, y: ch * 0.72, z: cd / 2 + 0.002, noHL: true, cast: false }));
    [0xd9534f, 0xe0b44a, 0x5ad07a].forEach((col, i) => p.add(M(cyl(m * 0.025, m * 0.025, h * 0.035, 20), MAT.led(col), { x: cxx, y: ch + h * 0.02 + i * h * 0.036, z: cd * 0.3, cast: false }))); }
  if (A.meas.length) { const p = P('meas', '計測カメラ', A.meas, [0, 0.6, 0]); const dk = MAT.dark(), yy = h - beamH - m * 0.05;
    p.add(M(rbox(m * 0.1, m * 0.08, m * 0.1, m * 0.012), dk, { x: xp - m * 0.11, y: yy, z: -d * 0.25 })); p.add(M(cyl(m * 0.03, m * 0.034, m * 0.04, 20), MAT.glass(0x9fb7d0), { x: xp - m * 0.11, y: yy - m * 0.06, z: -d * 0.25 })); }
  if (A.join.length) { const p = P('join', '溶接継手', A.join, [0, 0.3, 0]); const jm = partMat(A.join, () => MAT.steel(false));
    for (const s of [-1, 1]) p.add(M(rbox(colW * 1.4, beamH * 0.3, colW * 1.4, colW * 0.15), jm, { x: xp, y: h - beamH - beamH * 0.1, z: s * zr })); }
  if (A.surf.length) { const p = P('surf', 'カバー・表面処理', A.surf, [0, 0.55, 0]); const sm = partMat(A.surf, MAT.alu);
    for (const s of [-1, 1]) p.add(M(box(m * 0.006, beamH * 0.86, d * 0.84), sm, { x: xp + s * (m * 0.05 + m * 0.004), y: h - beamH / 2 })); }
  return { root, parts };
}

/* ---------- テンプレート: ノベルティ（プレート） ---------- */
function buildTag(ctx) {
  const { w, d, h, c } = ctx;
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'plate', roles: ['成形', '材料', '加工', '表面'], tags: COAT },
    { key: 'engr', roles: ['表面'], tags: ['刻印', 'マーキング', 'エンボス', 'QR', 'ブランド', 'テクスチャ'] },
    { key: 'edge', roles: ['成形', '材料', '表面'], tags: ['二色', '発泡', 'シリコーン', 'クッション', 'グリップ', '衝撃吸収', 'シボ'], need: 1 },
    { key: 'ring', roles: ['接合', '組立'] },
    { key: 'stand', roles: ['組立', '表面', '成形'] },
    { key: 'meas', roles: ['計測'] },
  ], ctx.techs);
  const stH = h * 0.14, pw = w * 0.72, t = Math.min(d * 0.12, pw * 0.06), yTop = h - 0.075 * pw, yBot = stH * 0.55, ph = yTop - yBot, yc = (yTop + yBot) / 2;
  const hx = -pw / 2 + pw * 0.15, hy = ph / 2 - pw * 0.15, hr = pw * 0.06;
  const plateMat = partMat(A.plate, () => MAT.steel(true));
  { const p = P('plate', '本体プレート', A.plate, [0, 0.3, 0]); const sh = rrShape(pw, ph, Math.min(pw, ph) * 0.18); sh.holes.push(circ(hx, hy, hr));
    p.add(M(slabZ(sh, t, t * 0.22, 48), plateMat, { y: yc })); }
  { const p = P('engr', '刻印・マーキング', A.engr, [0, 0.3, 0.35]); const ew = pw * 0.66, eh = ph * 0.78;
    const dark = plateMat.metalness > 0.5 && plateMat.roughness < 0.25 || plateMat.color.getHSL({}).l > 0.5;
    p.add(M(new THREE.PlaneGeometry(ew, eh), std({ map: engrTex(c.code, eh / ew, dark), transparent: true, alphaTest: 0.05, roughness: dark ? 0.7 : 0.4, metalness: dark ? 0.2 : 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), { x: pw * 0.1, y: yc - ph * 0.04, z: t / 2 + 0.002, cast: false })); }
  if (A.edge.length) { const p = P('edge', 'グリップ・縁取り', A.edge, [0, 0.3, -0.3]); const sh = rrShape(pw * 1.05, ph * 1.06, Math.min(pw, ph) * 0.2); sh.holes.push(rrShape(pw * 0.995, ph * 0.995, Math.min(pw, ph) * 0.18));
    const em = partMat(A.edge, () => MAT.silicone(ANOD)); if (em.color && A.edge.some(x => x.mat.some(y => /シリコーン|TPE|TPU|LSR/.test(y)))) em.color.setHex(ANOD); p.add(M(slabZ(sh, t * 1.4, t * 0.2), em, { y: yc })); }
  { const p = P('ring', 'リング金具', A.ring, [-0.1, 0.85, 0]); const Rr = pw * 0.12;
    p.add(M(new THREE.TorusGeometry(Rr, pw * 0.018, 16, 64), partMat(A.ring, () => MAT.steel(true)), { x: hx, y: yc + hy + Rr * 0.7, ry: Math.PI / 2 })); }
  { const p = P('stand', 'ディスプレイ台座', A.stand); const sm = A.stand.length ? partMat(A.stand, MAT.wood) : MAT.wood();
    p.add(M(rbox(w, stH, d, stH * 0.25), sm, { y: stH / 2 }));
    p.add(M(box(pw * 1.04, stH * 0.04, t * 1.6), MAT.chip(), { y: stH + 0.0005, cast: false }));
    p.add(M(rbox(w * 0.3, stH * 0.4, d * 0.012, stH * 0.04), MAT.brass(true), { y: stH * 0.5, z: d / 2 + d * 0.004 })); }
  if (A.meas.length) { const p = P('meas', '個体 ID（裏面 QR）', A.meas, [0, 0.3, -0.4]); const q = Math.min(pw, ph) * 0.34;
    p.add(M(new THREE.PlaneGeometry(q, q), std({ map: qrTex(hs(c.code)), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), { x: pw * 0.2, y: yc - ph * 0.12, z: -t / 2 - 0.002, ry: Math.PI, cast: false })); }
  return { root, parts };
}

/* ---------- テンプレート: ノベルティ（ヘラ絞りカップ） ---------- */
function buildCup(ctx) {
  const { w, d, h, c } = ctx; const m = Math.min(w, d);
  const root = new THREE.Group(); const { parts, P } = partFactory(root);
  const A = assign([
    { key: 'body', roles: ['成形', '材料', '加工', '表面'], tags: COAT.concat(['絞り', '曲面', '容器', '一体']) },
    { key: 'engr', roles: ['表面'], tags: ['刻印', 'マーキング', 'エンボス', 'QR', 'ブランド', 'テクスチャ'] },
    { key: 'edge', roles: ['成形', '材料', '表面'], tags: ['二色', '発泡', 'シリコーン', 'クッション', 'グリップ', '衝撃吸収'], need: 1 },
    { key: 'join', roles: ['接合'] },
    { key: 'stand', roles: ['組立', '表面', '成形'] },
    { key: 'meas', roles: ['計測'] },
  ], ctx.techs);
  const hasHandle = A.join.length > 0;
  const Rmax = hasHandle ? Math.min(d / 2, w / 2 / 1.45) / 1.08 : (m / 2) / 1.08, cH = h * 0.07, H = h - cH - Rmax * 0.04;
  const Rb = Rmax * 0.72, th = Rmax * 0.045, bt = H * 0.05;
  const prof = [[0.0001, 0], [Rb, 0], [Rb * 1.01, H * 0.03]];
  for (let i = 1; i <= 10; i++) { const t = i / 10; prof.push([Rb + (Rmax - Rb) * Math.pow(t, 1.4), H * (0.03 + 0.97 * t)]); }
  prof.push([Rmax - th * 0.5, H + th * 0.45], [Rmax - th, H]);
  for (let i = 10; i >= 1; i--) { const t = i / 10; prof.push([Rb - th + (Rmax - Rb) * Math.pow(t, 1.4), Math.max(bt, H * (0.03 + 0.97 * t))]); }
  prof.push([0.0001, bt]);
  const rAt = y => { const t = Math.max(0, Math.min(1, (y / H - 0.03) / 0.97)); return Rb + (Rmax - Rb) * Math.pow(t, 1.4); };
  { const p = P('body', 'カップ本体（ヘラ絞り）', A.body, [0, 0.35, 0]); const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96);
    p.add(M(g, partMat(A.body, () => MAT.steel(true)), { y: cH })); }
  { const p = P('engr', '刻印バンド', A.engr, [0, 0.35, 0.3]); const y0 = H * 0.42, y1 = H * 0.7; const tx = bandTex(c.code); tx.wrapS = THREE.RepeatWrapping;
    p.add(M(new THREE.CylinderGeometry(rAt(y1) + 0.003, rAt(y0) + 0.003, y1 - y0, 128, 1, true), std({ map: tx, transparent: true, alphaTest: 0.05, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), { y: cH + (y0 + y1) / 2, cast: false })); }
  if (A.edge.length) { const p = P('edge', 'グリップスリーブ', A.edge, [0, 0.35, -0.3]); const y0 = H * 0.06, y1 = H * 0.3;
    p.add(M(new THREE.CylinderGeometry(rAt(y1) * 1.03, rAt(y0) * 1.03, y1 - y0, 96, 1, true), partMat(A.edge, () => MAT.silicone(ANOD)), { y: cH + (y0 + y1) / 2 })); }
  if (hasHandle) { const p = P('join', 'ハンドル（溶接）', A.join, [0.4, 0.35, 0]); const hr = H * 0.26; const g = new THREE.TorusGeometry(hr, Rmax * 0.045, 16, 48, Math.PI);
    p.add(M(g, partMat(A.join, () => MAT.steel(true)), { x: rAt(H * 0.55) - Rmax * 0.02, y: cH + H * 0.55, rz: -Math.PI / 2 })); }
  { const p = P('stand', 'コースター台座', A.stand); p.add(M(cyl(Rmax * 1.08, Rmax * 1.12, cH, 64), A.stand.length ? partMat(A.stand, MAT.wood) : MAT.wood(), { y: cH / 2 }));
    p.add(M(new THREE.TorusGeometry(Rmax * 1.08, cH * 0.08, 8, 64), MAT.brass(true), { y: cH, rx: Math.PI / 2, cast: false })); }
  if (A.meas.length) { const p = P('meas', '個体 ID（QR）', A.meas, [0, 0, 0.3]); const q = Math.min(Rmax * 0.35, cH * 3);
    p.add(M(new THREE.PlaneGeometry(q, q), std({ map: qrTex(hs(c.code)), roughness: 0.6 }), { y: cH + 0.002, z: Rmax * 0.95 + q * 0.0, x: Rmax * 0.55, rx: -Math.PI / 2, cast: false })); }
  return { root, parts };
}

/* ---------- 組み立て ---------- */
function build(c, res) {
  const size = c.size0 || c.size; const S = 2.2 / Math.max(size.W, size.D, size.H, 1e-6);
  const techs = (c.techs || []).map(id => T[id]).filter(Boolean);
  const ctx = { c, res, techs, w: size.W * S, d: size.D * S, h: size.H * S, s: S, tagsAll: new Set(techs.flatMap(t => t.tags)) };
  ANOD = ANOD_PAL[hs(c.code) % ANOD_PAL.length];
  let out, kind;
  if (c.form === '装置') { out = buildDevice(ctx); kind = 'device'; }
  else if (c.form === '大型') { const can = /屋根|テント|シェルター|膜/.test(c.name) || ['耐候', '縫製', '溶着'].some(x => ctx.tagsAll.has(x)); out = can ? buildCanopy(ctx) : buildGantry(ctx); kind = can ? 'canopy' : 'gantry'; }
  else if (c.form === 'ノベルティ') { const cup = ctx.tagsAll.has('絞り') || /カップ|容器|ボトル|タンブラー/.test(c.name); out = cup ? buildCup(ctx) : buildTag(ctx); kind = cup ? 'cup' : 'tag'; }
  else { const arm = /アーム|ブラケット/.test(c.name); out = arm ? buildArm(ctx) : buildComponent(ctx); kind = arm ? 'arm' : 'component'; }
  return { ...out, s: S, kind, ctx };
}

/* =====================================================================
   VIEWER
   ===================================================================== */
const V = { ok: false, el: null, r: null, lr: null, scene: null, cam: null, ctl: null, root: null, parts: [], dims: null, grid: null, ground: null, sun: null,
  explodeCur: 0, explodeTgt: 0, expScale: 1, roleMode: false, section: false, labels: true, pendingIntro: false, hover: null, focus: null, concept: null, built: null,
  plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), secFrame: null, box: new THREE.Box3(), center: new THREE.Vector3(), radius: 1, onFocus: null, onHover: null };

function available() { try { const cv = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (cv.getContext('webgl2') || cv.getContext('webgl'))); } catch (e) { return false; } }

function init(el) {
  try { V.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false }); } catch (e) { V.ok = false; return false; }
  V.el = el; const r = V.r;
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.localClippingEnabled = true;
  r.domElement.className = 'v3d-canvas'; el.appendChild(r.domElement);
  V.lead = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); V.lead.setAttribute('class', 'v3d-lead'); el.appendChild(V.lead);
  V.lr = new CSS2DRenderer(); Object.assign(V.lr.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' }); V.lr.domElement.className = 'v3d-labels'; el.appendChild(V.lr.domElement);
  V.scene = new THREE.Scene(); V.cam = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
  const pm = new THREE.PMREMGenerator(r); V.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; V.scene.environmentIntensity = 0.85;
  V.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 0.45));
  V.sun = new THREE.DirectionalLight(0xffffff, 1.7); V.sun.castShadow = true; V.sun.shadow.mapSize.set(2048, 2048); V.sun.shadow.bias = -0.0004; V.sun.shadow.normalBias = 0.02; V.scene.add(V.sun, V.sun.target);
  const fill = new THREE.DirectionalLight(0xfff4e0, 0.45); fill.position.set(-4, 2, -3); V.scene.add(fill);
  V.ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 })); V.ground.rotation.x = -Math.PI / 2; V.ground.receiveShadow = true; V.scene.add(V.ground);
  V.ctl = new OrbitControls(V.cam, r.domElement); V.ctl.enableDamping = true; V.ctl.dampingFactor = 0.08; V.ctl.autoRotate = !RM; V.ctl.autoRotateSpeed = 0.7; V.ctl.maxPolarAngle = Math.PI * 0.495; V.ctl.screenSpacePanning = true;
  V.ctl.addEventListener('start', () => { V.ctl.autoRotate = false; V.moved = true; });
  new ResizeObserver(resize).observe(el);
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  r.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  r.domElement.addEventListener('pointermove', e => {
    if (!V.root) return; const b = r.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, V.cam);
    const hit = ray.intersectObject(V.root, true).find(x => x.object.isMesh && x.object.visible && x.object.userData.part && !(V.section && x.point.z > V.plane.constant + 1e-4));
    setHover(hit ? hit.object.userData.part : null, e.clientX - b.left, e.clientY - b.top);
  });
  r.domElement.addEventListener('pointerleave', () => setHover(null));
  r.domElement.addEventListener('click', e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return; const p = V.hover; setFocus(p && V.focus !== p ? p : null); });
  const mq = matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', applyTheme) : mq.addListener(applyTheme));
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  r.setAnimationLoop(tick); V.ok = true; applyTheme(); return true;
}
function resize() { if (!V.r || !V.el) return; const w = V.el.clientWidth, h = V.el.clientHeight; if (!w || !h) return; V.r.setSize(w, h); V.lr.setSize(w, h); V.lead.setAttribute('viewBox', `0 0 ${w} ${h}`); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); if (V.root && !V.moved) placeCamera(); }
function applyTheme() {
  if (!V.scene) return; V.scene.background = tcol('--card');
  const dark = V.scene.background.getHSL({}).l < 0.4; V.ground.material.opacity = dark ? 0.4 : 0.16;
  makeGrid();
  if (V.root) V.root.traverse(o => { if (o.userData.themeVar && o.material) o.material.color = tcol(o.userData.themeVar); });
  if (V.dims) V.dims.traverse(o => { if (o.isLine) o.material.color = tcol('--ink-mute'); });
  if (V.secFrame) V.secFrame.material.color = tcol('--accent');
  for (const p of V.parts) if (p.userData.roleMat) p.userData.roleMat.color = roleColor(p);
}
function makeGrid() {
  if (V.grid) { V.scene.remove(V.grid); V.grid.geometry.dispose(); V.grid.material.dispose(); }
  const size = Math.max(4, Math.ceil(V.radius * 5));
  V.grid = new THREE.GridHelper(size, 28, tcol('--line'), tcol('--line-faint')); V.grid.material.transparent = true; V.grid.material.opacity = 0.7; V.grid.material.depthWrite = false; V.grid.position.set(V.center.x, 0.0005, V.center.z); V.scene.add(V.grid);
}
function tick() {
  const el = V.el; if (!el || el.offsetParent === null || !el.clientWidth) return;
  if (V.r.domElement.width === 0 || V.cam.aspect === 1 && el.clientWidth !== el.clientHeight) resize();
  if (V.pendingIntro) { V.pendingIntro = false; if (!RM) { V.explodeCur = Math.max(V.explodeTgt, 1); } }
  if (Math.abs(V.explodeCur - V.explodeTgt) > 1e-4) { V.explodeCur += (V.explodeTgt - V.explodeCur) * 0.09; if (Math.abs(V.explodeCur - V.explodeTgt) < 1e-3) V.explodeCur = V.explodeTgt; applyExplode(); }
  V.ctl.update(); V.r.render(V.scene, V.cam); V.lr.render(V.scene, V.cam); if (V.labels) declutter();
}
const _wp = new THREE.Vector3();
function declutter() {
  const W = V.el.clientWidth, H = V.el.clientHeight, items = [], placed = [], svg = V.lead;
  for (const p of V.parts) {
    const d = p.userData.label, o = p.userData.labelObj; if (!d || !o) continue;
    o.getWorldPosition(_wp).project(V.cam); if (_wp.z > 1 || !o.visible) { if (d._line) d._line.setAttribute('visibility', 'hidden'); continue; }
    if (!d._w) { d._w = d._box.offsetWidth; d._h = d._box.offsetHeight; } if (!d._w) continue;
    items.push({ d, x: (_wp.x + 1) / 2 * W, y: (1 - _wp.y) / 2 * H });
  }
  items.sort((a, b) => a.y - b.y);
  const hit = r => placed.some(q => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h);
  for (const it of items) {
    const { d } = it, bw = d._w + 8, bh = d._h + 8; let best = null;
    const dxs = [0, -0.65, 0.65, -1.3, 1.3, -1.95, 1.95].map(k => k * bw);
    outer: for (let stem = 18; stem <= 240; stem += 14) for (const dx of dxs) {
      const r = { x: it.x + dx - bw / 2, y: it.y - 6 - stem - bh, w: bw, h: bh };
      if (r.x < 4 || r.x + r.w > W - 4 || r.y < 26 || r.y + r.h > H - 4) continue;
      if (!hit(r)) { best = { r, dx, stem }; break outer; }
    }
    if (!best) { const stem = 18, dx = 0; best = { r: { x: it.x - bw / 2, y: it.y - 6 - stem - bh, w: bw, h: bh }, dx, stem }; }
    placed.push(best.r);
    const key = best.dx + '|' + best.stem; if (d._k !== key) { d._k = key; d._box.style.transform = `translate(${best.dx}px,${-best.stem}px)`; }
    if (!d._line) { d._line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(d._line); }
    d._line.setAttribute('visibility', 'visible');
    d._line.setAttribute('x1', it.x); d._line.setAttribute('y1', it.y - 4); d._line.setAttribute('x2', it.x + best.dx); d._line.setAttribute('y2', it.y - 6 - best.stem + 2);
    d._line.classList.toggle('hl', d.classList.contains('hl'));
  }
}
function applyExplode() { for (const p of V.parts) p.position.copy(p.userData.base).addScaledVector(p.userData.explode, V.explodeCur * V.expScale); }

function disposeTree(o) {
  o.traverse(x => {
    if (x.isCSS2DObject && x.element) x.element.remove();
    if (x.geometry) x.geometry.dispose();
    const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : [];
    if (x.userData && x.userData.real && x.userData.real !== x.material) ms.push(x.userData.real);
    for (const m of ms) { for (const k of ['map', 'emissiveMap', 'bumpMap']) if (m[k]) m[k].dispose(); m.dispose(); }
  });
}
function clearModel() {
  if (V.root) { V.scene.remove(V.root); disposeTree(V.root); V.root = null; }
  if (V.dims) { V.scene.remove(V.dims); disposeTree(V.dims); V.dims = null; }
  if (V.secFrame) { V.scene.remove(V.secFrame); V.secFrame.geometry.dispose(); V.secFrame = null; }
  V.parts = []; V.hover = null; V.focus = null; hideTip(); if (V.lead) V.lead.innerHTML = '';
}
function roleColor(p) { const t = p.userData.techs[0]; return t ? tcol(ROLE_VAR[t.role]) : tcol('--paper-dark'); }
function finalize() {
  V.root.updateMatrixWorld(true); let li = 0;
  for (const p of V.parts) {
    p.userData.base.copy(p.position);
    p.userData.roleMat = std({ color: roleColor(p), roughness: 0.6, metalness: 0.05 });
    p.traverse(o => { if (o.isMesh) { o.userData.part = p; o.userData.real = o.material; } });
    if (p.userData.techs.length) {
      const bb = new THREE.Box3().setFromObject(p); if (bb.isEmpty()) continue;
      const lp = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2); p.worldToLocal(lp);
      const d = document.createElement('div'); d.className = 'l3d';
      d.innerHTML = `<div class="lb">${p.userData.techs.map(t => `<span class="lt"><i style="background:var(${ROLE_VAR[t.role]})"></i>${esc(short(t.name))}</span>`).join('')}<small>${esc(p.userData.name)}</small></div><div class="dot"></div>`;
      const o = new CSS2DObject(d); o.center.set(0.5, 1); o.position.copy(lp); p.add(o); p.userData.label = d; p.userData.labelObj = o; d._box = d.firstElementChild; li++;
    }
  }
}
function measured() { if (!V.built) return null; const sz = V.box.getSize(new THREE.Vector3()), s = V.built.s; return { W: Math.round(sz.x / s), D: Math.round(sz.z / s), H: Math.round(sz.y / s) }; }
function fmtDim(mm, big) { return big ? `${(mm / 1000).toFixed(1)} m` : `${Math.round(mm)} mm`; }
function addDims(c) {
  const b = V.box, g = new THREE.Group(), mat = new THREE.LineBasicMaterial({ color: tcol('--ink-mute') }), off = V.radius * 0.1, big = c.form === '大型';
  const line = pts => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), mat); g.add(l); };
  const lab = (txt, p) => { const d = document.createElement('div'); d.className = 'd3d'; d.textContent = txt; const o = new CSS2DObject(d); o.position.set(...p); g.add(o); };
  const y = 0.001, zf = b.max.z + off, xr = b.max.x + off, tk = off * 0.35;
  line([[b.min.x, y, zf], [b.max.x, y, zf]]); line([[b.min.x, y, zf - tk], [b.min.x, y, zf + tk]]); line([[b.max.x, y, zf - tk], [b.max.x, y, zf + tk]]);
  const md = measured(); lab(`W ${fmtDim(md.W, big)}`, [(b.min.x + b.max.x) / 2, y, zf + tk]);
  line([[xr, y, b.min.z], [xr, y, b.max.z]]); line([[xr - tk, y, b.min.z], [xr + tk, y, b.min.z]]); line([[xr - tk, y, b.max.z], [xr + tk, y, b.max.z]]);
  lab(`D ${fmtDim(md.D, big)}`, [xr + tk, y, (b.min.z + b.max.z) / 2]);
  line([[xr, 0, b.min.z], [xr, b.max.y, b.min.z]]); line([[xr - tk, b.max.y, b.min.z], [xr + tk, b.max.y, b.min.z]]);
  lab(`H ${fmtDim(md.H, big)}`, [xr + tk, b.max.y / 2, b.min.z]);
  V.dims = g; V.scene.add(g);
}
function fit(resetCam) {
  V.explodeCur = 0; applyExplode(); V.root.updateMatrixWorld(true);
  V.box.makeEmpty(); for (const p of V.parts) if (p.userData.key !== 'meas') V.box.expandByObject(p);
  if (V.box.isEmpty()) V.box.setFromObject(V.root);
  V.box.getCenter(V.center); V.radius = V.box.getSize(new THREE.Vector3()).length() / 2; V.expScale = V.radius * 0.9;
  V.plane.constant = V.center.z;
  const r = V.radius, s = V.sun.shadow.camera; V.sun.position.set(V.center.x + r * 1.6, r * 3.2, V.center.z + r * 2.2); V.sun.target.position.copy(V.center);
  s.left = -r * 1.8; s.right = r * 1.8; s.top = r * 1.8; s.bottom = -r * 1.8; s.near = 0.1; s.far = r * 10; s.updateProjectionMatrix();
  if (resetCam) { V.moved = false; placeCamera(); }
  makeGrid();
}
function placeCamera() {
  const r = V.radius, a = V.cam.aspect || 1, vf = THREE.MathUtils.degToRad(V.cam.fov / 2), hf = Math.atan(Math.tan(vf) * a);
  const dist = r / Math.sin(Math.min(vf, hf)) * 1.04 + r * 0.12, dir = new THREE.Vector3(1, 0.62, 1.35).normalize();
  V.cam.position.copy(V.center).addScaledVector(dir, dist); V.cam.near = dist / 100; V.cam.far = dist * 20; V.cam.updateProjectionMatrix();
  V.ctl.target.copy(V.center); V.ctl.minDistance = r * 0.4; V.ctl.maxDistance = r * 8; V.ctl.update();
}
function sectionFrame() {
  const b = V.box, z = V.center.z, pad = V.radius * 0.06;
  const pts = [[b.min.x - pad, -0.0, z], [b.max.x + pad, 0, z], [b.max.x + pad, b.max.y + pad, z], [b.min.x - pad, b.max.y + pad, z], [b.min.x - pad, 0, z]].map(p => new THREE.Vector3(...p));
  V.secFrame = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: tcol('--accent') })); V.secFrame.visible = V.section; V.scene.add(V.secFrame);
}
function allMats() { const s = new Set(); for (const p of V.parts) { s.add(p.userData.roleMat); p.traverse(o => { if (o.isMesh) s.add(o.userData.real); }); } return [...s]; }
function applyModes() {
  for (const p of V.parts) p.traverse(o => { if (o.isMesh) o.material = V.roleMode ? p.userData.roleMat : o.userData.real; });
  for (const m of allMats()) {
    if (m.userData.side === undefined) m.userData.side = m.side;
    m.clippingPlanes = V.section ? [V.plane] : null; m.clipShadows = true; m.side = V.section ? THREE.DoubleSide : m.userData.side; m.needsUpdate = true;
  }
  if (V.secFrame) V.secFrame.visible = V.section;
  if (V.lr) { V.lr.domElement.style.display = V.labels ? '' : 'none'; V.lead.style.display = V.labels ? '' : 'none'; }
  for (const p of [V.hover, V.focus]) if (p) highlight(p, true);
}
function highlight(p, on) {
  const acc = tcol('--accent');
  p.traverse(o => {
    if (!o.isMesh || o.userData.noHL || !o.material.emissive) return; const m = o.material;
    if (m.userData.em === undefined) { m.userData.em = m.emissive.getHex(); m.userData.ei = m.emissiveIntensity; }
    if (on) { m.emissive.copy(acc); m.emissiveIntensity = 0.35; } else { m.emissive.setHex(m.userData.em); m.emissiveIntensity = m.userData.ei; }
  });
  if (p.userData.label) p.userData.label.classList.toggle('hl', on);
}
function setHover(p, x, y) {
  if (V.hover !== p) { if (V.hover && V.hover !== V.focus) highlight(V.hover, false); V.hover = p; if (p) highlight(p, true); if (V.onHover) V.onHover(p ? p.userData.techs.map(t => t.id) : []); }
  V.r.domElement.style.cursor = p ? 'pointer' : '';
  if (p && x !== undefined) showTip(p, x, y); else hideTip();
}
function setFocus(p) { if (V.focus && V.focus !== V.hover) highlight(V.focus, false); V.focus = p; if (p) highlight(p, true); if (V.onFocus) V.onFocus(p ? p.userData.techs.map(t => t.id) : []); }
function tipEl() { let t = V.el.querySelector('.v3d-tip'); if (!t) { t = document.createElement('div'); t.className = 'v3d-tip'; V.el.appendChild(t); } return t; }
function showTip(p, x, y) {
  const t = tipEl(); const ts = p.userData.techs;
  t.innerHTML = `<div class="tt-h">${esc(p.userData.name)}</div>` + (ts.length ? ts.map(k => `<div class="tt-r"><span class="role-pill" style="background:var(${ROLE_VAR[k.role]})">${k.role}</span><div><b>${esc(k.name)}</b><br><span class="mono">${esc(FAC[k.fac].name)} · ${esc(FAC[k.fac].region)}</span><br><span class="tt-w">${ROLE_WORK[k.role]}</span></div></div>`).join('') : `<div class="tt-w">汎用部品（技術の割当なし）</div>`);
  t.hidden = false; const W = V.el.clientWidth, H = V.el.clientHeight, tw = t.offsetWidth, th = t.offsetHeight;
  t.style.left = Math.min(W - tw - 8, x + 14) + 'px'; t.style.top = Math.min(H - th - 8, Math.max(8, y + 14)) + 'px';
}
function hideTip() { if (!V.el) return; const t = V.el.querySelector('.v3d-tip'); if (t) t.hidden = true; }

function show(el, c, res) {
  if (!V.r) { if (!init(el)) return false; }
  if (V.concept === c && V.root) return true;
  clearModel(); V.concept = c;
  const b = build(c, res); V.built = b; V.root = b.root; V.parts = b.parts; V.scene.add(V.root);
  finalize(); fit(true); addDims(c); sectionFrame(); applyModes(); applyTheme();
  V.ctl.autoRotate = !RM; V.explodeCur = V.explodeTgt; applyExplode(); V.pendingIntro = true;
  return true;
}
function partsList() { return V.parts.filter(p => p.userData.techs.length).map(p => ({ key: p.userData.key, name: p.userData.name, techs: p.userData.techs.map(t => t.id) })); }
function partByTech(id) { return V.parts.find(p => p.userData.techs.some(t => t.id === id)) || null; }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
function withExportPose(k, fn) {
  const prevE = V.explodeCur, prevRole = V.roleMode, prevSec = V.section;
  V.explodeCur = 0; applyExplode(); if (prevRole || prevSec) { V.roleMode = false; V.section = false; applyModes(); }
  if (V.focus) highlight(V.focus, false); if (V.hover) highlight(V.hover, false);
  const sc = V.root.scale.clone(); V.root.scale.setScalar(k); V.root.updateMatrixWorld(true);
  const restore = () => { V.root.scale.copy(sc); V.root.updateMatrixWorld(true); V.explodeCur = prevE; applyExplode(); V.roleMode = prevRole; V.section = prevSec; applyModes(); };
  try { const r = fn(); if (r && r.then) return r.finally(restore); restore(); return r; } catch (e) { restore(); throw e; }
}
const fileBase = () => `ANGLEX-FUSION_${V.concept.code}`;
globalThis.FX3D = {
  available, show, measured,
  get ready() { return V.ok; },
  setExplode(v) { V.explodeTgt = Math.max(0, Math.min(1, v)); },
  setRoleMode(b) { V.roleMode = !!b; applyModes(); },
  setSection(b) { V.section = !!b; applyModes(); },
  setLabels(b) { V.labels = !!b; applyModes(); },
  reset() { if (V.root) { fit(true); V.explodeCur = V.explodeTgt; applyExplode(); V.ctl.autoRotate = !RM; } },
  hoverTech(id) { const p = id ? partByTech(id) : null; if (V.hover !== p) setHover(p); },
  focusTech(id) { const p = id ? partByTech(id) : null; setFocus(p === V.focus ? null : p); },
  parts: partsList,
  get kind() { return V.built ? V.built.kind : null; },
  set onFocus(f) { V.onFocus = f; }, set onHover(f) { V.onHover = f; },
  exportGLB() {
    return withExportPose(0.001 / V.built.s, () => {
      const saved = []; V.root.traverse(o => { saved.push([o, o.userData]); o.userData = o.isMesh || o.userData.isPart ? { part: o.userData.isPart ? o.userData.name : undefined } : {}; if (o.isMesh) o.userData = {}; });
      const labels = []; V.root.traverse(o => { if (o.isCSS2DObject) labels.push([o, o.parent]); }); labels.forEach(([o, pa]) => pa.remove(o));
      const restore = () => { saved.forEach(([o, u]) => { o.userData = u; }); labels.forEach(([o, pa]) => pa.add(o)); };
      return new GLTFExporter().parseAsync(V.root, { binary: true, onlyVisible: true }).then(buf => { restore(); download(new Blob([buf], { type: 'model/gltf-binary' }), fileBase() + '.glb'); }, e => { restore(); throw e; });
    });
  },
  exportSTL() { return withExportPose(1 / V.built.s, () => { const dv = new STLExporter().parse(V.root, { binary: true }); download(new Blob([dv], { type: 'model/stl' }), fileBase() + '.stl'); }); },
  exportPNG() { V.r.render(V.scene, V.cam); V.r.domElement.toBlob(b => b && download(b, fileBase() + '.png'), 'image/png'); },
  _debug: V,
};
