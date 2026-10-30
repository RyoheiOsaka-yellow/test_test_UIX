// 接合（A部材とB部材を繋ぐ）: 接触検出 → 溶接ビード / ボルト（両部材に穴）/ Uボルト を生成。日本語指示文のパーサ付き
import * as THREE from 'three';
import { parseSpec, decompose, sectionBox } from '../geo/profiles.js';
import { boltDims } from '../geo/fasteners.js';
import { place, DIR } from './families.js';

const V = a => new THREE.Vector3(...a);
export function instMatrix(inst) { const m = new THREE.Matrix4(); const e = new THREE.Euler(...(inst.rot || [0, 0, 0])); m.makeRotationFromEuler(e); m.setPosition(new THREE.Vector3(...inst.pos)); return m; }
function partMatrix(pt) { const [x, y, z] = pt.pl.basis; const m = new THREE.Matrix4().makeBasis(V(x), V(y), V(z)); m.setPosition(V(pt.pl.pos)); return m; }
// 部材の各板 → ワールド AABB（インスタンス変換込み）と板情報
export function plateBoxes(model, inst) {
  const fam = model.familyOf(inst); const p = model.resolved(inst); const parts = fam.parts(p, { inst, model }); const M = instMatrix(inst); const out = [];
  parts.forEach((pt, pi) => { if (!['member', 'plate', 'pipe'].includes(pt.kind) || pt.ref) return; const sp = parseSpec(pt.spec); if (!sp) return; const PM = partMatrix(pt).premultiply(M);
    if (sp.kind === 'PIPE' || sp.kind === 'RB') { const r = (sp.od || sp.d) / 2; const box = new THREE.Box3(); for (const c of [[-r, -r, 0], [r, r, 0], [-r, -r, pt.length], [r, r, pt.length]]) box.expandByPoint(V(c).applyMatrix4(PM)); out.push({ inst, part: pt, partIndex: pi, plate: null, box, PM, isPipe: true, r }); return; }
    for (const pl of decompose(sp, pt.length)) { const box = new THREE.Box3(); const PLM = pl.M.clone().premultiply(PM); for (const c of [[0, 0, 0], [pl.w, 0, 0], [0, pl.h, 0], [pl.w, pl.h, 0], [0, 0, pl.t], [pl.w, 0, pl.t], [0, pl.h, pl.t], [pl.w, pl.h, pl.t]]) box.expandByPoint(V(c).applyMatrix4(PLM)); out.push({ inst, part: pt, partIndex: pi, plate: pl, box, PM, PLM, thick: pl.t }); } });
  return out;
}
// 2つの AABB の接触（面同士が tol 以内で平行接触し、重なり面積あり）
function contact(a, b, tol = 1.5) {
  for (const ax of ['x', 'y', 'z']) { const others = ['x', 'y', 'z'].filter(k => k !== ax); const overlap = others.every(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 2);
    if (!overlap) continue; if (Math.abs(a.max[ax] - b.min[ax]) <= tol) return { axis: ax, plane: (a.max[ax] + b.min[ax]) / 2, aSide: 1, others }; if (Math.abs(b.max[ax] - a.min[ax]) <= tol) return { axis: ax, plane: (b.max[ax] + a.min[ax]) / 2, aSide: -1, others }; }
  return null;
}
function rectOverlap(a, b, ks) { return { min: { [ks[0]]: Math.max(a.min[ks[0]], b.min[ks[0]]), [ks[1]]: Math.max(a.min[ks[1]], b.min[ks[1]]) }, max: { [ks[0]]: Math.min(a.max[ks[0]], b.max[ks[0]]), [ks[1]]: Math.min(a.max[ks[1]], b.max[ks[1]]) } }; }
const unit = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
function pt3(axis, plane, ks, u, v) { const o = { x: 0, y: 0, z: 0 }; o[axis] = plane; o[ks[0]] = u; o[ks[1]] = v; return [o.x, o.y, o.z]; }

// 接触候補の検出: instA の板 と instB の板
export function detectContacts(model, instA, instB) {
  const A = plateBoxes(model, instA), B = plateBoxes(model, instB); const res = [];
  for (const a of A) for (const b of B) { const c = contact(a.box, b.box); if (!c) continue; const r = rectOverlap(a.box, b.box, c.others); const w = r.max[c.others[0]] - r.min[c.others[0]], h = r.max[c.others[1]] - r.min[c.others[1]]; if (w < 2 || h < 2) continue; res.push({ a, b, ...c, rect: r, w, h, area: w * h }); }
  res.sort((x, y) => y.area - x.area); return res;
}
// 隅肉溶接 parts を生成（接触矩形の外周。 A が B の面に乗る T 継手を想定: ビードは A の側面と B の面の隅）
export function weldPartsFromContact(c, size = 6, { allAround = true, sides = 1, site = false } = {}) {
  const ks = c.others; const nB = unit[c.axis].map(v => v * c.aSide); // B 面の法線（A 側へ向く）= A の軸方向の逆…  A が +側にあるなら B面法線は +
  const r = c.rect; const corners = [[r.min[ks[0]], r.min[ks[1]]], [r.max[ks[0]], r.min[ks[1]]], [r.max[ks[0]], r.max[ks[1]]], [r.min[ks[0]], r.max[ks[1]]]];
  // 外形が A の板断面と一致するか（Aの端面がBに乗る）判定: A box の他2軸範囲が rect と一致 → A 外周に溶接
  const edges = []; for (let i = 0; i < 4; i++) { const p0 = corners[i], p1 = corners[(i + 1) % 4]; const du = p1[0] - p0[0], dv = p1[1] - p0[1]; const out = { [ks[0]]: Math.sign(dv), [ks[1]]: -Math.sign(du) }; const n1 = [0, 0, 0]; n1[['x', 'y', 'z'].indexOf(ks[0])] = out[ks[0]] || 0; n1[['x', 'y', 'z'].indexOf(ks[1])] = out[ks[1]] || 0; edges.push({ from: pt3(c.axis, c.plane, ks, p0[0], p0[1]), to: pt3(c.axis, c.plane, ks, p1[0], p1[1]), n1 }); }
  // 外向き法線の向きを rect 中心基準で補正
  const cx = (r.min[ks[0]] + r.max[ks[0]]) / 2, cy = (r.min[ks[1]] + r.max[ks[1]]) / 2;
  const parts = []; for (const e of edges) { const mx = (e.from[0] + e.to[0]) / 2, my = (e.from[1] + e.to[1]) / 2, mz = (e.from[2] + e.to[2]) / 2; const mid = { x: mx, y: my, z: mz }; const d = [mid[ks[0]] - cx, mid[ks[1]] - cy]; const n1 = [0, 0, 0]; n1[['x', 'y', 'z'].indexOf(ks[0])] = Math.abs(d[0]) > Math.abs(d[1]) ? Math.sign(d[0]) : 0; n1[['x', 'y', 'z'].indexOf(ks[1])] = Math.abs(d[1]) >= Math.abs(d[0]) ? Math.sign(d[1]) : 0;
    const len = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]); if (len < 1) continue; parts.push({ kind: 'weld', weldType: 'fillet', size, length: len, from: e.from, to: e.to, n1, n2: nB.map(v => -v), group: site ? '現場接合溶接' : '接合溶接', allAround, site, symbol: `${site ? '▶' : ''}${allAround ? '○' : ''}▷${size}` }); }
  if (!allAround) return parts.slice(0, sides); return parts;
}
// ボルト接合: 重ね部（接触矩形）にボルト n 本 + 両部材に穴
export function boltPartsFromContact(c, { M = 'M12', count = 2, pitch = null, model, points = null } = {}) {
  // points: 既存の穴（ワールド座標）に合わせてボルトを立てる（穴の自動提案から）。接触面に投影し、穴は新たに作らない
  if (points && points.length) { const b = boltDims(M); const tA = c.a.thick || 6, tB = c.b.thick || 6; const grip = tA + tB; const Lb = Math.ceil((grip + b.wt * 2 + b.m + 3 * b.p + 2) / 5) * 5; const axisIdx = ['x', 'y', 'z'].indexOf(c.axis); const dirBolt = [0, 0, 0]; dirBolt[axisIdx] = -c.aSide; const parts = [];
    for (const p0 of points) { const center = [...p0]; center[axisIdx] = c.plane; const head = [...center]; head[axisIdx] = c.plane + c.aSide * tA; parts.push({ kind: 'bolt', name: `接合ボルト ${M}×${Lb}`, M, L: Lb, grip, pl: place(head, dirBolt, axisIdx === 0 ? DIR.Y : DIR.X), group: '接合ボルト' }); }
    return { parts, holes: [], bolt: { M, L: Lb, count: points.length } }; }
  const ks = c.others; const r = c.rect; const b = boltDims(M); const long = (r.max[ks[0]] - r.min[ks[0]]) >= (r.max[ks[1]] - r.min[ks[1]]) ? ks[0] : ks[1]; const short = long === ks[0] ? ks[1] : ks[0];
  const L0 = r.min[long], L1 = r.max[long]; const span = L1 - L0; const pch = pitch || Math.min(100, Math.max(40, (span - 60) / Math.max(1, count - 1))); const start = (L0 + L1) / 2 - pch * (count - 1) / 2; const mid = (r.min[short] + r.max[short]) / 2;
  const tA = c.a.thick || 6, tB = c.b.thick || 6; const grip = tA + tB; const Lb = Math.ceil((grip + b.wt * 2 + b.m + 3 * b.p + 2) / 5) * 5;
  const parts = []; const holes = []; const axisIdx = ['x', 'y', 'z'].indexOf(c.axis); const dirBolt = [0, 0, 0]; dirBolt[axisIdx] = -c.aSide; // A 側（外）から B へ
  for (let i = 0; i < count; i++) { const u = start + i * pch; const center = pt3(c.axis, c.plane, ks, long === ks[0] ? u : mid, long === ks[0] ? mid : u); const head = [...center]; head[axisIdx] = c.plane + c.aSide * tA; // A 外面にボルト座面
    parts.push({ kind: 'bolt', name: `接合ボルト ${M}×${Lb}`, M, L: Lb, grip, pl: place(head, dirBolt, axisIdx === 0 ? DIR.Y : DIR.X), group: '接合ボルト' }); holes.push({ world: center, d: b.hole }); }
  return { parts, holes, bolt: { M, L: Lb, count } };
}
// ワールド点 → 部材の穴（face, z, s）へ変換
export function worldToHole(pb, world, d, slot = null) {
  if (!pb.plate) return null; const inv = pb.PLM.clone().invert(); const lp = V(world).applyMatrix4(inv); // plate local: u=x, v=y
  const pl = pb.plate; const u = lp.x, v = lp.y; // 逆写像: map(z,s) → [u,v]; 面ごとに z/s を戻す（map は線形: u = z or s - k）
  const m0 = pl.map(0, 0), mz = pl.map(1, 0), ms = pl.map(0, 1); const zIsU = Math.abs(mz[0] - m0[0]) > 0.5; const z = zIsU ? u - m0[0] : v - m0[1]; const s = zIsU ? v - m0[1] : u - m0[0];
  return { face: pl.name, z: Math.round(z * 10) / 10, s: Math.round(s * 10) / 10, d, slot, kind: 'joint' };
}
// 接合を評価して parts と穴注入情報を返す
export function evaluateJoint(model, j) {
  const a = model.getInstance(j.a), b = model.getInstance(j.b); if (!a || !b) return { parts: [], holes: [] };
  const cs = detectContacts(model, a, b); const c = cs[0]; if (!c) return { parts: [], holes: [], warning: '接触面が見つかりません（部材を接触させてください）' };
  if (j.type === 'fillet' || j.type === 'weld') return { parts: weldPartsFromContact(c, j.size || 6, { allAround: j.allAround !== false, sides: j.sides || 1, site: !!j.site }), holes: [], contact: c };
  if (j.type === 'butt') { const ks = c.others; const r = c.rect; const from = pt3(c.axis, c.plane, ks, r.min[ks[0]], (r.min[ks[1]] + r.max[ks[1]]) / 2), to = pt3(c.axis, c.plane, ks, r.max[ks[0]], (r.min[ks[1]] + r.max[ks[1]]) / 2); return { parts: [{ kind: 'weld', weldType: 'butt', size: j.size || 6, length: Math.hypot(...to.map((v, i) => v - from[i])), from, to, n1: unit[c.axis], n2: unit[c.axis], group: '突合せ溶接' }], holes: [], contact: c }; }
  if (j.type === 'bolt') { const r = boltPartsFromContact(c, { M: j.M || 'M12', count: j.count || 2, pitch: j.pitch, points: j.points || null }); const holes = []; for (const h of r.holes) { const ha = worldToHole(c.a, h.world, h.d), hb = worldToHole(c.b, h.world, h.d); if (ha) holes.push({ instId: a.id, partIndex: c.a.partIndex, hole: ha }); if (hb) holes.push({ instId: b.id, partIndex: c.b.partIndex, hole: hb }); } return { parts: r.parts, holes, contact: c, bolt: r.bolt }; }
  return { parts: [], holes: [] };
}

// ---------- 日本語 指示文パーサ ----------
// 例: "MF-1 と LB-2 を 隅肉溶接 6 両側" / "PL-1 を MF-1 に M12 ボルト 4本 @100 で接合" / "MF-1 に φ15 穴 2個 @100 端から50 脚A" / "MF-1 と MF-2 を突合せ溶接"
export function parseInstruction(text, model) {
  const t = String(text).replace(/\s+/g, ' ').replace(/[Ｍ]/g, 'M').replace(/×/g, 'x').trim(); const marks = [...t.matchAll(/\b([A-Z]{1,3}-\d+)\b/g)].map(m => m[1]);
  const find = mk => model.instances.find(i => i.mark === mk);
  const num = (re, def) => { const m = t.match(re); return m ? parseFloat(m[1]) : def; };
  if (/(隅肉|すみ肉|溶接)/.test(t) && !/突合|突き合/.test(t) && marks.length >= 2) return { op: 'joint', type: 'fillet', a: find(marks[0])?.id, b: find(marks[1])?.id, size: num(/(?:脚長|S|s)?\s*(\d+(?:\.\d+)?)\s*(?:mm)?(?=\s*(?:両側|片側|全周|現場|工場|$))/, 6), sides: /両側/.test(t) ? 2 : 1, allAround: !/片側のみ|一辺/.test(t), site: /現場/.test(t), label: `${marks[0]}–${marks[1]} ${/現場/.test(t) ? '現場' : ''}隅肉溶接` };
  if (/(突合|突き合)/.test(t) && marks.length >= 2) return { op: 'joint', type: 'butt', a: find(marks[0])?.id, b: find(marks[1])?.id, size: num(/t\s*(\d+)/, 6), label: `${marks[0]}–${marks[1]} 突合せ溶接` };
  if (/ボルト/.test(t) && !/Uボルト|ｕボルト/i.test(t) && marks.length >= 2) { const M = (t.match(/\b(M\d{1,2}|W\d\/\d)\b/) || [])[1] || 'M12'; return { op: 'joint', type: 'bolt', a: find(marks[0])?.id, b: find(marks[1])?.id, M, count: num(/(\d+)\s*本/, 2), pitch: num(/@\s*(\d+)/, null), label: `${marks[0]}–${marks[1]} ${M} ボルト接合` }; }
  if (/(穴|孔|長穴)/.test(t) && marks.length >= 1) { const inst = find(marks[0]); const d = num(/(?:φ|Φ|ф|径)\s*(\d+(?:\.\d+)?)/, 15); const n = num(/(\d+)\s*[個ヶ箇]/, 1); const pitch = num(/@\s*(\d+)/, 100); const edge = num(/端(?:から|あき)\s*(\d+)/, 50); const slot = /長穴/.test(t) ? num(/長穴\s*(\d+)/, d + 13) : null; const face = (t.match(/(脚A|脚B|ウェブ|上フランジ|下フランジ|板面|上面)/) || [])[1]; const faceKey = { 脚A: 'A', 脚B: 'B', ウェブ: 'web', 上フランジ: 'ft', 下フランジ: 'fb', 板面: 'face', 上面: 'top' }[face] || 'A'; return { op: 'holes', inst: inst?.id, holes: Array.from({ length: n }, (_, i) => `${faceKey}:z${edge + i * pitch} s${num(/s\s*(\d+)/, 25)} d${d}${slot ? ' slot' + slot + 'z' : ''}`).join('; '), label: `${marks[0]} に ${face || ''} φ${d} ${slot ? '長穴' : '穴'} ×${n}` }; }
  if (/Uボルト/i.test(t) && marks.length >= 1) { const inst = find(marks[0]); const nom = (t.match(/(\d{2,3})\s*A/) || [])[1]; return { op: 'param', inst: inst?.id, params: { pipes: nom ? nom + 'A' : '50A', ubolt: true }, label: `${marks[0]} に Uボルト ${nom || 50}A` }; }
  if (/(移動|ずらす|オフセット)/.test(t) && marks.length >= 1) { const inst = find(marks[0]); const dx = num(/[XxＸ]\s*(-?\d+)/, 0), dy = num(/[YyＹ]\s*(-?\d+)/, 0), dz = num(/[ZzＺ]\s*(-?\d+)/, 0); return { op: 'move', inst: inst?.id, delta: [dx, dy, dz], label: `${marks[0]} を移動 (${dx},${dy},${dz})` }; }
  if (/(削除|消去|取り消し)/.test(t) && marks.length >= 1) return { op: 'delete', inst: find(marks[0])?.id, label: `${marks[0]} を削除` };
  if (/(複製|コピー)/.test(t) && marks.length >= 1) return { op: 'duplicate', inst: find(marks[0])?.id, label: `${marks[0]} を複製` };
  const kv = [...t.matchAll(/([A-Za-z]\w*)\s*[=＝:：]\s*([^\s,、]+)/g)]; if (kv.length && marks.length >= 1) { const params = {}; for (const m of kv) params[m[1]] = isNaN(+m[2]) ? m[2] : +m[2]; return { op: 'param', inst: find(marks[0])?.id, params, label: `${marks[0]} のパラメータ変更` }; }
  return { op: 'unknown', label: '解釈できませんでした: ' + text, hint: '例: 「MF-1 と LB-1 を隅肉溶接 6 両側」「PL-1 を MF-1 に M12 ボルト 4本 @100 で接合」「MF-1 に φ15 穴 2個 @100 端から50 脚A」「MF-1 に Uボルト 50A」「MF-1 を X100 移動」' };
}

// 組立確認: ボルト・アンカー・U ボルト・吊ボルトの頭／ナット側に工具スペース（長さ 2.5M+20, 幅 1.6M）があるか。他部材の板・管と重なれば不足
const mmOf = M => { const m = String(M || 'M12').match(/M(\d+(?:\.\d+)?)/); if (m) return +m[1]; const w = String(M).match(/W(\d+)\/(\d+)/); return w ? (+w[1] / +w[2]) * 25.4 : 12; };
export function toolClearanceIssues(model) {
  const insts = model.instances; const plates = new Map(insts.map(i => [i.id, plateBoxes(model, i)])); const out = [];
  for (const inst of insts) { const fam = model.familyOf(inst); const parts = fam.parts(model.resolved(inst), { inst, model }); const M = instMatrix(inst);
    for (const pt of parts) { if (!['bolt', 'anchor', 'ubolt', 'rod'].includes(pt.kind) || pt.ref) continue; const d = mmOf(pt.M); const clear = 2.5 * d + 20, half = 1.6 * d; const PM = partMatrix(pt).premultiply(M); const L = pt.kind === 'ubolt' ? (pt.plateT || 6) + 2 * d : (pt.L || (pt.kind === 'anchor' ? 3 * d : 40));
      const ends = pt.kind === 'anchor' ? [['ナット側', L, L + clear]] : pt.kind === 'ubolt' ? [['ナット側', -(L + clear), -0.5 * L]] : [['頭側', -clear, 0], ['ナット側', L, L + clear]];
      for (const [label, z0, z1] of ends) { const box = new THREE.Box3(); for (const c of [[-half, -half, z0], [half, half, z0], [-half, -half, z1], [half, half, z1]]) box.expandByPoint(V(c).applyMatrix4(PM));
        for (const other of insts) { if (other.id === inst.id) continue; for (const pb of plates.get(other.id)) { const inter = box.clone().intersect(pb.box); if (inter.isEmpty()) continue; const sz = inter.getSize(new THREE.Vector3()); if (sz.x > 2 && sz.y > 2 && sz.z > 2) out.push({ inst, part: pt, other, otherPart: pb.part, end: label, need: Math.round(clear), c: inter.getCenter(new THREE.Vector3()), label: `${inst.mark} ${pt.name || (pt.kind + ' ' + (pt.M || ''))} の${label}に工具スペース ${Math.round(clear)} mm が取れません（${other.mark} ${pb.part.name || pb.part.spec} と干渉）` }); } } } } }
  return out;
}

// ---------- 穴からボルト接合を提案 ----------
// 接触している 2 部材の既存の穴（単材/板の DSL・extraHoles）が、接触面上で同じ位置（許容 tol mm）にあれば、その穴列をボルト接合の候補にする。
// partsOf(inst) は穴つき部品（instanceParts）を返す関数。戻り値: [{ a, b, contact, points:[world], pairs:[{d, posA, posB}], M }]
export function suggestBoltJoints(model, partsOf, holePosFn, { tol = 4 } = {}) {
  const insts = model.instances; const out = []; const dToM = d => d >= 17 ? 'M16' : d >= 13 ? 'M12' : d >= 11 ? 'M10' : 'M8';
  const worldHoles = inst => { const M = instMatrix(inst); const res = []; let parts = []; try { parts = partsOf(inst); } catch { return res; } parts.forEach((pt, pi) => { if (!pt.holes || pt.ref) return; for (const h of pt.holes) { if (h.id) continue; const loc = holePosFn(pt, h); if (!loc) continue; const w = loc.clone().applyMatrix4(M); res.push({ w: [w.x, w.y, w.z], d: h.d, partIndex: pi, h }); } }); return res; };
  const cache = new Map(); const holesOf = inst => { if (!cache.has(inst.id)) cache.set(inst.id, worldHoles(inst)); return cache.get(inst.id); };
  for (let i = 0; i < insts.length; i++) for (let k = i + 1; k < insts.length; k++) { const A = insts[i], B = insts[k]; const existing = model.joints.find(j => j.type === 'bolt' && ((j.a === A.id && j.b === B.id) || (j.a === B.id && j.b === A.id))); if (existing) continue;
    let cs = []; try { cs = detectContacts(model, A, B); } catch { } if (!cs.length) continue; const c = cs[0]; const axisIdx = ['x', 'y', 'z'].indexOf(c.axis); const ks = c.others.map(o => ['x', 'y', 'z'].indexOf(o));
    const HA = holesOf(A), HB = holesOf(B); if (!HA.length || !HB.length) continue; const pairs = [];
    for (const ha of HA) { if (Math.abs(ha.w[axisIdx] - c.plane) > 60) continue; for (const hb of HB) { if (Math.abs(hb.w[axisIdx] - c.plane) > 60) continue; const dd = Math.hypot(ha.w[ks[0]] - hb.w[ks[0]], ha.w[ks[1]] - hb.w[ks[1]]); if (dd <= tol && Math.abs(ha.d - hb.d) <= 3) { pairs.push({ d: Math.max(ha.d, hb.d), posA: ha.w, posB: hb.w, mid: ha.w.map((v, q) => (v + hb.w[q]) / 2) }); break; } } }
    if (!pairs.length) continue; const d = Math.max(...pairs.map(p => p.d)); out.push({ a: A, b: B, contact: c, pairs, points: pairs.map(p => p.mid), M: dToM(d), d }); }
  return out;
}
