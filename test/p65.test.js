/* ============================================================
   P6.5 — ピッキング基盤のテスト（純粋 JS 部分）
   ビューア実機（レイキャスト / 差分更新 / 影）は Playwright で検証する。
   SPEC.md §20。
   ============================================================ */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { Graph } = require('../src/cook');
const { reg } = require('../src/nodes');
const { SceneStore } = require('../src/scene');
const { toRenderBuffers } = require('../src/convert');
const { GeoSet } = require('../src/geo');

function makeStore() {
  const g = new Graph(reg);
  reg.has('p65src') || reg.register({
    type: 'p65src', inputs: [], params: {},
    cook() {
      const s = new GeoSet();
      const p = [];
      for (const [x, y] of [[0, 0], [10, 0], [10, 10], [0, 10], [20, 0], [30, 0], [25, 10]])
        p.push(s.addPoint(x, y, 0));
      s.addPrim([p[0], p[1], p[2], p[3]]);
      s.addPrim([p[4], p[5], p[6]]);
      const h = s.addAttrib('prim', 'height', 'float');
      h.set(0, 12.5); h.set(1, 30);
      const u = s.addAttrib('prim', 'usage', 'string');
      u.set(0, '住宅'); u.set(1, '商業');
      return s;
    },
  });
  g.add('p65src', {}, 'src1');
  g.displayNode = 'src1';
  const store = new SceneStore();
  store.add('layer1', 'geo', { payload: { graph: g, displayNode: 'src1' }, style: { surface: true } });
  store.add('grp', 'site', {});
  return store;
}

test('scene inspect returns prim attributes for picking', () => {
  const store = makeStore();
  const info = store.inspect('layer1', 0);
  assert.equal(info.prim, 0);
  assert.equal(info.vertices, 4);
  assert.equal(info.attribs.height, 12.5);
  assert.equal(info.attribs.usage, '住宅');
  const info2 = store.inspect('layer1', 1);
  assert.equal(info2.attribs.usage, '商業');
});

test('scene inspect is null out of range / for non-geo kinds / unknown ids', () => {
  const store = makeStore();
  assert.equal(store.inspect('layer1', 99), null);
  assert.equal(store.inspect('layer1', -1), null);
  assert.equal(store.inspect('grp', 0), null);        // container kind に inspect は無い
  assert.equal(store.inspect('nope', 0), null);
});

test('inspect hits the cook cache (no recompute)', () => {
  const store = makeStore();
  const g = store.get('layer1').payload.graph;
  g.cook('src1');
  const before = g.cookCount;
  store.inspect('layer1', 0);
  store.inspect('layer1', 1);
  assert.equal(g.cookCount, before);
});

test('primId buffer maps every render triangle back to its prim', () => {
  const store = makeStore();
  const geo = store.get('layer1').payload.graph.cook('src1');
  const bufs = toRenderBuffers(geo);
  // quad は 2 三角形、三角形は 1 —— 全て正しい prim を指す
  assert.equal(bufs.tris.primId.length, bufs.tris.count);
  const byPrim = new Map();
  for (let t = 0; t < bufs.tris.primId.length; t += 3) {
    const pi = bufs.tris.primId[t];
    byPrim.set(pi, (byPrim.get(pi) || 0) + 1);
    // 三角形内の 3 頂点は同じ prim
    assert.equal(bufs.tris.primId[t + 1], pi);
    assert.equal(bufs.tris.primId[t + 2], pi);
  }
  assert.equal(byPrim.get(0), 2);
  assert.equal(byPrim.get(1), 1);
});
