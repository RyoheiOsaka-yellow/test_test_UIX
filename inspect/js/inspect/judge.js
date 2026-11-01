// 判定エンジン: 許容差との照合（合格/注意/不合格）、ロット判定、工場成績書との照合、AI 所見（原因仮説・推奨アクション）、工数試算
export const WARN_RATIO = 0.8; // 公差の 80% 以上を使っていたら「注意」

export function evaluate(item, v) {
  if (v == null || v === '') return { status: 'na', dev: null, ratio: null, text: '未測定' };
  if (item.kind === 'thread' || item.kind === 'visual') { const s = String(v).toUpperCase(); const ok = s === 'GO' || s === 'OK' || s === '良' || s === '合格'; return { status: ok ? 'ok' : 'ng', dev: null, ratio: ok ? 0 : 1, text: ok ? (item.kind === 'thread' ? 'GO 通り / NOGO 止まり' : '良') : (item.kind === 'thread' ? 'ゲージ不合格' : '不良あり') }; }
  const x = +v; if (Number.isNaN(x)) return { status: 'na', dev: null, ratio: null, text: '数値でない' };
  const dev = x - (+item.nominal); const [up, lo] = item.tol || [Infinity, -Infinity];
  if (dev > up + 1e-9 || dev < lo - 1e-9) return { status: 'ng', dev, ratio: dev > 0 ? (up > 0 ? dev / up : Infinity) : (lo < 0 ? dev / lo : Infinity), text: dev > 0 ? `上限超過 ${(dev - up).toFixed(3)}` : `下限割れ ${(lo - dev).toFixed(3)}` };
  let ratio = 0; if (dev > 0) ratio = up > 0 ? dev / up : 1; else if (dev < 0) ratio = lo < 0 ? dev / lo : 1; else ratio = 0;
  return { status: ratio >= WARN_RATIO ? 'warn' : 'ok', dev, ratio, text: ratio >= WARN_RATIO ? `公差の ${Math.round(ratio * 100)}% を使用` : '公差内' };
}
export const RANK = { ng: 3, warn: 2, na: 1, ok: 0 };
export function worst(statuses) { return statuses.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok'); }
// 項目ごと（全個体）の集計
export function itemSummary(part, item) { const rs = part.pieces.map(p => evaluate(item, p.m[item.no])); return { results: rs, status: worst(rs.map(r => r.status)), ng: rs.filter(r => r.status === 'ng').length, warn: rs.filter(r => r.status === 'warn').length, na: rs.filter(r => r.status === 'na').length }; }
export function partSummary(part) {
  const items = part.items.map(it => ({ item: it, ...itemSummary(part, it) })); const per = part.pieces.map(p => ({ piece: p, status: worst(part.items.map(it => evaluate(it, p.m[it.no]).status)), ng: part.items.filter(it => evaluate(it, p.m[it.no]).status === 'ng').length }));
  const ng = items.filter(i => i.status === 'ng'), warn = items.filter(i => i.status === 'warn'), na = items.filter(i => i.na > 0); const measured = items.filter(i => i.na === 0).length;
  const critNG = ng.filter(i => i.item.critical); let lot, lotText;
  if (measured === 0) { lot = 'na'; lotText = '未測定'; } else if (critNG.length) { lot = 'ng'; lotText = `不合格（重要寸法 ${critNG.length} 件が公差外）— 工場へ是正要求・不良個体は返却／手直し判断`; } else if (ng.length) { lot = 'cond'; lotText = `条件付き（一般寸法 ${ng.length} 件が公差外）— 特採（顧客承認）または選別`; } else if (na.length) { lot = 'partial'; lotText = `判定中（未測定 ${na.length} 項目）`; } else { lot = 'ok'; lotText = warn.length ? `合格（注意 ${warn.length} 件: 量産時は工程能力に留意）` : '合格'; }
  return { items, per, ng, warn, na, measured, total: items.length, lot, lotText, critNG };
}
// 工場（ベンダー）成績書との照合: 差が公差幅の 30% または 0.005 のどちらか大きい方を超えたら不一致
export function vendorCheck(item, ours, theirs) {
  if (theirs == null || ours == null) return { flag: false, text: theirs == null ? '工場成績書に記載なし' : '未測定' };
  if (typeof ours !== 'number' || typeof theirs !== 'number') { const same = String(ours).toUpperCase() === String(theirs).toUpperCase(); return { flag: !same, text: same ? '一致' : `不一致（工場: ${theirs}）` }; }
  const band = item.tol ? Math.abs(item.tol[0] - item.tol[1]) : 0.1; const th = Math.max(band * 0.3, 0.005); const d = ours - theirs; const flag = Math.abs(d) > th;
  const ev = evaluate(item, theirs); return { flag, d, text: flag ? `不一致 差 ${(d > 0 ? '+' : '') + d.toFixed(3)}（工場値 ${theirs}: ${ev.status === 'ng' ? '工場側でも公差外' : '工場側は合格と報告'}）` : `一致（差 ${(d > 0 ? '+' : '') + d.toFixed(3)}）` };
}
// AI 所見（ルールベースの仮説。本番は過去の不良データで学習）
const CAUSES = {
  dia_in_over: ['ボーリングバーのたわみ・刃先摩耗による穴径拡大', '仕上げ切込みの過多、または測定時の温度差（アルミは 20℃ 基準で 10℃ 差 ≈ 8µm/35mm）'],
  dia_in_under: ['仕上げ工具径の不足・工具のびびり', '切削後の熱収縮（加工直後の測定）'],
  dia_out_over: ['仕上げ代の残り（研削・旋削の最終パス不足）', '工具摩耗の補正遅れ'],
  dia_out_under: ['過切削（補正値の入力ミス）', '研削の追い込み過多'],
  width_over: ['溝入れバイトの幅・送り設定', 'ワークの逃げによる溝の拡がり'],
  width_under: ['工具幅の不足', '仕上げ不足'],
  pitch: ['治具の位置決め・基準面の当たり不良', 'プログラム原点（基準 A/C）の取り方の差'],
  pos: ['基準（データム）設定の違い: 工場側と当社側で基準面の取り方が異なる可能性', '治具クランプによる位置ずれ'],
  perp: ['段取り（面当たり・切粉のかみ込み）', '主軸直角度・テーブルの傾き'],
  flat: ['クランプ歪み（薄肉フランジ）', '残留応力による加工後変形（荒加工 → 仕上げの間に時効を入れていない）'],
  para: ['段取り替え時の基準面当たり', '工具摩耗による面の傾き'],
  runout: ['両センター支持の精度（センター穴の傷・偏心）', '研削時のドレス不足'],
  coax: ['チャック替え時の芯出し不良', 'センター穴の精度'],
  angle: ['曲げ金型のスプリングバック補正不足', '板材ロットの機械特性の差'],
  thread: ['タップの摩耗・下穴径の不足', 'ねじゲージの管理状態（校正）'],
  ra: ['送り速度・刃先 R の選定', 'びびり・切削油の不足'],
  visual: ['工程内の取扱い（めっき前の脱脂不足・ハンドリング傷）', '最終検査での見落とし'],
  len: ['工具長補正・原点設定', '熱変位（長尺寸法）'],
};
const ACTIONS = {
  ng_crit: ['当該個体は不合格として分離（赤札）', '別計測器で再測定し測定不確かさを除外（例: 三次元 → シリンダゲージ）', '工場へ是正要求（CAR）: 原因・対策・再発防止の回答を依頼', '顧客へ納期影響を連絡（手直し可否の判断）'],
  ng: ['当該個体を分離し、特採（顧客承認）または選別出荷を検討', '工場へ注意喚起（次ロットの管理項目に追加）'],
  warn: ['量産移行時の工程能力（Cp/Cpk）要確認: 公差の 80% 以上を消費', '工場へ中心値の調整を依頼（補正値の見直し）'],
};
export function aiFinding(part, item, summary) {
  const { status, results } = summary; if (status === 'ok' || status === 'na') return null;
  const devs = results.map(r => r.dev).filter(v => v != null); const mean = devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : null; const allSame = devs.length > 1 && devs.every(d => Math.sign(d) === Math.sign(devs[0]));
  let key; const over = mean != null ? mean > 0 : true; const f = item.key || '';
  if (item.kind === 'gdt') key = item.gdt; else if (item.kind === 'thread') key = 'thread'; else if (item.kind === 'ra') key = 'ra'; else if (item.kind === 'visual') key = 'visual'; else if (item.kind === 'angle') key = 'angle';
  else if (item.kind === 'dia') { const inner = /seat|through|groove|mount|cbore|dowel|hole|slot|tap/i.test(f) && !/j1|j2|mid|end|boss|relief/.test(f); key = `dia_${inner ? 'in' : 'out'}_${over ? 'over' : 'under'}`; }
  else if (/pitch|Pos|Y$|X$/.test(f) && item.kind === 'len') key = 'pitch'; else if (/groove|key/.test(f) && item.kind === 'len') key = over ? 'width_over' : 'width_under'; else key = 'len';
  const causes = CAUSES[key] || CAUSES.len; const acts = status === 'ng' ? (item.critical ? ACTIONS.ng_crit : ACTIONS.ng) : ACTIONS.warn;
  const trend = allSame ? `全個体が同方向（平均 ${mean > 0 ? '+' : ''}${mean.toFixed(3)}）に偏っており、ばらつきではなく工程の中心ずれ（系統誤差）の可能性が高い。` : devs.length > 1 ? '個体ごとにばらついており、段取り・計測のばらつき要因が疑われる。' : '';
  return { key, causes, actions: acts, trend, confidence: status === 'ng' ? 0.72 : 0.55 };
}
// 工数試算（ヒアリングに基づく仮定値。実測で更新）
export const ROI_DEFAULT = { lotsPerMonth: 12, itemsPerLot: 25, piecesPerLot: 3, hourlyYen: 4500, compareMin: 2.5, annotateMin: 45, reportMin: 30, measureMin: 1.5 };
export function timeEstimate(part, A = ROI_DEFAULT) {
  const n = part.items.length, p = part.pieces.length;
  const manual = { measure: n * p * A.measureMin, compare: n * p * A.compareMin, annotate: A.annotateMin * p, report: A.reportMin }; manual.total = Object.values(manual).reduce((a, b) => a + b, 0);
  const tool = { measure: n * p * A.measureMin, compare: n * 0.3, annotate: 2, report: 3 }; tool.total = Object.values(tool).reduce((a, b) => a + b, 0);
  return { manual, tool, saved: manual.total - tool.total, ratio: 1 - tool.total / manual.total };
}
// 月次 ROI（ヒアリング値で更新する前提の試算）
export function roiEstimate(A = ROI_DEFAULT) {
  const n = A.itemsPerLot, p = A.piecesPerLot; const manual = n * p * A.compareMin + A.annotateMin * p + A.reportMin; const tool = n * 0.3 + 2 + 3; const savedMinPerLot = manual - tool;
  const savedHoursMonth = savedMinPerLot * A.lotsPerMonth / 60; return { manualMinPerLot: manual, toolMinPerLot: tool, savedMinPerLot, savedHoursMonth, savedYenMonth: savedHoursMonth * A.hourlyYen, savedYenYear: savedHoursMonth * A.hourlyYen * 12 };
}
