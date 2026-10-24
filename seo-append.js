// 公開用ビルドの仕上げ（SEO / AIO）
//   ・各ページの日本語版を /ja/ 配下に生成（辞書で日本語を焼き込み、title/description/canonical も日本語に）
//   ・英日で hreflang を相互に付け、og:locale・twitter:*・記事の article:published_time を補う
//   ・RSS（/news/feed.xml）、言語別・画像つきサイトマップ、llms-full.txt を出力
const fs = require('fs');
const path = require('path');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const escText = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ページから I18N 辞書を取り出す（build-static の焼き込みと同じ手順）
function dictOf(h) {
  const dm = h.match(/var I18N = \{[\s\S]*?\n\};/);
  if (!dm) throw new Error('I18N 辞書が見つかりません');
  return new Function(dm[0] + ' return I18N;')();
}
function pageIdOf(h) {
  const m = h.match(/window\.__PAGE=("[^"]*")/);
  return m ? JSON.parse(m[1]) : 'home';
}
function bake(h, d) {
  return h.replace(/(<([a-z0-9]+)([^>]*?)data-i18n="([^"]+)"([^>]*)>)([\s\S]*?)(<\/\2>)/g,
    (m, open, tag, pre, key, post, inner, close) => {
      if (!(key in d)) return m;
      const v = d[key];
      const html = /data-i18n-html="true"/.test(open) || v.indexOf('<') !== -1;
      return open + (html ? v : escText(v)) + close;
    });
}

// 内部リンクを /ja/ 配下へ（ファイルや assets は除く）
function toJaLinks(h) {
  return h.replace(/href="\/(?!ja\/)([^"]*)"/g, (m, p) => {
    if (/^(assets\/|og\.png$|[^#?]*\.(xml|txt|php|png|jpe?g|webp|svg|pdf|ico)(\?.*)?$)/.test(p)) return m;
    return 'href="/ja/' + p + '"';
  });
}

function headInsert(h, afterRe, add) {
  const m = h.match(afterRe);
  if (!m) throw new Error('head anchor: ' + afterRe);
  return h.replace(m[0], m[0] + '\n' + add);
}

function articleDate(h) {
  const m = h.match(/"@type":\s*"NewsArticle"[\s\S]*?"datePublished":\s*"([0-9-]+)"/);
  return m ? m[1] : null;
}
function ldImages(h) {
  const m = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  try {
    const d = JSON.parse(m[1]);
    const g = d['@graph'] || [d];
    const out = [];
    g.forEach(n => { const im = n.image; if (Array.isArray(im)) im.forEach(x => typeof x === 'string' && out.push(x)); else if (typeof im === 'string') out.push(im); });
    return out.filter(u => !/og\.png$/.test(u));
  } catch (e) { return []; }
}

module.exports = function finalize({ DIST, ORIGIN, newsItems, cases, routes, today }) {
  // ── 対象ページ（/ja/ と 404 を除く index.html）
  const pages = [];
  (function walk(dir, rel) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { if (rel === '' && f === 'ja') continue; if (f === 'assets') continue; walk(p, rel + f + '/'); }
      else if (f === 'index.html') pages.push(rel);
    }
  })(DIST, '');
  pages.sort();

  const feedLink = '<link rel="alternate" type="application/rss+xml" title="YELLOW News" href="' + ORIGIN + '/news/feed.xml">';
  const sitemapEntries = [];

  for (const rel of pages) {
    const file = path.join(DIST, rel, 'index.html');
    let h = fs.readFileSync(file, 'utf8');
    const enUrl = ORIGIN + '/' + rel, jaUrl = ORIGIN + '/ja/' + rel;
    const pid = pageIdOf(h);
    const I18N = dictOf(h);
    const ja = I18N.ja, en = I18N.en;
    const date = articleDate(h);
    const titleEn = (h.match(/<title>([^<]*)<\/title>/) || [, ''])[1];
    const descEn = (h.match(/<meta name="description" id="metaDesc" content="([^"]*)"/) || [, ''])[1];
    const ogImg = (h.match(/<meta property="og:image" content="([^"]*)"/) || [, ORIGIN + '/og.png'])[1];

    // ── 英語版: hreflang・og:locale・twitter・RSS・記事メタ
    const alt = (self) => [
      '<link rel="alternate" hreflang="en" href="' + enUrl + '">',
      '<link rel="alternate" hreflang="ja" href="' + jaUrl + '">',
      '<link rel="alternate" hreflang="x-default" href="' + enUrl + '">',
      feedLink,
    ].join('\n');
    const extrasEn = [
      '<meta property="og:locale" content="en_US">',
      '<meta property="og:locale:alternate" content="ja_JP">',
      '<meta name="twitter:title" content="' + esc(titleEn) + '">',
      '<meta name="twitter:description" content="' + esc(descEn) + '">',
      '<meta name="twitter:image" content="' + esc(ogImg) + '">',
    ];
    if (date) extrasEn.push('<meta property="article:published_time" content="' + date + '">', '<meta property="article:modified_time" content="' + date + '">');
    let hEn = h;
    if (!/hreflang=/.test(hEn)) hEn = headInsert(hEn, /<link rel="canonical" href="[^"]*">/, alt(enUrl));
    if (!/og:locale/.test(hEn)) hEn = headInsert(hEn, /<meta name="twitter:card" content="[^"]*">/, extrasEn.join('\n'));
    if (date) hEn = hEn.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="article">');
    fs.writeFileSync(file, hEn);

    // ── 日本語版
    let hJa = bake(h, ja);
    const titleJa = ja['meta_title_' + pid] || ja.meta_title || titleEn;
    const descJa = ja['meta_desc_' + pid] || ja.meta_desc || descEn;
    hJa = hJa.replace(/<html lang="en"/, '<html lang="ja"')
      .replace(/<title>[^<]*<\/title>/, '<title>' + esc(titleJa) + '</title>')
      .replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, '$1' + esc(descJa) + '$2')
      .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + jaUrl + '">')
      .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(titleJa) + '">')
      .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(descJa) + '">')
      .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + jaUrl + '">')
      .replace("window.__BAKED='en';", "window.__BAKED='ja';")
      .replace("var want='en';", "var want='ja';")
      .replace("var currentLang = 'en';", "var currentLang = 'ja';");
    hJa = headInsert(hJa, /<link rel="canonical" href="[^"]*">/, alt(jaUrl));
    const extrasJa = [
      '<meta property="og:locale" content="ja_JP">',
      '<meta property="og:locale:alternate" content="en_US">',
      '<meta name="twitter:title" content="' + esc(titleJa) + '">',
      '<meta name="twitter:description" content="' + esc(descJa) + '">',
      '<meta name="twitter:image" content="' + esc(ogImg) + '">',
    ];
    if (date) extrasJa.push('<meta property="article:published_time" content="' + date + '">', '<meta property="article:modified_time" content="' + date + '">');
    hJa = headInsert(hJa, /<meta name="twitter:card" content="[^"]*">/, extrasJa.join('\n'));
    if (date) hJa = hJa.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="article">');
    hJa = toJaLinks(hJa);
    // 旧アンカーの振り分けは英語トップだけで動けばよい
    const outDir = path.join(DIST, 'ja', rel);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), hJa);

    sitemapEntries.push({ rel, enUrl, jaUrl, date, images: ldImages(h), pid });
  }

  // ── サイトマップ（英日・hreflang・画像）
  const prio = (e) => e.rel === '' ? '1.0' : /^(xinteractive|xad|xbuild)\/$/.test(e.rel) ? '0.8' : e.rel === 'cases/' ? '0.9' : /^cases\//.test(e.rel) ? '0.7' : /^news\/.+/.test(e.rel) ? '0.6' : /^news\/$/.test(e.rel) ? '0.8' : '0.3';
  const urlXml = (loc, e, withImages) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${e.date || today}</lastmod>
    <priority>${prio(e)}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${e.enUrl}"/>
    <xhtml:link rel="alternate" hreflang="ja" href="${e.jaUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${e.enUrl}"/>${withImages ? e.images.map(i => `
    <image:image><image:loc>${esc(i)}</image:loc></image:image>`).join('') : ''}
  </url>`;
  fs.writeFileSync(DIST + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapEntries.map(e => urlXml(e.enUrl, e, true) + '\n' + urlXml(e.jaUrl, e, false)).join('\n')}
</urlset>
`);

  // ── RSS（お知らせ）
  const rssItems = newsItems.map(n => {
    const link = n.sections && n.sections.length ? ORIGIN + '/news/' + n.id + '/' : (n.case ? ORIGIN + '/cases/' + n.case + '/' : n.press);
    return `    <item>
      <title>${esc(n.ja.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(n.date + 'T00:00:00+09:00').toUTCString()}</pubDate>
      <description>${esc(n.ja.text)}</description>
    </item>`;
  }).join('\n');
  fs.writeFileSync(DIST + 'news/feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>株式会社YELLOW お知らせ</title>
    <link>${ORIGIN}/news/</link>
    <atom:link href="${ORIGIN}/news/feed.xml" rel="self" type="application/rss+xml"/>
    <description>株式会社YELLOWのお知らせ。採択、加盟、プレスリリースなど。</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`);

  // ── llms-full.txt（本文を丸ごと。AI がサイトを読むときの一次資料）
  const secText = (s) => [s.heading ? '### ' + s.heading : '', ...(s.paras || []), ...(s.items || []).map(i => '- ' + i)].filter(Boolean).join('\n');
  const caseText = (c) => [`## ${c.title}`, `URL: ${ORIGIN}/cases/${c.key}/`, c.eyebrow ? `分類: ${c.eyebrow}` : '', c.lead, ...(c.sections || []).map(secText),
    (c.spec || []).length ? '### 仕様\n' + c.spec.map(([k, v]) => `- ${k}: ${v}`).join('\n') : '', c.demo ? `デモ: ${c.demo}` : '', c.press ? `プレスリリース: ${c.press}` : ''].filter(Boolean).join('\n\n');
  const newsText = (n) => [`## ${n.ja.title}（${n.date}）`, n.sections && n.sections.length ? `URL: ${ORIGIN}/news/${n.id}/` : '', n.ja.sub || '', n.ja.text,
    ...(n.sections || []).map(s => [s.ja.h ? '### ' + s.ja.h : '', ...(s.ja.paras || []), ...(s.ja.items || []).map(i => '- ' + i), ...(s.ja.notes || [])].filter(Boolean).join('\n')),
    n.press ? `プレスリリース: ${n.press}` : '', n.case ? `関連する事例: ${ORIGIN}/cases/${n.case}/` : ''].filter(Boolean).join('\n\n');
  const routeText = routes.filter(r => r.service).map(r => `## ${r.service.name}（${r.service.alt}）\nURL: ${ORIGIN}/${r.dir}/\n${r.desc}\n提供内容: ${r.service.offers.join('、')}`).join('\n\n');
  fs.writeFileSync(DIST + 'llms-full.txt', `# 株式会社YELLOW（YELLOW Inc.） — 全文

> 大学・研究機関・企業の技術シーズを社会へ橋渡しする会社。群馬県高崎市。2022年設立。
> 本ファイルはサイト全体の本文をそのまま収めたもの。要約は ${ORIGIN}/llms.txt。英語版ページは各URLそのまま、日本語版は ${ORIGIN}/ja/ 配下。

# 事業

${routeText}

# 事例（${cases.length}件）

${cases.map(caseText).join('\n\n---\n\n')}

# お知らせ（${newsItems.length}件）

${newsItems.map(newsText).join('\n\n---\n\n')}

# 会社情報

- 会社名: 株式会社YELLOW（YELLOW Inc.）
- 所在地: 群馬県高崎市白銀町9番地 白銀ビル3F
- 設立: 2022年
- 代表取締役: 大坂亮平、岩渕知弘
- 連絡先: info@yellow.technology / ${ORIGIN}/#contact
`);

  return { pages: pages.length, ja: pages.length };
};
