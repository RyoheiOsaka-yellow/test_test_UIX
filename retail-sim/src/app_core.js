/* =========================================================================
   xAD 店頭販促シミュレーション プロトタイプ
   - 3D店舗（Three.js）＋エージェントベース消費者行動モデル
   - 棚ごとの視線検知 / 店内回遊 / 消費予測 / ノベルティRCT / デジタルCP連動
   - ダッシュボードは xAD 販促ボード仕様（scripted + ライブ集計）
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
const rng = mulberry32(20260804);          // 挙動用（毎ロード同一で scripted 感を担保）
const histRng = mulberry32(910);           // 過去14日 scripted データ用
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
function normalCI95(p, n) { // 二項比率の95%CI半幅
  if (n <= 0) return 0;
  return 1.96 * Math.sqrt(Math.max(p * (1 - p), 1e-6) / n);
}

/* ---------- シナリオ状態 ---------- */
const S = {
  budget: 40,        // 万円/週 デジタルCP予算
  novelty: true,     // ノベルティ配布 ON
  novRate: 0.35,     // 配布率（無作為割付）
  traffic: 1.0,      // 店前人流レベル
  endcap: true,      // エンド陳列
  speed: 15,         // sim秒 / 実秒
  paused: false,
  layers: { shelfheat: true, floorheat: true, cones: false, trails: true, labels: true },
};

/* ---------- 店舗レイアウト ---------- */
// 座標系: x∈[-8,8], z∈[-5,5]（m）。入口は前面 z=+5 の x=-3.3。
const FLOOR_W = 16, FLOOR_D = 10;
const ENTRANCE = { x: -3.3, z: 4.55 };
const REGISTER = { x: 4.2, z: 4.3, payAt: { x: 4.2, z: 4.15 } };
const NOV_STAND = { x: -1.7, z: 3.6 };

// 棚定義: pos=中心, size=[w,h,d], normal=正面方向, approach=立寄位置
const SHELVES = [
  { id: 'chill',  name: '弁当・チルド',       cat: 'food',  pos: [-4.5, 0, -4.5], size: [5.0, 1.8, 0.75], normal: [0, 0, 1],  approach: [-4.5, -3.5], base: 0.62, price: 620, pop: 0.30 },
  { id: 'drink',  name: '飲料リーチイン',     cat: 'drink', pos: [2.5, 0, -4.5],  size: [5.0, 1.9, 0.75], normal: [0, 0, 1],  approach: [2.5, -3.5],  base: 0.58, price: 210, pop: 0.26 },
  { id: 'frozen', name: '冷凍・アイス',       cat: 'food',  pos: [7.55, 0, -1.4], size: [0.75, 1.6, 3.8], normal: [-1, 0, 0], approach: [6.6, -1.4],  base: 0.42, price: 300, pop: 0.10 },
  { id: 'daily',  name: '日用品・衛生',       cat: 'daily', pos: [7.55, 0, 2.3],  size: [0.75, 1.7, 2.6], normal: [-1, 0, 0], approach: [6.6, 2.3],   base: 0.35, price: 450, pop: 0.07 },
  { id: 'mag',    name: '雑誌・書籍',         cat: 'mag',   pos: [-7.55, 0, 0.6], size: [0.75, 1.5, 3.2], normal: [1, 0, 0],  approach: [-6.6, 0.6],  base: 0.18, price: 700, pop: 0.08 },
  { id: 'bread',  name: 'パン・スイーツ',     cat: 'food',  pos: [-6.6, 0, 4.55], size: [2.6, 1.5, 0.7],  normal: [0, 0, -1], approach: [-6.6, 3.6],  base: 0.48, price: 260, pop: 0.14 },
  { id: 'g1L',    name: '菓子',               cat: 'snack', pos: [-3.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [-4.2, -0.6], base: 0.45, price: 180, pop: 0.13, gondola: 'G1' },
  { id: 'g1R',    name: 'スナック・珍味',     cat: 'snack', pos: [-2.55, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [1, 0, 0],  approach: [-1.8, -0.6], base: 0.42, price: 200, pop: 0.10, gondola: 'G1' },
  { id: 'g2L',    name: 'カップ麺',           cat: 'food',  pos: [-0.45, 0, -0.6], size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [-1.2, -0.6], base: 0.40, price: 240, pop: 0.10, gondola: 'G2' },
  { id: 'g2R',    name: '加工食品・レトルト', cat: 'food',  pos: [0.45, 0, -0.6],  size: [0.1, 1.5, 4.0], normal: [1, 0, 0],  approach: [1.2, -0.6],  base: 0.33, price: 380, pop: 0.07, gondola: 'G2' },
  { id: 'g3L',    name: '酒類',               cat: 'drink', pos: [2.55, 0, -0.6],  size: [0.1, 1.5, 4.0], normal: [-1, 0, 0], approach: [1.8, -0.6],  base: 0.50, price: 520, pop: 0.11, gondola: 'G3' },
  { id: 'g3R',    name: '健康食品・美容',     cat: 'daily', pos: [3.45, 0, -0.6],  size: [0.1, 1.5, 4.0], normal: [1, 0, 0],  approach: [4.2, -0.6],  base: 0.28, price: 880, pop: 0.05, gondola: 'G3' },
  { id: 'endG2',  name: '販促エンド（新商品グミX）', cat: 'promo', pos: [0, 0, 1.95], size: [1.1, 1.4, 0.55], normal: [0, 0, 1], approach: [0, 2.85], base: 0.46, price: 240, pop: 0.0, promoted: true },
  { id: 'hot',    name: 'レジ横ホットスナック', cat: 'food', pos: [4.2, 0, 3.55],  size: [2.8, 1.1, 0.6],  normal: [0, 0, 1],  approach: [4.2, 4.35],  base: 0.30, price: 190, pop: 0.0, counter: true },
];
const shelfById = {}; SHELVES.forEach(s => shelfById[s.id] = s);
function promotedShelf() { return S.endcap ? shelfById.endG2 : shelfById.drink; }

// 通路グラフ
const NODE_XS = [-5.5, -1.5, 1.5, 6.2];
const NODE_ZS = [-3.5, 2.7, 4.35];
const NODES = [];
NODE_ZS.forEach((z, zi) => NODE_XS.forEach((x, xi) => NODES.push({ id: NODES.length, x, z, xi, zi })));
const EDGES = {}; // id -> [id]
NODES.forEach(n => EDGES[n.id] = []);
NODES.forEach(a => NODES.forEach(b => {
  if (a.id >= b.id) return;
  const rowAdj = a.zi === b.zi && Math.abs(a.xi - b.xi) === 1;
  const colAdj = a.xi === b.xi && Math.abs(a.zi - b.zi) === 1;
  if (rowAdj || colAdj) { EDGES[a.id].push(b.id); EDGES[b.id].push(a.id); }
}));
function nearestNode(x, z) {
  let best = null, bd = 1e9;
  NODES.forEach(n => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } });
  return best;
}
function nodePath(fromId, toId) { // BFS
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
function routePoints(from, to) { // {x,z} -> waypoint list
  const a = nearestNode(from.x, from.z), b = nearestNode(to.x, to.z);
  const ids = nodePath(a.id, b.id);
  const pts = ids.map(id => ({ x: NODES[id].x, z: NODES[id].z }));
  pts.push({ x: to.x, z: to.z });
  // 始点に近すぎる先頭ノードは捨てる
  if (pts.length > 1 && Math.hypot(pts[0].x - from.x, pts[0].z - from.z) < 0.4) pts.shift();
  return pts;
}

/* ---------- 集計ステート ---------- */
function freshShelfStats() { return { passes: 0, gazes: 0, gazeSec: 0, stops: 0, picks: 0, purchases: 0 }; }
const STATS = {
  day: 15,
  simSec: 10 * 3600,           // 10:00 スタート（秒）
  visitors: 0, adVisitors: 0,
  buyers: 0, revenue: 0,
  promoUnits: 0,
  nov: { treat: 0, ctrl: 0, treatBuy: 0, ctrlBuy: 0, treatRev: 0, ctrlRev: 0 },
  shelves: {},                  // id -> stats
  buckets: [],                  // 30分毎 revenue
  adStoreVisits: 0,             // 広告接触者来店数
  returns: 0,                   // 再来店（予約分カウント）
  applied: 0,                   // CP応募（=ノベルティQR登録扱い）
};
SHELVES.forEach(s => STATS.shelves[s.id] = freshShelfStats());
for (let i = 0; i < 24; i++) STATS.buckets.push(0);

const BEACON_LINES = [];
function beacon(msg, cls) {
  const h = Math.floor(STATS.simSec / 3600), m = Math.floor((STATS.simSec % 3600) / 60);
  BEACON_LINES.push({ t: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, msg, cls });
  if (BEACON_LINES.length > 7) BEACON_LINES.shift();
}

/* ---------- 消費者行動モデル ---------- */
// 到着率(人/sim分): 時間帯カーブ × 人流 × 広告リフト
function arrivalCurve(hour) {
  if (hour < 7) return 0.25;
  if (hour < 9) return 1.25;          // 通勤
  if (hour < 11) return 0.75;
  if (hour < 14) return hour < 12 ? 1.1 : 1.9;  // 昼ピーク
  if (hour < 17) return 0.8;
  if (hour < 20) return 1.55;         // 夕ピーク
  if (hour < 23) return 0.85;
  return 0.35;
}
function adReachLift() { return 0.35 * (S.budget / 100); }        // 来店リフト（人流経路B相当）
function adExposureShare() { return 0.06 + 0.26 * (S.budget / 100); } // 来店者のうち広告接触済み比率
function arrivalRatePerMin() {
  const hour = STATS.simSec / 3600;
  return 2.3 * arrivalCurve(hour) * S.traffic * (1 + adReachLift());
}

const NOV_TRUE_LIFT = 0.32;   // ノベルティの真の購買率リフト（モデル既定値・検証対象）
const AD_PROMO_MULT = 1.7;    // 広告接触者の販促商品購買倍率
const ENDCAP_ATTENTION = 1.9; // エンド陳列の視線・立寄倍率

let agentSeq = 0;
class Agent {
  constructor() {
    this.id = ++agentSeq;
    this.x = ENTRANCE.x + (rng() - 0.5) * 0.6;
    this.z = ENTRANCE.z;
    this.heading = -Math.PI / 2; // -z向き
    this.speed = 0.85 + rng() * 0.35;
    this.adExposed = rng() < adExposureShare();
    this.hasNovelty = false; this.novGroup = null;
    this.basket = []; this.revenue = 0;
    this.gazeMap = {};      // shelfId -> sec（ユニーク視線判定）
    this.passSet = {};
    this.state = 'plan'; this.wait = 0; this.wp = [];
    this.targetShelf = null; this.plan = [];
    this.trail = [];
    this.done = false;
    this.mesh = null; this.cone = null; this.trailLine = null;

    // 買い回り計画
    const wanderer = rng() < 0.18;
    const n = wanderer ? 0 : 1 + Math.floor(rng() * 3);
    const cand = SHELVES.filter(s => !s.promoted && !s.counter && s.pop > 0);
    const picked = [];
    for (let i = 0; i < n; i++) {
      let r = rng() * cand.reduce((a, s) => a + s.pop, 0);
      for (const s of cand) { r -= s.pop; if (r <= 0) { if (!picked.includes(s)) picked.push(s); break; } }
    }
    // 広告接触者は販促商品を目的地に追加（指名来店）
    if (this.adExposed && rng() < 0.72) picked.push(promotedShelf());
    else if (rng() < (S.endcap ? 0.16 : 0.07)) picked.push(promotedShelf()); // 自然立寄
    if (wanderer) { // ぶらり客: 通路2本を回遊
      picked.push(SHELVES[Math.floor(rng() * 12)]);
    }
    // 近い順に並べる（簡易TSP: 入口からの貪欲）
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
      if (s.id === 'endG2' && !S.endcap) { this.nextLeg(); return; }
      this.targetShelf = s;
      this.wp = routePoints(this, { x: s.approach[0], z: s.approach[1] });
      this.state = 'walk';
    } else if (!this.paid && this.basket.length) {
      this.targetShelf = null;
      this.wp = routePoints(this, REGISTER.payAt);
      this.state = 'toRegister';
    } else {
      this.targetShelf = null;
      this.wp = routePoints(this, ENTRANCE);
      this.state = 'exit';
    }
  }

  dwellAt(shelf, dt) {
    this.wait -= dt;
    // 視線を注ぎ続ける
    this.faceShelf(shelf);
    if (this.wait <= 0) {
      // 手に取り→購買判定
      const st = STATS.shelves[shelf.id];
      const pPick = 0.62;
      if (rng() < pPick) {
        st.picks++;
        let pBuy = shelf.base;
        if (shelf.promoted || (shelf === promotedShelf())) {
          if (this.adExposed) pBuy *= AD_PROMO_MULT;
          if (this.hasNovelty) pBuy *= (1 + NOV_TRUE_LIFT);
        } else if (this.hasNovelty) pBuy *= 1.06; // 併売のごく小さい波及
        if (rng() < clamp(pBuy, 0, 0.96)) {
          const isPromo = shelf === promotedShelf();
          if (isPromo && stockState.units <= 0) {
            // 在庫内生性: 品切れ中は買いたくても買えない（広告効果でなく在庫制約 → 機会損失として記録）
            stockState.missed++;
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

  update(dt) { // dt: sim秒
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
        // ノベルティRCTの成果計上（販促商品購買が主要アウトカム）
        const boughtPromo = this.basket.includes(promotedShelf().id);
        if (this.novGroup === 'treat') { if (boughtPromo) STATS.nov.treatBuy++; STATS.nov.treatRev += this.revenue; }
        if (this.novGroup === 'ctrl') { if (boughtPromo) STATS.nov.ctrlBuy++; STATS.nov.ctrlRev += this.revenue; }
        // 再来店モデル: 購買者は再来店確率↑、ノベルティでさらに↑
        const pReturn = 0.22 * (this.hasNovelty ? 1.35 : 1);
        if (rng() < pReturn) STATS.returns++;
        this.nextLeg();
      }
      return;
    }

    // 歩行
    if (!this.wp.length) { this.nextLeg(); return; }
    const t = this.wp[0];
    const dx = t.x - this.x, dz = t.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.18) {
      this.wp.shift();
      if (!this.wp.length) {
        if (this.state === 'walk' && this.targetShelf) {
          // 立寄（滞在）
          const s = this.targetShelf;
          STATS.shelves[s.id].stops++;
          this.dwellShelf = s; this.state = 'dwell';
          this.wait = 10 + rng() * 20;
          if (rng() < 0.05) beacon(`客#${this.id} 「${s.name}」に立寄`, this.hasNovelty ? 'seg-nov' : '');
        } else if (this.state === 'toRegister') {
          this.state = 'pay'; this.wait = 20 + rng() * 30;
          STATS.shelves.hot && this.maybeImpulseHot();
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

    // ノベルティスタンド通過時の無作為配布
    if (S.novelty && this.novGroup === null) {
      const dn = Math.hypot(this.x - NOV_STAND.x, this.z - NOV_STAND.z);
      if (dn < 2.0) {
        if (rng() < S.novRate) {
          this.novGroup = 'treat'; this.hasNovelty = true;
          STATS.nov.treat++; STATS.applied++;
          // サンプリングによる興味喚起 → 販促棚への立寄が増える（RCTが測る総合効果の一部）
          const promo = promotedShelf();
          if (!this.plan.includes(promo) && !this.basket.includes(promo.id) && rng() < 0.4) this.plan.push(promo);
          if (rng() < 0.1) beacon(`客#${this.id} ノベルティ受取（処置群）`, 'seg-nov');
        } else {
          this.novGroup = 'ctrl'; STATS.nov.ctrl++;
        }
      }
    }
  }

  maybeImpulseHot() {
    const hot = shelfById.hot;
    if (rng() < 0.3) {
      STATS.shelves.hot.stops++; STATS.shelves.hot.picks++;
      if (rng() < hot.base) {
        STATS.shelves.hot.purchases++;
        const price = hot.price * (0.9 + rng() * 0.3);
        this.basket.push('hot'); this.revenue += price;
      }
    }
  }
}

/* 視線・通過検知（0.25 sim秒間隔） */
const GAZE_DIST = 2.9, GAZE_COS = Math.cos(45 * Math.PI / 180);
function senseGaze(agent, interval) {
  for (const s of SHELVES) {
    if (s.id === 'endG2' && !S.endcap) continue;
    const gx = s.pos[0], gz = s.pos[2];
    const dx = gx - agent.x, dz = gz - agent.z;
    const d = Math.hypot(dx, dz);
    if (d > GAZE_DIST) continue;
    // 通過（棚前 2.2m 以内）
    if (d < 2.2 && !agent.passSet[s.id]) { agent.passSet[s.id] = 1; STATS.shelves[s.id].passes++; }
    // 視野角: heading は atan2(dx,dz)
    const hx = Math.sin(agent.heading), hz = Math.cos(agent.heading);
    const cos = (dx * hx + dz * hz) / (d || 1e-6);
    if (cos < GAZE_COS) continue;
    // 棚正面側にいるか
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

/* 在庫（販促商品） */
const stockState = { units: 240, cap: 240, missed: 0, restockedAt: null };

/* 到着カーブの累積割合（着地予測の按分に使用。線形按分だと昼ピーク直後に過大推計になる） */
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

/* ---------- 過去14日 scripted 日次データ ---------- */
// デフォルトシナリオ相当の日次売上を生成。Day9 にデジタルCP開始の構造変化を仕込む。
const HISTORY = [];
(function genHistory() {
  for (let d = 1; d <= 14; d++) {
    const week = (d - 1) % 7;
    const weekend = week >= 5 ? 1.18 : 1.0;
    const cpOn = d >= 9;
    const base = 418000;
    const noise = (histRng() - 0.5) * 40000;
    const cpLift = cpOn ? 66000 + (histRng() - 0.5) * 14000 : 0;
    const foot = 40000 * Math.sin(d / 3.1) * 0.5 + (histRng() - 0.5) * 18000;
    HISTORY.push({
      day: d,
      revenue: Math.round(base * weekend + noise + cpLift + foot),
      cpOn,
      anomaly: d === 9,
    });
  }
})();

/* ---------- Three.js シーン ---------- */
let renderer, scene, camera, camState;
const agents = [];
let followTarget = null;
const heat = { grid: new Float32Array(64 * 40), canvas: null, tex: null, dirty: 0 };
let shelfMeshes = {}, labelSprites = [], novStandGroup = null, endcapGroup = null;

function initThree() {
  const container = document.getElementById('view3d');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050c);
  scene.fog = new THREE.Fog(0x04050c, 26, 60);

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 200);
  camState = { theta: -0.5, phi: 0.96, r: 17, tx: 0, ty: 0, tz: 0.6 };
  applyCam();

  scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
  const dir = new THREE.DirectionalLight(0xcfe8ff, 0.75);
  dir.position.set(8, 14, 6); scene.add(dir);
  const p1 = new THREE.PointLight(0x00b7d9, 0.5, 22); p1.position.set(0, 4.5, 0); scene.add(p1);
  const p2 = new THREE.PointLight(0xd55181, 0.35, 14); p2.position.set(0, 3, 2.4); scene.add(p2);

  buildStore();
  bindCamControls();
  window.addEventListener('resize', () => {
    camera.aspect = (window.innerWidth) / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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

function bindCamControls() {
  const el = renderer.domElement;
  let drag = null;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('mousedown', e => { drag = { b: e.button, x: e.clientX, y: e.clientY }; followTarget = null; });
  window.addEventListener('mouseup', () => drag = null);
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
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
    camState.r = clamp(camState.r * (1 + Math.sign(e.deltaY) * 0.08), 4, 40);
    applyCam();
  }, { passive: true });
}

const CAM_PRESETS = {
  over:     { theta: -0.5, phi: 0.96, r: 17, tx: 0, ty: 0, tz: 0.6 },
  entrance: { theta: Math.PI - 0.35, phi: 1.25, r: 9, tx: -2.2, ty: 0.4, tz: 2.2 },
  promo:    { theta: 0.15, phi: 1.05, r: 7.5, tx: 0, ty: 0.5, tz: 1.6 },
};
let camTween = null;
function tweenCam(to) {
  followTarget = null;
  const from = Object.assign({}, camState);
  camTween = { from, to, t: 0 };
}
function focusShelf(id) {
  const s = shelfById[id];
  if (!s) return;
  tweenCam({
    theta: Math.atan2(s.normal[0], s.normal[2]),
    phi: 1.12, r: 6,
    tx: s.pos[0] + s.normal[0] * 0.5, ty: 0.6, tz: s.pos[2] + s.normal[2] * 0.5,
  });
}

function neonEdges(geom, color, opacity) {
  const e = new THREE.EdgesGeometry(geom);
  return new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity || 0.75 }));
}

function buildStore() {
  // 床
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1120, roughness: 0.9, metalness: 0.1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // 床グリッド
  const grid = new THREE.GridHelper(40, 40, 0x123, 0x0e1a30);
  grid.position.y = 0.005; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);
  // 外周の街っぽい床
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0x04060f }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; scene.add(outer);

  // 回遊ヒートマップ用テクスチャ
  heat.canvas = document.createElement('canvas');
  heat.canvas.width = 64; heat.canvas.height = 40;
  heat.tex = new THREE.CanvasTexture(heat.canvas);
  const heatPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_D),
    new THREE.MeshBasicMaterial({ map: heat.tex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  heatPlane.rotation.x = -Math.PI / 2; heatPlane.position.y = 0.02;
  heatPlane.name = 'heatPlane'; scene.add(heatPlane);
  heat.plane = heatPlane;

  // 壁（ネオン枠）
  const wallH = 2.6;
  const wallGeo = new THREE.BoxGeometry(FLOOR_W, wallH, 0.1);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c1526, transparent: true, opacity: 0.35, roughness: 0.6 });
  const mkWall = (w, d, x, z, ry) => {
    const g = new THREE.BoxGeometry(w, wallH, 0.1);
    const m = new THREE.Mesh(g, wallMat.clone());
    m.position.set(x, wallH / 2, z); m.rotation.y = ry || 0; scene.add(m);
    const e = neonEdges(g, 0x2a5f8f, 0.8); e.position.copy(m.position); e.rotation.y = m.rotation.y; scene.add(e);
  };
  mkWall(FLOOR_W, 0.1, 0, -FLOOR_D / 2, 0);                        // 奥
  mkWall(FLOOR_D, 0.1, -FLOOR_W / 2, 0, Math.PI / 2);              // 左
  mkWall(FLOOR_D, 0.1, FLOOR_W / 2, 0, Math.PI / 2);               // 右
  // 前面はドア開口: 左右セグメント
  mkWall(3.4, 0.1, -6.3, FLOOR_D / 2, 0);
  mkWall(9.4, 0.1, 3.3, FLOOR_D / 2, 0);
  // 入口マット
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshBasicMaterial({ color: 0x00b7d9, transparent: true, opacity: 0.18 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(ENTRANCE.x, 0.015, 4.45); scene.add(mat);

  // 棚
  SHELVES.forEach(s => {
    const g = new THREE.Group();
    const isGondolaSide = !!s.gondola;
    const w = isGondolaSide ? 0.42 : s.size[0];
    const geoW = s.size[0] < 0.2 ? 0.42 : s.size[0];
    const geo = new THREE.BoxGeometry(
      s.normal[0] !== 0 ? (s.size[0] < 1 ? s.size[0] : s.size[0]) : geoW,
      s.size[1],
      s.normal[2] !== 0 ? s.size[2] : s.size[2]
    );
    // 位置: ゴンドラ側面棚は半身
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x16324a, roughness: 0.55, metalness: 0.2,
      emissive: 0x06131f, emissiveIntensity: 1,
    }));
    mesh.position.set(s.pos[0] - (isGondolaSide ? s.normal[0] * 0 : 0), s.size[1] / 2, s.pos[2]);
    g.add(mesh);
    const edge = neonEdges(geo, s.promoted ? 0xff5fa2 : 0x2f81c7, s.promoted ? 0.95 : 0.55);
    edge.position.copy(mesh.position); g.add(edge);
    // 段板ライン
    for (let i = 1; i <= 3; i++) {
      const y = (s.size[1] / 4) * i;
      const shelfLine = new THREE.Mesh(
        new THREE.BoxGeometry(
          (s.normal[2] !== 0 ? Math.max(geoW - 0.06, 0.2) : 0.02),
          0.02,
          (s.normal[0] !== 0 ? Math.max(s.size[2] - 0.06, 0.2) : 0.02)
        ),
        new THREE.MeshBasicMaterial({ color: 0x1c4668 })
      );
      shelfLine.position.set(
        mesh.position.x + s.normal[0] * (geoW / 2 + 0.01),
        y,
        mesh.position.z + s.normal[2] * ((s.normal[2] !== 0 ? s.size[2] : s.size[2]) / 2 + 0.01)
      );
      g.add(shelfLine);
    }
    if (s.promoted) {
      // 販促POP
      const pop = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.34),
        new THREE.MeshBasicMaterial({ color: 0xff5fa2, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      pop.position.set(s.pos[0], s.size[1] + 0.45, s.pos[2]);
      g.add(pop);
      endcapGroup = g;
    }
    scene.add(g);
    shelfMeshes[s.id] = { group: g, mesh, edge };

    // ラベルスプライト
    const label = makeLabel(s.name, s.promoted ? '#ff9ec4' : '#9fd8ff');
    label.position.set(s.pos[0] + s.normal[0] * 0.7, s.size[1] + 0.35, s.pos[2] + s.normal[2] * 0.7);
    if (s.promoted) g.add(label); else scene.add(label);
    labelSprites.push(label);
  });

  // ゴンドラ本体（G1-G3の筐体）
  ['G1', 'G2', 'G3'].forEach((gname, i) => {
    const x = [-3, 0, 3][i];
    const geo = new THREE.BoxGeometry(0.9, 1.5, 4.0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x10263c, roughness: 0.6, emissive: 0x05101c }));
    m.position.set(x, 0.75, -0.6); scene.add(m);
    const e = neonEdges(geo, 0x2f81c7, 0.5); e.position.copy(m.position); scene.add(e);
  });

  // レジカウンター
  const regGeo = new THREE.BoxGeometry(2.8, 1.0, 0.6);
  const reg = new THREE.Mesh(regGeo, new THREE.MeshStandardMaterial({ color: 0x142c44, emissive: 0x061520 }));
  reg.position.set(4.2, 0.5, 3.55); scene.add(reg);
  const rege = neonEdges(regGeo, 0x36d6a5, 0.8); rege.position.copy(reg.position); scene.add(rege);
  const regLabel = makeLabel('レジ', '#7be8c4'); regLabel.position.set(4.2, 1.9, 3.55); scene.add(regLabel); labelSprites.push(regLabel);

  // ノベルティスタンド
  novStandGroup = new THREE.Group();
  const standGeo = new THREE.CylinderGeometry(0.36, 0.44, 1.05, 8);
  const stand = new THREE.Mesh(standGeo, new THREE.MeshStandardMaterial({ color: 0x3a2c10, emissive: 0x2a1c05, roughness: 0.5 }));
  stand.position.set(NOV_STAND.x, 0.52, NOV_STAND.z); novStandGroup.add(stand);
  const se = neonEdges(standGeo, 0xe8b04b, 0.9); se.position.copy(stand.position); novStandGroup.add(se);
  const flagGeo = new THREE.PlaneGeometry(0.55, 0.75);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ color: 0xe8b04b, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  flag.position.set(NOV_STAND.x, 1.6, NOV_STAND.z); novStandGroup.add(flag);
  const novLabel = makeLabel('ノベルティ配布', '#ffd98a'); novLabel.position.set(NOV_STAND.x, 2.15, NOV_STAND.z);
  novStandGroup.add(novLabel);
  scene.add(novStandGroup);
}

function makeLabel(text, color) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '600 26px "Hiragino Kaku Gothic ProN", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 26;
  c.width = w; c.height = 44;
  const ctx2 = c.getContext('2d');
  ctx2.font = '600 26px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx2.fillStyle = 'rgba(6,10,22,0.72)';
  ctx2.beginPath(); ctx2.roundRect(0, 0, w, 44, 9); ctx2.fill();
  ctx2.fillStyle = color;
  ctx2.textBaseline = 'middle';
  ctx2.fillText(text, 13, 23);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(w / 110, 44 / 110, 1);
  return sp;
}

/* エージェント3D表現 */
function makeAgentMesh(agent) {
  const g = new THREE.Group();
  const color = agent.adExposed ? 0xd55181 : 0x18b7d9;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.17, 0.9, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.5 })
  );
  body.position.y = 0.45; g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f5, emissive: 0x445566, emissiveIntensity: 0.25 })
  );
  head.position.y = 1.05; g.add(head);
  // 視線コーン
  const coneGeo = new THREE.ConeGeometry(1.5, 2.8, 20, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: agent.adExposed ? 0xff5fa2 : 0x00e5ff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
  }));
  cone.rotation.x = Math.PI / 2;
  const coneHolder = new THREE.Group();
  coneHolder.add(cone); cone.position.z = 1.4;
  coneHolder.position.y = 1.0;
  coneHolder.visible = false;
  g.add(coneHolder);
  agent.coneHolder = coneHolder;
  // ノベルティリング（受取後に表示）
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xe8b04b, transparent: true, opacity: 0.9 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; ring.visible = false;
  g.add(ring); agent.ring = ring;
  scene.add(g);
  agent.mesh = g;
  // トレイル
  const tGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(40 * 3);
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const tLine = new THREE.Line(tGeo, new THREE.LineBasicMaterial({
    color: agent.adExposed ? 0xd55181 : 0x1290b0, transparent: true, opacity: 0.4,
  }));
  tLine.frustumCulled = false;
  scene.add(tLine);
  agent.trailLine = tLine; agent.trailPos = tPos; agent.trailLen = 0;
}

function disposeAgent(agent) {
  if (agent.mesh) { scene.remove(agent.mesh); agent.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  if (agent.trailLine) { scene.remove(agent.trailLine); agent.trailLine.geometry.dispose(); agent.trailLine.material.dispose(); }
}

/* ヒートマップ描画 */
function heatColor(v) { // v 0..1 → シアン単色ランプ
  const r = Math.round(lerp(6, 60, v));
  const g = Math.round(lerp(16, 200, v));
  const b = Math.round(lerp(28, 255, v));
  return [r, g, b];
}
function redrawHeat() {
  const ctx = heat.canvas.getContext('2d');
  const img = ctx.createImageData(64, 40);
  let max = 8;
  for (let i = 0; i < heat.grid.length; i++) if (heat.grid[i] > max) max = heat.grid[i];
  for (let i = 0; i < heat.grid.length; i++) {
    const v = Math.pow(clamp(heat.grid[i] / max, 0, 1), 0.6);
    const [r, g, b] = heatColor(v);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(v * 210);
  }
  ctx.putImageData(img, 0, 0);
  heat.tex.needsUpdate = true;
}

/* 棚ヒート（視線量→発光） */
function updateShelfHeatVisual() {
  let max = 20;
  SHELVES.forEach(s => { const g = STATS.shelves[s.id].gazeSec; if (g > max) max = g; });
  SHELVES.forEach(s => {
    const sm = shelfMeshes[s.id]; if (!sm) return;
    const v = clamp(STATS.shelves[s.id].gazeSec / max, 0, 1);
    if (S.layers.shelfheat) {
      const c = new THREE.Color().setRGB(
        lerp(0.03, 0.16, v) + (s.promoted ? 0.06 : 0),
        lerp(0.07, 0.75, v),
        lerp(0.12, 1.0, v)
      );
      sm.mesh.material.emissive = c;
      sm.mesh.material.emissiveIntensity = lerp(0.25, 1.15, v);
    } else {
      sm.mesh.material.emissive = new THREE.Color(0x06131f);
      sm.mesh.material.emissiveIntensity = 1;
    }
  });
}

/* ---------- シミュレーションループ ---------- */
let arrivalCarry = 0, gazeTimer = 0, heatTimer = 0, shelfHeatTimer = 0;

function simStep(simDt) {
  // 到着（ポアソン近似）
  const perSec = arrivalRatePerMin() / 60;
  arrivalCarry += perSec * simDt;
  while (arrivalCarry >= 1) {
    arrivalCarry -= 1;
    if (agents.length < 46) {
      const a = new Agent();
      makeAgentMesh(a);
      agents.push(a);
    }
  }
  // エージェント更新
  const sub = Math.max(1, Math.ceil(simDt / 0.5)); // 大きな simDt は分割して挙動を安定化
  const stepDt = simDt / sub;
  for (let k = 0; k < sub; k++) {
    agents.forEach(a => a.update(stepDt));
    gazeTimer += stepDt;
    if (gazeTimer >= 0.25) {
      const iv = gazeTimer; gazeTimer = 0;
      agents.forEach(a => { if (!a.done) senseGaze(a, iv); });
      // 回遊ヒート蓄積
      agents.forEach(a => {
        if (a.done) return;
        const gx = Math.floor((a.x + FLOOR_W / 2) / FLOOR_W * 64);
        const gz = Math.floor((a.z + FLOOR_D / 2) / FLOOR_D * 40);
        if (gx >= 0 && gx < 64 && gz >= 0 && gz < 40) heat.grid[gz * 64 + gx] += iv;
      });
    }
  }
  // 退店処理
  for (let i = agents.length - 1; i >= 0; i--) {
    if (agents[i].done) { if (followTarget === agents[i]) followTarget = null; disposeAgent(agents[i]); agents.splice(i, 1); }
  }
  STATS.simSec += simDt;
  if (STATS.simSec >= 22 * 3600) { // 閉店 → 翌日
    STATS.simSec = 10 * 3600;
    rolloverDay();
  }
}

function rolloverDay() {
  // 本日実績を履歴に確定し、翌日へ（scripted 波形に接続）
  const proj = window.__computeProjection ? window.__computeProjection() : null;
  HISTORY.push({ day: STATS.day, revenue: Math.round(proj ? proj.totalRevenue : STATS.revenue), cpOn: S.budget > 0, anomaly: false, live: true });
  if (HISTORY.length > 20) HISTORY.shift();
  STATS.day++;
  STATS.visitors = 0; STATS.adVisitors = 0; STATS.buyers = 0; STATS.revenue = 0; STATS.promoUnits = 0;
  STATS.adStoreVisits = 0; STATS.returns = 0; STATS.applied = 0;
  STATS.nov = { treat: 0, ctrl: 0, treatBuy: 0, ctrlBuy: 0, treatRev: 0, ctrlRev: 0 };
  SHELVES.forEach(s => STATS.shelves[s.id] = freshShelfStats());
  STATS.buckets = STATS.buckets.map(() => 0);
  heat.grid.fill(0);
  stockState.units = stockState.cap; stockState.missed = 0; stockState.restockedAt = null;
  agents.slice().forEach(a => { disposeAgent(a); });
  agents.length = 0;
  document.getElementById('sim-day').textContent = 'DAY ' + STATS.day;
}

/* 3D表示更新（毎フレーム） */
function updateVisuals(realDt) {
  agents.forEach(a => {
    if (!a.mesh) return;
    a.mesh.position.set(a.x, 0, a.z);
    a.mesh.rotation.y = a.heading;
    a.coneHolder.visible = S.layers.cones && !a.done;
    if (a.ring) a.ring.visible = a.hasNovelty;
    // トレイル
    if (S.layers.trails) {
      a.trailLine.visible = true;
      a.trailTick = (a.trailTick || 0) + realDt;
      if (a.trailTick > 0.08) {
        a.trailTick = 0;
        if (a.trailLen < 40) a.trailLen++;
        // shift
        for (let i = a.trailLen - 1; i > 0; i--) {
          a.trailPos[i * 3] = a.trailPos[(i - 1) * 3];
          a.trailPos[i * 3 + 1] = a.trailPos[(i - 1) * 3 + 1];
          a.trailPos[i * 3 + 2] = a.trailPos[(i - 1) * 3 + 2];
        }
        a.trailPos[0] = a.x; a.trailPos[1] = 0.06; a.trailPos[2] = a.z;
        for (let i = a.trailLen; i < 40; i++) { a.trailPos[i * 3] = a.x; a.trailPos[i * 3 + 1] = 0.06; a.trailPos[i * 3 + 2] = a.z; }
        a.trailLine.geometry.attributes.position.needsUpdate = true;
      }
    } else a.trailLine.visible = false;
  });
  labelSprites.forEach(l => l.visible = S.layers.labels);
  heat.plane.visible = S.layers.floorheat;
  if (novStandGroup) novStandGroup.visible = S.novelty;
  if (endcapGroup) endcapGroup.visible = S.endcap;

  heatTimer += realDt;
  if (heatTimer > 0.5 && S.layers.floorheat) { heatTimer = 0; redrawHeat(); }
  shelfHeatTimer += realDt;
  if (shelfHeatTimer > 0.8) { shelfHeatTimer = 0; updateShelfHeatVisual(); }

  // カメラ tween / follow
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
