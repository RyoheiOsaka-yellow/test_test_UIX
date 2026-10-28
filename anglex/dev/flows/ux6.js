const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const okDialog = (vals) => page.evaluate(vals => { const mb = document.querySelector('.modal-back:last-of-type'); const ins = [...mb.querySelectorAll('input, textarea')]; (vals || []).forEach((v, i) => { if (ins[i] && v != null) ins[i].value = v; }); mb.querySelector('.modal-foot .btn.primary').click(); }, vals);
// 見積作成 → 業務フロー → B社へ（ゲート上書き → 受け渡しダイアログ: メッセージ＋期限 → 通知文）
await page.evaluate(async () => { const e = await import('./js/ui/estimate.js'); await e.createEstimate(app); }); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#btnFlow').click()); await page.waitForTimeout(700);
await page.evaluate(() => [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].find(b => b.textContent.includes('B社')).click()); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-foot .btn.danger').click()); await page.waitForTimeout(250); await okDialog(['工場と調整済み']); await page.waitForTimeout(300);
log('HANDOFF DIALOG', await page.evaluate(() => { const mb = document.querySelector('.modal-back:last-of-type'); return { title: mb.querySelector('.modal-title').textContent, fields: [...mb.querySelectorAll('.form-row span')].map(x => x.textContent), due: mb.querySelector('input[type=date]')?.value }; }));
await okDialog(['利益率をお願いします', null]); await page.waitForTimeout(900);
log('MESSAGE MODAL', await page.evaluate(() => { const mb = document.querySelector('.modal-back:last-of-type'); const t = mb?.querySelector('.msg-text')?.value || ''; return { title: mb?.querySelector('.modal-title')?.textContent, hasLink: /\?handoff=h_/.test(t), hasDue: /回答期限: \d{4}-\d{2}-\d{2}/.test(t), hasTotal: /A社 提示 計/.test(t), head: t.split('\n')[0], btns: [...mb.querySelectorAll('.modal-foot .btn')].map(b => b.textContent) }; }));
await page.screenshot({ path: S + '/w1_message.png' });
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click()); await page.waitForTimeout(400);
log('FLOW DEADLINE', await page.evaluate(() => ({ kv: [...document.querySelectorAll('.flow-card[data-k="share"] .fc-kv')].map(k => k.textContent), hist: document.querySelector('.flow-card[data-k="share"] details table')?.textContent.slice(0, 80), msgBtn: !!([...document.querySelectorAll('.flow-card[data-k="share"] .btn')].find(b => b.textContent === '通知文を表示')) })));
// 期限超過・未回答を擬似的に作る（store を直接書き換え）→ ダッシュボード
await page.evaluate(async () => { const est = (await app.store.listEstimates(app.project.id))[0]; const d = new Date(); d.setDate(d.getDate() - 2); est.due = d.toISOString().slice(0, 10); est.handoffs[est.handoffs.length - 1].at = new Date(Date.now() - 5 * 86400000).toISOString(); app.store.save(); });
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click()); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#btnDashboard2').click()); await page.waitForTimeout(1200);
log('DASHBOARD', await page.evaluate(() => ({ modal: !!document.querySelector('.modal.dash'), kpis: [...document.querySelectorAll('.dash-kpi')].map(k => k.textContent), rows: document.querySelectorAll('.modal.dash tbody tr').length, first: document.querySelector('.modal.dash tbody tr')?.textContent.replace(/\s+/g, ' ').slice(0, 200), overdue: document.querySelectorAll('.modal.dash tr.overdue').length })));
await page.screenshot({ path: S + '/w2_dashboard.png' });
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click()); await page.waitForTimeout(200);
// 確定前チェック: C社の回答を擬似的に（1 行 受注不可・1 行 未回答・納期超過）→ A社で確定 → ゲート
await page.evaluate(async () => { const est = (await app.store.listEstimates(app.project.id))[0]; est.currentOrg = 'A'; est.status = 'from_C'; est.lines[0].accepted = false; est.lines[0].cNote = '材料手配不可'; est.lines[1].factoryCost = 5000; est.lines[1].accepted = true; est.lines[1].leadDays = 30; est.meta = { ...(est.meta || {}), requiredLead: 14 }; app.store.save(); });
await page.evaluate(() => document.querySelector('#btnFlow').click()); await page.waitForTimeout(700);
log('FINAL CARD', await page.evaluate(() => ({ check: [...document.querySelectorAll('.flow-card[data-k="final"] .fc-kv')].map(k => k.textContent), issues: [...document.querySelectorAll('.fc-issues li')].map(l => l.textContent), lead: document.querySelector('.flow-card[data-k="final"] input')?.value })));
await page.evaluate(() => [...document.querySelectorAll('.flow-card[data-k="final"] .btn')].find(b => b.textContent.includes('確定する')).click()); await page.waitForTimeout(300);
// reviewGate（未確認あり）→ 承知 → 理由 → finalizeGate
log('GATE1', await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-title')?.textContent));
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-foot .btn.danger')?.click()); await page.waitForTimeout(250); await okDialog(['確認済み扱い']); await page.waitForTimeout(400);
log('GATE2', await page.evaluate(() => { const mb = document.querySelector('.modal-back:last-of-type'); return { title: mb?.querySelector('.modal-title')?.textContent, rows: [...mb.querySelectorAll('tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').slice(0, 60)) }; }));
await page.screenshot({ path: S + '/w3_finalize_gate.png' });
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-foot .btn.danger').click()); await page.waitForTimeout(250); await okDialog(['受注不可行は別途手配']); await page.waitForTimeout(600);
log('FINALIZED', await page.evaluate(async () => { const est = (await app.store.listEstimates(app.project.id))[0]; return { status: est.status, note: est.audit.find(a => a.action === 'finalize')?.note.slice(0, 80), flowCur: document.querySelector('.flow-step.cur')?.textContent }; }));
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
