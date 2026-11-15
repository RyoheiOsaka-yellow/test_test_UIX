// 使い方マニュアルを PDF にする： node build_pdf.js  →  ../ecowin-gym-twin-manual.pdf
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.join(__dirname, 'manual.html')); await pg.waitForLoadState('networkidle');
  const missing = await pg.evaluate(() => [].filter.call(document.images, i => !i.naturalWidth).map(i => i.getAttribute('src')));
  if (missing.length) console.log('画像がありません:', missing.join(', '));
  await pg.pdf({ path: path.join(__dirname, '../ecowin-gym-twin-manual.pdf'), format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#7b8794;padding:0 14mm;display:flex;justify-content:space-between;font-family:IPAPGothic,sans-serif"><span>体育館デジタルツイン 使い方マニュアル</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '15mm', bottom: '16mm', left: '14mm', right: '14mm' } });
  await b.close(); console.log('ok');
})();
