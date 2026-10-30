// 認識の学習ループ: 人が直した結果（要判断 → 確定、仕様・寸法の修正）を図面様式ごとに蓄積し、同じ特徴の候補は次回から確信度を上げ、直した値を初期値にする
const KEY = 'anglex.recognitionLearn';
function readLS() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function writeLS(rows) { try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-3000))); } catch { } }
export async function listLearn(app) { if (app?.store?.mode === 'server' && app.store.listLearn) { try { return await app.store.listLearn(); } catch { } } return readLS(); }
async function addLearn(app, rows) { if (!rows.length) return; if (app?.store?.mode === 'server' && app.store.addLearn) { try { await app.store.addLearn(rows); return; } catch { } } writeLS(readLS().concat(rows)); }
// 認識候補の特徴署名: 仕様（正規化）× 長さ区分 × 穴数 × 特徴キー（Uボルト・長穴・仕上げ…）× 図面様式（レイヤ／ソース）
export const lenBucket = L => !L ? 'L?' : L < 300 ? 'L<300' : L < 700 ? 'L300-700' : L < 1500 ? 'L700-1500' : 'L1500+';
export function signature(m, style = '') { const spec = String(m.spec || '').toUpperCase().replace(/\s+/g, ''); const feat = Object.keys(m.feat || {}).sort().join(','); return `${spec}|${lenBucket(m.length)}|h${(m.holes || []).length}|${feat}|${style}`; }
export function drawingStyle(drawing) { if (!drawing) return ''; if (drawing.kind === 'dxf') return 'dxf:' + Object.keys(drawing.dxf?.layers || {}).sort().slice(0, 6).join('/'); if (drawing.kind === 'raster') return 'raster'; return drawing.kind || ''; }
// 確定時に記録: 認識時の署名 → 確定後のファミリ・パラメータ
export async function recordConfirmation(app, inst) {
  if (!inst || inst.source !== 'import' || !inst.recogSig) return 0; const t = app.model.getType(inst.typeId); const p = app.model.resolved(inst); const keys = ['spec', 'L', 'holes', 'finish', 'pipes', 'profile', 'W', 'H', 'A', 't'];
  const params = {}; for (const k of keys) if (p[k] !== undefined) params[k] = p[k];
  await addLearn(app, [{ at: new Date().toISOString(), sig: inst.recogSig, familyId: t.familyId, params, status: 'confirmed', by: app.user().name, branch: app.project.branch || null }]); return 1;
}
// 図面上での修正を記録: 「部材ではない」(rejected) / 仕様・長さを直した (corrected)。同じ署名の候補に次回から効く
export async function recordCorrection(app, sig, { kind, spec = null, length = null }) {
  if (!sig) return 0; await addLearn(app, [{ at: new Date().toISOString(), sig, familyId: null, params: { spec, L: length }, status: kind, by: app.user?.().name || '', branch: app.project?.branch || null }]); return 1;
}
// 検証レポートの返送（CSV）を学習に取り込む: 行 = {sig, ok:'○'|'×', spec, length, originalSpec, originalLength}
//  ○ → その仕様・長さを正例（corrected と同じ扱いで 2 件以上あれば確信度 +0.2 と初期値）、× で正しい値あり → corrected、× のみ → rejected
export async function recordFeedback(app, rows, { by = 'feedback' } = {}) {
  const out = []; for (const r of rows) { if (!r.sig) continue; const ok = /^[○o○OＯ◯yY1]/.test(String(r.ok || '').trim()); const bad = /^[×xX✕✗nN0]/.test(String(r.ok || '').trim()); if (!ok && !bad) continue;
    if (ok) out.push({ at: new Date().toISOString(), sig: r.sig, familyId: null, params: { spec: r.originalSpec || null, L: r.originalLength || null }, status: 'corrected', by, branch: app.project?.branch || null, feedback: 'ok' });
    else if (r.spec || r.length) out.push({ at: new Date().toISOString(), sig: r.sig, familyId: null, params: { spec: r.spec || r.originalSpec || null, L: r.length || null }, status: 'corrected', by, branch: app.project?.branch || null, feedback: 'fix' });
    else out.push({ at: new Date().toISOString(), sig: r.sig, familyId: null, params: {}, status: 'rejected', by, branch: app.project?.branch || null, feedback: 'reject' }); }
  await addLearn(app, out); return out;
}
// 認識候補へ学習値を適用: 同じ署名の確定が 2 件以上 → 確信度 +0.2、直した値（ファミリ・パラメータ）を提案に使う
export function applyLearned(hist, members, style = '') {
  let n = 0; for (const m of members) { const sig = signature(m, style); m.recogSig = sig; const all = hist.filter(r => r.sig === sig); if (all.length < 2) continue;
    const rej = all.filter(r => r.status === 'rejected'), cor = all.filter(r => r.status === 'corrected'), rows = all.filter(r => r.status === 'confirmed');
    if (rej.length >= 2 && !rows.length && !cor.length) { m.learnedReject = rej.length; m.confidence = Math.min(m.confidence || 0, 0.15); m.riskReasons = (m.riskReasons || []).concat(`同じ形状の候補が ${rej.length} 回「部材ではない」と修正されています`); n++; continue; }
    if (cor.length >= 2 && !rows.length) { const last = cor[cor.length - 1]; if (last.params?.spec) m.spec = last.params.spec; if (last.params?.L) { m.length = last.params.L; m.lengthSource = '学習'; } m.learned = { n: cor.length, familyId: null, params: {} }; m.confidence = Math.min(0.9, (m.confidence || 0) + 0.2); n++; continue; }
    if (rows.length < 2) continue; const last = rows[rows.length - 1]; m.learned = { n: rows.length, familyId: last.familyId, params: last.params }; m.confidence = Math.min(0.95, (m.confidence || 0) + 0.2); n++; }
  return n;
}

// ---- 学習の見える化: 読込ごとの統計（候補数・要判断・学習が効いた数）を記録し、管理画面「学習の状態」で効果を示す ----
const STATS_KEY = 'anglex.learnStats';
export function recordImportStats(rec) { try { const rows = JSON.parse(localStorage.getItem(STATS_KEY) || '[]'); rows.push({ at: new Date().toISOString(), name: rec.name, kind: rec.kind, members: rec.members, review: rec.review, learned: rec.learned, rejected: rec.rejected || 0 }); localStorage.setItem(STATS_KEY, JSON.stringify(rows.slice(-500))); } catch { } }
export function listImportStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY) || '[]'); } catch { return []; } }
// 署名ごとの集計: 確定・修正・却下・返送（○/×）件数と「次回から効く」判定
export function summarizeLearn(hist) {
  const by = new Map(); for (const r of hist) { const o = by.get(r.sig) || { sig: r.sig, confirmed: 0, corrected: 0, rejected: 0, fbOk: 0, fbFix: 0, fbReject: 0, last: null, lastSpec: null, lastL: null }; if (r.status === 'confirmed') o.confirmed++; else if (r.status === 'corrected') o.corrected++; else if (r.status === 'rejected') o.rejected++; if (r.feedback === 'ok') o.fbOk++; else if (r.feedback === 'fix') o.fbFix++; else if (r.feedback === 'reject') o.fbReject++; if (!o.last || r.at > o.last) { o.last = r.at; o.lastSpec = r.params?.spec || null; o.lastL = r.params?.L || null; } by.set(r.sig, o); }
  const rows = [...by.values()].map(o => ({ ...o, effect: o.rejected >= 2 && !o.confirmed && !o.corrected ? '却下（候補から外す）' : o.corrected >= 2 && !o.confirmed ? `修正値を初期値に（${o.lastSpec || ''}${o.lastL ? ' L=' + o.lastL : ''}）` : o.confirmed >= 2 ? '確信度 +0.2・確定値を初期値に' : `あと ${Math.max(0, 2 - Math.max(o.confirmed, o.corrected, o.rejected))} 件で有効` }));
  return rows.sort((a, b) => (b.last || '').localeCompare(a.last || ''));
}
