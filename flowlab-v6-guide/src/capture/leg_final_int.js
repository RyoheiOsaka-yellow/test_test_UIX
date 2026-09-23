const { openLegacy } = require('./leg_common.js');
(async () => {
  const h = await openLegacy(); const { page } = h;
  const enter = async id => { await page.evaluate(i => { window.__kz.exit(); window.__kz.enter(i); }, id); await page.waitForTimeout(4000); };
  for (const id of ['paint2', 'varnish', 'tint', 'lab', 'whGen']) await h.step(id, async () => { await enter(id); await h.shot('I_' + id, 1500, true); });
  await h.step('p1', async () => { await enter('paint1'); await h.shot('I_paint1_ui', 1500); await h.shot('I_paint1', 500, true); await h.crop('P_stats_p1', '#stats', 300); });
  await h.step('close', async () => { await h.cam(0.55, 0.85, 30, 0, 2, 0); await h.shot('I_p1_close', 3500, true); });
  await h.step('tabs', async () => { for (const [t, n] of [['接続・動線', 'P_ws_conn'], ['設備台帳', 'P_ws_ledger'], ['配置検証', 'P_ws_check']]) { await h.tab(t); await h.crop(n, '#precision', 800); } });
  await h.step('detail', async () => { await h.tab('設備台帳');
    await page.evaluate(() => { const t = [...document.querySelectorAll('#pAssetList > *')].find(e => /分散ミル M-1/.test(e.textContent)); if (t) t.click(); });
    await page.waitForTimeout(2500); await h.tab('設備詳細'); await h.shot('I_p1_detail_ui', 2500); await h.crop('P_ws_detail', '#precision', 300);
    await h.click('v3Section'); await h.shot('I_p1_section_ui', 4000); await h.shot('I_p1_section', 500, true); await h.click('v3Overview'); await page.waitForTimeout(2500); });
  await h.step('walk', async () => { await h.click('v3Walk'); await h.shot('I_p1_walk', 4000, true); await h.click('v3Overview'); await page.waitForTimeout(2500); });
  await h.step('play', async () => { await h.click('playBtn'); await h.cam(0.5, 0.95, 40, 0, 2, 0); await h.shot('I_p1_play', 6000, true); await h.click('playBtn'); });
  await h.step('mep', async () => { await h.click('bimBtn'); await page.waitForTimeout(2500); await h.cam(0.4, 1.15, 26, 0, 6, 0); await h.shot('I_p1_mep', 3500, true); await h.shot('I_p1_mep_ui', 500);
    await h.click('schBtn'); await h.crop('P_sch', '#schPanel', 2500); await h.click('schClose'); await h.click('bimBtn'); await page.waitForTimeout(1500); });
  await h.step('draw', async () => { await h.cam(0.4, 0.95, 50, 0, 2, 0); await h.click('drawBtn'); await h.shot('I_p1_draw', 3500, true); await h.click('drawBtn'); });
  await h.browser.close();
})();
