// 営業所（拠点）マスタ: 全営業所と工場が 1 つのシステム・1 つの DB を共有し、案件・見積は branch で仕分ける
export const BRANCHES = [
  { code: 'HQ', name: '本社', short: '本社' },
  { code: 'TKY', name: '東京営業所', short: '東京' },
  { code: 'OSK', name: '大阪営業所', short: '大阪' },
  { code: 'NGY', name: '名古屋営業所', short: '名古屋' },
  { code: 'FKO', name: '福岡営業所', short: '福岡' },
  { code: 'SDI', name: '仙台営業所', short: '仙台' },
];
export const branchOf = code => BRANCHES.find(b => b.code === code) || null;
export const branchName = code => branchOf(code)?.name || (code ? code : '未設定');
export const branchShort = code => branchOf(code)?.short || (code ? code : '—');
// 閲覧範囲: 営業所所属（A社）は自営業所が既定、工場（C社）・販売（B社）は全営業所
export function visibleBranches(user) { if (!user) return BRANCHES.map(b => b.code); if (user.scope === 'all' || !user.branch) return BRANCHES.map(b => b.code); return [user.branch]; }
export function canSeeProject(user, p, { all = false } = {}) { if (all || !user || user.scope === 'all' || !user.branch) return true; return !p.branch || p.branch === user.branch; }
