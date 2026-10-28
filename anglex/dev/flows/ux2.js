const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 取付プレビュー（ゴースト）: モデルを変えずに結果を表示 → 消す
const r1 = await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'), hb = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_band'); const before = JSON.stringify([mf.pos, mf.rot, app.model.resolved(mf).pipes]); app.previewAttach(mf.id, hb.id); const g = app.viewer.ghostRoot.children[0]; const meshes = []; g.traverse(o => { if (o.isMesh) meshes.push(o); }); const after = JSON.stringify([mf.pos, mf.rot, app.model.resolved(mf).pipes]); return { ghosts: app.viewer.ghostRoot.children.length, meshes: meshes.length, transparent: meshes.every(m => m.material.transparent), ghostPos: g.position.toArray().map(v => Math.round(v)), label: app._ghostLabel?.element?.textContent, unchanged: before === after }; });
log('PREVIEW', r1);
await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'), hb = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_band'); app.select(mf.id); app.viewer.focusOn(app.groups.get(hb.id), { animate: false }); app.previewAttach(mf.id, hb.id); app.viewer.invalidate(3); }); await page.waitForTimeout(500);
await page.screenshot({ path: S + '/x1_preview_ghost.png' });
log('PREVIEW HIDE', await page.evaluate(() => { app.hideAttachGhost(); return { ghosts: app.viewer.ghostRoot.children.length, label: !!app._ghostLabel, overlays: document.querySelectorAll('.ghost-lbl').length }; }));
// ctx メニューのホバーでプレビューが出る（mouseenter）
await page.evaluate(() => { const mf = app.model.instances.find(i => i.mark === 'MF-1'); app.select(mf.id); app.selectPart(mf.id, null, { x: 400, y: 300 }); });
await page.waitForTimeout(200);
log('CTX HOVER', await page.evaluate(() => { const menus = [...document.querySelectorAll('.ctx-bar .ctx-menu')]; const m = menus.find(x => x.querySelector('.btn').textContent.includes('配管へ取付')); m.querySelector('.ctx-pop').classList.add('open'); const b = m.querySelector('.ctx-pop button'); b.dispatchEvent(new Event('mouseenter')); const n1 = app.viewer.ghostRoot.children.length; b.dispatchEvent(new Event('mouseleave')); return { button: b.textContent, ghostOnEnter: n1, ghostOnLeave: app.viewer.ghostRoot.children.length }; }));
await page.evaluate(() => app.select(null));
// 2) 複数選択: Shift+クリック相当（onPick に shiftKey）→ まとめ操作
const pick = (mark, shift) => page.evaluate(([mark, shift]) => { const i = app.model.instances.find(x => x.mark === mark); const g = app.groups.get(i.id); app.onPick({ instance: g, object: g.children[0], point: g.position.clone() }, { shiftKey: shift, clientX: 500, clientY: 400 }); }, [mark, shift]);
await pick('MF-1', false); await pick('MF-2', true); await pick('LB-1', true); await page.waitForTimeout(200);
log('MULTI', await page.evaluate(() => ({ sel: app.selection && app.model.getInstance(app.selection).mark, multi: [...app.multi].map(id => app.model.getInstance(id).mark), bar: !!document.querySelector('.multi-bar'), head: document.querySelector('.multi-bar .mb-head')?.textContent.slice(0, 40), btns: [...document.querySelectorAll('.multi-bar .ctx-row > .btn, .multi-bar .ctx-menu > .btn')].map(b => b.textContent), browserMulti: document.querySelectorAll('#browser .tn.leaf.multi').length })));
await page.screenshot({ path: S + '/x2_multi_bar.png' });
// 矢印でまとめて移動
log('MULTI NUDGE', await page.evaluate(() => { const before = app.selectedIds().map(id => app.model.getInstance(id).pos[0]); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); return { before, after: app.selectedIds().map(id => app.model.getInstance(id).pos[0]) }; }));
// 整列 X
log('ALIGN X', await page.evaluate(() => { app.alignSelected('x'); return app.selectedIds().map(id => { const i = app.model.getInstance(id); const b = new (app.viewer.modelRoot.constructor === Object ? null : Object)(); return [i.mark, i.pos.map(Math.round)]; }); }));
log('ALIGN GAPS', await page.evaluate(() => { const ids = app.selectedIds(); const boxes = ids.map(id => { const g = app.groups.get(id); g.updateWorldMatrix(true, true); let min = Infinity, max = -Infinity; g.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); min = Math.min(min, b.min.x); max = Math.max(max, b.max.x); } }); return [min, max]; }).sort((a, b) => a[0] - b[0]); return boxes.slice(1).map((b, i) => Math.round(b[0] - boxes[i][1])); }));
await page.waitForTimeout(600); await page.screenshot({ path: S + '/x3_aligned.png' });
// 複製 → 削除
log('DUP', await page.evaluate(() => { const n0 = app.model.instances.length; app.duplicateSelected(); return { n0, n1: app.model.instances.length, sel: app.selectedIds().length }; }));
log('DELETE MULTI', await page.evaluate(() => { const n0 = app.model.instances.length; app.removeInstances(app.selectedIds()); return { n0, n1: app.model.instances.length, bar: !!document.querySelector('.multi-bar'), multi: app.multi.size }; }));
// まとめて配管へ取付: HS-1 と HB-1 を MF-1 へ
log('ATTACH MULTI', await page.evaluate(() => { const hs = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_support'), hb = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_band'), mf = app.model.instances.find(i => i.mark === 'MF-1'); app.select(hs.id); app.multi.add(hb.id); app.applyMultiVisual(); app.attachSelectedTo(mf.id); const tp = app.pipeRefsOf(mf); const d = i => { const sp = app.pipeRefsOf(i); return Math.min(...tp.flatMap(t => sp.map(s => Math.round(s.center.distanceTo(t.center))))); }; return { hsPipes: app.model.resolved(hs).pipes, hbOd: app.model.resolved(hb).od, dHS: d(hs), dHB: d(hb), multi: app.multi.size }; }));
await page.waitForTimeout(600); await page.screenshot({ path: S + '/x4_attach_multi.png' });
// ショールーム: まとめて選択
await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(400);
await page.evaluate(() => { const rows = [...document.querySelectorAll('.sr-row:not(.na)')].slice(0, 3); for (const r of rows) r.click(); }); await page.waitForTimeout(1500);
log('SHOWROOM SELECT ALL', await page.evaluate(() => { const b = [...document.querySelectorAll('.sr-foot .btn')].find(x => x.textContent === '全選択'); b.click(); return { placed: app.model.instances.filter(i => i.source === 'catalog').length, selected: app.selectedIds().length, bar: !!document.querySelector('.multi-bar') }; }));
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
