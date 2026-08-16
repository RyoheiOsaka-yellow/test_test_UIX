// v3.4: モード由来バッジ / ストレージ表記修正 / タイムライン・サマリーのスチール表記
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
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① モード由来バッジ ============
  const badges = await page.evaluate(() => {
    // 屋外モードとスチールモードでカットを作る
    state.mode = 'outdoor';
    const op = allPresets().find(p => Array.isArray(p.modes) && p.modes.includes('outdoor'));
    state.cuts.push(makeCut(op));
    state.mode = 'still';
    state.cuts.push(makeCut(allPresets().find(p => p.id === 'three-point')));
    state.mode = 'video';
    renderAll();
    const outdoorBadge = document.querySelector('#cutStrip .mode-badge.mb-outdoor');
    const stillBadge = document.querySelector('#cutStrip .mode-badge.mb-still');
    return {
      count: document.querySelectorAll('#cutStrip .mode-badge').length,
      outdoor: !!outdoorBadge && outdoorBadge.textContent === '屋',
      still: !!stillBadge && stillBadge.textContent === 'ス',
      videoNoBadge: !document.querySelector('#cutStrip .cut-thumb[data-idx="0"] .mode-badge'),
      newOrigin: state.cuts[3].originMode === 'outdoor' && state.cuts[4].originMode === 'still',
    };
  });
  console.log({ ...badges, badgeOk: badges.count === 2 && badges.outdoor && badges.still && badges.videoNoBadge && badges.newOrigin });

  // 旧データ (originModeなし) の推定
  const legacy = await page.evaluate(() => {
    const op = allPresets().find(p => Array.isArray(p.modes) && p.modes.length === 1 && p.modes[0] === 'outdoor');
    const a = makeCut(op); delete a.originMode; ensureCameraDefaults(a);
    const b = makeCut(null); b.kind = 'still'; delete b.originMode; ensureCameraDefaults(b);
    const c = makeCut(null); delete c.originMode; ensureCameraDefaults(c);
    return { a: a.originMode, b: b.originMode, c: c.originMode };
  });
  console.log({ ...legacy, legacyOk: legacy.a === 'outdoor' && legacy.b === 'still' && legacy.c === 'video' });

  // canonical往復でスチールの由来が揃う
  const canon = await page.evaluate(() => {
    const shot = cutToCanonicalShot(state.cuts[4], 0, 'PRJ_T');
    const back = cutFromCanonicalShot(shot);
    return back.kind === 'still' && back.originMode === 'still';
  });

  // ============ ② タイムライン/ワークフローのスチール表記 ============
  const totals = await page.evaluate(() => {
    renderTimeline();
    return { tl: document.querySelector('#timelineBar .tl-total').textContent };
  });
  await page.click('#btnFlowPage');
  await page.waitForTimeout(600);
  const pill = await page.evaluate(() => document.querySelector('#wfSummary .wf-pill').textContent);
  await page.click('#btnWfBack');
  await page.waitForTimeout(300);
  console.log({ canon, ...totals, pill,
    labelOk: canon && totals.tl.includes('+ス1') && pill.includes('動画 計') && pill.includes('スチール1枚') });

  // ============ ③ ストレージメーター: 文字数ベース計上と新文言 ============
  const meter = await page.evaluate(async () => {
    await renderStorageMeter();
    const label = document.querySelector('#storageMeter .sm-label').textContent;
    let units = 0;
    for (const k of Object.keys(localStorage)) units += k.length + (localStorage.getItem(k) || '').length;
    return { label, expectMb: (units / 1048576).toFixed(2) };
  });
  console.log({ ...meter,
    meterOk: meter.label.includes('目安5MB') && meter.label.includes(meter.expectMb) && meter.label.includes('動画/音声') });

  await page.locator('#cutStrip').screenshot({ path: 'v34-badges.png' });
  console.log('ERRORS:', errors);
  await browser.close();
})();
