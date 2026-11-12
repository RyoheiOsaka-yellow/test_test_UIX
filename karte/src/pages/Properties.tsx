import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { STAFF, TODAY, daysBetween, fmtDate, fmtMan, fmtYm, matches, properties, type Property } from '../data';
import { Empty, ScoreBar, useStore } from '../ui';

type SortKey = 'overall' | 'age' | 'nextInspection' | 'cost' | 'due' | 'name';

const PREFS = [...new Set(properties.map((p) => p.pref))];
const STRUCTURES = ['木造', '軽量鉄骨造', 'RC造'];
const AGE_BANDS = [
  { label: '築10年未満', test: (a: number) => a < 10 },
  { label: '築10〜19年', test: (a: number) => a >= 10 && a < 20 },
  { label: '築20〜29年', test: (a: number) => a >= 20 && a < 30 },
  { label: '築30年以上', test: (a: number) => a >= 30 },
];

export default function Properties() {
  const { findings } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const pref = params.get('pref') ?? '';
  const structure = params.get('structure') ?? '';
  const band = params.get('band') ?? '';
  const level = params.get('level') ?? '';
  const staff = params.get('staff') ?? '';
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>(() => ({
    key: (params.get('sort') as SortKey) || 'due',
    asc: true,
  }));

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const stat = new Map<string, { urgent: number; watch: number; cost: number; due: string | null }>();
    for (const f of findings) {
      if (f.severity === 'ok' || f.status === '完了') continue;
      const s = stat.get(f.propertyId) ?? { urgent: 0, watch: 0, cost: 0, due: null };
      s[f.severity] += 1;
      s.cost += f.estCost;
      if (f.dueBy && (!s.due || f.dueBy < s.due)) s.due = f.dueBy;
      stat.set(f.propertyId, s);
    }
    const list = properties
      .map((p) => ({ p, s: stat.get(p.id) ?? { urgent: 0, watch: 0, cost: 0, due: null } }))
      .filter(({ p, s }) => {
        if (!matches(q, p.name, p.address, p.owner, p.ownerKana, p.id, p.staff, p.branch)) return false;
        if (pref && p.pref !== pref) return false;
        if (structure && p.structure !== structure) return false;
        if (band && !AGE_BANDS.find((b) => b.label === band)?.test(p.age)) return false;
        if (staff && p.staff !== staff) return false;
        if (level === 'urgent' && s.urgent === 0) return false;
        if (level === 'watch' && (s.urgent > 0 || s.watch === 0)) return false;
        if (level === 'none' && s.urgent + s.watch > 0) return false;
        return true;
      });
    const val = (r: { p: Property; s: { cost: number; due: string | null } }): string | number => {
      switch (sort.key) {
        case 'overall':
          return r.p.overall;
        case 'age':
          return r.p.age;
        case 'nextInspection':
          return r.p.nextInspection;
        case 'cost':
          return r.s.cost;
        case 'due':
          return r.s.due ?? '9999-99';
        default:
          return r.p.name;
      }
    };
    list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
    });
    return list;
  }, [findings, q, pref, structure, band, level, staff, sort]);

  const Th = ({ k, children, r }: { k: SortKey; children: string; r?: boolean }) => (
    <th className={r ? 'r' : ''} aria-sort={sort.key === k ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button className="th-sort" onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : k !== 'cost' }))}>
        {children}
        {sort.key === k && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  const active = [q, pref, structure, band, level, staff].filter(Boolean).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>物件を探す</h1>
          <p className="sub">物件名・住所・オーナー名(カナ可)・担当者・物件IDで絞り込めます</p>
        </div>
      </div>

      <section className="card filters">
        <label className="search-field">
          <Search size={16} />
          <input value={q} onChange={(e) => set('q', e.target.value)} placeholder="例: 石神井 / ヤマダ / P-0001" aria-label="キーワード" />
          {q && (
            <button onClick={() => set('q', '')} aria-label="キーワードを消す">
              <X size={14} />
            </button>
          )}
        </label>
        <select value={pref} onChange={(e) => set('pref', e.target.value)} aria-label="都道府県">
          <option value="">都道府県: すべて</option>
          {PREFS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={structure} onChange={(e) => set('structure', e.target.value)} aria-label="構造">
          <option value="">構造: すべて</option>
          {STRUCTURES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={band} onChange={(e) => set('band', e.target.value)} aria-label="築年数">
          <option value="">築年数: すべて</option>
          {AGE_BANDS.map((b) => (
            <option key={b.label}>{b.label}</option>
          ))}
        </select>
        <select value={level} onChange={(e) => set('level', e.target.value)} aria-label="指摘の状況">
          <option value="">指摘: すべて</option>
          <option value="urgent">早急対応あり</option>
          <option value="watch">経過観察のみ</option>
          <option value="none">指摘なし</option>
        </select>
        <select value={staff} onChange={(e) => set('staff', e.target.value)} aria-label="担当者">
          <option value="">担当: すべて</option>
          {STAFF.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        {active > 0 && (
          <button className="btn ghost" onClick={() => setParams({}, { replace: true })}>
            条件をクリア
          </button>
        )}
      </section>

      <section className="card">
        <header>
          <h2>
            {rows.length}棟 <span className="hint">／ 全{properties.length}棟</span>
          </h2>
          <span className="hint">列見出しで並べ替え</span>
        </header>
        {rows.length === 0 ? (
          <Empty>条件に一致する物件がありません。キーワードや絞り込みを見直してください。</Empty>
        ) : (
          <div className="table-wrap">
            <table className="tbl hover">
              <thead>
                <tr>
                  <Th k="name">物件</Th>
                  <th>オーナー</th>
                  <Th k="age">築年・構造</Th>
                  <Th k="overall">総合評価</Th>
                  <th>未完了の指摘</th>
                  <Th k="due">最短の修繕推奨</Th>
                  <Th k="cost" r>
                    概算額
                  </Th>
                  <Th k="nextInspection">次回点検</Th>
                  <th>担当</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, s }) => {
                  const days = daysBetween(TODAY, p.nextInspection);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/properties/${p.id}`} className="strong rowlink">
                          {p.name}
                        </Link>
                        <div className="muted small">
                          {p.id} ／ {p.address}
                        </div>
                      </td>
                      <td className="nowrap">{p.owner} 様</td>
                      <td className="nowrap">
                        築{p.age}年
                        <div className="muted small">
                          {p.structure}・{p.units}戸
                        </div>
                      </td>
                      <td>
                        <ScoreBar score={p.overall} />
                      </td>
                      <td className="nowrap">
                        {s.urgent > 0 && <span className="count red">早急 {s.urgent}</span>}
                        {s.watch > 0 && <span className="count amber">観察 {s.watch}</span>}
                        {s.urgent + s.watch === 0 && <span className="muted">なし</span>}
                      </td>
                      <td className="nowrap">{s.due ? `${fmtYm(s.due)}まで` : '—'}</td>
                      <td className="r num">{s.cost ? fmtMan(s.cost) : '—'}</td>
                      <td className="nowrap">
                        {fmtDate(p.nextInspection)}
                        {days < 0 && <div className="danger small">{-days}日超過</div>}
                        {days >= 0 && days <= 90 && <div className="warn small">あと{days}日</div>}
                      </td>
                      <td className="nowrap">{p.staff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
