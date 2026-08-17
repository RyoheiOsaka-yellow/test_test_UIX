const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file://' + __dirname + '/manual.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.pdf({ path: 'HICity_3Dダッシュボード_使用マニュアル.pdf', format: 'A4', printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' } });
  await b.close();
})();
