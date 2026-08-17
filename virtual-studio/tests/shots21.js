// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch(process.env.VS_CHROME ? { executablePath: process.env.VS_CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(r => { const rq = indexedDB.deleteDatabase('vsMedia'); rq.onsuccess = r; rq.onerror = r; rq.onblocked = r; });
  });
  await page.reload(); await page.waitForTimeout(500);

  // ============ ① トランジション付きラフカット ============
  await page.click('#btnFlowPage');
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    state.cuts.forEach((c, i) => { c.srcInSec = 0; c.duration = 2; });
    state.cuts[0].transition = 'dissolve';
    state.cuts[1].transition = 'fadeout';
    renderAll(); renderWorkflow();
    const mkClip = (color, name) => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      let t = 0;
      const iv = setInterval(() => { cx.fillStyle = color; cx.fillRect(0, 0, 320, 180); cx.fillStyle = '#fff'; cx.fillRect((t * 9) % 320, 80, 26, 18); t++; }, 33);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(chunks, name, { type: 'video/webm' })); };
      rec.start();
      setTimeout(() => rec.stop(), 2300);
    });
    await wfAttachClip(state.cuts[0], await mkClip('#a33', 'c1.webm'));
    await wfAttachClip(state.cuts[1], await mkClip('#3a3', 'c2.webm'));
    await wfAttachClip(state.cuts[2], await mkClip('#33a', 'c3.webm'));
    await new Promise(r => setTimeout(r, 400));
  });

  // 再生 (2s×3 + fades ≈ 7s)
  await page.click('#btnRcPlay');
  await page.waitForTimeout(9000);
  const play = await page.evaluate(() => ({ msg: document.getElementById('rcMsg').textContent, stats: roughCut.stats }));
  console.log({ play, playOk: play.msg.includes('最後まで再生') && play.stats.cross === 1 && play.stats.veil === 1 });

  // 書き出し (ダウンロードはフォールバックアンカー経由)
  const dlp = page.waitForEvent('download', { timeout: 40000 });
  await page.click('#btnRcExport');
  const dl = await dlp;
  const size = fs.statSync(await dl.path()).size;
  await page.waitForTimeout(500);
  const expMsg = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  console.log({ size, exportOk: size > 10000 && expMsg.includes('書き出しました') });

  // ============ ② 背景透過PNGの被写体合成 ============
  const alpha = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400;
    const cx = cv.getContext('2d');
    // 透過背景に人物風シルエットのみ
    cx.fillStyle = '#c9a184'; cx.beginPath(); cx.arc(200, 130, 70, 0, 7); cx.fill();
    cx.fillStyle = '#7a4a55'; cx.fillRect(110, 205, 180, 195);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'char-alpha.png', { type: 'image/png' })]);
    const ref = state.story.refs[state.story.refs.length - 1];
    state.cuts[0].refImgId = ref.id;
    state.cuts[0].bgStyle = 'sunset';
    renderAll();
    const svg = renderPreviewSVG(state.cuts[0], 'al');
    return {
      hasAlpha: ref.hasAlpha,
      isPng: refUrl(ref).startsWith('data:image/png'),
      maskAlpha: svg.includes('mask-type:alpha'),
      bgScene: svg.includes('imshad') && svg.includes(`fill="url(#albg)"`),
      sunsetCircle: svg.includes('#fff0c0'),
    };
  });
  console.log({ alpha, alphaOk: alpha.hasAlpha && alpha.isPng && alpha.maskAlpha && alpha.sunsetCircle });

  // リムライト → feDropShadow / シルエット→被写体暗転
  const rim = await page.evaluate(() => {
    applyPreset('backlight-silhouette');
    const sil = renderPreviewSVG(state.cuts[0], 'al2');
    applyPreset('rembrandt');
    const rem = renderPreviewSVG(state.cuts[0], 'al2');
    return { silGlow: sil.includes('feDropShadow'), differ: sil !== rem };
  });
  console.log({ rim, rimOk: rim.silGlow && rim.differ });

  // スクリーンショット: 透過被写体 x 夕景 x シルエット
  await page.click('#btnWfBack');
  await page.waitForTimeout(300);
  await page.evaluate(() => { applyPreset('backlight-silhouette'); state.cuts[0].bgStyle = 'sunset'; refresh(); });
  await page.waitForTimeout(400);
  await page.locator('#previewWrap').screenshot({ path: 'v24-alpha-sil.png' });
  await page.evaluate(() => { applyPreset('rembrandt'); state.cuts[0].bgStyle = 'night'; refresh(); });
  await page.waitForTimeout(400);
  await page.locator('#previewWrap').screenshot({ path: 'v24-alpha-rembrandt.png' });

  // ============ ③ saveFileAs 経由の既存ダウンロード ============
  const dlp2 = page.waitForEvent('download', { timeout: 15000 });
  await page.click('#btnExportCanonical');
  const dl2 = await dlp2;
  console.log({ canonicalDl: dl2.suggestedFilename(), canonOk: dl2.suggestedFilename().includes('canonical') });

  console.log('ERRORS:', errors);
  await browser.close();
})();
