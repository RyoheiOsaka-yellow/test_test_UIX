// 3D 内のコンテキストバー: 触った部材／部品の横に「足りないものを足す」操作を出す
// （同じ部材を隣に追加 / 穴 / 溶接 / ファミリ固有の追加（方杖・アンカー・配管…） / 関連寸法の微調整 / 軸ロック移動 / 単独表示 / ズレ補正）
import { $, h, toast, promptDialog } from './common.js';
import { weldInstructionDialog, holeInstructionDialog, openAlign } from './review.js';
import { detectMisalignment } from '../bim/review.js';
import { cadRole } from '../viewer/scene.js';
import { openExplode } from './explode.js';

// 部品の役割 → 関係する寸法パラメータ（名前のヒューリスティック）
const RELATED = { column: /^(H|L|colSpec|spec|t)$/, beam: /^(W|L|beamSpec|spec|overhang|B)$/, base: /^(base|anchor|t|W|H)/, brace: /^(brace|A|H|L)/, support: /^(L|A|spec|rodM|rodL|t|B)$/, pipe: /^(pipes|pipeKind|ubolt|od|nominal)$/, ubolt: /^(pipes|ubolt|od)$/, anchor: /^anchor/, rod: /^(rod|d|L)/, band: /^(od|t|B|d|L1|L2)$/, plate: /^(t|W|H|cols|rows|pitch|holeD|slot)/, steel: /^(spec|L|W|H|A|t)$/ };

export function hideContextBar(app) { const el = document.querySelector('.ctx-bar'); if (el) el.remove(); app.ctx = null; }

export function showContextBar(app, { inst, partIndex = null, part = null, x = 0, y = 0 }) {
  hideContextBar(app); const stage = $('#d3stage') || $('#stage'); if (!stage || !inst) return; const editable = app.role() === 'A';
  const fam = app.model.familyOf(inst); const type = app.model.getType(inst.typeId); const p = app.model.resolved(inst); const parts = app.instanceParts(inst); const pt = part || (partIndex != null ? parts[partIndex] : null);
  const role = pt ? cadRole(pt) : null; app.ctx = { inst, partIndex, part: pt };
  const bar = h('div', { class: 'ctx-bar', onClick: e => e.stopPropagation() });
  bar.append(h('div', { class: 'ctx-head' }, h('b', {}, inst.mark), ' ', h('span', { class: 'muted' }, type.name), pt ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, `${pt.name || pt.kind}${pt.spec ? ' ' + pt.spec : ''}`) : h('span', { class: 'chip ghost', style: { marginLeft: '6px' } }, '部材全体（もう一度クリックで部品を選択）'), h('button', { class: 'icon-btn', title: '閉じる', onClick: () => hideContextBar(app) }, '✕')));
  const row1 = h('div', { class: 'ctx-row' });
  // 1) 足す
  row1.append(h('button', { class: 'btn sm primary', disabled: !editable, title: '同じタイプの部材を隣（X 方向）に追加', onClick: () => app.addAdjacent(inst.id) }, '＋ 同じ部材を隣に'));
  row1.append(h('button', { class: 'btn sm', disabled: !editable, title: 'この部品に穴を追加（面・径・ピッチ・端あき）', onClick: () => holeInstructionDialog(app, inst, { id: 'hole:manual', partIndex: partIndex ?? parts.findIndex(q => ['member', 'plate'].includes(q.kind) && !q.ref), hole: pt?.holes?.[0] || null }) }, '＋ 穴'));
  row1.append(h('button', { class: 'btn sm', disabled: !editable, title: '端部溶接／脚長・工場/現場を指示', onClick: () => weldInstructionDialog(app, inst, { id: 'weld:manual' }) }, '＋ 溶接'));
  const adds = familyAdds(app, inst, fam, p); if (adds.length && editable) { const pop = h('div', { class: 'ctx-pop' }, ...adds.map(a => h('button', { class: 'btn sm', onClick: () => { a.run(); hideContextBar(app); } }, a.label))); row1.append(h('div', { class: 'ctx-menu' }, h('button', { class: 'btn sm', onClick: e => { e.stopPropagation(); pop.classList.toggle('open'); } }, '＋ 足す ▾'), pop)); }
  bar.append(row1);
  // 2) 関連寸法（±5mm ステッパー）
  const rel = fam.params.filter(d => ['length', 'number', 'int'].includes(d.type) && (!role || !RELATED[role] || RELATED[role].test(d.key))).slice(0, 5);
  if (rel.length) { const row2 = h('div', { class: 'ctx-row dims' }, h('span', { class: 'muted small' }, '寸法')); for (const d of rel) { const cur = p[d.key]; const inp = h('input', { type: 'number', value: cur, step: d.type === 'int' ? 1 : 5, disabled: !editable, title: `${d.label}（${d.scope === 'instance' ? 'インスタンス' : 'タイプ: 同タイプ全てに反映'}）` }); const apply = v => { if (d.scope === 'instance') { app.model.updateInstance(inst.id, { params: { [d.key]: v } }); app.rebuildInstance(inst); } else { app.model.updateType(type.id, { [d.key]: v }); app.rebuildInstancesOfType(type.id); } app.refreshProps(); }; inp.addEventListener('change', () => apply(+inp.value)); row2.append(h('label', { class: 'ctx-dim' }, h('span', {}, d.label.replace(/（.*?）/, '')), h('button', { class: 'tiny', disabled: !editable, onClick: () => { inp.value = +inp.value - (d.type === 'int' ? 1 : 5); apply(+inp.value); } }, '−'), inp, h('button', { class: 'tiny', disabled: !editable, onClick: () => { inp.value = +inp.value + (d.type === 'int' ? 1 : 5); apply(+inp.value); } }, '＋'), h('span', { class: 'scope' }, d.scope === 'instance' ? 'I' : 'T'))); } bar.append(row2); }
  // 3) 移動（軸ロック）・表示
  const row3 = h('div', { class: 'ctx-row' });
  if (editable) { row3.append(h('span', { class: 'muted small' }, '移動'), ...[['x', 'X'], ['y', 'Y（上下）'], ['z', 'Z'], ['all', '自由']].map(([a, l]) => h('button', { class: 'btn sm' + (app.gizmoAxis === a && app.gizmoMode === 'translate' ? ' on' : ''), title: `${l} 方向だけに 5mm 刻みで移動。移動後に 10mm 以内の隙間は自動で密着`, onClick: () => { app.setGizmoAxis(a); bar.querySelectorAll('.ctx-row:nth-child(3) .btn').forEach(b => b.classList.remove('on')); } }, l))); }
  row3.append(h('button', { class: 'btn sm' + (app.isolated && app.isolated.instId === inst.id ? ' on' : ''), title: 'この部品だけ表示', disabled: partIndex == null, onClick: () => { app.isolatePart(app.isolated && app.isolated.instId === inst.id ? null : { instId: inst.id, index: partIndex }); } }, '単独表示'), h('button', { class: 'btn sm', onClick: () => app.viewer.focusOn(app.groups.get(inst.id)) }, '中央へ'), h('button', { class: 'btn sm', onClick: () => openExplode(app) }, '分解図'));
  // 取付先へスナップ（配管を持つ他の部材へ）
  const targets = app.model.instances.filter(i => i.id !== inst.id).map(i => ({ i, refs: app.pipeRefsOf(i), d: Math.hypot(...i.pos.map((v, k) => v - inst.pos[k])) })).filter(t => t.refs.length).sort((a, b) => a.d - b.d).slice(0, 6);
  const fits = app.pipeFitParam(inst); // 口径パラメータ（pipes / od / nominal）があれば、取付と同時に口径も合わせる
  if (targets.length && editable) { const pop = h('div', { class: 'ctx-pop' }, fits ? h('div', { class: 'muted small', style: { padding: '2px 6px' } }, `取付先の口径に「${fits.label}」も合わせます（Uボルト穴ピッチ・配管位置が同時に揃う）`) : null, ...targets.map(({ i, d, refs }) => h('button', { class: 'btn sm', onClick: () => { app.attachTo(inst.id, i.id); hideContextBar(app); } }, `${i.mark} ${app.model.getType(i.typeId).name} — 配管 ${[...new Set(refs.map(r => r.nominal || Math.round(r.od) + 'φ'))].join('/')}（${Math.round(d / 100) / 10} m）`))); row3.append(h('div', { class: 'ctx-menu' }, h('button', { class: 'btn sm', title: '選んだ部材の配管へ、向きを合わせて取り付ける（空いている位置へ）。口径パラメータがあれば同時に合わせる', onClick: e => { e.stopPropagation(); pop.classList.toggle('open'); } }, (fits ? '配管へ取付（口径も合わせる）' : '配管へ取付') + ' ▾'), pop)); }
  // 逆方向: この部材が配管（支持対象）なら、近くの支持金具をこの配管へ呼び寄せる
  const myRefs = app.pipeRefsOf(inst).filter(r => !r.pt.ref);
  if (myRefs.length && editable) { const sup = app.model.instances.filter(i => i.id !== inst.id && app.pipeFitParam(i)).map(i => ({ i, d: Math.hypot(...i.pos.map((v, k) => v - inst.pos[k])) })).sort((a, b) => a.d - b.d).slice(0, 6); if (sup.length) { const pop = h('div', { class: 'ctx-pop' }, h('div', { class: 'muted small', style: { padding: '2px 6px' } }, `この配管 ${[...new Set(myRefs.map(r => r.nominal))].join('/')} に合わせて支持金具を取り付けます`), ...sup.map(({ i, d }) => h('button', { class: 'btn sm', onClick: () => { app.attachTo(i.id, inst.id); hideContextBar(app); } }, `${i.mark} ${app.model.getType(i.typeId).name}（${Math.round(d / 100) / 10} m）`))); row3.append(h('div', { class: 'ctx-menu' }, h('button', { class: 'btn sm', title: '選んだ支持金具の口径をこの配管に合わせ、ここへ取り付ける', onClick: e => { e.stopPropagation(); pop.classList.toggle('open'); } }, '支持金具をここへ ▾'), pop)); } }
  let alerts = []; try { alerts = detectMisalignment(app).filter(a => a.instIds.includes(inst.id)); } catch { }
  if (alerts.length) row3.append(h('button', { class: 'btn sm danger', title: alerts.map(a => a.label).join('\n'), onClick: () => openAlign(app) }, `ズレ ${alerts.length} → 補正`));
  bar.append(row3);
  // 位置: クリック位置の右下。はみ出しは補正
  stage.append(bar); const r = stage.getBoundingClientRect(); const bw = bar.offsetWidth, bh = bar.offsetHeight; let left = x + 14, top = y + 14; if (left + bw > r.width - 8) left = Math.max(8, x - bw - 14); if (top + bh > r.height - 8) top = Math.max(8, r.height - bh - 8); bar.style.left = left + 'px'; bar.style.top = top + 'px';
}

// ファミリ固有の「足す」: bool を ON / 個数 +1 / 配管を追加 / 段数 +1 など
function familyAdds(app, inst, fam, p) {
  const out = []; const set = (k, v, label) => ({ label, run: () => { const d = fam.params.find(x => x.key === k); if (d?.scope === 'instance') { app.model.updateInstance(inst.id, { params: { [k]: v } }); app.rebuildInstance(inst); } else { app.model.updateType(inst.typeId, { [k]: v }); app.rebuildInstancesOfType(inst.typeId); } app.refreshProps(); toast(label + ' — 反映しました', 'ok'); } });
  for (const d of fam.params) {
    if (d.type === 'bool' && !p[d.key]) out.push(set(d.key, true, `${d.label} を追加`));
    else if (d.type === 'int' && /n$|N$|cols|rows|count|段|本数|個数/.test(d.key + d.label)) out.push(set(d.key, (+p[d.key] || 0) + 1, `${d.label} を +1（${p[d.key]} → ${(+p[d.key] || 0) + 1}）`));
    else if (d.key === 'pipes') out.push({ label: '配管（Uボルト）を追加…', run: async () => { const r = await promptDialog('配管を追加', [{ key: 'size', label: '呼び径（例: 50A / 50A@300）', value: '50A' }]); if (!r || !r.size) return; const cur = String(p.pipes || '').trim(); const v = cur ? cur + ',' + r.size.trim() : r.size.trim(); set('pipes', v, `配管 ${r.size} を追加`).run(); } });
    else if (d.key === 'baseFix' && p.baseFix === 'weld') out.push(set('baseFix', 'bolt', 'ベースをボルト止めに（アンカー＋ボルト）'));
    else if (d.key === 'base' && p.base === false) out.push(set('base', true, 'ベースプレートを追加'));
  }
  if (fam.id === 'member' || fam.id === 'plate') out.push({ label: '端部溶接を追加（両端 全周）', run: () => { app.model.updateInstance(inst.id, { params: { welds: 'start:6; end:6' } }); app.rebuildInstance(inst); app.refreshProps(); toast('端部溶接 ▷6 を追加しました', 'ok'); } });
  out.push({ label: '接合（溶接／ボルト）を別の部材と定義…', run: () => $('#btnJoint')?.click() });
  return out.slice(0, 10);
}
