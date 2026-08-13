/* ============================================================
   XBUILD SOP Layer — subnet.js (P4)
   サブネット + パラメータ昇格 + XDA（XBUILD アセット）。
   依存なし（DOM / three.js を参照しない純粋 JS）。SPEC.md §18。

   仕組みの要点:
   - サブネットは内側グラフを1本持ち、cook 時に内側の出力ノードを
     プル評価する。内側グラフのキャッシュはサブネットの cook を跨いで
     生き続けるので、昇格パラメータを変えても '@parent.*' を参照する
     内側ノードだけが再 cook される（cook.js の resolveParams / _parentKey）。
   - subinput は外側から渡されたジオメトリを内側へ持ち込む。
     入力ジオメトリの実体（オブジェクト同一性）を cookKey にすることで、
     外側の上流が再 cook されたときだけ内側が追随する。
   - XDA は「グラフを def 側に固定したサブネット」。昇格パラメータが
     そのままノードパラメータになり、name がノード型名になる。
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { Graph } = require('./cook');

/* ---------- 内側グラフの実体化（ノード実インスタンス単位でキャッシュ） ---------- */

function innerGraph(node, graphData) {
  if (!graphData || !Array.isArray(graphData.nodes)) return null;
  // graphData のオブジェクト同一性で判定する。差し替えは setParam('graph', ...) 経由で
  // 行うこと（その場書き換えは検知できない）。
  if (node._innerFor !== graphData) {
    node._inner = Graph.deserialize(node.graph.registry, graphData);
    node._innerFor = graphData;
  }
  return node._inner;
}

function innerOutputId(inner) {
  if (inner.displayNode && inner.nodes.has(inner.displayNode)) return inner.displayNode;
  for (const [id, n] of inner.nodes) if (n.type === 'suboutput') return id;
  return null;
}

/** defs と values から、内側グラフへ渡す親パラメータ文脈を作る */
function parentContext(defs, values) {
  const out = {};
  for (const [k, d] of Object.entries(defs || {}))
    out[k] = values && k in values ? values[k] : d && d.default;
  return out;
}

/** 内側グラフを評価し、警告・レポートを外側ノードへ持ち上げる */
function cookInner(ctx, inner, parent) {
  const outId = innerOutputId(inner);
  if (!outId) throw new Error('subnet has no output (set displayNode or add a suboutput node)');
  const subInputs = [];
  for (let i = 0; i < ctx.node.inputs.length; i++) subInputs.push(ctx.inRaw(i));
  const geo = inner.cook(outId, { time: ctx.time, frame: ctx.frame, parent, subInputs });
  ctx.node._innerReport = inner.report();
  for (const [id, inode] of inner.nodes)
    for (const w of inode.warnings) ctx.warn(`[${id}] ${w}`);
  const on = inner.get(outId);
  if (on.error) throw new Error(`inner error in ${outId}: ${on.error}`);
  return geo;
}

/** 内側の出力が時間依存なら、サブネット自身も時間依存 */
function subnetTimeDep(node, graphData) {
  const inner = innerGraph(node, graphData);
  if (!inner) return false;
  const outId = innerOutputId(inner);
  return outId ? inner.isTimeDependent(outId) : false;
}

/* ============================================================
   ノード定義の登録
   ============================================================ */

function installSubnet(reg) {
  /* ---------- subinput : 外側から渡されたジオメトリを内側へ ---------- */
  reg.register({
    type: 'subinput',
    label: 'サブネット入力',
    inputs: [],
    params: { index: { type: 'int', default: 0 } },
    // 入力ジオメトリの実体が替わったときだけ再 cook する
    cookKey(node, tc) {
      const i = node.params.index | 0;
      return (tc.subInputs && tc.subInputs[i]) || null;
    },
    cook(ctx) {
      const i = ctx.params.index | 0;
      const g = ctx.subInput(i);
      if (!g) { ctx.warn(`subnet input ${i} is not connected`); return new GeoSet(); }
      return g;
    },
  });

  /* ---------- suboutput : 内側グラフの出力マーカー ---------- */
  reg.register({
    type: 'suboutput',
    label: 'サブネット出力',
    inputs: [{ name: 'geo', required: true }],
    params: {},
    cook(ctx) { return ctx.in(0); },
  });

  /* ---------- subnet : 編集可能なサブネット ---------- */
  reg.register({
    type: 'subnet',
    label: 'サブネット',
    inputs: [{ name: 'in0' }, { name: 'in1' }, { name: 'in2' }, { name: 'in3' }],
    params: {
      graph:  { type: 'dict', default: null },  // 内側グラフ（Graph.serialize 形式）
      defs:   { type: 'dict', default: {} },    // 昇格パラメータ定義 { name: { type, default } }
      values: { type: 'dict', default: {} },    // 昇格パラメータの現在値
    },
    timeDep(node) { return subnetTimeDep(node, node.params.graph); },
    cook(ctx) {
      const inner = innerGraph(ctx.node, ctx.params.graph);
      if (!inner) { ctx.warn('subnet has no inner graph'); return new GeoSet(); }
      // values 自体が '@parent.*' を含んでもよい（入れ子サブネット）。
      // その解決は cook.js が済ませているので、ここでは解決済みの値を使う。
      const parent = parentContext(ctx.params.defs, ctx.params.values);
      return cookInner(ctx, inner, parent);
    },
  });
}

/* ============================================================
   XDA — XBUILD アセット
   ------------------------------------------------------------
   形式（xda: 1）:
     {
       xda: 1,
       name: 'arena_bowl',          // ノード型名になる
       version: '1.2.0',            // MAJOR.MINOR.PATCH
       label?, inputs?, aliases?,
       params: { size: { type: 'float', default: 10 } },   // 昇格パラメータ
       graph: { nodes: [...], displayNode },               // subinput / suboutput を含む
       migrate?(params, fromVersion) -> params             // 旧バージョン読み込みフック
     }

   バージョンの規約:
   - ノードは生成時のアセットバージョンを params._xdaVersion に保存する
     （serialize に含まれるので、保存グラフに焼き付く）
   - 旧バージョンの保存ノードを新バージョンのレジストリで読み込むと、
     migrate(params, fromVersion) が（定義されていれば）呼ばれてから
     現行バージョンが刻まれる。パラメータの改名・削除は migrate で吸収する
   - migrate を書かずに互換を壊す変更をしたら、それは MAJOR を上げる場面
   ============================================================ */

const XDA_FORMAT = 1;
const VERSION_RE = /^\d+\.\d+\.\d+$/;

function registerAsset(reg, asset) {
  if (!asset || asset.xda !== XDA_FORMAT)
    throw new Error(`unsupported XDA format (expected xda: ${XDA_FORMAT})`);
  if (!asset.name) throw new Error('XDA requires a name');
  if (!VERSION_RE.test(asset.version || ''))
    throw new Error(`XDA "${asset.name}": version must be MAJOR.MINOR.PATCH (got "${asset.version}")`);
  if (!asset.graph || !Array.isArray(asset.graph.nodes))
    throw new Error(`XDA "${asset.name}": graph is required`);

  const params = {};
  for (const [k, d] of Object.entries(asset.params || {})) {
    if (k.startsWith('_'))
      throw new Error(`XDA "${asset.name}": parameter names must not start with "_" (got "${k}")`);
    params[k] = { type: d.type, default: structuredClone(d.default) };
  }
  params._xdaVersion = { type: 'string', default: asset.version };

  if (!reg.assets) reg.assets = new Map();
  reg.assets.set(asset.name, asset);

  return reg.register({
    type: asset.name,
    label: asset.label || asset.name,
    aliases: asset.aliases || [],
    asset: { name: asset.name, version: asset.version },
    inputs: (asset.inputs || []).map(i => ({ name: i.name, required: !!i.required })),
    params,
    migrateParams(p) {
      const from = p._xdaVersion;
      if (from && from !== asset.version && typeof asset.migrate === 'function') {
        const out = asset.migrate({ ...p }, from);
        if (out) p = out;
      }
      p._xdaVersion = asset.version;
      return p;
    },
    timeDep(node) { return subnetTimeDep(node, asset.graph); },
    cook(ctx) {
      const inner = innerGraph(ctx.node, asset.graph);
      const parent = {};
      for (const k of Object.keys(asset.params || {})) parent[k] = ctx.params[k];
      return cookInner(ctx, inner, parent);
    },
  });
}

/**
 * サブネットノードから XDA 定義を作る（「公開」操作）。
 * 昇格パラメータの既定値には、作者が現在セットしている値を採用する。
 */
function assetFromSubnet(node, meta = {}) {
  if (!node || node.type !== 'subnet') throw new Error('assetFromSubnet expects a subnet node');
  if (!meta.name) throw new Error('assetFromSubnet requires meta.name');
  if (!node.params.graph) throw new Error('subnet has no inner graph');

  const defs = structuredClone(node.params.defs || {});
  const values = node.params.values || {};
  for (const [k, d] of Object.entries(defs))
    if (k in values) d.default = structuredClone(values[k]);

  return {
    xda: XDA_FORMAT,
    name: meta.name,
    version: meta.version || '1.0.0',
    label: meta.label || meta.name,
    inputs: meta.inputs || node.def.inputs.map(i => ({ name: i.name })),
    params: defs,
    graph: structuredClone(node.params.graph),
  };
}

module.exports = {
  installSubnet, registerAsset, assetFromSubnet, XDA_FORMAT,
  // foreach.js（P5）が再利用する内側グラフ機構
  innerGraph, innerOutputId, parentContext, subnetTimeDep,
};
