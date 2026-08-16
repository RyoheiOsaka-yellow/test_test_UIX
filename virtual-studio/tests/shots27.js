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
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① Undo / Redo ============
  const before = await page.evaluate(() => state.cuts.length);
  await page.click('#btnDelCut');
  await page.waitForTimeout(300);
  const afterDel = await page.evaluate(() => state.cuts.length);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const afterUndo = await page.evaluate(() => ({
    n: state.cuts.length,
    toast: !document.getElementById('toast').hidden && document.getElementById('toast').textContent.includes('元に戻しました'),
  }));
  await page.keyboard.press('Control+Shift+Z');
  await page.waitForTimeout(400);
  const afterRedo = await page.evaluate(() => state.cuts.length);
  console.log({ before, afterDel, afterUndo, afterRedo,
    undoOk: before === 3 && afterDel === 2 && afterUndo.n === 3 && afterUndo.toast && afterRedo === 2 });

  // プリセット適用も戻せる
  const pidBefore = await page.evaluate(() => { doUndo(); return state.cuts[0].presetId; }); // まず3カットに戻す
  await page.waitForTimeout(300);
  await page.evaluate(() => applyPreset('butterfly'));
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const pidAfterUndo = await page.evaluate(() => state.cuts[0].presetId);
  console.log({ pidBefore, pidAfterUndo, undoPresetOk: pidAfterUndo === pidBefore });

  // ============ ② メディアGC: 孤児は消え、参照中と音声は残る ============
  await page.evaluate(async () => {
    await idbPutClip({ cutId: 'zombie-cut-id', name: 'orphan.webm', type: 'video/webm', size: 3, blob: new Blob(['abc']), addedAt: 1 });
    await idbPutClip({ cutId: state.cuts[0].id, name: 'alive.webm', type: 'video/webm', size: 3, blob: new Blob(['abc']), addedAt: 1 });
    await idbPutClip({ cutId: '__bgm', name: 'bgm.webm', type: 'audio/webm', size: 3, blob: new Blob(['abc']), addedAt: 1 });
  });
  const removed = await page.evaluate(() => gcMediaClips());
  await page.waitForTimeout(300);
  const clipsLeft = await page.evaluate(async () => (await idbAllClips()).map(c => c.name).sort());
  console.log({ removed, clipsLeft, gcOk: removed === 1 && clipsLeft.join() === 'alive.webm,bgm.webm' });

  // ============ ③ 自動保存失敗トースト ============
  await page.evaluate(() => {
    window.__origSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'vsCurrent') throw new Error('QuotaExceeded (シミュレーション)');
      return window.__origSet.call(this, k, v);
    };
    state.cuts[0].name = '保存失敗テスト';
    renderAll();
  });
  await page.waitForTimeout(3800);
  const failToast = await page.evaluate(() => ({
    shown: !document.getElementById('toast').hidden,
    text: document.getElementById('toast').textContent,
  }));
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__origSet;
    state.cuts[0].name = '保存復帰テスト';
    renderAll();
  });
  await page.waitForTimeout(3800);
  const recoverToast = await page.evaluate(() => document.getElementById('toast').textContent);
  console.log({ failToast: failToast.text.slice(0, 20), recoverToast: recoverToast.slice(0, 20),
    toastOk: failToast.shown && failToast.text.includes('自動保存に失敗') && recoverToast.includes('復帰') });

  // ============ ④ 容量メーター ============
  await page.click('#btnProjPage');
  await page.waitForTimeout(600);
  const meter = await page.evaluate(() => document.getElementById('storageMeter').textContent);
  console.log({ meter: meter.slice(0, 40), meterOk: /MB/.test(meter) && meter.includes('約5MB') });

  console.log('ERRORS:', errors);
  await browser.close();
})();
