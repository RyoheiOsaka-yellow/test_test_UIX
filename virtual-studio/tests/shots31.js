// v3.3: スライダーUndo合体 / alert→トースト統一 / ツアーのリサイズ追従 / 非対応ブラウザ案内
// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  let dialogs = 0;
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => { dialogs++; d.accept(); });
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① スライダーUndo合体: 連続変化が1ステップになる ============
  const undo = await page.evaluate(async () => {
    const c = state.cuts[0];
    const d0 = c.duration || 5;
    c.duration = d0 + 1; refresh(); // 離散変化 (基準)
    await new Promise(r => setTimeout(r, 600));
    const base = undoState.stack.length;
    for (let i = 0; i < 10; i++) { c.duration = d0 + 2 + i * 0.1; refresh(); } // 擬似スライダードラッグ
    const afterDrag = undoState.stack.length;
    await new Promise(r => setTimeout(r, 600));
    c.name = c.name + '!'; refresh(); // 間を空けた変化は別ステップ
    const afterNext = undoState.stack.length;
    doUndo();
    const nameBack = !state.cuts[0].name.endsWith('!');
    doUndo(); // ドラッグ全体が1回で戻る
    const durBack = Math.abs(state.cuts[0].duration - (d0 + 1)) < 0.001;
    return { base, afterDrag, afterNext, nameBack, durBack };
  });
  console.log({ ...undo,
    undoOk: undo.afterDrag === undo.base + 1 && undo.afterNext === undo.base + 2 && undo.nameBack && undo.durBack });

  // ============ ② alert→トースト: 最後のカット削除がトーストになる ============
  const toast = await page.evaluate(() => {
    state.cuts = [state.cuts[0]]; state.activeCut = 0; renderAll();
    document.getElementById('btnDelCut').click();
    const t = document.getElementById('toast');
    return { shown: !t.hidden, msg: t.textContent };
  });
  console.log({ ...toast, dialogs,
    toastOk: toast.shown && toast.msg.includes('最後のカット') && dialogs === 0 });

  // ============ ③ ツアーのリサイズ追従: スポットライトが引き直される ============
  await page.evaluate(() => startTour());
  await page.waitForTimeout(400);
  const holeBefore = await page.evaluate(() => document.getElementById('tourHole').style.height);
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.waitForTimeout(500); // debounce 150ms + 再描画
  const after = await page.evaluate(() => ({
    height: document.getElementById('tourHole').style.height,
    cardVisible: document.getElementById('tourCard').style.visibility !== 'hidden',
  }));
  await page.evaluate(() => tourEnd());
  console.log({ holeBefore, ...after,
    tourResizeOk: holeBefore !== after.height && after.cardVisible });
  await page.setViewportSize({ width: 1500, height: 950 });

  // ============ ④ 非対応ブラウザ案内: MediaRecorder無し→一度だけトースト ============
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true });
  });
  await page.reload();
  await page.waitForTimeout(2400); // 案内は1.5s遅延で出る
  const notice = await page.evaluate(() => ({
    shown: !document.getElementById('toast').hidden,
    msg: document.getElementById('toast').textContent,
    flagged: JSON.parse(localStorage.getItem('vsBrowserWarned') || 'false'),
  }));
  // 2回目のロードでは出ない (一度きり)
  await page.reload();
  await page.waitForTimeout(2400);
  const second = await page.evaluate(() => !document.getElementById('toast').hidden);
  console.log({ ...notice, second,
    noticeOk: notice.shown && notice.msg.includes('WebM録画に未対応') && notice.flagged && !second });

  console.log('ERRORS:', errors);
  await browser.close();
})();
