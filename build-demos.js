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

  const host = '<div class="panel__embed" data-slot="' + slot + '"'
             + ' data-demo="' + list.join(',') + '"'
             + ' data-video="' + vm[1] + '"></div>';
  edits.push({ at: sa + body.indexOf(vm[0]), len: vm[0].length, html: host, slot, n: list.length });
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
if (used.length) {
  const CSS = [MK.cssA,
    '/* パネル背景で 1枚HTML のデモを動かす。',
    '   iframe で隔離しているのでデモ側の CSS / JS はサイトに影響しない。',
    '   pointer-events:none によりスクロールとクリックはそのままサイトへ通る。 */',
    '.panel__embed{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;}',
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
  '  var slots = [];',
  '  for (var i = 0; i < hosts.length; i++) {',
  '    var raw = hosts[i].getAttribute(\'data-demo\').split(\',\');',
  '    var list = [];',
  '    for (var j = 0; j < raw.length; j++) { var s = raw[j].trim(); if (s) list.push(s); }',
  '    if (!list.length) continue;',
  '    // 訪問ごとに最初に見えるデモを変える',
  '    slots.push({ el: hosts[i], ids: list, at: (Math.random() * list.length) | 0,',
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
  '  if (!(\'IntersectionObserver\' in window)) { start(slots[0]); return; }',
  '  var io = new IntersectionObserver(function (es) {',
  '    for (var n = 0; n < es.length; n++)',
  '      for (var q = 0; q < slots.length; q++)',
  '        if (slots[q].el === es[n].target)',
  '          slots[q].ratio = es[n].isIntersecting ? es[n].intersectionRatio : 0;',
  '    arbitrate();',
  '  }, { threshold: [0, 0.05, 0.25, 0.5, 0.75, 1] });',
  '  for (var r = 0; r < slots.length; r++) io.observe(slots[r].el);',
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
