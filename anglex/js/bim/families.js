// ファミリ定義（Revit の「ファミリ → タイプ → インスタンス」）。各ファミリは params（型/インスタンス パラメータ）と
// parts(p) を持ち、parts は幾何（部材・板・ボルト・Uボルト・アンカー・溶接）と数量の単一ソース（single source of truth）。
// 3D・重量・見積・集計表はすべてこの parts から導かれる。
import { parseSpec, sectionOutline, sectionBox } from '../geo/profiles.js';
import { PIPES, UBOLTS, BOLTS, pipeOD } from '../data/sections.js';
import { boltDims } from '../geo/fasteners.js';

// ---------- 配置ユーティリティ ----------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const neg = a => mul(a, -1);
// 部材ローカル(長さ+Z, 断面XY) → 配置。 zDir: 長さ方向、xDir: 断面ローカル+X の向き。 Y = Z×X（右手系）
export function place(pos, zDir, xDir) { const z = norm(zDir), x = norm(xDir), y = cross(z, x); return { pos: [...pos], basis: [x, y, z] }; }
export function xform(pl, local) { const [x, y, z] = pl.basis; return add(pl.pos, add(add(mul(x, local[0]), mul(y, local[1])), mul(z, local[2]))); }
export function xdir(pl, local) { const [x, y, z] = pl.basis; return add(add(mul(x, local[0]), mul(y, local[1])), mul(z, local[2])); }
export const DIR = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1], NX: [-1, 0, 0], NY: [0, -1, 0], NZ: [0, 0, -1] };

// 共通パラメータ定義
const FINISH_OPTS = [['HDZ', '溶融亜鉛めっき（ドブ）'], ['HDZ35', '溶融亜鉛めっき HDZ35'], ['HDZ55', '溶融亜鉛めっき HDZ55'], ['EZ', '電気亜鉛めっき'], ['SUS304', 'ステンレス SUS304'], ['PAINT', 'サビ止め塗装'], ['BLACK', '黒皮（無処理）']];
const P = {
  finish: { key: 'finish', label: '仕上げ', type: 'select', options: FINISH_OPTS, default: 'HDZ', scope: 'type', group: '材料' },
  material: { key: 'material', label: '材質', type: 'select', options: [['SS400', 'SS400（一般構造用）'], ['SUS304', 'SUS304']], default: 'SS400', scope: 'type', group: '材料' },
  weldSize: { key: 'weldSize', label: '溶接脚長', type: 'length', unit: 'mm', default: 6, scope: 'type', group: '加工' },
  insul: { key: 'insul', label: '保温厚（U ボルト内径に加算）', type: 'length', default: 0, scope: 'instance', group: '配管', help: '保温・被覆のある配管は厚さ mm を入れると U ボルト径・穴ピッチ・配管高さが保温外径で決まる' },
  pipes: { key: 'pipes', label: '配管（呼び径@位置, カンマ区切り）', type: 'text', default: '50A', scope: 'instance', group: '配管', help: '例: 125A@120, 32A@300, 20A@420  位置省略で等配' },
  ubolt: { key: 'ubolt', label: 'Uボルト', type: 'bool', default: true, scope: 'type', group: '配管' },
  pipeKind: { key: 'pipeKind', label: '管種', type: 'select', options: [['SGP', 'SGP（白ガス管）'], ['SUS', 'SUS管'], ['VP', '塩ビ管 VP']], default: 'SGP', scope: 'instance', group: '配管' },
};
const num = (key, label, def, extra = {}) => ({ key, label, type: 'length', unit: 'mm', default: def, scope: 'type', group: '寸法', ...extra });
const int = (key, label, def, extra = {}) => ({ key, label, type: 'int', default: def, scope: 'type', group: '寸法', ...extra });
const sel = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, default: def, scope: 'type', group: '仕様', ...extra });
const bool = (key, label, def, extra = {}) => ({ key, label, type: 'bool', default: def, scope: 'type', group: '仕様', ...extra });
const spec = (key, label, def, extra = {}) => ({ key, label, type: 'spec', default: def, scope: 'type', group: '仕様', ...extra });

// 配管リスト解析: "125A@120, 32A@300" → [{nominal, od, x}]
export function parsePipes(str, span, kind = 'SGP') {
  const items = String(str || '').split(/[,、\s]+/).filter(Boolean).map(s => { const m = s.match(/^(\d+)(A|SU|mm)?(?:@(-?\d+(?:\.\d+)?))?$/i); if (!m) return null; const nominal = m[1] + 'A'; const od = pipeOD(m[1], kind === 'VP' ? 'VP' : 'SGP') || +m[1]; return { nominal, od, x: m[3] != null ? +m[3] : null, kind }; }).filter(Boolean);
  const free = items.filter(i => i.x == null); free.forEach((it, k) => { it.x = span * (k + 1) / (free.length + 1); });
  return items;
}
// 穴 DSL: "A:z50 s25 d12 slot25z; B:z150 s25 d12"  → [{face,z,s,d,slot}]
export function parseHoles(str) {
  const out = []; for (const seg of String(str || '').split(/[;\n]+/)) { const s = seg.trim(); if (!s) continue; const m = s.match(/^([A-Za-z]+)\s*[:：]\s*(.*)$/); const face = m ? m[1] : 'A'; const body = m ? m[2] : s; const h = { face, z: 0, s: 0, d: 12 }; let mm;
    if ((mm = body.match(/z\s*(-?\d+(?:\.\d+)?)/i))) h.z = +mm[1]; if ((mm = body.match(/s\s*(-?\d+(?:\.\d+)?)/i))) h.s = +mm[1]; if ((mm = body.match(/(?:d|φ)\s*(\d+(?:\.\d+)?)/i))) h.d = +mm[1]; if ((mm = body.match(/slot\s*(\d+(?:\.\d+)?)\s*([zs])?/i))) h.slot = { len: +mm[1], dir: (mm[2] || 'z').toLowerCase() };
    const rep = body.match(/x(\d+)\s*@\s*(\d+(?:\.\d+)?)/i); if (rep) { for (let i = 0; i < +rep[1]; i++) out.push({ ...h, z: h.z + i * +rep[2] }); } else out.push(h); }
  return out;
}
// 部材外周の全周隅肉溶接（端部）: 断面外形の各辺に沿ったビード。end: 'start'|'end'。n2 は基板面の法線（部材軸方向）
// 端部溶接 DSL: "start:6 site; end:6" → [{end,size,site}]
export function parseWelds(str) { const out = []; for (const seg of String(str || '').split(/[;\n]+/)) { const s = seg.trim(); if (!s) continue; const m = s.match(/^(start|end|始端|終端|両端|both)\s*[:：]?\s*(\d+(?:\.\d+)?)?\s*(site|現場)?/i); if (!m) continue; const size = m[2] ? +m[2] : 6; const site = !!m[3]; const e = m[1].toLowerCase(); if (e === 'both' || e === '両端') { out.push({ end: 'start', size, site }); out.push({ end: 'end', size, site }); } else out.push({ end: e === '始端' ? 'start' : e === '終端' ? 'end' : e, size, site }); } return out; }
export function endWelds(part, dsl) { const out = []; for (const w of parseWelds(dsl)) out.push(...outlineWeld(part, w.end, w.size, { site: w.site, group: `${part.name} ${w.end === 'end' ? '終端' : '始端'}全周` })); return out; }
export function outlineWeld(part, end, size, opts = {}) {
  const p = parseSpec(part.spec); if (!p) return []; const pts = sectionOutline(p); const L = part.length; const zE = end === 'end' ? L : 0; const axis = xdir(part.pl, DIR.Z); const n2 = end === 'end' ? neg(axis) : axis;
  const welds = []; const n = pts.length;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy); if (len < 0.5) continue; if (opts.skipShort && len < opts.skipShort) continue; const ne = norm([dy, -dx, 0]); // CCW 外形の外向き法線
    welds.push({ kind: 'weld', weldType: 'fillet', size, length: len, from: xform(part.pl, [a[0], a[1], zE]), to: xform(part.pl, [b[0], b[1], zE]), n1: xdir(part.pl, ne), n2, group: opts.group || part.name + ' 端部全周', allAround: true, site: !!opts.site, symbol: `${opts.site ? '▶' : ''}○▷${size}` }); }
  return welds;
}
// 直線隅肉: from/to（ワールド）, 面1法線 n1, 面2法線 n2, sides=2 なら反対側（n1 反転・板厚 offset）も
export function lineWeld(from, to, n1, n2, size, { sides = 1, thick = 0, group = '' } = {}) {
  const w = [{ kind: 'weld', weldType: 'fillet', size, length: Math.hypot(...add(to, neg(from))), from, to, n1, n2, group, symbol: `${sides === 2 ? '▷' : ''}▷${size}` }];
  if (sides === 2) { const off = mul(norm(n1), -thick); w.push({ ...w[0], from: add(from, off), to: add(to, off), n1: neg(n1) }); }
  return w;
}
const uboltFor = (od, nominal) => { const s = UBOLTS[nominal]; return s ? s.M : (od < 50 ? 'W3/8' : od < 120 ? 'W1/2' : od < 230 ? 'W5/8' : 'W3/4'); };
const uboltR = (od, nominal) => { const M = uboltFor(od, nominal); const b = boltDims(M); const s = UBOLTS[nominal]; return od / 2 + (s ? s.c : 3) + b.d / 2; };

// Uボルト + 配管 + 取付穴 を部材上面に生成。 topY: 取付面の y、x: 配管位置、zc: 配管中心 z、pipeDir: 配管軸（既定 Z）
function pipeSet(parts, pipesStr, span, { origin = [0, 0, 0], topY = 0, plateT = 6, pipeKind = 'SGP', pipeLen = 600, ubolt = true, insul = 0, holeTarget = null, holeFace = 'A', holeS = 0, holeFn = null, lenDir = DIR.X, group = '配管' } = {}) {
  const items = parsePipes(pipesStr, span, pipeKind); const result = [];
  for (const it of items) {
    const base = add(origin, mul(norm(lenDir), it.x)); const odE = it.od + 2 * (insul || 0); const nomE = insul ? it.nominal + '+' + insul : it.nominal; const cy = topY + uboltR(odE, nomE) - boltDims(uboltFor(odE, nomE)).d / 2; // 配管中心 = 取付面 + od/2 + c
    const pipeC = [base[0], cy, base[2]]; const pipeDir = cross(lenDir, DIR.Y); // 配管軸は部材長さ方向と直交（水平）
    parts.push({ kind: 'pipe', name: `配管 ${it.nominal}`, spec: pipeKind === 'VP' ? 'VP-' + it.nominal.replace('A', '') : 'SGP-' + it.nominal, length: pipeLen, finish: pipeKind === 'SUS' ? 'SUS304' : 'PIPE', pl: place(add(pipeC, mul(norm(pipeDir), -pipeLen / 2)), pipeDir, DIR.Y), ref: true, group, nominal: it.nominal, od: it.od, insul: insul || 0 });
    if (ubolt) { const M = uboltFor(odE, nomE); const R = uboltR(odE, nomE); parts.push({ kind: 'ubolt', name: `Uボルト ${M}（${it.nominal}${insul ? ' 保温' + insul : ''}）`, M, od: odE, nominal: it.nominal, insul: insul || 0, plateT, pl: place([base[0], topY, base[2]], pipeDir, lenDir), group, holeD: boltDims(M).hole, pitch: 2 * R });
      if (holeFn) holeFn(it, R, boltDims(M).hole); }
    result.push({ ...it, R: uboltR(odE, nomE) });
  }
  return result;
}

// ========================================================================================
export const FAMILIES = [];
// CAD 図面色の既定役割（ファミリ側のヒント）。インスタンスの cadRole（上書き） > role（ファミリ既定） > 名称判定
const ROLE_HINTS = { portal_frame: [[/柱/, 'column'], [/梁/, 'beam'], [/ベース/, 'base'], [/方杖|斜/, 'brace']], bracket_L: [[/腕/, 'beam'], [/縦|壁板/, 'column'], [/斜/, 'brace'], [/ベース/, 'base']], bracket_tri: [[/腕/, 'beam'], [/縦/, 'column'], [/斜/, 'brace']], hanger_support: [[/サポート材/, 'support']], channel_stand: [[/チャンネル/, 'support'], [/脚|縦/, 'column'], [/ベース/, 'base']], pole: [[/ポール/, 'column'], [/ベース/, 'base'], [/ブラケット/, 'beam']], frame_stand: [[/枠/, 'beam'], [/脚/, 'column'], [/ベース/, 'base']], ceiling_trapeze: [[/横材/, 'support']], guard: [[/支柱/, 'column'], [/横桟/, 'beam'], [/ベース/, 'base']], double_member: [[/部材/, 'beam']], slotted_angle: [[/フリーアングル/, 'support']], lip_channel: [[/フリーチャンネル/, 'support']] };
const reg = f => { const hints = ROLE_HINTS[f.id]; if (hints && f.parts) { const orig = f.parts; f.parts = function (p, ctx) { const parts = orig.call(this, p, ctx); for (const pt of parts) { if (pt.role || pt.ref || !['member', 'plate', 'pipe', 'custom'].includes(pt.kind)) continue; const n = `${pt.group || ''} ${pt.name || ''}`; const hit = hints.find(([re]) => re.test(n)); if (hit) pt.role = hit[1]; } return parts; }; } FAMILIES.push(f); return f; };

// ---- 1. 単材（形鋼・板・管） ----
reg({
  id: 'member', name: '単材（形鋼・平鋼・鋼管）', category: '部材', ifc: 'IfcMember', markPrefix: 'M', icon: 'L',
  params: [spec('spec', '鋼材仕様', 'L-50x50x6', { help: 'L-50x50x6 / [-75x40x5x7 / FB-6x50 / PL-6x100x200 / SGP-50A / □-50x50x2.3 / LC-40x40x1.6 / H-100x100x6x8' }),
    num('L', '長さ', 1000, { scope: 'instance' }), { key: 'holes', label: '穴（DSL）', type: 'text', default: '', scope: 'instance', group: '加工', help: 'A:z50 s25 d12 slot25z; B:z150 s25 d12 x3@100' },
    sel('axis', '配置軸', [['x', '水平 X'], ['y', '垂直 Y'], ['z', '水平 Z']], 'x', { scope: 'instance' }), { key: 'welds', label: '端部溶接（DSL）', type: 'text', default: '', scope: 'instance', group: '加工', help: 'start:6 site; end:6 （始端/終端 全周隅肉、site=現場）' }, P.material, P.finish],
  parts(p) { const zDir = p.axis === 'y' ? DIR.Y : p.axis === 'z' ? DIR.Z : DIR.X; const xDir = p.axis === 'y' ? DIR.X : p.axis === 'z' ? DIR.X : DIR.NZ; const m = { kind: 'member', name: p.spec, spec: p.spec, length: p.L, holes: parseHoles(p.holes), finish: p.finish, material: p.material, pl: place([0, 0, 0], zDir, xDir) }; return [m, ...endWelds(m, p.welds)]; },
});
// ---- 2. 板（穴パターン付き） ----
reg({
  id: 'plate', name: '鋼板（穴パターン）', category: '部材', ifc: 'IfcPlate', markPrefix: 'PL', icon: '▭',
  params: [num('t', '板厚', 6), num('W', '幅 W', 150), num('H', '長さ H', 150, { scope: 'instance' }), int('cols', '穴列数（W方向）', 2, { group: '加工' }), int('rows', '穴行数（H方向）', 2, { group: '加工' }), num('pitchW', '穴ピッチ W', 100, { group: '加工' }), num('pitchH', '穴ピッチ H', 100, { group: '加工' }), num('holeD', '穴径', 15, { group: '加工' }), num('slotLen', '長穴長さ（0=丸穴）', 0, { group: '加工' }), sel('slotDir', '長穴方向', [['z', 'H 方向'], ['s', 'W 方向']], 'z', { group: '加工' }), { key: 'welds', label: '端部溶接（DSL）', type: 'text', default: '', scope: 'instance', group: '加工', help: 'start:6 site; end:6' }, P.material, P.finish],
  parts(p) { const holes = []; const w0 = (p.W - (p.cols - 1) * p.pitchW) / 2, h0 = (p.H - (p.rows - 1) * p.pitchH) / 2; for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) holes.push({ face: 'face', z: h0 + r * p.pitchH, s: w0 + c * p.pitchW, d: p.holeD, slot: p.slotLen > p.holeD ? { len: p.slotLen, dir: p.slotDir } : null });
    const pl = { kind: 'plate', name: `PL-${p.t}×${p.W}×${p.H}`, spec: `PL-${p.t}x${p.W}x${p.H}`, length: p.H, holes, finish: p.finish, material: p.material, pl: place([0, 0, 0], DIR.Z, DIR.X) }; return [pl, ...endWelds(pl, p.welds)]; },
});
// ---- 3. 門型架台（ベース付 / なし） CH14_004 / 005 / 010, CH13_021〜024 ----
reg({
  id: 'portal_frame', name: '門型架台', category: '架台', ifc: 'IfcElementAssembly', markPrefix: 'MF', icon: 'Π',
  catalog: ['CH14_004', 'CH14_005', 'CH14_010', 'CH13_021', 'CH13_022', 'CH13_023', 'CH13_024'],
  params: [sel('profile', '柱・梁 形鋼', [['L', '山形鋼（アングル）'], ['C', '溝形鋼（チャンネル）']], 'L'), spec('colSpec', '柱 鋼材仕様', 'L-50x50x6'), spec('beamSpec', '梁 鋼材仕様', 'L-50x50x6'),
    num('W', '内寸法 W（柱内々）', 500, { scope: 'instance' }), num('H', '高さ H（床〜梁上端）', 600, { scope: 'instance' }), num('overhang', '梁 持出し（片側）', 0),
    bool('base', 'ベースプレート付', true), num('baseT', 'ベース板厚', 9), num('baseW', 'ベース幅', 150), num('baseD', 'ベース奥行', 150), sel('baseFix', 'ベース取付', [['weld', '工場溶接'], ['siteweld', '現場溶接（▶）'], ['bolt', 'ボルト止め']], 'weld'), sel('anchorM', 'アンカー', [['M10', 'M10'], ['M12', 'M12'], ['M16', 'M16']], 'M12'), int('anchorN', 'アンカー本数/枚', 2), bool('anchorDraw', 'アンカーを描画', true),
    P.pipes, P.insul, P.pipeKind, P.ubolt, P.weldSize, P.material, P.finish],
  parts(p) {
    const parts = []; const cs = parseSpec(p.colSpec), bs = parseSpec(p.beamSpec); const cb = sectionBox(cs), bb = sectionBox(bs);
    const colW = cb.w; // 柱の幅（断面 x）
    const beamLen = p.W + 2 * colW + 2 * p.overhang; const x0 = -p.W / 2 - colW, x1 = p.W / 2; // 柱外側位置
    const beamH = bs.kind === 'C' ? bs.H : bs.kind === 'L' ? bs.B : bb.h; const beamBottom = p.H - (bs.kind === 'C' ? (bs.B) : bs.kind === 'L' ? bs.B : bb.h); // 梁: Cは web 上向き（厚みB分下へ）, Lは水平脚上向き
    const colH = p.H - (bs.kind === 'C' ? bs.B : bs.kind === 'L' ? bs.B : bb.h) - (p.base ? p.baseT : 0); // 柱長さ
    const colBase = p.base ? p.baseT : 0;
    // 柱: 角を外側・脚は内向き。 左柱: 角 (x0, ., z0) 脚A→+X, 脚B→+Z? 柱は長さ Y、断面ローカル X→ワールド X、Y→ワールド Z
    const z0 = cb.h / 2; // 左柱: 断面Y → -Z なので z: +h/2 → -h/2、右柱は鏡像で -h/2 → +h/2（どちらも z=0 中心）
    const colL = { kind: 'member', name: '柱（左）', spec: p.colSpec, length: colH, finish: p.finish, material: p.material, holes: [], pl: place([x0, colBase, z0], DIR.Y, DIR.X), group: '柱' };
    const colR = { kind: 'member', name: '柱（右）', spec: p.colSpec, length: colH, finish: p.finish, material: p.material, holes: [], pl: place([x1 + colW, colBase, -z0], DIR.Y, DIR.NX), group: '柱' }; // 鏡像配置: X反転 → Y = Z×X = (0,1,0)×(-1,0,0) = (0,0,1)… 断面Yは +Z
    // 右柱の基底: zDir=Y, xDir=-X → yDir = Y×(-X) = +Z. 左柱: yDir = Y×X = -Z → 断面 y が -Z 方向。左右で対称
    parts.push(colL, colR);
    // 梁
    let beamPl;
    if (bs.kind === 'C') beamPl = place([x0 - p.overhang, p.H, -bs.H / 2], DIR.X, DIR.NY); // web 上面 y=H、フランジ下向き、H は Z 方向 → Y = X×(-Y) = -Z? cross([1,0,0],[0,-1,0]) = (0*0-0*(-1), 0*0-1*0, 1*(-1)-0) = (0,0,-1)
    else if (bs.kind === 'L') beamPl = place([x0 - p.overhang, p.H, bs.A / 2], DIR.X, DIR.NZ); // 脚A (ローカル+X) → -Z 水平、脚B → Y = X×(-Z) = (0*0-0*0... cross([1,0,0],[0,0,-1]) = (0*(-1)-0*0, 0*0-1*(-1), 0) = (0,1,0) → 上向き?? 脚Bを下向きにしたいので xDir を +Z にする
    else beamPl = place([x0 - p.overhang, p.H - bb.h, -bb.w / 2], DIR.X, DIR.NZ);
    if (bs.kind === 'L') beamPl = place([x0 - p.overhang, p.H, -bs.A / 2], DIR.X, DIR.Z); // 脚A → +Z、脚B: Y = X×Z = (0,-1,0) 下向き。脚A厚み(ローカル+Y) → -Y: 上面 y=H ✓
    if (bs.kind === 'C') beamPl = place([x0 - p.overhang, p.H, bs.H / 2], DIR.X, DIR.NY); // ウェブ厚み(ローカル+X)→ -Y: 上面 y=H ✓, 断面Y(高さH)→ Y=X×(-Y) = -Z ✓ z: H/2 .. -H/2
    const beam = { kind: 'member', name: '梁', spec: p.beamSpec, length: beamLen, finish: p.finish, material: p.material, holes: [], pl: beamPl, group: '梁' };
    parts.push(beam);
    // 配管 + Uボルト（梁上面）。Uボルト脚穴を梁の上面板に開ける
    const topFace = bs.kind === 'C' ? 'web' : bs.kind === 'L' ? 'A' : 'top';
    pipeSet(parts, p.pipes, beamLen, { origin: [x0 - p.overhang, p.H, 0], topY: p.H, plateT: bs.kind === 'C' ? bs.t1 : bs.t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: Math.max(400, Math.round((p.W + 2 * colW) * 0.9)), lenDir: DIR.X,
      holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) { const z = it.x + 0; const s = bs.kind === 'C' ? bs.H / 2 + sgn * R : bs.kind === 'L' ? bs.A / 2 + sgn * R : bb.w / 2 + sgn * R; beam.holes.push({ face: topFace, z, s, d: hole, kind: 'ubolt' }); } } });
    // 柱–梁 溶接（柱頭全周）
    for (const c of [colL, colR]) parts.push(...outlineWeld(c, 'end', p.weldSize, { group: '柱頭溶接' }));
    // ベースプレート + アンカー + 柱脚溶接
    if (p.base) {
      for (const [c, cx] of [[colL, x0 + colW / 2], [colR, x1 + colW / 2]]) {
        const bx = cx - p.baseW / 2, bz = -p.baseD / 2; const holes = []; const hd = (BOLTS[p.anchorM] || BOLTS.M12).hole + 2; // アンカー穴 = ボルト孔 +2
        const pts = p.anchorN >= 4 ? [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]] : [[0.5, 0.15], [0.5, 0.85]];
        for (const [fx, fz] of pts) holes.push({ face: 'face', z: fz * p.baseD, s: fx * p.baseW, d: hd, kind: 'anchor' });
        parts.push({ kind: 'plate', name: 'ベースPL', spec: `PL-${p.baseT}x${p.baseW}x${p.baseD}`, length: p.baseD, holes, finish: p.finish, material: p.material, pl: place([bx, 0, bz], DIR.Z, DIR.X), group: 'ベース' });
        if (p.baseFix === 'weld' || p.baseFix === 'siteweld') parts.push(...outlineWeld(c, 'start', p.weldSize, { group: p.baseFix === 'siteweld' ? '柱脚 現場溶接' : '柱脚溶接', site: p.baseFix === 'siteweld' }));
        else { for (const h of holes.slice(0, 2)) parts.push({ kind: 'bolt', name: `ボルト ${p.anchorM}`, M: p.anchorM, L: 35, pl: place([bx + h.s, p.baseT + 2, bz + h.z], DIR.NY, DIR.X), group: 'ベース' }); }
        if (p.anchorDraw) for (const h of holes) parts.push({ kind: 'anchor', name: `アンカー ${p.anchorM}`, M: p.anchorM, plateT: p.baseT, pl: place([bx + h.s, 0, bz + h.z], DIR.Y, DIR.X), group: 'アンカー', site: true });
      }
    }
    return parts;
  },
});
// ---- 4. L型ブラケット CH14_006 / CH14_015 / CH13_015 ----
reg({
  id: 'bracket_L', name: 'L型ブラケット', category: 'ブラケット', ifc: 'IfcElementAssembly', markPrefix: 'LB', icon: 'L',
  catalog: ['CH14_006', 'CH14_015', 'CH13_015', 'CH13_016', 'CH13_017'],
  params: [sel('profile', '形鋼', [['L', '山形鋼'], ['C', '溝形鋼'], ['FB', '平鋼']], 'L'), spec('spec', '鋼材仕様', 'L-50x50x6'), num('A', '腕長さ A（壁面〜先端）', 400, { scope: 'instance' }), num('H', '縦材高さ H', 300, { scope: 'instance' }),
    bool('gusset', '斜材（ブレース）', true), spec('gussetSpec', '斜材仕様', 'FB-6x50'), int('wallHoles', '壁アンカー穴数', 2, { group: '加工' }), num('wallHoleD', '壁穴径', 15, { group: '加工' }), num('wallSlot', '壁長穴長さ（0=丸穴）', 0, { group: '加工' }),
    P.pipes, P.insul, P.pipeKind, P.ubolt, P.weldSize, P.material, P.finish],
  parts(p) {
    const parts = []; const s = parseSpec(p.spec), sb = sectionBox(s); const w = sb.w, h = sb.h;
    // 壁面 = z=0 平面（ブラケットは +Z 側へ張り出す）。縦材: 長さ Y、背面が壁に接する
    const vert = { kind: 'member', name: '縦材', spec: p.spec, length: p.H, finish: p.finish, material: p.material, holes: [], pl: s.kind === 'C' ? place([-s.H / 2, 0, 0], DIR.Y, DIR.Z) : place([-w / 2, 0, 0], DIR.Y, DIR.X), group: '本体' };
    // 壁穴（縦材の壁側の板）: L なら脚A（厚みY→ ワールド Z 方向…）
    const wallFace = s.kind === 'C' ? 'web' : s.kind === 'L' ? 'A' : 'face'; const pitch = (p.H - 80) / Math.max(1, p.wallHoles - 1);
    for (let i = 0; i < p.wallHoles; i++) vert.holes.push({ face: wallFace, z: 40 + i * pitch, s: (s.kind === 'C' ? s.H : s.kind === 'L' ? s.A : s.w) / 2, d: p.wallHoleD, slot: p.wallSlot > p.wallHoleD ? { len: p.wallSlot, dir: 'z' } : null, kind: 'anchor' });
    // 腕: 長さ +Z、上面 y=H
    const armPl = s.kind === 'C' ? place([-s.H / 2, p.H, h], DIR.Z, DIR.NY) : s.kind === 'L' ? place([-s.A / 2, p.H, h], DIR.Z, DIR.X) : place([-s.w / 2, p.H - s.t, h], DIR.Z, DIR.X);
    const arm = { kind: 'member', name: '腕材', spec: p.spec, length: p.A - h, finish: p.finish, material: p.material, holes: [], pl: armPl, group: '本体' };
    if (s.kind === 'L') arm.pl = place([-s.A / 2, p.H, h], DIR.Z, DIR.X); // 脚A 水平（厚み +Y → Y: 上面 y=H+t）… 上面を H に揃える: 
    if (s.kind === 'L') arm.pl = place([-s.A / 2, p.H - s.t, h], DIR.Z, DIR.X); // 脚A 上面 = H。脚B: Y = Z×X = (0,1,0)… 上向き。下向きにしたい → xDir = -X で鏡像 → Y = Z×(-X) = -Y ✓
    if (s.kind === 'L') arm.pl = place([s.A / 2, p.H, h], DIR.Z, DIR.NX); // 脚A: ローカル+X→-X（x: A/2 → -A/2）、厚み(ローカル+Y)→ -Y: 上面 y=H ✓、脚B → -Y 下向き ✓
    parts.push(vert, arm);
    // 縦材–腕 溶接（腕の根元端面全周を縦材前面へ）
    parts.push(...outlineWeld(arm, 'start', p.weldSize, { group: '腕根元溶接' }));
    // 斜材
    if (p.gusset) { const gs = parseSpec(p.gussetSpec); const a = [0, 60, h], b = [0, p.H - (s.kind === 'L' ? s.B : h) - 10, p.A - 40]; const d = add(b, neg(a)); const len = Math.hypot(...d); const gPl = place([a[0] - (gs.w || 50) / 2, a[1], a[2]], d, DIR.X); parts.push({ kind: 'member', name: '斜材', spec: p.gussetSpec, length: len, finish: p.finish, material: p.material, holes: [], pl: gPl, group: '本体' }); const gpart = parts[parts.length - 1]; parts.push(...outlineWeld(gpart, 'start', p.weldSize, { group: '斜材溶接', skipShort: 7 }), ...outlineWeld(gpart, 'end', p.weldSize, { group: '斜材溶接', skipShort: 7 })); }
    // 配管 + Uボルト（腕上面）
    const topFace = s.kind === 'C' ? 'web' : s.kind === 'L' ? 'A' : 'face';
    pipeSet(parts, p.pipes, p.A - h, { origin: [0, p.H, h], topY: p.H, plateT: s.kind === 'C' ? s.t1 : s.t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 500, lenDir: DIR.Z, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) arm.holes.push({ face: topFace, z: it.x, s: (s.kind === 'C' ? s.H : s.kind === 'L' ? s.A : s.w) / 2 + sgn * R, d: hole, kind: 'ubolt' }); } });
    return parts;
  },
});
// ---- 5. 三角ブラケット CH14_007 / CH13_013 / 014 / ハンディブラケット ----
reg({
  id: 'bracket_tri', name: '三角ブラケット', category: 'ブラケット', ifc: 'IfcElementAssembly', markPrefix: 'TB', icon: '◺',
  catalog: ['CH14_007', 'CH13_010', 'CH13_011', 'CH13_012', 'CH13_013', 'CH13_014'],
  params: [spec('spec', '鋼材仕様', 'L-50x50x4'), num('A', '腕長さ A', 400, { scope: 'instance' }), num('H', '縦材高さ H', 350, { scope: 'instance' }), int('wallHoles', '壁穴数', 2, { group: '加工' }), num('wallHoleD', '壁穴径', 12, { group: '加工' }), int('armHoles', '腕 取付穴数', 3, { group: '加工' }), num('armHoleD', '腕穴径', 11, { group: '加工' }), P.pipes, P.insul, P.pipeKind, P.ubolt, P.weldSize, P.material, P.finish],
  parts(p) {
    const parts = []; const s = parseSpec(p.spec); const A = s.A || 50, t = s.t || 4;
    const vert = { kind: 'member', name: '縦材', spec: p.spec, length: p.H, finish: p.finish, material: p.material, holes: [], pl: place([-A / 2, 0, 0], DIR.Y, DIR.X), group: '本体' };
    const pitch = (p.H - 60) / Math.max(1, p.wallHoles - 1); for (let i = 0; i < p.wallHoles; i++) vert.holes.push({ face: 'A', z: 30 + i * pitch, s: A / 2, d: p.wallHoleD, kind: 'anchor' });
    const arm = { kind: 'member', name: '腕材', spec: p.spec, length: p.A - A, finish: p.finish, material: p.material, holes: [], pl: place([A / 2, p.H, A], DIR.Z, DIR.NX), group: '本体' };
    const ap = (p.A - A - 60) / Math.max(1, p.armHoles - 1); for (let i = 0; i < p.armHoles; i++) arm.holes.push({ face: 'A', z: 30 + i * ap, s: A / 2, d: p.armHoleD });
    parts.push(vert, arm, ...outlineWeld(arm, 'start', p.weldSize, { group: '腕溶接' }));
    const a = [0, 40, A], b = [0, p.H - A - 20, p.A - 30]; const d = add(b, neg(a)); const brace = { kind: 'member', name: '斜材', spec: p.spec, length: Math.hypot(...d), finish: p.finish, material: p.material, holes: [], pl: place([-A / 2, a[1], a[2]], d, DIR.X), group: '本体' };
    parts.push(brace, ...outlineWeld(brace, 'start', p.weldSize, { group: '斜材溶接', skipShort: 5 }), ...outlineWeld(brace, 'end', p.weldSize, { group: '斜材溶接', skipShort: 5 }));
    pipeSet(parts, p.pipes, p.A - A, { origin: [0, p.H, A], topY: p.H, plateT: t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 500, lenDir: DIR.Z, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) arm.holes.push({ face: 'A', z: it.x, s: A / 2 + sgn * R, d: hole, kind: 'ubolt' }); } });
    return parts;
  },
});
// ---- 6. 吊アングル / チャンネルサポート CH14_002 / 003 ----
reg({
  id: 'hanger_support', name: '吊アングル・チャンネルサポート', category: '吊り', ifc: 'IfcElementAssembly', markPrefix: 'HS', icon: '⊥',
  catalog: ['CH14_002', 'CH14_003'],
  params: [sel('profile', '形鋼', [['L', '山形鋼'], ['C', '溝形鋼']], 'L'), spec('spec', '鋼材仕様', 'L-40x40x5'), num('L', '長さ L', 600, { scope: 'instance' }), num('edge', '吊穴 端あき', 30, { group: '加工' }), sel('rodM', '吊ボルト', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M10', 'M10'], ['M12', 'M12']], 'W3/8'), num('rodSlot', '吊穴 長穴長さ', 25, { group: '加工' }), bool('rods', '吊ボルトを描画', true), num('rodL', '吊ボルト長さ', 500), P.pipes, P.insul, P.pipeKind, P.ubolt, P.material, P.finish],
  parts(p) {
    const parts = []; const s = parseSpec(p.spec); const b = boltDims(p.rodM);
    const pl = s.kind === 'C' ? place([0, 0, s.H / 2], DIR.X, DIR.NY) : place([0, 0, -s.A / 2], DIR.X, DIR.Z); // 上面 y=0 (配管載せ面)
    const mem = { kind: 'member', name: 'サポート材', spec: p.spec, length: p.L, finish: p.finish, material: p.material, holes: [], pl, group: '本体' };
    const face = s.kind === 'C' ? 'web' : 'A'; const mid = (s.kind === 'C' ? s.H : s.A) / 2;
    for (const z of [p.edge, p.L - p.edge]) mem.holes.push({ face, z, s: mid, d: b.hole, slot: p.rodSlot > b.hole ? { len: p.rodSlot, dir: 'z' } : null, kind: 'rod' });
    parts.push(mem);
    if (p.rods) for (const z of [p.edge, p.L - p.edge]) parts.push({ kind: 'rod', name: `吊ボルト ${p.rodM}`, M: p.rodM, L: p.rodL, pl: place([z, -(s.kind === 'C' ? s.t1 : s.t) - b.m - 4, 0], DIR.Y, DIR.X), group: '吊り', site: true });
    pipeSet(parts, p.pipes, p.L, { origin: [0, 0, 0], topY: 0, plateT: s.kind === 'C' ? s.t1 : s.t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 500, lenDir: DIR.X, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) mem.holes.push({ face, z: it.x, s: mid + sgn * R, d: hole, kind: 'ubolt' }); } });
    return parts;
  },
});
// ---- 7. 吊架台（天井用 / 梁用） CH14_011〜013 ----
reg({
  id: 'ceiling_trapeze', name: '吊架台（トラピーズ）', category: '吊り', ifc: 'IfcElementAssembly', markPrefix: 'CT', icon: '⊓',
  catalog: ['CH14_011', 'CH14_012', 'CH14_013'],
  params: [sel('profile', '形鋼', [['L', '山形鋼'], ['C', '溝形鋼']], 'L'), spec('spec', '鋼材仕様', 'L-50x50x6'), num('L', '横材長さ', 800, { scope: 'instance' }), int('tiers', '段数', 1), num('tierPitch', '段ピッチ', 300), sel('rodM', '吊ボルト', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M12', 'M12']], 'W1/2'), num('drop', '吊り長さ（天井〜最上段）', 600, { scope: 'instance' }), sel('mount', '取付', [['ceiling', '天井（インサート/アンカー）'], ['beam', '梁（ビームクランプ）']], 'ceiling'), num('edge', '吊穴 端あき', 40), P.pipes, P.insul, P.pipeKind, P.ubolt, P.material, P.finish],
  parts(p) {
    const parts = []; const s = parseSpec(p.spec); const b = boltDims(p.rodM); const face = s.kind === 'C' ? 'web' : 'A'; const mid = (s.kind === 'C' ? s.H : s.A) / 2;
    for (let k = 0; k < p.tiers; k++) {
      const y = -p.drop - k * p.tierPitch; const pl = s.kind === 'C' ? place([0, y, s.H / 2], DIR.X, DIR.NY) : place([0, y, -s.A / 2], DIR.X, DIR.Z);
      const mem = { kind: 'member', name: `横材 ${k + 1}段`, spec: p.spec, length: p.L, finish: p.finish, material: p.material, holes: [], pl, group: '本体' };
      for (const z of [p.edge, p.L - p.edge]) mem.holes.push({ face, z, s: mid, d: b.hole, kind: 'rod' });
      parts.push(mem);
      pipeSet(parts, p.pipes, p.L, { origin: [0, y, 0], topY: y, plateT: s.kind === 'C' ? s.t1 : s.t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 500, lenDir: DIR.X, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) mem.holes.push({ face, z: it.x, s: mid + sgn * R, d: hole, kind: 'ubolt' }); } });
      for (const z of [p.edge, p.L - p.edge]) { parts.push({ kind: 'nut', name: `ナット ${p.rodM}`, M: p.rodM, pl: place([z, y - (s.kind === 'C' ? s.t1 : s.t) - b.m, 0], DIR.Y, DIR.X), group: '吊り' }, { kind: 'nut', name: `ナット ${p.rodM}`, M: p.rodM, pl: place([z, y + 0.5, 0], DIR.Y, DIR.X), group: '吊り' }); }
    }
    const rodL = p.drop + (p.tiers - 1) * p.tierPitch + 60;
    for (const z of [p.edge, p.L - p.edge]) { parts.push({ kind: 'rod', name: `吊ボルト ${p.rodM}`, M: p.rodM, L: rodL, pl: place([z, -rodL + 10, 0], DIR.Y, DIR.X), group: '吊り', site: true }); if (p.mount === 'ceiling') parts.push({ kind: 'anchor', name: `インサート/アンカー ${p.rodM}`, M: b.alias || p.rodM, plateT: 0, pl: place([z, 0, 0], DIR.NY, DIR.X), group: '吊り', site: true }); }
    return parts;
  },
});
// ---- 8. 枠架台 CH14_014 ----
reg({
  id: 'frame_stand', name: '枠架台（アングル枠）', category: '架台', ifc: 'IfcElementAssembly', markPrefix: 'FS', icon: '▢',
  catalog: ['CH14_014'],
  params: [spec('spec', '鋼材仕様', 'L-50x50x6'), num('W', '幅 W（外々）', 800, { scope: 'instance' }), num('D', '奥行 D（外々）', 600, { scope: 'instance' }), num('H', '脚高さ H（0=枠のみ）', 300, { scope: 'instance' }), bool('base', '脚ベースPL', true), num('baseT', 'ベース板厚', 6), num('baseW', 'ベース寸法', 100), int('holesPerSide', '上面 取付穴/辺', 2, { group: '加工' }), num('holeD', '穴径', 12, { group: '加工' }), P.weldSize, P.material, P.finish],
  parts(p) {
    const parts = []; const s = parseSpec(p.spec); const A = s.A; const y = p.H;
    // 枠: 4本の L。脚A 上面水平（上面 y=H+? ）、脚B 外側垂直下向き。
    const edges = [{ name: '枠（前）', from: [0, y, 0], to: [p.W, y, 0], out: DIR.NZ }, { name: '枠（後）', from: [p.W, y, p.D], to: [0, y, p.D], out: DIR.Z }, { name: '枠（左）', from: [0, y, p.D], to: [0, y, 0], out: DIR.NX }, { name: '枠（右）', from: [p.W, y, 0], to: [p.W, y, p.D], out: DIR.X }];
    const mems = [];
    for (const e of edges) { const d = add(e.to, neg(e.from)); const len = Math.hypot(...d) - A; const dir = norm(d); const start = add(e.from, mul(dir, A / 2)); // 留め継ぎ簡略: 各辺を A 短縮
      const inward = neg(e.out); const m = { kind: 'member', name: e.name, spec: p.spec, length: len, finish: p.finish, material: p.material, holes: [], pl: place([start[0] + e.out[0] * A / 2, y, start[2] + e.out[2] * A / 2], dir, inward), group: '枠' }; // 脚A: ローカル+X → 内向き（水平）、厚み(+Y) → Y = dir×inward
      // dir×inward が +Y か -Y かで上下が決まる。上面を y=H に揃える: Y が -Y なら pos.y = y, +Y なら pos.y = y - t
      const Y = cross(dir, inward); if (Y[1] > 0) { m.pl = place([start[0] + e.out[0] * A / 2, y - s.t, start[2] + e.out[2] * A / 2], dir, inward); }
      // Y が +Y のとき脚Bは上向きになってしまう → 鏡像: xDir を外向きにして Y = dir×out = -Y
      if (Y[1] > 0) { m.pl = place([start[0] - e.out[0] * A / 2, y, start[2] - e.out[2] * A / 2], dir, e.out); }
      const n = p.holesPerSide; for (let i = 0; i < n; i++) m.holes.push({ face: 'A', z: len * (i + 1) / (n + 1), s: A / 2, d: p.holeD });
      mems.push(m); parts.push(m);
    }
    // 角の溶接（簡略: 各部材端面の脚B縦辺）
    for (const m of mems) for (const end of ['start', 'end']) parts.push(...outlineWeld(m, end, p.weldSize, { group: '枠角溶接', skipShort: 7 }));
    if (p.H > 0) { const bt = p.base ? p.baseT : 0; for (const [cx, cz, xd] of [[0, 0, DIR.X], [p.W, 0, DIR.NX], [0, p.D, DIR.X], [p.W, p.D, DIR.NX]]) { const leg = { kind: 'member', name: '脚', spec: p.spec, length: p.H - s.t - bt, finish: p.finish, material: p.material, holes: [], pl: place([cx + (xd[0] > 0 ? 0 : 0), bt, cz + (cz === 0 ? 0 : -A)], DIR.Y, xd), group: '脚' };
      if (xd[0] < 0) leg.pl = place([cx, bt, cz + (cz === 0 ? A : 0)], DIR.Y, DIR.NX); // 鏡像 → 断面 Y: Y×(-X) = +Z
      parts.push(leg, ...outlineWeld(leg, 'end', p.weldSize, { group: '脚頭溶接' }));
      if (p.base) { parts.push({ kind: 'plate', name: 'ベースPL', spec: `PL-${p.baseT}x${p.baseW}x${p.baseW}`, length: p.baseW, holes: [{ face: 'face', z: p.baseW / 2, s: p.baseW / 2, d: 15, kind: 'anchor' }], finish: p.finish, material: p.material, pl: place([cx - p.baseW / 2 + (xd[0] > 0 ? A / 2 : -A / 2), 0, cz - p.baseW / 2 + (cz === 0 ? A / 2 : -A / 2)], DIR.Z, DIR.X), group: 'ベース' }, ...outlineWeld(leg, 'start', p.weldSize, { group: '脚ベース溶接' })); } } }
    return parts;
  },
});
// ---- 9. チャンネル君（床・立て配管用架台） CH13_018/019 ----
reg({
  id: 'channel_stand', name: 'チャンネル架台（チャンネル君）', category: '架台', ifc: 'IfcMember', markPrefix: 'CS', icon: '⊏',
  catalog: ['CH13_018', 'CH13_019'],
  params: [spec('spec', '鋼材仕様', '[-100x50x5x7.5'), num('L', '長さ', 300, { scope: 'instance' }), int('slots', '長穴数', 2, { group: '加工' }), num('slotLen', '長穴長さ', 30, { group: '加工' }), num('slotD', '長穴幅', 12, { group: '加工' }), P.pipes, P.insul, P.pipeKind, P.ubolt, P.material, P.finish],
  parts(p) { const parts = []; const s = parseSpec(p.spec); const mem = { kind: 'member', name: 'チャンネル', spec: p.spec, length: p.L, finish: p.finish, material: p.material, holes: [], pl: place([0, 0, s.H / 2], DIR.X, DIR.NY), group: '本体' };
    for (let i = 0; i < p.slots; i++) mem.holes.push({ face: 'web', z: p.L * (i + 1) / (p.slots + 1), s: s.H / 2, d: p.slotD, slot: { len: p.slotLen, dir: 'z' }, kind: 'anchor' });
    parts.push(mem); pipeSet(parts, p.pipes, p.L, { origin: [0, 0, 0], topY: 0, plateT: s.t1, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 400, lenDir: DIR.X, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) mem.holes.push({ face: 'web', z: it.x, s: s.H / 2 + sgn * R, d: hole, kind: 'ubolt' }); } }); return parts; },
});
// ---- 10. ポール CH14_019 / 020 ----
reg({
  id: 'pole', name: 'アングル／チャンネルポール', category: '架台', ifc: 'IfcElementAssembly', markPrefix: 'PO', icon: '|',
  catalog: ['CH14_019', 'CH14_020'],
  params: [spec('spec', 'ポール鋼材', 'L-65x65x6'), num('H', '高さ', 1800, { scope: 'instance' }), num('baseT', 'ベース板厚', 9), num('baseW', 'ベース寸法', 200), int('brackets', 'ブラケット段数', 2), num('bracketPitch', 'ブラケットピッチ', 600), num('bracketL', 'ブラケット長さ', 300), spec('bracketSpec', 'ブラケット鋼材', 'L-50x50x6'), P.pipes, P.insul, P.pipeKind, P.ubolt, P.weldSize, P.material, P.finish],
  parts(p) { const parts = []; const s = parseSpec(p.spec); const sb = sectionBox(s); const pole = { kind: 'member', name: 'ポール', spec: p.spec, length: p.H - p.baseT, finish: p.finish, material: p.material, holes: [], pl: place([-sb.w / 2, p.baseT, -sb.h / 2], DIR.Y, DIR.X), group: '本体' };
    parts.push(pole, { kind: 'plate', name: 'ベースPL', spec: `PL-${p.baseT}x${p.baseW}x${p.baseW}`, length: p.baseW, holes: [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([a, b]) => ({ face: 'face', z: b * p.baseW, s: a * p.baseW, d: 15, kind: 'anchor' })), finish: p.finish, material: p.material, pl: place([-p.baseW / 2, 0, -p.baseW / 2], DIR.Z, DIR.X), group: 'ベース' }, ...outlineWeld(pole, 'start', p.weldSize, { group: 'ポール脚溶接' }));
    for (const [a, b] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) parts.push({ kind: 'anchor', name: 'アンカー M12', M: 'M12', plateT: p.baseT, pl: place([(a - 0.5) * p.baseW, 0, (b - 0.5) * p.baseW], DIR.Y, DIR.X), group: 'アンカー', site: true });
    const bsp = parseSpec(p.bracketSpec); for (let k = 0; k < p.brackets; k++) { const y = p.H - 100 - k * p.bracketPitch; const arm = { kind: 'member', name: `ブラケット ${k + 1}`, spec: p.bracketSpec, length: p.bracketL, finish: p.finish, material: p.material, holes: [], pl: place([sb.w / 2, y, bsp.A / 2], DIR.X, DIR.NZ), group: 'ブラケット' };
      // 脚A上面 = y: 脚A厚み(+Y) → Y = X×(-Z) = (0,1,0)… 上向き → pos.y = y - t。脚Bは +Y … 下向きに: xDir=+Z → Y = X×Z = -Y ✓
      arm.pl = place([sb.w / 2, y, -bsp.A / 2], DIR.X, DIR.Z);
      parts.push(arm, ...outlineWeld(arm, 'start', p.weldSize, { group: 'ブラケット溶接' }));
      pipeSet(parts, p.pipes, p.bracketL, { origin: [sb.w / 2, y, 0], topY: y, plateT: bsp.t, pipeKind: p.pipeKind, insul: p.insul || 0, ubolt: p.ubolt, pipeLen: 400, lenDir: DIR.X, holeFn: (it, R, hole) => { for (const sgn of [-1, 1]) arm.holes.push({ face: 'A', z: it.x, s: bsp.A / 2 + sgn * R, d: hole, kind: 'ubolt' }); } }); }
    return parts; },
});
// ---- 11. ダブルアングル / ダブルチャンネル CH14_017 / 018 ----
reg({
  id: 'double_member', name: 'ダブルアングル／ダブルチャンネル', category: '部材', ifc: 'IfcElementAssembly', markPrefix: 'DM', icon: '‖',
  catalog: ['CH14_017', 'CH14_018'],
  params: [spec('spec', '鋼材仕様', 'L-50x50x6'), num('L', '長さ', 1200, { scope: 'instance' }), num('gap', '間隔（吊ボルト通し幅）', 14), int('spacers', 'スペーサー数', 3), num('spacerT', 'スペーサー板厚', 12), sel('boltM', '連結ボルト', [['M10', 'M10'], ['M12', 'M12']], 'M10'), num('edge', '端あき', 50), P.material, P.finish],
  parts(p) { const parts = []; const s = parseSpec(p.spec); const sb = sectionBox(s); const g = p.gap;
    const a = { kind: 'member', name: '部材 A', spec: p.spec, length: p.L, finish: p.finish, material: p.material, holes: [], pl: place([0, 0, -g / 2], DIR.X, DIR.NZ), group: '本体' }; // 脚A(+X)→ -Z: 背中合わせで脚Bが外側… 脚Bは Y: X×(-Z)=+Y 上向き
    const b = { kind: 'member', name: '部材 B', spec: p.spec, length: p.L, finish: p.finish, material: p.material, holes: [], pl: place([0, 0, g / 2], DIR.X, DIR.Z), group: '本体' }; // 鏡像: Y = X×Z = -Y → 下向き… 上向きに揃えるには pos.y 調整:
    b.pl = place([0, sb.h, g / 2], DIR.X, DIR.Z); // 脚B は -Y 方向へ h → y: h..0 ✓ 上面揃え: 脚A厚み(+Y)→ -Y: 脚A上面 y=h… 不揃い。簡略: A を y: 0..h, B を y: 0..h になるよう B の原点 y=h（厚み下向き）… 脚Aは y=h-t..h。A の脚Aは y 0..t。対称にするには A も上面基準に: 
    a.pl = place([0, sb.h - s.t, -g / 2], DIR.X, DIR.NZ); b.pl = place([0, sb.h, g / 2], DIR.X, DIR.Z);
    const bd = boltDims(p.boltM); const pitch = (p.L - 2 * p.edge) / Math.max(1, p.spacers - 1);
    for (let i = 0; i < p.spacers; i++) { const x = p.spacers === 1 ? p.L / 2 : p.edge + i * pitch; a.holes.push({ face: 'B', z: x, s: sb.h / 2, d: bd.hole }); b.holes.push({ face: 'B', z: x, s: sb.h / 2, d: bd.hole });
      parts.push({ kind: 'plate', name: 'スペーサー', spec: `PL-${g}x${p.spacerT * 2}x${sb.h - 10}`, length: sb.h - 10, holes: [{ face: 'face', z: (sb.h - 10) / 2, s: p.spacerT, d: bd.hole }], finish: p.finish, material: p.material, pl: place([x - p.spacerT, sb.h - 5, -g / 2], DIR.NY, DIR.X), group: 'スペーサー' }, { kind: 'bolt', name: `ボルト ${p.boltM}`, M: p.boltM, L: Math.round((g + 2 * s.t + 2 * bd.wt + bd.m + 6) / 5) * 5, pl: place([x, sb.h / 2, -g / 2 - s.t - bd.wt], DIR.Z, DIR.X), group: 'ボルト' }); }
    parts.push(a, b); return parts; },
});
// ---- 12. スリーブ（鉄管 / 塩ビ） CH14_008 / 009 ----
reg({
  id: 'sleeve', name: 'スリーブ（つば付き鉄管 / 塩ビ）', category: 'スリーブ', ifc: 'IfcPipeSegment', markPrefix: 'SL', icon: '◎',
  catalog: ['CH14_008', 'CH14_009'],
  params: [sel('kind', '種類', [['steel', '鉄管スリーブ（SGP）'], ['pvc', '塩ビスリーブ（VU）']], 'steel'), sel('nominal', '呼び径', Object.keys(PIPES).filter(k => +k.replace('A', '') >= 50).map(k => [k, k]), '100A'), num('L', '長さ L（スラブ/壁厚）', 200, { scope: 'instance' }), sel('specKind', '仕様', [['public', '公共仕様（つば 6t×50W 片面全周溶接）'], ['standard', '標準仕様（つば 3.2t×50W）']], 'public'), num('collarPos', 'つば位置（端から）', 100, { scope: 'instance' }), bool('fixPiece', '固定ピース', false), P.finish],
  parts(p) { const parts = []; const pipe = PIPES[p.nominal]; const t = p.specKind === 'public' ? 6 : 3.2;
    if (p.kind === 'pvc') { parts.push({ kind: 'pipe', name: `塩ビスリーブ VU${p.nominal.replace('A', '')}`, spec: `VP-${p.nominal.replace('A', '')}`, length: p.L, finish: 'PVC', material: 'PVC', pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' }); return parts; }
    const body = { kind: 'pipe', name: `鉄管スリーブ SGP ${p.nominal}`, spec: 'SGP-' + p.nominal, length: p.L, finish: p.finish === 'HDZ' ? 'PAINT' : p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' };
    const collarOD = pipe.od + 100; parts.push(body, { kind: 'custom', name: `防水つば PL-${t}×${collarOD}φ`, custom: 'ring', ro: collarOD / 2, ri: pipe.od / 2, t, finish: p.finish === 'HDZ' ? 'PAINT' : p.finish, mass: Math.PI * (Math.pow(collarOD / 2, 2) - Math.pow(pipe.od / 2, 2)) * t * 7.85e-6, areaM2: 2 * Math.PI * (Math.pow(collarOD / 2, 2) - Math.pow(pipe.od / 2, 2)) / 1e6, pl: place([0, p.collarPos, 0], DIR.Y, DIR.X), group: 'つば' });
    // つば溶接（片面全周）: 管外周に沿う円周ビード → 36 分割
    const n = 36; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const r = pipe.od / 2; parts.push({ kind: 'weld', weldType: 'fillet', size: 6, length: r * (a1 - a0), from: [Math.cos(a0) * r, p.collarPos + t, Math.sin(a0) * r], to: [Math.cos(a1) * r, p.collarPos + t, Math.sin(a1) * r], n1: [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], n2: DIR.Y, group: 'つば溶接', allAround: true }); }
    if (p.fixPiece) for (const a of [0, Math.PI]) parts.push({ kind: 'member', name: '固定ピース FB-6x25', spec: 'FB-6x25', length: 80, finish: p.finish, material: 'SS400', holes: [{ face: 'face', z: 65, s: 12.5, d: 9 }], pl: place([Math.cos(a) * (collarOD / 2 - 10), p.collarPos + t, Math.sin(a) * (collarOD / 2 - 10)], [Math.cos(a), 0, Math.sin(a)], DIR.Y), group: '固定ピース' });
    return parts; },
});
// ---- 13. 両フランジ管 CH14_022 ----
reg({
  id: 'flanged_pipe', name: '両フランジ管', category: 'スリーブ', ifc: 'IfcPipeSegment', markPrefix: 'FP', icon: '⊢⊣',
  catalog: ['CH14_022'],
  params: [sel('nominal', '呼び径', Object.keys(PIPES).filter(k => +k.replace('A', '') >= 25).map(k => [k, k]), '100A'), num('L', '面間長さ', 500, { scope: 'instance' }), sel('flange', 'フランジ規格', [['JIS10K', 'JIS 10K'], ['JIS5K', 'JIS 5K']], 'JIS10K'), P.finish],
  parts(p) { const pipe = PIPES[p.nominal]; const parts = []; const fl = { '25A': [125, 4, 75, 19], '32A': [135, 4, 90, 19], '40A': [140, 4, 95, 19], '50A': [155, 4, 120, 19], '65A': [175, 4, 140, 19], '80A': [185, 8, 150, 19], '100A': [210, 8, 175, 19], '125A': [250, 8, 210, 23], '150A': [280, 8, 240, 23], '200A': [330, 12, 290, 23], '250A': [400, 12, 355, 25], '300A': [445, 16, 400, 25] }[p.nominal] || [210, 8, 175, 19]; const [D, n, pcd, hd] = fl; const t = 18;
    parts.push({ kind: 'pipe', name: `鋼管 ${p.nominal}`, spec: 'SGP-' + p.nominal, length: p.L - 2 * t, finish: p.finish, material: 'SS400', pl: place([0, 0, t], DIR.Z, DIR.X), group: '本体' });
    for (const z of [0, p.L - t]) { const holes = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / n; holes.push([Math.cos(a) * pcd / 2, Math.sin(a) * pcd / 2]); } parts.push({ kind: 'custom', name: `フランジ ${p.flange} ${p.nominal}`, custom: 'ring', ro: D / 2, ri: pipe.od / 2, t, holes, holeD: hd, finish: p.finish, mass: (Math.PI * (D * D - pipe.od * pipe.od) / 4 - n * Math.PI * hd * hd / 4) * t * 7.85e-6, areaM2: 2 * Math.PI * (D * D - pipe.od * pipe.od) / 4 / 1e6, pl: place([0, 0, z], DIR.Z, DIR.X), group: 'フランジ' });
      const r = pipe.od / 2; const m = 24; const zz = z === 0 ? t : z; const nz = z === 0 ? 1 : -1; for (let i = 0; i < m; i++) { const a0 = i / m * Math.PI * 2, a1 = (i + 1) / m * Math.PI * 2; parts.push({ kind: 'weld', weldType: 'fillet', size: 6, length: r * (a1 - a0), from: [Math.cos(a0) * r, Math.sin(a0) * r, zz], to: [Math.cos(a1) * r, Math.sin(a1) * r, zz], n1: [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0], n2: [0, 0, nz], group: 'フランジ溶接', allAround: true }); } }
    return parts; },
});
// ---- 14. 鉄板加工（一般・チェッカー・エキスパンド・ドレンパン・止水鉄板） ----
reg({
  id: 'plate_work', name: '鉄板加工（曲げ・ドレンパン・止水板）', category: '板金', ifc: 'IfcPlate', markPrefix: 'PW', icon: '▱',
  catalog: ['CH14_021', 'CH14_023', 'CH14_024', 'CH14_025', 'CH14_026', 'CH14_027', 'CH14_028'],
  params: [sel('kind', '種類', [['general', '一般鉄板（穴あけ）'], ['checker', 'チェッカープレート'], ['expanded', 'エキスパンドメタル'], ['drainpan', 'ドレンパン（4辺曲げ）'], ['waterstop', '止水鉄板（つば付）']], 'general'), num('t', '板厚', 4.5), num('W', '幅', 600, { scope: 'instance' }), num('D', '奥行', 400, { scope: 'instance' }), num('lip', '立上り高さ', 50), int('holes', '穴数（周囲）', 4, { group: '加工' }), num('holeD', '穴径', 12, { group: '加工' }), P.material, P.finish],
  parts(p) { const parts = []; const holes = []; const n = p.holes; const per = 2 * (p.W + p.D); for (let i = 0; i < n; i++) { let d = per * (i + 0.5) / n; let x, z; if (d < p.W) { x = d; z = 30; } else if (d < p.W + p.D) { x = p.W - 30; z = d - p.W; } else if (d < 2 * p.W + p.D) { x = 2 * p.W + p.D - d; z = p.D - 30; } else { x = 30; z = per - d; } holes.push({ face: 'face', z: Math.min(p.D - 15, Math.max(15, z)), s: Math.min(p.W - 15, Math.max(15, x)), d: p.holeD }); }
    const finish = p.kind === 'expanded' ? p.finish : p.finish; parts.push({ kind: 'plate', name: p.kind === 'checker' ? `縞鋼板 t${p.t}` : p.kind === 'expanded' ? `エキスパンドメタル XS` : `鋼板 PL-${p.t}`, spec: `PL-${p.t}x${p.W}x${p.D}`, length: p.D, holes: p.kind === 'drainpan' ? [] : holes, finish, material: p.material, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体', pattern: p.kind });
    if (p.kind === 'drainpan' || p.kind === 'waterstop') { const h = p.lip; const sides = [[[0, p.t, 0], DIR.X, p.W, DIR.NZ], [[p.W, p.t, p.D], DIR.NX, p.W, DIR.Z], [[0, p.t, p.D], DIR.NZ, p.D, DIR.NX], [[p.W, p.t, 0], DIR.Z, p.D, DIR.X]]; for (const [o, dir, len, out] of sides) { parts.push({ kind: 'plate', name: '立上り', spec: `PL-${p.t}x${h}x${len}`, length: len, holes: [], finish, material: p.material, pl: place(p.kind === 'waterstop' ? add(o, [out[0] * 0, 0, out[2] * 0]) : o, dir, DIR.Y), group: '曲げ' }); parts.push(...lineWeld(o, add(o, mul(dir, len)), out, DIR.Y, 3, { group: '隅溶接' })); } }
    return parts; },
});
// ---- 15. 吊バンド（タン付） / 立バンド / 被覆銅管バンド  CH01 ----
const BAND_SKU = { key: 'sku', label: '呼び径（SKU）', type: 'sku', default: '', scope: 'type', group: '仕様' };
reg({
  id: 'hanger_band', name: '吊バンド（タン付）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'HB', icon: '◯',
  params: [num('od', '適合配管径（外径）', 60.5), num('t', '帯厚 t', 2.0), num('B', '帯幅 B', 25), sel('d', '吊ボルト径 d', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M10', 'M10']], 'W3/8'), num('C', 'タン幅 C', 26), num('H', 'タン高さ H（管上端〜吊穴中心）', 100), sel('bolt', '締付ボルト', [['M6x20', 'M6×20'], ['M6x25', 'M6×25'], ['M8x25', 'M8×25'], ['M8x30', 'M8×30'], ['M10x35', 'M10×35'], ['M12x45', 'M12×45']], 'M8x25'), num('rubber', 'ゴム厚（0=なし）', 0), bool('rodDraw', '吊ボルトを描画', true), num('rodL', '吊ボルト長', 400, { scope: 'instance' }), P.finish],
  parts(p) { const r = p.od / 2 + (p.rubber || 0); const strapLen = Math.PI * 2 * (r + p.t / 2) + 2 * 20 + 2 * p.H * 0.6; const massStrap = strapLen * p.B * p.t * 7.85e-6; const bolt = p.bolt.split('x'); const bm = fastenerKey(bolt[0]); const b = boltDims(p.d);
    const parts = [{ kind: 'custom', custom: 'band', name: `吊バンド ${p.od}φ`, od: p.od, t: p.t, B: p.B, C: p.C, H: p.H, rubber: p.rubber, mass: massStrap, areaM2: 2 * strapLen * p.B / 1e6, finish: p.finish, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' },
      { kind: 'bolt', name: `締付ボルト ${bolt[0]}×${bolt[1]}`, M: bm, L: +bolt[1], pl: place([0, -(r + p.t + 6), -(p.B / 2 + 8)], DIR.Z, DIR.X), group: '締付', qty: 1 },
      { kind: 'nut', name: `吊ナット ${p.d}`, M: p.d, pl: place([0, r + p.t + p.H - b.m - 1, 0], DIR.Y, DIR.X), group: '吊り' }];
    if (p.rodDraw) parts.push({ kind: 'rod', name: `吊ボルト ${p.d}`, M: p.d, L: p.rodL, pl: place([0, r + p.t + p.H - 10, 0], DIR.Y, DIR.X), group: '吊り', site: true });
    parts.push({ kind: 'pipe', name: `配管 φ${p.od}`, spec: `PIPE-${p.od}x${Math.max(2, Math.round(p.od * 0.06 * 10) / 10)}`, length: 300, finish: 'PIPE', ref: true, pl: place([0, 0, -150], DIR.Z, DIR.X), group: '配管' });
    return parts; },
});
function fastenerKey(s) { const m = String(s).match(/M\s*(\d+)/i); return m ? 'M' + m[1] : 'M8'; }
reg({
  id: 'stand_band', name: '立バンド（Uバンド）', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'SB', icon: '∪',
  params: [num('od', '適合配管径（外径）', 60.5), num('t', '帯厚 t', 2.0), num('B', '帯幅 B', 25), num('L1', '脚 L1', 14), num('L2', '脚 L2', 7), num('H', '高さ H', 73), sel('bolt', '締付ボルト', [['M6x20', 'M6×20'], ['M6x25', 'M6×25'], ['M8x25', 'M8×25'], ['M8x30', 'M8×30']], 'M6x25'), P.finish],
  parts(p) { const r = p.od / 2; const strapLen = Math.PI * (r + p.t / 2) + 2 * p.H + 2 * p.L1 + 2 * p.L2; const bolt = p.bolt.split('x');
    return [{ kind: 'custom', custom: 'uband', name: `立バンド ${p.od}φ`, od: p.od, t: p.t, B: p.B, H: p.H, L1: p.L1, L2: p.L2, mass: strapLen * p.B * p.t * 7.85e-6, areaM2: 2 * strapLen * p.B / 1e6, finish: p.finish, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }, { kind: 'bolt', name: `締付ボルト ${bolt[0]}×${bolt[1]}`, M: fastenerKey(bolt[0]), L: +bolt[1], pl: place([0, r + p.t + 8, -(p.B / 2 + 8)], DIR.Z, DIR.X), group: '締付' }, { kind: 'pipe', name: `配管 φ${p.od}`, spec: `PIPE-${p.od}x${Math.max(2, Math.round(p.od * 0.06 * 10) / 10)}`, length: 300, finish: 'PIPE', ref: true, pl: place([0, 0, -150], DIR.Z, DIR.X), group: '配管' }]; },
});
reg({ id: 'insulated_band', name: '被覆銅管用吊バンド', category: 'バンド', ifc: 'IfcMechanicalFastener', markPrefix: 'IB', icon: '◎', params: [num('od', '被覆外径', 40), num('t', '帯厚', 1.2), num('B', '帯幅', 25), num('H', 'タン高さ', 60), sel('d', '吊ボルト径', [['W3/8', 'W3/8'], ['M10', 'M10']], 'W3/8'), P.finish],
  parts(p) { const r = p.od / 2; const strapLen = Math.PI * 2 * (r + p.t / 2) + 2 * p.H; return [{ kind: 'custom', custom: 'band', name: `被覆銅管吊バンド ${p.od}φ`, od: p.od, t: p.t, B: p.B, C: 24, H: p.H, rubber: 0, mass: strapLen * p.B * p.t * 7.85e-6, areaM2: 2 * strapLen * p.B / 1e6, finish: p.finish, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }, { kind: 'nut', name: `吊ナット ${p.d}`, M: p.d, pl: place([0, r + p.t + p.H - 9, 0], DIR.Y, DIR.X), group: '吊り' }, { kind: 'custom', custom: 'cylinder', name: '被覆銅管', r: p.od / 2, L: 300, finish: 'RUBBER', mass: 0, ref: true, pl: place([0, 0, -150], DIR.Z, DIR.X), group: '配管' }]; } });
// ---- 16. フリーアングル / フリーチャンネル（スロット付） CH13_001〜003, 035〜040 ----
reg({
  id: 'slotted_angle', name: 'フリーアングル（スロット付アングル）', category: '部材', ifc: 'IfcMember', markPrefix: 'FA', icon: 'L', catalog: ['CH13_001', 'CH13_002', 'CH13_003'],
  params: [sel('size', 'サイズ', [['40', 'L40×40×t2.3（LS-40/LW-40）'], ['50', 'L50×50×t3.0（LS-50/LW-50）']], '40'), num('L', '長さ', 1200, { scope: 'instance' }), num('slotPitch', 'スロットピッチ', 50), num('slotLen', 'スロット長', 25), num('slotW', 'スロット幅', 11), P.finish],
  parts(p) { const A = +p.size; const t = A === 40 ? 2.3 : 3.0; const holes = []; for (let z = p.slotPitch / 2; z < p.L; z += p.slotPitch) { holes.push({ face: 'A', z, s: A / 2 + 2, d: p.slotW, slot: { len: p.slotLen, dir: 'z' } }); holes.push({ face: 'B', z, s: A / 2 + 2, d: p.slotW, slot: { len: p.slotLen, dir: 'z' } }); }
    return [{ kind: 'member', name: `フリーアングル L${A}`, spec: `L-${A}x${A}x${t}`, length: p.L, holes, finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.X, DIR.NZ) }]; },
});
reg({
  id: 'lip_channel', name: 'フリーチャンネル（リップ溝形鋼）', category: '部材', ifc: 'IfcMember', markPrefix: 'FC', icon: 'C', catalog: ['CH13_035', 'CH13_036', 'CH13_037', 'CH13_038', 'CH13_039', 'CH13_040'],
  params: [spec('spec', '仕様', 'LC-40x40x10x2.3'), num('L', '長さ', 2500, { scope: 'instance' }), bool('slots', '背面スロット', true), num('slotPitch', 'スロットピッチ', 100), num('slotLen', 'スロット長', 30), num('slotW', 'スロット幅', 12), P.finish],
  parts(p) { const s = parseSpec(p.spec); const holes = []; if (p.slots) for (let z = p.slotPitch / 2; z < p.L; z += p.slotPitch) holes.push({ face: 'web', z, s: s.H / 2, d: p.slotW, slot: { len: p.slotLen, dir: 'z' } }); return [{ kind: 'member', name: `フリーチャンネル ${s.label}`, spec: p.spec, length: p.L, holes, finish: p.finish, material: 'SS400', pl: place([0, 0, s.H / 2], DIR.X, DIR.NY) }]; },
});
// ---- 17. 小物金具 ----
reg({ id: 'joint_fitting', name: 'ジョイント金具（コーナー）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'JF', icon: '⌐', catalog: ['CH13_004', 'CH13_005', 'CH13_006', 'CH13_007', 'CH13_008', 'CH13_009'], params: [sel('size', '適用アングル', [['40', 'L40'], ['50', 'L50']], '40'), sel('no', '種類', [['1', 'コーナー No.1'], ['2', '通しコーナー No.2'], ['4', '三方通し No.4'], ['6', '台座 No.6']], '1'), num('t', '板厚', 3.2), P.finish],
  parts(p) { const A = +p.size; const w = A - 6; const holes = [{ face: 'face', z: w / 2, s: w / 2, d: 11 }]; const parts = [{ kind: 'plate', name: `ジョイント金具 No.${p.no}`, spec: `PL-${p.t}x${w}x${w}`, length: w, holes, finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }]; const n = p.no === '1' ? 2 : p.no === '2' ? 3 : p.no === '4' ? 4 : 1; const dirs = [[[0, p.t, 0], DIR.X, DIR.Y], [[w, p.t, 0], DIR.Z, DIR.NX], [[0, p.t, w], DIR.X, DIR.NY], [[0, p.t, 0], DIR.Z, DIR.X]];
    for (let i = 0; i < n - 1 && i < 4; i++) { const [o, dir, x] = dirs[i]; parts.push({ kind: 'plate', name: '立上り', spec: `PL-${p.t}x${w}x${w}`, length: w, holes: [{ face: 'face', z: w / 2, s: w / 2, d: 11 }], finish: p.finish, material: 'SS400', pl: place(o, DIR.Y, dir), group: '本体' }); } parts.push({ kind: 'bolt', name: 'ボルト W3/8', M: 'W3/8', L: 20, qty: n, pl: place([w / 2, p.t, w / 2], DIR.Y, DIR.X), group: 'ボルト' }); return parts; } });
reg({ id: 'channel_nut', name: 'Dナット / DS金具', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'DN', icon: '▣', catalog: ['CH13_041', 'CH13_042', 'CH13_043', 'CH13_044', 'CH13_045'], params: [sel('M', 'ねじ', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M10', 'M10'], ['M12', 'M12']], 'W3/8'), bool('groove', '溝付', true), P.finish],
  parts(p) { const b = boltDims(p.M); return [{ kind: 'custom', custom: 'box', name: `Dナット ${p.M}`, w: 36, h: b.m + 2, d: 18, hole: b.d, finish: p.finish, mass: (36 * 18 * (b.m + 2) - Math.PI * b.d * b.d / 4 * (b.m + 2)) * 7.85e-6, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }]; } });
reg({ id: 'channel_clip', name: 'チャンネルクリップ', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'CC', icon: '∩', catalog: ['CH13_046'], params: [num('od', '適合管外径', 27.2), num('t', '板厚', 1.6), num('B', '幅', 20), P.finish],
  parts(p) { const r = p.od / 2; const len = Math.PI * (r + p.t) + 2 * 20; return [{ kind: 'custom', custom: 'uband', name: `チャンネルクリップ ${p.od}φ`, od: p.od, t: p.t, B: p.B, H: r + 4, L1: 12, L2: 0, mass: len * p.B * p.t * 7.85e-6, areaM2: 2 * len * p.B / 1e6, finish: p.finish, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }, { kind: 'bolt', name: '六角ねじ M6×20', M: 'M6', L: 20, pl: place([0, -(r + p.t + 3), 0], DIR.Y, DIR.X), group: '締付', qty: 1 }]; } });
reg({ id: 'spacer', name: 'ダブルアングル／チャンネルスペーサー', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'SP', icon: '⫲', catalog: ['CH13_030', 'CH13_031'], params: [sel('size', '形鋼サイズ', [['40', 'T-40'], ['50', 'T-50'], ['65', 'T-65']], '50'), bool('nutWelded', 'ナット溶接タイプ', false), P.finish],
  parts(p) { const h = +p.size; const parts = [{ kind: 'plate', name: `スペーサー PL-6×${h}×60`, spec: `PL-6x60x${h}`, length: h, holes: [{ face: 'face', z: h / 2, s: 30, d: 11 }], finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' }]; if (p.nutWelded) { parts.push({ kind: 'nut', name: 'ナット W3/8', M: 'W3/8', pl: place([30, h / 2, 6], DIR.Z, DIR.X), group: '本体' }); parts.push(...lineWeld([24, h / 2 - 6, 6], [36, h / 2 - 6, 6], DIR.NY, DIR.Z, 3, { group: 'ナット溶接' })); } return parts; } });
reg({ id: 'shim', name: 'シムライナー', category: '金具', ifc: 'IfcDiscreteAccessory', markPrefix: 'SH', icon: '⊔', catalog: ['CH13_025'], params: [sel('t', '厚さ', [['1', '1.0'], ['2', '2.0'], ['3', '3.0'], ['5', '5.0']], '2'), num('W', '幅', 80), num('D', '奥行', 80), num('slot', 'スリット幅', 18), P.finish],
  parts(p) { const t = +p.t; return [{ kind: 'plate', name: `シムライナー t${t}`, spec: `PL-${t}x${p.W}x${p.D}`, length: p.D, holes: [{ face: 'face', z: p.D / 2 + 10, s: p.W / 2, d: p.slot, slot: { len: p.D - 20 + p.slot, dir: 'z' } }], finish: 'ZAM', material: 'SS400', pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }]; } });
reg({ id: 'angle_parts', name: 'アングル組立パーツ（NL/NT）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'AP', icon: '⅃', catalog: ['CH13_026', 'CH13_027', 'CH13_028'], params: [sel('type', '種類', [['NL-1', 'NL-1（L形）'], ['NT-2', 'NT-2（T形）'], ['NT-40R', 'NT-40R'], ['NT-50R', 'NT-50R']], 'NL-1'), num('t', '板厚', 4.5), P.finish],
  parts(p) { const w = p.type.includes('50') ? 50 : 40; const parts = [{ kind: 'plate', name: p.type, spec: `PL-${p.t}x${w}x${w * 2}`, length: w * 2, holes: [{ face: 'face', z: w / 2, s: w / 2, d: 11 }, { face: 'face', z: w * 1.5, s: w / 2, d: 11 }], finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }]; if (p.type.startsWith('NL') || p.type.startsWith('NT')) parts.push({ kind: 'plate', name: '立上り', spec: `PL-${p.t}x${w}x${w}`, length: w, holes: [{ face: 'face', z: w / 2, s: w / 2, d: 11 }], finish: p.finish, material: 'SS400', pl: place([0, p.t, 0], DIR.Y, DIR.X), group: '本体' }); return parts; } });
reg({ id: 'parallel_hanger', name: 'アングル並列金具', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'PH', icon: '≡', catalog: ['CH13_029'], params: [int('n', '連数', 2), num('pitch', 'ピッチ', 60), P.finish],
  parts(p) { const L = p.pitch * p.n + 40; const holes = [{ face: 'A', z: 15, s: 20, d: 11 }, { face: 'A', z: L - 15, s: 20, d: 11 }]; for (let i = 0; i < p.n; i++) holes.push({ face: 'B', z: 20 + p.pitch / 2 + i * p.pitch, s: 20, d: 9 }); return [{ kind: 'member', name: `並列金具 ${p.n}連`, spec: 'L-40x40x3', length: L, holes, finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.X, DIR.NZ), group: '本体' }]; } });
reg({ id: 'hanger_rod', name: '吊ボルト（全ねじ）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'RD', icon: '|', params: [sel('M', 'ねじ', [['W3/8', 'W3/8'], ['W1/2', 'W1/2'], ['M10', 'M10'], ['M12', 'M12']], 'W3/8'), num('L', '長さ', 1000, { scope: 'instance' }), int('nuts', 'ナット数', 2), P.finish],
  parts(p) { return [{ kind: 'rod', name: `吊ボルト ${p.M}×${p.L}`, M: p.M, L: p.L, pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' }]; } });
reg({ id: 'hanger_rod_fitting', name: '吊金具（タン金具）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'HF', icon: '⌶', params: [num('t', '板厚', 1.6), num('B', '幅', 25), num('L', '長さ', 50), num('H', '高さ', 60), num('phi', '穴径', 10.5), P.finish],
  parts(p) { return [{ kind: 'plate', name: `タン金具 ${p.B}×${p.L}`, spec: `PL-${p.t}x${p.B}x${p.L}`, length: p.L, holes: [{ face: 'face', z: p.L - 12, s: p.B / 2, d: p.phi }], finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }, { kind: 'plate', name: '立上り', spec: `PL-${p.t}x${p.B}x${p.H}`, length: p.H, holes: [{ face: 'face', z: p.H - 10, s: p.B / 2, d: p.phi }], finish: p.finish, material: 'SS400', pl: place([0, p.t, 0], DIR.Y, DIR.X), group: '本体' }]; } });
reg({ id: 'turnbuckle_tab', name: 'ターンバックル付吊タン', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'TT', icon: '⟟', params: [num('L', '長さ', 50), sel('d', 'ねじ', [['W3/8', 'W3/8'], ['W1/2', 'W1/2']], 'W3/8'), P.finish],
  parts(p) { return [{ kind: 'plate', name: '吊タン FB-3×20', spec: `PL-3x20x${p.L}`, length: p.L, holes: [{ face: 'face', z: 12, s: 10, d: 11, slot: { len: 15, dir: 'z' } }], finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' }, { kind: 'nut', name: `長ナット ${p.d}`, M: p.d, pl: place([10, p.L, 1.5], DIR.Y, DIR.X), group: '本体' }]; } });
reg({ id: 'perforated_strap', name: '穴あき帯鋼（パンチバンド）', category: '金具', ifc: 'IfcMechanicalFastener', markPrefix: 'PS', icon: '⋯', params: [num('t', '厚さ', 0.5), num('B', '幅', 25), num('L', '長さ', 1000, { scope: 'instance' }), num('P', '穴ピッチ', 12.5), num('d1', '穴径', 3.5), P.finish],
  parts(p) { const holes = []; for (let z = p.P / 2; z < p.L; z += p.P) holes.push({ face: 'face', z, s: p.B / 2, d: p.d1 }); return [{ kind: 'plate', name: `穴あき帯鋼 ${p.t}×${p.B}`, spec: `PL-${p.t}x${p.B}x${p.L}`, length: p.L, holes, finish: p.finish, material: 'SS400', pl: place([0, 0, 0], DIR.X, DIR.NZ), group: '本体' }]; } });
reg({ id: 'band_accessory', name: '吊バンド付属品（サドル等）', category: '金具', ifc: 'IfcDiscreteAccessory', markPrefix: 'BA', icon: '⌓', params: [num('a', '内径 a', 30), num('b', '外径 b', 38), num('B', '幅', 25), P.finish],
  parts(p) { return [{ kind: 'custom', custom: 'uband', name: 'サドルバンド', od: p.a, t: (p.b - p.a) / 2, B: p.B, H: 10, L1: 15, L2: 0, mass: (Math.PI * p.a + 60) * p.B * ((p.b - p.a) / 2) * 7.85e-6, finish: p.finish, pl: place([0, 0, 0], DIR.Z, DIR.X), group: '本体' }]; } });
reg({ id: 'guard', name: 'パイプガード・車止め・防球ガード', category: '板金', ifc: 'IfcElementAssembly', markPrefix: 'GD', icon: '⫿', catalog: ['CH14_024', 'CH14_029'], params: [sel('nominal', 'パイプ呼び径', [['50A', '50A'], ['65A', '65A'], ['80A', '80A'], ['100A', '100A']], '80A'), num('H', '高さ', 800, { scope: 'instance' }), num('W', '幅（0=単柱）', 0, { scope: 'instance' }), num('baseT', 'ベース板厚', 9), num('baseW', 'ベース寸法', 200), P.weldSize, P.finish],
  parts(p) { const parts = []; const pipe = PIPES[p.nominal]; const xs = p.W > 0 ? [-p.W / 2, p.W / 2] : [0]; for (const x of xs) { const post = { kind: 'pipe', name: `支柱 SGP ${p.nominal}`, spec: 'SGP-' + p.nominal, length: p.H - p.baseT, finish: p.finish, material: 'SS400', pl: place([x, p.baseT, 0], DIR.Y, DIR.X), group: '本体' }; parts.push(post, { kind: 'plate', name: 'ベースPL', spec: `PL-${p.baseT}x${p.baseW}x${p.baseW}`, length: p.baseW, holes: [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([a, b]) => ({ face: 'face', z: b * p.baseW, s: a * p.baseW, d: 15, kind: 'anchor' })), finish: p.finish, material: 'SS400', pl: place([x - p.baseW / 2, 0, -p.baseW / 2], DIR.Z, DIR.X), group: 'ベース' });
      const r = pipe.od / 2, n = 24; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; parts.push({ kind: 'weld', weldType: 'fillet', size: p.weldSize, length: r * (a1 - a0), from: [x + Math.cos(a0) * r, p.baseT, Math.sin(a0) * r], to: [x + Math.cos(a1) * r, p.baseT, Math.sin(a1) * r], n1: [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], n2: DIR.Y, group: '支柱溶接', allAround: true }); }
      for (const [a, b] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) parts.push({ kind: 'anchor', name: 'アンカー M12', M: 'M12', plateT: p.baseT, pl: place([x + (a - 0.5) * p.baseW, 0, (b - 0.5) * p.baseW], DIR.Y, DIR.X), group: 'アンカー', site: true }); }
    if (p.W > 0) parts.push({ kind: 'pipe', name: `横桟 SGP ${p.nominal}`, spec: 'SGP-' + p.nominal, length: p.W - pipe.od, finish: p.finish, material: 'SS400', pl: place([-p.W / 2 + pipe.od / 2, p.H - pipe.od / 2, 0], DIR.X, DIR.NZ), group: '本体' }, { kind: 'custom', custom: 'elbow', name: 'エルボ', r: pipe.od / 2, R: pipe.od, finish: p.finish, mass: 0.5, pl: place([-p.W / 2, p.H - pipe.od / 2, 0], DIR.Y, DIR.X), group: '本体' }, { kind: 'custom', custom: 'elbow', name: 'エルボ', r: pipe.od / 2, R: pipe.od, finish: p.finish, mass: 0.5, pl: place([p.W / 2, p.H - pipe.od / 2, 0], DIR.Y, DIR.NX), group: '本体' });
    return parts; } });
reg({ id: 'generic_fab', name: '汎用加工品（板）', category: '板金', ifc: 'IfcBuildingElementProxy', markPrefix: 'GF', icon: '?', params: [num('t', '板厚', 6), num('W', '幅', 200), num('H', '長さ', 300, { scope: 'instance' }), P.material, P.finish], parts(p) { return [{ kind: 'plate', name: `PL-${p.t}×${p.W}×${p.H}`, spec: `PL-${p.t}x${p.W}x${p.H}`, length: p.H, holes: [], finish: p.finish, material: p.material, pl: place([0, 0, 0], DIR.Z, DIR.X) }]; } });
reg({ id: 'consumable', name: '消耗品（塗料等・形状なし）', category: '消耗品', ifc: 'IfcBuildingElementProxy', markPrefix: 'CN', icon: '◍', params: [{ key: 'name', label: '品名', type: 'text', default: 'ローバル 1kg', scope: 'type', group: '仕様' }, num('mass', '質量 kg', 1, { unit: 'kg' })], parts(p) { return [{ kind: 'custom', custom: 'can', name: p.name, mass: p.mass, finish: 'PAINT', pl: place([0, 0, 0], DIR.Y, DIR.X), group: '本体' }]; } });

export function familyById(id) { return FAMILIES.find(f => f.id === id); }
export const CATEGORIES = [...new Set(FAMILIES.map(f => f.category))];
