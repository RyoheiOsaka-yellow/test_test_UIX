// 加工の詳細: 切欠きつきの外形（面積を手計算と比較）→ 部品への反映（穴・切欠き・札）→ 画面で足す・つまむ・寸法を直す・消す → 3D の形が変わる → 指示書（PDF）
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-9;
await page.waitForFunction(() => window.app && app.model && app.model.instances.length, null, { timeout: 60000 });
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
// (1) 形: 板の外形に切欠きを差し込む。面積 = 板 − 切欠き
const g = await page.evaluate(async () => { const P = await import('./js/geo/profiles.js'); const F = await import('./js/bim/fab.js'); const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
  const p = P.parseSpec('L-50x50x6'); const info = P.faceInfo(p, 600); const fiA = info.A, fiB = info.B; const v = { kind: 'v', face: 'A', pi: 0, z: 300, edge: 's1', d: 44, ang: 90 }, rect = { kind: 'rect', face: 'A', pi: 0, z: 100, edge: 's1', w: 30, d: 20 }, cope = { kind: 'cope', face: 'A', pi: 0, end: 'start', edge: 's1', w: 40, d: 25 }, cham = { kind: 'chamfer', face: 'A', pi: 0, end: 'end', edge: 's1', c: 10 }, sc = { kind: 'scallop', face: 'A', pi: 0, end: 'end', edge: 's0', r: 20 }, uu = { kind: 'u', face: 'A', pi: 0, z: 500, edge: 's1', w: 20, d: 25 };
  const ol = fs => P.plateOutline(600, 50, fs.map(f => F.notchPoints(f, fiA))); const out = { info: { A: fiA, B: fiB }, plain: area(ol([])), v: area(ol([v])), rect: area(ol([rect])), cope: area(ol([cope])), cham: area(ol([cham])), sc: area(ol([sc])), u: area(ol([uu])), all: area(ol([v, rect, cope, cham, sc, uu])), nAll: ol([v, rect, cope, cham, sc, uu]).length, overlap: area(ol([rect, { ...rect, z: 110 }])), na: [F.notchArea(v, fiA), F.notchArea(cope, fiA), F.notchArea(cham, fiA)] };
  // 部品への反映と 3D の形
  const parts = [{ kind: 'member', name: '試験', spec: 'L-50x50x6', length: 600, holes: [], pl: { pos: [0, 0, 0], basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } }]; F.applyFab(parts, [v, { kind: 'hole', face: 'A', pi: 0, z: 200, s: 25, dia: 14 }, { kind: 'slot', face: 'B', pi: 0, z: 400, s: 30, dia: 12, len: 30, dir: 'z' }, { kind: 'tap', face: 'A', pi: 0, z: 450, s: 25, M: 'M8' }, { kind: 'bevel', face: 'A', pi: 0, end: 'end', ang: 35, note: 'レ形' }, { kind: 'zzz', face: 'A', pi: 0 }].filter(f => F.FAB_KINDS[f.kind]));
  const m0 = P.buildMember({ spec: 'L-50x50x6', length: 600, holes: [], lod: 300 }), m1 = P.buildMember({ spec: 'L-50x50x6', length: 600, holes: parts[0].holes, notches: parts[0].notches, lod: 300 }); const vol = grp => { let s = 0; grp.traverse(o => { const ge = o.geometry; if (!ge || !o.isMesh) return; const pa = ge.attributes.position, ix = ge.index; const n = ix ? ix.count : pa.count; const gv = i => { const k = ix ? ix.getX(i) : i; return [pa.getX(k), pa.getY(k), pa.getZ(k)]; }; for (let i = 0; i < n; i += 3) { const a = gv(i), b = gv(i + 1), c = gv(i + 2); s += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; } }); return Math.abs(s); };
  out.part = { holes: parts[0].holes.map(h => [h.kind, h.d, h.slot?.len || 0, h.M || '']), notches: parts[0].notches.length, marks: parts[0].marks.length }; out.vol = [vol(m0), vol(m1)]; out.desc = F.describeFab(v, fiA); out.descTap = F.describeFab({ kind: 'tap', face: 'A', z: 450, s: 25, M: 'M8' }, fiA); return out; });
log('geo', g);
chk('面の寸法: 山形鋼の脚 A は s = 0〜50、脚 B は s = 6〜50（穴の位置と同じ測り方）', g.info.A.s0 === 0 && g.info.A.s1 === 50 && near(g.info.B.s0, 6) && near(g.info.B.s1, 50) && g.info.A.L === 600 && g.info.A.t === 6);
chk('V 字切欠き 90°・深さ 44: 面積が 44² = 1,936 mm² 減る', near(g.plain, 30000) && near(g.plain - g.v, 1936, 0.002) && near(g.na[0], 1936, 0.002));
chk('角切欠き 30×20、端の切欠き 40×25、面取り C10 の面積がそれぞれ 600・1,000・50 mm² 減る', near(g.plain - g.rect, 600, 0.002) && near(g.plain - g.cope, 1000, 0.002) && near(g.plain - g.cham, 50, 0.002) && near(g.na[1], 1000, 0.002) && near(g.na[2], 50, 0.002));
chk('スカラップ R20 は π·20²/4、U 字 20×25 は 20×15 + π·10²/2 に近い（多角形の近似で 2% 以内）', near(g.plain - g.sc, Math.PI * 400 / 4, 0.02) && near(g.plain - g.u, 300 + Math.PI * 100 / 2, 0.02));
chk('6 つの切欠きを同時に入れても外形が 1 本につながり、重なる切欠きは後のものを捨てる', near(g.plain - g.all, 1936 + 600 + 1000 + 50 + (g.plain - g.sc) + (g.plain - g.u), 0.002) && g.nAll > 20 && near(g.plain - g.overlap, 600, 0.002));
chk('部品への反映: 丸穴・長穴・タップ（M8 は下穴 6.8）は穴に、V 字は切欠きに、開先は指示に入り、知らない種類は無視する', g.part.holes.length === 3 && g.part.holes[0][1] === 14 && g.part.holes[1][0] === 'slot' && g.part.holes[1][2] === 30 && g.part.holes[2][1] === 6.8 && g.part.holes[2][3] === 'M8' && g.part.notches === 1 && g.part.marks === 1);
chk('3D の形: 切欠きと穴の分だけ体積が減る（V 字 1,936 × 6 mm と穴 3 つ）', g.vol[1] < g.vol[0] && near(g.vol[0] - g.vol[1], 1936 * 6 + Math.PI * 49 * 6 + (Math.PI * 36 + 12 * 18) * 6 + Math.PI * 3.4 ** 2 * 6, 0.06));
chk('指示書の文: 位置と寸法が言葉で出る', /V 字切欠き 90°、深さ 44 mm（開き 88 mm）/.test(g.desc) && /始端から 300 mm/.test(g.desc) && /タップ穴 M8（下穴 φ6.8）/.test(g.descTap));
// (2) 画面: 部材を選ぶ → 加工の詳細 → 部品に寄る
const id = await page.evaluate(() => { const i = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); app.select(i.id); return i.id; });
const cam0 = await page.evaluate(() => app.viewer.camera.position.distanceTo(app.viewer.controls.target));
await page.click('#btnFab'); await page.waitForSelector('#fabSvg'); await page.waitForTimeout(1200);
const o1 = await page.evaluate(() => ({ parts: document.querySelectorAll('#fabPart option').length, faces: [...document.querySelectorAll('#fabFaces .fab-chip')].map(c => c.dataset.face), tools: +document.querySelector('#fabTools').dataset.total, groups: document.querySelectorAll('#fabGroups .fab-chip').length, shown: document.querySelectorAll('#fabTools .fab-tool').length, iso: app.isolated?.index, pi: app.fab.pi, dist: app.viewer.camera.position.distanceTo(app.viewer.controls.target), vb: app.fab.vb.w }));
log('open', { cam0, o1 });
chk('開くと、部品の選択・面のタブ・道具（4 つの組に 22 種類）が出て、その部品だけを残して 3D が寄る', o1.parts >= 3 && o1.faces.join() === 'A,B' && o1.tools === 22 && o1.groups === 4 && o1.shown === 7 && o1.iso === o1.pi && o1.dist < cam0 * 0.8);
const box = async () => (await page.$('#fabSvg')).boundingBox(); const place = async (tool, fx, fy) => { await page.evaluate(k => app.fab.pickTool(k), tool); await page.waitForTimeout(150); const b = await box(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await page.waitForTimeout(600); };
const vol = () => page.evaluate(() => { const E = app.fab; const inst = app.model.getInstance(E.instId); const g = app.groups.get(E.instId); const t = app.instanceParts(inst)[E.pi]; const ch = g.children.find(c => c.visible && c.userData.part && c.userData.part.name === t.name); let n = 0; ch.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return { verts: n, notches: (t.notches || []).length, holes: (t.holes || []).filter(h => h.fab).length, fab: JSON.parse(inst.params.fab || '[]') }; });
const v0 = await vol(); await place('v', 0.5, 0.45); const v1 = await vol();
const s1 = await page.evaluate(() => ({ sel: !!document.querySelector('#fabForm'), title: document.querySelector('#fabForm .t')?.textContent || '', list: document.querySelectorAll('#fabList tr').length, tool: app.fab.tool, lbl: document.querySelectorAll('.v-label.fab-lbl').length }));
log('place', { v0: { verts: v0.verts, n: v0.notches }, v1: { verts: v1.verts, n: v1.notches, f: v1.fab[0] }, s1 });
chk('道具を押して図を押すと V 字切欠きが足され、3D の部品の形が変わる', v1.notches === 1 && v1.fab.length === 1 && v1.fab[0].kind === 'v' && v1.fab[0].edge === 's1' && v1.fab[0].d === 44 && v1.verts !== v0.verts);
chk('足した加工が選ばれ、寸法の欄・一覧・3D の番号の札が出て、道具は元に戻る', s1.sel && /V 字切欠き/.test(s1.title) && s1.list === 1 && s1.tool === null && s1.lbl === 1);
// 寸法を直す
await page.fill('#fabForm [data-k="d"]', '30'); await page.waitForTimeout(700); await page.fill('#fabForm [data-k="ang"]', '60'); await page.waitForTimeout(700);
const v2 = await vol(); chk('寸法の欄で深さ 30・角度 60° に直すと、データと 3D に反映される', v2.fab[0].d === 30 && v2.fab[0].ang === 60 && v2.notches === 1);
// つまんで動かす（5 mm 刻み）
{ const b = await box(); const p0 = await page.evaluate(() => { const E = app.fab; const svg = document.getElementById('fabSvg'); const f = JSON.parse(app.model.getInstance(E.instId).params.fab)[0]; const fi = E.ctx.info[f.face]; const pt = svg.createSVGPoint(); pt.x = f.z; pt.y = (fi.s1 - fi.s0) - (fi.s1 - fi.s0) + 2; const q = pt.matrixTransform(svg.getScreenCTM()); return { x: q.x, y: q.y, z: f.z }; });
  await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 30, p0.y, { steps: 4 }); await page.mouse.move(p0.x + 60, p0.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(600); const v3 = await vol(); log('drag', { z0: p0.z, z1: v3.fab[0].z, bw: b.width });
  chk('図の上でつまんで動かすと、位置が 5 mm 刻みで変わる', v3.fab[0].z > p0.z + 5 && v3.fab[0].z % 5 === 0); }
// ほかの種類を足す。面を替える
await place('hole', 0.3, 0.5); await place('cope', 0.14, 0.45); await place('scallop', 0.88, 0.56); await place('bevel', 0.86, 0.5); await page.click('#fabFaces [data-face="B"]'); await page.waitForTimeout(300); await place('slot', 0.5, 0.5); await place('tap', 0.7, 0.5);
const v4 = await vol(); const kinds = v4.fab.map(f => f.kind + ':' + f.face).join(',');
log('many', { kinds, notches: v4.notches, holes: v4.holes });
chk('穴・端の切欠き・スカラップ・開先・長穴・タップを 2 つの面に足せる（7 か所）', v4.fab.length === 7 && v4.notches === 3 && v4.holes === 3 && /slot:B/.test(kinds) && /tap:B/.test(kinds) && /bevel:A/.test(kinds));
// 一覧から選ぶ → 図と 3D が寄る。複製・消す・元に戻す
const d0 = await page.evaluate(() => ({ vb: app.fab.vb.w, dist: app.viewer.camera.position.distanceTo(app.viewer.controls.target) })); await page.click('#fabList tr:nth-child(1)'); await page.waitForTimeout(1100);
const d1 = await page.evaluate(() => ({ vb: app.fab.vb.w, dist: app.viewer.camera.position.distanceTo(app.viewer.controls.target), face: app.fab.face, sel: app.fab.sel }));
log('zoom', { d0, d1 }); chk('一覧から加工を選ぶと、面が替わり、図がその加工に寄り、3D もその位置に寄る', d1.face === 'A' && d1.vb < d0.vb * 0.7 && d1.dist < d0.dist * 0.75 && !!d1.sel);
await page.click('#fabDup'); await page.waitForTimeout(500); const n1 = (await vol()).fab.length; await page.click('#fabDel'); await page.waitForTimeout(500); const n2 = (await vol()).fab.length; await page.evaluate(() => document.querySelector('#btnUndo').click()); await page.waitForTimeout(700); const n3 = await page.evaluate(id => JSON.parse(app.model.getInstance(id).params.fab).length, id);
chk('複製・消す・元に戻すが効く', n1 === 8 && n2 === 7 && n3 === 8);
// (3) 指示書
const pdf = await page.evaluate(async id => { const U = await import('./js/ui/fab.js'); const secs = await U.fabSections(app, app.model.getInstance(id)); globalThis.__anglexCapture = []; await U.exportFabSheet(app, { instId: id }); const c = globalThis.__anglexCapture; globalThis.__anglexCapture = null; return { n: c.length, name: c[0]?.name, size: c[0]?.blob.size, secs: secs.length, imgs: secs.filter(s => s.image?.dataUrl?.startsWith('data:image/png')).length, rows: secs.filter(s => s.table).reduce((a, s) => a + s.table.rows.length, 0), head: secs[0]?.heading }; }, id);
log('pdf', pdf); chk('指示書（PDF）: 面ごとの展開図（番号つき）と、加工の一覧（8 行）が入る', pdf.n === 1 && /加工の詳細/.test(pdf.name) && pdf.size > 30000 && pdf.imgs === 2 && pdf.rows === 8 && /MF-1/.test(pdf.head));
const wo = await page.evaluate(async () => { const R = await import('./js/ui/reports.js'); const { estimateModel } = await import('./js/bim/cost.js'); const em = estimateModel(app.model, app.rates()); const est = { no: 'T-001', projectName: app.project.name, lines: em.lines }; globalThis.__anglexCapture = []; await R.exportWorkOrderPDF(app, est); const c = globalThis.__anglexCapture; globalThis.__anglexCapture = null; return { n: c.length, size: c[0]?.blob.size }; });
log('workorder', wo); chk('いつもの加工指示書にも、足した加工の図と一覧が入る', wo.n === 1 && wo.size > 60000);
// (4) 閉じる・開き直す・保存
await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
const c1 = await page.evaluate(async id => { const closed = !document.getElementById('fabPanel') && !app.fab && !app.isolated; const marks = document.querySelectorAll('.v-label.fab-lbl').length; const d = app.projectData(); await app.loadProjectData(JSON.parse(JSON.stringify(d))); const i2 = app.model.getInstance(id); const kept = JSON.parse(i2.params.fab).length; const pt = app.instanceParts(i2).find(p => (p.notches || []).length); return { closed, marks, kept, notches: pt?.notches.length }; }, id);
log('close', c1); chk('Esc で閉じると全体の表示に戻り、開先の札だけが残る。加工は案件を開き直しても残る', c1.closed && c1.marks === 1 && c1.kept === 8 && c1.notches >= 3);
await page.evaluate(id => { app.model.updateInstance(id, { params: { fab: '[]' } }); app.rebuildInstance(app.model.getInstance(id)); }, id);
