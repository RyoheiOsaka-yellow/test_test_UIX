/* ============================================================
   XBUILD SOP Layer — foreach.js (P5)
   For-Each ブロック。入力ジオメトリをピースへ分割し、各ピースを
   本体グラフ（サブネットと同じ内側グラフ機構）で cook して結合する。
   依存なし（DOM / three.js を参照しない純粋 JS）。SPEC.md §19。

   反復モード:
   - 'prim'  : プリミティブ1つ = 1ピース
   - 'piece' : prim 属性の値が同じプリミティブ群 = 1ピース（棟別処理はこちら）

   本体グラフからの見え方:
   - ピースは subinput（index 0）で受け取る
   - '@parent.iteration' / '@parent.iterations' / '@parent.value' が
     パラメータ参照として解決される（foreach 自身の昇格パラメータも混ざる。
     予約名が衝突した場合は予約名が勝つ）
   - ピースの detail 属性 iteration / piece でも同じ情報が読める
     （スニペットの class 'detail' から参照できる）
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { innerGraph, innerOutputId, parentContext, subnetTimeDep } = require('./subnet');

/**
 * src から primIndices のプリミティブだけを含む新しい GeoSet を作る。
 * ピース内で共有されている point はピース内でも共有が保たれる。
 * 属性（point / vertex / prim / detail）はコピーされる。グループはコピーしない。
 */
function extractPrims(src, primIndices) {
  const g = new GeoSet();
  const pmap = new Map();            // src point -> piece point
  const newPrims = new Array(primIndices.length);
  const closedA = src.prim.get('closed');

  for (let k = 0; k < primIndices.length; k++) {
    const pi = primIndices[k];
    const pts = src.primPoints(pi);
    const mapped = new Array(pts.length);
    for (let j = 0; j < pts.length; j++) {
      let np = pmap.get(pts[j]);
      if (np === undefined) {
        const P = src.getP(pts[j]);
        np = g.addPoint(P[0], P[1], P[2]);
        pmap.set(pts[j], np);
      }
      mapped[j] = np;
    }
    newPrims[k] = g.addPrim(mapped, closedA ? closedA.get(pi) !== 0 : true);
  }

  for (const [name, a] of src.point.map) {
    if (name === 'P') continue;
    const da = g.point.add(name, a.type);
    for (const [si, di] of pmap) da.set(di, a.get(si));
  }
  for (const [name, a] of src.prim.map) {
    if (name === 'closed') continue;   // addPrim が設定済み
    const da = g.prim.add(name, a.type);
    for (let k = 0; k < primIndices.length; k++) da.set(newPrims[k], a.get(primIndices[k]));
  }
  if (src.vertex.map.size) {
    // 新しい vertex はプリミティブ順に隙間なく並ぶ
    const pairs = [];                  // [src vertex, piece vertex]
    let vi = 0;
    for (const pi of primIndices)
      for (const sv of src.primVerts(pi)) pairs.push([sv, vi++]);
    for (const [name, a] of src.vertex.map) {
      const da = g.vertex.add(name, a.type);
      for (const [sv, dv] of pairs) da.set(dv, a.get(sv));
    }
  }
  for (const [name, a] of src.detail.map)
    g.detail.add(name, a.type).set(0, a.get(0));

  return g;
}

/** ピースの detail に反復メタ情報を書く。既存属性と型が食い違う場合は諦めて警告 */
function stampDetail(piece, name, type, value, warn) {
  const ex = piece.detail.get(name);
  if (ex && ex.type !== type) {
    warn(`detail attribute "${name}" already exists as ${ex.type}; iteration metadata not stamped`);
    return;
  }
  piece.detail.add(name, type).set(0, value);
}

function installForEach(reg) {
  reg.register({
    type: 'foreach',
    label: 'For-Each',
    inputs: [{ name: 'geo', required: true }],
    params: {
      graph:  { type: 'dict', default: null },   // 本体グラフ（Graph.serialize 形式）
      mode:   { type: 'string', default: 'prim' },  // 'prim' | 'piece'
      attrib: { type: 'string', default: '' },      // piece モードのグループ化キー（prim 属性）
      defs:   { type: 'dict', default: {} },        // 昇格パラメータ定義（subnet と同じ）
      values: { type: 'dict', default: {} },
    },
    timeDep(node) { return subnetTimeDep(node, node.params.graph); },
    cook(ctx) {
      const src = ctx.inRaw(0);
      const inner = innerGraph(ctx.node, ctx.params.graph);
      if (!inner) { ctx.warn('foreach has no body graph'); return new GeoSet(); }
      const outId = innerOutputId(inner);
      if (!outId) throw new Error('foreach body has no output (set displayNode or add a suboutput node)');

      /* ---------- ピース分割 ---------- */
      const mode = ctx.params.mode;
      let pieces;                      // [{ indices, value }]
      if (mode === 'prim') {
        pieces = new Array(src.numPrims);
        for (let pi = 0; pi < src.numPrims; pi++) pieces[pi] = { indices: [pi], value: pi };
      } else if (mode === 'piece') {
        const name = ctx.params.attrib;
        if (!name) throw new Error('piece mode requires the "attrib" parameter');
        const a = src.prim.get(name);
        if (!a) throw new Error(`no prim attribute "${name}" to build pieces from`);
        const byKey = new Map();       // 値の初出順を保つ（決定論）
        for (let pi = 0; pi < src.numPrims; pi++) {
          const v = a.get(pi);
          let list = byKey.get(v);
          if (!list) byKey.set(v, list = []);
          list.push(pi);
        }
        pieces = [...byKey].map(([value, indices]) => ({ indices, value }));
      } else {
        throw new Error(`unknown mode "${mode}" (prim|piece)`);
      }

      if (!pieces.length) {
        ctx.warn('input has no primitives; output is empty');
        ctx.node._innerReport = { iterations: 0 };
        return new GeoSet();
      }

      /* ---------- 反復 ---------- */
      const promoted = parentContext(ctx.params.defs, ctx.params.values);
      const attrType = mode === 'piece' ? src.prim.get(ctx.params.attrib).type : null;
      const merged = new GeoSet();
      const lifted = new Set();        // 警告はユニーク化して持ち上げる

      for (let k = 0; k < pieces.length; k++) {
        const piece = extractPrims(src, pieces[k].indices);
        stampDetail(piece, 'iteration', 'int', k, ctx.warn);
        if (mode === 'piece') stampDetail(piece, 'piece', attrType, pieces[k].value, ctx.warn);

        // 予約名（iteration / iterations / value）は昇格パラメータより優先
        const parent = { ...promoted, iteration: k, iterations: pieces.length, value: pieces[k].value };
        const geo = inner.cook(outId, { time: ctx.time, frame: ctx.frame, parent, subInputs: [piece] });
        const on = inner.get(outId);
        if (on.error) {
          const label = mode === 'piece' ? ` (piece ${JSON.stringify(pieces[k].value)})` : '';
          throw new Error(`iteration ${k}${label}: inner error in ${outId}: ${on.error}`);
        }
        for (const [id, inode] of inner.nodes)
          for (const w of inode.warnings) lifted.add(`[${id}] ${w}`);

        // 反復メタ情報は結合結果に持ち込まない（merge は detail を先勝ちで拾うため）
        const out = geo.clone();
        out.detail.map.delete('iteration');
        out.detail.map.delete('piece');
        merged.merge(out);
      }

      let wn = 0;
      for (const w of lifted) {
        if (++wn > 20) { ctx.warn(`(+${lifted.size - 20} more unique warnings suppressed)`); break; }
        ctx.warn(w);
      }
      ctx.node._innerReport = { iterations: pieces.length, body: inner.report() };
      return merged;
    },
  });
}

module.exports = { installForEach, extractPrims };
