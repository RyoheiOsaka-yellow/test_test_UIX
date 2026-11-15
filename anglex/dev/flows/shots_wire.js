// 画面写真: 「線から組む」で作った箱形の架台（中段 1、斜材つき）と、ピン
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); for (const i of [...app.model.instances]) app.removeInstance(i.id); });
await page.click('#btnWire'); await page.waitForSelector('.wire-dlg [data-k="W"]'); await page.selectOption('.wire-dlg [data-k="brace"]', 'true'); await page.fill('.wire-dlg [data-k="tiers"]', '1'); await page.waitForTimeout(400); await page.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/wire_dialog.png' });
await page.click('[data-act="wire-apply"]'); await page.waitForTimeout(1500);
await page.evaluate(async () => { const P = await import('./js/ui/pins.js'); const inst = app.model.instances[0]; app.select(null); app.showAlerts = false; const g = app.groups.get(inst.id); const THREE = await import('three'); const b = new THREE.Box3().setFromObject(g); P.addPin(app, { text: '斜材の下端は、柱のベースから 300 mm 上げてください', pos: [b.min.x + 30, b.min.y + 520, b.max.z - 20], instId: inst.id, part: '斜材1' }); app.drawLevels?.(); const v = app.viewer; v.fit(g, 1.25, { animate: false }); });
await page.waitForTimeout(2000);
