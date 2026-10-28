// 溶接ビード: 隅肉（fillet）・全周・突合せ（開先）・プラグ。 JIS Z 3021 記号も生成
import * as THREE from 'three';
import { finishMaterial } from './materials.js';
import { DENSITY } from '../data/sections.js';

// 隅肉溶接ビード断面（脚長 s、やや凸）。局所座標: x = 面1の法線方向, y = 面2の法線方向, 隅角が原点。
function filletSection(s, convex = 0.18) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s, 0);
  const cx = s * (0.5 + convex), cy = s * (0.5 + convex); sh.quadraticCurveTo(cx, cy, 0, s); sh.lineTo(0, 0); return sh;
}
// 突合せ余盛り断面（幅 w、高さ h の半楕円）
function capSection(w, h) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w / 2, h * 1.3, 0, h); sh.quadraticCurveTo(w / 2, h * 1.3, w / 2, 0); sh.lineTo(-w / 2, 0); return sh; }

// 直線ビード。 from/to: Vector3, n1/n2: 2面の外向き法線（ビードはこの2法線の作る象限側に乗る）
export function filletBead({ from, to, n1, n2, size = 6, lod = 300, ripple = true }) {
  const dir = new THREE.Vector3().subVectors(to, from); const L = dir.length(); if (L < 1e-3) return null; dir.normalize();
  const sh = filletSection(size);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, curveSegments: lod >= 400 ? 10 : 6 });
  // 熱影響の焼け色（トゥ側へ 茶→青 のグラデーション）: 頂点色で表現。WELD 材質は vertexColors
  { const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const t = Math.min(1, Math.max(0, (Math.max(x, y) / size - 0.5) / 0.5)); const brown = [0.80, 0.60, 0.42], blue = [0.55, 0.62, 0.82], base = [0.88, 0.89, 0.90]; const k2 = x > y ? 0 : 1; const tint = [brown[0] * (1 - k2 * 0.5) + blue[0] * k2 * 0.5, brown[1] * (1 - k2 * 0.5) + blue[1] * k2 * 0.5, brown[2] * (1 - k2 * 0.5) + blue[2] * k2 * 0.5]; const w = t * t * 0.85; col[i * 3] = base[0] * (1 - w) + tint[0] * w; col[i * 3 + 1] = base[1] * (1 - w) + tint[1] * w; col[i * 3 + 2] = base[2] * (1 - w) + tint[2] * w; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  // ビード表面の波紋（LOD400）: 長さ方向の正弦で断面を微小に膨縮
  if (ripple && lod >= 400) {
    const pos = geo.attributes.position; const pitch = Math.max(2.5, size * 0.55);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (x > 1e-6 && y > 1e-6) { const k = 1 + 0.07 * Math.sin(z / pitch * Math.PI * 2) + 0.03 * Math.sin(z / pitch * Math.PI * 4.7); pos.setXY(i, x * k, y * k); } }
    pos.needsUpdate = true;
  }
  // UV: 波紋法線マップ用に u=長さ方向
  const uv = geo.attributes.uv; const pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) { const z = pos.getZ(i), x = pos.getX(i), y = pos.getY(i); uv.setXY(i, z / (size * 1.6), Math.atan2(y, x) / (Math.PI / 2)); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, finishMaterial('WELD')); m.castShadow = true; m.receiveShadow = true;
  // 基底: x=n1, y=n2, z=dir
  let xA = n1.clone().normalize(), yA = n2.clone().normalize();
  if (new THREE.Vector3().crossVectors(xA, yA).dot(dir) < 0) { const t = xA; xA = yA; yA = t; } // 右手系を保つ（断面は対称なので入替で可）
  const basis = new THREE.Matrix4().makeBasis(xA, yA, dir); m.applyMatrix4(basis); m.position.copy(from);
  const vol = size * size / 2 * 1.1 * L; // mm3（凸余盛り考慮 10%）
  m.userData = { kind: 'weld', type: 'fillet', size, length: L, mass: vol * DENSITY.SS400 / 1e6, symbol: `▷${size}` };
  return m;
}
// 折れ線に沿う隅肉（全周など）: 各セグメントごとに法線ペアを指定
export function filletPath({ points, normals, size = 6, lod = 300, closed = false }) {
  const g = new THREE.Group(); g.name = '溶接ビード'; let total = 0, mass = 0;
  const n = points.length; const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const a = points[i], b = points[(i + 1) % n]; const nn = normals[i] || normals[0]; const m = filletBead({ from: a, to: b, n1: nn[0], n2: nn[1], size, lod }); if (m) { g.add(m); total += m.userData.length; mass += m.userData.mass; } }
  g.userData = { kind: 'weld', type: closed ? 'all-around' : 'fillet', size, length: total, mass, symbol: (closed ? '○' : '') + `▷${size}` };
  return g;
}
// 突合せ溶接（余盛り）: 面法線 n、線方向 from→to、板厚 t
export function buttBead({ from, to, n, t = 6, lod = 300 }) {
  const dir = new THREE.Vector3().subVectors(to, from); const L = dir.length(); dir.normalize();
  const w = t * 1.6 + 2, h = Math.max(1.2, t * 0.18);
  const geo = new THREE.ExtrudeGeometry(capSection(w, h), { depth: L, bevelEnabled: false, curveSegments: 8 });
  const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i) / (w * 0.8), (pos.getX(i) + w / 2) / w);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, finishMaterial('WELD')); m.castShadow = true;
  const y = n.clone().normalize(); const x = new THREE.Vector3().crossVectors(y, dir).normalize(); // x×y = dir となり右手系
  m.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, dir)); m.position.copy(from);
  const vol = (t * t * Math.tan(Math.PI / 6) + w * h * 0.66) * L; // V開先充填 + 余盛り
  m.userData = { kind: 'weld', type: 'butt', size: t, length: L, mass: vol * DENSITY.SS400 / 1e6, symbol: 'V' };
  return m;
}
// プラグ（栓）溶接: 穴を埋める円板状ビード
export function plugWeld({ center, n, d = 15, t = 6 }) {
  const geo = new THREE.CylinderGeometry(d / 2 * 1.15, d / 2, t * 0.3 + 1, 20); geo.rotateX(Math.PI / 2); geo.translate(0, 0, (t * 0.3 + 1) / 2);
  const m = new THREE.Mesh(geo, finishMaterial('WELD')); m.lookAt(n); m.position.copy(center);
  m.userData = { kind: 'weld', type: 'plug', size: d, length: Math.PI * d, mass: Math.PI * d * d / 4 * t * DENSITY.SS400 / 1e6, symbol: '⌂' };
  return m;
}
// JIS Z 3021 溶接記号テキスト（図面注記用）
export function weldSymbolText(w) {
  const s = w.size || 6; const both = w.side === 'both';
  if (w.type === 'fillet') return `${both ? '両側' : '片側'} 隅肉 ▷${s}` + (w.allAround ? ' ○全周' : '') + (w.field ? ' ▶現場' : '');
  if (w.type === 'all-around') return `全周隅肉 ○▷${s}`;
  if (w.type === 'butt') return `突合せ V開先 t${s}`;
  if (w.type === 'plug') return `プラグ溶接 φ${s}`;
  return `溶接 ${s}`;
}
