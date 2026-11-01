// 単一 HTML へのバンドル: js/ 配下の ES モジュールを importmap の data: URL に埋め込む（ANGLEX と同じ方式）。
// 使い方: node build.mjs → dist/ANGLEX_INSPECT_v0_1.html（ダブルクリックで開ける。three.js は CDN）
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const imports = { three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', 'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/' };
for (const f of walk(join(root, 'js'))) { const key = 'inspect/' + relative(join(root, 'js'), f).split('\\').join('/'); imports[key] = 'data:text/javascript;charset=utf-8;base64,' + Buffer.from(readFileSync(f, 'utf8')).toString('base64'); }
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports })}</script>`);
html = html.replace("import 'inspect/main.js';", "import 'inspect/main.js';");
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'ANGLEX_INSPECT_v0_1.html'); writeFileSync(out, html);
console.log('wrote', out, (statSync(out).size / 1024).toFixed(0) + ' KB', Object.keys(imports).length - 2, 'modules');
