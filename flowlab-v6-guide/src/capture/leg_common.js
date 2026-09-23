const { openApp, SP } = require('./common.js');
const O = SP + '/legf/';
async function openLegacy() {
  const { browser, page } = await openApp({ width: 1600, height: 900, dsf: 2 });
  await page.evaluate(() => { window.__factorySim.close(); document.getElementById('pdApp').hidden = true;
    const s = document.createElement('style'); s.id = 'cleanCss'; s.textContent = 'body.clean > *:not(#app){visibility:hidden!important}'; document.head.appendChild(s); });
  await page.waitForTimeout(2500);
  const h = {
    page, browser,
    async shot(n, w = 3500, clean = false) { await page.evaluate(c => document.body.classList.toggle('clean', c), clean); await page.waitForTimeout(w); await page.screenshot({ path: O + n + '.png' }); await page.evaluate(() => document.body.classList.remove('clean')); console.log('shot', n); },
    async crop(n, sel, w = 1500) { await page.waitForTimeout(w); const el = await page.$(sel); await el.screenshot({ path: O + n + '.png' }); console.log('crop', n); },
    async tab(l) { await page.evaluate(l => { const b = [...document.querySelectorAll('#precision button')].find(x => x.textContent.trim() === l); if (b) b.click(); }, l); await page.waitForTimeout(1200); },
    async click(id) { await page.evaluate(i => document.getElementById(i).click(), id); },
    async cam(...a) { await page.evaluate(a => window.__kz.cam(...a), a); },
    async step(n, fn) { try { await fn(); } catch (e) { console.log('FAIL', n, e.message.slice(0, 160)); } },
  };
  return h;
}
module.exports = { openLegacy };
