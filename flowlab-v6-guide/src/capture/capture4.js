// Simulation-first captures: replay time-lapse, before/after, highlighted OD, hero, whereabouts timeline data.
const { openApp, SP } = require('./common.js');
const fs = require('fs');
const RAW = SP + '/raw/';
async function sel(page, id, v) { await page.selectOption('#' + id, v); await page.waitForTimeout(600); }
async function setTime(page, sec) { await page.evaluate(s => { const t = document.getElementById('simTime'); t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, sec); }
async function cam(page, [x, y], { yaw = -1.58, pitch = 0.62, dist = 55, h = 0 } = {}) { await page.evaluate(([x, y, yaw, pitch, dist, h]) => window.__kz.cam(yaw, pitch, dist, x - 130, h, 57.5 - y), [x, y, yaw, pitch, dist, h]); }
async function view(page, name, wait = 2200) {
  await page.waitForTimeout(wait);
  const v = await page.evaluate(() => ({ ...window.__simViewport, H: innerHeight }));
  await page.screenshot({ path: RAW + name + '.png', clip: { x: v.left, y: v.H - v.bottom - v.height + 42, width: v.width, height: v.height - 56 } });
  console.log('view', name);
}
async function setCfg(page, key, val) { await page.evaluate(([k, v]) => { const e = document.querySelector(`[data-sim-cfg="${k}"]`); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [key, val]); await page.waitForTimeout(700); }
(async () => {
  const { browser, page } = await openApp({ width: 1600, height: 900, dsf: 2 });
  // whereabouts timeline (1-minute steps) for the two 調色 IDs on 8/4
  const tl = await page.evaluate(() => {
    const core = window.__factorySim.core, R = core.replay, tr = R.tracks.filter(t => t.day === '2026-08-04');
    return tr.map(x => { const out = []; for (let t = 7 * 3600 + 50 * 60; t <= 18 * 3600 + 30 * 60; t += 60) { const p = core.position(x, t); out.push(p ? (R.areas[p[5]] || '?').split('|').pop() : null); } return { uid: x.uid, start: 7 * 60 + 50, series: out }; });
  });
  fs.writeFileSync(RAW + 'timeline_0804.json', JSON.stringify(tl));
  // A: replay time-lapse
  await sel(page, 'simDay', '2026-08-04'); await sel(page, 'simBuilding', 'all'); await sel(page, 'simFloor', '1');
  for (const [hh, mm] of [[8, 14], [10, 24], [11, 54]]) {
    await setTime(page, hh * 3600 + mm * 60); await cam(page, [78, 17], { dist: 60, pitch: 0.6 });
    await view(page, `k_replay_${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`);
  }
  await page.screenshot({ path: RAW + 'k_full_replay.png' });
  // B: plan mode, 調色 only, before/after with same camera
  await page.click('[data-sim-mode="plan"]'); await page.waitForTimeout(1500);
  await sel(page, 'simGroup', '調色');
  const wide = [[140, 40], { dist: 165, pitch: 0.6 }];
  await setCfg(page, 'moveV', false); await setCfg(page, 'moveT', false);
  await cam(page, ...wide); await view(page, 'k_plan_before', 3000);
  await setCfg(page, 'moveV', true); await setCfg(page, 'moveT', true);
  await cam(page, ...wide); await view(page, 'k_plan_after', 3000);
  await page.screenshot({ path: RAW + 'k_full_plan_tint.png' });
  // C: highlight 研究棟→調色工場
  await page.click('[data-sim-edge="0"]'); await page.waitForTimeout(1500);
  await cam(page, ...wide); await view(page, 'k_plan_highlight', 3000);
  // D: hero – all groups, relocation on
  await page.click('[data-sim-mode="plan"]'); await page.waitForTimeout(1200);
  await sel(page, 'simGroup', 'all');
  await cam(page, [125, 60], { dist: 190, pitch: 0.78, yaw: -1.35 }); await view(page, 'k_hero', 3000);
  await browser.close();
})();
