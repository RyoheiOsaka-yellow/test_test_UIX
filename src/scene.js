/* ============================================================
   XBUILD — scene.js
   シーン層（Pascal 系レジストリの最小形）。
   ------------------------------------------------------------
   ここでの目的は、シーン層を作り直すことではない。
   「geo という kind を1つ足すだけでデータフロー層が接続できる」
   という非破壊拡張の契約を実証すること。
   実運用では既存の xbuild_node_editor.html のレジストリへ
   同じ形の kind を1件追加するだけでよい。
   ============================================================ */

'use strict';

const { toRenderBuffers } = require('./convert');

/* ---------- kind 定義 ---------- */

const KINDS = {
  site:     { label: '敷地',   container: true },
  building: { label: '建物',   container: true },
  layer:    { label: 'レイヤ', container: true },

  /* データフロー層の接続点 */
  geo: {
    label: 'ジオメトリ',
    container: false,
    /**
     * payload = { graph, displayNode, colorBy, ramp, baseColor, range }
     * ctx = { time, frame }
     * 戻り値は描画バッファ。シーン層は GeoSet を一切知らない。
     */
    build(node, ctx) {
      const pl = node.payload;
      const geo = pl.graph.cook(pl.displayNode, ctx);
      return toRenderBuffers(geo, {
        colorBy: pl.colorBy,
        ramp: pl.ramp,
        baseColor: pl.baseColor,
        range: pl.range,
      });
    },
    /** 時間依存かどうかはデータフロー層に委譲する */
    isTimeDependent(node) {
      return node.payload.graph.isTimeDependent(node.payload.displayNode);
    },
  },
};

/* ---------- ストア ---------- */

class SceneStore {
  constructor() {
    this.nodes = {};          // id -> node
    this.order = [];
    this.dirty = new Set();
  }

  add(id, kind, opts = {}) {
    if (!KINDS[kind]) throw new Error(`unknown scene kind: ${kind}`);
    const n = {
      id, kind,
      name: opts.name || id,
      parentId: opts.parentId || null,
      visible: opts.visible !== false,
      payload: opts.payload || {},
      style: opts.style || {},
    };
    this.nodes[id] = n;
    this.order.push(id);
    this.dirty.add(id);
    return n;
  }

  get(id) { return this.nodes[id]; }
  children(id) { return this.order.filter(k => this.nodes[k].parentId === id); }
  roots() { return this.order.filter(k => !this.nodes[k].parentId); }

  markDirty(id) { this.dirty.add(id); }

  setVisible(id, v) { this.nodes[id].visible = v; this.dirty.add(id); }

  /** 時間依存のシーンノードだけを列挙する（毎フレーム再構築の対象） */
  timeDependentIds() {
    return this.order.filter(id => {
      const n = this.nodes[id];
      const k = KINDS[n.kind];
      return k.isTimeDependent ? k.isTimeDependent(n) : false;
    });
  }

  /**
   * dirty なノードだけ build する。
   * emit(id, buffers) が呼ばれる。
   */
  buildDirty(ctx, emit) {
    const built = [];
    for (const id of this.dirty) {
      const n = this.nodes[id];
      const k = KINDS[n.kind];
      if (!k.build) continue;
      let bufs = null, err = null;
      try { bufs = k.build(n, ctx); }
      catch (e) { err = e && e.message ? e.message : String(e); }
      emit(id, bufs, err);
      built.push(id);
    }
    this.dirty.clear();
    return built;
  }
}

module.exports = { SceneStore, KINDS };
