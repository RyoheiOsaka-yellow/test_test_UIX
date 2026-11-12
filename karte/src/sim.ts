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

/** 修繕を先送りした年数ごとの費用(円)。棒グラフ用 */
export function deferredCosts(total: number, p: SimParams, years = [0, 3, 5, 10]) {
  return years.map((y) => ({
    label: y === 0 ? '今' : `${y}年後`,
    year: y,
    cost: Math.round(total * Math.pow(1 + p.inflation, y) * Math.pow(1 + p.spread, y)),
  }));
}

/**
 * 総合評価の見通し(試算)。
 * - 放置した場合: 過去の点検での低下ペース(年あたり)がそのまま続く
 * - 今修繕する場合: 指摘のある部位が修繕で 8.5 点まで回復し、その後は同じペースで低下
 */
export function projectScores(
  scores: Record<string, number>,
  repairedParts: string[],
  history: { date: string; score: number }[],
  horizon = 10,
) {
  const parts = Object.keys(scores);
  const overall = parts.reduce((s, k) => s + scores[k], 0) / parts.length;
  const repaired = parts.reduce((s, k) => s + (repairedParts.includes(k) ? Math.max(scores[k], 8.5) : scores[k]), 0) / parts.length;
  let rate = 0.25;
  if (history.length >= 2) {
    const first = history[history.length - 1];
    const last = history[0];
    const yrs = Number(last.date.slice(0, 4)) - Number(first.date.slice(0, 4));
    if (yrs > 0) rate = (first.score - last.score) / yrs;
  }
  rate = Math.min(0.45, Math.max(0.15, rate));
  const rows = [];
  for (let y = 0; y <= horizon; y++) {
    rows.push({
      label: y === 0 ? '現在' : `${y}年後`,
      neglect: Math.max(3, Math.round((overall - rate * y) * 10) / 10),
      repair: y === 0 ? Math.round(overall * 10) / 10 : Math.max(3, Math.round((repaired - rate * (y - 1)) * 10) / 10),
    });
  }
  return { rows, rate, repaired: Math.round(repaired * 10) / 10 };
}
