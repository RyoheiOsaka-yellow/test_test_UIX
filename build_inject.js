/* ============================================================
   build_inject.js — 既存ビューアの HTML へデータフロー層を注入する
   ------------------------------------------------------------
   使い方:
     node build_inject.js --host <入力HTML> [--out <出力HTML>]

   ホスト HTML は一切書き換えず、`</body>` の直前に単一の <script> を
   足すだけ（非破壊拡張）。three.js はホストのものを使うので同梱しない。

   ホストに求める条件:
     window.__app = { scene, graph: { nodes: Map<id,{pos,ordinal}>, links: [] } }
   ホストはデータを非同期に読むため、注入側は準備完了を待ってから起動する。
   ============================================================ */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MODULES = ['geo', 'cook', 'convert', 'subnet', 'foreach', 'nodes', 'station_nodes', 'station_app'];
const ENTRY = 'station_app';
const MARKER = 'XBUILD_FLOW_INJECT';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function wrap(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', name + '.js'), 'utf8');
  return `__def(${JSON.stringify(name)}, function(module, exports, require){\n${src}\n});`;
}

const bundle = `
/* ${MARKER} — XBUILD データフロー層（人流）注入スクリプト */
(function(){
"use strict";
if (window.__xbflow) return;
var __defs = {}, __cache = {};
function __def(n, f){ __defs[n] = f; }
function require(p){
  var n = String(p).replace(/^\\.\\//, '').replace(/\\.js$/, '');
  if (__cache[n]) return __cache[n].exports;
  if (!__defs[n]) throw new Error('module not found: ' + n);
  var m = { exports: {} };
  __cache[n] = m;
  __defs[n](m, m.exports, require);
  return m.exports;
}
${MODULES.map(wrap).join('\n')}

/* ホストの非同期ロード完了を待ってから起動する */
var __tries = 0;
function __ready(){
  var a = window.__app;
  return a && a.scene && a.graph && a.graph.nodes && a.graph.nodes.size > 0 && a.graph.links.length > 0;
}
function __boot(){
  if (__ready()) {
    try { require(${JSON.stringify(ENTRY)}); }
    catch (e) { console.error('[${MARKER}] failed to start:', e); }
    return;
  }
  if (++__tries > 500) { console.error('[${MARKER}] host viewer did not become ready'); return; }
  setTimeout(__boot, 100);
}
__boot();
})();
`;

const hostPath = arg('--host', null);
if (!hostPath) {
  console.error('usage: node build_inject.js --host <input.html> [--out <output.html>]');
  process.exit(1);
}
const outPath = arg('--out', path.join(ROOT, 'dist', 'shinjuku_flow_3d.html'));

const host = fs.readFileSync(hostPath, 'utf8');
if (host.includes(MARKER)) {
  console.error('host HTML already contains an injected bundle; use the original file');
  process.exit(1);
}
const at = host.lastIndexOf('</body>');
if (at < 0) { console.error('no </body> in host HTML'); process.exit(1); }

const out = host.slice(0, at) + '<script>\n' + bundle + '\n</script>\n' + host.slice(at);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);

// 検証用に、注入したスクリプトだけを別ファイルへ出す（node --check 用）
fs.writeFileSync(path.join(ROOT, 'dist', '_inject_check.js'), bundle);

console.log('injected:', outPath,
  (out.length / 1024 / 1024).toFixed(2) + 'MB',
  '(+' + (bundle.length / 1024).toFixed(0) + 'KB)');
