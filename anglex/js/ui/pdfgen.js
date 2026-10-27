// PDF 生成（pdf-lib + fontkit + Noto Sans JP 埋め込み・サブセット化）。印刷ダイアログに依存せず直接ダウンロードできる日本語 PDF。
let libs = null, fontBytes = null, fontIsTrueType = false, hb = null;
// HarfBuzz（WASM）によるフォントサブセット: 使用した文字だけを含むフォントを生成して埋め込む（pdf-lib 内蔵サブセッタは CJK で不安定なため）
async function loadHb() { if (hb) return hb; try { const r = await fetch('https://cdn.jsdelivr.net/npm/harfbuzzjs@0.4.6/hb-subset.wasm'); const { instance } = await WebAssembly.instantiate(await r.arrayBuffer()); hb = instance.exports; } catch (e) { console.warn('hb-subset 読込失敗（全文埋込にフォールバック）', e); hb = null; } return hb; }
export function hbSubset(fontBuf, text) {
  if (!hb) return null; const ex = hb; const src = new Uint8Array(fontBuf); const ptr = ex.malloc(src.byteLength); new Uint8Array(ex.memory.buffer).set(src, ptr);
  const blob = ex.hb_blob_create(ptr, src.byteLength, 2, 0, 0); const face = ex.hb_face_create(blob, 0); ex.hb_blob_destroy(blob);
  const input = ex.hb_subset_input_create_or_fail(); const uset = ex.hb_subset_input_unicode_set(input); const cps = new Set([...text].map(c => c.codePointAt(0))); for (let c = 0x20; c < 0x7f; c++) cps.add(c); for (const c of cps) ex.hb_set_add(uset, c);
  // GSUB/GPOS/GDEF を落とす: fontkit が英字直後の数字を locl 代替グリフへ置換し全角幅で描かれる問題を防ぐ（帳票はカーニング不要）
  const dset = ex.hb_subset_input_set(input, 3 /* HB_SUBSET_SETS_DROP_TABLE_TAG */); for (const t of ['GSUB', 'GPOS', 'GDEF']) ex.hb_set_add(dset, ((t.charCodeAt(0) << 24) | (t.charCodeAt(1) << 16) | (t.charCodeAt(2) << 8) | t.charCodeAt(3)) >>> 0);
  const sub = ex.hb_subset_or_fail(face, input); ex.hb_subset_input_destroy(input); if (!sub) { ex.hb_face_destroy(face); ex.free(ptr); return null; }
  const rb = ex.hb_face_reference_blob(sub); const off = ex.hb_blob_get_data(rb, 0); const len = ex.hb_blob_get_length(rb); const out = len ? new Uint8Array(ex.memory.buffer).slice(off, off + len) : null;
  ex.hb_blob_destroy(rb); ex.hb_face_destroy(sub); ex.hb_face_destroy(face); ex.free(ptr); return out && out.byteLength ? out.buffer : null;
}
function collectText(doc) { const out = []; const walk = v => { if (v == null) return; if (typeof v === 'string' || typeof v === 'number') out.push(String(v)); else if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'object') { for (const [k, x] of Object.entries(v)) if (k !== 'dataUrl') walk(x); } }; walk(doc); out.push('0123456789.,¥/—－：:（）() kg mm m² ANGLEX ' + new Date().toLocaleString('ja-JP')); return out.join(''); }
export async function loadPdfLibs() {
  if (libs) return libs;
  const pdfLib = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js');
  loadHb(); // 並行ロード（失敗しても可）
  if (!window.fontkit) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  if (!fontBytes) { // 1) 同梱の JIS サブセット TrueType（サブセット埋込可 → 小さい PDF） 2) 失敗時は CDN の Noto Sans JP（CFF: 全文埋込）
    if (window.__anglexFontB64) { try { fontBytes = Uint8Array.from(atob(window.__anglexFontB64), c => c.charCodeAt(0)).buffer; fontIsTrueType = true; } catch (e) { fontBytes = null; } } // 単一 HTML 版: 同梱フォント
    try { const r = await fetch(new URL('fonts/NotoSansJP-JIS.ttf', document.baseURI)); if (r.ok) { fontBytes = await r.arrayBuffer(); fontIsTrueType = new DataView(fontBytes).getUint32(0) === 0x00010000; } } catch (e) { }
    if (!fontBytes) { const r = await fetch('https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-jp/NotoSansJP_400Regular.ttf'); if (!r.ok) throw new Error('日本語フォントを取得できません'); fontBytes = await r.arrayBuffer(); fontIsTrueType = false; } }
  libs = { ...pdfLib, fontkit: window.fontkit }; return libs;
}
const A4 = [595.28, 841.89];
// 汎用レポート: { title, subtitle, meta:[[k,v]], sections:[{heading, table:{cols:[{label,w,align}], rows:[[...]]}, text, image:{dataUrl,w,h}, kv:[[k,v]] }], footer, landscape }
export async function buildReport(doc) {
  const { PDFDocument, rgb, StandardFonts } = await loadPdfLibs(); const pdf = await PDFDocument.create(); pdf.registerFontkit(libs.fontkit);
  await loadHb(); let fb = fontBytes; try { const sub = hbSubset(fontBytes, collectText(doc)); if (sub) fb = sub; } catch (e) { console.warn('subset failed', e); }
  const font = await pdf.embedFont(fb, { subset: false }); const mono = await pdf.embedFont(StandardFonts.Helvetica);
  const [W, H] = doc.landscape ? [A4[1], A4[0]] : A4; const M = 40; let page = pdf.addPage([W, H]); let y = H - M; const ink = rgb(0.1, 0.1, 0.09), mute = rgb(0.45, 0.45, 0.42), line = rgb(0.75, 0.73, 0.65), head = rgb(0.92, 0.91, 0.86);
  const tw = (s, size) => font.widthOfTextAtSize(String(s ?? ''), size);
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = hgt => { if (y - hgt < M + 20) newPage(); };
  const text = (s, x, yy, size = 9, color = ink, opts = {}) => { s = String(s ?? ''); let f = font; if (opts.align === 'right') x = x - tw(s, size); if (opts.align === 'center') x = x - tw(s, size) / 2; page.drawText(s, { x, y: yy, size, font: f, color }); };
  const wrap = (s, size, maxW) => { const out = []; let cur = ''; for (const ch of String(s ?? '')) { if (ch === '\n') { out.push(cur); cur = ''; continue; } if (tw(cur + ch, size) > maxW) { out.push(cur); cur = ch; } else cur += ch; } out.push(cur); return out; };
  // ヘッダ
  text(doc.title, M, y - 14, 18); if (doc.subtitle) text(doc.subtitle, W - M, y - 12, 9, mute, { align: 'right' }); y -= 26; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: ink }); y -= 10;
  if (doc.meta?.length) { const colW = (W - 2 * M) / 2; doc.meta.forEach(([k, v], i) => { const x = M + (i % 2) * colW; if (i % 2 === 0 && i > 0) y -= 13; text(k, x, y - 9, 8, mute); text(v, x + 70, y - 9, 9); }); y -= 20; }
  for (const sec of doc.sections || []) {
    if (sec.heading) { need(30); y -= 6; text(sec.heading, M, y - 10, 11); y -= 16; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: line }); y -= 6; }
    if (sec.kv) { for (const [k, v] of sec.kv) { need(14); text(k, M, y - 9, 9, mute); text(v, W - M, y - 9, 9, ink, { align: 'right' }); y -= 13; } y -= 4; }
    if (sec.text) { for (const ln of wrap(sec.text, 8.5, W - 2 * M)) { need(12); text(ln, M, y - 9, 8.5, mute); y -= 11; } y -= 4; }
    if (sec.table) { const cols = sec.table.cols; const total = cols.reduce((s, c) => s + c.w, 0); const scale = (W - 2 * M) / total; const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c.w * scale; }
      const drawHead = () => { page.drawRectangle({ x: M, y: y - 14, width: W - 2 * M, height: 14, color: head }); cols.forEach((c, i) => text(c.label, c.align === 'right' ? xs[i] + c.w * scale - 3 : xs[i] + 3, y - 10, 7.5, ink, { align: c.align === 'right' ? 'right' : 'left' })); y -= 14; };
      need(40); drawHead();
      for (const row of sec.table.rows) { const cellLines = row.map((v, i) => wrap(v, 7.5, cols[i].w * scale - 6)); const hgt = Math.max(...cellLines.map(l => l.length)) * 10 + 4; if (y - hgt < M + 20) { newPage(); drawHead(); } cellLines.forEach((lines, i) => lines.forEach((ln, k) => text(ln, cols[i].align === 'right' ? xs[i] + cols[i].w * scale - 3 : xs[i] + 3, y - 10 - k * 10, 7.5, ink, { align: cols[i].align === 'right' ? 'right' : 'left' }))); y -= hgt; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: line }); }
      if (sec.table.totals) { for (const [k, v, bold] of sec.table.totals) { need(14); text(k, W - M - 160, y - 10, bold ? 10 : 8.5, ink, { align: 'right' }); text(v, W - M - 3, y - 10, bold ? 10 : 8.5, ink, { align: 'right' }); y -= bold ? 15 : 12; } }
      y -= 6; }
    if (sec.image?.dataUrl) { try { const png = await pdf.embedPng(sec.image.dataUrl); const w = Math.min(sec.image.w || 300, W - 2 * M); const h = w * png.height / png.width; need(h + 10); page.drawImage(png, { x: M, y: y - h, width: w, height: h }); if (sec.image.balloons?.length) { const iw = sec.image.iw || png.width, ih = sec.image.ih || png.height; const R = 6.5, minD = R * 2 + 2;
        const bs = sec.image.balloons.map(b => { const ax = M + b.x / iw * w, ay = y - b.y / ih * h; return { n: b.n, ax, ay, lx: ax, ly: ay + 16 }; });
        for (let it = 0; it < 40; it++) { let moved = false; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i], b = bs[j]; const dx = b.lx - a.lx, dy = b.ly - a.ly; const d = Math.hypot(dx, dy) || 0.01; if (d < minD) { const push = (minD - d) / 2 + 0.3; const ux = dx / d, uy = dy / d; a.lx -= ux * push; a.ly -= uy * push; b.lx += ux * push; b.ly += uy * push; moved = true; } } for (const b of bs) { b.lx = Math.min(M + w - R, Math.max(M + R, b.lx)); b.ly = Math.min(y - R, Math.max(y - h + R, b.ly)); } if (!moved) break; }
        for (const b of bs) { const dx = b.ax - b.lx, dy = b.ay - b.ly; const d = Math.hypot(dx, dy); if (d > R + 1) { page.drawLine({ start: { x: b.lx + dx / d * R, y: b.ly + dy / d * R }, end: { x: b.ax, y: b.ay }, thickness: 0.5, color: ink }); page.drawCircle({ x: b.ax, y: b.ay, size: 1.1, color: ink }); } page.drawCircle({ x: b.lx, y: b.ly, size: R, color: rgb(1, 1, 1), borderColor: ink, borderWidth: 0.8 }); text(String(b.n), b.lx, b.ly - 2.4, 6.5, ink, { align: 'center' }); } } y -= h + 8; } catch (e) { console.warn('image section', e); } }
  }
  const pages = pdf.getPages(); pages.forEach((p, i) => { p.drawText(`${doc.footer || 'ANGLEX'}  —  ${i + 1} / ${pages.length}`, { x: M, y: 22, size: 7, font, color: mute }); p.drawText(new Date().toLocaleString('ja-JP'), { x: W - M - 90, y: 22, size: 7, font, color: mute }); });
  return pdf.save();
}
export async function downloadPdf(name, doc) { const bytes = await buildReport(doc); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
// SheetJS（XLSX）ローダ
export async function loadXLSX() { if (window.XLSX) return window.XLSX; await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); return window.XLSX; }
