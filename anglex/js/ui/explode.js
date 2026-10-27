// 分解図パネル（v1 リボン用モーダル / 共通）: 部品ごとの分解スライダー・番号バルーン・部品表（行クリックで部品を単独表示）・個別部材化
import { $, h, modal, toast, confirmDialog, fmt } from './common.js';
import { summarize } from '../bim/weight.js';
import { exportExplodedPDF } from './reports.js';

export function explodePanel(app, inst, host) {
  host.innerHTML = ''; const fam = app.model.familyOf(inst); const parts = app.instanceParts(inst); const real = parts.filter(x => !x.ref && x.kind !== 'weld'); const welds = parts.filter(x => x.kind === 'weld');
  const g = app.groups.get(inst.id); const rng = $('#rngExplode');
  const slider = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: app.viewer.exploded || 0, onInput: e => { if (rng) rng.value = e.target.value; app.viewer.setExplode(+e.target.value, g); app.drawLevels(); } });
  const chk = h('input', { type: 'checkbox', checked: app.balloonInst === inst.id, onChange: e => app.setBalloons(e.target.checked ? inst.id : null) });
  host.append(h('div', { class: 'explode-ctl' }, h('span', {}, '分解'), slider, h('label', { class: 'chk' }, chk, 'バルーン'), h('button', { class: 'btn sm', onClick: () => { slider.value = 0; if (rng) rng.value = 0; app.isolatePart(null); app.viewer.setExplode(0, g); app.drawLevels(); render(); } }, '戻す'), h('span', { class: 'muted small' }, `${real.length} 部品 / 溶接 ${welds.length} 本`)));
  const tbl = h('table', { class: 'bom-table' }); host.append(tbl);
  const render = () => {
    tbl.innerHTML = ''; const sum = summarize(real); const iso = app.isolated && app.isolated.instId === inst.id ? app.isolated.index : null;
    tbl.append(h('thead', {}, h('tr', {}, ['No', '部品', '仕様', '長さ', '質量', '加工', ''].map((x, i) => h('th', { class: i >= 3 && i <= 5 ? 'r' : '' }, x)))));
    const tb = h('tbody', {}); tbl.append(tb);
    real.forEach((pt, i) => { const w = (sum.items || []).find(x => x === pt || (x.name === pt.name && x.spec === pt.spec)); const mass = w?.mass ?? w?.total ?? null; const proc = [pt.holes?.length ? `穴 ${pt.holes.length}${pt.holes.some(hh => hh.slot) ? '（長穴）' : ''}` : null, ['member', 'plate', 'pipe'].includes(pt.kind) ? '切断' : null, pt.kind === 'custom' && pt.custom === 'band' ? '曲げ' : null].filter(Boolean).join(' / ');
      const idx = parts.indexOf(pt); const tr = h('tr', { class: 'clickable' + (iso === idx ? ' sel' : ''), title: 'クリックでこの部品だけ表示（もう一度で解除）', onClick: () => { app.isolatePart(iso === idx ? null : { instId: inst.id, index: idx }); render(); } },
        h('td', {}, h('span', { class: 'balloon' + (iso === idx ? ' hot' : '') }, String(i + 1))), h('td', {}, pt.name || pt.kind), h('td', { class: 'mono' }, pt.spec || pt.M || pt.custom || ''), h('td', { class: 'r' }, pt.length ? String(Math.round(pt.length)) : ''), h('td', { class: 'r' }, mass != null ? fmt.kg(mass) : '—'), h('td', { class: 'r' }, proc || '—'), h('td', {}, { member: '形鋼', plate: '板', pipe: '管', bolt: 'ボルト', ubolt: 'Uボルト', anchor: 'アンカー', rod: '吊ボルト', nut: 'ナット', washer: '座金', custom: '加工品' }[pt.kind] || pt.kind));
      tb.append(tr); });
    if (welds.length) tb.append(h('tr', {}, h('td', { colspan: 7, class: 'muted small' }, `溶接 ${welds.length} 本 / 総長 ${Math.round(welds.reduce((a, w) => a + w.length, 0))} mm（現場 ${welds.filter(w => w.site).length} 本）— 分解中は非表示`)));
  };
  render();
  const canUngroup = fam.id !== 'member' && fam.id !== 'plate' && real.some(x => ['member', 'plate', 'pipe'].includes(x.kind));
  host.append(h('div', { class: 'explode-foot' }, h('button', { class: 'btn sm primary', disabled: !canUngroup || app.role() !== 'A', title: canUngroup ? '組立品を単材・板・管のインスタンスに分解（穴・仕様・配置を保持）' : '単材／板はこれ以上分解できません', onClick: async () => { if (!(await confirmDialog(`${inst.mark} を ${real.filter(x => ['member', 'plate', 'pipe'].includes(x.kind)).length} 個の個別部材に分解しますか？\nボルト類・溶接は集計から外れます（「接合」で再定義できます）。元に戻すには Ctrl+Z。`))) return; app.ungroupInstance(inst.id); host.dispatchEvent(new CustomEvent('ungrouped', { bubbles: true })); } }, '分解（個別部材化）'), h('button', { class: 'btn sm', onClick: () => exportExplodedPDF(app, inst) }, '分解図 PDF（バルーン＋部品表）'), h('button', { class: 'btn sm', onClick: () => $('#btnShot')?.click() }, '画像保存'), h('span', { class: 'muted small' }, '行クリック＝その部品だけ表示 ・ バルーン＝3D 上の部品番号')));
  return { render };
}

export function openExplode(app) {
  const inst = app.selectedInstance(); if (!inst) { toast('分解する部材を選択してください（3D でクリック）', 'warn'); return; }
  const body = h('div', { class: 'explode-wrap' }); const m = modal({ title: `分解図 — ${inst.mark} ${app.model.getType(inst.typeId).name}`, wide: true, body, cls: 'explode-modal', onClose: () => { /* 分解状態は維持（リボンの分解スライダーで戻せる） */ } });
  body.addEventListener('ungrouped', () => m.close());
  if (app.balloonInst !== inst.id) app.setBalloons(inst.id);
  explodePanel(app, inst, body);
}
