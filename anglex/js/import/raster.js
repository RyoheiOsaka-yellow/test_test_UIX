// ラスター図面（スキャン PDF / 画像）のベクタ化: 二値化 → 軸方向の線分抽出（行・列のラン）→ 矩形（閉ループ）復元 → DXF 互換の entities
// 寸法注記は読めないので、縮尺（1:n）と解像度（dpi）から mm/px を決める。斜線（方杖）と円（穴）は連結成分の形状から抽出
export function otsu(hist, total) { let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sumB = 0, wB = 0, max = 0; const vs = new Float64Array(256); for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) * (mB - mF); vs[t] = v; if (v > max) max = v; } // 二峰（0 / 255 のみ）では分散が平坦になるため、最大値の台地の中央を取る
  const ts = []; for (let t = 0; t < 256; t++) if (vs[t] >= max * (1 - 1e-6)) ts.push(t); return ts.length ? ts[Math.floor(ts.length / 2)] : 128; }
export async function imageToBinary(src, { maxPx = 2200 } = {}) {
  const img = src instanceof HTMLCanvasElement ? src : await loadImage(src); const s = Math.min(1, maxPx / Math.max(img.width, img.height)); const w = Math.max(1, Math.round(img.width * s)), hgt = Math.max(1, Math.round(img.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = hgt; const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt); ctx.drawImage(img, 0, 0, w, hgt);
  const d = ctx.getImageData(0, 0, w, hgt).data; const g = new Uint8Array(w * hgt); const hist = new Uint32Array(256); for (let i = 0, k = 0; i < d.length; i += 4, k++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; g[k] = v; hist[v]++; }
  // 図面はインク率 1〜5% 程度。Otsu が薄い線を白側に落とした（インク率 < 0.4%）場合は、暗い方から 1% に達する輝度まで閾値を上げる
  let thr = Math.min(Math.max(otsu(hist, w * hgt), 40), 200); const total = w * hgt; let cum = 0; for (let t = 0; t <= thr; t++) cum += hist[t]; if (cum / total < 0.004) { let acc = 0; for (let t = 0; t < 256; t++) { acc += hist[t]; if (acc / total >= 0.01) { thr = Math.min(Math.max(thr, t), 225); break; } } }
  const bin = new Uint8Array(total); for (let k = 0; k < g.length; k++) bin[k] = g[k] <= thr ? 1 : 0; const speckles = despeckle(bin, w, hgt); return { bin, w, h: hgt, scale: s, thr, speckles, canvas: c };
}
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('画像を読めません')); im.src = typeof src === 'string' ? src : URL.createObjectURL(src); }); }
// 行方向・列方向のラン（連続した黒）を抽出し、隣接する行のランを束ねて 1 本の線にする
// スキャンのごま塩ノイズ除去: 孤立した黒画素（8 近傍に黒が 1 以下）を白に、ほぼ囲まれた白画素（8 近傍に黒が 7 以上）を黒に。線（幅 2px 以上）は変わらない
export function despeckle(bin, w, h) { const src = bin.slice(); let n = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x; const c = src[k - w - 1] + src[k - w] + src[k - w + 1] + src[k - 1] + src[k + 1] + src[k + w - 1] + src[k + w] + src[k + w + 1]; if (src[k] && c <= 1) { bin[k] = 0; n++; } else if (!src[k] && c >= 7) { bin[k] = 1; n++; } } return n; }
// 円環テスト: 中心から 16 方向に走査し、黒の帯 [rin, rout] が全方向でほぼ同じ（真円）かつ中心に穴がある
function ringProfile(bin, w, h, cx, cy, rmax) { const rin = [], rout = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); let i0 = -1, i1 = -1; for (let r = 0; r <= rmax + 2; r += 0.5) { const x = Math.round(cx + r * dx), y = Math.round(cy + r * dy); if (x < 0 || y < 0 || x >= w || y >= h) break; if (bin[y * w + x]) { if (i0 < 0) i0 = r; i1 = r; } else if (i0 >= 0) break; } if (i0 < 0) return null; rin.push(i0); rout.push(i1); } const mean = v => v.reduce((a, b) => a + b, 0) / v.length; const sd = v => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); }; return { rin: mean(rin), rout: mean(rout), sdIn: sd(rin), sdOut: sd(rout) }; }
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
// 軸方向の線に使った画素を消し、残りの黒画素の連結成分から 斜線（細長い成分）と 円（中空で正方形に近い成分）を抽出
function components(bin, w, h, used, { maxComp = 4000 } = {}) {
  const seen = new Uint8Array(w * h); const out = []; const stack = new Int32Array(w * h);
  for (let k = 0; k < w * h && out.length < maxComp; k++) { if (!bin[k] || used[k] || seen[k]) continue; let sp = 0; stack[sp++] = k; seen[k] = 1; let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    while (sp) { const q = stack[--sp]; const x = q % w, y = (q - x) / w; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const d of [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1]) { const r = q + d; if (r < 0 || r >= w * h) continue; const rx = r % w; if (Math.abs(rx - x) > 1) continue; if (bin[r] && !used[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r; } } }
    out.push({ n, x0, x1, y0, y1, cx: sx / n, cy: sy / n, sxx: sxx / n - (sx / n) ** 2, syy: syy / n - (sy / n) ** 2, sxy: sxy / n - (sx / n) * (sy / n) }); }
  return out;
}
function markRuns(used, w, lines, thick) { for (const l of lines) { const t = Math.max(1, Math.round((l.thick || 1) / 2) + 1); const [ax, ay] = l.a, [bx, by] = l.b; if (ay === by) { const y = Math.round(ay); for (let x = Math.round(ax); x <= Math.round(bx); x++) for (let dy = -t; dy <= t; dy++) { const k = (y + dy) * w + x; if (k >= 0 && k < used.length) used[k] = 1; } } else { const x = Math.round(ax); for (let y = Math.round(ay); y <= Math.round(by); y++) for (let dx = -t; dx <= t; dx++) { const k = y * w + x + dx; if (k >= 0 && k < used.length) used[k] = 1; } } } }
// 円の検証: 中心から半径 r の円周 16 方向に黒があり（12 以上）、半径 0.55r 以内は白（文字の o/0/8 や塗り潰しを除外）
function isAnnulus(bin, w, h, cx, cy, r) { let hit = 0, inner = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; let ok = false; for (const dr of [-2.5, -1.5, -0.5, 0.5, 1.5]) { const x = Math.round(cx + (r + dr) * Math.cos(a)), y = Math.round(cy + (r + dr) * Math.sin(a)); if (x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x]) { ok = true; break; } } if (ok) hit++; const ix = Math.round(cx + 0.3 * r * Math.cos(a)), iy = Math.round(cy + 0.3 * r * Math.sin(a)); if (ix >= 0 && iy >= 0 && ix < w && iy < h && bin[iy * w + ix]) inner++; } return hit >= 12 && inner <= 2; }
// 直線（mm 座標）から矩形を復元（真値の作成や DXF にも使える汎用版）
export function rectsFromLines(lines, tol = 2) { const H = lines.filter(l => Math.abs(l.a[1] - l.b[1]) <= tol).map(l => ({ a: [Math.min(l.a[0], l.b[0]), (l.a[1] + l.b[1]) / 2], b: [Math.max(l.a[0], l.b[0]), (l.a[1] + l.b[1]) / 2] })); const V = lines.filter(l => Math.abs(l.a[0] - l.b[0]) <= tol).map(l => ({ a: [(l.a[0] + l.b[0]) / 2, Math.min(l.a[1], l.b[1])], b: [(l.a[0] + l.b[0]) / 2, Math.max(l.a[1], l.b[1])] })); return rectangles(H, V, tol); }
export function diagonalsAndCircles(bin, w, h, H, V, { minLen = 20, minD = 6, maxD = 90 } = {}) {
  // 1) 円（穴）: ラン除去の前に、生の連結成分から探す。太い小円の上下の弦は短い直線として拾われてしまうため、先に円を確定して該当するランを除外する
  const circles = []; const compsAll = components(bin, w, h, new Uint8Array(w * h), { maxComp: 20000 });
  for (const c of compsAll) { const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1; if (c.n < 12 || bw < minD || bw > maxD || bh > maxD) continue;
    // ほぼ正方形（文字の 0 / O は縦長）・中空（中心が白）・円環の内外径が全方向でほぼ一定
    if (Math.abs(bw - bh) > Math.max(1, bw * 0.12)) continue; const fill = c.n / (bw * bh); const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; const r = (bw + bh) / 4; const centerWhite = !bin[Math.round(cy) * w + Math.round(cx)]; if (!(fill > 0.1 && fill < 0.85 && centerWhite && isAnnulus(bin, w, h, cx, cy, r))) continue;
    const p = ringProfile(bin, w, h, cx, cy, r + 1); if (p && p.rin >= 1 && p.rin >= 0.12 * p.rout && p.sdIn <= Math.max(0.8, 0.12 * p.rout) && p.sdOut <= Math.max(0.7, 0.1 * p.rout)) circles.push({ c: [cx, cy], r: (p.rin + p.rout) / 2, rOut: p.rout, n: c.n, bbox: { x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1 } }); }
  // 2) 斜線: 水平・垂直ランと円を除いた残りの連結成分のうち、主軸方向に細長いもの
  const used = new Uint8Array(w * h); markRuns(used, w, H); markRuns(used, w, V); for (const c of circles) for (let y = c.bbox.y0; y <= c.bbox.y1; y++) for (let x = c.bbox.x0; x <= c.bbox.x1; x++) used[y * w + x] = 1;
  const comps = components(bin, w, h, used); const diag = [];
  for (const c of comps) { if (c.n < 12) continue;
    const tr = c.sxx + c.syy, det = c.sxx * c.syy - c.sxy * c.sxy; const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)); const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc); const len = Math.sqrt(l1) * 2 * Math.sqrt(3); if (len < minLen || l1 / l2 < 25) continue; const ang = 0.5 * Math.atan2(2 * c.sxy, c.sxx - c.syy); const dx = Math.cos(ang), dy = Math.sin(ang); if (Math.abs(dx) < 0.12 || Math.abs(dy) < 0.12) continue; // ほぼ水平／垂直はラン抽出に任せる
    diag.push({ a: [c.cx - dx * len / 2, c.cy - dy * len / 2], b: [c.cx + dx * len / 2, c.cy + dy * len / 2], len, thick: Math.round(Math.sqrt(l2) * 2 * Math.sqrt(3)) }); }
  return { diag, circles };
}
// 画像 → DXF 互換 entities（mm 座標、Y 上向き）
export async function vectorizeImage(src, { mmPerPx = null, dpi = 200, scale = 10, minLenMm = 15 } = {}) {
  const { bin, w, h, scale: s, thr, speckles, canvas } = await imageToBinary(src); const mmpp = mmPerPx != null ? mmPerPx / s : (25.4 / dpi) * scale / s; const minLen = Math.max(8, Math.round(minLenMm / mmpp));
  const H = runs(bin, w, h, minLen, true), V = runs(bin, w, h, minLen, false); const tol = Math.max(3, Math.round(2 / mmpp) + 2); const rects = rectangles(H, V, tol);
  const toMm = ([x, y]) => [Math.round(x * mmpp * 10) / 10, Math.round((h - y) * mmpp * 10) / 10];
  const { diag, circles: circles0 } = diagonalsAndCircles(bin, w, h, H, V, { minLen: minLen, minD: Math.max(5, Math.round(4 / mmpp)), maxD: Math.round(60 / mmpp) });
  const circles = circles0.filter(c => rects.some(r => c.c[0] > r.x0 + 2 && c.c[0] < r.x1 - 2 && c.c[1] > r.y0 + 2 && c.c[1] < r.y1 - 2)); // 穴は部材外形（矩形）の内側にある。文字の o / 0 を除外
  const inCircle = l => circles.some(c => l.a[0] >= c.bbox.x0 - 1 && l.b[0] <= c.bbox.x1 + 1 && l.a[1] >= c.bbox.y0 - 1 && l.b[1] <= c.bbox.y1 + 1); const Hl = H.filter(l => !inCircle(l)), Vl = V.filter(l => !inCircle(l)); // 円の弦として拾われた短いランを除く
  const entities = []; for (const l of [...Hl, ...Vl]) entities.push({ type: 'LINE', a: toMm(l.a), b: toMm(l.b), layer: 'RASTER' }); for (const l of diag) entities.push({ type: 'LINE', a: toMm(l.a), b: toMm(l.b), layer: 'RASTER_DIAG' }); for (const c of circles) entities.push({ type: 'CIRCLE', c: toMm(c.c), r: Math.round(c.r * mmpp * 10) / 10, layer: 'RASTER_HOLE' });
  for (const r of rects) entities.push({ type: 'LWPOLYLINE', pts: [toMm([r.x0, r.y0]), toMm([r.x1, r.y0]), toMm([r.x1, r.y1]), toMm([r.x0, r.y1])], closed: true, layer: 'RASTER_RECT' });
  return { entities, layers: { RASTER: { on: true }, RASTER_RECT: { on: true }, RASTER_DIAG: { on: true }, RASTER_HOLE: { on: true } }, stats: { px: `${w}×${h}`, threshold: thr, speckles, lines: Hl.length + Vl.length, diagonals: diag.length, circles: circles.length, circlesRaw: circles0.length, rects: rects.length, mmPerPx: Math.round(mmpp * 1000) / 1000 }, mmPerPx: mmpp, canvas };
}
