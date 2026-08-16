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

  // --- 1) 編集フィールド: インスペクタに存在し、値が反映される
  const hasFields = await page.evaluate(() => ({
    take: !!document.getElementById('cTake'),
    srcIn: !!document.getElementById('cSrcIn'),
    audioEdit: !!document.getElementById('cAudioEdit'),
  }));
  await page.fill('#cTake', '3');
  await page.dispatchEvent('#cTake', 'change');
  await page.fill('#cSrcIn', '4.5');
  await page.dispatchEvent('#cSrcIn', 'change');
  await page.selectOption('#cAudioEdit', 'lcut');
  await page.waitForTimeout(300);
  const editState = await page.evaluate(() => {
    const c = state.cuts[0];
    return { take: c.take, srcIn: c.srcInSec, audioEdit: c.audioEdit, hasOv: !!document.getElementById('cAudioOv') };
  });
  console.log({ hasFields, editState,
    editOk: editState.take === 3 && editState.srcIn === 4.5 && editState.audioEdit === 'lcut' && editState.hasOv });

  // C2にディゾルブを設定 (EDLのD行検証用)
  await page.evaluate(() => { state.cuts[0].transition = 'dissolve'; renderAll(); });

  // --- 2) EDL doc: ボタンで開き、TC/テイク/J-L/ディゾルブが載る
  await page.click('#btnExportEdl');
  await page.waitForTimeout(600);
  const doc = page.frameLocator('#docFrame');
  const edlText = await doc.locator('pre').textContent();
  const tableText = await doc.locator('table').textContent();
  console.log({
    docTitle: await page.locator('#docOverlayTitle').textContent(),
    hasTitleLine: edlText.includes('TITLE:'),
    hasNDF: edlText.includes('NON-DROP FRAME'),
    hasTake3: edlText.includes('C1TK3'),
    hasSrcIn: edlText.includes('00:00:04:12'),   // 4.5s @24fps = 4s+12f
    hasDissolve: /D {4}036/.test(edlText),
    hasLcut: edlText.includes('L-CUT'),
    tableHasTake: tableText.includes('TK3'),
  });
  await page.screenshot({ path: 'v19-edl.png' });
  await page.click('#btnDocBack');
  await page.waitForTimeout(300);

  // --- 3) canonical export に edit_decision が入る
  const canon = await page.evaluate(() => {
    const shot = cutToCanonicalShot(state.cuts[0], 0, 'TEST');
    return shot.edit_decision;
  });
  console.log({ canon, canonOk: canon && canon.take === 3 && canon.src_in_s === 4.5 && canon.audio_edit === 'lcut' });

  // --- 4) メディアDNA抽出: 暖色ハイコントラスト画像を生成→解析
  await page.click('#btnDnaPage');
  await page.waitForTimeout(400);
  const mediaDna = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
    const cx = cv.getContext('2d');
    // 左半分ほぼ黒 / 右半分明るい暖色 → ローキー気味・ハイコントラスト・暖色
    cx.fillStyle = '#0a0604'; cx.fillRect(0, 0, 160, 180);
    const g = cx.createLinearGradient(160, 0, 320, 0);
    g.addColorStop(0, '#7a3c10'); g.addColorStop(1, '#ffcf8a');
    cx.fillStyle = g; cx.fillRect(160, 0, 160, 180);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], 'ref-sunset.png', { type: 'image/png' });
    const dna = await extractMediaDNA(file);
    state.customDNA.push(dna); renderDnaPage();
    return { name: dna.name, look: dna.dims.color.look, fillScale: dna.dims.lighting.fillScale,
      contrast: dna.dims.lighting.contrast, method: dna.provenance.extraction_method,
      conf: dna.provenance.confidence, why: dna.why };
  });
  console.log({ mediaDna, mediaOk: mediaDna.method === 'auto_from_media' && mediaDna.conf === 'estimate' && mediaDna.look === 'filmwarm' });
  const cardShown = await page.evaluate(() => document.getElementById('dnaGrid').innerHTML.includes('ref-sunset'));
  const btnShown = await page.evaluate(() => !!document.getElementById('btnDnaMedia'));
  console.log({ cardShown, btnShown });
  await page.screenshot({ path: 'v19-media-dna.png' });

  console.log('ERRORS:', errors);
  await browser.close();
})();
