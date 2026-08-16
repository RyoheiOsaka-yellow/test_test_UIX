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

  // ============ ③ ファイル分割: 分離モジュールの関数が生きている ============
  const split = await page.evaluate(() => ({
    docs: typeof buildEdlDoc === 'function' && typeof buildInstructionDoc === 'function' && typeof buildDmxDoc !== 'undefined' || typeof exportDmx === 'function',
    wf: typeof rcRun === 'function' && typeof exportBackupZip === 'function' && typeof buildPromptPackMd === 'function',
    scripts: [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src')),
  }));
  console.log({ splitScripts: split.scripts.length, splitOk: split.docs && split.wf && split.scripts.includes('js/docs.js') && split.scripts.includes('js/workflow.js') });

  // ============ ① モバイル: 横スクロールなし ============
  await page.setViewportSize({ width: 430, height: 900 });
  await page.waitForTimeout(500);
  const mobile = await page.evaluate(() => ({
    scrollW: document.body.scrollWidth,
    innerW: window.innerWidth,
    labelHidden: getComputedStyle(document.querySelector('#btnFlowPage span')).display === 'none',
  }));
  await page.screenshot({ path: 'v31-mobile.png' });
  console.log({ mobile, mobileOk: mobile.scrollW <= mobile.innerW + 2 && mobile.labelHidden });
  await page.setViewportSize({ width: 1500, height: 950 });
  await page.waitForTimeout(400);

  // ============ ② a11y: dialogロール / フォーカス移動 / トラップ ============
  const roles = await page.evaluate(() =>
    ['equipOverlay', 'dnaOverlay', 'wfOverlay'].every(id => {
      const el = document.getElementById(id);
      return el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true';
    }));
  await page.click('#btnDnaPage');
  await page.waitForTimeout(500);
  const focusIn = await page.evaluate(() => document.getElementById('dnaOverlay').contains(document.activeElement));
  // トラップ: 最後の要素からTab → 先頭へ戻る
  const wrap = await page.evaluate(() => {
    const el = document.getElementById('dnaOverlay');
    const f = [...el.querySelectorAll('button, [href], input, select, textarea')].filter(x => !x.disabled && x.offsetParent !== null);
    f[f.length - 1].focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return document.activeElement === f[0];
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const focusBack = await page.evaluate(() => document.activeElement && document.activeElement.id === 'btnDnaPage');
  console.log({ roles, focusIn, wrap, focusBack, a11yOk: roles && focusIn && wrap && focusBack });

  // トーストのライブリージョン
  const toastAria = await page.evaluate(() => {
    const t = document.getElementById('toast');
    return t.getAttribute('role') === 'status' && t.getAttribute('aria-live') === 'polite';
  });

  // ============ ② ツアーのキーボード操作 ============
  await page.evaluate(() => startTour());
  await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  const step2 = await page.evaluate(() => document.getElementById('tourStep').textContent);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(350);
  const step1 = await page.evaluate(() => document.getElementById('tourStep').textContent);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const tourClosed = await page.evaluate(() => document.getElementById('tourWrap').hidden);
  console.log({ toastAria, step2, step1, tourClosed,
    tourKeysOk: toastAria && step2.startsWith('2') && step1.startsWith('1') && tourClosed });

  console.log('ERRORS:', errors);
  await browser.close();
})();
