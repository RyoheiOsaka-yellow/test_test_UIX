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
const lerp = (a, b, t) => a + (b - a) * t;
function fmtYen(v) {
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '億円';
  if (Math.abs(v) >= 1e4) return '¥' + Math.round(v / 1e3).toLocaleString() + 'k';
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
  speed: 3, paused: false,
  layers: { shelfheat: true, floorheat: true, cones: false, trails: false, labels: true },
};

/* ---------- 施設定義 ---------- */
// shelf.kind: wall | gondola-side | island-case | endcap | counter
const STORES = {
  conbini: {
    key: 'conbini', label: 'コンビニ', client: 'コンビニチェーンA',
    storeName: '新宿駅前店', promoName: '新商品グミX',
    floorW: 16, floorD: 10, wallH: 2.7,
    arrivalBase: 2.3, buyRate: 0.54, basket: 470, reachPerBudget: 1150,
    maxAgents: 46, stockCap: 240, heatW: 64, heatH: 40,
    entrances: [{ x: -3.3, z: 4.55 }],
    registers: [{ x: 4.2, z: 4.15 }],
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
    arrivalBase: 5.0, buyRate: 0.48, basket: 1450, reachPerBudget: 2000,
    maxAgents: 90, stockCap: 160, heatW: 96, heatH: 58,
    entrances: [{ x: 0, z: 8.5 }, { x: -13, z: 8.5 }],
    registers: [{ x: 4.8, z: 6.5 }, { x: -4.8, z: 6.5 }],
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
  return pts;
}
function nearestOf(list, x, z) {
  let best = list[0], bd = 1e9;
  list.forEach(p => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } });
  return best;
}

/* ---------- 集計ステート ---------- */
function freshShelfStats() { return { passes: 0, gazes: 0, gazeSec: 0, stops: 0, picks: 0, purchases: 0 }; }
const STATS = {
  day: 15, simSec: 10 * 3600,
  visitors: 0, adVisitors: 0, buyers: 0, revenue: 0, promoUnits: 0,
  nov: { treat: 0, ctrl: 0, treatBuy: 0, ctrlBuy: 0, treatRev: 0, ctrlRev: 0 },
  shelves: {}, buckets: [], adStoreVisits: 0, returns: 0, applied: 0,
};
function resetShelfStats() {
  STATS.shelves = {};
  SHELVES.forEach(s => STATS.shelves[s.id] = freshShelfStats());
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
function arrivalRatePerMin() {
  const hour = STATS.simSec / 3600;
  return STORE.arrivalBase * arrivalCurve(hour) * S.traffic * (1 + adReachLift());
}

const NOV_TRUE_LIFT = 0.32;
const AD_PROMO_MULT = 1.7;
const ENDCAP_ATTENTION = 1.9;

let agentSeq = 0;
class Agent {
  constructor() {
    this.id = ++agentSeq;
    const ent = STORE.entrances[Math.floor(rng() * STORE.entrances.length)];
    this.x = ent.x + (rng() - 0.5) * 0.6;
    this.z = ent.z;
    this.heading = -Math.PI / 2;
    this.speed = 0.85 + rng() * 0.35;
    this.adExposed = rng() < adExposureShare();
    this.hasNovelty = false; this.novGroup = null;
    this.basket = []; this.revenue = 0;
    this.gazeMap = {}; this.passSet = {};
    this.state = 'plan'; this.wait = 0; this.wp = [];
    this.targetShelf = null; this.plan = [];
    this.done = false; this.walkPhase = rng() * 6.28;
    this.mesh = null;

    const wanderer = rng() < 0.18;
    const n = wanderer ? 0 : 1 + Math.floor(rng() * 3);
    const cand = SHELVES.filter(s => !s.promoted && !s.counter && s.pop > 0);
    const picked = [];
    for (let i = 0; i < n; i++) {
      let r = rng() * cand.reduce((a, s) => a + s.pop, 0);
      for (const s of cand) { r -= s.pop; if (r <= 0) { if (!picked.includes(s)) picked.push(s); break; } }
    }
    if (this.adExposed && rng() < 0.72) picked.push(promotedShelf());
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
    if (rng() < 0.06) beacon(`客#${this.id} 入店${this.adExposed ? '（広告接触）' : ''}`, this.adExposed ? 'seg-ad' : '');
  }

  nextLeg() {
    if (this.plan.length) {
      const s = this.plan.shift();
      if (s.promoted && !S.endcap && s.id === STORE.promoted.mainId) { this.nextLeg(); return; }
      this.targetShelf = s;
      this.wp = routePoints(this, { x: s.approach[0], z: s.approach[1] });
      this.state = 'walk';
    } else if (!this.paid && this.basket.length) {
      this.targetShelf = null;
      const reg = nearestOf(STORE.registers, this.x, this.z);
      this.wp = routePoints(this, reg);
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
    this.faceShelf(shelf);
    if (this.wait <= 0) {
      const st = STATS.shelves[shelf.id];
      if (rng() < 0.62) {
        st.picks++;
        let pBuy = shelf.base;
        if (shelf === promotedShelf()) {
          if (this.adExposed) pBuy *= AD_PROMO_MULT;
          if (this.hasNovelty) pBuy *= (1 + NOV_TRUE_LIFT);
        } else if (this.hasNovelty) pBuy *= 1.06;
        if (rng() < clamp(pBuy, 0, 0.96)) {
          const isPromo = shelf === promotedShelf();
          if (isPromo && stockState.units <= 0) {
            stockState.missed++;   // 在庫内生性: 品切れ中の機会損失
          } else {
            st.purchases++;
            const price = shelf.price * (0.8 + rng() * 0.5);
            this.basket.push(shelf.id); this.revenue += price;
            if (isPromo) {
              STATS.promoUnits++;
              stockState.units = Math.max(0, stockState.units - 1);
              if (rng() < 0.12) beacon(`客#${this.id} 販促商品を購入 ${fmtYenFull(price)}`, 'seg-buy');
            }
          }
        }
      }
      this.nextLeg();
    }
  }

  faceShelf(shelf) {
    const dx = shelf.pos[0] - this.x, dz = shelf.pos[2] - this.z;
    this.heading = Math.atan2(dx, dz);
  }

  update(dt) {
    if (this.done) return;
    if (this.state === 'plan') { this.nextLeg(); return; }
    if (this.state === 'dwell') { this.dwellAt(this.dwellShelf, dt); return; }
    if (this.state === 'pay') {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.paid = true;
        STATS.buyers++; STATS.revenue += this.revenue;
        const b = Math.floor((STATS.simSec - 10 * 3600) / 1800);
        if (b >= 0 && b < STATS.buckets.length) STATS.buckets[b] += this.revenue;
        const boughtPromo = this.basket.includes(promotedShelf().id);
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
    if (d < 0.18) {
      this.wp.shift();
      if (!this.wp.length) {
        if (this.state === 'walk' && this.targetShelf) {
          const s = this.targetShelf;
          STATS.shelves[s.id].stops++;
          this.dwellShelf = s; this.state = 'dwell';
          this.wait = 10 + rng() * 20;
          if (rng() < 0.05) beacon(`客#${this.id} 「${s.name}」に立寄`, this.hasNovelty ? 'seg-nov' : '');
        } else if (this.state === 'toRegister') {
          this.state = 'pay'; this.wait = 20 + rng() * 30;
          this.maybeImpulseCounter();
        } else if (this.state === 'exit') {
          this.done = true;
        }
      }
      return;
    }
    const step = Math.min(this.speed * dt, d);
    this.x += (dx / d) * step; this.z += (dz / d) * step;
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    this.heading += dh * Math.min(1, dt * 6);

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

/* 視線・通過検知 */
const GAZE_DIST = 2.9, GAZE_COS = Math.cos(45 * Math.PI / 180);
function senseGaze(agent, interval) {
  for (const s of SHELVES) {
    if (s.promoted && !S.endcap && s.id === STORE.promoted.mainId) continue;
    const gx = s.pos[0], gz = s.pos[2];
    const dx = gx - agent.x, dz = gz - agent.z;
    const d = Math.hypot(dx, dz);
    if (d > GAZE_DIST) continue;
    if (d < 2.2 && !agent.passSet[s.id]) { agent.passSet[s.id] = 1; STATS.shelves[s.id].passes++; }
    const hx = Math.sin(agent.heading), hz = Math.cos(agent.heading);
    const cos = (dx * hx + dz * hz) / (d || 1e-6);
    if (cos < GAZE_COS) continue;
    const nx = s.normal[0], nz = s.normal[2];
    if ((agent.x - gx) * nx + (agent.z - gz) * nz < 0) continue;
    let w = interval * (1 - d / GAZE_DIST);
    if (s.promoted && S.endcap) w *= ENDCAP_ATTENTION;
    STATS.shelves[s.id].gazeSec += w;
    agent.gazeMap[s.id] = (agent.gazeMap[s.id] || 0) + interval;
    if (agent.gazeMap[s.id] >= 1.0 && !agent['gz_' + s.id] && d < 2.4) {
      agent['gz_' + s.id] = true; STATS.shelves[s.id].gazes++;
    }
  }
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
    const weekend = week >= 5 ? 1.18 : 1.0;
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
const heat = { grid: null, canvas: null, tex: null, plane: null, w: 64, h: 40 };
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

let camTween = null;
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

  // 外周グラウンド・床
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ color: 0xdde4ec }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; storeGroup.add(outer);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0xf7f9fb }));
  floor.rotation.x = -Math.PI / 2; storeGroup.add(floor);
  const grid = new THREE.GridHelper(Math.max(W, D), Math.max(W, D), 0xd3dce6, 0xe4eaf1);
  grid.position.y = 0.004; grid.material.transparent = true; grid.material.opacity = 0.7;
  storeGroup.add(grid);
  const floorEdge = neonEdges(new THREE.BoxGeometry(W, 0.01, D), 0x8aa0b8, 0.8);
  floorEdge.position.y = 0.01; storeGroup.add(floorEdge);

  // 回遊ヒートマップ
  heat.w = STORE.heatW; heat.h = STORE.heatH;
  heat.grid = new Float32Array(heat.w * heat.h);
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
  const productBoxes = [];
  SHELVES.forEach(s => buildShelf(s, productBoxes));

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
}

function buildShelf(s, productBoxes) {
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
          color: colors[Math.floor(rng() * colors.length)], ry: (rng() - 0.5) * 0.4,
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
        productBoxes.push({
          x: s.pos[0] + s.normal[0] * 0.28, y: y + 0.09, z: s.pos[2] + along,
          sx: 0.15 + rng() * 0.05, sy: 0.13 + rng() * 0.09, sz: 0.15 + rng() * 0.04,
          color: colors[Math.floor(rng() * colors.length)],
        });
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
        productBoxes.push({
          x: s.pos[0] + (alongX ? along : s.normal[0] * prodOffset),
          y,
          z: s.pos[2] + (alongX ? s.normal[2] * prodOffset : along),
          sx: 0.15 + rng() * 0.05, sy: 0.13 + rng() * 0.09, sz: 0.15 + rng() * 0.04,
          color: colors[Math.floor(rng() * colors.length)],
        });
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
function makeAgentMesh(agent) {
  const g = new THREE.Group();
  const color = agent.adExposed ? 0xd55181 : 0x0f9fba;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.85, 10),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.43; g.add(body);
  agent.bodyMesh = body;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf1e0cd })
  );
  head.position.y = 1.0; g.add(head);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 2.7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: agent.adExposed ? 0xd55181 : 0x0f9fba, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })
  );
  cone.rotation.x = Math.PI / 2; cone.position.z = 1.35;
  const coneHolder = new THREE.Group();
  coneHolder.add(cone); coneHolder.position.y = 0.95; coneHolder.visible = false;
  g.add(coneHolder); agent.coneHolder = coneHolder;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xc98500 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; ring.visible = false;
  g.add(ring); agent.ring = ring;
  const dwellDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x0f9fba }));
  dwellDot.position.y = 1.35; dwellDot.visible = false;
  g.add(dwellDot); agent.dwellDot = dwellDot;
  scene.add(g);
  agent.mesh = g;
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(40 * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const tLine = new THREE.Line(tGeo, new THREE.LineBasicMaterial({
    color: agent.adExposed ? 0xd55181 : 0x5aa8bd, transparent: true, opacity: 0.35,
  }));
  tLine.frustumCulled = false; tLine.visible = false;
  scene.add(tLine);
  agent.trailLine = tLine; agent.trailPos = tPos; agent.trailLen = 0;
}

function disposeAgent(agent) {
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
  let max = 8;
  for (let i = 0; i < heat.grid.length; i++) if (heat.grid[i] > max) max = heat.grid[i];
  for (let i = 0; i < heat.grid.length; i++) {
    const v = Math.pow(clamp(heat.grid[i] / max, 0, 1), 0.6);
    const [r, g, b] = heatColor(v);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(v * 185);
  }
  ctx.putImageData(img, 0, 0);
  heat.tex.needsUpdate = true;
}

/* 棚ヒート（視線量 → 白→ブルーのティント） */
const heatTint = new THREE.Color();
function updateShelfHeatVisual() {
  let max = 20;
  SHELVES.forEach(s => { const g = STATS.shelves[s.id].gazeSec; if (g > max) max = g; });
  SHELVES.forEach(s => {
    const sm = shelfMeshes[s.id]; if (!sm || !sm.mesh.material) return;
    if (!sm.mesh.material.color) return;
    const v = clamp(STATS.shelves[s.id].gazeSec / max, 0, 1);
    if (S.layers.shelfheat) {
      heatTint.setRGB(
        lerp(0.985, 0.31, v),
        lerp(0.99, 0.70, v),
        lerp(1.0, 0.82, v)
      );
      sm.mesh.material.color.copy(heatTint);
    } else {
      sm.mesh.material.color.set(s.promoted ? 0xfdf1f6 : 0xfbfcfe);
    }
  });
}

/* ---------- シミュレーションループ ---------- */
let arrivalCarry = 0, gazeTimer = 0, heatTimer = 0, shelfHeatTimer = 0;

function simStep(simDt) {
  const perSec = arrivalRatePerMin() / 60;
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
        if (gx >= 0 && gx < heat.w && gz >= 0 && gz < heat.h) heat.grid[gz * heat.w + gx] += iv;
      });
    }
  }
  for (let i = agents.length - 1; i >= 0; i--) {
    if (agents[i].done) { if (followTarget === agents[i]) followTarget = null; disposeAgent(agents[i]); agents.splice(i, 1); }
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

/* ---------- 施設切替 ---------- */
function loadFacility(key) {
  FKEY = key; STORE = STORES[key];
  SHELVES = STORE.shelves;
  rebuildShelfIndex();
  buildGraph();
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
    const walking = a.state === 'walk' || a.state === 'toRegister' || a.state === 'exit';
    a.bodyMesh.position.y = 0.43 + (walking ? Math.abs(Math.sin(time * 7 + a.walkPhase)) * 0.035 : 0);
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

  heatTimer += realDt;
  if (heatTimer > 0.5 && S.layers.floorheat) { heatTimer = 0; redrawHeat(); }
  shelfHeatTimer += realDt;
  if (shelfHeatTimer > 0.8) { shelfHeatTimer = 0; updateShelfHeatVisual(); }

  if (camTween) {
    camTween.t += realDt * 2.2;
    const t = Math.min(1, camTween.t);
    const e = t * t * (3 - 2 * t);
    ['theta', 'phi', 'r', 'tx', 'ty', 'tz'].forEach(k => camState[k] = lerp(camTween.from[k], camTween.to[k], e));
    applyCam();
    if (t >= 1) camTween = null;
  } else if (followTarget && !followTarget.done) {
    camState.tx = lerp(camState.tx, followTarget.x, realDt * 3);
    camState.tz = lerp(camState.tz, followTarget.z, realDt * 3);
    camState.ty = 0.6; camState.r = Math.min(camState.r, 7);
    applyCam();
  }
}

function pickFollowTarget() {
  const active = agents.filter(a => !a.done);
  if (!active.length) return;
  followTarget = active[Math.floor(rng() * active.length)];
  camTween = null;
}
