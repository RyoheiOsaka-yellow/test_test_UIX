await page.click('#btnEstimate'); await page.waitForTimeout(600);
await page.click('text=モデルから見積を作成'); await page.waitForTimeout(1500);
page.once('dialog', d => d.accept());
await page.click('text=→ 販売（商社・代理店） へ渡す'); await page.waitForTimeout(400);
// 確認ゲート（未確認あり）→ 理由を付けて進める
if (await page.locator('.modal >> text=承知の上で受け渡し').count()) { await page.click('.modal >> text=承知の上で受け渡し'); await page.waitForTimeout(300); await page.fill('.modal textarea', '客先要望で先行'); await page.click('.modal-foot .btn.primary'); await page.waitForTimeout(400); }
await page.fill('.modal textarea', '利益率をお願いします'); await page.click('.modal-foot .btn.primary'); await page.waitForTimeout(800);
console.log('AFTER HANDOFF (A view):', (await page.textContent('.est-main')).slice(0, 200).replace(/\s+/g, ' '));
// B社へ切替
await page.evaluate(async () => { const m = document.querySelector('.modal-back'); m && m.remove(); await app.switchUser({ id: 'u_b1', name: '鈴木（B社 営業）', org: 'B', company: 'B社', email: 'b@example.com' }); });
await page.waitForTimeout(500); await page.click('#btnEstimate'); await page.waitForTimeout(800);
const bview = await page.textContent('.est-main'); console.log('B VIEW has 工場単価?', bview.includes('工場単価'), '| has 基準原価?', bview.includes('基準原価'), '| editable margin inputs:', await page.locator('.est-table input.cell-edit').count());
await page.locator('.est-table input.cell-edit').first().fill('25'); await page.locator('.est-table input.cell-edit').first().press('Tab'); await page.waitForTimeout(800);
console.log('B after edit:', (await page.textContent('.est-totals')).replace(/\s+/g, ' '));
await page.click('text=→ 加工工場 へ渡す'); await page.waitForTimeout(400); await page.click('.modal-foot .btn.primary'); await page.waitForTimeout(800);
await page.evaluate(async () => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); await app.switchUser({ id: 'u_c1', name: '佐藤（C社 工場）', org: 'C', company: 'C社', email: 'c@example.com' }); });
await page.waitForTimeout(500); await page.click('#btnEstimate'); await page.waitForTimeout(800);
const cview = await page.textContent('.est-main'); console.log('C VIEW has 販売単価?', cview.includes('販売単価'), '| has 工場単価?', cview.includes('工場単価'), '| inputs:', await page.locator('.est-table input.cell-edit').count());
await page.locator('.est-table input.cell-edit[type=number]').first().fill('21000'); await page.locator('.est-table input.cell-edit[type=number]').first().press('Tab'); await page.waitForTimeout(800);
console.log('C totals:', (await page.textContent('.est-totals')).replace(/\s+/g, ' '));
console.log('MODEL EDIT DISABLED for C:', await page.evaluate(() => document.querySelector('#btnCatalog').disabled));
console.log('AUDIT:', await page.evaluate(async () => { const es = await app.store.listEstimates(); return es[0].audit.map(a => a.org + ':' + a.action).join(' '); }));
