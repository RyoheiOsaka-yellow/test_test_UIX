// 加工の詳細（部材 1 本ごとに足す加工）: 穴・長穴・タップ、V 字／角／U 字の切欠き、端の切欠き（コープ）、角の面取り、スカラップ、開先・けがき・仕上げ。
// 金具（インスタンス）の params.fab に JSON で持つ: [{ id, pi: 部品の番号, face: 面, kind, z: 始端からの位置, s: 幅方向の位置, edge: 's0'|'s1', end: 'start'|'end', w, d, ang, c, r, dia, len, dir, M, note }]
// 穴の類は部品の holes へ、切欠きの類は notches へ足す（3D・重量・穴の数・NC の穴にそのまま入る）。開先などの「形を変えない加工」は marks として指示書と 3D の札に出す。
import { parseSpec, faceInfo, holeFaces, FACE_LABEL, mergeCuts } from '../geo/profiles.js';

export const TAP_DRILL = { M4: 3.3, M5: 4.2, M6: 5.0, M8: 6.8, M10: 8.5, M12: 10.2, M16: 14.0, M20: 17.5 };
export const FAB_KINDS = {
  hole: { label: '丸穴', icon: '○', geo: 'hole', fields: ['z', 's', 'dia'], def: { dia: 12 } },
  slot: { label: '長穴', icon: '⊂⊃', geo: 'hole', fields: ['z', 's', 'dia', 'len', 'dir'], def: { dia: 12, len: 30, dir: 'z' } },
  tap: { label: 'タップ穴', icon: '⊕', geo: 'hole', fields: ['z', 's', 'M'], def: { M: 'M8' } },
  window: { label: '角穴・窓抜き', icon: '▭', geo: 'hole', fields: ['z', 's', 'w', 'hh'], def: { w: 40, hh: 20 } },
  csink: { label: '皿もみ（皿穴）', icon: '⌵', geo: 'hole', fields: ['z', 's', 'dia', 'cd'], def: { dia: 9, cd: 18 } },
  cbore: { label: 'ザグリ穴', icon: '⊔', geo: 'hole', fields: ['z', 's', 'dia', 'cd', 'dep'], def: { dia: 9, cd: 16, dep: 5 } },
  vent: { label: 'めっき抜き穴', icon: '◦', geo: 'hole', fields: ['z', 's', 'dia'], def: { dia: 10 } },
  v: { label: 'V 字切欠き', icon: 'V', geo: 'notch', fields: ['z', 'edge', 'd', 'ang'], def: { ang: 90 } },
  rect: { label: '角切欠き', icon: '⊔', geo: 'notch', fields: ['z', 'edge', 'w', 'd'], def: { w: 30 } },
  u: { label: 'U 字切欠き', icon: '∪', geo: 'notch', fields: ['z', 'edge', 'w', 'd'], def: { w: 20 } },
  arc: { label: '円弧切欠き（配管受け）', icon: '◡', geo: 'notch', fields: ['z', 'edge', 'r', 'd'], def: { r: 30 } },
  slit: { label: 'スリット', icon: '▏', geo: 'notch', fields: ['z', 'edge', 'w', 'd'], def: { w: 6 } },
  cope: { label: '端の切欠き（コープ）', icon: '◰', geo: 'notch', fields: ['end', 'edge', 'w', 'd'], def: { w: 40 } },
  chamfer: { label: '角の面取り（C）', icon: '◹', geo: 'notch', fields: ['end', 'edge', 'c'], def: { c: 10 } },
  scallop: { label: 'スカラップ（R）', icon: '◜', geo: 'notch', fields: ['end', 'edge', 'r'], def: { r: 20 } },
  round: { label: '角の丸め（R）', icon: '◝', geo: 'notch', fields: ['end', 'edge', 'r'], def: { r: 10 } },
  miter: { label: '端の斜め切り', icon: '◢', geo: 'cut', fields: ['end', 'ang'], def: { ang: 45 } },
  bend: { label: '曲げ（曲げ線）', icon: '∠', geo: 'mark', fields: ['z', 'ang', 'note'], def: { ang: 90, note: '内曲げ' } },
  nut: { label: '溶接ナット・スタッド', icon: '⬡', geo: 'mark', fields: ['z', 's', 'M', 'note'], def: { M: 'M10', note: '溶接ナット' } },
  bevel: { label: '開先', icon: '◣', geo: 'mark', fields: ['end', 'ang', 'note'], def: { ang: 35, note: 'レ形' } },
  mark: { label: 'けがき・刻印', icon: '✎', geo: 'mark', fields: ['z', 's', 'note'], def: { note: '' } },
  grind: { label: '仕上げ（グラインダー）', icon: '≋', geo: 'mark', fields: ['z', 's', 'note'], def: { note: 'バリ取り・面仕上げ' } },
};
export const FIELD_LABEL = { z: '始端からの位置 mm', s: '幅方向の位置 mm', dia: '穴径 mm', len: '長穴の長さ mm', dir: '長穴の向き', M: 'ねじの呼び', edge: 'どちらの縁から', end: 'どちらの端', w: '幅 mm', d: '深さ mm', ang: '角度 °', c: '面取り C mm', r: '半径 R mm', note: '指示の文', hh: '高さ（幅方向）mm', cd: '皿・ザグリの径 mm', dep: 'ザグリの深さ mm' };
const num = (v, d) => Number.isFinite(+v) ? +v : d; const clamp = (v, a, b) => Math.min(b, Math.max(a, v)); const r1 = v => Math.round(v * 10) / 10;
export function parseFab(inst) { try { const v = JSON.parse(inst?.params?.fab || '[]'); return Array.isArray(v) ? v.filter(f => f && FAB_KINDS[f.kind] && Number.isInteger(f.pi)) : []; } catch { return []; } }
export const fabId = () => 'F' + Math.random().toString(36).slice(2, 8);
// 加工できる部品（形鋼・板）と、その面
export function fabParts(parts) { const out = []; parts.forEach((pt, i) => { if (pt.ref || !['member', 'plate'].includes(pt.kind)) return; const p = parseSpec(pt.spec); if (!p) return; const faces = holeFaces(p); if (!faces.length) return; out.push({ index: i, part: pt, p, faces, info: faceInfo(p, pt.length) }); }); return out; }
// 新しく足すときの初期値（押した位置 z, s から）
export function newFeature(kind, pi, face, info, z, s) { const K = FAB_KINDS[kind]; const fi = info[face]; const W = fi.s1 - fi.s0; const f = { id: fabId(), pi, face, kind, ...K.def };
  if (K.fields.includes('z')) f.z = Math.round(clamp(z, 0, fi.L)); if (K.fields.includes('s')) f.s = Math.round(clamp(s, fi.s0, fi.s1));
  if (K.fields.includes('edge')) f.edge = (s - fi.s0) < W / 2 ? 's0' : 's1'; if (K.fields.includes('end')) f.end = z < fi.L / 2 ? 'start' : 'end';
  if (K.fields.includes('d')) f.d = kind === 'v' ? Math.round(W - fi.t) : kind === 'arc' ? Math.round(Math.min(f.r * 0.5, W * 0.4)) : kind === 'slit' ? Math.round(W * 0.6) : Math.round(Math.min(W * 0.5, 30)); if (kind === 'cope') f.d = Math.round(Math.min(W * 0.5, 25)); return f; }
// 切欠きの形（面の座標 z, s の折れ線。両端は面の縁の上）
export function notchPoints(f, fi) { const W = fi.s1 - fi.s0, L = fi.L; const e = f.edge === 's0' ? fi.s0 : fi.s1, dir = f.edge === 's0' ? 1 : -1; const z0 = f.end === 'end' ? L : 0, zd = f.end === 'end' ? -1 : 1; const dmax = W - 0.5;
  if (f.kind === 'v') { const d = clamp(num(f.d, 10), 1, dmax), half = d * Math.tan(clamp(num(f.ang, 90), 10, 170) / 2 * Math.PI / 180); const z = clamp(num(f.z, L / 2), half + 0.5, L - half - 0.5); return [[z - half, e], [z, e + dir * d], [z + half, e]]; }
  if (f.kind === 'arc') { const R = clamp(num(f.r, 30), 2, 2000), d = clamp(num(f.d, R / 2), 1, Math.min(R, dmax)); const ph = Math.acos((R - d) / R), c = R * Math.sin(ph); const z = clamp(num(f.z, L / 2), c + 0.5, L - c - 0.5); const n = 14, pts = []; for (let k = 0; k <= n; k++) { const a = -ph + 2 * ph * k / n; pts.push([z + R * Math.sin(a), k === 0 || k === n ? e : e - dir * (R - d) + dir * R * Math.cos(a)]); } return pts; }
  if (f.kind === 'round') { const r = clamp(num(f.r, 10), 1, Math.min(dmax, L - 1)); const cz = z0 + zd * r, cs = e + dir * r; const pts = []; for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 * k / 10; pts.push([k === 0 ? z0 : cz - zd * r * Math.cos(a), k === 10 ? e : cs - dir * r * Math.sin(a)]); } return pts; }
  if (f.kind === 'rect' || f.kind === 'slit') { const d = clamp(num(f.d, 10), 1, dmax), w = clamp(num(f.w, 20), 1, L - 2); const z = clamp(num(f.z, L / 2), w / 2 + 0.5, L - w / 2 - 0.5); return [[z - w / 2, e], [z - w / 2, e + dir * d], [z + w / 2, e + dir * d], [z + w / 2, e]]; }
  if (f.kind === 'u') { const w = clamp(num(f.w, 20), 2, L - 2), r = w / 2, d = clamp(num(f.d, r), r * 0.4, dmax); const z = clamp(num(f.z, L / 2), r + 0.5, L - r - 0.5); const st = Math.max(0, d - r), rr = Math.min(r, d); const pts = [[z - r, e]]; if (st > 0) pts.push([z - r, e + dir * st]); for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12; pts.push([z - r * Math.cos(a), e + dir * (st + rr * Math.sin(a))]); } if (st > 0) pts.push([z + r, e + dir * st]); pts.push([z + r, e]); return pts; }
  if (f.kind === 'cope') { const d = clamp(num(f.d, 10), 1, dmax), w = clamp(num(f.w, 20), 1, L - 1); return [[z0, e + dir * d], [z0 + zd * w, e + dir * d], [z0 + zd * w, e]]; }
  if (f.kind === 'chamfer') { const c = clamp(num(f.c, 10), 1, Math.min(dmax, L - 1)); return [[z0, e + dir * c], [z0 + zd * c, e]]; }
  if (f.kind === 'scallop') { const r = clamp(num(f.r, 20), 1, Math.min(dmax, L - 1)); const pts = []; for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 * k / 10; pts.push([z0 + zd * r * Math.sin(a), e + dir * r * Math.cos(a)]); } return pts; }
  return null; }
// 切り落とす部分を閉じた多角形にする（IFC の開口・面積の計算用）。板の縁の外へ ext mm はみ出させて、縁をきれいに切る
export function notchClosed(f, fi, ext = 0) { const pts = notchPoints(f, fi); if (!pts) return null; const e = f.edge === 's0' ? fi.s0 : fi.s1, dir = f.edge === 's0' ? 1 : -1; const out = pts.map(q => [...q]); const a = pts[0], b = pts[pts.length - 1];
  if (FAB_KINDS[f.kind].fields.includes('end')) { const z0 = f.end === 'end' ? fi.L : 0, zd = f.end === 'end' ? -1 : 1; out.push([b[0], e - dir * ext], [z0 - zd * ext, e - dir * ext], [z0 - zd * ext, a[1]]); } else out.push([b[0], e - dir * ext], [a[0], e - dir * ext]); return out; }
// 面の幅方向（s）が、断面の x か y か（端の斜め切りの向き）
const sAxis = (p, face) => p.kind === 'L' ? (face === 'A' ? 'x' : 'y') : ['web', 'left', 'right'].includes(face) ? 'y' : 'x';
// 加工の位置（札・3D で寄るとき用）
export function featureAnchor(f, fi) { const K = FAB_KINDS[f.kind]; const e = f.edge === 's0' ? fi.s0 : fi.s1; const z = K.fields.includes('end') ? (f.end === 'end' ? fi.L : 0) : num(f.z, fi.L / 2); const s = K.fields.includes('s') ? num(f.s, (fi.s0 + fi.s1) / 2) : K.fields.includes('edge') ? e : (fi.s0 + fi.s1) / 2; return { z, s }; }
// 部品の一覧に、加工を反映する
export function applyFab(parts, feats) { for (const f of feats) { const pt = parts[f.pi]; if (!pt || pt.ref || !['member', 'plate'].includes(pt.kind)) continue; const p = parseSpec(pt.spec); if (!p) continue; const fi = faceInfo(p, pt.length)[f.face]; if (!fi) continue; const K = FAB_KINDS[f.kind];
    if (K.geo === 'hole') { const d = f.kind === 'tap' ? (TAP_DRILL[f.M] || 6.8) : f.kind === 'window' ? Math.min(num(f.w, 40), num(f.hh, 20)) : clamp(num(f.dia, 12), 1, 200); const h = { face: f.face, z: clamp(num(f.z, 0), 0, fi.L), s: clamp(num(f.s, 0), fi.s0, fi.s1), d, kind: ['tap', 'slot', 'window', 'vent', 'csink', 'cbore'].includes(f.kind) ? f.kind : 'round', fab: f.id }; if (f.kind === 'slot') h.slot = { len: Math.max(d, num(f.len, d * 2)), dir: f.dir === 's' ? 's' : 'z' }; if (f.kind === 'tap') h.M = f.M; if (f.kind === 'window') h.rect = { w: clamp(num(f.w, 40), 2, fi.L), h: clamp(num(f.hh, 20), 2, fi.s1 - fi.s0) }; if (f.kind === 'csink' || f.kind === 'cbore') { h.cd = num(f.cd, d * 2); if (f.kind === 'cbore') h.dep = num(f.dep, 5); } (pt.holes ||= []).push(h); }
    else if (K.geo === 'cut') { const k = Math.tan(clamp(num(f.ang, 45), -70, 70) * Math.PI / 180); const ax = sAxis(p, f.face); pt.cuts = mergeCuts(pt.cuts, { [f.end === 'end' ? 'e' : 's']: { kx: ax === 'x' ? k : 0, ky: ax === 'y' ? k : 0 } }); (pt.marks ||= []).push({ ...f }); }
    else if (K.geo === 'notch') { const pts = notchPoints(f, fi); if (pts) (pt.notches ||= []).push({ face: f.face, pts, closed: notchClosed(f, fi, 2), kind: f.kind, label: K.label, fab: f.id }); }
    else (pt.marks ||= []).push({ ...f }); } return parts; }
// 指示書に書く 1 行
export function describeFab(f, fi) { const K = FAB_KINDS[f.kind]; const face = FACE_LABEL[f.face] || f.face; const edge = f.edge === 's0' ? '手前の縁（s = ' + r1(fi.s0) + '）' : '先の縁（s = ' + r1(fi.s1) + '）'; const end = f.end === 'end' ? '終端' : '始端'; const at = `始端から ${r1(num(f.z, 0))} mm`;
  switch (f.kind) {
    case 'hole': return `${face}: 丸穴 φ${f.dia}　${at}、幅方向 ${r1(f.s)} mm`;
    case 'slot': return `${face}: 長穴 ${f.dia}×${f.len}（${f.dir === 's' ? '幅方向' : '長さ方向'}）　${at}、幅方向 ${r1(f.s)} mm`;
    case 'tap': return `${face}: タップ穴 ${f.M}（下穴 φ${TAP_DRILL[f.M] || '—'}）　${at}、幅方向 ${r1(f.s)} mm`;
    case 'window': return `${face}: 角穴 ${f.w} × ${f.hh} mm（長さ方向 × 幅方向）　${at}（中心）、幅方向 ${r1(f.s)} mm`;
    case 'csink': return `${face}: 皿もみ 穴 φ${f.dia}、皿径 φ${f.cd}（90°）　${at}、幅方向 ${r1(f.s)} mm`;
    case 'cbore': return `${face}: ザグリ 穴 φ${f.dia}、ザグリ φ${f.cd} 深さ ${f.dep} mm　${at}、幅方向 ${r1(f.s)} mm`;
    case 'vent': return `${face}: めっき抜き穴 φ${f.dia}　${at}、幅方向 ${r1(f.s)} mm`;
    case 'arc': return `${face}: 円弧切欠き R${f.r}、深さ ${f.d} mm（弦 ${r1(2 * Math.sqrt(Math.max(0, f.r * f.r - (f.r - f.d) ** 2)))} mm）　${at}（中心）、${edge}から`;
    case 'slit': return `${face}: スリット 幅 ${f.w} × 深さ ${f.d} mm　${at}（中心）、${edge}から`;
    case 'round': return `${face}: 角の丸め R${f.r}　${end}、${edge}の角`;
    case 'miter': return `${face}: 端の斜め切り ${f.ang}°（幅方向に対して）　${end}`;
    case 'bend': return `${face}: 曲げ ${f.ang}°${f.note ? '（' + f.note + '）' : ''}　${at} の線で`;
    case 'nut': return `${face}: ${f.note || '溶接ナット'} ${f.M}　${at}、幅方向 ${r1(f.s)} mm`;
    case 'v': return `${face}: V 字切欠き ${f.ang}°、深さ ${f.d} mm（開き ${r1(2 * f.d * Math.tan(f.ang / 2 * Math.PI / 180))} mm）　${at}、${edge}から`;
    case 'rect': return `${face}: 角切欠き 幅 ${f.w} × 深さ ${f.d} mm　${at}（中心）、${edge}から`;
    case 'u': return `${face}: U 字切欠き 幅 ${f.w} × 深さ ${f.d} mm（底 R${r1(f.w / 2)}）　${at}（中心）、${edge}から`;
    case 'cope': return `${face}: 端の切欠き 長さ ${f.w} × 深さ ${f.d} mm　${end}、${edge}から`;
    case 'chamfer': return `${face}: 角の面取り C${f.c}　${end}、${edge}の角`;
    case 'scallop': return `${face}: スカラップ R${f.r}　${end}、${edge}の角`;
    case 'bevel': return `${face}: 開先 ${f.ang}°${f.note ? '（' + f.note + '）' : ''}　${end}`;
    case 'mark': return `${face}: けがき・刻印「${f.note || ''}」　${at}、幅方向 ${r1(f.s)} mm`;
    case 'grind': return `${face}: 仕上げ（${f.note || 'グラインダー'}）　${at} 付近`;
  } return K.label; }
// 切欠きで減る面積 mm²（重さの目安用）
export function notchArea(f, fi) { const poly = notchClosed(f, fi, 0); if (!poly) return 0; let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
