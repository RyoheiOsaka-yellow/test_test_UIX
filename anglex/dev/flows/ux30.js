// v2: 「部材を選ぶ」はサインインの画面では隠れ、サインイン後はどの画面（モード選択・案件一覧・チャット・3D）からでも開ける。3D でない画面から置くと 3D へ移る
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const vis = () => page.evaluate(() => { const b = document.querySelector('#btnParts'); return !!b && getComputedStyle(b).display !== 'none'; });
await page.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); for (const i of [...app.model.instances]) app.removeInstance(i.id); app.shell.showView('signin'); });
const atSignin = await vis(); const keyAtSignin = await page.evaluate(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })); await new Promise(r => setTimeout(r, 200)); return !!document.querySelector('.modal.partpicker'); });
await page.click('#smSignIn'); await page.waitForFunction(() => app.shell.view === 'modeselect');
const out = { atSignin, keyAtSignin, modeselect: await vis(), view0: await page.evaluate(() => document.body.dataset.smView) };
// モード選択の画面から選んで置く → 3D（手順 4）へ移り、部材が置かれる
await page.click('#btnParts'); await page.waitForSelector('.modal.partpicker .pk-card'); await page.click('.pk-ch[data-ch="4"]'); await page.click('.pk-card[data-pid="LIB04_01"]'); await page.waitForSelector('.pk-detail [data-act="place"]'); await page.click('.pk-detail [data-act="place"]');
await page.waitForFunction(() => app.model.instances.length === 1 && app.shell.view === 'app' && !document.querySelector('.modal.partpicker'));
out.fromMode = await page.evaluate(() => ({ view: app.shell.view, step: app.shell.step, fam: app.model.familyOf(app.model.instances[0]).id, appShown: !document.querySelector('#app').classList.contains('sm-hidden') }));
// 案件一覧・チャットの画面でも出ている。B キーで開く
for (const v of ['projects', 'chat']) { await page.evaluate(v => app.shell.showView(v), v); out[v] = await vis(); }
await page.evaluate(() => app.shell.showView('projects')); await page.keyboard.press('b'); await page.waitForSelector('.modal.partpicker'); out.keyOpens = true; await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
// 3D の画面: 案件進行のボタンがあり、開ける。コマンド検索にも出る
await page.evaluate(() => app.shell.enterApp(4)); out.app = await vis();
await page.evaluate(() => document.querySelector('#btnOrder').click()); await page.waitForSelector('.modal.order .order-step'); out.order = await page.evaluate(() => ({ steps: document.querySelectorAll('.order-step').length, badge: document.querySelector('#orderCnt')?.textContent })); await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(m => m.remove()));
await page.keyboard.press('Control+k'); await page.waitForSelector('.cmdk input'); await page.keyboard.type('案件進行'); await page.waitForTimeout(400); const c1 = await page.evaluate(() => [...document.querySelectorAll('.cmdk-row b')].map(x => x.textContent).slice(0, 2)); await page.keyboard.press('Escape'); await page.keyboard.press('Control+k'); await page.waitForSelector('.cmdk input'); await page.keyboard.type('部材を選ぶ'); await page.waitForTimeout(400); out.cmdk = { order: c1, parts: await page.evaluate(() => [...document.querySelectorAll('.cmdk-row b')].map(x => x.textContent).slice(0, 2)) }; await page.keyboard.press('Escape');
// デモ版の進め方: モード選択の画面から「案件の進行を見る」を押すと、3D へ移って開く
out.demo = await page.evaluate(async () => { const D = await import('./js/ui/demo.js'); globalThis.ANGLEX_DEMO = true; D.initDemo(app); app.shell.showView('modeselect'); D.openDemoGuide(app); document.querySelector('.demo-step[data-step="order"] [data-act="try"]').click(); await new Promise(r => setTimeout(r, 700)); const r = { view: app.shell.view, order: !!document.querySelector('.modal.order'), note: document.querySelector('#smAuthNote')?.textContent.slice(0, 12) }; document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.shell.showView('signin'); r.badgeBtnsHidden = getComputedStyle(document.querySelector('#btnDemoGuide')).display === 'none'; localStorage.removeItem('anglex.demo.done'); localStorage.removeItem('anglex.demo.seen'); globalThis.ANGLEX_DEMO = false; globalThis.__anglexDemo = false; document.querySelector('#demoBadge')?.remove(); app.shell.enterApp(4); return r; });
log('v2 picker', out);
const chk = (name, ok) => console.log('CHECK ' + JSON.stringify({ name, ok: !!ok }));
chk('サインインの画面では出ない（ボタンも B キーも）', out.atSignin === false && out.keyAtSignin === false);
chk('サインイン後は、モード選択・案件一覧・チャット・3D のどれでも出る', out.modeselect && out.projects && out.chat && out.app && out.keyOpens);
chk('3D でない画面から置くと、3D（手順 4）へ移って置かれる', out.fromMode.view === 'app' && out.fromMode.step === 4 && out.fromMode.fam === 'floor_band' && out.fromMode.appShown);
chk('案件進行のボタンとコマンド検索', out.order.steps === 9 && out.cmdk.order[0] === '案件進行' && out.cmdk.parts[0] === '部材を選ぶ');
chk('デモ版: 進め方から案件進行が開く。サインインの画面では案内のボタンを隠す', out.demo.view === 'app' && out.demo.order && out.demo.badgeBtnsHidden);
// 強度計算: v2 の 3D の道具にボタンがあり、一覧が開く
const st2 = await page.evaluate(async () => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); const b = document.getElementById('btnStrength'); b.click(); await new Promise(r => setTimeout(r, 500)); const o = { btn: !!b, n: app.model.instances.length, modal: !!document.querySelector('.st-modal'), rows: document.querySelectorAll('.st-modal .st-list tbody tr').length, msg: /計算できる支持金具がありません/.test(document.querySelector('.st-modal')?.textContent || '') }; document.querySelectorAll('.modal-back').forEach(m => m.remove()); return o; });
console.log('strength-v2:', JSON.stringify(st2)); chk('強度計算（v2）: ボタンから開く。計算できる金具がなければ、その旨を出す', st2.btn && st2.modal && (st2.rows >= 1 || st2.msg));
