// web-ifc / pdf.js の CDN 初期化チェック + ミニ PDF のテキスト抽出
const r = await page.evaluate(async () => {
  const out = {};
  try { const m = await import('/js/import/ifc.js'); const t0 = performance.now(); await m.loadWebIfc(); out.ifc = 'ok ' + Math.round(performance.now() - t0) + 'ms'; } catch (e) { out.ifc = 'ERR ' + e.message; }
  try { const m = await import('/js/import/pdf.js'); const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 150>>stream\nBT /F1 14 Tf 50 780 Td (L-50x50x6 L=600 SUPPORT) Tj 0 -30 Td (FB-6x50 L=300 2-15 HDZ) Tj 0 -30 Td (PL-9x150x150 BASE PL) Tj 0 -30 Td (SGP 50A U-BOLT) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF`; const buf = new TextEncoder().encode(pdf).buffer; const res = await m.parsePDF(buf); out.pdf = res.items.map(i => i.text); const rec = (await import('/js/import/recognize.js')).recognizeTextItems(res.items); out.pdfMembers = rec.members.map(x => x.spec + ':' + (x.length || '?')); } catch (e) { out.pdf = 'ERR ' + e.message; }
  return out;
});
console.log('LIBS:', JSON.stringify(r));
