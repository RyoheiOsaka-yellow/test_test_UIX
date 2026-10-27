await page.evaluate(() => document.querySelector('#btnDemoDxf').click()); await page.waitForTimeout(1500);
console.log('REC:', (await page.textContent('.modal')).slice(0, 900).replace(/\s+/g, ' '));
await page.click('text=選択した部材をモデルへ配置'); await page.waitForTimeout(2500);
console.log('INST:', await page.evaluate(() => app.model.instances.map(i => i.mark + ':' + i.status).join(',')));
await page.evaluate(() => app.setView('2d')); await page.waitForTimeout(800);
