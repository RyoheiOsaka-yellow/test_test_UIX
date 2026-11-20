// 単一 HTML へのバンドル: js/ 配下の ES モジュールを importmap の data: URL に埋め込む（ANGLEX と同じ方式）。
// 使い方: node build.mjs
//   dist/ANGLEX_INSPECT_v0_1.html            公開版（架空サンプル 3 部品のみ。js/private は含めない）
//   private_dist/ANGLEX_INSPECT_BANTEC.html  非公開版（js/private があるときだけ生成: 実図面パック + スキャン画像を同梱。git 管理外）
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)); const jsRoot = join(root, 'js'); const priv = join(jsRoot, 'private');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const CDN = { three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', 'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/' };
const src = readFileSync(join(root, 'index.html'), 'utf8');
function bundle(withPrivate, outFile) {
  const imports = { ...CDN }; const scans = {};
  for (const f of walk(jsRoot)) { const rel = relative(jsRoot, f).split('\\').join('/'); const isPriv = rel.startsWith('private/'); if (isPriv && !withPrivate) continue;
    if (f.endsWith('.js')) imports['inspect/' + rel] = 'data:text/javascript;charset=utf-8;base64,' + Buffer.from(readFileSync(f, 'utf8')).toString('base64');
    else if (/\.(jpe?g|png)$/i.test(f) && isPriv) scans['js/' + rel] = `data:image/${/png$/i.test(f) ? 'png' : 'jpeg'};base64,` + readFileSync(f).toString('base64'); }
  let html = src.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script>window.__SCANS=${JSON.stringify(scans)};window.__HAS_PRIVATE=${withPrivate}</script>\n<script type="importmap">${JSON.stringify({ imports })}</script>`);
  mkdirSync(dirname(outFile), { recursive: true }); writeFileSync(outFile, html); console.log('wrote', relative(root, outFile), (statSync(outFile).size / 1024).toFixed(0) + ' KB', Object.keys(imports).length - 2, 'modules', Object.keys(scans).length, 'scans');
}
bundle(false, join(root, 'dist', 'ANGLEX_INSPECT_v0_1.html'));
if (existsSync(join(priv, 'pack.js'))) bundle(true, join(root, 'private_dist', 'ANGLEX_INSPECT_BANTEC.html'));
