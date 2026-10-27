const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// CAD 役割の上書き（プロパティ）
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'LB-1'); app.select(i.id); const s = document.querySelector('#selStyle'); s.value = 'cad'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(800);
const colorOf = () => page.evaluate(() => { const g = app.groups.get(app.selection); const ch = g.children.find(c => c.userData.part && c.userData.part.kind === 'member'); let m = null; ch.traverse(o => { if (!m && o.isMesh) m = o.material; }); return '#' + m.color.getHexString(); });
log('ROLE BEFORE', await colorOf());
await page.evaluate(() => { const sel = [...document.querySelectorAll('#props select')].find(s => [...s.options].some(o => o.value === 'brace')); sel.value = 'brace'; sel.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(900);
log('ROLE AFTER', await colorOf(), await page.evaluate(() => app.model.getInstance(app.selection).cadRole));
// Space 一時パン
await page.keyboard.down('Space'); await page.waitForTimeout(150); log('SPACE DOWN', await page.evaluate(() => ({ pan: app.viewer.panMode, left: app.viewer.controls.mouseButtons.LEFT })));
await page.keyboard.up('Space'); await page.waitForTimeout(150); log('SPACE UP', await page.evaluate(() => ({ pan: app.viewer.panMode, left: app.viewer.controls.mouseButtons.LEFT })));
// UI 切替ボタン
log('SWITCH BTN', await page.evaluate(() => ({ v1: !!document.querySelector('#btnSwitchUI'), text: document.querySelector('#btnSwitchUI')?.textContent, f: location.pathname })));
// 分解図 PDF（モーダルから）
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(i.id); document.querySelector('#btnExplodeView').click(); }); await page.waitForTimeout(600);
const dl = []; page.on('download', d => dl.push(d));
await page.evaluate(() => [...document.querySelectorAll('.modal button')].find(b => b.textContent.includes('分解図 PDF')).click());
for (let i = 0; i < 60 && !dl.length; i++) await page.waitForTimeout(500);
if (dl.length) { const p = S + '/exploded.pdf'; await dl[0].saveAs(p); console.log('DL saved', p); }
log('EXPLODED SHOT', await page.evaluate(() => { const r = app.screenshotExploded(app.selection); return { w: r.w, h: r.h, n: r.balloons.length, first: r.balloons.slice(0, 3).map(b => [b.n, Math.round(b.x), Math.round(b.y)]), urlLen: r.url.length, restoredK: app.viewer.exploded }; }));
log('VISIBLE AFTER', await page.evaluate(() => [...app.viewer.modelRoot.children].filter(c => c.visible).length + '/' + app.viewer.modelRoot.children.length));
