const dl = []; page.on('download', d => { dl.push(d); page.evaluate(n => { window.__dlc = n; }, dl.length).catch(() => {}); });
await page.click('.rtab[data-tab=project]');
await page.click('#btnWeightCsv'); await page.waitForTimeout(500);
await page.click('#btnWeightXlsx'); await page.waitForTimeout(3000);
await page.click('#btnWeightPdf'); await page.waitForFunction(n => window.__dlc >= n, 3, { timeout: 40000 }).catch(() => {});
await page.click('#btnEstPdf'); await page.waitForFunction(n => window.__dlc >= n, 4, { timeout: 30000 }).catch(() => {});
await page.click('.rtab[data-tab=home]'); await page.click('#btnEstimate'); await page.waitForTimeout(1000); await page.click('.est-head-actions >> text=XLSX'); await page.waitForTimeout(2500); await page.click('.est-head-actions >> text=加工指示書 PDF'); await page.waitForFunction(n => window.__dlc >= n, 6, { timeout: 40000 }).catch(() => {});
for (const d of dl) { const p = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/dl_' + dl.indexOf(d) + '_' + d.suggestedFilename(); await d.saveAs(p); console.log('DL', d.suggestedFilename(), d.url().slice(0, 40)); }
