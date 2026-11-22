// 地下水の到達距離：付録の表示と、「判断」タブでの土質・動水勾配の変更の確認
// 使い方: node tests/gw-ui.js index.html [出力先dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[3] || '.';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + path.resolve(process.argv[2]));
  await p.addStyleTag({ content: '#toast{display:none!important}' });
  await p.click('#l-demo'); await p.waitForTimeout(400);
  const R = {};
  // 既往報告書のサンプル（標高が無い）には付録が出ない。動水勾配を入れると出る
  await p.click('.crow[data-id="s-komagawa"]'); await p.waitForTimeout(1200);
  R.sampleBefore = await p.evaluate(() => ({ app: !!document.getElementById('sec-gw'), toc: tocOf(curCase()).map(t => t[1]).filter(x => /付録/.test(x)) }));
  await p.click('.tabs2 button[data-t="judge"]'); await p.waitForTimeout(300);
  await p.selectOption('#g-soil', 'sand'); await p.waitForTimeout(300);
  await p.fill('#g-i', '1/200'); await p.dispatchEvent('#g-i', 'change'); await p.waitForTimeout(600);
  R.sampleAfter = await p.evaluate(() => ({ app: !!document.getElementById('sec-gw'), toc: tocOf(curCase()).map(t => t[1]).filter(x => /付録/.test(x)), gw: curCase().gw, rows: [...document.querySelectorAll('#paper .gwt tbody tr')].length, cond: [...document.querySelectorAll('#paper .gwc tr')].map(r => r.innerText.replace(/\s+/g, ' ')) }));
  await p.click('#c-back');
  // 資料なしの案件：標高からの勾配、土質は不明（礫）
  await p.evaluate(() => { ST.files = []; ST.draft = Object.assign({ geoTitle: '' }, DEMO2_INPUT); go('new'); });
  await p.click('#n-run');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 60000 }); await p.waitForTimeout(2500);
  R.nofile = await p.evaluate(() => { const c = curCase(); const t = gwTable(c); return { i: t.st.i, iSrc: t.st.iSrc, soil: t.st.soil.name, known: t.st.soilKnown, rows: t.rows.length, first: [...document.querySelectorAll('#paper .gwt tbody tr')].slice(0, 2).map(r => r.innerText.replace(/\s+/g, ' ')), review: reviewItems(c).filter(r => r.area === '地下水の到達距離').map(r => r.text.slice(0, 40)), src: sourcesOf(c).filter(s => /計算ツール/.test(s.kind)).map(s => s.title + ' 等級' + s.tier), over: [...document.querySelectorAll('#paper .sheet')].filter(s => s.offsetHeight > 1125).length }; });
  await p.click('.tabs2 button[data-t="judge"]'); await p.waitForTimeout(300);
  // 入力の検査：不正な値は受け付けない
  await p.fill('#g-i', '-1'); await p.dispatchEvent('#g-i', 'change'); await p.waitForTimeout(300);
  R.invalid = await p.evaluate(() => curCase().gw || null);
  await p.selectOption('#g-soil', 'sand'); await p.waitForTimeout(400);
  await p.fill('#g-i', '0.005'); await p.dispatchEvent('#g-i', 'change'); await p.waitForTimeout(700);
  R.changed = await p.evaluate(() => { const c = curCase(); const cd = GW_SUBS.find(s => s.sub === 'Cd'); const g = gwReach(cd, GW_SOILS.find(s => s.id === 'sand'), 0.005); const row = [...document.querySelectorAll('#paper .gwt tbody tr')].find(r => /カドミウム/.test(r.innerText)); return { gw: c.gw, calc: [g.d, g.rank], row: row.innerText.replace(/\s+/g, ' '), side: document.querySelector('#side .gwr').innerText.replace(/\s+/g, ' ').slice(0, 120), review: reviewItems(c).filter(r => r.area === '地下水の到達距離').length }; });
  await p.evaluate(() => document.getElementById('sec-gw').scrollIntoView({ block: 'start' })); await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(out, 'gw-app.png') });
  // 対象物質を選ぶと、その物質だけの表になる
  R.selected = await p.evaluate(() => { const c = curCase(); c.substances = ['TCE', 'Pb']; drawPaper(); return [...document.querySelectorAll('#paper .gwt tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')); });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
