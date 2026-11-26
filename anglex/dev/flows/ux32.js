// 強度計算: 骨組みの解析を手計算（閉じた式）と比べる → 断面性能・許容応力度 → 部品からの自動モデル化 → 画面・条件・計算書
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.abs(b) * tol;
await page.waitForFunction(() => window.app && app.model && app.model.instances.length, null, { timeout: 60000 });
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
// (1) 骨組みの解析: 片持ちはり（δ = PL³/3EI、M = PL）と、柱脚固定の門形ラーメン（水平力。柱脚 M = Ph/2·(3k+1)/(6k+1)、柱頭 M = Ph/2·3k/(6k+1)）
const r1 = await page.evaluate(async () => { const S = await import('./js/bim/strength.js'); const out = {};
  const el = (i, j, o = {}) => ({ i, j, A: 1e4, Iu: 1e6, Iv: 1e6, J: 1e6, E: 205000, G: 79000, eu: [0, 0, 1], ...o });
  { const F = new Float64Array(12); F[7] = -1000; const s = S.solveFrame3D({ nodes: [[0, 0, 0], [1000, 0, 0]], elems: [el(0, 1)], supports: new Map([[0, 'fixed']]), loads: [F] }); out.cant = { d: s.u[0][7], M: Math.abs(s.forces(0, 0).i.Mu), R: s.reactions(0).get(0)[1] }; }
  { const F = new Float64Array(24); F[6] = 1000; const s = S.solveFrame3D({ nodes: [[0, 0, 0], [0, 1000, 0], [2000, 1000, 0], [2000, 0, 0]], elems: [el(0, 1, { A: 1e7 }), el(1, 2, { A: 1e7 }), el(2, 3, { A: 1e7 })], supports: new Map([[0, 'fixed'], [3, 'fixed']]), loads: [F] }); out.portal = { base: Math.abs(s.reactions(0).get(0)[5]), top: Math.abs(s.forces(0, 0).j.Mu), H: Math.abs(s.reactions(0).get(0)[0]) }; }
  { // 弱軸・強軸を取り違えていないか: Iu ≠ Iv の片持ちで、u 方向と v 方向の先端荷重
    const mk = dof => { const F = new Float64Array(12); F[6 + dof] = 100; return F; }; const s = S.solveFrame3D({ nodes: [[0, 0, 0], [500, 0, 0]], elems: [{ i: 0, j: 1, A: 1e4, Iu: 4e5, Iv: 1e5, J: 1e5, E: 205000, G: 79000, eu: [0, 1, 0] }], supports: new Map([[0, 'fixed']]), loads: [mk(1), mk(2)] }); out.axes = { dy: s.u[0][7], dz: s.u[1][8], ey: 100 * 500 ** 3 / (3 * 205000 * 1e5), ez: 100 * 500 ** 3 / (3 * 205000 * 4e5) }; }
  out.fc = [S.fcOf(235, 205000, 100), S.fcOf(235, 205000, 150), S.fcOf(235, 205000, 0)]; const L = S.sectionOf('L-50x50x6'), Lg = S.sectionOf('L-50x50x6', { principal: false }), C = S.sectionOf('[-100x50x5x7.5'), Q = S.sectionOf('□-50x50x2.3');
  out.L = { A: L.A, Iu: L.Iu, Iv: L.Iv, th: L.theta * 180 / Math.PI, Ig: Lg.Iu }; out.C = { A: C.A, Ix: C.Ix, ltb: !!C.ltb }; out.Q = { A: Q.A, Ix: Q.Ix }; out.th = [S.threadArea('M12').As, S.threadArea('W3/8').As, S.threadArea('M10').As];
  out.kh = [S.khOf(S.settingsOf({})), S.khOf(S.settingsOf({ strength: { seismicClass: 'S', floor: 'top' } })), S.khOf(S.settingsOf({ strength: { seismic: false } })), S.khOf(S.settingsOf({ strength: { khManual: 0.75 } }))];
  return out; });
log('solver', r1);
chk('片持ちはり: 先端のたわみが PL³/3EI と合う', near(r1.cant.d, -1000 * 1e9 / (3 * 205000 * 1e6), 0.002));
chk('片持ちはり: 根元の曲げモーメントが PL、反力が P', near(r1.cant.M, 1e6, 0.002) && near(r1.cant.R, 1000, 0.002));
chk('門形ラーメン（水平力）: 柱脚と柱頭の曲げモーメントが閉じた式と合う', near(r1.portal.base, 312500, 0.005) && near(r1.portal.top, 187500, 0.005) && near(r1.portal.H, 500, 0.005));
chk('断面の向き: u 方向のたわみは Iv、v 方向のたわみは Iu で決まる', near(r1.axes.dy, r1.axes.ey, 0.003) && near(r1.axes.dz, r1.axes.ez, 0.003));
chk('許容圧縮応力度: λ = 100 で 86.3、λ = 150 で 40.9（オイラー側）、λ = 0 で F/1.5', near(r1.fc[0], 86.27, 0.002) && near(r1.fc[1], 0.277 * 235 / (150 / 119.79) ** 2, 0.002) && near(r1.fc[2], 235 / 1.5, 0.001));
chk('山形鋼 L-50×50×6: 断面積 5.644 cm²、主軸の Iu ≒ 20.0、Iv ≒ 5.23 cm⁴、主軸は 45°', near(r1.L.A, 564.4, 0.002) && near(r1.L.Iu, 20.0e4, 0.03) && near(r1.L.Iv, 5.23e4, 0.03) && near(Math.abs(r1.L.th), 45, 0.01) && near(r1.L.Ig, 12.6e4, 0.01));
chk('溝形鋼・角形鋼管の断面性能が JIS の表と合う（[-100×50: A 11.92 cm²、Ix 188 cm⁴）', near(r1.C.A, 1192, 0.002) && near(r1.C.Ix, 188e4, 0.002) && r1.C.ltb && near(r1.Q.A, 425, 0.01) && near(r1.Q.Ix, 15.9e4, 0.01));
chk('ねじの有効断面積: M12 = 84.3、M10 = 58.0、W3/8 ≒ 50 mm²', near(r1.th[0], 84.3, 0.01) && near(r1.th[2], 58.0, 0.01) && near(r1.th[1], 50.0, 0.04));
chk('設計用水平震度: 初期値 A・中間階 = 1.0、S・上層階 = 2.0、地震なし = 0、直接指定が優先', r1.kh[0] === 1.0 && r1.kh[1] === 2.0 && r1.kh[2] === 0 && r1.kh[3] === 0.75);
// (2) 部品からの自動モデル化を手計算と比べる: 角形鋼管の片持ち（アンカー 4 本）の先端に 50A の満水配管
const r2 = await page.evaluate(async () => { const S = await import('./js/bim/strength.js'); const { place } = await import('./js/bim/families.js');
  const mem = { kind: 'member', name: '腕', spec: '□-50x50x2.3', length: 1000, pl: place([0, -25, -25], [1, 0, 0], [0, 0, 1]) }; /* 断面の中心が x 軸を通るように置く */
  const anchors = [[40, 40], [40, -40], [-40, 40], [-40, -40]].map(([y, z]) => ({ kind: 'anchor', name: 'アンカー M12', M: 'M12', pl: place([0, y, z], [1, 0, 0], [0, 1, 0]) }));
  const pipe = { kind: 'pipe', ref: true, name: '配管 50A', spec: 'SGP-50A', nominal: '50A', od: 60.5, length: 400, pl: place([1000, 55, -200], [0, 0, 1], [0, 1, 0]) };
  const st = S.settingsOf({ strength: { seismic: false, span: 2 } }); const r = S.analyzeParts([mem, ...anchors, pipe], st); const st2 = S.settingsOf({ strength: { seismic: true, khManual: 1.0, span: 2 } }); const q = S.analyzeParts([mem, ...anchors, pipe], st2);
  const pick = (res, kind, term) => res.items.find(i => i.kind === kind && (!term || i.term === term));
  return { W: r.loads.pipe, self: r.loads.self, stress: pick(r, 'stress', 'long'), defl: pick(r, 'defl'), aT: pick(r, 'anchorT'), aQ: pick(r, 'anchorQ'), sup: r.supports, ratio: r.ratio, cases: r.cases.length, q: { ratio: q.ratio, cases: q.cases.length, stressS: pick(q, 'stress', 'short'), aT: pick(q, 'anchorT') }, model: r.model }; });
log('auto', r2);
const W = (5.31 + Math.PI / 4 * 52.9 ** 2 * 1e-6 * 1000) * 2 * 9.80665, self = 425e-6 * 7850 * 9.80665, Mroot = W * 1000 + self * 500, Z = 15.9e4 / 25;
chk('荷重: 50A 満水 × 支持間隔 2 m = 約 147 N、自重 約 33 N', near(r2.W, W, 0.01) && near(r2.self, self, 0.02));
chk('部材の応力: 根元の M/Z が手計算（約 25.7 N/mm²）と合い、許容 156.7 に対する検定比になる', near(r2.stress.sigma, Mroot / Z, 0.02) && near(r2.stress.fb, 156.7, 0.01) && near(r2.stress.ratio, Mroot / Z / (235 / 1.5), 0.02) && r2.stress.limit === 1);
chk('たわみ: 先端のたわみが PL³/3EI + wL⁴/8EI（約 1.63 mm）と合い、片持ちの制限 L/250 = 4 mm', near(r2.defl.value, W * 1e9 / (3 * 205000 * 15.9e4) + self / 1000 * 1e12 / (8 * 205000 * 15.9e4), 0.04) && near(r2.defl.limit, 4, 0.01));
chk('アンカー: 4 本を固定の支持点と読み、引抜 = M·d/Σd²（約 1.02 kN/本）、長期の許容は 6.7 ÷ 1.5', r2.sup.length === 1 && r2.sup[0].type === 'fixed' && r2.sup[0].n === 4 && near(r2.aT.value, Mroot * 40 / 6400 / 1000, 0.03) && near(r2.aT.limit, 6.7 / 1.5, 0.01) && r2.aT.term === 'long');
chk('地震あり: 組合せが 9 通りに増え、短期の許容（1.5 倍）で照査し、検定比が上がる', r2.cases === 1 && r2.q.cases === 9 && near(r2.q.stressS.fb, 235, 0.01) && r2.q.stressS.ratio > r2.stress.ratio && r2.q.aT.ratio > r2.aT.ratio);
// (3) サンプルの案件: すべての支持金具が計算でき、門型はアンカーが決め手、吊りは水平力をかけない
const r3 = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); const M = U.strengthModel(app); const by = id => M.rows.find(r => app.model.familyOf(r.inst).id === id);
  const info = r => r && ({ ratio: r.res.ratio, n: r.res.items.length, worst: r.res.worst && r.res.worst.scope + ':' + r.res.worst.kind, warn: r.res.warnings, lateral: r.res.lateral, sup: r.res.supports.map(s => s.type + ':' + s.kind), scopes: [...new Set(r.res.items.map(i => i.scope))] });
  const base = { live: M.live.length, all: M.rows.length, ng: M.ng.length, finite: M.live.every(r => Number.isFinite(r.res.ratio) && r.res.items.every(i => Number.isFinite(i.ratio))), portal: info(by('portal_frame')), hang: info(by('hanger_support')), band: info(by('hanger_band')), br: info(by('bracket_L')) };
  app.project.strength = { rodSeismic: true }; const M2 = U.strengthModel(app); const h2 = M2.rows.find(r => app.model.familyOf(r.inst).id === 'hanger_support'); base.hangSeis = { pass: h2.res.ok, ratio: h2.res.ratio, worst: h2.res.worst?.label, kind: h2.res.worst?.kind };
  app.project.strength = { seismicClass: 'S', floor: 'top' }; base.portalS = U.strengthModel(app).rows.find(r => app.model.familyOf(r.inst).id === 'portal_frame').res.ratio;
  app.project.strength = { contents: 'empty' }; base.portalEmpty = U.strengthModel(app).rows.find(r => app.model.familyOf(r.inst).id === 'portal_frame').res.loads.pipe; app.project.strength = null; base.portalLoad = U.strengthModel(app).rows.find(r => app.model.familyOf(r.inst).id === 'portal_frame').res.loads.pipe; return base; });
log('demo', r3);
chk('サンプルの 5 個すべてを計算でき、検定比がすべて有限', r3.live === 5 && r3.all === 5 && r3.finite);
chk('門型架台: アンカー・U ボルト・溶接・部材を照査し、支持点は固定 2 か所', r3.portal.sup.length === 2 && r3.portal.sup.every(s => s === 'fixed:anchor') && ['member', 'anchor', 'weld'].every(k => r3.portal.scopes.includes(k)) && r3.portal.ratio > 0.05);
chk('吊り金具: 初期設定では水平の地震力をかけず、その旨を知らせる', r3.hang.lateral === false && r3.hang.warn.some(w => /水平の地震力はかけていません/.test(w)) && r3.hang.ratio < 1 && r3.band.lateral === false);
chk('吊り金具に水平力をかける設定にすると NG になり、理由が出る', r3.hangSeis.pass === false && r3.hangSeis.ratio > 1);
chk('条件で結果が動く: 耐震クラス S・上層階で検定比が上がり、配管を空にすると荷重が減る', r3.portalS > r3.portal.ratio && r3.portalEmpty < r3.portalLoad);
// (4) 画面: 一覧 → 内訳 → 条件を変える → 3D の札 → 計算書
await page.click('#btnStrength'); await page.waitForSelector('.st-modal .st-list tbody tr'); await page.waitForTimeout(300);
const u1 = await page.evaluate(() => ({ rows: document.querySelectorAll('.st-list tbody tr').length, verdict: document.querySelector('#stVerdict').textContent, max: document.querySelector('#stMax').textContent, cond: document.querySelector('#stCond').textContent, detail: !!document.querySelector('#stDetail'), tabs: [...document.querySelectorAll('#stDetail .tab')].map(t => t.textContent), assume: document.querySelectorAll('.st-modal details li').length }));
log('ui', u1);
chk('一覧: 5 行と、判定・いちばん厳しい検定比・条件が出る', u1.rows === 5 && /OK|NG/.test(u1.verdict) && /^\d\.\d\d$/.test(u1.max) && /KH = 1\.00/.test(u1.cond) && /満水/.test(u1.cond));
chk('内訳: 部材 / 接合・アンカー / 荷重・反力 のタブと、仮定の説明（10 項目以上）', u1.detail && u1.tabs.length === 3 && /部材/.test(u1.tabs[0]) && /接合/.test(u1.tabs[1]) && u1.assume >= 10);
await page.click('.st-list tbody tr[data-inst]:nth-child(3)'); await page.waitForTimeout(300); const u2 = await page.evaluate(() => ({ title: document.querySelector('#stDetail h4').textContent, sel: app.selection, on: document.querySelector('.st-list tr.on')?.dataset.inst })); log('row', u2);
chk('行を押すと、その支持金具の内訳に替わり、3D でも選ばれる', u2.sel === u2.on && /LB-1/.test(u2.title));
await page.click('#stCondBtn'); await page.waitForSelector('.st-form'); await page.evaluate(() => { const f = document.querySelector('.st-form'); const sels = f.querySelectorAll('select'); sels[1].value = 'S'; sels[2].value = 'top'; }); await page.click('#stSaveCond'); await page.waitForTimeout(500);
const u3 = await page.evaluate(() => ({ cond: document.querySelector('#stCond').textContent, saved: app.project.strength, max: document.querySelector('#stMax').textContent, data: app.projectData().strength?.seismicClass })); log('cond', u3);
chk('条件を変える: 耐震クラス S・上層階にすると KH = 2.00 で計算し直し、案件に保存される', /KH = 2\.00/.test(u3.cond) && u3.saved.seismicClass === 'S' && u3.data === 'S' && +u3.max > +u1.max);
const pdf = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); globalThis.__anglexCapture = []; await U.exportStrengthPdf(app); const c = globalThis.__anglexCapture; globalThis.__anglexCapture = null; const b = c[0]; const head = b ? new TextDecoder().decode(new Uint8Array(await b.blob.arrayBuffer()).slice(0, 5)) : ''; return { n: c.length, name: b?.name, size: b?.blob.size, head }; }); log('pdf', pdf);
chk('強度計算書（PDF）を書き出せる', pdf.n === 1 && /強度計算書\.pdf$/.test(pdf.name) && pdf.size > 20000 && pdf.head === '%PDF-');
await page.click('#stLabels'); await page.waitForTimeout(500); await page.evaluate(() => { app.select(null); app.drawLevels(); }); await page.waitForTimeout(400); const u4 = await page.evaluate(() => ({ labels: document.querySelectorAll('.v-label.st-lbl').length, modal: !!document.querySelector('.st-modal'), text: document.querySelector('.v-label.st-lbl')?.textContent })); log('labels', u4);
chk('3D に判定の札が支持金具ごとに出て、描き直しても残る', u4.labels === 5 && !u4.modal && /強度 \d/.test(u4.text));
const u5 = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); const d = app.projectData(); await app.loadProjectData(JSON.parse(JSON.stringify(d))); const kept = app.project.strength?.floor; U.clearStrengthLabels(app); app.project.strength = null; return { kept, labels: document.querySelectorAll('.v-label.st-lbl').length, cmd: true }; }); log('persist', u5);
chk('条件は案件を開き直しても残り、札は消せる', u5.kept === 'top' && u5.labels === 0);
