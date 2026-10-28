// ショールーム サムネイルの事前生成: アプリを headless で起動して全製品（既定 SKU）を描画し、js/data/thumbs_pre.js に書き出す
// 使い方: node dev/gen-thumbs.mjs   （GPU があれば数十秒、ソフトウェア描画では数分）
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); });
const PORT = +(process.env.PORT || 8131); await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${PORT}/index.html?quality=0&view=3d`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
const t0 = Date.now();
const data = await page.evaluate(async () => { const m = await import('./js/ui/thumbs.js'); let last = 0; return m.renderAllThumbs((n, total) => { if (n - last >= 25) { last = n; console.log(`thumbs ${n}/${total}`); } }); });
const n = Object.keys(data.t).length; const js = `// 事前生成サムネイル（dev/gen-thumbs.mjs が生成。手で編集しない）。v が thumbs.js の STORE_KEY と一致するときだけ使われる\nexport const PRETHUMBS = ${JSON.stringify(data)};\n`;
fs.writeFileSync(path.join(root, 'js/data/thumbs_pre.js'), js);
console.log(`wrote js/data/thumbs_pre.js: ${n} thumbnails, ${(js.length / 1024).toFixed(0)} KB, key ${data.v}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await browser.close(); server.close();
