const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 期限通知: 見積を作成 → 期限を過去にして C社へ → バッジ・通知一覧・ダッシュボード KPI
const r1 = await page.evaluate(async () => {
  const E = await import('./js/ui/estimate.js'); const est = await E.createEstimate(app); await app.store.handoffEstimate(est.id, { from: 'A', to: 'C', who: app.user().name, note: 't', due: '2026-10-01' });
  await app.refreshReminders(); await new Promise(r => setTimeout(r, 300)); const badge = document.querySelector('#btnDashboard .rem-badge, #btnDashboard2 .rem-badge');
  const R = await import('./js/ui/reminders.js'); R.openReminders(app); await new Promise(r => setTimeout(r, 300)); const rows = [...document.querySelectorAll('.modal-back:last-of-type tbody tr')].map(tr => tr.textContent.slice(0, 80)); document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const D = await import('./js/ui/dashboard.js'); await D.openDashboard(app); await new Promise(r => setTimeout(r, 1200)); const kpis = [...document.querySelectorAll('.dash-kpi')].map(k => k.textContent); document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const { remindersFor } = await import('./js/core/reminders.js'); const ests = await app.store.listEstimates(app.project.id); const rem = remindersFor(ests, 'A');
  return { badge: badge?.textContent, badgeBad: badge?.classList.contains('bad'), items: app.reminders?.items?.length, rows, kpis, kinds: rem.map(r => r.kind) };
});
log('REMIND', r1);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u12_badge.png' });
// 2) デスキュー: 1.5° 回したスキャン画像 → skew 推定と矩形認識
const r2 = await page.evaluate(async () => {
  const { parseDXF, dxfToSVG } = await import('./js/import/dxf.js'); const { vectorizeImage } = await import('./js/import/raster.js'); const src = (await import('./js/main.js')).demoDXF(); const dxf = parseDXF(src); const bb = dxf.bbox;
  const pxPerMm = 300 / 25.4 / 10, pad0 = Math.max(bb.w, bb.h) * 0.04; const W = Math.round((bb.w + 2 * pad0) * pxPerMm), H = Math.round((bb.h + 2 * pad0) * pxPerMm);
  const svg = dxfToSVG(dxf, { width: W, height: H }).replace(/stroke-width="[^"]*"/g, 'stroke-width="5"').replace(/vector-effect="non-scaling-stroke"/g, ''); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.save(); g.translate(W / 2, H / 2); g.rotate(1.5 * Math.PI / 180); g.drawImage(img, -W / 2, -H / 2, W, H); g.restore();
  const vec = await vectorizeImage(c, { mmPerPx: 1 / pxPerMm, minLenMm: 15 }); const c0 = document.createElement('canvas'); c0.width = W; c0.height = H; const g0 = c0.getContext('2d'); g0.fillStyle = '#fff'; g0.fillRect(0, 0, W, H); g0.drawImage(img, 0, 0, W, H); const vec0 = await vectorizeImage(c0, { mmPerPx: 1 / pxPerMm, minLenMm: 15 });
  return { skew: vec.stats.skew, rects: vec.stats.rects, circles: vec.stats.circles, straightRects: vec0.stats.rects, straightCircles: vec0.stats.circles, straightSkew: vec0.stats.skew };
});
log('DESKEW', r2);
// 3) 日本語 OCR（限定語彙）: 大きめの注記文字で 仕上げ／長穴／全周／Uボルト／アンカー
const r3 = await page.evaluate(async () => {
  const O = await import('./js/import/ocr.js'); const c = document.createElement('canvas'); c.width = 900; c.height = 170; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 170); g.fillStyle = '#000'; g.font = '20px sans-serif';
  g.fillText('材質 SS400  仕上げ 溶融亜鉛めっき HDZ55', 10, 30); g.fillText('長穴 12x25  Uボルト 50A  ▷6 全周', 10, 70); g.fillText('4-φ15  アンカー M12', 10, 110); g.fillText('L-50x50x6  L=600', 10, 150);
  const t0 = performance.now(); const out = await O.ocrRegions(c, [{ x0: 6, y0: 10, x1: 520, y1: 38 }, { x0: 6, y0: 50, x1: 480, y1: 78 }, { x0: 6, y0: 90, x1: 300, y1: 118 }, { x0: 6, y0: 130, x1: 300, y1: 158 }]);
  const R = await import('./js/import/recognize.js'); return { ms: Math.round(performance.now() - t0), out: out.map(x => [x.lang, x.text, x.conf, x.jpn || '']), feats: out.map(x => R.featuresInText(x.text)) };
});
log('JPN', r3);
