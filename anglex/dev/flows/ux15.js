const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) ボルト接合の提案: 穴つき板 2 枚を重ねて置く → 穴が一致 → 提案 → 適用でボルト接合が増える
const r1 = await page.evaluate(async () => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove()); const R = await import('./js/ui/review.js');
  const t1 = app.model.addType('plate', 'PL-9 テスト板 A', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 90, pitchH: 90, holeD: 13.5 }); const t2 = app.model.addType('plate', 'PL-9 テスト板 B', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 90, pitchH: 90, holeD: 13.5 });
  const a = app.model.addInstance(t1.id, { pos: [3000, 0, 0], params: {}, level: 'L0' }); const b = app.model.addInstance(t2.id, { pos: [3000, 9, 0], params: {}, level: 'L0' }); app.rebuildAll();
  const before = app.model.joints.length; const cands = R.boltSuggestions(app); const mine = cands.filter(c => (c.a.id === a.id && c.b.id === b.id) || (c.a.id === b.id && c.b.id === a.id));
  R.openBoltSuggest(app); await new Promise(r => setTimeout(r, 400)); const rows = document.querySelectorAll('.modal-back:last-of-type tbody tr').length; [...document.querySelectorAll('.modal-back:last-of-type .modal-foot .btn')].find(x => /適用/.test(x.textContent))?.click(); await new Promise(r => setTimeout(r, 1200));
  const j = app.model.joints.find(x => x.type === 'bolt' && x.points); const ev = j ? app.model.joints.indexOf(j) : -1; const parts = j ? app.model.explodeParts().filter(p => p.kind === 'bolt' && /接合ボルト/.test(p.name || '')).length : 0;
  return { cands: cands.length, mine: mine.map(c => [c.pairs.length, c.M, c.contact.axis]), rows, jointsBefore: before, jointsAfter: app.model.joints.length, joint: j ? [j.M, j.count, j.status, j.points.length] : null, boltParts: parts, flowBtn: null };
});
log('BOLTS', r1);
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 2) 学習の状態タブ（管理画面）
const r2 = await page.evaluate(async () => { const A = await import('./js/ui/admin.js'); await A.openAdmin(app, { tab: 'learn' }); await new Promise(r => setTimeout(r, 500)); const kpis = [...document.querySelectorAll('.admin-wrap .dash-kpi')].map(k => k.textContent); const tables = document.querySelectorAll('.admin-wrap table').length; document.querySelectorAll('.modal-back').forEach(m => m.remove()); return { kpis, tables }; });
log('LEARNTAB', r2);
// 3) B社: 利益率履歴を 2 件ためる → B社ビューで「前回の利益率を流用」
const tok = await page.evaluate(async () => { const E = await import('./js/ui/estimate.js'); const P = await import('./js/core/pricing.js'); const est = await E.createEstimate(app);
  for (let k = 0; k < 2; k++) { const fake = JSON.parse(JSON.stringify(est)); fake.id = est.id + '_m' + k; fake.revision = 20 + k; fake.lines.forEach(l => { l.bMarginPct = 18; }); await P.recordMarginsFromEstimate(app, fake); }
  await app.store.editEstimate(est.id, { role: 'A', who: 't', lineId: est.lines[0].id, field: 'qty', value: est.lines[0].qty }).catch(() => {}); const r = await app.store.handoffEstimate(est.id, { from: 'A', to: 'B', who: app.user().name, note: 't', due: '2026-11-12' }); return r.token; });
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tok, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1500);
const r3 = await page.evaluate(async () => { const F = await import('./js/ui/flow.js'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); await F.openFlow(app); await new Promise(r => setTimeout(r, 900));
  const est0 = (await app.store.listEstimates(app.project.id)).find(e => e.currentOrg === 'B'); for (const l of est0.lines) { await app.store.editEstimate(est0.id, { role: 'B', who: 't', lineId: l.id, field: 'bMarginPct', value: null }).catch(() => {}); } await F.openFlow(app); await new Promise(r => setTimeout(r, 900));
  const chip0 = document.querySelector('.rv-pending .chip')?.textContent; const btn = [...document.querySelectorAll('.rv-bulk .btn')].find(b => /前回の利益率を流用/.test(b.textContent)); if (!btn) return { error: 'no margin reuse button', chip0 }; btn.click(); await new Promise(r => setTimeout(r, 1500));
  const est = (await app.store.listEstimates(app.project.id)).find(e => e.currentOrg === 'B'); return { role: app.role(), chip0, chip1: document.querySelector('.rv-pending .chip')?.textContent, margins: [...new Set(est.lines.map(l => l.bMarginPct))], total: est.lines.length }; });
log('MARGIN', r3);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u15_b.png' });
