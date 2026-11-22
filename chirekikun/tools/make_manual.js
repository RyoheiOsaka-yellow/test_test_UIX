// 操作マニュアルを作る：実際の画面を撮影し、manual/manual.src.html の {{img:名前|説明}} に埋め込んで manual.html を出力する。
// 画面を変えたら、作り直す。  使い方: node tools/make_manual.js [index.html]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
(async () => {
  const app = 'file://' + path.resolve(process.argv[2] || path.join(root, 'index.html'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const shots = {};
  const shot = async (name, opt) => { shots[name] = (await p.screenshot(Object.assign({ type: 'jpeg', quality: 74 }, opt || {}))).toString('base64'); };
  const el = async (name, sel) => { shots[name] = (await (await p.$(sel)).screenshot({ type: 'jpeg', quality: 78 })).toString('base64'); };
  const quiet = () => p.addStyleTag({ content: '#toast{display:none!important}' });
  const to = async id => { await p.evaluate(i => document.getElementById(i).scrollIntoView({ block: 'start' }), id); await p.waitForTimeout(900); };
  await p.goto(app); await quiet();
  await p.fill('#l-mail', 'tanaka@example.co.jp');
  await shot('login');
  await p.click('#l-demo'); await p.waitForTimeout(600);
  await shot('cases');
  // 新しい調査（入力例）→ 作成
  await p.click('#b-new'); await p.click('#n-fill'); await p.waitForTimeout(1800);
  await shot('new', { fullPage: true });
  await p.click('#n-run'); await p.waitForTimeout(2600);
  await shot('proc');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 60000 }); await p.waitForTimeout(2500);
  await shot('report');
  await el('head', '.ws-head');
  await to('sec-22'); await shot('sec22');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.tabs2 button[data-t="judge"]'); await p.waitForTimeout(400); await el('judge', '.ws-side');
  await p.click('.tabs2 button[data-t="docs"]'); await p.waitForTimeout(400); await el('docs', '.ws-side');
  await p.click('.tabs2 button[data-t="review"]');
  // プレビューと共有リンク
  await p.click('#c-prev'); await p.waitForTimeout(1800); await shot('preview');
  await p.click('#p-share'); await p.waitForTimeout(700); await shot('share');
  await p.click('#p-back'); await p.waitForTimeout(500);
  // 資料なしの案件（色分け）
  await p.click('#c-back');
  await p.evaluate(() => { ST.files = []; ST.draft = Object.assign({ geoTitle: '' }, DEMO2_INPUT); go('new'); });
  await p.click('#n-run');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 60000 }); await p.waitForTimeout(3500);
  await shot('gapbar');
  await to('sec-11'); await shot('sec11');
  await to('sec-22'); await shot('blue');
  await to('sec-23'); await shot('sec23');
  await to('sec-23f'); await p.waitForTimeout(2500); await shot('figs');
  await to('sec-gw'); await shot('gw');
  // 設定、法令・条例
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('#top .nav button[data-r=settings]'); await p.waitForTimeout(500); await shot('settings');
  await p.click('#top .nav button[data-r=laws]'); await p.waitForTimeout(700); await shot('laws');
  await b.close();
  let n = 0;
  const d = new Date();
  let html = fs.readFileSync(path.join(root, 'manual', 'manual.src.html'), 'utf8').replace(/\{\{date\}\}/g, `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`);
  html = html.replace(/\{\{img:([a-z0-9]+)\|([^}|]*)(?:\|([a-z]))?\}\}/g, (m, name, cap, cls) => {
    if (!shots[name]) throw new Error('画面の画像がありません: ' + name);
    n++; return `<figure${cls ? ` class="${cls}"` : ''}><img alt="${cap}" src="data:image/jpeg;base64,${shots[name]}"><figcaption>図${n}　${cap}</figcaption></figure>`;
  });
  const left = html.match(/\{\{[^}]*\}\}/g);
  if (left) throw new Error('置き換えられていない箇所: ' + left.join(' '));
  fs.writeFileSync(path.join(root, 'manual.html'), html);
  console.log('manual.html', Math.round(html.length / 1024), 'KB', n, '図', Object.keys(shots).filter(k => !html.includes(shots[k].slice(0, 60))).map(k => '未使用:' + k).join(' '));
})();
