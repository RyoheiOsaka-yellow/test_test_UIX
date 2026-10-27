await page.evaluate(() => { app.select(app.model.instances[0].id); app.viewer.camera.position.set(600, 500, 900); app.viewer.controls.target.set(0, 300, 0); });
await page.click('.rtab[data-tab=view]'); await page.click('#btnSection'); await page.waitForTimeout(1500);
