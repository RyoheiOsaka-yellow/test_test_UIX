const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const SP = process.env.SP;
async function openApp({ width = 1600, height = 900, dsf = 1 } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });
  page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  // Serve CDN modules from a local curl cache (curl trusts the proxy CA; the browser profile does not).
  await page.route(/^https?:\/\//, async route => {
    const url = route.request().url();
    if (!url.startsWith('https://cdn.jsdelivr.net/')) return route.abort();
    const file = path.join(SP, 'cdn', url.replace(/[^a-zA-Z0-9._-]/g, '_'));
    if (!fs.existsSync(file)) execFileSync('curl', ['-sSfL', '-o', file, url]);
    const type = url.endsWith('.js') ? 'application/javascript' : 'application/octet-stream';
    await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
  });
  await page.goto('file://' + SP + '/app.html', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__factorySim && document.body.classList.contains('sim-active'), null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  return { browser, page };
}
module.exports = { openApp, SP };
