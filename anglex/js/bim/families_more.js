// 追加ファミリ（配管支持金具の総合カタログの 1〜25 章から）。families.js の末尾で registerMore() を呼んで登録する。
// 形は「帯（strap）・回転体（lathe）・曲げ棒（sweep）・台形ブロック（frustum）・箱・円筒・輪」と、ボルト類の組み合わせで作る。
// 注意: 寸法の数値は寸法表から取ったが、寸法図は確認できていない。記号（C・P・H など）の意味と細部の形は推定を含む（docs/OPEN_ITEMS.md）。
import { boltDims } from '../geo/fasteners.js';

const STEEL = 7.85e-6;
const RHO = { ALUMI: 2.7e-6, RESIN: 0.92e-6, RESIN_GRAY: 0.92e-6, RUBBER: 1.3e-6, URETHANE: 0.2e-6, CONCRETE: 2.3e-6 };
const rho = f => RHO[f] ?? STEEL;
export const arc = (cx, cy, r, a0, a1, n = 0) => { const k = n || Math.max(6, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 20))); const o = []; for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
const plen = (pts, closed = false) => { let s = 0; for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (closed) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return s; };
const boltOf = s => { const m = String(s || '').match(/M\s*(\d+)\s*[x×]\s*(\d+)/i); return m ? { M: 'M' + m[1], L: +m[2] } : { M: 'M6', L: 20 }; };
const thr = d => { const s = String(d || 'W3/8'); return /^[MW]/.test(s) ? s : 'W' + s; };
const BOLT_OPTS = [['M6x20', 'M6×20'], ['M6x25', 'M6×25'], ['M6x30', 'M6×30'], ['M6x35', 'M6×35'], ['M8x20', 'M8×20'], ['M8x25', 'M8×25'], ['M8x30', 'M8×30'], ['M10x30', 'M10×30'], ['M10x35', 'M10×35'], ['M12x40', 'M12×40'], ['M12x45', 'M12×45']];
const ROD_OPTS = [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M10', 'M10'], ['M12', 'M12']];

export function registerMore({ reg, place, DIR, P, num, int, sel, bool }) {
  const XY = (pos = [0, 0, 0]) => place(pos, DIR.Z, DIR.X);        // ローカル XY = 立面（管軸は Z）
  const UP = (pos = [0, 0, 0]) => place(pos, DIR.Y, DIR.X);        // ローカル Z = 上（管軸は Y、または部品が立つ）
  const strap = (name, pts, t, B, finish, pl, x = {}) => { const L = plen(pts, x.closed); return { kind: 'custom', custom: 'strap', name, pts, t, B, mass: L * t * B * rho(finish), areaM2: 2 * L * B / 1e6, finish, pl, group: '本体', nonSteel: RHO[finish] != null || undefined, ...x }; };
  const box = (name, w, d, hgt, finish, pl, x = {}) => ({ kind: 'custom', custom: 'box', name, w, d, h: hgt, finish, mass: w * d * hgt * rho(finish), areaM2: 2 * (w * d + w * hgt + d * hgt) / 1e6, pl, group: '本体', nonSteel: RHO[finish] != null || undefined, ...x });
  const cyl = (name, r, L, finish, pl, x = {}) => ({ kind: 'custom', custom: 'cylinder', name, r, L, finish, mass: Math.PI * r * r * L * rho(finish === 'THREAD' ? 'EZ' : finish), areaM2: 2 * Math.PI * r * L / 1e6, pl, group: '本体', nonSteel: RHO[finish] != null || undefined, ...x });
  const tube = (name, ro, ri, L, finish, pl, x = {}) => ({ kind: 'custom', custom: 'ring', name, ro, ri, t: L, finish, mass: Math.PI * (ro * ro - ri * ri) * L * rho(finish), areaM2: 2 * Math.PI * (ro + ri) * L / 1e6, pl, group: '本体', nonSteel: RHO[finish] != null || undefined, ...x });
  const lathe = (name, profile, finish, pl, mass, x = {}) => ({ kind: 'custom', custom: 'lathe', name, profile, finish, mass, areaM2: 0, pl, group: '本体', nonSteel: RHO[finish] != null || undefined, ...x });
  const pipeRef = (od, L = 300, pl = null) => ({ kind: 'pipe', name: `配管 φ${od}`, spec: `PIPE-${od}x${Math.max(2, Math.round(od * 0.06 * 10) / 10)}`, length: L, finish: 'PIPE', ref: true, pl: pl || place([0, 0, -L / 2], DIR.Z, DIR.X), group: '配管' });
  const bolt = (spec, pl, x = {}) => { const b = boltOf(spec); return { kind: 'bolt', name: `締付ボルト ${b.M}×${b.L}`, M: b.M, L: b.L, pl, group: '締付', ...x }; };
  const nut = (M, pl, x = {}) => ({ kind: 'nut', name: `ナット ${M}`, M, pl, group: '吊り', ...x });
  const rod = (M, L, pl, x = {}) => ({ kind: 'rod', name: `吊ボルト ${M}`, M, L, pl, group: '吊り', site: true, ...x });
  const od = (def = 60.5) => num('od', '適合配管径（外径）', def);
  const tB = (t = 2, B = 25) => [num('t', '帯厚 t', t), num('B', '帯幅 B', B)];
  const rubberRing = (r, th, B) => tube('防振ゴム', r, r - th, B * 0.9, 'RUBBER', XY([0, 0, -B * 0.45]), { group: 'ゴム' });
  // 輪（耳つき）: 耳は +Y へ長さ e、すき間 gap。中心は原点
  const ringEars = (r, t, e, gap = 3) => { const R = r + t / 2; const x0 = gap / 2 + t / 2; const a = Math.asin(Math.min(0.9, x0 / R)); const y0 = R * Math.cos(a); return [[x0, y0 + e], ...arc(0, 0, R, Math.PI / 2 - a, -1.5 * Math.PI + a), [-x0, y0 + e]]; };
  // 2 つ割りの半分（右側）: 上下に耳
  const halfEars = (r, t, eTop, eBot, gap = 3, side = 1) => { const R = r + t / 2; const x0 = gap / 2 + t / 2; const a = Math.asin(Math.min(0.9, x0 / R)); const y0 = R * Math.cos(a); const p = [[x0, y0 + eTop], ...arc(0, 0, R, Math.PI / 2 - a, -Math.PI / 2 + a), [x0, -y0 - eBot]]; return side > 0 ? p : p.map(([x, y]) => [-x, y]); };
  const earBolt = (spec, t, gap, y) => { const b = boltOf(spec); const bd = boltDims(b.M); return bolt(spec, place([-(gap / 2 + t), y, 0], DIR.X, DIR.Y), { L: Math.max(b.L, Math.ceil(gap + 2 * t + bd.m + 4)) }); };

  // ---- 立バンド（蝶番式・組式）: 3 章 ----
  const riserParts = (p, finish, name) => { const r = p.od / 2 + (p.rubber || 0); const e = Math.max(14, (p.H || r + 40) - r - p.t); const gap = 3; const yb = r + p.t + Math.max(8, Math.min(e - 8, e - (p.P || 20) + 4)); const parts = [];
    if (p.style === 'split') { parts.push(strap(`${name} ${p.od}φ（半割）`, halfEars(r, p.t, e, 14, gap, 1), p.t, p.B, finish, XY()), strap(`${name} ${p.od}φ（半割）`, halfEars(r, p.t, e, 14, gap, -1), p.t, p.B, finish, XY()), earBolt(p.bolt, p.t, gap, -(r + p.t + 7))); }
    else parts.push(strap(`${name} ${p.od}φ`, ringEars(r, p.t, e, gap), p.t, p.B, finish, XY()));
    parts.push(earBolt(p.bolt, p.t, gap, yb)); if (p.rubber) parts.push(rubberRing(r, p.rubber, p.B)); parts.push(pipeRef(p.od)); return parts; };
  reg({ id: 'riser_band', name: '立バンド（蝶番式・組式）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'RB', icon: '⊚',
    params: [od(), ...tB(2, 25), sel('style', '形式', [['hinge', '蝶番式'], ['split', '組式（2 つ割り）']], 'hinge'), num('C', '耳の寸法 C', 44), num('P', '穴の寸法 P', 20), num('H', '高さ H（管芯〜耳の先）', 80), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x20'), num('rubber', 'ゴム厚（0=なし）', 0), P.finish],
    parts(p) { return riserParts(p, p.finish, '立バンド'); } });
  reg({ id: 'resin_band', name: '樹脂バンド（吊・立兼用）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'PB', icon: '◌',
    params: [od(27.2), num('t', '肉厚', 3), num('B', '幅 B', 25), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x30'), sel('color', '色', [['RESIN', 'ホワイト'], ['RESIN_GRAY', 'グレー']], 'RESIN')],
    parts(p) { return riserParts({ ...p, style: 'hinge', H: p.od / 2 + p.t + 18, P: 12, rubber: 0 }, p.color, '樹脂バンド'); } });
  reg({ id: 'gas_band', name: 'ガスバンド（足付）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'GB', icon: '⊝',
    params: [od(34), ...tB(2, 15), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x20'), num('L', '足の長さ（0=足なし）', 150), P.finish],
    parts(p) { const r = p.od / 2; const parts = riserParts({ ...p, style: 'split', H: r + p.t + 14, P: 10, rubber: 0 }, p.finish, 'ガスバンド'); if (p.L > 0) parts.splice(parts.length - 1, 0, cyl(`足（全ねじ）${p.L}`, 4.75, p.L, 'THREAD', place([-(r + p.t), 0, 0], DIR.NX, DIR.Y), { group: '足' })); return parts; } });
  // ---- 床バンド: 4 章。管は鉛直、耳は左右へ ----
  reg({ id: 'floor_band', name: '床バンド', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'FB', icon: '⊖',
    params: [od(), ...tB(2.3, 25), num('L', '全長 L（両耳の端から端）', 190), num('P', '穴の寸法 P', 20), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x25'), num('rubber', 'ゴム厚（0=なし）', 0), P.finish],
    parts(p) { const r = p.od / 2 + (p.rubber || 0); const R = r + p.t / 2; const gap = 3; const y0 = gap / 2 + p.t / 2; const a = Math.asin(Math.min(0.9, y0 / R)); const Lh = Math.max(p.L / 2, R + 24); const pl = UP([0, p.B / 2, 0]); const half = s => [[Lh, s * y0], ...arc(0, 0, R, s * a, s * (Math.PI - a)), [-Lh, s * y0]]; const b = boltOf(p.bolt); const xb = Math.min(Lh - 8, R + p.t + Math.max(10, p.P * 0.6)); const bl = Math.max(b.L, Math.ceil(gap + 2 * p.t + boltDims(b.M).m + 4));
      const parts = [strap(`床バンド ${p.od}φ（半割）`, half(1), p.t, p.B, p.finish, pl), strap(`床バンド ${p.od}φ（半割）`, half(-1), p.t, p.B, p.finish, pl), ...[-1, 1].map(s => bolt(p.bolt, place([s * xb, p.B / 2, gap / 2 + p.t], DIR.NZ, DIR.X), { L: bl }))];
      if (p.rubber) parts.push(tube('防振ゴム', r, r - p.rubber, p.B * 0.9, 'RUBBER', UP([0, p.B * 0.05, 0]), { group: 'ゴム' })); parts.push(pipeRef(p.od, 300, UP([0, -120, 0]))); return parts; } });
  // ---- サドルバンド（両サドル）・片サドル・樹脂サドル: 7・8 章。面（y = -r）に管を留める ----
  const saddlePts = (r, t, P, d) => { const R = r + t / 2, yb = -r + t / 2; const E = Math.max(P / 2 + Math.max(6, d), R + d + 6); return [[-E, yb], [-R, yb], ...arc(0, 0, R, Math.PI, 0), [R, yb], [E, yb]]; };
  const screws = (xs, y, d) => d >= 6 ? xs.map(x => ({ kind: 'bolt', name: `取付ボルト M${d >= 10 ? 10 : d >= 8 ? 8 : 6}`, M: d >= 10 ? 'M10' : d >= 8 ? 'M8' : 'M6', L: 16, noNut: true, pl: place([x, y, 0], DIR.NY, DIR.X), group: '取付', site: true })) : [];
  reg({ id: 'saddle_band', name: 'サドルバンド（両サドル）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'SD', icon: 'Ω',
    params: [od(27.2), num('t', '板厚 t', 1.2), num('B', '帯幅 B', 20), num('P', '穴ピッチ P', 54), num('d', '穴径 d', 5), P.finish],
    parts(p) { const r = p.od / 2; const P2 = Math.max(p.P / 2, r + p.t + p.d / 2 + 3); return [strap(`サドルバンド ${p.od}φ`, saddlePts(r, p.t, p.P, p.d), p.t, p.B, p.finish, XY()), ...screws([-P2, P2], -r + p.t, p.d), pipeRef(p.od)]; } });
  reg({ id: 'half_saddle', name: '片サドル', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'HS', icon: 'ᒍ',
    params: [od(25.5), num('t', '板厚 t', 1.8), num('B', '帯幅 B', 20), num('P1', '穴位置 P1（管芯から）', 38), num('P2', '寸法 P2', 30), P.finish],
    parts(p) { const r = p.od / 2, R = r + p.t / 2, yb = -r + p.t / 2; const E = Math.max(p.P1 + 8, R + 14); return [strap(`片サドル ${p.od}φ`, [[E, yb], [R, yb], ...arc(0, 0, R, 0, Math.PI), [-R, yb]], p.t, p.B, p.finish, XY()), pipeRef(p.od)]; } });
  reg({ id: 'resin_saddle', name: '樹脂サドル（台座付き）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'RS', icon: 'Ω',
    params: [od(27.2), num('P', 'ビス穴ピッチ P', 51), num('L', '全長 L', 69), num('B', '幅', 18), num('baseH', '台座の高さ（0=なし）', 0), sel('color', '色', [['RESIN', 'ホワイト'], ['RESIN_GRAY', 'グレー']], 'RESIN')],
    parts(p) { const r = p.od / 2, t = 2.5, R = r + t / 2, yb = -r + t / 2; const E = Math.max(p.L / 2, R + 8); const parts = [strap(`樹脂サドル ${p.od}φ`, [[-E, yb], [-R, yb], ...arc(0, 0, R, Math.PI, 0), [R, yb], [E, yb]], t, p.B, p.color, XY())]; if (p.baseH > 0) parts.push(box(`台座 ${p.baseH}`, p.L, p.B, p.baseH, p.color, UP([0, -r - p.baseH, 0]), { group: '台座' })); parts.push(pipeRef(p.od)); return parts; } });
  // ---- T 型バンド: 3 章。管を面から H だけ浮かせる ----
  reg({ id: 't_band', name: 'T型バンド（浮かし配管用）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'TB', icon: '⊥',
    params: [od(21.7), ...tB(1.6, 25), num('H', '高さ H（面〜管芯）', 35), P.finish],
    parts(p) { const r = p.od / 2; const e = Math.max(6, p.H - r - p.t); const ring = ringEars(r, p.t, e, 2).map(([x, y]) => [x, -y]); return [strap(`T型バンド ${p.od}φ`, ring, p.t, p.B, p.finish, XY()), box('足', 50, p.B, p.t, p.finish, UP([0, -p.H, 0]), { group: '足' }), pipeRef(p.od)]; } });
  // ---- U バンド: 12 章。架台の上に管を押さえる（両端ねじ） ----
  const uBandParts = (name, odv, p, Pv, studBelow, finish) => { const r = odv / 2, R = r + p.t / 2; const d = thr(p.d); const dr = boltDims(d).d / 2; const xs = Math.max(Pv / 2, R + p.t / 2 + dr); const below = Math.max(18, studBelow);
    return [strap(`${name} ${odv}φ`, [[-R, -r + 2], ...arc(0, 0, R, Math.PI, 0), [R, -r + 2]], p.t, p.B, finish, XY()), ...[-1, 1].flatMap(s => [cyl(`ねじ ${d}`, dr, below + 14, 'THREAD', place([s * xs, -r + 14, 0], DIR.NY, DIR.X), { group: '締付' }), nut(d, place([s * xs, -r - 6, 0], DIR.NY, DIR.X), { group: '締付' })])]; };
  reg({ id: 'u_band', name: 'Uバンド（両端ねじ）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'UB', icon: '∩',
    params: [od(), ...tB(2.3, 25), num('P', 'ねじの間隔 P', 72), num('L', '全高 L', 90), sel('d', 'ねじ径', ROD_OPTS, 'W3/8'), P.finish],
    parts(p) { return [...uBandParts('Uバンド', p.od, p, p.P, p.L - p.od - p.t, p.finish), pipeRef(p.od)]; } });
  // ---- レベルバンド: 5 章。床に置き、高さを調整する ----
  reg({ id: 'level_band', name: 'レベルバンド（床置き・高さ調整）', category: 'バンド', ifc: 'IfcElementAssembly', markPrefix: 'LB', icon: '⫯',
    params: [od(), ...tB(2, 25), num('H', '高さ H（床〜管芯）', 150), num('L', 'ベースの全長 L', 158), num('Pp', 'ベースの穴ピッチ P', 145), num('baseW', 'ベースの幅', 40), sel('d', 'ボルト径', ROD_OPTS, 'W3/8'), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x25'), P.finish],
    parts(p) { const r = p.od / 2; const bt = 4.5; const d = thr(p.d); const rodL = Math.max(20, p.H - r - p.t - bt); return [box('ベース', p.L, p.baseW, bt, p.finish, UP(), { group: 'ベース' }), rod(d, rodL, UP([0, bt, 0]), { site: false, group: '支柱' }), nut(d, UP([0, bt, 0]), { group: '支柱' }), nut(d, UP([0, p.H - r - p.t - boltDims(d).m - 1, 0]), { group: '支柱' }),
      strap(`レベルバンド ${p.od}φ`, ringEars(r, p.t, 14, 3), p.t, p.B, p.finish, XY([0, p.H, 0])), { ...earBolt(p.bolt, p.t, 3, r + p.t + 7), pl: place([-(1.5 + p.t), p.H + r + p.t + 7, 0], DIR.X, DIR.Y) }, pipeRef(p.od, 300, place([0, p.H, -150], DIR.Z, DIR.X))]; } });
  // ---- 取付足: T 足・羽子板・ツバ付足: 3 章。壁（z = 0）から +Z へ出す ----
  reg({ id: 't_foot', name: 'T足（立バンド用の取付足）', category: '金具', ifc: 'IfcDiscreteAccessory', markPrefix: 'TF', icon: '⊤',
    params: [num('L', '出寸法 L', 80), num('W', '帯幅 W', 25), num('l', '横板の長さ ℓ', 60), num('Pp', '穴ピッチ P', 37), num('t', '板厚', 3), P.finish],
    parts(p) { return [box('横板', p.l, p.W, p.t, p.finish, XY()), box(`足 ${p.L}`, p.t, p.W, p.L, p.finish, XY([0, 0, p.t]), { group: '足' })]; } });
  reg({ id: 'hagoita', name: '羽子板（座付・ターボ）', category: '金具', ifc: 'IfcDiscreteAccessory', markPrefix: 'HG', icon: '⫱',
    params: [num('L', '長さ L', 100), sel('d', 'ねじ径', ROD_OPTS, 'W3/8'), num('t', '羽子板の板厚', 3.4), num('B', '羽子板の幅', 21), num('seatD', '座の径（0=座なし）', 37.5), P.finish],
    parts(p) { const d = thr(p.d); const dr = boltDims(d).d / 2; const fl = 28; const parts = []; if (p.seatD > 0) parts.push(tube('座', p.seatD / 2, 0.01, 3, p.finish, XY(), { group: '座' })); parts.push(cyl(`ねじ ${d}`, dr, Math.max(10, p.L - fl), 'THREAD', XY([0, 0, p.seatD > 0 ? 3 : 0]), { group: '足' }), box('羽子板', p.t, p.B, fl, p.finish, XY([0, 0, Math.max(10, p.L - fl) + (p.seatD > 0 ? 3 : 0)]))); return parts; } });
  reg({ id: 'flange_foot', name: 'ツバ付足', category: '金具', ifc: 'IfcDiscreteAccessory', markPrefix: 'TA', icon: '⌐',
    params: [num('L', '長さ L', 80), num('t', '板厚', 3), num('B', '幅', 25), num('E', '寸法 E', 12), P.finish],
    parts(p) { return [strap(`ツバ付足 ${p.L}`, [[0, -(p.B + p.E)], [0, 0], [p.L, 0]], p.t, p.B, p.finish, place([0, 0, 0], DIR.Y, DIR.Z))]; } });
  // ---- ローラー: 11 章 ----
  const roller = (odv, Lr, rw, re, pl) => lathe(`ローラー ${Math.round(odv)}φ用`, [[3.5, 0], [re, 0], [re, 3], [rw, Lr / 2], [re, Lr - 3], [re, Lr], [3.5, Lr], [3.5, 0]], 'CAST', pl, Math.PI * ((re + rw) / 2) ** 2 * Lr * 7.2e-6, { group: 'ローラー' });
  const rollerDims = odv => { const r = odv / 2; const rw = Math.max(8, odv * 0.16), re = rw + Math.max(6, odv * 0.2); const Lr = Math.max(36, odv * 0.9 + 14); return { r, rw, re, Lr, yA: -(r + rw + 1.5) }; };
  reg({ id: 'roller_hanger', name: '吊ローラーバンド', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'RH', icon: '⌻',
    params: [od(), num('H', '高さ H（ローラー軸〜吊点）', 105), num('B', '帯幅 B', 25), num('T', '帯厚 T', 2), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), sel('axle', 'ローラーの軸ボルト', [['M6', 'M6'], ['M8', 'M8'], ['M12', 'M12']], 'M6'), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), P.finish],
    parts(p) { const q = rollerDims(p.od); const a = q.Lr / 2 + 2 + p.T / 2; const yTop = q.yA + Math.max(p.H, q.r * 2 + q.rw + 16); const d = thr(p.d); const parts = [strap(`吊りわく ${p.od}φ`, [[-a, q.yA - 12], [-a, yTop], [a, yTop], [a, q.yA - 12]], p.T, p.B, p.finish, XY()), roller(p.od, q.Lr, q.rw, q.re, place([-q.Lr / 2, q.yA, 0], DIR.X, DIR.Y)), { kind: 'bolt', name: `軸ボルト ${p.axle}`, M: p.axle, L: Math.ceil((2 * a + 14) / 5) * 5, pl: place([-a - p.T / 2, q.yA, 0], DIR.X, DIR.Y), group: 'ローラー' }, nut(d, UP([0, yTop + p.T / 2, 0]))];
      if (p.rodDraw) parts.push(rod(d, p.rodL, UP([0, yTop - 8, 0]))); parts.push(pipeRef(p.od)); return parts; } });
  reg({ id: 'roller_stand', name: '置式ローラー（ガイド付）', category: 'バンド', ifc: 'IfcElementAssembly', markPrefix: 'RL', icon: '⌼',
    params: [od(), num('L', 'ベースの全長 L', 165), num('Pp', '取付穴ピッチ P', 135), num('H', '高さ H（ベース下面〜管芯）', 71), num('t1', 'ガイドの帯厚', 2), num('C1', 'ガイドの帯幅', 25), num('t2', 'ベースの板厚', 4.5), num('C2', 'ベースの幅', 32), sel('axle', '軸ボルト', [['M6', 'M6'], ['M8', 'M8'], ['M10', 'M10'], ['M12', 'M12']], 'M8'), P.finish],
    parts(p) { const q = rollerDims(p.od); const H = Math.max(p.H, q.r + 2 * q.re + p.t2 + 2); const a = Math.max(q.Lr / 2 + 3, q.r + 6) + p.t1 / 2; const yb = -H + p.t2; return [box('ベース', Math.max(p.L, 2 * a + 30), p.C2, p.t2, p.finish, UP([0, -H, 0]), { group: 'ベース' }), strap('ガイド', [[-a, yb], [-a, 0], ...arc(0, 0, a, Math.PI, 0), [a, 0], [a, yb]], p.t1, p.C1, p.finish, XY()), roller(p.od, q.Lr, q.rw, q.re, place([-q.Lr / 2, q.yA, 0], DIR.X, DIR.Y)), { kind: 'bolt', name: `軸ボルト ${p.axle}`, M: p.axle, L: Math.ceil((2 * a + 14) / 5) * 5, pl: place([-a - p.t1 / 2, q.yA, 0], DIR.X, DIR.Y), group: 'ローラー' }, pipeRef(p.od)]; } });
  // ---- ウレタン断熱支持: 10 章 ----
  const urethane = (odv, T, W) => tube(`ウレタン断熱材 保温厚 ${T}`, odv / 2 + T, odv / 2, W, 'URETHANE', XY([0, 0, -W / 2]), { group: '断熱材' });
  reg({ id: 'urethane_hanger', name: 'ウレタン断熱支持（吊り型）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'UH', icon: '◎',
    params: [od(), sel('T', '保温厚 T', [['20', '20'], ['25', '25'], ['30', '30'], ['40', '40'], ['50', '50']], '25'), num('W', '断熱材の幅 L', 50), ...tB(2.3, 25), num('H', '高さ H（管芯〜吊点）', 110), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), P.finish],
    parts(p) { const T = +p.T; const ro = p.od / 2 + T; const d = thr(p.d); const H = Math.max(p.H, ro + p.t + 16); const sl = Math.PI * 2 * (ro + p.t / 2) + 2 * (H - ro);
      const parts = [urethane(p.od, T, p.W), { kind: 'custom', custom: 'band', name: `吊バンド ${Math.round(ro * 2)}φ`, od: ro * 2, t: p.t, B: p.B, C: 26, H, rubber: 0, mass: sl * p.B * p.t * STEEL, areaM2: 2 * sl * p.B / 1e6, finish: p.finish, pl: XY(), group: '本体' }, nut(d, UP([0, H - 2, 0]))];
      if (p.rodDraw) parts.push(rod(d, p.rodL, UP([0, H - 10, 0]))); parts.push(pipeRef(p.od)); return parts; } });
  reg({ id: 'urethane_seat', name: 'ウレタン断熱支持（置き型）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'US', icon: '◎',
    params: [od(), sel('T', '保温厚 T', [['20', '20'], ['25', '25'], ['30', '30'], ['40', '40'], ['50', '50']], '25'), num('W', '断熱材の幅 L', 50), ...tB(2, 25), num('P', 'ねじの間隔 P', 116), sel('d', 'ねじ径', ROD_OPTS, 'W3/8'), P.finish],
    parts(p) { const T = +p.T; const o2 = p.od + 2 * T; return [urethane(p.od, T, p.W), ...uBandParts('Uバンド', o2, p, p.P, 26, p.finish), pipeRef(p.od)]; } });
  // ---- 吊金具: 2 章 ----
  reg({ id: 'beam_clamp', name: '形鋼用吊金具（ビームクランプ）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'BC', icon: '⊏',
    params: [sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), num('flange', '挟むフランジの厚さ', 9), num('jaw', '口の深さ', 34), num('gapH', '口の高さ', 30), num('t', '本体の厚さ', 8), num('B', '本体の幅', 32), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), P.finish],
    parts(p) { const g = Math.max(p.gapH, p.flange + 8); const hh = g / 2 + p.t / 2; const d = thr(p.d); const parts = [strap('クランプ本体', [[p.jaw, hh], [0, hh], [0, -hh], [p.jaw, -hh]], p.t, p.B, p.finish, XY()), { kind: 'bolt', noNut: true, name: '固定ボルト M10', M: 'M10', L: Math.ceil((p.t + g - p.flange + 2) / 5) * 5, pl: place([p.jaw * 0.6, hh + p.t / 2, 0], DIR.NY, DIR.X), group: '締付' }, nut(d, place([p.jaw * 0.6, -hh - p.t / 2, 0], DIR.NY, DIR.X)), box('形鋼のフランジ（参考）', p.jaw + 60, 120, p.flange, 'BLACK', UP([p.jaw / 2 + 36, -g / 2, 0]), { ref: true, group: '相手材' })];
      if (p.rodDraw) parts.push(rod(d, p.rodL, place([p.jaw * 0.6, -hh + 4, 0], DIR.NY, DIR.X))); return parts; } });
  reg({ id: 'angle_hook', name: 'アングル用・チャンネル用吊金具', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'AH', icon: 'ʃ',
    params: [num('S', '掛ける辺の幅（L50 なら 50）', 50), num('L', '全長 L', 76), num('ft', '形鋼の厚さ', 6), num('t', '板厚', 3.2), num('B', '幅', 30), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), P.finish],
    parts(p) { const S = p.S, c = p.t / 2 + 0.6; const xm = S * 0.45; const d = thr(p.d); const yB = -Math.max(p.L, p.ft + 30); const parts = [strap('吊金具', [[xm, c], [S + c, c], [S + c, -p.ft - c], [xm, -p.ft - c], [xm, yB], [xm - 26, yB]], p.t, p.B, p.finish, XY()), box('形鋼（参考）', S, 200, p.ft, 'BLACK', UP([S / 2, -p.ft, 0]), { ref: true, group: '相手材' }), box('形鋼（参考）', p.ft, 200, S, 'BLACK', UP([p.ft / 2, -S, 0]), { ref: true, group: '相手材' }), nut(d, UP([xm - 14, yB + p.t / 2, 0]))];
      if (p.rodDraw) parts.push(rod(d, p.rodL, place([xm - 14, yB + 8, 0], DIR.NY, DIR.X))); return parts; } });
  reg({ id: 'vib_hanger', name: '防振吊金具', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'VH', icon: '⌸',
    params: [num('A', '枠の奥行 A', 30), num('Bw', '枠の幅 B', 50), num('L', '全長 L', 85), num('D', 'ゴムの外径 φD', 30), num('Hr', 'ゴムの高さ H', 21), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), bool('double', 'ダブル（上下にゴム）', false), num('rodL', '吊ボルト長', 200, { scope: 'instance' }), P.finish],
    parts(p) { const t = 2.3; const d = thr(p.d); const Lf = Math.max(p.L, (p.double ? 2 : 1) * p.Hr + 30); const w = Math.max(p.Bw, p.D + 8); const parts = [strap('枠', [[-w / 2, 0], [w / 2, 0], [w / 2, Lf], [-w / 2, Lf]], t, p.A, p.finish, XY(), { closed: true }), cyl('防振ゴム', p.D / 2, p.Hr, 'RUBBER', UP([0, t / 2, 0]), { group: 'ゴム' }), nut(d, UP([0, t / 2 + p.Hr, 0])), rod(d, p.rodL, place([0, t / 2 + p.Hr + 6, 0], DIR.NY, DIR.X)), rod(d, p.rodL, UP([0, Lf - (p.double ? p.Hr + 8 : 6), 0]))];
      if (p.double) parts.push(cyl('防振ゴム', p.D / 2, p.Hr, 'RUBBER', UP([0, Lf - t / 2 - p.Hr, 0]), { group: 'ゴム' })); return parts; } });
  // ---- 振れ止め: 16・17 章 ----
  reg({ id: 'seismic_band', name: '耐震吊バンド（振れ止め付き）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'EB', icon: '⩚',
    params: [od(), ...tB(2, 25), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), num('C', 'タン幅 C', 26), num('H', '高さ H', 97), sel('bolt', '締付ボルト', BOLT_OPTS, 'M6x25'), sel('braces', '斜材の本数', [['1', '1 本（3 点支持）'], ['2', '2 本（5 点支持の片面）']], '2'), num('braceL', '斜材の長さ', 500, { scope: 'instance' }), num('rodL', '吊ボルト長', 500, { scope: 'instance' }), P.finish],
    parts(p) { const r = p.od / 2; const d = thr(p.d); const H = Math.max(p.H, r + p.t + 20); const sl = Math.PI * 2 * (r + p.t / 2) + 2 * (H - r); const k = Math.SQRT1_2; const yT = H - 6; const parts = [{ kind: 'custom', custom: 'band', name: `吊バンド ${p.od}φ`, od: p.od, t: p.t, B: p.B, C: p.C, H, rubber: 0, mass: sl * p.B * p.t * STEEL, areaM2: 2 * sl * p.B / 1e6, finish: p.finish, pl: XY(), group: '本体' }, bolt(p.bolt, place([-(1.5 + p.t), -(r + p.t + 7), 0], DIR.X, DIR.Y)), nut(d, UP([0, H - 2, 0])), rod(d, p.rodL, UP([0, H - 10, 0])), strap('振れ止め金具', [[-30, yT + 26], [-6, yT + 2], [6, yT + 2], [30, yT + 26]], 3.2, p.B, p.finish, XY([0, 0, p.B / 2 + 4]), { group: '振れ止め' })];
      for (const s of (p.braces === '2' ? [-1, 1] : [1])) parts.push(rod(d, p.braceL, place([s * 20, yT + 16, p.B / 2 + 4], [s * k, k, 0], DIR.Z), { name: `斜材（全ねじ）${d}`, group: '振れ止め' })); parts.push(pipeRef(p.od)); return parts; } });
  reg({ id: 'brace_clamp', name: '吊ボルト振れ止め金具', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'BK', icon: '⩘',
    params: [sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), sel('angle', '斜材の角度', [['45', '45°'], ['60', '60°'], ['90', '90°（交差）']], '45'), num('W', '金具の幅', 30), num('Lc', '金具の全長', 115), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), num('braceL', '斜材の長さ', 400, { scope: 'instance' }), P.finish],
    parts(p) { const d = thr(p.d); const a = +p.angle * Math.PI / 180; const dir = [Math.cos(a), Math.sin(a), 0]; return [rod(d, p.rodL, UP([0, -p.rodL / 2, 0])), strap('振れ止め金具', [[-8, -p.Lc * 0.25], [-8, p.Lc * 0.2], [dir[0] * p.Lc * 0.45 - 8, p.Lc * 0.2 + dir[1] * p.Lc * 0.45]], 3.2, p.W, p.finish, XY([0, 0, 8])), rod(d, p.braceL, place([4, p.Lc * 0.1, 8], dir, DIR.Z), { name: `斜材（全ねじ）${d}`, group: '振れ止め' })]; } });
  reg({ id: 'wire_brace', name: 'ワイヤ式振れ止め・吊りワイヤ', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'WB', icon: '⟋',
    params: [num('L', 'ワイヤの長さ', 800, { scope: 'instance' }), num('dw', 'ワイヤ径', 2), sel('angle', '角度', [['45', '45°'], ['60', '60°'], ['90', '90°（まっすぐ吊る）']], '45'), sel('d', '吊ボルト径', ROD_OPTS, 'W3/8'), P.finish],
    parts(p) { const a = +p.angle * Math.PI / 180; const ex = Math.cos(a) * p.L, ey = Math.sin(a) * p.L; const d = thr(p.d); return [{ kind: 'custom', custom: 'sweep', name: `ワイヤ φ${p.dw}×${p.L}`, pts: [[0, 0, 0], [ex, ey, 0]], r: p.dw / 2, finish: 'WIRE', mass: Math.PI * (p.dw / 2) ** 2 * p.L * STEEL * 0.6, areaM2: 0, pl: XY(), group: '本体' }, strap('上部の取付金具', [[-18, 0], [0, 0], [0, -22]], 3.2, 25, p.finish, XY([ex, ey + 2, 0]), { group: '端末' }), strap('下部の引留金具', [[0, 18], [0, 0], [16, 0]], 3.2, 25, p.finish, XY([-2, -2, 0]), { group: '端末' }), rod(d, 200, UP([-2, -120, 0]), { name: `吊ボルト（参考）${d}`, ref: true })]; } });
  // ---- 基礎・防振材: 15 章 ----
  reg({ id: 'base_block', name: '基礎ブロック（架台基礎）', category: '架台', ifc: 'IfcFooting', markPrefix: 'BB', icon: '⏢',
    params: [num('L', '長さ', 400), num('H', '高さ', 100), num('top', '上部の幅', 80), num('bottom', '下部の幅', 110), sel('rail', '上面', [['alumi', 'アルミレール'], ['channel', 'チャンネルレール'], ['anchor', 'アンカー 1 本'], ['none', 'なし']], 'alumi'), num('massKg', '質量 kg（0=計算）', 0), sel('mat', '材質', [['CONCRETE', 'コンクリート'], ['RESIN_GRAY', '樹脂']], 'CONCRETE')],
    parts(p) { const vol = (p.top + p.bottom) / 2 * p.H * p.L; const parts = [{ kind: 'custom', custom: 'frustum', name: `基礎ブロック ${p.L}×${p.H}`, w1: p.bottom, d1: p.L, w2: p.top, d2: p.L, h: p.H, finish: p.mat, mass: p.massKg > 0 ? p.massKg : vol * rho(p.mat), areaM2: 0, nonSteel: true, pl: UP(), group: '本体' }];
      if (p.rail === 'alumi' || p.rail === 'channel') parts.push(box(p.rail === 'alumi' ? 'アルミレール' : 'チャンネルレール', p.rail === 'alumi' ? 30 : 41, Math.max(40, p.L - 10), p.rail === 'alumi' ? 8 : 12, p.rail === 'alumi' ? 'ALUMI' : 'HDZ', UP([0, p.H, 0]), { group: 'レール', mass: (p.rail === 'alumi' ? 0.5 : 1.6) * (p.L - 10) / 1000 }));
      if (p.rail === 'anchor') parts.push(cyl('アンカー W3/8', 4.75, 40, 'THREAD', UP([0, p.H, 0]), { group: 'アンカー' })); return parts; } });
  reg({ id: 'vib_pad', name: '防振パッド・ゴムブッシュ・ゴムワッシャー', category: '金具', ifc: 'IfcVibrationIsolator', markPrefix: 'VP', icon: '▬',
    params: [sel('type', '種類', [['pad', '防振パッド'], ['bush', 'ゴムブッシュ'], ['washer', 'ゴムワッシャー']], 'pad'), num('H', '厚さ H', 10), num('W', '幅 W（パッド）', 100), num('Lp', '長さ（パッド）', 300, { scope: 'instance' }), num('D1', 'つばの径 φD1 / 外径', 28), num('D2', '胴の径 φD2', 14), num('dd', '穴径 φd / 内径', 12.7), num('t1', '胴の長さ t1', 8), num('t2', 'つばの厚さ t2', 5)],
    parts(p) { if (p.type === 'pad') return [box(`防振パッド ${p.H}×${p.W}×${p.Lp}`, p.W, p.Lp, p.H, 'RUBBER', UP())]; const ri = p.dd / 2;
      if (p.type === 'bush') return [lathe(`ゴムブッシュ φ${p.D1}`, [[ri, 0], [p.D1 / 2, 0], [p.D1 / 2, p.t2], [p.D2 / 2, p.t2], [p.D2 / 2, p.t2 + p.t1], [ri, p.t2 + p.t1], [ri, 0]], 'RUBBER', UP(), Math.PI * ((p.D1 / 2) ** 2 * p.t2 + (p.D2 / 2) ** 2 * p.t1 - ri * ri * (p.t1 + p.t2)) * RHO.RUBBER)];
      return [lathe(`ゴムワッシャー φ${p.D1}`, [[ri, 0], [p.D1 / 2, 0], [p.D1 / 2, p.H], [ri, p.H], [ri, 0]], 'RUBBER', UP(), Math.PI * ((p.D1 / 2) ** 2 - ri * ri) * p.H * RHO.RUBBER)]; } });
  // ---- インサート: 22 章。スラブの下面（y = 0）から上へ埋まる ----
  reg({ id: 'insert', name: 'インサート', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'IN', icon: '⏉',
    params: [sel('d', 'ねじ径', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['W5/8', 'W5/8'], ['M10', 'M10'], ['M12', 'M12']], 'W3/8'), num('D', '頭の径 D', 28), num('dd', '胴の径 d', 12), num('L', '金具の全長 L', 40), num('A', '頭の厚さ A', 3), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 300, { scope: 'instance' }), bool('slab', 'スラブを表示（参考）', true)],
    parts(p) { const d = p.d === 'W5/8' ? 'M16' : p.d; const ri = Math.max(2, boltDims(d).d / 2 - 0.3); const rb = Math.max(p.dd / 2, ri + 1.2); const parts = [lathe(`インサート ${p.d}×${p.L}`, [[ri, 0], [rb, 0], [rb, p.L - p.A], [p.D / 2, p.L - p.A], [p.D / 2, p.L], [ri, p.L], [ri, 0]], 'EZ', UP(), Math.PI * ((rb * rb - ri * ri) * (p.L - p.A) + (p.D / 2) ** 2 * p.A) * STEEL)];
      if (p.rodDraw) parts.push(rod(d, p.rodL, place([0, Math.min(p.L - p.A - 2, 15), 0], DIR.NY, DIR.X))); if (p.slab) parts.push(box('スラブ（参考）', 300, 300, Math.max(120, p.L + 40), 'CONCRETE', UP(), { ref: true, group: '相手材', finish: 'GHOST' })); return parts; } });
  // ---- 鋼板製スリーブ: 19 章 ----
  reg({ id: 'sheet_sleeve', name: '鋼板製スリーブ（単筒・スライド式）', category: 'スリーブ', ifc: 'IfcBuildingElementProxy', markPrefix: 'SS', icon: '◯',
    params: [num('D', '内径 φ', 154), num('t', '板厚', 0.6), num('L', '長さ L', 200, { scope: 'instance' }), bool('slide', 'スライド式（外筒つき）', false), num('D2', '外筒の内径 φ′', 157), bool('cap', '養生フタ', false), sel('dir', '向き', [['wall', '壁・梁（水平）'], ['floor', '床（鉛直）']], 'wall')],
    parts(p) { const pl = p.dir === 'floor' ? UP() : XY([0, 0, -p.L / 2]); const parts = [tube(`鋼板スリーブ φ${p.D}×${p.L}`, p.D / 2 + p.t, p.D / 2, p.slide ? p.L * 0.62 : p.L, 'EZ', pl)];
      if (p.slide) { const r2 = Math.max(p.D2 / 2, p.D / 2 + p.t + 0.4); parts.push(tube(`外筒 φ${Math.round(r2 * 2)}`, r2 + p.t, r2, p.L * 0.62, 'EZ', p.dir === 'floor' ? UP([0, p.L * 0.38, 0]) : XY([0, 0, -p.L / 2 + p.L * 0.38]), { group: '外筒' })); }
      if (p.cap) { const R = p.D / 2 + p.t; parts.push(lathe(`養生フタ φ${p.D}`, [[0, 4], [R - 2, 4], [R - 2, 0], [R + 7, 0], [R + 7, 1], [R - 1, 1], [R - 1, 5], [0, 5]], 'EZ', p.dir === 'floor' ? UP([0, p.L, 0]) : XY([0, 0, p.L / 2]), Math.PI * (R + 7) ** 2 * 0.8 * STEEL, { group: 'フタ' })); } return parts; } });
  // ---- コラム柱用金具: 20 章 ----
  reg({ id: 'column_band', name: 'コラム柱用取付金具', category: '金具', ifc: 'IfcElementAssembly', markPrefix: 'CB', icon: '▣',
    params: [num('col', '角形鋼管の外寸（□）', 300), num('B', '金具の幅', 50), num('t', '板厚', 3.2), bool('rail', 'レール（Dバー）を付ける', true), num('colH', '柱の表示高さ（参考）', 500, { scope: 'instance' }), P.finish],
    parts(p) { const a = p.col / 2 + p.t / 2 + 0.5; const e = 38; const pl = UP([0, p.B / 2, 0]); const parts = [strap(`コラムバンド □${p.col}`, [[-a - e, a], [-a, a], [-a, -a], [a, -a], [a, a], [a + e, a]], p.t, p.B, p.finish, pl)];
      if (p.rail) parts.push(box(`レール ${Math.round(2 * (a + e))}`, 2 * (a + e), 41, 12, p.finish, place([0, p.B / 2, -(a + p.t / 2)], DIR.NZ, DIR.X), { group: 'レール', mass: 1.6 * 2 * (a + e) / 1000 })); else parts.push(box(`スペーサー ${Math.round(2 * (a + e))}`, 2 * (a + e), p.B, p.t, p.finish, place([0, p.B / 2, -(a + p.t / 2)], DIR.NZ, DIR.X), { group: 'スペーサー' }));
      for (const s of [-1, 1]) parts.push({ kind: 'bolt', name: '締付ボルト M10×30', M: 'M10', L: 30, pl: place([s * (a + e * 0.55), p.B / 2, -(a + p.t / 2 + (p.rail ? 12 : p.t)) - 0.5], DIR.Z, DIR.X), group: '締付' });
      parts.push(box(`角形鋼管 □${p.col}（参考）`, p.col, p.col, p.colH, 'BLACK', UP([0, -(p.colH - p.B) / 2, 0]), { ref: true, group: '相手材' })); return parts; } });
  // ---- スプリンクラー巻出し金具: 18 章 ----
  reg({ id: 'sprinkler_bar', name: 'スプリンクラー巻出し金具（角バー）', category: '金具', ifc: 'IfcElementAssembly', markPrefix: 'SK', icon: '⊓',
    params: [num('L', '角バーの長さ', 1200, { scope: 'instance' }), num('S', '角バーの外寸', 16), num('t', '板厚', 0.6), od(27.2), P.finish],
    parts(p) { const r = p.od / 2; return [box(`角バー ${p.S}×${p.L}`, p.S, p.S, p.L, p.finish, place([-p.L / 2, 0, 0], DIR.X, DIR.Y), { mass: 4 * p.S * p.t * p.L * STEEL }), strap('センター金具', [[-p.S / 2 - 3, p.S / 2 + 2], [p.S / 2 + 3, p.S / 2 + 2], [p.S / 2 + 3, -p.S / 2 - 2], [-p.S / 2 - 3, -p.S / 2 - 2]], 1.6, 30, p.finish, place([0, 0, 0], DIR.X, DIR.Z), { closed: true, group: 'センター金具' }), strap('管の押さえ', [[-r - 1, p.S / 2 + 2], ...arc(0, p.S / 2 + r + 3, r + 1, Math.PI, 0), [r + 1, p.S / 2 + 2]], 1.6, 20, p.finish, place([0, 0, 0], DIR.Y, DIR.X), { group: 'センター金具' }), pipeRef(p.od, 200, UP([0, -100, -(p.S / 2 + r + 3)])), ...[-1, 1].map(s => strap('サイド金具', [[0, -p.S / 2 - 2], [0, 22], [s * 16, 22]], 1.6, 20, p.finish, XY([s * (p.L / 2 - 1), 0, 0]), { group: 'サイド金具' }))]; } });
  // ---- フランジ・長ナット・角ワッシャー: 24 章 ----
  reg({ id: 'pipe_flange', name: 'フランジ（5K・10K）', category: '金具', ifc: 'IfcPipeFitting', markPrefix: 'FL', icon: '◉',
    params: [od(), num('D', '外径', 155), num('C', 'ボルト中心円', 130), int('n', 'ボルト穴の数', 4), num('hd', 'ボルト穴径', 15), num('t', '板厚（代表値。カタログの表に無い）', 14), sel('K', '呼び圧力', [['5K', '5K'], ['10K', '10K']], '10K'), bool('bolts', 'ボルトを描画', false), sel('fb', '使用ボルト', [['M10x40', 'M10×40'], ['M12x50', 'M12×50'], ['M12x55', 'M12×55'], ['M16x60', 'M16×60'], ['M16x65', 'M16×65'], ['M20x75', 'M20×75']], 'M12x55'), P.finish],
    parts(p) { const holes = []; for (let i = 0; i < p.n; i++) { const a = (i + 0.5) / p.n * Math.PI * 2; holes.push([p.C / 2 * Math.cos(a), p.C / 2 * Math.sin(a)]); } const ri = p.od / 2 + 0.6; const area = Math.PI * ((p.D / 2) ** 2 - ri * ri - p.n * (p.hd / 2) ** 2);
      const parts = [{ kind: 'custom', custom: 'ring', name: `フランジ ${p.K} φ${p.od}`, ro: p.D / 2, ri, t: p.t, holes, holeD: p.hd, finish: p.finish, mass: area * p.t * STEEL, areaM2: 2 * area / 1e6, pl: XY([0, 0, -p.t / 2]), group: '本体' }]; if (p.bolts) for (const [x, y] of holes) parts.push(bolt(p.fb, XY([x, y, -p.t / 2]), { group: 'ボルト' })); parts.push(pipeRef(p.od)); return parts; } });
  reg({ id: 'long_nut', name: '長ナット・角ワッシャー', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'LN', icon: '⬡',
    params: [sel('type', '種類', [['long', '長ナット'], ['sqw', '角ワッシャー']], 'long'), sel('d', 'ねじ径', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['W5/8', 'W5/8'], ['M10', 'M10'], ['M12', 'M12'], ['M16', 'M16'], ['M20', 'M20']], 'W3/8'), num('af', '平径（二面幅）', 14), num('L', '長さ', 30), num('sq', '外角（角ワッシャー）', 32), num('t', '板厚（角ワッシャー）', 3.2), P.finish],
    parts(p) { const d = p.d === 'W5/8' ? 'M16' : p.d; const bore = boltDims(d).d; if (p.type === 'sqw') return [{ ...box(`角ワッシャー ${p.sq}×${p.t}`, p.sq, p.sq, p.t, p.finish, UP()), hole: bore + 1.5 }]; const R = p.af / Math.sqrt(3), ri = bore / 2; return [lathe(`長ナット ${p.d}×${p.L}`, [[ri, 0], [R, 0], [R, p.L], [ri, p.L], [ri, 0]], p.finish, UP(), (Math.sqrt(3) / 2 * p.af * p.af - Math.PI * ri * ri) * p.L * STEEL, { seg: 6 })]; } });
  // ---- ホッパー: 25 章 ----
  reg({ id: 'hopper', name: 'ホッパー（排水受け）', category: '板金', ifc: 'IfcPipeFitting', markPrefix: 'HP', icon: '⏷',
    params: [num('D', '受け口の径 Φ', 80), od(42.7), num('H', '全高 H', 80), num('C', '寸法 C（受け口のまっすぐな部分）', 30), num('E', '寸法 E（下の管の長さ）', 25), num('t', '板厚', 1.6), P.finish],
    parts(p) { const ro = p.od / 2, R = Math.max(p.D / 2, ro + 4), t = p.t; const yc = Math.max(p.E + 6, p.H - p.C); const prof = [[ro, 0], [ro, p.E], [R, yc], [R, p.H], [R - t, p.H], [R - t, yc + t * 0.4], [ro - t, p.E + t * 0.4], [ro - t, 0], [ro, 0]]; const sl = p.E + Math.hypot(R - ro, yc - p.E) + (p.H - yc); return [lathe(`ホッパー ${p.D}Φ`, prof, p.finish, UP(), 2 * Math.PI * (R + ro) / 2 * sl * t * STEEL)]; } });
}
