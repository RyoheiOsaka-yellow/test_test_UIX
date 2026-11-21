// 紙面の確認：案件を開き、各ページを画像にして並べる。印刷用PDFのページ数も数える
// 使い方: node shots.js <index.html> <案件id> <出力先dir> [幅]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [, , html, id, out, w] = process.argv;
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w || 1500, height: 1000 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(html));
  await p.click('#l-demo');
  await p.waitForTimeout(500);
  await p.click('.crow[data-id="' + id + '"]');
  await p.waitForTimeout(3500);
  const info = await p.evaluate(() => {
    const sh = [...document.querySelectorAll('#paper .sheet')];
    const H = sh[0].offsetHeight;
    return {
      font: getComputedStyle(document.querySelector('#paper .sheet')).fontFamily.slice(0, 40), biz: document.fonts.check('10.5pt "BIZ UDGothic"'), zoom: document.getElementById('paper').style.zoom, H,
      sheets: sh.map((s, i) => i + ':' + (s.className.replace('sheet', '').trim() || '-') + ' p' + ((s.querySelector('.pno') || {}).textContent || '') + ' h' + s.offsetHeight + (s.offsetHeight > H + 2 ? ' OVER' : '') + ' ' + (s.querySelector('h2,h3,h4,.lb') || { textContent: '' }).textContent.slice(0, 16)),
      toc: [...document.querySelectorAll('#paper .toc a')].map(a => a.querySelector('span').textContent + '…' + a.querySelector('b').textContent).join(' / '),
      notes: [...document.querySelectorAll('#paper .fnotes>div')].map(d => d.innerText.replace(/\s+/g, ' ').slice(0, 70)),
      wide: sh.filter(s => s.scrollWidth > s.clientWidth + 1).length,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  const n = await p.$$eval('#paper .sheet', e => e.length);
  for (let i = 0; i < n; i++) { const el = (await p.$$('#paper .sheet'))[i]; await el.screenshot({ path: path.join(out, 's' + String(i).padStart(2, '0') + '.png') }); }
  // 印刷：PDFにしてページ数を数える
  await p.evaluate(() => { window.print = () => { window.__printed = true; }; document.getElementById('c-pdf').click(); });
  await p.waitForFunction(() => window.__printed, null, { timeout: 12000 });
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(out, 'print.pdf'), pdf);
  console.log('sheets', n, 'pdf bytes', pdf.length, 'ERR', errs);
  await b.close();
})();
