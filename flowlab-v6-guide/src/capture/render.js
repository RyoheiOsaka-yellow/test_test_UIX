// Render check + PDF export for the simulation guides (fonts served through curl, since the browser profile lacks the proxy CA).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const SP = process.env.SP, DIR = '/home/user/test_test_UIX/flowlab-v6-guide/';
async function fontRoute(page) {
  await page.route(/^https?:\/\//, async route => {
    const url = route.request().url();
    if (!/fonts\.(googleapis|gstatic)\.com/.test(url)) return route.abort();
    const file = path.join(SP, 'cdn', url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200));
    if (!fs.existsSync(file)) execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36', '-o', file, url]);
    await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': url.includes('css2') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
  });
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const mode = process.argv[2] || 'check';
  // 6-page
  const p = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERR 6p', e.message));
  await fontRoute(p);
  await p.goto('file://' + DIR + 'FLOW_LAB_3D_model_6p.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  if (mode === 'check') {
    const pgs = await p.$$('.pg');
    for (const [i, el] of pgs.entries()) {
      const over = await el.evaluate(n => { const b = n.getBoundingClientRect(); let m = 0; n.querySelectorAll('*').forEach(c => { const r = c.getBoundingClientRect(); if (r.height) m = Math.max(m, r.bottom - b.bottom); }); return Math.round(m); });
      console.log('page', i + 1, 'overflow px', over);
      await el.screenshot({ path: `${SP}/prev/s6_${i + 1}.png` });
    }
  } else {
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: DIR + 'FLOW_LAB_3D_model_6p.pdf', preferCSSPageSize: true, printBackground: true });
    console.log('pdf 6p done');
  }
  // detail
  const d = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  d.on('pageerror', e => console.log('PAGEERR detail', e.message));
  await fontRoute(d);
  await d.goto('file://' + DIR + 'FLOW_LAB_3D_model_detail.html', { waitUntil: 'networkidle' });
  await d.evaluate(() => document.fonts.ready); await d.waitForTimeout(800);
  if (mode === 'check') {
    for (const id of ['s1', 's3', 's3-3', 's4-3', 's4-4', 's5', 'sa']) {
      const el = await d.$('#' + id); const b = await el.boundingBox();
      await d.screenshot({ path: `${SP}/prev/d_${id}.png`, fullPage: true, clip: { x: 0, y: b.y - 10, width: 1360, height: 1300 } });
    }
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } }); await m.route(/^https?:\/\//, r => r.abort());
    for (const f of ['FLOW_LAB_3D_model_6p.html', 'FLOW_LAB_3D_model_detail.html']) { await m.goto('file://' + DIR + f); await m.waitForTimeout(500); console.log('mobile', f, await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth])); }
  } else {
    await d.emulateMedia({ media: 'print' });
    await d.pdf({ path: DIR + 'FLOW_LAB_3D_model_detail.pdf', preferCSSPageSize: true, printBackground: true });
    console.log('pdf detail done');
  }
  await browser.close();
})();
