/* =========================================================================
   xAD 店頭販促シミュレーション プロトタイプ v2
   - 3D店舗（Three.js・ライトトーン・細線ワイヤーフレーム＋商品陳列）
   - 施設切替（コンビニ / 百貨店デパ地下）・棚クリックで売場詳細
   - 棚ごとの視線検知 / 店内回遊 / 消費予測 / ノベルティRCT / デジタルCP連動
   ========================================================================= */
'use strict';

/* ---------- utils ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260804);
let histRng = mulberry32(910);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 標準正規の近似（一様3つの和）: 視線の散らばりに使う
function gauss3() { return (rng() + rng() + rng() - 1.5) * 2; }
const lerp = (a, b, t) => a + (b - a) * t;
function fmtYen(v) {
  const a = Math.abs(v);
  if (a >= 1e8) return (v / 1e8).toFixed(2) + '億円';
  if (a >= 1e6) return Math.round(v / 1e4).toLocaleString() + '万円';
  if (a >= 1e4) return '¥' + Math.round(v / 1e3).toLocaleString() + 'k';
  return '¥' + Math.round(v).toLocaleString();
}
function fmtYenFull(v) { return '¥' + Math.round(v).toLocaleString(); }
function fmtPct(v, d = 1) { return (v * 100).toFixed(d) + '%'; }
function fmtNum(v) { return Math.round(v).toLocaleString(); }
function normalCI95(p, n) {
  if (n <= 0) return 0;
  return 1.96 * Math.sqrt(Math.max(p * (1 - p), 1e-6) / n);
}

/* ---------- シナリオ状態 ---------- */
const S = {
  budget: 40, novelty: true, novRate: 0.35, traffic: 1.0, endcap: true,
  signage: true,        // 店内サイネージ出稿（FamilyMartVision型）
  dynPricing: false,    // AIダイナミックプライシング（トライアル型）
  weather: 'normal',    // 天候シグナル（状態型）: hot | normal | rain
  rival: false,         // 近隣競合セール（人流流出イベント）
  speed: 3, paused: false,
  layers: { shelfheat: true, floorheat: true, gaze: true, cones: false, trails: false, labels: true },
};

/* ---------- 施設定義 ---------- */
// shelf.kind: wall | gondola-side | island-case | endcap | counter
const STORES = {
  conbini: {
    key: 'conbini', label: 'コンビニ', client: 'コンビニチェーンA',
    storeName: '新宿駅前店', promoName: '新商品グミX',
    floorW: 16, floorD: 10, wallH: 2.7,
    // 公開統計ベースの較正: JFA客単価748.5円(2025/11既存店)・大手3社日販57-70万円
    // 駅前型を想定し デイタイム(10-22時)客数≈1,220人・購買転換62%・日販(デイタイム)≈56万円
    arrivalBase: 1.41, buyRate: 0.62, basket: 745, reachPerBudget: 1150,
    sampleFactor: 1, weekendFactor: 0.93,
    maxAgents: 46, stockCap: 240, heatW: 64, heatH: 40,
    benchmark: [
      { k: '平均客単価', real: '748.5円（JFA 2025年11月・既存店）', sim: '745円' },
      { k: '平均日販', real: 'セブン70.3万 / ローソン60.3万 / ファミマ57.3万円（2025年度上期・全店平均）', sim: 'デイタイム(10-22時)約56万円 ≒ 24h換算 約75万円の駅前型' },
      { k: 'レジ通過客数', real: '日販÷客単価 ≈ 870〜940人/日（24h）', sim: '約755人（10-22時）' },
      { k: '来店→購買転換', real: '約6割（業界通説）', sim: '62%' },
      { k: '売場規模', real: '標準店 売場約120㎡・約3,000SKU', sim: '16×10m・14売場' },
    ],
    entrances: [{ x: -3.3, z: 4.55 }],
    registers: [{ x: 4.6, z: 4.15 }, { x: 3.6, z: 4.15 }],
    queueDirs: [[0.55, 0.06], [-0.55, 0.06]],
    counters: [{ x: 4.2, z: 3.55, w: 2.8, d: 0.6, h: 1.0 }],
    novStand: { x: -1.7, z: 3.6 },
    doors: [{ x: -3.3, w: 1.9 }],
    nodeXs: [-5.5, -1.5, 1.5, 6.2],
    nodeZs: [-3.5, 2.7, 4.35],
    gondolas: [
      { x: -3, z: -0.6, w: 0.9, d: 4.0, h: 1.5 },
      { x: 0, z: -0.6, w: 0.9, d: 4.0, h: 1.5 },
      { x: 3, z: -0.6, w: 0.9, d: 4.0, h: 1.5 },
    ],
    promoted: { mainId: 'endG2', fallbackId: 'drink' },
    camPresets: {
      over: { theta: -0.5, phi: 0.9, r: 17, tx: 0, ty: 0, tz: 0.6 },
      entrance: { theta: Math.PI - 0.35, phi: 1.22, r: 9, tx: -2.2, ty: 0.4, tz: 2.2 },
      promo: { theta: 0.15, phi: 1.02, r: 7.5, tx: 0, ty: 0.5, tz: 1.6 },
    },
    shelves: [
      { id: 'chill', name: '弁当・チルド', cat: 'food', kind: 'wall', pos: [-4.5, 0, -4.5], size: [5.0, 1.8, 0.72], normal: [0, 0, 1], approach: [-4.5, -3.5], base: 0.62, price: 620, pop: 0.30 },
      { id: 'drink', name: '飲料リーチイン', cat: 'drink', kind: 'wall', pos: [2.5, 0, -4.5], size: [5.0, 1.9, 0.72], normal: [0, 0, 1], approach: [2.5, -3.5], base: 0.58, price: 210, pop: 0.26 },
      { id: 'frozen', name: '冷凍・アイス', cat: 'drink', kind: 'wall', pos: [7.55, 0, -1.4], size: [0.72, 1.6, 3.8], normal: [-1, 0, 0], approach: [6.6, -1.4], base: 0.42, price: 300, pop: 0.10 },
      { id: 'daily', name: '日用品・衛生', cat: 'daily', kind: 'wall', pos: [7.55, 0, 2.3], size: [0.72, 1.7, 2.6], normal: [-1, 0, 0], approach: [6.6, 2.3], base: 0.35, price: 450, pop: 0.07 },
      { id: 'mag', name: '雑誌・書籍', cat: 'mag', kind: 'wall', pos: [-7.55, 0, 0.6], size: [0.72, 1.5, 3.2], normal: [1, 0, 0], approach: [-6.6, 0.6], base: 0.18, price: 700, pop: 0.08 },
      { id: 'bread', name: 'パン・スイーツ', cat: 'food', kind: 'wall', pos: [-6.6, 0, 4.55], size: [2.6, 1.5, 0.66], normal: [0, 0, -1], approach: [-6.6, 3.6], base: 0.48, price: 260, pop: 0.14 },
      { id: 'g1L', name: '菓子', cat: 'snack', kind: 'gondola-side', pos: [-3.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [-4.2, -0.6], base: 0.45, price: 180, pop: 0.13 },
      { id: 'g1R', name: 'スナック・珍味', cat: 'snack', kind: 'gondola-side', pos: [-2.55, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [1, 0, 0], approach: [-1.8, -0.6], base: 0.42, price: 200, pop: 0.10 },
      { id: 'g2L', name: 'カップ麺', cat: 'food', kind: 'gondola-side', pos: [-0.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [-1.2, -0.6], base: 0.40, price: 240, pop: 0.10 },
      { id: 'g2R', name: '加工食品・レトルト', cat: 'food', kind: 'gondola-side', pos: [0.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [1, 0, 0], approach: [1.2, -0.6], base: 0.33, price: 380, pop: 0.07 },
      { id: 'g3L', name: '酒類', cat: 'drink', kind: 'gondola-side', pos: [2.55, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [1.8, -0.6], base: 0.50, price: 520, pop: 0.11 },
      { id: 'g3R', name: '健康食品・美容', cat: 'daily', kind: 'gondola-side', pos: [3.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [1, 0, 0], approach: [4.2, -0.6], base: 0.28, price: 880, pop: 0.05 },
      { id: 'endG2', name: '販促エンド（新商品グミX）', cat: 'promo', kind: 'endcap', pos: [0, 0, 1.95], size: [1.1, 1.4, 0.55], normal: [0, 0, 1], approach: [0, 2.85], base: 0.46, price: 240, pop: 0.0, promoted: true },
      { id: 'hot', name: 'レジ横ホットスナック', cat: 'food', kind: 'counter', pos: [4.2, 0, 3.55], size: [2.8, 1.0, 0.6], normal: [0, 0, 1], approach: [4.2, 4.35], base: 0.30, price: 190, pop: 0.0, counter: true },
    ],
  },

  depato: {
    key: 'depato', label: '百貨店', client: '百貨店グループB',
    storeName: '新宿本店 デパ地下フロア', promoName: '新作スイーツX',
    floorW: 30, floorD: 18, wallH: 3.4,
    // 公開統計ベースの較正: 百貨店販売額の食料品構成比28.3%・旗艦店(伊勢丹新宿)年商約3,900億円
    // 旗艦店級デパ地下を想定: フロア来店≈5.8万人/日・購買転換55%・客単価2,500円 → 日販≈0.8億円
    // 3D表示・ビーコン集計は 1/40 サンプリング（ダッシュボードは拡大推計）
    arrivalBase: 67, buyRate: 0.55, basket: 2500, reachPerBudget: 2000,
    sampleFactor: 40, weekendFactor: 1.35,
    maxAgents: 90, stockCap: 1600, heatW: 96, heatH: 58,
    benchmark: [
      { k: '食料品構成比', real: '百貨店販売額の28.3%（商業動態統計）', sim: 'デパ地下フロア単体を対象' },
      { k: '旗艦店規模', real: '伊勢丹新宿 年商約3,900億円（2022年度・過去最高）', sim: '食品フロア日販 約0.8億円で較正' },
      { k: 'デパ地下客単価', real: '約2,000〜3,000円（各種調査）', sim: '2,500円' },
      { k: 'フロア来店', real: '旗艦店で数万人/日規模', sim: '約5.8万人/日・3D表示は1/40サンプリング' },
      { k: '週末係数', real: '百貨店は土日祝に集中', sim: '土日 +35%' },
    ],
    entrances: [{ x: 0, z: 8.5 }, { x: -13, z: 8.5 }],
    registers: [{ x: 4.8, z: 6.5 }, { x: -4.8, z: 6.5 }],
    queueDirs: [[0.12, 0.58], [-0.12, 0.58]],
    counters: [
      { x: 4.8, z: 5.9, w: 2.6, d: 0.6, h: 1.0 },
      { x: -4.8, z: 5.9, w: 2.6, d: 0.6, h: 1.0 },
    ],
    novStand: { x: 1.6, z: 7.4 },
    doors: [{ x: 0, w: 2.6 }, { x: -13, w: 2.2 }],
    nodeXs: [-13, -6.4, 0, 6.4, 13],
    nodeZs: [-6.5, -2, 2.5, 6.9],
    gondolas: [],
    promoted: { mainId: 'promoDais', fallbackId: 'patisserie' },
    camPresets: {
      over: { theta: -0.4, phi: 0.85, r: 28, tx: 0, ty: 0, tz: 0.5 },
      entrance: { theta: Math.PI - 0.3, phi: 1.2, r: 13, tx: 0, ty: 0.5, tz: 5.5 },
      promo: { theta: 0.2, phi: 1.0, r: 9, tx: 3.2, ty: 0.5, tz: 4.2 },
    },
    shelves: [
      { id: 'patisserie', name: '洋菓子ギフト', cat: 'gift', kind: 'wall', pos: [-9, 0, -8.55], size: [5.5, 2.0, 0.8], normal: [0, 0, 1], approach: [-9, -7.3], base: 0.38, price: 1800, pop: 0.13 },
      { id: 'wagashi', name: '和菓子', cat: 'gift', kind: 'wall', pos: [-1.5, 0, -8.55], size: [5.0, 2.0, 0.8], normal: [0, 0, 1], approach: [-1.5, -7.3], base: 0.34, price: 1400, pop: 0.10 },
      { id: 'bakery', name: 'ベーカリー', cat: 'food', kind: 'wall', pos: [6.5, 0, -8.55], size: [5.5, 1.9, 0.8], normal: [0, 0, 1], approach: [6.5, -7.3], base: 0.52, price: 680, pop: 0.14 },
      { id: 'fish', name: '鮮魚', cat: 'fresh', kind: 'wall', pos: [-14.55, 0, -3.2], size: [0.8, 1.6, 4.5], normal: [1, 0, 0], approach: [-13.3, -3.2], base: 0.30, price: 1600, pop: 0.07 },
      { id: 'meat', name: '精肉', cat: 'fresh', kind: 'wall', pos: [-14.55, 0, 2.8], size: [0.8, 1.6, 4.5], normal: [1, 0, 0], approach: [-13.3, 2.8], base: 0.32, price: 2100, pop: 0.07 },
      { id: 'wine', name: 'ワイン・酒', cat: 'drink', kind: 'wall', pos: [14.55, 0, -3.2], size: [0.8, 2.0, 4.5], normal: [-1, 0, 0], approach: [13.3, -3.2], base: 0.36, price: 2600, pop: 0.08 },
      { id: 'tea', name: '紅茶・珈琲ギフト', cat: 'gift', kind: 'wall', pos: [14.55, 0, 2.8], size: [0.8, 1.8, 4.5], normal: [-1, 0, 0], approach: [13.3, 2.8], base: 0.26, price: 1500, pop: 0.06 },
      { id: 'deli', name: '惣菜デリ', cat: 'food', kind: 'island-case', pos: [-9.6, 0, -4.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [-9.6, -2.7], base: 0.44, price: 980, pop: 0.12 },
      { id: 'cheese', name: 'チーズ・グロサリー', cat: 'food', kind: 'island-case', pos: [-3.2, 0, -4.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [-3.2, -2.7], base: 0.30, price: 1200, pop: 0.07 },
      { id: 'tsukudani', name: '佃煮・乾物', cat: 'food', kind: 'island-case', pos: [3.2, 0, -4.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [3.2, -2.7], base: 0.24, price: 900, pop: 0.05 },
      { id: 'grocery', name: 'グロサリー・調味料', cat: 'daily', kind: 'island-case', pos: [9.6, 0, -4.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [9.6, -2.7], base: 0.30, price: 850, pop: 0.06 },
      { id: 'salad', name: 'サラダ・フルーツ', cat: 'fresh', kind: 'island-case', pos: [-9.6, 0, 0.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [-9.6, 1.8], base: 0.40, price: 750, pop: 0.09 },
      { id: 'bento', name: '弁当・寿司', cat: 'food', kind: 'island-case', pos: [-3.2, 0, 0.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [-3.2, 1.8], base: 0.50, price: 1100, pop: 0.13 },
      { id: 'kashi', name: '菓子ギフト', cat: 'gift', kind: 'island-case', pos: [3.2, 0, 0.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [3.2, 1.8], base: 0.38, price: 1300, pop: 0.08 },
      { id: 'meika', name: '銘菓・土産', cat: 'gift', kind: 'island-case', pos: [9.6, 0, 0.25], size: [2.8, 1.1, 1.4], normal: [0, 0, 1], approach: [9.6, 1.8], base: 0.32, price: 1000, pop: 0.07 },
      { id: 'promoDais', name: '催事プロモ台（新作スイーツX）', cat: 'promo', kind: 'island-case', pos: [3.2, 0, 4.7], size: [2.6, 1.1, 1.3], normal: [0, 0, 1], approach: [3.2, 5.8], base: 0.42, price: 1200, pop: 0.0, promoted: true },
    ],
  },
};

let FKEY = 'conbini';
let STORE = STORES.conbini;
let SHELVES = STORE.shelves;
let shelfById = {};
function rebuildShelfIndex() { shelfById = {}; SHELVES.forEach(s => shelfById[s.id] = s); }
rebuildShelfIndex();
function promotedShelf() { return S.endcap ? shelfById[STORE.promoted.mainId] : shelfById[STORE.promoted.fallbackId]; }

/* ---------- 通路グラフ ---------- */
let NODES = [], EDGES = {};
function buildGraph() {
  NODES = []; EDGES = {};
  STORE.nodeZs.forEach((z, zi) => STORE.nodeXs.forEach((x, xi) => NODES.push({ id: NODES.length, x, z, xi, zi })));
  NODES.forEach(n => EDGES[n.id] = []);
  NODES.forEach(a => NODES.forEach(b => {
    if (a.id >= b.id) return;
    const rowAdj = a.zi === b.zi && Math.abs(a.xi - b.xi) === 1;
    const colAdj = a.xi === b.xi && Math.abs(a.zi - b.zi) === 1;
    if (rowAdj || colAdj) { EDGES[a.id].push(b.id); EDGES[b.id].push(a.id); }
  }));
}
buildGraph();
function nearestNode(x, z) {
  let best = null, bd = 1e9;
  NODES.forEach(n => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } });
  return best;
}
function nodePath(fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = {}; const q = [fromId]; prev[fromId] = -1;
  while (q.length) {
    const c = q.shift();
    for (const nb of EDGES[c]) {
      if (prev[nb] !== undefined) continue;
      prev[nb] = c;
      if (nb === toId) { const path = [nb]; let p = c; while (p !== -1) { path.unshift(p); p = prev[p]; } return path; }
      q.push(nb);
    }
  }
  return [fromId];
}
function routePoints(from, to) {
  const a = nearestNode(from.x, from.z), b = nearestNode(to.x, to.z);
  const ids = nodePath(a.id, b.id);
  const pts = ids.map(id => ({ x: NODES[id].x, z: NODES[id].z }));
  pts.push({ x: to.x, z: to.z });
  if (pts.length > 1 && Math.hypot(pts[0].x - from.x, pts[0].z - from.z) < 0.4) pts.shift();
  return smoothPath(pts);
}
/* 什器の長手方向のどこに立つか。5m の壁面什器で全員が中央に立つと
   棚の両端が「一度も見られない」不自然な計測になるため、
   買いたいフェイス付近に立ち位置を分散させる。 */
function shelfAxis(s) {
  const alongX = s.normal[2] !== 0;
  return { alongX, len: alongX ? s.size[0] : s.size[2] };
}
function approachSpot(s, frac) {
  const { alongX, len } = shelfAxis(s);
  const off = (frac - 0.5) * Math.max(0, len - 0.9);    // 端に寄りすぎない
  return alongX
    ? { x: s.approach[0] + off, z: s.approach[1] }
    : { x: s.approach[0], z: s.approach[1] + off };
}

/* 什器正面の一点（u=長手方向 0..1, y=床上高さ）をワールド座標へ */
function shelfFacePoint(s, u, y, viewerZ) {
  const { alongX, len } = shelfAxis(s);
  const depth = alongX ? s.size[2] : s.size[0];
  const face = Math.max(depth / 2 - 0.04, 0.05);
  if (s.kind === 'island-case') {
    // 平ケースは「天面を手前から奥へ」見る。格子の v 軸は高さではなく奥行きに対応させる
    const dv = clamp((y - 0.5) / 0.55, 0, 0.999);          // 0=手前 1=奥
    const sgn = viewerZ != null && viewerZ < s.pos[2] ? -1 : 1;
    return [s.pos[0] + (u - 0.5) * s.size[0] * 0.92,
            s.size[1] * 0.87,
            s.pos[2] - sgn * (dv - 0.5) * s.size[2] * 0.9];
  }
  return alongX
    ? [s.pos[0] + (u - 0.5) * len, y, s.pos[2] + s.normal[2] * face]
    : [s.pos[0] + s.normal[0] * face, y, s.pos[2] + (u - 0.5) * len];
}

/* 什器上で、客から見て最も近い正面の点（長手方向にクランプ） */
function shelfNearPoint(s, x, z) {
  const { alongX, len } = shelfAxis(s);
  const half = Math.max(len / 2 - 0.05, 0.05);
  return alongX
    ? { x: clamp(x, s.pos[0] - half, s.pos[0] + half), z: s.pos[2] }
    : { x: s.pos[0], z: clamp(z, s.pos[2] - half, s.pos[2] + half) };
}

/* 視線の遮蔽判定。視点→注視点の線分が他の什器の箱を貫くなら「見えていない」。
   ゴンドラ越しに反対側の棚が見えてしまう（＝計測されてしまう）のを防ぐ。 */
function losBlocked(ax, ay, az, bx, by, bz, skipId) {
  const dx = bx - ax, dz = bz - az;
  for (const o of SHELVES) {
    if (o.id === skipId) continue;
    const hx = o.size[0] / 2 + 0.02, hz = o.size[2] / 2 + 0.02;
    let t0 = 0, t1 = 1, out = false;
    for (let k = 0; k < 2 && !out; k++) {
      const d = k ? dz : dx, p0 = k ? az : ax;
      const lo = (k ? o.pos[2] : o.pos[0]) - (k ? hz : hx);
      const hi = (k ? o.pos[2] : o.pos[0]) + (k ? hz : hx);
      if (Math.abs(d) < 1e-6) { if (p0 < lo || p0 > hi) out = true; continue; }
      let ta = (lo - p0) / d, tb = (hi - p0) / d;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) out = true;
    }
    if (out || t0 > t1 || t1 <= 0.02 || t0 >= 0.98) continue;
    // 交差区間の視線高さが什器天端より下なら遮られている
    if (ay + (by - ay) * ((t0 + t1) / 2) < o.size[1] - 0.03) return true;
  }
  return false;
}

/* 歩行の物理パラメータ（実測レンジ: 屋内歩行 0.8〜1.4m/s、加速 0.5〜1.0m/s²、旋回 ~2rad/s） */
const TURN_RATE = 2.4, WALK_ACC = 1.15, WALK_DEC = 1.6;

/* 客が什器の中にめり込まないよう押し出す（回避ステアリングの保険） */
const BODY_R = 0.22;
function pushOutOfFixtures(a) {
  for (const o of SHELVES) {
    const hx = o.size[0] / 2 + BODY_R, hz = o.size[2] / 2 + BODY_R;
    const dx = a.x - o.pos[0], dz = a.z - o.pos[2];
    const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) a.x = o.pos[0] + Math.sign(dx || 1) * hx;
    else a.z = o.pos[2] + Math.sign(dz || 1) * hz;
  }
}

/* ==========================================================================
   AIカメラの計測モデル（真値 ≠ 計測値）
   ここまでのシミュレーションは「実際に何が起きたか」（真値）を生成している。
   実機のAIカメラはそれを完全には観測できないので、次の制約を課した観測値を
   別レイヤーとして生成し、両方をダッシュボードに並べる。
     ・カバレッジ  … どのカメラの視錐台にも入らない位置は計測できない
     ・遮蔽        … 什器や他の客に隠れるとフレームが落ちる
     ・検出率      … 1フレームあたりの人物検出は100%ではない
     ・姿勢推定誤差… 頭部の向きの推定には誤差があり、注視セルがずれる
   ========================================================================== */
function cctvDefs() {
  const W = STORE.floorW, D = STORE.floorD, H = STORE.wallH;
  const y = Math.min(H - 0.32, 2.75);
  const ix = W / 2 - 0.45, iz = D / 2 - 0.45;
  const range = Math.max(W, D) * 0.42;
  const base = [
    { name: 'FOSCAM_1', p: [-ix, y, iz], t: [-W * 0.12, 0.95, -D * 0.22], range },
    { name: 'FOSCAM_2', p: [ix, y, iz], t: [W * 0.14, 0.95, -D * 0.20], range },
    { name: 'FOSCAM_3', p: [-ix, y, -iz], t: [-W * 0.10, 0.95, D * 0.18], range },
    { name: 'FOSCAM_4', p: [ix, y, -iz], t: [W * 0.12, 0.95, D * 0.16], range },
  ];
  return base.concat(EXTRA_CAMS);
}
let EXTRA_CAMS = [];                       // 増設提案を適用したときに増える
let CAMS = [];                             // 計測用の軽量表現（Three.js非依存）
const CAM_COS = Math.cos(0.62);            // 画角 半頂角35.5°
const CAM_POSE_SD = 0.155;                 // 頭部姿勢推定の誤差 σ（rad, 1台・良条件）
const CAM_RECALL = 0.93;                   // 1フレームあたりの人物検出率（良条件）

function buildCams() {
  CAMS = cctvDefs().map(def => {
    const p = { x: def.p[0], y: def.p[1], z: def.p[2] };
    const dx = def.t[0] - p.x, dy = def.t[1] - p.y, dz = def.t[2] - p.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    return { name: def.name, p, fwd: { x: dx / L, y: dy / L, z: dz / L }, range: def.range * 2.4 };
  });
}

/* 1台のカメラがその点をどれだけ良く見ているか（0=見えない, 1=画角中心で近い） */
function camQuality(c, x, y, z, skipId) {
  const dx = x - c.p.x, dy = y - c.p.y, dz = z - c.p.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > c.range || dist < 0.2) return 0;
  const cos = (dx * c.fwd.x + dy * c.fwd.y + dz * c.fwd.z) / dist;
  if (cos < CAM_COS) return 0;
  if (losBlocked(c.p.x, c.p.y, c.p.z, x, y, z, skipId)) return 0;   // 什器の陰
  const angQ = clamp((cos - CAM_COS) / (1 - CAM_COS) * 1.8, 0.25, 1);  // 画角端は精度が落ちる
  const dQ = clamp(1.3 - dist / c.range, 0.3, 1);                      // 遠いほど解像度が落ちる
  return angQ * dQ;
}

buildCams();

/* 増設カメラを1台足す（対象の棚が正面に入る天井位置を探して設置）。
   計測は打ち手ではないが、打ち手の確信度を上げる前提条件なので提案対象にしている。 */
function addCameraFor(shelfId) {
  const s = shelfById[shelfId];
  if (!s) return null;
  const H = Math.min(STORE.wallH - 0.32, 2.75);
  const tx = s.pos[0] + s.normal[0] * 0.4, tz = s.pos[2] + s.normal[2] * 0.4;
  // 棚の正面側・通路上から見下ろす位置。什器に遮られない距離を探す
  let best = null, bestCov = -1;
  for (const dist of [2.6, 3.6, 4.6]) {
    for (const off of [-1.6, 0, 1.6]) {
      const { alongX } = shelfAxis(s);
      const px = clamp(tx + s.normal[0] * dist + (alongX ? off : 0), -STORE.floorW / 2 + 0.4, STORE.floorW / 2 - 0.4);
      const pz = clamp(tz + s.normal[2] * dist + (alongX ? 0 : off), -STORE.floorD / 2 + 0.4, STORE.floorD / 2 - 0.4);
      const cam = { name: 'tmp', p: { x: px, y: H, z: pz }, range: Math.max(STORE.floorW, STORE.floorD) * 0.42 * 2.4 };
      const dx = tx - px, dy = 1.1 - H, dz = tz - pz;
      const L = Math.hypot(dx, dy, dz) || 1;
      cam.fwd = { x: dx / L, y: dy / L, z: dz / L };
      let seen = 0, n = 0;
      for (let v = 0; v < GRID_V; v++) for (let u = 0; u < GRID_U; u++) {
        const y = ((v + 0.5) / GRID_V) * s.size[1];
        const p = shelfFacePoint(s, (u + 0.5) / GRID_U, y);
        n++; if (camQuality(cam, p[0], p[1], p[2], s.id) > 0.02) seen++;
      }
      const cov = seen / n;
      if (cov > bestCov) { bestCov = cov; best = { px, pz }; }
    }
  }
  if (!best || bestCov <= 0) return null;
  EXTRA_CAMS.push({
    name: 'ADD_' + (EXTRA_CAMS.length + 1), p: [best.px, H, best.pz], t: [tx, 1.1, tz],
    range: Math.max(STORE.floorW, STORE.floorD) * 0.42,
  });
  buildCams();
  computeShelfCoverage();
  if (window.__cloudReady && window.buildCameras) buildCameras();
  beacon(`CCTVを1台増設（${s.name}向け・棚面カバレッジ ${Math.round(bestCov * 100)}%）`, 'seg-buy');
  return bestCov;
}
window.addCameraFor = addCameraFor;

/* その点を見ているカメラの台数と、合成した観測品質 */
function observeAt(x, y, z, skipId) {
  let n = 0, best = 0, sum = 0;
  for (const c of CAMS) {
    const q = camQuality(c, x, y, z, skipId);
    if (q > 0.02) { n++; sum += q; if (q > best) best = q; }
  }
  return { n, q: n ? clamp(best + (sum - best) * 0.35, 0, 1.6) : 0 };
}

/* 他の客による遮蔽（カメラと対象の間に人が立つとフレームが落ちる） */
function crowdOcclusion(a) {
  let worst = 1;
  for (const b of agents) {
    if (b === a || b.done) continue;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d < 0.85) worst = Math.min(worst, 0.55 + d * 0.5);
  }
  return worst;
}

/* 棚面がどれだけカメラに映っているか（什器ごと・店舗構築時に1回計算） */
function computeShelfCoverage() {
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (!st) return;
    let seen = 0, camSum = 0, n = 0;
    for (let v = 0; v < GRID_V; v++) {
      for (let u = 0; u < GRID_U; u++) {
        const y = s.kind === 'island-case'
          ? s.size[1] * 0.87
          : ((v + 0.5) / GRID_V) * s.size[1];
        const p = shelfFacePoint(s, (u + 0.5) / GRID_U, s.kind === 'island-case' ? 0.5 + (v + 0.5) / GRID_V * 0.549 : y);
        const o = observeAt(p[0], s.kind === 'island-case' ? y : p[1], p[2], s.id);
        n++; if (o.n > 0) { seen++; camSum += o.n; }
      }
    }
    st.coverage = n ? seen / n : 0;                  // 計測できるセルの割合
    st.camMean = seen ? camSum / seen : 0;           // 平均カメラ台数
  });
}

/* 対人回避: 前方の他客を避けて横にずれ、詰まっていれば減速する */
function avoidSteer(a) {
  let sx = 0, sz = 0, slow = 1;
  const hx = Math.sin(a.heading), hz = Math.cos(a.heading);
  for (const b of agents) {
    if (b === a || b.done) continue;
    const dx = b.x - a.x, dz = b.z - a.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 1.44 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const fwd = (dx * hx + dz * hz) / d;
    if (fwd < 0.1) continue;                        // 後ろ・真横は無視
    const push = (1.2 - d) / 1.2 * fwd;
    // 相手の左右どちら側かを見て、反対へ逃げる（日本の売場は右側通行寄り）
    const side = dx * hz - dz * hx;
    const s = side > 0 ? -1 : 1;
    sx += hz * s * push * 1.15; sz += -hx * s * push * 1.15;
    if (d < 0.75) slow = Math.min(slow, 0.34 + (d - 0.3) * 1.2);
  }
  return { x: sx, z: sz, slow: clamp(slow, 0.25, 1) };
}

/* 経路のコーナーを落として自然な曲線にする（Chaikin 1パス） */
function smoothPath(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 2; i++) {
    const p = pts[i], q = pts[i + 1], r = pts[i + 2];
    out.push({ x: p.x * 0.25 + q.x * 0.75, z: p.z * 0.25 + q.z * 0.75 });
    out.push({ x: r.x * 0.25 + q.x * 0.75, z: r.z * 0.25 + q.z * 0.75 });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function nearestOf(list, x, z) {
  let best = list[0], bd = 1e9;
  list.forEach(p => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } });
  return best;
}

/* ---------- 集計ステート ---------- */
/* 棚面の視線グリッド（点群ヒートマップの解像度） */
const GRID_U = 12, GRID_V = 6;
function freshShelfStats() {
  return {
    passes: 0, gazes: 0, gazeSec: 0, stops: 0, picks: 0, purchases: 0,
    goldenSec: 0,                                     // ゴールデン帯（床上85〜150cm）で受けた注意秒
    tierSec: new Float64Array(4),                     // 段別の注意秒（全視線）
    tierDwellSec: new Float64Array(4),                // 段別の注意秒（立寄中のみ）
    // 「目当ての商品がどの段にあったか」は無作為に割り付けられる＝段の自然実験。
    // この割付を条件にした手取・購買の差は、段の因果効果として読める。
    tierTrials: new Float64Array(4),                  // その段に目当てがあった立寄の数
    tierPicks: new Float64Array(4),                   // うち手に取った数
    tierBuys: new Float64Array(4),                    // うち購買に至った数
    // --- AIカメラ計測値（真値と分けて持つ） ---
    gridObs: new Float32Array(GRID_U * GRID_V),
    gazeSecObs: 0, gazesObs: 0, passesObs: 0,
    cellHit: 0, cellTot: 0,                           // 計測セルが真のセルと一致した割合
    coverage: 1, camMean: 0,                          // 棚面のカメラ被覆率・平均台数
    attnSum: 0, attnBuySum: 0, dwellN: 0,             // 注視効率の算出用
    grid: new Float32Array(GRID_U * GRID_V),          // 本日累計
    gridRecent: new Float32Array(GRID_U * GRID_V),    // 直近30分（指数減衰）
    gridLive: new Float32Array(GRID_U * GRID_V),      // ライブ（直近1分・人の動きに直結）
    gridWho: new Uint8Array(GRID_U * GRID_V),         // そのセルを最後に見たペルソナ
  };
}
const STATS = {
  day: 15, simSec: 10 * 3600,
  visitors: 0, adVisitors: 0, buyers: 0, revenue: 0, promoUnits: 0,
  nov: { treat: 0, ctrl: 0, treatBuy: 0, ctrlBuy: 0, treatRev: 0, ctrlRev: 0 },
  cross: { none: { n: 0, buy: 0 }, ad: { n: 0, buy: 0 }, sig: { n: 0, buy: 0 }, both: { n: 0, buy: 0 } },
  personas: {}, balked: 0, balkedRev: 0, waitSum: 0, waitN: 0, maxQueue: 0, reg2Opened: false, gazeEvents: 0, obsEvents: 0,
  shelves: {}, buckets: [], adStoreVisits: 0, returns: 0, applied: 0,
};
function resetPersonaStats() {
  STATS.personas = {};
  ['commuter', 'homemaker', 'student', 'senior', 'inbound'].forEach(k => STATS.personas[k] = { n: 0, buyers: 0, revenue: 0 });
}
resetPersonaStats();
function resetShelfStats() {
  STATS.shelves = {};
  SHELVES.forEach(s => STATS.shelves[s.id] = freshShelfStats());
  if (CAMS.length) computeShelfCoverage();
}
resetShelfStats();
for (let i = 0; i < 24; i++) STATS.buckets.push(0);

const BEACON_LINES = [];
function beacon(msg, cls) {
  const h = Math.floor(STATS.simSec / 3600), m = Math.floor((STATS.simSec % 3600) / 60);
  BEACON_LINES.push({ t: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, msg, cls });
  if (BEACON_LINES.length > 7) BEACON_LINES.shift();
}

/* 在庫（販促商品） */
const stockState = { units: 240, cap: 240, missed: 0 };

/* ---------- 消費者行動モデル ---------- */
function arrivalCurve(hour) {
  if (hour < 7) return 0.25;
  if (hour < 9) return 1.25;
  if (hour < 11) return 0.75;
  if (hour < 14) return hour < 12 ? 1.1 : 1.9;
  if (hour < 17) return 0.8;
  if (hour < 20) return 1.55;
  if (hour < 23) return 0.85;
  return 0.35;
}
function curveCumFrac(simSec) {
  const t = clamp((simSec - 10 * 3600) / 3600, 0, 12);
  let acc = 0, total = 0;
  for (let i = 0; i < 48; i++) {
    const h = 10 + (i + 0.5) * 0.25;
    const v = arrivalCurve(h) * 0.25;
    total += v;
    if (h - 10 < t) acc += v;
  }
  return clamp(acc / total, 0.001, 1);
}
function adReachLift() { return 0.35 * (S.budget / 100); }
function adExposureShare() { return 0.06 + 0.26 * (S.budget / 100); }
function envMult() { return WEATHER[S.weather].arrival * (S.rival ? 0.85 : 1); }
function arrivalRatePerMin() {
  const hour = STATS.simSec / 3600;
  return STORE.arrivalBase * arrivalCurve(hour) * S.traffic * envMult() * (1 + adReachLift());
}

const NOV_TRUE_LIFT = 0.32;
const AD_PROMO_MULT = 1.7;
const ENDCAP_ATTENTION = 1.9;
// 棚割シミュレーターから反映される係数（視線・転換の倍率）
const PLANO = { attn: 1, conv: 1 };
// AIダイナミックプライシング: 17時以降・在庫消化が遅い場合に自動値下げ（-15%）
function dynPricingActive() {
  return S.dynPricing && STATS.simSec >= 17 * 3600 && stockState.units > stockState.cap * 0.45;
}

/* 天候シグナル（統一推計モデルの「状態型」の具体例） */
const WEATHER = {
  hot:    { label: '晴れ・猛暑35℃', short: '猛暑', arrival: 0.95, seasonal: 0.085, bg: 0xf2ecdd,
            cats: { drink: 1.45, snack: 1.05, food: 0.85, fresh: 0.9, daily: 1.0, gift: 1.0, mag: 1.0, promo: 1.1 } },
  normal: { label: '晴れ・26℃', short: '平常', arrival: 1.0, seasonal: 0.055, bg: 0xe9eef5,
            cats: { drink: 1.0, snack: 1.0, food: 1.0, fresh: 1.0, daily: 1.0, gift: 1.0, mag: 1.0, promo: 1.0 } },
  rain:   { label: '雨・22℃', short: '雨', arrival: 0.78, seasonal: 0.02, bg: 0xdfe5ee,
            cats: { drink: 0.85, snack: 1.0, food: 1.1, fresh: 1.0, daily: 1.4, gift: 0.9, mag: 1.1, promo: 0.95 } },
};
function weatherCat(cat) { return WEATHER[S.weather].cats[cat] || 1; }

/* ペルソナ（顧客セグメント軸） */
const PERSONAS = {
  commuter:  { key: 'commuter', eyeH: 1.63, label: '通勤・オフィス', color: 0x0f9fba, speed: 1.15, dwell: 0.6, stops: [1, 2], buy: 1.0, priceMult: 1.0,
               aff: { drink: 1.5, food: 1.25, snack: 0.8, gift: 0.6, fresh: 0.6, daily: 0.7, mag: 0.9 } },
  homemaker: { key: 'homemaker', eyeH: 1.56, label: '主婦/主夫・ファミリー', color: 0xe07b39, speed: 0.85, dwell: 1.25, stops: [2, 4], buy: 1.1, priceMult: 1.0,
               aff: { food: 1.4, fresh: 1.5, daily: 1.3, drink: 0.9, snack: 1.0, gift: 0.9, mag: 0.6 } },
  student:   { key: 'student', eyeH: 1.66, label: '学生・若年', color: 0x7a5fd0, speed: 1.05, dwell: 1.0, stops: [1, 3], buy: 0.9, priceMult: 0.85,
               aff: { snack: 1.7, drink: 1.3, food: 1.0, mag: 1.2, gift: 0.5, fresh: 0.4, daily: 0.5 } },
  senior:    { key: 'senior', eyeH: 1.5, label: 'シニア', color: 0x64748b, speed: 0.65, dwell: 1.4, stops: [2, 3], buy: 1.0, priceMult: 0.95,
               aff: { food: 1.2, fresh: 1.3, mag: 1.1, gift: 1.0, drink: 0.8, snack: 0.7, daily: 1.1 } },
  inbound:   { key: 'inbound', eyeH: 1.6, label: 'インバウンド', color: 0x45b3a2, speed: 0.9, dwell: 1.6, stops: [2, 4], buy: 1.15, priceMult: 1.3,
               aff: { gift: 1.8, snack: 1.4, drink: 1.1, food: 1.0, fresh: 0.6, daily: 0.4, mag: 0.5 } },
};
Object.keys(PERSONAS).forEach((k, i) => { PERSONAS[k].pidx = i; });
const PERSONA_COLORS = Object.keys(PERSONAS).map(k => PERSONAS[k].color);

function personaWeights(hour) {
  const w = {
    commuter: hour < 10 ? 2.0 : hour < 12 ? 0.8 : hour < 14 ? 2.2 : hour < 17 ? 0.7 : hour < 19.5 ? 2.0 : 1.0,
    homemaker: hour >= 10 && hour < 16 ? 1.6 : 0.6,
    student: hour >= 15 && hour < 19 ? 1.8 : 0.5,
    senior: hour >= 10 && hour < 15 ? 1.4 : 0.4,
    inbound: hour >= 11 && hour < 20 ? 0.6 : 0.2,
  };
  if (FKEY === 'depato') {
    w.commuter *= 0.5; w.homemaker *= 1.6; w.senior *= 1.5; w.inbound *= 3.0; w.student *= 0.7;
  }
  return w;
}
function pickPersona() {
  const w = personaWeights(STATS.simSec / 3600);
  let sum = 0; Object.values(w).forEach(v => sum += v);
  let r = rng() * sum;
  for (const k of Object.keys(w)) { r -= w[k]; if (r <= 0) return PERSONAS[k]; }
  return PERSONAS.commuter;
}

/* レジ（待ち行列・機会損失） */
let REGS = [];
function buildRegs() {
  REGS = STORE.registers.map((r, i) => ({
    x: r.x, z: r.z,
    dir: (STORE.queueDirs && STORE.queueDirs[i]) || [0, 0.55],
    open: i === 0 || FKEY === 'depato',
    queue: [],
  }));
}
function balkThreshold() { return FKEY === 'depato' ? 7 : 5; }
buildRegs();

let agentSeq = 0;
class Agent {
  constructor() {
    this.id = ++agentSeq;
    const ent = STORE.entrances[Math.floor(rng() * STORE.entrances.length)];
    this.x = ent.x + (rng() - 0.5) * 0.6;
    this.z = ent.z;
    this.heading = -Math.PI / 2;
    this.persona = pickPersona();
    this.eyeH0 = (this.persona.eyeH || 1.6) + (rng() - 0.5) * 0.09;   // 直立時の目線高さ
    this.eyeH = this.eyeH0;                                            // 屈み込みを反映した実効値
    this.bend = 0;                                                     // 0=直立 1=しゃがんで下段を見る
    this.gazeTargetY = null; this.gazeLateral = 0; this.fixTimer = 0; this.targetFrac = null;
    this.fix = null;                                                   // いま見ている一点（注視）
    this.headYaw = this.heading; this.headPitch = 0;                   // 頭部は体と独立に回る
    this.reach = 0;                                                    // 商品に手を伸ばす動作
    this.v = 0;                                                        // 実速度（加減速あり）
    this.speed = (0.85 + rng() * 0.35) * this.persona.speed;
    STATS.personas[this.persona.key].n++;
    this.adExposed = rng() < adExposureShare();
    // 店内サイネージ接触（FamilyMartVision 認知率55.5%を丸めて58%）
    this.sigExposed = S.signage && rng() < 0.58;
    this.hasNovelty = false; this.novGroup = null;
    this.basket = []; this.revenue = 0;
    this.gazeMap = {}; this.passSet = {};
    this.goldenSec = {}; this.tierSec = {};            // 注意の「質」（ゴールデン帯・段別）
    this.cmpCount = 0; this.bandSeen = null; this.lastBand = -1;   // 段をまたぐ比較サッケード
    this.state = 'plan'; this.wait = 0; this.wp = [];
    this.targetShelf = null; this.plan = [];
    this.done = false; this.walkPhase = rng() * 6.28;
    this.mesh = null;

    const wanderer = rng() < 0.15;
    const [smin, smax] = this.persona.stops;
    const n = wanderer ? 0 : smin + Math.floor(rng() * (smax - smin + 1));
    const cand = SHELVES.filter(s => !s.promoted && !s.counter && s.pop > 0);
    const effPop = s => s.pop * (this.persona.aff[s.cat] || 1) * weatherCat(s.cat);
    const picked = [];
    for (let i = 0; i < n; i++) {
      let r = rng() * cand.reduce((a, s) => a + effPop(s), 0);
      for (const s of cand) { r -= effPop(s); if (r <= 0) { if (!picked.includes(s)) picked.push(s); break; } }
    }
    if (this.adExposed && rng() < 0.72) picked.push(promotedShelf());
    else if (this.sigExposed && rng() < 0.26) picked.push(promotedShelf());
    else if (rng() < (S.endcap ? 0.16 : 0.07)) picked.push(promotedShelf());
    if (wanderer) picked.push(SHELVES[Math.floor(rng() * Math.min(SHELVES.length, 12))]);

    let cur = { x: this.x, z: this.z };
    while (picked.length) {
      let bi = 0, bd = 1e9;
      picked.forEach((s, i) => { const d = Math.hypot(s.approach[0] - cur.x, s.approach[1] - cur.z); if (d < bd) { bd = d; bi = i; } });
      const s = picked.splice(bi, 1)[0];
      this.plan.push(s); cur = { x: s.approach[0], z: s.approach[1] };
    }
    STATS.visitors++;
    if (this.adExposed) { STATS.adVisitors++; STATS.adStoreVisits++; }
    if (rng() < 0.06) beacon(`客#${this.id}（${this.persona.label}）入店${this.adExposed ? '・広告接触' : ''}`, this.adExposed ? 'seg-ad' : '');
  }

  nextLeg() {
    this.legT = 0; this.lastD = null;
    if (this.plan.length) {
      const s = this.plan.shift();
      if (s.promoted && !S.endcap && s.id === STORE.promoted.mainId) { this.nextLeg(); return; }
      this.targetShelf = s;
      // 目当てのフェイスは什器の長手方向にも分布する（買いたい商品の位置）
      this.standU = clamp(0.5 + gauss3() * 0.26, 0.06, 0.94);
      this.wp = routePoints(this, approachSpot(s, this.standU));
      this.state = 'walk';
    } else if (!this.paid && this.basket.length) {
      this.targetShelf = null;
      const open = REGS.filter(r => r.open);
      let best = open[0];
      open.forEach(r => { if (r.queue.length < best.queue.length) best = r; });
      this.reg = best;
      this.wp = routePoints(this, best);
      this.state = 'toRegister';
    } else {
      this.targetShelf = null;
      const ext = nearestOf(STORE.entrances, this.x, this.z);
      this.wp = routePoints(this, ext);
      this.state = 'exit';
    }
  }

  dwellAt(shelf, dt) {
    this.wait -= dt;
    // 棚前のサイドステップ: 同じ什器の別のフェイスを見に、ゆっくり横移動する
    this.stepTimer = (this.stepTimer || 0) - dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = 4 + rng() * 7;
      this.standU = clamp((this.standU != null ? this.standU : 0.5) + gauss3() * 0.13, 0.06, 0.94);
      this.standSpot = approachSpot(shelf, this.standU);
    }
    if (this.standSpot) {
      const sdx = this.standSpot.x - this.x, sdz = this.standSpot.z - this.z;
      const sd = Math.hypot(sdx, sdz);
      this.v = sd > 0.06 ? this.speed * 0.3 : 0;
      if (sd > 0.06) {
        const st = Math.min(this.v * dt, sd);
        this.x += (sdx / sd) * st; this.z += (sdz / sd) * st;
      }
    } else this.v = 0;
    this.faceShelf(shelf, dt);
    this.fixTimer = (this.fixTimer || 0) - dt;
    if (this.fixTimer <= 0) this.sampleFixation(shelf);   // 次の注視点へ視線を移す
    else if (this.fix && this.fix.sid === shelf.id) this.setFixOn(shelf);   // 横移動に注視点を追従
    this.updateGazePose(dt);
    if (this.wait <= 0) {
      const st = STATS.shelves[shelf.id];
      // ---- この立寄で実際に「どこを何秒見たか」を購買行動へ接続する ----
      const q = this.attentionQuality(shelf);
      st.attnSum += q.attn; st.dwellN++;
      // 段別の注意秒（表示用）
      const cur = this.tierSec[shelf.id], t0 = this.dwellTier0;
      if (cur) for (let i = 0; i < 4; i++) st.tierDwellSec[i] += Math.max(0, cur[i] - (t0 ? t0[i] : 0));
      // 段の効果は「目当てがどの段にあったか」の無作為割付で識別する
      const tt = this.targetTier;
      if (tt != null) st.tierTrials[tt]++;
      if (rng() < clamp(PICK_BASE * q.pickMult, 0.02, 0.97)) {
        st.picks++;
        if (tt != null) st.tierPicks[tt]++;
        this.reach = 1;                                    // 商品へ手を伸ばす
        let pBuy = shelf.base * this.persona.buy * Math.sqrt(weatherCat(shelf.cat));
        pBuy *= q.buyMult;                                 // 注意の量と質が転換に効く
        let priceMult = this.persona.priceMult;
        if (shelf === promotedShelf()) {
          pBuy *= PLANO.conv;                       // 棚割シミュレーターの反映
          // クロスメディア接触効果（FamilyMartVision実証: 複数媒体接触で最大約1.7倍）
          if (this.adExposed && this.sigExposed) pBuy *= 1.7;
          else if (this.adExposed) pBuy *= 1.45;
          else if (this.sigExposed) pBuy *= 1.2;
          if (this.hasNovelty) pBuy *= (1 + NOV_TRUE_LIFT);
          if (dynPricingActive()) { pBuy *= 1.3; priceMult = 0.85; }   // トライアル型 自動値下げ
        } else if (this.hasNovelty) pBuy *= 1.06;
        if (rng() < clamp(pBuy, 0, 0.96)) {
          const isPromo = shelf === promotedShelf();
          if (isPromo && stockState.units <= 0) {
            stockState.missed += STORE.sampleFactor;   // 在庫内生性: 品切れ中の機会損失（実数換算）
          } else {
            st.purchases++;
            st.attnBuySum += q.attn;
            if (tt != null) st.tierBuys[tt]++;
            const price = shelf.price * (0.8 + rng() * 0.5) * priceMult;
            this.basket.push(shelf.id); this.revenue += price;
            if (isPromo) {
              STATS.promoUnits++;
              stockState.units = Math.max(0, stockState.units - STORE.sampleFactor);
              if (rng() < 0.12) beacon(`客#${this.id} 販促商品を購入 ${fmtYenFull(price)}`, 'seg-buy');
            }
          }
        }
      }
      this.targetFrac = null;
      this.sampleWalkFixation();
      this.nextLeg();
    }
  }

  /* ---- 注意の量と質を購買行動へ変換する ----
     アイトラッキング×購買の知見にもとづく3成分:
       ① 注視時間  … 効果は飽和する（対数）。最初の数秒が効き、それ以上は逓減
       ② 比較行動  … 一度見た段へ戻るサッケードの回数。購買の強い予測子
       ③ 注視位置  … 同じ秒数でもゴールデン帯（床上85〜150cm）で見たほうが手に取られやすい
     いずれも基準点（中央値）で係数1.0になるよう正規化してあるので、
     全体のKPI（客単価・買上率・日販）は公開統計への較正を保ったまま、
     個々の棚では「視線を集めた棚ほど売れる」という因果が成立する。 */
  attentionQuality(shelf) {
    const attn = Math.max(0, (this.gazeMap[shelf.id] || 0) - (this.dwellAttn0 || 0));
    const gold = Math.max(0, (this.goldenSec[shelf.id] || 0) - (this.dwellGold0 || 0));
    const gShare = attn > 0.2 ? gold / attn : GOLD_REF;
    const eng = Math.log1p(attn / ATTN_REF) / Math.LN2;              // 注視秒: 基準で1.0
    const cmp = Math.log1p(this.cmpCount / CMP_REF) / Math.LN2;      // 比較: 基準で1.0
    const gq = gShare - GOLD_REF;                                    // ゴールデン帯シェアの基準差
    const reach = this.targetTier != null ? TIER_REACH[this.targetTier] : 1;
    return {
      attn, gShare, cmp: this.cmpCount, reach,
      pickMult: clamp((0.372 + 0.42 * eng + 0.24 * cmp + 0.40 * gq) * reach, 0.05, 2.2),
      buyMult:  clamp(0.6415 + 0.28 * eng + 0.10 * cmp + 0.14 * gq, 0.30, 1.7),
    };
  }

  /* 立寄中の注視点サンプリング（サッケード1回分）
     棚前の視線は単一のピークではなく、4つの行動が重なった混合分布として立ち上がる。
       ① 快適域   … アイレベルからやや下（ゴールデンゾーンが成立する主因）
       ② 上下走査 … 什器全体を舐めるように探索する（最上段・最下段にも必ず入る）
       ③ 目的の段 … 買う予定の商品がある段を直接見に行く（段は全段に分布）
       ④ 下段確認 … 価格・容量・在庫を見るためにしゃがむ/見下ろす（最下段が 0 にならない要因）
     アイトラッキング文献では最下段でも全注視の 8〜12% 程度が観測されるため、
     ④ を明示的に持たせて「棚の下が全く見られない」状態が起きないようにしている。 */
  sampleFixation(s) {
    const H = (s && s.size[1]) || 1.6;
    const E = this.eyeH || 1.6;
    const topLimit = Math.min(H * 0.97, E + 0.34);
    let r = rng(), y;
    if ((r -= 0.44) < 0) {
      y = E - 0.45 + gauss3() * 0.195;                   // ① 快適域
    } else if ((r -= 0.25) < 0) {
      y = 0.10 + rng() * (topLimit - 0.10);              // ② 什器全体の上下走査
    } else if ((r -= 0.21) < 0) {
      const tf = this.targetFrac != null ? this.targetFrac : 0.60;
      y = tf * H + gauss3() * 0.09;                      // ③ 目当ての段
    } else {
      y = 0.08 + rng() * 0.47;                           // ④ 下段の確認（床上8〜55cm）
    }
    this.gazeTargetY = clamp(y, 0.10, H * 0.98);
    // 横方向の走査幅は什器の長さに比例（長い什器ながら左右に広く探す）
    const span = s ? Math.min(1.7, 0.55 + shelfAxis(s).len * 0.13) : 0.75;
    this.gazeLateral = gauss3() * span * 0.34;
    this.fixTimer = 1.5 + rng() * 2.3;                   // 次のサッケードまで
    // 一度見た段へ戻るサッケード＝比較検討の証拠。購買予測で最も強い指標のひとつ
    const band = tierOfY(this.gazeTargetY);
    if (this.bandSeen) {
      if (band !== this.lastBand && this.bandSeen[band]) this.cmpCount++;
      this.bandSeen[band] = 1;
    }
    this.lastBand = band;
    this.setFixOn(s);
  }

  /* 注視点を「棚面上の一点」としてワールド座標で確定させる。
     人間の中心視は常に1点であり、同時に複数の棚を注視することはない。
     これを持つことで、視線レイ・頭部の向き・計測セルが完全に一致する。 */
  setFixOn(s) {
    if (!s) { this.fix = null; return; }
    const { alongX, len } = shelfAxis(s);
    const rel = alongX ? (this.x - s.pos[0]) : (this.z - s.pos[2]);
    let uf = (rel + (this.gazeLateral || 0)) / Math.max(len, 0.1) + 0.5;
    if (uf < 0) uf = -uf; else if (uf > 1) uf = 2 - uf;
    const u = clamp(uf, 0, 0.999);
    const y = s.kind === 'island-case'
      ? 0.50 + rng() * 0.549                             // 平ケースは天面を手前から奥まで見渡す
      : clamp(this.gazeTargetY != null ? this.gazeTargetY : this.eyeH0 - 0.45, 0.08, s.size[1] * 0.98);
    const p = shelfFacePoint(s, u, y, this.z);
    this.fix = { sid: s.id, u, y, x: p[0], z: p[2] };
  }

  /* 通過中の視線: 実際の買物客は「進行方向」と「両脇の棚へのちら見」を交互に行う。
     ちら見の対象は、見える位置にある棚から1つだけ選ぶ（中心視は1点）。 */
  sampleWalkFixation() {
    this.fixTimer = 0.7 + rng() * 1.3;
    const E = this.eyeH0;
    if (rng() < 0.42) {                                   // 進行方向を見る（注視棚なし）
      this.fix = null;
      this.gazeTargetY = clamp(E - 0.12 + gauss3() * 0.14, 0.9, E + 0.3);
      return;
    }
    const hx = Math.sin(this.heading), hz = Math.cos(this.heading);
    let best = null, bw = 0;
    for (const s of SHELVES) {
      if (s.promoted && !S.endcap && s.id === STORE.promoted.mainId) continue;
      const np = shelfNearPoint(s, this.x, this.z);
      const dx = np.x - this.x, dz = np.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > GAZE_DIST || d < 0.05) continue;
      if ((dx * hx + dz * hz) / d < -0.1) continue;                     // 背後は見ない
      if ((this.x - np.x) * s.normal[0] + (this.z - np.z) * s.normal[2] < 0) continue;
      if (losBlocked(this.x, E, this.z, np.x, E - 0.3, np.z, s.id)) continue;   // 什器越しは見えない
      const w = (1 - d / GAZE_DIST) * (0.25 + (s.pop || 0.1) * 2.2) * (0.5 + rng());
      if (w > bw) { bw = w; best = s; }
    }
    if (!best) { this.fix = null; this.gazeTargetY = E - 0.12; return; }
    const H = best.size[1];
    // 歩きながらの視線は上下走査が浅く、アイレベルよりやや下に集まる
    const y = rng() < 0.18 ? 0.14 + rng() * 0.48 : E - 0.52 + gauss3() * 0.27;
    this.gazeTargetY = clamp(y, 0.10, H * 0.98);
    this.gazeLateral = gauss3() * 0.28;
    this.setFixOn(best);
  }

  /* 体の向き。棚前では通路に対して正対しつつ、頭だけがフェイスを追う。 */
  faceShelf(shelf, dt) {
    const want = Math.atan2(shelf.pos[0] - this.x, shelf.pos[2] - this.z);
    let dh = want - this.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    this.heading += clamp(dh, -2.6 * dt, 2.6 * dt);
  }

  /* 頭部・視線の姿勢を更新する。
     ・頭は体に対して ±72° までしか回らない（それ以上は体ごと向き直る）
     ・下段を覗き込むときは屈む（目線高さが下がり、無理な俯角にならない）
     ・視線の向き＝計測に使う軸。身体の向きではない。 */
  updateGazePose(dt) {
    const f = this.fix;
    let wantYaw = this.heading, wantPitch = 0, wantBend = 0;
    if (f) {
      const dx = f.x - this.x, dz = f.z - this.z;
      const hd = Math.hypot(dx, dz) || 1e-3;
      wantYaw = Math.atan2(dx, dz);
      let rel = wantYaw - this.heading;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      if (Math.abs(rel) > 1.26) {                          // 首の可動域を超えたら体ごと回る
        const over = Math.sign(rel) * (Math.abs(rel) - 1.26);
        this.heading += clamp(over, -2.2 * dt, 2.2 * dt);
      }
      const pitch0 = Math.atan2(f.y - this.eyeH0, hd);
      // 俯角が −42° を超える＝立ったままでは無理 → 膝と腰を折って目線を下げる
      if (pitch0 < -0.73) wantBend = clamp((-pitch0 - 0.73) / 0.5, 0, 1);
      wantPitch = Math.atan2(f.y - (this.eyeH0 - wantBend * 0.52), hd);
      wantPitch = clamp(wantPitch, -1.12, 0.62);
    }
    let dy = wantYaw - this.headYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    this.headYaw += clamp(dy, -5.5 * dt, 5.5 * dt);         // サッケード後の頭部回旋
    // 首の可動域は体に対して ±74°。これを超えた向きは物理的に取れない
    let off = this.headYaw - this.heading;
    while (off > Math.PI) off -= 2 * Math.PI; while (off < -Math.PI) off += 2 * Math.PI;
    this.headYaw = this.heading + clamp(off, -1.29, 1.29);
    this.headPitch += clamp(wantPitch - this.headPitch, -3.4 * dt, 3.4 * dt);
    this.bend += clamp(wantBend - this.bend, -1.6 * dt, 1.6 * dt);
    this.eyeH = this.eyeH0 - this.bend * 0.52;
    if (this.reach > 0) this.reach = Math.max(0, this.reach - dt * 0.9);
  }

  update(dt) {
    if (this.done) return;
    if (this.state === 'plan') { this.nextLeg(); return; }
    if (this.state === 'dwell') { this.dwellAt(this.dwellShelf, dt); return; }
    if (this.state === 'queue') {
      const reg = this.reg;
      const idx = reg.queue.indexOf(this);
      const tx = reg.x + reg.dir[0] * idx, tz = reg.z + reg.dir[1] * idx;
      const dx = tx - this.x, dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.12) {
        this.v += clamp(this.speed * 0.7 - this.v, -WALK_DEC * dt, WALK_ACC * dt);
        const step = Math.min(Math.max(this.v, 0) * dt, d);
        this.x += (dx / d) * step; this.z += (dz / d) * step;
        let dh = Math.atan2(dx, dz) - this.heading;
        while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        this.heading += clamp(dh, -TURN_RATE * dt, TURN_RATE * dt);
      } else {
        this.v = 0;
        if (idx === 0) {
          this.state = 'pay'; this.wait = 20 + rng() * 30;
          STATS.waitSum += STATS.simSec - this.queueJoin; STATS.waitN++;
          this.heading = Math.atan2(-reg.dir[0], -reg.dir[1]);
        }
      }
      this.updateGazePose(dt);
      return;
    }
    if (this.state === 'pay') {
      this.wait -= dt;
      this.v = 0; this.fix = null; this.updateGazePose(dt);
      if (this.wait <= 0) {
        if (this.reg) { const qi = this.reg.queue.indexOf(this); if (qi >= 0) this.reg.queue.splice(qi, 1); }
        this.paid = true;
        STATS.buyers++; STATS.revenue += this.revenue;
        STATS.personas[this.persona.key].buyers++;
        STATS.personas[this.persona.key].revenue += this.revenue;
        const b = Math.floor((STATS.simSec - 10 * 3600) / 1800);
        if (b >= 0 && b < STATS.buckets.length) STATS.buckets[b] += this.revenue;
        const boughtPromo = this.basket.includes(promotedShelf().id);
        const cg = this.adExposed && this.sigExposed ? 'both' : (this.adExposed ? 'ad' : (this.sigExposed ? 'sig' : 'none'));
        STATS.cross[cg].n++; if (boughtPromo) STATS.cross[cg].buy++;
        if (this.novGroup === 'treat') { if (boughtPromo) STATS.nov.treatBuy++; STATS.nov.treatRev += this.revenue; }
        if (this.novGroup === 'ctrl') { if (boughtPromo) STATS.nov.ctrlBuy++; STATS.nov.ctrlRev += this.revenue; }
        const pReturn = 0.22 * (this.hasNovelty ? 1.35 : 1);
        if (rng() < pReturn) STATS.returns++;
        this.nextLeg();
      }
      return;
    }

    if (!this.wp.length) { this.nextLeg(); return; }
    const t = this.wp[0];
    const dx = t.x - this.x, dz = t.z - this.z;
    const d = Math.hypot(dx, dz);
    // 到達判定。旋回半径より小さい許容半径だと的の周りを回り続けてしまうため、
    // 「十分近い」か「通り過ぎた」か「時間がかかりすぎた」で次の点へ進む。
    this.legT = (this.legT || 0) + dt;
    const arriveR = Math.max(0.26, (this.v || 0) * dt * 0.95);   // 早送り時は1歩幅が大きくなる
    const passed = this.lastD != null && d > this.lastD && d < arriveR + 0.55;
    this.lastD = d;
    if (d < arriveR || passed || this.legT > 26) {
      this.wp.shift();
      this.legT = 0; this.lastD = null;
      if (!this.wp.length) {
        if (this.state === 'walk' && this.targetShelf) {
          const s = this.targetShelf;
          STATS.shelves[s.id].stops++;
          this.dwellShelf = s; this.state = 'dwell';
          // 目当ての商品がどの段にあるか（商品は全段に分布する）
          const bands = [0.20, 0.45, 0.66, 0.89], bw = [0.15, 0.33, 0.34, 0.18];
          let rb = rng(), bi = 0;
          for (let k = 0; k < bw.length; k++) { rb -= bw[k]; if (rb <= 0) { bi = k; break; } }
          this.targetFrac = clamp(bands[bi] + (rng() - 0.5) * 0.10, 0.08, 0.95);
          this.targetTier = tierOfY(this.targetFrac * s.size[1]);   // 段の無作為割付
          this.cmpCount = 0; this.bandSeen = new Uint8Array(4); this.lastBand = -1;
          this.dwellAttn0 = this.gazeMap[s.id] || 0;      // 立寄開始時点の累計注意秒
          this.dwellGold0 = this.goldenSec[s.id] || 0;
          this.dwellTier0 = Float64Array.from(this.tierSec[s.id] || new Float64Array(4));
          this.sampleFixation(s);
          this.wait = (10 + rng() * 20) * this.persona.dwell;
          if (rng() < 0.05) beacon(`客#${this.id} 「${s.name}」に立寄`, this.hasNovelty ? 'seg-nov' : '');
        } else if (this.state === 'toRegister') {
          const reg = this.reg || REGS[0];
          if (reg.queue.length >= balkThreshold() && rng() < 0.45) {
            // 行列を見て離脱（機会損失）
            STATS.balked++; STATS.balkedRev += this.revenue;
            if (rng() < 0.25) beacon(`客#${this.id} 行列を見て退店（機会損失 ${fmtYenFull(this.revenue)}）`, 'seg-ad');
            this.revenue = 0; this.basket = []; this.paid = true;
            this.nextLeg();
          } else {
            reg.queue.push(this);
            this.state = 'queue'; this.queueJoin = STATS.simSec;
            this.maybeImpulseCounter();
          }
        } else if (this.state === 'exit') {
          this.done = true;
        }
      }
      return;
    }
    this.fixTimer = (this.fixTimer || 0) - dt;
    if (this.fixTimer <= 0) this.sampleWalkFixation();

    // --- 進みたい方向 = 経路方向 ＋ 対人回避（目標が近いほど回避を弱める） ---
    const av = avoidSteer(this);
    const avW = clamp((d - 0.3) / 0.8, 0, 1);
    let ux = dx / d + av.x * avW, uz = dz / d + av.z * avW;
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;

    // --- 旋回（角速度に上限。ただし遅いほどその場で向きを変えられる） ---
    const targetHeading = Math.atan2(ux, uz);
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    const turnCap = TURN_RATE * (1 + 1.8 * (1 - clamp(this.v / (this.speed || 1), 0, 1)));
    this.heading += clamp(dh, -turnCap * dt, turnCap * dt);

    // --- 加減速（曲がる・到着する・混む と遅くなる） ---
    let vWant = this.speed * av.slow;
    vWant *= 1 - Math.min(0.55, Math.abs(dh) * 0.34);
    if (this.wp.length <= 1) vWant *= clamp(d / 0.9, 0.3, 1);
    const a = vWant > this.v ? WALK_ACC : WALK_DEC;
    this.v += clamp(vWant - this.v, -a * dt, a * dt);
    const step = Math.min(Math.max(this.v, 0) * dt, d);
    this.x += Math.sin(this.heading) * step;
    this.z += Math.cos(this.heading) * step;
    pushOutOfFixtures(this);
    this.updateGazePose(dt);

    if (S.novelty && this.novGroup === null) {
      const dn = Math.hypot(this.x - STORE.novStand.x, this.z - STORE.novStand.z);
      if (dn < 2.0) {
        if (rng() < S.novRate) {
          this.novGroup = 'treat'; this.hasNovelty = true;
          STATS.nov.treat++; STATS.applied++;
          const promo = promotedShelf();
          if (!this.plan.includes(promo) && !this.basket.includes(promo.id) && rng() < 0.4) this.plan.push(promo);
          if (rng() < 0.1) beacon(`客#${this.id} ノベルティ受取（処置群）`, 'seg-nov');
        } else {
          this.novGroup = 'ctrl'; STATS.nov.ctrl++;
        }
      }
    }
  }

  maybeImpulseCounter() {
    const counter = SHELVES.find(s => s.counter);
    if (counter && rng() < 0.3) {
      const st = STATS.shelves[counter.id];
      st.stops++; st.picks++;
      if (rng() < counter.base) {
        st.purchases++;
        const price = counter.price * (0.9 + rng() * 0.3);
        this.basket.push(counter.id); this.revenue += price;
      }
    }
  }
}

function cloudSafeRand() { return rng(); }

/* ゴールデンゾーン（床上85〜150cmに什器売上の8〜9割）の判定 */
const GOLD_LO = 0.85, GOLD_HI = 1.50;
/* 注意→購買モデルの基準点。いずれも実測分布の中央値で、ここで係数が1.0になる */
const ATTN_REF = 21.5, CMP_REF = 2.55, GOLD_REF = 0.568, PICK_BASE = 0.639;
/* 段の「手に取りやすさ」（人間工学的な到達コスト）。
   見つけた後に実際に掴む段階のコストで、注目度とは独立した経路。
   最下段は屈む必要があり、上段は腕を伸ばして棚の奥が見えない。
   これがシミュレーション側の"真の"段効果で、棚割シミュレーターが持つ
   通説の段係数（0.55/0.95/1.40/0.90）とは意図的に別の値にしてある。
   段への割付は無作為なので、自然実験としてこの真値を推定できる。 */
const TIER_REACH = [0.70, 0.95, 1.12, 0.80];
/* 段の帰属（棚割シミュレーターの4段に合わせた床上高さ） */
const TIER_CM4 = [30, 75, 115, 155];
function argMax4(a) { let bi = 0; for (let i = 1; i < 4; i++) if (a[i] > a[bi]) bi = i; return bi; }
function tierOfY(y) {
  const hcm = y * 100;
  let bi = 0, bd = 1e9;
  for (let i = 0; i < 4; i++) { const d = Math.abs(TIER_CM4[i] - hcm); if (d < bd) { bd = d; bi = i; } }
  return bi;
}

/* 棚面の格子セルへ注目秒を積む。u/v は呼び出し側が確定させる */
function accumulateGaze(s, u, y, w, agent) {
  const st = STATS.shelves[s.id];
  if (!st.grid) st.grid = new Float32Array(GRID_U * GRID_V);
  const v = s.kind === 'island-case'
    ? clamp((y - 0.5) / 0.55, 0, 0.999)
    : clamp(y / Math.max(s.size[1], 0.5), 0, 0.999);
  const gi = Math.floor(v * GRID_V) * GRID_U + Math.floor(clamp(u, 0, 0.999) * GRID_U);
  st.grid[gi] += w;
  if (st.gridRecent) st.gridRecent[gi] += w;
  if (st.gridLive) st.gridLive[gi] += w;
  if (st.gridWho) st.gridWho[gi] = agent.persona.pidx;
  st.gazeSec += w;
  // 注意の「質」: ゴールデン帯か、どの段か。購買への効きを分けるために分解して持つ
  const golden = s.kind !== 'island-case' && y >= GOLD_LO && y <= GOLD_HI;
  if (golden) st.goldenSec += w;
  const ti = tierOfY(s.kind === 'island-case' ? 1.0 : y);
  st.tierSec[ti] += w;
  if (agent) {
    agent.goldenSec[s.id] = (agent.goldenSec[s.id] || 0) + (golden ? w : 0);
    agent.tierSec[s.id] = agent.tierSec[s.id] || new Float64Array(4);
    agent.tierSec[s.id][ti] += w;
  }
  STATS.gazeEvents++;
  return gi;
}

/* 同じ注視イベントを「AIカメラが観測できた形」で別レイヤーへ積む。
   観測できなければ何も積まない＝欠測。積めても姿勢推定誤差でセルがずれる。 */
function accumulateObserved(s, u, y, w, agent, dist, trueGi) {
  const st = STATS.shelves[s.id];
  st.trueSecForObs = (st.trueSecForObs || 0) + w;
  const obs = agent.obs;
  if (!obs || obs.n === 0) return;                      // どのカメラにも映っていない
  if (rng() > obs.recall) return;                       // 検出漏れ（フレーム落ち）
  // 姿勢推定誤差: 台数が増えるほど小さくなる（多視点で頭部姿勢が安定する）
  const sd = CAM_POSE_SD / Math.sqrt(obs.n) / Math.max(obs.q, 0.25);
  const off = sd * Math.max(dist, 0.4);                 // 棚面上の位置ズレ（m）
  const { len } = shelfAxis(s);
  const uo = clamp(u + gauss3() * off / Math.max(len, 0.3), 0, 0.999);
  const hRange = s.kind === 'island-case' ? 0.55 : Math.max(s.size[1], 0.5);
  const yo = s.kind === 'island-case'
    ? clamp(y + gauss3() * off * 0.55, 0.5, 1.049)
    : clamp(y + gauss3() * off, 0.02, s.size[1] * 0.99);
  const v = s.kind === 'island-case' ? clamp((yo - 0.5) / 0.55, 0, 0.999) : clamp(yo / hRange, 0, 0.999);
  const gi = Math.floor(v * GRID_V) * GRID_U + Math.floor(uo * GRID_U);
  st.gridObs[gi] += w;
  st.gazeSecObs += w;
  st.cellTot++; if (gi === trueGi) st.cellHit++;
  STATS.obsEvents++;
}

/* ---------- 視線検知 ----------
   実際の視覚は「中心視1点 ＋ その周囲へ急減衰する有効視野」でできている。
   ここでは注視点（fix）を1点だけ持ち、
     ・中心窩（±7°）… 注視している棚のそのセルへ
     ・有効視野（±22°）… 周辺の棚へ弱く
   という二重ガウスの重みで配分する。さらに
     ・什器越しは見えない（遮蔽判定）
     ・棚の背面は見えない
     ・無理な俯角/仰角は見えない
   を課すことで、「どこを見られているか」を頭部姿勢から素直に復元できる形にしている。 */
const GAZE_DIST = 2.9, GAZE_MAX_ANG = 0.92;              // 約53°で打ち切り
function acuity(ang) {
  return 0.74 * Math.exp(-0.5 * Math.pow(ang / 0.122, 2))   // 中心窩 σ≈7°
       + 0.26 * Math.exp(-0.5 * Math.pow(ang / 0.384, 2));  // 有効視野 σ≈22°
}

function senseGaze(agent, interval) {
  agent.gazeW = 0;
  const ex = agent.x, ez = agent.z, ey = agent.eyeH;
  // このフレームでAIカメラがこの客をどう観測できているか（頭部位置で判定）
  const o = observeAt(ex, ey, ez, null);
  agent.obs = { n: o.n, q: o.q, recall: o.n ? clamp(CAM_RECALL * crowdOcclusion(agent) * clamp(o.q * 1.15, 0.3, 1), 0, 0.99) : 0 };
  agent.obsConf = o.n ? clamp(0.52 + o.n * 0.11 + o.q * 0.18, 0, 0.99) : 0;
  // 視線軸（注視点がなければ頭の向き＝進行方向）
  const cp = Math.cos(agent.headPitch);
  const axX = Math.sin(agent.headYaw) * cp, axZ = Math.cos(agent.headYaw) * cp;
  const axY = Math.sin(agent.headPitch);
  const fixSid = agent.fix ? agent.fix.sid : null;

  for (const s of SHELVES) {
    if (s.promoted && !S.endcap && s.id === STORE.promoted.mainId) continue;
    const isFix = s.id === fixSid;
    // 什器は線分として扱う（5mの棚の端に立った客を「見ていない」と誤判定しないため）
    const np = shelfNearPoint(s, ex, ez);
    const d0 = Math.hypot(np.x - ex, np.z - ez);
    if (d0 > GAZE_DIST + 0.3) continue;
    if (d0 < 2.2 && !agent.passSet[s.id]) {
      agent.passSet[s.id] = 1; STATS.shelves[s.id].passes++;
      if (agent.obs.n > 0 && rng() < agent.obs.recall) STATS.shelves[s.id].passesObs++;
    }
    // 棚の背面からは見えない
    if ((ex - np.x) * s.normal[0] + (ez - np.z) * s.normal[2] < 0) continue;

    // この棚のどこを見ているか（注視棚は確定点、それ以外は視線軸に最も近い面上の点）
    let u, y, px, py, pz;
    if (isFix) {
      u = agent.fix.u; y = agent.fix.y; px = agent.fix.x; py = agent.fix.y; pz = agent.fix.z;
    } else if (s.kind === 'island-case') {
      // 平ケースは天面（水平面）との交点。v軸は高さではなく奥行き
      const topY = s.size[1] * 0.87;
      const t = axY < -1e-3 ? (topY - ey) / axY : -1;
      if (t <= 0.05 || t > GAZE_DIST * 1.6) continue;
      const hx2 = ex + axX * t, hz2 = ez + axZ * t;
      u = clamp((hx2 - s.pos[0]) / (s.size[0] * 0.92) + 0.5, 0, 0.999);
      const sgn = ez < s.pos[2] ? -1 : 1;
      const dv = clamp(0.5 - sgn * (hz2 - s.pos[2]) / (s.size[2] * 0.9), 0, 0.999);
      y = 0.5 + dv * 0.549;
      px = hx2; py = topY; pz = hz2;
    } else {
      const { alongX, len } = shelfAxis(s);
      // 視線軸を棚の正面平面へ伸ばし、当たる位置を面上の座標へ
      const nrm = alongX ? s.normal[2] : s.normal[0];
      const axN = alongX ? axZ : axX;
      const facePos = (alongX ? s.pos[2] : s.pos[0]) + nrm * (Math.max((alongX ? s.size[2] : s.size[0]) / 2 - 0.04, 0.05));
      const e0 = alongX ? ez : ex;
      const t = Math.abs(axN) > 1e-3 ? (facePos - e0) / axN : -1;
      if (t <= 0.05 || t > GAZE_DIST * 1.6) continue;
      const alongHit = (alongX ? ex + axX * t : ez + axZ * t) - (alongX ? s.pos[0] : s.pos[2]);
      let uf = alongHit / Math.max(len, 0.1) + 0.5;
      if (uf < 0) uf = -uf; else if (uf > 1) uf = 2 - uf;
      u = clamp(uf, 0, 0.999);
      y = clamp(ey + axY * t, 0.05, s.size[1] * 0.98);
      const p = shelfFacePoint(s, u, y, ez);
      px = p[0]; py = y; pz = p[2];
    }

    // 視線軸からの離角（中心視からのズレ）
    const vx = px - ex, vy = py - ey, vz = pz - ez;
    const vl = Math.hypot(vx, vy, vz) || 1e-3;
    if (vl > GAZE_DIST) continue;
    const ang = Math.acos(clamp((vx * axX + vy * axY + vz * axZ) / vl, -1, 1));
    if (ang > GAZE_MAX_ANG) continue;
    // 什器越しには見えない
    if (losBlocked(ex, ey, ez, px, py, pz, s.id)) continue;

    let w = interval * acuity(ang) * (1 - 0.45 * (vl / GAZE_DIST));
    if (s.promoted && S.endcap) w *= ENDCAP_ATTENTION * PLANO.attn;
    if (w < interval * 0.004) continue;
    const gi = accumulateGaze(s, u, y, w, agent);
    accumulateObserved(s, u, y, w, agent, vl, gi);

    // 「視線を獲得した」判定は注目秒ベース（0.7秒以上の停留＝fixation とみなす）
    agent.gazeMap[s.id] = (agent.gazeMap[s.id] || 0) + w;
    if (agent.gazeMap[s.id] >= 0.7 && !agent['gz_' + s.id]) {
      agent['gz_' + s.id] = true; STATS.shelves[s.id].gazes++;
      if (agent.obs.n > 0 && rng() < agent.obs.recall) STATS.shelves[s.id].gazesObs++;
    }
    if (w > agent.gazeW) {
      agent.gazeW = w;
      agent.gazeHit = [px, py, pz];
      agent.gazeShelf = s.id;
      agent.gazeCell = gi;
    }
  }
  agent.gazing = agent.gazeW > interval * 0.08;
}

/* ---------- 過去14日 scripted 日次データ ---------- */
let HISTORY = [];
function historyBase() { return STORE.arrivalBase * 60 * 14.4 * STORE.buyRate * STORE.basket * 0.86; }
function genHistory() {
  HISTORY = [];
  histRng = mulberry32(910 + (FKEY === 'depato' ? 77 : 0));
  const base = historyBase();
  for (let d = 1; d <= 14; d++) {
    const week = (d - 1) % 7;
    const weekend = week >= 5 ? STORE.weekendFactor : 1.0;
    const cpOn = d >= 9;
    HISTORY.push({
      day: d,
      revenue: Math.round(base * weekend + (histRng() - 0.5) * base * 0.09
        + (cpOn ? base * 0.155 + (histRng() - 0.5) * base * 0.03 : 0)
        + base * 0.09 * Math.sin(d / 3.1) * 0.5),
      cpOn, anomaly: d === 9,
    });
  }
}
genHistory();

/* ---------- Three.js シーン ---------- */
let renderer, scene, camera, camState;
let storeGroup = null;
const agents = [];
let followTarget = null;
const heat = { grid: null, live: null, canvas: null, tex: null, plane: null, w: 64, h: 40 };
let shelfMeshes = {}, labelSprites = [], novStandGroup = null, promoGroup = null;
let pickMeshes = [];
let selectedShelfId = null;

const CAT_PRODUCT_COLORS = {
  food:  [0xe07b39, 0xc9a227, 0x9fbf3b, 0xd6543f],
  drink: [0x3f8fd6, 0x45b3a2, 0xd6c23f, 0x7a5fd0],
  snack: [0xd6543f, 0xe0a03c, 0x8459c9, 0x3f9fd6],
  daily: [0x8fb3d9, 0xb9c9d9, 0x76c7b5, 0xd9a3b7],
  mag:   [0x66748c, 0xa3b1c9, 0xcdd6e4, 0x8b95ad],
  promo: [0xe36ba0, 0xf0a0c3, 0xd5519a, 0xef8fb5],
  gift:  [0xc9a227, 0xa06fd0, 0x5fa8d9, 0xd66a8a],
  fresh: [0xd66a6a, 0xe0a03c, 0x7fbf5f, 0xcfc39a],
};
const EDGE_COLOR = 0x5c7186, EDGE_OPACITY = 0.45;

function initThree() {
  const container = document.getElementById('view3d');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef5);
  scene.fog = new THREE.Fog(0xe9eef5, 40, 95);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 300);
  camState = Object.assign({}, STORE.camPresets.over);
  applyCam();

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd4dce6, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.65);
  dir.position.set(12, 22, 10); scene.add(dir);

  buildStore();
  buildGazeLines();
  bindCamControls();
  bindPicking();
  window.addEventListener('resize', () => {
    const c = document.getElementById('view3d');
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
  });
}

function applyCam() {
  const { theta, phi, r, tx, ty, tz } = camState;
  camera.position.set(
    tx + r * Math.sin(phi) * Math.sin(theta),
    ty + r * Math.cos(phi),
    tz + r * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(tx, ty, tz);
}

let dragMoved = 0;
function bindCamControls() {
  const el = renderer.domElement;
  let drag = null;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('mousedown', e => { drag = { b: e.button, x: e.clientX, y: e.clientY }; dragMoved = 0; followTarget = null; });
  window.addEventListener('mouseup', () => drag = null);
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 0) {
      camState.theta -= dx * 0.005;
      camState.phi = clamp(camState.phi - dy * 0.005, 0.15, 1.45);
    } else if (drag.b === 2) {
      const s = camState.r * 0.0016;
      camState.tx -= (Math.cos(camState.theta) * dx - Math.sin(camState.theta) * dy) * s;
      camState.tz -= (-Math.sin(camState.theta) * dx - Math.cos(camState.theta) * dy) * s;
    }
    applyCam();
  });
  el.addEventListener('wheel', e => {
    camState.r = clamp(camState.r * (1 + Math.sign(e.deltaY) * 0.08), 3.5, 60);
    applyCam();
  }, { passive: true });
}

let camTween = null, autoFollowTimer = 0;
function tweenCam(to) {
  followTarget = null;
  camTween = { from: Object.assign({}, camState), to, t: 0 };
}
function focusShelf(id) {
  const s = shelfById[id];
  if (!s) return;
  tweenCam({
    theta: Math.atan2(s.normal[0], s.normal[2]),
    phi: 1.1, r: FKEY === 'depato' ? 8 : 6,
    tx: s.pos[0] + s.normal[0] * 0.5, ty: 0.6, tz: s.pos[2] + s.normal[2] * 0.5,
  });
}

/* 棚クリック（売場詳細） */
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
function pickShelfAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(pickMeshes, false);
  return hits.length ? hits[0].object.userData.shelfId : null;
}
let hoverTick = 0;
function bindPicking() {
  const el = renderer.domElement;
  el.addEventListener('click', e => {
    if (dragMoved > 6) return;
    const id = pickShelfAt(e.clientX, e.clientY);
    if (id) { selectShelf(id); focusShelf(id); }
  });
  el.addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - hoverTick < 120) return;
    hoverTick = now;
    el.style.cursor = pickShelfAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
  });
}
function selectShelf(id) {
  if (selectedShelfId && shelfMeshes[selectedShelfId]) {
    const prev = shelfMeshes[selectedShelfId];
    prev.edge.material.color.set(shelfById[selectedShelfId] && shelfById[selectedShelfId].promoted ? 0xd55181 : EDGE_COLOR);
    prev.edge.material.opacity = shelfById[selectedShelfId] && shelfById[selectedShelfId].promoted ? 0.85 : EDGE_OPACITY;
  }
  selectedShelfId = id;
  if (id && shelfMeshes[id]) {
    shelfMeshes[id].edge.material.color.set(0x0f9fba);
    shelfMeshes[id].edge.material.opacity = 1.0;
  }
  if (window.__renderShelfDetail) window.__renderShelfDetail();
}

function neonEdges(geom, color, opacity) {
  const e = new THREE.EdgesGeometry(geom);
  return new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity != null ? opacity : EDGE_OPACITY }));
}

function makeTileTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = c1; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = c2; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = 'rgba(120,140,165,0.18)'; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 32, 32); ctx.strokeRect(32.5, 32.5, 31, 31);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

/* 店員（静的エージェント） */
function mkStaff(x, z, ry) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.9, 10),
    new THREE.MeshLambertMaterial({ color: 0x51657d }));
  body.position.y = 0.45; g.add(body);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.175, 0.4, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }));
  apron.position.y = 0.42; g.add(apron);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xf1e0cd }));
  head.position.y = 1.02; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 10),
    new THREE.MeshLambertMaterial({ color: 0x2c8fa5 }));
  cap.position.y = 1.12; g.add(cap);
  g.position.set(x, 0, z); g.rotation.y = ry || 0;
  storeGroup.add(g);
}

/* 店内サイネージ（リテールメディア）パネル */
let signageGroup = null;
function makeScreen(w, h) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 72;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 128, 72);
  grad.addColorStop(0, '#d55181'); grad.addColorStop(1, '#0f9fba');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 72);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('NEW', 64, 30);
  ctx.font = '600 13px sans-serif';
  ctx.fillText(STORE.promoName, 64, 52);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
function buildSignage() {
  signageGroup = new THREE.Group();
  const spots = [];
  // 入口サイネージ（ポールスタンド）+ レジ上 + 販促什器横
  STORE.entrances.forEach(e => spots.push({ x: e.x + 1.6, z: e.z - 0.9, y: 1.6, w: 0.9, h: 0.55, pole: true }));
  STORE.counters.forEach(c => spots.push({ x: c.x, z: c.z + 0.05, y: c.h + 1.05, w: 1.6, h: 0.9 }));
  const ps = shelfById[STORE.promoted.mainId];
  if (ps) spots.push({ x: ps.pos[0] + 1.1, z: ps.pos[2] + (ps.normal[2] || 0) * 0.6, y: 1.5, w: 0.8, h: 0.5, pole: true });
  spots.forEach(sp => {
    const scr = makeScreen(sp.w, sp.h);
    scr.position.set(sp.x, sp.y, sp.z);
    signageGroup.add(scr);
    const frame = neonEdges(new THREE.BoxGeometry(sp.w + 0.06, sp.h + 0.06, 0.03), 0x45586e, 0.7);
    frame.position.copy(scr.position); signageGroup.add(frame);
    if (sp.pole) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, sp.y, 8),
        new THREE.MeshLambertMaterial({ color: 0x8593a3 }));
      pole.position.set(sp.x, sp.y / 2, sp.z); signageGroup.add(pole);
    }
  });
  storeGroup.add(signageGroup);
}

/* 施設ごとの作り込みディテール */
function buildFacilityExtras() {
  const W = STORE.floorW, D = STORE.floorD, H = STORE.wallH;
  if (FKEY === 'conbini') {
    // ファサード帯（ブランドストライプ・前面と側面のみ控えめに）
    [[0, D / 2, 0, W], [-W / 2, 0, Math.PI / 2, D], [W / 2, 0, Math.PI / 2, D]].forEach(([x, z, ry, len]) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.1), new THREE.MeshLambertMaterial({ color: 0x7fc6d6 }));
      band.position.set(x, H - 0.12, z); band.rotation.y = ry; storeGroup.add(band);
      const band2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.11), new THREE.MeshLambertMaterial({ color: 0xdd8aa8 }));
      band2.position.set(x, H - 0.26, z); band2.rotation.y = ry; storeGroup.add(band2);
    });
    // イートインカウンター（左壁前方）＋スツール
    const eat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 2.0), new THREE.MeshLambertMaterial({ color: 0xe9d9c4 }));
    eat.position.set(-7.6, 0.48, 3.1); storeGroup.add(eat);
    const ee = neonEdges(eat.geometry, EDGE_COLOR, 0.4); ee.position.copy(eat.position); storeGroup.add(ee);
    [2.5, 3.7].forEach(z => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.55, 10), new THREE.MeshLambertMaterial({ color: 0xb9c7d6 }));
      stool.position.set(-6.9, 0.28, z); storeGroup.add(stool);
    });
    // 買い物カゴスタック（入口脇）
    for (let i = 0; i < 3; i++) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.32), new THREE.MeshLambertMaterial({ color: 0x2fa8c9 }));
      bk.position.set(-4.5, 0.1 + i * 0.13, 4.1); storeGroup.add(bk);
    }
    // コーヒーマシン（レジ横）
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.4), new THREE.MeshLambertMaterial({ color: 0x3a4656 }));
    cm.position.set(5.5, 1.28, 3.55); storeGroup.add(cm);
    // ATM（前面右）
    const atm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xc7d2de }));
    atm.position.set(0.4, 0.63, 4.5); storeGroup.add(atm);
    const atmScr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshBasicMaterial({ color: 0x2c8fa5 }));
    atmScr.position.set(0.4, 1.05, 4.24); atmScr.rotation.x = -0.4; storeGroup.add(atmScr);
    // 歩道・車道・駐車枠
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, 2.2), new THREE.MeshLambertMaterial({ color: 0xcfd8e2 }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(0, -0.015, D / 2 + 1.15); storeGroup.add(walk);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, 3.4), new THREE.MeshLambertMaterial({ color: 0x9aa5b1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -0.018, D / 2 + 3.9); storeGroup.add(road);
    for (let i = -3; i <= 3; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xe8edf2 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(i * 2.6, -0.01, D / 2 + 3.9); storeGroup.add(dash);
    }
    // 店員（レジ内側）
    mkStaff(3.6, 3.0, Math.PI);
    mkStaff(4.9, 3.0, Math.PI);
  } else {
    // 構造柱
    [[-8, -4], [8, -4], [-8, 4], [8, 4]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, H, 0.55), new THREE.MeshLambertMaterial({ color: 0xf3f1ec }));
      col.position.set(x, H / 2, z); storeGroup.add(col);
      const ce = neonEdges(col.geometry, 0x9aa8b8, 0.5); ce.position.copy(col.position); storeGroup.add(ce);
    });
    // エスカレーター（右奥コーナー）
    const esc = new THREE.Group();
    [-0.65, 0.65].forEach(off => {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 5.6), new THREE.MeshLambertMaterial({ color: 0xb9c3cf }));
      ramp.position.set(off, 1.0, 0); ramp.rotation.x = off < 0 ? -0.35 : 0.35;
      esc.add(ramp);
      [-0.5, 0.5].forEach(rz => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 5.4), new THREE.MeshLambertMaterial({ color: 0x8593a3, transparent: true, opacity: 0.55 }));
        rail.position.set(off + rz * 0.49, 1.45, 0); rail.rotation.x = off < 0 ? -0.35 : 0.35;
        esc.add(rail);
      });
    });
    esc.position.set(12.3, 0, -5.6); esc.rotation.y = 0;
    storeGroup.add(esc);
    const escLb = makeLabel('エスカレーター（上階へ）', '#5a6b80');
    escLb.position.set(12.3, 3.2, -5.6); storeGroup.add(escLb); labelSprites.push(escLb);
    // 吊りバナー（ゾーンサイン）
    [
      ['スイーツ・洋菓子', '#ffffff', 'rgba(213,81,129,0.92)', -6, -6.8],
      ['惣菜・デリカ', '#ffffff', 'rgba(201,133,0,0.92)', -6.4, -1],
      ['ベーカリー・グロサリー', '#ffffff', 'rgba(15,159,186,0.92)', 6.5, -6.8],
    ].forEach(([txt, fg, bg, x, z]) => {
      const bn = makeLabel(txt, fg, bg);
      bn.position.set(x, H - 0.55, z); bn.scale.multiplyScalar(1.35);
      storeGroup.add(bn); labelSprites.push(bn);
    });
    // 壁面カウンターのブランドファシア（色帯サイン）
    const fasciaColor = { gift: 0xc9a227, fresh: 0xd66a6a, food: 0xe07b39, drink: 0x3f8fd6, daily: 0x8fb3d9 };
    SHELVES.filter(s => s.kind === 'wall').forEach(s => {
      const alongX = s.normal[2] !== 0;
      const fw = (alongX ? s.size[0] : s.size[2]) * 0.86;
      const geo = alongX ? new THREE.BoxGeometry(fw, 0.32, 0.1) : new THREE.BoxGeometry(0.1, 0.32, fw);
      const f = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: fasciaColor[s.cat] || 0x8fa3b8 }));
      f.position.set(
        s.pos[0] + s.normal[0] * 0.15,
        s.size[1] + 0.62,
        s.pos[2] + s.normal[2] * 0.15
      );
      storeGroup.add(f);
    });
    // 店員（島ケース内側・レジ）
    SHELVES.filter(s => s.kind === 'island-case').forEach(s => {
      mkStaff(s.pos[0] + (rng() - 0.5) * 1.2, s.pos[2] - s.normal[2] * 1.15, Math.atan2(s.normal[0], s.normal[2]));
    });
    STORE.counters.forEach(c => mkStaff(c.x - 0.5, c.z - 0.75, Math.PI));
  }
}

function makeLabel(text, colorText, colorBg) {
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  ctx.font = '600 26px "Hiragino Kaku Gothic ProN", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 26;
  c.width = w; c.height = 44;
  ctx = c.getContext('2d');
  ctx.font = '600 26px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillStyle = colorBg || 'rgba(255,255,255,0.88)';
  ctx.strokeStyle = 'rgba(90,110,135,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(1, 1, w - 2, 42, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colorText || '#2c3e55';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 13, 23);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(w / 110, 44 / 110, 1);
  return sp;
}

/* ---------- 店舗構築 ---------- */
function disposeObject(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

function buildStore() {
  if (storeGroup) { scene.remove(storeGroup); disposeObject(storeGroup); }
  storeGroup = new THREE.Group();
  shelfMeshes = {}; labelSprites = []; pickMeshes = []; promoGroup = null; novStandGroup = null;
  const W = STORE.floorW, D = STORE.floorD, H = STORE.wallH;

  // 外周グラウンド・床（タイルテクスチャ）
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: 0xdde4ec }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; storeGroup.add(outer);
  const tileTex = makeTileTexture(FKEY === 'depato' ? '#f6f4ef' : '#f7f9fb', FKEY === 'depato' ? '#efece5' : '#f0f3f7');
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(W / (FKEY === 'depato' ? 2.4 : 1.2), D / (FKEY === 'depato' ? 2.4 : 1.2));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tileTex }));
  floor.rotation.x = -Math.PI / 2; storeGroup.add(floor);
  const grid = new THREE.GridHelper(Math.max(W, D), Math.max(W, D), 0xd3dce6, 0xe4eaf1);
  grid.position.y = 0.004; grid.material.transparent = true; grid.material.opacity = 0.7;
  storeGroup.add(grid);
  const floorEdge = neonEdges(new THREE.BoxGeometry(W, 0.01, D), 0x8aa0b8, 0.8);
  floorEdge.position.y = 0.01; storeGroup.add(floorEdge);

  // 回遊ヒートマップ
  heat.w = STORE.heatW; heat.h = STORE.heatH;
  heat.grid = new Float32Array(heat.w * heat.h);
  heat.live = new Float32Array(heat.w * heat.h);
  heat.canvas = document.createElement('canvas');
  heat.canvas.width = heat.w; heat.canvas.height = heat.h;
  if (heat.tex) heat.tex.dispose();
  heat.tex = new THREE.CanvasTexture(heat.canvas);
  heat.plane = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshBasicMaterial({ map: heat.tex, transparent: true, opacity: 0.9, depthWrite: false })
  );
  heat.plane.rotation.x = -Math.PI / 2; heat.plane.position.y = 0.02;
  storeGroup.add(heat.plane);

  // 壁（ガラス調・細線）
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const mkWall = (w, x, z, ry) => {
    const g = new THREE.BoxGeometry(w, H, 0.08);
    const m = new THREE.Mesh(g, wallMat.clone());
    m.position.set(x, H / 2, z); m.rotation.y = ry || 0; storeGroup.add(m);
    const e = neonEdges(g, 0x8aa0b8, 0.65); e.position.copy(m.position); e.rotation.y = m.rotation.y; storeGroup.add(e);
    const nMull = Math.floor(w / 2.2);
    for (let i = 1; i <= nMull; i++) {
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.03, H, 0.09), new THREE.MeshBasicMaterial({ color: 0xa9bacc }));
      mull.position.set(-w / 2 + (w / (nMull + 1)) * i, H / 2, 0);
      const holder = new THREE.Group();
      holder.add(mull); holder.position.set(x, 0, z); holder.rotation.y = ry || 0;
      storeGroup.add(holder);
    }
  };
  mkWall(W, 0, -D / 2, 0);
  mkWall(D, -W / 2, 0, Math.PI / 2);
  mkWall(D, W / 2, 0, Math.PI / 2);
  const doors = STORE.doors.slice().sort((a, b) => a.x - b.x);
  let cursor = -W / 2;
  doors.forEach(dr => {
    const segW = (dr.x - dr.w / 2) - cursor;
    if (segW > 0.05) mkWall(segW, cursor + segW / 2, D / 2, 0);
    cursor = dr.x + dr.w / 2;
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(dr.w, 1.3), new THREE.MeshBasicMaterial({ color: 0x0f9fba, transparent: true, opacity: 0.14 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(dr.x, 0.015, D / 2 - 0.1); storeGroup.add(mat);
  });
  const lastW = W / 2 - cursor;
  if (lastW > 0.05) mkWall(lastW, cursor + lastW / 2, D / 2, 0);
  const sign = makeLabel(STORE.label + '　' + STORE.storeName, '#0f6f83', 'rgba(255,255,255,0.95)');
  sign.position.set(STORE.doors[0].x, H + 1.0, D / 2 + 0.3);
  storeGroup.add(sign);

  // 天井照明
  const lightRows = FKEY === 'depato' ? 3 : 2;
  for (let r = 0; r < lightRows; r++) {
    const z = -D / 2 + (D / (lightRows + 1)) * (r + 1);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.05, 0.18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, H - 0.25, z); storeGroup.add(bar);
    const be = neonEdges(bar.geometry, 0xc9d4e0, 0.5); be.position.copy(bar.position); storeGroup.add(be);
  }

  // ゴンドラ本体
  STORE.gondolas.forEach(g => {
    const geo = new THREE.BoxGeometry(g.w, g.h, g.d);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf2f5f8 }));
    m.position.set(g.x, g.h / 2, g.z); storeGroup.add(m);
    const e = neonEdges(geo, EDGE_COLOR, 0.5); e.position.copy(m.position); storeGroup.add(e);
  });

  // レジカウンター
  STORE.counters.forEach(c => {
    const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xeef2f6 }));
    m.position.set(c.x, c.h / 2, c.z); storeGroup.add(m);
    const e = neonEdges(geo, 0x3f9b82, 0.8); e.position.copy(m.position); storeGroup.add(e);
    const lb = makeLabel('レジ', '#1d7a5f'); lb.position.set(c.x, c.h + 0.9, c.z); storeGroup.add(lb); labelSprites.push(lb);
    const pos2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.2), new THREE.MeshLambertMaterial({ color: 0x45586e }));
    pos2.position.set(c.x - c.w / 4, c.h + 0.15, c.z); storeGroup.add(pos2);
  });

  // 棚
  const productBoxes = [], productCyls = [];
  SHELVES.forEach(s => buildShelf(s, productBoxes, productCyls));

  // 商品 InstancedMesh
  if (productBoxes.length) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const im = new THREE.InstancedMesh(geo, mat, productBoxes.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();
    productBoxes.forEach((b, i) => {
      eu.set(0, b.ry || 0, 0); q.setFromEuler(eu);
      p.set(b.x, b.y, b.z); sc.set(b.sx, b.sy, b.sz);
      m4.compose(p, q, sc); im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(b.color));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    storeGroup.add(im);
  }
  // 飲料・酒類はボトル型（円筒）で表現
  if (productCyls.length) {
    const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.21, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const im2 = new THREE.InstancedMesh(geo, mat, productCyls.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    q.identity();
    productCyls.forEach((b, i) => {
      p.set(b.x, b.y, b.z); sc.set(1, 0.8 + (i % 5) * 0.12, 1);
      m4.compose(p, q, sc); im2.setMatrixAt(i, m4);
      im2.setColorAt(i, new THREE.Color(b.color));
    });
    im2.instanceMatrix.needsUpdate = true;
    if (im2.instanceColor) im2.instanceColor.needsUpdate = true;
    storeGroup.add(im2);
  }

  buildFacilityExtras();
  buildSignage();

  // ノベルティスタンド
  novStandGroup = new THREE.Group();
  const standGeo = new THREE.CylinderGeometry(0.34, 0.42, 1.0, 10);
  const stand = new THREE.Mesh(standGeo, new THREE.MeshLambertMaterial({ color: 0xf5e3c0 }));
  stand.position.set(STORE.novStand.x, 0.5, STORE.novStand.z); novStandGroup.add(stand);
  const se = neonEdges(standGeo, 0xc98500, 0.8); se.position.copy(stand.position); novStandGroup.add(se);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.72),
    new THREE.MeshBasicMaterial({ color: 0xe8b04b, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  flag.position.set(STORE.novStand.x, 1.55, STORE.novStand.z); novStandGroup.add(flag);
  const novLabel = makeLabel('ノベルティ配布', '#8a5c05');
  novLabel.position.set(STORE.novStand.x, 2.1, STORE.novStand.z); novStandGroup.add(novLabel);
  storeGroup.add(novStandGroup);

  scene.add(storeGroup);
  if (window.__cloudReady) buildPointCloud();
}

function buildShelf(s, productBoxes, productCyls) {
  const g = new THREE.Group();
  const [w, h, d] = s.size;
  const isPromo = !!s.promoted;
  const bodyColor = isPromo ? 0xfdf1f6 : 0xfbfcfe;

  let bodyGeo = null, bodyPos = null;
  if (s.kind === 'island-case') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), new THREE.MeshLambertMaterial({ color: bodyColor }));
    base.position.set(s.pos[0], 0.25, s.pos[2]); g.add(base);
    const glassGeo = new THREE.BoxGeometry(w, 0.55, d);
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshLambertMaterial({ color: 0xdfeaf4, transparent: true, opacity: 0.28 }));
    glass.position.set(s.pos[0], 0.78, s.pos[2]); g.add(glass);
    const ge = neonEdges(glassGeo, isPromo ? 0xd55181 : EDGE_COLOR, isPromo ? 0.85 : EDGE_OPACITY);
    ge.position.copy(glass.position); g.add(ge);
    base.userData.shelfId = s.id; glass.userData.shelfId = s.id;
    pickMeshes.push(base, glass);
    shelfMeshes[s.id] = { group: g, mesh: base, edge: ge };
    for (let row = 0; row < 2; row++) {
      const zOff = (row - 0.5) * d * 0.42;
      const n = Math.floor(w / 0.34);
      const colors = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
      for (let i = 0; i < n; i++) {
        productBoxes.push({
          x: s.pos[0] - w / 2 + 0.25 + i * ((w - 0.5) / Math.max(n - 1, 1)),
          y: 0.60, z: s.pos[2] + zOff,
          sx: 0.2 + rng() * 0.06, sy: 0.12 + rng() * 0.1, sz: 0.2 + rng() * 0.05,
          color: colors[Math.floor(i / 2 + row) % colors.length], ry: (rng() - 0.5) * 0.4,
        });
      }
    }
  } else if (s.kind === 'counter') {
    const n = Math.floor(w / 0.3);
    const colors = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
    for (let i = 0; i < n; i++) {
      productBoxes.push({
        x: s.pos[0] - w / 2 + 0.3 + i * ((w - 0.6) / Math.max(n - 1, 1)),
        y: 1.08, z: s.pos[2],
        sx: 0.16, sy: 0.12 + rng() * 0.06, sz: 0.16,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.pos[0], 0.6, s.pos[2]); g.add(hit);
    hit.userData.shelfId = s.id; pickMeshes.push(hit);
    const dummyEdge = neonEdges(new THREE.BoxGeometry(0.01, 0.01, 0.01), EDGE_COLOR, 0);
    g.add(dummyEdge);
    shelfMeshes[s.id] = { group: g, mesh: hit, edge: dummyEdge };
  } else if (s.kind === 'gondola-side') {
    bodyGeo = new THREE.BoxGeometry(0.42, h, d);
    bodyPos = new THREE.Vector3(s.pos[0], h / 2, s.pos[2]);
    const mesh = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: bodyColor }));
    mesh.position.copy(bodyPos); g.add(mesh);
    const edge = neonEdges(bodyGeo, isPromo ? 0xd55181 : EDGE_COLOR, isPromo ? 0.85 : EDGE_OPACITY);
    edge.position.copy(bodyPos); g.add(edge);
    mesh.userData.shelfId = s.id; pickMeshes.push(mesh);
    shelfMeshes[s.id] = { group: g, mesh, edge };
    const tiers = 3;
    const colors = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
    for (let t = 1; t <= tiers; t++) {
      const y = (h / (tiers + 1)) * t;
      const n = Math.floor((d - 0.3) / 0.24);
      for (let i = 0; i < n; i++) {
        const along = -d / 2 + 0.22 + i * ((d - 0.44) / Math.max(n - 1, 1));
        const item = {
          x: s.pos[0] + s.normal[0] * 0.28, y: y + 0.09, z: s.pos[2] + along,
          sx: 0.15 + rng() * 0.05, sy: 0.13 + rng() * 0.09, sz: 0.15 + rng() * 0.04,
          color: colors[(Math.floor(i / 3) + t) % colors.length],
        };
        if (s.cat === 'drink') { item.y = y + 0.105; productCyls.push(item); }
        else productBoxes.push(item);
      }
    }
  } else {
    // wall / endcap: 背面パネル + 台座 + 棚板 + 商品（商品が正面から見える開放型什器）
    const alongX = s.normal[2] !== 0;
    const length = alongX ? w : d;
    const depth = alongX ? d : w;
    // 台座
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), new THREE.MeshLambertMaterial({ color: 0xe8edf3 }));
    plinth.position.set(s.pos[0], 0.11, s.pos[2]); g.add(plinth);
    // 背面パネル（ヒートティント対象）
    const bpGeo = alongX ? new THREE.BoxGeometry(w, h, 0.14) : new THREE.BoxGeometry(0.14, h, d);
    const back = new THREE.Mesh(bpGeo, new THREE.MeshLambertMaterial({ color: bodyColor }));
    back.position.set(
      s.pos[0] - s.normal[0] * (depth / 2 - 0.07),
      h / 2,
      s.pos[2] - s.normal[2] * (depth / 2 - 0.07)
    );
    g.add(back);
    // 外形ワイヤーフレーム（細線）+ 不可視ピックボックス
    const frameGeo = new THREE.BoxGeometry(w, h, d);
    const edge = neonEdges(frameGeo, isPromo ? 0xd55181 : EDGE_COLOR, isPromo ? 0.85 : EDGE_OPACITY);
    edge.position.set(s.pos[0], h / 2, s.pos[2]); g.add(edge);
    const hit = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.pos[0], h / 2, s.pos[2]); g.add(hit);
    hit.userData.shelfId = s.id; pickMeshes.push(hit);
    shelfMeshes[s.id] = { group: g, mesh: back, edge };

    const prodOffset = depth * 0.08;
    const tiers = h > 1.7 ? 4 : 3;
    const colors = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
    for (let t = 1; t <= tiers; t++) {
      const y = 0.22 + ((h - 0.35) / tiers) * (t - 1) + 0.12;
      // 棚板（プレート）
      const board = new THREE.Mesh(
        alongX ? new THREE.BoxGeometry(length - 0.1, 0.03, depth * 0.6) : new THREE.BoxGeometry(depth * 0.6, 0.03, length - 0.1),
        new THREE.MeshLambertMaterial({ color: 0xdfe6ee })
      );
      board.position.set(
        s.pos[0] + s.normal[0] * prodOffset * 0.5,
        y - 0.09,
        s.pos[2] + s.normal[2] * prodOffset * 0.5
      );
      g.add(board);
      const n = Math.floor((length - 0.3) / 0.24);
      for (let i = 0; i < n; i++) {
        const along = -length / 2 + 0.22 + i * ((length - 0.44) / Math.max(n - 1, 1));
        const item = {
          x: s.pos[0] + (alongX ? along : s.normal[0] * prodOffset),
          y,
          z: s.pos[2] + (alongX ? s.normal[2] * prodOffset : along),
          sx: 0.15 + rng() * 0.05, sy: 0.13 + rng() * 0.09, sz: 0.15 + rng() * 0.04,
          color: colors[(Math.floor(i / 3) + t) % colors.length],
        };
        if (s.cat === 'drink') { item.y = y + 0.105; productCyls.push(item); }
        else productBoxes.push(item);
      }
    }
  }

  if (isPromo) {
    const pop = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xe36ba0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    pop.position.set(s.pos[0], (s.kind === 'island-case' ? 1.5 : h + 0.4), s.pos[2]);
    g.add(pop);
    promoGroup = g;
  }

  const label = makeLabel(s.name, isPromo ? '#b03a66' : '#2c3e55');
  label.position.set(s.pos[0] + s.normal[0] * 0.7, (s.kind === 'island-case' ? 1.35 : h + 0.32), s.pos[2] + s.normal[2] * 0.7);
  if (isPromo) g.add(label); else storeGroup.add(label);
  labelSprites.push(label);

  storeGroup.add(g);
}

/* エージェント3D表現 */
/* 人体は目線高さ（ペルソナ別 1.50〜1.66m）を基準に等身大で組む。
   什器（1.4〜2.0m）との相対関係が正しくないと「どこを見ているか」が目視で検証できないため。 */
function makeAgentMesh(agent) {
  const g = new THREE.Group();
  const color = agent.persona.color;
  const E = agent.eyeH0;                       // 目線高さ
  const hipY = E * 0.52;                       // 股関節
  const shoulderY = E - 0.20;
  agent.hipY = hipY;
  const mat = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1e0cd });

  // 上体（腰から肩まで）: 屈み込みでここが前傾する
  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = hipY; g.add(torsoPivot);
  agent.torsoPivot = torsoPivot;
  const torsoH = shoulderY - hipY;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, torsoH, 12), mat);
  torso.position.y = torsoH / 2; torso.scale.z = 0.66;   // 人体は前後に薄い
  torsoPivot.add(torso);
  agent.bodyMesh = torso;
  // 肩（腕の付け根を体の外に出す）
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.40, 8), mat);
  shoulder.rotation.z = Math.PI / 2; shoulder.position.y = torsoH - 0.05; torsoPivot.add(shoulder);
  // 首
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.13, 8), skin);
  neck.position.y = torsoH + 0.05; torsoPivot.add(neck);

  // 脚（股関節から振る。屈むと膝が曲がる）
  agent.legs = []; agent.legMeshes = [];
  for (let i = 0; i < 2; i++) {
    const pivot = new THREE.Group();
    pivot.position.set((i ? 1 : -1) * 0.105, hipY, 0); g.add(pivot);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, hipY, 8), dark);
    leg.position.y = -hipY / 2; pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.25), dark);
    shoe.position.set(0, -hipY + 0.03, 0.045); pivot.add(shoe);
    agent.legs.push(pivot); agent.legMeshes.push(leg, shoe);
  }
  // 腕（肩から振る。商品を取るときは前へ伸ばす）
  agent.arms = [];
  const armL = torsoH * 1.02;
  for (let i = 0; i < 2; i++) {
    const pivot = new THREE.Group();
    pivot.position.set((i ? 1 : -1) * 0.205, torsoH - 0.05, 0); torsoPivot.add(pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, armL, 7), mat);
    arm.position.y = -armL / 2; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), skin);
    hand.position.y = -armL; pivot.add(hand);
    agent.arms.push(pivot);
  }

  // 頭（体とは独立に回る。視線の向きはここ）
  const headPivot = new THREE.Group();
  headPivot.position.y = torsoH + 0.11; torsoPivot.add(headPivot);
  agent.headPivot = headPivot;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 11), skin);
  head.position.y = 0.09; head.scale.z = 1.12; headPivot.add(head);
  agent.headMesh = head;
  // 顔の向き（＝視線の向き）が一目で分かるマーカー
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x2b3a4d }));
  face.position.set(0, 0.09, 0.098); face.scale.set(1.25, 0.72, 0.45); headPivot.add(face);

  // 点群モードでは人体を隠して検出点だけにする
  agent.bodyParts = [torso, shoulder, neck, head, face].concat(agent.legMeshes, agent.arms);
  if (agent.adExposed) {  // 広告接触はピンクリングで表示
    const adRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 8, 18),
      new THREE.MeshBasicMaterial({ color: 0xd55181 }));
    adRing.rotation.x = Math.PI / 2; adRing.position.y = torsoH - 0.06; torsoPivot.add(adRing);
    agent.bodyParts.push(adRing);
  }
  const detDot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x31c5f0 }));
  detDot.position.y = 0.2; detDot.visible = false;
  headPivot.add(detDot); agent.detDot = detDot;
  // 視野コーン＝頭の向き（有効視野 ±22°相当）
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 2.4, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: agent.persona.color, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
  );
  cone.rotation.x = Math.PI / 2; cone.position.z = 1.2;
  const coneHolder = new THREE.Group();
  coneHolder.add(cone); coneHolder.visible = false;
  headPivot.add(coneHolder); agent.coneHolder = coneHolder;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xc98500 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.visible = false;
  g.add(ring); agent.ring = ring;
  const dwellDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x0f9fba }));
  dwellDot.position.y = E + 0.28; dwellDot.visible = false;
  g.add(dwellDot); agent.dwellDot = dwellDot;
  scene.add(g);
  agent.mesh = g;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(40 * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const tLine = new THREE.Line(tGeo, new THREE.LineBasicMaterial({
    color: agent.persona.color, transparent: true, opacity: 0.35,
  }));
  tLine.frustumCulled = false; tLine.visible = false;
  scene.add(tLine);
  agent.trailLine = tLine; agent.trailPos = tPos; agent.trailLen = 0;
}

/* ---------- 通常表示の視線レイ・注視点 ----------
   「誰が、いま、棚のどこを見ているか」を1本の線と1個の点で示す。
   線の始点は実際の目線高さ（屈んでいれば下がる）、終点は計測に使っている注視点そのもの。 */
let gazeFx = null;
const GAZE_FX_MAX = 80;
function buildGazeLines() {
  if (gazeFx) { scene.remove(gazeFx.lines); scene.remove(gazeFx.dots); disposeObject(gazeFx.lines); disposeObject(gazeFx.dots); }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GAZE_FX_MAX * 6), 3));
  lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(GAZE_FX_MAX * 6), 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false,
  }));
  lines.frustumCulled = false;
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GAZE_FX_MAX * 3), 3));
  dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(GAZE_FX_MAX * 3), 3));
  const dots = new THREE.Points(dg, new THREE.PointsMaterial({
    size: 0.22, vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false, sizeAttenuation: true,
  }));
  dots.frustumCulled = false;
  scene.add(lines); scene.add(dots);
  gazeFx = { lines, dots, lg, dg };
}

function updateGazeLines() {
  if (!gazeFx) return;
  const on = S.layers.gaze && !(window.CLOUD && CLOUD.on);
  gazeFx.lines.visible = on; gazeFx.dots.visible = on;
  if (!on) return;
  const lp = gazeFx.lg.attributes.position.array, lc = gazeFx.lg.attributes.color.array;
  const dp = gazeFx.dg.attributes.position.array, dc = gazeFx.dg.attributes.color.array;
  let n = 0;
  const c = new THREE.Color();
  for (const a of agents) {
    if (n >= GAZE_FX_MAX) break;
    if (a.done || !a.gazing || !a.gazeHit) continue;
    // 注視の強さ（中心視ほど濃い）で色を振る: 黄 → 橙赤
    const t = clamp((a.gazeW || 0) / 0.2, 0, 1);
    c.setHSL(lerp(0.13, 0.03, t), 0.85, lerp(0.62, 0.5, t));
    lp[n * 6] = a.x; lp[n * 6 + 1] = a.eyeH; lp[n * 6 + 2] = a.z;
    lp[n * 6 + 3] = a.gazeHit[0]; lp[n * 6 + 4] = a.gazeHit[1]; lp[n * 6 + 5] = a.gazeHit[2];
    for (let k = 0; k < 2; k++) {
      const f = k ? 1 : 0.45;                       // 目元は淡く、注視点側を濃く
      lc[n * 6 + k * 3] = c.r * f + (1 - f) * 0.98; lc[n * 6 + k * 3 + 1] = c.g * f + (1 - f) * 0.86; lc[n * 6 + k * 3 + 2] = c.b * f + (1 - f) * 0.55;
    }
    dp[n * 3] = a.gazeHit[0]; dp[n * 3 + 1] = a.gazeHit[1]; dp[n * 3 + 2] = a.gazeHit[2];
    dc[n * 3] = c.r; dc[n * 3 + 1] = c.g; dc[n * 3 + 2] = c.b;
    n++;
  }
  for (let i = n; i < GAZE_FX_MAX; i++) {
    lp[i * 6] = lp[i * 6 + 1] = lp[i * 6 + 2] = lp[i * 6 + 3] = lp[i * 6 + 4] = lp[i * 6 + 5] = 0;
    dp[i * 3] = 0; dp[i * 3 + 1] = -5; dp[i * 3 + 2] = 0;
  }
  gazeFx.lg.attributes.position.needsUpdate = true;
  gazeFx.lg.attributes.color.needsUpdate = true;
  gazeFx.dg.attributes.position.needsUpdate = true;
  gazeFx.dg.attributes.color.needsUpdate = true;
}

function disposeAgent(agent) {
  if (agent.reg) { const qi = agent.reg.queue.indexOf(agent); if (qi >= 0) agent.reg.queue.splice(qi, 1); }
  if (agent.mesh) { scene.remove(agent.mesh); disposeObject(agent.mesh); }
  if (agent.trailLine) { scene.remove(agent.trailLine); agent.trailLine.geometry.dispose(); agent.trailLine.material.dispose(); }
}

/* ヒートマップ描画（ライト床向け・単色ブルーランプ） */
function heatColor(v) {
  const r = Math.round(lerp(159, 29, v));
  const g = Math.round(lerp(196, 111, v));
  const b = Math.round(lerp(232, 184, v));
  return [r, g, b];
}
function redrawHeat() {
  const ctx = heat.canvas.getContext('2d');
  const img = ctx.createImageData(heat.w, heat.h);
  let max = 8, liveMax = 1e-6;
  for (let i = 0; i < heat.grid.length; i++) if (heat.grid[i] > max) max = heat.grid[i];
  if (heat.live) for (let i = 0; i < heat.live.length; i++) if (heat.live[i] > liveMax) liveMax = heat.live[i];
  for (let i = 0; i < heat.grid.length; i++) {
    const v = Math.log1p(clamp(heat.grid[i] / max, 0, 1) * 24) / Math.log1p(24);
    const [r, g, b] = heatColor(v);
    // 歩いた直後の足跡を白く重ねる（人の動きがそのまま床に描かれる）
    const lv = heat.live ? Math.pow(clamp(heat.live[i] / liveMax, 0, 1), 0.7) : 0;
    img.data[i * 4] = Math.round(lerp(r, 255, lv * 0.85));
    img.data[i * 4 + 1] = Math.round(lerp(g, 255, lv * 0.85));
    img.data[i * 4 + 2] = Math.round(lerp(b, 255, lv * 0.6));
    img.data[i * 4 + 3] = Math.round(clamp(v * 185 + lv * 170, 0, 235));
  }
  ctx.putImageData(img, 0, 0);
  heat.tex.needsUpdate = true;
}

/* 棚ヒート（視線量 → 白→ブルーのティント） */
const heatTint = new THREE.Color();
function updateShelfHeatVisual() {
  let max = 20, liveNorm = 1e-6;
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (st.gazeSec > max) max = st.gazeSec;
    const lg = st.gridLive;
    if (lg) { let sum = 0; for (let i = 0; i < lg.length; i++) sum += lg[i]; if (sum > liveNorm) liveNorm = sum; }
  });
  SHELVES.forEach(s => {
    const sm = shelfMeshes[s.id]; if (!sm || !sm.mesh.material) return;
    if (!sm.mesh.material.color) return;
    const v = clamp(STATS.shelves[s.id].gazeSec / max, 0, 1);
    if (S.layers.shelfheat) {
      // 直近に見られている棚は明るく脈動させ、人の動きとヒートの連動を可視化
      const lg = STATS.shelves[s.id].gridLive;
      let liveSum = 0;
      if (lg) for (let i = 0; i < lg.length; i++) liveSum += lg[i];
      const live = clamp(liveSum / (liveNorm || 1), 0, 1);
      const pulse = live > 0.05 ? (0.5 + 0.5 * Math.sin(performance.now() / 260)) * live * 0.45 : 0;
      heatTint.setRGB(
        clamp(lerp(0.985, 0.31, v) + pulse * 0.75, 0, 1),
        clamp(lerp(0.99, 0.70, v) + pulse, 0, 1),
        clamp(lerp(1.0, 0.82, v) + pulse, 0, 1)
      );
      sm.mesh.material.color.copy(heatTint);
    } else {
      sm.mesh.material.color.set(s.promoted ? 0xfdf1f6 : 0xfbfcfe);
    }
  });
}

/* ---------- シミュレーションループ ---------- */
let arrivalCarry = 0, gazeTimer = 0, heatTimer = 0, shelfHeatTimer = 0, lastWeatherBg = null, gazeDecayAcc = 0, gazeLiveAcc = 0;

function simStep(simDt) {
  // 3Dへ出すエージェントはサンプリング（ダッシュボードは sampleFactor 倍で拡大推計）
  const perSec = arrivalRatePerMin() / 60 / STORE.sampleFactor;
  arrivalCarry += perSec * simDt;
  while (arrivalCarry >= 1) {
    arrivalCarry -= 1;
    if (agents.length < STORE.maxAgents) {
      const a = new Agent();
      makeAgentMesh(a);
      agents.push(a);
    }
  }
  const sub = Math.max(1, Math.ceil(simDt / 0.5));
  const stepDt = simDt / sub;
  for (let k = 0; k < sub; k++) {
    agents.forEach(a => a.update(stepDt));
    gazeTimer += stepDt;
    if (gazeTimer >= 0.25) {
      const iv = gazeTimer; gazeTimer = 0;
      agents.forEach(a => { if (!a.done) senseGaze(a, iv); });
      agents.forEach(a => {
        if (a.done) return;
        const gx = Math.floor((a.x + STORE.floorW / 2) / STORE.floorW * heat.w);
        const gz = Math.floor((a.z + STORE.floorD / 2) / STORE.floorD * heat.h);
        if (gx >= 0 && gx < heat.w && gz >= 0 && gz < heat.h) {
          heat.grid[gz * heat.w + gx] += iv;
          if (heat.live) heat.live[gz * heat.w + gx] += iv;   // 直後だけ光る足跡
        }
      });
    }
  }
  for (let i = agents.length - 1; i >= 0; i--) {
    if (agents[i].done) { if (followTarget === agents[i]) followTarget = null; disposeAgent(agents[i]); agents.splice(i, 1); }
  }
  // ライブ層の減衰（半減期 約20 sim秒 — 見た瞬間に光り、すぐ褪せる）
  gazeLiveAcc += simDt;
  if (gazeLiveAcc >= 2) {
    const steps = Math.floor(gazeLiveAcc / 2);
    gazeLiveAcc -= steps * 2;
    const fg = Math.pow(0.933, steps), ff = Math.pow(0.90, steps);
    if (fg < 0.999) {
      SHELVES.forEach(s => {
        const g = STATS.shelves[s.id] && STATS.shelves[s.id].gridLive;
        if (!g) return;
        if (fg < 1e-4) g.fill(0); else for (let i = 0; i < g.length; i++) g[i] *= fg;
      });
    }
    if (heat.live) {
      if (ff < 1e-4) heat.live.fill(0);
      else for (let i = 0; i < heat.live.length; i++) heat.live[i] *= ff;
    }
  }

  // 直近ウィンドウの指数減衰（半減期 約10分）
  gazeDecayAcc += simDt;
  if (gazeDecayAcc >= 60) {
    const steps = Math.floor(gazeDecayAcc / 60);
    gazeDecayAcc -= steps * 60;
    const f = Math.pow(0.933, steps);
    SHELVES.forEach(s => {
      const g = STATS.shelves[s.id] && STATS.shelves[s.id].gridRecent;
      if (!g) return;
      if (f < 1e-4) g.fill(0); else for (let i = 0; i < g.length; i++) g[i] *= f;
    });
  }

  // レジ行列: 混雑検知で2番レジを自動開放（コンビニ）
  const totalQ = REGS.reduce((a, r) => a + r.queue.length, 0);
  if (totalQ > STATS.maxQueue) STATS.maxQueue = totalQ;
  if (FKEY === 'conbini' && REGS[1] && !REGS[1].open && REGS[0].queue.length >= 4) {
    REGS[1].open = true; STATS.reg2Opened = true;
    beacon('混雑検知: レジ2番を自動開放', 'seg-buy');
  }
  STATS.simSec += simDt;
  if (STATS.simSec >= 22 * 3600) {
    STATS.simSec = 10 * 3600;
    rolloverDay();
  }
}

function resetDayCounters() {
  STATS.visitors = 0; STATS.adVisitors = 0; STATS.buyers = 0; STATS.revenue = 0; STATS.promoUnits = 0;
  STATS.adStoreVisits = 0; STATS.returns = 0; STATS.applied = 0;
  STATS.nov = { treat: 0, ctrl: 0, treatBuy: 0, ctrlBuy: 0, treatRev: 0, ctrlRev: 0 };
  STATS.cross = { none: { n: 0, buy: 0 }, ad: { n: 0, buy: 0 }, sig: { n: 0, buy: 0 }, both: { n: 0, buy: 0 } };
  resetPersonaStats();
  STATS.balked = 0; STATS.balkedRev = 0; STATS.waitSum = 0; STATS.waitN = 0; STATS.maxQueue = 0; STATS.reg2Opened = false;
  STATS.gazeEvents = 0; STATS.obsEvents = 0;
  REGS.forEach(r => { r.queue.length = 0; if (FKEY === 'conbini') r.open = r === REGS[0]; });
  resetShelfStats();
  STATS.buckets = STATS.buckets.map(() => 0);
  if (heat.grid) heat.grid.fill(0);
  stockState.cap = STORE.stockCap; stockState.units = STORE.stockCap; stockState.missed = 0;
  agents.slice().forEach(a => disposeAgent(a));
  agents.length = 0;
  followTarget = null;
}

function rolloverDay() {
  const proj = window.__computeProjection ? window.__computeProjection() : null;
  HISTORY.push({ day: STATS.day, revenue: Math.round(proj ? proj.totalRevenue : STATS.revenue), cpOn: S.budget > 0, anomaly: false, live: true });
  if (HISTORY.length > 20) HISTORY.shift();
  STATS.day++;
  resetDayCounters();
  document.getElementById('sim-day').textContent = 'DAY ' + STATS.day;
}

/* 蓄積ヒートを消去して、人の動きが描き直す様子を観察できるようにする */
function resetHeatmaps() {
  SHELVES.forEach(s => {
    const st = STATS.shelves[s.id];
    if (!st) return;
    if (st.grid) st.grid.fill(0);
    if (st.gridRecent) st.gridRecent.fill(0);
    if (st.gridLive) st.gridLive.fill(0);
    if (st.gridWho) st.gridWho.fill(0);
    st.gazeSec = 0;
  });
  if (heat.grid) heat.grid.fill(0);
  if (heat.live) heat.live.fill(0);
  if (typeof redrawHeat === 'function' && heat.canvas) redrawHeat();
  if (window.__cloudReady) { updateCloudColors(); redrawFloorHeatCloud(); }
  beacon('ヒートマップをリセット — ここから人の動きが描き直します', 'seg-buy');
}
window.resetHeatmaps = resetHeatmaps;

/* ---------- 施設切替 ---------- */
function loadFacility(key) {
  FKEY = key; STORE = STORES[key];
  SHELVES = STORE.shelves;
  rebuildShelfIndex();
  buildGraph();
  buildRegs();
  EXTRA_CAMS = [];
  buildCams();
  selectShelf(null);
  STATS.day = 15; STATS.simSec = 10 * 3600;
  resetDayCounters();
  genHistory();
  buildStore();
  camState = Object.assign({}, STORE.camPresets.over);
  camTween = null; applyCam();
  document.getElementById('sim-day').textContent = 'DAY ' + STATS.day;
  document.getElementById('an-client').textContent = STORE.client;
  document.getElementById('an-store').textContent = STORE.storeName + ' ｜ 事業ライン: 小売（販促×人流×POS）';
  // ウォームアップ（12:30 まで先行実行してデータを貯める）
  while (STATS.simSec < 12.5 * 3600) simStep(30);
}

/* 3D表示更新（毎フレーム） */
function updateVisuals(realDt) {
  const time = performance.now() / 1000;
  agents.forEach(a => {
    if (!a.mesh) return;
    a.mesh.position.set(a.x, 0, a.z);
    a.mesh.rotation.y = a.heading;
    // 歩幅・ピッチを実速度に連動させる（速いほど大きく速く振る）
    const sp = Math.max(0, a.v || 0);
    const bend = a.bend || 0;
    a.walkPhase = (a.walkPhase || 0) + realDt * (2.4 + sp * 4.4);
    const swing = Math.sin(a.walkPhase) * Math.min(0.60, sp * 0.52);
    const hipDrop = bend * 0.30;                       // しゃがむと腰が沈む
    if (a.legs) {
      // 歩行は前後に振り、屈むと両膝を開いて腰を落とす
      a.legs[0].rotation.x = swing - bend * 0.42;
      a.legs[1].rotation.x = -swing - bend * 0.42;
      a.legs[0].position.y = a.legs[1].position.y = a.hipY - hipDrop;
      a.legs[0].scale.y = a.legs[1].scale.y = 1 - bend * 0.30;
    }
    const reach = a.reach || 0;
    if (a.arms) {
      // 通常は脚と逆位相に腕を振り、商品を取るときは前方へ伸ばす
      a.arms[0].rotation.x = lerp(-swing * 0.72, -1.5, reach);
      a.arms[1].rotation.x = lerp(swing * 0.72, -0.3, reach * 0.5);
    }
    // 屈み込み（下段を覗く）＝腰から前傾し、全体が沈む
    a.torsoPivot.rotation.x = bend * 0.66;
    a.torsoPivot.position.y = a.hipY - hipDrop;
    a.mesh.position.y = (sp > 0.05 ? Math.abs(Math.sin(a.walkPhase)) * 0.022 : 0);
    // 頭は体と独立。視線の向きそのもの
    let hy = (a.headYaw || a.heading) - a.heading;
    while (hy > Math.PI) hy -= 2 * Math.PI; while (hy < -Math.PI) hy += 2 * Math.PI;
    a.headPivot.rotation.set(-(a.headPitch || 0) - bend * 0.62, hy, 0, 'YXZ');
    a.coneHolder.visible = S.layers.cones && !a.done;
    if (a.ring) a.ring.visible = a.hasNovelty;
    if (a.dwellDot) {
      a.dwellDot.visible = a.state === 'dwell';
      if (a.dwellDot.visible) a.dwellDot.scale.setScalar(1 + Math.sin(time * 5) * 0.25);
    }
    if (S.layers.trails) {
      a.trailLine.visible = true;
      a.trailTick = (a.trailTick || 0) + realDt;
      if (a.trailTick > 0.08) {
        a.trailTick = 0;
        if (a.trailLen < 40) a.trailLen++;
        for (let i = a.trailLen - 1; i > 0; i--) {
          a.trailPos[i * 3] = a.trailPos[(i - 1) * 3];
          a.trailPos[i * 3 + 1] = a.trailPos[(i - 1) * 3 + 1];
          a.trailPos[i * 3 + 2] = a.trailPos[(i - 1) * 3 + 2];
        }
        a.trailPos[0] = a.x; a.trailPos[1] = 0.05; a.trailPos[2] = a.z;
        for (let i = a.trailLen; i < 40; i++) { a.trailPos[i * 3] = a.x; a.trailPos[i * 3 + 1] = 0.05; a.trailPos[i * 3 + 2] = a.z; }
        a.trailLine.geometry.attributes.position.needsUpdate = true;
      }
    } else a.trailLine.visible = false;
  });
  labelSprites.forEach(l => l.visible = S.layers.labels);
  if (heat.plane) heat.plane.visible = S.layers.floorheat;
  if (novStandGroup) novStandGroup.visible = S.novelty;
  if (promoGroup) promoGroup.visible = S.endcap;
  if (signageGroup) signageGroup.visible = S.signage;
  const wantBg = (window.CLOUD && CLOUD.on) ? 0x05070f : WEATHER[S.weather].bg;
  if (lastWeatherBg !== wantBg) {
    lastWeatherBg = wantBg;
    scene.background = new THREE.Color(wantBg);
    scene.fog.color = new THREE.Color(wantBg);
    scene.fog.near = (window.CLOUD && CLOUD.on) ? 60 : 40;
    scene.fog.far = (window.CLOUD && CLOUD.on) ? 170 : 95;
  }
  updateGazeLines();
  if (window.__cloudReady) updateCloud(realDt);

  heatTimer += realDt;
  if (heatTimer > 0.34 && S.layers.floorheat) { heatTimer = 0; redrawHeat(); }
  shelfHeatTimer += realDt;
  if (shelfHeatTimer > 0.12) { shelfHeatTimer = 0; updateShelfHeatVisual(); }

  if (camTween) {
    camTween.t += realDt * 2.2;
    const t = Math.min(1, camTween.t);
    const e = t * t * (3 - 2 * t);
    ['theta', 'phi', 'r', 'tx', 'ty', 'tz'].forEach(k => camState[k] = lerp(camTween.from[k], camTween.to[k], e));
    applyCam();
    if (t >= 1) camTween = null;
  } else if (followTarget && !followTarget.done) {
    // 注視をやめて一定時間たったら、いま注視している別の客へ自動で乗り換える
    if (followTarget.gazing || followTarget.state === 'dwell') autoFollowTimer = 0;
    else autoFollowTimer += realDt;
    if (autoFollowTimer > 2.5) { autoFollowTimer = 0; pickFollowTarget(); }
    const ft = followTarget;
    camState.tx = lerp(camState.tx, ft.x, realDt * 2.2);
    camState.tz = lerp(camState.tz, ft.z, realDt * 2.2);
    camState.ty = lerp(camState.ty, 1.2, realDt * 2);
    const want = (window.CLOUD && CLOUD.on) ? 7.6 : 7;
    camState.r = lerp(camState.r, want, realDt * 1.6);
    // 客が見ている棚の側から捉える
    if (ft.gazeHit) {
      const want2 = Math.atan2(ft.x - ft.gazeHit[0], ft.z - ft.gazeHit[2]);
      let d = want2 - camState.theta;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      camState.theta += d * Math.min(1, realDt * 0.9);
    }
    applyCam();
  } else if (followTarget && followTarget.done) {
    pickFollowTarget();
  }
}

function pickFollowTarget() {
  const active = agents.filter(a => !a.done);
  if (!active.length) return;
  const gazers = active.filter(a => a.gazing || a.state === 'dwell');
  const pool = gazers.length ? gazers : active;
  followTarget = pool[Math.floor(rng() * pool.length)];
  if (window.CLOUD && CLOUD.on) CLOUD.tracked = followTarget;   // 追従対象を計測対象にも揃える
  camTween = null;
}
