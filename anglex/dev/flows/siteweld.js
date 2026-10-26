await page.evaluate(() => { const t = app.model.types.find(t => t.familyId === 'portal_frame'); app.model.updateType(t.id, { baseFix: 'siteweld' }); app.rebuildInstancesOfType(t.id); app.drawLevels(); });
await page.waitForTimeout(1200);
console.log('LABELS:', await page.$$eval('.v-label.weld', els => els.map(e => e.textContent).join(' ')), '| site:', await page.$$eval('.v-label.weld.site', els => els.length));
await page.click('#btnSchedules'); await page.waitForTimeout(600); await page.click('.tab >> text=溶接集計'); await page.waitForTimeout(300);
console.log('WELD SCHED:', (await page.textContent('.tab-pane.on')).replace(/\s+/g, ' ').slice(0, 300));
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
console.log('COST siteWeld:', await page.evaluate(async () => { const { estimateModel } = await import('/js/bim/cost.js'); const e = estimateModel(app.model, app.rates()); return e.lines.map(l => l.desc + ':' + l.cost.weld + '/site=' + (l.cost.siteWeld || 0)).join(' ; '); }));
await page.evaluate(() => { app.viewer.camera.position.set(700, 420, 900); app.viewer.controls.target.set(0, 150, 0); }); await page.waitForTimeout(600);
