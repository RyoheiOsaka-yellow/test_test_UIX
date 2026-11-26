// マニュアル・操作説明用の画面写真（v1 / v2 / v3）。写真と、番号を付ける部品の位置（画面に対する割合）を書き出す
// 使い方: node dev/manual-shots.mjs v1|v2|v3 <出力フォルダ>
//   ヘッドレスでは全画面の撮影で 3D が写らないことがあるので、範囲を指定して撮る。札やダイアログの後ろの 3D は、撮影の直前の絵を敷いて写す
import pw from '/opt/node-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(new URL('..', import.meta.url).pathname); const ver = process.argv[2] || 'v1'; const out = path.resolve(process.argv[3] || 'docs/manual/shots'); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }); });
const PORT = 8240 + Math.floor(Math.random() * 40); await new Promise(r => server.listen(PORT, r));
const W = 1440, H = 900; const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, acceptDownloads: true }); await ctx.addInitScript(() => { window.__anglexNoGuide = true; try { localStorage.setItem('anglex.v3.hint', '9'); } catch { } });
const page = await ctx.newPage(); page.on('pageerror', e => console.log('[pageerror]', e.message));
const PAGE = { v1: '/index.html', v2: '/v2.html', v3: '/v3.html' }[ver];
await page.goto(`http://localhost:${PORT}${PAGE}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); await page.waitForTimeout(2000);
const meta = {}; const wait = ms => page.waitForTimeout(ms);
// 部品の位置: CSS セレクタ、'group:題名'（v1 のリボンの区切り）、'inst:符号'（3D の部材）、'text:文字'（その文字を含むボタン）
async function boxOf(sel) { return page.evaluate(sel => { let el = null; if (sel.startsWith('group:')) { const t = sel.slice(6); el = [...document.querySelectorAll('.rgroup')].find(g => g.querySelector('.rgroup-title')?.textContent.trim() === t); } else if (sel.startsWith('inst:')) { const inst = app.model.instances.find(i => i.mark === sel.slice(5)); const g = inst && app.groups.get(inst.id); const r = g && app.viewer.screenRect(g); const c = app.viewer.renderer.domElement.getBoundingClientRect(); return r ? { x: c.left + r.x0, y: c.top + r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 } : null; } else if (sel.startsWith('text:')) { const t = sel.slice(5); el = [...document.querySelectorAll('button,a,.v3-start,.v3-role,.sm-mode-card,label')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').find(e => e.textContent.replace(/\s+/g, '').includes(t.replace(/\s+/g, ''))); } else el = [...document.querySelectorAll(sel)].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel); }
async function shot(name, marks = [], { underlay = false } = {}) {
  await page.evaluate(() => { app.viewer?.invalidate?.(2); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await wait(900);
  const ms = []; for (const [n, sel, label, pos] of marks) { const b = await boxOf(sel); if (!b) { console.log('  marker not found', name, n, sel); continue; } const px = pos === 'tl' ? b.x + 8 : pos === 'tr' ? b.x + b.w - 8 : pos === 'l' ? b.x + 6 : b.x + b.w / 2; const py = pos === 'tl' || pos === 'tr' ? b.y + 8 : b.y + b.h / 2; ms.push({ n, label, x: +(Math.min(W - 14, Math.max(14, px)) / W * 100).toFixed(2), y: +(Math.min(H - 14, Math.max(14, py)) / H * 100).toFixed(2), box: [b.x / W * 100, b.y / H * 100, b.w / W * 100, b.h / H * 100].map(v => +v.toFixed(2)) }); }
  await page.screenshot({ path: path.join(out, `${ver}_${name}.png`), clip: { x: 0, y: 0, width: W, height: H } }); meta[name] = ms; console.log('shot', ver, name, ms.length); await page.evaluate(() => document.getElementById('shotBg')?.remove());
}
// 札・ダイアログの後ろの 3D を写すための下敷き
const underlay = () => page.evaluate(() => { document.getElementById('shotBg')?.remove(); if (!app.viewer) return; const url = app.viewer.screenshot(innerWidth, innerHeight); const img = document.createElement('img'); img.id = 'shotBg'; img.src = url; const c = app.viewer.renderer.domElement.getBoundingClientRect(); img.style.cssText = `position:fixed;left:${c.left}px;top:${c.top}px;width:${c.width}px;height:${c.height}px;z-index:1;pointer-events:none`; document.body.append(img); });
const closeAll = () => page.evaluate(() => { document.querySelectorAll('.modal-back,.cmdk-back,.v3-pop').forEach(m => m.remove()); });
const fit = () => page.evaluate(() => { app.select?.(null); app.viewer.fit(undefined, 1.3, { animate: false }); });

// 強度計算と加工の詳細（v1.1・v2.1・v3.1 で共通の画面）。門型架台 MF-1 を使う
async function extraShots() {
  await closeAll(); await page.evaluate(() => { document.querySelectorAll('.cmdk-back,.guide-ov').forEach(m => m.remove()); document.getElementById('v3Sheet')?.classList.remove('in'); app.project.strength = null; app.project.strengthRef = null; }); await fit(); await wait(700);
  const mf = await page.evaluate(() => app.model.instances.find(x => app.model.familyOf(x).id === 'portal_frame').id);
  // 強度計算の一覧
  await page.evaluate(async id => { const U = await import('./js/ui/strength.js'); U.openStrength(app, { instId: id }); }, mf); await page.waitForSelector('.st-modal .st-list tbody tr'); await wait(600);
  await shot('strength', [[1, '#stVerdict', '判定（OK か、NG が何件か）'], [2, '#stMax', 'いちばん厳しい所の検定比（1.00 以下で OK）'], [3, '#stQuick', '条件の切り替え（山形鋼の軸・吊りの金具の地震・負担する配管の長さ）'], [4, '.st-list', '金具ごとの検定比と判定。押すと下に内訳'], [5, '#stFix', '直し方の候補（検定比・重さ・金額の差）'], [6, '#stCmp', '計算書と比べる'], [7, '#stPdf', '強度計算書（PDF）']]);
  await closeAll();
  // NG を 3D に（地震時に負担する配管の長さを 12 m にして、NG を出す）
  await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); app.project.strength = { seismicSpan: 12 }; U.showStrengthLabels(app); app.select?.(null); }); await fit(); await wait(1400);
  await page.evaluate(() => { const ng = [...document.querySelectorAll('.v-label.alert')].find(e => /強度 NG/.test(e.textContent)); if (ng) ng.id = 'shotNgFlag'; const a = document.querySelector('.v-label.st-lbl.ng'); if (a) a.id = 'shotNgLbl'; const b = document.querySelector('.v-label.st-lbl.ok, .v-label.st-lbl.warn'); if (b) b.id = 'shotOkLbl'; });
  await shot('strength3d', [[1, '#shotNgLbl', '判定の札（赤は NG。押すと内訳が開く）'], [2, '#shotOkLbl', '緑は OK。部品も検定比で色分けされる'], [3, '#shotNgFlag', 'NG の場所の旗（確認リストにも入る）']]);
  await page.evaluate(async () => { const U = await import('./js/ui/strength.js'); U.clearStrengthLabels(app); app.project.strength = null; app.drawLevels?.(); });
  // 加工の詳細: 梁に寄って、加工を置く
  await page.evaluate(async id => { const U = await import('./js/ui/fab.js'); app.select?.(id); U.openFabEditor(app, { instId: id }); }, mf); await page.waitForSelector('#fabSvg'); await wait(900); await page.selectOption('#fabPart', { index: 2 }); await wait(1000);
  const put = async (tool, fx, fy) => { await page.evaluate(k => app.fab.pickTool(k), tool); await wait(200); const b = await (await page.$('#fabSvg')).boundingBox(); await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); await wait(700); };
  await put('hole', 0.24, 0.5); await put('window', 0.5, 0.5); await put('cope', 0.12, 0.42); await put('scallop', 0.9, 0.56);
  await page.evaluate(() => { app.fab.sel = null; app.fab.grp = 0; app.fab.render(); }); await wait(500);
  await shot('fab', [[1, '#fabPart', '加工する部品'], [2, '#fabFaces', '面（脚 A・脚 B、ウェブ・フランジなど）'], [3, '#fabGroups', '道具の組（穴 / 切欠き / 角・端 / 曲げ・指示）'], [4, '#fabTools', '道具: 押してから、図の置きたい所を押す'], [5, '#fabSvg', '面の展開図（ホイールで拡大。置いた加工はつまんで動かせる）'], [6, '#fabList', '加工の一覧（押すと図と 3D がその加工に寄る）'], [7, '#fabPdf', '指示書に書き出す（PDF）']]);
  // 型から足す → V カット曲げを 2 か所
  await page.evaluate(id => { app.model.updateInstance(id, { params: { fab: '[]', fabBent: '[]' } }); app.rebuildInstance(app.model.getInstance(id)); app.isolatePart({ instId: id, index: app.fab.pi }); app.fab.sel = null; app.fab.render(); }, mf); await wait(600);
  for (const x of [0.36, 0.64]) { await page.selectOption('#fabTpl', 'vbend'); await wait(300); const b = await (await page.$('#fabSvg')).boundingBox(); await page.mouse.click(b.x + b.width * x, b.y + b.height * 0.45); await wait(700); }
  await page.evaluate(() => { app.fab.sel = null; app.fab.render(); document.querySelector('.fab-body').scrollTop = 0; }); await wait(500);
  await shot('fabtpl', [[1, '#fabTpl', '型から足す（V カット曲げ・ボルト穴 2 個並びなど）'], [2, '#fabSaveTpl', '型に保存（この案件 / 自分）'], [3, '#fabCopy', 'ほかの部材へ写す'], [4, '#fabRatesBtn', '加工の単価'], [5, '#fabSvg', 'V 字切欠きが 2 か所に入った展開図']]);
  // 曲げた後の姿
  await page.click('#fabBentBtn'); await wait(1600); await page.evaluate(() => { document.getElementById('fabBent').scrollIntoView({ block: 'center' }); }); await wait(500);
  await shot('fabbent', [[1, '#fabBent', '曲げた後の姿: 横から見た線・区間の長さ・外形の寸法'], [2, '#fabBentBtn', '3D を曲げた後の形にする（もう一度押すと戻る）'], [3, '#fabPdf', '指示書には、曲げた後の図と寸法も入る']]);
  await page.evaluate(async id => { const U = await import('./js/ui/fab.js'); U.closeFabEditor(app); app.model.updateInstance(id, { params: { fab: '[]', fabBent: '[]' } }); app.rebuildInstance(app.model.getInstance(id)); app.select?.(null); }, mf); await wait(400);
}

if (ver === 'v1') {
  await fit(); await wait(800);
  await shot('main', [[1, '.topbar', '上の帯: 案件名・利用者・保存・画面の切り替え'], [2, '.ribbon', 'リボン: 機能のボタン（タブで切り替え）'], [3, '.side.left', 'プロジェクトブラウザ: 部材の一覧'], [4, '#viewport', '3D の画面'], [5, '.side.right', 'プロパティ: 選んだ部材の値'], [6, '#instrBox', '加工指示の入力欄'], [7, '.statusbar', '状態行: 部材の数・質量'], [8, '#btnParts', '部材を選ぶ（どこからでも開ける）']]);
  await shot('ribbon', [[1, 'group:配置', '配置: カタログ・ショールーム・線から組む'], [2, 'group:接合・加工', '接合・加工: 溶接・穴・指示入力'], [3, 'group:編集', '編集: 移動・回転・複製・削除・元に戻す'], [4, 'group:集計・見積', '集計・見積: 業務フロー・案件進行・見積'], [5, 'group:確認・補正', '確認・補正: 確認リスト・コメント'], [6, '.cmdk-open', 'コマンド検索（Ctrl + K）']]);
  await page.evaluate(() => { const i = app.model.instances.find(x => app.model.familyOf(x).id === 'portal_frame'); app.select(i.id); app.viewer.focusOn(app.groups.get(i.id), { animate: false, fill: 0.45 }); }); await wait(1200);
  await shot('select', [[1, 'inst:MF-1', 'クリックした部材（青く光る）'], [2, '.side.right', 'プロパティ: 寸法・仕様を変えると 3D がすぐ変わる'], [3, '.focus-pill', '寄っている部材の名前と、全体へ戻るボタン'], [4, '.side.left .tn.sel, .side.left .tn.leaf.on, .side.left .sel', '一覧でも同じ部材が選ばれる']]);
  await page.evaluate(() => app.select(null)); await fit(); await wait(600);
  await page.evaluate(() => app.openPartPicker()); await page.waitForSelector('.modal.partpicker .pk-card'); await page.click('.pk-ch[data-ch="3"]'); await page.click('.pk-card'); await wait(1500);
  await shot('picker', [[1, '.pk-side', '章で絞る'], [2, '.pk-bar input', '名前・サイズで探す'], [3, '.pk-card.sel', '部材を選ぶ'], [4, '.pk-detail select', 'サイズを選ぶ'], [5, '[data-act="place"]', '3D に置く']], { underlay: true }); await closeAll();
  await page.evaluate(() => { const i = document.getElementById('instrInput'); i.value = 'MF-1 に φ15 穴 2個 @100 端から50'; i.focus(); }); await wait(400);
  await shot('instr', [[1, '#instrInput', '日本語で加工指示を書く'], [2, '#instrRun', '実行'], [3, 'group:接合・加工', '接合（2 部材をクリック）・穴あけ']]);
  await page.evaluate(() => { document.getElementById('instrInput').value = ''; document.activeElement?.blur(); });
  await page.click('#btnAlerts'); await wait(1200); await shot('alerts', [[1, '.modal-back .modal', '確認すること（溶接・穴・アンカーなど）']]); await closeAll();
  await page.click('#btnFlow'); await page.waitForSelector('.modal.flow .flow-wrap > *'); await wait(800); await shot('flow', [[1, '.modal.flow .modal-body', '図面から確定までの段階と、次にやること']]); await closeAll();
  await page.click('#btnOrder'); await page.waitForSelector('.modal.order .order-step'); await wait(600); await shot('order', [[1, '.order-steps', '依頼から納品までの 9 段階'], [2, '.order-pane', 'いまの段階の確認と、次の一手'], [3, '.modal.order .tabs', '工場・変更と履歴・書類・全案件']]); await closeAll();
  await page.evaluate(() => document.getElementById('btnFormats').click()); await wait(1200); await shot('formats', [[1, '.modal-back .modal', '書き出しの形式（21 種類）と、読み込める形式（24 種類）']]); await closeAll();
  await page.keyboard.press('Control+k'); await page.waitForSelector('.cmdk input'); await page.keyboard.type('見積'); await wait(500); await shot('cmdk', [[1, '.cmdk input', 'やりたいことを言葉で探す'], [2, '.cmdk-row', 'Enter で実行']]); await page.keyboard.press('Escape');
  await extraShots();
}
if (ver === 'v2') {
  await page.evaluate(() => { localStorage.removeItem('anglex.v3.in'); app.shell.showView('signin'); }); await wait(800);
  await shot('signin', [[1, '#sm-inOrg', '会社・役割を選ぶ'], [2, '#sm-inBranch', '営業所'], [3, '#sm-inEmail', 'メール（デモは何でもよい）'], [4, '#smSignIn', 'サインイン']]);
  await page.click('#smSignIn'); await page.waitForFunction(() => app.shell.view === 'modeselect'); await wait(600);
  await shot('mode', [[1, '#smModeChat', 'かんたん見積: 会話で答えるだけ'], [2, '#smMode3D', '図面から加工指示: 5 つの手順で'], [3, '#smModeProjects', '顧客・案件の一覧へ'], [4, '#btnParts', '部材を選ぶ（どこからでも）']]);
  await page.click('#smModeProjects'); await wait(900); await shot('projects', [[1, '#sm-projGrid', '案件の一覧（クリックで開く）'], [2, '#smNewChat', '新しく見積の相談'], [3, '#smNewDrawing', '新しく図面から']]);
  await page.evaluate(() => app.shell.showView('chat')); await wait(1500); await shot('chat', [[1, '#sm-chatInner', 'ANGLEX の質問に、ボタンを押して答える'], [2, '#sm-chatField', '自由に書いてもよい'], [3, '#smChatTo3D', '3D で確かめる']]);
  await page.evaluate(() => app.shell.enterApp(1)); await wait(900);
  await shot('step1', [[1, '.wf-step[data-step="1"]', '手順 1〜5 の帯（いまの手順が黒）'], [2, '#btnDemoDxf', 'サンプル図面で試す'], [3, '#btnDemoModel', 'サンプルの 3D で試す'], [4, '#dropHint', 'ここに図面をドラッグして読み込む']]);
  await page.click('#btnDemoDxf'); await wait(1600); await shot('step2', [[1, '.wf-step[data-step="2"]', '手順 2: 読み込み・分析'], [2, '#alog', '図面を読み解いている途中の記録']]);
  await page.waitForFunction(() => /100%/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => { }); await wait(800); await page.evaluate(() => { app.shell.maxStep = Math.max(app.shell.maxStep || 0, 3); app.shell.goStep(3); }); await wait(1800);
  await shot('step3', [[1, '#drawing', '図面（見つけた部材に枠）'], [2, '#detectList', '見つけた部材の一覧（確かさの印つき）'], [3, '.wf-step[data-step="4"]', '次は手順 4 へ']]);
  await page.evaluate(() => document.getElementById('btnDemoModel').click()); await wait(2500); await page.evaluate(() => { app.shell.maxStep = 5; app.shell.goStep(4); app.select(null); app.viewer.fit(undefined, 1.3, { animate: false }); }); await wait(1500);
  await shot('step4', [[1, '.d3-toolbar', '道具: 配置・加工・表示・書出し・作業'], [2, '#d3stage', '3D の画面'], [3, '.detail-top, .detail-title', '選んだ部材の詳しい値'], [4, '#btnToQuote', '概算見積へ']]);
  await page.evaluate(() => app.shell.goStep(5)); await wait(1500); await shot('step5', [[1, '#estHost', '見積: A社 → B社 → C社 の受け渡しと出力'], [2, '.wf-step[data-step="5"]', '手順 5: 概算見積']]);
  await page.evaluate(() => app.shell.goStep(4)); await wait(1200); await extraShots();
}
if (ver === 'v3') {
  await page.waitForSelector('.v3-entry[data-view="signin"].in'); await wait(1500);
  await shot('signin', [[1, '.v3-roles', '役割を選ぶ（設計・販売・工場）'], [2, '[data-k="email"]', 'メール（デモは空でよい）'], [3, '#v3SignIn', 'はじめる']]);
  await page.click('#v3SignIn'); await page.waitForSelector('.v3-entry[data-view="home"].in .v3-proj'); await wait(800);
  await shot('home', [[1, '[data-start="new"]', '新しく作る'], [2, '[data-start="drawing"]', '図面から作る'], [3, '[data-start="sample"]', 'サンプルで試す'], [4, '.v3-proj', '続きから（案件の進みの輪つき）'], [5, '#v3SignOut', '役割を変える・サインアウト']]);
  await page.click('.v3-proj.cur'); await page.waitForFunction(() => !document.querySelector('.v3-entry')); await fit(); await wait(1200);
  await shot('work', [[1, '#v3Project', '案件のメニュー（ホーム・開く・書き出し）'], [2, '.v3-top', '探す・確認・コメント・使い方・利用者'], [3, '#v3Dock', '道具箱'], [4, '#v3Num', '質量と金額（押すと見積）'], [5, '#v3Send', '工場へ送る'], [6, '#v3Zoom', '寄る・引く・全体'], [7, '#v3ListTab', '部材の一覧']]);
  await page.evaluate(async () => { const i = app.model.instances.find(x => app.model.familyOf(x).id === 'portal_frame'); app.select(i.id); app.viewer.focusOn(app.groups.get(i.id), { animate: false, fill: 0.45 }); for (let k = 0; k < 80 && document.querySelectorAll('.v3-hd').length < 2; k++) await new Promise(r => setTimeout(r, 100)); }); await wait(800);
  await shot('select', [[1, '#v3Halo', '部材の上の輪: 符号・質量・金額と操作'], [2, '.v3-hd[data-key="H"]', '青い点（高さ）をつまむ'], [3, '.v3-hd[data-key="W"]', '青い点（幅）をつまむ']]);
  const hd = await page.$('.v3-hd[data-key="H"]'); if (hd) { const bb = await hd.boundingBox(); const d = await page.evaluate(() => { const h = app.v3.handles.find(x => x.d.key === 'H'); const { a, b } = h.screen; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; }); const x0 = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2; await page.mouse.move(x0, y0); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(x0 + d.x * k * 6, y0 + d.y * k * 6); await wait(80); } await wait(500); await shot('drag', [[1, '.v3-hd.drag', 'つまんで動かすと、値の札が付いてくる']]); await page.mouse.up(); await wait(800); await page.evaluate(() => document.querySelector('#btnUndo').click()); await wait(600); }
  await page.evaluate(() => { const i = app.model.instances.find(x => app.model.familyOf(x).id === 'portal_frame'); app.select(i.id); document.body.classList.add('v3-list', 'v3-props'); app.viewer.invalidate(); }); await wait(900);
  await shot('drawers', [[1, '.side.left', '部材の一覧（L）'], [2, '.side.right', '詳しい値（P）']]); await page.evaluate(() => document.body.classList.remove('v3-list', 'v3-props'));
  await page.click('#v3View'); await wait(500); await shot('view', [[1, '.v3-pop', '見え方: 材質・線あり・透かす・文字の札・断面・分解']]); await closeAll();
  await page.evaluate(() => app.select(null)); await fit(); await wait(800); await underlay(); await page.keyboard.press('e'); await page.waitForSelector('#v3Sheet.in'); await wait(600);
  await shot('estimate', [[1, '#v3EstTotal', '見積の金額'], [2, '[data-k="margin"]', '利益のつまみ'], [3, '.v3-bar', '内訳の帯'], [4, '.v3-row', '明細（押すとその部材へ）'], [5, '[data-act="est-pdf"]', '見積書 PDF']]);
  await page.keyboard.press('Escape'); await wait(400); await page.keyboard.press('t'); await page.waitForSelector('#v3Sheet.in [data-fac]'); await wait(500);
  await shot('factory', [[1, '[data-fac]', '送り先（加工内容に合う順）'], [2, '[data-pack]', '送るもの（押して選ぶ）'], [3, '.v3-field', '納期・ひとこと'], [4, '[data-act="pack"]', 'まとめて ZIP にする']]); await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await wait(500); await page.evaluate(() => document.getElementById('shotBg')?.remove()); await extraShots();
  await page.evaluate(() => document.getElementById('shotBg')?.remove());
}
fs.writeFileSync(path.join(out, `${ver}_marks.json`), JSON.stringify(meta, null, 1)); console.log('done', ver, Object.keys(meta).length);
await browser.close(); server.close();
