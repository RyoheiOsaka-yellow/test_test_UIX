// ロフトエンジン: 回転体 + 非軸対称の切欠き（二面幅・スロット・径方向穴）を「リング列」で表現する。
// リング = 同じ点数の閉ポリライン（平面座標 (x, p)、CCW、高さ y）。隣り合うリングを四角形で結ぶと
// 法線は「周方向 × 進行方向」になるため、外周（下→上）→ 端面 → 内周（上→下）→ 端面 の順にたどれば
// 段差面・円錐・面取りも含めて水密なソリッドが得られる。
import * as THREE from 'three';
export const P3 = (x, p, y) => new THREE.Vector3(x, y, -p);
const TAU = Math.PI * 2;
function triSafe(T, a, b, c) { const ab = new THREE.Vector3().subVectors(b, a), ac = new THREE.Vector3().subVectors(c, a); if (ab.cross(ac).lengthSq() < 1e-14) return; T.tri(a, b, c); }
// rings: [{ y, pts: [[x, p], ...] }]。modeFn(k, i, flat) で UV モード、skip(k, i) で穴あけ用にセルを抜く
export function loft(T, rings, { modeFn = null, skip = null } = {}) {
  for (let k = 0; k < rings.length - 1; k++) { const A = rings[k], B = rings[k + 1]; const n = A.pts.length; const flat = Math.abs(A.y - B.y) < 1e-9;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (skip && skip(k, i)) continue; T.mode = modeFn ? modeFn(k, i, flat) : (flat ? { polar: [0, 0] } : { cyl: [0, 0] });
      const a = P3(A.pts[i][0], A.pts[i][1], A.y), b = P3(A.pts[j][0], A.pts[j][1], A.y), c = P3(B.pts[j][0], B.pts[j][1], B.y), d = P3(B.pts[i][0], B.pts[i][1], B.y); triSafe(T, a, b, c); triSafe(T, a, c, d); } }
}
// 点数の異なる 2 リング間の環状面（端面）。A → B が進行方向
export function stitch(T, A, B, { mode = { polar: [0, 0] } } = {}) {
  T.mode = mode; const ang = R => { const out = []; let prev = null, off = 0; for (const [x, p] of R.pts) { let a = Math.atan2(p, x); if (prev != null) { while (a + off < prev - Math.PI) off += TAU; while (a + off > prev + Math.PI) off -= TAU; } a += off; out.push(a); prev = a; } return out; };
  const aA = ang(A), aB = ang(B); const nA = A.pts.length, nB = B.pts.length; let sh = 0; while (aB[0] + sh - aA[0] > Math.PI) sh -= TAU; while (aB[0] + sh - aA[0] < -Math.PI) sh += TAU;
  const PA = i => P3(A.pts[i % nA][0], A.pts[i % nA][1], A.y), PB = j => P3(B.pts[j % nB][0], B.pts[j % nB][1], B.y); const angA = i => aA[i % nA] + (i >= nA ? TAU : 0), angB = j => aB[j % nB] + sh + (j >= nB ? TAU : 0);
  let i = 0, j = 0; while (i < nA || j < nB) { const advA = j >= nB || (i < nA && angA(i + 1) <= angB(j + 1)); if (advA) { triSafe(T, PA(i), PA(i + 1), PB(j)); i++; } else { triSafe(T, PA(i), PB(j + 1), PB(j)); j++; } }
}
export function circleRing(y, r, N = 240, a0 = 0) { const pts = []; for (let i = 0; i < N; i++) { const t = a0 + i / N * TAU; const rr = typeof r === 'function' ? r(t) : r; pts.push([rr * Math.cos(t), rr * Math.sin(t)]); } return { y, pts }; }
export function polarRing(y, thetas, rho) { return { y, pts: thetas.map(t => { const r = typeof rho === 'function' ? rho(t) : rho; return [r * Math.cos(t), r * Math.sin(t)]; }) }; }
// 二面幅（x = ±flatX の 2 平面で切った円）。R は数値 or R(θ)（ねじ山など）。角は二分法で厳密に求める。
// full=true は同じ点配置で切欠きのない円（切欠きの終端の段差面を作るため）
export function dcutRing(y, Rin, flatX, { nF = 10, nA = 110, full = false, corners = null } = {}) {
  const R = typeof Rin === 'function' ? Rin : () => Rin; const g = t => R(t) * Math.abs(Math.cos(t)) - flatX;
  const root = (lo, hi) => { let a = lo, b = hi, ga = g(a); for (let i = 0; i < 40; i++) { const m = (a + b) / 2, gm = g(m); if ((ga > 0) === (gm > 0)) { a = m; ga = gm; } else b = m; } return (a + b) / 2; };
  const c = corners || [g(0) > 0 ? root(0, Math.PI / 2) : 0, g(Math.PI) > 0 ? root(Math.PI / 2, Math.PI) : Math.PI, g(Math.PI) > 0 ? root(Math.PI, Math.PI * 1.5) : Math.PI, g(0) > 0 ? root(Math.PI * 1.5, TAU) : TAU];
  const pts = []; const push = (t, onFlat) => { let r = R(t); if (onFlat && !full) r = Math.min(r, flatX / Math.max(1e-9, Math.abs(Math.cos(t)))); pts.push([r * Math.cos(t), r * Math.sin(t)]); };
  for (let i = 0; i < nF; i++) push(c[3] - TAU + (c[0] - (c[3] - TAU)) * i / nF, true);
  for (let i = 0; i < nA; i++) push(c[0] + (c[1] - c[0]) * i / nA, false);
  for (let i = 0; i < nF; i++) push(c[1] + (c[2] - c[1]) * i / nF, true);
  for (let i = 0; i < nA; i++) push(c[2] + (c[3] - c[2]) * i / nA, false);
  return { y, pts, corners: c, isFlat: i => i < nF || (i >= nF + nA && i < 2 * nF + nA) };
}
// ねじ山の断面（ISO 60°）: u ∈ [0,1) の位相 → 0（山頂）〜1（谷底）。山頂 P/8・谷底 P/6 の平坦部
export function threadProfile(u, { crest = 0.125, root = 0.167 } = {}) { const d = Math.min(u, 1 - u); const c = crest / 2, r = 0.5 - root / 2; if (d <= c) return 0; if (d >= r) return 1; return (d - c) / (r - c); }
// おねじの半径関数 R(θ, y)。hand: 'RH' | 'LH'。k(y) は不完全ねじ部の深さ係数
export function threadRadius({ rMaj, pitch, depth = 0.6134 * pitch, hand = 'RH', y0 = 0, k = null, cap = null }) { const s = hand === 'LH' ? 1 : -1; return (t, y) => { const u = (((y - y0) / pitch + s * t / TAU) % 1 + 1) % 1; let r = rMaj - depth * threadProfile(u) * (k ? k(y) : 1); if (cap) r = Math.min(r, cap(y)); return r; }; }
// 円筒面（半径 R、軸 Y）に径方向の丸穴（半径 rh、中心高さ yc、平面角 th）をあけるパッチ。
// 外周は周囲のグリッド節点（thNodes × yRows）に一致させ、穴の縁は厳密な相貫線。全頂点が円筒面上に乗る O グリッド
export function holePatch(T, { R, th, yc, rh, thNodes, yRows, outward = true, n2 = 48 }) {
  const B = []; const nt = thNodes.length, ny = yRows.length; for (let i = 0; i < nt; i++) B.push([thNodes[i], yRows[0]]); for (let j = 1; j < ny; j++) B.push([thNodes[nt - 1], yRows[j]]); for (let i = nt - 2; i >= 0; i--) B.push([thNodes[i], yRows[ny - 1]]); for (let j = ny - 2; j >= 1; j--) B.push([thNodes[0], yRows[j]]);
  const ang = ([t, y]) => Math.atan2(y - yc, (t - th) * R); const hp = f => [th + Math.asin(rh * Math.cos(f) / R), yc + rh * Math.sin(f)];
  const fB = B.map(ang); const L1 = B.map((b, i) => { const h = hp(fB[i]); return [b[0] + (h[0] - b[0]) * 0.62, b[1] + (h[1] - b[1]) * 0.62]; }); const curve = []; for (let k = 0; k < n2; k++) curve.push(hp(k / n2 * TAU));
  const P = ([t, y]) => P3(R * Math.cos(t), R * Math.sin(t), y); const tri = (a, b, c) => { const A = P(a), Bq = P(b), C = P(c); const mid = new THREE.Vector3().add(A).add(Bq).add(C).multiplyScalar(1 / 3); T.tri(A, Bq, C, new THREE.Vector3(mid.x, 0, mid.z).multiplyScalar(outward ? 1 : -1)); };
  T.mode = { cyl: [0, 0] }; const nb = B.length; for (let i = 0; i < nb; i++) { const j = (i + 1) % nb; tri(B[i], B[j], L1[j]); tri(B[i], L1[j], L1[i]); }
  // L1（nb 点）→ 穴の縁（n2 点）: 角度の小さい方から進める
  const un = arr => { const o = []; let prev = null, off = 0; for (const a0 of arr) { let a = a0; if (prev != null) { while (a + off < prev - Math.PI) off += TAU; while (a + off > prev + Math.PI) off -= TAU; } a += off; o.push(a); prev = a; } return o; };
  const a1 = un(fB), a2 = un(curve.map((c, k) => k / n2 * TAU)); let sh = 0; while (a2[0] + sh - a1[0] > Math.PI) sh -= TAU; while (a2[0] + sh - a1[0] < -Math.PI) sh += TAU; const A1 = i => a1[i % nb] + (i >= nb ? TAU : 0), A2 = j => a2[j % n2] + sh + (j >= n2 ? TAU : 0);
  let i = 0, j = 0; while (i < nb || j < n2) { const adv = j >= n2 || (i < nb && A1(i + 1) <= A2(j + 1)); if (adv) { tri(L1[i % nb], L1[(i + 1) % nb], curve[j % n2]); i++; } else { tri(L1[i % nb], curve[(j + 1) % n2], curve[j % n2]); j++; } }
  return curve;
}
// 円筒面上の頂点の法線を解析的な径方向に置き換える（不規則な三角形分割でも陰影が乱れないように）
export function cylNormals(geo, radii, tol = 2e-3) { const p = geo.attributes.position, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z); if (r < 1e-6) continue; for (const R of radii) { if (Math.abs(r - R) > tol) continue; const d = (n.getX(i) * x + n.getZ(i) * z) / r; if (Math.abs(d) > 0.85) { const s = Math.sign(d); n.setXYZ(i, s * x / r, 0, s * z / r); } break; } } n.needsUpdate = true; return geo; }
