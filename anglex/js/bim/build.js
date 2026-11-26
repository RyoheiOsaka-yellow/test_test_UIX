// parts（単一ソース）→ THREE.Group。各 part は { kind, pl:{pos,basis}, ... }。インスタンス単位の Group を返す。
import * as THREE from 'three';
import { buildMember, parseSpec, buildBentMember } from '../geo/profiles.js';
import { hexBolt, uBolt, anchorBolt, hangerRod, hexNut, flatWasher } from '../geo/fasteners.js';
import { filletBead, buttBead } from '../geo/welds.js';
import { finishMaterial, doubleSided } from '../geo/materials.js';
import { creaseNormals } from '../geo/normals.js';

function matrixOf(pl) { const [x, y, z] = pl.basis; const m = new THREE.Matrix4(); m.makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)); m.setPosition(new THREE.Vector3(...pl.pos)); return m; }
function ring(ro, ri, t, holes = [], hd = 0, seg = 48) { const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false); const p = new THREE.Path(); p.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(p); for (const [x, y] of holes) { const h = new THREE.Path(); h.absarc(x, y, hd / 2, 0, Math.PI * 2, true); s.holes.push(h); } const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: seg }); scaleUV(g); creaseNormals(g, 0.7); return g; }
// 質感の下ごしらえ: 角の小さな面取り（光の筋が出る）と、実寸に合わせた UV（材質の模様が部品の大きさに依らない）
const bevOf = (t, lod) => lod >= 300 && t >= 0.8 ? Math.min(0.5, t * 0.22) : 0;
function extrudeBeveled(shape, depth, t, lod, curveSegments = 12) { const bev = bevOf(Math.min(t, depth), lod); const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, depth - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: lod >= 400 ? 2 : 1, curveSegments }); if (bev > 0) geo.translate(0, 0, bev); scaleUV(geo); return geo; }
function scaleUV(geo, k = 130) { const uv = geo.attributes.uv; if (!uv) return geo; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / k, uv.getY(i) / k); uv.needsUpdate = true; return geo; }
// 吊バンド本体: 2つ割りの帯（半円×2）+ タン（吊り部）+ 耳（締付ボルト部）
function bandGeometry(pt, lod) {
  const g = new THREE.Group(); const mat = finishMaterial(pt.finish); const r = pt.od / 2 + (pt.rubber || 0); const t = pt.t, B = pt.B;
  const half = (a0, a1) => { const s = new THREE.Shape(); s.absarc(0, 0, r + t, a0, a1, false); s.absarc(0, 0, r, a1, a0, true); s.closePath(); const geo = extrudeBeveled(s, B, t, lod, lod >= 400 ? 40 : 24); geo.translate(0, 0, -B / 2); creaseNormals(geo, 0.6); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
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
  const geo = extrudeBeveled(s, B, t, lod, lod >= 400 ? 32 : 20); geo.translate(0, 0, -B / 2); creaseNormals(geo, 0.6); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return g;
}
// 帯（板を曲げた形）: 中心線の点列 pts（ローカル XY）を板厚 t で左右に振り、幅 B だけ Z に押し出す
function strapGeometry(pt, lod) {
  const pts = pt.pts || []; if (pts.length < 2) return new THREE.Group(); const t = pt.t || 2, B = pt.B || 25, n = pts.length, closed = !!pt.closed;
  const L = [], R = []; for (let i = 0; i < n; i++) { const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]; const c = pts[i]; const u = (p, q) => { const x = q[0] - p[0], y = q[1] - p[1]; const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }; const d1 = (closed || i > 0) ? u(a, c) : u(c, b), d2 = (closed || i < n - 1) ? u(c, b) : d1; let nx = -(d1[1] + d2[1]), ny = d1[0] + d2[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; const k = (t / 2) / Math.max(0.35, nx * -d1[1] + ny * d1[0]); L.push([c[0] + nx * k, c[1] + ny * k]); R.push([c[0] - nx * k, c[1] - ny * k]); }
  const mk = (outer, inner) => { const s = new THREE.Shape(); s.moveTo(outer[0][0], outer[0][1]); for (const q of outer.slice(1)) s.lineTo(q[0], q[1]); if (inner) { const hp = new THREE.Path(); hp.moveTo(inner[0][0], inner[0][1]); for (const q of inner.slice(1)) hp.lineTo(q[0], q[1]); hp.closePath(); s.holes.push(hp); } s.closePath(); return s; };
  const area = a => { let s = 0; for (let i = 0; i < a.length; i++) { const p = a[i], q = a[(i + 1) % a.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  let shape; if (closed) { const [o, i] = Math.abs(area(L)) > Math.abs(area(R)) ? [L, R] : [R, L]; shape = mk(o, [...i].reverse()); } else shape = mk([...L, ...[...R].reverse()]);
  const geo = extrudeBeveled(shape, B, t, lod, 4); geo.translate(0, 0, -B / 2); creaseNormals(geo, 0.6);
  const m = new THREE.Mesh(geo, finishMaterial(pt.finish || 'EZ')); m.castShadow = m.receiveShadow = true; return m;
}
// 回転体: profile = [[半径, 高さ], …] をローカル Z まわりに回す（ローラー、インサート、キャップなど）
// 回転体: 断面の折れ点は角として残し（法線を面ごとに分ける）、円周方向だけ滑らかにする
function latheGeometry(pt, lod) { const pr = (pt.profile || []).map(([r, z]) => [Math.max(0, r), z]); if (pr.length < 2) return new THREE.Group(); const seg = pt.seg || (lod >= 400 ? 56 : lod >= 300 ? 40 : 24); const flat = !!pt.seg && pt.seg <= 8; const pos = [], nor = [], uv = [], idx = []; let v0 = 0, run = 0;
  for (let i = 0; i < pr.length - 1; i++) { const [r0, z0] = pr[i], [r1, z1] = pr[i + 1]; const dl = Math.hypot(r1 - r0, z1 - z0); if (dl < 1e-6) continue; const nr = (z1 - z0) / dl, nz = -(r1 - r0) / dl;
    for (let j = 0; j <= seg; j++) { const a = j / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); let ca = c, sa = s; if (flat) { const am = (Math.floor(Math.min(j, seg - 1)) + 0.5) / seg * Math.PI * 2; ca = Math.cos(am); sa = Math.sin(am); }
      pos.push(r0 * c, r0 * s, z0, r1 * c, r1 * s, z1); nor.push(nr * ca, nr * sa, nz, nr * ca, nr * sa, nz); const u = a * Math.max(r0, r1, 4) / 130; uv.push(u, run / 130, u, (run + dl) / 130); }
    for (let j = 0; j < seg; j++) { const a = v0 + j * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, c2, b, b, c2, d); } v0 += (seg + 1) * 2; run += dl; }
  if (flat) { const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); const ni = g2.toNonIndexed(); ni.computeVertexNormals(); const mat = doubleSided(pt.finish || 'EZ'); const m = new THREE.Mesh(ni, mat); m.castShadow = m.receiveShadow = true; return m; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = doubleSided(pt.finish || 'EZ'); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; }
// 曲げ棒・ワイヤ: 点列 pts（ローカル XYZ）に沿って半径 r の丸棒を通す
function sweepGeometry(pt, lod) { const v = (pt.pts || []).map(a => new THREE.Vector3(a[0], a[1], a[2] || 0)); if (v.length < 2) return new THREE.Group(); const path = new THREE.CurvePath(); for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1])); if (pt.closed) path.add(new THREE.LineCurve3(v[v.length - 1], v[0]));
  const g = new THREE.Group(); const mat = finishMaterial(pt.finish || 'EZ'); const r = pt.r || 3; const seg = lod >= 400 ? 12 : 8;
  for (let i = 0; i < v.length - (pt.closed ? 0 : 1); i++) { const a = v[i], b = v[(i + 1) % v.length]; const len = a.distanceTo(b); if (len < 1e-6) continue; const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, true); const m = new THREE.Mesh(geo, mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; g.add(m); const sp = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 6), mat); sp.position.copy(b); g.add(sp); }
  if (!pt.closed) { const sp = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 6), mat); sp.position.copy(v[0]); g.add(sp); } return g; }
// 台形ブロック: 下面 w1×d1（z=0）、上面 w2×d2（z=h）。基礎ブロックなど
function frustumGeometry(pt) { const { w1, d1, w2 = w1, d2 = d1, h } = pt; const P = [[-w1 / 2, -d1 / 2, 0], [w1 / 2, -d1 / 2, 0], [w1 / 2, d1 / 2, 0], [-w1 / 2, d1 / 2, 0], [-w2 / 2, -d2 / 2, h], [w2 / 2, -d2 / 2, h], [w2 / 2, d2 / 2, h], [-w2 / 2, d2 / 2, h]]; const F = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]; const pos = []; for (const f of F) for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...P[f[i]]); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); const uvs = []; for (let i = 0; i < pos.length; i += 3) uvs.push((pos[i] + pos[i + 1]) / 400, (pos[i + 2] + pos[i + 1] * 0.5) / 400); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); const m = new THREE.Mesh(geo, finishMaterial(pt.finish || 'CONCRETE')); m.castShadow = m.receiveShadow = true; return m; }
function customGeometry(pt, lod) {
  const mat = finishMaterial(pt.finish || 'HDZ');
  switch (pt.custom) {
    case 'strap': return strapGeometry(pt, lod);
    case 'lathe': return latheGeometry(pt, lod);
    case 'sweep': return sweepGeometry(pt, lod);
    case 'frustum': return frustumGeometry(pt);
    case 'ring': { const m = new THREE.Mesh(ring(pt.ro, pt.ri, pt.t, pt.holes || [], pt.holeD || 0), mat); m.castShadow = m.receiveShadow = true; return m; }
    case 'band': return bandGeometry(pt, lod);
    case 'uband': return ubandGeometry(pt, lod);
    case 'box': { const g = new THREE.Group(); const s = new THREE.Shape(); s.moveTo(-pt.w / 2, -pt.d / 2); s.lineTo(pt.w / 2, -pt.d / 2); s.lineTo(pt.w / 2, pt.d / 2); s.lineTo(-pt.w / 2, pt.d / 2); s.closePath(); if (pt.hole) { const h = new THREE.Path(); h.absarc(0, 0, pt.hole / 2, 0, Math.PI * 2, true); s.holes.push(h); } const geo = extrudeBeveled(s, pt.h, Math.min(pt.w, pt.d, pt.h), lod, 24); creaseNormals(geo, 0.6); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return g; }
    case 'cylinder': { const geo = new THREE.CylinderGeometry(pt.r, pt.r, pt.L, lod >= 300 ? 40 : 24); geo.rotateX(Math.PI / 2); geo.translate(0, 0, pt.L / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
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
    if (pt.kind === 'member' || pt.kind === 'plate' || pt.kind === 'pipe') { const mat = pt.finish === 'PIPE' ? finishMaterial('PIPE') : finishMaterial(pt.material === 'SUS304' && !pt.finish?.startsWith('SUS') ? 'SUS304' : (pt.finish || 'HDZ')); obj = (pt.bentView && pt.bends?.length ? (o => buildBentMember(o, pt.bends)) : buildMember)({ spec: pt.spec, length: pt.length, holes: pt.holes || [], notches: pt.notches || null, cuts: pt.cuts || null, lod, material: mat }); patternize(obj, pt.pattern); }
    else if (pt.kind === 'bolt') obj = hexBolt({ M: pt.M, L: pt.L, lod, nut: !pt.noNut });
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
