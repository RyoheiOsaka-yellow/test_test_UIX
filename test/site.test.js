'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Graph } = require('../src/cook');
const { reg, decodeBuildings, decodeRoads, buildGraph, DATA } = require('../src/site_nodes');

/* ==================== 実データそのものの健全性 ==================== */

test('baked asset carries the expected shape', () => {
  assert.equal(DATA.v, 1);
  assert.ok(DATA.buildings.length > 900, `only ${DATA.buildings.length} buildings`);
  assert.ok(DATA.roads.length > 300);
  assert.match(DATA.source, /PLATEAU/);
  assert.ok(Math.abs(DATA.origin.lat - 34.9858) < 1e-6);
});

test('delta decoding reproduces plausible footprints', () => {
  const b = decodeBuildings();
  const area = (r) => {
    const n = r.length;
    let s = 0;
    for (let i = 0; i < n; i++) s += r[i][0] * r[(i + 1) % n][1] - r[(i + 1) % n][0] * r[i][1];
    return Math.abs(s) / 2;
  };
  const A = b.map(x => area(x.ring)).sort((p, q) => p - q);
  const med = A[A.length >> 1];
  assert.ok(med > 30 && med < 200, `median footprint ${med.toFixed(1)}m2 is implausible`);
  assert.equal(b.filter(x => x.ring.length < 3).length, 0);
  // 原点まわり600mに収まっていること
  const far = b.filter(x => {
    const c = x.ring.reduce((a, p) => [a[0] + p[0] / x.ring.length, a[1] + p[1] / x.ring.length], [0, 0]);
    return Math.hypot(c[0], c[1]) > 610;
  });
  assert.equal(far.length, 0, `${far.length} buildings outside the extraction radius`);
});

test('landmark positions agree with their real-world separations', () => {
  const L = Object.fromEntries(DATA.landmarks.map(l => [l[0], [l[1] / 10, l[2] / 10]]));
  const d = (a, b) => Math.hypot(L[a][0] - L[b][0], L[a][1] - L[b][1]);
  // JR東静岡 <-> 静鉄長沼 は実測でおよそ 520m
  const stations = d('JR東静岡駅', '静鉄長沼駅');
  assert.ok(Math.abs(stations - 524) < 40, `station separation ${stations.toFixed(0)}m`);
  // グランシップは駅の東側
  assert.ok(L['グランシップ'][0] > L['JR東静岡駅'][0]);
});

/* ==================== sitectx ==================== */

test('sitectx extrudes real footprints into closed prisms', () => {
  const g = new Graph(reg);
  g.add('sitectx', { radius: 600 }, 'ctx');
  const out = g.cook('ctx');
  assert.ok(out.numPrims > 5000, `only ${out.numPrims} prims`);
  assert.equal(out.detail.get('buildings').get(0), decodeBuildings().length);
  for (const a of ['height', 'usage', 'storeys', 'year', 'part', 'mhDelta'])
    assert.ok(out.prim.has(a), `missing prim attribute ${a}`);
  // 屋根1枚 + 壁n枚 = リング長+1 の関係
  const roofs = [];
  for (let i = 0; i < out.numPrims; i++) if (out.prim.get('part').get(i) === 'roof') roofs.push(i);
  assert.equal(roofs.length, decodeBuildings().length);
});

test('sitectx radius filter reduces the output and warns', () => {
  const g = new Graph(reg);
  g.add('sitectx', { radius: 200 }, 'ctx');
  const small = g.cook('ctx').numPrims;
  g.get('ctx').setParam('radius', 600);
  const big = g.cook('ctx').numPrims;
  assert.ok(small < big / 2, `${small} vs ${big}`);
  g.get('ctx').setParam('radius', 200);
  g.cook('ctx');
  assert.ok(g.get('ctx').warnings.some(w => /outside radius/.test(w)));
});

test('measuredHeight disagrees with geometry for split structures', () => {
  // 実データの品質問題: 1つの構造物が複数フィーチャに分割され、
  // すべてが同じ measuredHeight を持つため、mh で押し出すと形が壊れる。
  const g = new Graph(reg);
  g.add('sitectx', { radius: 600 }, 'ctx');
  const geo = g.cook('ctx');
  const d = geo.prim.get('mhDelta');
  let worst = 0, over5 = 0;
  const seen = new Set();
  for (let i = 0; i < geo.numPrims; i++) {
    if (geo.prim.get('part').get(i) !== 'roof') continue;
    const v = d.get(i);
    worst = Math.max(worst, v);
    if (v > 5) over5++;
    seen.add(i);
  }
  assert.ok(worst > 10, `expected a large mh discrepancy, got ${worst.toFixed(1)}m`);
  assert.ok(over5 > 0, 'expected at least one building off by more than 5m');
});

test('switching sitectx to measuredHeight changes the massing', () => {
  const g = new Graph(reg);
  g.add('sitectx', { radius: 600, useMh: 0 }, 'ctx');
  const a = g.cook('ctx').bounds().max[2];
  g.get('ctx').setParam('useMh', 1);
  const b = g.cook('ctx').bounds().max[2];
  assert.notEqual(Math.round(a), Math.round(b), 'useMh must change the result');
});

/* ==================== siteroads / roadagents ==================== */

test('siteroads emits open primitives only', () => {
  const g = new Graph(reg);
  g.add('siteroads', {}, 'r');
  const out = g.cook('r');
  assert.ok(out.numPrims > 250);
  for (let i = 0; i < out.numPrims; i++)
    assert.equal(out.prim.get('closed').get(i), 0, 'roads must not be closed polygons');
});

test('the walkable graph is connected enough to route on', () => {
  const { pos, adj } = buildGraph();
  assert.ok(pos.length > 600, `only ${pos.length} graph nodes`);
  const deg = adj.map(a => a.length);
  assert.equal(deg.filter(d => d === 0).length, 0, 'isolated nodes should not exist');
  const avg = deg.reduce((a, b) => a + b, 0) / deg.length;
  assert.ok(avg >= 1.6, `average degree ${avg.toFixed(2)} is too low to walk`);
});

test('roadagents produces the requested number of agents on the network', () => {
  const g = new Graph(reg);
  g.add('roadagents', { count: 400, attract: 0.5 }, 'a');
  const out = g.cook('a', { time: 0 });
  assert.equal(out.numPoints, 400);
  assert.equal(out.numPrims, 0);
  assert.ok(out.point.has('speed') && out.point.has('toVenue'));
  const bb = out.bounds();
  assert.ok(bb.max[0] - bb.min[0] > 200, 'agents should be spread across the network');
});

test('agent positions are a pure function of time and reproducible', () => {
  const g = new Graph(reg);
  g.add('roadagents', { count: 200 }, 'a');
  const p1 = g.cook('a', { time: 3 }).getP(7);
  g.invalidateAll();
  const p2 = g.cook('a', { time: 3 }).getP(7);
  assert.deepEqual(p1, p2, 'same time must give the same position after cache loss');
  const p3 = g.cook('a', { time: 3.5 }).getP(7);
  assert.notDeepEqual(p1, p3, 'agents must actually move');
});

test('attract biases agents towards the venue', () => {
  const mean = (attract) => {
    const g = new Graph(reg);
    g.add('roadagents', { count: 500, attract, seed: 11 }, 'a');
    const o = g.cook('a', { time: 20 });
    let s = 0;
    for (let i = 0; i < o.numPoints; i++) s += o.point.get('toVenue').get(i);
    return s / o.numPoints;
  };
  const wander = mean(0), drawn = mean(0.9);
  assert.ok(drawn < wander, `attract should shorten mean distance: ${drawn.toFixed(1)} vs ${wander.toFixed(1)}`);
});

test('heatmap aggregates real agents into cells', () => {
  const g = new Graph(reg);
  g.add('roadagents', { count: 800, attract: 0.8 }, 'a');
  g.add('heatmap', { cell: 25, extent: 600 }, 'h');
  g.connect('a', 'h', 0);
  const out = g.cook('h', { time: 12 });
  assert.ok(out.numPrims > 20, `only ${out.numPrims} cells`);
  assert.ok(out.prim.has('density'));
  assert.ok(g.isTimeDependent('h'), 'heatmap downstream of agents must be time dependent');
});

/* ==================== arena ==================== */

test('arena massing matches the published figures', () => {
  const g = new Graph(reg);
  g.add('arena', {}, 'a');
  const out = g.cook('a');
  const bb = out.bounds();
  assert.ok(Math.abs(bb.max[2] - 30.9) < 0.2, `height ${bb.max[2].toFixed(1)}m, expected ~30.9m`);
  const fp = out.detail.get('footprint').get(0);
  assert.ok(Math.abs(fp - 16900) / 16900 < 0.05, `footprint ${fp.toFixed(0)}m2, expected ~16,900m2`);
});

test('arena reports clashes with existing buildings instead of ignoring them', () => {
  const g = new Graph(reg);
  g.add('arena', {}, 'a');
  const clean = g.cook('a');
  assert.equal(clean.detail.get('clashes').get(0), 0, 'default placement should be clear');
  assert.equal(g.get('a').warnings.length, 0);

  g.get('a').setParam('cx', -80);
  g.get('a').setParam('cy', -60);
  const bad = g.cook('a');
  assert.ok(bad.detail.get('clashes').get(0) > 0, 'a placement over existing blocks must be reported');
  assert.match(g.get('a').warnings[0], /existing buildings inside the footprint/);
});
