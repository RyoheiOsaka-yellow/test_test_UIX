// 精密部品ジオメトリ: 2.5D 積層押出し（輪郭ごとに面取り量を指定・キャップを明示して水密なソリッドにする）、
// 旋盤形状（Lathe + 実螺旋ねじ + パラメトリックなキー溝）、板金（曲げ R の 90° 回転体 + 板）
// 単位 mm。Y 上向き。平面座標 (x, p) は p = −Z（図面の上 = 奥）
import * as THREE from 'three';
import { finishMaterial } from 'inspect/geo/materials.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const W = (x, p, y) => V3(x, y, -p); // 平面座標 (x, p) + 高さ y → ワールド

// ---------- 輪郭ジェネレータ: pts(d) は「ソリッドを d だけ太らせた」輪郭（穴は d だけ縮む）。CCW（平面座標） ----------
function arcPts(cx, cp, r, a0, a1, n, out) { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cp + r * Math.sin(a)]); } }
export const C = {
  rrect(w, h, r, { n = 14 } = {}) { return { kind: 'rrect', w, h, r, pts(d = 0) { const W2 = w / 2 + d, H2 = h / 2 + d, R = Math.max(0.01, r + d); const o = []; arcPts(W2 - R, -H2 + R, R, -Math.PI / 2, 0, n, o); arcPts(W2 - R, H2 - R, R, 0, Math.PI / 2, n, o); arcPts(-W2 + R, H2 - R, R, Math.PI / 2, Math.PI, n, o); arcPts(-W2 + R, -H2 + R, R, Math.PI, Math.PI * 1.5, n, o); return o; } }; },
  rect(w, h, { cx = 0, cp = 0 } = {}) { return { kind: 'rect', w, h, cx, cp, pts(d = 0) { const W2 = w / 2 + d, H2 = h / 2 + d; return [[cx + W2, cp - H2], [cx + W2, cp + H2], [cx - W2, cp + H2], [cx - W2, cp - H2]]; } }; },
  circ(cx, cp, r, { n = null } = {}) { const seg = n || Math.max(48, Math.min(128, Math.round(r * 6))); return { kind: 'circ', cx, cp, r, n: seg, pts(d = 0) { const o = []; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; o.push([cx + (r + d) * Math.cos(a), cp + (r + d) * Math.sin(a)]); } return o; } }; },
  // 長穴（スタジアム）: 幅 w、全長 len（両端の半円を含む）、角度 ang（長手方向）
  stadium(cx, cp, w, len, ang = 0, { n = 16 } = {}) { return { kind: 'stadium', cx, cp, w, len, ang, pts(d = 0) { const R = w / 2 + d, L = (len - w) / 2; const o = []; arcPts(L, 0, R, -Math.PI / 2, Math.PI / 2, n, o); arcPts(-L, 0, R, Math.PI / 2, Math.PI * 1.5, n, o); const c = Math.cos(ang), s = Math.sin(ang); return o.map(([x, y]) => [cx + x * c - y * s, cp + x * s + y * c]); } }; },
  hole(c) { return { ...c, hole: true, base: c, pts(d = 0) { return c.pts(-d).slice().reverse(); } }; },
};

// ---------- 三角形バッファ ----------
class Tris { constructor() { this.pos = []; } tri(a, b, c, want = null) { if (want) { const n = V3().subVectors(b, a).cross(V3().subVectors(c, a)); if (n.dot(want) < 0) { const t = b; b = c; c = t; } } this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); } quad(a, b, c, d, want = null) { this.tri(a, b, c, want); this.tri(a, c, d, want); }
  geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); return g; } }

// 平面輪郭の側壁: y0（オフセット d0）→ y1（オフセット d1）。CCW 外形なら外向き、穴（CW）なら穴側向きの法線
function wall(T, contour, y0, y1, d0 = 0, d1 = 0, skip = null) {
  const A = contour.pts(d0), B = contour.pts(d1); const n = A.length;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (skip && skip(A[i], A[j])) continue; const a = W(A[i][0], A[i][1], y0), b = W(A[j][0], A[j][1], y0), c = W(B[j][0], B[j][1], y1), d = W(B[i][0], B[i][1], y1); T.tri(a, b, c); T.tri(a, c, d); }
}
// キャップ: outer [contour, d]、holes [[contour, d], ...]。up=true なら +Y 向き
function cap(T, y, up, outer, holes = []) {
  const O = outer[0].pts(outer[1]).map(p => new THREE.Vector2(p[0], p[1])); const H = holes.map(([c, d]) => c.pts(d).map(p => new THREE.Vector2(p[0], p[1])));
  const tris = THREE.ShapeUtils.triangulateShape(O, H); const all = O.concat(...H); const want = V3(0, up ? 1 : -1, 0);
  for (const [a, b, c] of tris) T.tri(W(all[a].x, all[a].y, y), W(all[b].x, all[b].y, y), W(all[c].x, all[c].y, y), want);
}
// 層: y0..y1、外形 + 穴、面取り cb（下）/ct（上）は数値 or { outer, holes:[...] }
function layer(T, { y0, y1, outer, holes = [], cb = 0, ct = 0, skip = null }) {
  const cOf = (c, i) => typeof c === 'number' ? c : (i < 0 ? (c.outer || 0) : ((c.holes || [])[i] ?? c.def ?? 0));
  const one = (contour, i, sk) => { const b = cOf(cb, i), t = cOf(ct, i); if (b > 0) wall(T, contour, y0, y0 + b, -b, 0, sk); wall(T, contour, y0 + b, y1 - t, 0, 0, sk); if (t > 0) wall(T, contour, y1 - t, y1, 0, -t, sk); };
  one(outer, -1, skip); holes.forEach((hc, i) => one(hc, i, null));
}
// 穴底のドリル先端（118°）
function drillPoint(T, cx, cp, r, yTop, { angle = 118 } = {}) { const h = r / Math.tan(angle / 2 * Math.PI / 180); const n = 48; const apex = W(cx, cp, yTop - h); for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; T.tri(apex, W(cx + r * Math.cos(a0), cp + r * Math.sin(a0), yTop), W(cx + r * Math.cos(a1), cp + r * Math.sin(a1), yTop), V3(0, 1, 0)); } }

// ---------- 折れ角しきい値付きの法線（円筒は滑らかに、面取り・段差はシャープに） ----------
export function creaseNormals(geo, creaseDeg = 30) {
  if (geo.index) geo = geo.toNonIndexed(); const pos = geo.attributes.position; const n = pos.count; const fn = new Float32Array(n * 3); const faceN = [];
  const a = V3(), b = V3(), c = V3(), ab = V3(), ac = V3();
  for (let i = 0; i < n; i += 3) { a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2); ab.subVectors(b, a); ac.subVectors(c, a); const N = ab.cross(ac); const l = N.length() || 1; faceN.push(N.x / l, N.y / l, N.z / l); }
  const map = new Map(); const key = i => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  for (let i = 0; i < n; i++) { const k = key(i); let l = map.get(k); if (!l) map.set(k, l = []); l.push(i); }
  const cosT = Math.cos(creaseDeg * Math.PI / 180);
  for (let i = 0; i < n; i++) { const f = (i / 3) | 0; const fx = faceN[f * 3], fy = faceN[f * 3 + 1], fz = faceN[f * 3 + 2]; let x = 0, y = 0, z = 0; for (const j of map.get(key(i))) { const g = (j / 3) | 0; const gx = faceN[g * 3], gy = faceN[g * 3 + 1], gz = faceN[g * 3 + 2]; if (fx * gx + fy * gy + fz * gz >= cosT) { x += gx; y += gy; z += gz; } } const l = Math.hypot(x, y, z) || 1; fn[i * 3] = x / l; fn[i * 3 + 1] = y / l; fn[i * 3 + 2] = z / l; }
  geo.setAttribute('normal', new THREE.BufferAttribute(fn, 3)); return geo;
}
// 押出し形状の UV（mm 単位の三面投影）: 材質テクスチャ用
function boxUV(geo) { const p = geo.attributes.position, nrm = geo.attributes.normal; const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i)); let u, v; if (ny >= nx && ny >= nz) { u = p.getX(i); v = p.getZ(i); } else if (nx >= nz) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); } uv[i * 2] = u; uv[i * 2 + 1] = v; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo; }
// 回転体の UV（u = 円周方向の長さ mm、v = 軸方向 mm）
function cylUV(geo) { const p = geo.attributes.position; const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z); uv[i * 2] = Math.atan2(z, x) * r; uv[i * 2 + 1] = p.getY(i); } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo; }
function finish(T, material, name) { const g = boxUV(creaseNormals(T.geometry(), 32)); const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; m.name = name; return m; }

// ======================================================================
// 1) ベアリングハウジング（A6061-T6 切削）
// ======================================================================
export function buildHousing(P) {
  const { L, Wd, T, bossD, H, seatD, seatDepth, throughD, grooveD, grooveW, grooveY, mountD, cboreD, cboreDepth, pitchX, pitchY, dowelD, dowelPitch, tapDrill, tapPCD, tapDepth, cornerR, c, seatC } = P;
  const Tr = new Tris();
  const outer = C.rrect(L, Wd, cornerR); const rb = bossD / 2;
  const mounts = [[pitchX / 2, pitchY / 2], [-pitchX / 2, pitchY / 2], [-pitchX / 2, -pitchY / 2], [pitchX / 2, -pitchY / 2]];
  const dowels = [[dowelPitch / 2, 0], [-dowelPitch / 2, 0]];
  const taps = [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2; return [tapPCD / 2 * Math.cos(a), tapPCD / 2 * Math.sin(a)]; });
  const hM = mounts.map(([x, p]) => C.hole(C.circ(x, p, mountD / 2))), hCB = mounts.map(([x, p]) => C.hole(C.circ(x, p, cboreD / 2))), hD = dowels.map(([x, p]) => C.hole(C.circ(x, p, dowelD / 2)));
  const bore = C.hole(C.circ(0, 0, throughD / 2, { n: 96 })), seat = C.hole(C.circ(0, 0, seatD / 2, { n: 96 })), groove = C.hole(C.circ(0, 0, grooveD / 2, { n: 96 })), boss = C.circ(0, 0, rb, { n: 128 }), bossHole = C.hole(boss);
  const hT = taps.map(([x, p]) => C.hole(C.circ(x, p, tapDrill / 2, { n: 32 })));
  const yCB = T - cboreDepth, ySeat = H - seatDepth, yG0 = grooveY, yG1 = grooveY + grooveW, yTap = H - tapDepth;
  // A1: フランジ下層（取付穴 φ9・ノック穴・貫通穴）
  layer(Tr, { y0: 0, y1: yCB, outer, holes: [...hM, ...hD, bore], cb: c, ct: 0 });
  cap(Tr, 0, false, [outer, -c], [...hM, ...hD, bore].map(h => [h, -c]));
  for (let i = 0; i < 4; i++) cap(Tr, yCB, true, [hCB[i].base, 0], [[hM[i], 0]]); // ザグリ底
  // A2: フランジ上層（ザグリ φ15）
  layer(Tr, { y0: yCB, y1: T, outer, holes: [...hCB, ...hD, bore], cb: 0, ct: { outer: c, holes: [c, c, c, c, c, c, 0] } });
  cap(Tr, T, true, [outer, -c], [...hCB.map(h => [h, -c]), ...hD.map(h => [h, -c]), [bossHole, 0]]);
  // B: ボス（貫通穴部）
  layer(Tr, { y0: T, y1: ySeat, outer: boss, holes: [bore] });
  cap(Tr, ySeat, true, [seat.base, 0], [[bore, 0]]); // 軸受座の底（段）
  // C: 軸受座（溝の下）
  layer(Tr, { y0: ySeat, y1: yG0, outer: boss, holes: [seat] });
  cap(Tr, yG0, true, [groove.base, 0], [[seat, 0]]); // 止め輪溝 下フランク
  // D: 止め輪溝
  layer(Tr, { y0: yG0, y1: yG1, outer: boss, holes: [groove] });
  cap(Tr, yG1, false, [groove.base, 0], [[seat, 0]]); // 溝 上フランク
  // E1: 溝の上〜タップ底
  layer(Tr, { y0: yG1, y1: yTap, outer: boss, holes: [seat] });
  for (const [x, p] of taps) drillPoint(Tr, x, p, tapDrill / 2, yTap);
  // E2: 上面（M4 タップ下穴 ×4）
  layer(Tr, { y0: yTap, y1: H, outer: boss, holes: [seat, ...hT], ct: { outer: c, holes: [seatC, c, c, c, c] } });
  cap(Tr, H, true, [boss, -c], [[seat, -seatC], ...hT.map(h => [h, -c])]);
  const mesh = finish(Tr, finishMaterial('AL'), 'housing'); const g = new THREE.Group(); g.add(mesh); g.name = 'ベアリングハウジング';
  // 特徴（検査項目の 3D アンカー）
  const F = {};
  F.lengthX = { kind: 'dist', a: W(-L / 2, -Wd / 2 - 6, 0), b: W(L / 2, -Wd / 2 - 6, 0), label: W(0, -Wd / 2 - 8, 2) };
  F.widthY = { kind: 'dist', a: W(L / 2 + 6, -Wd / 2, 0), b: W(L / 2 + 6, Wd / 2, 0), label: W(L / 2 + 8, 0, 2) };
  F.flangeT = { kind: 'dist', a: W(L / 2 + 3, Wd / 2 + 3, 0), b: W(L / 2 + 3, Wd / 2 + 3, T), label: W(L / 2 + 6, Wd / 2 + 6, T / 2) };
  F.height = { kind: 'dist', a: W(-rb - 6, 0, 0), b: W(-rb - 6, 0, H), label: W(-rb - 9, 0, H / 2) };
  F.bossOD = { kind: 'cyl', c: W(0, 0, T), r: rb, h: H - T, side: 'out', label: W(rb, 0, (H + T) / 2) };
  F.seat = { kind: 'cyl', c: W(0, 0, ySeat), r: seatD / 2, h: seatDepth, side: 'in', label: W(0, 0, H + 2) };
  F.seatDepth = { kind: 'dist', a: W(seatD / 2 - 2, 0, ySeat), b: W(seatD / 2 - 2, 0, H), label: W(seatD / 2 + 1, 0, H - seatDepth / 2) };
  F.through = { kind: 'cyl', c: W(0, 0, 0), r: throughD / 2, h: ySeat, side: 'in', label: W(0, 0, -2) };
  F.grooveD = { kind: 'cyl', c: W(0, 0, yG0), r: grooveD / 2, h: grooveW, side: 'in', label: W(0, grooveD / 2 + 1, yG0) };
  F.grooveW = { kind: 'dist', a: W(0, seatD / 2 + 0.5, yG0), b: W(0, seatD / 2 + 0.5, yG1), label: W(0, seatD / 2 + 2, yG1 + 1) };
  F.grooveY = { kind: 'dist', a: W(0, -seatD / 2 - 0.5, 0), b: W(0, -seatD / 2 - 0.5, yG0), label: W(0, -seatD / 2 - 2, yG0 / 2) };
  F.mount = { kind: 'cyls', items: mounts.map(([x, p]) => ({ c: W(x, p, 0), r: mountD / 2, h: yCB })), side: 'in', label: W(mounts[0][0], mounts[0][1], -2) };
  F.cbore = { kind: 'cyls', items: mounts.map(([x, p]) => ({ c: W(x, p, yCB), r: cboreD / 2, h: cboreDepth })), side: 'in', label: W(mounts[1][0], mounts[1][1], T + 2) };
  F.cboreDepth = { kind: 'dist', a: W(mounts[0][0] + cboreD / 2, mounts[0][1], yCB), b: W(mounts[0][0] + cboreD / 2, mounts[0][1], T), label: W(mounts[0][0] + cboreD / 2 + 3, mounts[0][1], T) };
  F.pitchX = { kind: 'dist', a: W(-pitchX / 2, pitchY / 2, T), b: W(pitchX / 2, pitchY / 2, T), label: W(0, pitchY / 2 + 3, T + 1) };
  F.pitchY = { kind: 'dist', a: W(pitchX / 2, -pitchY / 2, T), b: W(pitchX / 2, pitchY / 2, T), label: W(pitchX / 2 + 3, 0, T + 1) };
  F.dowel = { kind: 'cyls', items: dowels.map(([x, p]) => ({ c: W(x, p, 0), r: dowelD / 2, h: T })), side: 'in', label: W(dowels[0][0], dowels[0][1], T + 2) };
  F.dowelPitch = { kind: 'dist', a: W(-dowelPitch / 2, 0, T), b: W(dowelPitch / 2, 0, T), label: W(0, -6, T + 1), skipMid: rb + 2 };
  F.tap = { kind: 'cyls', items: taps.map(([x, p]) => ({ c: W(x, p, yTap), r: tapDrill / 2, h: tapDepth })), side: 'in', label: W(taps[0][0], taps[0][1], H + 2) };
  F.cornerR = { kind: 'cyl', c: W(L / 2 - cornerR, -Wd / 2 + cornerR, 0), r: cornerR, h: T, side: 'out', arc: [-Math.PI / 2, 0], label: W(L / 2, -Wd / 2, T + 1) };
  F.seatChamfer = { kind: 'cyl', c: W(0, 0, H - seatC), r: seatD / 2 + seatC / 2, h: seatC, side: 'in', label: W(-seatD / 2, 0, H + 1) };
  F.bottom = { kind: 'plane', c: W(0, 0, 0), n: V3(0, -1, 0), w: L, h: Wd, label: W(-L / 4, 0, -1) };
  F.top = { kind: 'plane', c: W(0, 0, H), n: V3(0, 1, 0), w: bossD, h: bossD, round: true, label: W(0, -rb / 2, H + 1) };
  F.seatRa = { kind: 'cyl', c: W(0, 0, ySeat), r: seatD / 2, h: seatDepth, side: 'in', label: W(0, 0, H + 4) };
  return { group: g, features: F, mesh, size: { x: L, y: H, z: Wd } };
}

// ======================================================================
// 2) 段付きシャフト（S45C 研磨）: Lathe + 実螺旋ねじ + キー溝（エンドミル形状）+ センター穴
// ======================================================================
function threadMesh({ rMaj, L, pitch, seg = 72, y0 = 0 }) {
  const depth = Math.min(0.613 * pitch, rMaj * 0.35), rMin = rMaj - depth; const rings = Math.max(4, Math.ceil(L / pitch * 8)); const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) { const z = L * j / rings; for (let i = 0; i <= seg; i++) { const th = i / seg * Math.PI * 2; const ph = ((z / pitch - th / (Math.PI * 2)) % 1 + 1) % 1; let f = 1 - Math.abs(ph - 0.5) * 2; f = Math.min(1, f * 1.15); let r = rMin + depth * f; if (z < pitch * 0.8) r = Math.min(r, rMin + depth * (z / (pitch * 0.8))); pos.push(Math.cos(th) * r, y0 + z, Math.sin(th) * r); uv.push(i / seg * 4, z / pitch); } }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function fillet(pts, cx, cy, r, t0, t1, n = 5) { for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push(new THREE.Vector2(cx + r * Math.cos(t), cy + r * Math.sin(t))); } }
export function buildShaft(P) {
  const { L, thread, relief, j1, groove, mid, keyway, j2, end, center, c } = P; // 詳細は data/parts.js
  const mat = finishMaterial('S45C'), matT = finishMaterial('THREAD'); const g = new THREE.Group(); g.name = '段付きシャフト';
  const lathe = (pts, name) => { const geo = new THREE.LatheGeometry(pts, 96).toNonIndexed(); const m = new THREE.Mesh(cylUV(creaseNormals(geo, 32)), mat); m.castShadow = m.receiveShadow = true; m.name = name; g.add(m); return m; };
  const V2 = (r, a) => new THREE.Vector2(r, a); const rT = thread.d / 2, rR = relief.d / 2, r1 = j1.d / 2, rM = mid.d / 2, r2 = j2.d / 2, rE = end.d / 2;
  // 左端（ねじ側）端面 + 面取り
  lathe([V2(0, 0), V2(rT - thread.c, 0), V2(rT, thread.c)], 'end-left');
  const th = new THREE.Mesh(threadMesh({ rMaj: rT, L: thread.len - thread.c, pitch: thread.pitch, y0: thread.c }), matT); th.castShadow = th.receiveShadow = true; th.name = 'thread'; g.add(th);
  // 本体 M1: ねじ逃げ → ジャーナル1（止め輪溝）→ 段 → φ25（キー溝バンド手前まで）
  const a0 = thread.len, a1 = a0 + relief.len, aG0 = groove.a, aG1 = groove.a + groove.w, aS1 = j1.a1; const bandA0 = keyway.a0 - 1, bandA1 = keyway.a1 + 1;
  const m1 = [V2(rT, a0), V2(rR, a0), V2(rR, a1), V2(r1 - c, a1), V2(r1, a1 + c), V2(r1, aG0), V2(groove.d / 2, aG0), V2(groove.d / 2, aG1), V2(r1, aG1), V2(r1, aS1 - 0.5)];
  fillet(m1, r1 + 0.5, aS1 - 0.5, 0.5, Math.PI, Math.PI / 2); m1.push(V2(rM - c, aS1), V2(rM, aS1 + c), V2(rM, bandA0)); lathe(m1, 'M1');
  // キー溝バンド: 円筒 r=rM、a ∈ [bandA0, bandA1]、スタジアム形の切欠き（幅 w・全長 len・深さ t1、エンドミル半径 w/2）、キー溝は −X 側（回転後に上を向く）
  { const R = rM, w = keyway.w, t1 = keyway.t1, kA0 = keyway.a0, kA1 = keyway.a1, rk = w / 2; const e0 = kA0 + rk, e1 = kA1 - rk; const u = V3(-1, 0, 0), v = V3(0, 0, 1);
    const wE = a => (a < kA0 || a > kA1) ? 0 : a < e0 ? Math.sqrt(Math.max(0, rk * rk - (a - e0) ** 2)) : a > e1 ? Math.sqrt(Math.max(0, rk * rk - (a - e1) ** 2)) : rk;
    const samples = []; for (let a = bandA0; a < kA0; a += 0.5) samples.push(a); for (let a = kA0; a <= e0; a += 0.2) samples.push(a); for (let a = e0 + 2; a < e1; a += 2) samples.push(a); for (let a = e1; a <= kA1 + 1e-9; a += 0.2) samples.push(a); for (let a = kA1 + 0.5; a <= bandA1 + 1e-9; a += 0.5) samples.push(a); if (samples[samples.length - 1] < bandA1) samples.push(bandA1);
    const surf = (wv, a) => { const ph = Math.asin(Math.max(-1, Math.min(1, wv / R))); return V3().addScaledVector(u, R * Math.cos(ph)).addScaledVector(v, R * Math.sin(ph)).add(V3(0, a, 0)); };
    const floor = (wv, a) => V3().addScaledVector(u, R - t1).addScaledVector(v, wv).add(V3(0, a, 0));
    const T = new Tris(); const phi1 = Math.asin(rk / R); const N = 84;
    // 外側バンド（キー溝の弦の外）
    for (let s = 0; s < samples.length - 1; s++) { const aA = samples[s], aB = samples[s + 1]; for (let i = 0; i < N; i++) { const p0 = phi1 + (2 * Math.PI - 2 * phi1) * i / N, p1 = phi1 + (2 * Math.PI - 2 * phi1) * (i + 1) / N; const P = (ph, a) => V3().addScaledVector(u, R * Math.cos(ph)).addScaledVector(v, R * Math.sin(ph)).add(V3(0, a, 0)); const A = P(p0, aA), B = P(p1, aA), Cc = P(p1, aB), D = P(p0, aB); T.quad(A, B, Cc, D, V3().addVectors(A, Cc).multiplyScalar(0.5).setY(0)); } }
    // 弦の内側: 表面（切欠きの外側）+ 壁 + 床
    const sub = 3;
    for (let s = 0; s < samples.length - 1; s++) { const aA = samples[s], aB = samples[s + 1]; const wa = wE(aA), wb = wE(aB); if (wa >= rk - 1e-9 && wb >= rk - 1e-9) { } else for (const sg of [1, -1]) for (let k = 0; k < sub; k++) { const ta = wa + (rk - wa) * k / sub, tb = wa + (rk - wa) * (k + 1) / sub, ua = wb + (rk - wb) * k / sub, ub = wb + (rk - wb) * (k + 1) / sub; const A = surf(sg * ta, aA), B = surf(sg * tb, aA), Cc = surf(sg * ub, aB), D = surf(sg * ua, aB); const want = V3().addVectors(A, Cc).multiplyScalar(0.5).setY(0); T.quad(A, B, Cc, D, want); }
      if (aA >= kA0 - 1e-9 && aB <= kA1 + 1e-9) for (const sg of [1, -1]) { const A = surf(sg * wa, aA), B = surf(sg * wb, aB), Cc = floor(sg * wb, aB), D = floor(sg * wa, aA); const want = V3().addScaledVector(v, -sg); T.quad(A, B, Cc, D, want); } }
    // 床（スタジアム）
    { const pts = []; const n = 24; for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI * i / n; pts.push(new THREE.Vector2(e1 + rk * Math.cos(t), rk * Math.sin(t))); } for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + Math.PI * i / n; pts.push(new THREE.Vector2(e0 + rk * Math.cos(t), rk * Math.sin(t))); }
      const tris = THREE.ShapeUtils.triangulateShape(pts, []); for (const [a, b, cc] of tris) T.tri(floor(pts[a].y, pts[a].x), floor(pts[b].y, pts[b].x), floor(pts[cc].y, pts[cc].x), u); }
    const km = new THREE.Mesh(cylUV(creaseNormals(T.geometry(), 32)), mat); km.castShadow = km.receiveShadow = true; km.name = 'keyway-band'; g.add(km); }
  // 本体 M2: φ25 → 段 → ジャーナル2 → 段 → φ16 端 + 面取り + センター穴
  const aS2 = mid.a1, aS3 = j2.a1;
  const m2 = [V2(rM, bandA1), V2(rM, aS2 - c), V2(rM - c, aS2), V2(r1 + 0.5, aS2)]; fillet(m2, r1 + 0.5, aS2 + 0.5, 0.5, -Math.PI / 2, -Math.PI); m2.push(V2(r1, aS3 - c), V2(r1 - c, aS3), V2(rE + 0.5, aS3)); fillet(m2, rE + 0.5, aS3 + 0.5, 0.5, -Math.PI / 2, -Math.PI);
  m2.push(V2(rE, L - end.c), V2(rE - end.c, L), V2(center.D / 2, L), V2(center.d / 2, L - (center.D - center.d) / 2 / Math.tan(Math.PI / 6)), V2(center.d / 2, L - center.depth), V2(0, L - center.depth)); lathe(m2, 'M2');
  // 全体を X 軸に沿わせる（a=0 が −X 端）
  g.rotation.z = -Math.PI / 2; g.position.x = -L / 2; g.updateMatrixWorld(true);
  // 回転後の座標: 軸方向 a → X (= a − L/2)、半径方向 u(−X) → +Y。アンカーは回転後のワールド座標で記述
  const X = a => a - L / 2; const F = {};
  F.length = { kind: 'dist', a: V3(X(0), -rM - 8, 0), b: V3(X(L), -rM - 8, 0), label: V3(0, -rM - 11, 0) };
  F.j1 = { kind: 'cyl', c: V3(X(a1), 0, 0), r: r1, h: aS1 - a1, axis: 'x', side: 'out', label: V3(X((a1 + aS1) / 2), r1 + 2, 0) };
  F.j2 = { kind: 'cyl', c: V3(X(aS2), 0, 0), r: r1, h: aS3 - aS2, axis: 'x', side: 'out', label: V3(X((aS2 + aS3) / 2), r1 + 2, 0) };
  F.mid = { kind: 'cyl', c: V3(X(aS1), 0, 0), r: rM, h: aS2 - aS1, axis: 'x', side: 'out', label: V3(X((aS1 + aS2) / 2), -rM - 2, 0) };
  F.end = { kind: 'cyl', c: V3(X(aS3), 0, 0), r: rE, h: L - aS3, axis: 'x', side: 'out', label: V3(X((aS3 + L) / 2), rE + 2, 0) };
  F.thread = { kind: 'cyl', c: V3(X(0), 0, 0), r: rT, h: thread.len, axis: 'x', side: 'out', label: V3(X(thread.len / 2), rT + 2, 0) };
  F.relief = { kind: 'cyl', c: V3(X(a0), 0, 0), r: rR, h: relief.len, axis: 'x', side: 'out', label: V3(X((a0 + a1) / 2), -rR - 2, 0) };
  F.j1len = { kind: 'dist', a: V3(X(a1), r1 + 4, 0), b: V3(X(aS1), r1 + 4, 0), label: V3(X((a1 + aS1) / 2), r1 + 6, 0) };
  F.stepPos = { kind: 'dist', a: V3(X(0), rM + 4, 0), b: V3(X(aS1), rM + 4, 0), label: V3(X(aS1 / 2), rM + 6, 0) };
  F.keyW = { kind: 'plane', c: V3(X((keyway.a0 + keyway.a1) / 2), rM - keyway.t1, 0), n: V3(0, 1, 0), w: keyway.a1 - keyway.a0, h: keyway.w, label: V3(X((keyway.a0 + keyway.a1) / 2), rM + 2, 0) };
  F.keyT = { kind: 'dist', a: V3(X(keyway.a1 - 2), rM - keyway.t1, 0), b: V3(X(keyway.a1 - 2), rM, 0), label: V3(X(keyway.a1 + 1), rM + 1, 0) };
  F.keyL = { kind: 'dist', a: V3(X(keyway.a0), rM + 1, 0), b: V3(X(keyway.a1), rM + 1, 0), label: V3(X((keyway.a0 + keyway.a1) / 2), rM + 4, 0) };
  F.grooveD = { kind: 'cyl', c: V3(X(aG0), 0, 0), r: groove.d / 2, h: groove.w, axis: 'x', side: 'out', label: V3(X(aG0), -r1 - 2, 0) };
  F.grooveW = { kind: 'dist', a: V3(X(aG0), r1 + 1, 0), b: V3(X(aG1), r1 + 1, 0), label: V3(X(aG0), r1 + 4, 0) };
  F.runout = { kind: 'cyl', c: V3(X(aS1), 0, 0), r: rM, h: aS2 - aS1, axis: 'x', side: 'out', label: V3(X((aS1 + aS2) / 2), rM + 4, 0) };
  F.coax = { kind: 'cyl', c: V3(X(aS2), 0, 0), r: r1, h: aS3 - aS2, axis: 'x', side: 'out', label: V3(X((aS2 + aS3) / 2), -r1 - 2, 0) };
  F.endChamfer = { kind: 'cyl', c: V3(X(L - end.c), 0, 0), r: rE, h: end.c, axis: 'x', side: 'out', label: V3(X(L), rE + 2, 0) };
  F.j1Ra = F.j1; F.center = { kind: 'cyl', c: V3(X(L - center.depth), 0, 0), r: center.D / 2, h: center.depth, axis: 'x', side: 'in', label: V3(X(L) + 2, 0, 0) };
  return { group: g, features: F, mesh: g, size: { x: L, y: mid.d, z: mid.d } };
}

// ======================================================================
// 3) 板金 L ブラケット（SPCC t2.0 電気亜鉛めっき）: 底板 + 曲げ R（90° 回転体）+ 立板
// ======================================================================
export function buildBracket(P) {
  const { L, Wd, Hh, t, Ri, baseHoles, baseHoleD, legSlot, legHoles, legHoleD } = P; const Ro = Ri + t; const mat = finishMaterial('EZ'); const g = new THREE.Group(); g.name = 'L ブラケット';
  // 底板: X ∈ [Ro, L], Y ∈ [0, t], Z ∈ [−Wd/2, Wd/2]
  { const T = new Tris(); const outer = C.rect(L - Ro, Wd, { cx: (L + Ro) / 2, cp: 0 }); const holes = baseHoles.map(([x, z]) => C.hole(C.circ(x, -z, baseHoleD / 2))); const skip = (a, b) => Math.abs(a[0] - Ro) < 1e-6 && Math.abs(b[0] - Ro) < 1e-6;
    layer(T, { y0: 0, y1: t, outer, holes, skip }); cap(T, 0, false, [outer, 0], holes.map(h => [h, 0])); cap(T, t, true, [outer, 0], holes.map(h => [h, 0])); g.add(finish(T, mat, 'base')); }
  // 立板: 平面座標 (x = −Y, p = −Z)、高さ → X。X ∈ [0, t], Y ∈ [Ro, Hh]
  { const T = new Tris(); const outer = C.rect(Hh - Ro, Wd, { cx: -(Hh + Ro) / 2, cp: 0 }); const holes = [C.hole(C.stadium(-legSlot.y, -legSlot.z, legSlot.w, legSlot.len, Math.PI / 2)), ...legHoles.map(([y, z]) => C.hole(C.circ(-y, -z, legHoleD / 2)))]; const skip = (a, b) => Math.abs(a[0] + Ro) < 1e-6 && Math.abs(b[0] + Ro) < 1e-6;
    layer(T, { y0: 0, y1: t, outer, holes, skip }); cap(T, 0, false, [outer, 0], holes.map(h => [h, 0])); cap(T, t, true, [outer, 0], holes.map(h => [h, 0])); const m = finish(T, mat, 'leg'); m.geometry.rotateZ(-Math.PI / 2); g.add(m);
    // rotateZ(−90°): (x,y,z)→(y,−x,z): 平面 x(=−Y) → ワールド −x… = +Y ✓、高さ y → X ✓。法線も回転される（BufferGeometry.rotateZ は normal も変換）
  }
  // 曲げ R: 断面 [Ri..Ro] × [−Wd/2..Wd/2] を 90° 回転（中心 (Ro, Ro, 0)、軸 Z）
  { const pts = [new THREE.Vector2(Ri, -Wd / 2), new THREE.Vector2(Ro, -Wd / 2), new THREE.Vector2(Ro, Wd / 2), new THREE.Vector2(Ri, Wd / 2), new THREE.Vector2(Ri, -Wd / 2)]; const geo = new THREE.LatheGeometry(pts, 28, -Math.PI / 2, Math.PI / 2).toNonIndexed(); geo.rotateX(Math.PI / 2); geo.translate(Ro, Ro, 0); const m = new THREE.Mesh(boxUV(creaseNormals(geo, 32)), mat); m.castShadow = m.receiveShadow = true; m.name = 'bend'; g.add(m); }
  const F = {};
  F.length = { kind: 'dist', a: V3(0, -3, -Wd / 2 - 6), b: V3(L, -3, -Wd / 2 - 6), label: V3(L / 2, -5, -Wd / 2 - 9) };
  F.width = { kind: 'dist', a: V3(L + 6, 0, -Wd / 2), b: V3(L + 6, 0, Wd / 2), label: V3(L + 9, 0, 0) };
  F.height = { kind: 'dist', a: V3(-6, 0, Wd / 2 + 3), b: V3(-6, Hh, Wd / 2 + 3), label: V3(-9, Hh / 2, Wd / 2 + 3) };
  F.thick = { kind: 'dist', a: V3(L + 1, 0, Wd / 2 + 1), b: V3(L + 1, t, Wd / 2 + 1), label: V3(L + 4, t + 2, Wd / 2 + 3) };
  F.angle = { kind: 'plane', c: V3(t, (Hh + Ro) / 2, 0), n: V3(1, 0, 0), w: Wd, h: Hh - Ro, label: V3(t + 2, Hh - 6, 0) };
  F.bendR = { kind: 'cyl', c: V3(Ro, Ro, -Wd / 2), r: Ri, h: Wd, axis: 'z', side: 'in', arc: [Math.PI, Math.PI * 1.5], label: V3(Ro + 1, Ro + 1, 0) };
  F.baseHole = { kind: 'cyls', items: baseHoles.map(([x, z]) => ({ c: V3(x, 0, z), r: baseHoleD / 2, h: t })), side: 'in', label: V3(baseHoles[0][0], t + 2, baseHoles[0][1]) };
  F.basePitch = { kind: 'dist', a: V3(baseHoles[0][0], t, baseHoles[0][1]), b: V3(baseHoles[1][0], t, baseHoles[1][1]), label: V3(baseHoles[0][0] + 6, t + 1, 0) };
  F.baseHoleX = { kind: 'dist', a: V3(0, t, baseHoles[0][1]), b: V3(baseHoles[0][0], t, baseHoles[0][1]), label: V3(baseHoles[0][0] / 2, t + 1, baseHoles[0][1] + 4) };
  F.legSlot = { kind: 'cyl', c: V3(0, legSlot.y, legSlot.z), r: legSlot.w / 2, h: t, axis: 'x', side: 'in', stadium: legSlot.len, label: V3(t + 2, legSlot.y, legSlot.z) };
  F.legHole = { kind: 'cyls', items: legHoles.map(([y, z]) => ({ c: V3(0, y, z), r: legHoleD / 2, h: t, axis: 'x' })), side: 'in', label: V3(t + 2, legHoles[0][0], legHoles[0][1]) };
  F.legPitch = { kind: 'dist', a: V3(t, legHoles[0][0], legHoles[0][1]), b: V3(t, legHoles[1][0], legHoles[1][1]), label: V3(t + 1, legHoles[0][0] + 4, 0) };
  F.slotY = { kind: 'dist', a: V3(t, 0, legSlot.z + 10), b: V3(t, legSlot.y, legSlot.z + 10), label: V3(t + 1, legSlot.y / 2, legSlot.z + 13) };
  F.flat = { kind: 'plane', c: V3((L + Ro) / 2, 0, 0), n: V3(0, -1, 0), w: L - Ro, h: Wd, label: V3(L / 2, -1, 0) };
  F.plating = { kind: 'plane', c: V3((L + Ro) / 2, t, 0), n: V3(0, 1, 0), w: L - Ro, h: Wd, label: V3(L * 0.7, t + 1, 0) };
  F.burr = { kind: 'cyls', items: baseHoles.map(([x, z]) => ({ c: V3(x, 0, z), r: baseHoleD / 2 + 1, h: t })), side: 'in', label: V3(baseHoles[1][0], t + 2, baseHoles[1][1]) };
  return { group: g, features: F, mesh: g, size: { x: L, y: Hh, z: Wd } };
}

export const BUILDERS = { housing: buildHousing, shaft: buildShaft, bracket: buildBracket };
