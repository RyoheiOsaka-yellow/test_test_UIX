// プロパティパレット（Revit 風）: 選択インスタンスの タイプ/インスタンス パラメータを編集。式（=H-2*t）対応、3状態（確定/推論/要判断）表示
import { h, fmt, toast } from './common.js';
import { familyById } from '../bim/families.js';
import { summarize } from '../bim/weight.js';
import { costParts } from '../bim/cost.js';
import { holeFaces, FACE_LABEL, parseSpec } from '../geo/profiles.js';
import { ROLES, canEdit } from '../core/workflow.js';

export function renderProperties(app, host) {
  host.innerHTML = ''; const inst = app.selectedInstance(); const role = app.role();
  if (!inst) { host.append(h('div', { class: 'pp-empty' }, h('div', { class: 'pp-hint' }, '部材を選択するとプロパティを表示します'), h('div', { class: 'pp-sub' }, 'カタログ／ファミリから配置 → クリックで選択 → ここで寸法・仕様を編集。すべての変更は 3D・重量・見積に同時反映されます（単一ソース）'))); renderModelSummary(app, host); return; }
  const t = app.model.getType(inst.typeId); const fam = familyById(t.familyId); const p = app.model.resolved(inst); const parts = fam.parts(p, { inst, model: app.model }); const sum = summarize(parts.filter(x => !x.ref)); const cost = costParts(parts, app.rates());
  const editable = canEdit(role, 'model');
  const head = h('div', { class: 'pp-head' }, h('div', { class: 'pp-fam' }, fam.icon ? h('span', { class: 'pp-icon' }, fam.icon) : null, fam.name), h('div', { class: 'pp-type' }, h('input', { class: 'pp-typename', value: t.name, disabled: !editable, onChange: e => { app.model.renameType(t.id, e.target.value); app.refreshBrowser(); } })), h('div', { class: 'pp-mark' }, h('span', { class: 'chip' }, inst.mark), h('span', { class: 'chip ghost' }, t.familyId), h('span', { class: 'chip ghost' }, fam.ifc), statusChip(inst.status)));
  host.append(head);
  // 概要カード（重量・原価）
  host.append(h('div', { class: 'pp-card' }, h('div', { class: 'kv' }, h('span', {}, '製品質量'), h('b', {}, fmt.kg(sum.total))), h('div', { class: 'kv' }, h('span', {}, '鋼材（穴控除後）'), h('span', {}, fmt.kg(sum.steelNet))), h('div', { class: 'kv' }, h('span', {}, 'めっき付着'), h('span', {}, fmt.kg(sum.zinc))), h('div', { class: 'kv' }, h('span', {}, 'ボルト類'), h('span', {}, fmt.kg(sum.fasteners))), h('div', { class: 'kv' }, h('span', {}, '溶接金属 / 溶接長'), h('span', {}, `${fmt.kg(sum.welds)} / ${Math.round(sum.weldLength)} mm`)), h('div', { class: 'kv' }, h('span', {}, '穴 / 長穴'), h('span', {}, `${sum.holeCount} / ${sum.slotCount}`)), h('div', { class: 'kv' }, h('span', {}, '表面積'), h('span', {}, fmt.m2(sum.areaM2))), role !== 'B' ? h('div', { class: 'kv total' }, h('span', {}, '工場原価（単価）'), h('b', {}, fmt.yen(cost.factoryPrice))) : null));
  // パラメータ（グループ別、タイプ/インスタンスのスコープ表示）
  const groups = {}; for (const d of fam.params) (groups[d.group || '一般'] ||= []).push(d);
  const form = h('div', { class: 'pp-params' });
  for (const [g, defs] of Object.entries(groups)) {
    const sec = h('div', { class: 'pp-group' }, h('div', { class: 'pp-group-title' }, g)); form.append(sec);
    for (const d of defs) {
      const raw = inst.params[d.key] !== undefined ? inst.params[d.key] : (t.params[d.key] !== undefined ? t.params[d.key] : d.default); const isFormula = typeof raw === 'string' && raw.startsWith('='); const overridden = inst.params[d.key] !== undefined;
      let input;
      const commit = v => { if (!editable) return; if (d.scope === 'instance' || overridden) app.model.updateInstance(inst.id, { params: { [d.key]: v } }); else app.model.updateType(t.id, { [d.key]: v }); app.rebuildInstancesOfType(t.id); app.refreshProps(); };
      if (d.type === 'select') input = h('select', { disabled: !editable, onChange: e => commit(e.target.value) }, d.options.map(o => h('option', { value: o[0], selected: String(o[0]) === String(raw) }, o[1])));
      else if (d.type === 'bool') input = h('input', { type: 'checkbox', checked: !!p[d.key], disabled: !editable, onChange: e => commit(e.target.checked) });
      else if (d.type === 'sku') input = h('input', { value: raw ?? '', disabled: true });
      else input = h('input', { value: raw ?? '', class: isFormula ? 'formula' : '', disabled: !editable, title: isFormula ? `式 → ${p[d.key]}` : (d.help || ''), onChange: e => { const v = e.target.value; commit(v.startsWith('=') ? v : (d.type === 'text' || d.type === 'spec' ? v : (isNaN(+v) ? v : +v))); } });
      const row = h('div', { class: 'pp-row' + (d.scope === 'instance' ? ' inst' : ' type') }, h('label', { title: d.help || '' }, d.label, d.unit ? h('span', { class: 'unit' }, d.unit) : null, h('span', { class: 'scope', title: d.scope === 'instance' ? 'インスタンス パラメータ' : 'タイプ パラメータ（同タイプ全てに反映）' }, d.scope === 'instance' ? 'I' : 'T')), input, isFormula ? h('span', { class: 'fval' }, '= ' + (Math.round(p[d.key] * 100) / 100)) : null);
      if (d.type === 'spec') { const sp = parseSpec(p[d.key]); row.append(h('div', { class: 'pp-note' }, sp ? sp.label : '⚠ 仕様を解釈できません')); }
      if (d.key === 'holes') row.append(h('div', { class: 'pp-note' }, '面: ' + holeFaces(parseSpec(p.spec) || { kind: 'L' }).map(f => `${f}=${FACE_LABEL[f]}`).join(' / ')));
      sec.append(row);
    }
  }
  // インスタンス配置
  const place = h('div', { class: 'pp-group' }, h('div', { class: 'pp-group-title' }, '配置'), h('div', { class: 'pp-row inst' }, h('label', {}, '位置 X / Y / Z', h('span', { class: 'unit' }, 'mm')), h('div', { class: 'xyz' }, [0, 1, 2].map(k => h('input', { type: 'number', step: 5, value: Math.round(inst.pos[k]), disabled: !editable, onChange: e => { const pos = [...inst.pos]; pos[k] = +e.target.value; app.model.updateInstance(inst.id, { pos }); app.syncInstanceTransform(inst); } })))), h('div', { class: 'pp-row inst' }, h('label', {}, '回転 Y', h('span', { class: 'unit' }, '°')), h('input', { type: 'number', step: 15, value: Math.round((inst.rot[1] || 0) * 180 / Math.PI), disabled: !editable, onChange: e => { const rot = [...inst.rot]; rot[1] = +e.target.value * Math.PI / 180; app.model.updateInstance(inst.id, { rot }); app.syncInstanceTransform(inst); } })), h('div', { class: 'pp-row inst' }, h('label', {}, 'レベル'), h('select', { disabled: !editable, onChange: e => { const lv = app.model.levels.find(l => l.id === e.target.value); const pos = [...inst.pos]; pos[1] = lv.elev; app.model.updateInstance(inst.id, { level: lv.id, pos }); app.syncInstanceTransform(inst); } }, app.model.levels.map(l => h('option', { value: l.id, selected: l.id === inst.level }, `${l.name} (${l.elev})`)))), h('div', { class: 'pp-row inst' }, h('label', {}, '状態'), h('select', { onChange: e => app.model.updateInstance(inst.id, { status: e.target.value }) }, [['confirmed', '確定（図面根拠あり）'], ['inferred', '推論（ルール推定）'], ['review', '要判断']].map(o => h('option', { value: o[0], selected: inst.status === o[0] }, o[1])))), h('div', { class: 'pp-row inst' }, h('label', {}, 'メモ'), h('input', { value: inst.name || '', placeholder: '部材名・備考', onChange: e => app.model.updateInstance(inst.id, { name: e.target.value }) })));
  form.append(place); host.append(form);
  // 部品内訳
  const list = h('div', { class: 'pp-group' }, h('div', { class: 'pp-group-title' }, `部品内訳（${parts.filter(x => !x.ref).length}）`));
  const byGroup = {}; for (const pt of parts) (byGroup[pt.group || '本体'] ||= []).push(pt);
  for (const [g, pts] of Object.entries(byGroup)) { const det = h('details', { open: g === '本体' || g === '柱' }, h('summary', {}, `${g}（${pts.length}）`)); for (const pt of pts) { const w = sum.items.find(i => i === pt) ; det.append(h('div', { class: 'pp-part' + (pt.ref ? ' ref' : '') + (pt.site ? ' site' : ''), onMouseEnter: () => app.highlightPart(inst.id, pt), onMouseLeave: () => app.highlightPart(null) }, h('span', { class: 'pp-part-name' }, pt.name || pt.kind), h('span', { class: 'pp-part-spec' }, pt.kind === 'weld' ? `▷${pt.size} L=${Math.round(pt.length)}` : pt.spec ? `${pt.spec} L=${Math.round(pt.length || 0)}` : pt.M || ''), pt.holes?.length ? h('span', { class: 'chip ghost' }, `穴${pt.holes.length}`) : null, pt.ref ? h('span', { class: 'chip ghost' }, '参照') : null, pt.site ? h('span', { class: 'chip ghost' }, '現場') : null)); } list.append(det); }
  host.append(list);
  const btns = h('div', { class: 'pp-actions' }, h('button', { class: 'btn sm', disabled: !editable, onClick: () => { const n = app.model.duplicateInstance(inst.id); app.rebuildInstance(n); app.select(n.id); } }, '複製'), h('button', { class: 'btn sm', disabled: !editable, onClick: () => app.familyEditor(t.id) }, 'タイプ編集'), h('button', { class: 'btn sm', onClick: () => app.viewer.fit(app.groups.get(inst.id)) }, 'ズーム'), h('button', { class: 'btn sm danger', disabled: !editable, onClick: () => app.removeInstance(inst.id) }, '削除'));
  host.append(btns);
}
function statusChip(s) { const m = { confirmed: ['確定', 'ok'], inferred: ['推論', 'warn'], review: ['要判断', 'bad'] }[s] || ['確定', 'ok']; return h('span', { class: 'chip ' + m[1] }, m[0]); }
export function renderModelSummary(app, host) {
  const rows = app.model.explodeParts(); const sum = summarize(rows.filter(r => !r.ref)); const inst = app.model.instances.length;
  host.append(h('div', { class: 'pp-card' }, h('div', { class: 'pp-group-title' }, `モデル全体（${inst} インスタンス / ${app.model.types.length} タイプ / ${app.model.joints.length} 接合）`), h('div', { class: 'kv' }, h('span', {}, '総質量'), h('b', {}, fmt.kg(sum.total))), h('div', { class: 'kv' }, h('span', {}, '鋼材'), h('span', {}, fmt.kg(sum.steelNet))), h('div', { class: 'kv' }, h('span', {}, '溶接長'), h('span', {}, Math.round(sum.weldLength) + ' mm')), h('div', { class: 'kv' }, h('span', {}, '穴 / 長穴'), h('span', {}, `${sum.holeCount} / ${sum.slotCount}`)), h('div', { class: 'kv' }, h('span', {}, '要判断'), h('span', {}, app.model.instances.filter(i => i.status === 'review').length + ' 件'))));
}
