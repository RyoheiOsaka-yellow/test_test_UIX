import type { Finding } from './data';

export interface SimParams {
  /** 修繕を先送りする年数 */
  defer: number;
  /** 工事費(資材・労務費)の年間上昇率 */
  inflation: number;
  /** 劣化の進行による補修範囲の年間拡大率 */
  spread: number;
}

export const DEFAULT_SIM: SimParams = { defer: 5, inflation: 0.03, spread: 0.08 };

export interface SimRow {
  year: number;
  label: string;
  now: number;
  neglect: number;
}

/** 未完了の要対応指摘の概算費用合計(円) */
export function openCost(findings: Finding[]): number {
  return findings
    .filter((f) => f.severity !== 'ok' && f.status !== '完了')
    .reduce((s, f) => s + f.estCost, 0);
}

/**
 * 累積修繕コストの試算(円)。
 * - 今修繕する場合: 現在の概算費用をいま支払う
 * - 放置した場合: defer 年後に、工事費上昇と補修範囲拡大を織り込んだ費用を支払う
 * - 両シナリオ共通で、日常的な小修繕費(baseYearly)が毎年かかる
 */
export function simulate(total: number, baseYearly: number, p: SimParams, horizon = 15) {
  const mult = Math.pow(1 + p.inflation, p.defer) * Math.pow(1 + p.spread, p.defer);
  const deferred = total * mult;
  const rows: SimRow[] = [];
  for (let y = 0; y <= horizon; y++) {
    rows.push({
      year: y,
      label: y === 0 ? '現在' : `${y}年後`,
      now: Math.round(total + baseYearly * y),
      neglect: Math.round((y >= p.defer ? deferred : 0) + baseYearly * y),
    });
  }
  return { rows, deferred: Math.round(deferred), extra: Math.round(deferred - total), mult };
}
