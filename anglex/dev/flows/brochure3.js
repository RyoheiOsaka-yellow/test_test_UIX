// 見積・共有まわりのショット（軽量表示でスナップショットもグリッド床に）
const IMG = '/home/user/test_test_UIX/anglex/docs/spec/img'; const shot = n => page.screenshot({ path: `${IMG}/${n}.png` });
await page.evaluate(() => { app.select(null); app.viewer.setView('iso'); app.viewer.cancelTween(); app.viewer.fit(app.viewer.modelRoot, 1.1, { animate: false }); }); await page.waitForTimeout(600);
await page.evaluate(async () => { const e = await import('./js/ui/estimate.js'); await e.createEstimate(app); const est = (await app.store.listEstimates(app.project.id))[0]; const WF = await import('./js/core/workflow.js'); WF.handoff(est, { from: 'A', to: 'B', who: '山田（A社 設計）', note: '利益率をお願いします', due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }); for (const l of est.lines) WF.applyEdit(est, { role: 'B', who: '鈴木（B社 営業）', lineId: l.id, field: 'bMarginPct', value: 18 }); WF.handoff(est, { from: 'B', to: 'C', who: '鈴木（B社 営業）', note: '工場見積お願いします', due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }); for (const l of est.lines) { WF.applyEdit(est, { role: 'C', who: '佐藤（C社 工場）', lineId: l.id, field: 'factoryCost', value: Math.round(l.baseCost * 0.92) }); WF.applyEdit(est, { role: 'C', who: '佐藤（C社 工場）', lineId: l.id, field: 'leadDays', value: 21 }); WF.applyEdit(est, { role: 'C', who: '佐藤（C社 工場）', lineId: l.id, field: 'accepted', value: true }); } app.store.save(); });
await page.evaluate(async () => { const st = await import('./js/core/store.js'); await app.switchUser(st.DEMO_USERS[2]); }); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#btnFlow').click()); await page.waitForTimeout(900); await shot('b13_roleview_C');
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click());
await page.evaluate(async () => { const est = (await app.store.listEstimates(app.project.id))[0]; const WF = await import('./js/core/workflow.js'); WF.handoff(est, { from: 'C', to: 'A', who: '佐藤（C社 工場）', note: '回答します', due: null }); app.store.save(); const st = await import('./js/core/store.js'); await app.switchUser(st.DEMO_USERS[0]); });
await page.evaluate(() => document.querySelector('#btnDashboard2').click()); await page.waitForTimeout(1200); await shot('b10_dashboard');
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click());
await page.evaluate(async () => { const c = await import('./js/ui/compare.js'); const est = (await app.store.listEstimates(app.project.id))[0]; c.openCompare(app, est); }); await page.waitForTimeout(800); await shot('b11_compare');
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click());
await page.evaluate(() => document.querySelector('#btnFlow').click()); await page.waitForTimeout(900); await shot('b12_flow_shared');
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click());
await page.evaluate(() => { document.querySelector('#btnEstimate').click(); }); await page.waitForTimeout(900); await shot('b16_estimate');
await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-head .icon-btn').click());
await page.evaluate(() => { document.querySelector('#btnSchedules').click(); }); await page.waitForTimeout(800); await shot('b15_schedules');
console.log('BROCHURE3 DONE');
