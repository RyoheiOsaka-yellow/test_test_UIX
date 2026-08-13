/* ============================================================
   XBUILD データフロー層 — demo_nodes.js
   P6 のエンドツーエンド検証用ノード群。
   XBUILD / FLOW·LAB / xPop の3系統が同じ GeoSet に載ることを示す。
   ============================================================ */

'use strict';

const { GeoSet } = require('./geo');
const { reg } = require('./nodes');

/* 決定論 PRNG（シード固定で毎回同じ街が出る） */
function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/* ---------- ctxbuildings : PLATEAU 文脈建物相当 ---------- */
reg.register({
  type: 'ctxbuildings',
  label: '文脈建物',
  inputs: [],
  params: {
    count:  { type: 'int',   default: 400 },
    seed:   { type: 'int',   default: 20260813 },
    radius: { type: 'float', default: 260 },
    clear:  { type: 'float', default: 55 },
  },
  cook(ctx) {
    const { count, seed, radius, clear } = ctx.params;
    const rnd = prng(seed);
    const g = new GeoSet();
    g.reserve(count * 8, count * 20, count * 5);
    const name = g.addAttrib('prim', 'name', 'string');
    const height = g.addAttrib('prim', 'height', 'float');
    const part = g.addAttrib('prim', 'part', 'string');

    let made = 0, guard = 0;
    while (made < count && guard++ < count * 20) {
      const a = rnd() * Math.PI * 2;
      const r = clear + Math.sqrt(rnd()) * (radius - clear);
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      const w = 8 + rnd() * 18, d = 8 + rnd() * 18;
      const ht = 6 + Math.pow(rnd(), 2.2) * 52;
      const x = cx - w / 2, y = cy - d / 2;

      const lo = [
        g.addPoint(x, y, 0), g.addPoint(x + w, y, 0),
        g.addPoint(x + w, y + d, 0), g.addPoint(x, y + d, 0),
      ];
      const hi = [
        g.addPoint(x, y, ht), g.addPoint(x + w, y, ht),
        g.addPoint(x + w, y + d, ht), g.addPoint(x, y + d, ht),
      ];
      const roof = g.addPrim(hi);
      name.set(roof, 'bldg_' + made); height.set(roof, ht); part.set(roof, 'roof');
      for (let k = 0; k < 4; k++) {
        const pi = g.addPrim([lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]]);
        name.set(pi, 'bldg_' + made); height.set(pi, ht); part.set(pi, 'wall');
      }
      made++;
    }
    g.detail.add('source', 'string').set(0, 'ctx');
    return g;
  },
});

/* ---------- tower : パラメトリック建物 ---------- */
reg.register({
  type: 'tower',
  label: '建物',
  inputs: [],
  params: {
    floors:      { type: 'int',   default: 8 },
    floorHeight: { type: 'float', default: 4.2 },
    width:       { type: 'float', default: 32 },
    depth:       { type: 'float', default: 20 },
    setback:     { type: 'float', default: 0.0 },
  },
  cook(ctx) {
    const { floors, floorHeight, width, depth, setback } = ctx.params;
    const g = new GeoSet();
    g.reserve(floors * 16, floors * 40, floors * 12);
    const part = g.addAttrib('prim', 'part', 'string');
    const lvl = g.addAttrib('prim', 'level', 'int');
    const height = g.addAttrib('prim', 'height', 'float');

    for (let f = 0; f < floors; f++) {
      const t = floors > 1 ? f / (floors - 1) : 0;
      const w = width * (1 - setback * t) / 2, d = depth * (1 - setback * t) / 2;
      const z0 = f * floorHeight, z1 = z0 + floorHeight;

      const lo = [
        g.addPoint(-w, -d, z0), g.addPoint(w, -d, z0),
        g.addPoint(w, d, z0), g.addPoint(-w, d, z0),
      ];
      const hi = [
        g.addPoint(-w, -d, z1), g.addPoint(w, -d, z1),
        g.addPoint(w, d, z1), g.addPoint(-w, d, z1),
      ];
      const slab = g.addPrim(lo);
      part.set(slab, 'slab'); lvl.set(slab, f); height.set(slab, z0);
      for (let k = 0; k < 4; k++) {
        const pi = g.addPrim([lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]]);
        part.set(pi, 'facade'); lvl.set(pi, f); height.set(pi, z0);
      }
      if (f === floors - 1) {
        const roof = g.addPrim(hi);
        part.set(roof, 'roof'); lvl.set(roof, f); height.set(roof, z1);
      }
    }
    g.detail.add('source', 'string').set(0, 'tower');
    return g;
  },
});

/* ---------- agents : 時間依存の人流点 ---------- */
reg.register({
  type: 'agents',
  label: '人流エージェント',
  inputs: [],
  params: {
    count:  { type: 'int',   default: 600 },
    seed:   { type: 'int',   default: 7 },
    radius: { type: 'float', default: 90 },
    speed:  { type: 'float', default: 0.35 },
  },
  timeDep: true,
  cook(ctx) {
    const { count, seed, radius, speed } = ctx.params;
    const rnd = prng(seed);
    const g = new GeoSet();
    g.reserve(count, count, count);
    const v = g.addAttrib('point', 'speed', 'float');
    const P = g.point.get('P');

    for (let i = 0; i < count; i++) {
      const r = 20 + rnd() * radius;
      const w = (0.3 + rnd() * 0.9) * (rnd() < 0.5 ? -1 : 1) * speed;
      const ph = rnd() * Math.PI * 2;
      const drift = 0.6 + rnd() * 0.8;
      const a = ph + ctx.time * w;
      const rr = r * (1 + 0.12 * Math.sin(ctx.time * drift + ph));
      const pt = g.addPoint(Math.cos(a) * rr, Math.sin(a) * rr, 1.2);
      v.set(pt, Math.abs(w) * rr);
      P.get(pt);
    }
    g.detail.add('source', 'string').set(0, 'agents');
    return g;
  },
});

/* ---------- heatmap : 点 -> グリッドセルへの集約 ---------- */
reg.register({
  type: 'heatmap',
  label: 'ヒートマップ',
  inputs: [{ name: 'points', required: true }],
  params: {
    cell:   { type: 'float', default: 14 },
    extent: { type: 'float', default: 140 },
    lift:   { type: 'float', default: 0.4 },
  },
  cook(ctx) {
    const src = ctx.inRaw(0);
    const { cell, extent, lift } = ctx.params;
    const n = Math.max(1, Math.ceil((extent * 2) / cell));
    const counts = new Float64Array(n * n);
    const P = src.point.get('P');

    for (let i = 0; i < src.point.count; i++) {
      const p = P.get(i);
      const cx = Math.floor((p[0] + extent) / cell);
      const cy = Math.floor((p[1] + extent) / cell);
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
      counts[cy * n + cx] += 1;
    }

    let max = 0;
    for (let i = 0; i < counts.length; i++) if (counts[i] > max) max = counts[i];
    if (!max) max = 1;

    const g = new GeoSet();
    g.reserve(n * n * 4, n * n * 4, n * n);
    const dens = g.addAttrib('prim', 'density', 'float');
    for (let cy = 0; cy < n; cy++) {
      for (let cx = 0; cx < n; cx++) {
        const c = counts[cy * n + cx];
        if (!c) continue;
        const x = cx * cell - extent, y = cy * cell - extent;
        const z = lift + (c / max) * 0.2;
        const pi = g.addPrim([
          g.addPoint(x, y, z), g.addPoint(x + cell, y, z),
          g.addPoint(x + cell, y + cell, z), g.addPoint(x, y + cell, z),
        ]);
        dens.set(pi, c);
      }
    }
    g.detail.add('source', 'string').set(0, 'heatmap');
    return g;
  },
});

module.exports = { reg };
