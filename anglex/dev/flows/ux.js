const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const thumbs = () => page.evaluate(() => ({ rows: document.querySelectorAll('.sr-row').length, ok: document.querySelectorAll('.sr-thumb.ok').length, instant: document.querySelectorAll('.sr-thumb.instant').length }));
// 1) サムネイル永続キャッシュ: 生成 → リロード → 即表示
await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(6000);
log('THUMBS first', await thumbs());
await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); await page.waitForTimeout(600);
const t0 = Date.now(); await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(120);
log('THUMBS after reload (120ms)', { ...(await thumbs()), ms: Date.now() - t0 });
await page.waitForTimeout(400); log('THUMBS after reload (500ms)', await thumbs());
log('IDB', await page.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('anglex-thumbs', 1); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); if (!db) return 'no db'; const keys = await new Promise(r => { const q = db.transaction('thumbs').objectStore('thumbs').getAllKeys(); q.onsuccess = () => r(q.result); }); if (!keys.length) return { keys }; const val = await new Promise(r => { const q = db.transaction('thumbs').objectStore('thumbs').get(keys[0]); q.onsuccess = () => r(q.result); }); return { keys, n: Object.keys(val || {}).length, bytes: JSON.stringify(val || {}).length }; }));
await page.screenshot({ path: S + '/u1_showroom_instant.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(150); log('ESC closes showroom (focus in search input → blur + close)', await page.evaluate(() => !document.querySelector('.showroom')));
// 2) 逆方向の配管へ取付（口径合わせ）: MF-1（125A,32A,20A）→ HB-1（吊バンド 50A）
const marks = await page.evaluate(() => app.model.instances.map(i => [i.mark, app.model.familyOf(i).id, app.model.resolved(i).pipes || app.model.resolved(i).od || '']));
log('INSTANCES', marks);
const r1 = await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'), hb = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_band'); const before = app.model.resolved(mf).pipes; app.attachTo(mf.id, hb.id); const p = app.model.resolved(mf); const parts = app.instanceParts(mf); const ub = parts.filter(x => x.kind === 'ubolt').map(x => [x.nominal, x.pitch]); const holes = parts.flatMap(x => (x.holes || []).filter(h => h.kind === 'ubolt').map(h => Math.round(h.s))); const sp = app.pipeRefsOf(mf), tp = app.pipeRefsOf(hb); const m = sp.find(s => s.nominal === tp[0].nominal); return { before, after: p.pipes, fit: app.pipeFitParam(mf), ubolts: ub, uboltHoleS: holes, dist: m ? Math.round(m.center.distanceTo(tp[0].center) * 10) / 10 : null, axisDot: m ? Math.round(Math.abs(m.axis.dot(tp[0].axis)) * 1000) / 1000 : null, rot: mf.rot.map(v => Math.round(v * 1000) / 1000), pos: mf.pos }; });
log('ATTACH MF-1 -> HB-1 (口径合わせ)', r1);
// 3) 支持金具を実配管へ: スリーブ（鉄管 SGP、ref でない配管）を置き、吊アングル HS-1 を呼び寄せる
const r2 = await page.evaluate(() => { const t = app.model.addType('sleeve', 'スリーブ SGP 80A', { nominal: '80A', L: 900 }); const sl = app.model.addInstance(t.id, { pos: [2000, 900, 400], rot: [0, 0, Math.PI / 2] }); app.rebuildInstance(sl); const hs = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_support'); const before = app.model.resolved(hs).pipes; app.attachTo(hs.id, sl.id); const p = app.model.resolved(hs); const sp = app.pipeRefsOf(hs), tp = app.pipeRefsOf(sl); const m = sp.find(s => s.nominal === '80A'); return { sleeveRefs: tp.map(x => [x.nominal, x.od, !!x.pt.ref, x.axis.toArray().map(v => Math.round(v * 100) / 100)]), before, after: p.pipes, dist: m ? Math.round(m.center.distanceTo(tp[0].center) * 10) / 10 : null, axisDot: m ? Math.round(Math.abs(m.axis.dot(tp[0].axis)) * 1000) / 1000 : null, rot: hs.rot.map(v => Math.round(v * 1000) / 1000), ctxTargets: null }; });
log('ATTACH HS-1 -> sleeve 80A', r2);
await page.waitForTimeout(700);
// コンテキストバー: 配管インスタンス（スリーブ）を選ぶと「支持金具をここへ」が出る
await page.evaluate(() => { const sl = app.model.instances.find(i => app.model.familyOf(i).id === 'sleeve'); app.select(sl.id); app.selectPart ? app.selectPart(sl.id, 0, { x: 300, y: 300 }) : null; });
await page.waitForTimeout(300);
log('CTX BUTTONS', await page.evaluate(() => [...document.querySelectorAll('.ctx-bar .ctx-menu > .btn')].map(b => b.textContent)));
await page.screenshot({ path: S + '/u2_attach_sleeve.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(100); log('ESC closes ctx', await page.evaluate(() => !document.querySelector('.ctx-bar')));
// 4) 滑らかさ: fit アニメーション / zoomToCursor / 選択アウトライン / ホバー吹き出し / ショートカット / 矢印移動 / トースト上限
log('ZOOM2CURSOR', await page.evaluate(() => app.viewer.controls.zoomToCursor));
log('FIT TWEEN', await page.evaluate(async () => { app.viewer.fit(); const a = !!app.viewer._tween; await new Promise(r => setTimeout(r, 700)); return { tweenStarted: a, tweenDone: !app.viewer._tween }; }));
log('SETVIEW iso', await page.evaluate(async () => { app.viewer.setView('iso'); const a = !!app.viewer._tween; await new Promise(r => setTimeout(r, 900)); return { tweenStarted: a, done: !app.viewer._tween }; }));
const sel = await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'); app.select(mf.id); app.viewer.focusOn(app.groups.get(mf.id), { animate: false }); return { outlineLines: app.viewer.selRoot.children.length }; });
log('SELECTION OUTLINE', sel);
await page.waitForTimeout(300);
const pt = await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'); const g = app.groups.get(mf.id); const col = g.children.find(c => c.userData.part && c.userData.part.kind === 'member'); const v = g.position.clone(); col.getWorldPosition(v); const pt = col.userData.part; const mid = app.viewer.controls.target.clone().set(...[0, 0, (pt.length || 0) / 2]); mid.applyMatrix4(col.matrixWorld); v.copy(mid); v.project(app.viewer.camera); const r = app.viewer.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; });
await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(80); await page.mouse.move(pt.x + 2, pt.y + 1); await page.waitForTimeout(200);
log('HOVER TIP', await page.evaluate(() => { const t = document.querySelector('.hover-tip'); return t ? { show: t.classList.contains('show'), text: t.textContent } : null; }));
await page.screenshot({ path: S + '/u3_hover_outline.png' });
log('ARROW NUDGE', await page.evaluate(async () => { const mf = app.model.instances.find(i => i.mark === 'MF-1'); const x0 = mf.pos[0]; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', shiftKey: true, bubbles: true })); return { x0, pos: app.model.getInstance(mf.id).pos, status: document.querySelector('#status').textContent }; }));
await page.keyboard.press('?'); await page.waitForTimeout(250);
log('HELP', await page.evaluate(() => ({ modal: !!document.querySelector('.kbd-table'), rows: document.querySelectorAll('.kbd-table tr').length })));
await page.screenshot({ path: S + '/u4_shortcuts.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(200); log('ESC closes modal', await page.evaluate(() => !document.querySelector('.modal-back')));
log('TOAST CAP', await page.evaluate(async () => { const { toast } = await import('./js/ui/common.js'); for (let i = 0; i < 7; i++) toast('テスト ' + i); toast('テスト 6'); return { n: document.querySelectorAll('.toast').length }; }));
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
