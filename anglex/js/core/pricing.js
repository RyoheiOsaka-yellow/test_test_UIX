// 標準単価マスタ（学習）: C社の回答（工場単価・納期）を 部材種別 × 仕様 × 寸法区分 で蓄積し、次回の基準原価・納期の初期値と単価表の見直し候補に使う
const KEY = 'anglex.priceHistory';
export function sizeBucket(mass) { const m = +mass || 0; return m < 3 ? 'S(<3kg)' : m < 10 ? 'M(3-10kg)' : m < 30 ? 'L(10-30kg)' : 'XL(30kg+)'; }
export function lineKey(l) { return `${l.familyId || l.family || '?'}|${(l.spec || '').split(' ').find(s => /^(spec|colSpec)=/.test(s)) || ''}|${sizeBucket(l.mass)}`; }
export function famKey(l) { return `${l.familyId || l.family || '?'}|${sizeBucket(l.mass)}`; }
function readLS() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function writeLS(rows) { try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-5000))); } catch { } }
export async function listHistory(app) { if (app.store.mode === 'server' && app.store.listPrices) { try { return await app.store.listPrices(); } catch { } } return readLS(); }
async function addHistory(app, rows) { if (!rows.length) return; if (app.store.mode === 'server' && app.store.addPrices) { try { await app.store.addPrices(rows); return; } catch { } } writeLS(readLS().concat(rows)); }
// C社回答（工場単価・納期・可否）を記録。同じ見積・Rev の二重記録は避ける
export async function recordFromEstimate(app, est) {
  const hist = await listHistory(app); const tag = `${est.id}#${est.revision}`; if (hist.some(r => r.tag === tag)) return 0;
  const rows = est.lines.filter(l => l.factoryCost != null && l.familyId !== undefined || (l.factoryCost != null && l.family)).map(l => ({ tag, at: new Date().toISOString(), estNo: est.no, branch: est.branch || null, familyId: l.familyId || null, family: l.family, desc: l.desc, spec: l.spec || '', mass: l.mass || 0, qty: l.qty, baseCost: l.baseCost, factoryCost: l.factoryCost, perKg: l.mass ? Math.round(l.factoryCost / l.mass) : null, leadDays: l.leadDays ?? null, accepted: l.accepted ?? null, key: lineKey(l), fkey: famKey(l) }));
  await addHistory(app, rows); return rows.length;
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
// 1 行に対する学習値: 同じキー（仕様まで一致）→ ファミリ×寸法区分 の順で 2 件以上あれば採用
export function learnedFor(hist, l) {
  const exact = hist.filter(r => r.key === lineKey(l) && r.factoryCost != null); const fam = hist.filter(r => r.fkey === famKey(l) && r.factoryCost != null);
  const use = exact.length >= 2 ? exact : fam.length >= 2 ? fam : null; if (!use) return null;
  const perKg = median(use.filter(r => r.perKg).map(r => r.perKg)); const unit = median(use.map(r => r.factoryCost)); const lead = median(use.filter(r => r.leadDays != null).map(r => r.leadDays));
  const suggested = l.mass && perKg ? Math.round(perKg * l.mass) : Math.round(unit);
  return { n: use.length, level: exact.length >= 2 ? '仕様一致' : 'ファミリ×寸法区分', perKg, unit, leadDays: lead, suggested, deviation: l.baseCost ? Math.round((suggested - l.baseCost) / l.baseCost * 1000) / 10 : null, branches: [...new Set(use.map(r => r.branch).filter(Boolean))] };
}
// 見積作成時: 学習値がある行に baseCost を適用（元値は modelCost に保持）
export function applyLearned(hist, est) { let n = 0; for (const l of est.lines) { const g = learnedFor(hist, l); if (!g) continue; l.modelCost = l.modelCost ?? l.baseCost; l.learned = g; l.baseCost = g.suggested; if (g.leadDays != null) l.leadGuess = g.leadDays; n++; } return n; }
export function revertLearned(est) { let n = 0; for (const l of est.lines) if (l.modelCost != null) { l.baseCost = l.modelCost; delete l.learned; n++; } return n; }
// 単価表の見直し候補: ファミリ×寸法区分ごとに 想定（モデル原価）と回答の乖離
export function reviewCandidates(hist, { minN = 3, threshold = 10 } = {}) {
  const groups = new Map(); for (const r of hist) { if (r.factoryCost == null || !r.baseCost) continue; (groups.get(r.fkey) || groups.set(r.fkey, []).get(r.fkey)).push(r); }
  const out = []; for (const [k, rs] of groups) { const dev = rs.map(r => (r.factoryCost - r.baseCost) / r.baseCost * 100); const md = median(dev); out.push({ key: k, family: rs[0].family, bucket: k.split('|')[1], n: rs.length, medianDev: Math.round(md * 10) / 10, perKg: median(rs.filter(r => r.perKg).map(r => r.perKg)), lead: median(rs.filter(r => r.leadDays != null).map(r => r.leadDays)), accept: rs.filter(r => r.accepted === false).length, last: rs[rs.length - 1].at, branches: [...new Set(rs.map(r => r.branch).filter(Boolean))], flag: rs.length >= minN && Math.abs(md) >= threshold }); }
  return out.sort((a, b) => Math.abs(b.medianDev) - Math.abs(a.medianDev));
}

// ---- B社の利益率履歴: 受け渡し時に 顧客・ファミリ×寸法区分 ごとの利益率を記録し、次回は「前回の利益率を流用」 ----
export function marginKey(l, customer = '') { return `${(customer || '').trim()}|${famKey(l)}`; }
export async function recordMarginsFromEstimate(app, est) {
  const hist = await listHistory(app); const tag = `${est.id}#${est.revision}#margin`; if (hist.some(r => r.tag === tag)) return 0; const customer = est.meta?.customer || '';
  const rows = est.lines.filter(l => l.bMarginPct != null).map(l => ({ kind: 'margin', tag, at: new Date().toISOString(), estNo: est.no, branch: est.branch || null, customer, familyId: l.familyId || null, family: l.family, spec: l.spec || '', mass: l.mass || 0, bMarginPct: l.bMarginPct, mkey: marginKey(l, customer), fkey: famKey(l) }));
  await addHistory(app, rows); return rows.length;
}
// 顧客一致 → 全顧客（ファミリ×寸法区分）→ 全体 の順に 2 件以上あれば中央値
export function learnedMarginFor(hist, l, customer = '') { const mh = hist.filter(r => r.kind === 'margin' && r.bMarginPct != null); const exact = mh.filter(r => r.mkey === marginKey(l, customer)), fam = mh.filter(r => r.fkey === famKey(l)), all = mh; const use = exact.length >= 2 ? exact : fam.length >= 2 ? fam : all.length >= 2 ? all : null; if (!use) return null; return { n: use.length, level: exact.length >= 2 ? '同じ顧客・同じ区分' : fam.length >= 2 ? '同じ区分' : '全体', pct: median(use.map(r => r.bMarginPct)) }; }

// 単価・利益率履歴の出し入れ
export async function exportHistory(app) { return listHistory(app); }
export async function importHistory(app, rows) { const cur = await listHistory(app); const key = r => `${r.tag || ''}|${r.at}|${r.key || r.mkey || ''}|${r.desc || ''}`; const have = new Set(cur.map(key)); const add = (rows || []).filter(r => r && (r.factoryCost != null || r.bMarginPct != null) && !have.has(key(r))); if (add.length) await addHistory(app, add); return add.length; }
