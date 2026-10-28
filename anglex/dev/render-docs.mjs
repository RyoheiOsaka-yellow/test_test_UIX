// docs/spec/*.html → docs/pdf/*.pdf（Playwright / Chromium の印刷。同梱の日本語フォントを使用）
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); });
await new Promise(r => server.listen(8150, r));
const browser = await chromium.launch(); const page = await browser.newPage();
const DOCS = [['spec.html', 'ANGLEX_仕様書.pdf', '仕様書'], ['proposal.html', 'ANGLEX_提案書.pdf', '提案書'], ['hardware.html', 'ANGLEX_ハードウェア構成_回答書.pdf', '回答書'], ['security.html', 'ANGLEX_セキュリティ説明.pdf', 'セキュリティ説明', { landscape: true }]];
fs.mkdirSync(path.join(root, 'docs/pdf'), { recursive: true });
for (const [src, out, label, extra = {}] of DOCS) {
  await page.goto(`http://localhost:8150/docs/spec/${src}`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  const pdf = await page.pdf({ format: 'A4', printBackground: true, ...extra, margin: { top: '14mm', bottom: '14mm', left: '13mm', right: '13mm' }, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: `<div style="font-size:7.5pt;color:#888;width:100%;padding:0 13mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>ANGLEX ${label}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
  fs.writeFileSync(path.join(root, 'docs/pdf', out), pdf); console.log('wrote docs/pdf/' + out, Math.round(pdf.length / 1024), 'KB');
}
await browser.close(); server.close();
