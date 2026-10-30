// 推論／要判断 境界のリスク行列（Case B）: 信頼度 × 手戻りコスト。大口径・溶接・アンカーほど厳しく判定する。
// status = confirmed（根拠あり & 高信頼） / inferred（ルール推定で手戻りコストが許容内） / review（人の判断が必要）
export const DEFAULT_RISK = {
  version: 1,
  // 手戻りコスト（1=小 … 5=大）: 加工種別
  opCost: { spec: 3, length: 2, hole: 2, slot: 2, pitch: 3, ubolt: 2, weld: 4, anchor: 4, finish: 3, base: 3 },
  // 管径による係数（大口径ほど荷重が大きく手戻りが高い）
  pipeFactor: [[0, 50, 1.0], [50, 100, 1.25], [100, 200, 1.6], [200, 9999, 2.0]],   // [min mm, max mm, factor]
  // 判定閾値: risk = (1 - confidence) × opCost × pipeFactor
  thresholds: { confirmedMaxRisk: 0.6, inferredMaxRisk: 1.8 },  // risk ≤ 0.6 → 確定, ≤ 1.8 → 推論, それ以上 → 要判断
  // 根拠が無い項目（図面にも注記にも無い）は confidence をこの値に下げる
  noEvidenceConfidence: 0.45,
};
export function pipeFactor(risk, pipeOD) { if (!pipeOD) return 1; for (const [a, b, f] of risk.pipeFactor) if (pipeOD >= a && pipeOD < b) return f; return 1; }
// 認識部材 1 件を評価。 m: {spec,length,feat,holes,confidence}  → {status, risk, reasons:[]}
export function assessMember(m, risk = DEFAULT_RISK) {
  const reasons = []; const od = m.feat?.pipeOD || (typeof m.feat?.ubolt === 'string' ? parseInt(m.feat.ubolt) * 1.1 : 0); const pf = pipeFactor(risk, od);
  const items = [];
  items.push({ op: 'spec', conf: m.user ? 0.98 : m.spec ? m.confidence : risk.noEvidenceConfidence, label: '鋼材仕様' });
  items.push({ op: 'length', conf: m.length ? ({ '手入力': 0.98, '寸法注記': 0.95, '寸法注記(OCR)': 0.85, '学習': 0.85 }[m.lengthSource] ?? 0.7) : risk.noEvidenceConfidence, label: '長さ' });
  if (m.feat?.holeD || m.holes?.length) items.push({ op: m.feat?.slot ? 'slot' : 'hole', conf: m.holes?.length ? 0.9 : 0.7, label: '穴' }); else items.push({ op: 'hole', conf: risk.noEvidenceConfidence, label: '穴（注記なし）' });
  if (m.feat?.ubolt) items.push({ op: 'ubolt', conf: typeof m.feat.ubolt === 'string' ? 0.85 : 0.6, label: 'Uボルト' });
  if (m.feat?.weld) items.push({ op: 'weld', conf: 0.85, label: '溶接' }); else if (/L-|\[-|C-/.test(m.spec || '')) items.push({ op: 'weld', conf: risk.noEvidenceConfidence, label: '溶接（注記なし）' });
  if (m.feat?.anchor) items.push({ op: 'anchor', conf: 0.85, label: 'アンカー' });
  items.push({ op: 'finish', conf: m.feat?.finish ? 0.9 : risk.noEvidenceConfidence, label: '仕上げ' });
  let worst = 0, worstItem = null;
  for (const it of items) { const r = (1 - it.conf) * (risk.opCost[it.op] || 2) * pf; it.risk = Math.round(r * 100) / 100; if (r > worst) { worst = r; worstItem = it; } if (r > risk.thresholds.confirmedMaxRisk) reasons.push(`${it.label}: 信頼度 ${Math.round(it.conf * 100)}% × コスト ${risk.opCost[it.op] || 2}${pf !== 1 ? ` × 管径係数 ${pf}` : ''} = ${it.risk}`); }
  const status = worst <= risk.thresholds.confirmedMaxRisk ? 'confirmed' : worst <= risk.thresholds.inferredMaxRisk ? 'inferred' : 'review';
  return { status, risk: Math.round(worst * 100) / 100, worst: worstItem?.label, items, reasons, pipeFactor: pf };
}
