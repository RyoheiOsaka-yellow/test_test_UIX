// デモ②（資料のない土地）の通し確認：#demo2 で自動再生し、未取得の赤枠・年代別空中写真・所見の保留が出ること
// 使い方: node tests/demo2.js index.html [出力先dir]
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
  await p.goto('file://' + path.resolve(process.argv[2]) + '#demo2');
  const caps = [];
  const t0 = Date.now();
  let last = '';
  while (!(await p.evaluate(() => typeof DEMO !== 'undefined' && DEMO.done)) && Date.now() - t0 < 200000) {
    const c = await p.textContent('#demo-cap');
    if (c && c !== last) { last = c; caps.push(((Date.now() - t0) / 1000 | 0) + 's ' + c.slice(0, 44)); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(out, 'd2-' + String(caps.length).padStart(2, '0') + '.png') }); }
    await p.waitForTimeout(300);
  }
  const R = await p.evaluate(() => {
    const c = curCase(); const sh = [...document.querySelectorAll('#paper .sheet')]; const H = sh[0].offsetHeight;
    return {
      done: DEMO.done, route: ST.route, title: c.title, demo: c.demo, kind: c.demoKind, verdict: c.verdict.level, headline: document.querySelector('#paper .shh').innerText, badge: document.querySelector('.ws-head .lvl').className,
      gaps: gapsOf(c).map(g => g.k), miss: [...document.querySelectorAll('#paper .miss')].map(e => e.dataset.gap + ':' + e.querySelector('.mt').textContent.slice(0, 14)), ngv: document.querySelectorAll('#paper .ngv').length,
      bar: document.getElementById('c-gaps').innerText.slice(0, 60), draft: (document.querySelector('#paper .draft') || {}).innerText,
      photos: [...document.querySelectorAll('#paper .ph')].map(f => f.querySelector('figcaption').textContent + (f.querySelector('.tfig').classList.contains('none') ? ' ×なし' : ' ○')),
      gw: (c.site.gwText || '').slice(0, 60), gwDir: c.site.gwDir, laws: [...document.querySelectorAll('#paper .law')].map(e => e.innerText.split('\n')[0]),
      judge: judge(c).filter(r => r.st[0] !== 'no').map(r => r.law.replace(/（.*?）/g, '').slice(0, 14) + ' ' + r.art + '：' + r.st[1]),
      fac: (document.querySelector('#paper .miss[data-gap=fac]') || {}).innerText,
      sheets: sh.length, over: sh.filter(s => s.offsetHeight > H + 2).length, toc: [...document.querySelectorAll('#paper .toc a')].map(a => a.querySelector('span').textContent.slice(0, 8) + a.querySelector('b').textContent).join(' '),
      review: reviewItems(c).filter(r => !r.done).map(r => r.sev + ' ' + r.area + ' ' + r.text.slice(0, 30)), sec: (Date.now() - performance.timeOrigin) / 1000 | 0,
    };
  });
  // 仮の文言のまま欄を離れても保存されないこと、書き込めば保存されること
  await p.click('#demo-stop');
  R.ph = await p.evaluate(async () => { const c = curCase(); const el = document.querySelector('#paper [data-path="period"]'); el.focus(); el.blur(); const a = c.period; el.focus(); el.textContent = '令和8年11月21日～令和8年12月5日'; el.blur(); return { afterEmptyBlur: a, afterEdit: c.period }; });
  // 印刷
  await p.evaluate(() => { window.print = () => { window.__printed = true; }; document.getElementById('c-pdf').click(); });
  await p.waitForFunction(() => window.__printed, null, { timeout: 15000 });
  await p.emulateMedia({ media: 'print' });
  fs.writeFileSync(path.join(out, 'demo2.pdf'), await p.pdf({ preferCSSPageSize: true, printBackground: true }));
  // 資料（ヒアリング）を1点足すと、該当する赤枠が消えること
  R.afterAdd = await p.evaluate(() => { const c = curCase(); c.hearing.push({ date: '令和8年11月25日', by: '担当者', target: '土地所有者', text: '昭和40年頃から倉庫として使用しており、有害物質の取扱いは無かったとの回答を得た。' }); finalizeCase(c, true); saveCases(); drawPaper(); return { hearingGapGone: !gapsOf(c).some(g => g.k === 'hearing'), gaps: gapsOf(c).map(g => g.k), verdict: c.verdict.level, miss: document.querySelectorAll('#paper .miss').length }; });
  console.log(JSON.stringify({ caps, R }, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
