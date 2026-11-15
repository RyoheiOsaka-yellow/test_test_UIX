// 画面写真: 端部を斜め切りした単材（山形鋼・溝形鋼・H 形鋼・角パイプ・鋼管）を並べ、1 本を選んでプロパティの「端部の斜め切り（DSL）」を見せる
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); for (const i of [...app.model.instances]) app.removeInstance(i.id); });
const ids = await page.evaluate(() => { const mk = (spec, L, cuts, holes, z) => { const ty = app.model.addType('member', spec, { spec }); const inst = app.model.addInstance(ty.id, { pos: [0, 0, z], params: { L, cuts, holes, axis: 'x' }, level: null }); app.rebuildInstance(inst); return inst.id; };
  return [mk('L-50x50x6', 400, 'start:x30; end:y45', 'A:z200 s25 d12', 0), mk('[-75x40x5x7', 500, 'end:x-20 y15', 'web:z250 s37.5 d12', 140), mk('H-100x100x6x8', 600, 'start:y30', 'web:z300 s50 d18', 300), mk('□-50x50x2.3', 450, 'end:x45', '', 480), mk('STK-60.5x3.2', 380, 'start:y-30', '', 620)]; });
await page.evaluate((id) => { app.refreshBrowser(); app.viewer.setView?.('iso'); app.viewer.fit(app.viewer.modelRoot, 1.15, { animate: false }); app.select?.(id); }, ids[0]);
await page.waitForTimeout(1800);
