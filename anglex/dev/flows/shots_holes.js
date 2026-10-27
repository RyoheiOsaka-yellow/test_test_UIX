await page.evaluate(() => document.querySelector('#btnDemoDxf').click()); await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('#recHost .rec-actions .btn.primary').click()); await page.waitForTimeout(1200); await page.evaluate(() => document.querySelector('#btn3d').click()); await page.waitForTimeout(300);
await page.evaluate(() => { const i = app.model.instances.find(x => x.source === 'import' && x.mark === 'PL-1') || app.model.instances.find(x => x.source === 'import'); app.select(i.id); app.viewer.fit(app.groups.get(i.id)); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 420, c.y + 520, c.z + 560); app.viewer.controls.update(); app.viewer.invalidate(3); });
await page.waitForTimeout(1200);
