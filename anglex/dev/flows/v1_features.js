const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const click = sel => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no ' + s); el.click(); }, sel);
log('SHELL', await page.evaluate(() => !!app.shell));
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(i.id); app.viewer.fit(app.groups.get(i.id)); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 900, c.y + 650, c.z + 1000); app.viewer.controls.update(); app.viewer.invalidate(3); }); await page.waitForTimeout(700);
// 1) 分解図モーダル
await click('#btnExplodeView'); await page.waitForTimeout(600);
log('BOM ROWS', await page.$$eval('.modal .bom-table tbody tr', trs => trs.length));
log('BALLOONS', await page.evaluate(() => document.querySelectorAll('.v-label.balloon-lbl').length));
await page.evaluate(() => { const sl = document.querySelector('.modal .explode-ctl input[type=range]'); sl.value = 0.6; sl.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(900);
log('EXPLODED PARTS MOVED', await page.evaluate(() => { const g = app.groups.get(app.selection); return g.children.filter(c => c.userData._phome && c.position.distanceTo(c.userData._phome) > 1).length + ' / ' + g.children.filter(c => c.userData.part && !c.userData.ref).length + ' welds hidden ' + g.children.filter(c => c.userData.part?.kind === 'weld' && !c.visible).length; }));
log('OTHERS UNMOVED', await page.evaluate(() => [...app.groups.values()].filter(g => g !== app.groups.get(app.selection)).every(g => !g.userData._home || g.position.distanceTo(g.userData._home) < 0.01)));
await page.screenshot({ path: S + '/s17_v1_explode.png' });
await page.evaluate(() => document.querySelectorAll('.modal .bom-table tbody tr')[2].click()); await page.waitForTimeout(500);
log('ISOLATED', await page.evaluate(() => { const g = app.groups.get(app.selection); return { iso: app.isolated?.index, visible: g.children.filter(c => c.userData.part && c.visible).length, total: g.children.filter(c => c.userData.part).length }; }));
await page.evaluate(() => [...document.querySelectorAll('.modal button')].find(b => b.textContent === '戻す').click()); await page.waitForTimeout(500);
log('RESTORED', await page.evaluate(() => { const g = app.groups.get(app.selection); return { iso: app.isolated, moved: g.children.filter(c => c.userData._phome && c.position.distanceTo(c.userData._phome) > 1).length, visible: g.children.filter(c => c.userData.part && c.visible).length }; }));
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(e => e.remove()));
// 2) 中央へ / 手のひら
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'LB-1'); app.select(i.id); app.centerSelected(); }); await page.waitForTimeout(700);
log('CENTER', await page.evaluate(() => { const g = app.groups.get(app.selection); const c = new (app.viewer.scene.constructor === Object ? Object : Object)(); const box = app.viewer.modelRoot.children.length; const b = app.viewer.controls.target; const THREE_Box = null; const tgt = [Math.round(b.x), Math.round(b.y), Math.round(b.z)]; return { target: tgt, pos: g.position.toArray().map(Math.round) }; }));
await page.evaluate(() => app.togglePan()); log('PAN', await page.evaluate(() => ({ on: app.viewer.panMode, left: app.viewer.controls.mouseButtons.LEFT, btn: document.querySelector('#btnPan').classList.contains('on') })));
await page.evaluate(() => app.togglePan());
// 3) CAD 色
await page.evaluate(() => { const s = document.querySelector('#selStyle'); s.value = 'cad'; s.dispatchEvent(new Event('change', { bubbles: true })); app.viewer.fit(); }); await page.waitForTimeout(1200);
log('CAD', await page.evaluate(() => ({ bg: '#' + app.viewer.scene.background.getHexString(), legend: document.querySelectorAll('.cad-legend .lg').length, roles: [...new Set([...app.groups.values()].flatMap(g => g.children.filter(c => c.userData.part).map(c => { let m = null; c.traverse(o => { if (!m && o.isMesh) m = o.material; }); return m ? '#' + m.color.getHexString() : null; })))].slice(0, 12) })));
await page.screenshot({ path: S + '/s18_v1_cad.png' });
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(i.id); app.viewer.focusOn(app.groups.get(i.id), { animate: false }); app.viewer.setExplode(0.5, app.groups.get(i.id)); app.setBalloons(i.id); }); await page.waitForTimeout(900);
await page.screenshot({ path: S + '/s19_v1_cad_explode.png' });
await page.evaluate(() => { const s = document.querySelector('#selStyle'); s.value = 'shaded-edges'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(600);
log('BACK', await page.evaluate(() => ({ bg: '#' + app.viewer.scene.background.getHexString(), legend: document.querySelectorAll('.cad-legend').length })));
