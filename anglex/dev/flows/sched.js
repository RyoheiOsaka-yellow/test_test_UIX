await page.click('#btnSchedules'); await page.waitForTimeout(800);
console.log('SCHED:', (await page.textContent('.modal')).slice(0, 600).replace(/\s+/g, ' '));
