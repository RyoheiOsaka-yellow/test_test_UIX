const click = sel => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no ' + s); el.click(); }, sel);
const clickText = (txt, root = '.modal-back:last-of-type') => page.evaluate(([t, r]) => { const scope = r ? document.querySelector(r) || document : document; const el = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === t || b.textContent.includes(t)); if (!el) throw new Error('no button ' + t); el.click(); }, [txt, root]);
const fillLast = (sel, v) => page.evaluate(([s, val]) => { const el = document.querySelector('.modal-back:last-of-type ' + s); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) 穴位置の旗: デモ DXF を読み込んで配置 → 読込由来の単材の穴に旗
await page.evaluate(() => document.querySelector('#btnDemoDxf').click()); await page.waitForTimeout(1500);
await page.evaluate(() => (document.querySelector('#recHost .rec-actions .btn.primary') || document.querySelector('.modal-back:last-of-type .modal-foot .btn.primary')).click()); await page.waitForTimeout(1500); await page.evaluate(() => document.querySelector('#btn3d').click()); await page.waitForTimeout(300);
log('FLAGS', await page.evaluate(() => [...document.querySelectorAll('.v-label.alert')].map(e => e.textContent).filter(t => /穴/.test(t))));
log('HOLE POS', await page.evaluate(async () => { const m = await import('./js/bim/review.js'); const i = app.model.instances.find(x => x.source === 'import' && app.model.familyOf(x).id === 'member'); const pt = app.instanceParts(i)[0]; const h = pt.holes[0]; const p = m.holePos(pt, h); return { spec: pt.spec, L: pt.length, hole: [h.face, h.z, h.s], local: [p.x, p.y, p.z].map(v => Math.round(v * 10) / 10), instPos: i.pos }; }));
// 2) 部材長で密着: 単材 L-50x50x6 axis=y L=1488 @y=0（FL）, 板 @y=1500（サポート天端）, 隙間 12
await page.evaluate(() => { const m = app.model; const tm = m.addType('member', 'L-50x50x6 柱', { spec: 'L-50x50x6' }); const a = m.addInstance(tm.id, { pos: [4000, 0, 0], params: { L: 1488, axis: 'y' } }); const tp = m.addType('plate', 'PL-9 150x150', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 100, pitchH: 100, holeD: 15 }); const b = m.addInstance(tp.id, { pos: [4000, 1500, -100], level: 'L1' }); app.rebuildAll(); app.refreshBrowser(); window.__ab = [a.id, b.id]; });
await page.waitForTimeout(1500); log('FRAME', await page.evaluate(() => new Promise(r => { const t0 = performance.now(); requestAnimationFrame(() => r(Math.round(performance.now() - t0))); })));
await page.evaluate(() => document.querySelector('#btnAlign').click()); await page.waitForTimeout(500);
log('ALIGN ROWS', await page.$$eval('.modal table.grid tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim().slice(0, 70)).join(' | ')).filter(r => /4000|柱|長さ L/.test(r) || /隙間/.test(r))));
const row = page.locator('.modal table.grid tbody tr', { hasText: '長さ L' }); log('EXT ROW COUNT', await row.count());
if (await row.count()) { await page.evaluate(() => [...document.querySelectorAll('.modal table.grid tbody tr')].find(tr => tr.textContent.includes('長さ L')).querySelector('button').click()); await page.waitForTimeout(1000); }
log('L AFTER', await page.evaluate(() => { const i = app.model.getInstance(window.__ab[0]); return [i.params.L, app.model.resolved(i).L]; }));
log('ALIGN AFTER', await page.$$eval('.modal table.grid tbody tr', trs => trs.map(tr => tr.textContent.trim().slice(0, 60)).filter(r => /隙間/.test(r))));
await page.evaluate(() => document.querySelectorAll('.modal-back').forEach(e => e.remove()));
// 3) 受け渡しゲート
await click('#btnEstimate'); await page.waitForTimeout(600); await clickText('モデルから見積を作成', null); await page.waitForTimeout(1500);
log('EST HEAD CHIP', await page.$eval('.est-head', e => (e.textContent.match(/未確認 \d+/) || [''])[0]));
page.once('dialog', d => d.accept());
await clickText('→ 販売（商社・代理店） へ渡す', null); await page.waitForTimeout(400);
log('GATE TITLE', await page.$eval('.modal-back:last-of-type .modal-title', e => e.textContent));
await page.screenshot({ path: '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad/s12_gate.png' });
await clickText('キャンセル'); await page.waitForTimeout(300);
log('STILL A (cancel)', await page.evaluate(async () => (await app.store.listEstimates())[0].currentOrg));
await clickText('→ 販売（商社・代理店） へ渡す', null); await page.waitForTimeout(400);
await clickText('承知の上で受け渡し'); await page.waitForTimeout(300); await click('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(300);
log('EMPTY REASON BLOCKED', await page.evaluate(async () => (await app.store.listEstimates())[0].currentOrg));
await clickText('→ 販売（商社・代理店） へ渡す', null); await page.waitForTimeout(400);
await page.click('.modal >> text=承知の上で受け渡し'); await page.waitForTimeout(300); await fillLast('textarea', '客先要望で先行'); await click('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(400);
await fillLast('textarea', '利益率をお願いします'); await click('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(800);
log('AFTER OVERRIDE', await page.evaluate(async () => { const e = (await app.store.listEstimates())[0]; return [e.currentOrg, e.audit.filter(a => a.action === 'handoff').map(a => a.note)]; }));
