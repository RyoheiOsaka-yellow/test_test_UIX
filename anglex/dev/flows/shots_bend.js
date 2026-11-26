// 画面写真: 曲げた後の姿（V カット曲げを 2 か所 → コの字）と、加工の単価・型の管理
const dir = process.env.SHOT_DIR || '/tmp'; const shot = async n => { await page.evaluate(() => { document.querySelectorAll('.toast,.guide-ov').forEach(t => t.remove()); app.viewer.invalidate(3); }); await page.waitForTimeout(1300); await page.screenshot({ path: `${dir}/b_${n}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } }); };
await page.waitForFunction(() => window.app && app.model && app.model.instances.length, null, { timeout: 60000 }); await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelectorAll('.modal-back,.guide-ov').forEach(m => m.remove()); const i = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); app.select(i.id); });
await page.click('#btnFab'); await page.waitForSelector('#fabSvg'); await page.waitForTimeout(900); await page.selectOption('#fabPart', { index: 2 }); await page.waitForTimeout(900);
const clickAt = async (fx, fy) => { const b = await (await page.$('#fabSvg')).boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await page.waitForTimeout(700); };
for (const x of [0.36, 0.64]) { await page.selectOption('#fabTpl', 'vbend'); await page.waitForTimeout(300); await clickAt(x, 0.45); }
await page.evaluate(() => { app.fab.sel = null; app.fab.render(); }); await page.waitForTimeout(400); await shot('flat');
await page.click('#fabBentBtn'); await page.waitForTimeout(1500); await page.evaluate(() => { const v = app.viewer; v.controls.autoRotate = false; }); await shot('bent');
await page.click('#fabRatesBtn'); await page.waitForSelector('#fabRates'); await page.waitForTimeout(400); await page.screenshot({ path: `${dir}/b_rates.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } }); await page.evaluate(() => [...document.querySelectorAll('.modal-back')].pop().remove());
