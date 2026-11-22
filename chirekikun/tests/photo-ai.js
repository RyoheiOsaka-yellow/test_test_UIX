// 空中写真のAI下読みと、出力の切り替え（確認用／提出用）の確認
// APIは模擬応答に差し替える（--live を付けると実際のAPIに送る。APIキーは環境の中継で付与される想定）
// 使い方: node tests/photo-ai.js index.html [出力先dir] [--live]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '.';
  const live = process.argv.includes('--live');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; const sent = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  if (!live) await p.route('https://api.anthropic.com/v1/messages', async route => {
    const req = route.request(); const body = JSON.parse(req.postData());
    const imgs = body.messages[0].content.filter(x => x.type === 'image');
    sent.push({ model: body.model, effort: body.output_config && body.output_config.effort, fallbacks: body.fallbacks, images: imgs.length, kb: Math.round(imgs.reduce((a, x) => a + x.source.data.length, 0) / 1024), media: imgs[0] && imgs[0].source.media_type, labels: body.messages[0].content.filter(x => x.type === 'text').map(x => x.text.slice(0, 26)), beta: req.headers()['anthropic-beta'], ver: req.headers()['anthropic-version'] });
    const photos = imgs.map((_, i) => ({ n: i + 1, site: ['田', '低層の建物', '大きな屋根の建物（工場・倉庫の可能性）', '大きな屋根の建物（工場・倉庫の可能性）', '大きな屋根の建物（工場・倉庫の可能性）', '空地', '駐車場'][i] || '判読不能', around: '住宅・道路・鉄道', conf: i < 2 ? '低' : '中', note: '屋根の形状と敷地の広さから。用途の種類は写真では分からない。' }));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ photos, summary: '戦後は田で、1960年代に低層の建物が建ち、1970年代から大きな屋根の建物となった。2007年以降は空地・駐車場。' }) }], usage: { input_tokens: 9000, output_tokens: 600 } }) });
  });
  await p.goto('file://' + path.resolve(process.argv[2]));
  await p.click('#l-demo');
  await p.waitForTimeout(400);
  await p.evaluate(async () => { store.set('apiKey', 'sk-ant-dummy-key-replaced-by-proxy'); await aiDetect(); });
  // 資料なしで作成（デモ②と同じ入力）。作成の途中で空中写真の下読みが走る
  await p.evaluate(() => { ST.files = []; ST.draft = Object.assign({ geoTitle: '' }, DEMO2_INPUT); go('new'); });
  await p.click('#n-run');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: live ? 240000 : 60000 });
  await p.waitForTimeout(1500);
  const R = {};
  R.created = await p.evaluate(() => { const c = curCase(); const pr = c.photoRead; return { ai: AI.mode, photoRead: pr && { at: pr.at, n: pr.rows.length, rows: pr.rows.map(r => r.era + '｜' + r.site + '｜' + r.around + '｜' + r.conf + '｜' + r.note), summary: pr.summary, usage: pr.usage }, verdict: c.verdict.level, tags: document.querySelectorAll('#paper .aiv').length, title: (document.querySelector('#paper .mapt') || {}).previousElementSibling && document.querySelector('#paper .mapt').previousElementSibling.textContent, btns: [...document.querySelectorAll('#paper .scr button')].map(x => x.textContent), gaps: gapsOf(c).map(g => g.k) }; });
  await (await p.$('#sec-23')).scrollIntoViewIfNeeded();
  await p.evaluate(() => document.getElementById('sec-23').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'ai-23.png') });
  // 確認用のPDF
  const pdf = async name => { await p.evaluate(() => { window.__printed = false; window.print = () => { window.__printed = true; }; document.getElementById('c-pdf').click(); }); await p.waitForFunction(() => window.__printed, null, { timeout: 15000 }); const info = await p.evaluate(() => { const a = document.getElementById('printarea'); return { cls: a.className, sheets: a.querySelectorAll('.sheet').length, miss: a.querySelectorAll('.miss').length, app: a.querySelectorAll('.sheet.app').length, draft: a.querySelectorAll('.draft').length, scr: a.querySelectorAll('.scr').length, tocApp: [...a.querySelectorAll('.toc a')].filter(x => /付録/.test(x.textContent)).length, redNgv: a.querySelectorAll('.ngv').length }; }); await p.emulateMedia({ media: 'print' }); const buf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); fs.writeFileSync(path.join(out, name), buf); await p.emulateMedia({ media: 'screen' }); return info; };
  R.pdfCheck = await pdf('ai-check.pdf');
  // 判読案を採用 → 年次表になる。空中写真だけでは所見は保留のまま、住宅地図の赤枠は残る
  await p.click('#paper [data-act=photo-adopt]');
  await p.waitForTimeout(600);
  R.adopted = await p.evaluate(() => { const c = curCase(); return { maps: c.maps.map(m => m.y + '年(' + m.w + ')｜' + m.use + '｜' + m.src), verdict: c.verdict.level, concerns: c.concerns.map(x => x.industry + ':' + x.use), gaps: gapsOf(c).map(g => g.k), missMaps: !!document.querySelector('#paper .miss[data-gap=maps]'), photoFig: !!document.getElementById('sec-23f'), review: reviewItems(c).filter(r => /地図|年次/.test(r.area)).map(r => r.sev + ' ' + r.text.slice(0, 40)) }; });
  // 提出用のPDF
  await p.click('#c-mode button[data-m=submit]');
  R.pdfSubmit = await pdf('ai-submit.pdf');
  R.sent = sent;
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
