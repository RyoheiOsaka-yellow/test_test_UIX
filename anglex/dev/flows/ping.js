const t0 = Date.now(); console.log('ready?', await page.evaluate(() => window.__ready), 'quality', await page.evaluate(() => app.viewer.quality));
await page.evaluate(() => { const t = performance.now(); app.viewer.render(); return performance.now() - t; }).then(ms => console.log('one render ms', ms));
await page.click('.rtab[data-tab=project]', { timeout: 10000 }).then(() => console.log('click ok', Date.now() - t0, 'ms')).catch(e => console.log('click FAIL', e.message.slice(0, 60)));
console.log('rebuild ms', await page.evaluate(() => { const t = performance.now(); app.rebuildAll(); return Math.round(performance.now() - t); }));
