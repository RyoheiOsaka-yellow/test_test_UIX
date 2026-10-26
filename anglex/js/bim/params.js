// パラメータ式評価（Revit のファミリ式に相当）: "=H - 2*t", "=if(L>1000, 2, 1)", "=max(a,b)", "=round(H/100)*100"
const FN = { min: Math.min, max: Math.max, abs: Math.abs, round: (v, n = 0) => Math.round(v / Math.pow(10, -n)) * Math.pow(10, -n), floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, if: (c, a, b) => (c ? a : b), pi: () => Math.PI, roundup: (v, m = 1) => Math.ceil(v / m) * m, rounddown: (v, m = 1) => Math.floor(v / m) * m };
function tokenize(s) { const re = /\s*(\d+\.?\d*|[A-Za-z_぀-ヿ一-鿿][\w぀-ヿ一-鿿]*|>=|<=|==|!=|&&|\|\||[-+*/^(),<>!])/g; const out = []; let m; let last = 0; while ((m = re.exec(s))) { out.push(m[1]); last = re.lastIndex; } if (s.slice(last).trim()) throw new Error('式を解釈できません: ' + s.slice(last)); return out; }
export function evaluate(expr, vars = {}) {
  const t = tokenize(String(expr).replace(/^=/, '')); let i = 0;
  const peek = () => t[i], next = () => t[i++];
  function prim() { const k = next(); if (k == null) throw new Error('式が途中で終わっています'); if (k === '(') { const v = or(); if (next() !== ')') throw new Error(') がありません'); return v; } if (k === '-') return -prim(); if (k === '!') return prim() ? 0 : 1; if (/^\d/.test(k)) return parseFloat(k);
    if (peek() === '(') { next(); const args = []; if (peek() !== ')') { args.push(or()); while (peek() === ',') { next(); args.push(or()); } } next(); const f = FN[k.toLowerCase()]; if (!f) throw new Error('未知の関数 ' + k); return f(...args); }
    if (k in vars) { const v = vars[k]; return typeof v === 'number' ? v : (v === true ? 1 : v === false ? 0 : parseFloat(v) || 0); } throw new Error('未知のパラメータ ' + k); }
  function pow() { let a = prim(); while (peek() === '^') { next(); a = Math.pow(a, prim()); } return a; }
  function mul() { let a = pow(); while (peek() === '*' || peek() === '/') { const o = next(); const b = pow(); a = o === '*' ? a * b : a / b; } return a; }
  function add() { let a = mul(); while (peek() === '+' || peek() === '-') { const o = next(); const b = mul(); a = o === '+' ? a + b : a - b; } return a; }
  function cmp() { let a = add(); while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) { const o = next(); const b = add(); a = ({ '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b, '==': a == b, '!=': a != b })[o] ? 1 : 0; } return a; }
  function and() { let a = cmp(); while (peek() === '&&') { next(); const b = cmp(); a = a && b ? 1 : 0; } return a; }
  function or() { let a = and(); while (peek() === '||') { next(); const b = and(); a = a || b ? 1 : 0; } return a; }
  const v = or(); if (i < t.length) throw new Error('余分なトークン ' + t[i]); return v;
}
// 定義配列とユーザ値から全パラメータを解決（式は依存順に反復評価）
export function resolveParams(defs, values = {}) {
  const out = {}; const pending = [];
  for (const d of defs) { const v = values[d.key] !== undefined ? values[d.key] : d.default; if (typeof v === 'string' && v.startsWith('=')) pending.push([d.key, v]); else out[d.key] = coerce(d, v); }
  let guard = 0; let rest = pending;
  while (rest.length && guard++ < 10) { const nxt = []; for (const [k, e] of rest) { try { out[k] = evaluate(e, out); } catch (err) { nxt.push([k, e]); } } if (nxt.length === rest.length) { for (const [k, e] of nxt) out[k] = NaN; break; } rest = nxt; }
  return out;
}
function coerce(d, v) { if (d.type === 'number' || d.type === 'length' || d.type === 'angle' || d.type === 'int') { const n = typeof v === 'number' ? v : parseFloat(v); return isNaN(n) ? (d.default || 0) : n; } if (d.type === 'bool') return v === true || v === 'true' || v === 1 || v === '1'; return v; }
export function paramLabel(d) { return d.label + (d.unit ? ` [${d.unit}]` : ''); }
