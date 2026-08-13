/* ============================================================
   人流モデルの精緻化（§21）のテスト
   - demand モード: 需要ベースの流入（駅・外周 -> 会場、到着波）
   - 計画ペデストリアンデッキ（仮定線形）による経路比較
   - wander モードの後方互換
   ============================================================ */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { Graph } = require('../src/cook');
const { reg, DATA } = require('../src/site_nodes');

const VX = 55, VY = 65;   // アリーナ既定配置

function demandGraph(params = {}) {
  const g = new Graph(reg);
  g.add('roadagents', { mode: 'demand', count: 300, ...params }, 'a');
  return g;
}

function positions(geo) {
  const out = [];
  for (let i = 0; i < geo.numPoints; i++) out.push(geo.getP(i));
  return out;
}

/* ============================================================
   demand モードの基本性質
   ============================================================ */

test('demand agents are a pure function of time and reproducible', () => {
  const g = demandGraph();
  const p1 = positions(g.cook('a', { time: 400 }));
  g.invalidateAll();
  const p2 = positions(g.cook('a', { time: 400 }));
  assert.deepEqual(p1, p2);
  const p3 = positions(g.cook('a', { time: 900 }));
  assert.notDeepEqual(p1, p3, 'agents must actually move');
});

test('before the window everyone waits at origins; long after, everyone has arrived', () => {
  const g = demandGraph({ window: 600 });
  const early = g.cook('a', { time: 0 });
  const wait0 = early.detail.get('waiting').get(0);
  assert.ok(wait0 > 250, `most agents should still be waiting at t=0 (waiting=${wait0})`);

  const late = g.cook('a', { time: 100000 });
  assert.equal(late.detail.get('arrived').get(0), late.numPoints);
  // 到着した全員が会場の滞留半径（<= 5+18m + 会場ノードのずれ）に居る
  for (const [x, y] of positions(late)) {
    const d = Math.hypot(x - VX, y - VY);
    assert.ok(d < 60, `arrived agent too far from venue: ${d.toFixed(1)}m`);
  }
});

test('rail agents start at the stations, in the configured share', () => {
  const g = demandGraph({ count: 400, railShare: 0.6, higashiShare: 0.75, window: 600 });
  const geo = g.cook('a', { time: 0 });
  const aOrigin = geo.point.get('origin');
  const stations = DATA.landmarks.filter(l => l[3] === 'station')
    .map(([name, x, y]) => ({ name, x: x / 10, y: y / 10 }));
  let rail = 0, near = 0;
  for (let i = 0; i < geo.numPoints; i++) {
    const o = aOrigin.get(i);
    const st = stations.find(s => s.name === o);
    if (!st) continue;
    rail++;
    const p = geo.getP(i);
    // 出発待ちの鉄道客は駅の最寄りノードに居る（駅から 120m 以内）
    if (Math.hypot(p[0] - st.x, p[1] - st.y) < 120) near++;
  }
  assert.ok(rail / geo.numPoints > 0.45 && rail / geo.numPoints < 0.75,
    `rail share out of range: ${(rail / geo.numPoints).toFixed(2)}`);
  const wait = geo.detail.get('waiting').get(0);
  assert.ok(near > rail * 0.8, `waiting rail agents should be at their station (${near}/${rail}, waiting=${wait})`);
});

test('demand outputs demand metadata on detail', () => {
  const g = demandGraph({ count: 250, capacity: 10000 });
  const geo = g.cook('a', { time: 10 });
  assert.equal(geo.detail.get('capacity').get(0), 10000);
  assert.ok(Math.abs(geo.detail.get('personsPerAgent').get(0) - 40) < 0.1);
  assert.ok(geo.detail.get('meanRoute').get(0) > 100, 'mean route should be a few hundred meters');
  assert.equal(geo.detail.get('waiting').get(0) + geo.detail.get('walking').get(0) +
    geo.detail.get('arrived').get(0), geo.numPoints);
});

/* ============================================================
   計画デッキ（仮定線形）の効果比較 — §17.8 の「経路分散の比較」
   ============================================================ */

test('the planned deck shortens routes and captures a share of agents', () => {
  const base = demandGraph({ count: 400, deck: 0 }).cook('a', { time: 10 });
  const deck = demandGraph({ count: 400, deck: 1 }).cook('a', { time: 10 });

  assert.equal(base.detail.get('deckShare').get(0), 0);
  const share = deck.detail.get('deckShare').get(0);
  const m0 = base.detail.get('meanRoute').get(0);
  const m1 = deck.detail.get('meanRoute').get(0);
  assert.ok(share > 0.2, `deck should capture a meaningful share (got ${share.toFixed(2)})`);
  assert.ok(m1 < m0, `deck should shorten the mean route (${m1.toFixed(0)}m vs ${m0.toFixed(0)}m)`);
});

test('siteroads can display the assumed deck alignment', () => {
  const g = new Graph(reg);
  g.add('siteroads', { deck: 1 }, 'r');
  const geo = g.cook('r');
  const aPart = geo.prim.get('part');
  let decks = 0;
  for (let pi = 0; pi < geo.numPrims; pi++) if (aPart.get(pi) === 'deck') decks++;
  assert.equal(decks, 2);   // 東静岡駅・長沼駅の2本
  assert.ok(g.get('r').warnings.some(w => w.includes('assumption')));
});

/* ============================================================
   後方互換
   ============================================================ */

test('default mode is wander and behaves exactly as before', () => {
  const g1 = new Graph(reg);
  g1.add('roadagents', { count: 150, seed: 7 }, 'a');
  const g2 = new Graph(reg);
  g2.add('roadagents', { count: 150, seed: 7, mode: 'wander' }, 'a');
  assert.deepEqual(positions(g1.cook('a', { time: 5 })), positions(g2.cook('a', { time: 5 })));
});

test('unknown mode falls back to wander with a warning', () => {
  const g = new Graph(reg);
  g.add('roadagents', { count: 50, mode: 'typo' }, 'a');
  const geo = g.cook('a', { time: 1 });
  assert.equal(geo.numPoints, 50);
  assert.ok(g.get('a').warnings.some(w => w.includes('unknown mode')));
});
