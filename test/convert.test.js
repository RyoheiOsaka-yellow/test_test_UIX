'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { GeoSet } = require('../src/geo');
const { toRenderBuffers, triangulate, faceNormal } = require('../src/convert');

function triArea(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

test('triangulate: quad -> 2 triangles', () => {
  const q = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]];
  const t = triangulate(q);
  assert.equal(t.length, 2);
  const area = t.reduce((s, [i, j, k]) => s + triArea(q[i], q[j], q[k]), 0);
  assert.ok(Math.abs(area - 4) < 1e-6, `area ${area}`);
});

test('triangulate: concave L-shape keeps area and vertex count', () => {
  // L 字（面積 3）。扇分割では正しく分割できない形状
  const L = [[0, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0], [1, 2, 0], [0, 2, 0]];
  const t = triangulate(L);
  assert.equal(t.length, L.length - 2, 'n-2 triangles');
  const area = t.reduce((s, [i, j, k]) => s + triArea(L[i], L[j], L[k]), 0);
  assert.ok(Math.abs(area - 3) < 1e-6, `L-shape area ${area}, expected 3`);
});

test('triangulate works on a non-axis-aligned plane', () => {
  // XZ 平面に立てた正方形（壁面）
  const w = [[0, 0, 0], [4, 0, 0], [4, 0, 3], [0, 0, 3]];
  const t = triangulate(w);
  const area = t.reduce((s, [i, j, k]) => s + triArea(w[i], w[j], w[k]), 0);
  assert.ok(Math.abs(area - 12) < 1e-6, `wall area ${area}`);
  const n = faceNormal(w);
  assert.ok(Math.abs(Math.abs(n[1]) - 1) < 1e-6, 'normal should be along Y');
});

test('vertex-layer attributes map 1:1 onto non-indexed render vertices', () => {
  // P6 の核心的な検証: 同じ point を共有する2面が、コーナーごとに別の法線を持てるか
  const g = new GeoSet();
  const p = [
    g.addPoint(0, 0, 0), g.addPoint(1, 0, 0),
    g.addPoint(1, 1, 0), g.addPoint(0, 1, 0),
    g.addPoint(1, 0, 1), g.addPoint(1, 1, 1),
  ];
  g.addPrim([p[0], p[1], p[2], p[3]]);   // 床
  g.addPrim([p[1], p[4], p[5], p[2]]);   // 壁（point 1,2 を床と共有）

  const N = g.addAttrib('vertex', 'N', 'vec3');
  for (let v = 0; v < 4; v++) N.set(v, [0, 0, 1]);        // 床のコーナーは上向き
  for (let v = 4; v < 8; v++) N.set(v, [1, 0, 0]);        // 壁のコーナーは横向き

  const { tris } = toRenderBuffers(g);
  assert.equal(tris.count, 12, '2 quads -> 4 tris -> 12 verts');

  // 共有 point を参照する描画頂点が、所属面ごとに別の法線を持っていること
  const seen = new Set();
  for (let i = 0; i < tris.count; i++) {
    const px = tris.position[i * 3], py = tris.position[i * 3 + 1], pz = tris.position[i * 3 + 2];
    if (px === 1 && py === 0 && pz === 0)
      seen.add(`${tris.normal[i * 3]},${tris.normal[i * 3 + 1]},${tris.normal[i * 3 + 2]}`);
  }
  assert.equal(seen.size, 2, `shared point must carry both normals, got ${[...seen]}`);
});

test('falls back to face normals when no N attribute exists', () => {
  const g = new GeoSet();
  const a = g.addPoint(0, 0, 0), b = g.addPoint(1, 0, 0), c = g.addPoint(1, 1, 0);
  g.addPrim([a, b, c]);
  const { tris } = toRenderBuffers(g);
  assert.equal(tris.count, 3);
  assert.ok(Math.abs(Math.abs(tris.normal[2]) - 1) < 1e-6, 'normal along Z');
});

test('prim float attribute drives the colour ramp', () => {
  const g = new GeoSet();
  for (let i = 0; i < 2; i++) {
    const a = g.addPoint(i * 3, 0, 0), b = g.addPoint(i * 3 + 1, 0, 0), c = g.addPoint(i * 3 + 1, 1, 0);
    g.addPrim([a, b, c]);
  }
  g.addAttrib('prim', 'height', 'float').set(0, 10);
  g.prim.get('height').set(1, 50);
  const { tris, colorRange } = toRenderBuffers(g, { colorBy: 'height', ramp: 'yellow' });
  assert.deepEqual(colorRange, [10, 50]);
  const c0 = tris.color.slice(0, 3), c1 = tris.color.slice(9, 12);
  assert.ok(c1[0] > c0[0], 'higher value must be brighter on the yellow ramp');
});

test('open primitives become line segments, not triangles', () => {
  const g = new GeoSet();
  const a = g.addPoint(0, 0, 0), b = g.addPoint(5, 0, 0), c = g.addPoint(5, 5, 0);
  g.addPrim([a, b, c], false);   // closed = 0
  const { tris, lines } = toRenderBuffers(g);
  assert.equal(tris.count, 0);
  assert.equal(lines.count, 4, '3 points -> 2 segments -> 4 line vertices');
});

test('conversion scales to PLATEAU-context size', () => {
  const g = new GeoSet();
  g.reserve(8000, 20000, 5000);
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const h = g.addAttrib('prim', 'height', 'float');
  for (let i = 0; i < 1000; i++) {
    const x = rnd() * 500, y = rnd() * 500, w = 5 + rnd() * 10, ht = 6 + rnd() * 30;
    const lo = [g.addPoint(x, y, 0), g.addPoint(x + w, y, 0), g.addPoint(x + w, y + w, 0), g.addPoint(x, y + w, 0)];
    const hi = [g.addPoint(x, y, ht), g.addPoint(x + w, y, ht), g.addPoint(x + w, y + w, ht), g.addPoint(x, y + w, ht)];
    h.set(g.addPrim(hi), ht);
    for (let k = 0; k < 4; k++) h.set(g.addPrim([lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k]]), ht);
  }
  const t0 = Date.now();
  const { tris } = toRenderBuffers(g, { colorBy: 'height' });
  const ms = Date.now() - t0;
  assert.equal(tris.count, 5000 * 2 * 3, '5000 quads -> 10000 tris');
  assert.ok(ms < 2000, `conversion took ${ms}ms`);
});

test('all points are emitted as a point-cloud buffer', () => {
  const g = new GeoSet();
  g.addPoint(1, 2, 3); g.addPoint(4, 5, 6);
  g.addAttrib('point', 'speed', 'float').set(0, 0);
  g.point.get('speed').set(1, 10);
  const { points, tris } = toRenderBuffers(g, { colorBy: 'speed' });
  assert.equal(tris.count, 0, 'no prims -> no triangles');
  assert.equal(points.count, 2);
  assert.deepEqual(Array.from(points.position.slice(3, 6)), [4, 5, 6]);
  assert.ok(points.color[3] > points.color[0], 'ramp applied to points');
});
