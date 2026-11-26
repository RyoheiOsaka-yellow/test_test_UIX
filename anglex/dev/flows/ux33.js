// 強度計算の追加分: コーン状破壊・ベースプレート・配管のほかの荷重（手計算と比較）→ すぐ切り替える条件 → 直し方の候補 → 計算書との突き合わせ（ダミー・Excel の読み込み）
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.abs(b) * tol;
await page.waitForFunction(() => window.app && app.model && app.model.instances.length, null, { timeout: 60000 });
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
// (1) 計算の中身を手計算と比べる: 角形鋼管の片持ち + アンカー 4 本 + ベースプレート
const r1 = await page.evaluate(async () => { const S = await import('./js/bim/strength.js'); const { place } = await import('./js/bim/families.js');
  const mem = { kind: 'member', name: '腕', spec: '□-50x50x2.3', length: 1000, pl: place([0, 25, -25], [1, 0, 0], [0, 0, 1]) }; /* 断面の中心が x 軸を通る（断面の y 軸は下向きになる置き方） */
  const hs = [[15, 15], [135, 15], [15, 135], [135, 135]].map(([s, z]) => ({ face: 'face', s, z, d: 14, kind: 'anchor' }));
  const plate = { kind: 'plate', name: 'ベースPL', spec: 'PL-9x150x150', length: 150, holes: hs, pl: place([0, -75, -75], [0, 0, 1], [0, 1, 0]) }; /* x = 0 の面に 150 角の板 */
  const anchors = [[60, 60], [60, -60], [-60, 60], [-60, -60]].map(([y, z]) => ({ kind: 'anchor', name: 'アンカー M12', M: 'M12', pl: place([0, y, z], [1, 0, 0], [0, 1, 0]) }));
  const pipe = { kind: 'pipe', ref: true, name: '配管 50A', spec: 'SGP-50A', nominal: '50A', od: 60.5, length: 400, pl: place([1000, 55, -200], [0, 0, 1], [0, 1, 0]) };
  const parts = [mem, plate, ...anchors, pipe]; const st = S.settingsOf({ strength: { seismic: false, span: 2 } }); const a = S.analyzeParts(parts, st); const pick = (res, kind) => res.items.find(i => i.kind === kind);
  const b = S.analyzeParts(parts, st, { extra: [{ name: 'ダクト', kg: 20, partIndex: 0, pos: 0.5 }] }); const c = S.analyzeParts(parts, S.settingsOf({ strength: { seismic: false, span: 2, edgeDist: 40 } })); const d = S.analyzeParts(parts, S.settingsOf({ strength: { seismic: false, span: 2, coneCheck: false, plateCheck: false } }));
  return { T: pick(a, 'anchorT'), cone: pick(a, 'anchorCone'), plate: pick(a, 'basePlate'), W: a.loads.pipe, self: a.loads.self, b: { total: b.loads.total, extra: b.loads.extra, extras: b.loads.extras, stress: pick(b, 'stress').sigma, T: pick(b, 'anchorT').value }, a: { stress: pick(a, 'stress').sigma, total: a.loads.total }, coneEdge: pick(c, 'anchorCone').limit, off: { cone: !!pick(d, 'anchorCone'), plate: !!pick(d, 'basePlate') } }; });
log('engine', r1);
const W = (5.31 + Math.PI / 4 * 52.9 ** 2 * 1e-6 * 1000) * 2 * 9.80665, self = 425e-6 * 7850 * 9.80665, M0 = W * 1000 + self * 500, T0 = M0 * 60 / (4 * 3600);
const Ac = Math.PI * 60 * (60 + 12), rp = Math.sqrt(Ac / Math.PI), kk = (0.5 * (1 + 120 / (2 * rp))) ** 2, cone = 1 / 3 * 0.31 * Math.sqrt(18) * Ac * kk;
chk('アンカーの引抜: M·d/Σd² = 約 0.68 kN/本（アンカー間隔 120 mm）', near(r1.T.value, T0 / 1000, 0.03));
chk('コーン状破壊: 許容 = 1/3 × 0.31√Fc × π·le·(le + d) × となりとの重なりの低減（長期）と合う', near(r1.cone.limit, cone / 1000, 0.02) && near(r1.cone.value, T0 / 1000, 0.03) && near(r1.cone.ratio, T0 / cone, 0.04));
{ const e = Math.hypot(60, 60) - 25, beff = Math.min(2 * e + 12, 150), sig = 6 * T0 * e / (beff * 81);
  chk('ベースプレートの曲げ: σ = 6·T·e/(b·t²)、許容 F/1.3 = 180.8 N/mm² と合う', near(r1.plate.value, sig, 0.04) && near(r1.plate.limit, 235 / 1.3, 0.01)); }
chk('配管のほかの荷重: 20 kg を腕の中央に足すと、荷重が 196 N 増え、根元の応力が (20·g·500)/Z だけ増える', r1.b.extra === Math.round(20 * 9.80665) && r1.b.total === r1.a.total + r1.b.extra && near(r1.b.stress - r1.a.stress, 20 * 9.80665 * 500 / (15.9e4 / 25), 0.03) && r1.b.extras[0].on === '腕' && r1.b.T > r1.T.value);
{ const z = await page.evaluate(async () => { const S = await import('./js/bim/strength.js'); const st = S.settingsOf({}); const parts = app.instanceParts(app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame')); const a = S.analyzeParts(parts, st), b = S.analyzeParts(parts, st, { extra: [{ name: 'd', kg: 0.001, partIndex: null, pos: 0.5 }] }), c = S.analyzeParts(parts, st, { extra: [{ name: 'd', kg: 30, partIndex: null, pos: 0.5 }] }); return { a: a.ratio, b: b.ratio, c: c.ratio, na: a.model.nodes, nb: b.model.nodes }; }); log('samepos', z);
  chk('配管と同じ位置に荷重を足しても骨組みが切れない（ほぼ 0 kg なら結果は変わらず、30 kg なら少しだけ上がる）', near(z.b, z.a, 0.001) && z.nb === z.na && z.c > z.a && z.c < z.a * 1.4); }
chk('へりあきを指定するとコーンの許容が下がり、照査は条件で止められる', r1.coneEdge < r1.cone.limit && !r1.off.cone && !r1.off.plate);
// (2) サンプルの案件: 門型にコーンとベースプレートの照査が入り、候補が出る
const r2 = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); app.project.strength = null; app.project.strengthRef = null; const M = U.strengthModel(app); const row = M.rows.find(r => app.model.familyOf(r.inst).id === 'portal_frame'); const kinds = [...new Set(row.res.items.map(i => i.kind))];
  const fixes = U.suggestFixes(app, row.inst, row.res); const next = U.nextSpecs('L-50x50x6', 3), nextC = U.nextSpecs('[-100x50x5x7.5', 2);
  return { id: row.inst.id, mark: row.inst.mark, ratio: row.res.ratio, kinds, fixes: fixes.map(f => ({ label: f.label, ratio: f.ratio, dMass: f.dMass, dPrice: f.dPrice, ov: f.override })), next, nextC, ng: M.ng.length }; });
log('fixes', r2);
chk('門型架台: コーン状破壊とベースプレートの曲げを照査する', r2.kinds.includes('anchorCone') && r2.kinds.includes('basePlate') && r2.kinds.includes('anchorT'));
chk('1 つ上のサイズ: L-50×50×6 の次は断面係数と重さが大きい山形鋼、溝形鋼も同じ書き方で出る', r2.next.length === 3 && /^L-/.test(r2.next[0]) && r2.next[0] !== 'L-50x50x6' && r2.nextC.length >= 1 && /^\[-/.test(r2.nextC[0]));
chk('直し方の候補: 決め手（アンカー）に効く案が出て、検定比が下がり、重さと金額の差が付く', r2.fixes.length >= 2 && r2.fixes.every(f => f.ratio < r2.ratio && Number.isFinite(f.dMass) && Number.isFinite(f.dPrice)) && r2.fixes.some(f => 'anchorM' in f.ov || 'anchorN' in f.ov));
// (3) 画面: すぐ切り替える条件
await page.click('#btnStrength'); await page.waitForSelector('.st-modal .st-list tbody tr'); await page.waitForTimeout(300);
const u0 = await page.evaluate(() => ({ max: document.querySelector('#stMax').textContent, quick: document.querySelectorAll('#stQuick select').length, fix: !!document.querySelector('#stFix table'), fixRows: document.querySelectorAll('#stFix tbody tr').length, hs: [...document.querySelectorAll('.st-list tbody tr')].find(t => /HS-1/.test(t.textContent)).querySelector('.st-badge').textContent }));
await page.selectOption('#stQAngle', 'geometric'); await page.waitForTimeout(300); const u1 = await page.evaluate(() => ({ max: document.querySelector('#stMax').textContent, saved: app.project.strength?.angleMethod, lb: [...document.querySelectorAll('.st-list tbody tr')].find(t => /MF-1/.test(t.textContent)).querySelector('.st-ratio b').textContent }));
await page.selectOption('#stQRod', 'true'); await page.waitForTimeout(300); const u2 = await page.evaluate(() => ({ hs: [...document.querySelectorAll('.st-list tbody tr')].find(t => /HS-1/.test(t.textContent)).querySelector('.st-badge').textContent, verdict: document.querySelector('#stVerdict').textContent }));
await page.selectOption('#stQRod', 'false'); await page.selectOption('#stQSpan', '12'); await page.waitForTimeout(300); const u3 = await page.evaluate(() => ({ max: document.querySelector('#stMax').textContent, span: app.project.strength?.seismicSpan, verdict: document.querySelector('#stVerdict').textContent }));
await page.selectOption('#stQSpan', ''); await page.selectOption('#stQAngle', 'principal'); await page.waitForTimeout(300);
log('quick', { u0, u1, u2, u3 });
chk('条件の切り替えが一覧の上に 3 つあり、選ぶとその場で計算し直して保存される', u0.quick === 3 && u1.saved === 'geometric' && u3.span === 12);
chk('吊ボルトの金具に水平力をかけると HS-1 が NG に変わり、負担する長さを 12 m にすると検定比が大きく上がる', u0.hs === 'OK' && u2.hs === 'NG' && /NG/.test(u2.verdict) && +u3.max > +u0.max * 1.5);
// (4) 直し方の候補を選ぶ → 金具が変わり、検定比が下がる
chk('検定比 0.8 以上の金具には、直し方の候補の表が最初から出る', u0.fix && u0.fixRows >= 2);
const before = await page.evaluate(id => ({ ratio: +document.querySelector('#stDetail h4 .st-badge').textContent.split(' ')[0], p: app.model.resolved(app.model.getInstance(id)), first: document.querySelector('#stFix tbody tr b').textContent }), r2.id);
await page.click('#stFix tbody tr:first-child button'); await page.waitForTimeout(800);
const after = await page.evaluate(id => ({ ratio: +document.querySelector('#stDetail h4 .st-badge').textContent.split(' ')[0], p: app.model.resolved(app.model.getInstance(id)), title: document.querySelector('#stDetail h4').textContent }), r2.id);
log('apply', { before: { ratio: before.ratio, first: before.first, anchorM: before.p.anchorM, anchorN: before.p.anchorN }, after: { ratio: after.ratio, anchorM: after.p.anchorM, anchorN: after.p.anchorN, title: after.title } });
chk('「この案にする」で金具の仕様が変わり、検定比が下がる', after.ratio < before.ratio && (after.p.anchorM !== before.p.anchorM || after.p.anchorN !== before.p.anchorN || after.p.colSpec !== before.p.colSpec || after.p.baseT !== before.p.baseT));
// (5) 配管のほかの荷重を画面から足す
await page.click('#stDetail .tab:nth-child(3)'); await page.waitForSelector('#stXAdd'); await page.fill('#stXName', 'ダクト'); await page.fill('#stXKg', '30'); await page.click('#stXAdd'); await page.waitForTimeout(600);
const x1 = await page.evaluate(id => { const U = app.model.getInstance(id); return { saved: U.params.stLoads, rows: document.querySelectorAll('#stExtra tbody tr').length }; }, r2.id); await page.click('#stDetail .tab:nth-child(3)'); await page.waitForTimeout(200); const x2 = await page.evaluate(() => ({ rows: document.querySelectorAll('#stExtra tbody tr').length, note: [...document.querySelectorAll('#stDetail .st-note')].map(n => n.textContent).find(t => /配管のほか/.test(t)) || '' })); log('extra', { x1, x2 });
chk('配管のほかの荷重を足すと金具に保存され、荷重の合計に入る', /ダクト/.test(x1.saved) && x2.rows === 1 && /配管のほか 294 N/.test(x2.note));
// (6) 計算書との突き合わせ: ダミーで試す → Excel を読み込む
await page.click('#stCmp'); await page.waitForSelector('#stCmpDummy'); await page.click('#stCmpDummy'); await page.waitForSelector('#stCmpTable tbody tr');
const c1 = await page.evaluate(() => ({ rows: document.querySelectorAll('#stCmpTable tbody tr').length, same: +document.querySelector('#stCmp_same').textContent, near: +document.querySelector('#stCmp_near').textContent, check: +document.querySelector('#stCmp_check').textContent, flip: +document.querySelector('#stCmp_flip').textContent, warn: document.querySelector('.st-cmp .st-warnbox')?.textContent || '', ref: app.project.strengthRef?.rows.length, dummy: app.project.strengthRef?.dummy, line: document.querySelector('#stCmpLine')?.textContent || '' })); log('cmp', c1);
chk('ダミーで試す: 全行を比べ、一致・近い・要確認に分け、ダミーであることを表示する', c1.rows >= 30 && c1.rows === c1.same + c1.near + c1.check + c1.flip && c1.dummy === true && /ダミー/.test(c1.warn) && c1.same > 0 && (c1.near + c1.check + c1.flip) > 0);
chk('突き合わせの結果が強度計算の画面にも 1 行で出る', /一致 \d+・近い \d+・要確認 \d+/.test(c1.line));
const c2 = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); const { loadXLSX } = await import('./js/ui/pdfgen.js'); const XLSX = await loadXLSX(); const d = U.dummyRef(app); const rows = d.rows.slice(0, 6).map((r, i) => [r.mark, r.part, r.label, r.unit, r.value, i === 0 ? 1.5 : r.ratio, i === 1 ? '' : '手計算']); rows.push(['ZZ-9', 'ない部位', 'ない項目', '', '', 0.5, '']); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['強度計算書（社内）'], [], ['符号', '部位', '項目', '単位', '計算書の値', '計算書の検定比', '備考'], ...rows]), '計算書'); const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const ref = await U.importRefFile(app, new File([buf], '社内の計算書.xlsx')); const c = U.compareRef(app); let bad = ''; try { const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'x'); await U.importRefFile(app, new File([XLSX.write(wb2, { type: 'array', bookType: 'xlsx' })], 'bad.xlsx')); } catch (e) { bad = e.message; }
  return { n: ref.rows.length, dummy: ref.dummy, name: app.project.strengthRef.name, matched: c.rows.length, missing: c.missing.length, flip: c.counts.flip, first: c.rows[0].status, bad, kept: (await (async () => { const dd = app.projectData(); return dd.strengthRef?.rows.length; })()) }; }); log('import', c2);
chk('Excel の計算書を読み込める: 見出しの行を探し、相手のない行と、判定が逆の行を分けて出す', c2.n === 7 && c2.dummy === false && c2.matched === 6 && c2.missing === 1 && c2.flip === 1 && c2.first === 'flip' && c2.name === '社内の計算書.xlsx');
chk('見出しのない表は理由を出して読み込まない。読み込んだ計算書は案件に保存される', /見出し/.test(c2.bad) && c2.kept === 7);
const pdf = await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); globalThis.__anglexCapture = []; await U.exportStrengthPdf(app); const c = globalThis.__anglexCapture; globalThis.__anglexCapture = null; return { n: c.length, size: c[0]?.blob.size }; }); log('pdf', pdf);
chk('計算書 PDF に、配管のほかの荷重と突き合わせの結果も入れて書き出せる', pdf.n === 1 && pdf.size > 20000);
await page.evaluate(id => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.project.strength = null; app.project.strengthRef = null; app.model.updateInstance(id, { params: { stLoads: '[]' } }); }, r2.id);
