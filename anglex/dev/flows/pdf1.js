const dl = []; page.on('download', d => dl.push(d));
await page.click('.rtab[data-tab=project]'); await page.click('#btnWeightPdf');
await page.waitForFunction(() => document.querySelector('.toast.ok') !== null, null, { timeout: 180000 }).catch(() => console.log('toast timeout'));
await page.waitForTimeout(1500);
for (const d of dl) { const p = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/pdf1_' + dl.indexOf(d) + '.pdf'; await d.saveAs(p); console.log('DL saved', p); }
