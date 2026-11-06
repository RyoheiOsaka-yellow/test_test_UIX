// 建設モード: 架空の超高層商業複合ビルをパラメータから生成し、街に建てる。
// 評価: 最寄り駅までの歩行距離 (歩行者ネットワーク上の最短路) と、階ごとの眺望 (24 方位の遮蔽判定)。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

export const TOWER_NAME = 'みなとみらい セントラルタワー（架空）';
const FLOOR_H = 3.6;
export const DEFAULTS = { x: -407.6, y: 373.2, ang: -33, floors: 85, podFloors: 6, podHalf: 58, podHalfB: 47, towerHalf: 29, officeRatio: 72, crown: 25 };

// ---- 形状 --------------------------------------------------------------------------
function chamfered(cx, cy, half, cut, ang, halfB = half) {
  const pts = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const a = [[sx * half, sy * (halfB - cut)], [sx * (half - cut), sy * halfB]];
    if (sx * sy < 0) a.reverse();
    pts.push(...a);
  }
  pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
class MB {
  constructor() { this.v = []; this.i = []; }
  tri(a, b, c) { const k = this.v.length / 3; this.v.push(...a, ...b, ...c); this.i.push(k, k + 1, k + 2); }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  prism(lo, z0, hi, z1) { const n = lo.length; for (let i = 0; i < n; i++) { const a = lo[i], b = lo[(i + 1) % n], c = hi[(i + 1) % n], d = hi[i]; this.quad([a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z1], [d[0], d[1], z1]); } }
  cap(ring, z, up = true) { const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length; const n = ring.length; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; up ? this.tri([cx, cy, z], [a[0], a[1], z], [b[0], b[1], z]) : this.tri([cx, cy, z], [b[0], b[1], z], [a[0], a[1], z]); } }
}
export function buildTowerGeometry(p, ground) {
  const mb = new MB(); const ang = p.ang * Math.PI / 180; const z = ground; const { x: cx, y: cy } = p;
  const pod = chamfered(cx, cy, p.podHalf, Math.min(14, p.podHalf * 0.22), ang, p.podHalfB); const zPod = z + p.podFloors * FLOOR_H;
  mb.cap(pod, z, false); mb.prism(pod, z, pod, zPod); mb.cap(pod, zPod);
  if (p.podFloors >= 2) { const can = chamfered(cx, cy, p.podHalf + 5, Math.min(16, p.podHalf * 0.25), ang, p.podHalfB + 5); const zc = z + 2 * FLOOR_H; mb.cap(can, zc, false); mb.prism(can, zc, can, zc + 0.6); mb.cap(can, zc + 0.6); }
  const tf = p.floors - p.podFloors; const f1 = p.podFloors + Math.round(tf * 0.56), f2 = p.podFloors + Math.round(tf * 0.86);
  const segs = [[p.towerHalf, p.podFloors, f1], [p.towerHalf * 0.86, f1, f2], [p.towerHalf * 0.72, f2, p.floors]];
  let areaSum = 0;
  for (const [half, a, b] of segs) {
    if (b <= a) continue;
    const ring = chamfered(cx, cy, half, half * 0.27, ang); const z0 = z + a * FLOOR_H, z1 = z + b * FLOOR_H;
    mb.cap(ring, z0, false); mb.prism(ring, z0, ring, z1); mb.cap(ring, z1);
    areaSum += (b - a) * (2 * half) * (2 * half) * 0.93;
    for (let i = 0; i < ring.length; i++) {
      const A = ring[i], B = ring[(i + 1) % ring.length]; const L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 20) continue;
      const nx = (B[1] - A[1]) / L, ny = -(B[0] - A[0]) / L;
      for (const t of [0.33, 0.67]) {
        const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t, ux = (B[0] - A[0]) / L * 0.6, uy = (B[1] - A[1]) / L * 0.6;
        const fin = [[px - ux, py - uy], [px + ux, py + uy], [px + ux + nx * 0.8, py + uy + ny * 0.8], [px - ux + nx * 0.8, py - uy + ny * 0.8]];
        mb.prism(fin, z0, fin, z1);
      }
    }
  }
  const top = z + p.floors * FLOOR_H; const th = p.towerHalf * 0.72;
  const r0 = chamfered(cx, cy, th, th * 0.27, ang), r1 = chamfered(cx, cy, th * 0.42, th * 0.11, ang);
  mb.prism(r0, top, r1, top + p.crown * 0.7); mb.cap(r1, top + p.crown * 0.7);
  const sp = chamfered(cx, cy, 1.2, 0.3, ang); mb.prism(sp, top + p.crown * 0.7, sp, top + p.crown); mb.cap(sp, top + p.crown);
  areaSum += p.podFloors * (2 * p.podHalf) * (2 * p.podHalfB) * 0.95;
  // three 座標へ (x, h, -y)
  const pos = new Float32Array(mb.v.length);
  for (let i = 0; i < mb.v.length; i += 3) { pos[i] = mb.v[i]; pos[i + 1] = mb.v[i + 2]; pos[i + 2] = -mb.v[i + 1]; }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(mb.i);
  g = mergeVertices(g, 1e-3); g.computeVertexNormals(); g.computeBoundingSphere();
  return { geometry: g, height: p.floors * FLOOR_H + p.crown, pod, floorArea: areaSum, top: top + p.crown };
}

// ---- テナント生成 ------------------------------------------------------------------
const W1 = ['ベイサイド', 'ハーバー', 'ミナト', 'シーサイド', 'ブルー', 'ポート', 'マリン', 'グラン', 'ノース', 'セントラル', 'アトリエ', 'スカイ', 'ルミナ', 'ソラ', 'テラス'];
const W2 = { '飲食': ['キッチン', 'カフェ', '食堂', 'ビストロ', 'ダイニング', 'ベーカリー', 'ラーメン', '鮨', 'グリル', '珈琲'], '物販': ['ストア', 'ブティック', '雑貨店', 'セレクト', 'ブックス', 'スポーツ', 'コスメ', 'トイズ', 'マーケット', 'ギャラリー'], 'サービス': ['サロン', 'クリニック', 'スタジオ', 'ラボ', 'ジム', '教室', 'トラベル', 'フォト'], '医療': ['クリニック', '歯科', '薬局'], '公共': ['シネマ', 'ホール', 'ミュージアム', 'ラウンジ'], '宿泊': ['ホテル'], 'オフィス': ['株式会社', '合同会社', '法律事務所', 'デザイン事務所', 'ホールディングス', 'テクノロジーズ'] };
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export function genTenants(p, refGuide) {
  const rng = mulberry(21); const pick = a => a[Math.floor(rng() * a.length)];
  const guide = new Map(); const add = (fl, z) => { if (!guide.has(fl)) guide.set(fl, []); guide.get(fl).push({ zone: '', name: '', category: 'その他', share: 1, source: 'fictional', url: '', hours: '', tel: '', website: '', genre: '架空テナント', ...z }); };
  const mixOf = fl => { const zs = refGuide?.get(fl); if (!zs || !zs.length) return null; const m = {}; for (const z of zs) m[z.category] = (m[z.category] || 0) + 1; return m; };
  const commercial = []; // [fl, count, mix]
  commercial.push([-2, 4, { 'サービス': 3, '飲食': 1 }], [-1, 14, mixOf(-1) || { '物販': 2, '飲食': 1 }]);
  for (let f = 0; f < p.podFloors; f++) commercial.push([f, f === p.podFloors - 1 ? 8 : 14, f >= 5 ? { '飲食': 3, '公共': 1 } : (mixOf(f) || { '物販': 2, '飲食': 1 })]);
  for (const [fl, n, mix] of commercial) {
    const total = Object.values(mix).reduce((a, b) => a + b, 0); let seq = [];
    for (const [c, k] of Object.entries(mix).sort((a, b) => b[1] - a[1])) seq.push(...Array(Math.max(1, Math.round(n * k / total))).fill(c));
    seq = seq.concat(seq, seq).slice(0, n); for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
    seq.forEach((c, i) => add(fl, { zone: String(i + 1), name: `${pick(W1)} ${pick(W2[c] || W2['物販'])}`, category: c, share: pick([1, 1, 1.5, 2]), hours: '10:00〜21:00（架空）' }));
  }
  const tf = p.floors - p.podFloors; const officeN = Math.round((tf - 3) * p.officeRatio / 100);
  for (let f = p.podFloors; f < p.floors - 3; f++) {
    if (f < p.podFloors + officeN) add(f, { name: `${pick(W1)} ${pick(W2['オフィス'])}`, category: 'オフィス' });
    else add(f, { name: 'ミナト スカイホテル（架空） 客室階', category: '宿泊' });
  }
  add(p.floors - 3, { zone: '1', name: 'スカイダイニング ミナト（架空）', category: '飲食', hours: '11:00〜23:00（架空）' });
  add(p.floors - 2, { zone: '1', name: '展望ロビー セントラルビュー（架空）', category: '公共', hours: '10:00〜22:00（架空）' });
  add(p.floors - 1, { zone: '1', name: 'スカイデッキ（架空）', category: '公共', hours: '10:00〜21:00（架空）' });
  return guide;
}

// ---- 評価 ------------------------------------------------------------------------------
function dijkstraAll(graph, src) {
  const dist = new Map([[src, 0]]); const heap = [[0, src]];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, n] = pop(); if (d > (dist.get(n) ?? Infinity)) continue;
    for (const { li, forward } of graph.adj.get(n) ?? []) { const l = graph.links[li]; const nx = forward ? l.b : l.a; const nd = d + l.length; if (nd < (dist.get(nx) ?? Infinity)) { dist.set(nx, nd); push(nd, nx); } }
  }
  return dist;
}
const pointInPoly = (x, y, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };

// ---- 本体 ------------------------------------------------------------------------------
export function initConstruction(ctx) {
  const { THREE: T, groups, buildingMeta, buildingMesh, terrainSampler, drawingMaterial, cityMaterial, setupStyledMesh, sectionPlanes, DISP_PARS, addDispUniforms, dispUniforms, updateBldTex, floorGuide, guideFor, graph, addTowerLinks, makeTextSprite, labelsGroup, header, raycaster, selectBuilding, clearSelection, isSelected, refreshFlow, canvas, pointer, activeCamera, onPlaceModeChange } = ctx;
  const params = { ...DEFAULTS };
  const bid = buildingMeta.length;
  const meta = { n: TOWER_NAME, parts: 1, h: 0, fn: null, c: [0, 0], z: [0, 0], bb: [0, 0, 0, 0], fictional: true, runtime: true };
  buildingMeta.push(meta);
  // メッシュ (面 + 細線 + 太線)。ジオメトリを差し替えて更新する
  const mesh = new T.Mesh(new T.BufferGeometry(), drawingMaterial()); mesh.userData.bid = bid; mesh.name = 'tower'; groups.buildings.add(mesh);
  const thin = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, clippingPlanes: sectionPlanes }));
  const thickMat = new LineMaterial({ color: 0xffffff, linewidth: 1.8, worldUnits: false, transparent: true, opacity: 0.9, depthWrite: true, clippingPlanes: sectionPlanes }); thickMat.fog = true; thickMat.resolution.set(innerWidth, innerHeight);
  const thick = new LineSegments2(new LineSegmentsGeometry(), thickMat);
  thin.material.onBeforeCompile = sh => { addDispUniforms(sh); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float bid; varying float vBidL;\n' + DISP_PARS).replace('#include <begin_vertex>', 'vBidL = bid; vec3 transformed = vec3(position) + disp(bid);'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidL;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidL - uHide) < 0.5) discard;'); };
  thin.material.customProgramCacheKey = () => 'thinDisp';
  thickMat.onBeforeCompile = sh => { addDispUniforms(sh); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float bidInst; varying float vBidL;\n' + DISP_PARS).replace('void main() {', 'void main() {\n\tvBidL = bidInst; vec3 dOff = disp(bidInst);').replaceAll('vec4( instanceStart, 1.0 )', 'vec4( instanceStart + dOff, 1.0 )').replaceAll('vec4( instanceEnd, 1.0 )', 'vec4( instanceEnd + dOff, 1.0 )'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHide; varying float vBidL;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vBidL - uHide) < 0.5) discard;'); };
  thickMat.customProgramCacheKey = () => 'thickDisp';
  groups.edges.add(thin, thick);
  setupStyledMesh(mesh, mesh.material, cityMaterial({ windows: true }), { thin, thick }, 'bldg');
  const label = makeTextSprite('セントラルタワー（架空）', '#7ef0ff', { scale: 0.2, themeColor: t => t.label }); label.userData.kind = 'station'; label.userData.fadeFrom = 2600; labelsGroup.add(label);
  let built = null;

  function build() {
    const ground = Math.max(0, terrainSampler(params.x, params.y));
    built = buildTowerGeometry(params, ground);
    const g = built.geometry; const n = g.attributes.position.count;
    g.setAttribute('bid', new T.BufferAttribute(new Float32Array(n).fill(bid), 1));
    mesh.geometry.dispose(); mesh.geometry = g;
    const eThin = new T.EdgesGeometry(g, 14); eThin.setAttribute('bid', new T.BufferAttribute(new Float32Array(eThin.attributes.position.count).fill(bid), 1));
    thin.geometry.dispose(); thin.geometry = eThin;
    const eThick = new LineSegmentsGeometry().fromEdgesGeometry(new T.EdgesGeometry(g, 60)); eThick.setAttribute('bidInst', new T.InstancedBufferAttribute(new Float32Array(eThick.attributes.instanceStart.count).fill(bid), 1));
    thick.geometry.dispose(); thick.geometry = eThick; thick.computeLineDistances();
    const pos = g.attributes.position; let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = -pos.getZ(i), z = pos.getY(i); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
    Object.assign(meta, { h: Math.round(built.height * 10) / 10, c: [Math.round(params.x * 10), Math.round(params.y * 10)], z: [Math.round(zmin * 10) / 10, Math.round(zmax * 10) / 10], bb: [xmin * 10, ymin * 10, xmax * 10, ymax * 10].map(Math.round) });
    updateBldTex(bid, meta.h, params.x, params.y);
    floorGuide.set(TOWER_NAME, genTenants(params, guideFor('MARK IS minatomirai')));
    // エントランス (直交方向の負側 = 正面) をネットワークへ
    const a = params.ang * Math.PI / 180; const ex = params.x - Math.sin(a) * -(params.podHalfB + 2), ey = params.y + Math.cos(a) * -(params.podHalfB + 2);
    addTowerLinks(ex, ey, params.x, params.y);
    label.position.set(params.x, ground + built.height + 14, -params.y);
    if (isSelected(bid)) { clearSelection(); selectBuilding(bid); }
    refreshFlow();
    return overlapReport();
  }
  function overlapReport() {
    const ring = built.pod; const hits = [];
    for (let i = 0; i < buildingMeta.length; i++) {
      if (i === bid) continue; const m = buildingMeta[i]; const cx = m.c[0] / 10, cy = m.c[1] / 10;
      if (pointInPoly(cx, cy, ring) && (m.h ?? 0) > 2) hits.push(m);
    }
    return hits;
  }
  function evaluate(floor) {
    // 駅までの歩行距離
    const dist = dijkstraAll(graph, graph.towerLobby);
    const stations = [];
    for (const l of header.labels) {
      if (l.kind !== 'station' || l.n.includes('架空')) continue;
      let best = Infinity;
      for (const n of graph.nodes) { if (Math.hypot(n.x - l.p[0], n.y - l.p[1]) < 70) { const d = dist.get(n.id); if (d != null && d < best) best = d; } }
      if (best < Infinity) stations.push({ name: l.n, m: Math.round(best), min: Math.max(1, Math.round(best / 80)) });
    }
    stations.sort((a, b) => a.m - b.m);
    // 眺望: 24 方位の水平レイ
    const ground = Math.max(0, terrainSampler(params.x, params.y)); const h = ground + floor * FLOOR_H + 1.6;
    const origin = new T.Vector3(params.x, h, -params.y); const rc = new T.Raycaster(); rc.far = 2500;
    const sea = header.water.sea.map(p => p[0].map(q => [q[0] / 10, q[1] / 10]));
    const dirs = [];
    for (let k = 0; k < 24; k++) {
      const az = k * 15 * Math.PI / 180; // 北から時計回り
      const dx = Math.sin(az), dy = Math.cos(az);
      rc.set(origin, new T.Vector3(dx, 0, -dy));
      const hit = rc.intersectObject(buildingMesh, false)[0];
      let blocker = null;
      if (hit) { const i = ctx.findBuilding(hit.faceIndex); blocker = { name: buildingMeta[i]?.n ?? '（名称なし）', d: Math.round(hit.distance) }; }
      const free = hit ? hit.distance : 2500;
      const seaVisible = !hit || hit.distance > 700 ? sea.some(poly => pointInPoly(params.x + dx * 700, params.y + dy * 700, poly) || pointInPoly(params.x + dx * 1200, params.y + dy * 1200, poly)) : false;
      dirs.push({ az: k * 15, free, blocker, seaVisible });
    }
    return { stations, dirs, floor, h: Math.round(h) };
  }
  function siteFromClick() {
    raycaster.setFromCamera(pointer, activeCamera);
    const hit = raycaster.intersectObjects(groups.terrain.children, false)[0];
    return hit ? { x: hit.point.x, y: -hit.point.z } : null;
  }
  return { params, bid, mesh, build, evaluate, overlapReport, siteFromClick, get built() { return built; } };
}

export function compassSVG(ev) {
  const R = 60, cx = 70, cy = 70; let paths = '';
  for (const d of ev.dirs) {
    const a0 = (d.az - 7.5) * Math.PI / 180, a1 = (d.az + 7.5) * Math.PI / 180; const r = R * Math.min(1, d.free / 1200);
    const p = (a, rr) => `${(cx + rr * Math.sin(a)).toFixed(1)},${(cy - rr * Math.cos(a)).toFixed(1)}`;
    const col = d.seaVisible ? '#3b8cff' : d.free > 600 ? '#2fb27a' : d.free > 200 ? '#e8a33d' : '#d04a7a';
    paths += `<path d="M${cx},${cy} L${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} Z" fill="${col}" opacity="0.8"><title>${d.az}°: ${d.blocker ? d.blocker.name + ' ' + d.blocker.d + 'm' : '開放'}${d.seaVisible ? '（海が見える）' : ''}</title></path>`;
  }
  return `<svg viewBox="0 0 140 140" width="140" height="140"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#5f7ba0" stroke-dasharray="2 3"/>${paths}<text x="${cx}" y="12" font-size="9" fill="#9fb3d1" text-anchor="middle">N</text><text x="132" y="${cy + 3}" font-size="9" fill="#9fb3d1" text-anchor="middle">E</text><text x="${cx}" y="137" font-size="9" fill="#9fb3d1" text-anchor="middle">S</text><text x="8" y="${cy + 3}" font-size="9" fill="#9fb3d1" text-anchor="middle">W</text></svg>`;
}
