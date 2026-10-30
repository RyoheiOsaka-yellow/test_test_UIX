const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) スキャン読込: 穴注記・アンカー注記が最寄り部材に紐付き、配置した 3D 部材に穴が入る
const r1 = await page.evaluate(async () => {
  const { parseDXF, dxfToSVG } = await import('./js/import/dxf.js'); const src = (await import('./js/main.js')).demoDXF(); const dxf = parseDXF(src); const bb = dxf.bbox;
  const scale = 10, pxPerMm = 300 / 25.4 / scale, pad0 = Math.max(bb.w, bb.h) * 0.04; const W = Math.round((bb.w + 2 * pad0) * pxPerMm), H = Math.round((bb.h + 2 * pad0) * pxPerMm);
  const svg = dxfToSVG(dxf, { width: W, height: H }).replace(/stroke-width="[^"]*"/g, `stroke-width="${0.5 * scale}"`).replace(/vector-effect="non-scaling-stroke"/g, ''); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'scan_demo300.png', { type: 'image/png' }); const imp = await import('./js/ui/importer.js');
  const before = app.model.instances.length; const rec = await imp.importRaster(app, file, { name: 'scan_demo300.png', opts: { scale, dpi: 300, minLenMm: 15, ocr: true } });
  const notes = rec.notes.map(n => [n.text, Object.keys(n.feat).join(','), n.ocr]); const linked = rec.members.map(m => [m.id, m.spec, Object.keys(m.feat).join(','), (m.linkedNotes || []).length]);
  // 配置
  [...document.querySelectorAll('.modal-back:last-of-type .modal-foot .btn, #recHost .rec-actions .btn')].find(b => /モデルへ配置/.test(b.textContent))?.click(); await new Promise(r => setTimeout(r, 1200));
  const placed = app.model.instances.filter(i => i.source === 'import').map(i => { const p = app.model.resolved(i); return [i.name, p.spec || p.profile, p.holes || '', p.finish]; });
  return { ocr: app.drawing.ocr.length, jpn: app.drawing.ocr.filter(x => x.jpn).map(x => x.text), notes, linked, placed, added: app.model.instances.length - before, anchorNote: rec.members.some(m => m.feat.anchor) || rec.notes.some(n => n.feat.anchor) };
});
log('HOLES', r1);
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 2) C社ビュー: 見積 → C社へ受け渡し → C社としてリンクを開く → 未入力が上、残り n 行、未入力だけ表示
const tok = await page.evaluate(async () => { const E = await import('./js/ui/estimate.js'); const est = await E.createEstimate(app); const r = await app.store.handoffEstimate(est.id, { from: 'A', to: 'C', who: app.user().name, note: 't', due: '2026-11-05' }); const fresh = (await app.store.listEstimates(app.project.id)).find(e => e.id === est.id); await app.store.editEstimate(est.id, { role: 'C', who: 'test', lineId: fresh.lines[0].id, field: 'factoryCost', value: 1234 }).catch(() => {}); return r.token; });
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tok, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1500);
const r2 = await page.evaluate(async () => { const F = await import('./js/ui/flow.js'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); await F.openFlow(app); await new Promise(r => setTimeout(r, 900));
  const chip = document.querySelector('.rv-pending .chip')?.textContent; const rowsAll = document.querySelectorAll('.rv-wrap .est-table tbody tr').length; const pendingRows = document.querySelectorAll('.rv-wrap .est-table tbody tr.pending').length; const firstPending = document.querySelector('.rv-wrap .est-table tbody tr')?.classList.contains('pending');
  const btn = [...document.querySelectorAll('.rv-pending .btn')].find(b => /未入力だけ/.test(b.textContent)); btn?.click(); await new Promise(r => setTimeout(r, 900)); const rowsPending = document.querySelectorAll('.rv-wrap .est-table tbody tr').length; const btn2 = [...document.querySelectorAll('.rv-pending .btn')].map(b => b.textContent);
  return { role: app.role(), chip, rowsAll, pendingRows, firstPending, rowsPending, btn2, deadline: document.querySelector('.rv-deadline')?.textContent.slice(0, 40) }; });
log('CVIEW', r2);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u13_c.png' });
