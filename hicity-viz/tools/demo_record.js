const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'video', size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.route('**cyberjapandata.gsi.go.jp**', r => r.abort());
  await page.goto('file://' + __dirname + '/index3d.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);   // シーン構築待ち(録画前半は後でトリム)

  // 初期設定: リプレイ高速・朝8時
  await page.evaluate(() => {
    document.querySelector('#speed-row button[data-v="900"]').click();
    const ts = document.getElementById('time-slider');
    ts.value = 8 * 3600; ts.dispatchEvent(new Event('input'));
  });

  // [シーン1] ワイドへズームアウト(都市全景)
  for (let i = 0; i < 12; i++) { await page.mouse.move(640, 380); await page.mouse.wheel(0, 420); await page.waitForTimeout(120); }
  await page.waitForTimeout(1400);

  // [シーン2] HICityへフライト+フロア展開
  await page.evaluate(() => document.querySelector('#fly-row button[data-fly="hic"]').click());
  await page.waitForTimeout(1700);
  for (let v = 1.0; v <= 2.2; v += 0.15) {
    await page.evaluate(x => {
      const s = document.getElementById('floor-expand');
      s.value = x; s.dispatchEvent(new Event('input'));
    }, v);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(900);

  // [シーン3] 新駅(京急蒲田地下)へ
  await page.evaluate(() => document.querySelector('#fly-row button[data-fly="shin-keikyu-kamata"]').click());
  await page.waitForTimeout(2200);

  // [シーン4] 経路検索(蒲田→空港T3, 新空港線利用)
  await page.evaluate(() => document.getElementById('rt-go').click());
  for (let i = 0; i < 5; i++) { await page.mouse.move(640, 380); await page.mouse.wheel(0, 380); await page.waitForTimeout(130); }
  await page.waitForTimeout(1500);

  // [シーン5] 天空橋(HICity)へ戻って自動回転でフィニッシュ
  await page.evaluate(() => document.querySelector('#fly-row button[data-fly="tenkubashi"]').click());
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const c = document.getElementById('chk-rotate'); c.click(); });
  await page.waitForTimeout(3200);

  await ctx.close();   // flush video
  await browser.close();
})();
