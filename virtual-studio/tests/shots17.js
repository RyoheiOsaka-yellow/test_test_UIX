// 可搬版: VS_CHROME でChromiumパス指定 (未指定ならplaywright-core既定)
const { chromium } = require('playwright-core');
const http = require('http');

(async () => {
  // 実験的API連携の受け口 (中継サーバー想定・CORS許可)
  const received = [];
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => { received.push(JSON.parse(body)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); });
  });
  await new Promise(r => server.listen(8787, r));

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

  // --- 1) ワークフローを開く
  await page.click('#btnFlowPage');
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => !document.getElementById('wfOverlay').hidden);

  // --- 2) ストーリー入力 → カット設計
  await page.fill('#wfStory', '夜の雨の街をヒロインが歩いてくる。\nふと立ち止まり、ゆっくり振り返る。\n最後に顔の寄りで、目に涙が光る。');
  await page.click('#btnWfDesign');
  await page.waitForTimeout(600);
  const design = await page.evaluate(() => ({
    n: state.cuts.length,
    names: state.cuts.map(c => c.name),
    msg: document.getElementById('wfDesignMsg').textContent,
  }));
  console.log({ opened, design, designOk: design.n === 3 });

  // --- 3) 参照画像を追加 (canvasで生成) → C1に割当
  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
    const cx = cv.getContext('2d'); cx.fillStyle = '#334'; cx.fillRect(0, 0, 400, 300);
    cx.fillStyle = '#fa5'; cx.beginPath(); cx.arc(200, 150, 80, 0, 7); cx.fill();
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await wfAddRefFiles([new File([blob], 'heroine.png', { type: 'image/png' })]);
  });
  await page.waitForTimeout(400);
  await page.selectOption('[data-refassign]', { index: 1 }); // C1
  await page.waitForTimeout(300);
  const refState = await page.evaluate(() => ({
    refs: state.story.refs.length,
    assigned: state.cuts[0].refImgId === state.story.refs[0].id,
    thumbInExport: !!document.querySelector('.wf-exp-ref'),
  }));
  console.log({ refState });

  // --- 4) 書き出し: コピーで prompted に
  await page.locator('[data-wfcopy]').first().click();
  await page.waitForTimeout(300);
  const st1 = await page.evaluate(() => state.cuts[0].wfStatus);

  // --- 5) API送信 (ローカル中継サーバーへ)
  await page.evaluate(() => { document.getElementById('wfApi').open = true; });
  await page.fill('#wfApiUrl', 'http://127.0.0.1:8787/generate');
  await page.click('#btnWfApiSave');
  await page.waitForTimeout(300);
  await page.locator('[data-wfsend]').first().click();
  await page.waitForTimeout(800);
  const apiMsg = await page.evaluate(() => document.querySelector('[data-wfmsg]').textContent);
  console.log({ st1, apiMsg, apiReceived: received.length, hasPrompt: !!(received[0] && received[0].prompt), hasRef: !!(received[0] && received[0].first_frame_data_url), params: received[0] && received[0].params });

  // --- 6) ステータス: 生成済み→採用、ボードのサイクル
  await page.locator('[data-wfgen]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-wfok]').nth(1).click();
  await page.waitForTimeout(200);
  const board = await page.evaluate(() => state.cuts.map(c => c.wfStatus));
  await page.locator('[data-wfcycle]').nth(2).click(); // C3 plan→prompted
  await page.waitForTimeout(200);
  const board2 = await page.evaluate(() => state.cuts.map(c => c.wfStatus));
  const dots = await page.evaluate(() => [...document.querySelectorAll('.wf-dot')].map(d => d.className.replace('wf-dot ', '')));
  console.log({ board, board2, dots });
  await page.screenshot({ path: 'v20-workflow.png' });

  // --- 7) 保存確認: story が snapshot に入る
  const snapHasStory = await page.evaluate(() => {
    const s = snapshotState();
    return !!(s.story && s.story.refs.length === 1 && s.story.text.includes('ヒロイン'));
  });

  // --- 8) 4→1: 次のストーリーへ (保存+リセット)
  await page.click('#btnWfNext');
  await page.waitForTimeout(500);
  const afterNext = await page.evaluate(() => ({
    cuts: state.cuts.length, story: state.story.text, refs: state.story.refs.length,
    saved: Object.keys(JSON.parse(localStorage.getItem('vsProjects') || '{}')).length,
  }));
  console.log({ snapHasStory, afterNext, loopOk: afterNext.cuts === 1 && afterNext.story === '' && afterNext.saved === 1 });
  await page.screenshot({ path: 'v20-workflow-reset.png' });

  console.log('ERRORS:', errors);
  await browser.close();
  server.close();
})();
