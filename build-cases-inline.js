// 1枚HTML（yellow_spacex_v8.html）の中に、事例一覧と各事例の詳細ページを組み込む。
//   ルート: #/cases（一覧）、#/case/<key>（詳細）。公開用（build-static.js）はこの組み込みを外し、
//   実 URL（/cases/、/cases/<key>/）のページを別に生成する。
//   画像は 1枚目だけ assets/case/_thumb/ のサムネイルを data URI で埋め込む（単体で開いても表示される）。
//   マーカーで囲んであるので、何度流しても置き換わる。
const fs = require('fs'), path = require('path');
const REPO = __dirname + '/';
const { CSS, COMMON, dictFor, casePageHtml, indexPageHtml, productOf } = require('./cases-append.js').parts;

const S_PAGES = '<!-- CASES-INLINE START -->', E_PAGES = '<!-- CASES-INLINE END -->';
const S_CSS = '/* CASES-INLINE CSS START */', E_CSS = '/* CASES-INLINE CSS END */';
const S_DICT = '    /* CASES-INLINE DICT START */', E_DICT = '    /* CASES-INLINE DICT END */';
const JA_ANCHOR = '    meta_title: "株式会社YELLOW",', EN_ANCHOR = '    meta_title: "YELLOW Inc.';

function strip(h) {
  h = h.replace(/\n<!-- CASES-INLINE START -->[\s\S]*?<!-- CASES-INLINE END -->/g, '');
  h = h.replace(/\/\* CASES-INLINE CSS START \*\/[\s\S]*?\/\* CASES-INLINE CSS END \*\/\n/g, '');
  h = h.replace(/    \/\* CASES-INLINE DICT START \*\/\n[\s\S]*?    \/\* CASES-INLINE DICT END \*\/\n/g, '');
  return h;
}

// 公開用の実 URL を、1枚HTML内のハッシュルートへ
function toHash(html) {
  return html
    .replace(/href="\/cases\/([a-z0-9-]+)\/"/g, 'href="#/case/$1"')
    .replace(/href="\/cases\/"/g, 'href="#/cases"')
    .replace(/href="\/(xbuild|xad|xinteractive)\/"/g, 'href="#/$1"')
    .replace(/href="\/#contact"/g, 'href="#contact"')
    .replace(/href="\/"/g, 'href="#top"');
}

function thumbDataUri(src) {
  const t = REPO + 'assets/case/_thumb/' + path.basename(src).replace(/\.[a-z]+$/, '') + '.webp';
  if (!fs.existsSync(t)) return null;
  return 'data:image/webp;base64,' + fs.readFileSync(t).toString('base64');
}

function inline(h) {
  h = strip(h);
  const cases = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'));
  const dicts = cases.map((c, i) => dictFor(c, i));
  // 1枚HTMLでは画像は1枚目だけ（埋め込みサムネイル）。無ければ相対パスにする
  // 画像は一覧カードと詳細の2か所に出るので、data URI は1回だけ持ち、読み込み時に <img> へ配る
  const IMG = {};
  const slim = cases.map(c => {
    const first = c.imgs[0];
    if (!first) return { ...c, imgs: [] };
    const uri = thumbDataUri(first.src);
    if (uri) { IMG[c.key] = uri; return { ...c, imgs: [{ src: '__CASEIMG__' + c.key + '__', alt: first.alt }] }; }
    return { ...c, imgs: [{ src: first.src.replace(/^\//, ''), alt: first.alt }] };
  });
  const slimDicts = dicts.map(d => ({ ...d, e: { ...d.e, alts: d.e.alts.slice(0, 1) } }));

  let pages = indexPageHtml(slim, slimDicts).replace('<div class="page active" id="page-cases">', '<div class="page" id="page-cases">');
  slim.forEach((c, i) => {
    pages += casePageHtml(c, productOf(c.eyebrow), slimDicts[i])
      .replace('<div class="page active" id="page-case">', '<div class="page" id="page-case-' + c.key + '">');
  });
  pages = toHash(pages);
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  pages = pages.replace(/src="__CASEIMG__([a-z0-9-]+)__"/g, 'src="' + BLANK + '" data-case-img="$1"');
  pages += '<script>window.__CASE_IMG=' + JSON.stringify(IMG) + ';'
    + '(function(){var M=window.__CASE_IMG,n=document.querySelectorAll("[data-case-img]");'
    + 'for(var i=0;i<n.length;i++){var u=M[n[i].getAttribute("data-case-img")];if(u)n[i].src=u;}})();</script>\n';

  // ページ: サイト側の </main> の直前（デモのテンプレートより前にあることを確認する）
  const mi = h.indexOf('\n</main>');
  const ti = h.indexOf('<template id="tpl-demo');
  if (mi === -1 || (ti !== -1 && mi > ti)) throw new Error('cases-inline: </main> の位置が特定できません');
  h = h.slice(0, mi) + '\n' + S_PAGES + '\n' + pages + E_PAGES + h.slice(mi);

  // CSS
  const cssAnchor = '/* 法務ページ（プライバシーポリシー・利用規約） */';
  if (!h.includes(cssAnchor)) throw new Error('cases-inline: CSS anchor');
  h = h.replace(cssAnchor, S_CSS + '\n' + CSS + '\n' + E_CSS + '\n' + cssAnchor);

  // 辞書（共通ラベル＋全事例）
  const ja = {}, en = {};
  for (const [k, [j, g]] of Object.entries(COMMON)) { ja[k] = j; en[k] = g; }
  dicts.forEach(d => { Object.assign(ja, d.ja); Object.assign(en, d.en); });
  const lines = o => Object.entries(o).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',\n').join('');
  if (!h.includes(JA_ANCHOR) || !h.includes(EN_ANCHOR)) throw new Error('cases-inline: 辞書のアンカー');
  h = h.replace(JA_ANCHOR, S_DICT + '\n' + lines(ja) + E_DICT + '\n' + JA_ANCHOR)
       .replace(EN_ANCHOR, S_DICT + '\n' + lines(en) + E_DICT + '\n' + EN_ANCHOR);
  return h;
}

module.exports = { inline, strip };

if (require.main === module) {
  const P = REPO + 'yellow_spacex_v8.html';
  const before = fs.readFileSync(P, 'utf8');
  const after = inline(before);
  fs.writeFileSync(P, after);
  console.log('事例ページを1枚HTMLに組み込み: ' + ((after.length - strip(before).length) / 1024).toFixed(0) + 'KB 追加 / HTML ' + (after.length / 1048576).toFixed(2) + 'MB');
}
