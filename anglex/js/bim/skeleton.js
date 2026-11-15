// 基準線（骨格の線）から架台を組む。1 本の線 = 1 本の部材。線に断面を付け、線どうしが出会う所の端部を自動で決める:
//   ・線の途中に当たる端（T 字）   → 通っている部材の面に突き合わせる（斜めに当たるなら、その面に沿う斜め切り）
//   ・2 本の端どうしが出会う角     → 「突き合わせ」は主になる部材（柱など）を角の外まで伸ばし、もう一方をその面に当てる。「留め」は 2 本とも 2 等分の面で斜め切り
//   ・一直線につながる端、空いた端 → 直角切り
// 座標は mm、Y が上。ここは計算だけで、配置・端部加工の道具（place / flushEnds / outlineWeld）は呼び出し側（families.js）が渡す。
import { parseSpec, sectionBox, sectionOutline } from '../geo/profiles.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r1 = v => Math.round(v * 10) / 10;

// DSL: 1 行（または ; 区切り）に 1 本。「x,y,z > x,y,z [断面] [名前] [r90]」。断面を省くと既定の断面、r90 は断面を軸まわりに 90° 回す
export function parseWire(str) { const out = []; for (const seg of String(str || '').split(/[;\n]+/)) { const s = seg.trim(); if (!s) continue; const m = s.match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:>|→|-->|to)\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(.*)$/i); if (!m) continue; const ln = { a: [+m[1], +m[2], +m[3]], b: [+m[4], +m[5], +m[6]], spec: null, name: null, rot: 0 }; for (const tk of m[7].trim().split(/\s+/).filter(Boolean)) { const r = tk.match(/^r(-?\d+(?:\.\d+)?)$/i); if (r) ln.rot = +r[1]; else if (!ln.spec && parseSpec(tk)) ln.spec = tk; else ln.name = ln.name ? ln.name + ' ' + tk : tk; } out.push(ln); } return out; }
export function wireDSL(lines) { return lines.map(l => `${l.a.map(r1).join(',')} > ${l.b.map(r1).join(',')}${l.spec ? ' ' + l.spec : ''}${l.name ? ' ' + l.name : ''}${l.rot ? ' r' + l.rot : ''}`).join('; '); }

// 寸法から基準線を作る
export function presetPortal({ W = 600, H = 1000 } = {}) { return [{ a: [0, 0, 0], b: [0, H, 0] }, { a: [W, 0, 0], b: [W, H, 0] }, { a: [0, H, 0], b: [W, H, 0] }].map(l => ({ spec: null, name: null, rot: 0, ...l })); }
export function presetBox({ W = 800, D = 600, H = 1000, tiers = 0, brace = false, braceInset = 150 } = {}) { const L = []; const P = (a, b) => L.push({ a, b, spec: null, name: null, rot: 0 }); for (const x of [0, W]) for (const z of [0, D]) P([x, 0, z], [x, H, z]);
  const ring = y => { P([0, y, 0], [W, y, 0]); P([0, y, D], [W, y, D]); P([0, y, 0], [0, y, D]); P([W, y, 0], [W, y, D]); }; ring(H); for (let k = 1; k <= tiers; k++) ring(Math.round(H * k / (tiers + 1)));
  if (brace) { const lo = tiers > 0 ? Math.round(H * tiers / (tiers + 1)) : 0; const bi = Math.min(braceInset, W / 3, (H - lo) / 3); for (const z of [0, D]) P([0, lo + bi, z], [W - bi, H, z]); } return L; }

// 図面の線（DXF の LINE）から基準線を作る。図面の横 → X、縦 → Y（立面図として読む）。端点は tol mm 以内なら同じ点にまとめる
// plane: 'xy' = 立面図（横 → X、縦 → 高さ）/ 'xz' = 平面図（横 → X、縦 → 奥行。高さは depth）/ 'zy' = 側面図（横 → 奥行、縦 → 高さ）
export function linesFromEntities(entities, { layer = null, scale = 1, minLen = 50, tol = 2, depth = 0, plane = 'xy' } = {}) { const to3 = (u, v) => plane === 'xz' ? [u, depth, v] : plane === 'zy' ? [depth, v, u] : [u, v, depth]; const src = (entities || []).filter(e => e.type === 'LINE' && (!layer || e.layer === layer)).map(e => ({ a: [e.a[0] * scale, e.a[1] * scale], b: [e.b[0] * scale, e.b[1] * scale] })).filter(e => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) >= minLen);
  if (!src.length) return { lines: [], skipped: 0, dup: 0 }; const nodes = []; const snap = p => { for (const n of nodes) if (Math.hypot(n[0] - p[0], n[1] - p[1]) <= tol) return n; const n = [p[0], p[1]]; nodes.push(n); return n; }; const seen = new Set(); const lines = []; let dup = 0;
  for (const e of src) { const a = snap(e.a), b = snap(e.b); if (a === b) continue; const key = [nodes.indexOf(a), nodes.indexOf(b)].sort((p, q) => p - q).join('-'); if (seen.has(key)) { dup++; continue; } seen.add(key); lines.push({ a, b }); }
  const x0 = Math.min(...nodes.map(n => n[0])), y0 = Math.min(...nodes.map(n => n[1])); return { lines: lines.map(l => ({ a: to3(r1(l.a[0] - x0), r1(l.a[1] - y0)), b: to3(r1(l.b[0] - x0), r1(l.b[1] - y0)), spec: null, name: null, rot: 0 })), skipped: (entities || []).filter(e => e.type === 'LINE' && (!layer || e.layer === layer)).length - src.length, dup }; }

// 基準線 → 部材。戻り値: { parts: [...部材・板・溶接・アンカー], info: [{ name, spec, length, start, end }], warnings: [...], plates }
//   orient: 'auto' なら、山形鋼の向きを自動で決める（柱はかどを架台の外側の角に、梁は 1 枚の脚を上面にして、もう 1 枚を外側の面で下へ）。線に r90 などを書いた部材はその指定を優先
//   base:   { on, size, t, holeD, anchors } 床に立つ柱（いちばん低い高さで、端が空いている鉛直の部材）の下にベースプレートを置き、柱を板厚ぶん短くして溶接する
export function solveFrame(lines, { spec = 'L-50x50x6', align = 'center', joint = 'butt', weldSize = 6, finish = 'HDZ', material = 'SS400', orient = 'auto', base = null } = {}, { place, flushEnds, outlineWeld }) {
  const TOL = 1; const UP = [0, 1, 0]; const warnings = []; const M = []; const sgn = v => Math.abs(v) < TOL ? 0 : Math.sign(v);
  const pts = lines.flatMap(l => [l.a, l.b]); const C = pts.length ? mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length) : [0, 0, 0]; const minY = pts.length ? Math.min(...pts.map(p => p[1])) : 0;
  const pick = (d, P, Q) => { for (const [x, want] of [[P, Q], [Q, P]]) { const y = cross(d, x); if (dot(y, want) > 0.5) return [x, y]; } return null; };
  lines.forEach((ln, idx) => { const sp = parseSpec(ln.spec || spec); const v = sub(ln.b, ln.a); const L = len(v); if (!sp || L < 1) { warnings.push(`${idx + 1} 本目は読めませんでした（${!sp ? '断面' : '長さ'}）`); return; } const d = norm(v); const vertical = Math.abs(d[1]) > 0.99, horizontal = Math.abs(d[1]) < 0.05;
    let x = vertical ? [1, 0, 0] : norm(cross(UP, d)); let y = cross(d, x); let auto = false;
    if (orient === 'auto' && !ln.rot && sp.kind === 'L') { let r = null; if (vertical) { const ix = -sgn(ln.a[0] - C[0]), iz = -sgn(ln.a[2] - C[2]); if (ix && iz) r = pick(d, [ix, 0, 0], [0, 0, iz]); } else if (horizontal) { const side = norm(cross(UP, d)); const mid = mul(add(ln.a, ln.b), 0.5); const s = sgn(dot(side, sub(C, mid))); if (s) r = pick(d, mul(side, s), [0, -1, 0]); } if (r) { [x, y] = r; auto = true; } }
    if (ln.rot) { const t = ln.rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const x2 = add(mul(x, c), mul(y, s)); y = add(mul(y, c), mul(x, -s)); x = x2; }
    const bx = sectionBox(sp); const off = align === 'origin' ? [0, 0] : [-(bx.x0 + bx.x1) / 2, -(bx.y0 + bx.y1) / 2]; const W = ([cx, cy]) => add(mul(x, cx + off[0]), mul(y, cy + off[1])); const corners = [[bx.x0, bx.y0], [bx.x1, bx.y0], [bx.x1, bx.y1], [bx.x0, bx.y1]].map(W);
    M.push({ idx, ln, sp, spec: ln.spec || spec, d, L, x, y, vertical, horizontal, auto, corners, poly: sectionOutline(sp).map(W), pos: add(ln.a, add(mul(x, off[0]), mul(y, off[1]))), kind: vertical ? '柱' : horizontal ? '梁' : '斜材' }); });
  const count = {}; for (const m of M) { count[m.kind] = (count[m.kind] || 0) + 1; m.name = m.ln.name || `${m.kind}${count[m.kind]}`; }
  const support = (m, n) => Math.max(...m.corners.map(o => dot(o, n))); // 断面の外形の箱が、線から n の向きにどれだけ張り出すか
  // 当たる部材 m の幅の範囲で、相手 o の断面（実際の輪郭）が n の向きにどこまであるか。山形鋼の脚が無い側では、外形の箱ではなく実際の面まで寄せる
  const supportBand = (o, n, m) => { const lat = cross(o.d, n); const ws = m.corners.map(c => dot(c, lat)); const w0 = Math.min(...ws) - 0.01, w1 = Math.max(...ws) + 0.01; let best = -Infinity; const P = o.poly.map(q => [dot(q, lat), dot(q, n)]);
    for (let i = 0; i < P.length; i++) { let [a0, a1] = P[i], [b0, b1] = P[(i + 1) % P.length]; if (a0 > b0) { [a0, a1, b0, b1] = [b0, b1, a0, a1]; } if (b0 < w0 || a0 > w1) continue; const at = w => Math.abs(b0 - a0) < 1e-9 ? Math.max(a1, b1) : a1 + (b1 - a1) * (w - a0) / (b0 - a0); best = Math.max(best, at(Math.max(a0, w0)), at(Math.min(b0, w1)), Math.abs(b0 - a0) < 1e-9 ? Math.max(a1, b1) : -Infinity); }
    return isFinite(best) ? best : support(o, n); };
  const distToSeg = (P, m) => { const t = dot(sub(P, m.ln.a), m.d); const q = add(m.ln.a, mul(m.d, Math.max(0, Math.min(m.L, t)))); return { dist: len(sub(P, q)), t }; };
  // 端ごとの処理を決める
  const treat = (m, isStart) => { const P = isStart ? m.ln.a : m.ln.b; const u = isStart ? m.d : mul(m.d, -1); /* 節点から部材の中へ向かう向き */ const through = [], ends = [];
    for (const o of M) { if (o === m) continue; const { dist, t } = distToSeg(P, o); if (dist > TOL) continue; if (t > TOL && t < o.L - TOL) through.push(o); else ends.push({ o, u: t <= TOL ? o.d : mul(o.d, -1) }); }
    const buttTo = o => { const n0 = sub(u, mul(o.d, dot(u, o.d))); if (len(n0) < 0.2) return null; const n = norm(n0); return { plane: { p: add(P, mul(n, supportBand(o, n, m))), n }, kind: 'butt', to: o.name }; };
    for (const o of through) { const r = buttTo(o); if (r) return r; }
    const others = ends.filter(e => Math.abs(dot(u, e.u)) < 0.999);
    if (!others.length) { if (base?.on && !ends.length && m.vertical && u[1] > 0.99 && P[1] <= minY + TOL) return { plane: { p: add(P, [0, base.t, 0]), n: u }, kind: 'base', to: 'ベースPL', foot: P }; return { plane: null, kind: ends.length ? 'splice' : 'free', to: ends[0]?.o.name || null }; }
    if (joint === 'miter' && others.length === 1 && ends.length === 1) { const n0 = sub(u, others[0].u); return { plane: { p: P, n: norm(n0) }, kind: 'miter', to: others[0].o.name, weld: m.idx < others[0].o.idx }; }
    const all = [m, ...others.map(e => e.o)].sort((p, q) => (q.vertical - p.vertical) || (p.idx - q.idx)); const master = all[0];
    if (master === m) { const ext = Math.max(...others.map(e => support(e.o, mul(u, -1)))); return { plane: { p: add(P, mul(u, -ext)), n: u }, kind: 'through', to: others.map(e => e.o.name).join('・') }; }
    return buttTo(master) || { plane: null, kind: 'free', to: null }; };
  const parts = [], info = [], welds = [], extra = []; let plates = 0;
  for (const m of M) { const part = { kind: 'member', name: m.name, spec: m.spec, length: m.L, holes: [], finish, material, pl: place(m.pos, m.d, m.x), group: '本体', role: m.vertical ? 'column' : m.horizontal ? 'beam' : 'brace' }; const s = treat(m, true), e = treat(m, false);
    flushEnds(part, s.plane, e.plane); if (!(part.length > 1)) { warnings.push(`${m.name} は端部の処理後の長さが 0 になりました`); continue; } parts.push(part);
    for (const [end, t] of [['start', s], ['end', e]]) { if (t.kind === 'butt' || t.kind === 'base' || (t.kind === 'miter' && t.weld)) welds.push(...outlineWeld(part, end, weldSize, { group: `${m.name} → ${t.to}`, skipShort: 5 }));
      if (t.kind === 'base') { const S = base.size, f = t.foot; const x0 = f[0] - S / 2, z0 = f[2] - S / 2; const e2 = Math.max(18, Math.min(30, S * 0.18)); const hs = (S >= 120 ? [[e2, e2], [S - e2, e2], [e2, S - e2], [S - e2, S - e2]] : [[e2, e2], [S - e2, S - e2]]).map(([hx, hz]) => ({ face: 'face', z: hz, s: hx, d: base.holeD, kind: 'anchor' }));
        extra.push({ kind: 'plate', name: `ベースPL（${m.name}）`, spec: `PL-${base.t}x${S}x${S}`, length: S, holes: hs, finish, material, pl: place([x0, f[1], z0], [0, 0, 1], [1, 0, 0]), group: 'ベース', role: 'base' }); plates++;
        if (base.anchors) for (const h of hs) extra.push({ kind: 'anchor', name: `アンカー M${Math.max(8, Math.round(base.holeD - 2))}`, M: `M${Math.max(8, Math.round(base.holeD - 2))}`, plateT: base.t, pl: place([x0 + h.s, f[1], z0 + h.z], [0, 1, 0], [1, 0, 0]), group: 'アンカー', site: true }); } }
    info.push({ name: m.name, spec: m.spec, wire: r1(m.L), length: part.length, start: s.kind, startTo: s.to, end: e.kind, endTo: e.to, cuts: !!part.cuts, auto: m.auto }); }
  // 線の途中どうしが交わる（十字）: どちらも切らないので、重なったままになる
  for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) { const a = M[i], b = M[j]; const w = sub(a.ln.a, b.ln.a); const A = dot(a.d, a.d), B = dot(a.d, b.d), C2 = dot(b.d, b.d), D = dot(a.d, w), E = dot(b.d, w); const den = A * C2 - B * B; if (Math.abs(den) < 1e-6) continue; const s = (B * E - C2 * D) / den, t = (A * E - B * D) / den; if (s > TOL && s < a.L - TOL && t > TOL && t < b.L - TOL && len(sub(add(a.ln.a, mul(a.d, s)), add(b.ln.a, mul(b.d, t)))) < TOL) warnings.push(`${a.name} と ${b.name} が途中で交わっています（どちらかの線を交点で分けてください）`); }
  return { parts: [...parts, ...extra, ...welds], info, warnings, plates }; }
