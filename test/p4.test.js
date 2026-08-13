/* ============================================================
   P4 — サブネット + パラメータ昇格 + XDA のテスト
   SPEC.md §18 の検証。
   ============================================================ */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { Graph } = require('../src/cook');
const { reg, registerAsset, assetFromSubnet } = require('../src/nodes');

/* ---------- ヘルパ ---------- */

/** grid -> transform(translate='@parent.move') -> suboutput の内側グラフ */
function innerMoveGraph() {
  const g = new Graph(reg);
  g.add('grid', { rows: 2, cols: 2, size: [10, 10] }, 'g1');
  g.add('transform', { translate: '@parent.move' }, 't1');
  g.connect('g1', 't1');
  g.add('suboutput', {}, 'out1');
  g.connect('t1', 'out1');
  g.displayNode = 'out1';
  return g.serialize();
}

/** subinput -> transform(translate='@parent.move') -> suboutput の内側グラフ */
function innerPassthroughGraph() {
  const g = new Graph(reg);
  g.add('subinput', { index: 0 }, 'si1');
  g.add('transform', { translate: '@parent.move' }, 't1');
  g.connect('si1', 't1');
  g.add('suboutput', {}, 'out1');
  g.connect('t1', 'out1');
  g.displayNode = 'out1';
  return g.serialize();
}

function zOf(geo, i = 0) { return geo.point.get('P').get(i)[2]; }

/* ============================================================
   サブネットの基本
   ============================================================ */

test('subnet cooks its inner graph and resolves @parent references', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  const geo = g.cook('sn1');
  assert.equal(sn.error, null);
  assert.equal(geo.numPoints, 4);
  assert.equal(zOf(geo), 5);        // 既定値 [0,0,5] が内側 transform に届いている
});

test('subnet result is cached (second cook is free)', () => {
  const g = new Graph(reg);
  g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  g.cook('sn1');
  const before = g.cookCount;
  g.cook('sn1');
  assert.equal(g.cookCount, before);
});

test('promoted value change recooks only the nodes that reference it', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  g.cook('sn1');
  const inner = sn._inner;
  const gridSerial = inner.get('g1').stats.serial;

  sn.setParam('values', { move: [0, 0, 9] });
  const geo = g.cook('sn1');
  assert.equal(zOf(geo), 9);
  // '@parent.move' を参照する t1 は再 cook、参照しない g1 はキャッシュのまま
  assert.equal(inner.get('g1').stats.serial, gridSerial);
  assert.ok(inner.get('t1').stats.serial > gridSerial);
});

test('subnet recook with unchanged promoted values hits the inner cache', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  g.cook('sn1');
  const inner = sn._inner;
  const before = inner.cookCount;

  g.invalidate('sn1');            // 外側だけ無効化。昇格値は変わっていない
  g.cook('sn1');
  assert.equal(inner.cookCount, before);   // 内側は全ノードキャッシュ
});

/* ============================================================
   サブネット入力
   ============================================================ */

test('subinput carries outer geometry into the inner graph', () => {
  const g = new Graph(reg);
  g.add('grid', { rows: 3, cols: 3 }, 'src1');
  g.add('subnet', {
    graph: innerPassthroughGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 2] } },
  }, 'sn1');
  g.connect('src1', 'sn1', 0);
  const geo = g.cook('sn1');
  assert.equal(geo.numPoints, 9);
  assert.equal(zOf(geo), 2);
});

test('upstream change flows through the subnet; unchanged input stays cached', () => {
  const g = new Graph(reg);
  const src = g.add('grid', { rows: 3, cols: 3 }, 'src1');
  const sn = g.add('subnet', {
    graph: innerPassthroughGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 2] } },
  }, 'sn1');
  g.connect('src1', 'sn1', 0);
  g.cook('sn1');
  const inner = sn._inner;
  const cachedCount = inner.cookCount;

  // 外側だけ無効化 → 入力ジオメトリの実体は同じ → 内側はキャッシュ
  g.invalidate('sn1');
  g.cook('sn1');
  assert.equal(inner.cookCount, cachedCount);

  // 上流を変更 → 新しいジオメトリ実体 → subinput から下流が再 cook
  src.setParam('rows', 4);
  const geo = g.cook('sn1');
  assert.equal(geo.numPoints, 12);
  assert.ok(inner.cookCount > cachedCount);
});

test('unconnected subinput yields empty geometry and a lifted warning', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerPassthroughGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 2] } },
  }, 'sn1');
  const geo = g.cook('sn1');
  assert.equal(geo.numPoints, 0);
  assert.ok(sn.warnings.some(w => w.includes('[si1]') && w.includes('not connected')));
});

/* ============================================================
   エラー
   ============================================================ */

test('inner errors surface on the subnet node, other graphs unaffected', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerMoveGraph(),
    defs: {},                       // move を昇格し忘れた
  }, 'sn1');
  const geo = g.cook('sn1');
  assert.equal(geo.numPoints, 0);
  assert.ok(sn.error.includes('inner error in out1'));
  assert.ok(sn.error.includes('@parent.move'));
});

test('@parent reference outside a subnet is a node error, not a crash', () => {
  const g = new Graph(reg);
  g.add('grid', {}, 'g1');
  const t = g.add('transform', { translate: '@parent.move' }, 't1');
  g.connect('g1', 't1');
  const geo = g.cook('t1');
  assert.equal(geo.numPoints, 0);
  assert.ok(t.error.includes('no parent parameter context'));
});

test('fixing the promoted parameter clears the inner error', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', { graph: innerMoveGraph(), defs: {} }, 'sn1');
  g.cook('sn1');
  assert.ok(sn.error);
  sn.setParam('defs', { move: { type: 'vec3', default: [0, 0, 3] } });
  const geo = g.cook('sn1');
  assert.equal(sn.error, null);
  assert.equal(zOf(geo), 3);
});

/* ============================================================
   時間依存の境界越え
   ============================================================ */

test('subnet with a time-dependent inner node is itself time-dependent', () => {
  const inner = new Graph(reg);
  inner.add('grid', { rows: 2, cols: 2 }, 'g1');
  inner.add('oscillate', { amp: 1, freq: 1 }, 'o1');
  inner.connect('g1', 'o1');
  inner.add('suboutput', {}, 'out1');
  inner.connect('o1', 'out1');
  inner.displayNode = 'out1';

  const g = new Graph(reg);
  const sn = g.add('subnet', { graph: inner.serialize() }, 'sn1');
  assert.equal(g.isTimeDependent('sn1'), true);

  const z0 = zOf(g.cook('sn1', { time: 0 }));
  const z1 = zOf(g.cook('sn1', { time: 0.25 }));
  assert.notEqual(z0, z1);
  // 時刻を変えても、時間依存でない内側の g1 はキャッシュのまま
  const gridSerial = sn._inner.get('g1').stats.serial;
  g.cook('sn1', { time: 0.5 });
  assert.equal(sn._inner.get('g1').stats.serial, gridSerial);
});

test('static subnet ignores time changes entirely', () => {
  const g = new Graph(reg);
  g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  assert.equal(g.isTimeDependent('sn1'), false);
  g.cook('sn1', { time: 0 });
  const before = g.cookCount;
  g.cook('sn1', { time: 1 });
  assert.equal(g.cookCount, before);
});

/* ============================================================
   入れ子サブネット
   ============================================================ */

test('nested subnets chain @parent references through values', () => {
  // 内側の内側: '@parent.move' を参照する transform
  // 中間サブネット: values.move = '@parent.lift' で外側へ委譲
  const mid = new Graph(reg);
  mid.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 0] } },
    values: { move: '@parent.lift' },
  }, 'snIn');
  mid.add('suboutput', {}, 'out1');
  mid.connect('snIn', 'out1');
  mid.displayNode = 'out1';

  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: mid.serialize(),
    defs: { lift: { type: 'vec3', default: [0, 0, 7] } },
  }, 'sn1');
  assert.equal(zOf(g.cook('sn1')), 7);

  sn.setParam('values', { lift: [0, 0, 11] });
  assert.equal(zOf(g.cook('sn1')), 11);
});

/* ============================================================
   直列化
   ============================================================ */

test('graph with a subnet serialize / deserialize round-trips', () => {
  const g = new Graph(reg);
  g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
    values: { move: [0, 0, 8] },
  }, 'sn1');
  g.displayNode = 'sn1';
  const geo1 = g.cook('sn1');

  const g2 = Graph.deserialize(reg, JSON.parse(JSON.stringify(g.serialize())));
  const geo2 = g2.cook('sn1');
  assert.equal(geo2.numPoints, geo1.numPoints);
  assert.equal(zOf(geo2), zOf(geo1));
  assert.equal(zOf(geo2), 8);
});

/* ============================================================
   XDA — XBUILD アセット
   ============================================================ */

test('assetFromSubnet publishes a subnet; the asset cooks like the original', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
    values: { move: [0, 0, 6] },          // 作者が調整した現在値
  }, 'sn1');
  const asset = assetFromSubnet(sn, { name: 'p4test_lift', version: '1.0.0', label: 'Lift Kit' });
  assert.equal(asset.xda, 1);
  assert.equal(asset.params.move.default[2], 6);   // 現在値が既定値として焼き付く

  registerAsset(reg, asset);
  const g2 = new Graph(reg);
  g2.add('p4test_lift', {}, 'a1');
  assert.equal(zOf(g2.cook('a1')), 6);             // 既定値で cook

  const g3 = new Graph(reg);
  g3.add('p4test_lift', { move: [0, 0, 4] }, 'a2');
  assert.equal(zOf(g3.cook('a2')), 4);             // 上書きも効く
});

test('asset instances have independent inner caches', () => {
  const g = new Graph(reg);
  const a = g.add('p4test_lift', { move: [0, 0, 1] }, 'a1');
  const b = g.add('p4test_lift', { move: [0, 0, 2] }, 'b1');
  assert.equal(zOf(g.cook('a1')), 1);
  assert.equal(zOf(g.cook('b1')), 2);
  assert.notEqual(a._inner, b._inner);
  // a のパラメータ変更は b に波及しない
  const bSerial = b._inner.get('t1').stats.serial;
  a.setParam('move', [0, 0, 3]);
  assert.equal(zOf(g.cook('a1')), 3);
  assert.equal(zOf(g.cook('b1')), 2);
  assert.equal(b._inner.get('t1').stats.serial, bSerial);
});

test('asset with subnet inputs passes geometry through', () => {
  const g = new Graph(reg);
  const sn = g.add('subnet', {
    graph: innerPassthroughGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 2] } },
  }, 'sn1');
  registerAsset(reg, assetFromSubnet(sn, { name: 'p4test_pass', version: '1.0.0' }));

  const g2 = new Graph(reg);
  g2.add('grid', { rows: 3, cols: 3 }, 'src1');
  g2.add('p4test_pass', {}, 'a1');
  g2.connect('src1', 'a1', 0);
  const geo = g2.cook('a1');
  assert.equal(geo.numPoints, 9);
  assert.equal(zOf(geo), 2);
});

test('catalog lists assets with their version', () => {
  const entry = reg.catalog().find(e => e.type === 'p4test_lift');
  assert.ok(entry);
  assert.deepEqual(entry.asset, { name: 'p4test_lift', version: '1.0.0' });
  assert.ok(!('_xdaVersion' in entry.params) || entry.params._xdaVersion); // 内部パラメータは存在してもよい
});

test('registerAsset validates format, version, and graph', () => {
  assert.throws(() => registerAsset(reg, { xda: 2, name: 'x', version: '1.0.0', graph: { nodes: [] } }),
    /unsupported XDA format/);
  assert.throws(() => registerAsset(reg, { xda: 1, name: 'x', version: 'v1', graph: { nodes: [] } }),
    /MAJOR\.MINOR\.PATCH/);
  assert.throws(() => registerAsset(reg, { xda: 1, name: 'x', version: '1.0.0' }),
    /graph is required/);
  assert.throws(() => registerAsset(reg, {
    xda: 1, name: 'x', version: '1.0.0', graph: { nodes: [] },
    params: { _bad: { type: 'float', default: 0 } },
  }), /must not start with "_"/);
});

test('old asset versions migrate on load and are re-stamped', () => {
  // v1.0.0: パラメータ名 move / v2.0.0: shift に改名、migrate で吸収
  const inner = new Graph(reg);
  inner.add('grid', { rows: 2, cols: 2 }, 'g1');
  inner.add('transform', { translate: '@parent.shift' }, 't1');
  inner.connect('g1', 't1');
  inner.add('suboutput', {}, 'out1');
  inner.connect('t1', 'out1');
  inner.displayNode = 'out1';

  registerAsset(reg, {
    xda: 1, name: 'p4test_mig', version: '2.0.0',
    params: { shift: { type: 'vec3', default: [0, 0, 0] } },
    graph: inner.serialize(),
    migrate(p, from) {
      if (from.startsWith('1.')) {
        if ('move' in p && !('shift' in p)) { p.shift = p.move; delete p.move; }
      }
      return p;
    },
  });

  // v1.0.0 時代に保存されたグラフを読み込む
  const saved = {
    displayNode: 'a1',
    nodes: [{ id: 'a1', type: 'p4test_mig', params: { move: [0, 0, 7], _xdaVersion: '1.0.0' }, inputs: [null] }],
  };
  const g = Graph.deserialize(reg, saved);
  const node = g.get('a1');
  assert.equal(node.params._xdaVersion, '2.0.0');   // 現行バージョンが刻み直される
  assert.deepEqual(node.params.shift, [0, 0, 7]);   // 旧パラメータが移行されている
  assert.equal(zOf(g.cook('a1')), 7);
  // 保存し直すと現行形式になる
  const re = g.serialize().nodes[0];
  assert.equal(re.params._xdaVersion, '2.0.0');
  assert.ok(!('move' in re.params));
});

/* ============================================================
   レポート（AI 自己修正ループ用）
   ============================================================ */

test('report nests the inner report of a subnet', () => {
  const g = new Graph(reg);
  g.add('subnet', {
    graph: innerMoveGraph(),
    defs: { move: { type: 'vec3', default: [0, 0, 5] } },
  }, 'sn1');
  g.displayNode = 'sn1';
  g.cookDisplay();
  const rep = g.report();
  assert.ok(rep.sn1.inner);
  assert.equal(rep.sn1.inner.t1.type, 'transform');
  assert.equal(rep.sn1.inner.g1.points, 4);
});
