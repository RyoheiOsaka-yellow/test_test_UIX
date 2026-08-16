// v3.2: 音声のプロジェクト紐付け / スチールのラフカット参加 / canonical・EDLテロップ補完
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

  // ============ ① 音声のプロジェクト紐付け ============
  const audio = await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array(2048)], { type: 'audio/mpeg' });
    const id = 'aud-bgm-t1';
    await idbPutClip({ cutId: id, name: 'test-bgm.mp3', type: 'audio/mpeg', size: blob.size, blob, addedAt: 1 });
    state.story.audio = { bgm: id };
    await rcRefreshIndex();
    const bound = document.getElementById('rcBgmName').textContent.includes('test-bgm');
    // 保存 → 空プロジェクトへ切替 → 戻す
    document.getElementById('projName').value = '音声テストA';
    saveCurrentProject();
    const savedId = state.projectId;
    applySnapshot({ cuts: [], projectTitle: '別プロジェクト' });
    await rcRefreshIndex();
    const cleared = document.getElementById('rcBgmName').textContent === 'なし';
    const p = JSON.parse(localStorage.getItem('vsProjects'))[savedId];
    applySnapshot(p.data);
    await rcRefreshIndex();
    const restored = document.getElementById('rcBgmName').textContent.includes('test-bgm');
    return { bound, cleared, restored };
  });
  console.log({ ...audio, audioBindOk: audio.bound && audio.cleared && audio.restored });

  // 旧グローバルキー (__nar) の取り込み
  const legacy = await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array(1024)], { type: 'audio/mpeg' });
    await idbPutClip({ cutId: '__nar', name: 'legacy-nar.mp3', type: 'audio/mpeg', size: blob.size, blob, addedAt: 1 });
    delete state.story.audio.nar;
    await rcMigrateLegacyAudio();
    return state.story.audio.nar === '__nar';
  });

  // GC: 参照中の音声は残り、迷子キーは消える
  const gc = await page.evaluate(async () => {
    const blob = new Blob([new Uint8Array(512)], { type: 'audio/mpeg' });
    await idbPutClip({ cutId: 'aud-bgm-orphan', name: 'orphan.mp3', type: 'audio/mpeg', size: blob.size, blob, addedAt: 1 });
    const removed = await gcMediaClips();
    const ids = (await idbAllClips()).map(c => c.cutId);
    return { removed, orphanGone: !ids.includes('aud-bgm-orphan'), keptBound: ids.includes('aud-bgm-t1'), keptLegacy: ids.includes('__nar') };
  });
  console.log({ legacy, ...gc, audioGcOk: legacy && gc.orphanGone && gc.keptBound && gc.keptLegacy });

  // ============ ② スチールのラフカット参加 (UI) ============
  const stillUi = await page.evaluate(async () => {
    state.cuts.push(makeCut(allPresets()[0]));
    const st = state.cuts[1];
    st.kind = 'still';
    st.name = 'スチールカット';
    st.caption = '静止画テロップ';
    renderAll();
    await rcRefreshIndex();
    const row = document.querySelector('#rcList .rc-row.rc-still');
    const seg = document.querySelector('#rcSeekBlocks .rc-seg.still');
    return {
      dur: rcDurOf(st) === 3,
      playable: rcPlayableCuts().includes(st),
      row: !!row && row.textContent.includes('スチール') && !row.querySelector('[data-rcattach]'),
      seg: !!seg,
    };
  });
  console.log({ ...stillUi, stillUiOk: stillUi.dur && stillUi.playable && stillUi.row && stillUi.seg });

  // ============ ③ canonical: テロップ/参照画像/ストーリー往復 ============
  const canon = await page.evaluate(() => {
    state.story.text = 'ヒーローが街を歩くストーリー';
    state.story.refs.push({ id: 'ref-t1', name: 'hero.png', dataUrl: 'data:image/png;base64,', hasAlpha: true });
    const c0 = state.cuts[0];
    c0.caption = 'ビデオテロップ';
    c0.refImgId = 'ref-t1';
    const shot = cutToCanonicalShot(c0, 0, 'PRJ_T');
    const stillShot = cutToCanonicalShot(state.cuts[1], 1, 'PRJ_T');
    const doc = { schema: 'cineos.canonical_shot_list/v1-lite', project_id: 'PRJ_T', story_text: state.story.text, shots: [shot, stillShot] };
    state.story.text = '';
    c0.caption = '';
    importCanonical(doc);
    return {
      capOut: shot.edit_decision.caption === 'ビデオテロップ',
      refOut: !!shot.first_frame_ref && shot.first_frame_ref.name === 'hero.png' && shot.first_frame_ref.has_alpha === true,
      stillCapOut: !!stillShot.edit_decision && stillShot.edit_decision.caption === '静止画テロップ',
      capBack: state.cuts[0].caption === 'ビデオテロップ',
      stillCapBack: state.cuts[1].caption === '静止画テロップ',
      storyBack: state.story.text === 'ヒーローが街を歩くストーリー',
      stillKind: state.cuts[1].kind === 'still',
    };
  });
  console.log({ ...canon, canonOk: Object.values(canon).every(Boolean) });

  // ============ ③ EDL: テロップ列 + CMXコメント ============
  const edl = await page.evaluate(() => {
    const html = buildEdlDoc();
    return {
      th: html.includes('<th>テロップ</th>'),
      cell: html.includes('ビデオテロップ'),
      cmx: html.includes('* CAPTION: ビデオテロップ'),
    };
  });
  console.log({ ...edl, edlOk: edl.th && edl.cell && edl.cmx });

  // ============ ② スチールのラフカット再生 (動画添付なしでも再生できる) ============
  await page.click('#btnFlowPage');
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    await rcRefreshIndex();
    document.getElementById('rcSection').scrollIntoView({ behavior: 'instant' });
    rcRun(false);
  });
  await page.waitForTimeout(1200);
  const playing = await page.evaluate(() => ({
    playing: roughCut.playing,
    msg: document.getElementById('rcMsg').textContent,
    px: (() => {
      const g = document.getElementById('rcCanvas').getContext('2d');
      const d = g.getImageData(640, 360, 1, 1).data;
      return d[0] + d[1] + d[2];
    })(),
  }));
  await page.locator('#rcSection').screenshot({ path: 'v32-rc-still.png' });
  await page.waitForTimeout(2800); // スチール3秒を走り切る
  const done = await page.evaluate(() => ({
    playing: roughCut.playing,
    msg: document.getElementById('rcMsg').textContent,
  }));
  console.log({ playing, done,
    stillPlayOk: playing.playing && playing.msg.includes('スチール') && playing.px > 0 && !done.playing && done.msg.includes('最後まで') });

  console.log('ERRORS:', errors);
  await browser.close();
})();
