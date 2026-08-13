/* ============================================================
   XBUILD SOP Layer — station_nodes.js
   屋内歩行空間ネットワーク（駅構内）の人流ノード群。
   依存なし（DOM / three.js を参照しない純粋 JS）。SPEC.md §22。

   ホスト（新宿駅構内図 3D 等）が持つ歩行ネットワークを `setNetwork` で
   注入して使う。ネットワークを差し替えると `networkVersion()` が進み、
   ノードの `cookKey`（P4 の機構, §18.3）経由でキャッシュが無効化される。

   座標系はリポジトリの慣習どおり Z-up（x=東 / y=北 / z=高さ）。
   ホストが Y-up の場合の変換はアダプタ（station_app.js）の責務。
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { reg } = require('./nodes');

/* ============================================================
   ネットワークの注入
   ------------------------------------------------------------
   net = {
     nodes: [{ id?, x, y, z, ordinal, inout }],
     links: [{ a, b, pts: [[x,y,z], ...], len?, oneWay? }],   // a,b は nodes の添字
     name?: string,
     dangling?: number,        // 端点を解決できなかったリンク数（ホスト側で計上）
   }
   ============================================================ */

let _net = null;
let _netVersion = 0;

/** 高さ -> 階 の換算に使うフロア間隔。アダプタがホストの値に合わせる */
let FLOOR_H = 30;
function setFloorHeight(h) { FLOOR_H = h > 0 ? h : 30; }

function segLen(p, q) {
  return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
}

function setNetwork(net) {
  if (!net || !Array.isArray(net.nodes) || !Array.isArray(net.links))
    throw new Error('setNetwork expects { nodes, links }');

  const nodes = net.nodes.map((n, i) => ({
    id: n.id != null ? n.id : String(i),
    x: n.x, y: n.y, z: n.z,
    ordinal: n.ordinal != null ? n.ordinal : 0,
    inout: n.inout != null ? Number(n.inout) : 0,
  }));

  const links = [];
  const adj = nodes.map(() => []);
  for (const l of net.links) {
    if (!(l.a >= 0 && l.a < nodes.length) || !(l.b >= 0 && l.b < nodes.length)) continue;
    if (l.a === l.b) continue;
    let pts = l.pts && l.pts.length >= 2
      ? l.pts.map(p => [p[0], p[1], p[2]])
      : [[nodes[l.a].x, nodes[l.a].y, nodes[l.a].z], [nodes[l.b].x, nodes[l.b].y, nodes[l.b].z]];
    let len = 0;
    for (let i = 0; i + 1 < pts.length; i++) len += segLen(pts[i], pts[i + 1]);
    if (!(len > 0)) continue;
    const li = links.length;
    links.push({ a: l.a, b: l.b, pts, len, oneWay: !!l.oneWay });
    adj[l.a].push({ li, to: l.b, len, forward: true });
    if (!l.oneWay) adj[l.b].push({ li, to: l.a, len, forward: false });
  }

  _net = {
    name: net.name || 'indoor pedestrian network',
    nodes, links, adj,
    dangling: net.dangling || 0,
    _tree: new Map(),      // destKey -> 最短路木
    _template: null,       // ネットワーク線の GeoSet テンプレート（COW 元）
  };
  _netVersion++;
  _routeCache.clear();
  return _net;
}

function getNetwork() { return _net; }
function networkVersion() { return _netVersion; }

function requireNetwork() {
  if (!_net) throw new Error('no network loaded (call setNetwork first)');
  return _net;
}

/* ============================================================
   最短路木（目的地集合を根とする多始点 Dijkstra）
   ------------------------------------------------------------
   各ノードから「最寄りの目的地」へ向かう親ポインタを得る。
   1回作れば全エージェントで共有できるので、経路生成は O(N log N) 1回で済む。
   ============================================================ */

function parseFloors(spec) {
  return String(spec || '').split(/[\s,]+/).filter(Boolean).map(Number).filter(v => isFinite(v));
}

function destNodes(net, floors) {
  const set = new Set(floors);
  const out = [];
  for (let i = 0; i < net.nodes.length; i++) {
    const n = net.nodes[i];
    if (!net.adj[i].length) continue;
    if (set.has(n.ordinal) && n.inout !== 1) out.push(i);
  }
  return out;
}

function shortestTree(net, dests) {
  const key = dests.join(',');
  const hit = net._tree.get(key);
  if (hit) return hit;

  const n = net.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const parentLink = new Int32Array(n).fill(-1);
  const root = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);

  // 二分ヒープ（O(n^2) 走査だと駅規模でも 400万回になるため）
  const heap = [];
  const push = (node, d) => {
    heap.push([d, node]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
    }
    return top;
  };

  for (const d of dests) { dist[d] = 0; root[d] = d; push(d, 0); }
  while (heap.length) {
    const [d, u] = pop();
    if (done[u] || d > dist[u]) continue;
    done[u] = 1;
    for (const e of net.adj[u]) {
      const nd = d + e.len;
      if (nd < dist[e.to]) {
        dist[e.to] = nd; parent[e.to] = u; parentLink[e.to] = e.li; root[e.to] = root[u];
        push(e.to, nd);
      }
    }
  }
  const tree = { dist, parent, parentLink, root, dests };
  if (net._tree.size > 6) net._tree.clear();
  net._tree.set(key, tree);
  return tree;
}

/** 親ポインタを辿って origin -> 目的地 の折れ線を作る（リンク添字つき） */
function flattenRoute(net, tree, origin) {
  const pts = [], cum = [], segLink = [];
  let cur = origin, total = 0;
  const first = net.nodes[origin];
  pts.push([first.x, first.y, first.z]); cum.push(0);

  let guard = 0;
  while (tree.parent[cur] >= 0 && guard++ < 4096) {
    const li = tree.parentLink[cur];
    const link = net.links[li];
    const forward = link.a === cur;
    const lp = forward ? link.pts : link.pts.slice().reverse();
    for (let i = 1; i < lp.length; i++) {
      total += segLen(pts[pts.length - 1], lp[i]);
      pts.push([lp[i][0], lp[i][1], lp[i][2]]);
      cum.push(total);
      segLink.push(li);
    }
    cur = tree.parent[cur];
  }
  return { pts, cum, segLink, total, dest: cur };
}

/* ============================================================
   経路生成（決定論・メモ化）
   ============================================================ */

function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const _routeCache = new Map();

function buildRoutes(p) {
  const net = requireNetwork();
  const ck = JSON.stringify([_netVersion, p.count, p.seed, p.mode, p.destFloors,
                             p.window, p.dwell, p.minRoute]);
  const hit = _routeCache.get(ck);
  if (hit) return hit;

  let floors = parseFloors(p.destFloors);
  const warnings = [];
  let dests = floors.length ? destNodes(net, floors) : [];
  if (!dests.length) {
    // 指定フロアに目的地が無ければ、最もノード数の多いフロアで代替する
    const byOrd = new Map();
    for (let i = 0; i < net.nodes.length; i++) {
      if (!net.adj[i].length || net.nodes[i].inout === 1) continue;
      const o = net.nodes[i].ordinal;
      byOrd.set(o, (byOrd.get(o) || 0) + 1);
    }
    const best = [...byOrd].sort((a, b) => b[1] - a[1])[0];
    if (best) {
      floors = [best[0]];
      dests = destNodes(net, floors);
      warnings.push(`destFloors "${p.destFloors}" matched no node; falling back to floor ${best[0]}`);
    }
  }
  if (!dests.length) throw new Error('no destination nodes could be selected');

  const tree = shortestTree(net, dests);

  const entrances = [];
  for (let i = 0; i < net.nodes.length; i++)
    if (net.nodes[i].inout === 1 && net.adj[i].length && isFinite(tree.dist[i])) entrances.push(i);
  if (!entrances.length) warnings.push('no entrance nodes (in_out=1) reachable; using deep nodes as origins');

  // 出入口が1つも無いネットワークでは、目的地から最も遠いノード群を起点に代用する
  let origins = entrances;
  if (!origins.length) {
    const order = [];
    for (let i = 0; i < net.nodes.length; i++)
      if (net.adj[i].length && isFinite(tree.dist[i]) && tree.dist[i] > 0) order.push(i);
    order.sort((a, b) => tree.dist[b] - tree.dist[a]);
    origins = order.slice(0, Math.max(8, Math.ceil(order.length * 0.05)));
  }
  if (!origins.length) throw new Error('no origin nodes could be selected');

  const rnd = prng(p.seed);
  const routes = [];
  let sumLen = 0, guard = 0;

  // 最寄りの目的地が隣接している出入口（B1 の出入口など）は経路がほぼ 0m になり、
  // 「駅の中を歩く」可視化にならない。最低経路長で足切りする。
  const minRoute = Math.max(0.5, p.minRoute || 0.5);

  while (routes.length < p.count && guard++ < p.count * 12) {
    const o = origins[Math.floor(rnd() * origins.length)];
    const r = flattenRoute(net, tree, o);
    if (r.pts.length < 2 || !(r.total >= minRoute)) continue;

    // mode: in=出入口->目的地 / out=その逆 / both=半々
    const outbound = p.mode === 'out' || (p.mode === 'both' && rnd() < 0.5);
    let pts = r.pts, cum = r.cum, segLink = r.segLink;
    if (outbound) {
      pts = r.pts.slice().reverse();
      segLink = r.segLink.slice().reverse();
      cum = [0];
      let t = 0;
      for (let i = 1; i < pts.length; i++) { t += segLen(pts[i - 1], pts[i]); cum.push(t); }
    }

    const spd = 1.0 + rnd() * 0.7;                 // 個体差のある歩行速度 m/s
    const travel = r.total / spd;
    const dwell = p.dwell * (0.6 + rnd() * 0.8);   // 目的地での滞留
    const ang = rnd() * Math.PI * 2, rad = 0.6 + rnd() * 2.2;
    routes.push({
      pts, cum, segLink, total: r.total, spd, travel, dwell,
      cycle: travel + dwell,
      spawn: rnd() * p.window,
      outbound,
      sx: Math.cos(ang) * rad, sy: Math.sin(ang) * rad,
    });
    sumLen += r.total;
  }

  if (routes.length < p.count)
    warnings.push(`only ${routes.length}/${p.count} routes are at least ${minRoute}m long`);

  const out = {
    routes, warnings,
    meanRoute: routes.length ? sumLen / routes.length : 0,
    dests, floors, entrances: entrances.length,
  };
  if (_routeCache.size > 8) _routeCache.clear();
  _routeCache.set(ck, out);
  return out;
}

/* ============================================================
   stationnet : 歩行ネットワークを線分ジオメトリとして出す
   ============================================================ */

function networkTemplate(net) {
  if (net._template) return net._template;
  const g = new GeoSet();
  let nv = 0;
  for (const l of net.links) nv += l.pts.length;
  g.reserve(nv, nv, net.links.length);
  const aFloor = g.addAttrib('point', 'floor', 'float');
  const aLen   = g.addAttrib('prim', 'length', 'float');
  const aOrd   = g.addAttrib('prim', 'ordinal', 'float');
  const aVert  = g.addAttrib('prim', 'vertical', 'int');   // 階をまたぐ（階段/EV/ES）
  for (const l of net.links) {
    const idx = l.pts.map(p => {
      const pt = g.addPoint(p[0], p[1], p[2]);
      aFloor.set(pt, net.nodes[l.a].ordinal);
      return pt;
    });
    const pi = g.addPrim(idx, false);
    aLen.set(pi, l.len);
    aOrd.set(pi, net.nodes[l.a].ordinal);
    aVert.set(pi, net.nodes[l.a].ordinal !== net.nodes[l.b].ordinal ? 1 : 0);
  }
  g.detail.add('source', 'string').set(0, net.name);
  g.detail.add('nodes', 'int').set(0, net.nodes.length);
  g.detail.add('links', 'int').set(0, net.links.length);
  net._template = g;
  return g;
}

reg.register({
  type: 'stationnet',
  label: '構内ネットワーク',
  inputs: [],
  params: {},
  cookKey() { return _netVersion; },     // ネットワーク差し替えでキャッシュ無効化（§18.3）
  cook(ctx) {
    const net = requireNetwork();
    if (net.dangling) ctx.warn(`${net.dangling} links reference a missing node and were dropped`);
    return networkTemplate(net).clone();   // COW: 実バッファは共有される
  },
});

/* ============================================================
   stationagents : 構内を歩くエージェント（時間依存 / 時刻の純関数）
   ------------------------------------------------------------
   位置は必ず t から解析的に求める（前フレーム依存にしない。§17.6）。
   周期 cycle で巡回するので、任意時刻へ飛んでも結果は同じ。
   ============================================================ */

reg.register({
  type: 'stationagents',
  label: '構内人流',
  inputs: [],
  params: {
    count:      { type: 'int',    default: 800 },
    seed:       { type: 'int',    default: 20260813 },
    mode:       { type: 'string', default: 'both' },    // 'in' | 'out' | 'both'
    destFloors: { type: 'string', default: '-2,-1' },   // 目的地とみなす階（ダミー需要）
    window:     { type: 'float',  default: 120 },       // 出発が分散する時間幅（秒）
    dwell:      { type: 'float',  default: 25 },        // 目的地での滞留（秒）
    speed:      { type: 'float',  default: 1.0 },       // 速度倍率
    minRoute:   { type: 'float',  default: 40 },        // これより短い経路は採用しない（m）
  },
  timeDep: true,
  cookKey() { return _netVersion; },
  cook(ctx) {
    const p = ctx.params;
    const R = buildRoutes(p);
    for (const w of R.warnings) ctx.warn(w);
    if (!R.routes.length) ctx.warn('no routes could be built');

    const g = new GeoSet();
    g.reserve(R.routes.length, 0, 0);
    const aSpeed = g.addAttrib('point', 'speed', 'float');
    const aState = g.addAttrib('point', 'state', 'int');      // 0=出発前 1=歩行中 2=滞留
    const aFloor = g.addAttrib('point', 'floor', 'float');
    const aProg  = g.addAttrib('point', 'progress', 'float'); // 0..1
    const aLen   = g.addAttrib('point', 'routeLen', 'float');
    const aLink  = g.addAttrib('point', 'linkIdx', 'int');    // 混雑集計のキー
    const aDir   = g.addAttrib('point', 'dir', 'string');

    const spdMul = p.speed;
    let waiting = 0, walking = 0, dwelling = 0;

    for (const r of R.routes) {
      const u = ctx.time - r.spawn;
      let x, y, z, state, prog, link = -1;
      if (u < 0) {
        const A = r.pts[0];
        x = A[0]; y = A[1]; z = A[2];
        state = 0; prog = 0; waiting++;
      } else {
        const cycle = Math.max(0.001, r.travel / spdMul + r.dwell);
        const phase = u % cycle;
        const travel = r.travel / spdMul;
        if (phase < travel) {
          const d = phase * r.spd * spdMul;
          let lo = 0, hi = r.cum.length - 1;
          while (lo + 1 < hi) {
            const m = (lo + hi) >> 1;
            if (r.cum[m] <= d) lo = m; else hi = m;
          }
          const seg = r.cum[hi] - r.cum[lo] || 1;
          const t = (d - r.cum[lo]) / seg;
          const A = r.pts[lo], B = r.pts[hi];
          x = A[0] + (B[0] - A[0]) * t;
          y = A[1] + (B[1] - A[1]) * t;
          z = A[2] + (B[2] - A[2]) * t;
          state = 1; prog = Math.min(1, d / r.total); walking++;
          link = r.segLink[Math.min(lo, r.segLink.length - 1)];
        } else {
          const A = r.pts[r.pts.length - 1];
          x = A[0] + r.sx; y = A[1] + r.sy; z = A[2];
          state = 2; prog = 1; dwelling++;
          link = r.segLink.length ? r.segLink[r.segLink.length - 1] : -1;
        }
      }
      const pt = g.addPoint(x, y, z);
      aSpeed.set(pt, r.spd * spdMul);
      aState.set(pt, state);
      aFloor.set(pt, z / FLOOR_H);
      aProg.set(pt, prog);
      aLen.set(pt, r.total);
      aLink.set(pt, link);
      aDir.set(pt, r.outbound ? '退場' : '入場');
    }

    const net = requireNetwork();
    g.detail.add('source', 'string').set(0, net.name + ' + dummy demand');
    g.detail.add('agents', 'int').set(0, R.routes.length);
    g.detail.add('meanRoute', 'float').set(0, R.meanRoute);
    g.detail.add('entrances', 'int').set(0, R.entrances);
    g.detail.add('destNodes', 'int').set(0, R.dests.length);
    g.detail.add('waiting', 'int').set(0, waiting);
    g.detail.add('walking', 'int').set(0, walking);
    g.detail.add('dwelling', 'int').set(0, dwelling);
    return g;
  },
});

/* ============================================================
   stationload : リンク別の混雑度（点 -> プリム集約）
   ------------------------------------------------------------
   エージェントの linkIdx を数え、ネットワーク線に load 属性として載せる。
   ネットワークのジオメトリは COW テンプレートの共有なので、
   毎フレーム実体が複製されるのは load 属性だけになる。
   ============================================================ */

reg.register({
  type: 'stationload',
  label: 'リンク混雑度',
  inputs: [{ name: 'agents', required: true }],
  params: { decay: { type: 'float', default: 1 } },   // 表示上の倍率
  cookKey() { return _netVersion; },
  cook(ctx) {
    const net = requireNetwork();
    const agents = ctx.inRaw(0);
    const g = networkTemplate(net).clone();
    const aLoad = g.prim.add('load', 'float');
    const aNorm = g.prim.add('loadNorm', 'float');

    const counts = new Float64Array(net.links.length);
    const src = agents.point.get('linkIdx');
    const state = agents.point.get('state');
    if (!src) {
      ctx.warn('input has no point attribute "linkIdx"; load is zero everywhere');
    } else {
      for (let i = 0; i < agents.point.count; i++) {
        if (state && state.get(i) !== 1) continue;   // 歩行中のみ数える
        const li = src.get(i);
        if (li >= 0 && li < counts.length) counts[li]++;
      }
    }

    let max = 0;
    for (let i = 0; i < counts.length; i++) if (counts[i] > max) max = counts[i];
    const k = ctx.params.decay;
    for (let pi = 0; pi < g.prim.count; pi++) {
      const v = counts[pi] * k;
      aLoad.set(pi, v);
      aNorm.set(pi, max > 0 ? counts[pi] / max : 0);
    }
    g.detail.add('maxLoad', 'float').set(0, max);
    return g;
  },
});

module.exports = {
  reg, setNetwork, getNetwork, networkVersion, setFloorHeight,
  shortestTree, destNodes, buildRoutes,
};
