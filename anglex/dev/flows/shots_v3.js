// 画面写真（v3）: 何もない画面 → 部材 → 選んで取っ手 → つまむ → 一覧 → 詳しい値 → 見え方 → 部材を足す → 見積 → 工場へ
// 全画面の撮影はヘッドレスでは 3D が写らないことがあるので、範囲を指定して撮る
const dir = process.env.SHOT_DIR || '/tmp'; const W = +(process.env.VW || 1440), H = +(process.env.VH || 900);
const shot = async n => { await page.evaluate(() => app.viewer.invalidate(2)); await page.waitForTimeout(900); await page.screenshot({ path: `${dir}/v3_${n}.png`, clip: { x: 0, y: 0, width: W, height: H } }); };
const clean = () => page.evaluate(() => { document.querySelectorAll('.modal-back,.v3-pop,.toast').forEach(m => m.remove()); });
// 入口: サインイン → ホーム → 開いている案件へ
await page.waitForSelector('.v3-entry[data-view="signin"].in'); await page.waitForTimeout(1500); await shot('e1_signin');
await page.click('#v3SignIn'); await page.waitForSelector('.v3-entry[data-view="home"].in .v3-proj'); await page.waitForTimeout(800); await shot('e2_home');
await page.click('.v3-proj.cur'); await page.waitForFunction(() => !document.querySelector('.v3-entry')); await page.waitForTimeout(600);
await page.evaluate(() => { localStorage.setItem('anglex.v3.hint', '0'); document.querySelectorAll('.modal-back').forEach(m => m.remove()); app.select(null); app.viewer.fit(); }); await page.waitForTimeout(1500);
await shot('01_home');
// 何もないとき
await page.evaluate(async () => { app._v3saved = app.projectData(); for (const i of [...app.model.instances]) app.removeInstance(i.id); }); await page.waitForTimeout(500); await shot('00_empty');
await page.evaluate(async () => { await app.loadProjectData(JSON.parse(JSON.stringify(app._v3saved))); app.viewer.fit(); }); await page.waitForTimeout(1500);
// 選ぶ → 輪と取っ手
await page.evaluate(async () => { localStorage.setItem('anglex.v3.hint', '9'); document.getElementById('v3Hint')?.remove(); const inst = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); app.select(inst.id); app.viewer.focusOn(app.groups.get(inst.id), { animate: false, fill: 0.45 }); for (let k = 0; k < 80 && document.querySelectorAll('.v3-hd').length < 2; k++) await new Promise(r => setTimeout(r, 100)); });
await page.waitForTimeout(800); await page.hover('.v3-hd[data-key="H"]').catch(() => { }); await shot('02_select');
// つまむ（高さ）
const hd = await page.$('.v3-hd[data-key="H"]') || await page.$('.v3-hd'); if (hd) { const bb = await hd.boundingBox(); const d = await page.evaluate(k => { const h = app.v3.handles.find(x => x.d.key === k) || app.v3.handles[0]; const { a, b } = h.screen; const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; }, 'H'); const x0 = bb.x + bb.width / 2, y0 = bb.y + bb.height / 2; await page.mouse.move(x0, y0); await page.mouse.down(); for (let k = 1; k <= 8; k++) { await page.mouse.move(x0 + d.x * k * 6, y0 + d.y * k * 6); await page.waitForTimeout(80); } await page.waitForTimeout(500); await shot('03_drag'); await page.mouse.up(); await page.waitForTimeout(800); await page.evaluate(() => document.querySelector('#btnUndo').click()); await page.waitForTimeout(600); }
// 一覧と詳しい値
await page.keyboard.press('l'); await page.waitForTimeout(400); await page.evaluate(() => { const i = app.model.instances.find(i => app.model.familyOf(i).id === 'portal_frame'); app.select(i.id); }); await page.keyboard.press('p'); await page.waitForTimeout(600); await shot('04_drawers');
await page.evaluate(() => document.body.classList.remove('v3-list', 'v3-props')); await page.waitForTimeout(300);
// 見え方
await page.click('#v3View'); await page.waitForTimeout(400); await shot('05_view'); await clean();
// 部材を足す（道具箱から）
await page.click('#v3Add'); await page.waitForSelector('.modal.partpicker .pk-card'); await page.waitForTimeout(1200); await shot('06_add'); await clean();
// 札（見積・工場へ）を開くと、ヘッドレスの全画面撮影では 3D が写らない。撮影用に、いまの 3D を画像にして下に敷く
const underlay = () => page.evaluate(() => { document.getElementById('shotBg')?.remove(); const url = app.viewer.screenshot(innerWidth, innerHeight); const img = document.createElement('img'); img.id = 'shotBg'; img.src = url; img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:1;pointer-events:none'; document.body.append(img); });
await page.evaluate(() => { app.select(null); app.viewer.fit(undefined, 1.35, { animate: false }); }); await page.waitForTimeout(800); await underlay();
// 見積
await page.evaluate(() => app.select(null)); await page.keyboard.press('e'); await page.waitForSelector('#v3Sheet.in'); await page.waitForTimeout(500); await shot('07_estimate');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
// 工場へ → まとめる
await page.keyboard.press('t'); await page.waitForSelector('#v3Sheet.in [data-fac]'); await page.waitForTimeout(400); await shot('08_factory');
await page.click('[data-act="pack"]'); await page.waitForSelector('#v3Done', { timeout: 120000 }); await page.waitForTimeout(800); await page.evaluate(() => { document.querySelector('#v3Sheet').scrollTop = 9999; }); await shot('09_factory_done');
