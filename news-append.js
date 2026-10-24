// お知らせ（News）: news.json から、トップの NEWS セクション・一覧ページ・記事ページ・辞書を組み立てる部品。
// 1枚HTML（build-cases-inline.js）と公開用（build-static.js）の両方から使う。
//   記事ページを持つのは sections を持つ項目（/news/<id>/、1枚HTMLでは #/news/<id>）。
//   それ以外の項目は関連する事例ページへ直接リンクする。
const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `/* ═══════════════════════════════════════════════════════════
   NEWS（お知らせ）
   ═══════════════════════════════════════════════════════════ */
.newslist{list-style:none;margin:0;padding:0;border-top:1px solid var(--line-s);}
.newslist li{border-bottom:1px solid var(--line-s);}
.newslist a{display:grid;grid-template-columns:7.5em 1fr auto;gap:18px;align-items:baseline;padding:22px 2px;transition:background .3s var(--ease);}
.newslist a:hover{background:rgba(255,255,255,.03);}
.newslist time{font-size:11px;letter-spacing:var(--ls-ui);color:var(--grey-d);font-variant-numeric:tabular-nums;}
.newslist__t{font-size:15px;font-weight:500;line-height:1.7;}
.newslist__tag{display:block;font-size:10px;letter-spacing:var(--ls-ui);text-transform:uppercase;color:var(--grey-d);margin-bottom:6px;}
.newslist__d{display:block;font-size:12.5px;line-height:1.95;font-weight:300;color:rgba(255,255,255,.6);margin-top:6px;}
.newslist__go{font-size:11px;letter-spacing:var(--ls-ui);color:rgba(255,255,255,.55);white-space:nowrap;}
.newslist a:hover .newslist__go{color:var(--white);}
.sec__more{margin-top:clamp(28px,4vh,44px);}
.sec__more .btn{display:inline-block;}
/* トップの事例カード: 本文は3行で省略 */
#selected-cases .card__text{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.news{padding:calc(var(--hdr-h) + clamp(46px,8vh,90px)) var(--pad) clamp(80px,12vh,140px);}
.news__head{max-width:42em;margin-bottom:clamp(40px,6vh,70px);}
.news .newslist{max-width:62em;}
/* 記事ページ */
.article{padding:calc(var(--hdr-h) + clamp(40px,6vh,72px)) var(--pad) clamp(70px,10vh,120px);}
.article__wrap{max-width:46em;}
.article__meta{display:flex;gap:18px;align-items:baseline;font-size:11px;letter-spacing:var(--ls-ui);text-transform:uppercase;color:var(--grey-d);margin:0 0 18px;}
.article__title{font-size:clamp(24px,3.2vw,40px);font-weight:700;line-height:1.35;margin:0 0 16px;}
.article__sub{font-size:clamp(14px,1.4vw,16px);line-height:1.9;font-weight:300;color:rgba(255,255,255,.78);margin:0 0 26px;}
.article__logo{display:inline-block;background:#fff;padding:14px 18px;border-radius:4px;margin:6px 0 30px;}
.article__logo img{display:block;height:44px;width:auto;}
.article h2{font-size:15px;font-weight:700;letter-spacing:.06em;margin:40px 0 12px;padding-top:26px;border-top:1px solid var(--line-s);}
.article p,.article li{font-size:13.5px;line-height:2.1;font-weight:300;color:rgba(255,255,255,.84);margin:0 0 12px;}
.article ul{padding-left:1.3em;margin:4px 0 14px;}
.article .article__note{font-size:12px;color:rgba(255,255,255,.55);}
.article__figs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin:22px 0 10px;}
.article__figs figure{margin:0;background:#111;}
.article__figs img{width:100%;height:auto;display:block;}
.article__figs figcaption{font-size:11px;line-height:1.8;color:var(--grey-d);padding:8px 2px 0;}
.article__links{display:flex;flex-wrap:wrap;gap:12px;margin:34px 0 0;}
.article__links a{display:inline-block;font-size:11px;letter-spacing:var(--ls-ui);text-transform:uppercase;border:1px solid var(--line);padding:14px 26px;transition:.3s var(--ease);}
.article__links a:hover{background:var(--white);color:var(--black);}
.article__nav{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-top:clamp(50px,8vh,90px);padding-top:24px;border-top:1px solid var(--line-s);}
@media (max-width:720px){
  .newslist a{grid-template-columns:1fr;gap:6px;}
  .newslist__go{display:none;}
}`;

const COMMON = {
  nw_tag:   ['News', 'News'],
  nw_title: ['お知らせ。', 'News.'],
  nw_lede:  ['採択、加盟、プレスリリースなど、YELLOWの最近の動き。', 'Recent announcements: programmes, memberships and press releases.'],
  nw_all:   ['お知らせ一覧 →', 'All news →'],
  nw_back:  ['← ホームへ戻る', '← Back to home'],
  nw_list:  ['← お知らせ一覧', '← All news'],
  nw_case:  ['関連する事例を見る →', 'See the related case →'],
  nw_press: ['PR TIMES で読む ↗', 'Read on PR TIMES ↗'],
  nw_contact: ['お問い合わせ →', 'Contact →'],
  rec_tag:  ['Selected Cases', 'Selected Cases'],
  rec_title:['実装した事例。', 'What we have built.'],
  rec_lede: ['工場のレイアウト検証から駅構内の3Dモデリング、人流データの可視化まで。ブラウザで動くデモとともに公開しています。',
             'From factory layout studies to 3D station interiors and mobility data. Published with demos that run in the browser.'],
};

function load() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'news.json'), 'utf8'));
}
function label(n) { return n.dateLabel ? n.dateLabel : n.date.replace(/-/g, '.'); }
function keyOf(n) { return 'nw_' + n.id.replace(/[^a-z0-9]/g, '_') + '_'; }
function hasArticle(n) { return Array.isArray(n.sections) && n.sections.length > 0; }
// 一覧からの飛び先（公開用の実 URL。1枚HTMLは toHash でハッシュに変換される）
function href(n) {
  if (hasArticle(n)) return '/news/' + n.id + '/';
  return n.case ? '/cases/' + n.case + '/' : (n.press || '#');
}

// 日英辞書（見出し・一覧・記事本文すべて）
function dict(items) {
  const ja = {}, en = {};
  for (const [k, [j, g]] of Object.entries(COMMON)) { ja[k] = j; en[k] = g; }
  items.forEach(n => {
    const p = keyOf(n);
    ja[p + 'title'] = n.ja.title; en[p + 'title'] = n.en.title;
    ja[p + 'text'] = n.ja.text;   en[p + 'text'] = n.en.text;
    ja[p + 'tag'] = n.ja.tag;     en[p + 'tag'] = n.en.tag;
    if (n.ja.sub || n.en.sub) { ja[p + 'sub'] = n.ja.sub || ''; en[p + 'sub'] = n.en.sub || ''; }
    if (n.logo) { ja[p + 'logo'] = n.logo.ja; en[p + 'logo'] = n.logo.en; }
    (n.sections || []).forEach((s, si) => {
      const J = s.ja, E = s.en;
      if (J.h || E.h) { ja[p + 'h' + si] = J.h; en[p + 'h' + si] = E.h; }
      (J.paras || []).forEach((t, i) => { ja[p + 'p' + si + '_' + i] = t; en[p + 'p' + si + '_' + i] = E.paras[i]; });
      (J.items || []).forEach((t, i) => { ja[p + 'i' + si + '_' + i] = t; en[p + 'i' + si + '_' + i] = E.items[i]; });
      (J.notes || []).forEach((t, i) => { ja[p + 'n' + si + '_' + i] = t; en[p + 'n' + si + '_' + i] = E.notes[i]; });
      (s.imgs || []).forEach((im, i) => { ja[p + 'c' + si + '_' + i] = im.ja; en[p + 'c' + si + '_' + i] = im.en; });
    });
  });
  return { ja, en };
}

// 記事ページの画像（1枚HTMLで埋め込む対象）: [{key, src}]
function images(items) {
  const out = [];
  items.forEach(n => {
    if (n.logo) out.push({ key: 'news:' + path.basename(n.logo.src), src: n.logo.src });
    (n.sections || []).forEach(s => (s.imgs || []).forEach(im => out.push({ key: 'news:' + path.basename(im.src), src: im.src })));
  });
  return out;
}

// 一覧（トップは compact=true: タイトルのみ、ページは本文とリンク付き）
function listHtml(items, compact) {
  return '<ul class="newslist">\n' + items.map(n => {
    const p = keyOf(n);
    const ext = (!hasArticle(n) && !n.case && n.press) ? ' target="_blank" rel="noopener"' : '';
    if (compact) {
      return `      <li><a href="${href(n)}"${ext}><time datetime="${n.date}">${label(n)}</time><span class="newslist__t" data-i18n="${p}title">${esc(n.en.title)}</span><span class="newslist__go">→</span></a></li>`;
    }
    return `      <li><a href="${href(n)}"${ext}><time datetime="${n.date}">${label(n)}</time><span><span class="newslist__tag" data-i18n="${p}tag">${esc(n.en.tag)}</span><span class="newslist__t" data-i18n="${p}title">${esc(n.en.title)}</span><span class="newslist__d" data-i18n="${p}text">${esc(n.en.text)}</span></span><span class="newslist__go">→</span></a></li>`;
  }).join('\n') + '\n    </ul>';
}

function homeSectionHtml(items) {
  return `<section class="sec" id="news">
  <div class="sec__head">
    <p class="eyebrow rv" data-i18n="nw_tag">${COMMON.nw_tag[1]}</p>
    <h2 class="title rv" data-d="1" data-i18n="nw_title">${COMMON.nw_title[1]}</h2>
    <p class="lede rv" data-d="2" data-i18n="nw_lede">${COMMON.nw_lede[1]}</p>
  </div>
  <div class="rv" data-d="2">
    ${listHtml(items.slice(0, 4), true)}
  </div>
  <p class="sec__more rv" data-d="3"><a class="btn" href="/news/" data-i18n="nw_all">${COMMON.nw_all[1]}</a></p>
</section>`;
}

function pageHtml(items) {
  return `<div class="page active" id="page-news">
  <section class="news">
    <div class="news__head">
      <a class="back" href="/" data-i18n="nw_back">${COMMON.nw_back[1]}</a>
      <p class="eyebrow" data-i18n="nw_tag">${COMMON.nw_tag[1]}</p>
      <h1 class="title" style="font-size:clamp(26px,3.6vw,48px)" data-i18n="nw_title">${COMMON.nw_title[1]}</h1>
      <p class="lede" data-i18n="nw_lede">${COMMON.nw_lede[1]}</p>
    </div>
    ${listHtml(items, false)}
  </section>
</div>
`;
}

// 記事ページ。imgSrc(src) で画像の src を差し替えられる（1枚HTML用の埋め込み）
function articleHtml(n, imgSrc) {
  const p = keyOf(n), src = imgSrc || (s => s);
  const body = (n.sections || []).map((s, si) => {
    const E = s.en;
    let out = '';
    if (E.h) out += `        <h2 data-i18n="${p}h${si}">${esc(E.h)}</h2>\n`;
    (E.paras || []).forEach((t, i) => { out += `        <p data-i18n="${p}p${si}_${i}">${esc(t)}</p>\n`; });
    if ((E.items || []).length) out += '        <ul>\n' + E.items.map((t, i) => `          <li data-i18n="${p}i${si}_${i}">${esc(t)}</li>`).join('\n') + '\n        </ul>\n';
    (E.notes || []).forEach((t, i) => { out += `        <p class="article__note" data-i18n="${p}n${si}_${i}">${esc(t)}</p>\n`; });
    if ((s.imgs || []).length) out += '        <div class="article__figs">\n' + s.imgs.map((im, i) =>
      `          <figure><img src="${src(im.src)}" alt="${esc(im.en)}" loading="lazy" decoding="async"><figcaption data-i18n="${p}c${si}_${i}">${esc(im.en)}</figcaption></figure>`).join('\n') + '\n        </div>\n';
    return out;
  }).join('');
  const links = [];
  if (n.press) links.push(`<a href="${esc(n.press)}" target="_blank" rel="noopener" data-i18n="nw_press">${COMMON.nw_press[1]}</a>`);
  if (n.case) links.push(`<a href="/cases/${n.case}/" data-i18n="nw_case">${COMMON.nw_case[1]}</a>`);
  return `<div class="page active" id="page-news-${n.id}">
  <section class="article">
    <div class="article__wrap">
      <a class="back" href="/news/" data-i18n="nw_list">${COMMON.nw_list[1]}</a>
      <p class="article__meta"><time datetime="${n.date}">${label(n)}</time><span data-i18n="${p}tag">${esc(n.en.tag)}</span></p>
      <h1 class="article__title" data-i18n="${p}title">${esc(n.en.title)}</h1>
      ${n.en.sub ? `<p class="article__sub" data-i18n="${p}sub">${esc(n.en.sub)}</p>` : ''}
      ${n.logo ? `<div class="article__logo"><img src="${src(n.logo.src)}" alt="${esc(n.logo.en)}" loading="lazy" decoding="async"></div>` : ''}
${body}
      <div class="article__links">${links.join('\n        ')}</div>
      <nav class="article__nav">
        <a href="/news/" data-i18n="nw_list">${COMMON.nw_list[1]}</a>
        <a href="/#contact" data-i18n="nw_contact">${COMMON.nw_contact[1]}</a>
      </nav>
    </div>
  </section>
</div>
`;
}

module.exports = { CSS, COMMON, load, dict, images, listHtml, homeSectionHtml, pageHtml, articleHtml, hasArticle, href, label, keyOf, esc };
