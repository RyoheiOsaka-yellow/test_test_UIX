// 地下水汚染が到達し得る距離：src/gw.js の計算を、環境省の計算ツール本体で再計算した値（tests/gw-reference.json）と照合する。
// 参照値は、ツール（令和3年4月1日以降の基準）の入力シート（複数物質）に土質と動水勾配を入れ、LibreOffice で再計算して取り出したもの。
//   5土質 × 動水勾配5通り（1/10000、1/1000、1/200、1/50、1/10）× 26物質 ＝ 650件
// 使い方: node tests/gw.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'gw.js'), 'utf8');
const m = {};
new Function('m', src + ';Object.assign(m,{GW_SUBS,GW_SOILS,gwReach,gwRank,gwErfc});')(m);
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'gw-reference.json'), 'utf8'));
const norm = s => s.replace(/[,・\-－]/g, '').replace(/^シス/, '');
let ok = 0; const bad = [];
for (const r of ref) {
  const sub = m.GW_SUBS.find(s => norm(s.tool) === norm(r.sub));
  const soil = m.GW_SOILS.find(s => s.name === r.soil);
  if (!sub || !soil) { bad.push({ r, why: '対応する物質・土質が無い' }); continue; }
  const g = m.gwReach(sub, soil, r.i);
  const d = isFinite(g.d) ? g.d : '>1,000,000', rank = isFinite(g.rank) ? g.rank : '>1,000,000';
  const same = String(d) === String(r.d) && String(rank) === String(r.rank) && Math.abs(g.v - r.v) <= 1e-9 * Math.max(1, r.v) && Math.abs(g.R - r.R) <= 1e-9 * Math.max(1, r.R);
  if (same) ok++; else bad.push({ soil: r.soil, i: r.i, sub: r.sub, tool: [r.d, r.rank, r.v, r.R], ours: [d, rank, g.v, g.R] });
}
console.log(`照合 ${ref.length}件：一致 ${ok}件、不一致 ${bad.length}件`);
bad.slice(0, 20).forEach(b => console.log(JSON.stringify(b)));
// 丸めと誤差関数の確認
const t = [[86, 90], [100, 100], [101, 150], [120, 150], [150, 150], [151, 200], [500, 500], [501, 600], [0.1, 10], [1737, 1800]].filter(x => m.gwRank(x[0]) !== x[1]);
console.log('ランク別の丸め：', t.length ? '不一致 ' + JSON.stringify(t) : 'OK');
const e = [[0, 1], [0.5, 0.4795001221869535], [1, 0.15729920705028513], [2, 0.004677734981047266], [3, 0.000022090496998585441], [4, 1.541725790028002e-8], [6, 2.1519736712498913e-17]].filter(x => Math.abs(m.gwErfc(x[0]) - x[1]) > 1e-12 * Math.max(x[1], 1e-30) + 1e-16);
console.log('誤差関数：', e.length ? '不一致 ' + JSON.stringify(e.map(x => [x[0], m.gwErfc(x[0]), x[1]])) : 'OK');
process.exit(bad.length || t.length || e.length ? 1 : 0);
