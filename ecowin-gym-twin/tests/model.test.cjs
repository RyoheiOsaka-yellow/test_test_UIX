// 計算エンジンの自動テスト： node tests/model.test.cjs
const assert = require('assert');
const M = require('../js/model.js');
const p = { city: 3, insul: 'low', occupants: 80, sensible: 150, setHeat: 18, setCool: 27, opStart: 8, opEnd: 21, panels: 72, preheat: 1, price: 22, basic: 1100 };
const wx = M.generateWeather(p.city), wx2 = M.generateWeather(p.city);
assert.deepStrictEqual(Array.from(wx.T.slice(0, 200)), Array.from(wx2.T.slice(0, 200)), '気象は同じ地域なら毎回同じ');
for (let k = 0; k < 8760; k++) { assert(wx.T[k] > -25 && wx.T[k] < 45); assert(wx.I[k] >= 0 && wx.I[k] < 1200); assert(wx.RH[k] > 0 && wx.RH[k] <= 100); }
const panels = M.buildPanels('rows', p.panels); assert.strictEqual(panels.length, 72);
const F = M.computeViewWeights(1.1, panels);
for (let k = 0; k < F.floor.length; k += 97) assert(Math.abs(F.floor[k] + F.roof[k] + F.wall[k] + F.win[k] + F.panel[k] - 1) < 1e-5, '見える割合の合計は1');
// パネルの無い部屋の中央では、6面の立体角の合計が全球（4π）になる
const F0 = M.computeViewWeights(1.1, []); assert(F0.mean.panel === 0 && F0.mean.floor > 0.35 && F0.mean.floor < 0.5);
// パネルの正面1mは、5m離れた点（列全体が見える位置）より大きくパネルが見える
const P0 = panels[30], idx = (x, y) => Math.floor((y - M.GEOM.ay0) / 0.5) * M.GEOM.NX + Math.floor((x - M.GEOM.ax0) / 0.5);
assert(F.panel[idx(P0.x, P0.y + 1)] > 1.5 * F.panel[idx(P0.x, P0.y + 5)]);
const jm = { heat: M.computeJetPattern(1.1, true).mean, cool: M.computeJetPattern(1.1, false).mean };
const r = M.simulate(p, wx, F.mean, jm), S = r.summary;
assert.strictEqual(S.modes.none.kwh, 0);
assert(S.modes.eco.kwh < S.modes.ac.kwh && S.rate > 0.05 && S.rate <= 0.34 + 1e-9, '削減率は0〜34%');
assert(S.modes.eco.contract < S.modes.ac.contract);
assert(S.modes.none.wbgt28 > S.modes.ac.wbgt28, '空調なしは暑さ指数の高い時間が多い');
for (const m of M.MODES) for (let k = 0; k < 8760; k++) assert(isFinite(r[m].OT[k]) && r[m].Ta[k] > -25 && r[m].Ta[k] < 55, m + ' ' + k);
// 運転時間の後半は設定温度の近くに保たれる（1月と8月の15時）
let okH = 0, okC = 0, n = 0;
for (let d = 0; d < 31; d++) { n++; if (Math.abs(r.ac.Ta[d * 24 + 15] - 18) < 0.6) okH++; if (Math.abs(r.ac.Ta[(212 + d) * 24 + 15] - 27) < 0.6) okC++; }
assert(okH / n > 0.8 && okC / n > 0.8, '設定温度の維持 ' + okH + ' ' + okC);
// 暖房時の上下温度差はエアコンのみの方が大きい
let ga = 0, ge = 0; for (let d = 0; d < 31; d++) { ga += r.ac.G[d * 24 + 10]; ge += r.eco.G[d * 24 + 10]; } assert(ga > ge * 1.5);
// 高断熱では上限34%が働く
const r2 = M.simulate(Object.assign({}, p, { insul: 'high' }), wx, F.mean, jm); assert(r2.summary.rate <= 0.34 + 1e-9);
// パネル1台の移動：差分更新と作り直しが一致する
const moved = panels.map(q => Object.assign({}, q)); const np = { axis: 'x', x: 17.3, y: 19.7 };
M.movePanelWeights(F, moved[5], np); moved[5] = np; const Fb = M.computeViewWeights(1.1, moved);
for (let k = 0; k < Fb.panel.length; k += 53) assert(Math.abs(F.panel[k] - Fb.panel[k]) < 1e-4, '差分更新 ' + k);
// 観測データの形式
const fs = require('fs'), path = require('path'); global.window = {}; eval(fs.readFileSync(path.join(__dirname, '../data/nerima2025.js'), 'utf8'));
const ob = M.weatherFromData(global.window.WX_OBS); assert(ob.T.length === 8760 && ob.I.length === 8760 && ob.sky.length === 365 && ob.observed);
const ro = M.simulate(p, ob, Fb.mean, jm); assert(ro.summary.rate > 0.05 && ro.summary.rate <= 0.34 + 1e-9);
console.log('練馬2025  削減率 ' + (ro.summary.rate * 100).toFixed(1) + '%  WBGT28以上（空調なし） ' + ro.summary.modes.none.wbgt28 + ' 時間  最高 ' + Math.max.apply(null, ob.tmax).toFixed(1) + '℃');
const out = new Float32Array(M.GEOM.NX * M.GEOM.NY), st = {}; M.FIELDS.forEach(f => st[f] = r.ac[f][20 * 24 + 10]);
const windMean = M.computeField('wind', 'ac', st, true, 1.1, F, M.computeJetPattern(1.1, true), out); assert(windMean > 0.1 && windMean < 2);
// 予熱運転：朝の体感が上がり、消費電力量は増える
const rp0 = M.simulate(Object.assign({}, p, { preheat: 0 }), wx, F.mean, jm);
let o1 = 0, o0 = 0; for (let d = 0; d < 31; d++) { o1 += r.eco.OT[d * 24 + 9]; o0 += rp0.eco.OT[d * 24 + 9]; }
assert(o1 > o0 + 5 && S.modes.eco.kwh > rp0.summary.modes.eco.kwh);
console.log('ok  削減率 ' + (S.rate * 100).toFixed(1) + '%  エアコンのみ ' + Math.round(S.modes.ac.kwh) + ' kWh  ecowin ' + Math.round(S.modes.eco.kwh) + ' kWh');
