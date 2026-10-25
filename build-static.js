// v8（1URL・ハッシュルーター）から、実URLを持つ静的サイトを生成する。
//   dist/index.html  /xinteractive/  /xad/  /xbuild/  /privacy/  /terms/
// 各ファイルは自分のページのマークアップだけを持ち、独自の title / description /
// canonical / OGP / JSON-LD を備える。ページ間は通常のページ遷移。
const fs = require('fs');
const path = require('path');

const REPO = __dirname + '/';          // このスクリプトが置かれた場所を基準にする
const DIST = REPO + 'dist/';
const ORIGIN = 'https://yellow.technology';   // ★ドメイン確定時はここ1行を変えるだけ

const ROUTES = [
  { id: 'home', dir: '', title: '株式会社YELLOW｜研究を、素材として。',
    desc: '株式会社YELLOWは、大学・研究機関・企業の技術シーズを社会へ橋渡しする会社です。xINTERACTIVE（エンタメ・体験・UI/UX）、xAD（戦略分析とプロトタイピング）、xBUILD（人流・工業の大規模開発）の3つの事業を手がけます。群馬県高崎市。',
    en: { title: 'YELLOW Inc. — Research as material.',
          desc: 'YELLOW Inc. bridges technology seeds from universities, research institutions and companies into society through three businesses: xINTERACTIVE (entertainment, experiences and UI/UX), xAD (strategy analysis and prototyping) and xBUILD (large-scale development for mobility and industry).' } },
  { id: 'xinteractive', dir: 'xinteractive', title: 'xINTERACTIVE｜エンタメ・体験・UI/UXに、研究シーズとAIの知見を — 株式会社YELLOW',
    desc: 'エンターテインメント、体験、UI/UXを対象に、研究シーズ（リアルタイム3D、シミュレーション、空間データ）とAIの知見を盛り込んだプロジェクトを提供。企画・体験設計から実装、現場運用まで手がけます。株式会社YELLOWの事業 xINTERACTIVE。',
    en: { title: 'xINTERACTIVE — Entertainment, experiences and UI/UX, built with research seeds and AI | YELLOW Inc.',
          desc: 'Projects for entertainment, experiences and UI/UX that bring in research seeds (real-time 3D, simulation, spatial data) and AI know-how, from concept and design to on-site operation.' },
    service: { name: 'xINTERACTIVE', alt: 'エンタメ・体験・UI/UXの企画・開発',
               desc: 'エンターテインメント、体験、UI/UXを対象に、研究シーズやAIの知見を盛り込んで提供するプロジェクト。',
               offers: ['体験・エンターテインメント', 'UI/UX デザイン・開発'] } },
  { id: 'xad', dir: 'xad', title: 'xAD｜戦略分析とプロトタイピングを、PM・コンサルタントとして — 株式会社YELLOW',
    desc: '新規事業やマーケティングの戦略分析と、AIを使ったプロトタイピングを、プロジェクトマネージャー・コンサルタントとして担います。データから戦略を設計し、試せる形まで届けます。株式会社YELLOWの事業 xAD。',
    en: { title: 'xAD — Strategy analysis and prototyping, as project managers and consultants | YELLOW Inc.',
          desc: 'Strategy analysis for new businesses and marketing, and AI-driven prototyping, delivered as project managers and consultants: from data to strategy to something you can test.' },
    service: { name: 'xAD', alt: '戦略分析・プロトタイピング（PM・コンサルティング）',
               desc: '戦略分析とプロトタイピングを、プロジェクトマネージャー・コンサルタントとして担うプロジェクト。',
               offers: ['プロトタイピング', '戦略分析'] } },
  { id: 'xbuild', dir: 'xbuild', title: 'xBUILD｜人流や工業など、大規模な領域の分析と開発 — 株式会社YELLOW',
    desc: '人流や工業といった大規模な領域の開発プロジェクト。都市・施設・工場・設備をデジタルツインとして再現し、人流データや点群、衛星データ、機械の稼働までを分析して、現場で動くシステムまで開発します。株式会社YELLOWの事業 xBUILD。',
    en: { title: 'xBUILD — Large-scale analysis and development, from mobility to industry | YELLOW Inc.',
          desc: 'Large-scale development for mobility and industry: cities, facilities, factories and equipment modelled as digital twins, analysed from mobility data to machinery, and built into systems that run on site.' },
    service: { name: 'xBUILD', alt: '人流・工業の大規模開発（デジタルツイン・システム開発）',
               desc: '人流や工業といった大規模な領域の分析と開発を行うプロジェクト。',
               offers: ['工業・設備', '人流・都市'] } },
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
  email: 'info@yellow.technology',
  foundingDate: '2022',
  description: '大学・研究機関・企業の技術シーズを社会へ橋渡しする会社。xINTERACTIVE（エンタメ・体験・UI/UX）、xAD（戦略分析とプロトタイピング）、xBUILD（人流・工業の大規模開発）の3つの事業を手がける。',
  address: {
    '@type': 'PostalAddress', addressCountry: 'JP', addressRegion: '群馬県',
    addressLocality: '高崎市', streetAddress: '白銀町9番地 白銀ビル3F',
  },
  knowsAbout: ['技術シーズの社会実装', 'インタラクティブコンテンツ', 'デジタルサイネージ・什器', '販促・広告のデータ分析', 'AIプロトタイピング', 'デジタルツイン', '3Dモデリング', '点群データ', '産学連携'],
  member: [
    { '@type': 'Person', name: '大坂 亮平', jobTitle: '共同創業者' },
    { '@type': 'Person', name: '岩渕 知弘', jobTitle: '共同創業者' },
  ],
  founder: [
    { '@type': 'Person', name: '大坂 亮平', alternateName: 'Ryohei Osaka', jobTitle: '代表取締役' },
    { '@type': 'Person', name: '岩渕 知弘', alternateName: 'Tomohiro Iwabuchi', jobTitle: '代表取締役' },
  ],
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', email: 'info@yellow.technology', availableLanguage: ['ja', 'en'], url: ORIGIN + '/#contact' }],
  sameAs: ['https://prtimes.jp/main/html/searchrlp/company_id/157998'],
  areaServed: { '@type': 'Country', name: '日本' },
};
const FAQ = JSON.parse(fs.readFileSync(REPO + 'faq.json', 'utf8'));

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
  if (r.id === 'home') {
    graph.push({
      '@type': 'FAQPage', '@id': url + '#faq',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.en.q, acceptedAnswer: { '@type': 'Answer', text: f.en.a } })),
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
  // 事業ページのほか、組み込みの事例ページ（page-cases / page-case-<key>）も扱う
  if (!document.getElementById('page-' + name)) name = 'home';`;
  const n = `function showPage(name, scrollTo, restoreY) {
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
        'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js': './lib/three/three.module.min.js',
        'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/': './lib/three/addons/',
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

// 1g. 1枚HTMLに組み込まれている事例ページ（#/cases, #/case/<key>）を外し、実 URL のリンクへ
//     （公開版は /cases/ と /cases/<key>/ を cases-append.js が別ページとして生成する）
{
  const INL = require('./build-cases-inline.js');
  base = INL.strip(base);
  base = base.replace(/href="#\/case\/([a-z0-9-]+)"/g, 'href="/cases/$1/"')
             .replace(/href="#\/cases"/g, 'href="/cases/"')
             .replace(/href="#\/news\/([a-z0-9-]+)"/g, 'href="/news/$1/"')
             .replace(/href="#\/news"/g, 'href="/news/"');
  // トップの事例カードの画像: 1枚HTMLでは読み込み時に data URI を配るが、公開用は実ファイルを指す
  const TH = INL.thumbSrcMap();
  base = base.replace(/src="[^"]*" data-case-img="([a-z0-9:.-]+)"/g, (m, k) => TH[k] ? 'src="' + TH[k] + '" data-case-img="' + k + '"' : m);
  if (!/nav_cases:/.test(base)) {
    base = base.replace(/(    nav_work: "事業",)/, '    nav_cases: "事例", nav_cases_view: "事例を見る →",\n$1');
    base = base.replace(/(    nav_work: "Work",)/, '    nav_cases: "Cases", nav_cases_view: "View cases →",\n$1');
  }
}

// 1h. 旧サイトのアンカー(#case-01 等)で来た人を新URLへ送る
{
  const map = JSON.parse(fs.readFileSync(REPO + 'cases.json', 'utf8'))
    .reduce((a, c) => (a[c.id] = '/cases/' + c.key + '/', a), {});   // 旧 #case-NN は各事例の id で対応（並び順に依存しない）
  const script = `<script>
/* 旧サイトのアンカーで来た訪問者を対応するページへ送る（フラグメントはサーバに届かないためJSで処理） */
(function () {
  var M = ${JSON.stringify(map)};
  M['about'] = '/#company'; M['profile'] = '/#company'; M['intro'] = '/'; M['record'] = '/#selected-cases';
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
  // 公開版は初期化が速いので、ゲートの保険タイマーは短くてよい（JS障害時の空白を最小化）
  base = base.replace("document.documentElement.style.visibility='';},4000)",
                      "document.documentElement.style.visibility='';},1500)");
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
    h = h.replace(/href="#(contact|record|selected-cases|news|company|careers|xbuild|xad|xinteractive|hero)"/g, 'href="/#$1"');
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
const NEWS = require('./news-append.js');
const NEWS_ITEMS = NEWS.load();
const newsUrl = ORIGIN + '/news/';
const newsLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{
    '@type': 'CollectionPage', '@id': newsUrl + '#webpage', url: newsUrl, name: 'News — YELLOW Inc.', inLanguage: ['en', 'ja'],
    about: { '@id': ORIGIN + '/#organization' },
    mainEntity: { '@type': 'ItemList', numberOfItems: NEWS_ITEMS.length,
      itemListElement: NEWS_ITEMS.map((n, i) => ({ '@type': 'ListItem', position: i + 1,
        item: { '@type': 'NewsArticle', headline: n.en.title, datePublished: n.date, url: n.case ? ORIGIN + '/cases/' + n.case + '/' : n.press, publisher: { '@id': ORIGIN + '/#organization' } } })) },
  }, { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: 'News', item: newsUrl } ] }],
}, null, 2);
const NEWS_PAGES = [{
  dir: 'news', url: '/news/', inner: NEWS.pageHtml(NEWS_ITEMS),
  meta: { page: 'news', ja: {}, en: {},
    title: 'News — YELLOW Inc.', titleJa: 'お知らせ — 株式会社YELLOW',
    desc: 'Announcements from YELLOW Inc.: programmes, memberships and press releases.',
    descJa: '株式会社YELLOWのお知らせ。採択、加盟、プレスリリースなど。',
    url: newsUrl, ld: newsLd },
}];
NEWS_ITEMS.filter(NEWS.hasArticle).forEach(n => {
  const url = ORIGIN + '/news/' + n.id + '/';
  const imgs = [];
  (n.sections || []).forEach(s => (s.imgs || []).forEach(im => imgs.push(ORIGIN + im.src)));
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'NewsArticle', '@id': url + '#article', url, mainEntityOfPage: url,
      headline: n.en.title, alternativeHeadline: n.en.sub || undefined, description: n.en.text,
      datePublished: n.date, dateModified: n.date, inLanguage: ['en', 'ja'],
      image: imgs.slice(0, 3), author: { '@id': ORIGIN + '/#organization' }, publisher: { '@id': ORIGIN + '/#organization' },
      ...(n.press ? { sameAs: n.press, isBasedOn: n.press } : {}),
      ...(n.case ? { about: { '@type': 'CreativeWork', url: ORIGIN + '/cases/' + n.case + '/' } } : {}),
    }, { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'News', item: newsUrl },
      { '@type': 'ListItem', position: 3, name: n.en.title, item: url } ] }],
  }, null, 2);
  NEWS_PAGES.push({ dir: 'news/' + n.id, url: '/news/' + n.id + '/', inner: NEWS.articleHtml(n),
    meta: { page: 'news_' + n.id.replace(/-/g, '_'), ja: {}, en: {},
      title: n.en.title + ' — News | YELLOW Inc.', titleJa: n.ja.title + ' — お知らせ | 株式会社YELLOW',
      desc: n.en.text.slice(0, 160), descJa: n.ja.text.slice(0, 118), url, ld, image: imgs[0] ? imgs[0].replace(ORIGIN, '') : undefined } });
});
const CASES = buildCases({ DIST, ORIGIN, base, ORG_ID: ORIGIN + '/#organization', extra: NEWS_PAGES });
for (const [u, n] of CASES.sizes) console.log(u.padEnd(30), (n / 1024).toFixed(0).padStart(4) + 'KB');

// ── 3. 付随ファイル
for (const f of ['og.png', '404.html', 'contact.php']) fs.copyFileSync(REPO + f, DIST + f);
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

const today = new Date().toISOString().slice(0, 10);   // ビルド日
fs.writeFileSync(DIST + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map(r => `  <url>
    <loc>${ORIGIN}${r.dir ? '/' + r.dir + '/' : '/'}</loc>
    <lastmod>${today}</lastmod>
    <priority>${r.dir === '' ? '1.0' : (r.service ? '0.8' : '0.3')}</priority>
  </url>`).join('\n')}
  <url><loc>${ORIGIN}/cases/</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>
  <url><loc>${ORIGIN}/news/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>
${NEWS_ITEMS.filter(NEWS.hasArticle).map(n => `  <url><loc>${ORIGIN}/news/${n.id}/</loc><lastmod>${n.date}</lastmod><priority>0.6</priority></url>`).join('\n')}
${CASES.cases.map(c => `  <url><loc>${ORIGIN}/cases/${c.key}/</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`).join('\n')}
</urlset>
`);

// llms.txt — AI に読ませる前提の要約（提案中の標準フォーマット）
fs.writeFileSync(DIST + 'llms.txt', `# 株式会社YELLOW（YELLOW Inc.）

> 大学・研究機関・企業の技術シーズを社会へ橋渡しする会社。群馬県高崎市。
> 論文とプロダクトの間の距離を埋めることを事業にしている。2022年設立。

## 概要

株式会社YELLOWは、研究水準の手法と、その現場での実装をつなぐレイヤーを担う。
事業は3つに整理されている。

- **xINTERACTIVE（動かす）**: エンターテインメント、体験、UI/UXを対象に、研究シーズやAIの知見を盛り込んで提供するプロジェクト。
  内訳は「体験・エンターテインメント」と「UI/UX デザイン・開発」。企画・体験設計から実装、現場運用まで。
- **xAD（届ける）**: 戦略分析とプロトタイピングを、プロジェクトマネージャー・コンサルタントとして担うプロジェクト。
  内訳は「プロトタイピング」と「戦略分析」。分析と試作を往復させ、意思決定と実行を伴走する。
- **xBUILD（つくる）**: 人流や工業といった大規模な領域の分析と開発を行うプロジェクト。
  都市・施設・工場・設備をデジタルツインとして再現し、現場で稼働するシステムまで開発する。
  内訳は「工業・設備」と「人流・都市」。TOLIC 加盟。

## 主なページ

- [ホーム](${ORIGIN}/): 会社概要、3プロダクト、事例、お知らせ、採用、お問い合わせ
- [事例](${ORIGIN}/cases/): 実装した事例の一覧
- [お知らせ](${ORIGIN}/news/): 採択・加盟・プレスリリース
- [xINTERACTIVE](${ORIGIN}/xinteractive/): エンタメ・体験・UI/UX（研究シーズ×AI）
- [xAD](${ORIGIN}/xad/): 戦略分析とプロトタイピング（PM・コンサルティング）
- [xBUILD](${ORIGIN}/xbuild/): 人流・工業の大規模開発（デジタルツイン）
- [プライバシーポリシー](${ORIGIN}/privacy/)
- [利用規約](${ORIGIN}/terms/)

## 事例（すべてブラウザで動くデモを公開）

${CASES.cases.map(c => `- [${c.title}](${ORIGIN}/cases/${c.key}/): ${c.lead}`).join('\n')}

## お知らせ

${NEWS_ITEMS.map(n => `- **${NEWS.label(n)}** ${n.ja.title}: ${n.ja.text}` + (NEWS.hasArticle(n) ? ` → ${ORIGIN}/news/${n.id}/` : (n.case ? ` → ${ORIGIN}/cases/${n.case}/` : '')) + (n.press ? ` （プレスリリース: ${n.press}）` : '')).join('\n')}

## 会社情報

- 会社名: 株式会社YELLOW（YELLOW Inc.）
- 設立: 2022年
- 所在地: 群馬県高崎市白銀町9番地 白銀ビル3F
- 事業領域: 技術シーズの社会実装
- 共同創業者: 大坂 亮平（研究運営、産学連携の組成・構造設計）／
  岩渕 知弘（技術シーズ系ベンチャーの市場展開、官公庁のイノベーション・プログラム対応）
- お問い合わせ: info@yellow.technology
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

// 使われていない動画を公開物から外す。デモに置き換わったパネルの <video> は
// data-video 属性（元に戻すための控え）だけが残り、ブラウザが読むことはない。
// 実際に <video data-src> で参照されているファイルだけを残す
{
  const used = new Set();
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') for (const m of fs.readFileSync(p, 'utf8').matchAll(/<video[^>]*data-src="\/assets\/video\/([^"]+)"/g)) used.add(m[1]);
  } };
  walk(DIST);
  const vdir = DIST + 'assets/video/';
  let freed = 0, kept = 0;
  if (fs.existsSync(vdir)) for (const f of fs.readdirSync(vdir)) {
    if (used.has(f)) { kept++; continue; }
    freed += fs.statSync(vdir + f).size; fs.unlinkSync(vdir + f);
  }
  console.log('動画: 参照されている ' + kept + ' 本を残し、未使用 ' + (freed / 1048576).toFixed(1) + 'MB を外しました');
}

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

// ── 4. 仕上げ（SEO / AIO）: 日本語版ページ、hreflang、RSS、サイトマップ、llms-full.txt
{
  const finalize = require('./seo-append.js');
  const r = finalize({ DIST, ORIGIN, newsItems: NEWS_ITEMS, cases: CASES.cases, routes: ROUTES, today });
  console.log('日本語版ページ ' + r.ja + ' 件（/ja/）、hreflang・RSS・画像つきサイトマップ・llms-full.txt を出力');
}
