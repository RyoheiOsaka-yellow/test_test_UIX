// 保存（版）、プレビュー、共有リンク、ファイルへの保存と読み込み、プレビューからの印刷の確認
// 使い方: node tests/share.js index.html [出力先dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[3] || '.';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const file = 'file://' + path.resolve(process.argv[2]);
  await p.goto(file);
  await p.click('#l-demo');
  await p.waitForTimeout(400);
  await p.click('.crow[data-id="s-kawasaki"]');
  await p.waitForTimeout(1500);
  const R = {};
  // 保存：本文を直して保存 → もう一度直して保存 → 最初の版に戻す
  const edit = async txt => { await p.evaluate(t => { const el = document.querySelector('#paper [data-path="verdict.text"]'); el.focus(); el.textContent = t; el.blur(); }, txt); };
  await edit('版1の所見。'); await p.click('#c-save'); await p.waitForTimeout(300);
  await edit('版2の所見。'); await p.click('#c-save'); await p.waitForTimeout(300);
  R.save = await p.evaluate(() => { const c = curCase(); const vs = store.get('ver.' + c.id); return { status: document.getElementById('c-savest').textContent, versions: vs.length, texts: vs.map(v => v.data.verdict.text), now: c.verdict.text }; });
  await p.click('.tabs2 button[data-t="docs"]');
  await p.waitForTimeout(200);
  R.verList = await p.$$eval('#side .ver', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  await p.click('#side [data-ver="1"]');
  await p.waitForTimeout(400);
  R.restored = await p.evaluate(() => ({ text: curCase().verdict.text, paper: document.querySelector('#paper [data-path="verdict.text"]').innerText }));
  // ファイルに保存 → 読み込み
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#d-json')]);
  const fpath = path.join(out, 'case.json'); await dl.saveAs(fpath);
  await p.click('#c-back');
  await p.setInputFiles('#b-file', fpath);
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 10000 });
  R.imported = await p.evaluate(() => ({ id: curCase().id, sample: curCase().sample, title: curCase().title, text: curCase().verdict.text, count: ST.cases.length }));
  // プレビュー → 共有リンク
  await p.click('#c-prev');
  await p.waitForTimeout(1500);
  R.preview = await p.evaluate(() => ({ route: ST.route, sheets: document.querySelectorAll('#paper .sheet').length, editable: document.querySelectorAll('#paper [contenteditable]').length, top: document.getElementById('top').hidden, pages: [...document.querySelectorAll('#paper .pno')].pop().textContent }));
  await p.screenshot({ path: path.join(out, 'preview.png') });
  await p.click('#p-share');
  await p.waitForTimeout(600);
  const url = await p.inputValue('#p-url');
  R.share = { kb: Math.round(url.length / 1024), head: url.slice(0, 40).replace(/.*\//, '…/'), box: (await p.innerText('#p-urlbox')).slice(0, 90), clip: await p.evaluate(() => navigator.clipboard.readText().then(t => t.length).catch(e => 'clipboard:' + e.name)) };
  // 提出用に切り替えると付録が外れる
  await p.click('#p-mode button[data-m=submit]');
  await p.waitForTimeout(800);
  R.previewSubmit = await p.evaluate(() => ({ sheets: document.querySelectorAll('#paper .sheet').length, app: document.querySelectorAll('#paper .sheet.app').length }));
  await p.click('#p-mode button[data-m=check]');
  // 共有リンクを、ログインしていない別の利用者として開く：まずログイン画面、ログイン後にプレビュー
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await ctx2.newPage();
  q.on('pageerror', e => errs.push('SHARED PAGEERROR ' + e.message));
  await q.goto(url);
  await q.waitForFunction(() => !!ST.shared, null, { timeout: 15000 });
  R.sharedLogin = await q.evaluate(() => ({ route: ST.route, loginShown: !!document.getElementById('lf'), note: (document.querySelector('.sharednote') || {}).textContent, paper: !!document.getElementById('paper') }));
  await q.screenshot({ path: path.join(out, 'shared-login.png') });
  await q.click('#l-demo');
  await q.waitForFunction(() => ST.route === 'preview' && document.querySelectorAll('#paper .sheet').length > 0, null, { timeout: 15000 });
  await q.waitForTimeout(1500);
  R.shared = await q.evaluate(() => ({ user: !!ST.user, route: ST.route, title: document.querySelector('.pvh h1').textContent, tag: document.querySelector('.pvh .tag').textContent, sheets: document.querySelectorAll('#paper .sheet').length, text: document.querySelector('#paper .sht').innerText.slice(0, 20), topShown: !document.getElementById('top').hidden, shareBtn: !!document.getElementById('p-share'), editable: document.querySelectorAll('#paper [contenteditable]').length, zoom: document.getElementById('paper').style.zoom, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  await q.screenshot({ path: path.join(out, 'shared.png') });
  // 共有プレビューから印刷
  await q.evaluate(() => { window.print = () => { window.__printed = true; }; document.getElementById('p-pdf').click(); });
  await q.waitForFunction(() => window.__printed, null, { timeout: 15000 });
  await q.emulateMedia({ media: 'print' });
  fs.writeFileSync(path.join(out, 'shared.pdf'), await q.pdf({ preferCSSPageSize: true, printBackground: true }));
  // 壊れたリンク
  const q2 = await ctx2.newPage();
  await q2.goto(file + '#p=1AAAA');
  await q2.waitForTimeout(1200);
  R.badLink = await q2.evaluate(() => ({ route: ST.route, toast: document.getElementById('toast').textContent.slice(0, 30) }));
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
