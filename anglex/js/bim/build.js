// parts（単一ソース）→ THREE.Group。各 part は { kind, pl:{pos,basis}, ... }。インスタンス単位の Group を返す。
import * as THREE from 'three';
import { buildMember, parseSpec } from '../geo/profiles.js';
import { hexBolt, uBolt, anchorBolt, hangerRod, hexNut, flatWasher } from '../geo/fasteners.js';
import { filletBead, buttBead } from '../geo/welds.js';
import { finishMaterial } from '../geo/materials.js';

function matrixOf(pl) { const [x, y, z] = pl.basis; const m = new THREE.Matrix4(); m.makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)); m.setPosition(new THREE.Vector3(...pl.pos)); return m; }
function ring(ro, ri, t, holes = [], hd = 0, seg = 48) { const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false); const p = new THREE.Path(); p.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(p); for (const [x, y] of holes) { const h = new THREE.Path(); h.absarc(x, y, hd / 2, 0, Math.PI * 2, true); s.holes.push(h); } const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg }); g.computeVertexNormals(); return g; }
// 吊バンド本体: 2つ割りの帯（半円×2）+ タン（吊り部）+ 耳（締付ボルト部）
function bandGeometry(pt, lod) {
  const g = new THREE.Group(); const mat = finishMaterial(pt.finish); const r = pt.od / 2 + (pt.rubber || 0); const t = pt.t, B = pt.B;
  const half = (a0, a1) => { const s = new THREE.Shape(); s.absarc(0, 0, r + t, a0, a1, false); s.absarc(0, 0, r, a1, a0, true); s.closePath(); const geo = new THREE.ExtrudeGeometry(s, { depth: B, bevelEnabled: false, curveSegments: lod >= 400 ? 40 : 20 }); geo.translate(0, 0, -B / 2); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
  // 上半分（タン付）: 耳が下 (-Y) 両側。 下半分: 同様
  g.add(half(Math.PI * 1.5 + 0.08, Math.PI * 2.5 - 0.08)); // 右側 … 角度は右回り基準で 2 分割（左右）
  g.add(half(Math.PI * 0.5 + 0.08, Math.PI * 1.5 - 0.08));
  // 耳（上下）: 両半円の端に外向きフランジ。上は 2 枚（タン）、下は 2 枚（締付）
  const ear = (y, sign, h) => { const geo = new THREE.BoxGeometry(t, h, B); geo.translate(sign * t / 2, y + (y > 0 ? h / 2 : -h / 2), 0); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  const tanH = pt.H - (r + t) - 0; const C = pt.C || 26; const earGap = 1.5;
  for (const sgn of [-1, 1]) { g.add(ear(r + t - 2, sgn * 1 + (sgn > 0 ? earGap / 2 : -earGap / 2), Math.max(10, tanH))); g.add(ear(-(r + t - 2), sgn * 1 + (sgn > 0 ? earGap / 2 : -earGap / 2), 14)); }
  // 吊穴（タン上端）: 2枚の耳を貫く丸穴の表現 → 小さいリング
  const hole = new THREE.Mesh(ring(8, 5.5, 2 * t + earGap + 0.2), finishMaterial('BOLT')); hole.rotation.y = Math.PI / 2; hole.position.set(-(t + earGap / 2) - 0.1, r + t - 2 + Math.max(10, tanH) - 10, 0); hole.visible = false; g.add(hole);
  if (pt.rubber) { const rb = new THREE.Mesh(ring(r, r - pt.rubber, B * 0.9), finishMaterial('RUBBER')); rb.position.z = -B * 0.45; g.add(rb); }
  return g;
}
// 立バンド（U形）: 半円 + 2 脚 + 足元の折り返し
function ubandGeometry(pt, lod) {
  const g = new THREE.Group(); const mat = finishMaterial(pt.finish); const r = pt.od / 2, t = pt.t, B = pt.B; const H = pt.H || r + 10;
  const s = new THREE.Shape(); s.absarc(0, 0, r + t, 0, Math.PI, false); s.lineTo(-(r + t), -H); s.lineTo(-(r + t) - (pt.L1 || 10), -H); s.lineTo(-(r + t) - (pt.L1 || 10), -H - t); s.lineTo(-r, -H - t); s.lineTo(-r, 0); s.absarc(0, 0, r, Math.PI, 0, true); s.lineTo(r, -H - t); s.lineTo(r + t + (pt.L1 || 10), -H - t); s.lineTo(r + t + (pt.L1 || 10), -H); s.lineTo(r + t, -H); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: B, bevelEnabled: false, curveSegments: lod >= 400 ? 32 : 16 }); geo.translate(0, 0, -B / 2); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return g;
}
function customGeometry(pt, lod) {
  const mat = finishMaterial(pt.finish || 'HDZ');
  switch (pt.custom) {
    case 'ring': { const m = new THREE.Mesh(ring(pt.ro, pt.ri, pt.t, pt.holes || [], pt.holeD || 0), mat); m.castShadow = m.receiveShadow = true; return m; }
    case 'band': return bandGeometry(pt, lod);
    case 'uband': return ubandGeometry(pt, lod);
    case 'box': { const g = new THREE.Group(); const s = new THREE.Shape(); s.moveTo(-pt.w / 2, -pt.d / 2); s.lineTo(pt.w / 2, -pt.d / 2); s.lineTo(pt.w / 2, pt.d / 2); s.lineTo(-pt.w / 2, pt.d / 2); s.closePath(); if (pt.hole) { const h = new THREE.Path(); h.absarc(0, 0, pt.hole / 2, 0, Math.PI * 2, true); s.holes.push(h); } const geo = new THREE.ExtrudeGeometry(s, { depth: pt.h, bevelEnabled: false }); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return g; }
    case 'cylinder': { const geo = new THREE.CylinderGeometry(pt.r, pt.r, pt.L, 24); geo.rotateX(Math.PI / 2); geo.translate(0, 0, pt.L / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
    case 'elbow': { const geo = new THREE.TorusGeometry(pt.R, pt.r, 12, 24, Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
    case 'can': { const geo = new THREE.CylinderGeometry(60, 60, 120, 24); geo.translate(0, 60, 0); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
  }
  return new THREE.Group();
}
// パターン板（縞鋼板・エキスパンド）の表現: 法線/透過を変える
function patternize(obj, pattern) {
  if (!pattern || pattern === 'general') return;
  obj.traverse(o => { if (!o.isMesh) return; if (pattern === 'expanded') { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.75; o.material.wireframe = false; } });
}
export function buildPart(pt, lod = 300) {
  let obj = null;
  try {
    if (pt.kind === 'member' || pt.kind === 'plate' || pt.kind === 'pipe') { const mat = pt.finish === 'PIPE' ? finishMaterial('PIPE') : finishMaterial(pt.material === 'SUS304' && !pt.finish?.startsWith('SUS') ? 'SUS304' : (pt.finish || 'HDZ')); obj = buildMember({ spec: pt.spec, length: pt.length, holes: pt.holes || [], lod, material: mat }); patternize(obj, pt.pattern); }
    else if (pt.kind === 'bolt') obj = hexBolt({ M: pt.M, L: pt.L, lod });
    else if (pt.kind === 'ubolt') obj = uBolt({ od: pt.od, nominal: pt.nominal, M: pt.M, plateT: pt.plateT, lod });
    else if (pt.kind === 'anchor') obj = anchorBolt({ M: pt.M, plateT: pt.plateT, lod });
    else if (pt.kind === 'rod') obj = hangerRod({ M: pt.M, L: pt.L, lod });
    else if (pt.kind === 'nut') obj = hexNut({ M: pt.M, lod });
    else if (pt.kind === 'washer') obj = flatWasher({ M: pt.M });
    else if (pt.kind === 'weld') { if (lod < 300) return null; const V = a => new THREE.Vector3(...a); obj = pt.weldType === 'butt' ? buttBead({ from: V(pt.from), to: V(pt.to), n: V(pt.n1), t: pt.size, lod }) : filletBead({ from: V(pt.from), to: V(pt.to), n1: V(pt.n1), n2: V(pt.n2), size: pt.size, lod }); if (obj) { obj.userData.part = pt; return obj; } return null; }
    else if (pt.kind === 'custom') obj = customGeometry(pt, lod);
  } catch (e) { console.warn('buildPart failed', pt, e); return null; }
  if (!obj) return null;
  if (pt.pl) obj.applyMatrix4(matrixOf(pt.pl));
  obj.userData.part = pt; if (pt.ref) obj.traverse(o => { o.userData.ref = true; });
  return obj;
}
// インスタンス全体
export function buildInstance(parts, { lod = 300, showRefs = true, showSite = true } = {}) {
  const g = new THREE.Group();
  for (const pt of parts) { if (!showRefs && pt.ref) continue; if (!showSite && pt.site) continue; const o = buildPart(pt, lod); if (o) g.add(o); }
  return g;
}
