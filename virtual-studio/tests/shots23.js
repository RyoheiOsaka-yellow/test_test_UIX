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

  // 下ごしらえ: ストーリー・テロップ・動画クリップ・BGM
  await page.click('#btnFlowPage');
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    state.story.text = '夜の街を歩くヒロイン。';
    state.cuts[0].caption = 'テスト字幕';
    state.cuts[0].srcInSec = 0; state.cuts[0].duration = 2;
    // 動画クリップ
    const mkClip = () => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const cx = cv.getContext('2d');
      const iv = setInterval(() => { cx.fillStyle = '#654'; cx.fillRect(0, 0, 320, 180); }, 33);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(chunks, 'gen1.webm', { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 2200);
    });
    await wfAttachClip(state.cuts[0], await mkClip());
    // BGM (440Hzトーン 3s)
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator(); osc.frequency.value = 440;
    const g = ac.createGain(); g.gain.value = 0.2;
    osc.connect(g); g.connect(dest); osc.start();
    const rec2 = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
    const chunks2 = []; rec2.ondataavailable = e => chunks2.push(e.data);
    const bgmFile = await new Promise(resolve => {
      rec2.onstop = () => resolve(new File(chunks2, 'bgm-tone.webm', { type: 'audio/webm' }));
      rec2.start(); setTimeout(() => { rec2.stop(); osc.stop(); }, 3000);
    });
    await idbPutClip({ cutId: '__bgm', name: bgmFile.name, type: bgmFile.type, size: bgmFile.size, blob: bgmFile, addedAt: 1 });
    await rcRefreshIndex();
    await new Promise(r => setTimeout(r, 300));
  });
  const audioUi = await page.evaluate(() => ({
    bgmName: document.getElementById('rcBgmName').textContent,
    delShown: !document.getElementById('rcBgmDel').hidden,
  }));
  console.log({ audioUi, audioUiOk: audioUi.bgmName.includes('bgm-tone') && audioUi.delShown });

  // --- 1) BGM付きラフカット再生: 再生中にBGMが鳴り、ゲイン0.4
  await page.click('#btnRcPlay');
  await page.waitForTimeout(1000);
  const during = await page.evaluate(() => ({
    bgmPlaying: !document.getElementById('rcBgmEl').paused,
    gain: roughCut.gains.rcBgmEl ? +roughCut.gains.rcBgmEl.gain.value.toFixed(2) : null,
  }));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({
    msg: document.getElementById('rcMsg').textContent,
    bgmStopped: document.getElementById('rcBgmEl').paused,
  }));
  console.log({ during, after, audioOk: during.bgmPlaying && during.gain === 0.4 && after.msg.includes('最後まで') && after.bgmStopped });

  // --- 2) プロンプト一式MD
  const dlpMd = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#btnWfMd');
  const dlMd = await dlpMd;
  const md = fs.readFileSync(await dlMd.path(), 'utf8');
  console.log({
    mdName: dlMd.suggestedFilename(),
    mdOk: md.includes('生成プロンプト一式') && md.includes('FORMAT:') && md.includes('連結シーケンス') && md.includes('夜の街を歩くヒロイン'),
  });

  // --- 3) バックアップZIP → 全消去 → 復元
  await page.click('#btnWfBack');
  await page.click('#btnProjPage');
  await page.waitForTimeout(300);
  const dlpBk = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#btnProjBackup');
  const dlBk = await dlpBk;
  const bkPath = await dlBk.path();
  const bkBuf = fs.readFileSync(bkPath);
  console.log({ bkSize: bkBuf.length, bkMsg: await page.evaluate(() => document.getElementById('projSavedMsg').textContent) });

  // 全消去してリロード
  await page.evaluate(async () => {
    localStorage.clear();
    indexedDB.deleteDatabase('vsMedia');
  });
  await page.reload(); await page.waitForTimeout(600);
  const wiped = await page.evaluate(() => ({ caption: state.cuts[0].caption, story: state.story.text }));

  // 復元
  await page.click('#btnProjPage');
  await page.waitForTimeout(300);
  await page.setInputFiles('#projRestoreInput', { name: 'backup.zip', mimeType: 'application/zip', buffer: bkBuf });
  await page.waitForTimeout(1500);
  const restored = await page.evaluate(async () => {
    const clips = await idbAllClips();
    return {
      msg: document.getElementById('projSavedMsg').textContent,
      caption: state.cuts[0].caption,
      story: state.story.text,
      clipIds: clips.map(c => c.cutId).sort(),
      hasClip: clips.some(c => c.cutId === state.cuts[0].id),
      hasBgm: clips.some(c => c.cutId === '__bgm'),
    };
  });
  console.log({ wiped, restored,
    restoreOk: restored.caption === 'テスト字幕' && restored.story.includes('ヒロイン') && restored.hasClip && restored.hasBgm });

  console.log('ERRORS:', errors);
  await browser.close();
})();
