// お知らせ（News）: news.json から、トップの NEWS セクション・一覧ページ・辞書を組み立てる部品。
// 1枚HTML（build-cases-inline.js）と公開用（build-static.js）の両方から使う。
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
  nw_case:  ['事例を見る →', 'See the case →'],
  nw_press: ['プレスリリース ↗', 'Press release ↗'],
  rec_tag:  ['Selected Cases', 'Selected Cases'],
  rec_title:['実装した事例。', 'What we have built.'],
  rec_lede: ['工場のレイアウト検証から駅構内の3Dモデリング、人流データの可視化まで。ブラウザで動くデモとともに公開しています。',
             'From factory layout studies to 3D station interiors and mobility data. Published with demos that run in the browser.'],
};

function load() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'news.json'), 'utf8'));
}
function label(n) {
  if (n.dateLabel) return n.dateLabel;
  return n.date.replace(/-/g, '.');
}
// 日英辞書
function dict(items) {
  const ja = {}, en = {};
  for (const [k, [j, g]] of Object.entries(COMMON)) { ja[k] = j; en[k] = g; }
  items.forEach(n => {
    const p = 'nw_' + n.id.replace(/[^a-z0-9]/g, '_') + '_';
    ja[p + 'title'] = n.ja.title; en[p + 'title'] = n.en.title;
    ja[p + 'text'] = n.ja.text;   en[p + 'text'] = n.en.text;
    ja[p + 'tag'] = n.ja.tag;     en[p + 'tag'] = n.en.tag;
  });
  return { ja, en };
}
function keyOf(n) { return 'nw_' + n.id.replace(/[^a-z0-9]/g, '_') + '_'; }
function caseHref(n) { return n.case ? '/cases/' + n.case + '/' : (n.press || '#'); }

// 一覧（トップは compact=true: タイトルのみ、ページは本文とリンク付き）
function listHtml(items, compact) {
  return '<ul class="newslist">\n' + items.map(n => {
    const p = keyOf(n);
    if (compact) {
      return `      <li><a href="${caseHref(n)}"><time datetime="${n.date}">${label(n)}</time><span class="newslist__t" data-i18n="${p}title">${esc(n.en.title)}</span><span class="newslist__go">→</span></a></li>`;
    }
    const links = [];
    if (n.case) links.push(`<a href="/cases/${n.case}/" data-i18n="nw_case">${COMMON.nw_case[1]}</a>`);
    if (n.press) links.push(`<a href="${esc(n.press)}" target="_blank" rel="noopener" data-i18n="nw_press">${COMMON.nw_press[1]}</a>`);
    return `      <li><a href="${caseHref(n)}"${n.case ? '' : ' target="_blank" rel="noopener"'}><time datetime="${n.date}">${label(n)}</time><span><span class="newslist__tag" data-i18n="${p}tag">${esc(n.en.tag)}</span><span class="newslist__t" data-i18n="${p}title">${esc(n.en.title)}</span><span class="newslist__d" data-i18n="${p}text">${esc(n.en.text)}</span></span><span class="newslist__go">→</span></a></li>`;
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

module.exports = { CSS, COMMON, load, dict, listHtml, homeSectionHtml, pageHtml, label, esc };
