// Robust primitive fitting (RANSAC + least-squares refinement). Pure functions, no imports, so
// the file can also be concatenated into the scan-to-BIM worker.

function lcg(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

/** Plane through 3D points: returns { n:[a,b,c] (unit), d, inliers:Uint8Array, rms } with a·x+b·y+c·z+d=0. */
export function ransacPlane(xs, ys, zs, { thresh = 0.04, iters = 60, seed = 1 } = {}) {
  const n = xs.length;
  if (n < 3) return null;
  const rnd = lcg(seed);
  let best = null, bestCount = -1;
  for (let it = 0; it < iters; it++) {
    const i = (rnd() * n) | 0, j = (rnd() * n) | 0, k = (rnd() * n) | 0;
    if (i === j || j === k || i === k) continue;
    const ux = xs[j] - xs[i], uy = ys[j] - ys[i], uz = zs[j] - zs[i], vx = xs[k] - xs[i], vy = ys[k] - ys[i], vz = zs[k] - zs[i];
    let a = uy * vz - uz * vy, b = uz * vx - ux * vz, c = ux * vy - uy * vx;
    const L = Math.hypot(a, b, c); if (L < 1e-9) continue;
    a /= L; b /= L; c /= L;
    const d = -(a * xs[i] + b * ys[i] + c * zs[i]);
    let count = 0;
    for (let q = 0; q < n; q++) if (Math.abs(a * xs[q] + b * ys[q] + c * zs[q] + d) < thresh) count++;
    if (count > bestCount) { bestCount = count; best = [a, b, c, d]; }
  }
  if (!best) return null;
  // refine: PCA plane through the inliers
  const inl = new Uint8Array(n); let m = 0, mx = 0, my = 0, mz = 0;
  for (let q = 0; q < n; q++) if (Math.abs(best[0] * xs[q] + best[1] * ys[q] + best[2] * zs[q] + best[3]) < thresh) { inl[q] = 1; m++; mx += xs[q]; my += ys[q]; mz += zs[q]; }
  if (m < 3) return null;
  mx /= m; my /= m; mz /= m;
  let a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
  for (let q = 0; q < n; q++) if (inl[q]) { const x = xs[q] - mx, y = ys[q] - my, z = zs[q] - mz; a += x * x; b += x * y; d += x * z; e += y * y; f += y * z; g += z * z; }
  const nv = smallestEigenvector(a, b, d, e, f, g);
  const dd = -(nv[0] * mx + nv[1] * my + nv[2] * mz);
  let rms = 0;
  for (let q = 0; q < n; q++) if (inl[q]) { const r = nv[0] * xs[q] + nv[1] * ys[q] + nv[2] * zs[q] + dd; rms += r * r; }
  return { n: nv, d: dd, inliers: inl, count: m, rms: Math.sqrt(rms / m), centroid: [mx, my, mz] };
}

/** Circle in 2D (u,v): RANSAC on 3-point circles, then Kåsa least-squares on the inliers. */
export function ransacCircle(us, vs, { thresh = 0.05, iters = 80, seed = 1, rMin = 0.3, rMax = 6 } = {}) {
  const n = us.length;
  if (n < 6) return null;
  const rnd = lcg(seed);
  let best = null, bestCount = -1;
  for (let it = 0; it < iters; it++) {
    const i = (rnd() * n) | 0, j = (rnd() * n) | 0, k = (rnd() * n) | 0;
    if (i === j || j === k || i === k) continue;
    const c = circle3(us[i], vs[i], us[j], vs[j], us[k], vs[k]);
    if (!c || c[2] < rMin || c[2] > rMax) continue;
    let count = 0;
    for (let q = 0; q < n; q++) if (Math.abs(Math.hypot(us[q] - c[0], vs[q] - c[1]) - c[2]) < thresh) count++;
    if (count > bestCount) { bestCount = count; best = c; }
  }
  if (!best) return null;
  const inl = new Uint8Array(n); let m = 0;
  for (let q = 0; q < n; q++) if (Math.abs(Math.hypot(us[q] - best[0], vs[q] - best[1]) - best[2]) < thresh) { inl[q] = 1; m++; }
  if (m < 6) return null;
  // Kåsa fit: minimise Σ (u²+v² + D u + E v + F)²
  let suu = 0, suv = 0, svv = 0, su = 0, sv = 0, suuu = 0, suvv = 0, svvv = 0, svuu = 0;
  for (let q = 0; q < n; q++) if (inl[q]) { const u = us[q], v = vs[q]; suu += u * u; suv += u * v; svv += v * v; su += u; sv += v; suuu += u * u * u; suvv += u * v * v; svvv += v * v * v; svuu += v * u * u; }
  const A = [[suu, suv, su], [suv, svv, sv], [su, sv, m]], B = [-(suuu + suvv), -(svuu + svvv), -(suu + svv)];
  const sol = solve3(A, B);
  if (!sol) return { cu: best[0], cv: best[1], r: best[2], inliers: inl, count: m, rms: thresh };
  const cu = -sol[0] / 2, cv = -sol[1] / 2, r = Math.sqrt(Math.max(0, cu * cu + cv * cv - sol[2]));
  let rms = 0; for (let q = 0; q < n; q++) if (inl[q]) { const e = Math.hypot(us[q] - cu, vs[q] - cv) - r; rms += e * e; }
  return { cu, cv, r, inliers: inl, count: m, rms: Math.sqrt(rms / m) };
}

/** Line in 2D: RANSAC on 2-point lines, PCA refinement. Returns { p:[u,v] point, d:[du,dv] unit direction, n:[nu,nv] normal }. */
export function ransacLine(us, vs, { thresh = 0.04, iters = 60, seed = 1 } = {}) {
  const n = us.length;
  if (n < 2) return null;
  const rnd = lcg(seed);
  let best = null, bestCount = -1;
  for (let it = 0; it < iters; it++) {
    const i = (rnd() * n) | 0, j = (rnd() * n) | 0;
    if (i === j) continue;
    let du = us[j] - us[i], dv = vs[j] - vs[i]; const L = Math.hypot(du, dv); if (L < 1e-6) continue;
    du /= L; dv /= L; const nu = -dv, nv = du, c = -(nu * us[i] + nv * vs[i]);
    let count = 0;
    for (let q = 0; q < n; q++) if (Math.abs(nu * us[q] + nv * vs[q] + c) < thresh) count++;
    if (count > bestCount) { bestCount = count; best = [nu, nv, c]; }
  }
  if (!best) return null;
  const inl = new Uint8Array(n); let m = 0, mu = 0, mv = 0;
  for (let q = 0; q < n; q++) if (Math.abs(best[0] * us[q] + best[1] * vs[q] + best[2]) < thresh) { inl[q] = 1; m++; mu += us[q]; mv += vs[q]; }
  if (m < 2) return null;
  mu /= m; mv /= m;
  let a = 0, b = 0, c = 0;
  for (let q = 0; q < n; q++) if (inl[q]) { const x = us[q] - mu, y = vs[q] - mv; a += x * x; b += x * y; c += y * y; }
  const th = 0.5 * Math.atan2(2 * b, a - c);
  const d = [Math.cos(th), Math.sin(th)], nn = [-d[1], d[0]];
  let rms = 0; for (let q = 0; q < n; q++) if (inl[q]) { const e = nn[0] * (us[q] - mu) + nn[1] * (vs[q] - mv); rms += e * e; }
  return { p: [mu, mv], d, n: nn, inliers: inl, count: m, rms: Math.sqrt(rms / m) };
}

function circle3(x1, y1, x2, y2, x3, y3) {
  const a = x1 - x2, b = y1 - y2, c = x1 - x3, d = y1 - y3;
  const e = ((x1 * x1 - x2 * x2) + (y1 * y1 - y2 * y2)) / 2, f = ((x1 * x1 - x3 * x3) + (y1 * y1 - y3 * y3)) / 2;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return null;
  const cx = (d * e - b * f) / det, cy = (a * f - c * e) / det;
  return [cx, cy, Math.hypot(x1 - cx, y1 - cy)];
}
function solve3(A, B) {
  const M = A.map((r, i) => [...r, B[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}
export function smallestEigenvector(a, b, d, e, f, g) {
  let A = [[a, b, d], [b, e, f], [d, f, g]];
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 8; sweep++) for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
    if (Math.abs(A[p][q]) < 1e-12) continue;
    const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
  }
  let mi = 0; for (let i = 1; i < 3; i++) if (A[i][i] < A[mi][mi]) mi = i;
  const v = [V[0][mi], V[1][mi], V[2][mi]], L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}
export function median(arr) { if (!arr.length) return null; const a = Float64Array.from(arr).sort(); return a[a.length >> 1]; }
