// デモの通し確認：#demo で自動再生し、最後までエラーなく進むこと／入力例から作成できること
// 使い方: node tests/demo.js index.html [スクリーンショットの出力先]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const out = process.argv[3] || '.';
  const R = {};
  const errs = [];
  // ── 自動再生 ──
  let p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + path.resolve(process.argv[2]) + '#demo');
  const shots = [[3000, 'login'], [12000, 'new-addr'], [26000, 'new-files'], [36000, 'processing'], [50000, 'report'], [70000, 'side']];
  let t0 = Date.now();
  for (const [ms, name] of shots) { await p.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); await p.screenshot({ path: path.join(out, 'demo-' + name + '.png') }); R['cap@' + name] = await p.textContent('#demo-cap'); }
  await p.waitForFunction(() => typeof DEMO !== 'undefined' && DEMO.done, null, { timeout: 120000 });
  R.auto = await p.evaluate(() => { const c = curCase(); return { route: ST.route, demo: !!c.demo, area: c.site.area, title: c.title, verdict: c.verdict.level, subs: c.substances.length, land: c.land.length, maps: c.maps.length, corps: c.corps.length, docs: c.docs.map(d => d.id + ':' + d.kind), review: reviewItems(c).filter(r => !r.done && r.sev !== 'info').map(r => r.area + ' ' + r.text.slice(0, 46)), chips22: [...document.querySelectorAll('#sec-22 .ev')].map(e => e.textContent), cap: document.getElementById('demo-cap').textContent, sec: (Date.now() - performance.timeOrigin) / 1000 | 0 }; });
  await p.screenshot({ path: path.join(out, 'demo-end.png') });
  // 停止ボタンで字幕バーが閉じる
  await p.click('#demo-stop');
  R.barClosed = await p.isHidden('#demobar');
  // ── 入力例から作成（別の利用者） ──
  p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + path.resolve(process.argv[2]));
  await p.click('#l-demo');
  await p.waitForTimeout(600);
  await p.click('#b-new');
  await p.click('#n-fill');
  await p.waitForTimeout(400);
  R.fill = { addr: await p.inputValue('#n-addr'), files: await p.$$eval('#n-files .file', els => els.map(e => e.querySelector('.fk').textContent)), ai: (await p.textContent('#n-ai')).slice(0, 40) };
  await p.click('#n-run');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 60000 });
  R.fillCase = await p.evaluate(() => { const c = curCase(); return { verdict: c.verdict.level, subs: c.substances.length, demoCases: ST.cases.filter(x => x.demo).length }; });
  // 途中で停止できる
  await p.click('#c-back');
  await p.click('#b-demo');
  await p.waitForTimeout(2500);
  await p.click('#demo-stop');
  await p.waitForTimeout(2500);
  R.stopped = await p.evaluate(() => ({ on: DEMO.on, bar: document.getElementById('demobar').hidden }));
  // スマホ幅
  await p.setViewportSize({ width: 400, height: 800 });
  await p.click('#top .nav button[data-r=cases]');
  await p.waitForTimeout(300);
  R.mobileOverflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
