// 人流モデルの較正: 国交省 人流オープンデータ (1km メッシュ別の滞在人口, 2019 年) に、モデルの昼間滞在人口の分布を合わせる。
//   node tools/calibrate_people.mjs   (data/minatomirai.pack と data/jinryu.json が必要) → data/people_calib.json
// 合わせるもの:
//   fRes(メッシュ)  住民の重み      … 深夜人口の分布
//   fOff(メッシュ)  業務の集客力    … 平日昼の「昼間人口 − 在宅住民」の分布
//   fVis(メッシュ)  来街の集客力    … 休日昼の同じ値の分布
//   yokoDaily       横浜駅から対象範囲へ歩く人数 (公表値が無い) … 横浜駅東口メッシュの平日昼
//   holidayTotal    休日の総量係数   … 休日/平日 の昼間人口の比
//   monthWk/monthHol 月別係数        … 月別の昼間人口 / 年平均
// 合わせられないもの: 時間帯分布 (データは 昼・深夜・終日 の 3 区分のみ)。
import { readFileSync, writeFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { dirname, join } from 'node:path'; import { fileURLToPath } from 'node:url';
import { buildPeopleModel, DAY_TYPES, STATION_DATA } from '../src/people_model.js';
const here = dirname(fileURLToPath(import.meta.url)), D = join(here, '..', 'data');
const raw = gunzipSync(readFileSync(join(D, 'minatomirai.pack'))); const hl = raw.readUInt32LE(0); const header = JSON.parse(raw.subarray(4, 4 + hl).toString('utf8'));
const jin = JSON.parse(readFileSync(join(D, 'jinryu.json'), 'utf8'));
const LEVEL_H = header.levelHeights, levelY = lv => LEVEL_H[lv] ?? lv * 6, net = header.network;
const graph = { nodes: net.nodes.map(([x, y, lv], i) => ({ id: i, x: x / 10, y: y / 10, lv })), links: [] };
net.links.forEach((l, li) => { const [a, b, vtc, ow, ax, ay, bx, by, wd, fl] = l; const na = graph.nodes[a], nb = graph.nodes[b]; graph.links.push({ li, a, b, vt: net.vtypes[vtc] || null, vtc, oneWay: !!ow, ax: ax / 10, ay: ay / 10, bx: bx / 10, by: by / 10, length: Math.max(0.5, Math.hypot(bx - ax, by - ay) / 10 + Math.abs(levelY(nb.lv) - levelY(na.lv)) * (vtc ? 1 : 0.2)), w: (wd ?? 30) / 10, cross: !!((fl ?? 0) & 1), cov: !!((fl ?? 0) & 2) }); });

const HOME = 0.45;            // 昼に自宅にいる住民の割合 (仮定)
const MIN_OV = 0.45;          // 対象範囲との重なりがこれ以上のメッシュだけ較正に使う
const meshes = jin.meshes.map(q => ({ ...q, fOff: 1, fVis: 1, fRes: 1, use: q.overlap >= MIN_OV }));
// 観測: 「昼間人口 − 在宅住民」(対象範囲に入る分)
for (const q of meshes) { q.obsWk = Math.max(0, q.wkDay - HOME * q.wkNight) * q.overlap; q.obsHol = Math.max(0, q.holDay - HOME * q.holNight) * q.overlap; q.obsNight = q.wkNight * q.overlap; }
const calib = { meshes, yokoDaily: STATION_DATA.find(s => s.assumed).daily, holidayTotal: DAY_TYPES.holiday.total };
const sumBy = (model, arr, key = null) => { const out = Object.fromEntries(meshes.map(q => [q.id, 0])); model.dests.forEach((d, i) => { if (d.mesh) out[d.mesh] += key ? d[key] : Math.max(0, arr[i]); }); return out; };
let kW = 1, kH = 1, log = [];
for (let it = 0; it < 9; it++) {
  const model = buildPeopleModel({ graph, header, buildingMeta: header.buildings.meta, calib, light: true });
  const wd = DAY_TYPES.weekday, hd = { ...DAY_TYPES.holiday, total: calib.holidayTotal };
  const pw = sumBy(model, model.presence(13, wd, ['commute', 'visit'])), ph = sumBy(model, model.presence(13, hd, ['commute', 'visit'])), res = sumBy(model, null, 'res');
  // 横浜駅が支配的なメッシュ (その駅から来る人が過半): 横浜駅の仮定値の較正に使い、κ の計算からは外す
  const yi = model.stations.findIndex(s => s.assumed); const yokoShare = Object.fromEntries(meshes.map(q => [q.id, 0]));
  { const tot = new Float64Array(model.dests.length), yk = new Float64Array(model.dests.length); for (const c of model.classes) if (c.share && c.dir === 'out' && c.purpose !== 'resident') { let cum = 0; for (let t = 4; t < 13; t += 0.25) cum += c.rate(t + 0.125, wd) * 0.25; for (let i = 0; i < tot.length; i++) { const v = cum * c.share[i]; tot[i] += v; if (c.station === yi) yk[i] += v; } }
    const a = sumBy(model, tot), b = sumBy(model, yk); for (const q of meshes) yokoShare[q.id] = a[q.id] > 0 ? b[q.id] / a[q.id] : 0; }
  const core = meshes.filter(q => q.use && yokoShare[q.id] < 0.5);
  kW = core.reduce((s, q) => s + q.obsWk, 0) / core.reduce((s, q) => s + pw[q.id], 0); kH = core.reduce((s, q) => s + q.obsHol, 0) / core.reduce((s, q) => s + ph[q.id], 0);
  const err = Math.sqrt(core.reduce((s, q) => s + (Math.log((pw[q.id] * kW + 1) / (q.obsWk + 1))) ** 2, 0) / core.length);
  log.push({ it, kW: +kW.toFixed(2), kH: +kH.toFixed(2), yoko: Math.round(calib.yokoDaily), holidayTotal: +calib.holidayTotal.toFixed(2), rmsLog: +err.toFixed(3) });
  for (const q of meshes) { q.modelWk = Math.round(pw[q.id] * kW); q.modelHol = Math.round(ph[q.id] * kW); q.yokoShare = +yokoShare[q.id].toFixed(2); }
  if (it === 8) break;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const q of meshes) {
    if (!q.use) continue;
    if (res[q.id] > 0) q.fRes = clamp(q.fRes * (q.obsNight / res[q.id]) ** 0.8, 0.15, 6);
    if (yokoShare[q.id] >= 0.5) continue;
    if (pw[q.id] > 0) q.fOff = clamp(q.fOff * (q.obsWk / (pw[q.id] * kW)) ** 0.7, 0.2, 5);
    if (ph[q.id] > 0) q.fVis = clamp(q.fVis * (q.obsHol / (ph[q.id] * kH)) ** 0.7, 0.2, 5);
  }
  // 横浜駅: 支配的メッシュの平日昼を、他のメッシュと同じ κ で説明できる人数に寄せる
  const ym = meshes.filter(q => q.use && yokoShare[q.id] >= 0.5); if (ym.length) { const r = ym.reduce((s, q) => s + q.obsWk, 0) / (ym.reduce((s, q) => s + pw[q.id], 0) * kW); calib.yokoDaily = clamp(calib.yokoDaily * r ** 0.7, 40000, 600000); }
  calib.holidayTotal = clamp(calib.holidayTotal * (kH / kW) ** 0.7, 0.4, 1.6);
}
// 月別係数 (較正に使うメッシュの昼間人口の合計 / 年平均)
const mon = key => { const s = Array.from({ length: 12 }, (_, m) => meshes.filter(q => q.use).reduce((a, q) => a + q[key][m] * q.overlap, 0)); const mean = s.reduce((a, b) => a + b, 0) / 12; return s.map(v => +(v / mean).toFixed(3)); };
const out = { source: jin.source, url: jin.url, year: jin.year, homeShare: HOME, kappa: +kW.toFixed(2), yokoDaily: Math.round(calib.yokoDaily / 1000) * 1000, holidayTotal: +calib.holidayTotal.toFixed(2), monthWk: mon('monthWkDay'), monthHol: mon('monthHolDay'),
  meshes: meshes.map(q => ({ id: q.id, rect: q.rect, overlap: q.overlap, use: q.use, wkDay: q.wkDay, wkNight: q.wkNight, holDay: q.holDay, holNight: q.holNight, obsWk: Math.round(q.obsWk), obsHol: Math.round(q.obsHol), modelWk: q.modelWk, modelHol: q.modelHol, yokoShare: q.yokoShare, fOff: +q.fOff.toFixed(2), fVis: +q.fVis.toFixed(2), fRes: +q.fRes.toFixed(2) })) };
writeFileSync(join(D, 'people_calib.json'), JSON.stringify(out));
console.table(log); console.table(out.meshes.map(q => ({ id: q.id, ov: q.overlap, use: q.use, obsWk: q.obsWk, modelWk: q.modelWk, obsHol: q.obsHol, modelHol: q.modelHol, yoko: q.yokoShare, fOff: q.fOff, fVis: q.fVis, fRes: q.fRes })));
console.log('kappa', out.kappa, 'yokoDaily', out.yokoDaily, 'holidayTotal', out.holidayTotal, 'monthWk', out.monthWk.join(' '), 'monthHol', out.monthHol.join(' '));
