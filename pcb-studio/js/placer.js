// 自動配置：グループごとの散布 → 焼きなまし法 → 重なり解消
import { compBox, boxOverlap, sameSide, padWorld, snap, mulberry32 } from './core.js';

function prep(board) {
  const movable = board.comps.filter(c => !c.fixed);
  const netsOf = new Map();
  for (const c of board.comps) netsOf.set(c, [...board.netsOf(c)].filter(n => n.cls !== 'plane' && n.pins.length > 1 && n.pins.length <= 16));
  const byId = new Map(board.comps.map(c => [c.id, c]));
  const regions = planRegions(board), core = coreOf(board);
  // 電源の流れ：スイッチノード(2ピンの power ネット)では、出力側(2端子部品=インダクタ)を負荷に近い側へ
  const mate = new Map();
  if (core) for (const n of board.nets.values()) {
    if (n.cls !== 'power' || n.pins.length !== 2) continue;
    const [a, b] = n.pins.map(p => p.c);
    const out = a.part.pads.length === 2 ? a : b.part.pads.length === 2 ? b : null;
    if (!out || a === b) continue;
    const inn = out === a ? b : a;
    mate.set(out, { other: inn, out: true }); mate.set(inn, { other: out, out: false });
  }
  return { movable, netsOf, byId, regions, core, mate };
}
export function coreOf(board) {
  let best = null;
  for (const c of board.comps) if (c.fixed && c.part.pads.length > 200 && (!best || c.part.pads.length > best.part.pads.length)) best = c;
  return best;
}
// グループごとの配置領域。core 系は負荷 IC を囲むリング、power 系は「12V 入力 → VRM → 負荷」の順に並ぶ帯。
export function planRegions(board) {
  const out = new Map(), core = coreOf(board);
  if (!core) return out;
  const area = new Map(), mv = board.comps.filter(c => !c.fixed);
  for (const c of mv) if (c.side === 'T') area.set(c.group, (area.get(c.group) || 0) + (c.part.w + 0.6) * (c.part.h + 0.6));
  const kind = id => (board.group(id) || {}).kind;
  const cb = compBox(core), per = 2 * (cb.x1 - cb.x0 + cb.y1 - cb.y0);
  let d = 12;
  for (const [g, a] of area) if (kind(g) === 'core') d = Math.max(d, a * 1.35 / per + 4);
  d = Math.min(d, 26);
  const ring = { type: 'ring', x0: Math.max(1, cb.x0 - d), y0: Math.max(1, cb.y0 - d), x1: Math.min(board.w - 1, cb.x1 + d), y1: Math.min(board.h - 1, cb.y1 + d), core: cb };
  for (const [g] of area) if (kind(g) === 'core') out.set(g, ring);
  // 空き区間（基板の長手方向）
  let L0 = 1;
  for (const c of board.comps) if (c.fixed && c !== core) { const B = compBox(c); if (B.x1 < ring.x0 && B.y1 - B.y0 > 6 && B.x0 < 8) L0 = Math.max(L0, B.x1 + 1.5); }
  const free = { left: [L0, ring.x0 - 0.5], right: [ring.x1 + 0.5, board.w - 1] };
  const H = board.h - 2;
  const pw = [...area].filter(([g]) => kind(g) === 'power').sort((a, b) => b[1] - a[1]);
  // 電源入力グループ = 固定の電源コネクタを基準にしている部品を含むグループ
  const entry = board.comps.filter(c => c.fixed && /^pwrconn/.test(c.part.family));
  const ex = entry.length ? entry.reduce((s2, c) => s2 + c.x, 0) / entry.length : board.w;
  const srcSide = ex >= core.x ? 'right' : 'left';
  const inputG = new Set();
  for (const c of mv) { const a = c.near && board.comp(c.near); if (a && entry.includes(a)) inputG.add(c.group); }
  const take = (side, w, far) => {
    const f = free[side], avail = f[1] - f[0];
    w = Math.min(w, Math.max(0, avail)); if (w < 6) return null;
    const nearRing = side === 'left' ? !far : far;      // true なら区間の右端から取る
    let r;
    if (nearRing) { r = [f[1] - w, f[1]]; f[1] -= w; } else { r = [f[0], f[0] + w]; f[0] += w; }
    return { type: 'rect', x0: r[0], y0: 1, x1: r[1], y1: board.h - 1 };
  };
  for (const [g, a] of pw.filter(([g]) => inputG.has(g))) { const r = take(srcSide, Math.max(22, a * 2.4 / H), true); if (r) out.set(g, r); }
  const rest = pw.filter(([g]) => !inputG.has(g));
  for (const [g, a] of rest) {
    // 最大の VRM は入力側、残りの小さなレールは反対側（ブラケット側）を優先
    const w = Math.max(14, a * 2.1 / H), o = srcSide === 'right' ? 'left' : 'right';
    const first = g === rest[0][0] ? srcSide : o, second = first === srcSide ? o : srcSide;
    const fits = sd => free[sd][1] - free[sd][0] >= w;
    const r = take(fits(first) ? first : fits(second) ? second : (free[first][1] - free[first][0] > free[second][1] - free[second][0] ? first : second), w, false);
    if (r) out.set(g, r);
  }
  return out;
}
function regionPenalty(P, c) {
  const r = P.regions.get(c.group); if (!r) return 0;
  const B = compBox(c);
  return Math.max(0, r.x0 - B.x0) + Math.max(0, B.x1 - r.x1) + Math.max(0, r.y0 - B.y0) + Math.max(0, B.y1 - r.y1);
}
function hpwl(n) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of n.pins) { const q = padWorld(p.c, p.c.part.padMap[p.p]); if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
  return (x1 - x0) + (y1 - y0);
}
function overlapOf(board, c) {
  const A = compBox(c, 0.25); let s = 0;
  for (const o of board.comps) { if (o === c || !sameSide(c, o)) continue; s += boxOverlap(A, compBox(o, 0.25)); }
  return s;
}
function localCost(board, P, c, kOv) {
  let s = 0;
  for (const n of P.netsOf.get(c)) s += hpwl(n);
  if (c.near) { const a = P.byId.get(c.near); if (a) { const d = Math.hypot(c.x - a.x, c.y - a.y) - c.nearR; if (d > 0) s += d * 2.5; } }
  s += overlapOf(board, c) * kOv + regionPenalty(P, c) * 8;
  const m = P.mate.get(c);
  if (m) {
    const k = P.core, dc = Math.hypot(c.x - k.x, c.y - k.y), dm = Math.hypot(m.other.x - k.x, m.other.y - k.y);
    s += Math.max(0, (m.out ? dc - dm : dm - dc) + 3) * 2;
  }
  const b = compBox(c, 1);
  const out = Math.max(0, -b.x0) + Math.max(0, -b.y0) + Math.max(0, b.x1 - board.w) + Math.max(0, b.y1 - board.h);
  return s + out * 60;
}
export function wireLength(board) {
  let s = 0;
  for (const n of board.nets.values()) if (n.cls !== 'plane' && n.pins.length > 1) s += hpwl(n);
  return s;
}
export function totalOverlap(board) {
  let s = 0; const cs = board.comps;
  for (let i = 0; i < cs.length; i++) { const A = compBox(cs[i]); for (let j = i + 1; j < cs.length; j++) if (sameSide(cs[i], cs[j])) s += boxOverlap(A, compBox(cs[j])); }
  return s;
}
export function overlapPairs(board) {
  let n = 0; const cs = board.comps;
  for (let i = 0; i < cs.length; i++) { const A = compBox(cs[i], -0.05); for (let j = i + 1; j < cs.length; j++) if (sameSide(cs[i], cs[j]) && boxOverlap(A, compBox(cs[j], -0.05)) > 0) n++; }
  return n;
}

// 各グループの部品を「配線が望む場所」の周りにばらまく。戻り値は目標座標。
export function scatterTargets(board, seed) {
  const rnd = mulberry32(seed), P = prep(board), out = new Map();
  const want = new Map();
  for (const c of P.movable) {
    let sx = 0, sy = 0, k = 0;
    for (const n of P.netsOf.get(c)) for (const p of n.pins) if (p.c.fixed) { const q = padWorld(p.c, p.c.part.padMap[p.p]); sx += q.x; sy += q.y; k++; }
    let a = c.near && P.byId.get(c.near);
    while (a && !a.fixed && a.near) a = P.byId.get(a.near);
    if (k) want.set(c, { x: sx / k, y: sy / k });
    else if (a && a.fixed) want.set(c, { x: a.x, y: a.y });
  }
  const groups = new Map();
  for (const c of P.movable) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); }
  for (const [, list] of groups) {
    let sx = 0, sy = 0, k = 0, area = 0;
    for (const c of list) { const w = want.get(c); if (w) { sx += w.x; sy += w.y; k++; } area += c.part.w * c.part.h; }
    const cx = k ? sx / k : board.w / 2, cy = k ? sy / k : board.h / 2, R = Math.sqrt(area) * 0.9 + 6;
    const reg = P.regions.get(list[0].group);
    for (const c of list) {
      if (reg) {
        let x = 0, y = 0;
        for (let t = 0; t < 30; t++) {
          x = reg.x0 + rnd() * (reg.x1 - reg.x0); y = reg.y0 + rnd() * (reg.y1 - reg.y0);
          if (!reg.core || c.side === 'B' || x < reg.core.x0 - 3 || x > reg.core.x1 + 3 || y < reg.core.y0 - 3 || y > reg.core.y1 + 3) break;
        }
        if (reg.core && c.side === 'B') { x = reg.core.x0 + rnd() * (reg.core.x1 - reg.core.x0); y = reg.core.y0 + rnd() * (reg.core.y1 - reg.core.y0); }
        out.set(c, { x: snap(x), y: snap(y) }); continue;
      }
      const w = want.get(c), bx = w ? (w.x + cx) / 2 : cx, by = w ? (w.y + cy) / 2 : cy;
      const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
      out.set(c, {
        x: snap(Math.min(board.w - 4, Math.max(4, bx + Math.cos(ang) * rr))),
        y: snap(Math.min(board.h - 4, Math.max(4, by + Math.sin(ang) * rr))),
      });
    }
  }
  return out;
}

// 焼きなまし。chunk 手ごとに進捗を yield する。
export function* anneal(board, seed, chunk = 400) {
  const rnd = mulberry32(seed + 77), P = prep(board), mv = P.movable;
  if (!mv.length) return;
  const total = Math.min(60000, Math.max(8000, mv.length * 110));
  const T0 = 6, T1 = 0.03;
  let cost = 0;
  for (const n of board.nets.values()) if (n.cls !== 'plane' && n.pins.length > 1) cost += hpwl(n);
  for (let m = 0; m < total; m++) {
    const f = m / total, T = T0 * Math.pow(T1 / T0, f), kOv = 2 + 28 * f;
    const c = mv[(rnd() * mv.length) | 0];
    const old = { x: c.x, y: c.y, rot: c.rot };
    const r = rnd();
    let other = null, oo = null;
    const before = () => localCost(board, P, c, kOv) + (other ? localCost(board, P, other, kOv) : 0);
    if (r < 0.12) {
      other = mv[(rnd() * mv.length) | 0];
      if (other === c || other.part !== c.part || other.side !== c.side) other = null;
    }
    const b0 = before();
    if (other) { oo = { x: other.x, y: other.y, rot: other.rot }; c.x = oo.x; c.y = oo.y; c.rot = oo.rot; other.x = old.x; other.y = old.y; other.rot = old.rot; }
    else if (r < 0.24) c.rot = (c.rot + 90 * (1 + ((rnd() * 3) | 0))) % 360;
    else {
      const range = 1.5 + 40 * (1 - f) * (1 - f);
      c.x = snap(c.x + (rnd() * 2 - 1) * range); c.y = snap(c.y + (rnd() * 2 - 1) * range);
    }
    const d = before() - b0;
    if (d <= 0 || rnd() < Math.exp(-d / T)) cost += d;
    else { c.x = old.x; c.y = old.y; c.rot = old.rot; if (other) { other.x = oo.x; other.y = oo.y; other.rot = oo.rot; } }
    if (m % chunk === chunk - 1) yield { move: m + 1, total, T, cost: wireLength(board), overlap: totalOverlap(board) };
  }
  // 仕上げ：残った重なりを押し出して解消
  for (let it = 0; it < 160; it++) {
    let moved = 0;
    for (const c of mv) {
      const A = compBox(c, 0.2);
      for (const o of board.comps) {
        if (o === c || !sameSide(c, o)) continue;
        const B = compBox(o, 0.2);
        if (!boxOverlap(A, B)) continue;
        const dx = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), dy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (dx < dy) c.x = snap(c.x + (c.x >= o.x ? 1 : -1) * (dx / (o.fixed ? 1 : 2) + 0.5));
        else c.y = snap(c.y + (c.y >= o.y ? 1 : -1) * (dy / (o.fixed ? 1 : 2) + 0.5));
        const b = compBox(c, 0.5);
        if (b.x0 < 0) c.x = snap(c.x - b.x0 + 0.5); if (b.y0 < 0) c.y = snap(c.y - b.y0 + 0.5);
        if (b.x1 > board.w) c.x = snap(c.x - (b.x1 - board.w) - 0.5); if (b.y1 > board.h) c.y = snap(c.y - (b.y1 - board.h) - 0.5);
        moved++; break;
      }
    }
    yield { move: total, total, T: 0, cost: wireLength(board), overlap: totalOverlap(board), legal: it + 1 };
    if (!moved) break;
  }
}
