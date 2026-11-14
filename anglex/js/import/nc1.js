// DSTV NC（.nc1 / .nc）の読込・書出し: 鋼材加工機（穴あけ・切断）向けの標準テキスト（Standard Description for Steel Structure Pieces for the Numerical Controls）。
// ST ブロック（部材ヘッダー 24 行）、AK ブロック（面ごとの外形輪郭、反時計回り）、BO ブロック（穴・長穴）を扱う。
// 面の対応（既定）: 山形鋼 B（垂直脚）= v / A（水平脚）= u、溝形鋼・H 形鋼 web = v / ft = o / fb = u、平鋼・板 = v、角パイプ left = v / top = o / bottom = u / right = h
// x = 始端からの長さ方向（ANGLEX の z）、y = 面の幅方向（ANGLEX の s）。長穴は規格どおり「始点（最初の円の中心）」で書く（始点 + 長さ/2 = 長穴の中心）。
// 機械ごとに違いうる基準は opts で切り替える: swapL（山形鋼の v/u を入替）、fromEnd（終端を原点に）、flipY（y を反対側の縁から）
import { parseSpec, sectionProps } from '../geo/profiles.js';
const FACE_OUT = { L: { B: 'v', A: 'u' }, C: { web: 'v', ft: 'o', fb: 'u' }, LC: { web: 'v', ft: 'o', fb: 'u' }, FB: { face: 'v' }, PL: { face: 'v' }, SQ: { left: 'v', top: 'o', bottom: 'u', right: 'h' }, H: { web: 'v', ft: 'o', fb: 'u' } };
const CODE = { L: 'L', C: 'U', LC: 'C', FB: 'B', PL: 'B', SQ: 'M', H: 'I', PIPE: 'RO', RB: 'RU' };
export const NC_DEFAULTS = { swapL: false, fromEnd: false, flipY: false };
export function ncOptions() { try { return { ...NC_DEFAULTS, ...(JSON.parse(localStorage.getItem('anglex.nc1') || '{}')) }; } catch { return { ...NC_DEFAULTS }; } }
export function saveNcOptions(o) { try { localStorage.setItem('anglex.nc1', JSON.stringify(o)); } catch { } }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2).padStart(10, ' ');
// 面の幅（y 方向の全幅）: 山形鋼は脚の長さ、溝形鋼は web = H・フランジ = B、平鋼・板は幅
export function faceWidths(sp) { return { L: { A: sp.A, B: sp.B }, C: { web: sp.H, ft: sp.B, fb: sp.B }, LC: { web: sp.H, ft: sp.A, fb: sp.A }, FB: { face: sp.w }, PL: { face: sp.w || 0 }, SQ: { left: sp.B, right: sp.B, top: sp.A, bottom: sp.A }, H: { web: sp.H, ft: sp.B, fb: sp.B } }[sp.kind] || {}; }
export function faceMapFor(kind, opts = NC_DEFAULTS) { const m = { ...(FACE_OUT[kind] || {}) }; if (kind === 'L' && opts.swapL) { m.A = 'v'; m.B = 'u'; } return m; }
// ANGLEX の穴 → NC の穴（面記号・x・y・径・長穴）。照合シートと書出しで共用
export function ncHoles(pt, opts = NC_DEFAULTS) { const sp = parseSpec(pt.spec); if (!sp) return { holes: [], skipped: 0 }; const map = faceMapFor(sp.kind, opts), W = faceWidths(sp); const L = pt.length || (sp.kind === 'PL' ? sp.h : 0) || 0; const out = []; let skipped = 0, outside = 0;
  for (const h of (pt.holes || [])) { const face = map[h.face]; if (!face) { skipped++; continue; } if (h.z < 0 || h.z > L || h.s < 0 || (W[h.face] && h.s > W[h.face])) { outside++; continue; } /* 中心が面の外にある穴は NC に出さない */ let x = h.z, y = h.s; const slot = h.slot && h.slot.len > h.d ? { c: h.slot.len - h.d, along: h.slot.dir === 'z' || h.slot.dir == null } : null; if (opts.fromEnd) x = L - x; if (opts.flipY && W[h.face]) y = W[h.face] - y;
    let sx = x, sy = y; if (slot) { if (slot.along) sx = x - slot.c / 2; else sy = y - slot.c / 2; } out.push({ face, src: h.face, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, sx: Math.round(sx * 100) / 100, sy: Math.round(sy * 100) / 100, d: h.d, slot: slot ? { c: slot.c, len: h.slot.len, angle: slot.along ? 0 : 90 } : null, kind: h.kind || null }); }
  return { holes: out, skipped, outside, faces: Object.entries(map).map(([src, f]) => ({ face: f, src, width: W[src] || 0 })), length: L, sp }; }
// 1 部品 → NC1 テキスト。pt: { spec, length, holes:[{face,z,s,d,slot}], material }
export function toNC1(pt, { order = '', drawing = '', mark = '', qty = 1, opts = NC_DEFAULTS } = {}) {
  const sp = parseSpec(pt.spec); if (!sp || !CODE[sp.kind]) return null; let props = null; try { props = sectionProps(sp); } catch { }
  const dims = { L: [sp.A, sp.B, sp.t, sp.t], C: [sp.H, sp.B, sp.t2, sp.t1], LC: [sp.H, sp.A, sp.t, sp.t], FB: [sp.w, sp.t, sp.t, sp.t], PL: [sp.w || pt.width || 0, sp.t, sp.t, sp.t], SQ: [sp.B, sp.A, sp.t, sp.t], H: [sp.H, sp.B, sp.t2, sp.t1], PIPE: [sp.od, sp.od, sp.t, sp.t], RB: [sp.d, sp.d, 0, 0] }[sp.kind];
  const nh = ncHoles(pt, opts); const L = nh.length; const name = String(pt.spec).replace(/^\[-?/, 'U').replace(/^□-?/, 'RHS').replace(/-/g, '').replace(/x/gi, '*');
  const lines = ['ST', `** ANGLEX DSTV NC ${pt.spec} L=${Math.round(L * 10) / 10}${opts.swapL || opts.fromEnd || opts.flipY ? ' opts:' + ['swapL', 'fromEnd', 'flipY'].filter(k => opts[k]).join('+') : ''}`, '  ' + (order || '-'), '  ' + (drawing || '-'), '  ' + (mark || '-'), '  ' + (mark || '-'), '  ' + (pt.material || 'SS400'), '  ' + qty, '  ' + name, '  ' + CODE[sp.kind], f2(L), f2(dims[0]), f2(dims[1]), f2(dims[2]), f2(dims[3]), f2(0), f2(props?.w ?? 0), f2((props?.perim ?? 0) / 1000), f2(0), f2(0), f2(0), f2(0), '  -', '  -', '  -', '  -'];
  // AK: 面ごとの外形（矩形、反時計回り、始点に戻って閉じる）
  for (const fc of nh.faces) { if (!(fc.width > 0) || !(L > 0)) continue; lines.push('AK'); const pts = [[0, 0], [L, 0], [L, fc.width], [0, fc.width], [0, 0]]; pts.forEach(([x, y], i) => lines.push(`  ${i === 0 ? fc.face : ' '}${f2(x)}u${f2(y)}${f2(0)}${f2(0)}${f2(0)}${f2(0)}${f2(0)}`)); }
  if (nh.holes.length) { lines.push('BO'); for (const h of nh.holes) { let ln = `  ${h.face}${f2(h.sx)}u${f2(h.sy)}${f2(h.d)}${f2(0)}`; if (h.slot) ln += `l${f2(h.slot.c)}${f2(0)}${f2(h.slot.angle)}`; lines.push(ln); } }
  lines.push('EN'); return { text: lines.join('\r\n') + '\r\n', holes: nh.holes.length, skipped: nh.skipped, nc: nh };
}
// NC1 テキスト → { spec, length, holes(ANGLEX の面・z・s), mark, qty, material, code, profile }
export function parseNC1(text, opts = NC_DEFAULTS) {
  const lines = String(text).split(/\r?\n/); let i = lines.findIndex(l => l.trim() === 'ST'); if (i < 0) throw new Error('DSTV NC の ST ブロックがありません'); const hdr = []; for (i = i + 1; i < lines.length && hdr.length < 24; i++) { const l = lines[i]; if (/^\*\*/.test(l.trim())) continue; if (/^[A-Z]{2}\s*$/.test(l.trim())) break; hdr.push(l.trim()); }
  const num = k => parseFloat(String(hdr[k] || '').split(/[\s,]+/)[0]) || 0; const code = (hdr[7] || '').toUpperCase(); const L = num(8), h = num(9), b = num(10), tf = num(11), tw = num(12); const r = v => Math.round(v * 10) / 10;
  let spec = null; if (code === 'L') spec = `L-${r(h)}x${r(b)}x${r(tf || tw)}`; else if (code === 'U') spec = `[-${r(h)}x${r(b)}x${r(tw)}x${r(tf)}`; else if (code === 'C') spec = `LC-${r(h)}x${r(b)}x${r(tf || tw)}`; else if (code === 'B') { const t = r(tf || tw || b), w = r(h); spec = w > 0 && w <= 300 ? `FB-${t}x${w}` : `PL-${t}x${w}x${r(L)}`; } else if (code === 'M') spec = `□-${r(b)}x${r(h)}x${r(tf || tw)}`; else if (code === 'I') spec = `H-${r(h)}x${r(b)}x${r(tw)}x${r(tf)}`; else if (code === 'RO') spec = `STK-${r(h)}x${r(tf || tw)}`; else if (code === 'RU') spec = `RB-${r(h)}`;
  const sp = spec ? parseSpec(spec) : null; if (!sp) throw new Error(`この断面（コード ${code || '?'}: ${hdr[6] || ''}）は未対応です`);
  const out = faceMapFor(sp.kind, opts); const IN = {}; for (const [src, f] of Object.entries(out)) if (!(f in IN)) IN[f] = src; const fallback = Object.keys(out)[0] || 'A'; const W = faceWidths(sp);
  const holes = []; let block = null; for (const raw of lines) { const l = raw.trim(); if (/^[A-Z]{2}$/.test(l)) { block = l; continue; } if (block !== 'BO' || !l) continue; const tk = l.split(/\s+/); if (!/^[vouh]$/i.test(tk[0])) continue; const n = s => parseFloat(String(s ?? '').replace(/[a-z]/gi, '')); let x = n(tk[1]), y = n(tk[2]); const d = n(tk[3]); if (!isFinite(x) || !isFinite(y) || !(d > 0)) continue; const face = IN[tk[0].toLowerCase()] || fallback; let slot = null; if (tk.length >= 8 && n(tk[5]) > 0) { const c = n(tk[5]), ang = n(tk[7]) || 0; const along = Math.abs(ang) < 45; if (along) x += c / 2; else y += c / 2; slot = { len: Math.round((c + d) * 100) / 100, dir: along ? 'z' : 's' }; }
    if (opts.fromEnd) x = L - x; if (opts.flipY && W[face]) y = W[face] - y; const hole = { face, z: Math.round(x * 100) / 100, s: Math.round(y * 100) / 100, d }; if (slot) hole.slot = slot; holes.push(hole); }
  return { spec, length: r(L), holes, mark: hdr[3] && hdr[3] !== '-' ? hdr[3] : (hdr[2] !== '-' ? hdr[2] : ''), qty: Math.max(1, parseInt(hdr[5]) || 1), material: hdr[4] || 'SS400', code, profile: hdr[6] || '', contours: lines.filter(l => l.trim() === 'AK').length };
}
export const holesToDSL = holes => holes.map(h => `${h.face}:z${Math.round(h.z * 10) / 10} s${Math.round(h.s * 10) / 10} d${h.d}${h.slot ? ' slot' + h.slot.len + (h.slot.dir || 'z') : ''}`).join('; ');
// 照合用テストピース: 穴を左右・上下・脚ごとに非対称に置いた山形鋼。1 本加工すれば、面の取り違え・原点の向き・y の基準の違いがすべて見分けられる
export const NC_TEST_PIECE = { spec: 'L-50x50x6', length: 300, material: 'SS400', name: '照合テストピース', holes: [{ face: 'A', z: 50, s: 20, d: 12 }, { face: 'A', z: 200, s: 30, d: 12, slot: { len: 30, dir: 'z' } }, { face: 'B', z: 100, s: 30, d: 14 }, { face: 'B', z: 250, s: 25, d: 14 }] };
