/* ============================================================
   XBUILD SOP Layer — cook.js
   遅延プル評価エンジン。
   - ノードは出力 GeoSet をキャッシュする
   - 末端（display ノード）から遡って必要なものだけ cook する
   - timeDep フラグの立ったノードだけ時刻変化で再 cook する
   依存なし（DOM / three.js を参照しない純粋 JS）。
   ============================================================ */

'use strict';

const { GeoSet, EMPTY } = require('./geo');

/* ============================================================
   NodeDef レジストリ
   ------------------------------------------------------------
   def = {
     type:    'box',
     label:   'Box',
     inputs:  [{ name:'geo', required:false }],
     params:  { size: { type:'vec3', default:[1,1,1] } },
     timeDep: false,                 // 明示的な時間依存
     cook(ctx) -> GeoSet
   }
   ctx = { in(i), params, time, frame, node, warn(msg), GeoSet }
   ============================================================ */

class Registry {
  constructor() { this.defs = new Map(); this.aliases = new Map(); }

  register(def) {
    if (!def.type) throw new Error('NodeDef requires type');
    if (typeof def.cook !== 'function') throw new Error(`${def.type}: cook() required`);
    def.inputs = def.inputs || [];
    def.params = def.params || {};
    this.defs.set(def.type, def);
    for (const a of def.aliases || []) this.aliases.set(a, def.type);
    return def;
  }

  get(type) {
    const resolved = this.aliases.get(type) || type;
    const d = this.defs.get(resolved);
    if (!d) throw new Error(`unknown node type: ${type}`);
    return d;
  }

  /** 旧型名 -> 現行型名（保存済みグラフの読み込み互換） */
  resolveType(type) { return this.aliases.get(type) || type; }

  has(type) { return this.defs.has(this.aliases.get(type) || type); }
  types() { return [...this.defs.keys()]; }

  /** AI エージェントへ渡すカタログ */
  catalog() {
    return [...this.defs.values()].map(d => ({
      type: d.type,
      label: d.label || d.type,
      inputs: d.inputs.map(i => i.name),
      params: Object.fromEntries(
        Object.entries(d.params).map(([k, v]) => [k, { type: v.type, default: v.default }])
      ),
    }));
  }
}

/* ============================================================
   Node
   ============================================================ */

let _uid = 0;

class Node {
  constructor(graph, type, params = {}, id = null) {
    const def = graph.registry.get(type);
    const resolved = graph.registry.resolveType(type);
    this.graph = graph;
    this.id = id || `${resolved}_${++_uid}`;
    this.type = resolved;
    this.def = def;

    // 旧いパラメータ名で保存されたグラフを読み込むための移行フック
    let src = params;
    if (typeof def.migrateParams === 'function') {
      try { src = def.migrateParams({ ...params }) || params; }
      catch (e) { src = params; }
    }

    this.params = {};
    for (const [k, spec] of Object.entries(def.params))
      this.params[k] = k in src ? src[k] : structuredClone(spec.default);
    for (const k of Object.keys(src))
      if (!(k in def.params)) this.params[k] = src[k];

    this.inputs = new Array(def.inputs.length).fill(null); // node id | null

    // --- cook 状態 ---
    this._cache = null;
    this._valid = false;
    this._cookTime = null;   // キャッシュ時の ctx.time
    this._timeDep = !!def.timeDep;
    this.error = null;
    this.warnings = [];
    this.stats = null;
  }

  setParam(name, value) {
    this.params[name] = value;
    this.graph.invalidate(this.id);
    return this;
  }

  setInput(index, nodeId) {
    this.inputs[index] = nodeId;
    this.graph.invalidate(this.id);
    return this;
  }
}

/* ============================================================
   Graph
   ============================================================ */

class Graph {
  constructor(registry) {
    this.registry = registry;
    this.nodes = new Map();
    this.displayNode = null;
    this.cookCount = 0;
  }

  add(type, params = {}, id = null) {
    const n = new Node(this, type, params, id);
    this.nodes.set(n.id, n);
    return n;
  }

  get(id) {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`no such node: ${id}`);
    return n;
  }

  remove(id) {
    this.nodes.delete(id);
    for (const n of this.nodes.values())
      n.inputs = n.inputs.map(i => (i === id ? null : i));
    this.invalidateAll();
  }

  connect(fromId, toId, inputIndex = 0) {
    this.get(fromId);
    this.get(toId).setInput(inputIndex, fromId);
    return this;
  }

  /** 下流のキャッシュを再帰的に無効化する（プッシュ側） */
  invalidate(id) {
    const seen = new Set();
    const walk = (nid) => {
      if (seen.has(nid)) return;
      seen.add(nid);
      const n = this.nodes.get(nid);
      if (!n) return;
      n._valid = false;
      n._cache = null;
      for (const other of this.nodes.values())
        if (other.inputs.includes(nid)) walk(other.id);
    };
    walk(id);
  }

  invalidateAll() {
    for (const n of this.nodes.values()) { n._valid = false; n._cache = null; }
  }

  /** 時間依存の伝播: 自身 or 上流に時間依存があれば true */
  isTimeDependent(id, seen = new Set()) {
    if (seen.has(id)) return false;
    seen.add(id);
    const n = this.nodes.get(id);
    if (!n) return false;
    if (Graph.nodeDeclaresTimeDep(n)) return true;
    return n.inputs.some(i => i && this.isTimeDependent(i, seen));
  }

  /** def.timeDep は真偽値でも (node)=>boolean でもよい */
  static nodeDeclaresTimeDep(n) {
    const td = n.def.timeDep;
    if (typeof td === 'function') {
      try { return !!td(n); } catch (e) { return false; }
    }
    return !!td;
  }

  /* ---------- cook（プル側） ---------- */

  cook(id, ctx = {}) {
    const time = ctx.time ?? 0;
    const frame = ctx.frame ?? 0;
    return this._cookNode(id, { time, frame }, new Set());
  }

  _cookNode(id, tc, stack) {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`no such node: ${id}`);

    if (stack.has(id)) {
      n.error = 'cycle detected';
      return EMPTY;
    }

    const timeDep = this.isTimeDependent(id);
    n._timeDep = timeDep;

    if (n._valid && (!timeDep || n._cookTime === tc.time)) return n._cache;

    stack.add(id);
    const t0 = Date.now();
    n.error = null;
    n.warnings = [];

    // 入力を先に cook
    const ins = [];
    for (let i = 0; i < n.inputs.length; i++) {
      const src = n.inputs[i];
      if (!src) {
        if (n.def.inputs[i]?.required) {
          n.error = `input "${n.def.inputs[i].name}" is required but not connected`;
          stack.delete(id);
          n._cache = EMPTY; n._valid = true; n._cookTime = tc.time;
          return EMPTY;
        }
        ins.push(null);
        continue;
      }
      const g = this._cookNode(src, tc, stack);
      const up = this.nodes.get(src);
      if (up && up.error) {
        n.error = `upstream error in ${src}: ${up.error}`;
        stack.delete(id);
        n._cache = EMPTY; n._valid = true; n._cookTime = tc.time;
        return EMPTY;
      }
      ins.push(g);
    }

    let out;
    try {
      out = n.def.cook({
        in: (i = 0) => (ins[i] ? ins[i].clone() : null),
        inRaw: (i = 0) => ins[i],
        params: n.params,
        time: tc.time,
        frame: tc.frame,
        node: n,
        warn: (m) => n.warnings.push(String(m)),
        GeoSet,
      });
      if (!(out instanceof GeoSet)) throw new Error('cook() must return a GeoSet');
    } catch (e) {
      n.error = e && e.message ? e.message : String(e);
      out = EMPTY;
    }

    stack.delete(id);
    this.cookCount++;
    n._cache = out;
    n._valid = true;
    n._cookTime = tc.time;
    n.stats = {
      serial: this.cookCount,
      ms: Date.now() - t0,
      points: out.numPoints,
      prims: out.numPrims,
      timeDep,
      error: n.error,
      warnings: n.warnings.slice(),
    };
    return out;
  }

  /** display ノードを cook。AI へ返す診断つき */
  cookDisplay(ctx = {}) {
    if (!this.displayNode) return { geo: EMPTY, report: this.report() };
    const geo = this.cook(this.displayNode, ctx);
    return { geo, report: this.report() };
  }

  /** ノードごとの cook 結果サマリ（エージェントの自己修正ループ用） */
  report() {
    const out = {};
    for (const [id, n] of this.nodes)
      if (n.stats) out[id] = { type: n.type, ...n.stats };
    return out;
  }

  serialize() {
    return {
      displayNode: this.displayNode,
      nodes: [...this.nodes.values()].map(n => ({
        id: n.id, type: n.type, params: structuredClone(n.params), inputs: n.inputs.slice(),
      })),
    };
  }

  static deserialize(registry, data) {
    const g = new Graph(registry);
    for (const nd of data.nodes) g.add(nd.type, nd.params, nd.id);
    for (const nd of data.nodes) g.get(nd.id).inputs = nd.inputs.slice();
    g.displayNode = data.displayNode;
    g.invalidateAll();
    return g;
  }
}

module.exports = { Registry, Graph, Node };
