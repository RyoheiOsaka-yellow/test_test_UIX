const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 提案した接合（推論）が確認ウィザードのカードに出る → 確定 → 外す
const r1 = await page.evaluate(async () => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove()); const R = await import('./js/ui/review.js'); const W = await import('./js/ui/reviewWizard.js');
  const t1 = app.model.addType('plate', 'PL-9 A', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 90, pitchH: 90, holeD: 13.5 }); const a = app.model.addInstance(t1.id, { pos: [3000, 0, 0], params: {}, level: 'L0' }); const b = app.model.addInstance(t1.id, { pos: [3000, 9, 0], params: {}, level: 'L0' });
  const t2 = app.model.addType('plate', 'PL-9 C', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 90, pitchH: 90, holeD: 13.5 }); const c = app.model.addInstance(t2.id, { pos: [3600, 0, 0], params: {}, level: 'L0' }); const d = app.model.addInstance(t2.id, { pos: [3600, 9, 0], params: {}, level: 'L0' }); app.rebuildAll();
  const cands = R.boltSuggestions(app); for (const cnd of cands) app.model.addJoint({ type: 'bolt', a: cnd.a.id, b: cnd.b.id, M: cnd.M, count: cnd.pairs.length, points: cnd.points, sides: 1, allAround: true, site: false, status: 'inferred', label: `${cnd.a.mark}–${cnd.b.mark} ${cnd.M} ボルト（穴位置から提案）` }); app.rebuildAll();
  const inferred0 = app.model.joints.filter(j => j.status === 'inferred').length; W.openReviewWizard(app, { kind: 'joint' }); await new Promise(r => setTimeout(r, 600));
  const card = document.querySelector('.wiz-card')?.textContent.slice(0, 80); const chips = [...document.querySelectorAll('.wiz-chips .chip')].map(x => x.textContent); const count = document.querySelector('.wiz-head .muted')?.textContent;
  [...document.querySelectorAll('.wiz-actions .btn')].find(x => /接合を確定/.test(x.textContent))?.click(); await new Promise(r => setTimeout(r, 700)); const confirmed = app.model.joints.filter(j => j.status === 'confirmed').length;
  [...document.querySelectorAll('.wiz-actions .btn')].find(x => x.textContent === '外す')?.click(); await new Promise(r => setTimeout(r, 700)); const total = app.model.joints.length; W.closeReviewWizard(app);
  return { cands: cands.length, inferred0, card, chips, count, confirmed, totalAfter: total };
});
log('WIZJOINT', r1);
// 2) 学習データの書出し → 内容確認 → 別データとして読み込み（重複除外）、目標管理の表
const r2 = await page.evaluate(async () => {
  const L = await import('./js/import/learn.js'); const P = await import('./js/core/pricing.js'); await L.recordCorrection(app, 'TEST|L300-700|h0||raster', { kind: 'corrected', spec: 'L-50x50x6', length: 500 }); L.recordImportStats({ name: 'x.png', kind: 'ラスター', branch: 'TKY', members: 10, review: 6, learned: 1 }); L.recordImportStats({ name: 'y.dxf', kind: 'DXF', branch: 'OSK', members: 8, review: 1, learned: 2 });
  const data = await L.exportLearn(app); data.prices = await P.exportHistory(app); const n0 = data.learn.length;
  const dup = await L.importLearn(app, data); const extra = await L.importLearn(app, { learn: [{ at: '2026-01-01T00:00:00.000Z', sig: 'EXT|L<300|h0||dxf', status: 'confirmed', familyId: 'member', params: { spec: 'L-40x40x5' }, by: 'other-branch' }], stats: [{ at: '2026-01-02T00:00:00.000Z', name: 'z.png', kind: 'ラスター', branch: 'NGY', members: 5, review: 3, learned: 0 }] });
  const pr = await P.importHistory(app, [{ tag: 'ext#1', at: '2026-01-03T00:00:00.000Z', familyId: 'member', family: 'member', spec: 'spec=L-50x50x6', mass: 5, factoryCost: 1200, leadDays: 10, key: 'member|spec=L-50x50x6|M(3-10kg)', fkey: 'member|M(3-10kg)', desc: 't' }]);
  const A = await import('./js/ui/admin.js'); await A.openAdmin(app, { tab: 'learn' }); await new Promise(r => setTimeout(r, 600)); const kpis = [...document.querySelectorAll('.admin-wrap .dash-kpi')].map(k => k.textContent); const tgt = [...document.querySelectorAll('.admin-wrap table')].map(t => t.querySelector('thead')?.textContent.slice(0, 30)); const tRows = [...document.querySelectorAll('.admin-wrap table')].find(t => /図面様式/.test(t.textContent))?.querySelectorAll('tbody tr').length; const ioBtns = [...document.querySelectorAll('.admin-wrap .rv-pending .btn')].map(b => b.textContent); document.querySelectorAll('.modal-back').forEach(m => m.remove());
  return { exported: n0, hasPrices: Array.isArray(data.prices), dup, extra, pr, kpis, tables: tgt, targetRows: tRows, ioBtns, learnNow: (await L.listLearn(app)).length };
});
log('LEARNIO', r2);
await page.evaluate(async () => { const A = await import('./js/ui/admin.js'); await A.openAdmin(app, { tab: 'learn' }); }); await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u16_learn.png' });
