// build-static.js に事例ページ生成を組み込むための追記モジュール。
// 呼び出し側から buildCases({DIST, ORIGIN, base, esc, ldWrap}) で使う。
const fs = require('fs');
const path = require('path');

const PRODUCT_OF = {
  XBUILD: { id: 'xbuild', label: 'xBUILD' },
  XAD: { id: 'xad', label: 'xAD' },
  XINTERACTIVE: { id: 'xinteractive', label: 'xINTERACTIVE' },
};

function productOf(eyebrow) {
  const m = /^(XBUILD|XAD|XINTERACTIVE)/.exec((eyebrow || '').toUpperCase());
  return m ? PRODUCT_OF[m[1]] : null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `/* ═══════════════════════════════════════════════════════════
   CASES（事例）
   ═══════════════════════════════════════════════════════════ */
.cases{padding:calc(var(--hdr-h) + clamp(46px,8vh,90px)) var(--pad) clamp(80px,12vh,140px);}
.cases__head{max-width:42em;margin-bottom:clamp(40px,6vh,70px);}
.cases__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px;background:var(--line-s);border:1px solid var(--line-s);}
.ccard{display:block;background:var(--black);padding:0;transition:background .3s var(--ease);}
.ccard:hover{background:#0b0b0b;}
.ccard__img{aspect-ratio:16/10;overflow:hidden;background:#111;}
.ccard__img img{width:100%;height:100%;object-fit:cover;transition:transform 1s var(--ease);}
.ccard:hover .ccard__img img{transform:scale(1.05);}
.ccard__body{padding:20px 22px 26px;}
.ccard__tag{font-size:10px;letter-spacing:var(--ls-ui);text-transform:uppercase;color:var(--grey-d);}
.ccard__t{font-size:15px;font-weight:700;line-height:1.6;margin:8px 0 8px;}
.ccard__d{font-size:12px;line-height:1.95;font-weight:300;color:rgba(255,255,255,.6);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}

.case{padding:calc(var(--hdr-h) + clamp(40px,6vh,72px)) var(--pad) clamp(70px,10vh,120px);}
.case__wrap{max-width:62em;}
.case__eyebrow{font-size:10px;letter-spacing:var(--ls-eyebrow);text-transform:uppercase;color:var(--grey);margin:0 0 16px;}
.case__title{font-size:clamp(26px,3.6vw,48px);font-weight:700;line-height:1.25;margin:0 0 20px;}
.case__lead{font-size:clamp(14px,1.5vw,17px);line-height:2;font-weight:300;color:rgba(255,255,255,.84);max-width:44em;margin:0 0 28px;}
.case__demo{display:inline-block;font-size:11px;letter-spacing:var(--ls-ui);text-transform:uppercase;
  border:1px solid var(--line);padding:14px 28px;transition:.3s var(--ease);}
.case__demo:hover{background:var(--white);color:var(--black);}
.case__shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;margin:44px 0;}
.case__shots figure{margin:0;background:#111;}
.case__shots img{width:100%;height:auto;display:block;}
.case__shots figcaption{font-size:11px;line-height:1.8;color:var(--grey-d);padding:8px 2px 0;}
.case__cols{display:grid;grid-template-columns:1.5fr 1fr;gap:clamp(30px,5vw,70px);align-items:start;}
.case h2{font-size:14px;font-weight:700;letter-spacing:.08em;margin:34px 0 12px;}
.case p,.case li{font-size:13px;line-height:2.1;font-weight:300;color:rgba(255,255,255,.8);}
.case ul{padding-left:1.3em;margin:8px 0;}
.case__spec{width:100%;border-collapse:collapse;border-top:1px solid var(--line-s);}
.case__spec th,.case__spec td{text-align:left;vertical-align:top;padding:13px 0;border-bottom:1px solid var(--line-s);font-weight:400;}
.case__spec th{width:9em;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--grey-d);padding-right:14px;}
.case__spec td{font-size:13px;line-height:1.9;color:rgba(255,255,255,.84);}
.case__nav{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;
  margin-top:clamp(50px,8vh,90px);padding-top:24px;border-top:1px solid var(--line-s);}
.case__nav a{font-size:11px;letter-spacing:var(--ls-ui);text-transform:uppercase;color:var(--grey);transition:color .3s;}
.case__nav a:hover{color:var(--white);}
@media (max-width:900px){
  .case__cols{grid-template-columns:1fr;}
  .case p a,.case li a{display:inline-block;padding:6px 0;}
}

`;

/* ─────────────────────────────────────────────────────────────
   事例ページは英語を既定に、日本語は言語切替で出す。
   本文は cases.json（日本語）と cases.en.json（英語）を同じ構造で持ち、
   各要素に data-i18n を振って、ページごとに辞書（JA/EN）を差し込む。
   ───────────────────────────────────────────────────────────── */
const EN = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.en.json'), 'utf8'));

// 見出し・仕様項目名は全事例で共通
const HEAD_JA = ['案件背景', 'できること', '活用シーン'];
const HEAD_EN = ['Background', 'What it does', 'Use cases'];
const SPEC_JA = ['対象', 'データソース', '主要指標', 'レイヤー・機能', '想定シナリオ', '提供形態'];
const SPEC_EN = ['Scope', 'Data sources', 'Key metrics', 'Layers & features', 'Scenario', 'Delivery'];

// 共通ラベル
const COMMON = {
  cs_idx_back:  ['← ホームへ戻る', '← Back to home'],
  cs_idx_tag:   ['Cases', 'Cases'],
  cs_idx_title: ['実装した事例。', 'What we have built.'],
  cs_idx_lede:  ['工場のレイアウト検証から駅構内の3Dモデリング、点群データの活用、店頭販促のシミュレーションまで。参加しているプログラムやパートナーシップの記録も含みます。多くの事例はブラウザで動くデモを公開しています。',
                 'From factory layout studies and 3D modelling of station interiors to point-cloud data and in-store promotion simulation, plus the programmes and partnerships we take part in. Most cases have a working demo that runs in the browser.'],
  cs_back_list: ['← 事例一覧へ戻る', '← All cases'],
  cs_open_demo: ['デモを開く ↗', 'Open demo ↗'],
  cs_open_press: ['プレスリリースを読む ↗', 'Read the press release ↗'],
  cs_spec_h:    ['仕様', 'Specifications'],
  cs_nav_list:  ['← 事例一覧', '← All cases'],
  cs_nav_contact: ['お問い合わせ →', 'Contact →'],
  cs_about_xbuild: ['xBUILD について →', 'About xBUILD →'],
  cs_about_xad: ['xAD について →', 'About xAD →'],
  cs_about_xinteractive: ['xINTERACTIVE について →', 'About xINTERACTIVE →'],
};

// 事例ごとの辞書を組む。戻り値: { ja:{key:text}, en:{key:text}, k(name)→key }
function dictFor(c, i) {
  const e = EN[c.key];
  if (!e) throw new Error('cases.en.json に ' + c.key + ' がありません');
  const p = 'cs_' + String(i).padStart(2, '0') + '_';
  const ja = {}, en = {};
  const put = (name, j, g) => { ja[p + name] = j; en[p + name] = g; return p + name; };
  put('title', c.title, e.title); put('eyebrow', c.eyebrow, e.eyebrow);
  put('tags', c.tags, e.tags); put('lead', c.lead, e.lead);
  if (c.sections.length !== e.sections.length) throw new Error(c.key + ': sections の数が日英で違います');
  c.sections.forEach((s, si) => {
    const es = e.sections[si];
    const hi = HEAD_JA.indexOf(s.heading);
    if (hi === -1) throw new Error(c.key + ': 未知の見出し ' + s.heading);
    put('h' + si, s.heading, HEAD_EN[hi]);
    if (s.paras.length !== es.paras.length || s.items.length !== es.items.length)
      throw new Error(c.key + ': section ' + si + ' の段落/項目数が日英で違います');
    s.paras.forEach((t, pi) => put('p' + si + '_' + pi, t, es.paras[pi]));
    s.items.forEach((t, ii) => put('i' + si + '_' + ii, t, es.items[ii]));
  });
  if (c.spec.length !== e.spec.length) throw new Error(c.key + ': spec の行数が日英で違います');
  c.spec.forEach(([k, v], ri) => {
    const ki = SPEC_JA.indexOf(k);
    if (ki === -1) throw new Error(c.key + ': 未知の仕様項目 ' + k);
    put('sk' + ri, k, SPEC_EN[ki]); put('sv' + ri, v, e.spec[ri]);
  });
  if (c.imgs.length !== e.alts.length) throw new Error(c.key + ': 画像の数と alts の数が違います');
  return { ja, en, p, e };
}

function casePageHtml(c, prod, d) {
  const e = d.e, p = d.p;
  const shots = c.imgs.slice(0, 6).map((im, k) =>
    `        <figure><img src="${im.src}" alt="${esc(e.alts[k])}" loading="lazy" decoding="async"></figure>`).join('\n');
  const body = c.sections.map((s, si) => {
    const es = e.sections[si];
    let out = `        <h2 data-i18n="${p}h${si}">${esc(HEAD_EN[HEAD_JA.indexOf(s.heading)])}</h2>\n`;
    es.paras.forEach((t, pi) => { out += `        <p data-i18n="${p}p${si}_${pi}">${esc(t)}</p>\n`; });
    if (es.items.length) out += '        <ul>\n' + es.items.map((t, ii) => `          <li data-i18n="${p}i${si}_${ii}">${esc(t)}</li>`).join('\n') + '\n        </ul>\n';
    return out;
  }).join('');
  const spec = c.spec.map(([k, v], ri) =>
    `          <tr><th data-i18n="${p}sk${ri}">${esc(SPEC_EN[SPEC_JA.indexOf(k)])}</th><td data-i18n="${p}sv${ri}">${esc(e.spec[ri])}</td></tr>`).join('\n');
  const about = prod ? `<a href="/${prod.id}/" data-i18n="cs_about_${prod.id}">${esc(COMMON['cs_about_' + prod.id][1])}</a>`
                     : `<a href="/#contact" data-i18n="cs_nav_contact">${COMMON.cs_nav_contact[1]}</a>`;

  return `<div class="page active" id="page-case">
  <section class="case">
    <div class="case__wrap">
      <a class="back" href="/cases/" data-i18n="cs_back_list">${COMMON.cs_back_list[1]}</a>
      <p class="case__eyebrow" data-i18n="${p}eyebrow">${esc(e.eyebrow)}</p>
      <h1 class="case__title" data-i18n="${p}title">${esc(e.title)}</h1>
      <p class="case__lead" data-i18n="${p}lead">${esc(e.lead)}</p>
      ${c.demo ? `<p><a class="case__demo" href="${esc(c.demo)}" target="_blank" rel="noopener" data-i18n="cs_open_demo">${COMMON.cs_open_demo[1]}</a></p>` : ''}
      ${c.press ? `<p><a class="case__demo" href="${esc(c.press)}" target="_blank" rel="noopener" data-i18n="cs_open_press">${COMMON.cs_open_press[1]}</a></p>` : ''}

      <div class="case__shots">
${shots}
      </div>

      <div class="case__cols">
        <div>
${body}        </div>
        <aside>
          <h2 data-i18n="cs_spec_h">${COMMON.cs_spec_h[1]}</h2>
          <table class="case__spec"><tbody>
${spec}
          </tbody></table>
        </aside>
      </div>

      <nav class="case__nav">
        <a href="/cases/" data-i18n="cs_nav_list">${COMMON.cs_nav_list[1]}</a>
        ${about}
      </nav>
    </div>
  </section>
</div>
`;
}

function indexPageHtml(cases, dicts) {
  const cards = cases.map((c, i) => {
    const prod = productOf(c.eyebrow), d = dicts[i];
    return `      <a class="ccard" href="/cases/${c.key}/">
        <div class="ccard__img"><img src="${c.imgs[0] ? c.imgs[0].src : ''}" alt="${esc(d.e.title)}" loading="lazy" decoding="async"></div>
        <div class="ccard__body">
          <div class="ccard__tag"${prod ? '' : ` data-i18n="${d.p}tags"`}>${esc(prod ? prod.label : d.e.tags)}</div>
          <h2 class="ccard__t" data-i18n="${d.p}title">${esc(d.e.title)}</h2>
          <p class="ccard__d" data-i18n="${d.p}lead">${esc(d.e.lead)}</p>
        </div>
      </a>`;
  }).join('\n');

  return `<div class="page active" id="page-cases">
  <section class="cases">
    <div class="cases__head">
      <a class="back" href="/" data-i18n="cs_idx_back">${COMMON.cs_idx_back[1]}</a>
      <p class="eyebrow" data-i18n="cs_idx_tag">${COMMON.cs_idx_tag[1]}</p>
      <h1 class="title" style="font-size:clamp(26px,3.6vw,48px)" data-i18n="cs_idx_title">${COMMON.cs_idx_title[1]}</h1>
      <p class="lede" data-i18n="cs_idx_lede">${COMMON.cs_idx_lede[1]}</p>
    </div>
    <div class="cases__grid">
${cards}
    </div>
  </section>
</div>
`;
}

module.exports = function buildCases({ DIST, ORIGIN, base, ORG_ID, extra }) {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
  const dicts = cases.map((c, i) => dictFor(c, i));

  // 共通CSSを注入
  let withCss = base.replace('/* 法務ページ（プライバシーポリシー・利用規約） */', CSS + '/* 法務ページ（プライバシーポリシー・利用規約） */');
  if (withCss === base) throw new Error('cases CSS anchor missing');

  const pageRe = /<div class="page(?: active)?" id="page-[a-z]+">[\s\S]*?(?=\n<\/main>)/;
  if (!pageRe.test(withCss)) throw new Error('cases: page block not found');

  // 辞書（JA/EN）をページに差し込む。キーはハイフンを含みうるので引用符付きで書く
  const JA_ANCHOR = '    meta_title: "株式会社YELLOW",', EN_ANCHOR = '    meta_title: "YELLOW Inc.';
  if (!withCss.includes(JA_ANCHOR) || !withCss.includes(EN_ANCHOR)) throw new Error('cases: 辞書のアンカーが見つかりません');
  const lines = o => Object.entries(o).map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',\n').join('');
  function withDict(h, ja, en) {
    return h.replace(JA_ANCHOR, lines(ja) + JA_ANCHOR).replace(EN_ANCHOR, lines(en) + EN_ANCHOR);
  }
  const commonJa = {}, commonEn = {};
  for (const [k, [j, g]] of Object.entries(COMMON)) { commonJa[k] = j; commonEn[k] = g; }

  function emit(dir, inner, meta) {
    // meta.page … window.__PAGE の値。title/description は辞書側で言語ごとに切り替わる
    const ja = { ...commonJa, ...meta.ja, ['meta_title_' + meta.page]: meta.titleJa, ['meta_desc_' + meta.page]: meta.descJa };
    const en = { ...commonEn, ...meta.en, ['meta_title_' + meta.page]: meta.title,   ['meta_desc_' + meta.page]: meta.desc };
    let h = withDict(withCss, ja, en).replace(pageRe, inner);
    h = h.replace(/<title>[^<]*<\/title>/, '<title>' + esc(meta.title) + '</title>');
    h = h.replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, '$1' + esc(meta.desc) + '$2');
    h = h.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + meta.url + '">');
    h = h.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(meta.title) + '">');
    h = h.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(meta.desc) + '">');
    h = h.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + meta.url + '">');
    if (meta.image) h = h.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + ORIGIN + meta.image + '">');
    h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">\n' + meta.ld + '\n</script>');
    h = h.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<script>window.__PAGE=' + JSON.stringify(meta.page) + ';</script>\n<link rel="preconnect" href="https://fonts.googleapis.com">');
    // ハッシュルーターのリンクを実URLへ（これが無いと事例ページから事業・法務へ飛べない）
    h = h.replace(/href="#\/xbuild"/g, 'href="/xbuild/"')
         .replace(/href="#\/xad"/g, 'href="/xad/"')
         .replace(/href="#\/xinteractive"/g, 'href="/xinteractive/"')
         .replace(/href="#\/privacy"/g, 'href="/privacy/"')
         .replace(/href="#\/terms"/g, 'href="/terms/"');
    // ヘッダー/フッターのリンクはサブページ扱い
    h = h.replace(/<a class="back" href="#top"/g, '<a class="back" href="/"')
         .replace(/href="#(contact|record|company|careers|xbuild|xad|xinteractive|hero)"/g, 'href="/#$1"')
         .replace(/<a href="#top" class="hdr__logo">/g, '<a href="/" class="hdr__logo">');
    const out = path.join(DIST, dir);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), h);
    return h.length;
  }

  // 一覧
  const listUrl = ORIGIN + '/cases/';
  const listLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'CollectionPage', '@id': listUrl + '#webpage', url: listUrl,
      name: 'Cases — YELLOW Inc.', inLanguage: ['en', 'ja'],
      about: { '@id': ORG_ID },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: cases.length,
        itemListElement: cases.map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: dicts[i].e.title,
          url: ORIGIN + '/cases/' + c.key + '/',
        })),
      },
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: 'Cases', item: listUrl },
      ],
    }],
  }, null, 2);

  const sizes = [];
  const idxJa = {}, idxEn = {};
  dicts.forEach(d => { for (const k of ['title', 'lead', 'tags']) { idxJa[d.p + k] = d.ja[d.p + k]; idxEn[d.p + k] = d.en[d.p + k]; } });
  sizes.push(['/cases/', emit('cases', indexPageHtml(cases, dicts), {
    page: 'cases', ja: idxJa, en: idxEn,
    title: 'Cases — YELLOW Inc.',
    titleJa: '事例 — 株式会社YELLOW',
    desc: 'Factory layout studies, 3D modelling of station interiors, point-cloud data, in-store promotion simulation and more: ' + cases.length + ' cases implemented by YELLOW Inc., each with a working browser demo.',
    descJa: '工場のレイアウト検証、駅構内の3Dモデリング、点群データの活用、店頭販促シミュレーションなど、株式会社YELLOWが実装した' + cases.length + '件の事例。いずれもブラウザで動くデモを公開しています。',
    url: listUrl, ld: listLd, image: cases[0] && cases[0].imgs[0] && cases[0].imgs[0].src,
  })]);

  cases.forEach((c, i) => {
    const prod = productOf(c.eyebrow), d = dicts[i];
    const url = ORIGIN + '/cases/' + c.key + '/';
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': ['CreativeWork', 'WebPage'], '@id': url + '#webpage', url,
        name: d.e.title, headline: d.e.title, description: d.e.lead, inLanguage: ['en', 'ja'],
        creator: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
        image: c.imgs.slice(0, 3).map(im => ORIGIN + im.src),
        about: prod ? { '@type': 'Service', name: prod.label, url: ORIGIN + '/' + prod.id + '/' } : undefined,
        mainEntityOfPage: url,
        ...(c.demo ? { workExample: { '@type': 'WebApplication', url: c.demo, name: d.e.title + ' demo', applicationCategory: 'BusinessApplication', operatingSystem: 'Web' } } : {}),
        ...(c.press ? { subjectOf: { '@type': 'NewsArticle', url: c.press, headline: d.e.title } } : {}),
      }, {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Cases', item: ORIGIN + '/cases/' },
          { '@type': 'ListItem', position: 3, name: d.e.title, item: url },
        ],
      }],
    }, null, 2);
    sizes.push(['/cases/' + c.key + '/', emit(path.join('cases', c.key), casePageHtml(c, prod, d), {
      page: 'case_' + c.key.replace(/-/g, '_'), ja: d.ja, en: d.en,
      title: d.e.title + ' — Cases | YELLOW Inc.',
      titleJa: c.title + ' — 事例 | 株式会社YELLOW',
      desc: d.e.lead.slice(0, 160),
      descJa: c.lead.slice(0, 118),
      url, ld, image: c.imgs[0] && c.imgs[0].src,
    })]);
  });

  // 画像をコピー
  fs.cpSync(path.join(__dirname, 'assets/case'), path.join(DIST, 'assets/case'), { recursive: true });

  for (const x of (extra || [])) sizes.push([x.url, emit(x.dir, x.inner, x.meta)]);

  return { cases, sizes };
};

// 1枚HTMLへの組み込み（build-cases-inline.js）で使う部品
module.exports.parts = { CSS, COMMON, dictFor, casePageHtml, indexPageHtml, productOf, esc };
