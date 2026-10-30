const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 穴位置: デモ DXF（ベクタ）を読込 → 板（PL）は図面の円の位置が extraHoles に、単材は z 位置つき holes。確認事項に穴位置の出所
const r1 = await page.evaluate(async () => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove()); const imp = await import('./js/ui/importer.js'); const src = (await import('./js/main.js')).demoDXF(); const file = new File([src], 'demo.dxf', { type: 'text/plain' });
  const before = app.model.instances.length; await imp.importFile(app, file); await new Promise(r => setTimeout(r, 800));
  [...document.querySelectorAll('.modal-back:last-of-type .modal-foot .btn, #recHost .rec-actions .btn')].find(b => /モデルへ配置/.test(b.textContent))?.click(); await new Promise(r => setTimeout(r, 1200));
  const placed = app.model.instances.filter(i => i.source === 'import'); const R = await import('./js/bim/review.js');
  return placed.map(i => { const p = app.model.resolved(i); const fam = app.model.familyOf(i); let holeItems = 0; try { holeItems = R.buildChecklist(i, fam.parts(p, { inst: i, model: app.model })).filter(x => x.kind === 'hole').length; } catch { } const partHoles = app.instanceParts(i).reduce((a, pt) => a + ((pt.holes || []).length), 0); return { name: i.name, fam: fam.id, holes: (p.holes || i.params.extraHoles || '').slice(0, 90), partHoles, holePos: i.holePos, reasons: (i.reviewReasons || []).filter(r => /穴位置/.test(r)), holeItems }; }).concat([{ added: app.model.instances.length - before }]);
});
log('HOLEPOS', r1);
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 2) 検証結果 CSV の取込（管理画面）
const r2 = await page.evaluate(async () => {
  const A = await import('./js/ui/admin.js'); const L = await import('./js/import/learn.js'); const before = (await L.listLearn(app)).length; await A.openAdmin(app, { tab: 'feedback' }); await new Promise(r => setTimeout(r, 500));
  const ta = document.querySelector('.admin-wrap textarea'); if (!ta) return { error: 'no feedback pane' };
  ta.value = '﻿図面,ID,認識した仕様,認識した長さ,状態,正誤（○/×）,正しい仕様,正しい長さ,備考,署名（変更しない）\r\n"scan1.png","D1","L-50x50x5","603","review","○","","","","L-50X50X5|L300-700|h0||raster"\r\n"scan1.png","D2","L-40x40x3","503","review","×","L-40x40x5","500","","L-40X40X3|L300-700|h0||raster"\r\n"scan1.png","D3","L-50x50x5","305","review","×","","","枠線","L-50X50X5|L300-700|h0||raster"\r\n"scan1.png","D4","L-50x50x5","1020","review","","","","","L-50X50X5|L700-1500|h0||raster"';
  ta.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200)); const preview = document.querySelector('.admin-wrap .muted.small:nth-of-type(1)')?.textContent; const rowsShown = document.querySelectorAll('.admin-wrap tbody tr').length;
  [...document.querySelectorAll('.admin-wrap .btn')].find(b => b.textContent === '学習に反映').click(); await new Promise(r => setTimeout(r, 600)); const hist = await L.listLearn(app); const fb = hist.filter(r => r.feedback);
  const after = document.querySelectorAll('.admin-wrap tbody tr').length; document.querySelectorAll('.modal-back').forEach(m => m.remove());
  return { before, after: hist.length, fb: fb.map(r => [r.feedback, r.status, r.params?.spec, r.params?.L]), rowsShown, afterRows: after };
});
log('FEEDBACK', r2);
// 3) C社: 過去回答（単価履歴）を 2 件ためる → C社ビューで「前回回答を流用」→ 未入力行が埋まる
const tok = await page.evaluate(async () => { const E = await import('./js/ui/estimate.js'); const P = await import('./js/core/pricing.js'); const est = await E.createEstimate(app);
  for (let k = 0; k < 2; k++) { const fake = JSON.parse(JSON.stringify(est)); fake.id = est.id + '_h' + k; fake.revision = 9 + k; fake.lines.forEach(l => { l.factoryCost = Math.round(l.baseCost * 0.9); l.leadDays = 12; }); await P.recordFromEstimate(app, fake); }
  const r = await app.store.handoffEstimate(est.id, { from: 'A', to: 'C', who: app.user().name, note: 't', due: '2026-11-10' }); return r.token; });
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tok, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1500);
const r3 = await page.evaluate(async () => { const F = await import('./js/ui/flow.js'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); await F.openFlow(app); await new Promise(r => setTimeout(r, 900));
  const chip0 = document.querySelector('.rv-pending .chip')?.textContent; const btn = [...document.querySelectorAll('.rv-bulk .btn')].find(b => /前回回答を流用/.test(b.textContent)); if (!btn) return { error: 'no reuse button', chip0 }; btn.click(); await new Promise(r => setTimeout(r, 1500));
  const est = (await app.store.listEstimates(app.project.id)).find(e => e.currentOrg === 'C'); return { role: app.role(), chip0, chip1: document.querySelector('.rv-pending .chip')?.textContent, filled: est.lines.filter(l => l.factoryCost != null).length, lead: est.lines.filter(l => l.leadDays != null).length, total: est.lines.length, sample: est.lines.slice(0, 2).map(l => [l.desc, l.baseCost, l.factoryCost, l.leadDays]) }; });
log('REUSE', r3);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u14_reuse.png' });
