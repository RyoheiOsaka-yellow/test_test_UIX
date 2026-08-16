// v4.2: 台本・コンテページ (演出/動き/セリフ) と スタジオ (カメラ) の分業・連動
// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① 台本ページが開き、全カットが並ぶ ============
  await page.click('#btnScriptPage');
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => ({
    shown: !document.getElementById('scriptOverlay').hidden,
    cuts: document.querySelectorAll('.sc-cut').length,
    frames: document.querySelectorAll('.sc-frame svg').length,
    total: document.getElementById('scriptTotal').textContent,
    active: !!document.querySelector('.sc-cut.active'),
  }));
  console.log({ ...opened, openOk: opened.shown && opened.cuts === 3 && opened.frames === 3 && /計\d+秒/.test(opened.total) && opened.active });

  // ============ ② 動くのは人だけではない — 登場要素に車両を足す ============
  const actors = await page.evaluate(() => {
    document.querySelector('[data-scaadd="0"]').click();
    const c = state.cuts[0];
    const a2 = c.perf.actors[1];
    const sel = document.querySelector(`[data-scatype="${a2.id}"]`);
    sel.value = 'vehicle';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const nameInput = document.querySelector(`[data-scaname="${a2.id}"]`);
    nameInput.value = '赤いセダン';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      count: c.perf.actors.length,
      type: c.perf.actors[1].type,
      label: actorLabel(c, c.perf.actors[1].id),
      en: actorEn(c, c.perf.actors[1].id),
    };
  });
  console.log({ ...actors, actorOk: actors.count === 2 && actors.type === 'vehicle' && actors.label === '車両赤いセダン' && actors.en.includes('vehicle') });

  // ============ ③ ビートを書くと台本→プロンプトに反映 (誰が/何が) ============
  const beats = await page.evaluate(() => {
    const c = state.cuts[0];
    c.duration = 9;
    document.querySelector('[data-scbadd="0"]').click();
    document.querySelector('[data-scbadd="0"]').click();
    const b = c.perf.beats;
    b[0].who = c.perf.actors[1].id; b[0].do = '右から進入して停まる'; b[0].sec = 4;
    b[1].who = c.perf.actors[0].id; b[1].do = '降りて振り返る'; b[1].sec = 5;
    renderScriptPage();
    const p = generatePrompt(c, 'seedance');
    return {
      n: b.length,
      inPrompt: p.includes('BEATS:') && p.includes('右から進入して停まる') && /a vehicle \(赤いセダン\)/.test(p),
      cast: /cast: .*a vehicle/.test(p),
      rows: document.querySelectorAll('.sc-cut[data-sccut="0"] .sc-beat').length,
    };
  });
  console.log({ ...beats, beatOk: beats.n === 2 && beats.inPrompt && beats.cast && beats.rows === 2 });

  // ============ ④ 尺との連動 (ズレ表示 → 尺に合わせる) ============
  const fit = await page.evaluate(() => {
    const c = state.cuts[0];
    c.duration = 6;                       // 合計9s に対して尺6s → ズレ
    renderScriptPage();
    const gapShown = !!document.querySelector('.sc-cut[data-sccut="0"] .sc-gap');
    document.querySelector('[data-scfit="0"]').click();
    const after = perfBeatTotal(c);
    const gapGone = !document.querySelector('.sc-cut[data-sccut="0"] .sc-gap');
    return { gapShown, after, gapGone };
  });
  console.log({ ...fit, fitOk: fit.gapShown && Math.abs(fit.after - 6) < 0.6 && fit.gapGone });

  // ============ ⑤ カメラはスタジオの領分 — 台本側は読み取り専用で連動表示 ============
  const camera = await page.evaluate(() => {
    const c = state.cuts[0];
    const techBefore = document.querySelector('.sc-cut[data-sccut="0"] .sc-tech').textContent.trim();
    // スタジオ側でカメラを変更 → 台本の表示が追従する
    c.camera.move = 'track'; c.camera.focalMm = 35;
    renderScriptPage();
    const techAfter = document.querySelector('.sc-cut[data-sccut="0"] .sc-tech').textContent.trim();
    // 台本側にカメラを編集する入力は無い (分業)
    const noCamInput = !document.querySelector('.sc-cut [data-sccamera], .sc-cut [data-scfocal]');
    // 矛盾はここでも警告される
    c.camera.move = 'fix'; c.perf.camLink = 'follow';
    renderScriptPage();
    const lintShown = [...document.querySelectorAll('.sc-cut[data-sccut="0"] .sc-lint li')]
      .some(li => li.textContent.includes('フィックス'));
    c.camera.move = 'track';
    return { changed: techBefore !== techAfter, has35: techAfter.includes('35mm'), noCamInput, lintShown };
  });
  console.log({ ...camera, camOk: camera.changed && camera.has35 && camera.noCamInput && camera.lintShown });

  // ============ ⑥ セリフと選択の連動 ============
  const link = await page.evaluate(() => {
    const cap = document.querySelector('[data-sccap="1"]');
    cap.value = '行こう。';
    cap.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-scselect="2"]').click();
    return {
      caption: state.cuts[1].caption,
      active: state.activeCut,
      stripCap: document.querySelector('#cutStrip .cut-thumb[data-idx="1"]') !== null,
    };
  });
  console.log({ ...link, linkOk: link.caption === '行こう。' && link.active === 2 });

  // ============ ⑦ 絵コンテ書き出しに動きとセリフが載る ============
  const board = await page.evaluate(() => {
    const doc = buildStoryboardDoc();
    return {
      beats: doc.includes('右から進入して停まる') && doc.includes('panel-beats'),
      who: doc.includes('車両赤いセダン'),
      cap: doc.includes('「行こう。」'),
    };
  });
  console.log({ ...board, boardOk: board.beats && board.who && board.cap });

  await page.evaluate(() => document.querySelector('.sc-cut').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.locator('.sc-cut').first().screenshot({ path: 'v42-script.png' });
  console.log('ERRORS:', errors);
  await browser.close();
})();
