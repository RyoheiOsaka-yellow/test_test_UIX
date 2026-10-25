// 各事例の1枚目の画像から、1枚HTMLに埋め込む用の小さなサムネイル（最大 960px・WebP）を作る
// usage: node demos/tools/case-thumbs.js   → assets/case/_thumb/<元ファイル名>.webp
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..', '..') + '/';
const cases = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'));
const OUT = REPO + 'assets/case/_thumb/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const pg = await br.newPage(); await pg.setContent('<canvas id="c"></canvas>');
  let n = 0, total = 0;
  const NEWS = require(REPO + 'news-append.js');
  // 事例は全画像（1枚目は 800px、2枚目以降は 640px・やや強めの圧縮で1枚HTMLの重さを抑える）
  const jobs = cases.flatMap(c => c.imgs.map((im, i) => ({ src: im.src, out: OUT, w: i ? 560 : 800, q: i ? 0.55 : 0.68 })))
    .concat(NEWS.images(NEWS.load()).map(im => ({ src: im.src, out: REPO + 'assets/news/_thumb/', w: 800, q: 0.68 })));
  fs.mkdirSync(REPO + 'assets/news/_thumb/', { recursive: true });
  for (const job of jobs) {
    const src = job.src; if (!src) continue;
    const file = REPO + src.replace(/^\//, '');
    if (!fs.existsSync(file)) { console.log('  なし:', src); continue; }
    const out = job.out + path.basename(file).replace(/\.[a-z]+$/, '') + '.webp';
    const mime = /\.png$/i.test(file) ? 'image/png' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/webp';
    const data = 'data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
    const res = await pg.evaluate(async ([d, maxW, q]) => {
      const im = new Image(); im.src = d; await im.decode();
      const W = Math.min(maxW, im.naturalWidth), H = Math.round(im.naturalHeight * W / im.naturalWidth);
      const cv = document.getElementById('c'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(im, 0, 0, W, H);
      return cv.toDataURL("image/webp", q);
    }, [data, job.w || 800, job.q || 0.68]);
    const buf = Buffer.from(res.split(',')[1], 'base64');
    fs.writeFileSync(out, buf); n++; total += buf.length;
    console.log('  ' + path.basename(out).padEnd(40), (buf.length >> 10) + 'KB');
  }
  console.log('サムネイル ' + n + ' 枚 / 合計 ' + (total >> 10) + 'KB → assets/case/_thumb/');
  await br.close();
})();
