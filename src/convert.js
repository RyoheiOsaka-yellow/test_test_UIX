/* ============================================================
   XBUILD データフロー層 — convert.js
   GeoSet -> 描画バッファ（プレーンな TypedArray）。
   three.js を import しない。ビューア側が THREE.BufferAttribute に包む。
   ------------------------------------------------------------
   検証したい構造的論点:
     vertex 階層（面のコーナー）を three.js の非インデックス頂点へ
     1:1 で写せるか。写せるなら P1 のトポロジ設計は正しい。
   ============================================================ */

'use strict';

/* ---------- 多角形の三角形分割（耳切り法） ---------- */

/** Newell 法による面法線 */
function faceNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const L = Math.hypot(nx, ny, nz) || 1;
  return [nx / L, ny / L, nz / L];
}

/** 法線から正規直交基底 (u, v) を作る */
function planeBasis(N) {
  const a = Math.abs(N[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = a[1] * N[2] - a[2] * N[1];
  let uy = a[2] * N[0] - a[0] * N[2];
  let uz = a[0] * N[1] - a[1] * N[0];
  const L = Math.hypot(ux, uy, uz) || 1;
  ux /= L; uy /= L; uz /= L;
  return [
    [ux, uy, uz],
    [N[1] * uz - N[2] * uy, N[2] * ux - N[0] * uz, N[0] * uy - N[1] * ux],
  ];
}

function signedArea2D(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

/**
 * 3D 多角形を三角形へ分割する。
 * pts: [[x,y,z], ...]（凹多角形可、自己交差は非対応）
 * 戻り値: ローカルインデックスの三つ組配列 [[i,j,k], ...]
 */
function triangulate(pts) {
  const n = pts.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];

  const N = faceNormal(pts);
  const [U, V] = planeBasis(N);
  const p2 = pts.map(p => [
    p[0] * U[0] + p[1] * U[1] + p[2] * U[2],
    p[0] * V[0] + p[1] * V[1] + p[2] * V[2],
  ]);

  let idx = [...Array(n).keys()];
  if (signedArea2D(p2) < 0) idx.reverse();

  const out = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const a = p2[ia], b = p2[ib], c = p2[ic];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross <= 0) continue;                    // 凸でない頂点は耳にならない
      let contains = false;
      for (const k of idx) {
        if (k === ia || k === ib || k === ic) continue;
        if (pointInTri(p2[k][0], p2[k][1], a[0], a[1], b[0], b[1], c[0], c[1])) { contains = true; break; }
      }
      if (contains) continue;
      out.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;                           // 退化多角形。残りは扇分割で処理
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  else for (let i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i + 1]]);
  return out;
}

/* ---------- カラーランプ ---------- */

const RAMPS = {
  // 低 -> 高
  yellow: [[0.10, 0.11, 0.13], [0.55, 0.42, 0.12], [0.98, 0.78, 0.20]],
  cool:   [[0.08, 0.12, 0.20], [0.20, 0.45, 0.62], [0.62, 0.86, 0.94]],
  heat:   [[0.10, 0.10, 0.16], [0.72, 0.24, 0.20], [0.98, 0.85, 0.55]],
  // 上の3つは低域が暗い（面の陰影づけ向け）。暗背景に加算合成で点を重ねると
  // 低域が消えてしまうため、全域が明るいランプを別に持つ（SPEC.md §22.4）。
  flow:   [[0.22, 0.82, 1.00], [0.38, 1.00, 0.62], [1.00, 0.72, 0.26]],
  vivid:  [[0.45, 0.60, 1.00], [1.00, 0.45, 0.85], [1.00, 0.85, 0.35]],
};

function sampleRamp(name, t) {
  const r = RAMPS[name] || RAMPS.yellow;
  t = Math.max(0, Math.min(1, t));
  const s = t * (r.length - 1);
  const i = Math.min(r.length - 2, Math.floor(s));
  const f = s - i;
  return [
    r[i][0] + (r[i + 1][0] - r[i][0]) * f,
    r[i][1] + (r[i + 1][1] - r[i][1]) * f,
    r[i][2] + (r[i + 1][2] - r[i][2]) * f,
  ];
}

/* ============================================================
   toRenderBuffers
   ------------------------------------------------------------
   opts:
     colorBy   : 属性名（point / prim の float 属性）。省略時は Cd か既定色
     ramp      : 'yellow' | 'cool' | 'heat'
     range     : [min, max]（省略時は自動）
   戻り値:
     tris  { position, normal, color, primId, count }
     lines { position, color, count }
   ============================================================ */

function toRenderBuffers(geo, opts = {}) {
  const nPrim = geo.prim.count;
  const P = geo.point.get('P');
  const closedA = geo.prim.get('closed');
  const vN = geo.vertex.get('N');
  const pN = geo.point.get('N');
  const pCd = geo.point.get('Cd');
  const primCd = geo.prim.get('Cd');

  // ---- 色の元になるスカラー属性を解決 ----
  let scalar = null, owner = null, lo = 0, hi = 1;
  if (opts.colorBy) {
    if (geo.prim.has(opts.colorBy)) { scalar = geo.prim.get(opts.colorBy); owner = 'prim'; }
    else if (geo.point.has(opts.colorBy)) { scalar = geo.point.get(opts.colorBy); owner = 'point'; }
    if (scalar) {
      const n = owner === 'prim' ? geo.prim.count : geo.point.count;
      if (opts.range) { lo = opts.range[0]; hi = opts.range[1]; }
      else {
        lo = Infinity; hi = -Infinity;
        for (let i = 0; i < n; i++) { const v = scalar.get(i); if (v < lo) lo = v; if (v > hi) hi = v; }
        if (!isFinite(lo)) { lo = 0; hi = 1; }
      }
      if (hi === lo) hi = lo + 1;
    }
  }
  const ramp = opts.ramp || 'yellow';
  const base = opts.baseColor || [0.72, 0.74, 0.78];

  // ---- 三角形数を先に数える ----
  let triCount = 0, lineVerts = 0;
  const triCache = new Array(nPrim);
  for (let pi = 0; pi < nPrim; pi++) {
    const a = geo.primStart[pi], b = geo.primStart[pi + 1];
    const nv = b - a;
    const closed = closedA ? closedA.get(pi) : 1;
    if (!closed || nv < 3) { lineVerts += Math.max(0, (nv - 1)) * 2; triCache[pi] = null; continue; }
    const pts = new Array(nv);
    for (let k = 0; k < nv; k++) pts[k] = P.get(geo.vertPoint[a + k]);
    const t = triangulate(pts);
    triCache[pi] = { t, pts };
    triCount += t.length;
  }

  const position = new Float32Array(triCount * 9);
  const normal = new Float32Array(triCount * 9);
  const color = new Float32Array(triCount * 9);
  const primId = new Int32Array(triCount * 3);

  let o = 0, oi = 0;
  for (let pi = 0; pi < nPrim; pi++) {
    const c = triCache[pi];
    if (!c) continue;
    const a = geo.primStart[pi];
    const fn = faceNormal(c.pts);

    let primColor = null;
    if (scalar && owner === 'prim') primColor = sampleRamp(ramp, (scalar.get(pi) - lo) / (hi - lo));
    else if (primCd) primColor = primCd.get(pi);

    for (const tri of c.t) {
      for (const li of tri) {
        const vi = a + li;               // グローバル vertex インデックス
        const pt = geo.vertPoint[vi];    // 参照先 point
        const p = P.get(pt);
        position[o] = p[0]; position[o + 1] = p[1]; position[o + 2] = p[2];

        // 法線: vertex 属性 > point 属性 > 面法線 の優先順
        const nrm = vN ? vN.get(vi) : (pN ? pN.get(pt) : fn);
        normal[o] = nrm[0]; normal[o + 1] = nrm[1]; normal[o + 2] = nrm[2];

        let col = primColor;
        if (!col) {
          if (scalar && owner === 'point') col = sampleRamp(ramp, (scalar.get(pt) - lo) / (hi - lo));
          else if (pCd) col = pCd.get(pt);
          else col = base;
        }
        color[o] = col[0]; color[o + 1] = col[1]; color[o + 2] = col[2];

        primId[oi++] = pi;
        o += 3;
      }
    }
  }

  // ---- 開いたプリミティブは線分として ----
  const lpos = new Float32Array(lineVerts * 3);
  const lcol = new Float32Array(lineVerts * 3);
  let lo2 = 0;
  const colorOf = (pi, pt) => {
    if (scalar && owner === 'prim') return sampleRamp(ramp, (scalar.get(pi) - lo) / (hi - lo));
    if (primCd) return primCd.get(pi);
    if (scalar && owner === 'point') return sampleRamp(ramp, (scalar.get(pt) - lo) / (hi - lo));
    if (pCd) return pCd.get(pt);
    return base;
  };
  for (let pi = 0; pi < nPrim; pi++) {
    if (triCache[pi]) continue;
    const a = geo.primStart[pi], b = geo.primStart[pi + 1];
    for (let k = a; k < b - 1; k++) {
      const i0 = geo.vertPoint[k], i1 = geo.vertPoint[k + 1];
      const p0 = P.get(i0), p1 = P.get(i1);
      const c0 = colorOf(pi, i0), c1 = colorOf(pi, i1);
      lpos[lo2] = p0[0]; lpos[lo2 + 1] = p0[1]; lpos[lo2 + 2] = p0[2];
      lcol[lo2] = c0[0]; lcol[lo2 + 1] = c0[1]; lcol[lo2 + 2] = c0[2];
      lo2 += 3;
      lpos[lo2] = p1[0]; lpos[lo2 + 1] = p1[1]; lpos[lo2 + 2] = p1[2];
      lcol[lo2] = c1[0]; lcol[lo2 + 1] = c1[1]; lcol[lo2 + 2] = c1[2];
      lo2 += 3;
    }
  }

  // ---- 全 point を点群バッファとしても出力する ----
  const nPt = geo.point.count;
  const ppos = new Float32Array(nPt * 3);
  const pcol = new Float32Array(nPt * 3);
  for (let i = 0; i < nPt; i++) {
    const p = P.get(i);
    ppos[i * 3] = p[0]; ppos[i * 3 + 1] = p[1]; ppos[i * 3 + 2] = p[2];
    let col;
    if (scalar && owner === 'point') col = sampleRamp(ramp, (scalar.get(i) - lo) / (hi - lo));
    else if (pCd) col = pCd.get(i);
    else col = base;
    pcol[i * 3] = col[0]; pcol[i * 3 + 1] = col[1]; pcol[i * 3 + 2] = col[2];
  }

  return {
    tris: { position, normal, color, primId, count: triCount * 3 },
    lines: { position: lpos, color: lcol, count: lineVerts },
    points: { position: ppos, color: pcol, count: nPt },
    colorRange: scalar ? [lo, hi] : null,
  };
}

module.exports = { toRenderBuffers, triangulate, faceNormal, sampleRamp, RAMPS };
