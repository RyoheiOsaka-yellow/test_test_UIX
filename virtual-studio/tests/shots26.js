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

  // --- 0) 自動テスト環境 (webdriver) ではようこそが出ない
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(500);
  const suppressed = await page.evaluate(() => document.getElementById('welcome').hidden);
  console.log({ suppressed, suppressOk: suppressed });

  // --- 1) 強制表示 → サンプル読み込み + ツアー開始
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('vsForceWelcome', '1'); });
  await page.reload(); await page.waitForTimeout(600);
  const welShown = await page.evaluate(() => !document.getElementById('welcome').hidden);
  await page.screenshot({ path: 'v29-welcome.png' });
  await page.click('#btnWelSample');
  await page.waitForTimeout(800);
  const sample = await page.evaluate(() => ({
    title: state.projectTitle,
    cuts: state.cuts.length,
    refs: state.story.refs.length,
    alpha: state.story.refs.some(r => r.hasAlpha),
    thumbsWithImage: document.querySelectorAll('#cutStrip .cut-thumb svg image').length,
    captions: state.cuts.filter(c => c.caption).length,
    storyFilled: state.story.text.includes('夕暮れ'),
    tourShown: !document.getElementById('tourWrap').hidden,
    tourStep: document.getElementById('tourStep').textContent,
  }));
  console.log({ welShown, sample,
    sampleOk: welShown && sample.title.includes('サンプル') && sample.cuts === 4 && sample.refs === 2
      && sample.alpha && sample.thumbsWithImage >= 4 && sample.storyFilled && sample.tourShown && sample.tourStep === '1 / 8' });
  await page.screenshot({ path: 'v29-tour-step1.png' });

  // --- 2) ツアーを最後まで進める
  for (let i = 0; i < 7; i++) { await page.click('#btnTourNext'); await page.waitForTimeout(250); }
  const lastLabel = await page.evaluate(() => document.getElementById('btnTourNext').textContent);
  await page.screenshot({ path: 'v29-tour-step8.png' });
  await page.click('#btnTourNext'); // 完了
  await page.waitForTimeout(300);
  const tourDone = await page.evaluate(() => ({
    hidden: document.getElementById('tourWrap').hidden,
    flag: JSON.parse(localStorage.getItem('vsTourDone') || 'false'),
  }));
  console.log({ lastLabel, tourDone, tourOk: lastLabel === '完了' && tourDone.hidden && tourDone.flag });

  // --- 3) ヘルプからツアー再開
  await page.evaluate(() => { localStorage.removeItem('vsForceWelcome'); });
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  await page.click('#btnTourAgain');
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => !document.getElementById('tourWrap').hidden);
  await page.click('#btnTourSkip');
  await page.waitForTimeout(200);
  console.log({ again, againOk: again });

  // --- 4) パフォーマンス: プレビューキャッシュ
  const perf = await page.evaluate(() => {
    // 非キャッシュ (毎回クリア)
    let t0 = performance.now();
    for (let i = 0; i < 8; i++) { previewCache.clear(); renderCutStrip(); }
    const cold = performance.now() - t0;
    // キャッシュあり
    renderCutStrip();
    t0 = performance.now();
    for (let i = 0; i < 8; i++) renderCutStrip();
    const warm = performance.now() - t0;
    // 無効化: カット内容を変えると別のSVGになる
    const before = renderPreviewCached(state.cuts[0], 'inv');
    state.cuts[0].caption = 'キャッシュ無効化テスト';
    const after = renderPreviewCached(state.cuts[0], 'inv');
    return { cold: +cold.toFixed(1), warm: +warm.toFixed(1), invalidates: before !== after && after.includes('キャッシュ無効化テスト') };
  });
  console.log({ perf, perfOk: perf.warm < perf.cold && perf.invalidates });

  // --- 5) プリセット一覧のメモ化: 変化がなければDOMを触らない
  const memo = await page.evaluate(() => {
    const first = document.querySelector('.preset-card');
    first.dataset.probe = 'kept';
    renderPresetList();
    const kept = document.querySelector('.preset-card').dataset.probe === 'kept';
    applyPreset(document.querySelector('.preset-card').dataset.preset); // 統計が変わる→再構築
    const rebuilt = document.querySelector('.preset-card').dataset.probe !== 'kept';
    return { kept, rebuilt };
  });
  console.log({ memo, memoOk: memo.kept && memo.rebuilt });

  console.log('ERRORS:', errors);
  await browser.close();
})();
