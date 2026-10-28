const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const okDialog = (vals) => page.evaluate(vals => { const mb = document.querySelector('.modal-back:last-of-type'); const ins = [...mb.querySelectorAll('input, textarea')]; (vals || []).forEach((v, i) => { if (ins[i]) ins[i].value = v; }); mb.querySelector('.modal-foot .btn.primary').click(); }, vals);
// 1) まとめて確認ウィザード
await page.evaluate(async () => { const m = await import('./js/ui/reviewWizard.js'); m.openReviewWizard(app); }); await page.waitForTimeout(600);
log('WIZ OPEN', await page.evaluate(() => ({ panel: !!document.querySelector('.wiz-panel'), head: document.querySelector('.wiz-head')?.textContent, chips: [...document.querySelectorAll('.wiz-chips .chip')].map(c => c.textContent), card: document.querySelector('.wiz-label')?.textContent, sel: app.selection && app.model.getInstance(app.selection).mark, tween: !!app.viewer._tween, acts: [...document.querySelectorAll('.wiz-actions .btn')].map(b => b.textContent) })));
await page.screenshot({ path: S + '/z1_wizard.png' });
const open0 = await page.evaluate(() => app.openReviewCount());
await page.evaluate(() => { document.querySelector('.wiz-note').value = '図面注記で確認'; [...document.querySelectorAll('.wiz-actions .btn')].find(b => b.textContent.startsWith('✓')).click(); }); await page.waitForTimeout(300);
log('WIZ CONFIRM', await page.evaluate(() => ({ head: document.querySelector('.wiz-head')?.textContent, open: app.openReviewCount(), card: document.querySelector('.wiz-label')?.textContent })), 'open before', open0);
await page.evaluate(() => { [...document.querySelectorAll('.wiz-actions .btn')].find(b => b.textContent.startsWith('スキップ')).click(); }); await page.waitForTimeout(200);
log('WIZ SKIP', await page.evaluate(() => document.querySelector('.wiz-head')?.textContent));
log('WIZ KEY Enter', await page.evaluate(() => { const o = app.openReviewCount(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return { before: o, after: app.openReviewCount() }; }));
log('WIZ BULK KIND', await page.evaluate(() => { const b = [...document.querySelectorAll('.wiz-actions .btn')].find(x => /残りの/.test(x.textContent)); const t = b?.textContent; if (b) b.click(); return { btn: t, open: app.openReviewCount(), head: document.querySelector('.wiz-head')?.textContent }; }));
await page.keyboard.press('Escape'); await page.waitForTimeout(150); log('WIZ ESC', await page.evaluate(() => !document.querySelector('.wiz-panel')));
// 2) 見積作成 → B社へ受け渡し → B社として開く（役割専用ビュー）
await page.evaluate(async () => { const e = await import('./js/ui/estimate.js'); await e.createEstimate(app); }); await page.waitForTimeout(300);
const tokB = await page.evaluate(async () => { const list = await app.store.listEstimates(app.project.id); const est = list[0]; const r = await app.store.handoffEstimate(est.id, { from: 'A', to: 'B', who: app.user().name, note: '利益率をお願いします' }); return r.token; });
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tokB, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1200);
log('B LANDING', await page.evaluate(() => ({ role: app.role(), user: app.user().name, flowOpen: !!document.querySelector('.modal.flow'), steps: [...document.querySelectorAll('.flow-step')].map(e => e.textContent.slice(0, 12)), todo: document.querySelector('.rv-todo b')?.textContent, headers: [...document.querySelectorAll('.rv-wrap thead th')].map(t => t.textContent), bulk: !!document.querySelector('.rv-bulk'), hand: [...document.querySelectorAll('.rv-wrap .est-handoff .btn')].map(b => b.textContent) })));
await page.screenshot({ path: S + '/z2_roleview_B.png' });
// 一括 利益率 20% → 販売価格計が変わる
log('B BULK', await page.evaluate(async () => { const inp = document.querySelector('.rv-bulk input'); inp.value = 20; [...document.querySelectorAll('.rv-bulk .btn')][0].click(); await new Promise(r => setTimeout(r, 700)); const list = await app.store.listEstimates(app.project.id); const est = list[0]; return { margins: [...new Set(est.lines.map(l => l.bMarginPct))], total: document.querySelector('.rv-wrap .kv.total b')?.textContent, audit: est.audit.filter(a => a.action === 'edit').length }; }));
// B → C へ渡す（promptDialog）
await page.evaluate(() => { [...document.querySelectorAll('.rv-wrap .est-handoff .btn')].find(b => b.textContent.includes('C社')).click(); }); await page.waitForTimeout(300);
await okDialog(['工場見積お願いします']); await page.waitForTimeout(600);
const tokC = await page.evaluate(async () => { const list = await app.store.listEstimates(app.project.id); return list[0].tokens.C; });
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tokC, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1200);
log('C LANDING', await page.evaluate(() => ({ role: app.role(), todo: document.querySelector('.rv-todo b')?.textContent, headers: [...document.querySelectorAll('.rv-wrap thead th')].map(t => t.textContent), hand: [...document.querySelectorAll('.rv-wrap .est-handoff .btn')].map(b => b.textContent), hidesB: !document.body.textContent.includes('販売価格 計') })));
log('C BULK', await page.evaluate(async () => { const ins = [...document.querySelectorAll('.rv-bulk input')]; ins[0].value = 21; ins[1].value = 90; const btns = [...document.querySelectorAll('.rv-bulk .btn')]; btns[0].click(); await new Promise(r => setTimeout(r, 500)); [...document.querySelectorAll('.rv-bulk input')][1].value = 90; [...document.querySelectorAll('.rv-bulk .btn')][1].click(); await new Promise(r => setTimeout(r, 700)); [...document.querySelectorAll('.rv-bulk .btn')][2].click(); await new Promise(r => setTimeout(r, 700)); const est = (await app.store.listEstimates(app.project.id))[0]; return { lead: [...new Set(est.lines.map(l => l.leadDays))], fc: est.lines.map(l => Math.round(l.factoryCost / l.baseCost * 100)), acc: [...new Set(est.lines.map(l => l.accepted))], unanswered: document.querySelector('.rv-wrap .kv.warn') ? 'yes' : 'none', factoryTotal: document.querySelector('.rv-wrap .kv.total b')?.textContent }; }));
await page.screenshot({ path: S + '/z3_roleview_C.png' });
// C → A へ回答
await page.evaluate(() => { [...document.querySelectorAll('.rv-wrap .est-handoff .btn')].find(b => b.textContent.includes('A社')).click(); }); await page.waitForTimeout(300);
await okDialog(['回答します。納期 21 日']); await page.waitForTimeout(600);
const tokA = await page.evaluate(async () => (await app.store.listEstimates(app.project.id))[0].tokens.A);
await page.goto(page.url().split('?')[0] + '?quality=0&handoff=' + tokA, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(1200);
// 3) 比較ビュー（A社）
log('A LANDING', await page.evaluate(async () => { const est = (await app.store.listEstimates(app.project.id))[0]; return { role: app.role(), status: est.status, rev: est.revision, revisions: est.revisions.map(r => r.rev + r.org), cmpBtn: !!document.querySelector('.flow-card[data-k="estimate"] .btn[title*="差分"]') }; }));
await page.evaluate(() => document.querySelector('.flow-card[data-k="estimate"] .btn[title*="差分"]').click()); await page.waitForTimeout(500);
log('COMPARE', await page.evaluate(() => ({ modal: !!document.querySelector('.modal.compare'), headers: [...document.querySelectorAll('.modal.compare thead th')].map(t => t.textContent), sum: document.querySelector('.cmp-sum')?.textContent.slice(0, 160), ups: document.querySelectorAll('.modal.compare tbody .d.up').length, downs: document.querySelectorAll('.modal.compare tbody .d.down').length, why: document.querySelector('.modal.compare tbody tr td:last-child')?.textContent.slice(0, 120) })));
await page.screenshot({ path: S + '/z4_compare.png' });
// 比較元を Rev.1 に → 会社間モード
log('COMPARE REV1', await page.evaluate(() => { const sels = document.querySelectorAll('.cmp-sel select'); sels[0].value = 0; sels[0].dispatchEvent(new Event('change')); return { sum: document.querySelector('.cmp-sum')?.textContent.slice(0, 200), changed: document.querySelectorAll('.modal.compare tbody .d').length }; }));
log('COMPARE ORG', await page.evaluate(() => { [...document.querySelectorAll('.seg .btn')][1].click(); return { headers: [...document.querySelectorAll('.modal.compare thead th')].map(t => t.textContent), rows: document.querySelectorAll('.modal.compare tbody tr').length }; }));
await page.screenshot({ path: S + '/z5_compare_org.png' });
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
