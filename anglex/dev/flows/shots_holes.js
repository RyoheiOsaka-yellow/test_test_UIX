await page.click('.rtab[data-tab=import]'); await page.click('#btnDemoDxf'); await page.waitForTimeout(1500);
await page.click('.modal .modal-foot .btn.primary'); await page.waitForTimeout(1200); await page.click('#btn3d'); await page.waitForTimeout(300);
await page.evaluate(() => { const i = app.model.instances.find(x => x.source === 'import' && x.mark === 'PL-1') || app.model.instances.find(x => x.source === 'import'); app.select(i.id); app.viewer.fit(app.groups.get(i.id)); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 420, c.y + 520, c.z + 560); app.viewer.controls.update(); app.viewer.invalidate(3); });
await page.waitForTimeout(1200);
