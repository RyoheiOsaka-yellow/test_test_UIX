'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GeoSet } = require('../src/geo');
const { Graph } = require('../src/cook');
const { reg } = require('../src/nodes');

/* ==================== GeoSet ==================== */

test('point / prim / vertex topology', () => {
  const g = new GeoSet();
  const a = g.addPoint(0, 0, 0), b = g.addPoint(1, 0, 0), c = g.addPoint(1, 1, 0);
  const p = g.addPrim([a, b, c]);
  assert.equal(g.numPoints, 3);
  assert.equal(g.numVerts, 3);
  assert.equal(g.numPrims, 1);
  assert.deepEqual(g.primPoints(p), [0, 1, 2]);
  assert.equal(g.vertexPrim(2), 0);
  assert.deepEqual(g.getP(2), [1, 1, 0]);
});

test('string attributes use an index table', () => {
  const g = new GeoSet();
  g.addPoint(); g.addPoint();
  const a = g.addAttrib('point', 'name', 'string');
  a.set(0, 'wall'); a.set(1, 'slab');
  assert.equal(a.get(0), 'wall');
  assert.equal(a.get(1), 'slab');
  a.set(1, 'wall');
  assert.equal(a.strings.length, 3); // '', 'wall', 'slab'
});

test('clone is copy-on-write and does not leak mutations', () => {
  const g = new GeoSet();
  g.addPoint(1, 2, 3);
  const h = g.clone();
  h.setP(0, [9, 9, 9]);
  assert.deepEqual(g.getP(0), [1, 2, 3], 'original must be untouched');
  assert.deepEqual(h.getP(0), [9, 9, 9]);
});

test('promote point attribute to prim (mean)', () => {
  const g = new GeoSet();
  const a = g.addPoint(0, 0, 0), b = g.addPoint(2, 0, 0), c = g.addPoint(2, 2, 0);
  g.addPrim([a, b, c]);
  const h = g.addAttrib('point', 'h', 'float');
  h.set(a, 1); h.set(b, 2); h.set(c, 6);
  g.promotePointToPrim('h', 'mean');
  assert.equal(g.prim.get('h').get(0), 3);
});

test('merge offsets topology correctly', () => {
  const mk = (x) => {
    const g = new GeoSet();
    const a = g.addPoint(x, 0, 0), b = g.addPoint(x + 1, 0, 0), c = g.addPoint(x, 1, 0);
    g.addPrim([a, b, c]);
    return g;
  };
  const g = mk(0);
  g.merge(mk(10));
  assert.equal(g.numPoints, 6);
  assert.equal(g.numPrims, 2);
  assert.deepEqual(g.primPoints(1), [3, 4, 5]);
  assert.deepEqual(g.getP(3), [10, 0, 0]);
});

/* ==================== cook engine ==================== */

function mkGraph() {
  const g = new Graph(reg);
  const grid = g.add('grid', { rows: 3, cols: 3 }, 'grid1');
  const tr = g.add('transform', { translate: [0, 0, 5] }, 'tr1');
  g.connect(grid.id, tr.id, 0);
  g.displayNode = tr.id;
  return g;
}

test('cook produces geometry and caches it', () => {
  const g = mkGraph();
  g.cook('tr1');
  const first = g.cookCount;
  g.cook('tr1');
  assert.equal(g.cookCount, first, 'second cook must hit cache');
});

test('setParam invalidates downstream only', () => {
  const g = mkGraph();
  g.cook('tr1');
  const before = g.cookCount;
  g.get('tr1').setParam('translate', [0, 0, 9]);
  g.cook('tr1');
  assert.equal(g.cookCount, before + 1, 'only the transform recooks');
  assert.equal(g.cook('tr1').getP(0)[2], 9);
});

test('upstream change invalidates the whole downstream chain', () => {
  const g = mkGraph();
  g.cook('tr1');
  const before = g.cookCount;
  g.get('grid1').setParam('rows', 4);
  g.cook('tr1');
  assert.equal(g.cookCount, before + 2, 'grid and transform both recook');
});

test('non time-dependent nodes are not recooked on time change', () => {
  const g = mkGraph();
  g.cook('tr1', { time: 0 });
  const before = g.cookCount;
  g.cook('tr1', { time: 1 });
  assert.equal(g.cookCount, before, 'static chain must stay cached across time');
});

test('time-dependent nodes recook, and propagate the flag downstream', () => {
  const g = mkGraph();
  const osc = g.add('oscillate', { amp: 1, freq: 1 }, 'osc1');
  g.connect('tr1', 'osc1', 0);
  g.cook('osc1', { time: 0 });
  const before = g.cookCount;
  g.cook('osc1', { time: 0.25 });
  assert.equal(g.cookCount, before + 1, 'only the oscillator recooks, grid/transform stay cached');
  assert.ok(g.isTimeDependent('osc1'));
  assert.ok(!g.isTimeDependent('tr1'));
  assert.ok(Math.abs(g.cook('osc1', { time: 0.25 }).getP(0)[2] - 6) < 1e-6);
});

test('cook errors are captured and propagated downstream', () => {
  const g = mkGraph();
  g.add('boom', {}, 'boom1');
  g.connect('tr1', 'boom1', 0);
  const tail = g.add('transform', { translate: [1, 0, 0] }, 'tr2');
  g.connect('boom1', tail.id, 0);
  g.cook('tr2');
  assert.match(g.get('boom1').error, /intentional failure/);
  assert.match(g.get('tr2').error, /upstream error/);
  assert.equal(g.cook('tr2').numPoints, 0);
});

test('missing required input is reported, not thrown', () => {
  const g = new Graph(reg);
  g.add('transform', {}, 'lonely');
  const out = g.cook('lonely');
  assert.equal(out.numPoints, 0);
  assert.match(g.get('lonely').error, /required/);
});

test('cycles are detected instead of overflowing the stack', () => {
  const g = new Graph(reg);
  g.add('transform', {}, 'a');
  g.add('transform', {}, 'b');
  g.connect('a', 'b', 0);
  g.connect('b', 'a', 0);
  assert.doesNotThrow(() => g.cook('a'));
});

test('serialize / deserialize round-trips and recooks identically', () => {
  const g = mkGraph();
  const before = g.cook('tr1').stats();
  const h = Graph.deserialize(reg, g.serialize());
  const after = h.cook('tr1').stats();
  assert.deepEqual(after, before);
});

/* ==================== wrangle ==================== */

test('snippet mutates existing attributes', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2, size: [2, 2] }, 'grid1');
  g.add('snippet', { class: 'point', code: '@P.z = @P.x * 2.0;' }, 'w1');
  g.connect('grid1', 'w1', 0);
  const out = g.cook('w1');
  for (let i = 0; i < out.numPoints; i++) {
    const p = out.getP(i);
    assert.ok(Math.abs(p[2] - p[0] * 2) < 1e-6);
  }
});

test('snippet creates declared attributes and reads builtins', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'grid1');
  g.add('snippet', { class: 'point', code: 'f@w = @ptnum * 0.5; s@tag = "seat";' }, 'w1');
  g.connect('grid1', 'w1', 0);
  const out = g.cook('w1');
  assert.ok(out.point.has('w'));
  assert.equal(out.point.get('w').get(3), 1.5);
  assert.equal(out.point.get('tag').get(0), 'seat');
});

test('snippet reading @Time becomes time dependent automatically', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'grid1');
  g.add('snippet', { class: 'point', code: '@P.z = @Time;' }, 'w1');
  g.connect('grid1', 'w1', 0);
  assert.ok(g.isTimeDependent('w1'), '@Time reference must mark the node time dependent');
  assert.equal(g.cook('w1', { time: 1 }).getP(0)[2], 1);
  assert.equal(g.cook('w1', { time: 2 }).getP(0)[2], 2, 'must recook when time changes');
});

test('snippet without @Time stays static and keeps its cache', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'grid1');
  g.add('snippet', { class: 'point', code: '@P.z = 5;' }, 'w1');
  g.connect('grid1', 'w1', 0);
  assert.ok(!g.isTimeDependent('w1'));
  g.cook('w1', { time: 0 });
  const before = g.cookCount;
  g.cook('w1', { time: 9 });
  assert.equal(g.cookCount, before, 'static snippet must not recook on time change');
});

test('time dependency follows an edit to the snippet source', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'grid1');
  const w = g.add('snippet', { class: 'point', code: '@P.z = 1;' }, 'w1');
  g.connect('grid1', 'w1', 0);
  assert.ok(!g.isTimeDependent('w1'));
  w.setParam('code', '@P.z = @Frame * 0.1;');
  assert.ok(g.isTimeDependent('w1'), '@Frame must also count');
});

test('snippet syntax errors surface as node errors', () => {
  const g = new Graph(reg);
  g.add('grid', {}, 'grid1');
  g.add('snippet', { class: 'point', code: '@P.z = ;;;' }, 'w1');
  g.connect('grid1', 'w1', 0);
  g.cook('w1');
  assert.match(g.get('w1').error, /syntax error/);
});

test('report() returns per-node diagnostics for the agent loop', () => {
  const g = mkGraph();
  g.cookDisplay();
  const r = g.report();
  assert.equal(r.grid1.prims, 4);
  assert.equal(r.tr1.points, 9);
  assert.equal(r.tr1.error, null);
});

test('COW regression: resize must not leak the shared string table', () => {
  const g = new GeoSet();
  g.addPoint(); 
  g.addAttrib('point', 'name', 'string').set(0, 'orig');
  const h = g.clone();       // strings 共有 + frozen
  h.addPoint();              // resize が走る
  h.point.get('name').set(1, 'added');
  assert.equal(g.point.get('name').strings.length, 2, 'original table must be untouched');
  assert.equal(h.point.get('name').get(0), 'orig');
  assert.equal(h.point.get('name').get(1), 'added');
});
