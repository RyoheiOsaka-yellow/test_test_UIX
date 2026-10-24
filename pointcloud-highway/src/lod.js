// Level-of-detail point cloud: points are bucketed into ground cells, each cell holds its points
// sorted by a random LOD rank so that the first 1/64, 1/16, 1/4 or all of them form nested
// subsamples. Per frame each visible cell draws the fraction that projects to ~1 px spacing,
// under a global point budget. Attribute arrays stay in one global set; cells use subarray views.
import * as THREE from 'three';

const FRACTIONS = [1 / 64, 1 / 16, 1 / 4, 1];

export function buildLod(m, material, { cell = 64 } = {}) {
  const n = m.n, pos = m.pos;
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z; }
  const nx = Math.max(1, Math.ceil((maxx - minx) / cell)), nz = Math.max(1, Math.ceil((maxz - minz) / cell));
  const cellOf = new Uint32Array(n), level = new Uint8Array(n);
  const counts = new Uint32Array(nx * nz * 4);
  let h = 0x9e3779b9;
  for (let i = 0; i < n; i++) {
    const ix = Math.min(nx - 1, ((pos[i * 3] - minx) / cell) | 0), iz = Math.min(nz - 1, ((pos[i * 3 + 2] - minz) / cell) | 0);
    const c = iz * nx + ix;
    h = (Math.imul(h ^ (i + 1), 0x85ebca6b) ^ (h >>> 13)) >>> 0;
    const r = h / 4294967296;
    const l = r < FRACTIONS[0] ? 0 : r < FRACTIONS[1] ? 1 : r < FRACTIONS[2] ? 2 : 3;
    cellOf[i] = c; level[i] = l; counts[c * 4 + l]++;
  }
  // prefix sums → write offsets per (cell, level)
  const start = new Uint32Array(nx * nz * 4 + 1);
  for (let k = 0; k < counts.length; k++) start[k + 1] = start[k] + counts[k];
  const cursor = start.slice(0, -1);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[cursor[cellOf[i] * 4 + level[i]]++] = i;
  // permute all attribute arrays
  const permute = (arr, comp) => { if (!arr) return arr; const out = new arr.constructor(arr.length); for (let i = 0; i < n; i++) { const s = order[i]; for (let k = 0; k < comp; k++) out[i * comp + k] = arr[s * comp + k]; } return out; };
  const out = { ...m, pos: permute(m.pos, 3), inten: permute(m.inten, 1), cls: permute(m.cls, 1), dev: permute(m.dev, 1), elem: permute(m.elem, 1), nrm: permute(m.nrm, 3), rgb: permute(m.rgb, 3), order };
  const group = new THREE.Group();
  const cells = [];
  for (let c = 0; c < nx * nz; c++) {
    const off = start[c * 4], total = start[c * 4 + 4] - off;
    if (!total) continue;
    const cum = [start[c * 4 + 1] - off, start[c * 4 + 2] - off, start[c * 4 + 3] - off, total];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(out.pos.subarray(off * 3, (off + total) * 3), 3));
    geo.setAttribute('intensity', new THREE.BufferAttribute(out.inten.subarray(off, off + total), 1, true));
    geo.setAttribute('cls', new THREE.BufferAttribute(out.cls.subarray(off, off + total), 1, false));
    geo.setAttribute('dev', new THREE.BufferAttribute(out.dev.subarray(off, off + total), 1, true));
    geo.setAttribute('elem', new THREE.BufferAttribute(out.elem.subarray(off, off + total), 1, false));
    geo.setAttribute('normal', new THREE.BufferAttribute(out.nrm.subarray(off * 3, (off + total) * 3), 3, true));
    if (out.rgb) geo.setAttribute('rgb', new THREE.BufferAttribute(out.rgb.subarray(off * 3, (off + total) * 3), 3, true));
    geo.computeBoundingSphere();
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false; // we cull ourselves
    const sphere = geo.boundingSphere.clone();
    const area = Math.max(1, Math.min(cell * cell, Math.PI * sphere.radius * sphere.radius));
    const cellObj = { points, offset: off, total, cum, sphere, spacing: Math.sqrt(area / total), lodScale: 1, drawn: 0 };
    points.onBeforeRender = () => { material.uniforms.uLodScale.value = cellObj.lodScale; material.uniformsNeedUpdate = true; };
    group.add(points);
    cells.push(cellObj);
  }
  const frustum = new THREE.Frustum(), mat = new THREE.Matrix4();
  const stats = { drawn: 0, cellsVisible: 0 };
  function update(camera, viewportH, budget = 8e6, targetPx = 1.0) {
    mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mat);
    const tanHalf = Math.tan((camera.fov / 2) * Math.PI / 180);
    let sum = 0, vis = 0;
    const want = new Float32Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!frustum.intersectsSphere(c.sphere)) { want[i] = 0; c.points.visible = false; continue; }
      const d = Math.max(1, camera.position.distanceTo(c.sphere.center) - c.sphere.radius);
      const px = (c.spacing * viewportH) / (2 * tanHalf * d);
      const f = Math.min(1, Math.max(FRACTIONS[0], (px / targetPx) ** 2));
      want[i] = f; vis++; sum += f * c.total;
    }
    const scale = sum > budget ? budget / sum : 1;
    let drawn = 0;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!want[i]) continue;
      const f = Math.max(FRACTIONS[0], want[i] * scale);
      let L = 0; while (L < 3 && FRACTIONS[L] < f) L++;
      const count = c.cum[L];
      c.points.visible = count > 0;
      c.points.geometry.setDrawRange(0, count);
      c.lodScale = 1 / Math.sqrt(count / c.total);
      c.drawn = count; drawn += count;
    }
    stats.drawn = drawn; stats.cellsVisible = vis;
    return stats;
  }
  function dispose() { for (const c of cells) c.points.geometry.dispose(); }
  return { group, cells, update, dispose, cloud: out, objects: cells.map((c) => c.points), stats };
}
