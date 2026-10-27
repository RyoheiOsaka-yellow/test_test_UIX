const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(500);
log('PANEL', await page.evaluate(() => ({ rows: document.querySelectorAll('.sr-row').length, na: document.querySelectorAll('.sr-row.na').length, chips: [...document.querySelectorAll('.sr-chips .chip')].map(c => c.textContent) })));
const n0 = await page.evaluate(() => app.model.instances.length);
// 対応製品を 6 件クリック（各章から）
await page.evaluate(() => { const rows = [...document.querySelectorAll('.sr-row:not(.na)')]; const pick = []; const byCh = {}; for (const r of rows) { const ch = (r.querySelector('.sr-meta').textContent.match(/第(\d+)章/) || [])[1]; (byCh[ch] ||= []).push(r); } for (const ch of Object.keys(byCh)) pick.push(...byCh[ch].slice(0, 2)); window.__picked = pick.slice(0, 6).map(r => r.querySelector('.sr-name').textContent); pick.slice(0, 6).forEach(r => r.click()); });
await page.waitForTimeout(3500);
log('PLACED', await page.evaluate(() => ({ added: app.model.instances.length, picked: window.__picked, catalog: app.model.instances.filter(i => i.source === 'catalog').map(i => [i.mark, i.name, i.pos]) })), 'was', n0);
log('ROWS PLACED', await page.evaluate(() => document.querySelectorAll('.sr-row.placed').length));
await page.evaluate(() => { document.querySelector('.sr-search').value = 'バンド'; document.querySelector('.sr-search').dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(300);
log('SEARCH', await page.evaluate(() => document.querySelectorAll('.sr-row').length));
await page.evaluate(() => { app.viewer.fit(); const c = app.viewer.controls.target; app.viewer.camera.position.set(c.x + 2500, c.y + 1800, c.z + 3200); app.viewer.controls.update(); app.viewer.invalidate(3); }); await page.waitForTimeout(1200);
await page.screenshot({ path: S + '/s22_showroom.png' });
// 1 件トグルで消す
await page.evaluate(() => { document.querySelector('.sr-search').value = ''; document.querySelector('.sr-search').dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.sr-row.placed').click()); await page.waitForTimeout(600);
log('AFTER TOGGLE OFF', await page.evaluate(() => app.model.instances.filter(i => i.source === 'catalog').length));
