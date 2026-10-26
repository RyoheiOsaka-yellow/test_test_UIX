import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => server.listen(+(process.env.PORT || 8124), r));
const out = process.argv[2] || '/tmp/app.png'; const script = process.argv[3];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +(process.env.VW || 1600), height: +(process.env.VH || 1000) } });
page.on('console', m => { if (m.type() !== 'warning' && !/404/.test(m.text())) console.log('[console]', m.type(), m.text().slice(0, 300)); }); page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:' + (process.env.PORT || 8124) + (process.env.PAGE || '/index.html') + (process.env.QUALITY === '1' ? '' : '?quality=0'), { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }).catch(() => console.log('ready timeout'));
await page.waitForTimeout(1500);
if (script) { const fn = new Function('page', 'return (async()=>{' + fs.readFileSync(script, 'utf8') + '})()'); await fn(page); }
await page.screenshot({ path: out }); console.log('saved', out);
await browser.close(); server.close();
