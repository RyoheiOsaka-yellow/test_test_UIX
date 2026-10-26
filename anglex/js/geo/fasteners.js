// 締結部品: 六角ボルト・ナット・座金・ばね座金・Uボルト・アンカーボルト・吊りボルト（JIS寸法）
import * as THREE from 'three';
import { BOLTS, UBOLTS, ANCHORS, DENSITY } from '../data/sections.js';
import { finishMaterial } from './materials.js';

const RHO = DENSITY.SS400 / 1e6; // kg/mm3 → ×1000 → g; 使用: mass_kg = vol_mm3 * 7.85e-6

export function boltDims(M) { const b = BOLTS[M] || BOLTS['M' + M] || BOLTS.M12; return { ...b, M: b.alias ? M : M }; }

// 六角プリズム（30° 円錐面取り = 実物のワッシャーフェイス）: 二面幅 s, 高さ h, 中心穴 bore。辺中点（内接円上）を追加し角頂点を下げて面取りを表現
function hexPrism(s, h, bore = 0, lod = 300, { topChamfer = true, bottomChamfer = false } = {}) {
  const R = s / Math.sqrt(3), ri = s / 2; const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, am = a + Math.PI / 6; const x = Math.cos(a) * R, y = Math.sin(a) * R; i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y); shape.lineTo(Math.cos(am) * ri, Math.sin(am) * ri); } shape.closePath();
  if (bore > 0) { const p = new THREE.Path(); p.absarc(0, 0, bore / 2, 0, Math.PI * 2, true); shape.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 16 });
  if (lod >= 300) { const pos = geo.attributes.position; const dz = (R - ri) * Math.tan(Math.PI / 6) * 0.9; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const r = Math.hypot(x, y); if (r > ri + 0.05) { const k = (r - ri) / (R - ri); if (topChamfer && z > h - 1e-6) pos.setZ(i, h - dz * k); else if (bottomChamfer && z < 1e-6) pos.setZ(i, dz * k); } } pos.needsUpdate = true; geo.deleteAttribute('normal'); geo.computeVertexNormals(); }
  else geo.computeVertexNormals();
  return geo;
}
function ring(ro, ri, t, seg = 32) { const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false); const p = new THREE.Path(); p.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(p); const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg }); g.computeVertexNormals(); return g; }
// ねじ部: LOD400 は実際の螺旋ねじ山（三角ねじ、JIS ピッチ）。それ以外は法線マップ縞
function threadCyl(d, L, pitch, lod) {
  if (lod >= 400 && L > 0) {
    const rMaj = d / 2, depth = Math.min(0.613 * pitch, rMaj * 0.35), rMin = rMaj - depth; const seg = L > 300 ? 24 : 36; const rings = Math.max(2, Math.ceil(L / pitch * (L > 300 ? 4 : 6))); const geo = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rings; j++) { const z = L * j / rings; for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2; const ph = ((z / pitch - th / (Math.PI * 2)) % 1 + 1) % 1; const f = 1 - Math.abs(ph - 0.5) * 2; let r = rMin + depth * f; if (z < pitch * 0.6) r = Math.min(r, rMin + depth * (z / (pitch * 0.6))); if (z > L - pitch * 0.6) r = Math.min(r, rMin + depth * ((L - z) / (pitch * 0.6))); pos.push(Math.cos(th) * r, Math.sin(th) * r, z); uv.push(i / seg, z / pitch); } }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  const g = new THREE.CylinderGeometry(d / 2, d / 2, L, 16, 1, false); g.rotateX(Math.PI / 2); g.translate(0, 0, L / 2);
  const uv = g.attributes.uv; const turns = L / pitch; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * turns); return g;
}
// 六角ボルト（軸は +Z、頭が z<0 側、座面 z=0）  grip: 締結板厚合計 → ナット位置を自動
export function hexBolt({ M = 'M12', L = 40, grip = null, washer = true, nut = true, springWasher = false, lod = 300, finish = 'BOLT' } = {}) {
  const b = boltDims(M); const g = new THREE.Group(); g.name = `${M}×${L} 六角ボルト`;
  const matB = finishMaterial(finish), matT = lod >= 400 ? finishMaterial('BOLT') : finishMaterial('THREAD');
  const head = new THREE.Mesh(hexPrism(b.s, b.k, 0, lod, { topChamfer: true }), matB); head.rotation.y = Math.PI; head.position.z = 0; head.userData.part = 'head'; g.add(head);
  // 頭は z: -k..0 に置く
  head.position.z = 0; head.rotation.set(0, Math.PI, 0); // extrude +z → flip so it occupies -k..0
  if (washer) { const w = new THREE.Mesh(ring(b.wo / 2, b.wi / 2, b.wt), matB); w.position.z = 0; w.userData.part = 'washer'; g.add(w); }
  const z0 = washer ? b.wt : 0;
  const shankL = Math.max(L - (grip != null ? 0 : 0), 10);
  const threadStart = lod >= 300 ? Math.max(0, L - Math.min(L, 2 * b.d + 12)) : L; // 不完全ねじ部を省略し先端側をねじ
  if (threadStart > 0) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2, b.d / 2, threadStart, lod >= 400 ? 32 : 16).rotateX(Math.PI / 2).translate(0, 0, threadStart / 2), matB); sh.userData.part = 'shank'; g.add(sh); }
  const th = new THREE.Mesh(threadCyl(b.d, L - threadStart, b.p, lod), matT); th.position.z = threadStart; th.userData.part = 'thread'; g.add(th);
  // 先端面取り
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2 * 0.72, b.d / 2, b.d * 0.12, 16).rotateX(Math.PI / 2), matB); tip.position.z = L + b.d * 0.06; g.add(tip);
  const gripLen = grip != null ? grip : Math.max(0, L - b.m - b.wt - 2 * b.p);
  let z = z0 + gripLen;
  if (nut) {
    if (washer) { const w2 = new THREE.Mesh(ring(b.wo / 2, b.wi / 2, b.wt), matB); w2.position.z = z; w2.userData.part = 'washer'; g.add(w2); z += b.wt; }
    if (springWasher) { const sw = new THREE.Mesh(ring(b.d / 2 + b.sw, b.wi / 2, b.sw), matB); sw.position.z = z; sw.userData.part = 'springWasher'; g.add(sw); z += b.sw; }
    const n = new THREE.Mesh(hexPrism(b.s, b.m, b.d * 0.98, lod, { topChamfer: true, bottomChamfer: true }), matB); n.position.z = z; n.userData.part = 'nut'; g.add(n);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  g.userData = { kind: 'bolt', M, L, mass: boltMass(M, L, { washer: washer ? (nut ? 2 : 1) : 0, nut: nut ? 1 : 0, springWasher: springWasher ? 1 : 0 }) };
  return g;
}
export function boltMass(M, L, { washer = 2, nut = 1, springWasher = 0 } = {}) {
  const b = boltDims(M); const R = b.s / Math.sqrt(3);
  const hexArea = 3 * Math.sqrt(3) / 2 * R * R;
  const head = hexArea * b.k, shank = Math.PI * b.d * b.d / 4 * L * 0.94; // ねじ部の体積減少を考慮
  const nutV = (hexArea - Math.PI * b.d * b.d / 4) * b.m * nut;
  const wV = Math.PI * (b.wo * b.wo - b.wi * b.wi) / 4 * b.wt * washer;
  const swV = Math.PI * (Math.pow(b.d / 2 + b.sw, 2) - Math.pow(b.wi / 2, 2)) * b.sw * springWasher;
  return (head + shank + nutV + wV + swV) * 7.85e-6; // kg
}
export function hexNut({ M = 'M12', lod = 300 } = {}) { const b = boltDims(M); const m = new THREE.Mesh(hexPrism(b.s, b.m, b.d * 0.98, lod, { topChamfer: true, bottomChamfer: true }), finishMaterial('BOLT')); m.castShadow = m.receiveShadow = true; m.userData = { kind: 'nut', M, mass: (3 * Math.sqrt(3) / 2 * Math.pow(b.s / Math.sqrt(3), 2) - Math.PI * b.d * b.d / 4) * b.m * 7.85e-6 }; return m; }
export function flatWasher({ M = 'M12' } = {}) { const b = boltDims(M); const m = new THREE.Mesh(ring(b.wo / 2, b.wi / 2, b.wt), finishMaterial('BOLT')); m.castShadow = m.receiveShadow = true; m.userData = { kind: 'washer', M, mass: Math.PI * (b.wo * b.wo - b.wi * b.wi) / 4 * b.wt * 7.85e-6 }; return m; }

// Uボルト: 配管外径 od を抱く。U の平面は XY、脚は -Y 方向へ伸び、脚先端が y=0（取付面）… 取付板厚 plateT を貫通してナット締め
// 原点 = 2脚の中点（取付面上）。配管中心は (0, od/2 + c, 0)
export function uBolt({ od = 60.5, nominal = null, M = null, plateT = 6, legExtra = 25, lod = 300, finish = 'BOLT' } = {}) {
  const spec = nominal && UBOLTS[nominal]; M = M || (spec ? spec.M : (od < 50 ? 'W3/8' : od < 120 ? 'W1/2' : od < 230 ? 'W5/8' : 'W3/4'));
  const b = boltDims(M); const c = spec ? spec.c : 3; const R = od / 2 + c + b.d / 2; // 脚中心半径
  const g = new THREE.Group(); g.name = `Uボルト ${M}（${nominal || 'φ' + od}）`;
  const matB = finishMaterial(finish), matT = lod >= 400 ? finishMaterial('BOLT') : finishMaterial('THREAD');
  const cy = od / 2 + c; // 配管中心高さ
  const arc = new THREE.Mesh(new THREE.TorusGeometry(R, b.d / 2, lod >= 400 ? 16 : 10, lod >= 400 ? 48 : 28, Math.PI), matB); arc.position.set(0, cy, 0); arc.userData.part = 'arc'; g.add(arc);
  const legLen = cy + plateT + legExtra; // 配管中心高さから板下面+余長まで
  const threadLen = Math.min(legLen, plateT + legExtra + b.d); // 下端からねじ
  for (const sx of [-1, 1]) {
    const plain = legLen - threadLen; if (plain > 0) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2, b.d / 2, plain, 16), matB); leg.position.set(sx * R, cy - plain / 2, 0); g.add(leg); }
    const th = new THREE.Mesh(threadCyl(b.d, threadLen, b.p, lod), matT); th.rotation.x = Math.PI / 2; th.position.set(sx * R, cy - plain, 0); th.rotation.set(Math.PI / 2, 0, 0); g.add(th);
    // 板下面にナット＋座金（板は y: 0 .. -plateT）
    const w = new THREE.Mesh(ring(b.wo / 2, b.wi / 2, b.wt), matB); w.rotation.x = Math.PI / 2; w.position.set(sx * R, -plateT, 0); g.add(w);
    const n = new THREE.Mesh(hexPrism(b.s, b.m, b.d * 0.98, lod, { topChamfer: true, bottomChamfer: true }), matB); n.rotation.x = Math.PI / 2; n.position.set(sx * R, -plateT - b.wt, 0); g.add(n);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2, b.d / 2 * 0.72, b.d * 0.12, 16), matB); tip.position.set(sx * R, cy - legLen - b.d * 0.06, 0); g.add(tip);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  const rodLen = Math.PI * R + 2 * legLen; const mass = Math.PI * b.d * b.d / 4 * rodLen * 7.85e-6 + 2 * (boltMass(M, 0, { washer: 1, nut: 1 }));
  g.userData = { kind: 'ubolt', M, od, R, legLen, mass, holeD: b.hole, holePitch: 2 * R };
  return g;
}

// あと施工アンカー（芯棒打込み式）: 取付面 z=0、コンクリート内は z<0、突出部 z>0 にナット・座金
export function anchorBolt({ M = 'M12', plateT = 9, lod = 300 } = {}) {
  const a = ANCHORS[M] || ANCHORS.M12; const b = boltDims(M); const g = new THREE.Group(); g.name = `アンカーボルト ${M}`;
  const matB = finishMaterial('BOLT'), matT = lod >= 400 ? finishMaterial('BOLT') : finishMaterial('THREAD');
  const embed = new THREE.Mesh(new THREE.CylinderGeometry(a.hole / 2 * 0.98, a.hole / 2 * 0.98, a.depth, 16).rotateX(Math.PI / 2).translate(0, 0, -a.depth / 2), finishMaterial('EZ')); g.add(embed);
  const proj = plateT + b.wt + b.m + 2 * b.p + 3; const th = new THREE.Mesh(threadCyl(b.d, proj, b.p, lod), matT); g.add(th);
  const w = new THREE.Mesh(ring(b.wo / 2, b.wi / 2, b.wt), matB); w.position.z = plateT; g.add(w);
  const sw = new THREE.Mesh(ring(b.d / 2 + b.sw, b.wi / 2, b.sw), matB); sw.position.z = plateT + b.wt; g.add(sw);
  const n = new THREE.Mesh(hexPrism(b.s, b.m, b.d * 0.98, lod, { topChamfer: true, bottomChamfer: true }), matB); n.position.z = plateT + b.wt + b.sw; g.add(n);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.userData = { kind: 'anchor', M, mass: boltMass(M, a.L, { washer: 1, nut: 1, springWasher: 1 }), holeD: a.hole };
  return g;
}
// 吊りボルト（全ねじ）+ ダブルナット
export function hangerRod({ M = 'W3/8', L = 500, nuts = 2, lod = 300 } = {}) {
  const b = boltDims(M); const g = new THREE.Group(); g.name = `吊りボルト ${M}×${L}`;
  const th = new THREE.Mesh(threadCyl(b.d, L, b.p, lod), lod >= 400 ? finishMaterial('BOLT') : finishMaterial('THREAD')); g.add(th);
  for (let i = 0; i < nuts; i++) { const n = new THREE.Mesh(hexPrism(b.s, b.m, b.d * 0.98, lod, { topChamfer: true, bottomChamfer: true }), finishMaterial('BOLT')); n.position.z = L - (i + 1) * (b.m + 1) - 2; g.add(n); }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.userData = { kind: 'rod', M, L, mass: Math.PI * b.d * b.d / 4 * L * 7.85e-6 * 0.94 + nuts * hexNut({ M }).userData.mass };
  return g;
}
