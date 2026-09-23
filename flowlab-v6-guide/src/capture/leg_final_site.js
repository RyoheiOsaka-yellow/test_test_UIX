const { openLegacy } = require('./leg_common.js');
(async () => {
  const h = await openLegacy(); const { page } = h;
  await h.step('site-ui', () => h.shot('L_site_ui', 3000));
  for (const [id, n] of [['exAll', 'L_ex_all'], ['exGate', 'L_ex_gate'], ['exWh', 'L_ex_wh'], ['exTanks', 'L_ex_tanks'], ['exSunset', 'L_ex_sunset']])
    await h.step(n, async () => { await h.click(id); await h.shot(n, 4000, true); });
  await h.step('day', async () => { await h.click('exAll'); await page.waitForTimeout(1500); await h.click('exSunset'); await page.waitForTimeout(1500); });
  await h.step('bim', async () => { await h.click('bimBtn'); await h.cam(0.2, 1.0, 150, 35, 4, -15); await h.shot('L_bim_ui', 4500); await h.shot('L_bim_clean', 1000, true);
    await h.click('clashBtn'); await h.shot('L_clash_ui', 3000); await h.crop('P_clash', '#clashPanel', 500); await h.click('bimBtn'); await page.waitForTimeout(1500); });
  await h.step('draw', async () => { await h.click('drawBtn'); await h.shot('L_draw_site', 3500, true); await h.click('drawBtn'); await page.waitForTimeout(1500); });
  await h.step('play', async () => { await h.click('exAll'); await page.waitForTimeout(2000); await h.click('playBtn'); await h.click('congBtn'); await h.shot('L_play_cong', 7000, true); await h.shot('L_play_cong_ui', 500); await h.crop('P_stats_site', '#stats', 300); await h.click('congBtn'); await h.click('playBtn'); });
  await h.step('ana', async () => { await h.click('anaBtn'); await page.waitForTimeout(1500); await h.click('anaSugBtn'); await h.crop('P_ana', '#anaPanel', 2500); await h.click('anaBtn'); });
  await h.browser.close();
})();
