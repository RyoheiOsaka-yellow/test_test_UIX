#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   add-boot.js — 起動カーテン（YELLOWロゴのローディング画面）を入れる／外す

     node add-boot.js        入れる（何度実行しても同じ結果）
     node add-boot.js off    外す

   何をするか:
     ・読み込み中は黒地に YELLOW のロゴを出し、その裏でサイトを組み立てる
     ・TOPの3D都市が「実際に画面へ出た」ところまで待ってからカーテンを上げる
       ので、静止画→動く、下地→絵、といった切り替わりが一切見えない
     ・?boot=off を付けて開くとカーテン無しで確認できる（比較用）

   入れたあとは node build-demos.js → node build-static.js の順でビルドする。
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const TARGET = __dirname + '/yellow_spacex_v8.html';

const MK = {
  cssA: '/* ══ BOOT:CSS:START ══ */',
  cssB: '/* ══ BOOT:CSS:END ══ */',
  htmlA: '<!-- ══ BOOT:HTML:START ══ -->',
  htmlB: '<!-- ══ BOOT:HTML:END ══ -->',
};

const GATE_OLD = "if(want!==window.__BAKED){document.documentElement.style.visibility='hidden';}";
const GATE_NEW = "if(!/[?&]boot=off/.test(location.search)){document.documentElement.className+=' booting';"
               + "setTimeout(function(){document.documentElement.classList.remove('booting');},15000);}"
               + "else if(want!==window.__BAKED){document.documentElement.style.visibility='hidden';}";

const CSS = [MK.cssA,
'/* ═══ 起動カーテン ═══',
'   読み込みが終わるまで黒地にロゴを出し、その裏で組み立てる。',
'   中身は visibility で隠す（display:none にするとデモの表示判定が働かない） */',
'html.booting body > *:not(#boot){visibility:hidden;}',
'html.booting{background:#000;}',
'#boot{',
'  position:fixed;inset:0;z-index:9999;background:#000;',
'  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;',
'  opacity:1;transition:opacity .8s var(--ease);',
'}',
'#boot.is-out{opacity:0;pointer-events:none;}',
'.boot__mark{',
'  font-family:var(--font-logo);font-size:clamp(19px,3.1vw,34px);font-weight:300;',
'  letter-spacing:.42em;padding-left:.42em;line-height:1;color:#fff;white-space:nowrap;',
'  transition:transform .8s var(--ease);',
'}',
'#boot.is-out .boot__mark{transform:translateY(-7px);}',
'/* 文字は最初から見えている状態を基準にし、動くのは位置だけにする。',
'   組み立てで本体が詰まるとアニメーションは進まないことがあり、',
'   透明から始めると「ロゴが出ないまま真っ黒」になってしまうため */',
'.boot__mark i{display:inline-block;font-style:normal;transform:translateY(9px);',
'  animation:bootIn .85s var(--ease) both;}',
'@keyframes bootIn{to{transform:none;}}',
'/* 進捗の線。読み込み中は 72% まで伸び、準備ができたら残りを詰めて消える */',
'.boot__bar{position:relative;width:min(210px,38vw);height:1px;background:rgba(255,255,255,.16);overflow:hidden;}',
'.boot__bar b{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);background:rgba(255,255,255,.8);',
'  animation:bootBar 2.6s cubic-bezier(.15,.75,.2,1) .25s both;}',
'@keyframes bootBar{to{transform:scaleX(.72);}}',
'#boot.is-ready .boot__bar b{animation:none;transform:scaleX(1);transition:transform .34s var(--ease);}',
'@media (prefers-reduced-motion:reduce){',
'  .boot__mark i{animation:none;transform:none;}',
'  .boot__bar b{animation:none;transform:scaleX(.72);}',
'  #boot,.boot__mark{transition-duration:.3s;}',
'}',
MK.cssB].join('\n');

const LETTERS = 'YELLOW'.split('')
  .map((c, i) => '<i style="animation-delay:' + (0.05 + i * 0.055).toFixed(3) + 's">' + c + '</i>').join('');

const HTML = [MK.htmlA,
'<div id="boot" aria-hidden="true">',
'  <div class="boot__mark">' + LETTERS + '</div>',
'  <div class="boot__bar"><b></b></div>',
'</div>',
'<script>',
'/* カーテンを上げる条件:',
'   ・TOPのデモが実際に画面へ出ている（iframe が is-on になり、重なりが終わる）',
'   ・デモが動かない環境では、ページの読み込み完了',
'   ・どちらも最短 MIN は見せ、最長 MAX で必ず上げる（何かが詰まっても閉じ込めない） */',
'(function () {',
'  var el = document.getElementById(\'boot\');',
'  if (!el) return;',
'  var root = document.documentElement;',
'  if (!root.classList.contains(\'booting\')) { el.parentNode.removeChild(el); return; }',
'  /* 時間は「文書が組み上がった時点(DOMContentLoaded)」から数える。',
'     読み込み自体が遅い環境で、まだ何も描けていないうちにカーテンだけ',
'     先に外れてしまうのを防ぐため */',
'  var MIN = 800, MAX = 7000, t0 = 0, done = false, ready = false;',
'',
'  function lift() {',
'    if (done) return;',
'    done = true;',
'    el.classList.add(\'is-out\');',
'    root.classList.remove(\'booting\');',
'    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);',
'  }',
'  function markReady() {',
'    if (ready) return;',
'    ready = true;',
'    el.classList.add(\'is-ready\');',
'    setTimeout(lift, Math.max(0, MIN - (Date.now() - t0)));',
'  }',
'',
'  document.addEventListener(\'DOMContentLoaded\', function () {',
'    t0 = Date.now();',
'    setTimeout(lift, MAX);',
'    var willRunDemo = false;',
'    try {',
'      willRunDemo = !!document.querySelector(\'.panel__embed[data-demo]\')',
'        && !window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches',
'        && !(navigator.connection && navigator.connection.saveData)',
'        && !!document.createElement(\'canvas\').getContext(\'webgl2\');',
'    } catch (e) { willRunDemo = false; }',
'',
'    if (willRunDemo) {',
'      // デモが「重なり終わって見えている」状態になるまで待つ',
'      var iv = setInterval(function () {',
'        if (document.querySelector(\'.panel__embed[data-slot="home-hero"] iframe.is-on\')) {',
'          clearInterval(iv);',
'          setTimeout(markReady, 450);',
'        }',
'      }, 120);',
'      // 途中で見切って上げない。出てこないときは MAX の lift が受け止める',
'      setTimeout(function () { clearInterval(iv); }, MAX);',
'    } else if (document.readyState === \'complete\') {',
'      markReady();',
'    } else {',
'      window.addEventListener(\'load\', function () { setTimeout(markReady, 250); });',
'    }',
'  });',
'})();',
'<\/script>',
MK.htmlB].join('\n');

/* ───────── 既存分を取り除く（入れ直し・取り消し共通） ─────────
   待ち時間などを書き換えたあとでも確実に剥がせるよう、数値は決め打ちにしない */
const GATE_RE = /if\(!\/\[\?&\]boot=off\/\.test\(location\.search\)\)\{document\.documentElement\.className\+=' booting';setTimeout\(function\(\)\{document\.documentElement\.classList\.remove\('booting'\);\},\d+\);\}else /g;
function strip(h) {
  for (const [a, b] of [[MK.cssA, MK.cssB], [MK.htmlA, MK.htmlB]]) {
    let i;
    while ((i = h.indexOf(a)) !== -1) {
      const j = h.indexOf(b, i);
      if (j === -1) break;
      h = h.slice(0, i) + h.slice(j + b.length).replace(/^\n/, '');
    }
  }
  h = h.replace(GATE_RE, '');
  return h;
}

let h = fs.readFileSync(TARGET, 'utf8');
h = strip(h);

if (process.argv[2] === 'off') {
  fs.writeFileSync(TARGET, h);
  console.log('起動カーテンを外しました');
} else {
  // 1. 言語ゲートを、カーテン方式に切り替える
  if (h.indexOf(GATE_OLD) === -1) throw new Error('言語ゲートが見つかりません');
  h = h.replace(GATE_OLD, GATE_NEW);

  // 2. CSS（head 内のスタイルシートの末尾）
  //    ※ 単純な indexOf は使わない。デモの <template> 内にも </style> がある
  const head = h.indexOf('</head>');
  if (head === -1) throw new Error('</head> がありません');
  const s = h.lastIndexOf('</style>', head);
  if (s === -1) throw new Error('head 内に </style> がありません');
  h = h.slice(0, s) + CSS + '\n' + h.slice(s);

  // 3. マークアップ（本物の <body> の直後）
  //    ※ CSS コメントの中にも "<body>" の文字列があるので </head> 以降を探す
  const head2 = h.indexOf('</head>');
  const b = h.indexOf('<body>', head2);
  if (b === -1) throw new Error('<body> がありません');
  const at = b + '<body>'.length;
  h = h.slice(0, at) + '\n' + HTML + '\n' + h.slice(at);

  fs.writeFileSync(TARGET, h);
  console.log('起動カーテンを入れました（?boot=off で無効化して比較できます）');
}
