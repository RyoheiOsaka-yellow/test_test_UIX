import { type Part, type Property, type Repair } from './data';

/**
 * 主な部位の修繕目安(築年数)。
 * 出典: 国土交通省「民間賃貸住宅の計画修繕ガイドブック」。建て方・資材・立地で前後する参考値。
 */
export const CYCLE_SOURCE = {
  label: '国土交通省「民間賃貸住宅の計画修繕ガイドブック」',
  url: 'https://www.mlit.go.jp/common/001231406.pdf',
};
const GUIDE: { part: Part; label: string; from: number; to: number }[] = [
  { part: '外壁', label: '外壁 塗装', from: 11, to: 18 },
  { part: '屋根', label: '屋根 塗装・補修', from: 11, to: 15 },
  { part: '屋根', label: '屋根 防水・葺替', from: 21, to: 25 },
  { part: '防水', label: '階段・廊下 塗装・防水', from: 11, to: 18 },
  { part: '構造', label: '階段・廊下 鉄部塗装', from: 4, to: 10 },
  { part: '設備', label: '給湯器・エアコン 交換', from: 11, to: 15 },
  { part: '設備', label: '給排水管 取替', from: 30, to: 30 },
];
const MAX = 40;

export function CycleCard({ p, repairs, ownerView }: { p: Property; repairs: Repair[]; ownerView: boolean }) {
  const pct = (y: number) => `${(Math.min(y, MAX) / MAX) * 100}%`;
  return (
    <section className="card">
      <header>
        <h2>部位別の修繕時期の目安</h2>
        <span className="hint">築年数と修繕記録を、一般的な目安時期に重ねています</span>
      </header>
      <div className="cycle">
        <div className="cycle-row cycle-axis">
          <span />
          <div className="cycle-track bare">
            {[0, 10, 20, 30, 40].map((y) => (
              <i key={y} style={{ left: pct(y) }}>
                {y === 0 ? '新築' : `${y}年`}
              </i>
            ))}
          </div>
          <span />
        </div>
        {GUIDE.map((g) => {
          const done = repairs
            .filter((r) => r.part === g.part)
            .map((r) => Number(r.date.slice(0, 4)) - p.builtYear)
            .filter((age) => age >= g.from - 2);
          const state =
            done.length > 0
              ? { cls: 'ok', text: `実施済み(築${Math.max(...done)}年)` }
              : p.age < g.from
                ? { cls: 'pre', text: `目安まであと${g.from - p.age}年` }
                : p.age <= g.to
                  ? { cls: 'in', text: '目安時期に入っています' }
                  : { cls: 'over', text: ownerView ? '目安時期を過ぎています' : '目安時期を経過・修繕記録なし' };
          return (
            <div className="cycle-row" key={g.label}>
              <span className="cycle-label">{g.label}</span>
              <div className="cycle-track">
                <span className="cycle-band" style={{ left: pct(g.from), width: `${((Math.max(g.to - g.from, 1)) / MAX) * 100}%` }} />
                {done.map((age, i) => (
                  <span key={i} className="cycle-done" style={{ left: pct(age) }} title={`築${age}年に修繕`} />
                ))}
                <span className="cycle-now" style={{ left: pct(p.age) }} />
              </div>
              <span className={`cycle-state ${state.cls}`}>{state.text}</span>
            </div>
          );
        })}
      </div>
      <p className="note cycle-legend">
        <span className="cycle-band inline" /> 目安時期
        <span className="cycle-now inline" /> 現在(築{p.age}年)
        <span className="cycle-done inline" /> 修繕実施 ／ 出典:{' '}
        <a href={CYCLE_SOURCE.url} target="_blank" rel="noreferrer">
          {CYCLE_SOURCE.label}
        </a>
        。建て方・資材・立地で前後する参考値で、実際の時期は点検結果で判断します。
      </p>
    </section>
  );
}
