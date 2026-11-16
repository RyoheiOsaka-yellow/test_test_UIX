// デモ版（オフライン）の通し確認: 配布ファイルを直接開き、外部通信を遮断したまま、サインイン → 進め方 → 部材えらび → 3D に置く、までを動かす
// 既定の画質（質感あり）で開くので、材質や環境光が外部へ取りに行かないことも確かめる。使い方: node dev/offline-demo.mjs dist/ANGLEX_demo_offline.html
import path from 'path';
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); const ext = [];
await page.route('**/*', r => { const u = r.request().url(); if (/^https?:/.test(u)) { ext.push(u.slice(0, 110)); return r.abort(); } return r.continue(); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
const t0 = Date.now(); await page.goto('file://' + path.resolve(process.argv[2] || 'dist/ANGLEX_demo_offline.html'), { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); const tReady = Date.now() - t0;
const r = await page.evaluate(async () => { const out = { badge: !!document.querySelector('#demoBadge'), title: document.title, view: app.shell?.view, note: document.querySelector('#smAuthNote')?.textContent, fabHidden: getComputedStyle(document.querySelector('#btnParts')).display === 'none' }; return out; });
await page.click('#smSignIn'); await page.waitForSelector('.demo-step', { timeout: 15000 }); r.guideAuto = await page.evaluate(() => document.querySelectorAll('.demo-step').length);
await page.evaluate(() => document.querySelector('.demo-step[data-step="parts"] [data-act="try"]').click()); await page.waitForSelector('.modal.partpicker .pk-card img'); await page.waitForFunction(() => [...document.querySelectorAll('.pk-card img')].slice(0, 8).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 30000 }); r.thumbsInstant = await page.evaluate(() => [...document.querySelectorAll('.pk-card img')].slice(0, 8).every(i => i.naturalWidth === 360));
await page.click('.pk-card[data-pid="LIB15_01"]').catch(async () => { await page.fill('.modal.partpicker input[type=search]', '基礎ブロック'); await page.click('.pk-card[data-pid="LIB15_01"]'); }); await page.click('.pk-detail [data-act="place"]'); await page.waitForFunction(() => app.model.instances.some(i => app.model.familyOf(i).id === 'base_block') && app.shell.view === 'app');
r.placed = await page.evaluate(() => ({ view: app.shell.view, step: app.shell.step, n: app.model.instances.length })); r.external = ext; r.readyMs = tReady;
// コンクリート・黒皮・塗装など、以前は写真テクスチャを取りに行っていた材質も作ってみる
await page.evaluate(async () => { const sel = document.querySelector('#selStyle'); if (sel) { sel.value = 'realistic'; sel.dispatchEvent(new Event('change')); } await app.viewer.setEnvironment?.('warehouse'); await new Promise(r => setTimeout(r, 1500)); });
r.external = ext; console.log(JSON.stringify(r)); const ok = r.badge && r.fabHidden && r.guideAuto === 5 && r.thumbsInstant && r.placed.view === 'app' && ext.length === 0; console.log('BLOCKED ' + JSON.stringify(ext)); console.log(ok ? 'DEMO_OK' : 'FAILED'); await b.close();
