await page.click('#btnFamily'); await page.waitForTimeout(2500);
console.log('FE INFO:', await page.textContent('.fe-info'));
