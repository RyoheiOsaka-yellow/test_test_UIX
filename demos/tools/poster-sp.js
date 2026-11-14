// スマホ用ポスター: デモを縦長の画面で撮り、webp にする
// usage: node demos/tools/poster-sp.js <demo.html> <out.webp> [w] [h] [q]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [SRC, OUT, W = 390, H = 844, Q = 0.8] = process.argv.slice(2);
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const pg = await ctx.newPage();
  await pg.goto('file://' + SRC); await pg.waitForTimeout(1200);
  const png = await pg.screenshot({ type: 'png' });
  const b64 = await pg.evaluate(async ([p, q]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + p; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/webp', q).split(',')[1];
  }, [png.toString('base64'), +Q]);
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64')); fs.writeFileSync(OUT.replace(/\.webp$/, '.png'), png);
  console.log(OUT, fs.statSync(OUT).size, 'bytes');
  await br.close();
})();
