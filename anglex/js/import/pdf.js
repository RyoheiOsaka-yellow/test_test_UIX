// PDF 図面: PDF.js（ESM）でページ描画 + テキスト抽出（ベクターPDF）。ラスターのみの場合はテキスト0件 → 要OCR扱い
let pdfjsLib = null;
export async function loadPdfJs() { if (pdfjsLib) return pdfjsLib; pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs'; return pdfjsLib; }
export async function parsePDF(arrayBuffer, { maxPages = 20, scale = 1.5, onPage = null } = {}) {
  const lib = await loadPdfJs(); const doc = await lib.getDocument({ data: arrayBuffer }).promise; const pages = []; const items = [];
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
    const page = await doc.getPage(n); const vp = page.getViewport({ scale }); const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height; await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const tc = await page.getTextContent(); const texts = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ text: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || 8, page: n }));
    // 近接する断片を行として結合（CAD由来PDFは文字がバラバラなことが多い）
    const merged = mergeFragments(texts);
    pages.push({ n, canvas, width: vp.width, height: vp.height, texts: merged, raster: merged.length === 0 }); items.push(...merged); if (onPage) onPage(pages[pages.length - 1]);
  }
  return { numPages: doc.numPages, pages, items, rasterOnly: items.length === 0 };
}
function mergeFragments(ts) { const sorted = [...ts].sort((a, b) => (b.y - a.y) || (a.x - b.x)); const out = []; for (const t of sorted) { const last = out[out.length - 1]; if (last && Math.abs(last.y - t.y) < t.h * 0.6 && t.x - last.xEnd < t.h * 1.2 && t.x >= last.x) { last.text += (t.x - last.xEnd > t.h * 0.3 ? ' ' : '') + t.text; last.xEnd = t.x + t.text.length * t.h * 0.55; } else out.push({ ...t, xEnd: t.x + t.text.length * t.h * 0.55 }); } return out; }
