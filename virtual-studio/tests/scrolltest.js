// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const errors = [];
  let fail = false;

  for (const vp of [{ width: 1280, height: 720 }, { width: 1500, height: 950 }, { width: 1100, height: 620 }, { width: 800, height: 900 }]) {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const r = document.querySelector('#rightPanel');
      const l = document.querySelector('#libraryPanel');
      const narrow = innerWidth <= 900;
      // パネル最下部の要素 (備考テキストエリア) までスクロールして見えるか
      r.scrollTop = 999999;
      const notes = document.querySelector('#cNotes');
      const nb = notes.getBoundingClientRect();
      const rb = r.getBoundingClientRect();
      const notesReachable = narrow ? true : (nb.bottom <= rb.bottom + 4 && nb.bottom > 0);
      // ライブラリ最下部
      l.scrollTop = 999999;
      const cards = document.querySelectorAll('.preset-card');
      const last = cards[cards.length - 1].getBoundingClientRect();
      const lb = l.getBoundingClientRect();
      const libReachable = narrow ? true : (last.bottom <= lb.bottom + 4);
      // パネルが画面からはみ出ていないか
      const overflow = narrow ? false : (rb.bottom > innerHeight + 2 || lb.bottom > innerHeight + 2);
      // 狭い画面: ページ全体スクロールで最下部に到達できるか
      let pageScrollOk = true;
      if (narrow) {
        scrollTo(0, 999999);
        pageScrollOk = document.querySelector('#cNotes').getBoundingClientRect().top < innerHeight * 3;
      }
      return { notesReachable, libReachable, overflow, pageScrollOk, narrow };
    });
    const ok = m.notesReachable && m.libReachable && !m.overflow && m.pageScrollOk;
    if (!ok) fail = true;
    console.log(`${vp.width}x${vp.height}:`, JSON.stringify(m), ok ? 'OK' : 'NG');
    await page.close();
  }

  // 9:16 プレビューの高さ上限とスクロール位置保持
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(400);
  await page.selectOption('#cAspect', '9:16');
  await page.waitForTimeout(300);
  const prevH = await page.evaluate(() => document.querySelector('#previewWrap svg').getBoundingClientRect().height);
  // ライブラリを深くスクロールしてからプリセット適用 → 位置維持を確認
  const keep = await page.evaluate(() => { const l = document.querySelector('#libraryPanel'); l.scrollTop = 800; return l.scrollTop; });
  await page.evaluate(() => document.querySelectorAll('.preset-card')[5].click());
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector('#libraryPanel').scrollTop);
  console.log({ verticalPreviewH: Math.round(prevH), scrollKept: Math.abs(after - keep) < 50, keep, after });
  await page.screenshot({ path: 'v6-fixed.png' });
  await browser.close();
  console.log('ERRORS:', errors.length ? errors : 'none');
  process.exit(fail || errors.length ? 1 : 0);
})();
