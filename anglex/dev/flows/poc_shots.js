// PoC 計画書用のスクリーンショット（docs/spec/img/p_*.png）
const IMG = '/home/user/test_test_UIX/anglex/docs/spec/img';
const shot = async (n, wait = 700) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${IMG}/${n}.png` }); console.log('SHOT', n); };
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); }); await page.waitForTimeout(400);
// 1) スキャン図面（デモ DXF を 300 dpi 相当の画像に）を OCR 付きで読込 → 認識結果ダイアログ
await page.evaluate(async () => {
  const { parseDXF, dxfToSVG } = await import('./js/import/dxf.js'); const src = (await import('./js/main.js')).demoDXF(); const dxf = parseDXF(src); const bb = dxf.bbox;
  const scale = 10, pxPerMm = 300 / 25.4 / scale, pad0 = Math.max(bb.w, bb.h) * 0.04; const W = Math.round((bb.w + 2 * pad0) * pxPerMm), H = Math.round((bb.h + 2 * pad0) * pxPerMm);
  const svg = dxfToSVG(dxf, { width: W, height: H }).replace(/stroke-width="[^"]*"/g, `stroke-width="${0.5 * scale}"`).replace(/vector-effect="non-scaling-stroke"/g, ''); const img = new Image(); await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); });
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'スキャン図面_支持金具.png', { type: 'image/png' }); const imp = await import('./js/ui/importer.js');
  await imp.importRaster(app, file, { name: 'スキャン図面_支持金具.png', opts: { scale, dpi: 300, minLenMm: 15, ocr: true } });
});
await page.waitForSelector('.modal-back', { timeout: 120000 }).catch(() => { }); await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
await shot('p01_recognition', 900);
// 2) 図面ビュー（スキャン画像の上に認識結果）
await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-back:last-of-type .btn')].find(x => /図面/.test(x.textContent) && !x.classList.contains('primary') && !/修正/.test(x.title || '')); if (b) b.click(); else { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('2d'); } });
await shot('p02_drawing', 1500);
// 3) モデルへ配置 → 3D（確認旗つき）
await page.evaluate(() => { app.setView('3d'); }); await page.waitForTimeout(400);
await page.evaluate(async () => { const imp = await import('./js/ui/importer.js'); const d = app.drawing; imp.showRecognition(app, { name: d.name, kind: 'ラスター', rec: d.rec, stats: {}, raster: true }); await new Promise(r => setTimeout(r, 300)); const b = document.querySelector('.modal-back:last-of-type .btn.primary'); b && b.click(); });
await page.waitForTimeout(1200); await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); document.querySelectorAll('.toast').forEach(t => t.remove()); });
await page.evaluate(async () => { const THREE = await import('three'); const box = new THREE.Box3(); for (const i of app.model.instances.filter(x => x.source === 'import')) { const g = app.groups.get(i.id); if (g) box.expandByObject(g); } if (box.isEmpty()) return; const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z)); m.position.copy(c); m.updateMatrixWorld(true); app.viewer.fit(m, 1.05, { animate: false }); const imp = app.model.instances.find(x => x.source === 'import' && x.status === 'review') || app.model.instances.find(x => x.source === 'import'); if (imp) app.select(imp.id); });
await shot('p03_placed3d', 1500);
