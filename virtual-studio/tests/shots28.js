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

  // ============ ① 書き出しセンターのモデル追従 ============
  await page.selectOption('#promptModelSelect', 'veo');
  await page.click('#btnFlowPage');
  await page.waitForTimeout(500);
  const model1 = await page.evaluate(() => ({
    wfSel: document.getElementById('wfModelSel').value,
    ta: document.querySelector('.wf-exp textarea').value,
    veoExpected: generatePrompt(state.cuts[0], 'veo'),
    seedance: generatePrompt(state.cuts[0], 'seedance'),
  }));
  // WF側セレクタで切替 → ヘッダーも追従
  await page.selectOption('#wfModelSel', 'kling');
  await page.waitForTimeout(400);
  const model2 = await page.evaluate(() => ({
    headerSel: document.getElementById('promptModelSelect').value,
    ta: document.querySelector('.wf-exp textarea').value,
    klingExpected: generatePrompt(state.cuts[0], 'kling'),
    mdHead: buildPromptPackMd().includes('カット別プロンプト (Kling)'),
  }));
  console.log({
    m1Ok: model1.wfSel === 'veo' && model1.ta === model1.veoExpected && model1.ta !== model1.seedance,
    m2Ok: model2.headerSel === 'kling' && model2.ta === model2.klingExpected && model2.mdHead,
  });

  // ============ ② 複製時に添付動画もコピー ============
  await page.evaluate(async () => {
    const mk = () => new Promise(resolve => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 36;
      const cx = cv.getContext('2d');
      const iv = setInterval(() => cx.fillRect(0, 0, 64, 36), 40);
      const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
      const ch = []; rec.ondataavailable = e => ch.push(e.data);
      rec.onstop = () => { clearInterval(iv); resolve(new File(ch, 'gen.webm', { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 700);
    });
    state.activeCut = 0;
    await wfAttachClip(state.cuts[0], await mk());
  });
  await page.click('#btnWfBack');
  await page.waitForTimeout(300);
  await page.click('#btnDupCut');
  await page.waitForTimeout(700);
  const dup = await page.evaluate(async () => {
    const clone = state.cuts[1];
    const clip = await idbGetClip(clone.id);
    return { name: clone.name, hasClip: !!clip, clipName: clip && clip.name,
      toast: document.getElementById('toast').textContent };
  });
  console.log({ dup, dupOk: dup.name.includes('複製') && dup.hasClip && dup.clipName === 'gen.webm' && dup.toast.includes('コピー') });

  // ============ ③ D&D割当 ============
  // 参照画像を用意
  const refId = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    cv.getContext('2d').fillRect(0, 0, 64, 64);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'dragme.png', { type: 'image/png' })]);
    return state.story.refs[0].id;
  });
  // 内部ドラッグ: refId → C3サムネ
  const internal = await page.evaluate(rid => {
    const th = document.querySelectorAll('#cutStrip .cut-thumb')[2];
    const dt = new DataTransfer();
    dt.setData('text/vs-ref', rid);
    th.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    th.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return { assigned: state.cuts[2].refImgId === rid };
  }, refId);
  await page.waitForTimeout(400);
  const internalThumb = await page.evaluate(() =>
    document.querySelectorAll('#cutStrip .cut-thumb')[2].querySelector('svg image') != null);
  console.log({ internal, internalThumb, dndOk: internal.assigned && internalThumb });

  // OSファイル直接ドロップ: 新規画像 → C4サムネ (取り込み+割当が一撃)
  const fileDrop = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d'); g.fillStyle = '#37a'; g.fillRect(0, 0, 64, 64);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], 'os-drop.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const th = document.querySelectorAll('#cutStrip .cut-thumb')[3];
    th.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    th.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 600));
    const ref = state.story.refs.find(r2 => r2.name === 'os-drop.png');
    return { imported: !!ref, assigned: ref && state.cuts[3].refImgId === ref.id };
  });
  console.log({ fileDrop, fileDropOk: fileDrop.imported && fileDrop.assigned });

  // WF内: 画像カード → 書き出しカード
  await page.click('#btnFlowPage');
  await page.waitForTimeout(500);
  const wfDrop = await page.evaluate(rid => {
    const exp = document.querySelectorAll('.wf-exp')[1]; // C2
    const dt = new DataTransfer();
    dt.setData('text/vs-ref', rid);
    exp.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    exp.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return { assigned: state.cuts[1].refImgId === rid,
      draggableCard: !!document.querySelector('[data-refdrag]') };
  }, refId);
  console.log({ wfDrop, wfDropOk: wfDrop.assigned && wfDrop.draggableCard });

  console.log('ERRORS:', errors);
  await browser.close();
})();
