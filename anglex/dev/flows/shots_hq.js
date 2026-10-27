await page.selectOption('#selStyle', 'realistic'); await page.waitForTimeout(400);
await page.evaluate(() => { app.viewer.camera.position.set(1900, 900, 2300); app.viewer.controls.target.set(0, 350, 400); app.viewer.invalidate(5); });
await page.waitForFunction(() => app.viewer.hdri != null, null, { timeout: 60000 }).catch(() => console.log('hdri timeout'));
await page.waitForTimeout(6000); await page.evaluate(() => app.viewer.invalidate(5)); await page.waitForTimeout(6000);
