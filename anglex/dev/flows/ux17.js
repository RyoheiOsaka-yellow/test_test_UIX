const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 打合せの予約（.ics）→ 見積に記録・タイムラインに表示・リンク生成
const r1 = await page.evaluate(async () => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove()); const E = await import('./js/ui/estimate.js'); const est = await E.createEstimate(app); await app.store.handoffEstimate(est.id, { from: 'A', to: 'C', who: app.user().name, note: 't', due: '2026-11-20' }); app.currentEstimateId = est.id;
  const M = await import('./js/ui/meeting.js'); const L = M.meetingLinks({ title: 'テスト', start: new Date('2026-11-05T01:00:00Z'), minutes: 30, details: 'd', attendees: ['c@example.com'] });
  const F = await import('./js/ui/flow.js'); await F.openFlow(app); await new Promise(r => setTimeout(r, 900)); const btn = [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].find(b => /打合せを予約/.test(b.textContent)); if (!btn) return { error: 'no meeting button' }; btn.click(); await new Promise(r => setTimeout(r, 400));
  const dlg = document.querySelector('.modal-back:last-of-type'); const sel = dlg.querySelector('select'); sel.value = 'ics'; const inputs = [...dlg.querySelectorAll('input')]; const att = inputs.find(i => i.value.includes('@') || i.placeholder === '') ; [...dlg.querySelectorAll('.modal-foot .btn')].find(b => b.textContent === 'OK').click(); await new Promise(r => setTimeout(r, 900));
  const fresh = (await app.store.listEstimates(app.project.id)).find(e => e.id === est.id); const linksDlg = document.querySelector('.modal-back:last-of-type')?.textContent.slice(0, 60); document.querySelectorAll('.modal-back').forEach(m => m.remove()); await F.openFlow(app); await new Promise(r => setTimeout(r, 900)); const tl = [...document.querySelectorAll('.flow-timeline .flow-tl .lbl')].map(x => x.textContent); const btnTxt = [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].find(b => /打合せ/.test(b.textContent))?.textContent;
  return { google: L.google.includes('calendar.google.com') && L.google.includes('add=c%40example.com'), teams: L.teams.includes('teams.microsoft.com/l/meeting/new'), outlook: L.outlook.includes('online=1'), ics: L.ics.includes('BEGIN:VEVENT') && L.ics.includes('DTSTART:20261105T010000Z'), meetings: fresh.meetings?.length, audit: fresh.audit.filter(a => a.action === 'meeting').length, timeline: tl, btnTxt, linksDlg };
});
log('MEETING', r1);
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/u17_meeting.png' });
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 2) 片側穴からのボルト提案: 穴あり板 + 無地板 → 提案（片側）→ 適用で無地板に穴があく
const r2 = await page.evaluate(async () => {
  const R = await import('./js/ui/review.js'); const t1 = app.model.addType('plate', 'PL-9 穴あり', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 90, pitchH: 90, holeD: 13.5 }); const t2 = app.model.addType('plate', 'PL-9 無地', { t: 9, W: 200, H: 200, cols: 0, rows: 0, holeD: 13.5 });
  const a = app.model.addInstance(t1.id, { pos: [4000, 0, 0], params: {}, level: 'L0' }); const b = app.model.addInstance(t2.id, { pos: [3975, 9, -25], params: {}, level: 'L0' }); app.rebuildAll();
  const holesB0 = app.instanceParts(b).reduce((n, pt) => n + (pt.holes || []).length, 0); const cands = R.boltSuggestions(app).filter(c => c.a.id === a.id || c.b.id === a.id); const c = cands[0]; if (!c) return { error: 'no candidate' };
  const j = app.model.addJoint({ type: 'bolt', a: c.a.id, b: c.b.id, M: c.M, count: c.pairs.length, points: c.points, drill: c.drill || null, sides: 1, allAround: true, site: false, status: 'inferred', label: 't' }); app.rebuildAll();
  const holesB1 = app.instanceParts(b).reduce((n, pt) => n + (pt.holes || []).length, 0); const holesA1 = app.instanceParts(a).reduce((n, pt) => n + (pt.holes || []).length, 0);
  return { oneSided: c.oneSided, drillMark: c.drillMark, pairs: c.pairs.length, M: c.M, holesB0, holesB1, holesA1, evalHoles: j.eval?.holes?.length, evalParts: j.eval?.parts?.length };
});
log('ONESIDED', r2);
// 3) ダッシュボードの目標未達 KPI とバッジ
const r3 = await page.evaluate(async () => { const L = await import('./js/import/learn.js'); L.recordImportStats({ name: 'a.png', kind: 'ラスター', branch: 'TKY', members: 10, review: 7, learned: 0 }, app); L.recordImportStats({ name: 'b.dxf', kind: 'DXF', branch: 'TKY', members: 10, review: 1, learned: 0 }, app); await app.refreshReminders(); await new Promise(r => setTimeout(r, 400)); const badge = document.querySelector('#btnDashboard .rem-badge, #btnDashboard2 .rem-badge'); const D = await import('./js/ui/dashboard.js'); await D.openDashboard(app); await new Promise(r => setTimeout(r, 1200)); const kpi = [...document.querySelectorAll('.dash-kpi')].map(k => k.textContent).find(t => /目標/.test(t)); document.querySelectorAll('.modal-back').forEach(m => m.remove()); return { badge: badge?.textContent, title: badge?.title.split('\n').filter(t => /目標未達/.test(t)), kpi, over: L.targetsOver(L.listImportStats(), { target: 20 }).map(t => [t.kind, t.rate]) }; });
log('TARGETS', r3);
