const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// サンプル parts JSON（Astra ブリーフ用）
log('PARTS_JSON', await page.evaluate(() => JSON.stringify(app.instanceParts(app.model.instances.find(x => x.mark === 'MF-1')))));
// サムネイル
await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(4000);
log('THUMBS', await page.evaluate(() => ({ imgs: document.querySelectorAll('.sr-thumb').length, ok: document.querySelectorAll('.sr-thumb.ok').length, na: document.querySelectorAll('img.sr-thumb.na').length, first: document.querySelector('.sr-thumb.ok')?.src.slice(0, 30) })));
await page.screenshot({ path: S + '/s23_thumbs.png' });
await page.evaluate(() => document.querySelector('.showroom .icon-btn').click());
// 配管へ取付: HB-1（吊バンド）を MF-1 の配管へ
const before = await page.evaluate(() => app.model.instances.find(x => x.mark === 'HB-1').pos);
await page.evaluate(() => { const hb = app.model.instances.find(x => x.mark === 'HB-1'); const mf = app.model.instances.find(x => x.mark === 'MF-1'); app.attachTo(hb.id, mf.id); }); await page.waitForTimeout(800);
log('ATTACH', await page.evaluate(() => { const hb = app.model.instances.find(x => x.mark === 'HB-1'); const mf = app.model.instances.find(x => x.mark === 'MF-1'); const tp = app.pipeRefsOf(mf); const sp = app.pipeRefsOf(hb); return { before: window.__b, pos: hb.pos, rot: hb.rot.map(v => Math.round(v * 100) / 100), hbPipe: sp[0] ? [sp[0].center.toArray().map(Math.round), sp[0].od] : null, mfPipes: tp.map(t => [t.nominal, t.center.toArray().map(Math.round)]) }; }), 'before', before);
await page.evaluate(() => { const hb = app.model.instances.find(x => x.mark === 'HB-1'); app.select(hb.id); const g = app.groups.get(hb.id); const r = app.viewer.renderer.domElement.getBoundingClientRect(); app.onPick({ instance: g, object: g.children[0] }, { clientX: r.left + 400, clientY: r.top + 300 }); }); await page.waitForTimeout(300);
log('CTX ATTACH BTN', await page.evaluate(() => [...document.querySelectorAll('.ctx-bar .btn')].map(b => b.textContent.trim()).filter(t => /配管へ取付/.test(t)).length));
await page.evaluate(() => { const hb = app.model.instances.find(x => x.mark === 'HB-1'); app.viewer.focusOn(app.groups.get(hb.id), { animate: false }); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 500, c.y + 350, c.z + 650); app.viewer.controls.update(); app.viewer.invalidate(3); }); await page.waitForTimeout(900);
await page.screenshot({ path: S + '/s24_attach.png' });
