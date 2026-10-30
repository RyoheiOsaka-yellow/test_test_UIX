const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// スキャン図面（デモ DXF を 200 dpi 相当に画像化）を OCR 付きで読込 → 仕様注記が部材に紐づくこと
const r1 = await page.evaluate(async () => {
  const { parseDXF, dxfToSVG } = await import('./js/import/dxf.js'); const src = (await import('./js/main.js')).demoDXF(); const dxf = parseDXF(src); const bb = dxf.bbox;
  const scale = 10, pxPerMm = 200 / 25.4 / scale, pad0 = Math.max(bb.w, bb.h) * 0.04; const W = Math.round((bb.w + 2 * pad0) * pxPerMm), H = Math.round((bb.h + 2 * pad0) * pxPerMm);
  const svg = dxfToSVG(dxf, { width: W, height: H }).replace(/stroke-width="[^"]*"/g, `stroke-width="${0.5 * scale}"`).replace(/vector-effect="non-scaling-stroke"/g, ''); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'scan_demo.png', { type: 'image/png' }); const imp = await import('./js/ui/importer.js');
  const t0 = performance.now(); const rec = await imp.importRaster(app, file, { name: 'scan_demo.png', opts: { scale, dpi: 200, minLenMm: 15, ocr: true } }); const d = app.drawing;
  return { ms: Math.round(performance.now() - t0), ocr: d.ocr.length, ocrSample: d.ocr.slice(0, 6).map(x => x.text + ' ' + x.conf + '%'), members: rec.members.map(m => [m.id, m.spec, m.length, m.status, m.ocr, m.lengthSource]), review: rec.members.filter(m => m.status === 'review').length };
});
log('OCRIMPORT', r1);
await page.waitForTimeout(600); await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u11_ocr.png' });
// 図面上で修正: 修正モードで最初の矩形をクリック → 仕様を入力して保存 → 再認識・学習記録
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.drawingEdit = true; app.setView('2d'); }); await page.waitForTimeout(800);
const r2 = await page.evaluate(async () => {
  const paths = [...document.querySelectorAll('.svg-host.editing path.editable')]; const circles = document.querySelectorAll('.svg-host.editing circle.editable').length; const texts = document.querySelectorAll('.svg-host.editing text.editable').length; const img = !!document.querySelector('.svg-host svg image');
  if (!paths.length) return { error: 'no editable rects', circles, texts, img };
  const ents = app.drawing.dxf.entities.filter(e => e.type === 'LWPOLYLINE'); const idxOf = m => ents.findIndex(e => Math.abs(Math.min(...e.pts.map(p => p[0])) - m.bbox.x0) < 1 && Math.abs(Math.min(...e.pts.map(p => p[1])) - m.bbox.y0) < 1); const mems = app.drawing.rec.members.filter(m => m.bbox && idxOf(m) >= 0); window.__memIdx = mems.map(idxOf); if (!mems.length) return { error: 'no member rects' };
  paths[window.__memIdx[0]].dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
  const spec = document.querySelector('.modal-back:last-of-type input[list="anglexSpecList"]'); if (!spec) return { error: 'no edit modal' }; spec.value = 'L-65x65x6'; const len = document.querySelector('.modal-back:last-of-type input[type="number"]'); len.value = '800';
  [...document.querySelectorAll('.modal-back:last-of-type .modal-foot .btn')].find(b => /保存して再認識/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 900));
  const d = app.drawing; const L = await import('./js/import/learn.js'); const hist = await L.listLearn(app);
  return { rects: paths.length, circles, texts, img, edits: d.edits.length, user: d.rec.members.filter(m => m.user).map(m => [m.spec, m.length, m.status]), learnRows: hist.filter(r => r.status === 'corrected' || r.status === 'rejected').length, undoBtn: !!document.querySelector('.dwg-tools button[title="最後の修正を取り消す"]:not([disabled])') };
});
log('EDIT', r2);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u11_edit.png' });
// 「部材ではない」で除外 → 候補が減る
const r3 = await page.evaluate(async () => {
  const before = app.drawing.dxf.entities.filter(e => e.type === 'LWPOLYLINE').length; const paths = [...document.querySelectorAll('.svg-host.editing path.editable')]; const ents = app.drawing.dxf.entities.filter(e => e.type === 'LWPOLYLINE'); const m2 = app.drawing.rec.members.filter(m => m.bbox && !m.user).map(m => ents.findIndex(e => Math.abs(Math.min(...e.pts.map(p => p[0])) - m.bbox.x0) < 1 && Math.abs(Math.min(...e.pts.map(p => p[1])) - m.bbox.y0) < 1)).filter(i => i >= 0); if (!m2.length) return { error: 'no member rects' }; paths[m2[m2.length - 1]].dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
  [...document.querySelectorAll('.modal-back:last-of-type .modal-foot .btn')].find(b => /部材ではない/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 900)); return { before, after: app.drawing.dxf.entities.filter(e => e.type === 'LWPOLYLINE').length, members: app.drawing.rec.members.length, edits: app.drawing.edits.length };
});
log('REMOVE', r3);
await page.waitForTimeout(400); await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u11_edit2.png' });
// 業務フロー: 次の一手バナー（スキャン要判断 or 確認）とタイムライン
const r4 = await page.evaluate(async () => { const F = await import('./js/ui/flow.js'); await F.openFlow(app); await new Promise(r => setTimeout(r, 900)); const b = document.querySelector('.flow-next'); return { banner: b?.querySelector('.fn-title')?.textContent, cls: b?.className, btn: b?.querySelector('button')?.textContent, dwgKv: [...document.querySelectorAll('.flow-card[data-k="model"] .fc-kv')].map(k => k.textContent).slice(0, 8) }; });
log('FLOW', r4);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u11_flow.png' });
// 共有タイムラインと催促文: 見積を作成 → 期限を過去にして C社へ受け渡し → バナー（超過・催促文）とタイムライン
const r5 = await page.evaluate(async () => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove()); const E = await import('./js/ui/estimate.js'); const est = await E.createEstimate(app); if (!est) return { error: 'no estimate' };
  await app.store.handoffEstimate(est.id, { from: 'A', to: 'C', who: app.user().name, note: 'テスト', due: '2026-10-01' }); app.currentEstimateId = est.id;
  const F = await import('./js/ui/flow.js'); await F.openFlow(app); await new Promise(r => setTimeout(r, 900));
  const b = document.querySelector('.flow-next'); const tl = [...document.querySelectorAll('.flow-timeline .flow-tl')].map(x => x.querySelector('.lbl')?.textContent); const rem = [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].map(x => x.textContent).find(t => /催促/.test(t));
  const H = await import('./js/ui/handoff.js'); const msg = H.reminderMessage(app, (await app.store.listEstimates(app.project.id)).find(e => e.id === est.id));
  return { banner: b?.querySelector('.fn-title')?.textContent, cls: b?.className, btn: b?.querySelector('button')?.textContent, timeline: tl, reminderBtn: rem, msgHead: msg.split('\n').slice(0, 6) };
});
log('TIMELINE', r5);
await page.evaluate(() => document.querySelector('.flow-card[data-k="share"]')?.scrollIntoView()); await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u11_tl.png' });
