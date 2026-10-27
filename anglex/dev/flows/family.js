await page.evaluate(() => document.querySelector('#btnFamily').click()); await page.waitForTimeout(2500);
console.log('FE INFO:', await page.textContent('.fe-info'));
