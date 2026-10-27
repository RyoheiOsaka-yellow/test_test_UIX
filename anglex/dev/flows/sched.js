await page.evaluate(() => document.querySelector('#btnSchedules').click()); await page.waitForTimeout(800);
console.log('SCHED:', (await page.textContent('.modal')).slice(0, 600).replace(/\s+/g, ' '));
