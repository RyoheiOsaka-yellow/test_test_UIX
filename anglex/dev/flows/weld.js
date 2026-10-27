await page.evaluate(() => { app.viewer.camera.position.set(900, 650, 1100); app.viewer.controls.target.set(0, 300, 0); });
await page.fill('#instrInput', 'MF-1 と MF-2 を 現場 隅肉溶接 6'); await page.press('#instrInput', 'Enter'); await page.waitForTimeout(800);
console.log('LABELS:', await page.$$eval('.v-label.weld', els => els.length), 'site:', await page.$$eval('.v-label.weld.site', els => els.length));
await page.evaluate(() => document.querySelector('#btnSchedules').click()); await page.waitForTimeout(600); await page.click('.tab >> text=溶接集計'); await page.waitForTimeout(300);
console.log('WELD SCHED:', (await page.textContent('.tab-pane.on')).replace(/\s+/g, ' ').slice(0, 300));
await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove())); await page.waitForTimeout(500);
