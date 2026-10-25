// 1枚HTML（yellow_spacex_v8.html）に、事例とお知らせを組み込む。
//   トップ: 「Selected Cases」（cases.json で home:true の事例カード）と「News」（news.json の最新4件）
//   ページ: #/cases（事例一覧）、#/case/<key>（事例詳細）、#/news（お知らせ一覧）
//   公開用（build-static.js）は「ページ」の組み込みだけを外して実 URL のページを別に生成し、
//   トップのセクション・そのCSS・辞書はそのまま使う。
//   画像は各事例の1枚目のサムネイル（assets/case/_thumb/）を data URI で1回だけ持ち、読み込み時に <img> へ配る。
//   すべてマーカーで囲んであるので、何度流しても置き換わる。
const fs = require('fs'), path = require('path');
const REPO = __dirname + '/';
const { CSS, COMMON, dictFor, casePageHtml, indexPageHtml, productOf, esc } = require('./cases-append.js').parts;
const NEWS = require('./news-append.js');

const S_PAGES = '<!-- CASES-INLINE START -->', E_PAGES = '<!-- CASES-INLINE END -->';
const S_CSS = '/* CASES-INLINE CSS START */', E_CSS = '/* CASES-INLINE CSS END */';
const S_DICT = '    /* CASES-INLINE DICT START */', E_DICT = '    /* CASES-INLINE DICT END */';
const S_HOME = '<!-- HOME-SECTIONS START -->', E_HOME = '<!-- HOME-SECTIONS END -->';
const S_HCSS = '/* HOME-SECTIONS CSS START */', E_HCSS = '/* HOME-SECTIONS CSS END */';
const S_HDICT = '    /* HOME-SECTIONS DICT START */', E_HDICT = '    /* HOME-SECTIONS DICT END */';
const JA_ANCHOR = '    meta_title: "株式会社YELLOW",', EN_ANCHOR = '    meta_title: "YELLOW Inc.';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// 公開用が外す部分（組み込みページ・そのCSS・その辞書）。トップのセクション類は残す
function strip(h) {
  h = h.replace(/\n<!-- CASES-INLINE START -->[\s\S]*?<!-- CASES-INLINE END -->/g, '');
  h = h.replace(/\/\* CASES-INLINE CSS START \*\/[\s\S]*?\/\* CASES-INLINE CSS END \*\/\n/g, '');
  h = h.replace(/    \/\* CASES-INLINE DICT START \*\/\n[\s\S]*?    \/\* CASES-INLINE DICT END \*\/\n/g, '');
  return h;
}
function stripHome(h) {
  h = h.replace(/\n<!-- HOME-SECTIONS START -->[\s\S]*?<!-- HOME-SECTIONS END -->/g, '');
  h = h.replace(/\/\* HOME-SECTIONS CSS START \*\/[\s\S]*?\/\* HOME-SECTIONS CSS END \*\/\n/g, '');
  h = h.replace(/    \/\* HOME-SECTIONS DICT START \*\/\n[\s\S]*?    \/\* HOME-SECTIONS DICT END \*\/\n/g, '');
  return h;
}

// 公開用の実 URL → 1枚HTML内のハッシュルート
function toHash(html) {
  return html
    .replace(/href="\/cases\/([a-z0-9-]+)\/"/g, 'href="#/case/$1"')
    .replace(/href="\/cases\/"/g, 'href="#/cases"')
    .replace(/href="\/news\/([a-z0-9-]+)\/"/g, 'href="#/news/$1"')
    .replace(/href="\/news\/"/g, 'href="#/news"')
    .replace(/href="\/(xbuild|xad|xinteractive)\/"/g, 'href="#/$1"')
    .replace(/href="\/#contact"/g, 'href="#contact"')
    .replace(/href="\/"/g, 'href="#top"');
}

function thumbFile(src) { return (src.indexOf('/assets/news/') === 0 ? 'assets/news/_thumb/' : 'assets/case/_thumb/') + path.basename(src).replace(/\.[a-z]+$/, '') + '.webp'; }
function newsThumbFile(src) { return 'assets/news/_thumb/' + path.basename(src).replace(/\.[a-z]+$/, '') + '.webp'; }
function thumbDataUri(src) {
  const t = REPO + thumbFile(src);
  return fs.existsSync(t) ? 'data:image/webp;base64,' + fs.readFileSync(t).toString('base64') : null;
}
// 公開用で data-case-img を実ファイルへ戻すための対応表 {key: '/assets/case/_thumb/x.webp'}
function thumbSrcMap() {
  const cases = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'));
  const m = {};
  cases.forEach(c => c.imgs.forEach((im, i) => {
    const v = '/' + (fs.existsSync(REPO + thumbFile(im.src)) ? thumbFile(im.src) : im.src.replace(/^\//, ''));
    if (i === 0) m[c.key] = v;
    m[c.key + ':' + i] = v;
  }));
  NEWS.images(NEWS.load()).forEach(im => { m[im.key] = im.src; });   // お知らせの画像は実ファイルそのまま
  return m;
}

const lines = o => Object.entries(o).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',\n').join('');

function featuredCardsHtml(cases, dicts) {
  const feats = cases.map((c, i) => [c, dicts[i]]).filter(([c]) => c.home).slice(0, 4);
  return feats.map(([c, d], i) => {
    const prod = productOf(c.eyebrow);
    return `    <a class="card rv"${i ? ` data-d="${i}"` : ''} href="/cases/${c.key}/">
      <div class="card__img"><img src="${BLANK}" data-case-img="${c.key}" alt="${esc(d.e.title)}" loading="lazy" decoding="async"></div>
      <div class="card__body">
        <div class="card__meta"><span>${prod ? prod.label : 'Record'}</span><span data-i18n="${d.p}tags">${esc(d.e.tags)}</span></div>
        <h3 class="card__title" data-i18n="${d.p}title">${esc(d.e.title)}</h3>
        <p class="card__text" data-i18n="${d.p}lead">${esc(d.e.lead)}</p>
        <div class="card__more" data-i18n="btn_read">Read more →</div>
      </div>
    </a>`;
  }).join('\n');
}

function homeSectionsHtml(cases, dicts, news, faq) {
  return `<!-- ═══════════════════ CASES（トップ） ═══════════════════ -->
<section class="sec" id="selected-cases">
  <div class="sec__head">
    <p class="eyebrow rv" data-i18n="rec_tag">${NEWS.COMMON.rec_tag[1]}</p>
    <h2 class="title rv" data-d="1" data-i18n="rec_title">${NEWS.COMMON.rec_title[1]}</h2>
    <p class="lede rv" data-d="2" data-i18n="rec_lede">${NEWS.COMMON.rec_lede[1]}</p>
  </div>

  <div class="grid4">
${featuredCardsHtml(cases, dicts)}
  </div>
  <p class="sec__more rv"><a class="btn" href="/cases/" data-i18n="nav_cases_view">View cases →</a></p>
</section>

<!-- ═══════════════════ NEWS（トップ） ═══════════════════ -->
${NEWS.homeSectionHtml(news)}

<!-- ═══════════════════ FAQ（トップ） ═══════════════════ -->
${faqSectionHtml(faq)}
`;
}

const FAQ_COMMON = { faq_tag: ['FAQ', 'FAQ'], faq_title: ['よくある質問。', 'Questions.'], faq_lede: ['会社、プロダクト、事例、ご相談の流れについて。', 'About the company, the products, the cases and how to get in touch.'] };
const FAQ_CSS = `/* FAQ（トップ） */
.faq{max-width:62em;border-top:1px solid var(--line-s);}
.faq__item{border-bottom:1px solid var(--line-s);}
.faq__item summary{cursor:pointer;list-style:none;padding:20px 2px;font-size:15px;font-weight:500;line-height:1.7;display:flex;justify-content:space-between;gap:20px;}
.faq__item summary::-webkit-details-marker{display:none;}
.faq__item summary::after{content:"+";color:var(--grey-d);font-weight:300;flex:none;}
.faq__item[open] summary::after{content:"−";}
.faq__item p{font-size:13px;line-height:2.05;font-weight:300;color:rgba(255,255,255,.74);margin:0 0 22px;max-width:46em;}`;
function faqSectionHtml(faq) {
  return `<section class="sec" id="faq">
  <div class="sec__head">
    <p class="eyebrow rv" data-i18n="faq_tag">${FAQ_COMMON.faq_tag[1]}</p>
    <h2 class="title rv" data-d="1" data-i18n="faq_title">${FAQ_COMMON.faq_title[1]}</h2>
    <p class="lede rv" data-d="2" data-i18n="faq_lede">${FAQ_COMMON.faq_lede[1]}</p>
  </div>
  <div class="faq rv" data-d="2">
${faq.map(f => `    <details class="faq__item"><summary data-i18n="faq_${f.id}_q">${esc(f.en.q)}</summary><p data-i18n="faq_${f.id}_a">${esc(f.en.a)}</p></details>`).join('\n')}
  </div>
</section>`;
}
function faqDict(faq) {
  const ja = {}, en = {};
  for (const [k, [j, g]] of Object.entries(FAQ_COMMON)) { ja[k] = j; en[k] = g; }
  faq.forEach(f => { ja['faq_' + f.id + '_q'] = f.ja.q; en['faq_' + f.id + '_q'] = f.en.q; ja['faq_' + f.id + '_a'] = f.ja.a; en['faq_' + f.id + '_a'] = f.en.a; });
  return { ja, en };
}

function inline(h) {
  h = stripHome(strip(h));
  const cases = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'));
  const dicts = cases.map((c, i) => dictFor(c, i));
  const news = NEWS.load();
  const faq = JSON.parse(fs.readFileSync(REPO + 'faq.json', 'utf8'));

  // ── トップのセクション（初回は旧 RECORD セクションを置き換える）
  const home = S_HOME + '\n' + toHash(homeSectionsHtml(cases, dicts, news, faq)) + E_HOME;
  const recStart = h.indexOf('<!-- ═══════════════════ RECORD ═══════════════════ -->');
  const coStart = h.indexOf('<!-- ═══════════════════ COMPANY');
  if (recStart !== -1 && coStart > recStart) {
    h = h.slice(0, recStart) + home + '\n\n' + h.slice(coStart);
  } else {
    if (coStart === -1) throw new Error('cases-inline: COMPANY セクションが見つかりません');
    h = h.slice(0, coStart) + home + '\n\n' + h.slice(coStart);
  }
  // そのCSS（公開用でも残す）
  const cssAnchor = '/* 法務ページ（プライバシーポリシー・利用規約） */';
  if (!h.includes(cssAnchor)) throw new Error('cases-inline: CSS anchor');
  h = h.replace(cssAnchor, S_HCSS + '\n' + NEWS.CSS + '\n' + FAQ_CSS + '\n' + E_HCSS + '\n' + cssAnchor);
  // その辞書（公開用でも残す）: お知らせ全件＋見出し＋トップに出す事例のタイトル等
  const nd = NEWS.dict(news), fd = faqDict(faq);
  const hja = { ...nd.ja, ...fd.ja }, hen = { ...nd.en, ...fd.en };
  cases.forEach((c, i) => { if (!c.home) return; const d = dicts[i]; for (const k of ['title', 'lead', 'tags']) { hja[d.p + k] = d.ja[d.p + k]; hen[d.p + k] = d.en[d.p + k]; } });
  if (!h.includes(JA_ANCHOR) || !h.includes(EN_ANCHOR)) throw new Error('cases-inline: 辞書のアンカー');
  h = h.replace(JA_ANCHOR, S_HDICT + '\n' + lines(hja) + E_HDICT + '\n' + JA_ANCHOR)
       .replace(EN_ANCHOR, S_HDICT + '\n' + lines(hen) + E_HDICT + '\n' + EN_ANCHOR);

  // ── 組み込みページ（1枚HTMLだけ）
  const IMG = {};
  // 事例の画像はすべて埋め込む（サムネイル）。1枚目は一覧カードと共用のキー、2枚目以降は key:n
  const slim = cases.map(c => ({ ...c, imgs: c.imgs.map((im, i) => {
    const uri = thumbDataUri(im.src);
    const k = i === 0 ? c.key : c.key + ':' + i;
    if (uri) { IMG[k] = uri; return { src: '__CASEIMG__' + k + '__', alt: im.alt }; }
    return { src: im.src.replace(/^\//, ''), alt: im.alt };
  }) }));
  const slimDicts = dicts;
  let pages = indexPageHtml(slim, slimDicts).replace('<div class="page active" id="page-cases">', '<div class="page" id="page-cases">');
  slim.forEach((c, i) => {
    pages += casePageHtml(c, productOf(c.eyebrow), slimDicts[i])
      .replace('<div class="page active" id="page-case">', '<div class="page" id="page-case-' + c.key + '">');
  });
  pages += NEWS.pageHtml(news).replace('<div class="page active" id="page-news">', '<div class="page" id="page-news">');
  // お知らせの記事ページ（画像は assets/news/_thumb のサムネイルを埋め込む）
  NEWS.images(news).forEach(im => {
    const t = REPO + newsThumbFile(im.src);
    if (fs.existsSync(t)) IMG[im.key] = 'data:image/webp;base64,' + fs.readFileSync(t).toString('base64');
  });
  news.filter(NEWS.hasArticle).forEach(n => {
    pages += NEWS.articleHtml(n, s => (IMG['news:' + path.basename(s)] ? '__CASEIMG__news:' + path.basename(s) + '__' : s.replace(/^\//, '')))
      .replace('<div class="page active" id="page-news-' + n.id + '">', '<div class="page" id="page-news-' + n.id + '">');
  });
  pages = toHash(pages).replace(/src="__CASEIMG__([a-z0-9:.-]+)__"/g, 'src="' + BLANK + '" data-case-img="$1"');
  pages += '<script>window.__CASE_IMG=' + JSON.stringify(IMG) + ';'
    + '(function(){var M=window.__CASE_IMG,n=document.querySelectorAll("[data-case-img]");'
    + 'for(var i=0;i<n.length;i++){var u=M[n[i].getAttribute("data-case-img")];if(u)n[i].src=u;}})();</script>\n';
  const mi = h.indexOf('\n</main>');
  const ti = h.indexOf('<template id="tpl-demo');
  if (mi === -1 || (ti !== -1 && mi > ti)) throw new Error('cases-inline: </main> の位置が特定できません');
  h = h.slice(0, mi) + '\n' + S_PAGES + '\n' + pages + E_PAGES + h.slice(mi);
  h = h.replace(cssAnchor, S_CSS + '\n' + CSS + '\n' + E_CSS + '\n' + cssAnchor);
  const ja = {}, en = {};
  for (const [k, [j, g]] of Object.entries(COMMON)) { ja[k] = j; en[k] = g; }
  dicts.forEach(d => { Object.assign(ja, d.ja); Object.assign(en, d.en); });
  for (const k of Object.keys(hja)) { delete ja[k]; delete en[k]; }   // トップ用の辞書と重複させない
  h = h.replace(JA_ANCHOR, S_DICT + '\n' + lines(ja) + E_DICT + '\n' + JA_ANCHOR)
       .replace(EN_ANCHOR, S_DICT + '\n' + lines(en) + E_DICT + '\n' + EN_ANCHOR);
  return h;
}

module.exports = { inline, strip, stripHome, thumbSrcMap, BLANK };

if (require.main === module) {
  const P = REPO + 'yellow_spacex_v8.html';
  const before = fs.readFileSync(P, 'utf8');
  const after = inline(before);
  fs.writeFileSync(P, after);
  console.log('事例・お知らせを1枚HTMLに組み込み: HTML ' + (after.length / 1048576).toFixed(2) + 'MB');
}
