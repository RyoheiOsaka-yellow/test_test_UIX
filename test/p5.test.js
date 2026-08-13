/* ============================================================
   P5 — For-Each ブロックのテスト
   SPEC.md §19 の検証。
   ============================================================ */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { Graph } = require('../src/cook');
const { reg } = require('../src/nodes');
const { extractPrims } = require('../src/foreach');
const { GeoSet } = require('../src/geo');
require('../src/site_nodes');   // sitectx（実データ棟別テスト用）を登録する

/* ---------- ヘルパ ---------- */

/** subinput -> suboutput の素通し本体 */
function identityBody() {
  const g = new Graph(reg);
  g.add('subinput', { index: 0 }, 'si1');
  g.add('suboutput', {}, 'out1');
  g.connect('si1', 'out1');
  g.displayNode = 'out1';
  return g.serialize();
}

/** subinput -> transform(translate=[0,0,'@parent.iteration']) -> suboutput */
function liftByIterationBody() {
  const g = new Graph(reg);
  g.add('subinput', { index: 0 }, 'si1');
  g.add('transform', { translate: [0, 0, '@parent.iteration'] }, 't1');
  g.connect('si1', 't1');
  g.add('suboutput', {}, 'out1');
  g.connect('t1', 'out1');
  g.displayNode = 'out1';
  return g.serialize();
}

/** subinput -> snippet(prim: f@cnt = @numprim) -> suboutput */
function countBody() {
  const g = new Graph(reg);
  g.add('subinput', { index: 0 }, 'si1');
  g.add('snippet', { class: 'prim', code: 'f@cnt = @numprim;' }, 's1');
  g.connect('si1', 's1');
  g.add('suboutput', {}, 'out1');
  g.connect('s1', 'out1');
  g.displayNode = 'out1';
  return g.serialize();
}

/** 2つの三角形と1つの四角形、prim 属性 grp = a / a / b */
function groupedInput() {
  const g = new GeoSet();
  const p = [];
  for (let i = 0; i < 8; i++) p.push(g.addPoint(i, 0, 0));
  g.addPrim([p[0], p[1], p[2]]);
  g.addPrim([p[2], p[3], p[4]]);
  g.addPrim([p[4], p[5], p[6], p[7]]);
  const a = g.addAttrib('prim', 'grp', 'string');
  a.set(0, 'a'); a.set(1, 'a'); a.set(2, 'b');
  const h = g.addAttrib('prim', 'height', 'float');
  h.set(0, 10); h.set(1, 20); h.set(2, 30);
  return g;
}

/** GeoSet を返すだけのソースノードを都度登録する */
let _srcSeq = 0;
function sourceNode(geoFactory) {
  const type = `p5src_${++_srcSeq}`;
  reg.register({ type, inputs: [], params: {}, cook: () => geoFactory() });
  return type;
}

/* ============================================================
   extractPrims（分割ユーティリティ）
   ============================================================ */

test('extractPrims keeps in-piece point sharing and copies attributes', () => {
  const src = groupedInput();
  const piece = extractPrims(src, [0, 1]);       // 三角形2枚。point 2 を共有
  assert.equal(piece.numPrims, 2);
  assert.equal(piece.numPoints, 5);              // 6 ではなく 5（共有が保たれる）
  assert.equal(piece.prim.get('grp').get(0), 'a');
  assert.equal(piece.prim.get('height').get(1), 20);
  assert.deepEqual(piece.getP(0), [0, 0, 0]);
});

test('extractPrims copies detail attributes and closed flags', () => {
  const src = groupedInput();
  src.detail.add('site', 'string').set(0, 'higashi');
  const piece = extractPrims(src, [2]);
  assert.equal(piece.detail.get('site').get(0), 'higashi');
  assert.equal(piece.prim.get('closed').get(0), 1);
});

/* ============================================================
   prim モード
   ============================================================ */

test('foreach prim mode processes each primitive as its own piece', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 3, cols: 3 }, 'g1');     // 4 prims / 9 点（共有あり）
  g.add('foreach', { graph: liftByIterationBody(), mode: 'prim' }, 'fe1');
  g.connect('g1', 'fe1');
  const geo = g.cook('fe1');
  const fe = g.get('fe1');
  assert.equal(fe.error, null);
  assert.equal(geo.numPrims, 4);
  // ピース k は z=k に持ち上がっている
  const zs = new Set();
  for (let pi = 0; pi < geo.numPrims; pi++)
    for (const pt of geo.primPoints(pi)) zs.add(geo.getP(pt)[2]);
  assert.deepEqual([...zs].sort(), [0, 1, 2, 3]);
  assert.equal(fe._innerReport.iterations, 4);
});

test('foreach identity body preserves prims and per-prim geometry', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 3, cols: 3 }, 'g1');
  g.add('foreach', { graph: identityBody(), mode: 'prim' }, 'fe1');
  g.connect('g1', 'fe1');
  const src = g.cook('g1');
  const geo = g.cook('fe1');
  assert.equal(geo.numPrims, src.numPrims);
  assert.equal(geo.numVerts, src.numVerts);
  // 点はピース間で複製される（4 prim × 4 点）。位置は一致する
  assert.equal(geo.numPoints, 16);
  for (let pi = 0; pi < src.numPrims; pi++) {
    const a = src.primPoints(pi).map(p => src.getP(p));
    const b = geo.primPoints(pi).map(p => geo.getP(p));
    assert.deepEqual(b, a);
  }
});

/* ============================================================
   piece モード
   ============================================================ */

test('foreach piece mode groups prims by attribute value', () => {
  const type = sourceNode(groupedInput);
  const g = new Graph(reg);
  g.add(type, {}, 'src1');
  g.add('foreach', { graph: countBody(), mode: 'piece', attrib: 'grp' }, 'fe1');
  g.connect('src1', 'fe1');
  const geo = g.cook('fe1');
  assert.equal(g.get('fe1').error, null);
  assert.equal(g.get('fe1')._innerReport.iterations, 2);   // グループ a / b
  // グループ a の 2 枚は cnt=2、グループ b の 1 枚は cnt=1
  const cnt = geo.prim.get('cnt');
  const grp = geo.prim.get('grp');
  for (let pi = 0; pi < geo.numPrims; pi++)
    assert.equal(cnt.get(pi), grp.get(pi) === 'a' ? 2 : 1);
});

test('piece metadata is visible as detail attributes inside the body', () => {
  const body = new Graph(reg);
  body.add('subinput', { index: 0 }, 'si1');
  body.add('snippet', { class: 'detail', code: 's@tag = @piece; i@it = @iteration;' }, 's1');
  body.connect('si1', 's1');
  body.add('suboutput', {}, 'out1');
  body.connect('s1', 'out1');
  body.displayNode = 'out1';

  const type = sourceNode(groupedInput);
  const g = new Graph(reg);
  g.add(type, {}, 'src1');
  g.add('foreach', { graph: body.serialize(), mode: 'piece', attrib: 'grp' }, 'fe1');
  g.connect('src1', 'fe1');
  const geo = g.cook('fe1');
  assert.equal(g.get('fe1').error, null);
  // merge は detail を先勝ちで拾う → 最初のピース（grp='a', iteration=0）の値
  assert.equal(geo.detail.get('tag').get(0), 'a');
  assert.equal(geo.detail.get('it').get(0), 0);
  // 反復メタ情報そのものは結合結果に残らない
  assert.equal(geo.detail.get('iteration'), null);
  assert.equal(geo.detail.get('piece'), null);
});

test('@parent.value resolves to the piece key', () => {
  const body = new Graph(reg);
  body.add('subinput', { index: 0 }, 'si1');
  body.add('attribdelete', { class: 'prim', names: '@parent.value' }, 'd1');  // グループ名と同名の属性を消す
  body.connect('si1', 'd1');
  body.add('suboutput', {}, 'out1');
  body.connect('d1', 'out1');
  body.displayNode = 'out1';

  const type = sourceNode(() => {
    const s = groupedInput();
    s.addAttrib('prim', 'a', 'float');   // グループ 'a' の反復でだけ消される
    return s;
  });
  const g = new Graph(reg);
  g.add(type, {}, 'src1');
  g.add('foreach', { graph: body.serialize(), mode: 'piece', attrib: 'grp' }, 'fe1');
  g.connect('src1', 'fe1');
  const geo = g.cook('fe1');
  assert.equal(g.get('fe1').error, null);
  // グループ b の反復では属性 'b' が無い → 警告が持ち上がる
  assert.ok(g.get('fe1').warnings.some(w => w.includes('no prim attribute "b"')));
  // merge で復活するので消えはしないが、警告経路の検証としては十分
  assert.ok(geo.numPrims === 3);
});

/* ============================================================
   エラー
   ============================================================ */

test('body errors carry the iteration index and piece key', () => {
  const body = new Graph(reg);
  body.add('subinput', { index: 0 }, 'si1');
  body.add('boom', {}, 'b1');
  body.connect('si1', 'b1');
  body.add('suboutput', {}, 'out1');
  body.connect('b1', 'out1');
  body.displayNode = 'out1';

  const type = sourceNode(groupedInput);
  const g = new Graph(reg);
  g.add(type, {}, 'src1');
  g.add('foreach', { graph: body.serialize(), mode: 'piece', attrib: 'grp' }, 'fe1');
  g.connect('src1', 'fe1');
  const geo = g.cook('fe1');
  assert.equal(geo.numPoints, 0);
  const err = g.get('fe1').error;
  assert.ok(err.includes('iteration 0'));
  assert.ok(err.includes('piece "a"'));
  assert.ok(err.includes('intentional failure'));
});

test('piece mode without the grouping attribute is a node error', () => {
  const g = new Graph(reg);
  g.add('grid', {}, 'g1');
  g.add('foreach', { graph: identityBody(), mode: 'piece', attrib: 'nope' }, 'fe1');
  g.connect('g1', 'fe1');
  g.cook('fe1');
  assert.ok(g.get('fe1').error.includes('no prim attribute "nope"'));
});

test('input without primitives yields empty output and a warning, not an error', () => {
  const type = sourceNode(() => {
    const s = new GeoSet();
    s.addPoint(1, 2, 3);
    return s;
  });
  const g = new Graph(reg);
  g.add(type, {}, 'src1');
  g.add('foreach', { graph: identityBody(), mode: 'prim' }, 'fe1');
  g.connect('src1', 'fe1');
  const geo = g.cook('fe1');
  assert.equal(g.get('fe1').error, null);
  assert.equal(geo.numPoints, 0);
  assert.ok(g.get('fe1').warnings.some(w => w.includes('no primitives')));
});

/* ============================================================
   キャッシュと時間依存
   ============================================================ */

test('foreach output is cached; input change recooks', () => {
  const g = new Graph(reg);
  const grid = g.add('grid', { rows: 3, cols: 3 }, 'g1');
  g.add('foreach', { graph: identityBody(), mode: 'prim' }, 'fe1');
  g.connect('g1', 'fe1');
  g.cook('fe1');
  const before = g.cookCount;
  g.cook('fe1');
  assert.equal(g.cookCount, before);             // キャッシュヒット
  grid.setParam('rows', 4);
  const geo = g.cook('fe1');
  assert.equal(geo.numPrims, 6);
  assert.ok(g.cookCount > before);
});

test('static foreach ignores time; @Time in the body makes it time-dependent', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  g.add('foreach', { graph: identityBody(), mode: 'prim' }, 'fe1');
  g.connect('g1', 'fe1');
  assert.equal(g.isTimeDependent('fe1'), false);
  g.cook('fe1', { time: 0 });
  const before = g.cookCount;
  g.cook('fe1', { time: 1 });
  assert.equal(g.cookCount, before);

  const body = new Graph(reg);
  body.add('subinput', { index: 0 }, 'si1');
  body.add('snippet', { class: 'point', code: '@P.z = @Time;' }, 's1');
  body.connect('si1', 's1');
  body.add('suboutput', {}, 'out1');
  body.connect('s1', 'out1');
  body.displayNode = 'out1';
  const g2 = new Graph(reg);
  g2.add('grid', { rows: 2, cols: 2 }, 'g1');
  g2.add('foreach', { graph: body.serialize(), mode: 'prim' }, 'fe1');
  g2.connect('g1', 'fe1');
  assert.equal(g2.isTimeDependent('fe1'), true);
  const z0 = g2.cook('fe1', { time: 0 }).getP(0)[2];
  const z1 = g2.cook('fe1', { time: 0.5 }).getP(0)[2];
  assert.equal(z0, 0);
  assert.equal(z1, 0.5);
});

/* ============================================================
   昇格パラメータとの併用 / 直列化
   ============================================================ */

test('foreach promoted parameters mix with iteration metadata', () => {
  const body = new Graph(reg);
  body.add('subinput', { index: 0 }, 'si1');
  body.add('transform', { translate: '@parent.shift' }, 't1');
  body.connect('si1', 't1');
  body.add('suboutput', {}, 'out1');
  body.connect('t1', 'out1');
  body.displayNode = 'out1';

  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2 }, 'g1');
  const fe = g.add('foreach', {
    graph: body.serialize(), mode: 'prim',
    defs: { shift: { type: 'vec3', default: [0, 0, 4] } },
  }, 'fe1');
  g.connect('g1', 'fe1');
  assert.equal(g.cook('fe1').getP(0)[2], 4);
  fe.setParam('values', { shift: [0, 0, 6] });
  assert.equal(g.cook('fe1').getP(0)[2], 6);
});

test('graph with a foreach serialize / deserialize round-trips', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 3, cols: 3 }, 'g1');
  g.add('foreach', { graph: liftByIterationBody(), mode: 'prim' }, 'fe1');
  g.connect('g1', 'fe1');
  g.displayNode = 'fe1';
  const geo1 = g.cook('fe1');
  const g2 = Graph.deserialize(reg, JSON.parse(JSON.stringify(g.serialize())));
  const geo2 = g2.cook('fe1');
  assert.equal(geo2.numPoints, geo1.numPoints);
  assert.deepEqual(geo2.getP(geo2.numPoints - 1), geo1.getP(geo1.numPoints - 1));
});

/* ============================================================
   実データ — 棟別処理（P5 の本来の目的）
   ============================================================ */

test('foreach over real PLATEAU buildings by bid (棟別処理)', () => {
  const g = new Graph(reg);
  g.add('sitectx', { radius: 200 }, 'ctx');
  g.add('foreach', { graph: countBody(), mode: 'piece', attrib: 'bid' }, 'fe1');
  g.connect('ctx', 'fe1');
  const src = g.cook('ctx');
  const t0 = Date.now();
  const geo = g.cook('fe1');
  const ms = Date.now() - t0;
  const fe = g.get('fe1');
  assert.equal(fe.error, null);
  assert.equal(geo.numPrims, src.numPrims);      // プリミティブは失われない
  assert.ok(fe._innerReport.iterations > 50);    // 半径200mでも数十棟はある

  // 各棟のプリム数 = その棟の cnt 値（本体は棟単位で cook されている）
  const bid = geo.prim.get('bid');
  const cnt = geo.prim.get('cnt');
  const sizes = new Map();
  for (let pi = 0; pi < geo.numPrims; pi++)
    sizes.set(bid.get(pi), (sizes.get(bid.get(pi)) || 0) + 1);
  for (let pi = 0; pi < geo.numPrims; pi++)
    assert.equal(cnt.get(pi), sizes.get(bid.get(pi)));

  // 属性は保存される
  assert.equal(geo.prim.get('height') !== null, true);
  assert.equal(geo.prim.get('usage') !== null, true);
  // 性能の回帰検知（緩め）: 数百ミリ秒オーダーで終わること
  assert.ok(ms < 5000, `foreach over buildings took ${ms}ms`);
});
