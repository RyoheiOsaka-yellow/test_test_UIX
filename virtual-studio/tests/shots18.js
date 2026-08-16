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

  // --- 1) 2カットにして短い生成動画 (canvas録画webm) を添付
  await page.click('#btnFlowPage');
  await page.waitForTimeout(400);
  const attach = await page.evaluate(async () => {
    state.cuts = state.cuts.slice(0, 2);
    state.cuts.forEach(c => { c.srcInSec = 0; c.duration = 1; });
    renderAll(); renderWorkflow();
    const mkClip = (color, name) => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      let t = 0;
      const iv = setInterval(() => { cx.fillStyle = color; cx.fillRect(0, 0, 320, 180); cx.fillStyle = '#fff'; cx.fillRect((t * 8) % 320, 80, 30, 20); t++; }, 33);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(chunks, name, { type: 'video/webm' })); };
      rec.start();
      setTimeout(() => rec.stop(), 1300);
    });
    const f1 = await mkClip('#a33', 'gen-cut1.webm');
    const f2 = await mkClip('#33a', 'gen-cut2.webm');
    await wfAttachClip(state.cuts[0], f1);
    await wfAttachClip(state.cuts[1], f2);
    await new Promise(r => setTimeout(r, 400));
    return { rows: document.querySelectorAll('.rc-row').length, clips: document.querySelectorAll('.rc-clip').length,
      statuses: state.cuts.map(c => c.wfStatus), sizes: [state.cuts[0].id, state.cuts[1].id].map(id => roughCut.index[id] && roughCut.index[id].size) };
  });
  console.log({ attach, attachOk: attach.clips === 2 && attach.statuses.every(s => s === 'generated') && attach.sizes.every(s => s > 0) });

  // --- 2) 永続化: リロード後もIndexedDBから復元される
  await page.reload(); await page.waitForTimeout(600);
  await page.click('#btnFlowPage');
  await page.waitForTimeout(600);
  const persisted = await page.evaluate(() => document.querySelectorAll('.rc-clip').length);
  console.log({ persisted, persistOk: persisted === 2 });
  await page.screenshot({ path: 'v21-roughcut.png' });

  // --- 3) 連結再生 (各1秒×2カット)
  await page.click('#btnRcPlay');
  await page.waitForTimeout(3500);
  const playMsg = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  console.log({ playMsg, playOk: playMsg.includes('最後まで再生') });

  // --- 4) WebM書き出し (canvas録画+ダウンロード)
  const dlPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#btnRcExport');
  const dl = await dlPromise;
  const dlPath = await dl.path();
  const dlSize = dlPath ? fs.statSync(dlPath).size : 0;
  await page.waitForTimeout(500);
  const expMsg = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  // 注: headless shellは日本語ファイル名を'download'に落とす (実ブラウザでは「<プロジェクト名>-roughcut.webm」)
  console.log({ file: dl.suggestedFilename(), dlSize, expMsg, exportOk: dlSize > 10000 && expMsg.includes('書き出しました') });
  await page.screenshot({ path: 'v21-roughcut-export.png' });

  console.log('ERRORS:', errors);
  await browser.close();
})();
