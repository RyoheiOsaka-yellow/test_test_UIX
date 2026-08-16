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

  // --- 疑似「ChatGPT生成画像」(人物ポートレート風) を作って取り込み → C1に割当
  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#7a8699'); g.addColorStop(1, '#3a4150');
    cx.fillStyle = g; cx.fillRect(0, 0, 640, 360);
    cx.fillStyle = '#c9a184'; cx.beginPath(); cx.arc(320, 150, 60, 0, 7); cx.fill(); // 顔
    cx.fillStyle = '#5a4632'; cx.beginPath(); cx.arc(320, 128, 62, Math.PI, 0); cx.fill(); // 髪
    cx.fillStyle = '#8a4a52'; cx.fillRect(240, 210, 160, 150); // 服
    cx.fillStyle = '#2a2e36'; cx.beginPath(); cx.arc(298, 150, 6, 0, 7); cx.arc(342, 150, 6, 0, 7); cx.fill();
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'chatgpt-heroine.png', { type: 'image/png' })]);
    state.cuts[0].refImgId = state.story.refs[0].id;
    renderAll();
  });
  await page.waitForTimeout(500);

  // --- 1) カット割りサムネ/想定カットに画像が反映される
  const base = await page.evaluate(() => ({
    thumbHasImage: document.querySelector('#cutStrip .cut-thumb svg image') != null,
    previewHasImage: document.querySelector('#previewWrap svg image') != null,
    refBadge: document.querySelector('#previewWrap svg') ? document.querySelector('#previewWrap svg').innerHTML.includes('REF:') : false,
    c2NoImage: renderPreviewSVG(state.cuts[1], 'x2').includes('<image') === false,
  }));
  console.log({ base, baseOk: base.thumbHasImage && base.previewHasImage && base.c2NoImage });

  // --- 2) 技法切替で効果が変わる (レンブラント vs 逆光シルエット vs バタフライ)
  const fx = await page.evaluate(() => {
    const svgOf = pid => { state.cuts[0].presetId = null; applyPreset(pid); return renderPreviewSVG(state.cuts[0], 'fxtest'); };
    const rembrandt = svgOf('rembrandt');
    const keptAfterPreset = state.cuts[0].refImgId != null;
    const sil = svgOf('backlight-silhouette');
    const butterfly = svgOf('butterfly');
    return {
      keptAfterPreset,
      allImage: [rembrandt, sil, butterfly].every(s => s.includes('<image')),
      differ: rembrandt !== sil && sil !== butterfly && rembrandt !== butterfly,
      silDark: sil.includes('mix-blend-mode:multiply') && sil.includes('imglow'),
    };
  });
  console.log({ fx, fxOk: fx.keptAfterPreset && fx.allImage && fx.differ && fx.silDark });

  // --- 3) スクリーンショット: 3技法での見え方
  await page.evaluate(() => { applyPreset('rembrandt'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'v22-ref-rembrandt.png', clip: (await (async () => null)()) || undefined });
  const pv = await page.locator('#previewWrap').boundingBox();
  await page.screenshot({ path: 'v22-ref-rembrandt.png', clip: pv });
  await page.evaluate(() => { applyPreset('backlight-silhouette'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'v22-ref-silhouette.png', clip: await page.locator('#previewWrap').boundingBox() });
  await page.evaluate(() => { applyPreset('butterfly'); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'v22-ref-butterfly.png', clip: await page.locator('#previewWrap').boundingBox() });
  await page.screenshot({ path: 'v22-studio-ref.png' });

  // --- 4) インスペクタの参照画像セレクトで解除できる
  const hasSel = await page.evaluate(() => !!document.getElementById('cRefImg'));
  await page.selectOption('#cRefImg', '');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => state.cuts[0].refImgId === null && !document.querySelector('#previewWrap svg image'));
  console.log({ hasSel, cleared });

  // --- 5) 複数カットに同じ画像を割当 (ワークフロー側)
  await page.click('#btnFlowPage');
  await page.waitForTimeout(400);
  await page.selectOption('[data-refassign]', { index: 1 }); // C1
  await page.waitForTimeout(200);
  await page.selectOption('[data-refassign]', { index: 2 }); // C2
  await page.waitForTimeout(300);
  const multi = await page.evaluate(() => ({
    c1: state.cuts[0].refImgId != null, c2: state.cuts[1].refImgId != null,
    usedChip: document.querySelector('.wf-ref-used') && document.querySelector('.wf-ref-used').textContent,
  }));
  console.log({ multi, multiOk: multi.c1 && multi.c2 && /C1 C2/.test(multi.usedChip || '') });

  console.log('ERRORS:', errors);
  await browser.close();
})();
