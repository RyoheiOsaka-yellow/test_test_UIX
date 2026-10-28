// ラスター図面（スキャン PDF / 画像）のベクタ化: 二値化 → 軸方向の線分抽出（行・列のラン）→ 矩形（閉ループ）復元 → DXF 互換の entities
// 寸法注記は読めないので、縮尺（1:n）と解像度（dpi）から mm/px を決める。斜線・円は v1 では対象外（矩形・直線のみ）
export function otsu(hist, total) { let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sumB = 0, wB = 0, max = 0, thr = 128; for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); if (v > max) { max = v; thr = t; } } return thr; }
export async function imageToBinary(src, { maxPx = 2200 } = {}) {
  const img = src instanceof HTMLCanvasElement ? src : await loadImage(src); const s = Math.min(1, maxPx / Math.max(img.width, img.height)); const w = Math.max(1, Math.round(img.width * s)), hgt = Math.max(1, Math.round(img.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = hgt; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt); ctx.drawImage(img, 0, 0, w, hgt);
  const d = ctx.getImageData(0, 0, w, hgt).data; const g = new Uint8Array(w * hgt); const hist = new Uint32Array(256); for (let i = 0, k = 0; i < d.length; i += 4, k++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; g[k] = v; hist[v]++; }
  const thr = Math.min(otsu(hist, w * hgt), 200); const bin = new Uint8Array(w * hgt); for (let k = 0; k < g.length; k++) bin[k] = g[k] < thr ? 1 : 0; return { bin, w, h: hgt, scale: s, thr, canvas: c };
}
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('画像を読めません')); im.src = typeof src === 'string' ? src : URL.createObjectURL(src); }); }
// 行方向・列方向のラン（連続した黒）を抽出し、隣接する行のランを束ねて 1 本の線にする
function runs(bin, w, h, minLen, horizontal) {
  const out = []; const N = horizontal ? h : w, M = horizontal ? w : h; const at = (i, j) => horizontal ? bin[i * w + j] : bin[j * w + i];
  let open = []; // {a,b,i0,i1,sum}
  for (let i = 0; i < N; i++) { const cur = []; let j = 0; while (j < M) { if (!at(i, j)) { j++; continue; } let k = j; while (k < M && at(i, k)) k++; if (k - j >= minLen) cur.push([j, k - 1]); j = k; }
    const next = []; for (const [a, b] of cur) { let hit = null; for (const o of open) { if (o.i1 === i - 1 && Math.min(b, o.b) - Math.max(a, o.a) > minLen * 0.6) { hit = o; break; } } if (hit) { hit.i1 = i; hit.a = Math.min(hit.a, a); hit.b = Math.max(hit.b, b); hit.n++; next.push(hit); open.splice(open.indexOf(hit), 1); } else next.push({ a, b, i0: i, i1: i, n: 1 }); }
    for (const o of open) out.push(o); open = next; }
  out.push(...open); return out.filter(o => o.i1 - o.i0 + 1 <= Math.max(6, (o.b - o.a) * 0.25)).map(o => { const c = (o.i0 + o.i1) / 2; return horizontal ? { a: [o.a, c], b: [o.b, c], thick: o.i1 - o.i0 + 1 } : { a: [c, o.a], b: [c, o.b], thick: o.i1 - o.i0 + 1 }; });
}
// 水平線と垂直線から矩形（4 辺が揃う閉ループ）を復元
function rectangles(H, V, tol) {
  const rects = []; const near = (x, y) => Math.abs(x - y) <= tol;
  for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) { const t = H[i], b = H[j]; if (near(t.a[1], b.a[1])) continue; const x0 = Math.max(t.a[0], b.a[0]), x1 = Math.min(t.b[0], b.b[0]); if (x1 - x0 < tol * 2) continue; if (!near(t.a[0], b.a[0]) || !near(t.b[0], b.b[0])) continue;
    const y0 = Math.min(t.a[1], b.a[1]), y1 = Math.max(t.a[1], b.a[1]); const left = V.find(v => near(v.a[0], x0) && v.a[1] <= y0 + tol && v.b[1] >= y1 - tol), right = V.find(v => near(v.a[0], x1) && v.a[1] <= y0 + tol && v.b[1] >= y1 - tol); if (left && right) rects.push({ x0, y0, x1, y1 }); }
  // 入れ子・重複を除く（ほぼ同じ矩形）
  return rects.filter((r, i) => !rects.some((o, k) => k < i && near(o.x0, r.x0) && near(o.x1, r.x1) && near(o.y0, r.y0) && near(o.y1, r.y1)));
}
// 画像 → DXF 互換 entities（mm 座標、Y 上向き）
export async function vectorizeImage(src, { mmPerPx = null, dpi = 200, scale = 10, minLenMm = 15 } = {}) {
  const { bin, w, h, scale: s, thr, canvas } = await imageToBinary(src); const mmpp = mmPerPx != null ? mmPerPx / s : (25.4 / dpi) * scale / s; const minLen = Math.max(8, Math.round(minLenMm / mmpp));
  const H = runs(bin, w, h, minLen, true), V = runs(bin, w, h, minLen, false); const tol = Math.max(3, Math.round(2 / mmpp) + 2); const rects = rectangles(H, V, tol);
  const toMm = ([x, y]) => [Math.round(x * mmpp * 10) / 10, Math.round((h - y) * mmpp * 10) / 10];
  const entities = []; for (const l of [...H, ...V]) entities.push({ type: 'LINE', a: toMm(l.a), b: toMm(l.b), layer: 'RASTER' });
  for (const r of rects) entities.push({ type: 'LWPOLYLINE', pts: [toMm([r.x0, r.y0]), toMm([r.x1, r.y0]), toMm([r.x1, r.y1]), toMm([r.x0, r.y1])], closed: true, layer: 'RASTER_RECT' });
  return { entities, layers: { RASTER: { on: true }, RASTER_RECT: { on: true } }, stats: { px: `${w}×${h}`, threshold: thr, lines: H.length + V.length, rects: rects.length, mmPerPx: Math.round(mmpp * 1000) / 1000 }, mmPerPx: mmpp, canvas };
}
