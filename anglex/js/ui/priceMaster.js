// 単価マスタ（学習）: C社回答の蓄積、見積への適用状況、単価表の見直し候補
import { h, modal, fmt, table, toast, download, csv } from './common.js';
import { listHistory, reviewCandidates, learnedFor } from '../core/pricing.js';
import { branchShort } from '../core/branches.js';

export async function openPriceMaster(app, est = null) {
  const host = h('div', {}); const m = modal({ title: '単価マスタ（学習）— C社回答の蓄積と単価表の見直し候補', wide: true, body: host });
  const hist = await listHistory(app); const cands = reviewCandidates(hist);
  host.append(h('div', { class: 'muted small', style: { marginBottom: '6px' } }, `蓄積 ${hist.length} 行（見積 ${new Set(hist.map(r => r.estNo)).size} 件、営業所 ${[...new Set(hist.map(r => r.branch).filter(Boolean))].map(branchShort).join('・') || '—'}）。同じ仕様が 2 件以上あると、次回の見積で基準原価と納期の初期値に使われます。`));
  const kpi = (k, v, cls = '') => h('div', { class: 'dash-kpi ' + cls }, h('span', {}, k), h('b', {}, String(v)));
  host.append(h('div', { class: 'dash-kpis' }, kpi('蓄積行', hist.length), kpi('学習キー（ファミリ×寸法区分）', cands.length), kpi('見直し候補（乖離 ≥10%・3 件以上）', cands.filter(c => c.flag).length, cands.some(c => c.flag) ? 'warn' : ''), kpi('受注不可の回答', hist.filter(r => r.accepted === false).length, hist.some(r => r.accepted === false) ? 'bad' : '')));
  if (est) { const rows = est.lines.map(l => { const g = l.learned || learnedFor(hist, l); return [l.no, l.desc, fmt.yen(l.modelCost ?? l.baseCost), g ? h('span', { class: 'd ' + (g.deviation > 0 ? 'up' : 'down') }, `${fmt.yen(g.suggested)}（${g.deviation > 0 ? '+' : ''}${g.deviation}%）`) : h('span', { class: 'muted' }, '学習値なし'), g ? `${g.n} 件・${g.level}` : '—', g?.leadDays != null ? g.leadDays + ' 日' : '—', l.learned ? h('span', { class: 'chip ok' }, '適用中') : '—']; }); host.append(h('h4', { style: { margin: '8px 0 4px' } }, `この見積 ${est.no} への適用`), h('div', { class: 'est-table' }, table(['No', '品名', 'モデル原価', '学習値（乖離）', '根拠', '納期', '状態'], rows))); }
  host.append(h('h4', { style: { margin: '10px 0 4px' } }, '単価表の見直し候補（想定＝モデル原価 と C社回答の乖離）'), cands.length ? h('div', { class: 'est-table' }, table(['', 'ファミリ', '寸法区分', '件数', '乖離（中央値）', '¥/kg', '納期', '受注不可', '営業所', '最終'], cands.map(c => [c.flag ? h('span', { class: 'chip warn' }, '見直し') : '', c.family, c.bucket, c.n, h('span', { class: 'd ' + (c.medianDev > 0 ? 'up' : 'down') }, `${c.medianDev > 0 ? '+' : ''}${c.medianDev}%`), c.perKg ? fmt.yen(c.perKg) : '—', c.lead != null ? c.lead + ' 日' : '—', c.accept || '—', c.branches.map(branchShort).join('・') || '—', fmt.date(c.last)]))) : h('div', { class: 'pp-empty' }, 'まだ C社の回答が蓄積されていません。C社が回答（A社へ受け渡し）すると自動で記録されます。'));
  host.append(h('div', { style: { marginTop: '8px', display: 'flex', gap: '6px' } }, h('button', { class: 'btn sm', disabled: !hist.length, onClick: () => download('単価マスタ_学習履歴.csv', csv([['日時', '見積', '営業所', 'ファミリ', '品名', '仕様', '質量', '数量', 'モデル原価', '工場単価', '¥/kg', '納期', '受注可否'], ...hist.map(r => [r.at, r.estNo, r.branch || '', r.family, r.desc, r.spec, r.mass, r.qty, r.baseCost, r.factoryCost, r.perKg ?? '', r.leadDays ?? '', r.accepted == null ? '' : r.accepted ? '可' : '不可'])]), 'text/csv') }, '履歴 CSV'), h('button', { class: 'btn sm', onClick: () => { m.close(); app.ratesDialog?.(); } }, '単価表を開く')));
  return m;
}
