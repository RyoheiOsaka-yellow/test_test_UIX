await page.click('.rtab[data-tab=import]'); await page.click('#btnDemoDxf'); await page.waitForTimeout(1500);
const rows = await page.$$eval('.modal table.grid tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim().slice(0, 28)).join(' | ')));
console.log('RISK ROWS:\n' + rows.join('\n'));
