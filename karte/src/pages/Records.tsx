import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Search, X } from 'lucide-react';
import {
  PARTS,
  STATUSES,
  fmtDate,
  fmtYen,
  fmtYm,
  checks,
  CHECK_KINDS,
  matches,
  propertyById,
  repairs,
  SEVERITY_LABEL,
} from '../data';
import { CheckBadge, Empty, SeverityBadge, StatusBadge, downloadCsv, useStore } from '../ui';

type Tab = 'findings' | 'repairs' | 'inspections';
const TABS: { key: Tab; label: string }[] = [
  { key: 'findings', label: '指摘事項' },
  { key: 'repairs', label: '修繕履歴' },
  { key: 'inspections', label: '点検・審査履歴' },
];
const LIMIT = 100;

export default function Records() {
  const { findings } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'findings';
  const q = params.get('q') ?? '';
  const part = params.get('part') ?? '';
  const sev = params.get('sev') ?? '';
  const st = params.get('st') ?? '';
  const year = params.get('year') ?? '';
  const kind = params.get('kind') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const fRows = useMemo(
    () =>
      findings
        .filter((f) => f.severity !== 'ok')
        .filter((f) => {
          const p = propertyById.get(f.propertyId)!;
          if (!matches(q, f.title, f.part, f.location, f.id, f.description, p.name, p.owner, p.address)) return false;
          if (part && f.part !== part) return false;
          if (sev && f.severity !== sev) return false;
          if (st && f.status !== st) return false;
          return true;
        })
        .sort((a, b) => ((a.dueBy ?? '9') < (b.dueBy ?? '9') ? -1 : 1)),
    [findings, q, part, sev, st],
  );

  const rRows = useMemo(
    () =>
      repairs.filter((r) => {
        const p = propertyById.get(r.propertyId)!;
        if (!matches(q, r.work, r.place, r.part, r.contractor, r.id, p.name, p.owner, p.address)) return false;
        if (part && r.part !== part) return false;
        if (year && !r.date.startsWith(year)) return false;
        return true;
      }),
    [q, part, year],
  );

  const iRows = useMemo(
    () =>
      checks.filter((i) => {
        const p = propertyById.get(i.propertyId)!;
        if (!matches(q, i.summary, i.by, i.id, i.kind, i.round, i.result, p.name, p.owner, p.address)) return false;
        if (year && !i.date.startsWith(year)) return false;
        if (kind && i.kind !== kind) return false;
        return true;
      }),
    [q, year, kind],
  );

  const count = tab === 'findings' ? fRows.length : tab === 'repairs' ? rRows.length : iRows.length;
  const years = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

  const exportCsv = () => {
    if (tab === 'findings') {
      downloadCsv(
        '指摘事項.csv',
        ['指摘ID', '物件', 'オーナー', '部位', '箇所', '緊急度', '指摘内容', '指摘日', '推奨時期', '概算費用', '対応状況'],
        fRows.map((f) => {
          const p = propertyById.get(f.propertyId)!;
          return [f.id, p.name, p.owner, f.part, f.location, SEVERITY_LABEL[f.severity], f.title, f.foundDate, f.dueBy ?? '', f.estCost, f.status];
        }),
      );
    } else if (tab === 'repairs') {
      downloadCsv(
        '修繕履歴.csv',
        ['修繕ID', '物件', 'オーナー', '修繕日', '部位', '修繕箇所', '修繕内容', '金額', '施工会社'],
        rRows.map((r) => {
          const p = propertyById.get(r.propertyId)!;
          return [r.id, p.name, p.owner, r.date, r.part, r.place, r.work, r.cost, r.contractor];
        }),
      );
    } else {
      downloadCsv(
        '点検・審査履歴.csv',
        ['ID', '物件', 'オーナー', '種別', '実施日', '回次', '結果', '内容', '実施者'],
        iRows.map((i) => {
          const p = propertyById.get(i.propertyId)!;
          return [i.id, p.name, p.owner, i.kind, i.date, i.round, i.result, i.summary, i.by];
        }),
      );
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>指摘・修繕データ</h1>
          <p className="sub">全物件の指摘・修繕・点検の記録を横断して検索できます</p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={count === 0}>
          <Download size={15} /> CSV出力({count}件)
        </button>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'on' : ''}
            onClick={() => {
              const next = new URLSearchParams();
              next.set('tab', t.key);
              if (q) next.set('q', q);
              setParams(next, { replace: true });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="card filters">
        <label className="search-field">
          <Search size={16} />
          <input value={q} onChange={(e) => set('q', e.target.value)} placeholder="例: ひび割れ / 防水 石神井 / 給湯器" aria-label="キーワード" />
          {q && (
            <button onClick={() => set('q', '')} aria-label="キーワードを消す">
              <X size={14} />
            </button>
          )}
        </label>
        {tab === 'inspections' && (
          <select value={kind} onChange={(e) => set('kind', e.target.value)} aria-label="種別">
            <option value="">種別: すべて</option>
            {CHECK_KINDS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        )}
        {tab !== 'inspections' && (
          <select value={part} onChange={(e) => set('part', e.target.value)} aria-label="部位">
            <option value="">部位: すべて</option>
            {PARTS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        )}
        {tab === 'findings' && (
          <>
            <select value={sev} onChange={(e) => set('sev', e.target.value)} aria-label="緊急度">
              <option value="">緊急度: すべて</option>
              <option value="urgent">要対応(早急)</option>
              <option value="watch">要対応(経過観察)</option>
            </select>
            <select value={st} onChange={(e) => set('st', e.target.value)} aria-label="対応状況">
              <option value="">対応状況: すべて</option>
              {STATUSES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </>
        )}
        {tab !== 'findings' && (
          <select value={year} onChange={(e) => set('year', e.target.value)} aria-label="年">
            <option value="">年: すべて</option>
            {years.map((v) => (
              <option key={v} value={v}>
                {v}年
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="card">
        <header>
          <h2>{count.toLocaleString()}件</h2>
          <span className="hint">
            {tab === 'findings' && `概算合計 ${fmtYen(fRows.reduce((s, f) => s + f.estCost, 0))}`}
            {tab === 'repairs' && `金額合計 ${fmtYen(rRows.reduce((s, r) => s + r.cost, 0))}`}
            {count > LIMIT && ` ／ 先頭${LIMIT}件を表示(CSVは全件)`}
          </span>
        </header>
        {count === 0 ? (
          <Empty>条件に一致する記録がありません。</Empty>
        ) : (
          <div className="table-wrap">
            {tab === 'findings' && (
              <table className="tbl hover">
                <thead>
                  <tr>
                    <th>緊急度</th>
                    <th>物件</th>
                    <th>部位|箇所</th>
                    <th>指摘内容</th>
                    <th>指摘日</th>
                    <th>推奨時期</th>
                    <th className="r">概算費用</th>
                    <th>対応状況</th>
                  </tr>
                </thead>
                <tbody>
                  {fRows.slice(0, LIMIT).map((f) => {
                    const p = propertyById.get(f.propertyId)!;
                    return (
                      <tr key={f.id}>
                        <td>
                          <SeverityBadge severity={f.severity} short />
                        </td>
                        <td>
                          <Link className="strong rowlink" to={`/properties/${p.id}?f=${f.id}`}>
                            {p.name}
                          </Link>
                          <div className="muted small">{p.owner} 様</div>
                        </td>
                        <td className="nowrap">
                          {f.part}|{f.location}
                        </td>
                        <td>{f.title}</td>
                        <td className="nowrap">{fmtDate(f.foundDate)}</td>
                        <td className="nowrap">{fmtYm(f.dueBy)}まで</td>
                        <td className="r num">{fmtYen(f.estCost)}</td>
                        <td>
                          <StatusBadge status={f.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {tab === 'repairs' && (
              <table className="tbl hover">
                <thead>
                  <tr>
                    <th>修繕日</th>
                    <th>物件</th>
                    <th>部位</th>
                    <th>修繕箇所</th>
                    <th>修繕内容</th>
                    <th className="r">金額(税込)</th>
                    <th>施工会社</th>
                  </tr>
                </thead>
                <tbody>
                  {rRows.slice(0, LIMIT).map((r) => {
                    const p = propertyById.get(r.propertyId)!;
                    return (
                      <tr key={r.id}>
                        <td className="nowrap">{fmtDate(r.date)}</td>
                        <td>
                          <Link className="strong rowlink" to={`/properties/${p.id}`}>
                            {p.name}
                          </Link>
                          <div className="muted small">{p.owner} 様</div>
                        </td>
                        <td>{r.part}</td>
                        <td>{r.place}</td>
                        <td>{r.work}</td>
                        <td className="r num">{fmtYen(r.cost)}</td>
                        <td className="nowrap">{r.contractor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {tab === 'inspections' && (
              <table className="tbl hover">
                <thead>
                  <tr>
                    <th>種別</th>
                    <th>実施日</th>
                    <th>物件</th>
                    <th>回次</th>
                    <th>結果</th>
                    <th>内容</th>
                    <th>実施者</th>
                  </tr>
                </thead>
                <tbody>
                  {iRows.slice(0, LIMIT).map((i) => {
                    const p = propertyById.get(i.propertyId)!;
                    return (
                      <tr key={i.id}>
                        <td className="nowrap">
                          <CheckBadge kind={i.kind} />
                        </td>
                        <td className="nowrap">{fmtDate(i.date)}</td>
                        <td>
                          <Link className="strong rowlink" to={`/properties/${p.id}`}>
                            {p.name}
                          </Link>
                          <div className="muted small">{p.owner} 様</div>
                        </td>
                        <td className="nowrap">{i.round}</td>
                        <td className="nowrap strong">{i.result}</td>
                        <td>{i.summary}</td>
                        <td className="nowrap">{i.by}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </>
  );
}
