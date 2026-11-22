// 指定区域の公表台帳との照合の確認（registry/zones.json を埋め込んだ index.html が対象。無い場合は照合なしの動作だけ確認）
// 使い方: node tests/zones.js index.html [出力先dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[3] || '.';
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.goto('file://' + path.resolve(process.argv[2]));
  await p.click('#l-demo');
  await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const mk = (addr, lat, lng) => { const c = blankCase({ addr, chiban: '1番', area: '500', purpose: 'sale', changeArea: '', note: '', period: '', lat, lng }); finalizeCase(c); const g = c.regs, za = g.zoneAuto; return { src: za ? za.name.slice(0, 12) + ' ' + za.updated : null, art6: g.art6 || null, jin: g.art11jin || null, shizen: g.art11shizen || null, umetate: g.art11umetate || null, ord: (g.ord || []).map(o => o.item + '=' + o.v + (o.auto ? '(自動)' : '')), zoneSrc: g.zoneSrc || null, radius: g.radius || null, hits: za ? za.hits.length : null, top: za ? za.hits.slice(0, 4).map(h => h.k + (h.sub ? '/' + h.sub : '') + ' ' + h.city + h.town + ' ' + h.no + ' ' + (h.same ? '同町' : '') + (h.d != null ? h.d + 'km' : '')) : null, gapZone: gapsOf(c).some(x => x.k === 'zone'), j611: judge(c).filter(r => /第6条/.test(r.art)).map(r => r.st[1])[0], review: reviewItems(c).filter(r => r.area === '指定区域').map(r => r.text.slice(0, 60)) }; };
    return {
      zones: { checkedOn: ZONES.checkedOn, sources: ZONES.sources.map(s => s.id + ' ' + s.updated + ' ' + s.rows + '行'), rows: ZONES.rows.length, geo: ZONES.rows.filter(r => r.lat).length },
      nagoyaAtsuta: mk('愛知県名古屋市熱田区六番一丁目', 35.125168, 136.887512),
      nagoyaMinato: mk('愛知県名古屋市港区七番町四丁目', 35.1087, 136.8853),
      tokyoToyo: mk('東京都江東区東陽五丁目', 35.6712, 139.8176),
      tokyoNoPos: mk('東京都江東区東陽五丁目', null, null),
      tokyoOgasawara: mk('東京都小笠原村父島字東町', 27.0946, 142.1918),
      hachioji: mk('東京都八王子市元本郷町三丁目', 35.6664, 139.316),
      osaka: mk('大阪府大阪市東住吉区駒川一丁目', 34.619, 135.533),
      normTown: [normTown('東陽５丁目'), normTown('金町 六丁目'), normTown('大字茶屋新田字ろの割'), normTown('霞ケ関一丁目')],
    };
  });
  // 紙面：名古屋の資料なしの案件を作り、2.4.3 の表示を確認
  await p.evaluate(() => { ST.files = []; ST.draft = Object.assign({ geoTitle: '' }, DEMO2_INPUT); go('new'); });
  await p.click('#n-run');
  await p.waitForFunction(() => ST.route === 'case', null, { timeout: 60000 });
  await p.waitForTimeout(1200);
  R.paper = await p.evaluate(() => ({ note: (document.querySelector('#paper .zn') || { innerText: null }).innerText, hitsRows: document.querySelectorAll('#paper .znt tbody tr').length, yn: [...document.querySelectorAll('#paper table.yn')].pop().innerText.replace(/\s+/g, ' ').slice(0, 260), t11: [...document.querySelectorAll('#paper .t11 td.v')].map(e => e.innerText), missZone: !!document.querySelector('#paper .miss[data-gap=zone]'), gaps: gapsOf(curCase()).map(g => g.k), src: [...document.querySelectorAll('#paper .src')].filter(e => /区域の指定状況/.test(e.innerText)).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 200)), over: [...document.querySelectorAll('#paper .sheet')].filter(s => s.offsetHeight > 1125).length }));
  await p.evaluate(() => document.getElementById('sec-243').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, 'zones-243.png') });
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS', errs);
  await b.close();
})();
