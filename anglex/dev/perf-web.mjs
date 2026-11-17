// 動作の重さの計測（Web 版）: 読み込み・待機中・操作中を数える。
// 使い方: node dev/perf-web.mjs [dist/ANGLEX_v1.html] [出力 JSON]
//   ヘッドレスの Chromium（ソフトウェア描画）で測るため、描画の ms は実機の GPU より大きく出る。比べるのは「回数」と「CPU の時間」、改善の前後の差。
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const target = process.argv[2] || 'dist/ANGLEX_v1.html'; const outFile = process.argv[3] || null; const isV2 = /v2|demo/.test(target);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); });
const PORT = +(process.env.PORT || 8171); await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { window.__anglexNoGuide = true; window.__lt = { n: 0, ms: 0, max: 0 }; try { new PerformanceObserver(l => { for (const e of l.getEntries()) { __lt.n++; __lt.ms += e.duration; __lt.max = Math.max(__lt.max, e.duration); } }).observe({ type: 'longtask', buffered: true }); } catch { } });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
const metric = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); return Object.fromEntries(metrics.map(m => [m.name, m.value])); };
const net = []; page.on('requestfinished', async req => { try { const s = await req.sizes(); const t = req.timing(); net.push({ url: req.url().slice(0, 140), type: req.resourceType(), kb: Math.round((s.responseBodySize + s.responseHeadersSize) / 1024), ms: Math.round(t.responseEnd) }); } catch { } });
const failed = []; page.on('requestfailed', r => failed.push(r.url().slice(0, 120))); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
const R = { target, when: new Date().toISOString() };
const t0 = Date.now(); await page.goto(`http://localhost:${PORT}/${target}`, { waitUntil: 'domcontentloaded' }); R.domContentLoadedMs = Date.now() - t0;
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }); R.readyMs = Date.now() - t0;
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => { }); R.networkIdleMs = Date.now() - t0;
const m0 = await metric(); R.load = { scriptMs: Math.round(m0.ScriptDuration * 1000), taskMs: Math.round(m0.TaskDuration * 1000), layoutMs: Math.round(m0.LayoutDuration * 1000), heapMB: +(m0.JSHeapUsedSize / 1048576).toFixed(1), domNodes: m0.Nodes, longTasks: await page.evaluate(() => ({ n: __lt.n, ms: Math.round(__lt.ms), max: Math.round(__lt.max) })) };
// v2 はサインイン → 3D の画面へ
if (isV2) await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); document.querySelector('#smSignIn')?.click(); app.shell?.enterApp(app.model.instances.length ? 4 : 1); });
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); const v = app.viewer; const orig = v.render.bind(v); window.__rc = { n: 0, ms: 0 }; v.render = (...a) => { const t = performance.now(); const r = orig(...a); __rc.n++; __rc.ms += performance.now() - t; return r; }; });
await page.waitForTimeout(2500);
const idle = async (label, sec) => { await page.evaluate(() => { __rc.n = 0; __rc.ms = 0; }); const a = await metric(); await page.waitForTimeout(sec * 1000); const b = await metric(); const rc = await page.evaluate(() => ({ ...__rc })); return { label, sec, renders: rc.n, rendersPerSec: +(rc.n / sec).toFixed(1), renderMsAvg: rc.n ? +(rc.ms / rc.n).toFixed(1) : 0, cpuTaskPct: Math.round((b.TaskDuration - a.TaskDuration) / sec * 100), scriptMsPerSec: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000 / sec) }; };
const scene = () => page.evaluate(() => { const v = app.viewer; v.render(); const i = v.renderer.info; let meshes = 0, verts = 0; const mats = new Set(), geos = new Set(); v.scene.traverse(o => { if (o.isMesh || o.isLine || o.isLineSegments) { meshes++; geos.add(o.geometry.uuid); verts += o.geometry.attributes.position?.count || 0; const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x && mats.add(x.uuid)); } }); return { instances: app.model.instances.length, drawCalls: i.render.calls, triangles: i.render.triangles, objects: meshes, vertices: verts, uniqueGeometries: geos.size, uniqueMaterials: mats.size, gpuGeometries: i.memory.geometries, gpuTextures: i.memory.textures, programs: i.programs?.length, pixelRatio: v.renderer.getPixelRatio(), shadows: v.renderer.shadowMap.enabled, composer: !!v.composer, passes: v.composer?.passes?.map(p => p.constructor.name).join('+') }; });
R.scene = await scene();
R.idle = [await idle('待機（何も選んでいない）', 8)];
// 部材を選ぶ（見どころ表示 → 3 秒後に自動回転）
await page.evaluate(() => { const i = app.model.instances[0]; if (i) { app.select(i.id); app.setSpot?.(i.id); } });
R.idle.push(await idle('部材を選んで放置（自動回転あり）', 10));
await page.evaluate(() => { app.select(null); app.setSpot?.(null); });
// 回す操作（2 秒ドラッグ）
const box = await page.evaluate(() => { const r = app.viewer.renderer.domElement.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.evaluate(() => { __rc.n = 0; __rc.ms = 0; }); const ma = await metric(); const td = Date.now();
await page.mouse.move(box.x, box.y); await page.mouse.down(); for (let k = 0; k < 40; k++) { await page.mouse.move(box.x + k * 6, box.y + Math.sin(k / 5) * 30); await page.waitForTimeout(50); } await page.mouse.up(); const dragSec = (Date.now() - td) / 1000; const mb = await metric();
R.orbit = await page.evaluate(s => ({ sec: +s.toFixed(1), renders: __rc.n, fps: +(__rc.n / s).toFixed(1), renderMsAvg: __rc.n ? +(__rc.ms / __rc.n).toFixed(1) : 0 }), dragSec); R.orbit.cpuTaskPct = Math.round((mb.TaskDuration - ma.TaskDuration) / dragSec * 100);
// 寸法を変える（作り直しの時間）
R.edit = await page.evaluate(async () => { const inst = app.model.instances.find(i => /portal|bracket|hanger_support/.test(app.model.familyOf(i).id)) || app.model.instances[0]; if (!inst) return null; const fam = app.model.familyOf(inst); const key = fam.params.find(p => p.type === 'length' && p.scope === 'instance')?.key || fam.params.find(p => p.type === 'length')?.key; const ts = []; for (let k = 0; k < 5; k++) { const t = performance.now(); app.updateInstanceParams ? app.updateInstanceParams(inst.id, { [key]: (app.model.resolved(inst)[key] || 500) + 10 }) : (app.model.updateInstance(inst.id, { params: { ...inst.params, [key]: (app.model.resolved(inst)[key] || 500) + 10 } }), app.rebuildInstance(inst)); app.viewer.render(); ts.push(performance.now() - t); await new Promise(r => setTimeout(r, 50)); } return { family: fam.id, key, msAvg: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1), msMax: +Math.max(...ts).toFixed(1) }; });
// 画面を開く時間
const open = async (label, fn, sel) => { const t = Date.now(); await page.evaluate(fn); await page.waitForSelector(sel, { timeout: 30000 }); const ms = Date.now() - t; await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove())); return { label, ms }; };
R.open = [];
R.open.push(await open('部材を選ぶ', () => app.openPartPicker?.(), '.modal.partpicker .pk-card'));
R.open.push(await open('案件進行', () => app.openOrder?.(), '.modal.order .order-step'));
R.open.push(await open('業務フロー', () => document.querySelector('#btnFlow')?.click(), '.modal.flow .flow-wrap > *'));
R.open.push(await open('集計表', () => document.querySelector('#btnSchedules')?.click(), '.modal-back'));
// 重い場面: 部材を 30 個並べる
R.heavy = await page.evaluate(async () => { const { CATALOG } = await import('anglex:js/data/catalog.js').catch(() => import('./js/data/catalog.js')); const t = performance.now(); const ps = CATALOG.products.filter(p => p.skus?.length).slice(0, 30); for (const p of ps) app.placeProduct(p, p.skus[0]); return { placed: ps.length, placeMs: Math.round(performance.now() - t) }; }).catch(e => ({ error: e.message }));
await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
await page.waitForTimeout(1500); R.heavy.scene = await scene();
R.heavy.idle = await idle('部材 30 個を追加して待機', 6);
const m1 = await metric(); R.end = { heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), domNodes: m1.Nodes, jsListeners: m1.JSEventListeners };
// 通信
const hosts = {}; for (const n of net) { const h = n.url.startsWith('data:') ? 'data:' : (n.url.match(/^https?:\/\/([^/]+)/)?.[1] || n.url.slice(0, 20)); (hosts[h] ||= { n: 0, kb: 0 }); hosts[h].n++; hosts[h].kb += n.kb; }
R.network = { requests: net.length, kb: net.reduce((a, b) => a + b.kb, 0), hosts, biggest: [...net].filter(n => !n.url.startsWith('data:')).sort((a, b) => b.kb - a.kb).slice(0, 10), failed, errors: errs };
console.log(JSON.stringify(R, null, 1)); if (outFile) fs.writeFileSync(outFile, JSON.stringify(R, null, 1));
await browser.close(); server.close();
