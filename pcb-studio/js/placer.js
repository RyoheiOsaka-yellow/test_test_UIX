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
  for (const c of mv) if (kind(c.group) === 'core' && c.part.pads.length > 20) d = Math.max(d, Math.max(c.part.w, c.part.h) + 8);
  d = Math.min(d, 28);
  // 相ブロック（スイッチノードでつながる 2 部品＋周辺）を列に並べるのに必要な幅
  const need = new Map();
  for (const n of board.nets.values()) {
    if (n.cls !== 'power' || n.pins.length !== 2) continue;
    const [a, b2] = n.pins.map(p => p.c); if (a.fixed || b2.fixed || a === b2) continue;
    const e = need.get(a.group) || { n: 0, bw: 0, bh: 0 };
    e.n++; e.bw = Math.max(e.bw, a.part.w + b2.part.w + 8); e.bh = Math.max(e.bh, Math.max(a.part.h, b2.part.h, a.part.w, b2.part.w) + 1.5);
    need.set(a.group, e);
  }
  const lattice = g => { const e = need.get(g); if (!e) return 0; const rows = Math.max(1, Math.floor((board.h - 4) / e.bh)); return Math.ceil(e.n / rows) * (e.bw + 2) + 2; };
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
  for (const [g, a] of pw.filter(([g]) => inputG.has(g))) { const r = take(srcSide, Math.max(22, a * 2.4 / H, lattice(g)), true); if (r) out.set(g, r); }
  const rest = pw.filter(([g]) => !inputG.has(g));
  for (const [g, a] of rest) {
    // 最大の VRM は入力側、残りの小さなレールは反対側（ブラケット側）を優先
    const w = Math.max(14, a * 2.1 / H, lattice(g) + a * 0.25 / H), o = srcSide === 'right' ? 'left' : 'right';
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

// ───────── モジュール（剛体ブロック）─────────
// near の親子関係とスイッチノードでつながる部品を 1 ブロックにまとめる（例: DrMOS+インダクタ+コンデンサ、メモリ+デカップリング）
function buildModules(board, P) {
  const mv = P.movable, idx = new Map(mv.map((c, i) => [c, i])), par = mv.map((_, i) => i);
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const uni = (a, b) => { if (idx.has(a) && idx.has(b)) par[find(idx.get(a))] = find(idx.get(b)); };
  for (const c of mv) { const a = c.near && P.byId.get(c.near); if (a) uni(c, a); }
  for (const [c, m] of P.mate) uni(c, m.other);
  const map = new Map();
  mv.forEach((c, i) => { const r = find(i); if (!map.has(r)) map.set(r, []); map.get(r).push(c); });
  return [...map.values()].map(list => {
    const score = c => c.part.pads.length * 1000 + c.part.w * c.part.h;
    const root = list.reduce((a, c) => (score(c) > score(a) ? c : a));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, area = 0;
    for (const c of list) { const B = compBox(c); x0 = Math.min(x0, B.x0); y0 = Math.min(y0, B.y0); x1 = Math.max(x1, B.x1); y1 = Math.max(y1, B.y1); area += (B.x1 - B.x0) * (B.y1 - B.y0); }
    let mem = list.map(c => ({ c, dx: c.x - root.x, dy: c.y - root.y, rot: c.rot }));
    if ((x1 - x0) * (y1 - y0) > 3.5 * area + 40) { // ばらけている場合は横一列に詰め直す
      const R = compBox(root); let cur = (R.x1 - R.x0) / 2, under = 0;
      mem = list.map(c => {
        if (c === root) return { c, dx: 0, dy: 0, rot: c.rot };
        const B = compBox(c), w = B.x1 - B.x0;
        if (c.side !== root.side) return { c, dx: snap((under++ % 3 - 1) * 2), dy: snap(Math.floor(under / 3) * 2), rot: c.rot };
        const dx = snap(cur + w / 2 + 0.5); cur = dx + w / 2; return { c, dx, dy: 0, rot: c.rot };
      });
    }
    return { root, mem, group: root.group };
  });
}
function pose(mod, x, y, k) {
  for (const m of mod.mem) {
    let dx = m.dx, dy = m.dy;
    for (let i = 0; i < k; i++) [dx, dy] = [-dy, dx];
    m.c.x = snap(x + dx); m.c.y = snap(y + dy); m.c.rot = (m.rot + 90 * k) % 360;
  }
  mod.x = snap(x); mod.y = snap(y); mod.k = k;
}
function modBox(mod) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const side = mod.root.side;
  for (const m of mod.mem) { if (m.c.side !== side && !m.c.part.th) continue; const B = compBox(m.c); x0 = Math.min(x0, B.x0); y0 = Math.min(y0, B.y0); x1 = Math.max(x1, B.x1); y1 = Math.max(y1, B.y1); }
  return { x0, y0, x1, y1 };
}

// 配置計画：領域 → 構成的配置（相ブロックの整列、負荷 IC のボール正面への配置、裏面コンデンサの格子）→ 残りは散布
// 基板は変更せず、各部品の目標姿勢を返す。
export function planLayout(board, seed) {
  const rnd = mulberry32(seed), P = prep(board), core = P.core;
  const orig = board.comps.map(c => [c, c.x, c.y, c.rot]);
  const mods = buildModules(board, P), pinned = new Set(), soft = new Set();
  const kind = id => (board.group(id) || {}).kind;
  const info = { blocks: 0, facing: 0, grid: 0 };

  if (core) {
    const cb = compBox(core);
    // 1) 負荷 IC と信号でつながるブロックは、接続先ボール群の正面へ
    const sides = { top: [], bottom: [], left: [], right: [] };
    for (const mod of mods) {
      if (kind(mod.group) !== 'core') continue;
      const pairs = [];
      for (const m of mod.mem) for (const n of P.netsOf.get(m.c)) {
        const cp = n.pins.find(p => p.c === core), mp = n.pins.find(p => p.c === m.c);
        if (cp && mp) pairs.push([mp, padWorld(core, core.part.padMap[cp.p])]);
      }
      if (pairs.length < 3) continue;
      const cx = pairs.reduce((s, q) => s + q[1].x, 0) / pairs.length, cy = pairs.reduce((s, q) => s + q[1].y, 0) / pairs.length;
      const ds = { left: cx - cb.x0, right: cb.x1 - cx, top: cy - cb.y0, bottom: cb.y1 - cy };
      const side = Object.keys(ds).reduce((a, b) => (ds[b] < ds[a] ? b : a));
      let best = null;
      for (let k = 0; k < 4; k++) {
        pose(mod, 0, 0, k);
        const B = modBox(mod);
        let px = 0, py = 0;
        for (const [mp] of pairs) { const q = padWorld(mp.c, mp.c.part.padMap[mp.p]); px += q.x; py += q.y; }
        px /= pairs.length; py /= pairs.length;
        const x = side === 'left' ? cb.x0 - 3 - B.x1 : side === 'right' ? cb.x1 + 3 - B.x0 : cx - px;
        const y = side === 'top' ? cb.y0 - 3 - B.y1 : side === 'bottom' ? cb.y1 + 3 - B.y0 : cy - py;
        let cost = 0;
        for (const [mp, cq] of pairs) { const q = padWorld(mp.c, mp.c.part.padMap[mp.p]); cost += Math.abs(q.x + x - cq.x) + Math.abs(q.y + y - cq.y); }
        const horiz = side === 'top' || side === 'bottom';
        if (!best || cost < best.cost) best = { cost, x, y, k, half: horiz ? (B.x1 - B.x0) / 2 : (B.y1 - B.y0) / 2, off: horiz ? (B.x0 + B.x1) / 2 : (B.y0 + B.y1) / 2 };
      }
      sides[side].push({ mod, ...best });
    }
    for (const [side, list] of Object.entries(sides)) {
      if (!list.length) continue;
      const horiz = side === 'top' || side === 'bottom', al = s => (horiz ? s.x : s.y) + s.off;
      list.sort((a, b) => al(a) - al(b));
      const pos = list.map(al), mean0 = pos.reduce((a, b) => a + b, 0) / pos.length;
      for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + list[i - 1].half + list[i].half + 1);
      const sh = mean0 - pos.reduce((a, b) => a + b, 0) / pos.length;
      list.forEach((s, i) => { const d = pos[i] + sh - al(s); pose(s.mod, s.x + (horiz ? d : 0), s.y + (horiz ? 0 : d), s.k); soft.add(s.mod); info.facing++; });
    }
    // 2) 電源の相ブロックを、負荷側から順に列へ整列
    for (const [g, reg] of P.regions) {
      if (reg.type !== 'rect') continue;
      const blocks = mods.filter(m => m.group === g && m.mem.some(q => P.mate.has(q.c)));
      if (!blocks.length) continue;
      const num = m => parseInt((m.root.ref.match(/\d+/) || [0])[0], 10);
      blocks.sort((a, b) => num(a) - num(b));
      const dir = core.x < (reg.x0 + reg.x1) / 2 ? -1 : 1;     // 負荷のある向き
      let bw = 0, bh = 0;
      for (const mod of blocks) {
        const o = mod.mem.find(q => P.mate.has(q.c) && P.mate.get(q.c).out), i = mod.mem.find(q => P.mate.has(q.c) && !P.mate.get(q.c).out);
        let k = 0, bd = -1e9;
        for (let t = 0; t < 4; t++) { let dx = o.dx - i.dx, dy = o.dy - i.dy; for (let j = 0; j < t; j++) [dx, dy] = [-dy, dx]; if (dx * dir > bd) { bd = dx * dir; k = t; } }
        pose(mod, 0, 0, k); const B = modBox(mod);
        mod._c = [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2];
        bw = Math.max(bw, B.x1 - B.x0); bh = Math.max(bh, B.y1 - B.y0);
      }
      let single = 0;
      for (const c of P.movable) if (c.group === g && c.side === 'T' && !blocks.some(m => m.mem.some(q => q.c === c))) single += (c.part.w + 0.6) * (c.part.h + 0.6);
      const RH = reg.y1 - reg.y0 - 2, reserve = single * 1.9 / RH;
      const maxRows = Math.max(1, Math.floor(RH / (bh + 1))), cols = Math.ceil(blocks.length / maxRows), rows = Math.ceil(blocks.length / cols);
      blocks.forEach((mod, i) => {
        const col = Math.floor(i / rows), row = i % rows;
        const bx = dir < 0 ? reg.x0 + reserve + bw / 2 + 1 + col * (bw + 2) : reg.x1 - reserve - bw / 2 - 1 - col * (bw + 2);
        const by = reg.y0 + 1 + RH * (row + 0.5) / rows;
        pose(mod, bx - mod._c[0], by - mod._c[1], mod.k); pinned.add(mod); info.blocks++;
      });
    }
    // 3) 負荷 IC 裏面のデカップリングは格子に並べる
    const sat = mods.filter(m => m.mem.length === 1 && m.root.side === 'B' && m.root.near === core.id && m.root.part.pads.length === 2);
    if (sat.length) {
      const bw = cb.x1 - cb.x0 - 10, bh = cb.y1 - cb.y0 - 10;
      const cols = Math.max(1, Math.ceil(Math.sqrt(sat.length * bw / bh))), rows = Math.ceil(sat.length / cols);
      sat.forEach((mod, i) => { pose(mod, cb.x0 + 5 + bw * ((i % cols) + 0.5) / cols, cb.y0 + 5 + bh * (Math.floor(i / cols) + 0.5) / rows, 0); pinned.add(mod); info.grid++; });
    }
  }
  // 4) 残りは領域内（なければ配線が望む場所の周り）へ散布
  for (const mod of mods) {
    if (pinned.has(mod) || soft.has(mod)) continue;
    const reg = P.regions.get(mod.group), c = mod.root;
    let x, y;
    if (reg) {
      for (let t = 0; t < 30; t++) {
        x = reg.x0 + 2 + rnd() * (reg.x1 - reg.x0 - 4); y = reg.y0 + 2 + rnd() * (reg.y1 - reg.y0 - 4);
        if (!reg.core || c.side === 'B' || x < reg.core.x0 - 3 || x > reg.core.x1 + 3 || y < reg.core.y0 - 3 || y > reg.core.y1 + 3) break;
      }
    } else {
      let sx = 0, sy = 0, k = 0;
      for (const m of mod.mem) for (const n of P.netsOf.get(m.c)) for (const p of n.pins) if (p.c.fixed || pinned.has(p.c)) { const q = padWorld(p.c, p.c.part.padMap[p.p]); sx += q.x; sy += q.y; k++; }
      let a = c.near && P.byId.get(c.near);
      const bx = k ? sx / k : a ? a.x : board.w / 2, by = k ? sy / k : a ? a.y : board.h / 2;
      const ang = rnd() * 6.2832, rr = Math.sqrt(rnd()) * 14;
      x = Math.min(board.w - 4, Math.max(4, bx + Math.cos(ang) * rr)); y = Math.min(board.h - 4, Math.max(4, by + Math.sin(ang) * rr));
    }
    pose(mod, x, y, 0);
  }
  const targets = new Map(board.comps.filter(c => !c.fixed).map(c => [c, { x: c.x, y: c.y, rot: c.rot }]));
  for (const [c, x, y, rot] of orig) { c.x = x; c.y = y; c.rot = rot; }
  return { mods, pinned, soft, targets, regions: P.regions, info };
}

// 焼きなまし：整列済み以外のブロックを剛体のまま動かす。chunk 手ごとに進捗を yield。
export function* anneal(board, seed, chunk, plan) {
  const rnd = mulberry32(seed + 77), P = prep(board);
  const units = plan.mods.filter(m => !plan.pinned.has(m) && !plan.soft.has(m));
  const total = units.length ? Math.min(40000, Math.max(3000, units.length * 420)) : 0;
  const T0 = 5, T1 = 0.03;
  const cost = (u, kOv) => { let s = 0; for (const m of u.mem) s += localCost(board, P, m.c, kOv); return s; };
  for (let m = 0; m < total; m++) {
    const f = m / total, T = T0 * Math.pow(T1 / T0, f), kOv = 2 + 28 * f;
    const u = units[(rnd() * units.length) | 0];
    const ox = u.x, oy = u.y, ok = u.k, b0 = cost(u, kOv);
    if (rnd() < 0.18) pose(u, ox, oy, (ok + 1 + ((rnd() * 3) | 0)) % 4);
    else { const range = 1.5 + 36 * (1 - f) * (1 - f); pose(u, ox + (rnd() * 2 - 1) * range, oy + (rnd() * 2 - 1) * range, ok); }
    const d = cost(u, kOv) - b0;
    if (!(d <= 0 || rnd() < Math.exp(-d / T))) pose(u, ox, oy, ok);
    if (m % chunk === chunk - 1) yield { move: m + 1, total, T, cost: wireLength(board), overlap: totalOverlap(board) };
  }
  // 仕上げ：残った重なりをブロック単位で押し出す（整列済みの相ブロックと裏面格子は動かさない）
  const movable = plan.mods.filter(m => !plan.pinned.has(m)), owner = new Map();
  for (const mod of plan.mods) for (const q of mod.mem) owner.set(q.c, mod);
  for (let it = 0; it < 160; it++) {
    let moved = 0;
    for (const u of movable) {
      let hit = null;
      for (const q of u.mem) {
        const A = compBox(q.c, 0.2);
        for (const o of board.comps) {
          if (owner.get(o) === u || !sameSide(q.c, o)) continue;
          const B = compBox(o, 0.2);
          if (boxOverlap(A, B)) { hit = [q.c, o, A, B]; break; }
        }
        if (hit) break;
      }
      let dx = 0, dy = 0;
      if (hit) {
        const [c, o, A, B] = hit, ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        const stuck = o.fixed || plan.pinned.has(owner.get(o));
        if (ox < oy) dx = (c.x >= o.x ? 1 : -1) * (ox / (stuck ? 1 : 2) + 0.5); else dy = (c.y >= o.y ? 1 : -1) * (oy / (stuck ? 1 : 2) + 0.5);
      }
      const b = modBox(u);
      if (b.x0 + dx < 0.5) dx = 0.5 - b.x0; if (b.y0 + dy < 0.5) dy = 0.5 - b.y0;
      if (b.x1 + dx > board.w - 0.5) dx = board.w - 0.5 - b.x1; if (b.y1 + dy > board.h - 0.5) dy = board.h - 0.5 - b.y1;
      if (Math.abs(dx) >= 0.25 || Math.abs(dy) >= 0.25) { pose(u, u.x + dx, u.y + dy, u.k); moved++; }
    }
    yield { move: total, total, T: 0, cost: wireLength(board), overlap: totalOverlap(board), legal: it + 1 };
    if (!moved) break;
    if (it % 25 === 24) { // 押し合いで決着しないブロックは、最寄りの空き位置へ移す
      const clash = u => u.mem.some(q => { const A = compBox(q.c, 0.2); return board.comps.some(o => owner.get(o) !== u && sameSide(q.c, o) && boxOverlap(A, compBox(o, 0.2))); });
      const inside = u => { const b = modBox(u); return b.x0 >= 0.5 && b.y0 >= 0.5 && b.x1 <= board.w - 0.5 && b.y1 <= board.h - 0.5; };
      for (const u of movable) {
        if (!clash(u)) continue;
        const ox = u.x, oy = u.y; let done = false;
        for (let r = 1.5; r < 70 && !done; r += 1.5) for (let a = 0; a < 16 && !done; a++) {
          pose(u, ox + Math.cos(a * 0.3927) * r, oy + Math.sin(a * 0.3927) * r, u.k);
          if (inside(u) && !clash(u)) done = true;
        }
        if (!done) pose(u, ox, oy, u.k);
      }
    }
  }
}
