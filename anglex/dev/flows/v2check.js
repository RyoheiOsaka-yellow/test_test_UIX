const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
log('V2', await page.evaluate(() => ({ shell: !!app.shell, step: app.shell?.step, sw: document.querySelector('#btnSwitchUI')?.textContent, sm: document.querySelector('#smSwitchUI')?.textContent })));
await page.evaluate(() => { const i = app.model.instances[0]; app.select(i.id); const sel = [...document.querySelectorAll('#props select')].find(s => [...s.options].some(o => o.value === 'brace')); sel.value = 'gusset'; sel.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(600);
log('V2 ROLE', await page.evaluate(() => app.model.getInstance(app.selection).cadRole));
log('V2 EXPLODE CARD', await page.$$eval('#explodeHost .bom-table tbody tr', t => t.length));
