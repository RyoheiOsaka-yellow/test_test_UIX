// 現行サイトの <article class="sheet" id="case-NN"> 17件を構造化JSONへ抽出する。
// 画像は assets/case/ へ書き出し、本文はそのまま持ち越す（内容は改変しない）。
const fs = require('fs');
// 【一回限りの移行用】旧サイトの index.html から cases.json を作り直すスクリプト。
// 通常の運用（事例の追加・修正）では使わない。cases.json を直接編集すること。
//   使い方: node extract-cases.js <旧サイトのindex.htmlのパス>
const SRC = process.argv[2];
if (!SRC) { console.error('使い方: node extract-cases.js <旧サイトのindex.htmlのパス>'); process.exit(1); }
const OUT_IMG = __dirname + '/assets/case/';
const OUT_JSON = __dirname + '/cases.json';

const h = fs.readFileSync(SRC, 'utf8');
fs.rmSync(OUT_IMG, { recursive: true, force: true });
fs.mkdirSync(OUT_IMG, { recursive: true });

const parts = h.split(/(?=<article class="sheet" id="case-\d+")/).slice(1);
const cases = [];
let imgN = 0;

function textOf(s) { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

for (const raw of parts) {
  const art = raw.slice(0, raw.indexOf('</article>') + 10);
  const id = /id="(case-\d+)"/.exec(art)[1];
  const key = (/data-key="([^"]*)"/.exec(art) || [, id])[1];
  const tags = (/data-tags="([^"]*)"/.exec(art) || [, ''])[1];
  const eyebrow = textOf((/<p class="eyebrow">([\s\S]*?)<\/p>/.exec(art) || [, ''])[1]);
  const title = textOf((/<h1 class="title">([\s\S]*?)<\/h1>/.exec(art) || [, ''])[1]);
  const lead = textOf((/<p class="lead">([\s\S]*?)<\/p>/.exec(art) || [, ''])[1]);
  const demo = (/<a class="demo-link" href="([^"]+)"/.exec(art) || [, ''])[1];

  // 画像をファイルへ
  const imgs = [];
  const imgRe = /<img[^>]*src="data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)"[^>]*>/g;
  let m;
  while ((m = imgRe.exec(art)) !== null) {
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const alt = (/alt="([^"]*)"/.exec(m[0]) || [, ''])[1];
    const name = key + '-' + String(++imgN).padStart(2, '0') + '.' + ext;
    fs.writeFileSync(OUT_IMG + name, Buffer.from(m[2], 'base64'));
    imgs.push({ src: '/assets/case/' + name, alt: alt || title });
  }

  // 本文（案件背景 / できること / 活用シーン）
  const bodyHtml = (/<div class="body">([\s\S]*?)<\/div>/.exec(art) || [, ''])[1];
  const sections = [];
  const secParts = bodyHtml.split(/<h2 class="h2">/).slice(1);
  for (const sp of secParts) {
    const heading = textOf(sp.slice(0, sp.indexOf('</h2>')));
    const rest = sp.slice(sp.indexOf('</h2>') + 5);
    const paras = [...rest.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x => textOf(x[1])).filter(Boolean);
    const items = [...rest.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => textOf(x[1])).filter(Boolean);
    sections.push({ heading, paras, items });
  }

  // 仕様表
  const specHtml = (/<table class="spec">([\s\S]*?)<\/table>/.exec(art) || [, ''])[1];
  const spec = [...specHtml.matchAll(/<tr><th>([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)]
    .map(x => [textOf(x[1]), textOf(x[2])]);

  cases.push({ id, key, tags, eyebrow, title, lead, demo, imgs, sections, spec });
}

fs.writeFileSync(OUT_JSON, JSON.stringify(cases, null, 2));
console.log('抽出:', cases.length, '件 / 画像', imgN, '枚 →', OUT_IMG);
const bytes = fs.readdirSync(OUT_IMG).reduce((t, f) => t + fs.statSync(OUT_IMG + f).size, 0);
console.log('画像合計: %sMB', (bytes / 1048576).toFixed(1));
for (const c of cases) {
  console.log(' ', c.key.padEnd(24), c.title.slice(0, 26).padEnd(28),
    'sec:' + c.sections.length, 'spec:' + c.spec.length, 'img:' + c.imgs.length);
}
