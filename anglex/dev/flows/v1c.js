const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const pickPart = (mark, kind) => page.evaluate(([mk, kd]) => { const i = app.model.instances.find(x => x.mark === mk); const g = app.groups.get(i.id); const ch = g.children.find(c => c.userData.part && c.userData.part.kind === kd && !c.userData.ref); const r = app.viewer.renderer.domElement.getBoundingClientRect(); app.onPick({ instance: g, object: ch }, { clientX: r.left + 420, clientY: r.top + 300 }); return !!ch; }, [mark, kind]);
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(null); }); 
log('PICK1', await pickPart('MF-1', 'member')); await page.waitForTimeout(300);
log('BAR1', await page.evaluate(() => ({ bar: !!document.querySelector('.ctx-bar'), head: document.querySelector('.ctx-head')?.textContent.slice(0, 60), sel: app.selectedInstance()?.mark, part: !!app.selectedPart })));
log('PICK2', await pickPart('MF-1', 'member')); await page.waitForTimeout(300);
log('BAR2', await page.evaluate(() => ({ head: document.querySelector('.ctx-head')?.textContent.slice(0, 80), part: app.selectedPart?.index, btns: [...document.querySelectorAll('.ctx-bar .btn')].map(b => b.textContent.trim()).slice(0, 14), dims: [...document.querySelectorAll('.ctx-dim')].map(d => d.querySelector('span').textContent), hl: (() => { let n = 0; app.viewer.modelRoot.traverse(o => { if (o.userData._hl) n++; }); return n; })() })));
await page.screenshot({ path: S + '/s21_ctxbar.png' });
// 足す ポップ
await page.evaluate(() => { document.querySelector('.ctx-menu > .btn').click(); }); await page.waitForTimeout(200);
log('ADDS', await page.evaluate(() => [...document.querySelectorAll('.ctx-pop .btn')].map(b => b.textContent.trim())));
const before = await page.evaluate(() => app.model.resolved(app.selectedInstance()).anchorN ?? null);
await page.evaluate(() => { const b = [...document.querySelectorAll('.ctx-pop .btn')].find(x => /アンカー.*\+1/.test(x.textContent)); if (b) b.click(); }); await page.waitForTimeout(800);
log('ANCHOR +1', { before, after: await page.evaluate(() => app.model.resolved(app.selectedInstance()).anchorN ?? null) });
// 寸法 ステッパー
log('PICK3', await pickPart('MF-1', 'member')); await page.waitForTimeout(300);
const dimBefore = await page.evaluate(() => { const d = document.querySelector('.ctx-dim'); return [d.querySelector('span').textContent, +d.querySelector('input').value]; });
await page.evaluate(() => document.querySelector('.ctx-dim .tiny:last-of-type').click()); await page.waitForTimeout(800);
log('DIM', { before: dimBefore, after: await page.evaluate(() => { const d = document.querySelector('.ctx-dim'); return d ? +d.querySelector('input').value : null; }), H: await page.evaluate(() => app.model.resolved(app.selectedInstance()).H) });
// 同じ部材を隣に
const n0 = await page.evaluate(() => app.model.instances.length);
await page.evaluate(() => [...document.querySelectorAll('.ctx-bar .btn')].find(b => b.textContent.includes('隣に')).click()); await page.waitForTimeout(1200);
log('ADJACENT', await page.evaluate(() => ({ n: app.model.instances.length, sel: app.selectedInstance()?.mark, pos: app.selectedInstance()?.pos })), 'was', n0);
// 軸ロック
await page.evaluate(() => app.setGizmoAxis('y')); log('AXIS', await page.evaluate(() => ({ x: app.viewer.gizmo.showX, y: app.viewer.gizmo.showY, z: app.viewer.gizmo.showZ, mode: app.gizmoMode })));
// 自動密着
await page.evaluate(() => { const m = app.model; const t = m.addType('plate', 'PL-9 150x150', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 100, pitchH: 100, holeD: 15 }); const a = m.addInstance(t.id, { pos: [5000, 0, 0] }); const b = m.addInstance(t.id, { pos: [5000, 15, 0] }); app.rebuildAll(); app.refreshBrowser(); window.__b = b.id; const g = app.groups.get(b.id); g.position.set(5000, 15, 0); app.onGizmoEnd(g); });
await page.waitForTimeout(800); log('SNAP', await page.evaluate(() => app.model.getInstance(window.__b).pos));
// 切替状態の持ち越し
await page.evaluate(() => { localStorage.setItem('anglex.switch', JSON.stringify({ selection: app.model.instances[2].id, step: null, style: 'cad', project: app.project.id })); app.applySwitchState(); }); await page.waitForTimeout(400);
log('SWITCH APPLY', await page.evaluate(() => ({ sel: app.selectedInstance()?.mark, style: app.viewer.displayStyle })));
// 分解図 PDF（引出線）
await page.evaluate(() => { const i = app.model.instances.find(x => x.mark === 'MF-1'); app.select(i.id); document.querySelector('#btnExplodeView').click(); }); await page.waitForTimeout(500);
const dl = []; page.on('download', d => dl.push(d)); await page.evaluate(() => [...document.querySelectorAll('.modal button')].find(b => b.textContent.includes('分解図 PDF')).click());
for (let i = 0; i < 60 && !dl.length; i++) await page.waitForTimeout(500); if (dl.length) { await dl[0].saveAs(S + '/exploded2.pdf'); console.log('DL saved'); }
