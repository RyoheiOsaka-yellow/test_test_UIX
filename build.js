/* ============================================================
   build.js — src/*.js + vendor/three.min.js を単一 HTML へ結合する
   モジュールは無改造のまま。極小の CommonJS ローダで包むだけ。
   ============================================================ */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MODULES = ['geo', 'cook', 'convert', 'subnet', 'nodes', 'demo_nodes', 'site_data', 'site_nodes', 'scene', 'app'];
const ENTRY = 'app';

function wrap(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', name + '.js'), 'utf8');
  return `__def(${JSON.stringify(name)}, function(module, exports, require){\n${src}\n});`;
}

const loader = `
(function(){
"use strict";
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
require(${JSON.stringify(ENTRY)});
})();
`;

const three = fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'shell.html'), 'utf8');

const html = shell
  .replace('<!--THREE-->', '<script>\n' + three + '\n</script>')
  .replace('<!--BUNDLE-->', '<script>\n' + loader + '\n</script>');

const out = path.join(ROOT, 'dist', 'xbuild_dataflow.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

// 検証用に、結合したスクリプト部分だけを別ファイルへ出す（node --check 用）
fs.writeFileSync(path.join(ROOT, 'dist', '_bundle_check.js'), loader);

console.log('built:', out, (html.length / 1024).toFixed(0) + 'KB');
