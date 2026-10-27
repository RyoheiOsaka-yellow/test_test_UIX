// 確認事項（人が必ず確認する箇所）と ズレ補正: 溶接・穴・アンカー・Uボルト・仕上げ・図面根拠 をチェックリスト化し、
// 3D 上にアラート（旗）を立てる。ズレ（隙間・レベル不一致・穴の板外/非5mm単位・配管位置）を検出して自動補正する。
import * as THREE from 'three';
import { plateBoxes } from './joints.js';
import { parseSpec, sectionBox, decompose } from '../geo/profiles.js';
import { xform } from './families.js';
// 穴の位置（インスタンス座標）: 面→板ローカル (u,v) → 部品座標 → 配置
export function holePos(pt, h) { try { const sp = parseSpec(pt.spec); if (!sp) return null; const plates = decompose(sp, pt.length); const pl = plates.find(q => q.name === h.face) || plates[0]; if (!pl) return null; const [u, v] = pl.map(h.z, h.s); const loc = new THREE.Vector3(u, v, pl.t / 2).applyMatrix4(pl.M); return new THREE.Vector3(...xform(pt.pl, [loc.x, loc.y, loc.z])); } catch { return null; } }

export const REVIEW_KINDS = { weld: '溶接', hole: '穴あけ', anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', finish: '仕上げ', origin: '図面根拠', risk: 'リスク要因', length: '寸法' };
// チェックリスト生成（parts = app.instanceParts(inst)）
export function buildChecklist(inst, parts, { importOnly = true } = {}) {
  const items = []; const V = a => new THREE.Vector3(...a); const imported = inst.source === 'import';
  const welds = {}; for (const pt of parts) if (pt.kind === 'weld') { const k = pt.group || '溶接'; (welds[k] ||= { L: 0, n: 0, size: pt.size, site: pt.site, type: pt.weldType, mid: V(pt.from) }); welds[k].L += pt.length; welds[k].n++; }
  for (const [g, w] of Object.entries(welds)) items.push({ id: 'weld:' + g, kind: 'weld', label: `${g}  ${w.type === 'butt' ? '突合せ' : '隅肉'} ▷${w.size}  L=${Math.round(w.L)}mm（${w.site ? '現場 ▶' : '工場'}）`, need: '溶接の要否・脚長・全周/片側・現場/工場を確認', pos: w.mid, mustCheck: true });
  const holes = {}; parts.forEach((pt, pi) => { if (!pt.holes || pt.ref) return; for (const h of pt.holes) { const k = `${pt.name || pt.spec}|${h.kind || 'general'}|${h.d}${h.slot ? 'x' + h.slot.len : ''}`; const o = (holes[k] ||= { part: pt.name || pt.spec, kind: h.kind || 'general', d: h.d, slot: h.slot, n: 0, partIndex: pi, first: h }); o.n++; } });
  for (const o of Object.values(holes)) { const use = { anchor: 'アンカー', ubolt: 'Uボルト', rod: '吊ボルト', joint: '接合ボルト', general: '一般' }[o.kind] || o.kind; items.push({ id: 'hole:' + o.part + ':' + o.kind + ':' + o.d, kind: 'hole', label: `${o.part}  ${o.slot ? `長穴 ${o.d}×${o.slot.len}` : `丸穴 φ${o.d}`} ×${o.n}（${use}）`, flag: `${o.slot ? '長穴' : '穴'} φ${o.d}×${o.n}`, need: '穴径・ピッチ・端あき・面を確認', partIndex: o.partIndex, hole: o.first, pos: holePos(parts[o.partIndex], o.first), mustCheck: o.kind !== 'ubolt' }); }
  const anchors = parts.filter(p => p.kind === 'anchor'); if (anchors.length) items.push({ id: 'anchor', kind: 'anchor', label: `アンカー ${anchors[0].M} ×${anchors.length}（現場施工）`, need: 'アンカー種別・埋込深さ・母材を確認', pos: V(anchors[0].pl.pos), mustCheck: true });
  const ubs = parts.filter(p => p.kind === 'ubolt'); const ubg = {}; for (const u of ubs) (ubg[u.nominal || u.od] ||= { n: 0, M: u.M, pos: V(u.pl.pos) }).n++; for (const [k, u] of Object.entries(ubg)) items.push({ id: 'ubolt:' + k, kind: 'ubolt', label: `Uボルト ${u.M} ×${u.n}（配管 ${k}）`, need: '管径・メーカー差（ピッチ P）・材質を確認', pos: u.pos, mustCheck: imported });
  const rods = parts.filter(p => p.kind === 'rod'); if (rods.length) items.push({ id: 'rod', kind: 'rod', label: `吊ボルト ${rods[0].M} ×${rods.length} L=${rods[0].L}`, need: '吊り長さ・ナット位置を確認', pos: V(rods[0].pl.pos), mustCheck: imported });
  const fin = parts.find(p => p.finish && !p.ref && p.kind !== 'weld'); if (fin) items.push({ id: 'finish', kind: 'finish', label: `仕上げ ${fin.finish}`, need: 'めっき/塗装の仕様を確認', mustCheck: imported });
  if (inst.status !== 'confirmed') items.push({ id: 'origin', kind: 'origin', label: `図面根拠: ${inst.status === 'inferred' ? '推論（ルール推定）' : '要判断'}${inst.name ? ' — ' + inst.name : ''}`, need: '図面・注記で寸法と仕様を裏付ける', mustCheck: true });
  if (inst.reviewReasons?.length) for (const r of inst.reviewReasons) items.push({ id: 'risk:' + r.slice(0, 24), kind: 'risk', label: r, need: 'リスク行列の主因。根拠を追加して確信度を上げる', mustCheck: true });
  for (const it of items) { const st = inst.review?.[it.id]; it.status = st?.status || ((importOnly ? (imported ? it.mustCheck : it.kind === 'weld') : it.mustCheck) ? 'open' : 'ok'); it.note = st?.note || ''; it.at = st?.at || null; }
  return items;
}
export function openCount(items) { return items.filter(i => i.status === 'open').length; }

// ---------- ズレ検出 ----------
const AX = ['x', 'y', 'z'];
export function detectMisalignment(app) {
  const model = app.model; const alerts = []; const insts = model.instances; const pbs = new Map(); for (const i of insts) { try { pbs.set(i.id, plateBoxes(model, i)); } catch { pbs.set(i.id, []); } }
  // 1) 隙間（0.5〜60mm）: 面が平行に向き合い、他2軸で重なる
  for (let a = 0; a < insts.length; a++) for (let b = a + 1; b < insts.length; b++) { const A = insts[a], B = insts[b]; let best = null; for (const pa of pbs.get(A.id)) for (const pb of pbs.get(B.id)) { if (pa.part.ref || pb.part.ref) continue; for (const ax of AX) { const o = AX.filter(k => k !== ax); const overlap = o.every(k => Math.min(pa.box.max[k], pb.box.max[k]) - Math.max(pa.box.min[k], pb.box.min[k]) > 5); if (!overlap) continue; const g1 = pb.box.min[ax] - pa.box.max[ax], g2 = pa.box.min[ax] - pb.box.max[ax]; const g = g1 > 0.5 ? g1 : g2 > 0.5 ? g2 : null; if (g == null || g > 60) continue; if (!best || g < best.gap) best = { gap: g, axis: ax, dir: g1 > 0.5 ? -1 : 1, pa, pb }; } }
    if (best) { const onLevel = i => model.levels.some(l => Math.abs(l.elev - i.pos[1]) <= 1); let mover = B, dir = best.dir; // Y 方向の隙間はレベルに載っていない側を動かす（両方レベル上なら自動補正しない＝部材長で調整）
      let ext = null; // 両方レベル上: 下側の部材を伸ばして密着（単材 axis=y → L、門型架台/ポール → H）
      if (best.axis === 'y') { if (onLevel(B) && !onLevel(A)) { mover = A; dir = -dir; } else if (onLevel(A) && onLevel(B)) { mover = null; const lower = best.dir === -1 ? A : B; ext = extendable(model, lower); } }
      const delta = [0, 0, 0]; delta[AX.indexOf(best.axis)] = dir * best.gap; const gmm = Math.round(best.gap * 10) / 10;
      const fixLabel = mover ? `${mover.mark} を ${gmm} mm 寄せて密着` : ext ? `${ext.inst.mark} の ${ext.label} を +${gmm} mm（${ext.cur} → ${Math.round((ext.cur + best.gap) * 10) / 10}）で密着` : '両方レベル上・伸ばせる部材なし（手動で寸法調整）';
      const fix = mover ? () => { model.updateInstance(mover.id, { pos: mover.pos.map((v, i) => v + delta[i]) }); app.syncInstanceTransform(mover); } : ext ? () => { model.updateInstance(ext.inst.id, { params: { [ext.key]: Math.round((ext.cur + best.gap) * 10) / 10 } }); app.rebuildInstance(ext.inst); } : null;
      alerts.push({ id: `gap:${A.id}:${B.id}`, kind: 'gap', label: `${A.mark} と ${B.mark} の間に隙間 ${gmm} mm（${best.axis.toUpperCase()} 方向）`, instIds: [A.id, B.id], fixLabel, fix }); } }
  // 2) レベル不一致: 原点 y がどのレベルとも一致しない（±1mm）
  for (const i of insts) { const lv = model.levels.find(l => Math.abs(l.elev - i.pos[1]) <= 1); if (!lv) { const near = model.levels.reduce((p, c) => Math.abs(c.elev - i.pos[1]) < Math.abs(p.elev - i.pos[1]) ? c : p); const d = near.elev - i.pos[1]; if (Math.abs(d) <= 150) alerts.push({ id: 'level:' + i.id, kind: 'level', label: `${i.mark} の高さ ${Math.round(i.pos[1])} が ${near.name}（${near.elev}）と ${Math.round(d)} mm ずれ`, instIds: [i.id], fixLabel: `${near.name} に合わせる`, fix: () => { model.updateInstance(i.id, { pos: [i.pos[0], near.elev, i.pos[2]], level: near.id }); app.syncInstanceTransform(i); } }); } }
  // 3) 穴: 板外・5mm 単位でない（単材/板ファミリの DSL と extraHoles を対象）
  for (const i of insts) { const parts = app.instanceParts(i); parts.forEach((pt, pi) => { if (!pt.holes || pt.ref || !['member', 'plate', 'pipe'].includes(pt.kind)) return; const sp = parseSpec(pt.spec); if (!sp) return; const sb = sectionBox(sp); const width = sp.kind === 'PL' ? (sp.w || 100) : sp.kind === 'L' ? Math.max(sp.A, sp.B) : sp.kind === 'C' || sp.kind === 'LC' || sp.kind === 'H' ? Math.max(sp.H, sp.B || sp.A || 0) : sp.kind === 'FB' ? sp.w : sb.w; const bad = [], off = []; for (const h of pt.holes) { if (h.z < h.d / 2 || h.z > pt.length - h.d / 2 || h.s < h.d / 2 || h.s > width - h.d / 2) bad.push(h); if (Math.abs(h.z - Math.round(h.z / 5) * 5) > 0.01 || Math.abs(h.s - Math.round(h.s / 5) * 5) > 0.01) off.push(h); }
      const editable = ['member', 'plate'].includes(model.familyOf(i).id) || (i.params.extraHoles || '').length > 0;
      if (bad.length && editable) alerts.push({ id: `holeout:${i.id}:${pi}`, kind: 'hole', label: `${i.mark} ${pt.name || pt.spec}: 穴 ${bad.length} 個が板外（端あき不足）`, instIds: [i.id], fixLabel: '端あき 1.5d へ寄せる', fix: () => clampHoles(app, i, pt, pi, width) });
      if (off.length && editable) alerts.push({ id: `holegrid:${i.id}:${pi}`, kind: 'hole', label: `${i.mark} ${pt.name || pt.spec}: 穴 ${off.length} 個が 5mm 単位でない`, instIds: [i.id], fixLabel: '5mm 単位へ丸める', fix: () => roundHoles(app, i, pt, pi) }); }); }
  // 4) 配管位置が部材外（pipes DSL の位置指定）
  for (const i of insts) { const p = model.resolved(i); if (!p.pipes || !/@/.test(p.pipes)) continue; const span = p.L || p.W || p.A || 0; if (!span) continue; const items = String(p.pipes).split(/[,、\s]+/).filter(Boolean); const outs = items.filter(s => { const m = s.match(/@(-?\d+(?:\.\d+)?)/); return m && (+m[1] < 0 || +m[1] > span); }); if (outs.length) alerts.push({ id: 'pipeout:' + i.id, kind: 'pipe', label: `${i.mark}: 配管位置 ${outs.join(',')} が部材長 ${span} の外`, instIds: [i.id], fixLabel: '部材内へクランプ', fix: () => { const fixed = items.map(s => s.replace(/@(-?\d+(?:\.\d+)?)/, (m, v) => '@' + Math.min(span - 30, Math.max(30, +v)))).join(','); model.updateInstance(i.id, { params: { pipes: fixed } }); app.rebuildInstance(i); } }); }
  // 5) 接触が無い接合
  for (const j of model.joints) if (j.warning) { const A = model.getInstance(j.a), B = model.getInstance(j.b); if (!A || !B) continue; const g = alerts.find(x => x.kind === 'gap' && x.instIds.includes(A.id) && x.instIds.includes(B.id)); alerts.push({ id: 'joint:' + j.id, kind: 'joint', label: `接合 ${j.label}: 接触面なし`, instIds: [A.id, B.id], fixLabel: g ? '隙間を詰めて再評価' : '部材を手動で接触させる', fix: g ? () => { g.fix(); app.rebuildAll(); } : null }); }
  return alerts;
}
// 上方向へ伸ばせる寸法: 単材（配置軸 Y）の L、門型架台・ポールの H
function extendable(model, inst) { const fam = model.familyOf(inst); const p = model.resolved(inst); if (fam.id === 'member' && p.axis === 'y') return { inst, key: 'L', label: '長さ L', cur: p.L }; if ((fam.id === 'portal_frame' || fam.id === 'pole') && p.H != null) return { inst, key: 'H', label: '高さ H', cur: p.H }; return null; }
function holeSourceOf(app, inst, pt, pi) { // 穴の出所: 単材/板の holes DSL か extraHoles
  const fam = app.model.familyOf(inst); if (fam.id === 'member') return { key: 'holes' }; return { key: 'extraHoles', partIndex: pi }; }
export function holeDSL(h) { return `${h.face}:z${Math.round(h.z * 10) / 10} s${Math.round(h.s * 10) / 10} d${h.d}${h.slot ? ' slot' + h.slot.len + h.slot.dir : ''}`; }
function rewriteHoles(app, inst, pt, pi, mapFn) { const src = holeSourceOf(app, inst, pt, pi); const fam = app.model.familyOf(inst); if (src.key === 'holes') { const dsl = pt.holes.filter(h => !h.id).map(mapFn).map(holeDSL).join('; '); app.model.updateInstance(inst.id, { params: { holes: dsl } }); } else { const dsl = pt.holes.filter(h => h.extra).map(mapFn).map(h => `${pi}|${holeDSL(h)}`).join('\n'); const others = String(inst.params.extraHoles || '').split('\n').filter(l => l && !l.startsWith(pi + '|')).join('\n'); app.model.updateInstance(inst.id, { params: { extraHoles: [others, dsl].filter(Boolean).join('\n') } }); } app.rebuildInstance(inst); }
function clampHoles(app, inst, pt, pi, width) { const g5 = v => Math.ceil(v / 5) * 5; rewriteHoles(app, inst, pt, pi, h => ({ ...h, z: Math.min(Math.floor((pt.length - 1.5 * h.d) / 5) * 5, Math.max(g5(1.5 * h.d), h.z)), s: Math.min(Math.floor((width - 1.5 * h.d) / 5) * 5, Math.max(g5(1.5 * h.d), h.s)) })); }
function roundHoles(app, inst, pt, pi) { rewriteHoles(app, inst, pt, pi, h => ({ ...h, z: Math.round(h.z / 5) * 5, s: Math.round(h.s / 5) * 5 })); }
// extraHoles DSL（全ファミリ共通・インスタンス パラメータ）: "<partIndex>|<face>:z s d [slotNNz]" 行区切り
export function parseExtraHoles(str) { const out = []; for (const line of String(str || '').split('\n')) { const m = line.match(/^(\d+)\|(.+)$/); if (!m) continue; const pi = +m[1]; const body = m[2]; const mm = body.match(/^([A-Za-z]+)\s*[:：]\s*(.*)$/); const face = mm ? mm[1] : 'A'; const b = mm ? mm[2] : body; const h = { face, z: 0, s: 0, d: 12, extra: true }; let r; if ((r = b.match(/z\s*(-?\d+(?:\.\d+)?)/))) h.z = +r[1]; if ((r = b.match(/s\s*(-?\d+(?:\.\d+)?)/))) h.s = +r[1]; if ((r = b.match(/(?:d|φ)\s*(\d+(?:\.\d+)?)/))) h.d = +r[1]; if ((r = b.match(/slot\s*(\d+(?:\.\d+)?)\s*([zs])?/))) h.slot = { len: +r[1], dir: (r[2] || 'z') }; out.push({ partIndex: pi, hole: h }); } return out; }
