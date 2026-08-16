// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(600);

  // 基本描画チェック
  const presetCount = await page.locator('.preset-card').count();
  const canvasItems = await page.locator('#studioCanvas .equip-item').count();
  const cutThumbs = await page.locator('.cut-thumb').count();
  const promptLen = (await page.inputValue('#promptText')).length;
  console.log({ presetCount, canvasItems, cutThumbs, promptLen });

  await page.screenshot({ path: 'shot-main.png' });

  // プリセット切替
  await page.locator('.preset-card').nth(3).click();
  await page.waitForTimeout(300);

  // モード切替: スチール
  await page.locator('.mode-tab[data-mode="still"]').click();
  await page.waitForTimeout(200);
  const stillPresets = await page.locator('.preset-card').count();
  await page.locator('.preset-card').first().click();
  await page.waitForTimeout(300);
  console.log({ stillPresets });
  await page.screenshot({ path: 'shot-still.png' });

  // 機材クリック選択 → インスペクター表示
  await page.locator('#studioCanvas .equip-item').nth(2).dispatchEvent('pointerdown', { bubbles: true });
  await page.waitForTimeout(200);
  const inspHasItem = await page.locator('#inspector').textContent();
  console.log({ hasEquipSection: inspHasItem.includes('選択中の機材') });

  // オプション toggle (演出オプション — v4.0で役割分担のチップも .opt-toggle になったため明示)
  await page.locator('.opt-toggle[data-opt]').first().click();
  await page.waitForTimeout(200);

  // カット追加・複製
  await page.click('#btnAddCut');
  await page.click('#btnDupCut');
  await page.waitForTimeout(200);
  console.log({ cutsAfter: await page.locator('.cut-thumb').count() });

  // 指示書生成 (アプリ内オーバーレイ)
  await page.click('#btnExportDoc');
  await page.waitForTimeout(900);
  const docShown = await page.evaluate(() => !document.getElementById('docOverlay').hidden);
  const cutPages = await page.frameLocator('#docFrame').locator('.cut-page').count();
  console.log({ docShown, cutPages });
  await page.click('#btnDocBack');

  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
