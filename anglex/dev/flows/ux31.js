// v3（空気のような画面）: 帯とパネルを出さない、道具箱・数字の札、選ぶと輪と取っ手、つまんで寸法、ホバー、見積の札、工場への ZIP
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
await page.evaluate(() => { localStorage.setItem('anglex.v3.hint', '9'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.select(null); app.viewer.fit(); }); await page.waitForTimeout(1200);
// (1) 画面の骨組み: v1 の帯・パネル・状態行は見えない。道具箱・右上・右下・左のつまみはある。3D は画面いっぱい
const r1 = await page.evaluate(() => { const vis = sel => { const e = document.querySelector(sel); if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && r.right > 0 && r.left < innerWidth; }; const c = app.viewer.renderer.domElement.getBoundingClientRect();
  return { ribbon: vis('.ribbon'), topbar: vis('.topbar'), status: vis('.statusbar'), left: vis('.side.left'), right: vis('.side.right'), dock: vis('#v3Dock'), top: vis('.v3-top'), num: vis('#v3Num'), send: vis('#v3Send'), tab: vis('#v3ListTab'), canvas: [Math.round(c.width), Math.round(c.height)], win: [innerWidth, innerHeight], dockButtons: document.querySelectorAll('#v3Dock .v3-btn').length, overlap: (() => { const bs = [...document.querySelectorAll('#v3Dock .v3-btn')].map(b => b.getBoundingClientRect()); for (let i = 1; i < bs.length; i++) if (bs[i].left < bs[i - 1].right - 1) return true; return false; })(), yen: document.querySelector('#v3Yen').textContent, count: document.querySelector('#v3Count').textContent, labels: ['chkTags', 'chkLevels', 'chkWeldSym', 'chkAlerts'].map(id => document.getElementById(id).checked) }; });
log('layout', r1);
chk('v1 の帯・パネル・状態行は出さず、3D が画面いっぱい', !r1.ribbon && !r1.topbar && !r1.status && !r1.left && !r1.right && r1.canvas[0] === r1.win[0] && r1.canvas[1] === r1.win[1]);
chk('道具箱・右上・数字の札・工場へ・一覧のつまみがあり、道具箱のボタンが重ならない', r1.dock && r1.top && r1.num && r1.send && r1.tab && r1.dockButtons >= 8 && !r1.overlap);
chk('数字の札に金額と部材の数、文字の札は既定で隠す', /^¥[\d,]+$/.test(r1.yen) && r1.count === '5' && r1.labels.every(x => x === false));
// (2) 選ぶ → 輪と取っ手（門型架台なら 幅 W と 高さ H）。文字の帯（コンテキストバー）は出ない
const id = await page.evaluate(async () => { const inst = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); app.select(inst.id); app.viewer.focusOn(app.groups.get(inst.id), { animate: false }); for (let k = 0; k < 100 && document.querySelectorAll('.v3-hd').length < 2; k++) await new Promise(r => setTimeout(r, 100)); await new Promise(r => setTimeout(r, 300)); return inst.id; });
const r2 = await page.evaluate(() => ({ halo: document.querySelector('#v3Halo').style.display, who: document.querySelector('#v3Halo .who b')?.textContent, keys: [...document.querySelectorAll('.v3-hd')].map(e => e.dataset.key), ctx: !!document.querySelector('.ctx-bar'), haloButtons: document.querySelectorAll('#v3Halo .v3-btn').length }));
log('select', r2); chk('選ぶと輪（符号・種類・操作 6 つ）と、幅・高さの取っ手が出る。文字の帯は出ない', r2.halo === 'flex' && /MF-1/.test(r2.who) && r2.keys.includes('W') && r2.keys.includes('H') && !r2.ctx && r2.haloButtons === 6);
// (3) つまむ: 幅 W を外へ。動かしている間はモデルに書かず、離したら 1 回だけ書く。元に戻すも 1 回
const yen0 = await page.evaluate(() => document.querySelector('#v3Yen').textContent); const undo0 = await page.evaluate(() => app.model._undo?.length ?? app.model.undoStack?.length ?? null);
const hd = await page.$('.v3-hd[data-key="W"]'); const bb = await hd.boundingBox(); const dv = await page.evaluate(() => { const h = app.v3.handles.find(x => x.d.key === 'W'); const { a, b } = h.screen; const L = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; });
const x0 = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2; await page.mouse.move(x0, y0); await page.mouse.down(); for (let k = 1; k <= 6; k++) { await page.mouse.move(x0 + dv.x * k * 5, y0 + dv.y * k * 5); await page.waitForTimeout(60); }
const mid = await page.evaluate(id => ({ model: app.model.resolved(app.model.getInstance(id)).W, label: document.querySelector('.v3-hd.drag .lb')?.textContent, controls: app.viewer.controls.enabled }), id);
await page.mouse.up(); await page.waitForTimeout(900);
const after = await page.evaluate(id => ({ W: app.model.resolved(app.model.getInstance(id)).W, override: app.model.getInstance(id).params?.W, yen: document.querySelector('#v3Yen').textContent, controls: app.viewer.controls.enabled }), id);
await page.evaluate(() => document.querySelector('#btnUndo').click()); await page.waitForTimeout(600); const undone = await page.evaluate(id => app.model.resolved(app.model.getInstance(id)).W, id);
log('drag', { mid, after, yen0, undone });
chk('つまんでいる間はモデルに書かず、値の札が出て、回転は止まる', mid.model === 500 && /W\s+[\d,]+ mm/.test(mid.label || '') && mid.controls === false);
chk('離すとこの部材だけの値として書き込み、金額が変わり、回転が戻る', after.W > 500 && after.override === after.W && after.W % 10 === 0 && after.yen !== yen0 && after.controls === true);
chk('元に戻すと 1 回で戻る', undone === 500);
// (4) ホバー: 部材の上で青い枠と名前の札
const pt = await page.evaluate(async () => { const THREE = await import('three'); app.select(null); app.viewer.fit(undefined, 1.35, { animate: false }); await new Promise(r => setTimeout(r, 300)); const inst = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); let m = null; app.groups.get(inst.id).traverse(o => { if (!m && o.userData?.part?.kind === 'member') m = o; }); const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).project(app.viewer.activeCamera); const r = app.viewer.renderer.domElement.getBoundingClientRect(); return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height }; });
await page.mouse.move(pt.x - 40, pt.y - 40); await page.mouse.move(pt.x, pt.y, { steps: 4 }); await page.waitForTimeout(500);
const hov = await page.evaluate(() => ({ tag: document.querySelector('.v3-hover-tag').textContent, box: !!app.v3.hoverBox, cursor: app.viewer.renderer.domElement.style.cursor })); log('hover', hov);
chk('部材の上にマウスを置くと、青い枠と名前の札が出る', /^MF-\d/.test(hov.tag) && hov.box && hov.cursor === 'pointer');
// (5) 見積の札: 利益のつまみで金額と右下の札が一緒に変わる。明細をクリックすると 3D のその部材へ
await page.mouse.move(5, 5); await page.keyboard.press('e'); await page.waitForSelector('#v3Sheet.in .v3-row');
const e0 = await page.evaluate(() => ({ total: document.querySelector('#v3EstTotal').textContent, rows: document.querySelectorAll('.v3-row').length, segs: document.querySelectorAll('.v3-bar i').length, raw: /colSpec|=/.test(document.querySelector('.v3-row .m').textContent) }));
await page.evaluate(() => { const s = document.querySelector('[data-k="margin"]'); s.value = 30; s.dispatchEvent(new Event('input')); });
const e1 = await page.evaluate(() => ({ total: document.querySelector('#v3EstTotal').textContent, chip: document.querySelector('#v3Yen').textContent }));
await page.click('.v3-row'); await page.waitForTimeout(500); const e2 = await page.evaluate(() => ({ sheet: !!document.querySelector('#v3Sheet'), sel: app.selection && app.model.getInstance(app.selection).mark }));
await page.evaluate(() => { const s = app.v3; s.margin = 15; localStorage.setItem('anglex.v3.margin', '15'); });
log('estimate', { e0, e1, e2 });
chk('見積の札: 金額・内訳の帯・明細（内部の書式は出さない）', /^¥[\d,]+$/.test(e0.total) && e0.rows === 4 && e0.segs >= 5 && !e0.raw);
chk('利益のつまみで札の金額と右下の金額が一緒に変わる', e1.total !== e0.total && e1.total === e1.chip);
chk('明細をクリックすると札が閉じて、その部材を選ぶ', !e2.sheet && /^MF-/.test(e2.sel || ''));
// (6) 工場へ: おすすめの工場、送るもの 6 つ、ZIP（送り状と 6 種類）、案件の進みに記録
const zipEntries = await page.evaluate(async () => { app.select(null); const m = await import('./js/ui/v3.js'); const got = await m.capture(async () => { m.openFactorySheet(app); await new Promise(r => setTimeout(r, 200)); document.querySelector('[data-act="pack"]').click(); for (let k = 0; k < 600 && !document.querySelector('#v3Done'); k++) await new Promise(r => setTimeout(r, 100)); });
  const zip = got.find(g => /送付資料\.zip$/.test(g.name)); if (!zip) return { error: 'no zip', got: got.map(g => g.name) }; const { unzipSync, strFromU8 } = await import('three/addons/libs/fflate.module.js'); const files = unzipSync(new Uint8Array(await zip.blob.arrayBuffer())); const names = Object.keys(files); const letter = strFromU8(files['送り状.txt']);
  const o = app.project.order; return { name: zip.name, names, letter: letter.split('\r\n').slice(0, 3), ext: [...new Set(names.map(n => n.split('.').pop()))].sort(), factory: o.factory?.name, ordered: o.stages.factory.manual?.ordered, work: o.stages.shop.manual?.workorder, last: o.history.slice(-1)[0].action, toasts: document.querySelectorAll('.toast').length }; });
log('factory', zipEntries);
chk('工場へ: ZIP に送り状・加工指示書・部品表・加工図・NC・IFC・検査記録シート', zipEntries.names?.length === 7 && ['dxf', 'ifc', 'pdf', 'txt', 'xlsx', 'zip'].every(x => zipEntries.ext.includes(x)) && /加工のお願い/.test(zipEntries.letter[0]));
chk('工場へ: 案件の進みに工場・注文・加工指示書を記録', !!zipEntries.factory && zipEntries.ordered && zipEntries.work && zipEntries.last === 'doc');
// (7) キーと引き出し、画面の切り替え先
const r7 = await page.evaluate(async () => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); const m = await import('./js/ui/v3.js'); document.getElementById('v3Sheet') && document.querySelector('.v3-sheet-back').click(); await new Promise(r => setTimeout(r, 300)); const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); key('l'); const list = document.body.classList.contains('v3-list'); key('p'); const props = document.body.classList.contains('v3-props'); key('l'); key('p'); const closed = !document.body.classList.contains('v3-list') && !document.body.classList.contains('v3-props');
  let target = null; const orig = Object.getOwnPropertyDescriptor(window, 'location'); try { app.save = async () => { }; const f = app.switchUI.toString(); target = /ANGLEX_\$\{want\}/.test(f) && /v3: 'v3\.html'/.test(f); } catch { } return { list, props, closed, target }; });
log('keys', r7); chk('L で一覧、P で詳しい値の引き出しが出入りする。v1・v2・v3 を行き来できる', r7.list && r7.props && r7.closed && r7.target);
