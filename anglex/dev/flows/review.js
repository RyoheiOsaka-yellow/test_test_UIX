const clickText = (txt, root = '.modal-back:last-of-type') => page.evaluate(([t, r]) => { const scope = r ? document.querySelector(r) || document : document; const el = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === t || b.textContent.includes(t)); if (!el) throw new Error('no button ' + t); el.click(); }, [txt, root]);
const clickSel = sel => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no ' + s); el.click(); }, sel);
// 確認アラート / 溶接指示 / 穴あけ指示 / ズレ補正 / 作業保存
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 1) デモ DXF を読み込んで配置 → 読込由来インスタンスに確認事項が付く
await page.evaluate(() => document.querySelector('#btnDemoDxf').click()); await page.waitForTimeout(1500);
await page.evaluate(() => (document.querySelector('#recHost .rec-actions .btn.primary') || document.querySelector('.modal-back:last-of-type .modal-foot .btn.primary')).click()); await page.waitForTimeout(1500);
log('STATUS', await page.$eval('#statusWarn', e => e.textContent));
log('IMPORTED', await page.evaluate(() => app.model.instances.map(i => ({ mark: i.mark, src: i.source, st: i.status, reasons: (i.reviewReasons || []).length }))));
log('FLAGS', await page.evaluate(() => [...document.querySelectorAll('.v-label.alert')].map(e => e.textContent)));
// 2) 1 体目を選択 → プロパティの確認事項
await page.evaluate(() => { const i = app.model.instances.find(x => x.source === 'import' && app.model.familyOf(x).id === 'member'); window.__sel = i.id; app.select(i.id); app.shell?.goStep(4); }); await page.waitForTimeout(400);
log('SEL', await page.evaluate(() => { const i = app.model.getInstance(window.__sel); return [i.mark, i.status, i.reviewReasons]; }));
log('REVIEW ITEMS', await page.$$eval('#props .rv-item', els => els.map(e => e.querySelector('.rv-kind').textContent + ' / ' + e.querySelector('.rv-label').textContent + ' [' + e.className.replace('rv-item ', '') + ']')));
// 3) 溶接指示（単材: 両端全周 6 現場）
await clickText('溶接指示', '#props'); await page.waitForTimeout(300);
await page.selectOption('.modal select >> nth=0', 'both'); await page.selectOption('.modal select >> nth=1', 'site'); await clickSel('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(1200);
log('WELDS PARAM', await page.evaluate(() => app.model.getInstance(window.__sel).params.welds));
log('WELD PARTS', await page.evaluate(() => { const ps = app.instanceParts(app.model.getInstance(window.__sel)).filter(p => p.kind === 'weld'); return { n: ps.length, site: ps.filter(p => p.site).length, L: Math.round(ps.reduce((a, p) => a + p.length, 0)), sym: ps[0]?.symbol }; }));
// 4) 穴あけ指示（φ15 ×3 @100 端から 50）
await clickText('穴あけ指示', '#props'); await page.waitForTimeout(300);
await page.fill('.modal input[type=number] >> nth=0', '15'); await page.fill('.modal input[type=number] >> nth=1', '3'); await clickSel('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(1200);
log('HOLES PARAM', await page.evaluate(() => app.model.getInstance(window.__sel).params.holes));
log('HOLES PARTS', await page.evaluate(() => app.instanceParts(app.model.getInstance(window.__sel)).filter(p => p.holes)[0]?.holes?.length));
log('REVIEW AFTER', await page.$$eval('#props .rv-item', els => els.map(e => e.querySelector('.rv-kind').textContent + ' [' + e.className.replace('rv-item ', '') + ']')));
log('STATUS2', await page.$eval('#statusWarn', e => e.textContent));
// 5) 確認リスト（全体）
await page.evaluate(() => document.querySelector('#btnAlerts').click()); await page.waitForTimeout(400);
log('ALERTS TITLE', await page.$eval('.modal .modal-title, .modal h3, .modal header', e => e.textContent).catch(() => '?'));
log('ALERT ROWS', await page.$$eval('.modal table.grid tbody tr', trs => trs.length));
await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.modal-back,.modal').forEach(e => e.remove())); await page.waitForTimeout(200);
// 6) ズレ補正: 門型架台 + 隙間 12mm の板、レベルずれ 40mm、extraHoles で板外の穴
await page.evaluate(() => { const m = app.model; const t = m.addType('plate', 'PL-9 150x150', { t: 9, W: 150, H: 150, cols: 2, rows: 2, pitchW: 100, pitchH: 100, holeD: 15 }); const a = m.addInstance(t.id, { pos: [2500, 0, 0] }); const b = m.addInstance(t.id, { pos: [2500, 9 + 12, 0] }); const c = m.addInstance(t.id, { pos: [3000, 1540, 0], params: { extraHoles: '0|face:z3 s7 d15' } }); app.rebuildAll(); app.refreshBrowser(); window.__ids = [a.id, b.id, c.id]; });
await page.waitForTimeout(600);
log('EXTRA HOLES', await page.evaluate(() => app.instanceParts(app.model.getInstance(window.__ids[2]))[0].holes.length));
await page.evaluate(() => document.querySelector('#btnAlign').click()); await page.waitForTimeout(500);
log('ALIGN ROWS', await page.$$eval('.modal table.grid tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].slice(0, 2).map(td => td.textContent.trim().slice(0, 60)).join(' | '))));
await clickText('すべて補正'); await page.waitForTimeout(1200);
log('ALIGN AFTER', await page.$$eval('.modal table.grid tbody tr, .modal .pp-empty', els => els.map(e => e.textContent.trim().slice(0, 60))));
log('POS AFTER', await page.evaluate(() => window.__ids.map(id => { const i = app.model.getInstance(id); return [i.pos, i.params.extraHoles || null]; })));
await page.evaluate(() => document.querySelectorAll('.modal-back,.modal').forEach(e => e.remove()));
// 7) 作業保存 → 変更 → 履歴から復元
await page.keyboard.press('Control+Shift+S'); await page.waitForTimeout(300);
await page.fill('.modal input >> nth=0', 'テスト保存1'); await clickSel('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(800);
log('SNAPS', await page.evaluate(() => (app.project.snapshots || []).map(s => [s.name, s.stats])));
await page.evaluate(() => { app.removeInstance(window.__sel); }); await page.waitForTimeout(300);
log('N BEFORE RESTORE', await page.evaluate(() => app.model.instances.length));
await page.evaluate(() => document.querySelector('#btnHistory').click()); await page.waitForTimeout(400);
log('HISTORY ROWS', await page.$$eval('.modal table.grid tbody tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].slice(0, 5).map(td => td.textContent.trim()).join(' | '))));
await page.evaluate(() => document.querySelector('.modal table.grid tbody tr button').click()); await page.waitForTimeout(300); await clickSel('.modal-back:last-of-type .modal-foot .btn.primary'); await page.waitForTimeout(1200);
log('N AFTER RESTORE', await page.evaluate(() => app.model.instances.length));
log('SNAPS2', await page.evaluate(() => (app.project.snapshots || []).map(s => s.name)));
// 8) 保存→再読込で snapshots が残るか
log('STORED', await page.evaluate(async () => { const p = await app.store.getProject(app.project.id); return (p.snapshots || []).length; }));
await page.evaluate(() => { app.select(app.model.getInstance(window.__sel).id); app.viewer.fit(app.groups.get(app.model.getInstance(window.__sel).id)); }); await page.waitForTimeout(800);
