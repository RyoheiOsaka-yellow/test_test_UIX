// 自動配置：グループごとの散布 → 焼きなまし法 → 重なり解消
import { compBox, boxOverlap, sameSide, padWorld, snap, mulberry32 } from './core.js';

function prep(board) {
  const movable = board.comps.filter(c => !c.fixed);
  const netsOf = new Map();
  for (const c of board.comps) netsOf.set(c, [...board.netsOf(c)].filter(n => n.cls !== 'plane' && n.pins.length > 1 && n.pins.length <= 16));
  const byId = new Map(board.comps.map(c => [c.id, c]));
  return { movable, netsOf, byId };
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
  s += overlapOf(board, c) * kOv;
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
    for (const c of list) {
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
