// 分析パネル: 公開データと人流モデルを、ヒートマップ・建物の色分け・建物内のフロア別集計・ランキング・データ一覧として見る。
//  - ヒートマップ: 10 m 格子のラスタを地表に重ねる (歩行者密度、滞在人口、実測の滞在人口、夜間人口、従業者数、店舗密度、駅までの徒歩時間)
//  - 建物の色分け: 滞在人数、来訪ピーク、推定用途、高さ、津波・高潮・洪水の浸水深 (PLATEAU)、駅までの徒歩時間
//  - 建物内: 選択した建物の階ごと・区画ごとの推計人数 (フロアと区画を色分け)
//  - 集計: KPI、建物・区間のランキング、CSV / GeoJSON 出力
//  - データ: 使っている公開データと、調べたが対象エリアに無い / 未使用のデータの一覧
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
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
  { s: 'use', n: '各施設の公式フロアガイド（MARK IS、ランドマークプラザ、クイーンズスクエア、東急スクエア）', by: '各施設', g: '階・区画・店舗・昇降設備の記号', u: '建物内のテナント配置、区画形状。MARK IS はエレベーター・エスカレーターの位置も画像から検出' },
  { s: 'use', n: 'OpenStreetMap の駐車場・バス停', by: 'OpenStreetMap contributors', g: '点（駐車場 397・バス停 101）', u: '鉄道以外で来る人の発着点。駐車場は面積から収容台数も見積もる' },
  { s: 'use', n: '国土数値情報 バスルート (N07) 2011年度', by: '国土交通省', g: '系統別の線（平日・土曜・日祝の運行本数）', u: 'バスで来る人の量（範囲内 176 系統・平日 4,658 便）' },
  { s: 'use', n: '主要施設の駐車場の収容台数', by: '各施設の公式サイト・駐車場案内サイト', g: '施設ごと（16 施設・計 9,759 台）', u: '車で来る人の量。台数が分からない施設は、延床からの見積もりに実数との比（0.51）を掛けて補正' },
  { s: 'use', n: 'みなとみらい公共駐車場の利用実績', by: '横浜市（市会資料）', g: '年間の駐車台数（2012年度 369,328 台 / 収容 1,154 台）', u: '駐車場の回転率（0.88 回/日）' },
  { s: 'ref', n: 'みなとみらい 21 地区の来街者数', by: '横浜市 都市整備局（記者発表）', g: '地区全体の年間値（2024年 約 8,260 万人、2025年から人流データで約 1 億 180 万人）', u: '手段別の内訳は公表されていないため、総量の目安としてのみ参照' },
  { s: 'use', n: 'PLATEAU 都市計画決定情報（用途地域・指定容積率）', by: '国土交通省 都市局', g: '面（MVT）→ 10 m 格子', u: '用途地域と指定容積率のヒートマップ' },
  { s: 'can', n: '横浜市営バス GTFS-JP（現行ダイヤ）', by: '横浜市交通局 / 公共交通オープンデータセンター', g: '便ごとの停留所と時刻', u: '利用者登録で発行されるアクセストークンが必要。取り込みの仕組み（tools/fetch_gtfs_bus.py）は用意済みで、取得すれば 2011 年度の本数を現行の便数と時間帯別の分布に置き換えられる' },
  { s: 'can', n: 'PLATEAU 津波・高潮・洪水 浸水想定区域モデル（面）', by: '国土交通省 都市局', g: '面（3D Tiles）', u: '未使用。建物属性の浸水深で代用している' },
  { s: 'use', n: '経済センサス 500m メッシュ 産業小分類（e-Stat 統計GIS 表 T001164）', by: '総務省・経済産業省', g: '500m メッシュ・産業小分類の一部', u: '宿泊・集客施設・百貨店の従業者数、病院・診療所の数。飲食店（食堂・専門料理店など）はこの表に含まれない' },
  { s: 'can', n: '経済センサス 500m メッシュ 従業者規模別（表 T001165）', by: '総務省・経済産業省', g: '500m メッシュ', u: '未使用' },
  { s: 'can', n: '国勢調査 2020 250m メッシュ 就業状態等（表 T001145）', by: '総務省統計局', g: '250m メッシュ', u: '未使用' },
  { s: 'use', n: '全国の人流オープンデータ（市区町村単位発地別）2019 年', by: '国土交通省', g: '市区町村・発地 4 区分', u: '西区・中区に滞在している人の発地構成（集計タブ）。メッシュ単位の発地は公開されていない' },
  { s: 'none', n: '屋内地図オープンデータ', by: '国土交通省 政策統括官', g: '施設内の通路・店舗区画', u: '横浜市内は新横浜駅と横浜国際総合競技場のみ。みなとみらい・横浜駅は未整備' },
  { s: 'none', n: '歩行空間ネットワークデータ', by: '国土交通省 政策統括官', g: '歩道の幅員・段差・勾配', u: '神奈川県は新横浜地区と鎌倉地区のみ' },
  { s: 'none', n: 'PLATEAU 建築物の用途・階数・延床面積', by: '国土交通省 都市局', g: '建物ごと', u: '横浜市のデータには収録されていない（CityGML を確認）。用途は OSM タグ等から推定' },
  { s: 'none', n: 'PLATEAU LOD4（建物の屋内モデル）', by: '国土交通省 都市局', g: '部屋・階段', u: '横浜市は未整備' },
  { s: 'none', n: '時間帯別（1 時間ごと）の人流', by: '携帯キャリア各社など', g: '500m メッシュ・1 時間', u: '有償データ。公開データは昼・深夜・終日の 3 区分まで' },
];

export function initAnalysis(ctx) {
  const { scene, header, graph, buildingMeta, people, indoor, terrainSampler, renderer, stats, calib, getCamera, getSel, FLOOR_H, catColor, setBuildingColors, applyIndoorHeat, selectBuilding, flyTo, floorLabel, guideFor, poiOf, onTheme, setNavEnabled = () => {}, setClock = () => {}, guides = () => [], flows = null, share = null, snapshot = () => null, realMonth = () => 1 } = ctx;
  const S = { layer: 'none', opacity: 0.8, bmetric: 'none', tab: 'heat', floorHeat: false, dark: false, open: true, diff: 'none', split: false, layer2: 'emp', splitX: 0.5, scUnit: 'mesh', scX: 'emp', scY: 'stay', range: null, tsTarget: 'all', tsPoint: null, tsOther: true, style: 'flat', flows: false, tsPolar: false, multi: false };
  const $ = id => document.getElementById(id);
  // ---- ヒートマップの面 (地形に沿わせる) ----
  const data = new Uint8Array(NX * NY * 4), tex = new THREE.DataTexture(data, NX, NY, THREE.RGBAFormat, THREE.UnsignedByteType); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const pg = new THREE.PlaneGeometry(BOX[2] - BOX[0], BOX[3] - BOX[1], 70, 64); pg.rotateX(-Math.PI / 2); pg.translate((BOX[0] + BOX[2]) / 2, 0, -(BOX[1] + BOX[3]) / 2);
  { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, terrainSampler(p.getX(i), -p.getZ(i))) + 0.9); }
  const heat = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: S.opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); heat.renderOrder = 3; heat.visible = false; heat.name = 'analysis-heat'; scene.add(heat);
  // 画面分割で比較するための 2 枚目。画面の x 座標で左右に切り分ける (左 = 1 枚目, 右 = 2 枚目)
  const data2 = new Uint8Array(NX * NY * 4), tex2 = new THREE.DataTexture(data2, NX, NY, THREE.RGBAFormat, THREE.UnsignedByteType); tex2.colorSpace = THREE.SRGBColorSpace; tex2.magFilter = tex2.minFilter = THREE.LinearFilter; tex2.needsUpdate = true;
  const heat2 = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex2, transparent: true, opacity: S.opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); heat2.renderOrder = 3; heat2.visible = false; heat2.name = 'analysis-heat2'; scene.add(heat2);
  const splitU = { value: -1 };
  const patchSplit = (mat, side) => { mat.onBeforeCompile = sh => { sh.uniforms.uSplitX = splitU; sh.uniforms.uSide = { value: side }; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uSplitX; uniform float uSide;\nvoid main() {\n  if (uSplitX >= 0.0 && (gl_FragCoord.x - uSplitX) * uSide < 0.0) discard;'); }; mat.customProgramCacheKey = () => 'anheat' + side; };
  patchSplit(heat.material, -1); patchSplit(heat2.material, 1); let cur2 = null;
  let cur = null;   // { v: Float32Array, max, unit, ramp, nearest, label }
  const cellOf = (x, y) => { const ix = Math.floor((x - BOX[0]) / CELL), iy = Math.floor((y - BOX[1]) / CELL); return ix < 0 || iy < 0 || ix >= NX || iy >= NY ? -1 : iy * NX + ix; };
  const blur = (v, passes) => { const t = new Float32Array(v.length); for (let p = 0; p < passes; p++) { for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * NX + x; t[i] = (v[i] * 2 + (x > 0 ? v[i - 1] : v[i]) + (x < NX - 1 ? v[i + 1] : v[i])) / 4; } for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * NX + x; v[i] = (t[i] * 2 + (y > 0 ? t[i - NX] : t[i]) + (y < NY - 1 ? t[i + NX] : t[i])) / 4; } } return v; };
  const fillRect = (v, r, val) => { const x0 = Math.max(0, Math.round((r[0] - BOX[0]) / CELL)), x1 = Math.min(NX, Math.round((r[2] - BOX[0]) / CELL)), y0 = Math.max(0, Math.round((r[1] - BOX[1]) / CELL)), y1 = Math.min(NY, Math.round((r[3] - BOX[1]) / CELL)); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v[y * NX + x] = val; };
  const ha = r => (r[2] - r[0]) * (r[3] - r[1]) / 10000;
  const pctl = (v, q) => { const a = []; for (let i = 0; i < v.length; i += 3) if (v[i] > 0) a.push(v[i]); if (!a.length) return 1; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
  const day = () => people.day(), Q = (o = {}) => ({ hour: people.state.hour, day: people.day(), dayKey: people.state.day, model: people.model, ...o }), hourTxt = () => { const h = people.state.hour, hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh}:${String(mm).padStart(2, '0')}`; };
  // 用途地域 (10 m 格子のコード) と指定容積率
  const b64u8 = b => { const t = atob(b), a = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; };
  const ZN = stats?.zoning?.zones ?? [], zoneGrid = new Float32Array(NX * NY), farGrid = new Float32Array(NX * NY);
  if (stats?.zoning && stats.zoning.nx === NX && stats.zoning.ny === NY) { const g = b64u8(stats.zoning.grid), f = b64u8(stats.zoning.far); for (let i = 0; i < g.length; i++) { zoneGrid[i] = g[i]; farGrid[i] = f[i] * 10; } }
  const ZCOL = { '第1種低層住居専用地域': '#00a651', '第2種低層住居専用地域': '#7dc242', '第1種中高層住居専用地域': '#a8d08d', '第2種中高層住居専用地域': '#d4e6a5', '第1種住居地域': '#fff200', '第2種住居地域': '#ffd966', '準住居地域': '#f7b26a', '田園住居地域': '#c6e0b4', '近隣商業地域': '#f4a6c0', '商業地域': '#ed1c24', '準工業地域': '#b39ddb', '工業地域': '#8fd3f4', '工業専用地域': '#5b9bd5' };
  const econLayer = f => { const v = new Float32Array(NX * NY); for (const c of stats?.econ?.cells ?? []) fillRect(v, c.rect, f(c) / ha(c.rect)); return { v }; };
  let accessCache = null;
  const nodeMinutes = () => { if (accessCache && accessCache.m === people.model) return accessCache.v; const N = graph.nodes.length, v = new Float32Array(N).fill(Infinity); for (const st of people.model.stations) for (let i = 0; i < N; i++) if (st.out.dist[i] < v[i]) v[i] = st.out.dist[i]; for (let i = 0; i < N; i++) v[i] = v[i] / WALK_SPEED / 60; accessCache = { m: people.model, v }; return v; };

  const LAYERS = {
    none: { n: 'なし' },
    ped: { n: '歩行者密度（モデル・現在時刻）', unit: '人/ha', time: true, note: '人流モデルの通行量から、その時刻に各地点を歩いている人数を面にしたもの', make: (q = Q()) => {
      const v = new Float32Array(NX * NY), vol = new Float32Array(graph.links.length); q.model.volumes(q.hour, q.day, vol);
      for (let i = 0; i < vol.length; i++) { if (vol[i] < 1) continue; const l = graph.links[i], h = Math.hypot(l.bx - l.ax, l.by - l.ay); if (h < 0.5) continue; const n = vol[i] * h / (WALK_SPEED * 3600), k = Math.max(1, Math.ceil(h / 5)); for (let j = 0; j < k; j++) { const t = (j + 0.5) / k, c = cellOf(l.ax + (l.bx - l.ax) * t, l.ay + (l.by - l.ay) * t); if (c >= 0) v[c] += n / k * 100; } }
      return { v: blur(v, 2) }; } },
    stay: { n: '滞在人口（モデル・現在時刻）', unit: '人/ha', time: true, note: '駅から来て建物に滞在している推計人数（駅へ帰った人を引いた累積）。車・バスで来た人は含まない', make: (q = Q()) => {
      const v = new Float32Array(NX * NY), pr = q.model.presence(q.hour, q.day);
      q.model.dests.forEach((d, i) => { if (pr[i] <= 0.5 || d.b < 0) return; const bb = buildingMeta[d.b]?.bb; if (!bb) return; const x0 = Math.max(0, Math.floor((bb[0] / 10 - BOX[0]) / CELL)), x1 = Math.min(NX - 1, Math.floor((bb[2] / 10 - BOX[0]) / CELL)), y0 = Math.max(0, Math.floor((bb[1] / 10 - BOX[1]) / CELL)), y1 = Math.min(NY - 1, Math.floor((bb[3] / 10 - BOX[1]) / CELL)); const n = (x1 - x0 + 1) * (y1 - y0 + 1); if (n <= 0) return; const add = pr[i] / n * 100; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) v[y * NX + x] += add; });
      return { v: blur(v, 1) }; } },
    obs: { n: '実測 滞在人口（人流オープンデータ 1km・昼）', unit: '人/ha', nearest: true, dayDep: true, note: '国交省 人流オープンデータ 2019 年。平日/休日の切替に連動（11〜14 時台の平均）', make: (q = Q()) => { const v = new Float32Array(NX * NY); for (const m of calib?.meshes ?? []) fillRect(v, m.rect, (q.dayKey === 'holiday' ? m.holDay : m.wkDay) / ha(m.rect)); return { v }; } },
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
    zoning: { n: '用途地域（PLATEAU 都市計画決定情報）', cat: true, nearest: true, note: 'PLATEAU 横浜市 2024 の用途地域。海や市街化調整区域には指定が無い', make: () => ({ v: zoneGrid }) },
    far: { n: '指定容積率（PLATEAU 都市計画決定情報）', unit: '%', nearest: true, fixedMax: 800, note: '用途地域ごとに指定された容積率の上限', make: () => ({ v: farGrid }) },
    empHotel: { n: '宿泊業の従業者数（経済センサス 小分類・500m）', unit: '人/ha', nearest: true, note: '旅館・ホテルの従業者数', make: () => econLayer(c => c.empHotel ?? 0) },
    empAttr: { n: '集客施設の従業者数（経済センサス 小分類・500m）', unit: '人/ha', nearest: true, note: '映画館、興行場・興行団、博物館・美術館、動物園・水族館の従業者数の合計', make: () => econLayer(c => c.empAttr ?? 0) },
    empDept: { n: '百貨店・総合スーパーの従業者数（経済センサス 小分類・500m）', unit: '人/ha', nearest: true, note: '百貨店・総合スーパーの従業者数', make: () => econLayer(c => c.empDept ?? 0) },
    estMed: { n: '病院・診療所の数（経済センサス 小分類・500m）', unit: '件/ha', nearest: true, note: '病院、一般診療所、歯科診療所の事業所数の合計', make: () => econLayer(c => c.estMed ?? 0) },
  };
  const DIV = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'].map(hexRGB);
  const DIFFS = {
    none: { n: 'なし' },
    holiday: { n: '休日 − 平日', ok: L => L.time || L.dayDep, pair: () => [Q({ dayKey: 'holiday', day: people.dayOf('holiday') }), Q({ dayKey: 'weekday', day: people.dayOf('weekday') })] },
    scenario: { n: 'シナリオ − 通常', ok: L => L.time, pair: () => [Q(), Q({ model: people.base })] },
    prev: { n: '現在 − 1 時間前', ok: L => L.time, pair: () => [Q(), Q({ hour: (people.state.hour + 23) % 24 })] },
  };
  function fillTexture(d, t, v, max, stops, L) {
    for (let i = 0; i < v.length; i++) { const x = v[i], o = i * 4; if (L.zeroOk ? x < 0 : x <= max * 0.01) { d[o + 3] = 0; continue; } const tt = Math.min(1, x / max), c = rampAt(stops, L.zeroOk ? tt : Math.sqrt(tt)); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = L.zeroOk ? 215 : Math.round(90 + 150 * Math.min(1, tt * 3)); }
    t.magFilter = L.nearest ? THREE.NearestFilter : THREE.LinearFilter; t.needsUpdate = true;
  }
  function paint() {
    const L = LAYERS[S.layer]; if (!L.make || !people.model) { heat.visible = false; cur = null; renderLegend(); paint2(); return; }
    if (L.cat) {   // 区分 (用途地域): コードごとの色で塗る
      const v = L.make().v, cols = ZN.map(n => hexRGB(ZCOL[n] ?? '#999999')); for (let i = 0; i < v.length; i++) { const o = i * 4, c = v[i]; if (!c) { data[o + 3] = 0; continue; } const k = cols[c - 1]; data[o] = k[0]; data[o + 1] = k[1]; data[o + 2] = k[2]; data[o + 3] = 200; }
      tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true; heat.material.opacity = S.opacity; heat.visible = true; cur = { v, max: 1, unit: '', stops: [], L, cat: true }; renderLegend(); paint2(); return;
    }
    const D = DIFFS[S.diff];
    if (D.pair && D.ok(L)) {   // 差分: 2 条件の値の差を、青 (減) − 白 − 赤 (増) で塗る
      const [qa, qb] = D.pair(), va = L.make(qa).v, vb = L.make(qb).v, v = new Float32Array(va.length); let abs = new Float32Array(va.length); for (let i = 0; i < v.length; i++) { v[i] = va[i] - vb[i]; abs[i] = Math.abs(v[i]); }
      const max = Math.max(1e-6, pctl(abs, 0.985));
      for (let i = 0; i < v.length; i++) { const o = i * 4, t = Math.max(-1, Math.min(1, v[i] / max)); if (Math.abs(t) < 0.03) { data[o + 3] = 0; continue; } const c = rampAt(DIV, 0.5 + 0.5 * Math.sign(t) * Math.sqrt(Math.abs(t))); data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = Math.round(110 + 135 * Math.min(1, Math.abs(t) * 2.5)); }
      tex.magFilter = L.nearest ? THREE.NearestFilter : THREE.LinearFilter; tex.needsUpdate = true; heat.material.opacity = S.opacity; heat.visible = true;
      cur = { v, max, unit: L.unit, stops: DIV, L, diff: D }; renderLegend(); paint2(); return;
    }
    const v = L.make().v, max = L.fixedMax ?? Math.max(1e-6, pctl(v, 0.985)), stops = RAMPS[L.ramp ?? (S.dark ? 'dark' : 'light')].map(hexRGB);
    fillTexture(data, tex, v, max, stops, L); heat.material.opacity = S.opacity; heat.visible = true;
    cur = { v, max, unit: L.unit, stops, L }; renderLegend(); paint2();
  }
  function paint2() {   // 画面分割の右側
    restyle(); renderMulti();
    const L = LAYERS[S.layer2], on = S.split && L?.make && people.model && cur;
    if (!on) { heat2.visible = false; cur2 = null; splitU.value = -1; if ($('an-divider')) $('an-divider').style.display = 'none'; return; }
    const v = L.make().v, max = L.fixedMax ?? Math.max(1e-6, pctl(v, 0.985)), stops = RAMPS[L.ramp ?? (S.dark ? 'dark' : 'light')].map(hexRGB);
    fillTexture(data2, tex2, v, max, stops, L); heat2.material.opacity = S.opacity; heat2.visible = true; cur2 = { v, max, unit: L.unit, stops, L }; placeDivider();
  }
  function placeDivider() {
    const el = $('an-divider'); if (!el) return; const r = renderer.domElement.getBoundingClientRect(); splitU.value = S.splitX * renderer.domElement.width;
    el.style.display = 'block'; el.style.left = (r.left + S.splitX * r.width) + 'px'; el.querySelector('.an-dl').textContent = '◀ ' + LAYERS[S.layer].n; el.querySelector('.an-dr').textContent = LAYERS[S.layer2].n + ' ▶';
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
    $('an-legend').innerHTML = !cur ? '' : cur.cat ? `<div class="legend" style="margin-top:4px">${[...new Set(cur.v)].filter(c => c).sort((a, b) => a - b).map(c => `<span><i style="background:${ZCOL[ZN[c - 1]]}"></i>${ZN[c - 1]}</span>`).join('')}</div><div class="note">${cur.L.note}</div>` : cur.diff ? `<div class="an-grad" style="background:${grad(cur.stops)}"></div><div class="an-ticks"><span>−${fmt(cur.max)}</span><span>減</span><span>0</span><span>増</span><span>+${fmt(cur.max)}</span><span class="an-unit">${cur.unit}</span></div><div class="note">差分: ${cur.diff.n}（${hourTxt()} 時点）</div>` : `<div class="an-grad" style="background:${grad(cur.stops)}"></div><div class="an-ticks">${ticks(cur.max, cur.unit, !cur.L.zeroOk)}</div><div class="note">${cur.L.note ?? ''}${cur.L.time ? `（${hourTxt()} 時点）` : ''}${S.diff !== 'none' ? '<br>この指標は選んだ差分に対応していません。' : ''}</div>`;
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
  // フロアガイドのある建物どうしの比較 (店舗数、階数、用途構成、階ごとの店舗数、推計の滞在人数)
  function guideCompare(curBid) {
    const CATS = ['飲食', '物販', 'サービス', 'オフィス', '医療', '公共', '宿泊', 'その他'];
    const find = name => { let i = buildingMeta.findIndex(m => m && m.n === name); if (i < 0) i = buildingMeta.findIndex(m => m && m.n && m.n.includes(name)); if (i < 0) i = buildingMeta.findIndex(m => m && m.n && m.n.length >= 5 && name.includes(m.n)); return i; };
    const rows = guides().filter(([name]) => !name.includes('架空')).map(([name, g]) => { const bi = find(name); const cats = {}; let n = 0; const per = []; for (const [fl, zs] of g) { per.push([fl, zs.length]); for (const z of zs) { const k = CATS.includes(z.category) ? z.category : 'その他'; cats[k] = (cats[k] || 0) + 1; n++; } } per.sort((a, b) => a[0] - b[0]); const bf = bi >= 0 ? people.buildingFlows(buildingMeta[bi].runtime ? -2 : bi) : null; return { name, bi, cats, n, per, bf }; }).filter(r => r.n > 0 && r.bi >= 0 && !buildingMeta[r.bi].runtime).sort((a, b) => b.n - a.n);
    if (rows.length < 2) return ''; const pm = Math.max(1, ...rows.flatMap(r => r.per.map(q => q[1])));
    return `<div class="sec-title" style="margin-top:8px">フロアガイドのある建物の比較</div>${rows.map(r => `<div class="an-cmp${r.bi === curBid ? ' cur' : ''}" data-b="${r.bi}"><div class="an-cmp-h"><b>${r.name}</b><span>${r.n} 店・${r.per.length} 階${r.bf ? `・滞在 ${fmtN(r.bf.presence)} 人` : ''}</span></div><div class="an-bar" style="height:7px;display:flex">${CATS.filter(k => r.cats[k]).map(k => `<i style="flex:${r.cats[k]};background:${catColor(k)};border-radius:0" title="${k} ${r.cats[k]} 店（${Math.round(r.cats[k] / r.n * 100)}%）"></i>`).join('')}</div><div class="an-strip">${r.per.map(([fl, c]) => `<i style="background:rgba(253,141,60,${(0.15 + 0.85 * c / pm).toFixed(2)})" title="${floorLabel(fl)}: ${c} 店">${floorLabel(fl)}</i>`).join('')}</div></div>`).join('')}<div class="note" style="margin-top:2px">帯 = 用途別の店舗数の割合、下段 = 階ごとの店舗数（濃いほど多い）。行をクリックでその建物を選択。</div>`;
  }
  const bindCompare = el => el.querySelectorAll('.an-cmp').forEach(d => d.addEventListener('click', () => { const b = Number(d.dataset.b), m = buildingMeta[b]; selectBuilding(b); const x = m.c[0] / 10, z = -m.c[1] / 10, h = m.h ?? 40; flyTo(new THREE.Vector3(x - 180 - h * 0.5, 120 + h * 0.8, z + 200 + h * 0.5), new THREE.Vector3(x, h * 0.35, z)); }));
  const syncFlows = () => { if (!flows) return; const sel = getSel(); if (S.flows && sel && sel.bid >= 0) flows.show(sel.bid); else flows.hide(); };
  function renderBuilding() {
    const el = $('an-bldg'); if (!el) return; const fs = floorStats();
    if (!fs) { el.innerHTML = '<div class="note">建物をクリックして選択すると、階ごと・区画ごとの推計人数と、その建物について使えるデータが出ます。</div>' + guideCompare(-1); bindCompare(el); return; }
    const { m, bf, pres, rows, zones, sel } = fs, guide = guideFor(m.n), nGuide = guide ? [...guide.values()].reduce((s, z) => s + z.length, 0) : 0, nPoi = poiOf(sel.bid).length, nZone = sel.zones.filter(z => !z.isCor).length, rk = m.rk;
    const mx = Math.max(1e-6, ...rows.map(r => r.people)), big = rows.length > 24, show = big ? rows.filter((_, i) => i % Math.ceil(rows.length / 24) === 0) : rows;
    const gf = indoor.gridFloors, gridN = gf.length, gridOpen = gf.filter(g => g.open).length;
    // 階別の用途構成 (区画数の積み上げ)
    const CATS = ['飲食', '物販', 'サービス', 'オフィス', '医療', '公共', '宿泊', 'その他'], zrows = rows.filter(r => r.zones.length), zmax = Math.max(1, ...zrows.map(r => r.zones.length));
    const comp = zrows.length ? `<div class="sec-title" style="margin-top:6px">階別の用途構成（区画数）</div><div class="an-floors">${zrows.map(r => { const c = {}; for (const z of r.zones) { const k = CATS.includes(z.zone?.category) ? z.zone.category : 'その他'; c[k] = (c[k] || 0) + 1; } return `<div class="an-frow"><span class="an-fl">${floorLabel(r.fl)}</span><span class="an-bar" style="height:8px;display:flex;background:none"><span style="display:flex;width:${r.zones.length / zmax * 100}%">${CATS.filter(k => c[k]).map(k => `<i style="flex:${c[k]};background:${catColor(k)};border-radius:0" title="${k} ${c[k]}"></i>`).join('')}</span></span><span class="an-fv">${r.zones.length}</span><span class="an-fz"></span></div>`; }).join('')}</div><div class="legend">${CATS.filter(k => zrows.some(r => r.zones.some(z => (CATS.includes(z.zone?.category) ? z.zone.category : 'その他') === k))).map(k => `<span><i style="background:${catColor(k)}"></i>${k}</span>`).join('')}</div>` : '';
    const bars = show.map(r => { const cats = {}; for (const z of r.zones) cats[z.zone?.category ?? 'その他'] = (cats[z.zone?.category ?? 'その他'] || 0) + 1; const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]; return `<div class="an-frow"><span class="an-fl">${floorLabel(r.fl)}</span><span class="an-bar"><i style="width:${Math.max(1, r.people / mx * 100)}%;background:${top ? catColor(top[0]) : '#7f93b8'}"></i></span><span class="an-fv">${fmtN(r.people)}</span><span class="an-fz">${r.zones.length ? r.zones.length + ' 区画' : ''}</span></div>`; }).join('');
    el.innerHTML = `<div class="an-title">${m.n ?? '（名称なし）'}</div>
      <div class="an-kv"><span>高さ</span><b>${Math.round(m.h ?? (m.z[1] - m.z[0]))} m</b><span>推定階数</span><b>${sel.floors} 階</b><span>用途（推定）</span><b>${USE[bf?.use]?.[0] ?? '—'}</b><span>滞在（推計）</span><b>${fmtN(pres)} 人</b></div>
      <div class="an-kv"><span>津波</span><b>${rk?.[0] ? rk[0] + ' m' : '想定なし'}</b><span>高潮</span><b>${rk?.[1] ? rk[1] + ' m' : '想定なし'}</b><span>洪水</span><b>${rk?.[2] ? rk[2] + ' m' : '想定なし'}</b><span></span><b></b></div>
      <label class="row"><input type="checkbox" id="an-floorheat" ${S.floorHeat ? 'checked' : ''}/><span class="chip" style="background:linear-gradient(90deg,#ffeda0,#fd8d3c,#b10026)"></span>フロアと区画を推計人数で色分け</label>
      <label class="row"><input type="checkbox" id="an-flows" ${S.flows ? 'checked' : ''}/><span class="chip" style="background:linear-gradient(90deg,#4da3ff,#9a7bff)"></span>商圏・回遊の流線（どこから来て、次にどこへ）</label>
      ${gridN ? `<label class="row"><input type="checkbox" id="an-flow" ${indoor.state.flow ? 'checked' : ''}/><span class="chip" style="background:linear-gradient(90deg,#fed976,#e31a1c)"></span>通路の動線密度（${gridN} 階）</label>${indoor.state.flow ? `<div class="note" style="margin-top:0">最も通る場所で 約 ${fmtN(indoor.flowMax)} 人/時（1.5 m 格子）。区画の外側を通路とみなし、昇降コアと入口から各区画の前までの経路を重ねたもの。${gridOpen ? `うち ${gridOpen} 階は通路の形が取れておらず、階全体を歩ける前提。` : ''}</div>` : ''}` : ''}
      <div class="sec-title" style="margin-top:4px">階ごとの推計滞在人数（${hourTxt()}）${big ? '・抜粋' : ''}</div><div class="an-floors">${bars}</div>
      ${zones.length ? `<div class="sec-title" style="margin-top:6px">区画の上位（推計滞在人数）</div><table class="p-table">${zones.slice(0, 8).map(z => `<tr><td>${floorLabel(z.z.fl)} ${z.z.zone?.name || z.z.zone?.zone || ''}</td><td>${z.z.zone?.category ?? ''}</td><td>${fmtN(z.people)}</td></tr>`).join('')}</table>` : ''}
      ${flowsHTML()}${comp}${guideCompare(sel.bid)}
      <div class="sec-title" style="margin-top:6px">この建物の内部について使えるデータ</div>
      <div class="note" style="margin-top:0">公式フロアガイド ${nGuide ? nGuide + ' 件' : 'なし'} ／ 区画形状 ${nZone ? nZone + ' 区画' : 'なし'} ／ OSM の店舗 ${nPoi} 件 ／ 入口 ${indoor.model.ents.length} か所（歩行者ネットワーク）<br>国交省の屋内地図オープンデータと PLATEAU LOD4 は、この建物については公開されていません。階ごとの人数は、滞在人数を階と区画の用途で按分した推計です。</div>`;
    $('an-floorheat').addEventListener('change', e => { S.floorHeat = e.target.checked; applyFloorHeat(); });
    if ($('an-flow')) $('an-flow').addEventListener('change', e => { indoor.set({ flow: e.target.checked }); renderBuilding(); });
    $('an-flows').addEventListener('change', e => { S.flows = e.target.checked; syncFlows(); renderBuilding(); });
    el.querySelectorAll('tr[data-b]').forEach(tr => tr.addEventListener('click', () => { const b = Number(tr.dataset.b); if (b >= 0) selectBuilding(b); }));
    bindCompare(el);
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
      ${sankeyHTML()}
      ${originHTML()}
      <div class="btn-row" style="margin-top:6px"><button id="an-x-b">建物指標 CSV</button><button id="an-x-l">区間 GeoJSON</button><button id="an-x-m">メッシュ CSV</button></div>
      <div class="an-share"><div class="sec-title">表示状態の保存・共有</div><div class="btn-row" style="margin:2px 0"><button id="an-s-link">リンクをコピー</button><button id="an-s-save">状態を保存</button><button id="an-s-load">読み込む</button></div><div class="btn-row" style="margin:2px 0"><button id="an-s-report">レポートを出力（地図・表・グラフを 1 つの HTML に）</button></div><div id="an-s-msg" class="note" style="margin-top:0"></div></div>
      <div class="note" style="margin-top:0">行をクリックするとその場所へ移動します。集計の範囲は対象範囲（約 2.8 × 2.55 km）にかかるメッシュの合計で、範囲外を含みます。</div>`;
    el.querySelectorAll('tr[data-b]').forEach(tr => tr.addEventListener('click', () => { const b = Number(tr.dataset.b), m = buildingMeta[b]; selectBuilding(b); const x = m.c[0] / 10, z = -m.c[1] / 10, h = (m.h ?? 40); flyTo(new THREE.Vector3(x - 180 - h * 0.5, 120 + h * 0.8, z + 200 + h * 0.5), new THREE.Vector3(x, h * 0.35, z)); }));
    el.querySelectorAll('tr[data-x]').forEach(tr => tr.addEventListener('click', () => { const x = Number(tr.dataset.x), z = -Number(tr.dataset.y); flyTo(new THREE.Vector3(x - 90, 130, z + 110), new THREE.Vector3(x, 0, z)); }));
    $('an-x-b').addEventListener('click', exportBuildings); $('an-x-l').addEventListener('click', exportLinks); $('an-x-m').addEventListener('click', exportMesh);
    const msg = t => { $('an-s-msg').textContent = t; };
    $('an-s-link').addEventListener('click', () => { if (!share) return; const u = share.link(); (navigator.clipboard?.writeText(u) ?? Promise.reject()).then(() => msg('リンクをコピーしました。開くと同じ表示になります。'), () => msg(u)); });
    $('an-s-save').addEventListener('click', () => { if (share) { download('minatomirai_view.json', JSON.stringify(share.get(), null, 1), 'application/json'); msg('表示状態を JSON で保存しました。'); } });
    $('an-s-load').addEventListener('click', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = () => inp.files[0]?.text().then(t => { try { share.apply(JSON.parse(t.replace(/^\ufeff/, ''))); msg('読み込みました。'); } catch (e) { msg('読み込めませんでした: ' + e.message); } }); inp.click(); });
    $('an-s-report').addEventListener('click', () => { makeReport(); msg('レポートを出力しました。'); });
  }
  // 来訪者の発地構成 (人流オープンデータ 市区町村単位発地別)。区単位の値で、対象範囲より広い
  function originHTML() {
    const o = stats?.origin; if (!o) return ''; const col = ['#6fdc7a', '#4da3ff', '#ffb347', '#e040fb'];
    const bar = (lab, a) => { const t = a.reduce((x, y) => x + y, 0) || 1; return `<div class="an-frow"><span class="an-fl" style="width:44px">${lab}</span><span class="an-bar" style="height:9px;display:flex">${a.map((v, i) => `<i style="width:${v / t * 100}%;background:${col[i]};border-radius:0" title="${o.areas[i]} ${fmtN(v)} 人（${Math.round(v / t * 100)}%）"></i>`).join('')}</span><span class="an-fv" style="width:52px">${fmtN(t)}</span></div>`; };
    return `<div class="sec-title" style="margin-top:6px">滞在している人の発地（区単位・2019 年）</div>${o.cities.map(c => `<div style="font-size:10px;color:#c6d4e8;margin-top:2px">${c.n}</div>${bar('平日昼', c.wkDay)}${bar('休日昼', c.holDay)}${bar('深夜', c.wkNight)}`).join('')}<div class="legend" style="margin-top:2px">${o.areas.map((a, i) => `<span><i style="background:${col[i]}"></i>${a}</span>`).join('')}</div><div class="note" style="margin-top:0">平日昼の県外からの割合: 西区 ${Math.round((o.cities[0].wkDay[2] + o.cities[0].wkDay[3]) / o.cities[0].wkDay.reduce((x, y) => x + y, 0) * 100)}%、中区 ${Math.round((o.cities[1].wkDay[2] + o.cities[1].wkDay[3]) / o.cities[1].wkDay.reduce((x, y) => x + y, 0) * 100)}%。</div>`;
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
  // ---- 比較: 散布図 ----
  const BLK = 25, BX = Math.floor(NX / BLK), BY = Math.floor(NY / BLK);   // 250 m のブロック
  const staticRaster = new Map();
  const rasterOf = key => { const L = LAYERS[key]; if (!L?.make) return null; if (L.time || L.dayDep) return L.make().v; if (!staticRaster.has(key) || staticRaster.get(key).m !== people.model) staticRaster.set(key, { m: people.model, v: L.make().v }); return staticRaster.get(key).v; };
  const blocks = v => { const out = []; for (let by = 0; by < BY; by++) for (let bx = 0; bx < BX; bx++) { let s = 0, n = 0; for (let y = by * BLK; y < (by + 1) * BLK; y++) for (let x = bx * BLK; x < (bx + 1) * BLK; x++) { const q = v[y * NX + x]; if (q >= 0) { s += q; n++; } } out.push(n ? s / n : 0); } return out; };
  let scPts = [];
  function scatterData() {
    if (S.scUnit === 'mesh') {
      const vx = rasterOf(S.scX), vy = rasterOf(S.scY); if (!vx || !vy) return { pts: [], ux: '', uy: '' }; const ax = blocks(vx), ay = blocks(vy), pts = [];
      for (let i = 0; i < ax.length; i++) if (ax[i] > 0 || ay[i] > 0) pts.push({ x: ax[i], y: ay[i], px: BOX[0] + ((i % BX) + 0.5) * BLK * CELL, py: BOX[1] + (Math.floor(i / BX) + 0.5) * BLK * CELL, n: `メッシュ (${i % BX + 1}, ${Math.floor(i / BX) + 1})` });
      return { pts, ux: LAYERS[S.scX].unit, uy: LAYERS[S.scY].unit, nx: LAYERS[S.scX].n, ny: LAYERS[S.scY].n };
    }
    const fx = BM[S.scX]?.val?.(), fy = BM[S.scY]?.val?.(); if (!fx || !fy) return { pts: [], ux: '', uy: '' }; let pts = [];
    for (const d of people.model.dests) { if (d.b < 0) continue; const x = fx(d.b), y = fy(d.b); if (x > 0 && y > 0) pts.push({ x, y, px: d.x, py: d.y, n: d.n ?? '（名称なし）', b: d.b }); }
    if (pts.length > 1400) { pts.sort((p, q) => q.x * q.y - p.x * p.y); pts = pts.slice(0, 1400); }
    return { pts, ux: BM[S.scX].unit, uy: BM[S.scY].unit, nx: BM[S.scX].n, ny: BM[S.scY].n };
  }
  function renderScatter() {
    const el = $('an-scatter'); if (!el || !people.model) return; const { pts, ux, uy, nx, ny } = scatterData(); scPts = pts;
    if (pts.length < 3) { el.innerHTML = '<div class="note">点が足りません。別の指標を選んでください。</div>'; return; }
    const W = 312, H = 196, L = 34, B = 22, T = 6, R = 6, mx = Math.max(...pts.map(p => p.x)), my = Math.max(...pts.map(p => p.y)), X = v => L + Math.sqrt(v / mx) * (W - L - R), Y = v => H - B - Math.sqrt(v / my) * (H - B - T);
    const n = pts.length, sx = pts.reduce((s, p) => s + p.x, 0) / n, sy = pts.reduce((s, p) => s + p.y, 0) / n; let cxy = 0, cxx = 0, cyy = 0; for (const p of pts) { cxy += (p.x - sx) * (p.y - sy); cxx += (p.x - sx) ** 2; cyy += (p.y - sy) ** 2; } const r = cxx > 0 && cyy > 0 ? cxy / Math.sqrt(cxx * cyy) : 0;
    let g = ''; for (const t of [0.25, 0.5, 0.75, 1]) { const vx = t * t * mx, vy = t * t * my; g += `<line x1="${X(vx)}" y1="${T}" x2="${X(vx)}" y2="${H - B}" stroke="rgba(120,180,255,.12)"/><text x="${X(vx)}" y="${H - B + 9}" font-size="7" fill="#7d93b5" text-anchor="middle">${fmt(vx)}</text><line x1="${L}" y1="${Y(vy)}" x2="${W - R}" y2="${Y(vy)}" stroke="rgba(120,180,255,.12)"/><text x="${L - 3}" y="${Y(vy) + 2}" font-size="7" fill="#7d93b5" text-anchor="end">${fmt(vy)}</text>`; }
    const dots = pts.map((p, i) => `<circle data-i="${i}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${S.scUnit === 'mesh' ? 3.2 : 2}" fill="#ffb347" fill-opacity="0.75" stroke="#08101e" stroke-width="0.4"><title>${p.n}\n${fmt(p.x)} ${ux} / ${fmt(p.y)} ${uy}</title></circle>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;cursor:pointer"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - B - T}" fill="rgba(60,90,140,.12)"/>${g}${dots}<text x="${(L + W - R) / 2}" y="${H - 2}" font-size="8" fill="#9fb3d1" text-anchor="middle">${nx}（${ux}）</text><text x="8" y="${(T + H - B) / 2}" font-size="8" fill="#9fb3d1" text-anchor="middle" transform="rotate(-90 8 ${(T + H - B) / 2})">${ny}（${uy}）</text></svg>
      <div class="note" style="margin-top:0">${S.scUnit === 'mesh' ? '250m メッシュ' : '建物'} ${n} 点 ／ 相関係数 r = <b style="color:#ffd94d">${r.toFixed(2)}</b>（軸は平方根目盛）。点をクリックでその場所へ移動。</div>`;
    el.querySelectorAll('circle').forEach(c => c.addEventListener('click', () => { const p = scPts[Number(c.dataset.i)]; if (p.b != null) selectBuilding(p.b); flyTo(new THREE.Vector3(p.px - 160, 260, -p.py + 220), new THREE.Vector3(p.px, 0, -p.py)); }));
  }
  // ---- 比較: 範囲を囲んで集計 / 地点を選ぶ ----
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const groundPoint = e => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, getCamera()); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: -hit.z } : null; };
  const rangeGeo = new THREE.BufferGeometry(); rangeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const rangeLine = new THREE.LineLoop(rangeGeo, new THREE.LineBasicMaterial({ color: '#0077ff', depthTest: false, transparent: true })); rangeLine.renderOrder = 40; rangeLine.visible = false; rangeLine.frustumCulled = false; scene.add(rangeLine);
  const rangeFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#00a2ff', transparent: true, opacity: 0.2, depthTest: false, side: THREE.DoubleSide })); rangeFill.rotation.x = -Math.PI / 2; rangeFill.renderOrder = 39; rangeFill.visible = false; scene.add(rangeFill);
  const pointMark = new THREE.Mesh(new THREE.RingGeometry(5, 8, 32), new THREE.MeshBasicMaterial({ color: '#ff3df2', transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide })); pointMark.rotation.x = -Math.PI / 2; pointMark.renderOrder = 41; pointMark.visible = false; scene.add(pointMark);
  const drawRange = (a, b) => { const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), p = rangeGeo.attributes.position; p.setXYZ(0, x0, 4, -y0); p.setXYZ(1, x1, 4, -y0); p.setXYZ(2, x1, 4, -y1); p.setXYZ(3, x0, 4, -y1); p.needsUpdate = true; rangeLine.visible = true; rangeFill.position.set((x0 + x1) / 2, 3.5, -(y0 + y1) / 2); rangeFill.scale.set(Math.max(1, x1 - x0), Math.max(1, y1 - y0), 1); rangeFill.visible = true; return [x0, y0, x1, y1]; };
  let capMode = null, justCaptured = false, dragStart = null;
  const setCap = m => { capMode = m; setNavEnabled(!m); renderer.domElement.style.cursor = m ? 'crosshair' : ''; if ($('an-range')) $('an-range').classList.toggle('active', m === 'range'); if ($('an-pick')) $('an-pick').classList.toggle('active', m === 'point'); };
  const el0 = renderer.domElement;
  el0.addEventListener('pointerdown', e => { if (capMode === 'range' && e.button === 0) dragStart = groundPoint(e); });
  el0.addEventListener('pointerup', e => {
    if (!capMode) return; justCaptured = true; setTimeout(() => { justCaptured = false; }, 0); const g = groundPoint(e);
    if (capMode === 'range') { if (dragStart && g) { const r = drawRange(dragStart, g); if ((r[2] - r[0]) * (r[3] - r[1]) > 400) { S.range = r; renderRange(); if (S.tsTarget === 'range') renderTS(); } } dragStart = null; setCap(null); }
    else if (capMode === 'point' && g) { let best = -1, bd = 60; graph.links.forEach((l, i) => { const h = Math.hypot(l.bx - l.ax, l.by - l.ay); if (h < 1) return; const t = Math.max(0, Math.min(1, ((g.x - l.ax) * (l.bx - l.ax) + (g.y - l.ay) * (l.by - l.ay)) / (h * h))), d = Math.hypot(l.ax + (l.bx - l.ax) * t - g.x, l.ay + (l.by - l.ay) * t - g.y) + Math.abs(graph.nodes[l.a].lv) * 15; if (d < bd) { bd = d; best = i; } }); if (best >= 0) { const l = graph.links[best]; S.tsPoint = { li: best, x: (l.ax + l.bx) / 2, y: (l.ay + l.by) / 2 }; pointMark.position.set(S.tsPoint.x, terrainSampler(S.tsPoint.x, S.tsPoint.y) + 2.5, -S.tsPoint.y); pointMark.visible = true; S.tsTarget = 'point'; if ($('an-ts-target')) $('an-ts-target').value = 'point'; renderTS(); } setCap(null); }
  });
  const inRange = (x, y) => S.range && x >= S.range[0] && x <= S.range[2] && y >= S.range[1] && y <= S.range[3];
  const integrate = v => { if (!v || !S.range) return 0; const x0 = Math.max(0, Math.floor((S.range[0] - BOX[0]) / CELL)), x1 = Math.min(NX, Math.ceil((S.range[2] - BOX[0]) / CELL)), y0 = Math.max(0, Math.floor((S.range[1] - BOX[1]) / CELL)), y1 = Math.min(NY, Math.ceil((S.range[3] - BOX[1]) / CELL)); let s = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const q = v[y * NX + x]; if (q > 0) s += q; } return s * 0.01; };
  function renderRange() {
    const el = $('an-range-out'); if (!el) return; if (!S.range || !people.model) { el.innerHTML = '<div class="note" style="margin-top:0">「範囲を選ぶ」を押してから、地図上をドラッグして四角形で囲みます。</div>'; return; }
    const r = S.range, area = (r[2] - r[0]) * (r[3] - r[1]) / 10000; let nb = 0, nrisk = 0, np = 0; for (const d of people.model.dests) if (d.b >= 0 && inRange(d.x, d.y)) { nb++; if ((buildingMeta[d.b].rk?.[0] ?? 0) >= 0.5) nrisk++; } for (const q of header.poi || []) if (inRange(q.x / 10, q.y / 10)) np++;
    const prAll = people.model.presence(people.state.hour, day()); let stayIn = 0; people.model.dests.forEach((d, i) => { if (d.b >= 0 && inRange(d.x, d.y) && prAll[i] > 0) stayIn += prAll[i]; });   // 建物の重心が範囲内のものを数える (推移グラフと同じ基準)
    const row = (n, v, u, src) => `<tr><td>${n}</td><td>${v} ${u}</td><td style="color:#6f84a6">${src}</td></tr>`, hol = people.state.day === 'holiday';
    el.innerHTML = `<table class="p-table">${row('面積', area.toFixed(1), 'ha', `${Math.round(r[2] - r[0])} × ${Math.round(r[3] - r[1])} m`)}${row('歩行中', fmtN(integrate(rasterOf('ped'))), '人', 'モデル ' + hourTxt())}${row('建物に滞在', fmtN(stayIn), '人', 'モデル ' + hourTxt())}${row(`実測 昼間人口（${hol ? '休日' : '平日'}）`, fmtN(integrate(rasterOf('obs'))), '人', '人流データ 1km 按分')}${row('夜間人口', fmtN(integrate(rasterOf('census'))), '人', '国勢調査 250m 按分')}${row('従業者数', fmtN(integrate(rasterOf('emp'))), '人', '経済センサス 500m 按分')}${row('建物', fmtN(nb), '棟', `うち津波 0.5m 以上 ${fmtN(nrisk)} 棟`)}${row('店舗・施設', fmtN(np), '件', 'OSM')}</table><div class="note" style="margin-top:0">メッシュ統計は、範囲と重なる面積で按分した値です。</div>`;
  }
  // ---- 推移 (24 時間の時系列) ----
  const HOURS = Array.from({ length: 49 }, (_, i) => i * 0.5);
  const cumCache = new Map();   // モデル・曜日ごと: 各クラスの時刻別の発生量と累積
  function classSeries(model, dayKey) {
    const k = dayKey + '|' + people.state.rain + '|' + people.state.event; let e = cumCache.get(model); if (e && e.k === k) return e.v; const dd = people.dayOf(dayKey);
    const v = model.classes.map(c => { const rate = HOURS.map(h => c.rate(Math.min(h, 23.99), dd)), cum = new Float32Array(HOURS.length); let s = 0; for (let i = 0; i < HOURS.length; i++) { if (HOURS[i] > 4) s += (rate[i] + rate[i - 1]) / 2 * 0.5; cum[i] = s; } return { rate, cum }; });
    cumCache.set(model, { k, v }); return v;
  }
  function seriesOf(model, dayKey) {   // 現在の対象について [{n, v[49]}] を返す
    const cs = classSeries(model, dayKey), dd = people.dayOf(dayKey), T = S.tsTarget, sel = getSel(), zero = () => new Float32Array(HOURS.length);
    if (T === 'bldg' && sel && sel.bid >= 0) {
      const d = model.dests.find(x => buildingMeta[sel.bid]?.runtime ? x.extra : x.b === sel.bid); if (!d) return null; const pres = zero(), arr = zero(), lev = zero();
      model.classes.forEach((c, ci) => { const sh = c.share?.[d.idx]; if (!sh) return; for (let i = 0; i < HOURS.length; i++) { if (c.dir === 'out') { arr[i] += cs[ci].rate[i] * sh; pres[i] += cs[ci].cum[i] * sh; } else { lev[i] += cs[ci].rate[i] * sh; pres[i] -= cs[ci].cum[i] * sh; } } });
      return { title: buildingMeta[sel.bid].n ?? '（名称なし）', unit: '人・人/時', lines: [{ n: '滞在（人）', v: pres.map(x => Math.max(0, x)) }, { n: '来る（人/時）', v: arr }, { n: '出る（人/時）', v: lev }] };
    }
    if (T === 'point' && S.tsPoint) { const li = S.tsPoint.li, v = zero(); model.classes.forEach((c, ci) => { const u = c.U[li]; if (u > 0) for (let i = 0; i < HOURS.length; i++) v[i] += cs[ci].rate[i] * u; }); const l = graph.links[li]; return { title: `地点 (${Math.round(S.tsPoint.x)}, ${Math.round(S.tsPoint.y)})・幅員 ${l.w} m${l.cross ? '・横断歩道' : ''}${l.cov ? '・屋根あり' : ''}`, unit: '人/時', lines: [{ n: '通行量（人/時）', v }], width: l.w }; }
    if (T === 'range' && S.range) {
      const walk = zero(), stay = zero(); const lw = new Float32Array(graph.links.length); graph.links.forEach((l, i) => { if (inRange((l.ax + l.bx) / 2, (l.ay + l.by) / 2)) lw[i] = Math.hypot(l.bx - l.ax, l.by - l.ay) / (WALK_SPEED * 3600); });
      const inb = model.dests.map(d => d.b >= 0 && inRange(d.x, d.y));
      model.classes.forEach((c, ci) => { let k = 0; for (let i = 0; i < lw.length; i++) if (lw[i] > 0 && c.U[i] > 0) k += lw[i] * c.U[i]; let sh = 0; if (c.share) for (let i = 0; i < inb.length; i++) if (inb[i]) sh += c.share[i]; const sg = c.dir === 'out' ? 1 : -1; for (let i = 0; i < HOURS.length; i++) { walk[i] += cs[ci].rate[i] * k; if (sh) stay[i] += sg * cs[ci].cum[i] * sh; } });
      return { title: `選んだ範囲（${((S.range[2] - S.range[0]) * (S.range[3] - S.range[1]) / 10000).toFixed(1)} ha）`, unit: '人', lines: [{ n: '建物に滞在（人）', v: stay.map(x => Math.max(0, x)) }, { n: '歩行中（人）', v: walk }] };
    }
    const v = zero(); model.classes.forEach((c, ci) => { for (let i = 0; i < HOURS.length; i++) v[i] += cs[ci].rate[i] * c.meanDist / WALK_SPEED / 3600; }); return { title: '対象範囲の全体', unit: '人', lines: [{ n: '歩行中（人）', v }] };
  }
  function renderTS() {
    const el = $('an-ts'); if (!el || !people.model) return; const ps = people.state, main = seriesOf(people.model, ps.day);
    if (!main) { el.innerHTML = `<div class="note">${S.tsTarget === 'bldg' ? '建物をクリックして選択してください。' : S.tsTarget === 'point' ? '「地点を選ぶ」を押してから、地図上の歩行者経路の近くをクリックしてください。' : '「比較」タブで範囲を選んでください。'}</div>`; return; }
    const other = S.tsOther ? seriesOf(people.model, ps.day === 'weekday' ? 'holiday' : 'weekday') : null, base = people.base !== people.model ? seriesOf(people.base, ps.day) : null;
    const COL = ['#ffd94d', '#4da3ff', '#ff6f91'], W = 312, H = 150, L = 34, B = 16, T = 6, R = 6; let mx = 1; for (const s of [main, other, base]) if (s) for (const l of s.lines) for (const x of l.v) if (x > mx) mx = x;
    const X = h => L + h / 24 * (W - L - R), Y = v => H - B - v / mx * (H - B - T), path = v => 'M' + Array.from(v, (x, i) => `${X(HOURS[i]).toFixed(1)},${Y(x).toFixed(1)}`).join('L');
    let g = ''; for (const t of [0.25, 0.5, 0.75, 1]) g += `<line x1="${L}" y1="${Y(t * mx)}" x2="${W - R}" y2="${Y(t * mx)}" stroke="rgba(120,180,255,.12)"/><text x="${L - 3}" y="${Y(t * mx) + 2}" font-size="7" fill="#7d93b5" text-anchor="end">${fmt(t * mx)}</text>`; for (const h of [0, 6, 12, 18, 24]) g += `<text x="${X(h)}" y="${H - 4}" font-size="7" fill="#7d93b5" text-anchor="middle">${h}時</text>`;
    let p = ''; if (base) base.lines.forEach((l, i) => { p += `<path d="${path(l.v)}" fill="none" stroke="#9aa3b5" stroke-width="1" stroke-dasharray="1 2"/>`; }); if (other) other.lines.forEach((l, i) => { p += `<path d="${path(l.v)}" fill="none" stroke="${COL[i % 3]}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`; }); main.lines.forEach((l, i) => { p += `<path d="${path(l.v)}" fill="none" stroke="${COL[i % 3]}" stroke-width="1.6"/>`; });
    const idx = Math.round(ps.hour * 2), peakI = main.lines[0].v.reduce((b, x, i, a) => x > a[b] ? i : b, 0), dn = ps.day === 'weekday' ? '平日' : '休日', on = ps.day === 'weekday' ? '休日' : '平日';
    let extra = ''; if (main.width) { const f = main.lines[0].v[peakI] / (60 * main.width), lo = LOS.find(q => f < q.max) ?? LOS[LOS.length - 1]; extra = ` ／ ピーク時の混雑度 <b style="color:${lo.c}">${lo.k}</b>（${f.toFixed(0)} 人/m/分）`; }
    // 時計型: 0 時を上に、時計回りに 24 時間。半径が値
    const PC = [W / 2, 104], PR = 86, PR0 = 16, ang = h => h / 24 * Math.PI * 2 - Math.PI / 2, pp = (h, v) => { const r = PR0 + v / mx * (PR - PR0), a = ang(h); return `${(PC[0] + Math.cos(a) * r).toFixed(1)},${(PC[1] + Math.sin(a) * r).toFixed(1)}`; }, ppath = v => 'M' + Array.from(v, (x, i) => pp(HOURS[i], x)).join('L') + 'Z';
    let chart;
    if (S.tsPolar) {
      let pg = ''; for (const t of [0.25, 0.5, 0.75, 1]) pg += `<circle cx="${PC[0]}" cy="${PC[1]}" r="${PR0 + t * (PR - PR0)}" fill="none" stroke="rgba(120,180,255,.14)"/>`; for (let h = 0; h < 24; h += 3) { const a = ang(h); pg += `<line x1="${PC[0] + Math.cos(a) * PR0}" y1="${PC[1] + Math.sin(a) * PR0}" x2="${PC[0] + Math.cos(a) * PR}" y2="${PC[1] + Math.sin(a) * PR}" stroke="rgba(120,180,255,.12)"/><text x="${PC[0] + Math.cos(a) * (PR + 9)}" y="${PC[1] + Math.sin(a) * (PR + 9) + 3}" font-size="7.5" fill="#7d93b5" text-anchor="middle">${h}時</text>`; }
      let q = ''; if (base) base.lines.forEach(l => { q += `<path d="${ppath(l.v)}" fill="none" stroke="#9aa3b5" stroke-width="1" stroke-dasharray="1 2"/>`; }); if (other) other.lines.forEach((l, i) => { q += `<path d="${ppath(l.v)}" fill="none" stroke="${COL[i % 3]}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`; }); main.lines.forEach((l, i) => { q += `<path d="${ppath(l.v)}" fill="${COL[i % 3]}" fill-opacity="${i === 0 ? 0.22 : 0.08}" stroke="${COL[i % 3]}" stroke-width="1.6"/>`; });
      const ca = ang(ps.hour); chart = `<svg id="an-ts-svg" viewBox="0 0 ${W} 208" width="100%" style="display:block;cursor:pointer">${pg}${q}<line x1="${PC[0] + Math.cos(ca) * PR0}" y1="${PC[1] + Math.sin(ca) * PR0}" x2="${PC[0] + Math.cos(ca) * PR}" y2="${PC[1] + Math.sin(ca) * PR}" stroke="#fff" stroke-width="1.2"/><text x="${PC[0]}" y="${PC[1] + 3}" font-size="8" fill="#eaf4ff" text-anchor="middle">${hourTxt()}</text><text x="${W - 4}" y="10" font-size="7" fill="#7d93b5" text-anchor="end">外周 = ${fmt(mx)}</text></svg>`;
    } else chart = `<svg id="an-ts-svg" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;cursor:pointer"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - B - T}" fill="rgba(60,90,140,.12)"/>${g}${p}<line x1="${X(ps.hour)}" y1="${T}" x2="${X(ps.hour)}" y2="${H - B}" stroke="#fff" stroke-width="1"/></svg>`;
    el.innerHTML = `<div class="an-title">${main.title}</div>${chart}
      <div class="legend">${main.lines.map((l, i) => `<span><i style="background:${COL[i % 3]}"></i>${l.n} いま ${fmtN(l.v[idx] ?? 0)}</span>`).join('')}</div>
      <div class="note" style="margin-top:2px">実線 = ${dn}${other ? `、破線 = ${on}` : ''}${base ? '、点線 = 通常時（シナリオなし）' : ''}。ピークは ${Math.floor(HOURS[peakI])}:${HOURS[peakI] % 1 ? '30' : '00'} 頃 ${fmtN(main.lines[0].v[peakI])}${extra}。グラフをクリックするとその時刻に移動します。</div>`;
    $('an-ts-svg').addEventListener('click', e => { const r = $('an-ts-svg').getBoundingClientRect(); let h; if (S.tsPolar) { const x = (e.clientX - r.left) / r.width * W - PC[0], y = (e.clientY - r.top) / r.height * 208 - PC[1]; h = ((Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2) * 24 + 24) % 24; } else h = ((e.clientX - r.left) / r.width * W - L) / (W - L - R) * 24; setClock(Math.max(0, Math.min(23.75, Math.round(h * 4) / 4))); });
  }
  // ---- ヒートマップの表現: 面 / 立体の柱 / 等値線 ----
  const BG = 5, BXN = NX / BG, BYN = NY / BG;   // 柱は 50 m 格子
  const barGeo = new THREE.BoxGeometry(1, 1, 1); barGeo.translate(0, 0.5, 0);
  const bars = new THREE.InstancedMesh(barGeo, new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.9 }), BXN * BYN); bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bars.visible = false; bars.frustumCulled = false; bars.name = 'analysis-bars'; bars.renderOrder = 3; scene.add(bars);
  // 等値線は画面上の太さを指定できる線 (LineSegments2) で描き、値のラベルを線の上に置く
  const contGeo = new LineSegmentsGeometry(), contours = new LineSegments2(contGeo, new LineMaterial({ vertexColors: true, linewidth: 2.6, transparent: true, depthTest: false })); contours.visible = false; contours.frustumCulled = false; contours.renderOrder = 5; contours.name = 'analysis-contours'; scene.add(contours);
  const contLabels = new THREE.Group(); contLabels.name = 'analysis-contour-labels'; contLabels.visible = false; scene.add(contLabels);
  const contLabel = (text, rgb) => {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 26px sans-serif'; const w = Math.ceil(g.measureText(text).width) + 18; c.width = w; c.height = 36;
    g.fillStyle = S.dark ? 'rgba(8,12,24,0.82)' : 'rgba(255,255,255,0.9)'; g.beginPath(); g.roundRect(0, 0, w, 36, 8); g.fill(); g.font = 'bold 26px sans-serif'; g.textBaseline = 'middle';
    g.fillStyle = `rgb(${rgb.map(q => Math.round(Math.min(1, Math.pow(q, 1 / 2.2)) * (S.dark ? 255 : 150))).join(',')})`; g.fillText(text, 9, 19);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, sizeAttenuation: false, fog: false })); sp.scale.set(w / 36 * 0.019, 0.019, 1); sp.renderOrder = 46; return sp;
  };
  const fmtLv = x => { const a = Math.abs(x); return (x < 0 ? '−' : '') + (a >= 100 ? Math.round(a).toLocaleString('ja-JP') : a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2)); };
  const MS = { 1: [3, 0], 2: [0, 1], 3: [3, 1], 4: [1, 2], 5: [3, 2, 0, 1], 6: [0, 2], 7: [3, 2], 8: [2, 3], 9: [0, 2], 10: [0, 3, 1, 2], 11: [1, 2], 12: [1, 3], 13: [0, 1], 14: [3, 0] };
  function contourSegs(v, level, out) {   // マーチングスクエア法
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = v[j * NX + i], b = v[j * NX + i + 1], c = v[(j + 1) * NX + i + 1], d = v[(j + 1) * NX + i]; if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      const k = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0); if (k === 0 || k === 15) continue;
      const x0 = BOX[0] + (i + 0.5) * CELL, y0 = BOX[1] + (j + 0.5) * CELL, e = q => q === 0 ? [x0 + (level - a) / (b - a) * CELL, y0] : q === 1 ? [x0 + CELL, y0 + (level - b) / (c - b) * CELL] : q === 2 ? [x0 + (level - d) / (c - d) * CELL, y0 + CELL] : [x0, y0 + (level - a) / (d - a) * CELL];
      const T = MS[k]; for (let q = 0; q < T.length; q += 2) { const p = e(T[q]), r = e(T[q + 1]); out.push(p[0], p[1], r[0], r[1]); }
    }
  }
  const lin255 = c => { const k = new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
  function restyle() {
    const ok = cur && !cur.cat && S.style !== 'flat'; bars.visible = !!ok && S.style === 'bars'; contours.visible = contLabels.visible = !!ok && S.style === 'contour';
    if (!ok) { if (cur) heat.material.opacity = S.opacity; return; }
    const v = cur.v, max = cur.max, diff = !!cur.diff, zeroOk = cur.L.zeroOk;
    if (S.style === 'bars') {
      heat.material.opacity = S.opacity * 0.3; const M4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
      for (let by = 0; by < BYN; by++) for (let bx = 0; bx < BXN; bx++) {
        let s = 0, c = 0; for (let y = by * BG; y < (by + 1) * BG; y++) for (let x = bx * BG; x < (bx + 1) * BG; x++) { const q = v[y * NX + x]; if (zeroOk && q < 0) continue; s += q; c++; } if (!c) continue; const val = s / c, t = Math.min(1, Math.abs(val) / max); if (t < 0.02) continue;
        const cx = BOX[0] + (bx + 0.5) * BG * CELL, cy = BOX[1] + (by + 0.5) * BG * CELL, rgb = lin255(diff ? rampAt(DIV, 0.5 + 0.5 * Math.sign(val) * Math.sqrt(t)) : rampAt(cur.stops, zeroOk ? t : Math.sqrt(t)));
        M4.makeScale(BG * CELL * 0.82, 4 + t * 230, BG * CELL * 0.82); M4.setPosition(cx, Math.max(0, terrainSampler(cx, cy)) + 1, -cy); bars.setMatrixAt(n, M4); bars.setColorAt(n, col.setRGB(rgb[0], rgb[1], rgb[2])); n++;
      }
      bars.count = n; bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    } else {
      for (const o of [...contLabels.children]) { contLabels.remove(o); o.material.map.dispose(); o.material.dispose(); }
      heat.material.opacity = S.opacity * 0.45; const marks = [], pos = [], colr = [], levels = zeroOk ? [3, 5, 8, 10, 15] : diff ? [-0.6, -0.3, -0.1, 0.1, 0.3, 0.6].map(t => t * max) : [0.06, 0.15, 0.3, 0.5, 0.75].map(t => t * max);
      for (const lv of levels) { const segs = []; if (diff && lv < 0) { const neg = new Float32Array(v.length); for (let i = 0; i < v.length; i++) neg[i] = Math.max(0, -v[i]); contourSegs(neg, -lv, segs); } else contourSegs(diff ? v.map(x => Math.max(0, x)) : v, lv, segs);
        const t = Math.min(1, Math.abs(lv) / max), rgb = lin255(diff ? rampAt(DIV, lv > 0 ? 0.62 + 0.38 * t : 0.38 - 0.38 * t) : rampAt(cur.stops, zeroOk ? t : Math.max(0.35, Math.sqrt(t)))), k = S.dark ? 1 : 0.72;
        for (let i = 0; i < segs.length; i += 2) { pos.push(segs[i], Math.max(0, terrainSampler(segs[i], segs[i + 1])) + 2.2, -segs[i + 1]); colr.push(rgb[0] * k, rgb[1] * k, rgb[2] * k); }
        // 値のラベル: その等値線の上で、互いに 320 m 以上離れた場所に最大 3 個
        const at = [], nSeg = segs.length / 4; for (let c = 0; c < 14 && at.length < 3 && nSeg > 6; c++) { const i = Math.floor(nSeg * ((c * 0.381966 + 0.19) % 1)) * 4, x = segs[i], y = segs[i + 1]; if (marks.every(m => Math.hypot(m[0] - x, m[1] - y) > 150) && at.every(m => Math.hypot(m[0] - x, m[1] - y) > 320)) { at.push([x, y]); marks.push([x, y]); } }   // 線の全体から黄金比の間隔で候補を取り、地図全体に散らす
        for (const [x, y] of at) { const sp = contLabel(fmtLv(lv) + (lv === levels[levels.length - 1] ? ' ' + (cur.L.unit ?? '') : ''), [rgb[0] * k, rgb[1] * k, rgb[2] * k]); sp.position.set(x, Math.max(0, terrainSampler(x, y)) + 4, -y); contLabels.add(sp); } }
      if (pos.length) { contGeo.setPositions(pos); contGeo.setColors(colr); contGeo.instanceCount = pos.length / 6; contours.visible = true; } else contours.visible = false;
      cur.levels = levels;
    }
  }
  // ---- 時刻別の一覧 (スモールマルチプル) ----
  function renderMulti() {
    const el = $('an-multi'); if (!el) return; const L = LAYERS[S.layer]; if (!S.multi || !L?.make || !L.time || !people.model) { el.innerHTML = S.multi ? '<div class="note" style="margin-top:0">時刻で変わる指標（歩行者密度・滞在人口）を選ぶと、時刻別の一覧が出ます。</div>' : ''; return; }
    const hs = [7.5, 9, 12, 15, 18, 21], vs = hs.map(h => L.make(Q({ hour: h })).v), max = Math.max(1e-6, ...vs.map(v => pctl(v, 0.985))), stops = RAMPS[S.dark ? 'dark' : 'light'].map(hexRGB), K = 3, w = Math.floor(NX / K), hgt = Math.floor(NY / K);
    el.innerHTML = `<div class="an-multi">${hs.map((h, i) => `<div data-h="${h}" class="${Math.abs(h - people.state.hour) < 0.26 ? 'cur' : ''}"><canvas width="${w}" height="${hgt}"></canvas><span>${Math.floor(h)}:${h % 1 ? '30' : '00'}</span></div>`).join('')}</div><div class="note" style="margin-top:0">同じ色の尺度で並べています。クリックでその時刻へ。</div>`;
    el.querySelectorAll('canvas').forEach((cv, i) => { const g = cv.getContext('2d'), im = g.createImageData(w, hgt), d = im.data, v = vs[i]; for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) { let s = 0; for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) s += v[(y * K + dy) * NX + x * K + dx]; const t = Math.min(1, s / (K * K) / max), o = ((hgt - 1 - y) * w + x) * 4; if (t < 0.012) { d[o] = 18; d[o + 1] = 24; d[o + 2] = 40; d[o + 3] = 255; continue; } const c = rampAt(stops, Math.sqrt(t)); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } g.putImageData(im, 0, 0); });
    el.querySelectorAll('[data-h]').forEach(dv => dv.addEventListener('click', () => setClock(Number(dv.dataset.h))));
  }
  // ---- サンキー図: 発着点 → 目的 → 行き先の用途 (駅などから街へ向かう人、1 日) ----
  function sankeyHTML() {
    const model = people.model, d = day(), UG = [['業務', ['off', 'tower', 'pub']], ['商業', ['ret', 'sta']], ['宿泊', ['hot']], ['集客・公園', ['att', 'park']], ['住宅', ['res']], ['その他', ['mix', 'extra']]], ugOf = u => { const i = UG.findIndex(g => g[1].includes(u)); return i < 0 ? 5 : i; };
    const PG = [['通勤', '#4da3ff'], ['来街', '#ffb347'], ['帰宅（住民）', '#6fdc7a'], ['イベント', '#e040fb']], pgOf = c => c.event ? 3 : c.purpose === 'commute' ? 0 : c.purpose === 'visit' ? 1 : 2;
    const ug = model.dests.map(q => ugOf(q.u)), SP = new Map(), PU = PG.map(() => UG.map(() => 0));
    for (const c of model.classes) { if (!c.share || c.dir !== 'out' || c.station == null) continue; let daily = 0; for (let h = 0.25; h < 24; h += 0.5) daily += c.rate(h, d) * 0.5; if (daily < 1) continue; const p = pgOf(c); if (!SP.has(c.station)) SP.set(c.station, PG.map(() => 0)); SP.get(c.station)[p] += daily; for (let i = 0; i < ug.length; i++) if (c.share[i] > 0) PU[p][ug[i]] += daily * c.share[i]; }
    const sts = [...SP].map(([si, a]) => ({ n: model.stations[si].n, a, t: a.reduce((x, y) => x + y, 0) })).sort((a, b) => b.t - a.t), tot = sts.reduce((a, s) => a + s.t, 0); if (tot < 1) return '';
    const W = 312, H = 250, NW = 7, x0 = 78, x1 = 150, x2 = 232, gap = 3, sc = (H - gap * Math.max(sts.length, UG.length)) / tot, pT = PG.map((_, p) => sts.reduce((a, s) => a + s.a[p], 0)), uT = UG.map((_, u) => PU.reduce((a, r) => a + r[u], 0));
    const lay = arr => { let y = 0; return arr.map(v => { const o = { y, h: v * sc }; y += v * sc + (v > 0 ? gap : 0); return o; }); }, ls = lay(sts.map(s => s.t)), lp = lay(pT), lu = lay(uT);
    const band = (xa, ya, xb, yb, h, col) => `<path d="M${xa},${ya.toFixed(1)}C${(xa + xb) / 2},${ya.toFixed(1)} ${(xa + xb) / 2},${yb.toFixed(1)} ${xb},${yb.toFixed(1)}L${xb},${(yb + h).toFixed(1)}C${(xa + xb) / 2},${(yb + h).toFixed(1)} ${(xa + xb) / 2},${(ya + h).toFixed(1)} ${xa},${(ya + h).toFixed(1)}Z" fill="${col}" fill-opacity="0.42"/>`;
    let svg = ''; const pin = PG.map(() => 0), pout = PG.map(() => 0);
    sts.forEach((s, i) => { let off = 0; s.a.forEach((v, p) => { if (v <= 0) return; svg += band(x0 + NW, ls[i].y + off, x1, lp[p].y + pin[p], v * sc, PG[p][1]); off += v * sc; pin[p] += v * sc; }); });
    const uin = UG.map(() => 0); PU.forEach((r, p) => r.forEach((v, u) => { if (v <= 0) return; svg += band(x1 + NW, lp[p].y + pout[p], x2, lu[u].y + uin[u], v * sc, PG[p][1]); pout[p] += v * sc; uin[u] += v * sc; }));
    const lab = (x, o, text, anchor, sub) => o.h > 0.5 ? `<text x="${x}" y="${(o.y + o.h / 2 + 3).toFixed(1)}" font-size="7.5" fill="#c6d4e8" text-anchor="${anchor}">${text}<tspan fill="#7d93b5"> ${sub}</tspan></text>` : '';
    sts.forEach((s, i) => { svg += `<rect x="${x0}" y="${ls[i].y.toFixed(1)}" width="${NW}" height="${Math.max(0.5, ls[i].h).toFixed(1)}" fill="#9fb3d1"/>` + lab(x0 - 3, ls[i], s.n.replace(/（.*）/, ''), 'end', Math.round(s.t / tot * 100) + '%'); });
    PG.forEach((p, i) => { svg += `<rect x="${x1}" y="${lp[i].y.toFixed(1)}" width="${NW}" height="${Math.max(0.5, lp[i].h).toFixed(1)}" fill="${p[1]}"/>` + (lp[i].h > 0.5 ? `<text x="${x1 + NW / 2}" y="${(lp[i].y - 1.5 + (i === 0 ? 9 : 0)).toFixed(1)}" font-size="7.5" fill="${p[1]}" text-anchor="middle">${i === 0 ? '' : p[0]}</text>` : ''); });
    UG.forEach((u, i) => { svg += `<rect x="${x2}" y="${lu[i].y.toFixed(1)}" width="${NW}" height="${Math.max(0.5, lu[i].h).toFixed(1)}" fill="#9fb3d1"/>` + lab(x2 + NW + 3, lu[i], u[0], 'start', fmtN(uT[i])); });
    return `<div class="sec-title" style="margin-top:6px">人の流れの内訳（1 日・街へ向かう人 ${fmtN(tot)} 人）</div><svg viewBox="0 -4 ${W} ${H + 8}" width="100%" style="display:block">${svg}</svg><div class="legend">${PG.map((p, i) => pT[i] > 0 ? `<span><i style="background:${p[1]}"></i>${p[0]} ${Math.round(pT[i] / tot * 100)}%</span>` : '').join('')}</div><div class="note" style="margin-top:0">左 = 発着点（駅・駐車場など）、中 = 目的、右 = 行き先の建物の用途（推定）。帯の太さが人数。</div>`;
  }
  // ---- 商圏・回遊 (選択中の建物) ----
  function flowsHTML() {
    const f = S.flows ? flows?.data : null; if (!f) return '';
    return `<div class="sec-title" style="margin-top:6px">どこから来るか（1 日・モデル推計 ${fmtN(f.total)} 人）</div><div class="an-bar" style="height:9px;display:flex">${f.stations.map(s => `<i style="flex:${Math.max(0.001, s.arrive)};background:${s.color};border-radius:0" title="${s.n} ${fmtN(s.arrive)} 人"></i>`).join('')}</div>
      <table class="p-table">${f.stations.slice(0, 8).map(s => `<tr><td><i class="an-dot" style="background:${s.color}"></i>${s.n}${s.nonRail ? '<sup>仮</sup>' : ''}</td><td>${fmtN(s.arrive)} 人</td><td>${Math.round(s.arrive / f.total * 100)}%</td></tr>`).join('')}</table>
      ${f.next.length ? `<div class="sec-title" style="margin-top:6px">次に向かう先（この建物を出た人の行き先の割合）</div><table class="p-table an-click">${f.next.map(q => `<tr data-b="${q.b}"><td><i class="an-dot" style="background:${q.kind === 'stroll' ? '#9a7bff' : '#ff6f91'}"></i>${q.n}</td><td>${q.kind === 'stroll' ? '回遊' : '昼食'}</td><td>${Math.round(q.p * 100)}%</td></tr>`).join('')}</table>` : '<div class="note">回遊・昼食の起点になるほどの集客力・就業者数がないため、次の行き先は出ません。</div>'}`;
  }
  // ---- 表示状態の保存・共有とレポート ----
  const STATE_KEYS = ['layer', 'opacity', 'bmetric', 'tab', 'floorHeat', 'diff', 'split', 'layer2', 'splitX', 'scUnit', 'scX', 'scY', 'range', 'tsTarget', 'tsPoint', 'tsOther', 'style', 'flows', 'tsPolar', 'multi'];
  const exportState = () => Object.fromEntries(STATE_KEYS.map(k => [k, S[k]]));
  function importState(o) {
    if (!o) return; const st = {}; for (const k of STATE_KEYS) if (k in o) st[k] = o[k]; if (st.tsPoint) { pointMark.position.set(st.tsPoint.x, terrainSampler(st.tsPoint.x, st.tsPoint.y) + 2.5, -st.tsPoint.y); pointMark.visible = true; }
    if (st.scUnit) { Object.assign(S, { scUnit: st.scUnit, scX: st.scX, scY: st.scY }); document.querySelectorAll('#an-scunit button').forEach(b => { if (b.dataset.u === S.scUnit) b.click(); }); }
    set(st); if ($('an-opacity')) { $('an-opacity').value = S.opacity; } if ($('an-ts-other')) $('an-ts-other').checked = S.tsOther;
  }
  function makeReport() {
    const img = snapshot(), ps = people.state, when = new Date(), L = LAYERS[S.layer], M = BM[S.bmetric];
    renderRank(); renderTS(); renderScatter(); renderRange();
    const grab = id => ($(id)?.innerHTML ?? '').replace(/<div class="btn-row"[\s\S]*?<\/div>/g, '').replace(/<div class="an-share"[\s\S]*?<\/div>\s*<\/div>/g, '');
    const cond = `${ps.day === 'weekday' ? '平日' : '休日'} ${hourTxt()}${ps.rain ? '・雨天' : ''}${ps.event ? '・イベント: ' + (people.model.eventInfo?.n ?? ps.event) : ''}${ps.nonRail ? '・鉄道以外の来訪者を含む（仮定）' : ''}`;
    const css = 'body{background:#0b1220;color:#dfe8f5;font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;max-width:980px;margin:24px auto;padding:0 20px;line-height:1.6}h1{font-size:22px;letter-spacing:.08em}h2{font-size:15px;color:#7fd4ff;border-bottom:1px solid rgba(120,180,255,.25);padding-bottom:4px;margin-top:28px}img{max-width:100%;border-radius:8px;border:1px solid rgba(120,180,255,.25)}.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}.box{max-width:420px}.note,.hint{font-size:11px;color:#8ea2c2}.sec-title{font-size:11px;letter-spacing:.1em;color:#7d93b5;margin:10px 0 4px}.an-title{font-weight:600;margin-bottom:4px}.p-table{width:100%;border-collapse:collapse;font-size:12px}.p-table td{padding:2px 0;border-top:1px solid rgba(120,180,255,.12);text-align:right}.p-table td:first-child{text-align:left}.legend{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px;color:#8ea2c2}.legend i,.an-dot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}.an-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.an-kpi{background:rgba(60,90,140,.18);border:1px solid rgba(120,180,255,.18);border-radius:6px;padding:6px 8px}.an-kpi span{display:block;font-size:11px;color:#8ea2c2}.an-kpi b{font-size:18px;color:#ffd94d}.an-kpi i{font-style:normal;font-size:11px;margin-left:3px}.an-kpi em{display:block;font-style:normal;font-size:10px;color:#6f84a6}.an-frow{display:flex;align-items:center;gap:6px;font-size:11px;color:#9fb3d1}.an-fl{width:44px;text-align:right}.an-bar{flex:1;height:8px;background:rgba(120,180,255,.1);border-radius:2px}.an-bar i{display:block;height:100%}.an-fv{width:60px;text-align:right;color:#eaf4ff}.an-grad{height:10px;border-radius:3px}.an-ticks{display:flex;justify-content:space-between;font-size:10px;color:#9fb3d1}b{font-weight:600}a{color:#7fb2ff;word-break:break-all}';
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>みなとみらい 分析レポート ${when.toLocaleDateString('ja-JP')}</title><style>${css}</style></head><body>
<h1>みなとみらい 分析レポート</h1><div class="note">作成 ${when.toLocaleString('ja-JP')} ／ 条件: ${cond} ／ ${realMonth()} 月</div>
<h2>表示中の地図</h2>${img ? `<img src="${img}" alt="地図">` : '<div class="note">画像を取得できませんでした。</div>'}
<div class="cols"><div><div class="sec-title">地表のヒートマップ: ${L.n}${cur?.diff ? '（差分: ' + cur.diff.n + '）' : ''}</div>${$('an-legend').innerHTML}</div><div><div class="sec-title">建物の色分け: ${M.n}</div>${$('an-blegend').innerHTML}</div></div>
<h2>主要指標とランキング</h2><div class="box" style="max-width:none">${grab('an-rank')}</div>
<h2>24 時間の推移</h2><div class="box">${grab('an-ts')}</div>
<h2>散布図</h2><div class="box">${grab('an-scatter')}</div>
${S.range ? `<h2>選んだ範囲の集計</h2><div class="box">${grab('an-range-out')}</div>` : ''}
${getSel()?.bid >= 0 ? `<h2>選択中の建物</h2><div class="box">${grab('an-bldg')}</div>` : ''}
<h2>この表示を再現するリンク</h2><div class="note">本ツール（index.html）の URL の末尾に次を付けて開くと、同じ表示になります。</div><a>${share ? share.hash() : ''}</a>
<h2>データの出典</h2><ul style="font-size:12px">${CATALOG.filter(c => c.s === 'use').map(c => `<li>${c.n}（${c.by}）</li>`).join('')}</ul>
<div class="note">歩行者・滞在人数・建物内の人数は、駅の乗降人員などの公表値と仮定から組み立てたモデルの推計で、実測ではありません。</div></body></html>`;
    download(`minatomirai_report_${when.toISOString().slice(0, 10)}_${hourTxt().replace(':', '')}.html`, html, 'text/html');
  }
  // ---- パネル ----
  function buildPanel() {
    const el = $('analysis'); if (!el) return;
    const opt = (o, sel, f = () => true) => Object.entries(o).filter(([k, v]) => f(k, v)).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.n}</option>`).join('');
    const badge = { use: ['使用中', '#2fb27a'], ref: ['参考', '#4da3ff'], can: ['取得可・未使用', '#ffb648'], none: ['対象エリアに無い', '#8a93a6'] };
    el.innerHTML = `<div class="an-head"><b>分析</b><div class="an-tabs"><button data-tab="heat" class="active">ヒート</button><button data-tab="cmp">比較</button><button data-tab="ts">推移</button><button data-tab="bldg">建物内</button><button data-tab="rank">集計</button><button data-tab="data">データ</button></div><button id="an-toggle" title="たたむ">−</button></div>
      <div class="an-body">
        <div data-pane="heat">
          <div class="sec-title">地表のヒートマップ</div><select id="an-layer" class="p-select" style="width:100%">${opt(LAYERS, S.layer)}</select>
          <div class="seg-row" id="an-style" style="margin-top:4px"><button data-s="flat" class="active">面</button><button data-s="bars">立体の柱</button><button data-s="contour">等値線</button></div>
          <div class="cal-row"><span>濃さ</span><input type="range" id="an-opacity" min="0.2" max="1" step="0.05" value="${S.opacity}" /><b></b></div>
          <div id="an-legend"></div><div id="an-hover" class="an-hover"></div>
          <label class="row"><input type="checkbox" id="an-multi-on" /><span class="chip chip-outline"></span>時刻別に並べる（6 枚）</label><div id="an-multi"></div>
          <div class="sec-title" style="margin-top:8px">建物の色分け</div><select id="an-bmetric" class="p-select" style="width:100%">${opt(BM, S.bmetric)}</select>
          <div id="an-blegend"></div>
        </div>
        <div data-pane="cmp" style="display:none">
          <div class="sec-title">画面を左右に分けて 2 つの指標を比べる</div>
          <label class="row"><input type="checkbox" id="an-split" /><span class="chip chip-outline"></span>画面分割（左 =「ヒート」で選んだ指標）</label>
          <div class="cal-row"><span>右側</span><select id="an-layer2" class="p-select">${opt(LAYERS, S.layer2, (k, v) => v.make && !v.cat)}</select></div>
          <div class="sec-title" style="margin-top:6px">差分ヒートマップ（「ヒート」の指標に適用）</div><select id="an-diff" class="p-select" style="width:100%">${opt(DIFFS, S.diff)}</select>
          <div class="sec-title" style="margin-top:8px">散布図（指標どうしの関係）</div>
          <div class="seg-row" id="an-scunit"><button data-u="mesh" class="active">250m メッシュ</button><button data-u="bldg">建物</button></div>
          <div class="cal-row"><span>横軸</span><select id="an-scx" class="p-select"></select></div><div class="cal-row"><span>縦軸</span><select id="an-scy" class="p-select"></select></div>
          <div id="an-scatter"></div>
          <div class="sec-title" style="margin-top:8px">範囲を囲んで集計</div>
          <div class="btn-row" style="margin:2px 0 4px"><button id="an-range">範囲を選ぶ（地図をドラッグ）</button><button id="an-range-clear" style="flex:0 0 60px">解除</button></div>
          <div id="an-range-out"></div>
        </div>
        <div data-pane="ts" style="display:none">
          <div class="cal-row"><span>対象</span><select id="an-ts-target" class="p-select"><option value="all">対象範囲の全体</option><option value="bldg">選択中の建物</option><option value="point">地点（区間の通行量）</option><option value="range">選んだ範囲</option></select></div>
          <div class="btn-row" style="margin:2px 0 4px"><button id="an-pick">地点を選ぶ（地図をクリック）</button></div>
          <label class="row"><input type="checkbox" id="an-ts-other" checked /><span class="chip chip-outline"></span>平日と休日を重ねる</label>
          <div class="seg-row" id="an-ts-shape" style="margin:2px 0 4px"><button data-p="0" class="active">折れ線</button><button data-p="1">時計型（24 時間）</button></div>
          <div id="an-ts"></div>
        </div>
        <div data-pane="bldg" style="display:none"><div id="an-bldg"></div></div>
        <div data-pane="rank" style="display:none"><div id="an-rank"></div></div>
        <div data-pane="data" style="display:none"><div class="note" style="margin-top:0">公開されているデータを調べ、使えるものを取り込みました。</div>${CATALOG.map(c => `<div class="an-ds"><span class="an-badge" style="background:${badge[c.s][1]}">${badge[c.s][0]}</span><b>${c.n}</b><div>${c.by} ／ ${c.g}</div><div class="an-use">${c.u}</div></div>`).join('')}</div>
      </div>`;
    el.querySelectorAll('.an-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('an-toggle').addEventListener('click', () => { S.open = !S.open; el.classList.toggle('closed', !S.open); $('an-toggle').textContent = S.open ? '−' : '＋'; });
    $('an-layer').addEventListener('change', e => { S.layer = e.target.value; paint(); });
    $('an-opacity').addEventListener('input', e => { S.opacity = Number(e.target.value); heat2.material.opacity = S.opacity; heat.material.opacity = S.opacity * (!cur || cur.cat || S.style === 'flat' ? 1 : S.style === 'bars' ? 0.3 : 0.45); });
    $('an-bmetric').addEventListener('change', e => { S.bmetric = e.target.value; paintBuildings(); });
    $('an-split').addEventListener('change', e => { S.split = e.target.checked; if (S.split && S.layer === 'none') { S.layer = 'stay'; $('an-layer').value = 'stay'; } paint(); });
    $('an-layer2').addEventListener('change', e => { S.layer2 = e.target.value; paint2(); });
    $('an-diff').addEventListener('change', e => { S.diff = e.target.value; if (S.diff !== 'none' && S.layer === 'none') { S.layer = 'ped'; $('an-layer').value = 'ped'; } paint(); });
    const fillSc = () => { const src = S.scUnit === 'mesh' ? LAYERS : BM, ok = S.scUnit === 'mesh' ? (k, v) => v.make && !v.cat : (k, v) => v.val && !v.cat; if (!src[S.scX] || !ok(S.scX, src[S.scX])) S.scX = S.scUnit === 'mesh' ? 'emp' : 'height'; if (!src[S.scY] || !ok(S.scY, src[S.scY])) S.scY = S.scUnit === 'mesh' ? 'stay' : 'presence'; $('an-scx').innerHTML = opt(src, S.scX, ok); $('an-scy').innerHTML = opt(src, S.scY, ok); };
    fillSc();
    el.querySelectorAll('#an-scunit button').forEach(b => b.addEventListener('click', () => { S.scUnit = b.dataset.u; el.querySelectorAll('#an-scunit button').forEach(x => x.classList.toggle('active', x === b)); fillSc(); renderScatter(); }));
    $('an-scx').addEventListener('change', e => { S.scX = e.target.value; renderScatter(); }); $('an-scy').addEventListener('change', e => { S.scY = e.target.value; renderScatter(); });
    $('an-range').addEventListener('click', () => setCap(capMode === 'range' ? null : 'range'));
    $('an-range-clear').addEventListener('click', () => { S.range = null; rangeLine.visible = rangeFill.visible = false; setCap(null); renderRange(); });
    $('an-ts-target').addEventListener('change', e => { S.tsTarget = e.target.value; renderTS(); });
    $('an-pick').addEventListener('click', () => setCap(capMode === 'point' ? null : 'point'));
    $('an-ts-other').addEventListener('change', e => { S.tsOther = e.target.checked; renderTS(); });
    el.querySelectorAll('#an-ts-shape button').forEach(b => b.addEventListener('click', () => { S.tsPolar = b.dataset.p === '1'; syncSeg(); renderTS(); }));
    el.querySelectorAll('#an-style button').forEach(b => b.addEventListener('click', () => { S.style = b.dataset.s; syncSeg(); restyle(); renderLegend(); }));
    $('an-multi-on').addEventListener('change', e => { S.multi = e.target.checked; renderMulti(); });
    // 画面分割の境界線 (ドラッグで移動)
    const dv = document.createElement('div'); dv.id = 'an-divider'; dv.innerHTML = '<span class="an-dl"></span><span class="an-dr"></span>'; document.body.appendChild(dv);
    dv.addEventListener('pointerdown', e => { e.preventDefault(); dv.setPointerCapture(e.pointerId); const mv = ev => { const r = renderer.domElement.getBoundingClientRect(); S.splitX = Math.max(0.05, Math.min(0.95, (ev.clientX - r.left) / r.width)); placeDivider(); }; const up = () => { dv.removeEventListener('pointermove', mv); dv.removeEventListener('pointerup', up); }; dv.addEventListener('pointermove', mv); dv.addEventListener('pointerup', up); });
    addEventListener('resize', () => { if (cur2) placeDivider(); });
    renderLegend(); renderBuilding(); renderRange();
  }
  const syncSeg = () => { document.querySelectorAll('#an-style button').forEach(b => b.classList.toggle('active', b.dataset.s === S.style)); document.querySelectorAll('#an-ts-shape button').forEach(b => b.classList.toggle('active', (b.dataset.p === '1') === S.tsPolar)); if ($('an-multi-on')) $('an-multi-on').checked = S.multi; };
  function setTab(tab) { S.tab = tab; const el = $('analysis'); el.querySelectorAll('.an-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); el.querySelectorAll('[data-pane]').forEach(p => { p.style.display = p.dataset.pane === tab ? '' : 'none'; }); if (tab === 'rank') renderRank(); if (tab === 'bldg') renderBuilding(); if (tab === 'cmp') { renderScatter(); renderRange(); } if (tab === 'ts') renderTS(); }
  // カーソル位置の値
  let lastMove = 0;
  el0.addEventListener('pointermove', e => {
    if (dragStart && capMode === 'range') { const g = groundPoint(e); if (g) drawRange(dragStart, g); return; }
    if (!cur || performance.now() - lastMove < 80) return; lastMove = performance.now(); const el = $('an-hover'); if (!el) return; const g = groundPoint(e); if (!g) { el.textContent = ''; return; }
    const c = cellOf(g.x, g.y), val = (q, right) => { if (q.cat) return c >= 0 && q.v[c] ? `<b>${ZN[q.v[c] - 1]}</b>` : '指定なし'; const v = c >= 0 ? q.v[c] : NaN; return !(c >= 0) || (q.diff ? false : q.L.zeroOk ? v < 0 : v <= 0) ? '値なし' : `<b>${q.diff && v > 0 ? '+' : ''}${fmt(Math.abs(v) < 1e-9 ? 0 : v)}</b> ${q.unit}`; };
    el.innerHTML = cur2 ? `カーソル位置: 左 ${val(cur)} ／ 右 ${val(cur2)}` : `カーソル位置: ${val(cur)}`;
  });
  // 時刻・曜日・シナリオが変わったら、時刻に依存する表示を更新する
  let sig = '', tAcc = 0;
  function update(dt) {
    if (flows) flows.update(dt);
    tAcc += dt; if (tAcc < 0.6 || !people.model) return; tAcc = 0; const ps = people.state, s = `${Math.round(ps.hour * 4)}|${ps.day}|${ps.rain}|${ps.event}|${people.model.dests.length}`; if (s === sig) return; const dayCh = sig.split('|')[1] !== ps.day || sig.split('|').slice(2).join() !== s.split('|').slice(2).join(); sig = s;
    const L = LAYERS[S.layer]; if (L.make && (L.time || (L.dayDep && dayCh))) paint(); else { const L2 = LAYERS[S.layer2]; if (S.split && L2?.make && (L2.time || (L2.dayDep && dayCh))) paint2(); }
    const M = BM[S.bmetric]; if (M.val && (M.time || (M.dayDep && dayCh))) paintBuildings();
    if (dayCh) syncFlows();
    if (S.tab === 'rank') renderRank(); if (S.tab === 'bldg') { renderBuilding(); if (S.floorHeat) applyFloorHeat(); } if (S.tab === 'cmp') { renderScatter(); renderRange(); } if (S.tab === 'ts') renderTS(); if (S.multi) renderMulti();
  }
  function onSelect(bid) { setTimeout(syncFlows, 0); if (bid >= 0 && S.floorHeat) setTimeout(applyFloorHeat, 0); if (S.tab === 'bldg' || bid >= 0) setTimeout(renderBuilding, 0); if (S.tab === 'ts' && S.tsTarget === 'bldg') setTimeout(renderTS, 0); }
  onTheme(t => { S.dark = new THREE.Color(t.bg).getHSL({}).l < 0.3 && !t.real; if (cur) paint(); if (bcur) paintBuildings(); });
  buildPanel();
  const set = o => {
    Object.assign(S, o); if ('layer' in o || 'diff' in o) { if ($('an-layer')) $('an-layer').value = S.layer; if ($('an-diff')) $('an-diff').value = S.diff; paint(); } if ('split' in o || 'layer2' in o || 'splitX' in o) { if ($('an-split')) $('an-split').checked = S.split; if ($('an-layer2')) $('an-layer2').value = S.layer2; paint(); }
    if ('bmetric' in o) { if ($('an-bmetric')) $('an-bmetric').value = S.bmetric; paintBuildings(); } if ('range' in o) { if (S.range) drawRange({ x: S.range[0], y: S.range[1] }, { x: S.range[2], y: S.range[3] }); else rangeLine.visible = rangeFill.visible = false; renderRange(); }
    if ('style' in o || 'tsPolar' in o || 'multi' in o) { syncSeg(); restyle(); renderLegend(); renderMulti(); } if ('flows' in o) syncFlows();
    if ('tsTarget' in o) { if ($('an-ts-target')) $('an-ts-target').value = S.tsTarget; } if ('tab' in o) setTab(S.tab); else if (S.tab === 'ts') renderTS(); else if (S.tab === 'cmp') renderScatter(); if ('floorHeat' in o) { applyFloorHeat(); renderBuilding(); }
  };
  return { update, onSelect, set, state: S, LAYERS, BM, floorStats, exportBuildings, exportLinks, exportMesh, capturing: () => capMode !== null || justCaptured, seriesOf, scatterData, exportState, importState, makeReport, sankeyHTML, get current() { return cur; }, get current2() { return cur2; } };
}
