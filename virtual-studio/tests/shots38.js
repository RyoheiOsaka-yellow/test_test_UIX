// v4.8: 香盤表×太陽/日付の連結 / バックアップZIPの往復 / ロケ地ライブラリ拡充
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

  // ============ ① 香盤表が夕GH/時刻指定にアンカーされる ============
  const anchor = await page.evaluate(() => {
    state.cuts = [makeCut(allPresets()[0]), makeCut(allPresets()[1])];
    state.cuts.forEach(c => ensureCameraDefaults(c));
    const tokyo = { lat: 35.6936, lng: 139.7047 };
    // C1: 朝のいつでもカット / C2: 夕GH指定 (夏至の東京 → GH開始 ~18:14 太陽時)
    state.cuts[0].location = { ...state.cuts[0].location, presetId: 'jp-alley', coords: tokyo, date: '2026-06-21' };
    state.cuts[1].location = { ...state.cuts[1].location, presetId: 'jp-alley', coords: tokyo, date: '2026-06-21', timing: 'golden' };
    const doc = buildScheduleDoc();
    const ev = sunEvents(tokyo.lat, tokyo.lng, '2026-06-21');
    // GH指定カットの撮影開始 = goldenStart。行は段取り30分前から始まる
    const m = doc.match(/☀️ 夕GH指定 \((\d{2}:\d{2})/);
    const toMin = hm => +hm.slice(0, 2) * 60 + +hm.slice(3);
    const fmt = mm => `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
    const rowStart = fmt(toMin(ev.goldenStart) - 30);   // setup 30分を指定時刻の前に置く
    return {
      ghStart: ev.goldenStart,
      chip: m ? m[1] : null,
      wait: doc.includes('⏳ 待機/予備'),
      rowStart,
      startsBeforeGh: doc.includes(`<td>${rowStart}–`),
      note: doc.includes('現地太陽時'),
    };
  });
  console.log({ ...anchor, anchorOk:
    anchor.chip === anchor.ghStart && anchor.wait && anchor.startsBeforeGh && anchor.note });

  // 時刻固定: 15:00指定 → 段取り30分を引いた14:30まで待機し、撮影が15:00に始まる
  const fixed = await page.evaluate(() => {
    state.cuts[1].location.timing = 'fixed';
    state.cuts[1].location.time = '15:00';
    const doc = buildScheduleDoc();
    return {
      chip: doc.includes('🕐 15:00 指定'),
      rowAt1430: doc.includes('<td>14:30–'),             // 段取り30分は15:00の前に置かれる
      waitTo1430: /⏳ 待機\/予備 \(\d{2}:\d{2}–14:30\)/.test(doc),
    };
  });
  console.log({ ...fixed, fixedOk: fixed.chip && fixed.rowAt1430 && fixed.waitTo1430 });

  // 間に合わない指定は警告になる (9:30指定だが前に仕事が詰まっている)
  const late = await page.evaluate(() => {
    state.cuts[1].location.time = '09:30';
    const doc = buildScheduleDoc();
    state.cuts[1].location.timing = 'any';
    return { warn: doc.includes('間に合いません') && doc.includes('間に合わない指定が1件') };
  });
  console.log({ ...late, lateOk: late.warn });

  // 日の最初のカットに早い時刻指定 → 警告ではなく開始を前倒しする (朝GH等)
  const early = await page.evaluate(() => {
    state.cuts[0].location.timing = 'fixed';
    state.cuts[0].location.time = '06:00';
    const doc = buildScheduleDoc();
    state.cuts[0].location.timing = 'any';
    return {
      early: doc.includes('🌅 早朝スタート (05:30 集合・段取り開始)'),
      rowAt0530: doc.includes('<td>05:30–'),
      noWarn: !doc.includes('間に合いません'),
    };
  });
  console.log({ ...early, earlyOk: early.early && early.rowAt0530 && early.noWarn });

  // ============ ② 撮影日が違うカットは Day で分かれる ============
  const days = await page.evaluate(() => {
    while (state.cuts.length < 3) state.cuts.push(makeCut(allPresets()[0]));
    state.cuts.forEach(c => ensureCameraDefaults(c));
    state.cuts[2].location = { ...state.cuts[2].location, presetId: 'jp-kyoto',
      coords: { lat: 35.0116, lng: 135.7681 }, date: '2026-06-22' };
    const doc = buildScheduleDoc();
    return {
      day1: doc.includes('📅 Day 1'),
      day2: doc.includes('📅 Day 2 — 2026-06-22'),
      twoEnds: /Day1 \d{2}:\d{2} \/ Day2 \d{2}:\d{2}/.test(doc),
      noMoveAcrossDays: !doc.includes('別日/前泊を検討'),  // 375分の移動はDay分割で消える
      resetClock: /Day 2[\s\S]*?<td>09:00–/.test(doc),     // 翌日は9:00から
      footer: doc.includes('Day で分割'),
    };
  });
  console.log({ ...days, daysOk: Object.values(days).every(Boolean) });

  // GH枠の超過警告: 夕GHに3カットは入らない
  const over = await page.evaluate(() => {
    state.cuts.forEach((c, i) => {
      c.location.presetId = 'jp-alley';
      c.location.coords = { lat: 35.6936, lng: 139.7047 };
      c.location.date = '2026-06-21';
      c.location.timing = 'golden';
      c.takes = 8; c.duration = 20;   // 1カットで撮影約20分
    });
    const doc = buildScheduleDoc();
    state.cuts.forEach(c => { c.location.timing = 'any'; c.takes = 3; c.duration = 5; });
    return { over: doc.includes('夕GH枠') && doc.includes('超過') };
  });
  console.log({ ...over, overOk: over.over });

  // ============ ③ バックアップZIPの完全往復 (参照画像込み) ============
  const zip = await page.evaluate(async () => {
    // 参照画像2枚 (1枚はカット割当) をIDB形式で用意
    state.story.refs = [
      { id: 'z1', name: 'street.jpg', hasAlpha: false, dataUrl: makeSampleStreetImage() },
      { id: 'z2', name: 'heroine.png', hasAlpha: true, dataUrl: makeSampleHeroineImage() },
    ];
    await refIngest(state.story.refs);
    state.cuts[0].refImgId = 'z1';
    state.projectTitle = 'ZIP往復テスト';
    const { blob, manifest } = await buildBackupBlob();
    const refFiles = manifest.filter(m => m.cutId.startsWith('ref-')).length;

    // 完全に消す: state・メモリキャッシュ・IDB
    const snap = null;
    refFull.clear();
    await idbDelClip('ref-z1'); await idbDelClip('ref-z2');
    applySnapshot({ cuts: [makeCut(allPresets()[0])], story: { text: '', refs: [] } });
    const wiped = state.story.refs.length === 0 && !(await idbGetClip('ref-z1'));

    // 復元
    await importBackupZip(new File([blob], 'backup.zip', { type: 'application/zip' }), null);
    const r1 = state.story.refs.find(r => r.id === 'z1');
    const body = r1 ? await refBody(r1) : '';
    const clip = await idbGetClip('ref-z1');
    return {
      refFiles, size: blob.size, wiped,
      title: state.projectTitle,
      refs: state.story.refs.length,
      assigned: state.cuts[0].refImgId === 'z1',
      clipBack: !!clip && clip.isRef === undefined || !!clip,   // blobが戻っている
      bodyBack: body.length > 1000 && body.startsWith('data:image/'),
      inPreview: r1 ? renderPreviewCached(state.cuts[0], 'zz').includes(refUrl(r1).slice(0, 40)) : false,
    };
  });
  console.log({ ...zip, zipOk:
    zip.refFiles === 2 && zip.wiped && zip.title === 'ZIP往復テスト' && zip.refs === 2
    && zip.assigned && zip.clipBack && zip.bodyBack && zip.inPreview });

  // ============ ④ ロケ地ライブラリの拡充と整合性 ============
  const lib = await page.evaluate(() => {
    const ids = LOCATION_PRESETS.map(p => p.id);
    const regions = new Set(LOCATION_REGIONS.map(r => r.id));
    const need = ['arch', 'material', 'signage', 'vegetation', 'ground', 'life', 'sky', 'lightNote', 'permit', 'en', 'label'];
    const broken = LOCATION_PRESETS.filter(p =>
      !regions.has(p.region) || need.some(k => !p[k] || typeof p[k] !== 'string'));
    const perRegion = {};
    LOCATION_PRESETS.forEach(p => { perRegion[p.region] = (perRegion[p.region] || 0) + 1; });
    // 新プリセットがプロンプトに具体を出す
    const c = state.cuts[0];
    c.location.presetId = 'mena-sahara';
    const block = buildLocationBlock(c, false);
    c.location.presetId = null;
    return {
      total: ids.length,
      unique: new Set(ids).size === ids.length,
      broken: broken.map(p => p.id),
      minPerRegion: Math.min(...Object.values(perRegion)),
      sahara: block.includes('Saharan sand dunes') && block.includes('ripple-textured'),
    };
  });
  console.log({ ...lib, libOk:
    lib.total >= 34 && lib.unique && lib.broken.length === 0 && lib.minPerRegion >= 2 && lib.sahara });

  // ============ ⑤ タイミング指定のUIとcanonical往復 ============
  const ui = await page.evaluate(() => {
    const c = state.cuts[0];
    c.location.presetId = 'jp-alley';
    c.location.coords = { lat: 35.69, lng: 139.7 };
    c.location.date = '2026-06-21'; c.location.timing = 'golden';
    byId('scriptOverlay').hidden = false;
    renderScriptPage();
    const sel = document.querySelector('[data-sctiming="0"]');
    const shot = cutToCanonicalShot(c, 0, 'PRJ');
    const back = cutFromCanonicalShot(shot);
    byId('scriptOverlay').hidden = true;
    return {
      selExists: !!sel, selValue: sel ? sel.value : null,
      exported: shot.location.schedule_timing === 'golden',
      roundtrip: back.location.timing === 'golden',
    };
  });
  console.log({ ...ui, uiOk: ui.selExists && ui.selValue === 'golden' && ui.exported && ui.roundtrip });

  console.log('ERRORS:', errors);
  await browser.close();
})();
