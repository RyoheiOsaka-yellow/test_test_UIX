// 部品の「親の情報」: 部品単体のデータ（NC・加工指示・部品 JSON・IFC・検査記録）を見ても、全体のどこに属し、何の役割で、何とつながるかが分かるようにする。
//   所属（架台の符号と型）・部品番号（n / 総数）・役割（柱・梁・斜材…）・向き・位置・相手部材（溶接でつながる同じ架台の部品、接合でつながる別の架台）
import * as THREE from 'three';
import { parseSpec, sectionBox } from '../geo/profiles.js';

export const ROLE_JA = { column: '柱', beam: '梁', brace: '斜材', base: 'ベース', plate: '板', arm: '腕', hanger: '吊り材', band: 'バンド', rod: '吊ボルト' };
const STEEL = pt => ['member', 'plate'].includes(pt.kind) && !pt.ref;
const local = (pl, p) => { const d = [p[0] - pl.pos[0], p[1] - pl.pos[1], p[2] - pl.pos[2]]; const [x, y, z] = pl.basis; return [d[0] * x[0] + d[1] * x[1] + d[2] * x[2], d[0] * y[0] + d[1] * y[1] + d[2] * y[2], d[0] * z[0] + d[1] * z[1] + d[2] * z[2]]; };
// 点 p（架台の座標）が部品の外形（断面の箱 × 長さ）の tol mm 以内にあるか
function near(pt, p, tol = 2.5) { const sp = parseSpec(pt.spec); if (!sp || !pt.pl) return false; const b = sectionBox(sp); const L = sp.kind === 'PL' ? (sp.h || pt.length || 0) : (pt.length || 0); const q = local(pt.pl, p); return q[0] > b.x0 - tol && q[0] < b.x1 + tol && q[1] > b.y0 - tol && q[1] < b.y1 + tol && q[2] > -tol && q[2] < L + tol; }

// 架台 1 体ぶん。戻り値は部品の並びと同じ長さの配列（鋼材でない部品は null）
export function partContexts(app, inst, parts = null) { parts = parts || app.instanceParts(inst); const fam = app.model.familyOf(inst), type = app.model.getType(inst.typeId); const steel = parts.map((pt, i) => STEEL(pt) ? i : -1).filter(i => i >= 0); const no = new Map(steel.map((i, k) => [i, k + 1]));
  const mates = new Map(steel.map(i => [i, new Set()])); // 溶接線の中点が外形の近くにある部品どうしは「溶接でつながる」
  for (const w of parts) { if (w.kind !== 'weld' || !w.from || !w.to) continue; const mid = [(w.from[0] + w.to[0]) / 2, (w.from[1] + w.to[1]) / 2, (w.from[2] + w.to[2]) / 2]; const hit = steel.filter(i => near(parts[i], mid)); for (const a of hit) for (const b of hit) if (a !== b) mates.get(a).add(b); }
  const ext = []; for (const j of app.model.joints || []) { const ids = [j.a, j.b, j.instA, j.instB].filter(Boolean); if (!ids.includes(inst.id)) continue; const other = app.model.instances.find(i => ids.includes(i.id) && i.id !== inst.id); if (other) ext.push(`${other.mark}（${j.type === 'bolt' ? 'ボルト' : j.type === 'ubolt' ? 'U ボルト' : '溶接'}）`); }
  const g = app.groups?.get(inst.id); if (g) g.updateWorldMatrix(true, false); const v = new THREE.Vector3(); const level = (app.model.levels || []).find(l => l.id === inst.level)?.name || '';
  return parts.map((pt, i) => { if (!no.has(i)) return null; const sp = parseSpec(pt.spec); const L = sp?.kind === 'PL' ? (sp.h || pt.length || 0) : (pt.length || 0); const z = pt.pl?.basis?.[2] || [0, 0, 1]; const c = pt.pl ? [pt.pl.pos[0] + z[0] * L / 2, pt.pl.pos[1] + z[1] * L / 2, pt.pl.pos[2] + z[2] * L / 2] : [0, 0, 0]; v.set(...c); let zw = new THREE.Vector3(...z); if (g) { v.applyMatrix4(g.matrixWorld); zw.transformDirection(g.matrixWorld); } else v.add(new THREE.Vector3(...(inst.pos || [0, 0, 0])));
    const dir = Math.abs(zw.y) > 0.99 ? '鉛直' : Math.abs(zw.y) < 0.05 ? '水平' : '斜め'; const ms = [...mates.get(i)].sort((a, b) => a - b);
    return { asm: inst.mark, asmName: type?.name || fam?.name || '', family: fam?.name || '', familyId: fam?.id || '', no: no.get(i), of: steel.length, mark: `${inst.mark}-${no.get(i)}`, name: pt.name || pt.spec || '', role: pt.role || '', roleJa: ROLE_JA[pt.role] || pt.group || '', dir, level, pos: [Math.round(v.x), Math.round(v.y), Math.round(v.z)], mates: ms.map(k => parts[k].name || parts[k].spec), mateMarks: ms.map(k => `${inst.mark}-${no.get(k)}`), joints: ext }; }); }
// 1 行の説明（帳票用）: 「MF-1 門型架台 ／ 梁（3/5・水平）／ 相手: 柱（左）・柱（右）」
export function contextLine(c) { if (!c) return ''; const who = [c.roleJa && c.roleJa !== c.name ? c.roleJa : null, `${c.no}/${c.of}`, c.dir].filter(Boolean).join('・'); const m = [...c.mates, ...c.joints]; return `${c.asm} ${c.asmName} ／ ${c.name}（${who}）${m.length ? ' ／ 相手: ' + m.join('・') : ''}`; }
// NC のコメント行用（英数字だけ。機械の表示で文字化けしないように、相手は符号で書く）
export function contextAscii(c) { if (!c) return ''; const a = s => String(s).replace(/[^\x20-\x7e]/g, '').trim(); return `ASM:${a(c.asm)} PART:${c.no}/${c.of}${c.role ? ' ROLE:' + a(c.role) : ''} POS:${c.pos.join(',')}${c.mateMarks.length ? ' MATES:' + c.mateMarks.map(a).join(',') : ''}`; }
