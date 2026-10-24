// LAS / LAZ reader and LAS writer (plain script: no imports, so it can also run inside a classic
// worker that loads laz-perf via importScripts). Produces the same attribute set as the synthesiser:
// positions (y-up, local metres), intensity, classification, deviation (=0), element id (none), normals.
const LAZPERF_URL = 'https://cdn.jsdelivr.net/npm/laz-perf@0.0.6/lib/web/';

export function readLasHeader(buf) {
  const dv = new DataView(buf);
  const sig = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (sig !== 'LASF') throw new Error('LAS ファイルではありません（署名 LASF がありません）');
  const vMajor = dv.getUint8(24), vMinor = dv.getUint8(25);
  const headerSize = dv.getUint16(94, true);
  const offsetToPoints = dv.getUint32(96, true);
  const formatByte = dv.getUint8(104);
  const compressed = (formatByte & 0x80) !== 0;
  const format = formatByte & 0x3f;
  const recordLength = dv.getUint16(105, true);
  let count = dv.getUint32(107, true);
  if (vMajor === 1 && vMinor >= 4 && headerSize >= 375) {
    const c64 = dv.getBigUint64(247, true);
    if (c64 > 0n) count = Number(c64);
  }
  const scale = [dv.getFloat64(131, true), dv.getFloat64(139, true), dv.getFloat64(147, true)];
  const offset = [dv.getFloat64(155, true), dv.getFloat64(163, true), dv.getFloat64(171, true)];
  const max = [dv.getFloat64(179, true), dv.getFloat64(195, true), dv.getFloat64(211, true)];
  const min = [dv.getFloat64(187, true), dv.getFloat64(203, true), dv.getFloat64(219, true)];
  return { version: `${vMajor}.${vMinor}`, headerSize, offsetToPoints, format, compressed, recordLength, count, scale, offset, min, max };
}

/** Byte offsets of fields inside a point record for each point data format. */
export function recordLayout(format) {
  const f = format;
  if (f <= 5) return { cls: 15, clsMask: 0x1f, rgb: f === 2 ? 20 : f === 3 || f === 5 ? 28 : -1 };
  return { cls: 16, clsMask: 0xff, rgb: f === 7 || f === 8 || f === 10 ? 30 : -1 };
}

// ASPRS classification → viewer classes (see synth.js CLS). Codes 20–31 are this viewer's own
// extended classes (markings, parapets, piers, girders, …) and survive a LAS round trip unchanged.
const CLS_MAP = { 2: 2, 3: 3, 4: 3, 5: 5, 6: 6, 7: 18, 9: 9, 10: 11, 11: 11, 13: 25, 14: 25, 15: 29, 17: 17, 18: 18, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30 };

/**
 * Decode point records into viewer arrays.
 * getRecord(i, dv) must return the byte offset of record i inside the DataView dv.
 */
export function decodeRecords(header, dv, getRecord, { maxPoints = 16e6, progress = () => {} } = {}) {
  const n = header.count, stride = Math.max(1, Math.ceil(n / maxPoints));
  const m = Math.floor(n / stride);
  const lay = recordLayout(header.format);
  const [sx, sy, sz] = header.scale, [ox, oy, oz] = header.offset;
  // local frame: centre of the bounding box in XY, min Z at 0; LAS Z-up → viewer Y-up
  const cx = (header.min[0] + header.max[0]) / 2, cy = (header.min[1] + header.max[1]) / 2, z0 = header.min[2];
  const pos = new Float32Array(m * 3), inten = new Uint8Array(m), cls = new Uint8Array(m), dev = new Uint8Array(m).fill(128), elem = new Uint16Array(m).fill(65535);
  const hasRgb = lay.rgb >= 0;
  const rgb = hasRgb ? new Uint8Array(m * 3) : null;
  const rawI = new Uint16Array(m);
  let maxI = 0;
  for (let k = 0; k < m; k++) {
    const o = getRecord(k * stride, dv);
    pos[k * 3] = dv.getInt32(o, true) * sx + ox - cx;
    pos[k * 3 + 1] = dv.getInt32(o + 8, true) * sz + oz - z0;
    pos[k * 3 + 2] = -(dv.getInt32(o + 4, true) * sy + oy - cy);
    const I = dv.getUint16(o + 12, true); rawI[k] = I; if (I > maxI) maxI = I;
    const c = dv.getUint8(o + lay.cls) & lay.clsMask;
    cls[k] = CLS_MAP[c] ?? 1;
    if (hasRgb) { rgb[k * 3] = dv.getUint16(o + lay.rgb, true) >> 8; rgb[k * 3 + 1] = dv.getUint16(o + lay.rgb + 2, true) >> 8; rgb[k * 3 + 2] = dv.getUint16(o + lay.rgb + 4, true) >> 8; }
    if ((k & 0xfffff) === 0) progress(k / m);
  }
  // intensity: normalise to the 99th percentile so a few saturated returns do not flatten the rest
  const hist = new Uint32Array(1024);
  const div = Math.max(1, maxI) / 1023;
  for (let k = 0; k < m; k++) hist[(rawI[k] / div) | 0]++;
  let acc = 0, p99 = 1023;
  for (let b = 0; b < 1024; b++) { acc += hist[b]; if (acc >= m * 0.99) { p99 = b; break; } }
  const iScale = 255 / Math.max(1, p99 * div);
  for (let k = 0; k < m; k++) inten[k] = Math.min(255, rawI[k] * iScale);
  // if the file carries no classification at all, colour by RGB luminance as intensity fallback
  return { n: m, pos, inten, cls, dev, elem, rgb, stride, local: { cx, cy, z0 } };
}

/** Parse an uncompressed LAS buffer. */
export function parseLas(buf, opts) {
  const header = readLasHeader(buf);
  if (header.compressed) throw new Error('LAZ 圧縮ファイルです: parseLaz を使用してください');
  const dv = new DataView(buf);
  const base = header.offsetToPoints, len = header.recordLength;
  const out = decodeRecords(header, dv, (i) => base + i * len, opts);
  return { header, ...out };
}

/** Decode a LAZ buffer with laz-perf (must be loaded: `createLazPerf` global or passed module). */
export async function parseLaz(buf, opts = {}) {
  const header = readLasHeader(buf);
  const create = opts.createLazPerf || (typeof createLazPerf !== 'undefined' ? createLazPerf : null);
  if (!create) throw new Error('laz-perf が読み込まれていません');
  const LazPerf = await create({ locateFile: (f) => LAZPERF_URL + f });
  const bytes = new Uint8Array(buf);
  const filePtr = LazPerf._malloc(bytes.length);
  LazPerf.HEAPU8.set(bytes, filePtr);
  const laszip = new LazPerf.LASZip();
  laszip.open(filePtr, bytes.length);
  const count = laszip.getCount(), recLen = laszip.getPointLength();
  header.count = count; header.recordLength = recLen; header.format = laszip.getPointFormat();
  // decode all records sequentially into one contiguous buffer, then reuse the LAS decoder
  const all = new ArrayBuffer(count * recLen);
  const allU8 = new Uint8Array(all);
  const recPtr = LazPerf._malloc(recLen);
  for (let i = 0; i < count; i++) {
    laszip.getPoint(recPtr);
    allU8.set(LazPerf.HEAPU8.subarray(recPtr, recPtr + recLen), i * recLen);
    if ((i & 0x7ffff) === 0 && opts.progress) opts.progress((i / count) * 0.5);
  }
  laszip.delete(); LazPerf._free(recPtr); LazPerf._free(filePtr);
  const dv = new DataView(all);
  const out = decodeRecords(header, dv, (i) => i * recLen, { ...opts, progress: (p) => opts.progress && opts.progress(0.5 + p * 0.5) });
  return { header, ...out };
}

/**
 * Grid-cell PCA normals: points are binned into cubic cells sized for ~24 points per cell, the
 * covariance of each cell gives its normal (smallest eigenvector), assigned to all points in it.
 * Sign is irrelevant for surfel rendering. Returns Int8 normals (x127).
 */
export function estimateNormals(pos, n, { targetPerCell = 24 } = {}) {
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const area = Math.max(1, (maxx - minx) * (maxz - minz));
  const cell = Math.max(0.15, Math.min(4, Math.sqrt((area * targetPerCell) / n) * 1.1));
  const nx = Math.ceil((maxx - minx) / cell) + 1, ny = Math.ceil((maxy - miny) / cell) + 1, nz = Math.ceil((maxz - minz) / cell) + 1;
  const key = new Uint32Array(n);
  const stats = new Map(); // key → Float64Array(10): count, sx, sy, sz, sxx, sxy, sxz, syy, syz, szz
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const k = (((y - miny) / cell) | 0) * nx * nz + (((z - minz) / cell) | 0) * nx + (((x - minx) / cell) | 0);
    key[i] = k;
    let s = stats.get(k);
    if (!s) { s = new Float64Array(10); stats.set(k, s); }
    s[0]++; s[1] += x; s[2] += y; s[3] += z; s[4] += x * x; s[5] += x * y; s[6] += x * z; s[7] += y * y; s[8] += y * z; s[9] += z * z;
  }
  const normals = new Map();
  for (const [k, s] of stats) {
    const c = s[0];
    if (c < 5) continue;
    const mx = s[1] / c, my = s[2] / c, mz = s[3] / c;
    const a = s[4] / c - mx * mx, b = s[5] / c - mx * my, d = s[6] / c - mx * mz, e = s[7] / c - my * my, f = s[8] / c - my * mz, g = s[9] / c - mz * mz;
    normals.set(k, smallestEigenvector(a, b, d, e, f, g));
  }
  const out = new Int8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = normals.get(key[i]);
    if (!v) continue;
    out[i * 3] = v[0] * 127; out[i * 3 + 1] = v[1] * 127; out[i * 3 + 2] = v[2] * 127;
  }
  return { normals: out, cell, spacing: Math.sqrt(area / n) };
}

/**
 * k-nearest-neighbour PCA normals (hash grid, radius-limited). Much sharper on walls and edges
 * than the cell PCA above; used when the cloud is small enough (see LAS_WORKER_BODY).
 */
export function estimateNormalsKnn(pos, n, { k = 14, progress = () => {} } = {}) {
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  const area = Math.max(1, (maxx - minx) * (maxz - minz));
  const spacing = Math.sqrt(area / n);
  const cell = Math.max(0.1, spacing * 2.2);
  const nx = Math.ceil((maxx - minx) / cell) + 1, ny = Math.ceil((maxy - miny) / cell) + 1, nz = Math.ceil((maxz - minz) / cell) + 1;
  const cellOf = new Uint32Array(n), counts = new Uint32Array(nx * ny * nz + 1);
  for (let i = 0; i < n; i++) {
    const c = (((pos[i * 3 + 1] - miny) / cell) | 0) * nx * nz + (((pos[i * 3 + 2] - minz) / cell) | 0) * nx + (((pos[i * 3] - minx) / cell) | 0);
    cellOf[i] = c; counts[c + 1]++;
  }
  for (let c = 0; c < nx * ny * nz; c++) counts[c + 1] += counts[c];
  const cursor = counts.slice(0, -1), sorted = new Uint32Array(n);
  for (let i = 0; i < n; i++) sorted[cursor[cellOf[i]]++] = i;
  const out = new Int8Array(n * 3);
  const r2max = (cell * 1.5) ** 2;
  const cand = new Float64Array(2048 * 2); // [dist2, index] pairs
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const cx = ((x - minx) / cell) | 0, cy = ((y - miny) / cell) | 0, cz = ((z - minz) / cell) | 0;
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) { const yy = cy + dy; if (yy < 0 || yy >= ny) continue;
      for (let dz = -1; dz <= 1; dz++) { const zz = cz + dz; if (zz < 0 || zz >= nz) continue;
        for (let dx = -1; dx <= 1; dx++) { const xx = cx + dx; if (xx < 0 || xx >= nx) continue;
          const c = yy * nx * nz + zz * nx + xx;
          for (let q = counts[c]; q < counts[c + 1] && m < 2048; q++) {
            const j = sorted[q]; if (j === i) continue;
            const d2 = (pos[j * 3] - x) ** 2 + (pos[j * 3 + 1] - y) ** 2 + (pos[j * 3 + 2] - z) ** 2;
            if (d2 < r2max) { cand[m * 2] = d2; cand[m * 2 + 1] = j; m++; }
          }
        }
      }
    }
    if (m < 4) continue;
    // partial selection of the k nearest (m is small)
    const kk = Math.min(k, m);
    for (let a = 0; a < kk; a++) { let best = a; for (let b = a + 1; b < m; b++) if (cand[b * 2] < cand[best * 2]) best = b; if (best !== a) { const t0 = cand[a * 2], t1 = cand[a * 2 + 1]; cand[a * 2] = cand[best * 2]; cand[a * 2 + 1] = cand[best * 2 + 1]; cand[best * 2] = t0; cand[best * 2 + 1] = t1; } }
    let sx = x, sy = y, sz = z;
    for (let a = 0; a < kk; a++) { const j = cand[a * 2 + 1]; sx += pos[j * 3]; sy += pos[j * 3 + 1]; sz += pos[j * 3 + 2]; }
    const cnt = kk + 1, mx = sx / cnt, my = sy / cnt, mz = sz / cnt;
    let a = 0, b = 0, d = 0, e = 0, f = 0, g = 0;
    const acc = (px, py, pz) => { const ux = px - mx, uy = py - my, uz = pz - mz; a += ux * ux; b += ux * uy; d += ux * uz; e += uy * uy; f += uy * uz; g += uz * uz; };
    acc(x, y, z); for (let q = 0; q < kk; q++) { const j = cand[q * 2 + 1]; acc(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]); }
    const v = smallestEigenvector(a / cnt, b / cnt, d / cnt, e / cnt, f / cnt, g / cnt);
    out[i * 3] = v[0] * 127; out[i * 3 + 1] = v[1] * 127; out[i * 3 + 2] = v[2] * 127;
    if ((i & 0x3ffff) === 0) progress(i / n);
  }
  return { normals: out, spacing, cell };
}

// smallest eigenvector of the symmetric 3x3 matrix [[a,b,d],[b,e,f],[d,f,g]] via a few Jacobi sweeps
function smallestEigenvector(a, b, d, e, f, g) {
  let A = [[a, b, d], [b, e, f], [d, f, g]];
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 8; sweep++) {
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(A[p][q]) < 1e-12) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  let mi = 0;
  for (let i = 1; i < 3; i++) if (A[i][i] < A[mi][mi]) mi = i;
  const v = [V[0][mi], V[1][mi], V[2][mi]];
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}

/** Write a LAS 1.2 point-format-2 file (XYZ, intensity, classification, RGB) from viewer arrays. */
export function writeLas({ n, pos, inten, cls, rgb }, { offset = [0, 0, 0] } = {}) {
  // standard ASPRS codes where they exist, this viewer's extended codes (20–31) otherwise
  const INV = { 2: 2, 3: 3, 5: 5, 6: 6, 9: 9, 11: 11, 17: 17, 18: 18, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30 };
  const headerSize = 227, recLen = 26;
  const buf = new ArrayBuffer(headerSize + n * recLen);
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8.set([76, 65, 83, 70], 0); // LASF
  dv.setUint8(24, 1); dv.setUint8(25, 2);
  u8.set(new TextEncoder().encode('LiDAR x BIM synth'.padEnd(32, '\0')), 26);
  u8.set(new TextEncoder().encode('pointcloud-highway'.padEnd(32, '\0')), 58);
  dv.setUint16(94, headerSize, true); dv.setUint32(96, headerSize, true); dv.setUint32(100, 0, true);
  dv.setUint8(104, 2); dv.setUint16(105, recLen, true); dv.setUint32(107, n, true);
  const sc = 0.001;
  dv.setFloat64(131, sc, true); dv.setFloat64(139, sc, true); dv.setFloat64(147, sc, true);
  dv.setFloat64(155, offset[0], true); dv.setFloat64(163, offset[1], true); dv.setFloat64(171, offset[2], true);
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) {
    const X = pos[i * 3], Y = -pos[i * 3 + 2], Z = pos[i * 3 + 1]; // viewer y-up → LAS z-up
    const o = headerSize + i * recLen;
    dv.setInt32(o, Math.round(X / sc), true); dv.setInt32(o + 4, Math.round(Y / sc), true); dv.setInt32(o + 8, Math.round(Z / sc), true);
    dv.setUint16(o + 12, inten[i] * 257, true);
    dv.setUint8(o + 14, 0x11); // return 1 of 1
    dv.setUint8(o + 15, INV[cls[i]] ?? 1);
    if (rgb) { dv.setUint16(o + 20, rgb[i * 3] * 257, true); dv.setUint16(o + 22, rgb[i * 3 + 1] * 257, true); dv.setUint16(o + 24, rgb[i * 3 + 2] * 257, true); }
    if (X < minx) minx = X; if (X > maxx) maxx = X; if (Y < miny) miny = Y; if (Y > maxy) maxy = Y; if (Z < minz) minz = Z; if (Z > maxz) maxz = Z;
  }
  dv.setFloat64(179, maxx + offset[0], true); dv.setFloat64(187, minx + offset[0], true);
  dv.setFloat64(195, maxy + offset[1], true); dv.setFloat64(203, miny + offset[1], true);
  dv.setFloat64(211, maxz + offset[2], true); dv.setFloat64(219, minz + offset[2], true);
  return buf;
}

/** Body of the classic worker that decodes a file (LAS or LAZ) and estimates normals. */
export const LAS_WORKER_BODY = `
self.onmessage = async (ev) => {
  const { buf, isLaz, maxPoints } = ev.data;
  try {
    const progress = (p) => self.postMessage({ type: 'progress', p: p * 0.7 });
    let r;
    if (isLaz) { importScripts('${LAZPERF_URL}laz-perf.js'); r = await parseLaz(buf, { maxPoints, progress }); }
    else r = parseLas(buf, { maxPoints, progress });
    self.postMessage({ type: 'progress', p: 0.75 });
    // k-NN PCA for clouds up to 3 M points, grid-cell PCA beyond (time-bounded)
    const { normals, spacing, cell } = r.n <= 2.5e6 ? estimateNormalsKnn(r.pos, r.n, { progress: (p) => self.postMessage({ type: 'progress', p: 0.75 + p * 0.25 }) }) : estimateNormals(r.pos, r.n);
    const out = { type: 'done', n: r.n, pos: r.pos, inten: r.inten, cls: r.cls, dev: r.dev, elem: r.elem, nrm: normals, rgb: r.rgb, header: r.header, stride: r.stride, spacing, cell, local: r.local };
    self.postMessage(out, [r.pos.buffer, r.inten.buffer, r.cls.buffer, r.dev.buffer, r.elem.buffer, normals.buffer].concat(r.rgb ? [r.rgb.buffer] : []));
  } catch (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); }
};
`;
