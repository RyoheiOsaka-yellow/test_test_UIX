await page.click('#btnEstimate'); await page.waitForTimeout(800);
await page.click('text=モデルから見積を作成'); await page.waitForTimeout(1500);
console.log('EST:', (await page.textContent('.est-main')).slice(0, 700).replace(/\s+/g, ' '));
