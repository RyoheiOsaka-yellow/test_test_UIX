await page.click('.rtab[data-tab=view]'); await page.click('#btnTheme'); await page.selectOption('#selStyle', 'realistic'); await page.waitForTimeout(300);
await page.evaluate(() => { app.viewer.camera.position.set(1500, 900, 1900); app.viewer.controls.target.set(200, 300, 300); });
await page.waitForTimeout(800);
