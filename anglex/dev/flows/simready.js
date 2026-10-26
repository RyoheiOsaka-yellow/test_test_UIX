const dl = []; page.on('download', d => dl.push(d));
await page.click('.rtab[data-tab=project]'); await page.click('#btnExpSimReady');
await page.waitForFunction(() => !!document.querySelector('.toast.ok, .toast.bad'), null, { timeout: 120000 }).catch(() => console.log('toast timeout'));
console.log('TOAST:', await page.$eval('.toast.ok, .toast.bad', e => e.textContent).catch(() => '-'));
await page.waitForTimeout(1000);
for (const d of dl) { const p = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/simready.zip'; await d.saveAs(p); console.log('DL saved', p); }
