// 開くたびにログイン画面から始まること（前回ログインした状態のブラウザでも）、ログアウトで戻れること
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const file = 'file://' + path.resolve(process.argv[2]);
  await p.goto(file);
  // 以前の版が残した「ログイン済み」の記録を再現する
  await p.evaluate(() => { localStorage.setItem('chireki.user', JSON.stringify({ mail: 'old@example.com', name: 'old' })); localStorage.setItem('chireki.lastMail', JSON.stringify('old@example.com')); });
  const R = {};
  const state = () => p.evaluate(() => ({ route: ST.route, form: !!document.getElementById('lf'), top: !document.getElementById('top').hidden, mail: (document.getElementById('l-mail') || {}).value, staleUser: localStorage.getItem('chireki.user') }));
  await p.reload(); await p.waitForTimeout(600); R.reopenWithOldSession = await state();
  await p.screenshot({ path: path.join(process.argv[3] || '.', 'signin.png') });
  await p.fill('#l-mail', 'tanaka@example.co.jp'); await p.fill('#l-pass', 'x'); await p.click('#lf button[type=submit]'); await p.waitForTimeout(700); R.afterSignIn = await state();
  await p.click('#b-new'); await p.waitForTimeout(300);
  await p.click('#logout'); await p.waitForTimeout(400); R.afterLogout = await state();
  await p.click('#l-demo'); await p.waitForTimeout(600); R.cases = await p.$$eval('.crow', e => e.length);
  const q = await ctx.newPage(); await q.goto(file); await q.waitForTimeout(600); R.newTab = await q.evaluate(() => ({ route: ST.route, form: !!document.getElementById('lf') }));
  await q.setViewportSize({ width: 400, height: 800 }); await q.click('#l-demo'); await q.waitForTimeout(600); R.mobileOverflow = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(JSON.stringify(R, null, 1)); console.log('ERRORS', errs);
  await b.close();
})();
