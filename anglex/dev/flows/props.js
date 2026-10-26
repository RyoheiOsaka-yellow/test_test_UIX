await page.evaluate(() => { app.select(app.model.instances[0].id); });
await page.waitForTimeout(800);
const txt = await page.textContent('#props'); console.log('PROPS:', txt.slice(0, 400).replace(/\s+/g, ' '));
