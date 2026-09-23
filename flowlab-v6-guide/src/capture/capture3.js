const { openApp, SP } = require('./common.js');
const RAW = SP + '/raw/';
async function sel(page, id, v) { await page.selectOption('#' + id, v); await page.waitForTimeout(600); }
async function setTime(page, sec) { await page.evaluate(s => { const t = document.getElementById('simTime'); t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, sec); }
async function cam(page, [x, y], { yaw = -1.58, pitch = 0.6, dist = 45, h = 0 } = {}) { await page.evaluate(([x, y, yaw, pitch, dist, h]) => window.__kz.cam(yaw, pitch, dist, x - 130, h, 57.5 - y), [x, y, yaw, pitch, dist, h]); }
async function view(page, name, wait = 2200) {
  await page.waitForTimeout(wait);
  const v = await page.evaluate(() => ({ ...window.__simViewport, H: innerHeight }));
  await page.screenshot({ path: RAW + name + '.png', clip: { x: v.left, y: v.H - v.bottom - v.height + 34, width: v.width, height: v.height - 34 } });
  console.log('view', name);
}
(async () => {
  const { browser, page } = await openApp({ width: 1600, height: 900, dsf: 2 });
  try {
    await sel(page, 'simDay', '2026-08-04'); await sel(page, 'simBuilding', 'all'); await sel(page, 'simFloor', '1');
    for (const t of [9.25, 10.5, 13.5, 15]) { await setTime(page, t * 3600); await page.waitForTimeout(300); console.log(t, await page.evaluate(() => document.getElementById('simActorCount').textContent)); }
    await setTime(page, 10.5 * 3600); await cam(page, [78, 18], { dist: 48, pitch: 0.62 }); await view(page, 'z1_replay_zoom');
  } catch (e) { console.log('FAIL z1', e.message); }
  try {
    await sel(page, 'simDay', '2026-07-29'); await sel(page, 'simBuilding', 'paint1'); await sel(page, 'simFloor', 'both');
    await setTime(page, 10 * 3600); await cam(page, [152, 51], { yaw: -0.9, pitch: 1.05, dist: 95, h: 5 }); await view(page, 'z2_replay_2f');
  } catch (e) { console.log('FAIL z2', e.message); }
  try {
    await page.click('[data-sim-mode="plan"]'); await page.waitForTimeout(1500);
    await cam(page, [150, 50], { dist: 150, pitch: 0.62 }); await view(page, 'z3_plan_overview', 3000);
    await cam(page, [185, 48], { dist: 75, pitch: 0.62, yaw: -1.4 }); await view(page, 'z4_plan_second', 3000);
  } catch (e) { console.log('FAIL z3', e.message); }
  try {
    await page.click('[data-sim-edge="0"]'); await page.waitForTimeout(1500);
    await cam(page, [148, 40], { dist: 125, pitch: 0.6 }); await view(page, 'z5_edge', 3000);
  } catch (e) { console.log('FAIL z5', e.message); }
  await browser.close();
})();
