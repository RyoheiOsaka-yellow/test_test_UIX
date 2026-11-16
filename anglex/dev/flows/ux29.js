// 追加の部材（総合カタログ 1〜25 章）、部材えらび、案件進行（依頼から納品まで）、デモ版、質感の下ごしらえ
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.setView('3d'); });
// (1) 部材: すべての製品・すべてのサイズで部品が作れる。数値は有限で、質量は 0 以上。既定サイズは 3D の形になる
const r1 = await page.evaluate(async () => { const { CATALOG } = await import('./js/data/catalog.js'); const F = await import('./js/bim/families.js'); const C = await import('./js/ui/catalog.js'); const { resolveParams } = await import('./js/bim/params.js'); const B = await import('./js/bim/build.js'); const THREE = await import('three'); const W = await import('./js/bim/weight.js');
  const lib = CATALOG.products.filter(p => p.pid.startsWith('LIB')); const bad = []; let skus = 0, built = 0; const fams = new Set();
  for (const p of lib) { const fam = F.familyById(p.family); if (!fam) { bad.push(p.pid + ' no family'); continue; } fams.add(fam.id); for (const [i, sku] of p.skus.entries()) { skus++; try { const pp = C.productParams(p, sku); const parts = fam.parts(resolveParams(fam.params, pp.params), { model: { joints: [], instances: [] }, inst: {} }); if (!parts.length) bad.push(`${p.pid} ${sku.sku} empty`); for (const pt of parts) { const nums = [pt.mass, ...(pt.pl?.pos || []), ...(pt.pl?.basis || []).flat(), ...(pt.pts || []).flat(), ...(pt.profile || []).flat()].filter(v => v !== undefined); if (nums.some(v => !Number.isFinite(v))) bad.push(`${p.pid} ${sku.sku} ${pt.name} NaN`); if (pt.mass < 0) bad.push(`${p.pid} ${sku.sku} ${pt.name} mass<0`); } const sum = W.summarize(parts.filter(x => !x.ref)); if (!(sum.total > 0)) bad.push(`${p.pid} ${sku.sku} total ${sum.total}`); if (i === 0) { const g = B.buildInstance(parts, { lod: 300 }); const box = new THREE.Box3().setFromObject(g); if (box.isEmpty() || !Number.isFinite(box.getSize(new THREE.Vector3()).length())) bad.push(p.pid + ' no geometry'); else built++; g.traverse(o => o.geometry?.dispose()); } } catch (e) { bad.push(`${p.pid} ${sku.sku} ${e.message}`); } } }
  // 呼び径と外径が合っている（寸法表の誤記を呼び径で直したもの）
  const ub = lib.find(p => p.family === 'u_band'); const u200 = ub.skus.find(s => s.sku === '200A'); const stats = (await import('./js/ui/partPicker.js')).libraryStats();
  return { products: CATALOG.products.length, lib: lib.length, skus, built, families: F.FAMILIES.length, libFamilies: fams.size, chapters: CATALOG.chapters.length, bad: bad.slice(0, 8), badN: bad.length, u200: u200.params.od, stats, guess: lib.filter(p => p.shapeGuess).length }; });
log('library', r1);
// (2) 質感の下ごしらえ: 面取り、折り目つき法線、コンクリートは鋼材に数えない
const r2 = await page.evaluate(async () => { const B = await import('./js/bim/build.js'); const F = await import('./js/bim/families.js'); const { resolveParams } = await import('./js/bim/params.js'); const W = await import('./js/bim/weight.js'); const M = await import('./js/geo/materials.js'); const THREE = await import('three'); const out = {};
  const parts = id => { const fam = F.familyById(id); return fam.parts(resolveParams(fam.params, {}), { model: { joints: [], instances: [] }, inst: {} }); }; const count = (pt, lod) => { let n = 0; B.buildPart(pt, lod).traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return n; };
  const strap = parts('riser_band').find(p => p.custom === 'strap'); out.bevel = { lod200: count(strap, 200), lod300: count(strap, 300) };
  const unit = o => { let bad = 0, n = 0; o.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.normal; for (let i = 0; i < a.count; i++) { n++; const l = Math.hypot(a.getX(i), a.getY(i), a.getZ(i)); if (Math.abs(l - 1) > 0.02) bad++; } }); return { n, bad }; };
  out.normals = { strap: unit(B.buildPart(strap, 300)), lathe: unit(B.buildPart(parts('hopper')[0], 300)), pipe: unit(B.buildPart(parts('riser_band').find(p => p.kind === 'pipe'), 300)) };
  // 丸い管の法線は滑らか（同じ位置の頂点で、周方向に隣り合う面の法線が一致する）
  { const o = B.buildPart(parts('riser_band').find(p => p.kind === 'pipe'), 300); let mesh = null; o.traverse(m => { if (m.isMesh && !mesh) mesh = m; }); const p = mesh.geometry.attributes.position, nrm = mesh.geometry.attributes.normal; const map = new Map(); let split = 0, groups = 0; for (let i = 0; i < p.count; i++) { if (Math.abs(nrm.getZ(i)) > 0.5) continue; const k = `${Math.round(p.getX(i) * 50)},${Math.round(p.getY(i) * 50)},${Math.round(p.getZ(i) * 50)}`; const v = [nrm.getX(i), nrm.getY(i)]; const e = map.get(k); if (!e) { map.set(k, v); groups++; } else if (Math.hypot(e[0] - v[0], e[1] - v[1]) > 0.05) split++; } out.pipeSmooth = { groups, split }; }
  const blk = parts('base_block'); const s = W.summarize(blk); out.block = { other: s.other, steelNet: s.steelNet, total: s.total, nonSteel: blk[0].nonSteel === true };
  const ez = M.finishMaterial('EZ'); out.mat = { ezPhysical: ez.isMeshPhysicalMaterial === true, resin: M.finishMaterial('RESIN').isMeshPhysicalMaterial === true, rubberBump: !!M.finishMaterial('RUBBER').bumpMap, cast: !!M.finishMaterial('CAST').map };
  const T = await import('./js/ui/thumbs.js'); out.thumbKey = T.THUMB_STORE_KEY; return out; });
log('texture', r2);
// (3) 部材えらび: 右端のボタンから開き、探して、サイズを選び、3D に置く。リストでまとめて置く
await page.evaluate(() => { for (const i of [...app.model.instances]) app.removeInstance(i.id); });
await page.click('#btnParts'); await page.waitForSelector('.modal.partpicker .pk-card');
const r3a = await page.evaluate(() => ({ cards: document.querySelectorAll('.pk-card').length, chapters: document.querySelectorAll('.pk-ch').length, title: document.querySelector('.modal.partpicker .modal-title').textContent }));
await page.fill('.modal.partpicker input[type=search]', '立バンド 蝶番'); await page.waitForFunction(() => document.querySelectorAll('.pk-card').length <= 3);
await page.click('.pk-card[data-pid="LIB03_01"]'); await page.waitForSelector('.pk-detail [data-k="sku"]');
await page.selectOption('.pk-detail [data-k="sku"]', { label: '50A' }); await page.fill('.pk-detail [data-k="qty"]', '2'); await page.dispatchEvent('.pk-detail [data-k="qty"]', 'change');
await page.click('.pk-detail [data-act="place"]'); await page.waitForFunction(() => app.model.instances.length === 2 && !document.querySelector('.modal.partpicker'));
const r3b = await page.evaluate(() => { const i = app.model.instances[0]; const p = app.model.resolved(i); return { n: app.model.instances.length, fam: app.model.familyOf(i).id, od: p.od, t: p.t, B: p.B, bolt: p.bolt, style: p.style, mark: i.mark }; });
// リスト: 2 種類を入れて、まとめて置く（B キーで開く）
await page.keyboard.press('b'); await page.waitForSelector('.modal.partpicker .pk-card');
await page.click('.pk-ch[data-ch="11"]'); await page.click('.pk-card[data-pid="LIB11_01"]'); await page.waitForSelector('.pk-detail [data-act="add"]'); await page.click('.pk-detail [data-act="add"]');
await page.click('.pk-ch[data-ch="15"]'); await page.click('.pk-card[data-pid="LIB15_01"]'); await page.waitForFunction(() => document.querySelector('.pk-detail h3')?.textContent.includes('基礎ブロック')); await page.click('.pk-detail [data-act="add"]');
const badge = await page.evaluate(() => document.querySelector('#partsTrayN').textContent);
await page.click('[data-act="place-all"]'); await page.waitForFunction(() => app.model.instances.length === 4 && !document.querySelector('.modal.partpicker'));
const r3c = await page.evaluate(() => ({ fams: app.model.instances.map(i => app.model.familyOf(i).id), tray: app.partTray.length, badge: document.querySelector('#partsTrayN').textContent }));
log('picker', { ...r3a, placed: r3b, trayBadge: badge, after: r3c });
// (4) 案件進行のロジック
const r4 = await page.evaluate(async () => { const OD = await import('./js/core/order.js'); const O = await import('./js/ui/order.js'); const out = {}; const user = app.user();
  out.biz = { add: OD.addBizDays('2026-11-13', 1), back: OD.addBizDays('2026-11-16', -1), between: OD.bizDaysBetween('2026-11-13', '2026-11-20') };
  const easy = { parts: 4, steel: 3, welds: 0, weldLen: 0, holes: 4, miters: 0, maxLen: 900, mass: 12, galv: false, sus: false, custom: 0, bought: 1 }; const hard = { parts: 80, steel: 50, welds: 44, weldLen: 9000, holes: 70, miters: 8, maxLen: 6500, mass: 900, galv: true, sus: false, custom: 0, bought: 30 };
  out.diff = { easy: OD.difficulty(easy).cls, hard: OD.difficulty(hard).cls, hardScore: OD.difficulty(hard).score };
  const pe = OD.planSchedule({ start: '2026-11-16', cls: 'A', due: '2026-12-25' }), ph = OD.planSchedule({ start: '2026-11-16', cls: 'C', galv: true, due: '2026-12-04' }); out.plan = { easy: [pe.total, pe.finish, pe.ok, pe.slack], hard: [ph.total, ph.finish, ph.ok, ph.slack] };
  const o = OD.newOrder({ project: { client: '○○設備' }, user, need: easy, start: '2026-11-16' }); out.new = { no: /^J-\d{4}-\d{5}$/.test(o.no), stages: Object.keys(o.stages).length, first: o.stages.request.status, cur: OD.currentStage(o).id };
  // 確認が残っていると完了にできない。force で完了にすると履歴に残る。前の段階が終わっていないと先へ進めない
  const c1 = OD.completeStage(o, 'request', { user, checks: [{ ok: false, label: '希望納期が入っている' }] }); const c2 = OD.completeStage(o, 'spec', { user, checks: [] }); const c3 = OD.completeStage(o, 'request', { user, checks: [{ ok: false, label: '希望納期が入っている' }], force: true }); out.gate = { blocked: c1.ok === false, order: c2.ok === false, forced: c3.ok, next: c3.next, nextStatus: o.stages.drawing.status, hist: o.history[o.history.length - 1].action };
  OD.addChange(o, { user, what: '架台の高さを 100 mm 上げる', costDelta: 12000, dayDelta: 2 }); const d0 = o.stages.deliver.due; out.change = { n: o.changes.length, shifted: OD.bizDaysBetween(pe.stages.deliver.due, d0) };
  // 工場: 加工内容に合う順。めっきができない工場・長さが入らない工場は下に回る
  const recs = OD.recommendFactories(OD.SAMPLE_FACTORIES, hard, {}); out.fac = { first: recs[0].factory.id, firstOk: recs[0].ok, ng: recs.filter(r => !r.ok).map(r => r.factory.id), missF3: recs.find(r => r.factory.id === 'F3').miss.length }; const recsE = OD.recommendFactories(OD.SAMPLE_FACTORIES, easy, {}); out.facEasy = recsE.filter(r => r.ok).length;
  OD.chooseFactory(o, recs[0], { user }); OD.replan(o, { need: hard, user }); out.replan = { cls: o.difficulty.cls, factory: o.factory.name, makeDue: o.stages.make.due > o.stages.factory.due, late: OD.lateStages(o, '2099-01-01').length };
  // モデルから数える
  const need = O.orderNeed(app); out.need = { parts: need.parts, mass: Math.round(need.mass * 10) / 10 }; return out; });
log('orderLogic', r4);
// (5) 案件進行の画面: 開く → 依頼を入れる → 完了 → 工場を選ぶ → 書類 → 保存して開き直しても残る
await page.evaluate(() => { app.project.order = null; app.project.pins = []; });
await page.click('#btnOrder'); await page.waitForSelector('.modal.order .order-step');
const r5a = await page.evaluate(() => ({ steps: document.querySelectorAll('.order-step').length, sel: document.querySelector('.order-step.sel')?.dataset.stage, tabs: document.querySelectorAll('.modal.order .tab').length, badge: document.querySelector('#orderCnt')?.textContent }));
await page.fill('[data-req="customer"]', '○○設備工業'); await page.dispatchEvent('[data-req="customer"]', 'change'); await page.waitForSelector('.order-checks li.ok');
await page.fill('[data-req="due"]', '2027-03-31'); await page.dispatchEvent('[data-req="due"]', 'change'); await page.waitForFunction(() => document.querySelectorAll('.order-checks li.ok').length >= 2);
await page.check('[data-check="agreed"]'); await page.waitForFunction(() => document.querySelectorAll('.order-checks li.ok').length === 3);
await page.click('[data-act="complete"]'); await page.waitForFunction(() => document.querySelector('.order-step.sel')?.dataset.stage === 'drawing');
// 「図面共有」: 部材があり、未解決のコメントがないので完了にできる。「仕様整理」は手の確認が残るので、止められる
await page.click('[data-act="complete"]'); await page.waitForFunction(() => document.querySelector('.order-step.sel')?.dataset.stage === 'spec');
await page.click('[data-act="complete"]'); await page.waitForFunction(() => [...document.querySelectorAll('.modal-back')].length >= 2);
const warn = await page.evaluate(() => [...document.querySelectorAll('.modal-back')].pop().querySelector('.modal-body').textContent.slice(0, 60));
await page.evaluate(() => { const b = [...document.querySelectorAll('.modal-back')].pop(); [...b.querySelectorAll('button')].find(x => /キャンセル/.test(x.textContent)).click(); });
// 工場
await page.click('.modal.order .tab[data-tab="factory"]'); await page.waitForSelector('.order-fac');
const r5b = await page.evaluate(() => ({ facs: document.querySelectorAll('.order-fac').length, best: document.querySelector('.order-fac.best')?.dataset.fac, ng: document.querySelectorAll('.order-fac.ng').length }));
await page.click('.order-fac.best [data-act="choose"]'); await page.waitForSelector('.order-fac.chosen');
// 書類: 注文書・納品書・検収書・品質書類の一覧
const pdfs = await page.evaluate(async () => { const O = await import('./js/ui/order.js'); const P = await import('./js/ui/pdfgen.js'); const o = app.project.order; o.delivery = { date: '2027-03-30', receiver: '田中', accepted: true, note: '' }; const ctx = await O.orderContext(app); const got = []; const orig = URL.createObjectURL; const sizes = []; URL.createObjectURL = b => { sizes.push(b.size); return orig.call(URL, b); }; try { for (const f of [() => O.orderSheetPDF(app, o, ctx), () => O.deliveryNotePDF(app, o, ctx, false), () => O.deliveryNotePDF(app, o, ctx, true), () => O.qualityListPDF(app, o, ctx)]) got.push(await f()); } finally { URL.createObjectURL = orig; } return { ok: got, sizes }; });
// 保存 → 開き直し: 案件進行・コメント・許容差・検査の結果が残る（以前は、開き直すとコメントと許容差が消えていた）
const r5c = await page.evaluate(async () => { const P = await import('./js/ui/pins.js'); P.addPin(app, { text: '保存の確認', pos: [0, 0, 0] }); app.project.tolerances = { length: 3 }; app.project.inspection = { at: 1, file: 'x.xlsx', counts: { ok: 5, ng: 0, blank: 1 }, fails: [] }; document.querySelectorAll('.modal-back').forEach(m => m.remove()); await app.save(true); const d = await app.store.getProject(app.project.id); const no = app.project.order.no; await app.loadProjectData(JSON.parse(JSON.stringify(d))); const o = app.project.order; return { order: o?.no === no, factory: o?.factory?.name, customer: o?.request?.customer, done: Object.values(o.stages).filter(s => s.status === 'done').length, history: o.history.length, pins: app.project.pins.length, tol: app.project.tolerances?.length, insp: app.project.inspection?.counts?.ok, badge: document.querySelector('#orderCnt')?.textContent }; });
log('orderUI', { ...r5a, warn, fac: r5b, pdfs, reload: r5c });
// (6) デモ版: 印・進め方・感想メモ。PDF のフッターに「デモ版」が入る
const r6 = await page.evaluate(async () => { const D = await import('./js/ui/demo.js'); const out = { before: D.isDemo(), badge0: !!document.querySelector('#demoBadge') }; globalThis.ANGLEX_DEMO = true; out.on = D.initDemo(app); out.badge = !!document.querySelector('#demoBadge'); out.flag = globalThis.__anglexDemo === true; D.openDemoGuide(app); out.steps = document.querySelectorAll('.demo-step').length; document.querySelector('.demo-step[data-step="parts"] [data-act="try"]').click(); await new Promise(r => setTimeout(r, 300)); out.opensPicker = !!document.querySelector('.modal.partpicker'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); D.openDemoGuide(app); out.doneMark = document.querySelector('.demo-step[data-step="parts"]').classList.contains('done'); document.querySelectorAll('.modal-back').forEach(m => m.remove());
  D.openFeedback(app); document.querySelector('.demo-fb textarea').value = '部材の一覧が分かりやすい'; document.querySelector('[data-act="fb-add"]').click(); out.fb = JSON.parse(localStorage.getItem('anglex.demo.feedback')).length; document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const P = await import('./js/ui/pdfgen.js'); const bytes = await P.buildReport({ title: '試験', sections: [{ heading: 'a', text: 'b' }] }); out.pdf = bytes.length > 1000; localStorage.removeItem('anglex.demo.feedback'); localStorage.removeItem('anglex.demo.done'); localStorage.removeItem('anglex.demo.seen'); globalThis.ANGLEX_DEMO = false; globalThis.__anglexDemo = false; document.querySelector('#demoBadge')?.remove(); return out; });
log('demo', r6);
// 合否（dev/check-all.sh が "ok":true / "ok":false を数える）
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
chk('部材: 54 製品・596 サイズがすべて作れる', r1.lib === 54 && r1.skus === 596 && r1.built === 54 && r1.badN === 0);
chk('部材: 3D の型は 67 種類、U バンド 200A の外径は 216.3', r1.families === 67 && r1.u200 === 216.3);
chk('質感: 面取りで頂点が増え、法線は単位長、配管は滑らか', r2.bevel.lod300 > r2.bevel.lod200 && r2.normals.strap.bad === 0 && r2.normals.lathe.bad === 0 && r2.normals.pipe.bad === 0 && r2.pipeSmooth.split === 0);
chk('質感: コンクリートは鋼材に数えない、材質の作り直し', r2.block.other > 0 && r2.block.nonSteel && r2.mat.ezPhysical && r2.mat.resin && r2.mat.rubberBump && r2.mat.cast);
chk('部材えらび: 探して、サイズを選び、2 個置ける', r3b.n === 2 && r3b.fam === 'riser_band' && r3b.od === 60.5 && r3b.style === 'hinge');
chk('部材えらび: リストでまとめて置ける', badge === '2' && r3c.fams.includes('roller_hanger') && r3c.fams.includes('base_block') && r3c.tray === 0);
chk('案件進行: 営業日・難易度・期限', r4.biz.add === '2026-11-16' && r4.biz.back === '2026-11-13' && r4.biz.between === 5 && r4.diff.easy === 'A' && r4.diff.hard === 'C' && r4.plan.easy[2] === true && r4.plan.hard[2] === false);
chk('案件進行: 確認が残ると止まり、強行は履歴に残る。変更で期限が動く', r4.gate.blocked && r4.gate.order && r4.gate.forced && r4.gate.hist === 'complete-forced' && r4.change.shifted === 2);
chk('案件進行: 工場は加工内容に合う順', r4.fac.firstOk && r4.fac.ng.includes('F3') && r4.facEasy === 4 && r4.replan.cls === 'C');
chk('案件進行の画面: 9 段階、止める、工場を選ぶ', r5a.steps === 9 && r5a.tabs === 5 && /確認が残っています/.test(warn) && r5b.facs === 4);
chk('帳票: 注文書・納品書・検収書・品質書類の一覧', pdfs.ok.every(x => x === true) && pdfs.sizes.length === 4 && pdfs.sizes.every(x => x > 5000));
chk('保存 → 開き直しで、案件進行・コメント・許容差・検査の結果が残る', r5c.order && r5c.pins === 1 && r5c.tol === 3 && r5c.insp === 5 && r5c.customer === '○○設備工業' && !!r5c.factory);
chk('デモ版: 既定では出ない。印・進め方 5 手順・感想メモ', r6.before === false && r6.badge0 === false && r6.on && r6.badge && r6.steps === 5 && r6.opensPicker && r6.doneMark && r6.fb === 1 && r6.pdf);
