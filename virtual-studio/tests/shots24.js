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

  // ============ ③ プリセット統計とお気に入り ============
  await page.evaluate(() => { applyPreset('rembrandt'); applyPreset('loop'); applyPreset('rembrandt'); });
  await page.waitForTimeout(400);
  const stats1 = await page.evaluate(() => {
    const st = presetStats();
    const titles = [...document.querySelectorAll('.preset-group-title')].map(x => x.textContent);
    const pinnedFirst = document.querySelector('.preset-group-title');
    const pinnedCards = [];
    let el = pinnedFirst && pinnedFirst.nextElementSibling;
    while (el && el.classList.contains('preset-card')) { pinnedCards.push(el.dataset.preset); el = el.nextElementSibling; }
    return { rembrandtUsed: st.rembrandt.used, hasPinned: titles[0].includes('よく使う'), pinnedCards, usedBadge: document.body.innerHTML.includes('2回使用') };
  });
  console.log({ stats1, statsOk: stats1.rembrandtUsed === 2 && stats1.hasPinned && stats1.pinnedCards.includes('rembrandt') });

  // お気に入り: three-point の☆をクリック → ピン留めに出る + リロード後も残る
  await page.locator('[data-fav="three-point"]').first().click();
  await page.waitForTimeout(300);
  const fav1 = await page.evaluate(() => ({
    fav: presetStats()['three-point'].fav,
    starOn: document.querySelector('[data-fav="three-point"]').classList.contains('on'),
  }));
  await page.reload(); await page.waitForTimeout(600);
  const fav2 = await page.evaluate(() => {
    const first = document.querySelector('.preset-group-title');
    const cards = [];
    let el = first && first.nextElementSibling;
    while (el && el.classList.contains('preset-card')) { cards.push(el.dataset.preset); el = el.nextElementSibling; }
    return { pinnedAfterReload: cards };
  });
  console.log({ fav1, fav2, favOk: fav1.fav && fav1.starOn && fav2.pinnedAfterReload.includes('three-point') });
  await page.locator('#libraryPanel').screenshot({ path: 'v27-presets.png' });

  // ============ 準備: 3クリップ + ナレーション ============
  await page.click('#btnFlowPage');
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    state.cuts.forEach(c => { c.srcInSec = 0; c.duration = 2; c.transition = 'cut'; });
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
    await wfAttachClip(state.cuts[0], await mkClip('#a33'));
    await wfAttachClip(state.cuts[1], await mkClip('#3a3'));
    await wfAttachClip(state.cuts[2], await mkClip('#33a'));
    // ナレーション音声 (5s)
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator(); osc.frequency.value = 300;
    osc.connect(dest); osc.start();
    const rec2 = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
    const chunks2 = []; rec2.ondataavailable = e => chunks2.push(e.data);
    const narFile = await new Promise(resolve => {
      rec2.onstop = () => resolve(new File(chunks2, 'narration.webm', { type: 'audio/webm' }));
      rec2.start(); setTimeout(() => { rec2.stop(); osc.stop(); }, 5000);
    });
    await idbPutClip({ cutId: '__nar', name: narFile.name, type: narFile.type, size: narFile.size, blob: narFile, addedAt: 1 });
    await rcMigrateLegacyAudio(); // v3.2: 旧グローバルキーは現プロジェクトへ紐付けてから使う
    await rcRefreshIndex();
    await new Promise(r => setTimeout(r, 300));
  });

  // ============ ① ナレーション開始カット = C2 ============
  const narSel = await page.evaluate(() => ({
    visible: !document.getElementById('rcNarStart').hidden,
    options: document.getElementById('rcNarStart').options.length,
  }));
  await page.selectOption('#rcNarStart', { index: 1 }); // C2
  await page.waitForTimeout(200);
  const narSet = await page.evaluate(() => state.story.narStartCutId === state.cuts[1].id);
  await page.click('#btnRcPlay');
  await page.waitForTimeout(1000); // C1再生中
  const atC1 = await page.evaluate(() => ({ narPaused: document.getElementById('rcNarEl').paused }));
  await page.waitForTimeout(2000); // C2再生中 (t≈3s)
  const atC2 = await page.evaluate(() => ({
    narPlaying: !document.getElementById('rcNarEl').paused,
    playhead: document.getElementById('rcPlayhead').style.left,
  }));
  await page.waitForTimeout(3000);
  console.log({ narSel, narSet, atC1, atC2,
    narOk: narSel.visible && narSel.options === 3 && narSet && atC1.narPaused && atC2.narPlaying && parseFloat(atC2.playhead) > 20 });

  // ============ ② シーク: 停止中に80%クリック → C3から再生 ============
  const seekBox = await page.locator('#rcSeek').boundingBox();
  await page.mouse.click(seekBox.x + seekBox.width * 0.83, seekBox.y + seekBox.height / 2);
  await page.waitForTimeout(700);
  const seek1 = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  // 再生中に10%へシークバック → C1
  await page.mouse.click(seekBox.x + seekBox.width * 0.1, seekBox.y + seekBox.height / 2);
  await page.waitForTimeout(900);
  const seek2 = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  await page.waitForTimeout(6000);
  const seekEnd = await page.evaluate(() => document.getElementById('rcMsg').textContent);
  console.log({ seek1, seek2, seekEnd, seekOk: seek1.includes('C3') && seek2.includes('C1') && seekEnd.includes('最後まで') });

  console.log('ERRORS:', errors);
  await browser.close();
})();
