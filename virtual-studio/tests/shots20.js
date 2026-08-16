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

  // ポートレート風画像を取り込み → C1に割当
  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    const cx = cv.getContext('2d');
    const g = cx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#8a94a8'); g.addColorStop(1, '#39404e');
    cx.fillStyle = g; cx.fillRect(0, 0, 640, 360);
    cx.fillStyle = '#c9a184'; cx.beginPath(); cx.arc(320, 140, 55, 0, 7); cx.fill();
    cx.fillStyle = '#4a3a2c'; cx.beginPath(); cx.arc(320, 120, 57, Math.PI, 0); cx.fill();
    cx.fillStyle = '#7a4a55'; cx.fillRect(245, 196, 150, 164);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'heroine.png', { type: 'image/png' })]);
    state.cuts[0].refImgId = state.story.refs[0].id;
    renderAll();
  });
  await page.waitForTimeout(400);

  // --- 1) カットサイズ連動ズーム: CU は LS よりスケールが大きい
  const zooms = await page.evaluate(() => {
    const zOf = ss => {
      state.cuts[0].camera.shotSize = ss;
      const svg = renderPreviewSVG(state.cuts[0], 'zt');
      const m = svg.match(/scale\(([\d.]+)\)/);
      return m ? +m[1] : null;
    };
    return { ls: zOf('LS'), bs: zOf('BS'), cu: zOf('CU'), ecu: zOf('ECU') };
  });
  console.log({ zooms, zoomOk: zooms.ls < zooms.bs && zooms.bs < zooms.cu && zooms.cu < zooms.ecu });

  // --- 2) ダッチ/ハイアングルが構図に反映
  const ang = await page.evaluate(() => {
    state.cuts[0].camera.shotSize = 'BS';
    state.cuts[0].camera.angle = 'dutch';
    const dutchSvg = renderPreviewSVG(state.cuts[0], 'at');
    state.cuts[0].camera.angle = 'eye';
    const eyeSvg = renderPreviewSVG(state.cuts[0], 'at');
    return { dutchRot: dutchSvg.includes('rotate(-7)'), differ: dutchSvg !== eyeSvg };
  });
  console.log({ ang, angOk: ang.dutchRot && ang.differ });

  // --- 3) 開放絞りでDOFボケ、絞るとなし
  const dof = await page.evaluate(() => {
    state.cuts[0].camera.apertureF = 1.4;
    const open = renderPreviewSVG(state.cuts[0], 'dt');
    state.cuts[0].camera.apertureF = 5.6;
    const closed = renderPreviewSVG(state.cuts[0], 'dt');
    state.cuts[0].camera.apertureF = 1.4;
    return { openBlur: open.includes('imblf') && open.includes('dofm'), closedNoBlur: !closed.includes('imblf') };
  });
  console.log({ dof, dofOk: dof.openBlur && dof.closedNoBlur });

  // --- 4) グレイン (フィルム系ルックのみ) とビネット
  const gv = await page.evaluate(() => {
    state.cuts[0].look = 'filmwarm';
    const film = renderPreviewSVG(state.cuts[0], 'gt');
    state.cuts[0].look = 'natural';
    const nat = renderPreviewSVG(state.cuts[0], 'gt');
    return { grainOnFilm: film.includes('feTurbulence'), noGrainNatural: !nat.includes('feTurbulence') };
  });
  console.log({ gv, gvOk: gv.grainOnFilm && gv.noGrainNatural });

  // --- 5) 位置スライダー: 動かすと構図が変わる
  await page.evaluate(() => { renderAll(); });
  await page.waitForTimeout(300);
  const sliders = await page.evaluate(() => ({
    x: !!document.getElementById('cRefOffX'), y: !!document.getElementById('cRefOffY'),
  }));
  const beforeTf = await page.evaluate(() => renderPreviewSVG(state.cuts[0], 'ot'));
  await page.locator('#cRefOffX').fill('20');
  await page.dispatchEvent('#cRefOffX', 'input');
  await page.waitForTimeout(300);
  const offApplied = await page.evaluate(() => state.cuts[0].refOffX === 20);
  const afterTf = await page.evaluate(() => renderPreviewSVG(state.cuts[0], 'ot'));
  console.log({ sliders, offApplied, tfChanged: beforeTf !== afterTf });

  // --- 6) スクリーンショット: CU (f1.4 フィルム) vs LS
  await page.evaluate(() => {
    state.cuts[0].refOffX = 0; state.cuts[0].camera.shotSize = 'CU'; state.cuts[0].look = 'filmwarm';
    refresh(); renderInspector();
  });
  await page.waitForTimeout(400);
  await page.locator('#previewWrap').screenshot({ path: 'v23-cu-film.png' });
  await page.evaluate(() => { state.cuts[0].camera.shotSize = 'LS'; state.cuts[0].look = 'natural'; state.cuts[0].camera.apertureF = 5.6; refresh(); });
  await page.waitForTimeout(400);
  await page.locator('#previewWrap').screenshot({ path: 'v23-ls.png' });

  console.log('ERRORS:', errors);
  await browser.close();
})();
