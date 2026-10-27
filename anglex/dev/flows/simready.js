const dl = []; page.on('download', d => dl.push(d));
await page.evaluate(() => document.querySelector('#btnExpSimReady').click()); await page.waitForTimeout(400); await page.click('.modal-foot .btn.primary');
await page.waitForFunction(() => !!document.querySelector('.toast.ok, .toast.bad'), null, { timeout: 120000 }).catch(() => console.log('toast timeout'));
console.log('TOAST:', await page.$eval('.toast.ok, .toast.bad', e => e.textContent).catch(() => '-'));
await page.waitForTimeout(1000);
for (const d of dl) { const p = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/simready.zip'; await d.saveAs(p); console.log('DL saved', p); }
