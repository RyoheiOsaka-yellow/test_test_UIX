import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(async e => { console.error('fallback', e.message); return chromium.launch(); });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
const failed = new Set();
page.on('requestfailed', r => failed.add(new URL(r.url()).host));
const views = [
  ['omaezaki', '#14/34.612/138.215'],
  ['omaezaki-z16', '#16/34.612/138.222'],
  ['hamamatsu-lake', '#13/34.68/137.60'],
  ['overview', '#10/34.85/138.05'],
];
for (const [name, hash] of views) {
  for (const dem of ['terrarium', 'mapbox', 'gsidem']) {
    await page.goto('http://127.0.0.1:5176/' + hash, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // DEM を切り替える（ボタンのラベルで探す）
    const label = { terrarium: 'Terrarium', mapbox: 'Mapbox Terrain-RGB', gsidem: '数値PNG' }[dem];
    const btn = page.locator('#dem-modes button', { hasText: label }).first();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `shots/${name}-${dem}.png` });
    console.log('shot', name, dem, 'zoom', await page.locator('#zoom-val').textContent());
  }
}
console.log('failed hosts:', [...failed].join(','));
await browser.close();
