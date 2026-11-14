// 人流モデル (仮): 駅の乗降人員 (実績値) を、時間帯別の目的 (通勤・来街・住民・昼食・回遊) に分け、
// 建物の用途と規模から決めた「集客力」と駅からの歩行距離による重力モデルで目的地へ配分し、歩行者ネットワーク上の最短経路に流す。
// three.js に依存しない純粋な計算部 (Node でも検証できる)。
//
// 実績値の出典 (1 日平均):
//   みなとみらい駅 85,853 人 (乗降, 2024 年度) / 新高島駅 13,140 人 (乗降, 2024 年度) / 馬車道駅 44,296 人 (乗降, 2025 年度)  … 横浜高速鉄道
//   桜木町駅 JR 72,477 人 (乗車, 2024 年度 → 乗降は 2 倍と仮定) … JR 東日本
//   桜木町駅 地下鉄 40,139 人 (乗降, 2024 年度) / 高島町駅 10,031 人 (乗降, 2024 年度) … 横浜市交通局
//   みなとみらい21地区: 就業者 約 14.4 万人、来街者 約 8,260 万人/年 (2024 年) … 横浜市都市整備局 記者発表
// 仮定 (実測ではない): 横浜駅から対象範囲へ歩く人数、目的別の割合、時間帯分布、建物の集客力、昼食・回遊の発生率。

export const GROUPS = [
  { key: 'commute', n: '通勤', color: '#4da3ff' },
  { key: 'visit', n: '来街（買物・観光）', color: '#ffb347' },
  { key: 'resident', n: '住民', color: '#6fdc7a' },
  { key: 'lunch', n: '昼食', color: '#ff6f91' },
  { key: 'stroll', n: '回遊', color: '#9a7bff' },
  { key: 'event', n: 'イベント', color: '#e040fb' },
];

export const STATION_DATA = [
  { id: 'mm', n: 'みなとみらい駅', st: 'みなとみらい駅', daily: 85853, src: '乗降 2024年度' },
  { id: 'shin', n: '新高島駅', st: '新高島駅', daily: 13140, src: '乗降 2024年度' },
  { id: 'basha', n: '馬車道駅', st: '馬車道駅', daily: 44296, src: '乗降 2025年度' },
  { id: 'sakuJR', n: '桜木町駅（JR）', st: '桜木町駅', lvMin: 0, daily: 144954, src: '乗車 72,477×2 2024年度' },
  { id: 'sakuSub', n: '桜木町駅（地下鉄）', st: '桜木町駅', lvMax: -1, daily: 40139, src: '乗降 2024年度' },
  { id: 'taka', n: '高島町駅', st: '高島町駅', daily: 10031, src: '乗降 2024年度' },
  { id: 'yoko', n: '横浜駅（東口方面）', st: '横浜駅', daily: 120000, src: '仮定値', assumed: true },
];

// 時間帯分布: {時: その 1 時間に動く割合}。合計 1 に正規化し、時刻の中央 (h+0.5) で線形補間する
const P = o => { const a = new Float32Array(24); let s = 0; for (const [h, v] of Object.entries(o)) { a[+h] = v; s += v; } for (let i = 0; i < 24; i++) a[i] /= s; return a; };
const PROFILE = {
  commuteIn: P({ 5: 0.01, 6: 0.05, 7: 0.20, 8: 0.36, 9: 0.20, 10: 0.07, 11: 0.03, 12: 0.02, 13: 0.03, 14: 0.01, 15: 0.01, 16: 0.01 }),
  commuteOut: P({ 12: 0.01, 13: 0.01, 14: 0.01, 15: 0.02, 16: 0.05, 17: 0.17, 18: 0.27, 19: 0.20, 20: 0.12, 21: 0.08, 22: 0.04, 23: 0.02 }),
  visitIn: P({ 8: 0.01, 9: 0.04, 10: 0.10, 11: 0.13, 12: 0.12, 13: 0.11, 14: 0.10, 15: 0.09, 16: 0.08, 17: 0.08, 18: 0.07, 19: 0.04, 20: 0.02, 21: 0.01 }),
  visitOut: P({ 10: 0.01, 11: 0.02, 12: 0.04, 13: 0.06, 14: 0.08, 15: 0.10, 16: 0.12, 17: 0.12, 18: 0.12, 19: 0.11, 20: 0.10, 21: 0.08, 22: 0.03, 23: 0.01 }),
  residentOut: P({ 5: 0.02, 6: 0.10, 7: 0.28, 8: 0.27, 9: 0.12, 10: 0.06, 11: 0.04, 12: 0.03, 13: 0.03, 14: 0.02, 15: 0.02, 16: 0.01 }),
  residentIn: P({ 13: 0.02, 14: 0.03, 15: 0.05, 16: 0.07, 17: 0.12, 18: 0.18, 19: 0.18, 20: 0.14, 21: 0.10, 22: 0.07, 23: 0.04 }),
  lunchOut: P({ 11: 0.25, 12: 0.65, 13: 0.10 }),
  lunchBack: P({ 12: 0.35, 13: 0.60, 14: 0.05 }),
  stroll: P({ 10: 0.05, 11: 0.08, 12: 0.09, 13: 0.10, 14: 0.11, 15: 0.11, 16: 0.10, 17: 0.10, 18: 0.09, 19: 0.08, 20: 0.06, 21: 0.03 }),
};
const prof = (a, h) => { const x = h - 0.5, i = Math.floor(x), f = x - i; const A = a[((i % 24) + 24) % 24], B = a[(((i + 1) % 24) + 24) % 24]; return A + (B - A) * f; };

// 曜日による目的別の割合 (駅で降りる人・乗る人に対する割合) と総量係数
export const DAY_TYPES = {
  weekday: { n: '平日', total: 1.0, commute: 0.50, visit: 0.36, resident: 0.14, lunch: 0.30, stroll: 1.0 },
  holiday: { n: '休日', total: 0.92, commute: 0.13, visit: 0.72, resident: 0.15, lunch: 0.30, stroll: 1.5 },
};
// イベント (仮定): 会場の収容人数規模の来場者が、開演前に最寄り駅から集まり、終演後に一斉に駅へ向かう
export const EVENTS = {
  karena: { n: 'K アリーナ横浜 公演（2 万人・18:00 開演 / 21:00 終演）', match: /K-?\s?Arena|Kアリーナ/i, people: 20000, arrive: [16, 17.25, 18], leave: [21, 21.25, 21.9] },
  pia: { n: 'ぴあアリーナ MM 公演（1 万人・18:00 開演 / 20:30 終演）', match: /ぴあアリーナ/, people: 10000, arrive: [16, 17.25, 18], leave: [20.5, 20.75, 21.4] },
  pacifico: { n: 'パシフィコ横浜 展示会（3 万人・10〜17 時）', match: /^パシフィコ横浜$|パシフィコ横浜展示ホール/, people: 30000, arrive: [9, 10.2, 13], leave: [14.5, 16.6, 18] },
};
const tri = (h, [a, p, b]) => h <= a || h >= b ? 0 : (h < p ? (h - a) / (p - a) : (b - h) / (b - p)) * 2 / (b - a);   // 面積 1 の三角パルス (1/時)
// 雨天 (仮定): 屋根の無い区間は歩行コスト 1.7 倍 (屋内・地下・屋根付きへ寄る)、来街 0.8 倍、回遊 0.4 倍、公園の集客 0.1 倍
export const RAIN = { cost: 1.7, visit: 0.8, stroll: 0.4, park: 0.1 };
// 曜日 + 月 + 較正 を反映した発生条件。calib があれば 休日の総量と月別の係数を人流オープンデータに合わせる
export function dayContext(dayKey, month, calib) {
  const d = { ...DAY_TYPES[dayKey] };
  if (calib) { if (dayKey === 'holiday' && calib.holidayTotal) d.total = calib.holidayTotal; const mf = (dayKey === 'holiday' ? calib.monthHol : calib.monthWk)?.[(month ?? 1) - 1]; if (mf) d.total *= mf; }
  return d;
}
const BETA = { commute: 450, visit: 600, resident: 500 };   // 重力モデルの距離減衰 (m)
const VT_W = { stairs: 1.6, esc: 1.15, elev: 2.5, slope: 1.1 };
export const WALK_SPEED = 1.3;

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v; const top = v[0]; const key = k.pop(), val = v.pop(); const n = k.length; if (n) { let i = 0; for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = key; v[i] = val; } return top; }
  get size() { return this.k.length; }
  get minKey() { return this.k[0]; }
}

const inRing = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0] / 10, yi = ring[i][1] / 10, xj = ring[j][0] / 10, yj = ring[j][1] / 10; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const ringArea = ring => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]); return Math.abs(s) / 200; };
const RES_NAME = /レジデンス|タワーズ|マンション|ハイツ|コート|ブリリア|ライオンズ|パークホームズ|グランド?メゾン|団地|住宅|寮$/;
const HOTEL_NAME = /ホテル|HOTEL|Hotel|イン$|ヒルトン|ウェスティン|インターコンチネンタル|カハラ|オークウッド/;

// 建物 1 棟の集客力 (相対値)。延床の目安 = 建築面積 × 階数。用途は OSM タグ・店舗数・名称・高さから推定する
function attraction(m, poi) {
  const h = Math.max(3, (m.z ? m.z[1] - m.z[0] : m.h) || 3), floors = Math.max(1, Math.round(h / 3.8));
  const a = (m.a ?? ((m.bb[2] - m.bb[0]) * (m.bb[3] - m.bb[1]) / 100 * 0.6)) * ((m.parts || 1) > 1 ? 0.5 : 1);
  const low = Math.min(floors, 8), F = a * low + a * 0.6 * (floors - low), Flow = a * low, Fhigh = F - Flow;   // 高層部は基壇より細い
  const nm = m.n || ''; let u = m.u;
  if (HOTEL_NAME.test(nm)) u = 'hot'; else if (!u && RES_NAME.test(nm)) u = 'res';
  if (!u) u = (h < 14 && a < 260) ? 'res' : h >= 45 ? 'tower' : 'mix';
  let off = 0, vis = 0, res = 0;
  if (u === 'res') res = F / 35;
  else if (u === 'hot') { vis = F / 60; off = F / 400; }
  else if (u === 'ret') {   // 商業は基壇部のみ。高層部は名称が住宅なら住宅、それ以外は業務
    vis = Flow / 12; off = Flow / 150;
    if (RES_NAME.test(nm) || /ザ・タワー/.test(nm)) res += Fhigh / 35; else off += Fhigh / 28;
  }
  else if (u === 'att') { vis = F / 25; off = F / 300; }
  else if (u === 'pub') { off = F / 60; vis = F / 60; }
  else if (u === 'sta') { vis = F / 25; off = F / 200; }
  else if (u === 'off') off = F / 22;
  else if (u === 'tower') off = F / 28;
  else { off = F / 45; if (a < 600) res = F / 140; }
  const shops = poi ? poi.shop : 0, food = poi ? poi.food : 0, other = poi ? poi.other : 0;
  vis += shops * 120 + food * 90 + other * 40;
  if (u !== 'res') off += (shops + food) * 4;
  return { off, vis, res, food: food + (u === 'ret' ? Flow / 4000 : 0), u };
}

export function buildPeopleModel({ graph, header, buildingMeta, extraDest = [], calib = null, scenario = {}, light = false }) {
  const t0 = Date.now();
  const nodes = graph.nodes, links = graph.links, N = nodes.length, L = links.length;
  // ---- 隣接 (歩行コスト付き)。code = リンク番号*2 + (a→b なら 1) ----
  const fadj = Array.from({ length: N }, () => []), radj = Array.from({ length: N }, () => []);
  const linkW = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const l = links[i]; if (l.a === l.b) continue; const w = l.length * (VT_W[l.vt] ?? 1) * (scenario.rain && !l.cov ? RAIN.cost : 1); linkW[i] = w;
    fadj[l.a].push(i * 2 + 1, l.b, w); radj[l.b].push(i * 2 + 1, l.a, w);
    if (!l.oneWay) { fadj[l.b].push(i * 2, l.a, w); radj[l.a].push(i * 2, l.b, w); }
  }
  // sources から全ノードへの最短路木。forward: via[v] = v に入る移動 / reverse (adj=radj): via[v] = v から出る移動。par[v] = 根側の隣
  function tree(sources, adj, maxDist = Infinity) {
    const dist = new Float32Array(N).fill(Infinity), via = new Int32Array(N).fill(-1), par = new Int32Array(N).fill(-1), order = [];
    const heap = new Heap(); for (const s of sources) { dist[s] = 0; heap.push(0, s); }
    const done = new Uint8Array(N);
    while (heap.size) {
      const d = heap.minKey, v = heap.pop(); if (done[v]) continue; done[v] = 1; order.push(v); if (d > maxDist) break;
      const a = adj[v];
      for (let i = 0; i < a.length; i += 3) { const to = a[i + 1], nd = d + a[i + 2]; if (nd < dist[to]) { dist[to] = nd; via[to] = a[i]; par[to] = v; heap.push(nd, to); } }
    }
    return { dist, via, par, order };
  }
  const pathOut = (T, v) => { const c = []; while (T.via[v] >= 0) { c.push(T.via[v]); v = T.par[v]; } c.reverse(); return Int32Array.from(c); };
  const pathIn = (T, v) => { const c = []; while (T.via[v] >= 0) { c.push(T.via[v]); v = T.par[v]; } return Int32Array.from(c); };

  // ---- ノードの空間格子 ----
  const CELL = 20, grid = new Map(), gk = (x, y) => Math.floor(x / CELL) * 100003 + Math.floor(y / CELL);
  nodes.forEach((n, i) => { const k = gk(n.x, n.y); let g = grid.get(k); if (!g) grid.set(k, g = []); g.push(i); });
  const nodesInBox = (x0, y0, x1, y1) => { const out = []; for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) { const g = grid.get(cx * 100003 + cy); if (g) for (const i of g) { const n = nodes[i]; if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) out.push(i); } } return out; };
  const nearestNodes = (x, y, r, k) => nodesInBox(x - r, y - r, x + r, y + r).map(i => [Math.hypot(nodes[i].x - x, nodes[i].y - y), i]).filter(e => e[0] <= r).sort((p, q) => p[0] - q[0]).slice(0, k).map(e => e[1]);

  // ---- 駅 (ホームのノードを発着点にする) ----
  const labelOf = Object.fromEntries((header.labels || []).filter(l => l.kind === 'station').map(l => [l.n, l.p]));
  const stations = [];
  for (const sd0 of STATION_DATA) {
    const sd = sd0.assumed && calib?.yokoDaily ? { ...sd0, daily: calib.yokoDaily, src: '人流オープンデータで較正' } : sd0;
    const spaces = (header.stations || []).filter(s => s.st === sd.st && (sd.lvMin === undefined || s.lv >= sd.lvMin) && (sd.lvMax === undefined || s.lv <= sd.lvMax));
    let src = [];
    for (const cat of ['platform', 'gate', 'concourse']) {
      for (const sp of spaces.filter(s => s.cat === cat)) for (let i = 0; i < N; i++) { const n = nodes[i]; if (n.lv === sp.lv && inRing(sp.r, n.x, n.y)) src.push(i); }
      if (src.length) break;
    }
    const lp = labelOf[sd.st]; let cx = lp ? lp[0] : 0, cy = lp ? lp[1] : 0;
    if (spaces.length) { let sx = 0, sy = 0, c = 0; for (const sp of spaces) for (const [x, y] of sp.r) { sx += x / 10; sy += y / 10; c++; } cx = sx / c; cy = sy / c; }
    if (!src.length) src = nearestNodes(cx, cy, 90, 4);
    if (!src.length) continue;
    src = [...new Set(src)];
    stations.push({ ...sd, src, x: cx, y: cy, out: tree(src, fadj), in: tree(src, radj) });
  }

  // ---- 目的地 (建物・公園・追加の建物) ----
  const poiBy = new Map();
  for (const q of header.poi || []) { if (q.b == null || q.b < 0) continue; let e = poiBy.get(q.b); if (!e) poiBy.set(q.b, e = { shop: 0, food: 0, other: 0 }); if (q.c === '飲食') e.food++; else if (q.c === '物販') e.shop++; else e.other++; }
  const dests = [];
  const meshOf = (x, y) => calib?.meshes?.find(q => x >= q.rect[0] && x < q.rect[2] && y >= q.rect[1] && y < q.rect[3]) ?? null;
  const addDest = (d, x0, y0, x1, y1) => {
    let cand = nodesInBox(x0 - 8, y0 - 8, x1 + 8, y1 + 8);
    if (cand.length > 40) { const step = cand.length / 40; cand = Array.from({ length: 40 }, (_, i) => cand[Math.floor(i * step)]); }
    if (!cand.length) cand = nearestNodes(d.x, d.y, 60 + Math.max(x1 - x0, y1 - y0) / 2, 2);
    if (!cand.length) return;
    d.cand = cand; d.home = cand.reduce((b, i) => Math.hypot(nodes[i].x - d.x, nodes[i].y - d.y) < Math.hypot(nodes[b].x - d.x, nodes[b].y - d.y) ? i : b, cand[0]);
    d.idx = dests.length; dests.push(d);
  };
  buildingMeta.forEach((m, i) => {
    if (!m || !m.bb || m.runtime) return; const w = attraction(m, poiBy.get(i)); if (w.off + w.vis + w.res < 1) return;
    const mesh = meshOf(m.c[0] / 10, m.c[1] / 10); w.mesh = mesh ? mesh.id : null;
    if (mesh) { w.off *= mesh.fOff ?? 1; w.vis *= mesh.fVis ?? 1; w.res *= mesh.fRes ?? 1; }
    addDest({ b: i, n: m.n, x: m.c[0] / 10, y: m.c[1] / 10, ...w }, m.bb[0] / 10, m.bb[1] / 10, m.bb[2] / 10, m.bb[3] / 10);
  });
  for (const rings of header.green || []) {   // 公園・緑地 (面積 4000 m2 以上) は来街・回遊の目的地
    const r = rings[0]; if (!r || r.length < 3) continue; const area = ringArea(r); if (area < 4000) continue;
    let sx = 0, sy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of r) { sx += x / 10; sy += y / 10; x0 = Math.min(x0, x / 10); y0 = Math.min(y0, y / 10); x1 = Math.max(x1, x / 10); y1 = Math.max(y1, y / 10); }
    const cx = sx / r.length, cy = sy / r.length;
    const d = { b: -1, n: '公園・緑地', x: cx, y: cy, off: 0, vis: Math.sqrt(area) * 7 * (scenario.rain ? RAIN.park : 1), res: 0, food: 0, u: 'park' };
    const cand = nearestNodes(cx, cy, Math.max(40, Math.sqrt(area) / 2), 6); if (!cand.length) continue;
    d.cand = cand; d.home = cand[0]; d.idx = dests.length; dests.push(d);
  }
  for (const e of extraDest) { if (e.node == null || e.node < 0 || e.node >= N) continue; const d = { b: -2, n: e.n, x: e.x, y: e.y, off: e.off || 0, vis: e.vis || 0, res: e.res || 0, food: e.food || 0, u: 'extra', cand: [e.node], home: e.node, extra: true }; d.idx = dests.length; dests.push(d); }

  // ---- 駅 × 目的 × 方向 の配分 (重力モデル) と、1 トリップあたりのリンク通行量 U ----
  const WKEY = { commute: 'off', visit: 'vis', resident: 'res' };
  const mVisit = scenario.rain ? RAIN.visit : 1, mStroll = scenario.rain ? RAIN.stroll : 1;
  const classes = [];
  const accumulate = (T, nodeP) => {   // nodeP: Float64Array(N) 各ノードが終点 (または起点) になる確率 → U[リンク] と平均距離
    const U = new Float32Array(L), q = nodeP; let md = 0;
    for (let i = 0; i < N; i++) if (q[i] > 0) md += q[i] * T.dist[i];
    for (let k = T.order.length - 1; k >= 0; k--) { const v = T.order[k]; if (q[v] > 0 && T.via[v] >= 0) { U[T.via[v] >> 1] += q[v]; q[T.par[v]] += q[v]; } }
    return { U, md };
  };
  stations.forEach((S, si) => {
    for (const purpose of ['commute', 'visit', 'resident']) for (const dir of ['out', 'in']) {
      // out: 駅 → 建物 (通勤・来街の到着、住民の帰宅) / in: 建物 → 駅
      const T = S[dir], wk = WKEY[purpose], beta = BETA[purpose];
      const ids = [], nds = [], cdf = []; let sum = 0; const nodeP = new Float64Array(N);
      for (const d of dests) {
        const W = d[wk]; if (!(W > 0)) continue;
        let bn = -1, bd = Infinity; for (const c of d.cand) if (T.dist[c] < bd) { bd = T.dist[c]; bn = c; }
        if (bn < 0 || bd > 2600) continue;
        const w = W * Math.exp(-bd / beta); if (w <= 0) continue;
        sum += w; ids.push(d.idx); nds.push(bn); cdf.push(sum);
      }
      if (!ids.length) continue;
      for (let i = 0; i < ids.length; i++) { const pr = (cdf[i] - (i ? cdf[i - 1] : 0)) / sum; nodeP[nds[i]] += pr; const d = dests[ids[i]]; (d.entr ??= new Map()).set(nds[i], (d.entr.get(nds[i]) ?? 0) + pr * S.daily); }
      const share = new Float32Array(dests.length); for (let i = 0; i < ids.length; i++) share[ids[i]] = (cdf[i] - (i ? cdf[i - 1] : 0)) / sum;
      const { U, md } = accumulate(T, nodeP);
      // 人の向き: 通勤・来街は out=到着 / in=帰り。住民は in=出発 (朝) / out=帰宅 (夕)
      const profKey = purpose === 'resident' ? (dir === 'in' ? 'residentOut' : 'residentIn') : purpose + (dir === 'out' ? 'In' : 'Out');
      const cache = new Map();
      classes.push({
        key: `${S.id}:${purpose}:${dir}`, station: si, purpose, dir, group: purpose === 'commute' ? 0 : purpose === 'visit' ? 1 : 2, U, meanDist: md, share,
        rate: (h, day) => S.daily / 2 * day.total * day[purpose] * (purpose === 'visit' ? mVisit : 1) * prof(PROFILE[profKey], h),
        sample: rnd => {
          const r = rnd() * sum; let lo = 0, hi = cdf.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
          const nd = nds[lo]; let p = cache.get(nd); if (!p) cache.set(nd, p = dir === 'out' ? pathOut(T, nd) : pathIn(T, nd)); return p;
        },
      });
    }
  });

  // ---- 昼食 (オフィス → 近くの飲食) と 回遊 (集客施設どうし): 起点ごとの局所最短路木を必要時に作る ----
  const dailyAlight = day => stations.reduce((s, S) => s + S.daily / 2, 0) * day.total;
  const topBy = (key, n) => dests.filter(d => d[key] > 0).sort((p, q) => q[key] - p[key]).slice(0, n);
  const makeLocal = (origins, okey, dkey, beta, euclid, netR) => {
    const ocdf = []; let osum = 0; for (const d of origins) { osum += d[okey]; ocdf.push(osum); }
    const cand = dests.filter(d => d[dkey] > 0), local = new Map();
    const get = oi => {
      let e = local.get(oi); if (e) return e; const o = origins[oi]; const T = tree([o.home], fadj, netR);
      const nds = [], cdf = []; let sum = 0;
      for (const d of cand) {
        if (d === o || Math.hypot(d.x - o.x, d.y - o.y) > euclid) continue;
        let bn = -1, bd = Infinity; for (const c of d.cand) if (T.dist[c] < bd) { bd = T.dist[c]; bn = c; }
        if (bn < 0 || bd > netR || bd < 15) continue; sum += d[dkey] * Math.exp(-bd / beta); nds.push(bn); cdf.push(sum);
      }
      e = { T, nds, cdf, sum, paths: new Map() }; local.set(oi, e); return e;
    };
    const sample = rnd => {
      if (!origins.length) return null;
      const r = rnd() * osum; let lo = 0, hi = ocdf.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (ocdf[mid] < r) lo = mid + 1; else hi = mid; }
      const e = get(lo); if (!e.nds.length) return null;
      const r2 = rnd() * e.sum; let a = 0, b = e.cdf.length - 1; while (a < b) { const mid = (a + b) >> 1; if (e.cdf[mid] < r2) a = mid + 1; else b = mid; }
      const nd = e.nds[a]; let p = e.paths.get(nd); if (!p) e.paths.set(nd, p = pathOut(e.T, nd)); return p;
    };
    return { sample };
  };
  const pathLen = p => { let s = 0; for (let i = 0; i < p.length; i++) s += links[p[i] >> 1].length; return s; };
  const reversePath = p => { const r = new Int32Array(p.length); for (let i = 0; i < p.length; i++) r[i] = p[p.length - 1 - i] ^ 1; return r; };
  let seed = 12345; const lcg = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const monteCarlo = (sampler, n) => { const U = new Float32Array(L); let md = 0, ok = 0; for (let i = 0; i < n; i++) { const p = sampler(lcg); if (!p) continue; ok++; md += pathLen(p); for (let k = 0; k < p.length; k++) U[p[k] >> 1] += 1; } if (ok) { for (let i = 0; i < L; i++) U[i] /= ok; md /= ok; } return { U, md }; };
  const lunch = makeLocal(light ? [] : topBy('off', 260), 'off', 'food', 160, 450, 800), stroll = makeLocal(light ? [] : topBy('vis', 200), 'vis', 'vis', 350, 1000, 1500);
  const lu = monteCarlo(lunch.sample, light ? 0 : 3000), su = monteCarlo(stroll.sample, light ? 0 : 3000);
  classes.push({ key: 'lunch:out', group: 3, U: lu.U, meanDist: lu.md, rate: (h, day) => dailyAlight(day) * day.commute * day.lunch * prof(PROFILE.lunchOut, h), sample: lunch.sample });
  classes.push({ key: 'lunch:back', group: 3, U: lu.U, meanDist: lu.md, rate: (h, day) => dailyAlight(day) * day.commute * day.lunch * prof(PROFILE.lunchBack, h), sample: rnd => { const p = lunch.sample(rnd); return p && reversePath(p); } });
  classes.push({ key: 'stroll', group: 4, U: su.U, meanDist: su.md, rate: (h, day) => dailyAlight(day) * day.visit * day.stroll * mStroll * prof(PROFILE.stroll, h), sample: stroll.sample });

  // ---- イベント: 会場 ⇄ 駅 (駅の選択は 会場からの歩行距離と駅の規模) ----
  let eventInfo = null;
  const ev = scenario.event ? EVENTS[scenario.event] : null;
  if (ev) {
    const venue = dests.filter(d => d.n && ev.match.test(d.n)).sort((p, q) => q.vis - p.vis)[0];
    if (venue) {
      const opts = stations.map((S, si) => { let on = -1, od = Infinity, inn = -1, id = Infinity; for (const c of venue.cand) { if (S.out.dist[c] < od) { od = S.out.dist[c]; on = c; } if (S.in.dist[c] < id) { id = S.in.dist[c]; inn = c; } } return { S, si, on, od, inn, id, w: on < 0 ? 0 : Math.sqrt(S.daily) * Math.exp(-od / 500) }; });
      const wsum = opts.reduce((a, o) => a + o.w, 0);
      eventInfo = { n: ev.n, venue: venue.n, people: ev.people, split: opts.filter(o => o.w / wsum > 0.005).map(o => ({ n: o.S.n, share: o.w / wsum, m: Math.round(o.od) })).sort((p, q) => q.share - p.share) };
      for (const o of opts) {
        const sh = o.w / wsum; if (sh < 0.005) continue;
        for (const dir of ['out', 'in']) {
          const T = o.S[dir], nd = dir === 'out' ? o.on : o.inn, path = dir === 'out' ? pathOut(T, nd) : pathIn(T, nd); if (!path.length) continue;
          const U = new Float32Array(L); for (let k = 0; k < path.length; k++) U[path[k] >> 1] += 1;
          const share = new Float32Array(dests.length); share[venue.idx] = 1;
          classes.push({ key: `event:${o.S.id}:${dir}`, station: o.si, dir, group: 5, U, meanDist: dir === 'out' ? o.od : o.id, share, event: true, rate: h => ev.people * sh * tri(h, dir === 'out' ? ev.arrive : ev.leave), sample: () => path });
        }
      }
    }
  }
  // ---- 集計 ----
  const volumes = (h, day, out = new Float32Array(L)) => { out.fill(0); for (const c of classes) { const r = c.rate(h, day); if (r <= 0) continue; const U = c.U; for (let i = 0; i < L; i++) out[i] += r * U[i]; } return out; };
  const walking = (h, day) => { const g = new Float32Array(GROUPS.length); for (const c of classes) g[c.group] += c.rate(h, day) * c.meanDist / WALK_SPEED / 3600; return g; };
  const stationFlows = (h, day) => stations.map((S, si) => { let toCity = 0, toStation = 0; for (const c of classes) if (c.station === si) { if (c.dir === 'out') toCity += c.rate(h, day); else toStation += c.rate(h, day); } return { n: S.n, toCity, toStation, assumed: !!S.assumed }; });
  // 建物 1 棟に出入りする人数 (人/時): 駅から来る人 + 駅へ向かう人
  const destFlows = (idx, h, day) => { let arrive = 0, leave = 0; for (const c of classes) if (c.share) { const r = c.rate(h, day) * c.share[idx]; if (c.dir === 'out') arrive += r; else leave += r; } return { arrive, leave }; };
  // 建物ごとの滞在人数 (駅から来た人 − 駅へ帰った人 の累積。4 時起点、0.25 時間刻み)。purposes を絞れる
  const presence = (h, day, purposes = null) => {
    const out = new Float64Array(dests.length);
    for (const c of classes) {
      if (!c.share || (purposes && !purposes.includes(c.purpose ?? 'event'))) continue;
      let cum = 0; for (let t = 4; t < h; t += 0.25) cum += c.rate(t + 0.125, day) * 0.25; if (cum <= 0) continue;
      const sg = c.dir === 'out' ? 1 : -1; for (let i = 0; i < out.length; i++) if (c.share[i] > 0) out[i] += sg * cum * c.share[i];
    }
    return out;
  };
  return { stations, dests, classes, volumes, walking, stationFlows, destFlows, presence, eventInfo, linkW, buildMs: Date.now() - t0 };
}
