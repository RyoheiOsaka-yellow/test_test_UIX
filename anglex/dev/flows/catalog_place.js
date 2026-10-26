await page.click('#btnCatalog'); await page.waitForTimeout(600);
await page.fill('.cat-filters input', 'タン付吊バンド'); await page.waitForTimeout(300);
await page.click('.cat-item >> nth=0'); await page.waitForTimeout(300);
await page.selectOption('.cat-models select', { index: 5 }); await page.waitForTimeout(200);
await page.click('text=登録して配置'); await page.waitForTimeout(1500);
console.log('INST:', await page.evaluate(() => app.model.instances.map(i => i.mark).join(',')));
console.log('PROPS:', (await page.textContent('#props')).slice(0, 500).replace(/\s+/g, ' '));
await page.evaluate(() => app.viewer.fit(app.groups.get(app.selection)));
await page.waitForTimeout(800);
