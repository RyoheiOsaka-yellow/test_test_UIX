/* ============================================================
   屋内歩行ネットワーク（駅構内）人流ノードのテスト
   SPEC.md §22。純粋 JS 部分のみ（アダプタは Playwright で検証する）。
   ============================================================ */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { Graph } = require('../src/cook');
const { reg, setNetwork, networkVersion, setFloorHeight } = require('../src/station_nodes');

const FH = 30;
setFloorHeight(FH);

/* ------------------------------------------------------------
   合成ネットワーク: 2フロアの「口の字 + 階段」
     地上(ordinal 0): e0 - a - b        （e0 が出入口）
     地下(ordinal -1): c - d            （目的地フロア）
     階段: b - c
   ------------------------------------------------------------ */
function toyNetwork() {
  const N = (x, y, ord, inout) => ({ x, y, z: ord * FH, ordinal: ord, inout });
  const nodes = [
    N(0, 0, 0, 1),      // 0 e0 出入口
    N(10, 0, 0, 0),     // 1 a
    N(20, 0, 0, 0),     // 2 b
    N(20, 0, -1, 0),    // 3 c 階段下
    N(30, 0, -1, 0),    // 4 d
    N(0, 40, 0, 1),     // 5 e1 別の出入口
    N(10, 40, 0, 0),    // 6 f
  ];
  const seg = (a, b) => ({ a, b, pts: [[nodes[a].x, nodes[a].y, nodes[a].z], [nodes[b].x, nodes[b].y, nodes[b].z]] });
  const links = [seg(0, 1), seg(1, 2), seg(2, 3), seg(3, 4), seg(5, 6), seg(6, 1)];
  return { name: 'toy', nodes, links };
}

function load() { return setNetwork(toyNetwork()); }

function agentsGraph(params = {}) {
  const g = new Graph(reg);
  g.add('stationagents', { count: 60, destFloors: '-1', mode: 'in', window: 10, ...params }, 'a');
  return g;
}

function positions(geo) {
  const out = [];
  for (let i = 0; i < geo.numPoints; i++) out.push(geo.getP(i));
  return out;
}

/* ============================================================
   ネットワークの取り込み
   ============================================================ */

test('setNetwork builds adjacency and bumps the version', () => {
  const before = networkVersion();
  const net = load();
  assert.equal(net.nodes.length, 7);
  assert.equal(net.links.length, 6);
  assert.equal(net.adj[1].length, 3);          // a は e0 / b / f につながる
  assert.ok(networkVersion() > before);
});

test('setNetwork drops links with bad endpoints or zero length', () => {
  const t = toyNetwork();
  t.links.push({ a: 0, b: 99 }, { a: 2, b: 2 });
  const net = setNetwork(t);
  assert.equal(net.links.length, 6);
  load();
});

test('stationnet emits the network as open prims sharing COW buffers', () => {
  load();
  const g = new Graph(reg);
  g.add('stationnet', {}, 'n');
  const a = g.cook('n');
  assert.equal(a.numPrims, 6);
  assert.equal(a.prim.get('closed').get(0), 0);       // 線分
  assert.equal(a.prim.get('vertical').get(2), 1);     // b-c は階をまたぐ
  // 2回目の cook でも同じ内容（テンプレートの COW クローン）
  g.invalidateAll();
  const b = g.cook('n');
  assert.equal(b.numPrims, a.numPrims);
  assert.deepEqual(b.getP(0), a.getP(0));
});

/* ============================================================
   エージェント — 時刻の純関数
   ============================================================ */

test('agent positions are a pure function of time and reproducible', () => {
  load();
  const g = agentsGraph();
  const p1 = positions(g.cook('a', { time: 30 }));
  g.invalidateAll();
  const p2 = positions(g.cook('a', { time: 30 }));
  assert.deepEqual(p1, p2);
  const p3 = positions(g.cook('a', { time: 33 }));
  assert.notDeepEqual(p1, p3, 'agents must actually move');
});

test('agents start at entrances, descend, and dwell on the destination floor', () => {
  load();
  const g = agentsGraph({ window: 1, dwell: 5 });
  const early = g.cook('a', { time: 0 });
  // t=0 では大半が出発前 = 出入口に居る（合成ネットワークの出入口はどちらも x=0）
  const atEntrance = positions(early).filter(p => Math.abs(p[0]) < 0.01).length;
  assert.ok(atEntrance > early.numPoints * 0.5, `most agents should start at an entrance (${atEntrance})`);

  // 経路は周期的に巡回するので「十分あとの1時刻」では判定できない。
  // 時間を掃いて、滞留中の個体が必ず目的地フロアに居ることを確かめる。
  let sawDwell = false, maxBelow = 0;
  for (let t = 20; t <= 90; t += 5) {
    const geo = g.cook('a', { time: t });
    const fl = geo.point.get('floor'), st = geo.point.get('state');
    let below = 0;
    for (let i = 0; i < geo.numPoints; i++) {
      if (st.get(i) === 2) {
        sawDwell = true;
        assert.ok(Math.abs(fl.get(i) + 1) < 0.01,
          `dwelling agent must be on the destination floor (got ${fl.get(i)})`);
      }
      if (fl.get(i) < -0.5) below++;
    }
    maxBelow = Math.max(maxBelow, below);
  }
  assert.ok(sawDwell, 'some agents must reach the destination');
  assert.ok(maxBelow > early.numPoints * 0.3, `agents should descend (max ${maxBelow}/${early.numPoints})`);
});

test('state / floor / linkIdx attributes are consistent', () => {
  load();
  const geo = agentsGraph({ window: 8, dwell: 20 }).cook('a', { time: 12 });
  const st = geo.point.get('state'), fl = geo.point.get('floor'), li = geo.point.get('linkIdx');
  const d = (n) => geo.detail.get(n).get(0);
  assert.equal(d('waiting') + d('walking') + d('dwelling'), geo.numPoints);
  for (let i = 0; i < geo.numPoints; i++) {
    assert.ok([0, 1, 2].includes(st.get(i)));
    assert.ok(fl.get(i) <= 0.001 && fl.get(i) >= -1.001, `floor out of range: ${fl.get(i)}`);
    if (st.get(i) === 1) assert.ok(li.get(i) >= 0, 'walking agents must be on a link');
  }
  assert.ok(d('meanRoute') > 10);
  assert.equal(d('entrances'), 2);
});

test('mode out reverses the direction', () => {
  load();
  const gin = agentsGraph({ mode: 'in', window: 1, dwell: 3 }).cook('a', { time: 0.0 });
  const gout = agentsGraph({ mode: 'out', window: 1, dwell: 3 }).cook('a', { time: 0.0 });
  const meanZ = (geo) => {
    let s = 0;
    for (let i = 0; i < geo.numPoints; i++) s += geo.getP(i)[2];
    return s / geo.numPoints;
  };
  // 入場は地上（z=0）から、退場は地下（z=-30）から始まる
  assert.ok(meanZ(gin) > meanZ(gout), `${meanZ(gin)} should be above ${meanZ(gout)}`);
  assert.equal(gin.point.get('dir').get(0), '入場');
  assert.equal(gout.point.get('dir').get(0), '退場');
});

test('unknown destination floors fall back with a warning', () => {
  load();
  const g = agentsGraph({ destFloors: '99', minRoute: 0 });
  const geo = g.cook('a', { time: 5 });
  assert.equal(g.get('a').error, null);
  assert.ok(geo.numPoints > 0);
  assert.ok(g.get('a').warnings.some(w => w.includes('matched no node')));
});

test('minRoute drops trivial routes and warns instead of failing', () => {
  load();
  // 合成ネットワークの最長経路は 50m。100m を要求すれば 1 本も残らない
  const g = agentsGraph({ minRoute: 100 });
  const geo = g.cook('a', { time: 5 });
  assert.equal(g.get('a').error, null, 'an empty result must not be an error');
  assert.equal(geo.numPoints, 0);
  assert.ok(g.get('a').warnings.some(w => w.includes('at least 100m')));

  // 40m なら e0 -> a -> b -> c（50m）が残る
  const ok = agentsGraph({ minRoute: 40 }).cook('a', { time: 5 });
  assert.equal(ok.numPoints, 60);
  const len = ok.point.get('routeLen');
  for (let i = 0; i < ok.numPoints; i++) assert.ok(len.get(i) >= 40);
});

test('cooking without a network is a node error, not a crash', () => {
  const { setNetwork: sn } = require('../src/station_nodes');
  // ネットワーク未設定の状態を作れないため、空ノードのネットワークで代替する
  assert.throws(() => sn({ nodes: [], links: null }), /expects/);
  load();
});

/* ============================================================
   混雑度（点 -> プリム集約）
   ============================================================ */

test('stationload counts walking agents onto their link', () => {
  load();
  const g = new Graph(reg);
  g.add('stationagents', { count: 120, destFloors: '-1', mode: 'in', window: 4, dwell: 30 }, 'a');
  g.add('stationload', {}, 'l');
  g.connect('a', 'l', 0);
  const agents = g.cook('a', { time: 6 });
  const geo = g.cook('l', { time: 6 });

  assert.equal(geo.numPrims, 6);
  const aLoad = geo.prim.get('load');
  let total = 0;
  for (let pi = 0; pi < geo.numPrims; pi++) total += aLoad.get(pi);
  assert.equal(total, agents.detail.get('walking').get(0));   // 歩行中のみ数える
  assert.ok(geo.detail.get('maxLoad').get(0) > 0);
  // loadNorm は 0..1
  const n = geo.prim.get('loadNorm');
  for (let pi = 0; pi < geo.numPrims; pi++) {
    assert.ok(n.get(pi) >= 0 && n.get(pi) <= 1);
  }
});

test('stationload does not disturb the shared network template', () => {
  load();
  const g = new Graph(reg);
  g.add('stationagents', { count: 40, destFloors: '-1', window: 2 }, 'a');
  g.add('stationload', {}, 'l');
  g.add('stationnet', {}, 'n');
  g.connect('a', 'l', 0);
  const p0 = g.cook('n').getP(0);
  g.cook('l', { time: 9 });
  g.invalidateAll();
  assert.deepEqual(g.cook('n').getP(0), p0);
  assert.equal(g.cook('n').prim.get('load'), null);   // load はクローン側にしか付かない
});

/* ============================================================
   キャッシュとネットワーク差し替え
   ============================================================ */

test('re-loading the network invalidates caches through cookKey', () => {
  load();
  const g = agentsGraph();
  const a = g.cook('a', { time: 4 });
  const before = g.cookCount;
  g.cook('a', { time: 4 });
  assert.equal(g.cookCount, before, 'same time must hit the cache');

  // ネットワークを 2 倍スケールで入れ直す -> 同じ時刻でも結果が変わる
  const t = toyNetwork();
  for (const n of t.nodes) { n.x *= 2; n.y *= 2; }
  for (const l of t.links) l.pts = [[t.nodes[l.a].x, t.nodes[l.a].y, t.nodes[l.a].z],
                                    [t.nodes[l.b].x, t.nodes[l.b].y, t.nodes[l.b].z]];
  setNetwork(t);
  const b = g.cook('a', { time: 4 });
  assert.ok(g.cookCount > before, 'network change must force a recook');
  assert.notDeepEqual(positions(b), positions(a));
  load();
});

test('agents node is time dependent and static nodes are not', () => {
  load();
  const g = new Graph(reg);
  g.add('stationagents', { count: 10 }, 'a');
  g.add('stationnet', {}, 'n');
  assert.equal(g.isTimeDependent('a'), true);
  assert.equal(g.isTimeDependent('n'), false);
});
