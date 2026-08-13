/* ============================================================
   XBUILD SOP Layer — nodes.js
   仕様検証用のリファレンスノード定義。
   ここでの目的は網羅ではなく「cook 契約が破綻しないこと」の証明。
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { Registry } = require('./cook');

const reg = new Registry();

/* ---------- grid : 点とプリミティブを生成 ---------- */
reg.register({
  type: 'grid',
  label: 'Grid',
  inputs: [],
  params: {
    size: { type: 'vec2', default: [10, 10] },
    rows: { type: 'int', default: 3 },
    cols: { type: 'int', default: 3 },
  },
  cook(ctx) {
    const { size, rows, cols } = ctx.params;
    const g = new GeoSet();
    const ids = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const x = (c / Math.max(1, cols - 1) - 0.5) * size[0];
        const y = (r / Math.max(1, rows - 1) - 0.5) * size[1];
        row.push(g.addPoint(x, y, 0));
      }
      ids.push(row);
    }
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++)
        g.addPrim([ids[r][c], ids[r][c + 1], ids[r + 1][c + 1], ids[r + 1][c]], true);
    return g;
  },
});

/* ---------- transform ---------- */
reg.register({
  type: 'transform',
  label: 'Transform',
  inputs: [{ name: 'geo', required: true }],
  params: { translate: { type: 'vec3', default: [0, 0, 0] } },
  cook(ctx) {
    const g = ctx.in(0);
    const t = ctx.params.translate;
    const P = g.point.get('P').raw();
    for (let i = 0; i < g.numPoints; i++) {
      P[i * 3] += t[0]; P[i * 3 + 1] += t[1]; P[i * 3 + 2] += t[2];
    }
    return g;
  },
});

/* ---------- merge ---------- */
reg.register({
  type: 'merge',
  label: 'Merge',
  inputs: [{ name: 'a' }, { name: 'b' }],
  params: {},
  cook(ctx) {
    const a = ctx.in(0) || new GeoSet();
    const b = ctx.inRaw(1);
    if (b) a.merge(b);
    return a;
  },
});

/* ---------- oscillate : 時間依存ノード ---------- */
reg.register({
  type: 'oscillate',
  label: 'Oscillate',
  inputs: [{ name: 'geo', required: true }],
  params: { amp: { type: 'float', default: 1 }, freq: { type: 'float', default: 1 } },
  timeDep: true,
  cook(ctx) {
    const g = ctx.in(0);
    const { amp, freq } = ctx.params;
    const dz = amp * Math.sin(ctx.time * freq * Math.PI * 2);
    const P = g.point.get('P').raw();
    for (let i = 0; i < g.numPoints; i++) P[i * 3 + 2] += dz;
    return g;
  },
});

/* ---------- boom : 常に失敗するノード（エラー伝播の検証用） ---------- */
reg.register({
  type: 'boom',
  label: 'Boom',
  inputs: [{ name: 'geo' }],
  params: {},
  cook() { throw new Error('intentional failure'); },
});

/* ============================================================
   snippet : 要素ごとに JS スニペットを実行する
   ------------------------------------------------------------
   構文:
     @P, @N ...       既存属性のバインド（vec は {x,y,z}）
     f@w, i@n, v@up, s@name, 2@uv, 4@q   新規属性の宣言つきバインド
     @ptnum, @numpt, @Time, @Frame       読み取り専用の組込み

   旧名 `wrangle` は型エイリアスとして受け付ける（保存済みグラフ互換）。
   ============================================================ */

const TYPE_PREFIX = { f: 'float', i: 'int', v: 'vec3', s: 'string', 2: 'vec2', 4: 'vec4' };
const CLASS_TO_OWNER = { point: 'point', prim: 'prim', vertex: 'vertex', detail: 'detail' };
const BUILTINS = new Set(['ptnum', 'primnum', 'elemnum', 'numpt', 'numprim', 'Time', 'Frame']);

/* 時間依存の自動検出 */
const TIME_RE = /@(Time|Frame)\b/;

/**
 * コメントと文字列リテラルを取り除く。
 * これを通さないと `// @Time を書くと…` のような説明文が
 * 時間依存として検出され、属性バインドにも拾われてしまう。
 */
function stripNonCode(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        if (src[i] === q) break;
        out += ' '; i++;                 // 文字列の中身は空白に潰す
      }
      out += q; i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* コンパイル結果のキャッシュ（同じソースを毎フレーム再コンパイルしない） */
const _compileCache = new Map();
const COMPILE_CACHE_MAX = 200;

function compileSnippet(source) {
  const src = source || '';
  const hit = _compileCache.get(src);
  if (hit) {
    if (hit.error) throw new Error(hit.error);
    return hit;
  }

  const scan = stripNonCode(src);      // 検出とバインドはコメント/文字列を除いた本体で行う
  const declared = new Map();
  let code = src.replace(/\b([fiv24s])@(\w+)/g, (_m, t, n) => {
    declared.set(n, TYPE_PREFIX[t]);
    return `_v.${n}`;
  });
  code = code.replace(/@(\w+)/g, (_m, n) => `_v.${n}`);

  const bound = new Set();
  let scanCode = scan.replace(/\b([fiv24s])@(\w+)/g, (_m, t, n) => `_v.${n}`)
                     .replace(/@(\w+)/g, (_m, n) => `_v.${n}`);
  for (const m of scanCode.matchAll(/_v\.(\w+)/g)) bound.add(m[1]);

  let fn;
  try {
    fn = new Function('_v', `"use strict";\n${code}\n`);
  } catch (e) {
    const msg = `snippet syntax error: ${e.message}`;
    if (_compileCache.size < COMPILE_CACHE_MAX) _compileCache.set(src, { error: msg });
    throw new Error(msg);
  }

  for (const k of [...declared.keys()]) if (!bound.has(k)) declared.delete(k);
  const out = { fn, declared, bound, timeDep: TIME_RE.test(scan) };
  if (_compileCache.size >= COMPILE_CACHE_MAX) _compileCache.clear();
  _compileCache.set(src, out);
  return out;
}

/** 例外を投げずに時間依存だけ知りたい場合 */
function snippetIsTimeDependent(source) {
  return TIME_RE.test(stripNonCode(source || ''));
}

reg.register({
  type: 'snippet',
  label: 'スニペット',
  aliases: ['wrangle'],
  inputs: [{ name: 'geo', required: true }],
  params: {
    class: { type: 'string', default: 'point' },
    code:  { type: 'string', default: '' },
  },
  /** 旧パラメータ名 `snippet` を `code` へ移行する */
  migrateParams(p) {
    if ('snippet' in p && !('code' in p)) { p.code = p.snippet; delete p.snippet; }
    return p;
  },
  /** ソースが @Time / @Frame を参照していれば時間依存として扱う */
  timeDep(node) { return snippetIsTimeDependent(node.params.code); },
  cook(ctx) {
    const g = ctx.in(0);
    const owner = CLASS_TO_OWNER[ctx.params.class] || 'point';
    const { fn, declared, bound } = compileSnippet(ctx.params.code);

    // 属性の解決 / 新規作成
    const attribs = new Map();
    for (const name of bound) {
      if (BUILTINS.has(name)) continue;
      let a = g[owner].get(name);
      if (a && declared.has(name) && a.type !== declared.get(name))
        ctx.warn(`@${name} already exists as ${a.type}; the declared ${declared.get(name)} is ignored`);
      if (!a && declared.has(name)) a = g[owner].add(name, declared.get(name));
      if (!a && name === 'P' && owner !== 'point') continue;
      if (a) attribs.set(name, a);
      else ctx.warn(`unbound attribute @${name} (declare it, e.g. f@${name})`);
    }

    const n = owner === 'detail' ? 1 : g[owner].count;
    const _v = Object.create(null);

    for (let i = 0; i < n; i++) {
      for (const [name, a] of attribs) {
        const v = a.get(i);
        _v[name] = Array.isArray(v) ? { x: v[0], y: v[1], z: v[2], w: v[3] } : v;
      }
      _v.ptnum = i; _v.primnum = i; _v.elemnum = i;
      _v.numpt = g.numPoints; _v.numprim = g.numPrims;
      _v.Time = ctx.time; _v.Frame = ctx.frame;

      fn(_v);

      for (const [name, a] of attribs) {
        const v = _v[name];
        if (v && typeof v === 'object')
          a.set(i, a.size === 2 ? [v.x, v.y] : a.size === 4 ? [v.x, v.y, v.z, v.w] : [v.x, v.y, v.z]);
        else a.set(i, v);
      }
    }
    return g;
  },
});

/* ============================================================
   属性操作ノード群
   ============================================================ */

const OWNER_LIST = ['point', 'vertex', 'prim', 'detail'];

function requireOwner(o) {
  if (!OWNER_LIST.includes(o)) throw new Error(`unknown class "${o}" (point|vertex|prim|detail)`);
  return o;
}

/* ---------- attribpromote : 階層間の移動 ---------- */
reg.register({
  type: 'attribpromote',
  label: '属性の昇格',
  inputs: [{ name: 'geo', required: true }],
  params: {
    name:    { type: 'string', default: '' },
    from:    { type: 'string', default: 'point' },
    to:      { type: 'string', default: 'prim' },
    mode:    { type: 'string', default: 'mean' },   // mean|min|max|sum|first
    outName: { type: 'string', default: '' },
  },
  cook(ctx) {
    const g = ctx.in(0);
    const { name, mode } = ctx.params;
    const from = requireOwner(ctx.params.from), to = requireOwner(ctx.params.to);
    const out = ctx.params.outName || name;
    if (!name) throw new Error('name is required');
    if (!g[from].has(name)) throw new Error(`no ${from} attribute "${name}"`);

    if (from === 'point' && to === 'prim') g.promotePointToPrim(name, mode, out);
    else if (from === 'prim' && to === 'point') g.promotePrimToPoint(name, out);
    else throw new Error(`promotion ${from} -> ${to} is not supported yet`);
    return g;
  },
});

/* ---------- attribconvert : 型変換 / 成分抽出 ---------- */
reg.register({
  type: 'attribconvert',
  label: '属性の型変換',
  inputs: [{ name: 'geo', required: true }],
  params: {
    class:     { type: 'string', default: 'point' },
    name:      { type: 'string', default: '' },
    type:      { type: 'string', default: 'float' },  // float|int
    component: { type: 'int',    default: -1 },       // vec からの成分抽出。-1 で無効
    outName:   { type: 'string', default: '' },
  },
  cook(ctx) {
    const g = ctx.in(0);
    const owner = requireOwner(ctx.params.class);
    const { name, type, component } = ctx.params;
    const out = ctx.params.outName || name;
    if (!name) throw new Error('name is required');
    const src = g[owner].get(name);
    if (!src) throw new Error(`no ${owner} attribute "${name}"`);
    if (type !== 'float' && type !== 'int')
      throw new Error(`target type must be float or int (got "${type}")`);
    if (src.size > 1 && component < 0)
      throw new Error(`"${name}" is ${src.type}; set component (0..${src.size - 1}) to extract a scalar`);
    if (component >= 0 && component >= src.size)
      throw new Error(`component ${component} out of range for ${src.type}`);

    const n = owner === 'detail' ? 1 : g[owner].count;
    const vals = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = src.get(i);
      let s = src.size > 1 ? v[component] : (typeof v === 'string' ? parseFloat(v) : v);
      if (!isFinite(s)) s = 0;
      vals[i] = type === 'int' ? Math.round(s) : s;
    }
    if (out === name) g[owner].remove(name);
    const dst = g[owner].add(out, type);
    for (let i = 0; i < n; i++) dst.set(i, vals[i]);
    return g;
  },
});

/* ---------- attribrename ---------- */
reg.register({
  type: 'attribrename',
  label: '属性の改名',
  inputs: [{ name: 'geo', required: true }],
  params: {
    class: { type: 'string', default: 'point' },
    from:  { type: 'string', default: '' },
    to:    { type: 'string', default: '' },
  },
  cook(ctx) {
    const g = ctx.in(0);
    const owner = requireOwner(ctx.params.class);
    const { from, to } = ctx.params;
    if (!from || !to) throw new Error('from and to are required');
    const a = g[owner].get(from);
    if (!a) throw new Error(`no ${owner} attribute "${from}"`);
    if (g[owner].has(to)) throw new Error(`${owner} attribute "${to}" already exists`);
    g[owner].map.delete(from);
    a.name = to;
    g[owner].map.set(to, a);
    return g;
  },
});

/* ---------- attribdelete ---------- */
reg.register({
  type: 'attribdelete',
  label: '属性の削除',
  inputs: [{ name: 'geo', required: true }],
  params: {
    class: { type: 'string', default: 'point' },
    names: { type: 'string', default: '' },   // 空白 or カンマ区切り
  },
  cook(ctx) {
    const g = ctx.in(0);
    const owner = requireOwner(ctx.params.class);
    const list = String(ctx.params.names || '').split(/[\s,]+/).filter(Boolean);
    for (const nm of list) {
      if (owner === 'point' && nm === 'P') { ctx.warn('point attribute "P" cannot be deleted'); continue; }
      if (!g[owner].remove(nm)) ctx.warn(`no ${owner} attribute "${nm}"`);
    }
    return g;
  },
});

module.exports = { reg, compileSnippet, snippetIsTimeDependent, stripNonCode };
