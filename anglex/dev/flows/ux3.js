const S = '/tmp/claude-0/-home-user-test-test-UIX/8bb357dc-bfe3-5217-a828-e2bc54d304f7/scratchpad'; const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
// 事前生成サムネイルの同梱: IndexedDB が空の初回起動でも即表示
log('IDB EMPTY', await page.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('anglex-thumbs', 1); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); if (!db) return 'no db'; const keys = await new Promise(r => { const q = db.transaction('thumbs').objectStore('thumbs').getAllKeys(); q.onsuccess = () => r(q.result); }); return keys.length === 0; }));
log('PRE', await page.evaluate(async () => { const m = await import('./js/data/thumbs_pre.js'); const t = await import('./js/ui/thumbs.js'); return { v: m.PRETHUMBS.v, key: t.THUMB_STORE_KEY, n: Object.keys(m.PRETHUMBS.t).length, match: m.PRETHUMBS.v === t.THUMB_STORE_KEY }; }));
const t0 = Date.now(); await page.evaluate(() => document.querySelector('#btnShowroom').click()); await page.waitForTimeout(150);
log('THUMBS 150ms', await page.evaluate(() => ({ rows: document.querySelectorAll('.sr-row').length, ok: document.querySelectorAll('.sr-thumb.ok').length, instant: document.querySelectorAll('.sr-thumb.instant').length })));
await page.waitForTimeout(600); await page.screenshot({ path: S + '/x5_showroom_prethumbs.png' });
log('GL', await page.evaluate(() => app.viewer.renderer.getContext().getError()));
