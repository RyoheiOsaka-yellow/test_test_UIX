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
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(r => { const rq = indexedDB.deleteDatabase('vsMedia'); rq.onsuccess = r; rq.onerror = r; rq.onblocked = r; });
  });
  await page.reload(); await page.waitForTimeout(500);

  // ============ ③ ショートカット ============
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const nav1 = await page.evaluate(() => state.activeCut);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  const nav0 = await page.evaluate(() => state.activeCut);
  await page.keyboard.press('2');
  await page.waitForTimeout(200);
  const size = await page.evaluate(() => state.cuts[0].camera.shotSize);
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  const helpOpen = await page.evaluate(() => !document.getElementById('kbdHelp').hidden);
  await page.screenshot({ path: 'v28-kbd-help.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const helpClosed = await page.evaluate(() => document.getElementById('kbdHelp').hidden);
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  const playOn = await page.evaluate(() => !!state.previewPlay);
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  const playOff = await page.evaluate(() => !state.previewPlay);
  console.log({ nav1, nav0, size, helpOpen, helpClosed, playOn, playOff,
    kbdOk: nav1 === 1 && nav0 === 0 && size === 'CU' && helpOpen && helpClosed && playOn && playOff });

  // ============ 準備: 2クリップ + ナレーション ============
  await page.click('#btnFlowPage');
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    state.cuts.forEach(c => { c.srcInSec = 0; c.duration = 2; });
    renderAll(); renderWorkflow();
    const mkClip = color => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      const iv = setInterval(() => { cx.fillStyle = color; cx.fillRect(0, 0, 320, 180); }, 33);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(chunks, 'c.webm', { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 2200);
    });
    await wfAttachClip(state.cuts[0], await mkClip('#a44'));
    await wfAttachClip(state.cuts[1], await mkClip('#44a'));
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator(); osc.frequency.value = 250;
    osc.connect(dest); osc.start();
    const rec2 = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
    const chunks2 = []; rec2.ondataavailable = e => chunks2.push(e.data);
    const narFile = await new Promise(resolve => {
      rec2.onstop = () => resolve(new File(chunks2, 'nar.webm', { type: 'audio/webm' }));
      rec2.start(); setTimeout(() => { rec2.stop(); osc.stop(); }, 2500);
    });
    await idbPutClip({ cutId: '__nar', name: narFile.name, type: narFile.type, size: narFile.size, blob: narFile, addedAt: 1 });
    await rcRefreshIndex();
    await new Promise(r => setTimeout(r, 800));
  });

  // ============ ② ナレーション波形 ============
  const wave = await page.evaluate(() => ({
    visible: !document.getElementById('rcNarWave').hidden,
    peaks: roughCut.narPeaks && roughCut.narPeaks.peaks ? roughCut.narPeaks.peaks.length : 0,
    dur: roughCut.narPeaks ? +(roughCut.narPeaks.dur || 0).toFixed(1) : 0,
  }));
  console.log({ wave, waveOk: wave.visible && wave.peaks === 240 && wave.dur > 1.5 });

  // 開始カットをC2へ → 波形が右に寄る (x0 > 0 で描かれる = 再描画エラーなし確認)
  await page.selectOption('#rcNarStart', { index: 1 });
  await page.waitForTimeout(400);

  // ============ ① ホバーサムネイル ============
  await page.evaluate(() => document.querySelector('.rc-player').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(300);
  const seekBox = await page.locator('#rcSeek').boundingBox();
  await page.mouse.move(seekBox.x + seekBox.width * 0.75, seekBox.y + seekBox.height / 2);
  await page.waitForTimeout(300);
  const tip = await page.evaluate(() => ({
    visible: !document.getElementById('rcSeekTip').hidden,
    hasSvg: !!document.querySelector('#rcSeekTip svg'),
    cap: document.querySelector('#rcSeekTip .tip-cap') ? document.querySelector('#rcSeekTip .tip-cap').textContent : '',
  }));
  await page.locator('.rc-player').screenshot({ path: 'v28-seek-tip.png' });
  await page.mouse.move(seekBox.x, seekBox.y - 80);
  await page.waitForTimeout(300);
  const tipGone = await page.evaluate(() => document.getElementById('rcSeekTip').hidden);
  console.log({ tip, tipGone, tipOk: tip.visible && tip.hasSvg && tip.cap.includes('C2') && tipGone });

  // ============ ③b Space (ワークフロー内) = ラフカット再生/停止 ============
  await page.keyboard.press(' ');
  await page.waitForTimeout(800);
  const rcPlaying = await page.evaluate(() => roughCut.playing);
  await page.keyboard.press(' ');
  await page.waitForTimeout(600);
  const rcStopped = await page.evaluate(() => !roughCut.playing && document.getElementById('rcMsg').textContent.includes('停止'));
  console.log({ rcPlaying, rcStopped, spaceWfOk: rcPlaying && rcStopped });

  console.log('ERRORS:', errors);
  await browser.close();
})();
