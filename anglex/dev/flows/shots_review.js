const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad';
await page.click('.rtab[data-tab=import]'); await page.click('#btnDemoDxf'); await page.waitForTimeout(1500);
await page.click('.modal .modal-foot .btn.primary'); await page.waitForTimeout(1200);
await page.click('#btn3d'); await page.waitForTimeout(400);
await page.evaluate(() => { const i = app.model.instances.find(x => x.source === 'import' && app.model.familyOf(x).id === 'member'); window.__sel = i.id; app.select(i.id); const hs = app.model.instances.find(x => x.source === 'import' && x.mark.startsWith('HS')); app.viewer.fit(app.groups.get(hs.id)); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 1100, c.y + 800, c.z + 1500); app.viewer.controls.update(); app.viewer.invalidate(3); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const el = document.querySelector('#props .pp-group.review'); if (el) el.scrollIntoView({ block: 'start' }); });
await page.waitForTimeout(600); await page.screenshot({ path: S + '/s7_review_flags.png' });
// 溶接指示ダイアログ
await page.click('#props .rv-item >> text=溶接指示'); await page.waitForTimeout(400); await page.screenshot({ path: S + '/s8_weld_instr.png' });
await page.selectOption('.modal select >> nth=0', 'both'); await page.selectOption('.modal select >> nth=1', 'site'); await page.click('.modal .modal-foot .btn.primary'); await page.waitForTimeout(1000);
// 補正: 板を 12mm 浮かせて置く
await page.evaluate(() => { const m = app.model; const t = m.addType('plate', 'PL-9 150x150', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 100, pitchH: 100, holeD: 15 }); m.addInstance(t.id, { pos: [2500, 0, 0] }); m.addInstance(t.id, { pos: [2500, 21, 0] }); m.addInstance(t.id, { pos: [3000, 1540, 0], params: { extraHoles: '0|face:z3 s7 d15' } }); app.rebuildAll(); app.refreshBrowser(); });
await page.click('.rtab[data-tab=home]'); await page.click('#btnAlign'); await page.waitForTimeout(600); await page.screenshot({ path: S + '/s9_align.png' });
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(e => e.remove()));
await page.click('#btnAlerts'); await page.waitForTimeout(600); await page.screenshot({ path: S + '/s10_alerts.png' });
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(e => e.remove()));
await page.evaluate(async () => { await app.saveSnapshot('溶接指示後', '現場溶接 ▷6 両端を指示'); });
await page.click('#btnHistory'); await page.waitForTimeout(500); await page.screenshot({ path: S + '/s11_history.png' });
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(e => e.remove()));
await page.evaluate(() => { app.select(window.__sel); app.viewer.fit(app.groups.get(window.__sel)); }); await page.waitForTimeout(800);
