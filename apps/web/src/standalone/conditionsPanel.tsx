/**
 * Loading-condition manager and the cross-condition comparison table —
 * every condition judged by the same battery: IMO criteria, weather
 * criterion, class strength envelopes and the summer load line.
 */

import { useState } from 'react';
import type { ConditionRow, LoadingCondition } from './conditions.js';
import { fmt } from './charts.js';

export function ConditionManager(props: {
  conditions: LoadingCondition[];
  activeId: string | null;
  busy: boolean;
  storageOk: boolean;
  onApply: (c: LoadingCondition) => void;
  onSaveCurrent: (name: string) => void;
  onDelete: (id: string) => void;
  onCompare: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <section className="card">
      <h2>積付条件</h2>
      <ul className="cond-list">
        {props.conditions.map((c) => (
          <li key={c.id}>
            <button
              className={c.id === props.activeId ? 'cond-row on' : 'cond-row'}
              onClick={() => props.onApply(c)}
              aria-pressed={c.id === props.activeId}
            >
              <span className="cond-name">{c.name}</span>
              <span className="cond-meta num">
                {c.cargo.mass > 0 ? `貨物 ${fmt(c.cargo.mass, 0)} t` : '貨物なし'}
              </span>
            </button>
            {!c.preset && (
              <button
                className="link danger cond-del"
                onClick={() => props.onDelete(c.id)}
                aria-label={`${c.name} を削除`}
              >
                削除
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="cond-save">
        <input
          className="cond-input"
          placeholder="現在の状態を条件として保存…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="seg"
          disabled={!name.trim()}
          onClick={() => {
            props.onSaveCurrent(name.trim());
            setName('');
          }}
        >
          保存
        </button>
      </div>
      {!props.storageOk && (
        <p className="muted">この環境では保存はページを閉じるまで有効です(ストレージ不可)。</p>
      )}
      <button className="solve" onClick={props.onCompare} disabled={props.busy}>
        {props.busy ? '全条件を評価中…' : `全 ${props.conditions.length} 条件を一括評価`}
      </button>
      <p className="muted">
        条件を選ぶとタンク充填率と貨物がモデルに反映されます。一括評価は各条件を
        IMO 基準・気象基準・許容 SF/BM・夏期満載喫水の同一バッテリーで判定します。
      </p>
    </section>
  );
}

export function ComparisonTable(props: { rows: ConditionRow[]; summerDraft: number | null }) {
  const { rows } = props;
  if (!rows.length) return null;
  const mark = (ok: boolean) => (
    <span className={ok ? 'cmp-ok' : 'cmp-bad'}>{ok ? '適合' : '不適合'}</span>
  );
  return (
    <section className="card table-card">
      <h2>積付条件の比較 — 同一バッテリーでの一括判定</h2>
      <div className="table-scroll">
        <table className="eng cmp">
          <thead>
            <tr>
              <th className="txt">条件</th>
              <th>排水量<br /><span>t</span></th>
              <th>平均喫水<br /><span>m</span></th>
              <th>トリム<br /><span>m</span></th>
              <th>GM₀<br /><span>m</span></th>
              <th>最大GZ<br /><span>m</span></th>
              <th>IMO<br /><span>A/2.2</span></th>
              <th>気象<br /><span>A/2.3</span></th>
              <th>SF/BM<br /><span>利用率</span></th>
              <th>夏期満載<br /><span>余裕 m</span></th>
              <th>総合</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const util = Math.max(
                r.envelope.saggingUtil,
                r.envelope.hoggingUtil,
                r.envelope.shearUtil,
              );
              return (
                <tr key={r.condition.id} className={r.allPassed ? '' : 'cmp-fail-row'}>
                  <td className="txt">{r.condition.name}</td>
                  <td>{fmt(r.stability.equilibrium.displacement, 0)}</td>
                  <td>{fmt(r.stability.equilibrium.draftMean, 2)}</td>
                  <td>{fmt(r.stability.equilibrium.trimByStern, 2)}</td>
                  <td>{fmt(r.stability.gm0, 2)}</td>
                  <td>{fmt(r.stability.gzMax, 2)}</td>
                  <td>{mark(r.stability.allCriteriaPassed)}</td>
                  <td>{r.weather.applicable ? mark(r.weather.passed) : '—'}</td>
                  <td>
                    <span className={util <= 1 ? 'cmp-ok' : 'cmp-bad'}>
                      {fmt(util * 100, 0)}%
                    </span>
                  </td>
                  <td>
                    {r.summerMargin === null ? (
                      '—'
                    ) : (
                      <span className={r.summerMargin >= 0 ? 'cmp-ok' : 'cmp-bad'}>
                        {r.summerMargin >= 0 ? '+' : ''}
                        {fmt(r.summerMargin, 2)}
                      </span>
                    )}
                  </td>
                  <td>{mark(r.allPassed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        SF/BM 利用率は許容包絡線(クラス規則系)に対する最悪値。夏期満載余裕は
        夏期満載喫水 {props.summerDraft === null ? '—' : `${fmt(props.summerDraft, 3)} m`} と
        各条件の平均喫水の差で、負値は過積載を意味します。
      </p>
    </section>
  );
}
