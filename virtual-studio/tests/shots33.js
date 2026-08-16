// v4.1: 人の動き (演技演出) レイヤー / プロンプト診断 / 制作方式の推奨 / 既存への非破壊
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
  await page.reload(); await page.waitForTimeout(700);

  // ============ ① 未使用ならプロンプトは従来どおり (非破壊) ============
  const untouched = await page.evaluate(() => {
    const c = state.cuts[0];
    const before = PROMPT_MODELS.map(m => generatePrompt(c, m.id));
    const active = perfActive(c);
    // 動きの質だけ変えても、演出が未使用ならプロンプトは変わらない
    c.perf.speed = 'fast'; c.perf.care = 'loose';
    const after = PROMPT_MODELS.map(m => generatePrompt(c, m.id));
    return { active, same: before.join('|') === after.join('|'), models: PROMPT_MODELS.length };
  });
  console.log({ ...untouched, untouchedOk: !untouched.active && untouched.same && untouched.models === 7 });

  // ============ ② ビートの追加と尺との連動 ============
  const beats = await page.evaluate(() => {
    const c = state.cuts[0];
    c.duration = 10;
    perfApplyTemplate(c, 'oneTake');            // 尺に比率で流し込む
    const total = perfBeatTotal(c);
    const p = generatePrompt(c, 'seedance');
    // 尺を変えるとビート合計とズレる → 診断が出る
    c.duration = 5;
    const li = lintCut(c).map(x => x.code);
    // 「尺に合わせる」相当の再フィット
    const k = 5 / perfBeatTotal(c);
    c.perf.beats.forEach(b => { b.sec = Math.max(0.5, Math.round(b.sec * k * 10) / 10); });
    const li2 = lintCut(c).map(x => x.code);
    return {
      count: c.perf.beats.length, total,
      active: perfActive(c),
      hasBeats: p.includes('BEATS:') && /0\.0–2\.0s/.test(p),
      mismatch: li.includes('BEAT-DUR'),
      fixed: !li2.includes('BEAT-DUR'),
    };
  });
  console.log({ ...beats, beatsOk: beats.count === 4 && Math.abs(beats.total - 10) < 0.6 && beats.active && beats.hasBeats && beats.mismatch && beats.fixed });

  // ============ ③ カメラとの連動 (矛盾の検出) ============
  const camLink = await page.evaluate(() => {
    const c = state.cuts[0];
    c.camera.move = 'fix';
    c.perf.camLink = 'follow';
    const bad = lintCut(c).find(x => x.code === 'CONFLICT-CAM');
    c.camera.move = 'follow';
    const ok = !lintCut(c).some(x => x.code === 'CONFLICT-CAM');
    return { detected: !!bad, lv: bad && bad.lv, cleared: ok };
  });
  console.log({ ...camLink, camLinkOk: camLink.detected && camLink.lv === 'danger' && camLink.cleared });

  // ============ ④ 書いてはいけない5項目の診断 ============
  const lint = await page.evaluate(() => {
    const c = state.cuts[0];
    c.aim = '幻想的で、美しく、儚げな、エモーショナルな雰囲気';       // ① 形容詞の積み上げ
    c.perf.beats[0].do = 'ちょっとふざけたミニダンスをする';           // ② 動きの名前
    c.subjectNote = '腕を振り、肩を揺らし、手を前に出す';              // ③ 部位の分解
    const codes = lintCut(c).map(x => x.code);
    // ④ 参照が持つ情報の重複
    state.story.refs.push({ id: 'r1', name: 'face.png', dataUrl: 'data:image/png;base64,' });
    c.refImgId = 'r1';
    c.subjectNote = '20代女性・栗色の髪・白い服';
    const codes2 = lintCut(c).map(x => x.code);
    return {
      adj: codes.includes('ADJ-PILE'),
      name: codes.includes('MOTION-NAME'),
      parts: codes.includes('BODY-PARTS'),
      dup: codes2.includes('REF-DUP'),
    };
  });
  console.log({ ...lint, lintOk: Object.values(lint).every(Boolean) });

  // 診断パネルがUIに出る
  const panel = await page.evaluate(() => {
    renderLint();
    const box = document.getElementById('lintBox');
    return { shown: !box.hidden, items: document.querySelectorAll('#lintList li').length };
  });
  console.log({ ...panel, panelOk: panel.shown && panel.items >= 2 });

  // ============ ⑤ 制作方式の推奨と向かないケース ============
  const method = await page.evaluate(() => {
    const c = state.cuts[0];
    c.perf.actors = [{ id: 'a1', type: 'person', name: '' }]; c.perf.people = 1; c.perf.contact = 'none'; c.perf.beats = [];
    c.refImgId = null;
    const solo = recommendMethod(c).id;
    c.refImgId = 'r1';
    const withRef = recommendMethod(c).id;
    c.perf.actors = [{ id: 'a1', type: 'person', name: '1' }, { id: 'a2', type: 'vehicle', name: '' }]; c.perf.people = 2; c.perf.contact = 'embrace';
    const rec = recommendMethod(c);
    const auto = perfMethodOf(c);
    // 向かないケースにチェック → 先に撮っても解決しない警告
    c.perf.unfit = ['complex', 'hidden'];
    const unfit = lintCut(c).find(x => x.code === 'UNFIT');
    return { solo, withRef, contactRec: rec.id, why: rec.why[0], auto, unfit: !!unfit && unfit.lv === 'danger' };
  });
  console.log({ ...method,
    methodOk: method.solo === 'gen' && method.withRef === 'ref' && method.contactRec === 'shoot' && method.auto === 'shoot' && method.unfit });

  // ============ ⑥ UI: セクション操作とバッジ ============
  const ui = await page.evaluate(() => {
    const c = state.cuts[0];
    c.perf.unfit = [];
    renderAll();
    const sec = document.querySelector('.perf-sec');
    sec.open = true;
    document.getElementById('pBeatAdd').click();
    const added = c.perf.beats.length;
    document.querySelector('[data-bdel="0"]').click();
    const removed = c.perf.beats.length;
    document.getElementById('pContact').value = 'touch';
    document.getElementById('pContact').dispatchEvent(new Event('change'));
    return {
      added, removed, contact: c.perf.contact,
      badge: !!document.querySelector('#cutStrip .mode-badge.mb-perf'),
      rows: document.querySelectorAll('.beat-row').length,
    };
  });
  console.log({ ...ui, uiOk: ui.added === 1 && ui.removed === 0 && ui.contact === 'touch' && ui.badge });

  // ============ ⑦ canonical往復・指示書・技法変更での維持 ============
  const round = await page.evaluate(() => {
    const c = state.cuts[0];
    c.duration = 8;
    perfApplyTemplate(c, 'enterExit');
    c.perf.actors = [{ id: 'a1', type: 'person', name: '1' }, { id: 'a2', type: 'person', name: '2' }]; c.perf.people = 2; c.perf.contact = 'handoff';
    c.perf.preserve = ['performance', 'timing']; c.perf.change = ['person'];
    const shot = cutToCanonicalShot(c, 0, 'PRJ_T');
    const back = cutFromCanonicalShot(shot);
    const keep = JSON.stringify(c.perf);
    applyPreset('rembrandt');
    const doc = buildInstructionDoc();
    return {
      exported: !!shot.performance && shot.performance.beats.length === 3 && shot.performance.beats[0].out_s > 0,
      imported: back.perf.beats.length === 3 && back.perf.contact === 'handoff' && back.perf.preserve.includes('performance'),
      keptOnPreset: JSON.stringify(state.cuts[0].perf) === keep,
      docBeats: doc.includes('演技演出 (人の動き)') && doc.includes('フレームインする'),
      docLint: doc.includes('プロンプト診断'),
    };
  });
  console.log({ ...round, roundOk: Object.values(round).every(Boolean) });

  await page.evaluate(() => { document.querySelector('.perf-sec').open = true; });
  await page.waitForTimeout(200);
  await page.locator('.perf-sec').screenshot({ path: 'v41-perf.png' });
  console.log('ERRORS:', errors);
  await browser.close();
})();
