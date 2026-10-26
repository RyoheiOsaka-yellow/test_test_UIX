await page.click('#btnCatalog'); await page.waitForTimeout(600);
await page.fill('.cat-filters input', '門型架台'); await page.waitForTimeout(300);
await page.click('.cat-item >> nth=0'); await page.waitForTimeout(400);
console.log('CAT COUNT:', await page.textContent('.cat-count'));
console.log('CAT DETAIL:', (await page.textContent('.cat-detail')).slice(0, 300).replace(/\s+/g, ' '));
