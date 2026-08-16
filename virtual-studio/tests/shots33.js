// v4.0: 参照オーケストレーション — 役割分担 / 公式型プロンプト / 動画・音声参照 / 往復
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

  // 参照素材を用意 (画像=同一性 / 動画=動き / 音声)
  await page.evaluate(() => {
    state.story.refs.push({ id: 'r-img', name: 'heroine.png', mediaKind: 'image', dataUrl: 'data:image/png;base64,', hasAlpha: true, role: 'identity' });
    state.story.refs.push({ id: 'r-vid', name: 'walk.mp4', mediaKind: 'video', clipId: 'ref-r-vid', dataUrl: '', dur: 6, role: 'motion' });
    state.story.refs.push({ id: 'r-aud', name: 'vo.mp3', mediaKind: 'audio', clipId: 'ref-r-aud', dataUrl: '', role: 'audio' });
    const c = state.cuts[0];
    c.orch.refs = [{ refId: 'r-img', role: 'identity' }, { refId: 'r-vid', role: 'motion' }, { refId: 'r-aud', role: 'audio' }];
    c.orch.preserve = ['performance', 'timing', 'blocking'];
    c.orch.change = ['person', 'environment'];
    c.orch.priority = orchDefaultPriority(c);
    renderAll();
  });

  // ============ ① 役割タグ付けと公式型の並び ============
  const form = await page.evaluate(() => {
    const c = state.cuts[0];
    const p = generatePrompt(c, 'orchestrate');
    const order = ['REFERENCES:', 'ACTION:', 'CAMERA:', 'PERFORMANCE:', 'ENVIRONMENT:', 'PRESERVE / CHANGE:', 'PRIORITY:'];
    const idx = order.map(k => p.indexOf(k));
    return {
      tags: orchRefsOf(c).map(r => r.tag),
      ordered: idx.every((v, i) => v > 0 && (i === 0 || v > idx[i - 1])),
      useAvoid: p.includes('Use only: character identity, face, hair.') && p.includes('Do not copy: location, clothing, text'),
      priTop: p.includes('1. Match body rhythm'),
      p,
    };
  });
  console.log({ tags:form.tags, ordered:form.ordered, useAvoid:form.useAvoid, priTop:form.priTop,
    formOk:form.tags.join() === '@Image1,@Video1,@Audio1' &&form.ordered &&form.useAvoid &&form.priTop });

  // ============ ② 参照が持つ情報を文章で重ねない ============
  const dedup = await page.evaluate(() => {
    const c = state.cuts[0];
    const withMotion = generatePrompt(c, 'orchestrate');
    // 動き参照を外すと「動きの質」が文章側に戻る
    c.orch.refs = c.orch.refs.filter(a => a.role !== 'motion');
    const noMotion = generatePrompt(c, 'orchestrate');
    c.orch.refs.push({ refId: 'r-vid', role: 'motion' });
    // シーン参照を足すと環境の描写がその参照に委ねられる
    state.story.refs.push({ id: 'r-scene', name: 'street.jpg', mediaKind: 'image', dataUrl: '', role: 'scene' });
    c.orch.refs.push({ refId: 'r-scene', role: 'scene' });
    const withScene = generatePrompt(c, 'orchestrate');
    c.orch.refs = c.orch.refs.filter(a => a.refId !== 'r-scene');
    return {
      motionDeferred: withMotion.includes('Follow @Video1 for the motion') && !withMotion.includes('Motion quality:'),
      motionWritten: noMotion.includes('Motion quality:') && !noMotion.includes('Follow @Video1 for the motion'),
      sceneDeferred: /Follow @Image\d for scene, materials, lighting and color/.test(withScene),
      identityDeferred: withMotion.includes('identity comes from @Image1'),
    };
  });
  console.log({ ...dedup, dedupOk: Object.values(dedup).every(Boolean) });

  // ============ ③ 無関係な要素は固定指示に出さない ============
  const locks = await page.evaluate(() => {
    const c = state.cuts[0];
    c.subjectType = 'person'; c.camera.move = 'fix';
    const person = generatePrompt(c, 'orchestrate');
    c.subjectType = 'bottle';
    const bottle = generatePrompt(c, 'orchestrate');
    c.subjectType = 'person';
    return {
      personNoProduct: !person.includes('product design and demonstration'),
      bottleHasProduct: bottle.includes('product design and demonstration'),
      fixNoSpace: !person.includes('spatial layout and camera path'),
    };
  });
  console.log({ ...locks, lockOk: Object.values(locks).every(Boolean) });

  // ============ ④ Seedance方言にも役割ブロックが乗る ============
  const seed = await page.evaluate(() => {
    const p = generatePrompt(state.cuts[0], 'seedance');
    return { refs: p.includes('REFERENCES:'), pri: p.includes('PRIORITY:'), pc: p.includes('PRESERVE / CHANGE:'), neg: p.includes('NEGATIVE:') };
  });
  console.log({ ...seed, seedOk: Object.values(seed).every(Boolean) });

  // ============ ⑤ 動画参照の取り込み (IDB保存 + GC生存) ============
  const media = await page.evaluate(async () => {
    // 実ファイルの代わりに小さなWebMを作って取り込む
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 36;
    const cx = cv.getContext('2d');
    const iv = setInterval(() => { cx.fillStyle = '#3a6'; cx.fillRect(0, 0, 64, 36); }, 33);
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: 'video/webm' });
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
    const file = await new Promise(res => {
      rec.onstop = () => { clearInterval(iv); res(new File(chunks, 'motion-ref.webm', { type: 'video/webm' })); };
      rec.start(); setTimeout(() => rec.stop(), 700);
    });
    const before = state.story.refs.length;
    await wfAddRefFiles([file]);
    const ref = state.story.refs[state.story.refs.length - 1];
    const clips = (await idbAllClips()).map(c => c.cutId);
    const removed = await gcMediaClips();
    const after = (await idbAllClips()).map(c => c.cutId);
    return {
      added: state.story.refs.length === before + 1,
      kind: ref.mediaKind, role: ref.role,
      stored: clips.includes(ref.clipId),
      survivesGc: after.includes(ref.clipId), removed,
      poster: (ref.dataUrl || '').startsWith('data:image'),
    };
  });
  console.log({ ...media, mediaOk: media.added && media.kind === 'video' && media.role === 'motion' && media.stored && media.survivesGc && media.poster });

  // ============ ⑥ インスペクタUI: 役割変更・強度・優先順位 ============
  const ui = await page.evaluate(() => {
    renderInspector();
    const sec = document.querySelector('.orch-sec');
    sec.open = true;
    const before = document.querySelectorAll('.orch-ref').length;
    // 強度を「おまかせ」にすると制約から消える
    document.querySelector('[data-lock="identity"][data-lv="free"]').click();
    const freed = !generatePrompt(state.cuts[0], 'orchestrate').includes('character identity: LOCKED');
    // 「残す」チップの追加
    document.querySelector('.orch-sec [data-pres="gaze"]').click();
    const gaze = state.cuts[0].orch.preserve.includes('gaze');
    // 優先順位の並べ替え
    const p0 = state.cuts[0].orch.priority[0];
    document.querySelector('[data-pridn="0"]').click();
    const moved = state.cuts[0].orch.priority[1] === p0;
    return { refs: before, locks: document.querySelectorAll('.orch-lock').length, freed, gaze, moved };
  });
  await page.waitForTimeout(200);
  await page.locator('.orch-sec').screenshot({ path: 'v40-orch.png' });
  console.log({ ...ui, uiOk: ui.refs >= 3 && ui.locks === 6 && ui.freed && ui.gaze && ui.moved });

  // ============ ⑦ canonical往復 & 技法変更での維持 ============
  const round = await page.evaluate(() => {
    const c = state.cuts[0];
    c.orch.method = 'shoot'; c.orch.speed = 'fast'; c.orch.care = 'loose';
    const shot = cutToCanonicalShot(c, 0, 'PRJ_T');
    const back = cutFromCanonicalShot(shot);
    // 技法プリセットを変えても役割分担は残る
    const keep = JSON.stringify(c.orch);
    applyPreset('rembrandt');
    return {
      exported: !!shot.orchestration && shot.orchestration.references.length >= 3
        && shot.orchestration.method === 'shoot' && shot.orchestration.priority.length > 0,
      imported: back.orch.method === 'shoot' && back.orch.speed === 'fast' && back.orch.preserve.includes('performance'),
      keptOnPreset: JSON.stringify(state.cuts[0].orch) === keep,
    };
  });
  console.log({ ...round, roundOk: Object.values(round).every(Boolean) });

  console.log('ERRORS:', errors);
  await browser.close();
})();
