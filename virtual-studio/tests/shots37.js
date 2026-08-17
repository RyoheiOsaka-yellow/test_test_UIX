// v4.7: 参照画像のIndexedDB移行 / 距離ベースの移動時間 / 台本からのカット操作
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
  await page.reload(); await page.waitForTimeout(800);

  const idbOk = await page.evaluate(async () => {
    try { await idbPutClip({ cutId: '__probe', name: 'p', type: 'text/plain', size: 1, blob: new Blob(['x']), addedAt: 1 }); await idbDelClip('__probe'); return true; }
    catch { return false; }
  });
  console.log({ idbOk });   // false のブラウザでは従来どおりlocalStorageに残す (下の判定を切り替える)

  // ============ ① 参照画像の本体がlocalStorageから消えIDBへ移る ============
  const move = await page.evaluate(async () => {
    // 旧形式 (dataUrl入り) の参照画像を作って移行させる
    state.story.refs = [
      { id: 'r1', name: 'a.png', hasAlpha: false, dataUrl: makeSampleStreetImage() },
      { id: 'r2', name: 'b.png', hasAlpha: true, dataUrl: makeSampleHeroineImage() },
    ];
    state.cuts[0].refImgId = 'r1';
    const beforeChars = JSON.stringify(state.story.refs).length;
    const moved = await refMigrateToIdb();
    const afterChars = JSON.stringify(state.story.refs).length;
    const r1 = state.story.refs[0];
    return {
      moved, beforeChars, afterChars,
      noBody: !r1.dataUrl,
      hasThumb: !!r1.thumb && r1.thumb.length < beforeChars / 4,
      clipId: r1.clipId,
      // 描画は本体 (メモリキャッシュ) を使う
      urlIsFull: refUrl(r1) === refFull.get('r1') && refUrl(r1).length > r1.thumb.length,
      inPreview: renderPreviewCached(state.cuts[0], 'x').includes(refUrl(r1).slice(0, 40)),
    };
  });
  console.log({ ...move,
    shrink: +(move.afterChars / move.beforeChars).toFixed(3),
    moveOk: !idbOk || (move.moved === 2 && move.noBody && move.hasThumb && move.clipId === 'ref-r1'
      && move.urlIsFull && move.inPreview && move.afterChars < move.beforeChars / 5) });

  // 本体をメモリから捨ててもIDBから読み戻せる / GCで消されない
  const reload = await page.evaluate(async () => {
    refFull.clear();
    const thumbOnly = refUrl(state.story.refs[0]) === state.story.refs[0].thumb;
    const removed = await gcMediaClips();          // 参照画像は生存扱いのはず
    const body = await refBody(state.story.refs[0]);
    const clip = await idbGetClip('ref-r1');
    return { thumbOnly, removed, restored: body.length > 1000, kept: !!clip };
  });
  console.log({ ...reload, reloadOk: !idbOk || (reload.thumbOnly && reload.restored && reload.kept) });

  // 保存済みプロジェクト側の参照画像も移行される
  const proj = await page.evaluate(async () => {
    const all = { p9: { id: 'p9', title: '旧プロジェクト', updated: 1, data: {
      cuts: [], story: { text: '', refs: [{ id: 'r9', name: 'old.png', dataUrl: makeSampleStreetImage() }] },
    } } };
    localStorage.setItem('vsProjects', JSON.stringify(all));
    const moved = await refMigrateToIdb();
    const back = JSON.parse(localStorage.getItem('vsProjects')).p9.data.story.refs[0];
    return { moved, noBody: !back.dataUrl, clipId: back.clipId, thumb: !!back.thumb };
  });
  console.log({ ...proj, projOk: !idbOk || (proj.moved === 1 && proj.noBody && proj.clipId === 'ref-r9' && proj.thumb) });

  // ============ ② 香盤表の移動時間が距離から決まる ============
  const sched = await page.evaluate(() => {
    const near = moveEstimate({ lat: 35.6936, lng: 139.7047 }, { lat: 35.6586, lng: 139.7454 }); // 新宿→東京タワー 約5km
    const far = moveEstimate({ lat: 35.6936, lng: 139.7047 }, { lat: 35.0116, lng: 135.7681 });  // 東京→京都 約370km
    const none = moveEstimate(null, { lat: 35, lng: 139 });
    while (state.cuts.length < 3) state.cuts.push(makeCut(allPresets()[0]));
    state.cuts.forEach(c => ensureCameraDefaults(c));
    state.cuts[0].location = { ...state.cuts[0].location, presetId: 'jp-alley', name: '新宿', coords: { lat: 35.6936, lng: 139.7047 }, date: '2026-06-21' };
    state.cuts[1].location = { ...state.cuts[1].location, presetId: 'jp-alley', name: '新宿' };
    state.cuts[2].location = { ...state.cuts[2].location, presetId: 'jp-kyoto', name: '京都', coords: { lat: 35.0116, lng: 135.7681 } };
    const doc = buildScheduleDoc();
    return {
      nearKm: near.km, nearMin: near.min, farKm: far.km, farMin: far.min,
      noneMin: none.min, noneGuess: none.guess,
      showsKm: /🚚 移動 \d+km \/ \d+分/.test(doc),
      showsFar: doc.includes('別日/前泊を検討'),
      footer: doc.includes('移動は合計'),
    };
  });
  console.log({ ...sched, schedOk:
    sched.nearKm > 4 && sched.nearKm < 7 && sched.nearMin > 25 && sched.nearMin < 60 &&
    sched.farKm > 350 && sched.farKm < 400 && sched.farMin > 300 && sched.farMin < 500 &&
    sched.noneMin === 30 && sched.noneGuess && sched.showsKm && sched.showsFar && sched.footer });

  // ============ ③ 台本ページからカットを増減・並べ替え・分割できる ============
  const ops = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    state.cuts = [makeCut(allPresets()[0]), makeCut(allPresets()[1])];
    state.cuts.forEach((c, i) => { c.name = 'C' + (i + 1) + '元'; ensureCameraDefaults(c); });
    state.activeCut = 0;
    byId('scriptOverlay').hidden = false;
    renderScriptPage();
    const out = {};

    // 追加
    document.querySelector('[data-scins="0"]').click();
    out.added = state.cuts.length === 3 && state.activeCut === 1;

    // 並べ替え (C3を上へ)
    const before = state.cuts[2].id;
    document.querySelector('[data-scup="2"]').click();
    out.moved = state.cuts[1].id === before;

    // 複製
    const n0 = state.cuts.length;
    document.querySelector('[data-scdup="0"]').click();
    await wait(200);
    out.duped = state.cuts.length === n0 + 1 && /複製/.test(state.cuts[1].name)
      && state.cuts[1].id !== state.cuts[0].id;

    // 削除
    const n1 = state.cuts.length;
    document.querySelector('[data-sccutdel="1"]').click();
    out.deleted = state.cuts.length === n1 - 1;

    // 分割 (ビート境界)
    state.cuts = [state.cuts[0]];
    const c = state.cuts[0];
    c.name = '長いカット'; c.caption = 'セリフ'; c.duration = 10; c.transition = 'dissolve';
    c.perf.beats = [
      { id: 'b1', sec: 3, who: '', do: '入ってくる', gaze: 'ahead', cam: 'none' },
      { id: 'b2', sec: 4, who: '', do: '立ち止まる', gaze: 'ahead', cam: 'none' },
      { id: 'b3', sec: 3, who: '', do: 'ふり返る', gaze: 'cam', cam: 'none' },
    ];
    renderScriptPage();
    await wait(600); captureUndo(); await wait(600);   // 分割前の状態を履歴に固定する
    document.querySelector('.sc-cut[data-sccut="0"] [data-scbsplit="1"]').click();
    const [a, b] = state.cuts;
    out.split = state.cuts.length === 2
      && a.perf.beats.length === 1 && b.perf.beats.length === 2
      && a.duration === 3 && b.duration === 7
      && a.transition === 'cut' && b.transition === 'dissolve'
      && a.caption === 'セリフ' && b.caption === ''
      && a.id !== b.id && b.perf.beats[0].id !== 'b2';   // ビートIDも振り直す
    out.splitGuard = cutSplitAtBeat(0, 0) === -1;        // 先頭では割れない

    // 台本ページ側にもカメラ編集は生えていない (役割分担を崩さない)
    out.noCamEdit = !document.querySelector('#scriptBody [data-sccamera], #scriptBody [data-scshot], #scriptBody [data-scfocal]');

    // Undo で分割前に戻せる
    await wait(600);
    doUndo();
    out.undo = state.cuts.length === 1;
    return out;
  });
  console.log({ ...ops, opsOk: Object.values(ops).every(Boolean) });

  console.log('ERRORS:', errors);
  await browser.close();
})();
