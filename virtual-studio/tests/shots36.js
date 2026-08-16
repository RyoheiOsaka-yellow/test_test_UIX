// v4.5: 追加機能の統合 — Undo/Esc/フォーカストラップ/香盤表のロケ地/診断/ツアー/サンプル
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

  // ============ ① 台本ページの編集が Undo できる ============
  const undo = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    byId('scriptOverlay').hidden = false; renderScriptPage();
    await wait(600);
    const n0 = undoState.stack.length;
    document.querySelector('[data-scbadd="0"]').click();      // ビート追加
    await wait(600);
    const n1 = undoState.stack.length;
    const cap = document.querySelector('[data-sccap="0"]');
    cap.value = 'セリフ試験'; cap.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(600);
    const n2 = undoState.stack.length;
    doUndo();
    const capBack = state.cuts[0].caption !== 'セリフ試験';
    doUndo();
    const beatBack = state.cuts[0].perf.beats.length === 0;
    return { beatPushed: n1 > n0, capPushed: n2 > n1, capBack, beatBack };
  });
  console.log({ ...undo, undoOk: Object.values(undo).every(Boolean) });

  // ============ ② Escape で前面のページから閉じる ============
  const esc = await page.evaluate(() => ({ script: !byId('scriptOverlay').hidden }));
  await page.evaluate(() => openLocationLib(0));
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const afterFirst = await page.evaluate(() => ({
    loc: byId('locOverlay').hidden, script: byId('scriptOverlay').hidden,
  }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const afterSecond = await page.evaluate(() => byId('scriptOverlay').hidden);
  console.log({ ...esc, afterFirst, afterSecond,
    escOk: esc.script && afterFirst.loc && !afterFirst.script && afterSecond });

  // ============ ③ 新オーバーレイのフォーカストラップ ============
  const trap = await page.evaluate(() => {
    const el = byId('scriptOverlay');
    el.hidden = false; renderScriptPage();
    const f = [...el.querySelectorAll('button, [href], input, select, textarea')]
      .filter(x => !x.disabled && x.offsetParent !== null);
    f[f.length - 1].focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    const wrapped = document.activeElement === f[0];
    el.hidden = true;
    return { count: f.length, wrapped };
  });
  console.log({ ...trap, trapOk: trap.count > 3 && trap.wrapped });

  // ============ ④ 香盤表がロケ地でまとまり移動時間が入る ============
  const sched = await page.evaluate(() => {
    state.cuts[0].location.presetId = 'jp-alley';
    state.cuts[0].location.name = '新宿ゴールデン街';
    state.cuts[0].location.coords = { lat: 35.6936, lng: 139.7047 };
    state.cuts[0].location.date = '2026-06-21';
    state.cuts[1].location.presetId = 'jp-alley';        // 同じロケ地 = 移動なし
    state.cuts[1].location.name = '新宿ゴールデン街';
    state.cuts[2].location.presetId = 'jp-kyoto';        // 別ロケ地 = 移動が入る
    const doc = buildScheduleDoc();
    const locRows = (doc.match(/class="loc-row"/g) || []).length;
    return {
      locRows,
      hasName: doc.includes('新宿ゴールデン街'),
      move: doc.includes('🚚 移動 30分'),
      sun: doc.includes('日の出'),
      permit: doc.includes('撮影許可と近隣配慮'),
    };
  });
  console.log({ ...sched,
    schedOk: sched.locRows === 2 && sched.hasName && sched.move && sched.sun && sched.permit });

  // ============ ⑤ ロケ地とスタジオ設定の食い違いを診断 ============
  const lint = await page.evaluate(() => {
    const c = state.cuts[0];
    // 屋内スタジオなのに太陽がある
    c.location.presetId = 'studio-white';
    c.items.push(makeItem({ type: 'sun', x: 200, y: 200, power: 80, colorTemp: 5600 }));
    const indoor = lintCut(c).map(x => x.code);
    c.items = c.items.filter(i => i.type !== 'sun');
    // 昼の太陽なのに時間帯が夜
    c.location.presetId = 'jp-alley';
    c.location.coords = { lat: 35.68, lng: 139.76 };
    c.location.date = '2026-06-21'; c.location.time = '12:00';
    c.timeOfDay = 'night';
    const day = lintCut(c).map(x => x.code);
    c.timeOfDay = 'golden';
    c.location.time = '23:00';
    const night = lintCut(c).map(x => x.code);
    c.location.time = '17:00'; c.timeOfDay = 'golden';
    const ok = lintCut(c).map(x => x.code);
    return { indoor: indoor.includes('LOC-INDOOR-SUN'), day: day.includes('LOC-SUN-TOD'),
      night: night.includes('LOC-SUN-TOD'), clean: !ok.includes('LOC-SUN-TOD') };
  });
  console.log({ ...lint, lintOk: Object.values(lint).every(Boolean) });

  // ============ ⑥ ツアーとヘルプが新機能を案内する ============
  const guide = await page.evaluate(() => {
    const t = byId('kbdHelp').textContent;
    return {
      steps: TOUR_STEPS.length,
      missing: TOUR_STEPS.filter(s => !document.querySelector(s.el)).length,
      tourScript: TOUR_STEPS.some(s => /台本/.test(s.title)),
      tourLoc: TOUR_STEPS.some(s => /ロケ地/.test(s.body)),
      helpScript: /台本/.test(t), helpLoc: /ロケ地/.test(t),
    };
  });
  console.log({ ...guide,
    guideOk: guide.steps === 9 && guide.missing === 0 && guide.tourScript && guide.tourLoc && guide.helpScript && guide.helpLoc });

  // ============ ⑦ サンプルプロジェクトが新しい層まで見せる ============
  const sample = await page.evaluate(() => {
    loadSampleProject();
    const withLoc = state.cuts.filter(c => locActive(c));
    const withPerf = state.cuts.filter(c => perfActive(c));
    const p = generatePrompt(withPerf[0] || state.cuts[0], 'seedance');
    return {
      cuts: state.cuts.length, loc: withLoc.length, perf: withPerf.length,
      locName: withLoc.length ? withLoc[0].location.name : '',
      sun: !!locSunNow(withLoc[0] || state.cuts[0]),
      prompt: p.includes('LOCATION:') && p.includes('BEATS:'),
    };
  });
  console.log({ ...sample,
    sampleOk: sample.cuts >= 3 && sample.loc >= 2 && sample.perf >= 1 && sample.sun && sample.prompt });

  console.log('ERRORS:', errors);
  await browser.close();
})();
