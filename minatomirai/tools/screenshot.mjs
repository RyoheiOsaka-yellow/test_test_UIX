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
    await new Promise(r => setTimeout(r, 700));  // 下敷き画像のデコード待ち
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
await shot('20g_underlay_1f', `a.labels('none'); const i = a.selectByName('MARK IS'); a.setGap(0); a.setCat(['宿泊']); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(5); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await shot('20h_underlay_lmp', `a.section(null); const i = a.selectByName('ランドマークプラザ'); a.setGap(0); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(5); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await shot('20h2_underlay_lmp3', `const i = a.selectByName('ランドマークプラザ'); a.setGap(0); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(12); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await page.evaluate(() => window.__app.setCat([]));
await shot('20j_zones_exact', `a.labels('auto'); const i = a.selectByName('MARK IS minatomirai'); a.setGap(0); a.underlay(false); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(5); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await shot('20k_zones_3f', `const i = a.selectByName('MARK IS minatomirai'); a.setGap(0); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(12); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await page.evaluate(() => { window.__app.underlay(true); window.__app.section(null); });
await shot('21_fictional', `a.select(-1); a.camera.position.set(-900, 420, -60); a.controls.target.set(-408, 120, -373);`);
await shot('22_rebuilt', `const p = a.tower().params; p.floors = 60; p.podFloors = 4; p.towerHalf = 34; p.ang = 10; a.rebuildTower(); a.camera.position.set(-900, 420, -60); a.controls.target.set(-408, 120, -373);`);
await page.evaluate(() => { const a = window.__app; const p = a.tower().params; Object.assign(p, { floors: 85, podFloors: 6, towerHalf: 29, ang: -33 }); a.rebuildTower(); document.getElementById('c-floor').value = 70; a.evaluateTower(); const el = document.getElementById('c-info'); el.scrollIntoView({ block: 'center' }); });
await page.screenshot({ path: `${out}/23_construct_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await shot('24_lmp_zones', `a.select(-1); const i = a.selectByName('ランドマークプラザ'); a.setGap(0); a.underlay(false); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.section(5); a.camera.position.set(cx + 1, 330, cz + 1); a.controls.target.set(cx, 0, cz);`);
await page.evaluate(() => { window.__app.section(null); window.__app.underlay(true); window.__app.select(-1); });
await shot('21b_fictional_floors', `a.selectByName('みなとみらい セントラルタワー（架空）'); a.setGap(6); a.floorCat(true); a.camera.position.set(-640, 300, -180); a.controls.target.set(-408, 60, -373);`);
await page.screenshot({ path: `${out}/21c_fictional_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await page.evaluate(() => { window.__app.select(-1); window.__app.floorCat(false); });
await shot('20i_declutter', `a.section(null); a.labels('auto'); const i = a.selectByName('MARK IS'); a.setGap(9); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 200, 150, cz + 170); a.controls.target.set(cx, 30, cz);`);
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
await shot('30_real_day', `a.select(-1); a.section(null); a.applyTheme('real'); a.real.hour = 14; a.real.month = 11; a.sun(); a.camera.position.set(-520, 260, 420); a.controls.target.set(-40, 80, 300);`);
await shot('31_real_overview', `a.camera.position.set(1150, 720, -1250); a.controls.target.set(0, 0, 60);`);
await shot('32_real_evening', `a.real.hour = 16.75; a.sun(); a.camera.position.set(700, 120, 300); a.controls.target.set(0, 60, 60);`);
await shot('33_real_night', `a.real.hour = 20; a.sun(); a.camera.position.set(700, 220, 300); a.controls.target.set(0, 60, 60);`);
await shot('34_real_close', `a.real.hour = 10; a.sun(); a.camera.position.set(120, 60, 120); a.controls.target.set(-40, 30, -20);`);
await shot('35_road_day', `a.real.hour = 11; a.real.month = 6; a.sun(); a.camera.position.set(-150, 70, 60); a.controls.target.set(-60, 2, -40);`);
await shot('36_road_street', `a.camera.position.set(-250, 18, 330); a.controls.target.set(-120, 3, 180);`);
await shot('37_road_night', `a.real.hour = 20; a.sun(); a.roads().update(3); a.camera.position.set(-250, 18, 330); a.controls.target.set(-120, 3, 180);`);
await shot('40_people_morning', `a.applyTheme('paper'); a.setClock(8.25); a.camera.position.set(-520, 330, 420); a.controls.target.set(-40, 20, 250); for (let i = 0; i < 40; i++) a.people().update(0.05);`);
await shot('41_people_sakuragicho', `a.setClock(18.25); a.camera.position.set(-170, 150, 880); a.controls.target.set(-30, 0, 660); for (let i = 0; i < 40; i++) a.people().update(0.05);`);
await shot('43_people_night', `a.applyTheme('night'); a.setClock(18.25); a.camera.position.set(-520, 330, 420); a.controls.target.set(-40, 20, 250); for (let i = 0; i < 40; i++) a.people().update(0.05);`);
await shot('44_people_real', `a.applyTheme('real'); a.setClock(8.5); a.camera.position.set(-35, 40, 745); a.controls.target.set(30, 3, 690); for (let i = 0; i < 40; i++) a.people().update(0.05);`);
{ const ui = `const $ = id => document.getElementById(id); const ev = v => { $('p-event').value = v; $('p-event').dispatchEvent(new Event('change')); }; const rain = v => { $('p-rain').checked = v; $('p-rain').dispatchEvent(new Event('change')); }; const rib = r => document.querySelector('#p-ribbon button[data-r="' + r + '"]').click(); const mesh = v => { $('p-mesh').checked = v; $('p-mesh').dispatchEvent(new Event('change')); }; const run = () => { for (let i = 0; i < 60; i++) { a.people().update(0.05); a.indoor().update(0.05); } };`;
  await shot('50_los_morning', `${ui} a.applyTheme('paper'); rib('los'); a.setClock(8.25); a.camera.position.set(-120, 170, 860); a.controls.target.set(20, 0, 660); run();`);
  await shot('51_event_karena', `${ui} a.applyTheme('night'); rib('diff'); ev('karena'); a.setClock(21.3); a.camera.position.set(-250, 900, 250); a.controls.target.set(-330, 0, -420); run();`);
  await shot('52_rain_diff', `${ui} a.applyTheme('paper'); ev(''); rain(true); rib('diff'); a.setClock(12.5); a.camera.position.set(-380, 520, 560); a.controls.target.set(-20, 0, 200); run();`);
  await shot('53_mesh_check', `${ui} rain(false); rib('volume'); mesh(true); a.setClock(13); a.camera.position.set(100, 2300, 900); a.controls.target.set(100, 0, 60); run();`);
  await shot('54_indoor_markis', `${ui} mesh(false); a.setClock(13); const i = a.selectByName('MARK IS'); a.setGap(9); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 200, 150, cz + 170); a.controls.target.set(cx, 30, cz); run();`);
  await page.evaluate(() => window.__app.select(-1)); }
{ const OBL = `a.camera.position.set(-560, 620, 760); a.controls.target.set(0, 0, 150);`;
  await shot('60_heat_ped', `const an = a.analysis(), p = a.people(); a.applyTheme('paper'); a.setClock(18.25); p.set({ vol: false, agents: false }); an.set({ layer: 'ped', bmetric: 'none' }); ${OBL}`);
  await shot('61_heat_emp', `a.analysis().set({ layer: 'emp' }); a.camera.position.set(100, 2500, 700); a.controls.target.set(100, 0, 20);`);
  await shot('64_bldg_tsunami', `a.analysis().set({ layer: 'none', bmetric: 'tsunami' }); ${OBL}`);
  await shot('65_bldg_presence_night', `a.applyTheme('night'); a.setClock(13); a.analysis().set({ layer: 'stay', bmetric: 'presence' }); ${OBL}`);
  await shot('67_indoor_heat', `const an = a.analysis(), p = a.people(); a.applyTheme('paper'); p.set({ vol: true, agents: true }); an.set({ layer: 'none', bmetric: 'none' }); const i = a.selectByName('MARK IS'); a.setGap(9); an.set({ tab: 'bldg', floorHeat: true }); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 200, 150, cz + 170); a.controls.target.set(cx, 30, cz);`);
  await page.evaluate(() => { const a = window.__app; a.select(-1); a.analysis().set({ floorHeat: false, tab: 'heat' }); }); }
{ const TOP = `a.camera.position.set(100, 2500, 700); a.controls.target.set(100, 0, 20);`;
  await shot('70_split', `const an = a.analysis(), p = a.people(); a.applyTheme('paper'); a.setClock(13); p.set({ vol: false, agents: false }); an.set({ layer: 'stay', bmetric: 'none', diff: 'none', split: true, layer2: 'emp', splitX: 0.5 }); ${TOP}`);
  await shot('74_diff_holiday', `a.analysis().set({ split: false, layer: 'stay', diff: 'holiday' }); ${TOP}`);
  await shot('75_zoning', `a.analysis().set({ layer: 'zoning', diff: 'none' }); ${TOP}`);
  await shot('80_indoor_flow', `const an = a.analysis(), p = a.people(); p.set({ vol: true, agents: true }); an.set({ layer: 'none' }); const i = a.selectByName('MARK IS'); a.setGap(11); a.indoor().set({ flow: true }); const m = a.header.buildings.meta[i]; const cx = m.c[0] / 10, cz = -m.c[1] / 10; a.camera.position.set(cx - 150, 190, cz + 150); a.controls.target.set(cx, 40, cz);`);
  await page.evaluate(() => { const a = window.__app; a.indoor().set({ flow: false }); a.select(-1); }); }
{ const OBL = `a.camera.position.set(-560, 620, 760); a.controls.target.set(0, 0, 150);`;
  await shot('90_bars', `const an = a.analysis(), p = a.people(); a.applyTheme('paper'); a.setClock(13); p.set({ vol: false, agents: false }); an.set({ layer: 'stay', style: 'bars', bmetric: 'none', diff: 'none', split: false }); ${OBL}`);
  await shot('91_isochrone', `a.analysis().set({ layer: 'access', style: 'contour' }); a.camera.position.set(100, 2500, 700); a.controls.target.set(100, 0, 20);`);
  await shot('93_flows', `const an = a.analysis(); an.set({ layer: 'none', style: 'flat' }); a.selectByName('MARK IS'); an.set({ flows: true }); a.camera.position.set(-760, 620, 900); a.controls.target.set(60, 40, 160);`);
  await page.evaluate(() => { const a = window.__app; a.analysis().set({ flows: false }); a.select(-1); a.people().set({ vol: true, agents: true }); }); }
// 追加の描き方と指標: 六角形・点密度・上位の範囲・混雑度の面・待ち人数・モデルの当てはまり
{ const OBL = `a.camera.position.set(-560, 760, 900); a.controls.target.set(40, 0, 120);`, TOP = `a.camera.position.set(100, 2300, 600); a.controls.target.set(100, 0, 40);`;
  await shot('96_hex', `const an = a.analysis(), p = a.people(); a.applyTheme('paper'); a.setClock(12.5); p.set({ vol: false, agents: false }); an.set({ layer: 'stay', style: 'hex', bmetric: 'none', diff: 'none', split: false }); ${OBL}`);
  await shot('97_dots', `a.analysis().set({ layer: 'ped', style: 'dots' }); a.camera.position.set(-300, 520, 620); a.controls.target.set(20, 0, 160);`);
  await shot('98_hot', `a.analysis().set({ layer: 'arrCar', style: 'hot' }); ${TOP}`);
  await shot('99_los', `a.setClock(8.5); a.analysis().set({ layer: 'los', style: 'flat' }); ${TOP}`);
  await shot('99b_wait', `a.setClock(18.25); a.analysis().set({ layer: 'wait', style: 'bars' }); ${OBL}`);
  await shot('99c_fit', `a.analysis().set({ layer: 'fit', style: 'flat' }); ${TOP}`);
  await page.evaluate(() => { const a = window.__app; a.analysis().set({ layer: 'none', style: 'flat' }); a.people().set({ vol: true, agents: true }); }); }
// ガイドツアー: 各場面へ切り替えた直後の 3D 表示 (説明文の箱は 09_ui と同じく DOM なのでここには写らない)
{ const n = await page.evaluate(() => window.__app.tour().scenes.length);
  for (let i = 0; i < n; i++) { await page.evaluate(i => { const a = window.__app; a.paused = true; a.tour().start(i, true); }, i); await shot(`tour_${String(i + 1).padStart(2, '0')}`, ``); }
  await page.evaluate(() => { window.__app.tour().stop(); }); }
await page.evaluate(() => { window.__app.applyTheme('paper'); document.getElementById('btn-blueprint').click(); });
await shot('08_blueprint', ``);
await page.screenshot({ path: `${out}/09_ui.png`, timeout: 120000 }).catch(e => console.log('ui screenshot failed:', e.message));
await browser.close();
