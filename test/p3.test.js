'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GeoSet } = require('../src/geo');
const { Graph } = require('../src/cook');
const { reg, compileSnippet, snippetIsTimeDependent } = require('../src/nodes');

/* ==================== 旧グラフの読み込み互換 ==================== */

test('legacy "wrangle" type resolves to "snippet"', () => {
  const g = new Graph(reg);
  const n = g.add('wrangle', {}, 'w1');
  assert.equal(n.type, 'snippet', 'stored type must be normalised');
  assert.equal(n.def.type, 'snippet');
});

test('legacy "snippet" parameter migrates to "code"', () => {
  const g = new Graph(reg);
  const n = g.add('wrangle', { class: 'point', snippet: '@P.z = 3;' }, 'w1');
  assert.equal(n.params.code, '@P.z = 3;');
  assert.ok(!('snippet' in n.params), 'legacy key must be removed');
});

test('a graph saved with the old names deserializes and cooks', () => {
  const legacy = {
    displayNode: 'w1',
    nodes: [
      { id: 'g1', type: 'grid', params: { rows: 2, cols: 2, size: [2, 2] }, inputs: [] },
      { id: 'w1', type: 'wrangle', params: { class: 'point', snippet: '@P.z = 4;' }, inputs: ['g1'] },
    ],
  };
  const g = Graph.deserialize(reg, legacy);
  const out = g.cook('w1');
  assert.equal(out.getP(0)[2], 4);
  assert.equal(g.get('w1').type, 'snippet');
  // 再保存すると現行の名前で出る
  const round = g.serialize();
  assert.equal(round.nodes.find(n => n.id === 'w1').type, 'snippet');
  assert.equal(round.nodes.find(n => n.id === 'w1').params.code, '@P.z = 4;');
});

/* ==================== 時間依存の自動検出 ==================== */

test('snippetIsTimeDependent detects @Time and @Frame only', () => {
  assert.ok(snippetIsTimeDependent('@P.z = @Time;'));
  assert.ok(snippetIsTimeDependent('var f = @Frame;'));
  assert.ok(!snippetIsTimeDependent('@P.z = 1;'));
  assert.ok(!snippetIsTimeDependent('f@Timeless = 1;'), 'must not match a longer identifier');
});

test('time dependency propagates downstream from a snippet', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  g.add('snippet', { class: 'point', code: '@P.z = @Time;' }, 'w1');
  g.add('transform', { translate: [1, 0, 0] }, 't1');
  g.connect('g1', 'w1', 0);
  g.connect('w1', 't1', 0);
  assert.ok(g.isTimeDependent('t1'), 'downstream of a time-dependent node is time dependent');
  assert.ok(!g.isTimeDependent('g1'));

  g.cook('t1', { time: 0 });
  const before = g.cookCount;
  g.cook('t1', { time: 1 });
  assert.equal(g.cookCount, before + 2, 'snippet and transform recook, grid stays cached');
});

test('compile cache returns the same compiled object for identical source', () => {
  const a = compileSnippet('@P.z = 1;');
  const b = compileSnippet('@P.z = 1;');
  assert.strictEqual(a, b);
});

test('compile cache also remembers failures without rethrowing differently', () => {
  assert.throws(() => compileSnippet('@P.z = ;;;'), /syntax error/);
  assert.throws(() => compileSnippet('@P.z = ;;;'), /syntax error/);
});

/* ==================== 属性操作ノード ==================== */

function grid2x2() {
  const g = new Graph(reg);
  g.add('grid', { rows: 3, cols: 3, size: [4, 4] }, 'g1');
  return g;
}

test('attribpromote moves a point attribute up to prim', () => {
  const g = grid2x2();
  g.add('snippet', { class: 'point', code: 'f@h = @P.x;' }, 'w1');
  g.add('attribpromote', { name: 'h', from: 'point', to: 'prim', mode: 'max', outName: 'hmax' }, 'pr');
  g.connect('g1', 'w1', 0); g.connect('w1', 'pr', 0);
  const out = g.cook('pr');
  assert.ok(out.prim.has('hmax'));
  assert.equal(out.prim.get('hmax').get(0), Math.max(...out.primPoints(0).map(p => out.getP(p)[0])));
});

test('attribpromote reports an unsupported direction instead of silently passing', () => {
  const g = grid2x2();
  g.add('attribpromote', { name: 'P', from: 'point', to: 'vertex' }, 'pr');
  g.connect('g1', 'pr', 0);
  g.cook('pr');
  assert.match(g.get('pr').error, /not supported/);
});

test('attribconvert extracts a vector component into a scalar', () => {
  const g = grid2x2();
  g.add('attribconvert', { class: 'point', name: 'P', type: 'float', component: 0, outName: 'px' }, 'cv');
  g.connect('g1', 'cv', 0);
  const out = g.cook('cv');
  assert.ok(out.point.has('px'));
  for (let i = 0; i < out.point.count; i++)
    assert.equal(out.point.get('px').get(i), out.getP(i)[0]);
  assert.ok(out.point.has('P'), 'source attribute survives when outName differs');
});

test('attribconvert rounds when the target type is int', () => {
  const g = grid2x2();
  g.add('snippet', { class: 'point', code: 'f@v = @ptnum * 0.4;' }, 'w1');
  g.add('attribconvert', { class: 'point', name: 'v', type: 'int', outName: 'vi' }, 'cv');
  g.connect('g1', 'w1', 0); g.connect('w1', 'cv', 0);
  const out = g.cook('cv');
  assert.equal(out.point.get('vi').type, 'int');
  assert.equal(out.point.get('vi').get(3), 1);   // 1.2 -> 1
  assert.equal(out.point.get('vi').get(4), 2);   // 1.6 -> 2
});

test('attribconvert refuses a vector source without a component', () => {
  const g = grid2x2();
  g.add('attribconvert', { class: 'point', name: 'P', type: 'float', outName: 'x' }, 'cv');
  g.connect('g1', 'cv', 0);
  g.cook('cv');
  assert.match(g.get('cv').error, /set component/);
});

test('attribrename and attribdelete', () => {
  const g = grid2x2();
  g.add('snippet', { class: 'point', code: 'f@a = 1; f@b = 2;' }, 'w1');
  g.add('attribrename', { class: 'point', from: 'a', to: 'alpha' }, 'rn');
  g.add('attribdelete', { class: 'point', names: 'b' }, 'dl');
  g.connect('g1', 'w1', 0); g.connect('w1', 'rn', 0); g.connect('rn', 'dl', 0);
  const out = g.cook('dl');
  assert.ok(out.point.has('alpha'));
  assert.ok(!out.point.has('a'));
  assert.ok(!out.point.has('b'));
  assert.equal(out.point.get('alpha').get(0), 1);
});

test('attribdelete refuses to remove P and warns instead', () => {
  const g = grid2x2();
  g.add('attribdelete', { class: 'point', names: 'P' }, 'dl');
  g.connect('g1', 'dl', 0);
  const out = g.cook('dl');
  assert.ok(out.point.has('P'));
  assert.match(g.get('dl').warnings[0], /cannot be deleted/);
});

/* ==================== 属性型の取り違え検出 ==================== */

test('re-adding an attribute with a different type throws', () => {
  const geo = new GeoSet();
  geo.addPoint();
  geo.addAttrib('point', 'h', 'float');
  assert.throws(() => geo.addAttrib('point', 'h', 'int'), /already exists as float/);
});

test('a snippet redeclaring an attribute with another type warns, keeping the graph alive', () => {
  const g = grid2x2();
  g.add('snippet', { class: 'point', code: 'f@h = 1;' }, 'w1');
  g.add('snippet', { class: 'point', code: 'i@h = 2;' }, 'w2');
  g.connect('g1', 'w1', 0); g.connect('w1', 'w2', 0);
  const out = g.cook('w2');
  assert.equal(g.get('w2').error, null, 'must not break the chain');
  assert.match(g.get('w2').warnings[0], /already exists as float/);
  assert.equal(out.point.get('h').type, 'float', 'the existing type wins');
  assert.equal(out.point.get('h').get(0), 2);
});

/* ==================== コメント / 文字列の除外 ==================== */

test('a snippet that only mentions @Time in a comment is NOT time dependent', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  g.add('snippet', { class: 'point', code: '// @Time を書くと時間依存になる\n@P.z = 1;' }, 'w1');
  g.connect('g1', 'w1', 0);
  assert.ok(!g.isTimeDependent('w1'), 'comments must not trigger time dependency');
});

test('block comments and string literals are excluded too', () => {
  assert.ok(!snippetIsTimeDependent('/* uses @Frame internally */ @P.z = 0;'));
  assert.ok(!snippetIsTimeDependent('s@note = "set from @Time";'));
  assert.ok(snippetIsTimeDependent('/* comment */ @P.z = @Time;'));
});

test('attributes named only inside a comment are not bound or warned about', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  g.add('snippet', { class: 'point', code: '// @height @usage は prim 属性\n@P.z = 2;' }, 'w1');
  g.connect('g1', 'w1', 0);
  const out = g.cook('w1');
  assert.equal(g.get('w1').warnings.length, 0, `unexpected warnings: ${g.get('w1').warnings}`);
  assert.equal(out.getP(0)[2], 2);
});

test('a declaration inside a comment does not create an attribute', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  g.add('snippet', { class: 'point', code: '// f@ghost = 1;\n@P.z = 3;' }, 'w1');
  g.connect('g1', 'w1', 0);
  const out = g.cook('w1');
  assert.ok(!out.point.has('ghost'), 'commented-out declaration must not create an attribute');
});
