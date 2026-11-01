// dist/index.html をヘッドレス Chromium で開き、コンソールエラー確認とスクリーンショット撮影を行う。
// usage: node tools/screenshot.mjs [outdir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright'); // 環境にプリインストールされた playwright を利用
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] || 'dist/shots');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForFunction(() => !document.getElementById('loading') || /エラー/.test(document.getElementById('loading-text')?.textContent || ''), null, { timeout: 180000 });
await page.waitForTimeout(3500);
console.log(logs.filter(l => !/\[log\]/.test(l) || /edges/.test(l)).join('\n') || '(no console errors)');
const info = await page.evaluate(() => {
  const a = window.__app; if (!a) return null;
  return { buildings: a.header.buildings.meta.length, bridges: a.header.bridges.meta.length, nodes: a.graph.nodes.length, links: a.graph.links.length, stations: a.header.stations.length, labels: a.header.labels.length, bench: a.benchmark(3) };
});
console.log(JSON.stringify(info));
// 描画ループを止め、カメラを置いてから 1 フレーム描画して canvas を取得する (ソフトウェア GL でも確実に撮れる)
const shot = async (name, setup) => {
  const dataUrl = await page.evaluate(async (setupSrc) => {
    const a = window.__app; a.paused = true;
    await new Promise(r => setTimeout(r, 50));
    (new Function('a', 'THREE_CAM', setupSrc))(a, a.camera);
    a.controls.update(); a.render();
    return document.querySelector('canvas').toDataURL('image/png');
  }, setup);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${out}/${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('shot', name);
};
await shot('01_overview', `a.camera.position.set(1150, 720, -1250); a.controls.target.set(0, 0, 60);`);
await shot('02_station', `a.camera.position.set(330, 190, 260); a.controls.target.set(60, 0, 40);`);
await shot('03_landmark', `a.camera.position.set(-520, 260, 420); a.controls.target.set(-40, 80, 300);`);
await shot('04_expanded', `a.setExpand(2.5); a.camera.position.set(420, 260, 380); a.controls.target.set(60, -20, 40);`);
await shot('05_redbrick', `a.setExpand(1); a.camera.position.set(1500, 320, 1100); a.controls.target.set(1000, 0, 650);`);
await shot('06_station_inside', `a.setExpand(1.6); a.groups.buildings.visible = false; a.groups.edges.visible = false; a.groups.labels.visible = false; a.camera.position.set(300, 60, 240); a.controls.target.set(80, -30, 50);`);
await shot('07_deck', `a.setExpand(1); a.groups.buildings.visible = true; a.groups.edges.visible = true; a.camera.position.set(140, 60, 560); a.controls.target.set(0, 5, 440);`);
// 経路検索テスト: みなとみらい駅ホーム(B4) -> 桜木町方面の地上ノード
const route = await page.evaluate(() => {
  const a = window.__app; const g = a.graph;
  const near = (x, y, lv) => { let b = null, bd = 1e9; for (const n of g.nodes) { if (n.lv !== lv) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; b = n; } } return b; };
  const from = near(105, -67, -4), to = near(-40, -700, 0);
  const r = a.dijkstra(from.id, to.id, false); const r2 = a.dijkstra(from.id, to.id, true);
  return { from: [from.x, from.y, from.lv], to: [to.x, to.y, to.lv], len: r && Math.round(r.length), moves: r && r.moves.map(m => `${m.vt}:${m.from}>${m.to}`), lenBF: r2 && Math.round(r2.length), movesBF: r2 && r2.moves.map(m => `${m.vt}:${m.from}>${m.to}`), stairsBF: r2 && r2.usedStairs };
});
console.log('route test', JSON.stringify(route));
await shot('12_points', `a.applyTheme('paper'); a.setRep('points'); a.camera.position.set(-520, 260, 420); a.controls.target.set(-40, 80, 300);`);
await shot('13_voxel', `a.setRep('voxel');`);
await shot('14_explode', `a.setRep('line'); a.setDisp('explode', 0.6);`);
await shot('15_stack', `a.setDisp('stack', 1);`);
await shot('16_build', `a.setDisp('build', 0.55);`);
await shot('17_section', `a.setDisp('explode', 0); a.section(30); a.camera.position.set(-300, 420, 300); a.controls.target.set(-40, 0, 300);`);
await shot('18_section_cap', `a.section(60); a.camera.position.set(-200, 520, 420); a.controls.target.set(-40, 0, 300);`);
await page.evaluate(() => { window.__app.section(null); });
// 建物選択 + 階分解 (ランドマークタワー = 最も高い建物 = bid 0)
await shot('19_floors', `a.select(0); a.setGap(9); a.poi(true); a.camera.position.set(-700, 520, 760); a.controls.target.set(-56, 260, 361);`);
await shot('20_tenants', `const i = a.selectByName('MARK IS'); a.setGap(7); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 260, 230, cz + 220); a.controls.target.set(cx, 40, cz);`);
await shot('20a_zones', `a.setPartition('corridor'); const i = a.selectByName('MARK IS'); a.setGap(9); a.floorCat(true); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 200, 150, cz + 170); a.controls.target.set(cx, 30, cz);`);
await shot('20d_markis_1f', `const i = a.selectByName('MARK IS'); a.setGap(0); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(6); a.camera.position.set(cx - 40, 230, cz + 120); a.controls.target.set(cx, 0, cz);`);
await shot('20e_grid_filter', `a.section(null); a.setPartition('grid'); const i = a.selectByName('ランドマークプラザ'); a.setGap(8); a.setCat(['飲食']); a.zoneDetail(0); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 220, 200, cz + 200); a.controls.target.set(cx, 20, cz);`);
await page.screenshot({ path: `${out}/20f_zone_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await page.evaluate(() => { window.__app.setCat([]); window.__app.setPartition('corridor'); });
await shot('20b_queens', `const i = a.selectByName('クイーンズスクエア横浜'); a.setGap(5); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 420, 420, cz + 380); a.controls.target.set(cx, 120, cz);`);
await page.screenshot({ path: `${out}/20c_tenant_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await page.evaluate(() => { const a = window.__app; a.select(-1); a.poi(false); });
await shot('21_points_height', `a.setRep('points'); a.setPMode(1); a.camera.position.set(-520, 260, 420); a.controls.target.set(-40, 80, 300);`);
await shot('22_points_size', `a.setPMode(2);`);
await page.evaluate(() => { window.__app.setRep('line'); window.__app.setPMode(0); });
await shot('10_line', `a.applyTheme('line'); a.setExpand(1); a.camera.position.set(-520, 260, 420); a.controls.target.set(-40, 80, 300);`);
await shot('11_night', `a.applyTheme('night');`);
await page.evaluate(() => { window.__app.applyTheme('paper'); document.getElementById('btn-blueprint').click(); });
await shot('08_blueprint', ``);
await page.screenshot({ path: `${out}/09_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await browser.close();
