const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1480, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const url = 'file://' + path.resolve(process.argv[2]);
  await p.goto(url);
  await p.click('#l-demo');
  await p.waitForTimeout(700);
  const R = {};
  const ok = (k, cond, detail) => { R[k] = (cond ? 'PASS' : 'FAIL') + (detail ? ' | ' + detail : ''); };

  // ── ロジック単体 ──
  const logic = await p.evaluate(() => {
    const out = {};
    const mk = (addr, extra) => { const c = blankCase(Object.assign({ addr, chiban: '1番1', area: '500', purpose: 'sale', note: '', period: '', lat: null, lng: null }, extra || {})); return c; };
    // F1: 資料追加で人の判断が残る
    let c = mk('神奈川県川崎市川崎区貝塚一丁目');
    mergePart(c, { kind: '法人登記簿', corps: [{ name: '株式会社中島モーターサイクル', purpose: ['各種オートバイ及自動車の修理及び販売業'], est: '昭和31年9月15日', p: 5 }] }, 'A');
    mergePart(c, { kind: '既往報告書', verdict: { level: '低い', headline: 'x', text: 'x', p: 11 } }, 'R');
    finalizeCase(c);
    c.concerns[0].resolved = true; c.concerns[0].resolveNote = '事務所利用のみで整備作業は行っていない'; c.verdict = verdictOf(c); c.verdict.text = '手で直した所見'; c.verdictEdited = true;
    c.substances = ['Pb']; c.substancesManual = true; c.classification = { none: ['1番1'], low: [], high: [] };
    const d0 = c.diffs.length;
    mergePart(c, { kind: '住宅地図', maps: [{ y: 1965, w: '昭和40年', use: '山田商店', around: '住宅', src: '住宅地図①', p: 2 }] }, 'C');
    finalizeCase(c, true); finalizeCase(c, true);
    out.f1a = { kept: c.concerns[0].resolved === true, verdictText: c.verdict.text, subs: c.substances.join(), cls: c.classification.none.join(), diffsAdded: c.diffs.length - d0 };
    mergePart(c, { kind: '住宅地図', maps: [{ y: 1970, w: '昭和45年', use: '○○鍍金工業所', around: '住宅', src: '住宅地図②', p: 3 }] }, 'C');
    finalizeCase(c, true); finalizeCase(c, true);
    out.f1 = { kept: c.concerns[0].resolved === true && c.concerns[0].resolveNote.indexOf('事務所') === 0, concerns: c.concerns.map(x => x.industry + ':' + !!x.resolved + ':' + !!x.pending), verdict: c.verdict.level, subs: c.substances, cls: c.classification, diffsAdded: c.diffs.length - d0, diffTexts: c.diffs.map(x => x.text.slice(0, 40)) };
    // F2/F6: 根拠チップ
    c = mk('東京都葛飾区金町六丁目'); c.docs = [{ id: 'R', kind: '既往報告書', cls: '本文', name: 'r.pdf', pages: '' }, { id: 'A', kind: '登記簿謄本', cls: '一般公表資料', name: 'touki.pdf', pages: '' }];
    c.source = { file: 'r.pdf', overviewP: null, lawsP: null };
    mergePart(c, { land: [{ chiban: '葛飾区金町六丁目 1番1', chimoku: '宅地', p: 3, rows: [{ date: '昭和40年1月1日', cause: '売買', holder: '甲' }] }] }, 'A');
    finalizeCase(c);
    const html = renderReport(c);
    const div = document.createElement('div'); div.innerHTML = html;
    out.f2 = [...div.querySelectorAll('#sec-22 .ev')].map(e => e.textContent + ' [doc=' + e.dataset.doc + ' p=' + e.dataset.p + ']');
    out.f6 = { sec11: div.querySelector('#sec-11 .ev') ? 'chip' : 'none', sec14: div.querySelector('#sec-14 .ev') ? 'chip' : 'none', lazy: html.indexOf('loading="lazy"') >= 0 };
    // F3: 診療所・「工業」だけでは所見を倒さない
    c = mk('大阪府大阪市東住吉区駒川一丁目');
    mergePart(c, { maps: [{ y: 1960, w: '昭和35年', use: '村田医院', around: '居宅', src: '住宅地図④', p: 2 }], land: [{ chiban: 'x 1番1', chimoku: '宅地', p: 1, rows: [{ date: '昭和40年1月1日', cause: '売買', holder: '山田工業株式会社' }] }] }, 'C');
    finalizeCase(c);
    out.f3 = { verdict: c.verdict.level, concerns: c.concerns.map(x => x.industry + ':' + !!x.pending), review: reviewItems(c).filter(r => r.area === '利用履歴').length, text: c.verdict.text.slice(0, 60) };
    // F7: ヒアリングの否定文
    c = mk('東京都渋谷区西原二丁目');
    mergePart(c, { hearing: [{ date: '令和6年6月20日', by: 'x', target: '所有者', text: '自動車の修理は行っておらず、駐車のみであった。', p: 7 }] }, 'PA');
    finalizeCase(c);
    out.f7 = { verdict: c.verdict.level, concerns: c.concerns.length, hint: reviewItems(c).filter(r => r.area === 'ヒアリング').map(r => r.text.slice(0, 50)) };
    // F4: 条例の副閾値
    const J = (addr, area, ch, fac, art) => { const x = mk(addr, { area: String(area) }); x.request = { purpose: 'develop', formChange: true, changeArea: ch }; x.regs.suidaku = { v: fac }; x.regs.gesui = { v: fac }; const r = judge(x).find(r => r.src === '条例' && r.art === art); return r ? r.st[1] : 'no row'; };
    out.f4 = {
      osaka_1200_fac: J('大阪府大阪市東住吉区駒川一丁目', 5000, 1200, 'あり', '第81条の5'), osaka_1200_nofac: J('大阪府大阪市東住吉区駒川一丁目', 5000, 1200, 'なし', '第81条の5'), osaka_3200: J('大阪府大阪市東住吉区駒川一丁目', 5000, 3200, 'なし', '第81条の5'),
      tokyo_site3200_ch200: J('東京都葛飾区金町六丁目', 3200, 200, 'なし', '第117条'), tokyo_site3200_ch500: J('東京都葛飾区金町六丁目', 3200, 500, 'なし', '第117条'), tokyo_site1000_fac: J('東京都葛飾区金町六丁目', 1000, 500, 'あり', '第117条'), tokyo_site1000_nofac: J('東京都葛飾区金町六丁目', 1000, 500, 'なし', '第117条'),
      yokohama_3500: J('神奈川県横浜市中区本町一丁目', 5000, 3500, 'なし', '第65条第1項'), yokohama_2500: J('神奈川県横浜市中区本町一丁目', 5000, 2500, 'なし', '第65条第1項'), yokohama_500_fac: J('神奈川県横浜市中区本町一丁目', 5000, 500, 'あり', '第65条第1項'), yokohama_500_nofac: J('神奈川県横浜市中区本町一丁目', 5000, 500, 'なし', '第65条第1項'),
    };
    // F10: 位置づけの文
    c = mk('東京都葛飾区金町六丁目', { area: '4000' }); c.request = { purpose: 'sale', formChange: true, changeArea: 3200 };
    out.f10 = positionText(c).slice(0, 120);
    return out;
  });
  ok('F1a 懸念のない資料の追加', logic.f1a.kept && logic.f1a.verdictText === '手で直した所見' && logic.f1a.subs === 'Pb' && logic.f1a.cls === '1番1' && logic.f1a.diffsAdded === 0, JSON.stringify(logic.f1a));
  ok('F1b 新しい懸念を含む資料の追加', logic.f1.kept && logic.f1.verdict === '否定できない' && logic.f1.subs.includes('Pb') && logic.f1.subs.includes('Cr6') && logic.f1.cls.none.join() === '1番1' && logic.f1.diffsAdded === 1, JSON.stringify(logic.f1).slice(0, 400));
  ok('F2 根拠チップの資料', logic.f2.some(t => /添付\(一般\)A 登記簿謄本 p\.3 \[doc=A p=3\]/.test(t)), JSON.stringify(logic.f2));
  ok('F6 固定ページなし', logic.f6.sec11 === 'none' && logic.f6.sec14 === 'none', JSON.stringify(logic.f6));
  ok('F3 診療所・工業', logic.f3.verdict === '低い' && logic.f3.review >= 1, JSON.stringify(logic.f3));
  ok('F7 否定文', logic.f7.verdict !== '否定できない' && logic.f7.concerns === 0, JSON.stringify(logic.f7));
  const f4 = logic.f4;
  ok('F4 副閾値', /900/.test(f4.osaka_1200_fac) && /非該当/.test(f4.osaka_1200_nofac) && /対象$/.test(f4.osaka_3200) && /300/.test(f4.tokyo_site3200_ch200) && /対象$/.test(f4.tokyo_site3200_ch500) && /900/.test(f4.tokyo_site1000_fac) && /非該当/.test(f4.tokyo_site1000_nofac) && /法第4条/.test(f4.yokohama_3500) && /対象$/.test(f4.yokohama_2500) && /下限なし/.test(f4.yokohama_500_fac) && /非該当/.test(f4.yokohama_500_nofac), JSON.stringify(f4));
  ok('F10 位置づけ', logic.f10.indexOf('義務によるものではない') < 0 && logic.f10.indexOf('第4条第1項') > 0, logic.f10);
  ok('F8 lazy除去', logic.f6.lazy === false);

  // ── F5: 画面操作（所見を手で直す → 物質を足す → 懸念を追加） ──
  await p.click('.crow[data-id="s-kanamachi"]');
  await p.waitForTimeout(500);
  await p.evaluate(() => { const el = document.querySelector('#paper [data-path="verdict.text"]'); el.focus(); el.innerText = '手で書き直した所見の本文。'; el.blur(); });
  await p.click('.tabs2 button[data-t=judge]');
  await p.click('#side .sb2[data-s="Pb"]');
  await p.selectOption('#j-ind', 'cleaning');
  await p.fill('#j-use', '○○クリーニング店');
  await p.click('#j-add');
  await p.waitForTimeout(300);
  const f5 = await p.evaluate(() => { const c = curCase(); return { text: c.verdict.text, subs: c.substances, concerns: c.concerns.length, paper: document.querySelector('#paper [data-path="verdict.text"]').innerText }; });
  ok('F5 手直しの保持', f5.text === '手で書き直した所見の本文。' && f5.paper === f5.text && f5.subs.includes('Pb') && f5.subs.includes('PCE') && f5.subs.includes('VC') && f5.concerns === 2, JSON.stringify(f5));

  // ── F8: PDF出力は画像の読み込み後に印刷 ──
  const f8 = await p.evaluate(() => new Promise(res => { let called = 0; window.print = () => { called++; const im = [...document.querySelectorAll('#printarea img')]; res({ called, imgs: im.length, complete: im.filter(i => i.complete).length }); }; document.getElementById('c-pdf').click(); setTimeout(() => res({ called, timeout: true }), 9000); }));
  ok('F8 印刷前に図を読込', f8.called === 1 && f8.imgs > 0 && f8.complete === f8.imgs, JSON.stringify(f8));

  // ── F9: 古いサンプルの差し替え ──
  await p.evaluate(() => { const cs = JSON.parse(localStorage.getItem('chireki.cases')); cs.forEach(c => { if (c.id === 's-kanamachi') c.title = '古いサンプル'; }); cs.push({ id: 'c-mine', sample: false, title: '自分の案件', site: { pref: '東京都', city: '港区', town: '', parcels: [], area: 0 }, org: { name: 'x', no: '', addr: '', tel: '' }, request: { purpose: 'sale' }, regs: { ord: [] }, updated: '2026-11-21' }); localStorage.setItem('chireki.cases', JSON.stringify(cs)); localStorage.setItem('chireki.samplesVer', '1'); });
  await p.reload();
  await p.waitForTimeout(800);
  const f9 = await p.$$eval('.crow .ct b', els => els.map(e => e.textContent));
  ok('F9 サンプルの版', !f9.includes('古いサンプル') && f9.includes('自分の案件') && f9.includes('東京都葛飾区金町六丁目地内'), JSON.stringify(f9));

  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
