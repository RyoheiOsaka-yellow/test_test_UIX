const { openApp, SP } = require('./common.js');
const fs = require('fs');
const RAW = SP + '/raw/';
const meta = {};
async function boxes(page, list) {
  return page.evaluate(list => {
    const W = innerWidth, H = innerHeight;
    return list.map(([n, sel, label]) => {
      const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0);
      if (!els.length) return { n, label, missing: sel };
      const rs = els.map(e => e.getBoundingClientRect());
      const x0 = Math.min(...rs.map(r => r.left)), y0 = Math.min(...rs.map(r => r.top)), x1 = Math.max(...rs.map(r => r.right)), y1 = Math.max(...rs.map(r => r.bottom));
      return { n, label, x: x0 / W * 100, y: y0 / H * 100, w: (x1 - x0) / W * 100, h: (Math.min(y1, H) - y0) / H * 100 };
    });
  }, list);
}
async function setTime(page, sec) {
  await page.evaluate(s => { const t = document.getElementById('simTime'); t.value = s; t.dispatchEvent(new Event('input', { bubbles: true })); }, sec);
}
async function sel(page, id, v) { await page.selectOption('#' + id, v); await page.waitForTimeout(600); }
async function shot(page, name, opts = {}) { await page.waitForTimeout(opts.wait ?? 1800); await page.screenshot({ path: RAW + name + '.png', ...opts.s }); console.log('shot', name); }
async function crop(page, name, selector) { const el = await page.$(selector); await el.screenshot({ path: RAW + name + '.png' }); console.log('crop', name); }
async function step(name, fn) { try { await fn(); } catch (e) { console.log('FAIL', name, e.message.slice(0, 300)); } }

(async () => {
  const { browser, page } = await openApp({ width: 1600, height: 900, dsf: 2 });
  const main = [
    [1, '[data-sim-mode]', 'モード切替'], [2, '#simBuilding, #simFloor', '建屋・階'], [3, '#simGroup', '工程フィルター'],
    [4, '#simDay, #simFit', '実測日・視点を合わせる'], [5, '#simShell .sim-left .sim-separator', '何を変えるか'],
    [6, '#simShell .sim-right', '何が変わるか'], [7, '#simPlay, #simSpeed', '再生・倍速'], [8, '#simTime', 'タイムライン'],
    [9, '#simSave, #simLoad', '条件を保存・読込'], [10, '#simDashboard', '分析一覧'], [11, '#simLegacy', '仮設備を編集'],
  ];
  await step('s01', async () => { await shot(page, 's01_replay_start', { wait: 2500 }); meta.s01 = await boxes(page, main); });
  await step('s02', async () => {
    await sel(page, 'simDay', '2026-08-04'); await sel(page, 'simBuilding', 'all'); await sel(page, 'simFloor', 'both');
    await page.click('#simFit'); await setTime(page, 10.5 * 3600); await shot(page, 's02_replay_all_0804', { wait: 2500 });
    meta.s02 = await page.evaluate(() => document.getElementById('simActorCount').textContent);
  });
  await step('s03', async () => {
    await sel(page, 'simDay', '2026-07-29'); await sel(page, 'simBuilding', 'paint1'); await sel(page, 'simFloor', 'both');
    await page.click('#simFit'); await setTime(page, 10 * 3600); await shot(page, 's03_replay_paint1_both', { wait: 2500 });
    meta.s03 = await page.evaluate(() => document.getElementById('simActorCount').textContent);
  });
  await step('s04', async () => { await crop(page, 's04_bottom', '#simShell .sim-bottom'); await crop(page, 's04_top', '#simShell .sim-top'); });
  await step('s05', async () => {
    await page.click('[data-sim-mode="plan"]'); await shot(page, 's05_plan_default', { wait: 3000 });
    meta.s05 = await boxes(page, [[1, '#simShell .sim-left .sim-separator', '移設・往来削減の条件'], [2, '#simShell .sim-right .sim-result', '結果（移動時間・距離・人員）'], [3, '#simShell .sim-right table', '工程別の変化']]);
  });
  await step('s06', async () => { await page.click('[data-sim-edge="0"]'); await shot(page, 's06_edge_highlight', { wait: 3000 }); });
  await step('s07', async () => {
    await page.click('[data-sim-mode="plan"]'); await page.waitForTimeout(800);
    await page.evaluate(() => { const r = document.querySelector('[data-sim-cfg="researchReduction"]'); r.value = 1; r.dispatchEvent(new Event('change', { bubbles: true })); });
    await shot(page, 's07_plan_research100', { wait: 2500 });
    meta.s07 = await page.evaluate(() => { const r = window.__factorySim.evaluate(); return { before: r.beforeMinutes, after: r.afterMinutes, gain: r.gain, fte: r.fte }; });
  });
  await step('s08', async () => {
    await page.evaluate(() => { const r = document.querySelector('[data-sim-cfg="researchReduction"]'); r.value = 0; r.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(600);
    for (const k of ['moveV', 'moveT']) { await page.evaluate(k => { const c = document.querySelector(`[data-sim-cfg="${k}"]`); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }, k); await page.waitForTimeout(600); }
    await shot(page, 's08_plan_moveoff', { wait: 2000 });
    meta.s08 = await page.evaluate(() => { const r = window.__factorySim.evaluate(); return { before: r.beforeMinutes, after: r.afterMinutes, gain: r.gain }; });
    await page.click('#simReset').catch(async () => { await page.click('#simShell details summary'); await page.click('#simReset'); });
    await page.waitForTimeout(800);
  });
  // Tall viewport for full panel crops
  await step('panels', async () => {
    await page.setViewportSize({ width: 1600, height: 2300 }); await page.waitForTimeout(1500);
    await page.click('[data-sim-mode="replay"]'); await page.waitForTimeout(1500);
    await crop(page, 'c01_left_replay', '#simShell .sim-left');
    await page.click('[data-sim-mode="plan"]'); await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll('#simShell .sim-left details').forEach(d => d.open = true));
    await crop(page, 'c02_left_plan', '#simShell .sim-left');
    await page.evaluate(() => document.querySelectorAll('#simShell .sim-right details').forEach(d => d.open = true));
    await crop(page, 'c03_right_plan', '#simShell .sim-right');
    await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(1500);
  });
  // Dashboard
  const tabs = ['全体像', '実測動線', '移設比較', '人員計画', '元資料・集計方法'];
  await step('dash', async () => {
    await page.click('#simDashboard'); await page.waitForTimeout(2000);
    for (const [i, t] of tabs.entries()) {
      await page.evaluate(t => [...document.querySelectorAll('#pdApp [data-tab]')].find(b => b.textContent.trim() === t).click(), t);
      await page.waitForTimeout(1200);
      if (t === '実測動線') { await page.selectOption('#pdGroup', '調色'); await page.waitForTimeout(500); await page.check('#pdTrace'); await page.waitForTimeout(800); }
      const h = await page.evaluate(() => { const a = document.getElementById('pdApp'); return a.scrollHeight; });
      await page.setViewportSize({ width: 1600, height: Math.min(h, 4000) }); await page.waitForTimeout(1500);
      await page.screenshot({ path: RAW + `d0${i + 1}_dash.png` }); console.log('dash', t, h);
      await page.setViewportSize({ width: 1600, height: 900 });
    }
    meta.dashH = true;
  });
  // Legacy editor
  await step('legacy', async () => {
    await page.click('#pdInternal'); await page.waitForTimeout(3000);
    await page.click('#simLegacy'); await shot(page, 'l01_legacy', { wait: 5000 });
  });
  fs.writeFileSync(SP + '/raw/meta.json', JSON.stringify(meta, null, 1));
  await browser.close();
})();
