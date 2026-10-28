const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const okDialog = (vals) => page.evaluate(vals => { const mb = document.querySelector('.modal-back:last-of-type'); const ins = [...mb.querySelectorAll('input, textarea')]; (vals || []).forEach((v, i) => { if (ins[i]) ins[i].value = v; }); mb.querySelector('.modal-foot .btn.primary').click(); }, vals);
// 1) ホットスポット: 支持金具を選ぶと近くの配管に ◎、配管を選ぶと支持金具に ⇣
await page.evaluate(() => { const hs = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_support'); app.select(hs.id); });
await page.waitForTimeout(200);
log('HOTSPOTS (support selected)', await page.evaluate(() => [...document.querySelectorAll('.v-label.hotspot')].map(e => e.textContent)));
log('HOTSPOT HOVER→GHOST', await page.evaluate(() => { const el = document.querySelector('.v-label.hotspot'); el.dispatchEvent(new Event('mouseenter')); const n = app.viewer.ghostRoot.children.length; el.dispatchEvent(new Event('mouseleave')); return { onEnter: n, onLeave: app.viewer.ghostRoot.children.length }; }));
await page.evaluate(() => { const hs = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_support'); app.viewer.focusOn(app.groups.get(hs.id), { animate: false }); app.viewer.invalidate(3); }); await page.waitForTimeout(400);
await page.screenshot({ path: S + '/y1_hotspots.png' });
log('HOTSPOT CLICK→ATTACH', await page.evaluate(() => { const hs = app.model.instances.find(i => app.model.familyOf(i).id === 'hanger_support'); const p0 = hs.pos.slice(); document.querySelector('.v-label.hotspot').click(); return { before: p0, after: app.model.getInstance(hs.id).pos, pipes: app.model.resolved(hs).pipes }; }));
// 配管（スリーブ）を選ぶと支持金具へのホットスポット
await page.evaluate(() => { const t = app.model.addType('sleeve', 'スリーブ SGP 100A', { nominal: '100A', L: 6000 }); const sl = app.model.addInstance(t.id, { pos: [-3000, 900, -2500], rot: [0, 0, Math.PI / 2] }); app.rebuildInstance(sl); app.select(sl.id); }); await page.waitForTimeout(300);
log('HOTSPOTS (pipe selected)', await page.evaluate(() => [...document.querySelectorAll('.v-label.hotspot')].map(e => e.textContent)));
// 2) 等ピッチ配置: MF-1 を 6m のスリーブに 2000mm ピッチで
const pr = page.evaluate(async () => { const mf = app.model.instances.find(i => i.mark === 'MF-1'); const sl = app.model.instances.find(i => app.model.familyOf(i).id === 'sleeve'); const n0 = app.model.instances.length; await app.arrayAlongPipe(mf.id, sl.id); const made = app.selectedIds().map(id => app.model.getInstance(id)); const tp = app.pipeRefsOf(sl)[0]; return { n0, n1: app.model.instances.length, made: made.map(i => [i.mark, i.pos.map(Math.round), app.model.resolved(i).pipes]), along: made.map(i => Math.round(new (app.viewer.controls.target.constructor)(...i.pos).sub(tp.center).dot(tp.axis))), total: document.querySelector('#statusModel').textContent }; });
await page.waitForTimeout(500); await okDialog(['2000', '3']); log('ARRAY ALONG PIPE', await pr);
await page.waitForTimeout(700); await page.screenshot({ path: S + '/y2_array.png' });
// 3) 業務フロー パネル
await page.evaluate(() => document.querySelector('#btnFlow').click()); await page.waitForTimeout(700);
log('FLOW', await page.evaluate(() => ({ steps: [...document.querySelectorAll('.flow-step')].map(e => e.className.replace('flow-step', '').trim() + ':' + e.textContent), cards: document.querySelectorAll('.flow-card').length, cur: document.querySelector('.flow-card.cur')?.dataset.k, weight: document.querySelector('.flow-card[data-k="weight"] .fc-kv.big b')?.textContent, bars: document.querySelectorAll('.fc-bar').length })));
await page.screenshot({ path: S + '/y3_flow.png' });
// 見積作成 → B社へ受け渡し（ゲート: 未確認があれば上書き）→ 共有リンク
await page.evaluate(() => [...document.querySelectorAll('.flow-card[data-k="estimate"] .btn')].find(b => b.textContent.includes('モデルから見積を作成')).click()); await page.waitForTimeout(900);
log('FLOW AFTER ESTIMATE', await page.evaluate(() => ({ cur: document.querySelector('.flow-card.cur')?.dataset.k, est: document.querySelector('.flow-card[data-k="estimate"] .fc-kv b')?.textContent, price: document.querySelector('.flow-card[data-k="estimate"] .fc-kv.big b')?.textContent, shareBtns: [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].map(b => b.textContent) })));
await page.evaluate(() => [...document.querySelectorAll('.flow-card[data-k="share"] .fc-actions .btn')].find(b => b.textContent.includes('B社')).click()); await page.waitForTimeout(400);
// ゲート（未確認あり）→ 「承知の上で進める」= danger ボタン → 理由入力
log('GATE', await page.evaluate(() => { const mb = document.querySelector('.modal-back:last-of-type'); return mb?.querySelector('.modal-title')?.textContent; }));
await page.evaluate(() => { const mb = document.querySelector('.modal-back:last-of-type'); const d = mb.querySelector('.modal-foot .btn.danger'); if (d) d.click(); }); await page.waitForTimeout(300);
log('GATE 2', await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-title')?.textContent));
await okDialog(['工場と調整済み']); await page.waitForTimeout(300);
log('HANDOFF MSG', await page.evaluate(() => document.querySelector('.modal-back:last-of-type .modal-title')?.textContent));
await okDialog(['B社 田中さん、確認お願いします']); await page.waitForTimeout(800);
log('FLOW AFTER HANDOFF', await page.evaluate(() => ({ cur: document.querySelector('.flow-card.cur')?.dataset.k, org: document.querySelector('.flow-org.cur b')?.textContent, links: [...document.querySelectorAll('.flow-link')].map(l => l.querySelector('.chip').textContent + ' ' + l.querySelector('code').textContent.slice(-20)), note: document.querySelector('.flow-card[data-k="share"] .fc-head .muted')?.textContent })));
await page.screenshot({ path: S + '/y4_flow_shared.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
