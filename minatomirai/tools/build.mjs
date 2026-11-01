// dist/index.html を生成: src/main.js を esbuild でバンドルし、data/minatomirai.pack を base64 で埋め込む。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2022'],
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text;
const pack = readFileSync(join(root, 'data/minatomirai.pack')).toString('base64');
let guide = ''; try { guide = readFileSync(join(root, 'data/floorguide.csv'), 'utf8'); } catch (e) { }
// 下敷き画像 (公式フロアマップ) を data URL で埋め込む
let underlays = [];
try {
  underlays = JSON.parse(readFileSync(join(root, 'data/underlays.json'), 'utf8')).map(u => ({ ...u, data: 'data:image/jpeg;base64,' + readFileSync(join(root, 'data/underlays', u.file)).toString('base64') }));
} catch (e) { }
const html = readFileSync(join(root, 'src/index.html'), 'utf8')
  .replace('/*__PACK__*/', () => `window.__PACK_B64=${JSON.stringify(pack)};window.__FLOORGUIDE=${JSON.stringify(guide)};window.__UNDERLAYS=${JSON.stringify(underlays)};`)
  .replace('/*__APP__*/', () => js);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);
console.log(`dist/index.html: ${(html.length / 1e6).toFixed(2)} MB (js ${(js.length / 1e3).toFixed(0)} KB, pack b64 ${(pack.length / 1e6).toFixed(2)} MB)`);
