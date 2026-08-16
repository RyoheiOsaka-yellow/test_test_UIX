// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);

  // --- 1) 3D HUD: 長い情報行になるプリセット + 移動あり → HUD描画確認
  await page.evaluate(() => {
    const sel = document.getElementById('presetSelect');
    // ドリーインなど移動のあるプリセットを選ぶ
    const c = state.cuts[state.activeCut];
    c.camera.move = 'dollyin'; c.camera.focalMm = 85; renderAll();
  });
  await page.click('[data-view="3d"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'v18-3d-hud-wide.png' });
  console.log('3D wide OK, errors so far:', errors.length);

  // 狭いビューポートで被りが無いか(fitTextで省略される)
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'v18-3d-hud-narrow.png' });
  // canvas要素だけ切り出し
  const cv = await page.locator('#studio3d').boundingBox();
  if (cv) await page.screenshot({ path: 'v18-3d-hud-narrow-canvas.png', clip: cv });
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.click('[data-view="2d"]');
  await page.waitForTimeout(400);

  // --- 2) タイムライン トリム: 右端ハンドルをドラッグ → duration変化
  const before = await page.evaluate(() => state.cuts.map(c => c.duration || 5));
  const handle = await page.locator('.tl-handle').first().boundingBox();
  if (!handle) { console.log('NO HANDLE FOUND'); }
  else {
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  const after = await page.evaluate(() => state.cuts.map(c => c.duration || 5));
  console.log({ trimBefore: before, trimAfter: after, trimOk: after[0] === before[0] + 4 });

  // --- 3) タイムライン 並べ替え: 1番目ブロックを3番目位置へドラッグ
  const names0 = await page.evaluate(() => state.cuts.map(c => c.name));
  const b0 = await page.locator('.tl-block').nth(0).boundingBox();
  const b2 = await page.locator('.tl-block').nth(2).boundingBox();
  await page.mouse.move(b0.x + 20, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const names1 = await page.evaluate(() => ({ names: state.cuts.map(c => c.name), active: state.activeCut }));
  console.log({ reorderBefore: names0, reorderAfter: names1, reorderOk: names1.names[0] !== names0[0] });

  // --- 4) クリック選択が生きているか
  await page.locator('.tl-block').nth(0).click();
  await page.waitForTimeout(300);
  const sel0 = await page.evaluate(() => state.activeCut);
  console.log({ clickSelect: sel0 === 0 });
  await page.screenshot({ path: 'v18-timeline.png' });

  // --- 5) Phase 3-lite: プロジェクトDNA抽出
  await page.click('#btnDnaPage');
  await page.waitForTimeout(400);
  await page.click('#btnDnaExtract');
  await page.waitForTimeout(500);
  const ext = await page.evaluate(() => {
    const d = state.customDNA[state.customDNA.length - 1];
    return d ? { id: d.id, name: d.name, conf: d.provenance && d.provenance.confidence, method: d.provenance && d.provenance.extraction_method, hasDims: !!d.dims } : null;
  });
  console.log({ extract: ext, extractOk: ext && ext.conf === 'estimate' && ext.method === 'auto_from_project' });
  // 推定値バッジがカードに出るか
  const badge = await page.evaluate(() => document.getElementById('dnaGrid').innerHTML.includes('推定値'));
  console.log({ estimateBadge: badge });
  await page.screenshot({ path: 'v18-dna-extract.png' });

  // --- 6) Phase 5-lite: 適用カウント + 👍
  await page.locator('.dna-card [data-apply]').first().click();
  await page.waitForTimeout(400);
  const perf1 = await page.evaluate(() => JSON.parse(localStorage.getItem('vsDnaPerf') || '{}'));
  console.log({ perfAfterApply: perf1 });
  const goodBtn = page.locator('[data-good]').first();
  if (await goodBtn.count()) {
    await goodBtn.click();
    await page.waitForTimeout(300);
  }
  const perf2 = await page.evaluate(() => JSON.parse(localStorage.getItem('vsDnaPerf') || '{}'));
  console.log({ perfAfterGood: perf2 });
  await page.screenshot({ path: 'v18-dna-perf.png' });

  console.log('ERRORS:', errors);
  await browser.close();
})();
