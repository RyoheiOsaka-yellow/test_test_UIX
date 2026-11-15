// 分析パネル: 公開データと人流モデルを、ヒートマップ・建物の色分け・建物内のフロア別集計・ランキング・データ一覧として見る。
//  - ヒートマップ: 10 m 格子のラスタを地表に重ねる (歩行者密度、滞在人口、実測の滞在人口、夜間人口、従業者数、店舗密度、駅までの徒歩時間)
//  - 建物の色分け: 滞在人数、来訪ピーク、推定用途、高さ、津波・高潮・洪水の浸水深 (PLATEAU)、駅までの徒歩時間
//  - 建物内: 選択した建物の階ごと・区画ごとの推計人数 (フロアと区画を色分け)
//  - 集計: KPI、建物・区間のランキング、CSV / GeoJSON 出力
//  - データ: 使っている公開データと、調べたが対象エリアに無い / 未使用のデータの一覧
import * as THREE from 'three';
import { WALK_SPEED } from './people_model.js';
import { LOS } from './people.js';

const BOX = [-1300, -1350, 1500, 1200], CELL = 10, NX = (BOX[2] - BOX[0]) / CELL, NY = (BOX[3] - BOX[1]) / CELL;
const RAMPS = {
  light: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'],
  dark: ['#2a0a6b', '#5c01a6', '#9c179e', '#cc4778', '#ed7953', '#fdb42f', '#f0f921'],
  access: ['#1a9850', '#66bd63', '#a6d96a', '#fee08b', '#fdae61', '#f46d43', '#d73027'],
  water: ['#deebf7', '#9ecae1', '#6baed6', '#3182bd', '#08519c', '#08306b'],
};
const USE = { res: ['住宅', '#6fdc7a'], off: ['業務', '#4da3ff'], tower: ['高層ビル', '#7fa8e8'], ret: ['商業', '#ffb347'], hot: ['宿泊', '#c58bff'], att: ['集客施設', '#ff6f91'], pub: ['公共・教育・医療', '#2fb27a'], sta: ['駅', '#ffd84a'], mix: ['不明', '#b0b7c3'], extra: ['架空ビル', '#e040fb'] };
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rampAt = (stops, t) => { const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1), i = Math.floor(x), f = x - i, a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
const fmt = v => v === 0 ? '0' : v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
const fmtN = v => Math.round(v).toLocaleString();

// 公開データの一覧 (調査結果)。state: use=使用中, can=取得できるが未使用, none=対象エリアに無い/非公開
export const CATALOG = [
  { s: 'use', n: '3D都市モデル（Project PLATEAU）横浜市 2024 年度', by: '国土交通省 都市局', g: '建物 LOD2/LOD3・橋梁・道路', u: '建物・デッキ・道路の形状' },
  { s: 'use', n: 'PLATEAU CityGML 建築物の災害リスク属性（津波・高潮・洪水の浸水深）', by: '国土交通省 都市局', g: '建物ごと', u: '建物の色分け、浸水想定内の滞在人数' },
  { s: 'use', n: '全国の人流オープンデータ（1km メッシュ別の滞在人口）2019 年', by: '国土交通省 不動産・建設経済局', g: '1km メッシュ・月別・平休日・昼/深夜', u: '人流モデルの較正、ヒートマップ' },
  { s: 'use', n: '国勢調査 2020 250m メッシュ「人口及び世帯」（e-Stat 統計GIS 表 T001142）', by: '総務省統計局', g: '250m メッシュ', u: '夜間人口のヒートマップ' },
  { s: 'use', n: '経済センサス‐活動調査 500m メッシュ「産業別 事業所数・従業者数」（e-Stat 統計GIS 表 T001162）', by: '総務省・経済産業省', g: '500m メッシュ・産業大分類', u: '従業者数のヒートマップ' },
  { s: 'use', n: '国土数値情報 駅別乗降客数（S12）2023 年度', by: '国土交通省', g: '駅ごと', u: '駅の乗降人員の照合' },
  { s: 'use', n: '各鉄道事業者の公表乗降人員（2024 年度）', by: '横浜高速鉄道・JR 東日本・横浜市交通局', g: '駅ごと・1 日平均', u: '人流モデルの発生量' },
  { s: 'use', n: 'OpenStreetMap', by: 'OpenStreetMap contributors', g: '歩行者経路（階層付き）・店舗・建物用途タグ', u: '歩行者ネットワーク、店舗密度、用途の推定' },
  { s: 'use', n: '地理院タイル（標高 DEM5A・全国最新写真）', by: '国土地理院', g: '5m 標高・航空写真', u: '地形、リアル表示の地表' },
  { s: 'use', n: '各施設の公式フロアガイド（MARK IS、ランドマークプラザ、クイーンズスクエア、東急スクエア）', by: '各施設', g: '階・区画・店舗', u: '建物内のテナント配置、区画形状' },
  { s: 'can', n: 'PLATEAU 都市計画決定情報（用途地域・区域区分）', by: '国土交通省 都市局', g: '面（MVT）', u: '未使用。用途地域の重ね合わせに使える' },
  { s: 'can', n: 'PLATEAU 津波・高潮・洪水 浸水想定区域モデル（面）', by: '国土交通省 都市局', g: '面（3D Tiles）', u: '未使用。建物属性の浸水深で代用している' },
  { s: 'can', n: '経済センサス 500m メッシュ 産業小分類・従業者規模別（表 T001164・T001165）', by: '総務省・経済産業省', g: '500m メッシュ', u: '未使用。小売・飲食の内訳に使える' },
  { s: 'can', n: '国勢調査 2020 250m メッシュ 就業状態等（表 T001145）', by: '総務省統計局', g: '250m メッシュ', u: '未使用' },
  { s: 'can', n: '全国の人流オープンデータ（市区町村単位発地別）', by: '国土交通省', g: '市区町村・発地 4 区分', u: '未使用。来訪者の発地構成に使える' },
  { s: 'none', n: '屋内地図オープンデータ', by: '国土交通省 政策統括官', g: '施設内の通路・店舗区画', u: '横浜市内は新横浜駅と横浜国際総合競技場のみ。みなとみらい・横浜駅は未整備' },
  { s: 'none', n: '歩行空間ネットワークデータ', by: '国土交通省 政策統括官', g: '歩道の幅員・段差・勾配', u: '神奈川県は新横浜地区と鎌倉地区のみ' },
  { s: 'none', n: 'PLATEAU 建築物の用途・階数・延床面積', by: '国土交通省 都市局', g: '建物ごと', u: '横浜市のデータには収録されていない（CityGML を確認）。用途は OSM タグ等から推定' },
  { s: 'none', n: 'PLATEAU LOD4（建物の屋内モデル）', by: '国土交通省 都市局', g: '部屋・階段', u: '横浜市は未整備' },
  { s: 'none', n: '時間帯別（1 時間ごと）の人流', by: '携帯キャリア各社など', g: '500m メッシュ・1 時間', u: '有償データ。公開データは昼・深夜・終日の 3 区分まで' },
];

export function initAnalysis(ctx) {
  const { scene, header, graph, buildingMeta, people, indoor, terrainSampler, renderer, stats, calib, getCamera, getSel, FLOOR_H, catColor, setBuildingColors, applyIndoorHeat, selectBuilding, flyTo, floorLabel, guideFor, poiOf, onTheme } = ctx;
  const S = { layer: 'none', opacity: 0.8, bmetric: 'none', tab: 'heat', floorHeat: false, dark: false, open: true };
  const $ = id => document.getElementById(id);
  // ---- ヒートマップの面 (地形に沿わせる) ----
  const data = new Uint8Array(NX * NY * 4), tex = new THREE.DataTexture(data, NX, NY, THREE.RGBAFormat, THREE.UnsignedByteType); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const pg = new THREE.PlaneGeometry(BOX[2] - BOX[0], BOX[3] - BOX[1], 70, 64); pg.rotateX(-Math.PI / 2); pg.translate((BOX[0] + BOX[2]) / 2, 0, -(BOX[1] + BOX[3]) / 2);
  { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, terrainSampler(p.getX(i), -p.getZ(i))) + 0.9); }
  const heat = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: S.opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); heat.renderOrder = 3; heat.visible = false; heat.name = 'analysis-heat'; scene.add(heat);
  let cur = null;   // { v: Float32Array, max, unit, ramp, nearest, label }
  const cellOf = (x, y) => { const ix = Math.floor((x - BOX[0]) / CELL), iy = Math.floor((y - BOX[1]) / CELL); return ix < 0 || iy < 0 || ix >= NX || iy >= NY ? -1 : iy * NX + ix; };
  const blur = (v, passes) => { const t = new Float32Array(v.length); for (let p = 0; p < passes; p++) { for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * NX + x; t[i] = (v[i] * 2 + (x > 0 ? v[i - 1] : v[i]) + (x < NX - 1 ? v[i + 1] : v[i])) / 4; } for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * NX + x; v[i] = (t[i] * 2 + (y > 0 ? t[i - NX] : t[i]) + (y < NY - 1 ? t[i + NX] : t[i])) / 4; } } return v; };
  const fillRect = (v, r, val) => { const x0 = Math.max(0, Math.round((r[0] - BOX[0]) / CELL)), x1 = Math.min(NX, Math.round((r[2] - BOX[0]) / CELL)), y0 = Math.max(0, Math.round((r[1] - BOX[1]) / CELL)), y1 = Math.min(NY, Math.round((r[3] - BOX[1]) / CELL)); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v[y * NX + x] = val; };
  const ha = r => (r[2] - r[0]) * (r[3] - r[1]) / 10000;
  const pctl = (v, q) => { const a = []; for (let i = 0; i < v.length; i += 3) if (v[i] > 0) a.push(v[i]); if (!a.length) return 1; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
  const day = () => people.day(), hourTxt = () => { const h = people.state.hour, hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh}:${String(mm).padStart(2, '0')}`; };
  let accessCache = null;
  const nodeMinutes = () => { if (accessCache && accessCache.m === people.model) return accessCache.v; const N = graph.nodes.length, v = new Float32Array(N).fill(Infinity); for (const st of people.model.stations) for (let i = 0; i < N; i++) if (st.out.dist[i] < v[i]) v[i] = st.out.dist[i]; for (let i = 0; i < N; i++) v[i] = v[i] / WALK_SPEED / 60; accessCache = { m: people.model, v }; return v; };

  const LAYERS = {
    none: { n: 'なし' },
    ped: { n: '歩行者密度（モデル・現在時刻）', unit: '人/ha', time: true, note: '人流モデルの通行量から、その時刻に各地点を歩いている人数を面にしたもの', make: () => {
      const v = new Float32Array(NX * NY), vol = new Float32Array(graph.links.length); people.model.volumes(people.state.hour, day(), vol);
      for (let i = 0; i < vol.length; i++) { if (vol[i] < 1) continue; const l = graph.links[i], h = Math.hypot(l.bx - l.ax, l.by - l.ay); if (h < 0.5) continue; const n = vol[i] * h / (WALK_SPEED * 3600), k = Math.max(1, Math.ceil(h / 5)); for (let j = 0; j < k; j++) { const t = (j + 0.5) / k, c = cellOf(l.ax + (l.bx - l.ax) * t, l.ay + (l.by - l.ay) * t); if (c >= 0) v[c] += n / k * 100; } }
      return { v: blur(v, 2) }; } },
    stay: { n: '滞在人口（モデル・現在時刻）', unit: '人/ha', time: true, note: '駅から来て建物に滞在している推計人数（駅へ帰った人を引いた累積）。車・バスで来た人は含まない', make: () => {
      const v = new Float32Array(NX * NY), pr = people.model.presence(people.state.hour, day());
      people.model.dests.forEach((d, i) => { if (pr[i] <= 0.5 || d.b < 0) return; const bb = buildingMeta[d.b]?.bb; if (!bb) return; const x0 = Math.max(0, Math.floor((bb[0] / 10 - BOX[0]) / CELL)), x1 = Math.min(NX - 1, Math.floor((bb[2] / 10 - BOX[0]) / CELL)), y0 = Math.max(0, Math.floor((bb[1] / 10 - BOX[1]) / CELL)), y1 = Math.min(NY - 1, Math.floor((bb[3] / 10 - BOX[1]) / CELL)); const n = (x1 - x0 + 1) * (y1 - y0 + 1); if (n <= 0) return; const add = pr[i] / n * 100; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) v[y * NX + x] += add; });
      return { v: blur(v, 1) }; } },
    obs: { n: '実測 滞在人口（人流オープンデータ 1km・昼）', unit: '人/ha', nearest: true, dayDep: true, note: '国交省 人流オープンデータ 2019 年。平日/休日の切替に連動（11〜14 時台の平均）', make: () => { const v = new Float32Array(NX * NY); for (const q of calib?.meshes ?? []) fillRect(v, q.rect, (people.state.day === 'holiday' ? q.holDay : q.wkDay) / ha(q.rect)); return { v }; } },
    obsNight: { n: '実測 滞在人口（人流オープンデータ 1km・深夜）', unit: '人/ha', nearest: true, note: '同 1〜4 時台の平均（平日）', make: () => { const v = new Float32Array(NX * NY); for (const q of calib?.meshes ?? []) fillRect(v, q.rect, q.wkNight / ha(q.rect)); return { v }; } },
    census: { n: '夜間人口（国勢調査 2020・250m）', unit: '人/ha', nearest: true, note: '国勢調査 2020 年 250m メッシュの人口総数', make: () => { const v = new Float32Array(NX * NY); for (const c of stats?.census?.cells ?? []) fillRect(v, c.rect, c.pop / ha(c.rect)); return { v }; } },
    aged: { n: '65 歳以上人口（国勢調査 2020・250m）', unit: '人/ha', nearest: true, note: '国勢調査 2020 年 250m メッシュ', make: () => { const v = new Float32Array(NX * NY); for (const c of stats?.census?.cells ?? []) fillRect(v, c.rect, c.p65 / ha(c.rect)); return { v }; } },
    emp: { n: '従業者数（経済センサス・500m）', unit: '人/ha', nearest: true, note: '経済センサス‐活動調査 500m メッシュの全産業従業者数', make: () => { const v = new Float32Array(NX * NY); for (const c of stats?.econ?.cells ?? []) fillRect(v, c.rect, c.emp / ha(c.rect)); return { v }; } },
    empRetail: { n: '小売・飲食・宿泊の従業者数（経済センサス・500m）', unit: '人/ha', nearest: true, note: '卸売業・小売業と宿泊業・飲食サービス業の従業者数の合計', make: () => { const v = new Float32Array(NX * NY); for (const c of stats?.econ?.cells ?? []) fillRect(v, c.rect, (c.empRetail + c.empFood) / ha(c.rect)); return { v }; } },
    poi: { n: '店舗・施設の密度（OSM）', unit: '件/ha', note: 'OpenStreetMap の店舗・飲食・サービス等の地点を平滑化', make: () => { const v = new Float32Array(NX * NY); for (const q of header.poi || []) { const c = cellOf(q.x / 10, q.y / 10); if (c >= 0) v[c] += 100; } return { v: blur(v, 5) }; } },
    food: { n: '飲食店の密度（OSM）', unit: '件/ha', note: 'OpenStreetMap の飲食店を平滑化', make: () => { const v = new Float32Array(NX * NY); for (const q of header.poi || []) { if (q.c !== '飲食') continue; const c = cellOf(q.x / 10, q.y / 10); if (c >= 0) v[c] += 100; } return { v: blur(v, 5) }; } },
    access: { n: '最寄り駅までの徒歩時間（歩行者ネットワーク）', unit: '分', ramp: 'access', fixedMax: 15, zeroOk: true, note: '各駅のホームからの最短経路（階段・エレベーターの所要を加味）。歩行者経路の近くだけ値がある', make: () => {
      const v = new Float32Array(NX * NY).fill(-1), mins = nodeMinutes(); graph.nodes.forEach((n, i) => { if (!isFinite(mins[i]) || n.lv < 0) return; const r = 3; const cx = Math.floor((n.x - BOX[0]) / CELL), cy = Math.floor((n.y - BOX[1]) / CELL); for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { if (x < 0 || y < 0 || x >= NX || y >= NY) continue; const m = mins[i] + Math.hypot(x - cx, y - cy) * CELL / WALK_SPEED / 60, k = y * NX + x; if (v[k] < 0 || m < v[k]) v[k] = m; } });
      return { v }; } },
  };
  function paint() {
    const L = LAYERS[S.layer]; if (!L.make || !people.model) { heat.visible = false; cur = null; renderLegend(); return; }
    const r = L.make(), v = r.v, max = L.fixedMax ?? Math.max(1e-6, pctl(v, 0.985)), stops = RAMPS[L.ramp ?? (S.dark ? 'dark' : 'light')].map(hexRGB);
    for (let i = 0; i < v.length; i++) { const x = v[i], o = i * 4; if (L.zeroOk ? x < 0 : x <= max * 0.01) { data[o + 3] = 0; continue; } const t = Math.min(1, x / max), c = rampAt(stops, L.zeroOk ? t : Math.sqrt(t)); data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = L.zeroOk ? 215 : Math.round(90 + 150 * Math.min(1, t * 3)); }
    tex.magFilter = L.nearest ? THREE.NearestFilter : THREE.LinearFilter; tex.needsUpdate = true; heat.material.opacity = S.opacity; heat.visible = true;
    cur = { v, max, unit: L.unit, stops, L }; renderLegend();
  }
  // ---- 建物の色分け ----
  let peakCache = null;
  const destByB = () => { const m = new Map(); for (const d of people.model.dests) if (d.b >= 0) m.set(d.b, d); return m; };
  const BM = {
    none: { n: 'なし' },
    presence: { n: '滞在人数（モデル・現在時刻）', unit: '人', time: true, val: () => { const pr = people.model.presence(people.state.hour, day()), db = destByB(); return i => { const d = db.get(i); return d ? Math.max(0, pr[d.idx]) : 0; }; } },
    peak: { n: '出入りのピーク（モデル・人/時）', unit: '人/時', dayDep: true, val: () => { if (!peakCache || peakCache.m !== people.model || peakCache.d !== people.state.day) { const a = new Float32Array(people.model.dests.length), dd = day(); const tmp = new Float32Array(a.length); for (let h = 6; h < 23.5; h += 0.5) { tmp.fill(0); for (const c of people.model.classes) if (c.share) { const r = c.rate(h, dd); if (r > 0) for (let i = 0; i < tmp.length; i++) if (c.share[i] > 0) tmp[i] += r * c.share[i]; } for (let i = 0; i < a.length; i++) if (tmp[i] > a[i]) a[i] = tmp[i]; } peakCache = { m: people.model, d: people.state.day, a }; } const db = destByB(), a = peakCache.a; return i => { const d = db.get(i); return d ? a[d.idx] : 0; }; } },
    use: { n: '用途（OSM タグ等からの推定）', cat: true, val: () => { const db = destByB(); return i => db.get(i)?.u ?? null; } },
    height: { n: '高さ（PLATEAU）', unit: 'm', val: () => i => { const m = buildingMeta[i]; return m.h ?? (m.z ? m.z[1] - m.z[0] : 0); } },
    tsunami: { n: '津波浸水深（PLATEAU 建物属性）', unit: 'm', ramp: 'water', fixedMax: 3, val: () => i => buildingMeta[i].rk?.[0] ?? 0 },
    hightide: { n: '高潮浸水深（PLATEAU 建物属性）', unit: 'm', ramp: 'water', fixedMax: 3, val: () => i => buildingMeta[i].rk?.[1] ?? 0 },
    flood: { n: '洪水浸水深（PLATEAU 建物属性）', unit: 'm', ramp: 'water', fixedMax: 3, val: () => i => buildingMeta[i].rk?.[2] ?? 0 },
    access: { n: '最寄り駅までの徒歩時間', unit: '分', ramp: 'access', fixedMax: 15, zeroOk: true, val: () => { const mins = nodeMinutes(), db = destByB(); return i => { const d = db.get(i); if (!d) return -1; let b = Infinity; for (const c of d.cand) if (mins[c] < b) b = mins[c]; return isFinite(b) ? b : -1; }; } },
  };
  let bcur = null;
  const linRGB = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  function paintBuildings() {
    const M = BM[S.bmetric]; if (!M.val || !people.model) { setBuildingColors(null); bcur = null; renderLegend(); return; }
    const f = M.val();
    if (M.cat) { setBuildingColors(i => { const u = f(i); return u && USE[u] ? [...linRGB(USE[u][1]), 0.85] : null; }); bcur = { M }; renderLegend(); return; }
    const vals = new Float32Array(buildingMeta.length); for (let i = 0; i < vals.length; i++) vals[i] = buildingMeta[i]?.bb ? f(i) : 0;
    const max = M.fixedMax ?? Math.max(1e-6, pctl(vals, 0.99)), stops = RAMPS[M.ramp ?? (S.dark ? 'dark' : 'light')].map(h => linRGB(h));
    setBuildingColors(i => { const x = vals[i]; if (M.zeroOk ? x < 0 : x <= max * 0.004) return null; const t = Math.min(1, x / max); return [...rampAt(stops, M.zeroOk ? t : Math.sqrt(t)), 0.92]; });
    bcur = { M, max, vals }; renderLegend();
  }
  // ---- 凡例 ----
  const grad = (stops, sqrt) => `linear-gradient(90deg, ${stops.map((c, i) => `rgb(${c.map(Math.round).join(',')}) ${Math.round(i / (stops.length - 1) * 100)}%`).join(', ')})`;
  const ticks = (max, unit, sqrt) => [0, 0.25, 0.5, 0.75, 1].map(t => `<span>${fmt((sqrt ? t * t : t) * max)}</span>`).join('') + `<span class="an-unit">${unit}</span>`;
  function renderLegend() {
    if (!$('an-legend')) return;
    $('an-legend').innerHTML = cur ? `<div class="an-grad" style="background:${grad(cur.stops)}"></div><div class="an-ticks">${ticks(cur.max, cur.unit, !cur.L.zeroOk)}</div><div class="note">${cur.L.note ?? ''}${cur.L.time ? `（${hourTxt()} 時点）` : ''}</div>` : '';
    const b = $('an-blegend'); if (!b) return;
    if (!bcur) b.innerHTML = '';
    else if (bcur.M.cat) b.innerHTML = '<div class="legend">' + Object.values(USE).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('') + '</div><div class="note">横浜市の PLATEAU には用途属性が無いため、OSM の建物タグ・店舗数・名称・高さからの推定です。</div>';
    else b.innerHTML = `<div class="an-grad" style="background:${grad(RAMPS[bcur.M.ramp ?? (S.dark ? 'dark' : 'light')].map(hexRGB))}"></div><div class="an-ticks">${ticks(bcur.max, bcur.M.unit, !bcur.M.zeroOk)}</div>${bcur.M.time ? `<div class="note">${hourTxt()} 時点</div>` : ''}`;
  }
  // ---- 建物内 (選択中の建物) ----
  function floorStats() {
    const sel = getSel(); if (!sel || sel.bid < 0 || !indoor.model) return null; const sh = indoor.shares(); if (!sh) return null;
    const m = buildingMeta[sel.bid], bf = people.buildingFlows(m.runtime ? -2 : sel.bid), pres = bf?.presence ?? 0, arr = bf ? bf.arrive + bf.leave : 0;
    const rows = [...sh.floors].map(([fl, share]) => ({ fl, share, people: pres * share, zones: sel.zones.filter(z => !z.isCor && z.fl === fl) })).sort((a, b) => b.fl - a.fl);
    const zones = [...sh.zones].map(([z, share]) => ({ z, share, people: pres * share })).sort((a, b) => b.people - a.people);
    return { m, bf, pres, arr, rows, zones, sel };
  }
  function applyFloorHeat() {
    const fs = S.floorHeat ? floorStats() : null; if (!fs) { applyIndoorHeat(null); return; }
    const stops = RAMPS.light.map(h => linRGB(h)), fmax = Math.max(1e-6, ...fs.rows.map(r => r.people)), zmax = Math.max(1e-6, ...fs.zones.map(z => z.people)), byFl = new Map(fs.rows.map(r => [r.fl, r.people])), zmap = new Map(fs.zones.map(z => [z.z, z.people]));
    const hx = c => '#' + new THREE.Color(c[0], c[1], c[2]).getHexString();
    applyIndoorHeat({ floor: fl => { const p = byFl.get(fl); return p > 0 ? rampAt(stops, Math.sqrt(p / fmax)) : null; }, zone: z => zmap.has(z) ? hx(rampAt(stops, Math.sqrt(zmap.get(z) / zmax))) : null });
  }
  function renderBuilding() {
    const el = $('an-bldg'); if (!el) return; const fs = floorStats();
    if (!fs) { el.innerHTML = '<div class="note">建物をクリックして選択すると、階ごと・区画ごとの推計人数と、その建物について使えるデータが出ます。</div>'; return; }
    const { m, bf, pres, rows, zones, sel } = fs, guide = guideFor(m.n), nGuide = guide ? [...guide.values()].reduce((s, z) => s + z.length, 0) : 0, nPoi = poiOf(sel.bid).length, nZone = sel.zones.filter(z => !z.isCor).length, rk = m.rk;
    const mx = Math.max(1e-6, ...rows.map(r => r.people)), big = rows.length > 24, show = big ? rows.filter((_, i) => i % Math.ceil(rows.length / 24) === 0) : rows;
    const bars = show.map(r => { const cats = {}; for (const z of r.zones) cats[z.zone?.category ?? 'その他'] = (cats[z.zone?.category ?? 'その他'] || 0) + 1; const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]; return `<div class="an-frow"><span class="an-fl">${floorLabel(r.fl)}</span><span class="an-bar"><i style="width:${Math.max(1, r.people / mx * 100)}%;background:${top ? catColor(top[0]) : '#7f93b8'}"></i></span><span class="an-fv">${fmtN(r.people)}</span><span class="an-fz">${r.zones.length ? r.zones.length + ' 区画' : ''}</span></div>`; }).join('');
    el.innerHTML = `<div class="an-title">${m.n ?? '（名称なし）'}</div>
      <div class="an-kv"><span>高さ</span><b>${Math.round(m.h ?? (m.z[1] - m.z[0]))} m</b><span>推定階数</span><b>${sel.floors} 階</b><span>用途（推定）</span><b>${USE[bf?.use]?.[0] ?? '—'}</b><span>滞在（推計）</span><b>${fmtN(pres)} 人</b></div>
      <div class="an-kv"><span>津波</span><b>${rk?.[0] ? rk[0] + ' m' : '想定なし'}</b><span>高潮</span><b>${rk?.[1] ? rk[1] + ' m' : '想定なし'}</b><span>洪水</span><b>${rk?.[2] ? rk[2] + ' m' : '想定なし'}</b><span></span><b></b></div>
      <label class="row"><input type="checkbox" id="an-floorheat" ${S.floorHeat ? 'checked' : ''}/><span class="chip" style="background:linear-gradient(90deg,#ffeda0,#fd8d3c,#b10026)"></span>フロアと区画を推計人数で色分け</label>
      <div class="sec-title" style="margin-top:4px">階ごとの推計滞在人数（${hourTxt()}）${big ? '・抜粋' : ''}</div><div class="an-floors">${bars}</div>
      ${zones.length ? `<div class="sec-title" style="margin-top:6px">区画の上位（推計滞在人数）</div><table class="p-table">${zones.slice(0, 8).map(z => `<tr><td>${floorLabel(z.z.fl)} ${z.z.zone?.name || z.z.zone?.zone || ''}</td><td>${z.z.zone?.category ?? ''}</td><td>${fmtN(z.people)}</td></tr>`).join('')}</table>` : ''}
      <div class="sec-title" style="margin-top:6px">この建物の内部について使えるデータ</div>
      <div class="note" style="margin-top:0">公式フロアガイド ${nGuide ? nGuide + ' 件' : 'なし'} ／ 区画形状 ${nZone ? nZone + ' 区画' : 'なし'} ／ OSM の店舗 ${nPoi} 件 ／ 入口 ${indoor.model.ents.length} か所（歩行者ネットワーク）<br>国交省の屋内地図オープンデータと PLATEAU LOD4 は、この建物については公開されていません。階ごとの人数は、滞在人数を階と区画の用途で按分した推計です。</div>`;
    $('an-floorheat').addEventListener('change', e => { S.floorHeat = e.target.checked; applyFloorHeat(); });
  }
  // ---- 集計 ----
  function renderRank() {
    const el = $('an-rank'); if (!el || !people.model) return; const d = day(), w = people.model.walking(people.state.hour, d), pr = people.model.presence(people.state.hour, d);
    let walking = 0; for (const x of w) walking += x; let stay = 0; for (const x of pr) if (x > 0) stay += x;
    const hol = people.state.day === 'holiday', obs = (calib?.meshes ?? []).reduce((s, q) => s + (hol ? q.holDay : q.wkDay) * q.overlap, 0), pop = (stats?.census?.cells ?? []).reduce((s, c) => s + c.pop, 0), emp = (stats?.econ?.cells ?? []).reduce((s, c) => s + c.emp, 0);
    let rb = 0, rp = 0; people.model.dests.forEach((dd, i) => { if (dd.b < 0) return; const r = buildingMeta[dd.b]?.rk; if (r && r[0] >= 0.5) { rb++; rp += Math.max(0, pr[i]); } });
    const kpi = (n, v, u, src) => `<div class="an-kpi"><span>${n}</span><b>${v}</b><i>${u}</i><em>${src}</em></div>`;
    const top = people.model.dests.map((dd, i) => ({ dd, p: pr[i] })).filter(o => o.dd.b >= 0 && o.p > 0).sort((a, b) => b.p - a.p).slice(0, 10);
    const vol = new Float32Array(graph.links.length); people.model.volumes(people.state.hour, d, vol); const order = [...vol.keys()].filter(i => Math.hypot(graph.links[i].bx - graph.links[i].ax, graph.links[i].by - graph.links[i].ay) > 3).sort((a, b) => vol[b] - vol[a]); const picks = [];
    for (const i of order) { const l = graph.links[i], x = (l.ax + l.bx) / 2, y = (l.ay + l.by) / 2; if (picks.some(p => Math.hypot(p.x - x, p.y - y) < 60)) continue; let nm = '', bd = 90; for (const dd of people.model.dests) { if (!dd.n || dd.n === '公園・緑地' || dd.extra) continue; const q = Math.hypot(dd.x - x, dd.y - y); if (q < bd) { bd = q; nm = dd.n; } } const f = vol[i] / (60 * l.w); picks.push({ i, x, y, v: vol[i], nm, los: LOS.find(q => f < q.max) ?? LOS[LOS.length - 1], lv: graph.nodes[l.a].lv }); if (picks.length >= 8) break; }
    el.innerHTML = `<div class="an-kpis">${kpi('歩行中', fmtN(walking), '人', 'モデル ' + hourTxt())}${kpi('建物に滞在', fmtN(stay), '人', 'モデル（駅来訪）')}${kpi(`実測 昼間人口（${hol ? '休日' : '平日'}）`, fmtN(obs), '人', '人流オープンデータ')}${kpi('夜間人口', fmtN(pop), '人', '国勢調査 2020')}${kpi('従業者数', fmtN(emp), '人', '経済センサス')}${kpi('津波 0.5m 以上の建物', fmtN(rb), '棟', `滞在 ${fmtN(rp)} 人（モデル）`)}</div>
      <div class="sec-title" style="margin-top:6px">滞在人数の多い建物（${hourTxt()}・モデル）</div><table class="p-table an-click">${top.map((o, k) => `<tr data-b="${o.dd.b}"><td>${k + 1}. ${o.dd.n ?? '（名称なし）'}</td><td>${USE[o.dd.u]?.[0] ?? ''}</td><td>${fmtN(o.p)}</td></tr>`).join('')}</table>
      <div class="sec-title" style="margin-top:6px">通行量の多い区間（人/時・混雑度）</div><table class="p-table an-click">${picks.map((p, k) => `<tr data-x="${p.x}" data-y="${p.y}"><td>${k + 1}. ${p.nm ? p.nm + ' 付近' : `(${Math.round(p.x)}, ${Math.round(p.y)})`}${p.lv ? `（${p.lv > 0 ? 'デッキ' : '地下'}）` : ''}</td><td style="color:${p.los.c}">${p.los.k}</td><td>${fmtN(p.v)}</td></tr>`).join('')}</table>
      <div class="btn-row" style="margin-top:6px"><button id="an-x-b">建物指標 CSV</button><button id="an-x-l">区間 GeoJSON</button><button id="an-x-m">メッシュ CSV</button></div>
      <div class="note" style="margin-top:0">行をクリックするとその場所へ移動します。集計の範囲は対象範囲（約 2.8 × 2.55 km）にかかるメッシュの合計で、範囲外を含みます。</div>`;
    el.querySelectorAll('tr[data-b]').forEach(tr => tr.addEventListener('click', () => { const b = Number(tr.dataset.b), m = buildingMeta[b]; selectBuilding(b); const x = m.c[0] / 10, z = -m.c[1] / 10, h = (m.h ?? 40); flyTo(new THREE.Vector3(x - 180 - h * 0.5, 120 + h * 0.8, z + 200 + h * 0.5), new THREE.Vector3(x, h * 0.35, z)); }));
    el.querySelectorAll('tr[data-x]').forEach(tr => tr.addEventListener('click', () => { const x = Number(tr.dataset.x), z = -Number(tr.dataset.y); flyTo(new THREE.Vector3(x - 90, 130, z + 110), new THREE.Vector3(x, 0, z)); }));
    $('an-x-b').addEventListener('click', exportBuildings); $('an-x-l').addEventListener('click', exportLinks); $('an-x-m').addEventListener('click', exportMesh);
  }
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const lonlat = (x, y) => [header.origin.lon + x / (111320 * Math.cos(header.origin.lat * Math.PI / 180)), header.origin.lat + y / 110940];   // 近似 (対象範囲内で誤差 数 m)
  const csv = rows => rows.map(r => r.map(v => v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
  function exportBuildings() {
    const d = day(), pr = people.model.presence(people.state.hour, d), mins = nodeMinutes(), rows = [['building_index', 'name', 'lon', 'lat', 'height_m', 'use_estimated', 'footprint_m2', 'presence_model', 'arrive_per_h', 'leave_per_h', 'tsunami_m', 'hightide_m', 'flood_m', 'station_walk_min', 'hour', 'day']];
    people.model.dests.forEach((dd, i) => { if (dd.b < 0) return; const m = buildingMeta[dd.b], f = people.model.destFlows(i, people.state.hour, d), [lo, la] = lonlat(dd.x, dd.y); let b = Infinity; for (const c of dd.cand) if (mins[c] < b) b = mins[c]; rows.push([dd.b, m.n ?? '', lo.toFixed(6), la.toFixed(6), Math.round(m.h ?? (m.z[1] - m.z[0])), USE[dd.u]?.[0] ?? '', m.a ?? '', Math.max(0, pr[i]).toFixed(1), f.arrive.toFixed(1), f.leave.toFixed(1), m.rk?.[0] ?? 0, m.rk?.[1] ?? 0, m.rk?.[2] ?? 0, isFinite(b) ? b.toFixed(1) : '', hourTxt(), people.state.day]); });
    download(`minatomirai_buildings_${hourTxt().replace(':', '')}.csv`, csv(rows), 'text/csv');
  }
  function exportLinks() {
    const d = day(), vol = new Float32Array(graph.links.length); people.model.volumes(people.state.hour, d, vol);
    const feats = graph.links.map((l, i) => ({ l, i })).filter(o => vol[o.i] >= 1 && Math.hypot(o.l.bx - o.l.ax, o.l.by - o.l.ay) > 0.5).map(({ l, i }) => { const f = vol[i] / (60 * l.w); return { type: 'Feature', geometry: { type: 'LineString', coordinates: [lonlat(l.ax, l.ay).map(v => +v.toFixed(6)), lonlat(l.bx, l.by).map(v => +v.toFixed(6))] }, properties: { volume_per_h: Math.round(vol[i]), width_m: l.w, flow_per_m_min: +f.toFixed(1), los: (LOS.find(q => f < q.max) ?? LOS[LOS.length - 1]).k, level: graph.nodes[l.a].lv, covered: l.cov, crossing: l.cross, type: l.vt ?? 'walk' } }; });
    download(`minatomirai_links_${hourTxt().replace(':', '')}.geojson`, JSON.stringify({ type: 'FeatureCollection', name: `pedestrian volume ${hourTxt()} ${people.state.day} (model)`, features: feats }), 'application/geo+json');
  }
  function exportMesh() {
    const rows = [['dataset', 'mesh_code', 'x0_m', 'y0_m', 'x1_m', 'y1_m', 'value_1', 'value_2', 'value_3', 'value_4', 'columns']];
    for (const q of calib?.meshes ?? []) rows.push(['jinryu_1km_2019', q.id, ...q.rect, q.wkDay, q.wkNight, q.holDay, q.holNight, 'weekday_day/weekday_night/holiday_day/holiday_night']);
    for (const c of stats?.census?.cells ?? []) rows.push(['census2020_250m', c.id, ...c.rect, c.pop, c.p65, c.p14, c.hh, 'population/age65plus/age0to14/households']);
    for (const c of stats?.econ?.cells ?? []) rows.push(['economic_census_500m', c.id, ...c.rect, c.emp, c.est, c.empRetail, c.empFood, 'employees/establishments/employees_retail/employees_food_lodging']);
    download('minatomirai_mesh_stats.csv', csv(rows), 'text/csv');
  }
  // ---- パネル ----
  function buildPanel() {
    const el = $('analysis'); if (!el) return;
    const opt = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.n}</option>`).join('');
    const badge = { use: ['使用中', '#2fb27a'], can: ['取得可・未使用', '#ffb648'], none: ['対象エリアに無い', '#8a93a6'] };
    el.innerHTML = `<div class="an-head"><b>分析</b><div class="an-tabs"><button data-tab="heat" class="active">ヒート</button><button data-tab="bldg">建物内</button><button data-tab="rank">集計</button><button data-tab="data">データ</button></div><button id="an-toggle" title="たたむ">−</button></div>
      <div class="an-body">
        <div data-pane="heat">
          <div class="sec-title">地表のヒートマップ</div><select id="an-layer" class="p-select" style="width:100%">${opt(LAYERS, S.layer)}</select>
          <div class="cal-row"><span>濃さ</span><input type="range" id="an-opacity" min="0.2" max="1" step="0.05" value="${S.opacity}" /><b></b></div>
          <div id="an-legend"></div><div id="an-hover" class="an-hover"></div>
          <div class="sec-title" style="margin-top:8px">建物の色分け</div><select id="an-bmetric" class="p-select" style="width:100%">${opt(BM, S.bmetric)}</select>
          <div id="an-blegend"></div>
        </div>
        <div data-pane="bldg" style="display:none"><div id="an-bldg"></div></div>
        <div data-pane="rank" style="display:none"><div id="an-rank"></div></div>
        <div data-pane="data" style="display:none"><div class="note" style="margin-top:0">公開されているデータを調べ、使えるものを取り込みました。</div>${CATALOG.map(c => `<div class="an-ds"><span class="an-badge" style="background:${badge[c.s][1]}">${badge[c.s][0]}</span><b>${c.n}</b><div>${c.by} ／ ${c.g}</div><div class="an-use">${c.u}</div></div>`).join('')}</div>
      </div>`;
    el.querySelectorAll('.an-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('an-toggle').addEventListener('click', () => { S.open = !S.open; el.classList.toggle('closed', !S.open); $('an-toggle').textContent = S.open ? '−' : '＋'; });
    $('an-layer').addEventListener('change', e => { S.layer = e.target.value; paint(); });
    $('an-opacity').addEventListener('input', e => { S.opacity = Number(e.target.value); heat.material.opacity = S.opacity; });
    $('an-bmetric').addEventListener('change', e => { S.bmetric = e.target.value; paintBuildings(); });
    renderLegend(); renderBuilding();
  }
  function setTab(tab) { S.tab = tab; const el = $('analysis'); el.querySelectorAll('.an-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); el.querySelectorAll('[data-pane]').forEach(p => { p.style.display = p.dataset.pane === tab ? '' : 'none'; }); if (tab === 'rank') renderRank(); if (tab === 'bldg') renderBuilding(); }
  // カーソル位置の値
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3), hit = new THREE.Vector3(), ndc = new THREE.Vector2(); let lastMove = 0;
  renderer.domElement.addEventListener('pointermove', e => {
    if (!cur || performance.now() - lastMove < 80) return; lastMove = performance.now(); const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, getCamera());
    const el = $('an-hover'); if (!el) return; if (!ray.ray.intersectPlane(plane, hit)) { el.textContent = ''; return; } const c = cellOf(hit.x, -hit.z); const v = c >= 0 ? cur.v[c] : -1;
    el.innerHTML = c < 0 || (cur.L.zeroOk ? v < 0 : v <= 0) ? 'カーソル位置: 値なし' : `カーソル位置: <b>${fmt(v)}</b> ${cur.unit}`;
  });
  // 時刻・曜日・シナリオが変わったら、時刻に依存する表示を更新する
  let sig = '', tAcc = 0;
  function update(dt) {
    tAcc += dt; if (tAcc < 0.6 || !people.model) return; tAcc = 0; const ps = people.state, s = `${Math.round(ps.hour * 4)}|${ps.day}|${ps.rain}|${ps.event}|${people.model.dests.length}`; if (s === sig) return; const dayCh = sig.split('|')[1] !== ps.day || sig.split('|').slice(2).join() !== s.split('|').slice(2).join(); sig = s;
    const L = LAYERS[S.layer]; if (L.make && (L.time || (L.dayDep && dayCh))) paint();
    const M = BM[S.bmetric]; if (M.val && (M.time || (M.dayDep && dayCh))) paintBuildings();
    if (S.tab === 'rank') renderRank(); if (S.tab === 'bldg') { renderBuilding(); if (S.floorHeat) applyFloorHeat(); }
  }
  function onSelect(bid) { if (bid >= 0 && S.floorHeat) setTimeout(applyFloorHeat, 0); if (S.tab === 'bldg' || bid >= 0) setTimeout(renderBuilding, 0); }
  onTheme(t => { S.dark = new THREE.Color(t.bg).getHSL({}).l < 0.3 && !t.real; if (cur) paint(); if (bcur) paintBuildings(); });
  buildPanel();
  const set = o => { Object.assign(S, o); if ('layer' in o) { if ($('an-layer')) $('an-layer').value = S.layer; paint(); } if ('bmetric' in o) { if ($('an-bmetric')) $('an-bmetric').value = S.bmetric; paintBuildings(); } if ('tab' in o) setTab(S.tab); if ('floorHeat' in o) { applyFloorHeat(); renderBuilding(); } };
  return { update, onSelect, set, state: S, LAYERS, BM, floorStats, exportBuildings, exportLinks, exportMesh, get current() { return cur; } };
}
