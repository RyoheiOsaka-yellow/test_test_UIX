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
.case__shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin:44px 0;}
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

function casePageHtml(c, prod) {
  const shots = c.imgs.slice(0, 6).map(im =>
    `        <figure><img src="${im.src}" alt="${esc(im.alt)}" loading="lazy" decoding="async"></figure>`).join('\n');
  const body = c.sections.map(s => {
    let out = `        <h2>${esc(s.heading)}</h2>\n`;
    for (const p of s.paras) out += `        <p>${esc(p)}</p>\n`;
    if (s.items.length) out += '        <ul>\n' + s.items.map(i => `          <li>${esc(i)}</li>`).join('\n') + '\n        </ul>\n';
    return out;
  }).join('');
  const spec = c.spec.map(([k, v]) => `          <tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('\n');

  return `<div class="page active" id="page-case">
  <section class="case" lang="ja">
    <div class="case__wrap">
      <a class="back" href="/cases/">← 事例一覧へ戻る</a>
      <p class="case__eyebrow">${esc(c.eyebrow)}</p>
      <h1 class="case__title">${esc(c.title)}</h1>
      <p class="case__lead">${esc(c.lead)}</p>
      ${c.demo ? `<p><a class="case__demo" href="${esc(c.demo)}" target="_blank" rel="noopener">デモを開く ↗</a></p>` : ''}

      <div class="case__shots">
${shots}
      </div>

      <div class="case__cols">
        <div>
${body}        </div>
        <aside>
          <h2>仕様</h2>
          <table class="case__spec"><tbody>
${spec}
          </tbody></table>
        </aside>
      </div>

      <nav class="case__nav">
        <a href="/cases/">← 事例一覧</a>
        ${prod ? `<a href="/${prod.id}/">${prod.label} について →</a>` : '<a href="/#contact">お問い合わせ →</a>'}
      </nav>
    </div>
  </section>
</div>
`;
}

function indexPageHtml(cases) {
  const cards = cases.map(c => {
    const prod = productOf(c.eyebrow);
    return `      <a class="ccard" href="/cases/${c.key}/">
        <div class="ccard__img"><img src="${c.imgs[0] ? c.imgs[0].src : ''}" alt="${esc(c.title)}" loading="lazy" decoding="async"></div>
        <div class="ccard__body">
          <div class="ccard__tag">${esc(prod ? prod.label : (c.tags || '事例'))}</div>
          <h2 class="ccard__t">${esc(c.title)}</h2>
          <p class="ccard__d">${esc(c.lead)}</p>
        </div>
      </a>`;
  }).join('\n');

  return `<div class="page active" id="page-cases">
  <section class="cases" lang="ja">
    <div class="cases__head">
      <a class="back" href="/">← ホームへ戻る</a>
      <p class="eyebrow">Cases</p>
      <h1 class="title" style="font-size:clamp(26px,3.6vw,48px)">実装した事例。</h1>
      <p class="lede">工場のレイアウト検証から駅構内の3Dモデリング、点群データの活用、店頭販促のシミュレーションまで。いずれもブラウザで動くデモを公開しています。</p>
    </div>
    <div class="cases__grid">
${cards}
    </div>
  </section>
</div>
`;
}

module.exports = function buildCases({ DIST, ORIGIN, base, ORG_ID }) {
  const cases = JSON.parse(fs.readFileSync('/home/user/test_test_UIX/cases.json', 'utf8'));

  // 共通CSSを注入
  let withCss = base.replace('/* 法務ページ（プライバシーポリシー・利用規約） */', CSS + '/* 法務ページ（プライバシーポリシー・利用規約） */');
  if (withCss === base) throw new Error('cases CSS anchor missing');

  const pageRe = /<div class="page(?: active)?" id="page-[a-z]+">[\s\S]*?(?=\n<\/main>)/;
  if (!pageRe.test(withCss)) throw new Error('cases: page block not found');

  function emit(dir, inner, meta) {
    let h = withCss.replace(pageRe, inner);
    h = h.replace(/<title>[^<]*<\/title>/, '<title>' + esc(meta.title) + '</title>');
    h = h.replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, '$1' + esc(meta.desc) + '$2');
    h = h.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + meta.url + '">');
    h = h.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(meta.title) + '">');
    h = h.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(meta.desc) + '">');
    h = h.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + meta.url + '">');
    if (meta.image) h = h.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + ORIGIN + meta.image + '">');
    h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">\n' + meta.ld + '\n</script>');
    h = h.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<script>window.__PAGE=null;window.__TITLE_FIXED=true;</script>\n<link rel="preconnect" href="https://fonts.googleapis.com">');
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
      name: '事例 — 株式会社YELLOW', inLanguage: 'ja',
      about: { '@id': ORG_ID },
      mainEntity: {
        '@type': 'ItemList', numberOfItems: cases.length,
        itemListElement: cases.map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: c.title,
          url: ORIGIN + '/cases/' + c.key + '/',
        })),
      },
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: '事例', item: listUrl },
      ],
    }],
  }, null, 2);

  const sizes = [];
  sizes.push(['/cases/', emit('cases', indexPageHtml(cases), {
    title: '事例 — 株式会社YELLOW',
    desc: '工場のレイアウト検証、駅構内の3Dモデリング、点群データの活用、店頭販促シミュレーションなど、株式会社YELLOWが実装した' + cases.length + '件の事例。いずれもブラウザで動くデモを公開しています。',
    url: listUrl, ld: listLd, image: cases[0] && cases[0].imgs[0] && cases[0].imgs[0].src,
  })]);

  for (const c of cases) {
    const prod = productOf(c.eyebrow);
    const url = ORIGIN + '/cases/' + c.key + '/';
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': ['CreativeWork', 'WebPage'], '@id': url + '#webpage', url,
        name: c.title, headline: c.title, description: c.lead, inLanguage: 'ja',
        creator: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
        image: c.imgs.slice(0, 3).map(i => ORIGIN + i.src),
        about: prod ? { '@type': 'Service', name: prod.label, url: ORIGIN + '/' + prod.id + '/' } : undefined,
        mainEntityOfPage: url,
        ...(c.demo ? { workExample: { '@type': 'WebApplication', url: c.demo, name: c.title + ' デモ', applicationCategory: 'BusinessApplication', operatingSystem: 'Web' } } : {}),
      }, {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'ホーム', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: '事例', item: ORIGIN + '/cases/' },
          { '@type': 'ListItem', position: 3, name: c.title, item: url },
        ],
      }],
    }, null, 2);

    sizes.push(['/cases/' + c.key + '/', emit(path.join('cases', c.key), casePageHtml(c, prod), {
      title: c.title + ' — 事例 | 株式会社YELLOW',
      desc: c.lead.slice(0, 118),
      url, ld, image: c.imgs[0] && c.imgs[0].src,
    })]);
  }

  // 画像をコピー
  fs.cpSync('/home/user/test_test_UIX/assets/case', path.join(DIST, 'assets/case'), { recursive: true });

  return { cases, sizes };
};
