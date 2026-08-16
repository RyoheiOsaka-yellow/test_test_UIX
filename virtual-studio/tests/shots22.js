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

  // --- 1) テロップ: インスペクタ入力 → プレビュー/サムネに焼き込み
  await page.fill('#cCaption', '「ここから先は、ひとりで行く」');
  await page.dispatchEvent('#cCaption', 'input');
  await page.waitForTimeout(300);
  const cap = await page.evaluate(() => ({
    saved: state.cuts[0].caption.includes('ひとりで行く'),
    inPreview: document.querySelector('#previewWrap svg').innerHTML.includes('ひとりで行く'),
    inThumb: document.querySelector('#cutStrip .cut-thumb svg').innerHTML.includes('ひとりで行く'),
  }));
  console.log({ cap, capOk: cap.saved && cap.inPreview && cap.inThumb });
  await page.locator('#previewWrap').screenshot({ path: 'v25-caption.png' });

  // --- 2) 接地影: 透過被写体に楕円影 + ぼかし
  const gs = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#c9a184'; cx.beginPath(); cx.arc(200, 130, 70, 0, 7); cx.fill();
    cx.fillStyle = '#7a4a55'; cx.fillRect(110, 205, 180, 195);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'char.png', { type: 'image/png' })]);
    state.cuts[0].refImgId = state.story.refs[0].id;
    renderAll();
    const svg = renderPreviewSVG(state.cuts[0], 'gs');
    return { ellipse: svg.includes('<ellipse') && svg.includes('gsb'), blur: svg.includes('feGaussianBlur') };
  });
  console.log({ gs, gsOk: gs.ellipse && gs.blur });
  await page.waitForTimeout(300);
  await page.locator('#previewWrap').screenshot({ path: 'v25-groundshadow.png' });

  // --- 3) ラフカットのテロップ焼き込み (canvasピクセル検査)
  await page.click('#btnFlowPage');
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    state.cuts[0].srcInSec = 0; state.cuts[0].duration = 2;
    const mk = () => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      const iv = setInterval(() => { cx.fillStyle = '#357'; cx.fillRect(0, 0, 320, 180); }, 33);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(chunks, 'c.webm', { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 2200);
    });
    await wfAttachClip(state.cuts[0], await mk());
    await new Promise(r => setTimeout(r, 300));
  });
  await page.click('#btnRcPlay');
  await page.waitForTimeout(1200);
  const burn = await page.evaluate(() => {
    const cv = document.getElementById('rcCanvas');
    const d = cv.getContext('2d').getImageData(0, cv.height - 90, cv.width, 40).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) white++; }
    return { whitePixels: white };
  });
  await page.waitForTimeout(2500);
  console.log({ burn, burnOk: burn.whitePixels > 200 });

  // --- 4) 画像一括書き出し: ZIP (シート+各カット)
  const dlp = page.waitForEvent('download', { timeout: 60000 });
  await page.click('#btnWfPngs');
  const dl = await dlp;
  const zipPath = await dl.path();
  fs.copyFileSync(zipPath, 'v25-storyboard.zip');
  const head = fs.readFileSync(zipPath).slice(0, 4);
  const msg = await page.evaluate(() => document.getElementById('wfPngMsg').textContent);
  console.log({ zipMagic: head.toString('latin1'), size: fs.statSync(zipPath).size, msg });

  console.log('ERRORS:', errors);
  await browser.close();
})();
