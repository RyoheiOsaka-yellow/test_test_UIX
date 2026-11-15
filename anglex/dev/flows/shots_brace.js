// 画面写真: L 型ブラケットと三角ブラケット。斜材の両端が、縦材の前面と腕の下面に沿って斜め切りになっている
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); for (const i of [...app.model.instances]) app.removeInstance(i.id); });
await page.evaluate(() => { const mk = (fid, over, x) => { const ty = app.model.addType(fid, fid, over); const inst = app.model.addInstance(ty.id, { pos: [x, 0, 0], params: {}, level: null }); app.rebuildInstance(inst); return inst.id; }; mk('bracket_L', { gusset: true }, 0); mk('bracket_tri', {}, 500); app.refreshBrowser(); });
await page.evaluate(() => { const v = app.viewer; v.fit(v.modelRoot, 1.1, { animate: false }); const t = v.controls.target.clone(); const d = v.camera.position.distanceTo(t); v.camera.position.set(t.x + d * 0.92, t.y + d * 0.18, t.z + d * 0.35); v.camera.lookAt(t); v.controls.update(); });
await page.waitForTimeout(1800);
