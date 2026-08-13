/* ============================================================
   XBUILD — site_nodes.js
   実データ（PLATEAU LOD1 + OpenStreetMap）を GeoSet へ載せるノード群。
   データは src/site_data.js（bake 済み、原点からのデシメートル整数、差分符号化）。
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { reg } = require('./demo_nodes');
const DATA = require('./site_data');

/* ---------- 差分符号化の展開 ---------- */

function decodeRing(rec, at, n) {
  const ring = new Array(n);
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    x += rec[at + i * 2]; y += rec[at + i * 2 + 1];
    ring[i] = [x / 10, y / 10];
  }
  return ring;
}

/** buildings レコード: [base, h, usageIdx, storeys, year, mh, ringLen, dx, dy, ...] */
function decodeBuildings() {
  if (decodeBuildings._c) return decodeBuildings._c;
  const out = DATA.buildings.map(r => ({
    base: r[0] / 10, h: r[1] / 10,
    usage: r[2] >= 0 ? DATA.usages[r[2]] : '不明',
    storeys: r[3], year: r[4], mh: r[5] / 10,
    ring: decodeRing(r, 7, r[6]),
  }));
  decodeBuildings._c = out;
  return out;
}

/** roads レコード: [walkable, n, dx, dy, ...] */
function decodeRoads() {
  if (decodeRoads._c) return decodeRoads._c;
  const out = DATA.roads.map(r => ({ walk: !!r[0], pts: decodeRing(r, 2, r[1]) }));
  decodeRoads._c = out;
  return out;
}

/* ============================================================
   sitectx : PLATEAU LOD1 の実建物
   ============================================================ */

reg.register({
  type: 'sitectx',
  label: '文脈建物 (PLATEAU)',
  inputs: [],
  params: {
    radius:    { type: 'float',  default: 600 },
    minHeight: { type: 'float',  default: 0 },
    useMh:     { type: 'int',    default: 0 },   // 1 で measuredHeight を高さに使う
  },
  cook(ctx) {
    const src = decodeBuildings();
    const { radius, minHeight, useMh } = ctx.params;
    const g = new GeoSet();
    g.reserve(src.length * 14, src.length * 40, src.length * 9);

    const aHeight  = g.addAttrib('prim', 'height', 'float');
    const aUsage   = g.addAttrib('prim', 'usage', 'string');
    const aStoreys = g.addAttrib('prim', 'storeys', 'int');
    const aYear    = g.addAttrib('prim', 'year', 'int');
    const aPart    = g.addAttrib('prim', 'part', 'string');
    const aDelta   = g.addAttrib('prim', 'mhDelta', 'float');   // |幾何高さ − measuredHeight|

    let used = 0, skippedFar = 0, skippedLow = 0, noMh = 0;
    for (const b of src) {
      let cx = 0, cy = 0;
      for (const p of b.ring) { cx += p[0]; cy += p[1]; }
      cx /= b.ring.length; cy /= b.ring.length;
      if (Math.hypot(cx, cy) > radius) { skippedFar++; continue; }

      const hasMh = b.mh > 0;
      if (!hasMh) noMh++;
      const h = (useMh && hasMh) ? b.mh : b.h;
      if (h < minHeight) { skippedLow++; continue; }

      const z0 = b.base, z1 = b.base + h;
      const n = b.ring.length;
      const lo = new Array(n), hi = new Array(n);
      for (let i = 0; i < n; i++) {
        lo[i] = g.addPoint(b.ring[i][0], b.ring[i][1], z0);
        hi[i] = g.addPoint(b.ring[i][0], b.ring[i][1], z1);
      }
      const roof = g.addPrim(hi);
      const tag = (pi) => {
        aHeight.set(pi, h); aUsage.set(pi, b.usage);
        aStoreys.set(pi, b.storeys); aYear.set(pi, b.year);
        aDelta.set(pi, hasMh ? Math.abs(b.h - b.mh) : 0);
      };
      tag(roof); aPart.set(roof, 'roof');
      for (let i = 0; i < n; i++) {
        const pi = g.addPrim([lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]]);
        tag(pi); aPart.set(pi, 'wall');
      }
      used++;
    }

    g.detail.add('source', 'string').set(0, DATA.source);
    g.detail.add('buildings', 'int').set(0, used);
    if (skippedFar) ctx.warn(`${skippedFar} buildings outside radius ${radius}m`);
    if (skippedLow) ctx.warn(`${skippedLow} buildings below minHeight ${minHeight}m`);
    if (noMh) ctx.warn(`${noMh} buildings have no measuredHeight attribute`);
    return g;
  },
});

/* ============================================================
   siteroads : OSM 道路網（開いたプリミティブ = 線分）
   ============================================================ */

reg.register({
  type: 'siteroads',
  label: '道路網 (OSM)',
  inputs: [],
  params: {
    walkableOnly: { type: 'int',   default: 1 },
    lift:         { type: 'float', default: 0.3 },
  },
  cook(ctx) {
    const src = decodeRoads();
    const g = new GeoSet();
    let nv = 0;
    for (const w of src) nv += w.pts.length;
    g.reserve(nv, nv, src.length);
    const aWalk = g.addAttrib('prim', 'walk', 'int');
    let n = 0;
    for (const w of src) {
      if (ctx.params.walkableOnly && !w.walk) continue;
      const idx = w.pts.map(p => g.addPoint(p[0], p[1], ctx.params.lift));
      aWalk.set(g.addPrim(idx, false), w.walk ? 1 : 0);   // closed=false -> 線分
      n++;
    }
    g.detail.add('roads', 'int').set(0, n);
    return g;
  },
});

/* ============================================================
   roadagents : 実道路網の上を歩く人流エージェント（時間依存）
   ------------------------------------------------------------
   cook は時刻の純関数でなければならない（任意時刻で呼ばれ、結果がキャッシュされる）。
   そのため各エージェントには「固定経路 + 経路上の弧長」を持たせ、
   位置は t から解析的に求める。経路生成はコストが高いのでメモ化する。
   ============================================================ */

function buildGraph() {
  if (buildGraph._c) return buildGraph._c;
  const roads = decodeRoads().filter(w => w.walk);
  const key = new Map();     // "x,y" -> node index
  const pos = [];
  const adj = [];
  const id = (p) => {
    const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);   // 0.5m で溶接
    let v = key.get(k);
    if (v === undefined) { v = pos.length; key.set(k, v); pos.push([p[0], p[1]]); adj.push([]); }
    return v;
  };
  for (const w of roads) {
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = id(w.pts[i]), b = id(w.pts[i + 1]);
      if (a === b) continue;
      const d = Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]);
      adj[a].push([b, d]); adj[b].push([a, d]);
    }
  }
  buildGraph._c = { pos, adj };
  return buildGraph._c;
}

function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

const _routeCache = new Map();

function buildRoutes(count, seed, steps, attract) {
  const ck = `${count}|${seed}|${steps}|${attract}`;
  const hit = _routeCache.get(ck);
  if (hit) return hit;

  const { pos, adj } = buildGraph();
  const starts = [];
  for (let i = 0; i < pos.length; i++) if (adj[i].length) starts.push(i);
  const rnd = prng(seed);
  const routes = [];

  for (let a = 0; a < count; a++) {
    let cur = starts[Math.floor(rnd() * starts.length)];
    let prev = -1;
    const path = [cur];
    const cum = [0];
    let total = 0;
    for (let s = 0; s < steps; s++) {
      const opts = adj[cur].filter(e => e[0] !== prev);
      const list = opts.length ? opts : adj[cur];
      if (!list.length) break;
      let pick;
      if (attract > 0 && rnd() < attract) {
        // 会場（原点）へ近づく枝を選ぶ
        let best = list[0], bd = Infinity;
        for (const e of list) {
          const d = Math.hypot(pos[e[0]][0], pos[e[0]][1]);
          if (d < bd) { bd = d; best = e; }
        }
        pick = best;
      } else {
        pick = list[Math.floor(rnd() * list.length)];
      }
      total += pick[1];
      prev = cur; cur = pick[0];
      path.push(cur); cum.push(total);
    }
    if (total < 1) { a--; continue; }
    routes.push({ path, cum, total, offset: rnd() * total, speed: 1.1 + rnd() * 0.7 });
  }

  const out = { routes, pos };
  if (_routeCache.size > 12) _routeCache.clear();
  _routeCache.set(ck, out);
  return out;
}

reg.register({
  type: 'roadagents',
  label: '人流 (道路網)',
  inputs: [],
  params: {
    count:   { type: 'int',   default: 900 },
    seed:    { type: 'int',   default: 20260813 },
    steps:   { type: 'int',   default: 26 },
    attract: { type: 'float', default: 0.55 },   // 0=ランダム歩行, 1=会場へ直行
    speed:   { type: 'float', default: 1.0 },    // 倍率
  },
  timeDep: true,
  cook(ctx) {
    const { count, seed, steps, attract, speed } = ctx.params;
    const { routes, pos } = buildRoutes(count, seed, steps, attract);

    const g = new GeoSet();
    g.reserve(routes.length, 0, 0);
    const aSpeed = g.addAttrib('point', 'speed', 'float');
    const aDist  = g.addAttrib('point', 'toVenue', 'float');

    for (const r of routes) {
      let d = (r.offset + ctx.time * r.speed * speed) % r.total;
      if (d < 0) d += r.total;
      // 弧長 d の位置を二分探索
      let lo = 0, hi = r.cum.length - 1;
      while (lo + 1 < hi) {
        const m = (lo + hi) >> 1;
        if (r.cum[m] <= d) lo = m; else hi = m;
      }
      const seg = r.cum[hi] - r.cum[lo] || 1;
      const t = (d - r.cum[lo]) / seg;
      const A = pos[r.path[lo]], B = pos[r.path[hi]];
      const x = A[0] + (B[0] - A[0]) * t;
      const y = A[1] + (B[1] - A[1]) * t;
      const pt = g.addPoint(x, y, 1.4);
      aSpeed.set(pt, r.speed * speed);
      aDist.set(pt, Math.hypot(x, y));
    }
    g.detail.add('source', 'string').set(0, 'OSM walkable network');
    return g;
  },
});

/* ============================================================
   arena : 計画アリーナのマッシング（公表値ベース）
   敷地面積 約29,359m2 / 建築面積 約16,900m2 / 最高高さ 約30.9m / 鉄骨造4階
   ============================================================ */

reg.register({
  type: 'arena',
  label: 'アリーナ (計画値)',
  inputs: [],
  params: {
    width:     { type: 'float', default: 152 },
    depth:     { type: 'float', default: 111 },
    height:    { type: 'float', default: 30.9 },
    floors:    { type: 'int',   default: 4 },
    rotate:    { type: 'float', default: -26 },  // 度。街区の向きに合わせる
    cx:        { type: 'float', default: 55 },
    cy:        { type: 'float', default: 65 },
  },
  cook(ctx) {
    const { width, depth, height, floors, rotate, cx, cy } = ctx.params;
    const g = new GeoSet();
    const a = rotate * Math.PI / 180, C = Math.cos(a), S = Math.sin(a);
    const put = (u, v, z) => g.addPoint(cx + u * C - v * S, cy + u * S + v * C, z);

    const aPart = g.addAttrib('prim', 'part', 'string');
    const aLevel = g.addAttrib('prim', 'level', 'int');
    const aHeight = g.addAttrib('prim', 'height', 'float');
    const fh = height / floors;

    for (let f = 0; f < floors; f++) {
      const k = 1 - 0.06 * (f / Math.max(1, floors - 1));
      const w = width * k / 2, d = depth * k / 2;
      const z0 = f * fh, z1 = z0 + fh;
      const lo = [put(-w, -d, z0), put(w, -d, z0), put(w, d, z0), put(-w, d, z0)];
      const hi = [put(-w, -d, z1), put(w, -d, z1), put(w, d, z1), put(-w, d, z1)];
      const slab = g.addPrim(lo);
      aPart.set(slab, 'slab'); aLevel.set(slab, f); aHeight.set(slab, z0);
      for (let i = 0; i < 4; i++) {
        const pi = g.addPrim([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]]);
        aPart.set(pi, 'facade'); aLevel.set(pi, f); aHeight.set(pi, z0);
      }
      if (f === floors - 1) {
        const roof = g.addPrim(hi);
        aPart.set(roof, 'roof'); aLevel.set(roof, f); aHeight.set(roof, z1);
      }
    }
    /* 既存建物との干渉チェック。推測で配置せず、数を出して判断できるようにする */
    const clash = countClashes(cx, cy, width, depth, rotate);
    g.detail.add('footprint', 'float').set(0, width * depth);
    g.detail.add('clashes', 'int').set(0, clash.n);
    g.detail.add('clashArea', 'float').set(0, clash.area);
    if (clash.n) ctx.warn(`${clash.n} existing buildings inside the footprint (${clash.area.toFixed(0)}m2 of PLATEAU building area)`);
    return g;
  },
});

/** フットプリント内に重心が入る既存建物を数える */
function countClashes(cx, cy, w, d, rotate) {
  if (!countClashes._c) {
    countClashes._c = decodeBuildings().map(b => {
      let x = 0, y = 0, n = b.ring.length;
      for (const p of b.ring) { x += p[0]; y += p[1]; }
      let a = 0;
      for (let i = 0; i < n; i++) {
        const p = b.ring[i], q = b.ring[(i + 1) % n];
        a += p[0] * q[1] - q[0] * p[1];
      }
      return { x: x / n, y: y / n, area: Math.abs(a) / 2 };
    });
  }
  const a = -rotate * Math.PI / 180, C = Math.cos(a), S = Math.sin(a);
  let n = 0, area = 0;
  for (const b of countClashes._c) {
    const dx = b.x - cx, dy = b.y - cy;
    const u = dx * C - dy * S, v = dx * S + dy * C;
    if (Math.abs(u) <= w / 2 && Math.abs(v) <= d / 2) { n++; area += b.area; }
  }
  return { n, area };
}

/* ---------- landmarks : OSM の実在ランドマークを縦線マーカーとして ---------- */
reg.register({
  type: 'landmarks',
  label: 'ランドマーク',
  inputs: [],
  params: { height: { type: 'float', default: 42 } },
  cook(ctx) {
    const g = new GeoSet();
    const aName = g.addAttrib('prim', 'name', 'string');
    const aKind = g.addAttrib('prim', 'kind', 'string');
    for (const [name, xdm, ydm, kind] of DATA.landmarks) {
      const x = xdm / 10, y = ydm / 10;
      const pi = g.addPrim([g.addPoint(x, y, 0), g.addPoint(x, y, ctx.params.height)], false);
      aName.set(pi, name); aKind.set(pi, kind);
    }
    return g;
  },
});

module.exports = { reg, decodeBuildings, decodeRoads, buildGraph, DATA };
