// 2枚の板を接触させてボルト接合、指示文で穴
await page.evaluate(() => { const m = app.model; const t = m.addType('plate', 'PL-9 150x150', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 100, pitchH: 100, holeD: 15 }); const a = m.addInstance(t.id, { pos: [2500, 0, 0] }); const b = m.addInstance(t.id, { pos: [2600, 9, 50] }); app.rebuildAll(); app.refreshBrowser(); window.__ab = [a.mark, b.mark]; });
await page.waitForTimeout(500);
const [a, b] = await page.evaluate(() => window.__ab);
await page.fill('#instrInput', `${b} を ${a} に M12 ボルト 2本 で接合`); await page.press('#instrInput', 'Enter'); await page.waitForTimeout(1500);
console.log('JOINTS:', await page.evaluate(() => JSON.stringify(app.model.joints.map(j => ({ label: j.label, warn: j.warning, parts: j.eval?.parts?.length, holes: j.eval?.holes?.length })))));
const m1 = await page.evaluate(() => app.model.instances[0].mark);
await page.fill('#instrInput', `${m1} と ${a} を隅肉溶接 6 両側`); await page.press('#instrInput', 'Enter'); await page.waitForTimeout(800);
console.log('JOINTS2:', await page.evaluate(() => JSON.stringify(app.model.joints.map(j => ({ label: j.label, warn: j.warning })))));
// 単材に穴
await page.evaluate(() => { const t = app.model.addType('member', 'L-50x50x6 単材', { spec: 'L-50x50x6' }); const i = app.model.addInstance(t.id, { pos: [2500, 0, 800] }); app.rebuildAll(); app.refreshBrowser(); window.__m = i.mark; });
const mm = await page.evaluate(() => window.__m);
await page.fill('#instrInput', `${mm} に 脚A φ15 穴 3個 @100 端から50`); await page.press('#instrInput', 'Enter'); await page.waitForTimeout(1200);
console.log('HOLES:', await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === window.__m); return i.params.holes; }));
await page.evaluate(() => { app.viewer.camera.position.set(3100, 500, 700); app.viewer.controls.target.set(2600, 50, 300); });
await page.waitForTimeout(800);
