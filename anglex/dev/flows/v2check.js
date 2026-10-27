const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
log('V2', await page.evaluate(() => ({ shell: !!app.shell, step: app.shell?.step, sw: document.querySelector('#btnSwitchUI')?.textContent, sm: document.querySelector('#smSwitchUI')?.textContent })));
await page.evaluate(() => { const i = app.model.instances[0]; app.select(i.id); const sel = [...document.querySelectorAll('#props select')].find(s => [...s.options].some(o => o.value === 'brace')); sel.value = 'gusset'; sel.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(600);
log('V2 ROLE', await page.evaluate(() => app.model.getInstance(app.selection).cadRole));
log('V2 EXPLODE CARD', await page.$$eval('#explodeHost .bom-table tbody tr', t => t.length));
await page.evaluate(() => { const i = app.model.instances[0]; app.select(i.id); const g = app.groups.get(i.id); const ch = g.children.find(c => c.userData.part && !c.userData.ref); const r = app.viewer.renderer.domElement.getBoundingClientRect(); app.onPick({ instance: g, object: ch }, { clientX: r.left + 300, clientY: r.top + 200 }); }); await page.waitForTimeout(300);
log('V2 CTX', await page.evaluate(() => ({ inStage: !!document.querySelector('#d3stage .ctx-bar'), head: document.querySelector('.ctx-head')?.textContent.slice(0, 50) })));
