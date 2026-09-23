const { openApp, SP } = require('./common.js');
const RAW = SP + '/raw/';
(async () => {
  const { browser, page } = await openApp({ width: 1600, height: 900, dsf: 2 });
  for (const [id, v] of [['simDay', '2026-08-04'], ['simBuilding', 'all'], ['simFloor', '1']]) { await page.selectOption('#' + id, v); await page.waitForTimeout(600); }
  await page.evaluate(s => { const t = document.getElementById('simTime'); t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, 10 * 3600 + 4 * 60);
  await page.evaluate(() => window.__kz.cam(-1.58, 0.6, 60, 78 - 130, 0, 57.5 - 17));
  await page.waitForTimeout(2200);
  const v = await page.evaluate(() => ({ ...window.__simViewport, H: innerHeight }));
  await page.screenshot({ path: RAW + 'k_replay_1004.png', clip: { x: v.left, y: v.H - v.bottom - v.height + 42, width: v.width, height: v.height - 56 } });
  await browser.close();
})();
