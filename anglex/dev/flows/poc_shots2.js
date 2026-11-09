// PoC 計画書用（デモモデル）: 視点ブックマーク、受け渡し後の確認チップ、確認ゲート
const IMG = '/home/user/test_test_UIX/anglex/docs/spec/img';
const shot = async (n, wait = 700) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${IMG}/${n}.png` }); console.log('SHOT', n); };
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); }); await page.waitForTimeout(400);
// 視点ブックマーク一覧
await page.evaluate(async () => { app.project.views = []; const inst = app.model.instances[1]; const g = app.groups.get(inst.id); app.viewer.focusOn(g, { zoom: true, animate: false }); await app.saveViewmark('MF-2 柱頭の溶接'); const v = app.project.views[0]; v.pdf = true; v.note = '脚長 ▷6、工場溶接'; app.viewer.fit(app.viewer.modelRoot, 1.3, { animate: false }); const v2 = await app.saveViewmark('全体（北側から）'); v2.note = '配管 125A の通り'; const inst2 = app.model.instances[0]; app.viewer.focusOn(app.groups.get(inst2.id), { zoom: true, animate: false }); const v3 = await app.saveViewmark('MF-1 アンカー'); v3.note = 'M12 × 4、現場施工'; app.viewer.fit(app.viewer.modelRoot, 1.3, { animate: false }); document.querySelectorAll('.toast').forEach(t => t.remove()); });
await page.keyboard.press('b'); await shot('p05_viewmarks', 900); await page.keyboard.press('Escape');
// 確認ゲート（未確認が残った状態で受け渡し）
await page.evaluate(async () => { const E = await import('./js/ui/estimate.js'); E.reviewGate(app, 'B社へ渡す'); }); await shot('p06_gate', 900);
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 受け渡し後: B社の見積ヘッダに確認チップ → 明細
await page.evaluate(async () => { const inst = app.model.instances[1]; app.viewer.focusOn(app.groups.get(inst.id), { zoom: true, animate: false }); app.startTour(inst.id); const { markTour } = await import('./js/ui/spotTour.js'); markTour(app, 'ok'); app.closeTour(); const E = await import('./js/ui/estimate.js'); const est = await E.createEstimate(app); const res = await app.store.handoffEstimate(est.id, { from: 'A', to: 'B', who: app.user().name, note: '', review: app.reviewSummary() }); const e2 = res.est || await app.store.getEstimate(est.id); document.querySelectorAll('.toast').forEach(t => t.remove()); E.showReviewSummary(app, e2); });
await shot('p07_review_summary', 900);
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
