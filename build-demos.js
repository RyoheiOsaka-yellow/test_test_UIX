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
     <id>.css        … デモ側の <style> の末尾に足す上書き。HUDを隠す等
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
  'home-xbuild':        { page: 'page-home',         panel: 1 },
  'home-xad':           { page: 'page-home',         panel: 2 },
  'home-xinteractive':  { page: 'page-home',         panel: 3 },
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
       .replace(/<\/?html[^>]*>/gi, '')
       .replace(/<\/?head[^>]*>/gi, '')
       .replace(/<\/?body[^>]*>/gi, '')
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
    const i = s.lastIndexOf('</style>');
    if (i !== -1) s = s.slice(0, i) + '\n' + css + '\n' + s.slice(i);
    else s = '<style>\n' + css + '\n</style>\n' + s;
  }

  // 外部読み込みがあると、公開時に読めない/遅くなる可能性があるので知らせる
  const ext = s.match(/(?:src|href)=["']https?:\/\/[^"']+/gi);
  if (ext) warn.push(id + ': 外部読み込みがあります → ' + ext.slice(0, 3).join(' , '));
  if (!/<canvas|<svg|requestAnimationFrame|setInterval/.test(s))
    warn.push(id + ': 自動で動く要素が見当たりません（静止したままかもしれません）');

  // WebGPU 依存のデモは対応ブラウザでだけ動かす（未対応ではポスターのまま）
  if (/navigator\.gpu/.test(s)) demoNeeds[id] = 'webgpu';

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
  const host = '<div class="panel__embed" data-slot="' + slot + '"'
             + (theme ? ' data-theme="' + theme + '"' : '')
             + (keepAll ? ' data-keep="1"' : '')
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
    ...placeholderRules,
    '/* 白背景デモ用: デモが動くときだけ、そのパネルの文字を黒系に反転する',
    '   （デモが動かない環境ではポスター写真のまま白文字が維持される） */',
    '.panel--light .panel__scrim{background:',
    '  linear-gradient(to top,rgba(255,255,255,.9) 0%,rgba(255,255,255,.45) 34%,rgba(255,255,255,.03) 66%),',
    '  linear-gradient(to right,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 55%);}',
    '.panel--light .title,.panel--light .lede{color:#0b0d10;}',
    '.panel--light .eyebrow{color:rgba(10,12,16,.72);}',
    '.panel--light .eyebrow .nt,.panel--light .title .nt{color:#0b0d10;}',
    '.panel--light .panel__idx{color:rgba(10,12,16,.55);}',
    '.panel--light .btn{border-color:#0b0d10;color:#0b0d10;}',
    '.panel--light .btn:hover,.panel--light .btn:focus-visible{background:#0b0d10;color:#fff;}',
    '.panel__embed iframe{',
    '  position:absolute;inset:0;width:100%;height:100%;border:0;display:block;',
    '  pointer-events:none;opacity:0;transition:opacity .25s ease;',
    '}',
    '.panel__embed iframe.is-on{opacity:1;}',
    '@media (max-width:900px){ .panel__embed{display:none;} }',
    '@media (prefers-reduced-motion:reduce){ .panel__embed{display:none;} }',
    MK.cssB].join('\n') + '\n';
  const i = h.indexOf('</style>');           // スタイルシート末尾（前方だと後続宣言に負ける）
  if (i === -1) throw new Error('</style> がありません');
  h = h.slice(0, i) + CSS + h.slice(i);
}

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
  '  if (window.matchMedia(\'(max-width: 900px)\').matches) return;',
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
  '  var needProbe = false;',
  '  for (var n0 = 0; n0 < hosts.length; n0++) {',
  '    var l0 = hosts[n0].getAttribute(\'data-demo\').split(\',\');',
  '    for (var n1 = 0; n1 < l0.length; n1++) if (NEEDS[l0[n1].trim()] === \'webgpu\') needProbe = true;',
  '  }',
  '',
  '  function boot(gpuOk) {',
  '  function needsOk(id) {',
  '    if (NEEDS[id] === \'webgpu\') return gpuOk;',
  '    return true;',
  '  }',
  '',
  '  var slots = [];',
  '  for (var i = 0; i < hosts.length; i++) {',
  '    var raw = hosts[i].getAttribute(\'data-demo\').split(\',\');',
  '    var list = [];',
  '    for (var j = 0; j < raw.length; j++) { var s = raw[j].trim(); if (s && needsOk(s)) list.push(s); }',
  '    if (!list.length) continue;',                       // 動かせるデモが無ければポスターのまま',
  '    // この環境ではデモが動く: ポスターを隠す下地を1フレーム目から出す',
  '    hosts[i].classList.add(\'is-live\');',
  '    // 白背景デモのパネルは文字を黒系に反転',
  '    if (hosts[i].getAttribute(\'data-theme\') === \'light\') {',
  '      var pn = hosts[i].closest ? hosts[i].closest(\'.panel\') : null;',
  '      if (pn) pn.classList.add(\'panel--light\');',
  '    }',
  '    // 訪問ごとに最初に見えるデモを変える',
  '    slots.push({ el: hosts[i], ids: list, at: (Math.random() * list.length) | 0,',
  '                 keep: hosts[i].getAttribute(\'data-keep\') === \'1\',',
  '                 ratio: 0, on: false, timer: 0 });',
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
  '  function show(slot, id) {',
  '    var f = build(slot, id);',
  '    if (!f) return;',
  '    var old = slot.el.lastChild;',
  '    // 読み込み完了を待たずにすぐ見せる。デモ自身の立ち上がり演出をそのまま出す',
  '    requestAnimationFrame(function () { f.classList.add(\'is-on\'); });',
  '    f.addEventListener(\'load\', function () {',
  '      if (old) setTimeout(function () {',
  '        if (old.parentNode) old.parentNode.removeChild(old);',
  '      }, 700);',
  '    });',
  '    slot.el.appendChild(f);',
  '  }',
  '',
  '  function start(slot) {',
  '    if (slot.on) return;',
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

/* ───────── 7. 書き出し ───────── */
fs.writeFileSync(TARGET, h);

console.log('');
for (const e of edits.slice().reverse())
  console.log('  slot ' + e.slot.padEnd(20) + e.n + '件');
if (!edits.length) console.log('  デモの割り当てなし（すべて動画のまま）');
for (const w of warn) console.log('  ⚠ ' + w);
console.log('\nyellow_spacex_v8.html を更新（' + (h.length / 1024 / 1024).toFixed(2) + 'MB）');
console.log('公開用を作り直すには: node build-static.js');
