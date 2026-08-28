// v8（1URL・ハッシュルーター）から、実URLを持つ静的サイトを生成する。
//   dist/index.html  /xbuild/  /xad/  /xinteractive/  /privacy/  /terms/
// 各ファイルは自分のページのマークアップだけを持ち、独自の title / description /
// canonical / OGP / JSON-LD を備える。ページ間は通常のページ遷移。
const fs = require('fs');
const path = require('path');

const REPO = __dirname + '/';          // このスクリプトが置かれた場所を基準にする
const DIST = REPO + 'dist/';
const ORIGIN = 'https://yellow.technology';   // ★ドメイン確定時はここ1行を変えるだけ

const ROUTES = [
  { id: 'home', dir: '', title: '株式会社YELLOW｜研究を、素材として。',
    desc: '株式会社YELLOWは、大学・研究機関・企業の技術シーズを社会へ橋渡しする会社です。人流分析、スポーツDX、そして研究と現場のあいだの運用レイヤーを担います。群馬県高崎市。',
    en: { title: 'YELLOW Inc. — Research as material.',
          desc: 'YELLOW bridges technology seeds from universities, research institutions, and companies into society — mobility analytics, sports DX, and the operational layer between research and real-world use.' } },
  { id: 'xbuild', dir: 'xbuild', title: 'xBUILD｜技術シーズを製品・設備・システムとして立ち上げる — 株式会社YELLOW',
    desc: '大学・研究機関・企業の技術シーズを発掘し、試作から検証、現場で稼働する形まで一貫して設計・実装します。TOLIC加盟、一般社団法人BtoR参画。株式会社YELLOWのプロダクト xBUILD。',
    en: { title: 'xBUILD — Turning technology seeds into products, facilities and systems | YELLOW Inc.',
          desc: 'Sourcing technology seeds from universities and research institutions, then designing and implementing them through prototyping and validation into systems that run in the field.' },
    service: { name: 'xBUILD', alt: '技術シーズの社会実装（研究開発・技術移転）',
               desc: '技術シーズを、製品・設備・システムとして立ち上げるプロダクト。',
               offers: ['技術シーズの発掘', '研究開発の支援'] } },
  { id: 'xad', dir: 'xad', title: 'xAD｜人流・行動データから届け方を設計する — 株式会社YELLOW',
    desc: '交通手段別・時間別・経路別の来訪動態をデータとして捕捉し、混雑緩和や導線設計に落とし込みます。公的プログラムへの採択支援まで。SOIP×いわきFC。株式会社YELLOWのプロダクト xAD。',
    en: { title: 'xAD — Designing how a message lands, from mobility and behaviour data | YELLOW Inc.',
          desc: 'Capturing visitor dynamics by mode, time and route, then turning them into congestion relief and circulation design.' },
    service: { name: 'xAD', alt: '人流・行動データ分析、公的プログラム採択支援',
               desc: '人流と行動のデータから、伝えるべき相手と場所と時間を割り出すプロダクト。',
               offers: ['人流・行動データ分析', '公的プログラムへの採択'] } },
  { id: 'xinteractive', dir: 'xinteractive', title: 'xINTERACTIVE｜研究を現場で動く体験として実装する — 株式会社YELLOW',
    desc: 'スタジアム、商業施設、街区。研究の成果を来場者が触れて動く体験として実装し、運用まで伴走します。スポーツ庁SOIP採択事業。株式会社YELLOWのプロダクト xINTERACTIVE。',
    en: { title: 'xINTERACTIVE — Implementing research as experiences that run on site | YELLOW Inc.',
          desc: 'Stadiums, commercial facilities and districts — implementing research as hands-on experiences and supporting them through operation.' },
    service: { name: 'xINTERACTIVE', alt: 'スポーツDX、体験設計・実装・運用支援',
               desc: '研究の成果を、来場者が触れて動く体験として実装するプロダクト。',
               offers: ['スポーツDX', '市場への展開'] } },
  { id: 'privacy', dir: 'privacy', title: 'プライバシーポリシー — 株式会社YELLOW',
    desc: '株式会社YELLOWのウェブサイトにおける個人情報の取り扱いについて定めています。',
    en: { title: 'Privacy Policy — YELLOW Inc.', desc: 'How YELLOW Inc. handles personal information on this website.' },
    noindexHint: false },
  { id: 'terms', dir: 'terms', title: '利用規約 — 株式会社YELLOW',
    desc: '株式会社YELLOWのウェブサイトの利用条件を定めています。',
    en: { title: 'Terms of Use — YELLOW Inc.', desc: 'Terms and conditions for using the YELLOW Inc. website.' } },
];

const ORG_LD = {
  '@type': 'Organization',
  '@id': ORIGIN + '/#organization',
  name: '株式会社YELLOW',
  alternateName: 'YELLOW Inc.',
  url: ORIGIN + '/',
  logo: { '@type': 'ImageObject', url: ORIGIN + '/og.png', width: 1200, height: 630 },
  email: 't.iwabuchi@yellow.technology',
  foundingDate: '2022',
  description: '大学・研究機関・企業の技術シーズを社会へ橋渡しする会社。人流分析、スポーツDX、研究と現場のあいだの運用レイヤーを担う。',
  address: {
    '@type': 'PostalAddress', addressCountry: 'JP', addressRegion: '群馬県',
    addressLocality: '高崎市', streetAddress: '白銀町9番地 白銀ビル3F',
  },
  knowsAbout: ['技術シーズの社会実装', '人流データ分析', 'スポーツDX', '産学連携', '公的プログラムの採択支援', '3Dモデリング', '点群データ'],
  member: [
    { '@type': 'Person', name: '大坂 亮平', jobTitle: '共同創業者' },
    { '@type': 'Person', name: '岩渕 知弘', jobTitle: '共同創業者' },
  ],
};

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function ldFor(r) {
  const graph = [ORG_LD, {
    '@type': 'WebSite', '@id': ORIGIN + '/#website',
    url: ORIGIN + '/', name: '株式会社YELLOW',
    publisher: { '@id': ORIGIN + '/#organization' }, inLanguage: ['en', 'ja'],
  }];
  const url = ORIGIN + (r.dir ? '/' + r.dir + '/' : '/');
  graph.push({
    '@type': 'WebPage', '@id': url + '#webpage', url: url,
    name: r.en.title, description: r.en.desc,
    isPartOf: { '@id': ORIGIN + '/#website' },
    about: { '@id': ORIGIN + '/#organization' }, inLanguage: ['en', 'ja'],
  });
  if (r.service) {
    graph.push({
      '@type': 'Service', '@id': url + '#service',
      name: r.service.name, alternateName: r.service.alt, description: r.service.desc,
      serviceType: r.service.alt, url: url,
      provider: { '@id': ORIGIN + '/#organization' }, areaServed: { '@type': 'Country', name: '日本' },
      hasOfferCatalog: {
        '@type': 'OfferCatalog', name: r.service.name + ' の提供内容',
        itemListElement: r.service.offers.map(o => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: o } })),
      },
    });
  }
  if (r.dir) {
    graph.push({
      '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: r.service ? r.service.name : r.title.split(' — ')[0], item: url },
      ],
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

// ── 1. ベースHTMLを読み、共通の下ごしらえ
let base = fs.readFileSync(REPO + 'yellow_spacex_v8.html', 'utf8');

// 1a. showPage を「この文書に無いページなら何もしない」よう寛容にする
{
  const o = `function showPage(name, scrollTo, restoreY) {
  if (PAGES.indexOf(name) === -1) name = 'home';`;
  const n = `function showPage(name, scrollTo, restoreY) {
  if (PAGES.indexOf(name) === -1) name = 'home';
  // 静的ビルドでは各文書が自分のページしか持たない。無ければ何もしない
  if (!document.getElementById('page-' + name)) {
    if (scrollTo) {
      var st = document.getElementById(scrollTo);
      if (st) st.scrollIntoView();
    }
    return;
  }`;
  if (!base.includes(o)) throw new Error('showPage anchor');
  base = base.replace(o, n);
}

// 1b. setLang がページ別の title / description を尊重するようにする
{
  const o = `  document.documentElement.lang = lang;
  document.title = d.meta_title;`;
  const n = `  document.documentElement.lang = lang;
  // 静的ビルドでは window.__PAGE ごとの title / description を優先する
  var pk = window.__PAGE;
  if (!window.__TITLE_FIXED) {
    document.title = (pk && d['meta_title_' + pk]) ? d['meta_title_' + pk] : d.meta_title;
  }`;
  if (!base.includes(o)) throw new Error('setLang title anchor');
  base = base.replace(o, n);

  const o2 = `  if (md) md.setAttribute('content', d.meta_desc);`;
  const n2 = `  if (md && !window.__TITLE_FIXED) md.setAttribute('content', (pk && d['meta_desc_' + pk]) ? d['meta_desc_' + pk] : d.meta_desc);`;
  if (!base.includes(o2)) throw new Error('setLang desc anchor');
  base = base.replace(o2, n2);
}

// 1c. 辞書へページ別 meta を追加（日英対称）
{
  const jaEntries = ROUTES.map(r => `    meta_title_${r.id}: ${JSON.stringify(r.title)}, meta_desc_${r.id}: ${JSON.stringify(r.desc)},`).join('\n');
  const enEntries = ROUTES.map(r => `    meta_title_${r.id}: ${JSON.stringify(r.en.title)}, meta_desc_${r.id}: ${JSON.stringify(r.en.desc)},`).join('\n');
  base = base.replace(/(    meta_title: "株式会社YELLOW",)/, jaEntries + '\n$1');
  base = base.replace(/(    meta_title: "YELLOW Inc\.",)/, enEntries + '\n$1');
}

// 1d. 画像の代替テキスト（実績カード4枚）
{
  const alts = ['SOIP × いわきFC — 点群データによる大井町エリアの3Dモデリング',
    'TOLIC 加盟 — 点群データによる建物モデルの一括生成',
    '一般社団法人BtoR 参画 — 工場移転シミュレーションの俯瞰ビュー',
    'WELLNEXUS 鎌倉 2026 — 点群データによるフロア構成の可視化'];
  let i = 0;
  base = base.replace(/(<img src="data:image\/webp;base64,[^"]+" )alt=""/g, (m, p) => p + 'alt="' + esc(alts[i++] || '') + '"');
}

// 1e. 埋め込み画像(base64)をファイルへ切り出す。全ページ共通のURLになりキャッシュが効く
const IMG_DIR = DIST + 'assets/img/';
{
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const seen = new Map();
  base = base.replace(/data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)/g, (m, ext, b64) => {
    if (seen.has(b64)) return seen.get(b64);
    const buf = Buffer.from(b64, 'base64');
    const name = 'img' + String(seen.size + 1).padStart(2, '0') + '.' + (ext === 'jpeg' ? 'jpg' : ext);
    fs.writeFileSync(IMG_DIR + name, buf);
    const url = '/assets/img/' + name;
    seen.set(b64, url);
    return url;
  });
  console.log('画像を外部化:', seen.size, '枚 →', '/assets/img/');
}

// 1f. アセット参照を絶対パスへ（/xbuild/ 配下から相対解決されて404になるのを防ぐ）
base = base.replace(/data-src="assets\/video\//g, 'data-src="/assets/video/');

// 1e2. パネル背景デモ(<template>)を単体HTMLへ切り出す。
//      単一ファイル版は srcdoc で動かすが、公開版は外部ファイルにして
//      ページ本体を軽くし、ブラウザにキャッシュさせる（本文からは丸ごと取り除く）
{
  const DEMO_DIR = DIST + 'assets/demo/';
  const A = '<!-- ══ DEMO-EMBED:TPL:START ══ -->';
  const B = '<!-- ══ DEMO-EMBED:TPL:END ══ -->';
  const a = base.indexOf(A);
  if (a !== -1) {
    const b = base.indexOf(B, a);
    if (b === -1) throw new Error('DEMO-EMBED:TPL:END が見つかりません');
    const block = base.slice(a, b);
    fs.mkdirSync(DEMO_DIR, { recursive: true });
    const re = /<template id="tpl-demo-([a-z0-9_-]+)">\n([\s\S]*?)\n<\/template>/g;
    let m, n = 0;
    while ((m = re.exec(block)) !== null) {
      const page = '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
                 + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
                 + '<title>' + m[1] + '</title>\n</head>\n<body>\n' + m[2] + '\n</body>\n</html>\n';
      fs.writeFileSync(DEMO_DIR + m[1] + '.html', page);
      n++;
    }
    if (!n) throw new Error('デモの <template> が1つも取り出せませんでした');
    base = base.slice(0, a) + base.slice(b + B.length);
    // 外部ファイルを読ませる
    base = base.replace(/<div class="panel__embed" /g, '<div class="panel__embed" data-demo-base="/assets/demo/" ');
    // 外部ライブラリはサイト内に同梱し、CDN 待ちを無くす（単一ファイル版は CDN のまま）
    {
      const LIB_SRC = REPO + 'demos/lib/';
      const LIB_DST = DEMO_DIR + 'lib/';
      (function copyTree(a, b) {
        fs.mkdirSync(b, { recursive: true });
        for (const e of fs.readdirSync(a, { withFileTypes: true })) {
          if (e.isDirectory()) copyTree(a + e.name + '/', b + e.name + '/');
          else fs.copyFileSync(a + e.name, b + e.name);
        }
      })(LIB_SRC, LIB_DST);
      const LIB_MAP = {
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js': './lib/three/three.module.min.js',
      };
      for (const f of fs.readdirSync(DEMO_DIR)) {
        if (!f.endsWith('.html')) continue;
        const p = DEMO_DIR + f;
        let t = fs.readFileSync(p, 'utf8');
        for (const [cdn, local] of Object.entries(LIB_MAP)) t = t.split(cdn).join(local);
        fs.writeFileSync(p, t);
      }
    }
    console.log('デモを外部化:', n, '件 →', '/assets/demo/');
  }
}

// 1g. ナビに「事例」を追加（実績の隣）
{
  const o = '<a class="hdr__link" href="#record"  data-i18n="nav_record">Record</a>';
  if (!base.includes(o)) throw new Error('nav anchor');
  base = base.replace(o, '<a class="hdr__link" href="/cases/" data-i18n="nav_cases">Cases</a>\n    ' + o);
  base = base.replace(/(    nav_work: "事業",)/, '    nav_cases: "事例", nav_cases_view: "事例を見る →",\n$1');
  base = base.replace(/(    nav_work: "Work",)/, '    nav_cases: "Cases", nav_cases_view: "View cases →",\n$1');
  // 全画面メニューにも
  const m = '<a class="menu__item" href="#record"';
  if (base.includes(m)) base = base.replace(m, '<a class="menu__item" href="/cases/" data-i18n="nav_cases" style="--dl:.10s">Cases</a>\n    ' + m);
  // ドロップダウンの「事業の一覧へ」の隣に事例導線
  base = base.replace('<a class="drop__all" href="#xbuild" data-i18n="drop_all">',
    '<a class="drop__all" href="/cases/" style="display:block;margin-bottom:10px" data-i18n="nav_cases_view">View cases →</a>\n            <a class="drop__all" href="#xbuild" data-i18n="drop_all">');
}

// 1h. 旧サイトのアンカー(#case-01 等)で来た人を新URLへ送る
{
  const map = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'))
    .reduce((a, c, i) => (a['case-' + String(i + 1).padStart(2, '0')] = '/cases/' + c.key + '/', a), {});
  const script = `<script>
/* 旧サイトのアンカーで来た訪問者を対応するページへ送る（フラグメントはサーバに届かないためJSで処理） */
(function () {
  var M = ${JSON.stringify(map)};
  M['about'] = '/#company'; M['profile'] = '/#company'; M['intro'] = '/';
  var k = (location.hash || '').replace('#', '');
  if (k && M[k] && location.pathname === '/') location.replace(M[k]);
})();
</script>
`;
  base = base.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
    script + '<link rel="preconnect" href="https://fonts.googleapis.com">');
}

// ── 2. ルートごとに出力
// 1e3. 既定言語（英語）を HTML に静的に焼き込む。
//      JSを待たずに最初から英語で描画され、クローラも英語本文を読める。
//      日本語は setLang('ja') が辞書から差し戻す（辞書はそのまま残る）。
{
  const dm = base.match(/var I18N = \{[\s\S]*?\n\};/);
  if (!dm) throw new Error('I18N 辞書が見つかりません');
  const I18N = new Function(dm[0] + ' return I18N;')();
  const en = I18N.en;
  if (!en) throw new Error('英語辞書が見つかりません');
  const escText = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let replaced = 0, missing = [];
  base = base.replace(/(<([a-z0-9]+)([^>]*?)data-i18n="([^"]+)"([^>]*)>)([\s\S]*?)(<\/\2>)/g,
    (m, open, tag, pre, key, post, inner, close) => {
      if (!(key in en)) { missing.push(key); return m; }
      const v = en[key];
      const html = /data-i18n-html="true"/.test(open) || v.indexOf('<') !== -1;
      replaced++;
      return open + (html ? v : escText(v)) + close;
    });
  if (missing.length) console.log('  ⚠ 英語辞書に無いキー:', missing.slice(0, 5).join(', '));
  console.log('英語を静的に焼き込み:', replaced, '箇所');
  // この文書の焼き込み言語を宣言（言語ゲートが参照する）
  base = base.replace("window.__BAKED='ja';", "window.__BAKED='en';");
}


for (const r of ROUTES) {
  let h = base;
  const url = ORIGIN + (r.dir ? '/' + r.dir + '/' : '/');

  // 2a. 自分以外のページ div を削除。
  //     閉じタグの体裁が一定でないため、ページ開始位置と </main> で区間を切る
  {
    const spans = [];
    const re = /<div class="page(?: active)?" id="page-([a-z]+)">/g;
    let m;
    while ((m = re.exec(h)) !== null) spans.push({ id: m[1], start: m.index });
    const mainEnd = h.indexOf('\n</main>');
    if (mainEnd === -1) throw new Error(r.id + ': </main> not found');
    if (spans.length !== ROUTES.length) throw new Error(r.id + ': page count ' + spans.length);
    for (let i = 0; i < spans.length; i++) {
      spans[i].end = (i + 1 < spans.length) ? spans[i + 1].start : mainEnd;
    }
    // 後ろから消してインデックスを保つ
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].id === r.id) continue;
      h = h.slice(0, spans[i].start) + h.slice(spans[i].end);
    }
    // 残った見出しコメントを掃除
    h = h.replace(/<!-- ═+ PAGE: [^>]*═+ -->\n?/g, '');
  }
  h = h.replace('<div class="page" id="page-' + r.id + '">', '<div class="page active" id="page-' + r.id + '">');

  // 2b. リンクを実URLへ。サブページからのセクションリンクはトップ配下へ
  h = h.replace(/href="#\/xbuild"/g, 'href="/xbuild/"')
       .replace(/href="#\/xad"/g, 'href="/xad/"')
       .replace(/href="#\/xinteractive"/g, 'href="/xinteractive/"')
       .replace(/href="#\/privacy"/g, 'href="/privacy/"')
       .replace(/href="#\/terms"/g, 'href="/terms/"');
  if (r.id !== 'home') {
    h = h.replace(/<a class="back" href="#top"/g, '<a class="back" href="/"');
    h = h.replace(/href="#(contact|record|company|careers|xbuild|xad|xinteractive|hero)"/g, 'href="/#$1"');
    h = h.replace(/<a href="#top" class="hdr__logo">/g, '<a href="/" class="hdr__logo">');
    h = h.replace(/<a class="ft__logo-link" href="#top">/g, '<a class="ft__logo-link" href="/">');
  }

  // 2c. head：title / description / canonical / OGP / hreflang / JSON-LD
  //      サイトの既定言語は英語。head も英語で焼き、日本語は JA 切り替えで出す
  h = h.replace(/<html lang="ja">/, '<html lang="en">');
  h = h.replace(/<title>[^<]*<\/title>/, '<title>' + esc(r.en.title) + '</title>');
  h = h.replace(/(<meta name="description" id="metaDesc" content=")[^"]*(")/, '$1' + esc(r.en.desc) + '$2');
  h = h.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  h = h.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(r.en.title) + '">');
  h = h.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(r.en.desc) + '">');
  h = h.replace(/<meta property="og:site_name" content="[^"]*">/, '<meta property="og:site_name" content="YELLOW Inc.">');
  h = h.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">');
  h = h.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + ORIGIN + '/og.png">');
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">\n' + ldFor(r) + '\n</script>');

  // 2d. このページの識別子（setLang がページ別 meta を引くのに使う）
  h = h.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<script>window.__PAGE=' + JSON.stringify(r.id) + ';</script>\n<link rel="preconnect" href="https://fonts.googleapis.com">');

  const outDir = r.dir ? DIST + r.dir : DIST.slice(0, -1);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), h);
  console.log(('/' + r.dir).padEnd(16), (h.length / 1024).toFixed(0).padStart(5) + 'KB  ' + r.title.slice(0, 40));
}

// ── 2.5 事例ページ（現行サイトから移植した17件）
const buildCases = require('./cases-append.js');
const CASES = buildCases({ DIST, ORIGIN, base, ORG_ID: ORIGIN + '/#organization' });
for (const [u, n] of CASES.sizes) console.log(u.padEnd(30), (n / 1024).toFixed(0).padStart(4) + 'KB');

// ── 3. 付随ファイル
for (const f of ['og.png', '404.html']) fs.copyFileSync(REPO + f, DIST + f);
fs.cpSync(REPO + 'assets', DIST + 'assets', { recursive: true });

fs.writeFileSync(DIST + 'robots.txt', `# 株式会社YELLOW
User-agent: *
Allow: /

# 生成AI・AI検索のクローラを明示的に許可（引用・回答内での参照を受け入れる）
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`);

const today = '2026-08-13';
fs.writeFileSync(DIST + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map(r => `  <url>
    <loc>${ORIGIN}${r.dir ? '/' + r.dir + '/' : '/'}</loc>
    <lastmod>${today}</lastmod>
    <priority>${r.dir === '' ? '1.0' : (r.service ? '0.8' : '0.3')}</priority>
  </url>`).join('\n')}
  <url><loc>${ORIGIN}/cases/</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
${CASES.cases.map(c => `  <url><loc>${ORIGIN}/cases/${c.key}/</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`).join('\n')}
</urlset>
`);

// llms.txt — AI に読ませる前提の要約（提案中の標準フォーマット）
fs.writeFileSync(DIST + 'llms.txt', `# 株式会社YELLOW（YELLOW Inc.）

> 大学・研究機関・企業の技術シーズを社会へ橋渡しする会社。群馬県高崎市。
> 論文とプロダクトの間の距離を埋めることを事業にしている。2022年設立。

## 概要

株式会社YELLOWは、研究水準の手法と、その現場での実装をつなぐレイヤーを担う。
事業は3つのプロダクトに整理されている。

- **xBUILD（つくる）**: 技術シーズを、製品・設備・システムとして立ち上げる。
  内訳は「技術シーズの発掘」と「研究開発の支援」。ライフサイエンス機器の集積拠点
  TOLIC への加盟を通じ、国内有数の開発パイプラインに接続している。
- **xAD（届ける）**: 人流と行動のデータから、伝えるべき相手と場所と時間を割り出す。
  内訳は「人流・行動データ分析」と「公的プログラムへの採択」。交通手段別・時間別・
  経路別の来訪動態を捕捉し、混雑緩和や導線設計に落とし込む。
- **xINTERACTIVE（動かす）**: 研究の成果を、来場者が触れて動く体験として実装する。
  内訳は「スポーツDX」と「市場への展開」。スタジアム、商業施設、街区が対象。

## 主なページ

- [ホーム](${ORIGIN}/): 会社概要、3プロダクト、実績、採用、お問い合わせ
- [xBUILD](${ORIGIN}/xbuild/): 技術シーズの社会実装
- [xAD](${ORIGIN}/xad/): 人流・行動データ分析
- [xINTERACTIVE](${ORIGIN}/xinteractive/): スポーツDXと体験実装
- [プライバシーポリシー](${ORIGIN}/privacy/)
- [利用規約](${ORIGIN}/terms/)

## 事例（すべてブラウザで動くデモを公開）

${CASES.cases.map(c => `- [${c.title}](${ORIGIN}/cases/${c.key}/): ${c.lead}`).join('\n')}

## 実績（公開記録）

- **SOIP × いわきFC**（2025.08）: スポーツ庁「スポーツオープンイノベーション推進事業」
  に採択。いわきFC・LocationMind とともに、人流データ分析によるスタジアムアクセス
  改善と地域価値創造を推進。
- **TOLIC 加盟**（2025）: 東北ライフサイエンス・インストルメンツ・クラスターに
  企業会員として加盟。
- **一般社団法人BtoR 参画**（2025.12）: TOLICが設立した法人に企業会員として参画。
  助成金申請と採択事業の管理を支える。
- **WELLNEXUS 鎌倉 2026**（2026.03）: スピック・鎌倉インターナショナルFC主催の
  コンテストでファイナリスト7社に選出。

## 会社情報

- 会社名: 株式会社YELLOW（YELLOW Inc.）
- 設立: 2022年
- 所在地: 群馬県高崎市白銀町9番地 白銀ビル3F
- 事業領域: 技術シーズの社会実装
- 共同創業者: 大坂 亮平（研究運営、産学連携の組成・構造設計）／
  岩渕 知弘（技術シーズ系ベンチャーの市場展開、官公庁のイノベーション・プログラム対応）
- お問い合わせ: t.iwabuchi@yellow.technology
`);

// XServer(Apache) 用
fs.writeFileSync(DIST + '.htaccess', `ErrorDocument 404 /404.html

# 静的アセットは長期キャッシュ、HTMLは都度確認
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType video/mp4 "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/plain application/json
</IfModule>
`);

// Netlify 用
fs.writeFileSync(DIST + '_headers', `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/assets/demo/*
  Access-Control-Allow-Origin: *
/*.html
  Cache-Control: public, max-age=0, must-revalidate
`);

// デモは sandbox iframe（不透明オリジン）から ES モジュールとして読まれるため CORS 許可が要る。
// Netlify は上の _headers、XServer(Apache) はこの .htaccess が効く
fs.writeFileSync(DIST + 'assets/demo/.htaccess', `<IfModule mod_headers.c>
Header set Access-Control-Allow-Origin "*"
</IfModule>
`);

console.log('\nrobots.txt / sitemap.xml / llms.txt / 404.html / og.png / .htaccess / _headers / assets を出力');
console.log('dist 合計:', (execSizeMB(DIST)).toFixed(1) + 'MB');

function execSizeMB(dir) {
  let t = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else t += fs.statSync(p).size;
    }
  })(dir);
  return t / 1048576;
}
