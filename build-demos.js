#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build-demos.js — 1枚HTMLのデモを、各パネルの背景として動かす仕込みをする

   使い方:
     1. もらった HTML を demos/src/<id>.html に置く
     2. demos/demos.json の該当スロットに <id> を書き足す
     3. node build-demos.js
     4. node build-static.js       ← 公開用 dist/ を作り直す

   何をするか:
     ・demos.json の割り当てどおりに、パネルの <video> を
       <div class="panel__embed" data-demo="a,b,c"> へ差し替える
     ・使うデモ本体を <template id="tpl-demo-<id>"> として </main> の後ろにまとめる
     ・埋め込み用の CSS とマウント用の JS を差し込む
     ・何度実行しても同じ結果になる（前回の分は元の <video> に戻してからやり直す）

   demos/src/ に置ける補助ファイル（どちらも任意）:
     <id>.css        … デモ文書の末尾に <style> として足す上書き。HUDを隠す等
     <id>.patch.json … [["置換前","置換後"], ...] の文字列置換。粒子数を落とす等
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO   = __dirname + path.sep;
const TARGET = REPO + 'yellow_spacex_v8.html';
const SRCDIR = REPO + 'demos' + path.sep + 'src' + path.sep;
const CONF   = REPO + 'demos' + path.sep + 'demos.json';

// スロット名 → どのページの何番目のパネルか（0始まり）
const SLOTS = {
  'home-hero':          { page: 'page-home',         panel: 0 },
  'home-xinteractive':  { page: 'page-home',         panel: 1 },
  'home-xad':           { page: 'page-home',         panel: 2 },
  'home-xbuild':        { page: 'page-home',         panel: 3 },
  'home-careers':       { page: 'page-home',         panel: 4 },
  'home-contact':       { page: 'page-home',         panel: 5 },
  'xbuild-hero':        { page: 'page-xbuild',       panel: 0 },
  'xbuild-cap01':       { page: 'page-xbuild',       panel: 1 },
  'xbuild-cap02':       { page: 'page-xbuild',       panel: 2 },
  'xad-hero':           { page: 'page-xad',          panel: 0 },
  'xad-cap01':          { page: 'page-xad',          panel: 1 },
  'xad-cap02':          { page: 'page-xad',          panel: 2 },
  'xinteractive-hero':  { page: 'page-xinteractive', panel: 0 },
  'xinteractive-cap01': { page: 'page-xinteractive', panel: 1 },
  'xinteractive-cap02': { page: 'page-xinteractive', panel: 2 }
};

const MK = {
  cssA: '/* ══ DEMO-EMBED:CSS:START ══ */',
  cssB: '/* ══ DEMO-EMBED:CSS:END ══ */',
  jsA:  '/* ══ DEMO-EMBED:JS:START ══ */',
  jsB:  '/* ══ DEMO-EMBED:JS:END ══ */',
  tplA: '<!-- ══ DEMO-EMBED:TPL:START ══ -->',
  tplB: '<!-- ══ DEMO-EMBED:TPL:END ══ -->'
};

const warn = [];
const demoNeeds = {};   // id → 'webgpu' など

/* ───────── デモ HTML を <template> に入れられる形へ整える ───────── */
function prepare(id) {
  const p = SRCDIR + id + '.html';
  if (!fs.existsSync(p)) throw new Error('demos/src/' + id + '.html がありません');
  let s = fs.readFileSync(p, 'utf8');

  if (s.indexOf('</template>') !== -1)
    throw new Error(id + ': デモHTMLに </template> が含まれるため埋め込めません');

  // 外側の器はこちらで組み立てるので落とす
  s = s.replace(/<!doctype[^>]*>/gi, '')
       .replace(/<\/?html(?=[\s>\/])[^>]*>/gi, '')
       .replace(/<\/?head(?=[\s>\/])[^>]*>/gi, '')   // <header> を巻き込まない
       .replace(/<\/?body(?=[\s>\/])[^>]*>/gi, '')
       .replace(/<meta\s+charset[^>]*>/gi, '')
       .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, '')
       .replace(/<title>[\s\S]*?<\/title>/gi, '')
       .trim();

  // 文字列置換（粒子数を落とす等）
  const pj = SRCDIR + id + '.patch.json';
  if (fs.existsSync(pj)) {
    const rules = JSON.parse(fs.readFileSync(pj, 'utf8'));
    for (const [from, to] of rules) {
      if (s.indexOf(from) === -1) throw new Error(id + '.patch.json: 置換対象が見つかりません → ' + from);
      s = s.split(from).join(to);
    }
  }

  // 埋め込み用の上書き CSS をデモ側スタイルの末尾に足す
  const cs = SRCDIR + id + '.css';
  if (fs.existsSync(cs)) {
    const css = fs.readFileSync(cs, 'utf8');
    // 文書の末尾に独立した <style> として足す（JS文字列内の </style> に紛れ込まず、後勝ちで必ず効く）
    s = s + '\n<style>\n' + css + '\n</style>';
  }

  // 外部読み込みがあると、公開時に読めない/遅くなる可能性があるので知らせる
  const ext = s.match(/(?:src|href)=["']https?:\/\/[^"']+/gi);
  if (ext) warn.push(id + ': 外部読み込みがあります → ' + ext.slice(0, 3).join(' , '));
  if (!/<canvas|<svg|requestAnimationFrame|setInterval|@keyframes/.test(s))
    warn.push(id + ': 自動で動く要素が見当たりません（静止したままかもしれません）');

  // WebGPU 依存のデモは対応ブラウザでだけ動かす（未対応ではポスターのまま）
  if (/navigator\.gpu/.test(s)) demoNeeds[id] = 'webgpu';

  /* スマホでの負荷を落とす。多くのデモは devicePixelRatio をそのまま描画解像度に
     使うため、3倍の端末では9倍の画素を描くことになる。ここで上限を被せておくと、
     デモ側に手を入れなくても描画量が数分の一になる。
     デモ本体より先に効かせる必要があるので先頭に置く */
  s = '<script>(function(){try{if(!window.matchMedia("(max-width:900px)").matches)return;'
    + 'var cap=Math.min(window.devicePixelRatio||1,' + JSON.stringify(mobileDpr) + ');'
    + 'Object.defineProperty(window,"devicePixelRatio",{configurable:true,get:function(){return cap;}});'
    + '}catch(e){}})();<\/script>\n' + s;

  /* 「動き出してよい」合図（ydemo-go）の受け口。
     ポスター→デモの切り替えを目立たせないため、カメラ等の動きは親から合図が来るまで止めておく
     （デモ側は window.__YGO を見るか 'ydemo-go' イベントを待つ）。
     単体で開いたときは即座に動き出す。iframe 内では ydemo-ready を送ったあと 20 秒待っても合図が来ない場合だけ自分で動き出す。
     ?hold=1 を付けて開くと止まったまま（ポスター撮影用） */
  /* 乱数を固定する（demos.json の seed に挙げたデモ）。
     初期配置や色がランダムなデモは、止めた状態の絵が毎回変わりポスターと一致しないので、
     決まった乱数列で毎回同じ絵になるようにする */
  if ((conf.seed || []).includes(id)) {
    s = '<script>(function(){var x=0x9E3779B9;Math.random=function(){x=(x+0x6D2B79F5)|0;var t=Math.imul(x^(x>>>15),1|x);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};})();<\/script>\n' + s;
  }
  s = '<script>(function(){window.__YFAIL=false;function fail(){if(window.__YFAIL)return;window.__YFAIL=true;try{parent.postMessage("ydemo-fail","*")}catch(e){}}'
    + 'window.__yfail=fail;window.addEventListener("error",function(e){if(e&&e.message&&/ResizeObserver/.test(e.message))return;fail()});'
    + 'window.addEventListener("unhandledrejection",fail);})();<\/script>\n'
    + '<script>(function(){var hold=/[?&]hold=1/.test(location.search);window.__YGO=false;'
    + 'function go(){if(window.__YGO)return;window.__YGO=true;try{window.dispatchEvent(new Event("ydemo-go"))}catch(e){}}'
    + 'window.__ygo=go;window.addEventListener("message",function(e){if(e.data==="ydemo-go")go()});'
    + 'if(!hold&&window===window.parent)go()})();<\/script>\n' + s;

  /* 「もう普通に描けている」ことを親に知らせる合図を仕込む。
     読み込み完了(load)だけを合図にすると、まだ何も描いていない板を先に出してしまい、
     あとから絵が飛び込む＝ちらつきになる。
     組み立て中のデモも1コマずつ譲りながら進む（重い処理→コマ間隔がバラバラ）ので、
     コマ数だけでは足りない。ここでは「短い間隔のコマが続けて出ている」=描画ループに
     入った状態を待つ。遅い端末ほど自然に長く待つことになる
     デモが window.__YREADY=false を立てている間は（組み立て中など）合図を出さない
     合図を出したあと 20 秒たっても親から ydemo-go が来なければ自分で動き出す（保険）。
     読み込み直後からの固定タイマーだと、重いデモ＋長い settle で「見せる前に動き出す」ことがあった */
  /* 失敗と遅さも親へ知らせる:
       ・スクリプトが例外で止まった（WebGL の拡張なし等）→ "ydemo-fail"。親は iframe を外してポスターのままにする
       ・描画はしているがコマ間隔が長すぎる（約 8fps 未満が続く）→ "ydemo-slow"。同じくポスターに戻す
     どちらも「真っ白な板がポスターに重なる」「カクカク動く」を防ぐため */
  s += '\n<script>(function(){var last=0,run=0,n=0,slow=0,done=false;'
     + 'function t(ts){if(done||window.__YFAIL)return;n++;'
     + 'var dt=last?ts-last:9999;last=ts;if(dt<120)run++;else{run=0;if(n>3&&dt>=160&&dt<5000)slow++;}'
     + 'if(slow>=40){done=true;try{parent.postMessage("ydemo-slow","*")}catch(e){}return}'
     + 'if(((run>=6&&n>=10)||n>=120)&&window.__YREADY!==false){done=true;try{parent.postMessage("ydemo-ready","*")}catch(e){}'
     + 'if(window!==window.parent&&!/[?&]hold=1/.test(location.search))setTimeout(function(){if(window.__ygo)window.__ygo()},20000);return}'
     + 'requestAnimationFrame(t)}requestAnimationFrame(t)})();<\/script>\n';

  return s;
}

/* ───────── ページ区間とパネル位置 ───────── */
function pageSpan(h, id) {
  if (id === 'page-home') {
    const a = h.indexOf('<main');
    const b = h.indexOf('</div><!-- /page-home -->');
    if (a === -1 || b === -1) throw new Error('page-home の範囲が取れません');
    return [a, b];
  }
  const a = h.indexOf('<div class="page" id="' + id + '">');
  if (a === -1) throw new Error(id + ' がありません');
  let b = h.indexOf('<div class="page" id="', a + 10);
  if (b === -1) b = h.indexOf('\n</main>');
  if (b === -1) throw new Error(id + ': 終端が取れません');
  return [a, b];
}

// 区間内の n 番目の <section class="panel...">〜</section> の範囲を返す
function panelSpan(h, [a, b], n) {
  const seg = h.slice(a, b);
  const re = /<section class="panel[^"]*"[^>]*>/g;
  let m, k = 0;
  while ((m = re.exec(seg)) !== null) {
    if (k === n) {
      const from = a + m.index;
      const to = h.indexOf('</section>', from);
      if (to === -1) throw new Error('パネルの </section> が見つかりません');
      return [from, to];
    }
    k++;
  }
  throw new Error('パネル ' + n + ' がありません（この区間には ' + k + ' 枚しかありません）');
}

/* ───────── 1. 読み込み ───────── */
const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'));
const cycleSec = Number(conf.cycleSec) > 0 ? Number(conf.cycleSec) : 45;

/* スマホ向けの手加減。demos.json の "mobile" で指定する
     dpr  … 描画解像度の上限（既定 1.25）
     skip … スマホでは動かさないデモ（重いものを外す。ポスターのまま） */
const mobileConf = conf.mobile || {};
const mobileDpr = Number(mobileConf.dpr) > 0 ? Number(mobileConf.dpr) : 1.25;
const mobileSkip = Array.isArray(mobileConf.skip) ? mobileConf.skip : [];
for (const k of Object.keys(conf.slots || {}))
  if (!SLOTS[k]) throw new Error('demos.json: 知らないスロット名です → ' + k);

let h = fs.readFileSync(TARGET, 'utf8');

/* ───────── 2. 前回の分を元に戻す（何度でも実行できるように） ───────── */
h = h.replace(
  /<div class="panel__embed"[^>]*data-video="([^"]*)"[^>]*><\/div>/g,
  (_, v) => '<video class="panel__vid" muted loop playsinline preload="none" data-src="' + v + '"></video>'
);
h = h.replace(/class="panel panel--light/g, 'class="panel');
for (const [A, B] of [[MK.cssA, MK.cssB], [MK.jsA, MK.jsB], [MK.tplA, MK.tplB]]) {
  let a = h.indexOf(A);
  if (a === -1) continue;
  const b = h.indexOf(B, a);
  if (b === -1) throw new Error('目印 ' + B + ' が見つかりません');
  // 前後の改行もまとめて吸収する（実行のたびに空行が増えないように）
  let end = b + B.length;
  while (a > 0 && h[a - 1] === '\n') a--;
  while (end < h.length && h[end] === '\n') end++;
  h = h.slice(0, a) + '\n' + h.slice(end);
}

/* ───────── 3. パネルを差し替える ───────── */
const used = [];          // 実際に使うデモ id（重複なし・出現順）
const edits = [];         // 後ろから適用するため一旦ためる

for (const [slot, ids] of Object.entries(conf.slots || {})) {
  const list = (ids || []).map(s => String(s).trim()).filter(Boolean);
  if (!list.length) continue;
  for (const id of list) if (used.indexOf(id) === -1) used.push(id);

  const { page, panel } = SLOTS[slot];
  const [pa, pb] = pageSpan(h, page);
  const [sa, sb] = panelSpan(h, [pa, pb], panel);
  const body = h.slice(sa, sb);

  const vm = body.match(/<video class="panel__vid"[^>]*data-src="([^"]+)"[^>]*><\/video>/);
  if (!vm) throw new Error(slot + ': このパネルに差し替え対象の動画がありません');

  const theme = (conf.theme || {})[slot];
  const keepAll = list.every(id => (conf.keep || []).indexOf(id) !== -1);
  const reveal = (conf.reveal || {})[slot];   // "fade": ポスターの上に読み込み完了後フェードで重ねる
  const settle = (conf.settle || {})[slot];   // 描画が育つのを待つ時間(ms)。既定 300
  const host = '<div class="panel__embed" data-slot="' + slot + '"'
             + (theme ? ' data-theme="' + theme + '"' : '')
             + (keepAll ? ' data-keep="1"' : '')
             + (reveal ? ' data-reveal="' + reveal + '"' : '')
             + (settle ? ' data-settle="' + settle + '"' : '')
             + ' data-demo="' + list.join(',') + '"'
             + ' data-video="' + vm[1] + '"></div>';
  edits.push({ at: sa + body.indexOf(vm[0]), len: vm[0].length, html: host, slot, n: list.length });
  // 明るいテーマはビルド時にパネルへ静的に付ける（ポスターも明るい画に差し替える前提。
  // これでスマホ等デモが動かない環境でも文字色が正しく黒になる）
  if (theme === 'light') {
    const openTag = h.slice(sa, h.indexOf('>', sa) + 1);
    if (openTag.indexOf('panel--light') === -1) {
      const patched = openTag.replace('class="panel', 'class="panel panel--light');
      edits.push({ at: sa, len: openTag.length, html: patched, slot: slot + ' (light)', n: 0 });
    }
  }
}

edits.sort((x, y) => y.at - x.at);
for (const e of edits) h = h.slice(0, e.at) + e.html + h.slice(e.at + e.len);

/* ───────── 4. デモ本体を </main> の後ろにまとめる ─────────
   ページ div の外に置くので、静的ビルドのページ切り出しに巻き込まれない。
   dist ではさらに build-static.js が外部ファイル化して丸ごと取り除く。 */
if (used.length) {
  const parts = [MK.tplA,
    '<!-- パネル背景で動かすデモ本体。<template> の中は解析されるだけで実行されない。',
    '     元ファイルは demos/src/ にあります。編集はそちらで行い node build-demos.js を実行してください -->'];
  for (const id of used) {
    const s = prepare(id);
    console.log('  demo ' + id.padEnd(20) + (s.length / 1024).toFixed(0).padStart(5) + 'KB');
    parts.push('<template id="tpl-demo-' + id + '">', s, '</template>');
  }
  parts.push(MK.tplB);
  const mainEnd = h.indexOf('\n</main>');
  if (mainEnd === -1) throw new Error('</main> が見つかりません');
  const at = mainEnd + '\n</main>'.length;
  h = h.slice(0, at) + '\n' + parts.join('\n') + h.slice(at);
}

/* ───────── 5. CSS ───────── */
// スロットごとの下地（demos.json の placeholder）。デモの背景色と揃えるとつなぎ目が消える
const placeholderRules = Object.entries(conf.placeholder || {}).map(([slot, bg]) => {
  if (!SLOTS[slot]) throw new Error('demos.json placeholder: 知らないスロット名です → ' + slot);
  return '.panel__embed.is-live[data-slot="' + slot + '"]{background:' + bg + ';}';
});
if (used.length) {
  const CSS = [MK.cssA,
    '/* パネル背景で 1枚HTML のデモを動かす。',
    '   iframe で隔離しているのでデモ側の CSS / JS はサイトに影響しない。',
    '   pointer-events:none によりスクロールとクリックはそのままサイトへ通る。 */',
    '/* 動画と同じ視差: 縦118%で敷いてスクロール量の18%だけ逆送りする（JS側で transform） */',
    '.panel__embed{position:absolute;left:0;top:-9%;width:100%;height:118%;z-index:0;overflow:hidden;pointer-events:none;will-change:transform;}',
    '@media (max-width:900px){ .panel__embed{top:0;height:100%;transform:none;} }',
    '/* デモが実際に動く環境では、ポスター静止画を最初から見せない。',
    '   ホストがデモと同じ背景を持ち、そこへデモの立ち上がり演出が描かれる */',
    '.panel__embed.is-live{background:#000;}',
    '/* fade 指定のスロットは、ポスターをデモと同じ箱（縦118%・同じ視差）に敷く。',
    '   高さ基準で等倍に合わせるので、現れたデモと絵の大きさ・位置がそのまま一致する',
    '   （ポスターは横2:1で撮る。デモ側の縦画角が一定なら縦合わせで一致する） */',
    '.panel__embed[data-reveal="fade"]{background-image:var(--bg);background-size:auto 100%;background-position:center;background-repeat:no-repeat;}',
    ...placeholderRules,
    '/* 白背景デモ用: デモが動くときだけ、そのパネルの文字を黒系に反転する',
    '   （デモが動かない環境ではポスター写真のまま白文字が維持される） */',
    '.panel--light .panel__scrim{background:',
    '  linear-gradient(to top,rgba(255,255,255,.9) 0%,rgba(255,255,255,.45) 34%,rgba(255,255,255,.03) 66%),',
    '  linear-gradient(to right,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 55%);}',
    '.panel--light .title,.panel--light .lede{color:#0b0d10;}',
    '.panel--light .prodhero__sub,.panel--light .back{color:#0b0d10;}',
    '.panel--light .eyebrow{color:rgba(10,12,16,.72);}',
    '.panel--light .eyebrow .nt,.panel--light .title .nt{color:#0b0d10;}',
    '.panel--light .panel__idx{color:rgba(10,12,16,.55);}',
    '.panel--light .btn{border-color:#0b0d10;color:#0b0d10;}',
    '.panel--light .btn:hover,.panel--light .btn:focus-visible{background:#0b0d10;color:#fff;}',
    '.panel__embed iframe{',
    '  position:absolute;inset:0;width:100%;height:100%;border:0;display:block;',
    '  pointer-events:none;opacity:0;transition:opacity .9s ease;',
    '}',
    '.panel__embed iframe.is-on{opacity:1;}',
    '/* reveal:fade はポスターを見せたまま、準備できた実描画を1秒かけて重ねる */',
    '.panel__embed[data-reveal="fade"] iframe{transition-duration:1s;}',
    '/* スマホでもデモは動かす。動かない環境（WebGL2なし・省データ・動きの抑制）は JS 側でデモを出さず、',
    '   ポスター（静止画）がそのまま背景になる */',
    MK.cssB].join('\n') + '\n';
  const i = h.indexOf('</style>');           // スタイルシート末尾（前方だと後続宣言に負ける）
  if (i === -1) throw new Error('</style> がありません');
  h = h.slice(0, i) + CSS + h.slice(i);
}

/* 他ページのヒーローで使うデモ（先読みの対象） */
const prefetchList = Object.keys(conf.slots).filter(k => /-hero$/.test(k)).map(k => (conf.slots[k] || [])[0]).filter(Boolean);

/* ───────── 6. マウント用 JS ───────── */
if (used.length) {
  const JS = [MK.jsA,
  '/* ═══════════════════ パネル背景のデモ ═══════════════════',
  '   ・.panel__embed[data-demo] のカンマ区切りリストを順に流す（複数なら一定時間で切り替え）',
  '   ・静的ビルドでは data-demo-base 配下の外部ファイル、単一ファイル版では <template> から読む',
  '   ・iframe(sandbox="allow-scripts") で隔離。pointer-events:none で操作はサイト側へ通る',
  '   ・同時に動かすのは一番大きく映っているパネルだけ（GPUを取り合わせない）',
  '   ・スマホ / 省データ / prefers-reduced-motion / WebGL2非対応 では出さず静止画のまま */',
  '(function () {',
  '  var hosts = document.querySelectorAll(\'.panel__embed[data-demo]\');',
  '  if (!hosts.length) return;',
  '  if (window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches) return;',
  '  /* スマホも動かす（幅での除外はしない）。省データ設定と reduced-motion は尊重する */',
  '  if (navigator.connection && navigator.connection.saveData) return;',
  '  try { if (!document.createElement(\'canvas\').getContext(\'webgl2\')) return; }',
  '  catch (e) { return; }',
  '',
  '  var CYCLE_MS = ' + (cycleSec * 1000) + ';',
  '  var HEAD = \'<!doctype html><html lang="ja"><head><meta charset="utf-8">\'',
  '           + \'<meta name="viewport" content="width=device-width,initial-scale=1">\'',
  '           + \'</head><body>\';',
  '  var TAIL = \'</body></html>\';',
  '',
  '  var NEEDS = ' + JSON.stringify(demoNeeds) + ';',
  '  /* スマホでの手加減: 重いデモは動かさず（ポスターのまま）、画面外に出たものは破棄する。',
  '     描画解像度の上限はデモ側に仕込んである */',
  '  var SMALL = window.matchMedia(\'(max-width: 900px)\').matches;',
  '  var MOBILE_SKIP = ' + JSON.stringify(mobileSkip) + ';',
  '  var needProbe = false;',
  '  for (var n0 = 0; n0 < hosts.length; n0++) {',
  '    var l0 = hosts[n0].getAttribute(\'data-demo\').split(\',\');',
  '    for (var n1 = 0; n1 < l0.length; n1++) if (NEEDS[l0[n1].trim()] === \'webgpu\') needProbe = true;',
  '  }',
  '',
  '  function boot(gpuOk) {',
  '  /* iframe の load は「文書が読み終わった」だけの合図で、WebGL の1枚目はまだ描けていない。',
  '     そこで load からさらに settle だけ待ってから見せる。これをしないと、まだ何も描いて',
  '     いない白/黒の板が先に出てきて、あとから絵が飛び込む＝ちらつきに見える。',
  '     インクのように「育つ」デモは、育つまでの時間を demos.json の settle で長めに取る */',
  '  var SETTLE_MS = 300;',
  '  function needsOk(id) {',
  '    if (NEEDS[id] === \'webgpu\') return gpuOk;',
  '    if (SMALL && MOBILE_SKIP.indexOf(id) !== -1) return false;',
  '    return true;',
  '  }',
  '',
  '  var slots = [];',
  '  for (var i = 0; i < hosts.length; i++) {',
  '    var raw = hosts[i].getAttribute(\'data-demo\').split(\',\');',
  '    var list = [];',
  '    for (var j = 0; j < raw.length; j++) { var s = raw[j].trim(); if (s && needsOk(s)) list.push(s); }',
  '    if (!list.length) continue;',                       // 動かせるデモが無ければポスターのまま',
  '    var fade = hosts[i].getAttribute(\'data-reveal\') === \'fade\';',
  '    // fade はポスターを見せたまま重ねるので下地は出さない。それ以外は1フレーム目から下地',
  '    if (!fade) hosts[i].classList.add(\'is-live\');',
  '    // 白背景デモのパネルは文字を黒系に反転',
  '    if (hosts[i].getAttribute(\'data-theme\') === \'light\') {',
  '      var pn = hosts[i].closest ? hosts[i].closest(\'.panel\') : null;',
  '      if (pn) pn.classList.add(\'panel--light\');',
  '    }',
  '    // 訪問ごとに最初に見えるデモを変える',
  '    var st = parseInt(hosts[i].getAttribute(\'data-settle\'), 10);',
  '    slots.push({ el: hosts[i], ids: list, at: (Math.random() * list.length) | 0,',
  '                 // スマホでは抱え込まない。画面外に出たら破棄してメモリと電池を返す',
  '                 keep: !SMALL && (hosts[i].getAttribute(\'data-keep\') === \'1\' || fade),',
  '                 fade: fade,',
  '                 settle: st > 0 ? st : SETTLE_MS,',
  '                 ratio: 0, near: false, dead: false, on: false, timer: 0 });',
  '  }',
  '  if (!slots.length) return;',
  '',
  '  function build(slot, id) {',
  '    var f = document.createElement(\'iframe\');',
  '    f.setAttribute(\'title\', id);',
  '    f.setAttribute(\'aria-hidden\', \'true\');',
  '    f.setAttribute(\'tabindex\', \'-1\');',
  '    f.setAttribute(\'scrolling\', \'no\');',
  '    f.setAttribute(\'sandbox\', \'allow-scripts\');',
  '    var base = slot.el.getAttribute(\'data-demo-base\');',
  '    if (base) { f.src = base + id + \'.html\'; }',
  '    else {',
  '      var t = document.getElementById(\'tpl-demo-\' + id);',
  '      if (!t) return null;',
  '      f.srcdoc = HEAD + t.innerHTML + TAIL;',
  '    }',
  '    return f;',
  '  }',
  '',
  '  /* 出す条件は2つ。どちらも満たすまでポスター/下地のままにする。',
  '     ・デモが実際に描き始めている（デモ側から "ydemo-ready" が届く）',
  '     ・最低待ち時間 settle を過ぎている（インクのように「育つ」絵のため） */',
  '  function show(slot, id) {',
  '    var f = build(slot, id);',
  '    if (!f) return;',
  '    var old = slot.el.lastChild;',
  '    var hold = slot.fade ? 1600 : 1100;',   // 重ね終わってから前の1枚を外す',
  '    var painted = false, waited = false, shown = false;',
  '    function tryShow() {',
  '      if (shown || !painted || !waited) return;',
  '      shown = true;',
  '      requestAnimationFrame(function () { f.classList.add(\'is-on\'); });',
  '      // 重なり始めと同時に「動いてよい」と伝える。最初の絵はポスターと同じなので、',
  '      // 静止画がそのまま動き出したように見える（重ね終わってから動かすと「止まってから動く」感じが残る）',
  '      setTimeout(function () {',
  '        try { f.contentWindow.postMessage(\'ydemo-go\', \'*\'); } catch (e) {}',
  '      }, 60);',
  '      if (old) setTimeout(function () {',
  '        if (old.parentNode) old.parentNode.removeChild(old);',
  '      }, hold);',
  '    }',
  '    f.__painted = function () { painted = true; tryShow(); };',
  '    f.addEventListener(\'load\', function () {',
  '      setTimeout(function () { waited = true; tryShow(); }, slot.settle);',
  '      // 合図が来ないデモでも取り残さないための保険。ポスターを敷いている fade では、',
  '      // 描けていない板を重ねるとポスターが消えてしまうので使わない（合図が来るまでポスターのまま）',
  '      if (!slot.fade) setTimeout(function () { painted = true; tryShow(); }, slot.settle + 6000);',
  '    });',
  '    // 失敗（例外）や遅すぎる端末: この iframe を外し、以後このスロットは動かさない（ポスターのまま）',
  '    f.__failed = function () {',
  '      if (f.parentNode) f.parentNode.removeChild(f);',
  '      slot.dead = true; slot.on = false;',
  '      if (slot.timer) { clearInterval(slot.timer); slot.timer = 0; }',
  '      slot.el.classList.remove(\'is-live\');',
  '    };',
  '    slot.el.appendChild(f);',
  '  }',
  '',
  '  // デモ側から届く「描き始めた」合図を、その iframe に結びつける',
  '  window.addEventListener(\'message\', function (ev) {',
  '    if (ev.data !== \'ydemo-ready\' && ev.data !== \'ydemo-fail\' && ev.data !== \'ydemo-slow\') return;',
  '    var fs2 = document.querySelectorAll(\'.panel__embed iframe\');',
  '    for (var mi = 0; mi < fs2.length; mi++) {',
  '      if (fs2[mi].contentWindow !== ev.source) continue;',
  '      if (ev.data === \'ydemo-ready\') { if (fs2[mi].__painted) fs2[mi].__painted(); }',
  '      else if (fs2[mi].__failed) fs2[mi].__failed();',
  '    }',
  '  });',
  '',
  '  function start(slot) {',
  '    if (slot.on || slot.dead) return;',
  '    slot.on = true;',
  '    show(slot, slot.ids[slot.at]);',
  '    if (slot.ids.length > 1) slot.timer = setInterval(function () {',
  '      slot.at = (slot.at + 1) % slot.ids.length;',
  '      show(slot, slot.ids[slot.at]);',
  '    }, CYCLE_MS);',
  '  }',
  '  function stop(slot) {',
  '    if (!slot.on) return;',
  '    /* keep 指定のデモは破棄しない。画面外の iframe はブラウザが描画を止めるので',
  '       負荷は増えず、育った状態（インクの模様など）が保たれ、戻ったとき続きから動く */',
  '    if (slot.keep) return;',
  '    slot.on = false;',
  '    if (slot.timer) { clearInterval(slot.timer); slot.timer = 0; }',
  '    while (slot.el.firstChild) slot.el.removeChild(slot.el.firstChild);',
  '  }',
  '',
  '  // 一番大きく映っている 1枚だけを動かし、それ以外は破棄して GPU を解放する',
  '  function arbitrate() {',
  '    if (SMALL) {',
  '      /* スマホ: 画面から一画面以内（near）のスロットを用意しておき、離れたら片付ける。',
  '         見えていない iframe の描画はブラウザが止めるので、次のパネルに着いたときには',
  '         読み込み済みですぐ動き出す（到着してから読み込む「白い間」をなくす） */',
  '      for (var s0 = 0; s0 < slots.length; s0++) {',
  '        if (slots[s0].near || slots[s0].ratio > 0.05) start(slots[s0]); else stop(slots[s0]);',
  '      }',
  '      return;',
  '    }',
  '    var best = null;',
  '    for (var k = 0; k < slots.length; k++)',
  '      if (slots[k].ratio > 0.05 && (!best || slots[k].ratio > best.ratio)) best = slots[k];',
  '    for (var m = 0; m < slots.length; m++) if (slots[m] !== best) stop(slots[m]);',
  '    if (best) start(best);',
  '  }',
  '',
  '  // 最初から画面に入っているスロットは IntersectionObserver を待たずに開始する',
  '  for (var e0 = 0; e0 < slots.length; e0++) {',
  '    var r0 = slots[e0].el.getBoundingClientRect();',
  '    var vh0 = window.innerHeight || 1;',
  '    var vis = Math.max(0, Math.min(r0.bottom, vh0) - Math.max(r0.top, 0));',
  '    slots[e0].ratio = r0.height > 0 ? vis / r0.height : 0;',
  '  }',
  '  arbitrate();',
  '',
  '  if (!(\'IntersectionObserver\' in window)) { if (slots[0] && !slots[0].on) start(slots[0]); return; }',
  '  // 破棄しない(keep)スロットは、画面に来るずっと手前から裏で読み込んで動かし始める。',
  '  // 到達したときには既に描画が育っているので、白い空白や「後から急に出る」が起きない',
  '  if (\'IntersectionObserver\' in window) {',
  '    var pre = new IntersectionObserver(function (es) {',
  '      for (var pi2 = 0; pi2 < es.length; pi2++) {',
  '        if (!es[pi2].isIntersecting) continue;',
  '        for (var pj2 = 0; pj2 < slots.length; pj2++) {',
  '          if (slots[pj2].el === es[pi2].target && slots[pj2].keep && !slots[pj2].on) start(slots[pj2]);',
  '        }',
  '        pre.unobserve(es[pi2].target);',
  '      }',
  '    }, { rootMargin: \'200% 0px 200% 0px\', threshold: 0 });',
  '    for (var pk2 = 0; pk2 < slots.length; pk2++) if (slots[pk2].keep) pre.observe(slots[pk2].el);',
  '  }',
  '',
  '  if (SMALL) {',
  '    var nearIo = new IntersectionObserver(function (es) {',
  '      for (var ni = 0; ni < es.length; ni++)',
  '        for (var nj = 0; nj < slots.length; nj++)',
  '          if (slots[nj].el === es[ni].target) slots[nj].near = es[ni].isIntersecting;',
  '      arbitrate();',
  '    }, { rootMargin: \'100% 0px 100% 0px\', threshold: 0 });',
  '    for (var nk = 0; nk < slots.length; nk++) nearIo.observe(slots[nk].el);',
  '  }',
  '  var io = new IntersectionObserver(function (es) {',
  '    for (var n = 0; n < es.length; n++)',
  '      for (var q = 0; q < slots.length; q++)',
  '        if (slots[q].el === es[n].target)',
  '          slots[q].ratio = es[n].isIntersecting ? es[n].intersectionRatio : 0;',
  '    arbitrate();',
  '  }, { threshold: [0, 0.05, 0.25, 0.5, 0.75, 1] });',
  '  for (var r = 0; r < slots.length; r++) io.observe(slots[r].el);',
  '',
  '  /* 視差: 背景動画と同じく、スクロール量の18%だけ逆送りして写真の固定背景と見え方を揃える */',
  '  function embedParallax() {',
  '    var vh = window.innerHeight;',
  '    // スマホは視差なし（CSS側の top:0/height:100% に任せ、inline transform で上書きしない）',
  '    if (window.innerWidth <= 900) {',
  '      for (var i0 = 0; i0 < slots.length; i0++) slots[i0].el.style.transform = \'\';',
  '      return;',
  '    }',
  '    for (var i2 = 0; i2 < slots.length; i2++) {',
  '      var el2 = slots[i2].el;',
  '      var pn2 = el2.closest ? el2.closest(\'.panel\') : null;',
  '      if (!pn2) continue;',
  '      var r2 = pn2.getBoundingClientRect();',
  '      var prog = (vh - r2.top) / (vh + r2.height);',
  '      if (prog < 0) prog = 0; else if (prog > 1) prog = 1;',
  '      el2.style.transform = \'translate3d(0,\' + ((prog - 0.5) * 0.18 * r2.height).toFixed(1) + \'px,0)\';',
  '    }',
  '  }',
  '  var ticking2 = false;',
  '  function onScroll2() {',
  '    if (ticking2) return;',
  '    ticking2 = true;',
  '    requestAnimationFrame(function () { embedParallax(); ticking2 = false; });',
  '  }',
  '  window.addEventListener(\'scroll\', onScroll2, { passive: true });',
  '  window.addEventListener(\'resize\', onScroll2, { passive: true });',
  '  embedParallax();',
  '',
  '  /* 公開版（外部ファイル）のとき: 他ページのヒーローのデモを、このページが落ち着いてから裏で先読みしておく。',
  '     次のページを開いたとき、読み込み待ちなしで動き出す */',
  '  var base0 = hosts[0].getAttribute(\'data-demo-base\');',
  '  if (base0 && !SMALL && !(navigator.connection && navigator.connection.saveData)) {',
  '    var PRE = ' + JSON.stringify(prefetchList) + ';',
  '    var have = {};',
  '    for (var h0 = 0; h0 < hosts.length; h0++) have[hosts[h0].getAttribute(\'data-demo\').split(\',\')[0].trim()] = 1;',
  '    setTimeout(function () {',
  '      for (var p0 = 0; p0 < PRE.length; p0++) {',
  '        if (have[PRE[p0]]) continue;',
  '        var ln = document.createElement(\'link\'); ln.rel = \'prefetch\'; ln.as = \'document\';',
  '        ln.href = base0 + PRE[p0] + \'.html\'; document.head.appendChild(ln);',
  '      }',
  '    }, 6000);',
  '  }',
  '  }',                                                    // boot() ここまで',
  '',
  '  /* WebGPU は「navigator.gpu がある」だけでは動かない環境がある（アダプタ無効など）。',
  '     実際にアダプタが取れるかを確かめてから始める */',
  '  if (!needProbe) { boot(false); }',
  '  else if (!navigator.gpu || !navigator.gpu.requestAdapter) { boot(false); }',
  '  else {',
  '    var settled = false;',
  '    var go = function (ok) { if (!settled) { settled = true; boot(ok); } };',
  '    try {',
  '      navigator.gpu.requestAdapter().then(function (a) { go(!!a); }, function () { go(false); });',
  '      setTimeout(function () { go(false); }, 1500);',     // 応答が無い環境の保険',
  '    } catch (e) { go(false); }',
  '  }',
  '})();',
  MK.jsB].join('\n') + '\n';

  const MARK = '/* ═══════════════════ PRODUCT DROPDOWN ═══════════════════ */';
  const i = h.indexOf(MARK);
  if (i === -1) throw new Error('JS の差し込み位置が見つかりません');
  h = h.slice(0, i) + JS + h.slice(i);
}

/* ───────── 7. 事例ページを組み込んで書き出し ───────── */
h = require('./build-cases-inline.js').inline(h);
fs.writeFileSync(TARGET, h);

console.log('');
for (const e of edits.slice().reverse())
  console.log('  slot ' + e.slot.padEnd(20) + e.n + '件');
if (!edits.length) console.log('  デモの割り当てなし（すべて動画のまま）');
for (const w of warn) console.log('  ⚠ ' + w);
console.log('\nyellow_spacex_v8.html を更新（' + (h.length / 1024 / 1024).toFixed(2) + 'MB）');
console.log('公開用を作り直すには: node build-static.js');
