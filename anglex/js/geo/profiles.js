// 形鋼プロファイル → 板構成（plate composition）による実穴付きソリッド生成
// 部材は長さ方向を +Z、断面を XY 平面に置く。各プレートは2Dシェイプ(穴付き)を厚み方向に押し出して作るため、
// 穴・長穴は本当の貫通穴として表現される（CSG不要）。
import * as THREE from 'three';
import { ANGLES, UANGLES, CHANNELS, LIPCHANNELS, SQUARES, HBEAMS, PIPES, PVC, DENSITY } from '../data/sections.js';
import { finishMaterial } from './materials.js';

// ---- 仕様文字列のパース ----
// 'L-50x50x6' 'L50×50×6' 'L-75x50x6' '[-100x50x5x7.5' 'C-100x50x5x7.5' 'FB-6x50' 'FB6×50' 'PL-6' 'PL-6x200x300' 'SGP-50A' '50A' 'STK-60.5x3.2' '□-50x50x2.3' 'LC-40x40x1.6' 'LC-100x50x20x2.3' 'H-100x100x6x8' 'VP-50' 'RB-12'(丸鋼) 'SB-12'(丸棒)
export function parseSpec(spec) {
  if (!spec) return null;
  let s = String(spec).trim().replace(/[×ｘＸ*]/g, 'x').replace(/[－‐‑–—]/g, '-').replace(/\s+/g, '').replace(/[ーｰ]/g, '-');
  s = s.replace(/^(等辺|不等辺)?山形鋼/, 'L-').replace(/^溝形鋼/, 'C-').replace(/^平鋼/, 'FB-').replace(/^鋼板/, 'PL-').replace(/^角パイプ|^角形鋼管/, '□-').replace(/^リップ溝形鋼|^軽溝形鋼/, 'LC-');
  let m;
  if ((m = s.match(/^L-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { const [A, B, t] = [+m[1], +m[2], +m[3]]; return { kind: 'L', A, B, t, key: `${A}x${B}x${t}`, label: `L-${A}×${B}×${t}` }; }
  if ((m = s.match(/^(?:C|\[|\[-)-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?$/i))) { const H = +m[1], B = +m[2], t1 = +m[3], t2 = m[4] ? +m[4] : +m[3]; return { kind: 'C', H, B, t1, t2, key: `${H}x${B}x${t1}x${t2}`, label: `[-${H}×${B}×${t1}×${t2}` }; }
  if ((m = s.match(/^LC-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { return { kind: 'LC', H: +m[1], A: +m[2], C: +m[3], t: +m[4], key: `${m[1]}x${m[2]}x${m[3]}x${m[4]}`, label: `C-${m[1]}×${m[2]}×${m[3]}×${m[4]}（リップ）` }; }
  if ((m = s.match(/^LC-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { return { kind: 'LC', H: +m[1], A: +m[2], C: Math.round(+m[1] / 4), t: +m[3], key: `${m[1]}x${m[2]}x${Math.round(+m[1] / 4)}x${m[3]}`, label: `C-${m[1]}×${m[2]}×${m[3]}（リップ）` }; }
  if ((m = s.match(/^FB-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { const a = +m[1], b = +m[2]; const t = Math.min(a, b), w = Math.max(a, b); return { kind: 'FB', t, w, key: `${t}x${w}`, label: `FB-${t}×${w}` }; }
  if ((m = s.match(/^PL-?(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?))?$/i))) { return { kind: 'PL', t: +m[1], w: m[2] ? +m[2] : null, h: m[3] ? +m[3] : null, key: `${m[1]}`, label: `PL-${m[1]}` + (m[2] ? `×${m[2]}×${m[3]}` : '') }; }
  if ((m = s.match(/^(?:SGP|STPG|STK)?-?(\d+)A$/i))) { const p = PIPES[m[1] + 'A']; if (p) return { kind: 'PIPE', nominal: m[1] + 'A', od: p.od, t: p.t, key: m[1] + 'A', label: `SGP ${m[1]}A（φ${p.od}×${p.t}）` }; }
  if ((m = s.match(/^(?:STK|STKM|φ|PIPE)-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { return { kind: 'PIPE', od: +m[1], t: +m[2], key: `${m[1]}x${m[2]}`, label: `φ${m[1]}×${m[2]}` }; }
  if ((m = s.match(/^(?:VP|VU)-?(\d+)$/i))) { const p = PVC[m[1]]; if (p) return { kind: 'PIPE', material: 'PVC', nominal: 'VP' + m[1], od: p.od, t: p.t, key: 'VP' + m[1], label: `VP${m[1]}（φ${p.od}）` }; }
  if ((m = s.match(/^(?:□|口|SQ|STKR|RECT)-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { return { kind: 'SQ', A: +m[1], B: +m[2], t: +m[3], key: `${m[1]}x${m[2]}x${m[3]}`, label: `□-${m[1]}×${m[2]}×${m[3]}` }; }
  if ((m = s.match(/^H-?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i))) { return { kind: 'H', H: +m[1], B: +m[2], t1: +m[3], t2: +m[4], key: `${m[1]}x${m[2]}x${m[3]}x${m[4]}`, label: `H-${m[1]}×${m[2]}×${m[3]}×${m[4]}` }; }
  if ((m = s.match(/^(?:RB|SB|φ|丸鋼|M)-?(\d+(?:\.\d+)?)$/i))) { return { kind: 'RB', d: +m[1], key: m[1], label: `丸鋼 φ${m[1]}` }; }
  return null;
}

// ---- 断面性能（kg/m, cm2, cm4, cm3, 周長 mm）----
export function sectionProps(p) {
  if (!p) return null;
  const rho = DENSITY[p.material === 'PVC' ? 'PVC' : 'SS400'];
  const out = { w: 0, A: 0, Ix: 0, Zx: 0, perim: 0, source: 'calc' };
  switch (p.kind) {
    case 'L': {
      const tbl = p.A === p.B ? ANGLES[p.key] : UANGLES[p.key];
      const A = (p.A + p.B - p.t) * p.t; // mm2
      out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * (p.A + p.B);
      if (tbl) { Object.assign(out, { w: tbl.w, A: tbl.A, Ix: tbl.Ix, Zx: tbl.Zx, r1: tbl.r1, r2: tbl.r2, source: 'JIS G 3192' }); }
      else { out.r1 = Math.round(p.t * 1.2); out.r2 = Math.round(p.t * 0.6); const c = (p.A * p.A + (p.B - p.t) * p.t) / (2 * (p.A + p.B - p.t)); out.Ix = ((p.t * Math.pow(p.B, 3)) / 3 + (p.A - p.t) * Math.pow(p.t, 3) / 3 - (A) * c * c) / 1e4; out.Zx = out.Ix / ((p.B - c) / 10); }
      break; }
    case 'C': {
      const tbl = CHANNELS[p.key];
      const A = p.H * p.t1 + 2 * (p.B - p.t1) * p.t2; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * p.H + 4 * p.B;
      if (tbl) Object.assign(out, { w: tbl.w, A: tbl.A, Ix: tbl.Ix, Zx: tbl.Zx, r1: tbl.r1, r2: tbl.r2, source: 'JIS G 3192' });
      else { out.Ix = (p.B * Math.pow(p.H, 3) - (p.B - p.t1) * Math.pow(p.H - 2 * p.t2, 3)) / 12 / 1e4; out.Zx = out.Ix / (p.H / 20); }
      break; }
    case 'LC': {
      const tbl = LIPCHANNELS[p.key];
      const A = (p.H + 2 * p.A + 2 * p.C - 4 * p.t) * p.t; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * (p.H + 2 * p.A + 2 * p.C);
      if (tbl) Object.assign(out, { w: tbl.w, A: tbl.A, Ix: tbl.Ix, Zx: tbl.Zx, source: 'JIS G 3350' });
      else { out.Ix = (p.A * Math.pow(p.H, 3) - (p.A - p.t) * Math.pow(p.H - 2 * p.t, 3)) / 12 / 1e4; out.Zx = out.Ix / (p.H / 20); }
      break; }
    case 'SQ': {
      const tbl = SQUARES[p.key]; const A = 2 * (p.A + p.B) * p.t - 4 * p.t * p.t; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * (p.A + p.B) * 2;
      if (tbl) Object.assign(out, { w: tbl.w, A: tbl.A, Ix: tbl.Ix, Zx: tbl.Zx, source: 'JIS G 3466' });
      else { out.Ix = (p.B * Math.pow(p.A, 3) - (p.B - 2 * p.t) * Math.pow(p.A - 2 * p.t, 3)) / 12 / 1e4; out.Zx = out.Ix / (p.A / 20); }
      break; }
    case 'H': {
      const tbl = HBEAMS[p.key]; const A = p.H * p.t1 + 2 * (p.B - p.t1) * p.t2; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * p.H + 4 * p.B;
      if (tbl) Object.assign(out, { w: tbl.w, A: tbl.A, Ix: tbl.Ix, Zx: tbl.Zx, source: 'JIS G 3192' });
      else { out.Ix = (p.B * Math.pow(p.H, 3) - (p.B - p.t1) * Math.pow(p.H - 2 * p.t2, 3)) / 12 / 1e4; out.Zx = out.Ix / (p.H / 20); }
      break; }
    case 'FB': { const A = p.t * p.w; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * (p.t + p.w); out.Ix = p.t * Math.pow(p.w, 3) / 12 / 1e4; out.Zx = out.Ix / (p.w / 20); break; }
    case 'PL': { const w = p.w || 100; const A = p.t * w; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = 2 * (p.t + w); out.Ix = w * Math.pow(p.t, 3) / 12 / 1e4; out.Zx = out.Ix / (p.t / 20); break; }
    case 'PIPE': { const tbl = p.nominal && PIPES[p.nominal]; const ri = p.od / 2 - p.t; const A = Math.PI * (p.od * p.od / 4 - ri * ri); out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = Math.PI * p.od + Math.PI * 2 * ri;
      if (tbl) { out.w = tbl.w; out.source = 'JIS G 3452'; } out.Ix = Math.PI * (Math.pow(p.od, 4) - Math.pow(2 * ri, 4)) / 64 / 1e4; out.Zx = out.Ix / (p.od / 20); break; }
    case 'RB': { const A = Math.PI * p.d * p.d / 4; out.A = A / 100; out.w = A / 1e6 * rho * 1000; out.perim = Math.PI * p.d; out.Ix = Math.PI * Math.pow(p.d, 4) / 64 / 1e4; out.Zx = out.Ix / (p.d / 20); break; }
  }
  return out;
}

// ---- 板（plate）定義 ----
// plate: { name, w (幅 = u方向), h (高さ = v方向), t (厚 = w方向), M: Matrix4 (plate local → member local), holes:[{u,v,d,slot?:{len,ang}}], face: 穴面ID }
// plate local: u→+X, v→+Y, 厚み→+Z(0..t)
function plateMatrix(origin, uDir, vDir) {
  const u = uDir.clone().normalize(), v = vDir.clone().normalize(), w = new THREE.Vector3().crossVectors(u, v).normalize();
  return new THREE.Matrix4().makeBasis(u, v, w).setPosition(origin);
}
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), NX = new THREE.Vector3(-1, 0, 0), NY = new THREE.Vector3(0, -1, 0);

// 部材の板分解。穴 face 名と、その面での (z: 長さ方向位置, s: 幅方向位置) → plate (u,v) 変換を提供する
export function decompose(p, L) {
  const plates = [];
  const add = (name, origin, uDir, vDir, w, h, t, map) => plates.push({ name, w, h, t, M: plateMatrix(origin, uDir, vDir), holes: [], map });
  switch (p.kind) {
    case 'L': { // 角を原点、脚A: +X 方向(厚み +Y)、脚B: +Y 方向(厚み +X)、長さ +Z
      add('A', new THREE.Vector3(0, 0, 0), Z, X, L, p.A, p.t, (z, s) => [z, s]);
      add('B', new THREE.Vector3(0, p.t, 0), Y, Z, p.B - p.t, L, p.t, (z, s) => [s - p.t, z]);
      break; }
    case 'C': { // ウェブ背面 x=0（厚み +X）、y: 0..H、フランジは +X 方向に B（厚み +Y）
      add('web', new THREE.Vector3(0, 0, 0), Y, Z, p.H, L, p.t1, (z, s) => [s, z]);
      add('fb', new THREE.Vector3(p.t1, 0, 0), Z, X, L, p.B - p.t1, p.t2, (z, s) => [z, s - p.t1]);
      add('ft', new THREE.Vector3(p.t1, p.H - p.t2, 0), Z, X, L, p.B - p.t1, p.t2, (z, s) => [z, s - p.t1]);
      break; }
    case 'LC': {
      add('web', new THREE.Vector3(0, 0, 0), Y, Z, p.H, L, p.t, (z, s) => [s, z]);
      add('fb', new THREE.Vector3(p.t, 0, 0), Z, X, L, p.A - p.t, p.t, (z, s) => [z, s - p.t]);
      add('ft', new THREE.Vector3(p.t, p.H - p.t, 0), Z, X, L, p.A - p.t, p.t, (z, s) => [z, s - p.t]);
      add('lipb', new THREE.Vector3(p.A - p.t, p.t, 0), Y, Z, p.C - p.t, L, p.t, (z, s) => [s - p.t, z]);
      add('lipt', new THREE.Vector3(p.A - p.t, p.H - p.C, 0), Y, Z, p.C - p.t, L, p.t, (z, s) => [s - (p.H - p.C), z]);
      break; }
    case 'SQ': { // x: 0..A, y: 0..B
      add('bottom', new THREE.Vector3(0, 0, 0), Z, X, L, p.A, p.t, (z, s) => [z, s]);
      add('top', new THREE.Vector3(0, p.B - p.t, 0), Z, X, L, p.A, p.t, (z, s) => [z, s]);
      add('left', new THREE.Vector3(0, p.t, 0), Y, Z, p.B - 2 * p.t, L, p.t, (z, s) => [s - p.t, z]);
      add('right', new THREE.Vector3(p.A - p.t, p.t, 0), Y, Z, p.B - 2 * p.t, L, p.t, (z, s) => [s - p.t, z]);
      break; }
    case 'H': { // 中心 x=0, y: 0..H
      add('web', new THREE.Vector3(-p.t1 / 2, p.t2, 0), Y, Z, p.H - 2 * p.t2, L, p.t1, (z, s) => [s - p.t2, z]);
      add('fb', new THREE.Vector3(-p.B / 2, 0, 0), Z, X, L, p.B, p.t2, (z, s) => [z, s + p.B / 2]);
      add('ft', new THREE.Vector3(-p.B / 2, p.H - p.t2, 0), Z, X, L, p.B, p.t2, (z, s) => [z, s + p.B / 2]);
      break; }
    case 'FB': { add('face', new THREE.Vector3(0, 0, 0), Z, X, L, p.w, p.t, (z, s) => [z, s]); break; }
    case 'PL': { const w = p.w || 100, h = p.h || L; add('face', new THREE.Vector3(0, 0, 0), Z, X, h, w, p.t, (z, s) => [z, s]); break; }
  }
  return plates;
}

// 穴を板へ割り当て  hole: {face, z, s, d, slot:{len, dir:'z'|'s'}}
export function assignHoles(plates, holes = []) {
  for (const h of holes) {
    const pl = plates.find(q => q.name === h.face) || plates[0]; if (!pl) continue;
    const [u, v] = pl.map(h.z, h.s);
    pl.holes.push({ u, v, d: h.d, slot: h.slot ? { len: h.slot.len, ang: h.slot.dir === 's' ? Math.PI / 2 : 0 } : null, id: h.id, kind: h.kind || (h.slot ? 'slot' : 'round') });
  }
}

function holePath(h) {
  const path = new THREE.Path();
  if (h.slot && h.slot.len > h.d) { // 長穴: 両端半円 + 直線
    const r = h.d / 2, half = (h.slot.len - h.d) / 2, a = h.slot.ang;
    const c = Math.cos(a), s = Math.sin(a);
    const P = (x, y) => [h.u + x * c - y * s, h.v + x * s + y * c];
    const p1 = P(-half, -r), p2 = P(half, -r); path.moveTo(...p1); path.lineTo(...p2);
    path.absarc(...P(half, 0), r, a - Math.PI / 2, a + Math.PI / 2, false);
    path.lineTo(...P(-half, r)); path.absarc(...P(-half, 0), r, a + Math.PI / 2, a + 3 * Math.PI / 2, false);
  } else path.absarc(h.u, h.v, h.d / 2, 0, Math.PI * 2, false);
  return path;
}
export function holeArea(h) { const r = h.d / 2; return h.slot && h.slot.len > h.d ? Math.PI * r * r + (h.slot.len - h.d) * h.d : Math.PI * r * r; }
export function holePerimeter(h) { const r = h.d / 2; return h.slot && h.slot.len > h.d ? 2 * Math.PI * r + 2 * (h.slot.len - h.d) : 2 * Math.PI * r; }

// 板 → メッシュ
function plateMesh(pl, material, lod) {
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(pl.w, 0); shape.lineTo(pl.w, pl.h); shape.lineTo(0, pl.h); shape.closePath();
  for (const h of pl.holes) shape.holes.push(holePath(h));
  const bev = lod >= 400 && pl.t >= 2 ? Math.min(0.45, pl.t * 0.12) : 0;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: pl.t - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1, curveSegments: lod >= 400 ? 24 : 12 });
  if (bev > 0) geo.translate(0, 0, bev);
  geo.applyMatrix4(pl.M);
  // UV: スパングル等のスケール（mm→タイル 200mm）
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 130, uv.getY(i) / 130);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material); mesh.userData.plate = pl.name; mesh.castShadow = mesh.receiveShadow = true; return mesh;
}
// 根元Rのフィレット帯（L・C の内隅）: LOD300 以上
function filletStrip(r, L, material, origin, quadrant) {
  if (!r || r <= 0) return null;
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(r, 0); s.absarc(r, r, r, -Math.PI / 2, -Math.PI, true); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 6 });
  if (quadrant === 2) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); // mirror x
  if (quadrant === 3) g.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1));
  g.translate(origin.x, origin.y, origin.z); g.computeVertexNormals(); const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; m.userData.fillet = true; return m;
}

// 円管（内径付き）
function pipeMesh(p, L, material, lod) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, p.od / 2, 0, Math.PI * 2, false);
  const inner = new THREE.Path(); inner.absarc(0, 0, p.od / 2 - p.t, 0, Math.PI * 2, true); shape.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: lod >= 400 ? 48 : 24 });
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; m.userData.plate = 'pipe'; return m;
}

// ---- 公開 API: 部材ソリッド ----
// opts: { spec, length, holes:[], finish, lod (200|300|400), material }
export function buildMember(opts) {
  const p = typeof opts.spec === 'string' ? parseSpec(opts.spec) : opts.spec; if (!p) throw new Error('unknown spec: ' + opts.spec);
  const L = opts.length || 1000, lod = opts.lod || 300;
  const mat = opts.material || finishMaterial(p.material === 'PVC' ? 'PVC' : (opts.finish || 'HDZ'));
  const g = new THREE.Group(); g.name = p.label; g.userData.profile = p; g.userData.length = L;
  if (p.kind === 'PIPE' || p.kind === 'RB') {
    if (p.kind === 'RB') { const geo = new THREE.CylinderGeometry(p.d / 2, p.d / 2, L, lod >= 400 ? 32 : 16); geo.rotateX(Math.PI / 2); geo.translate(0, 0, L / 2); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); }
    else g.add(pipeMesh(p, L, mat, lod));
    g.userData.plates = []; return g;
  }
  const plates = decompose(p, L); assignHoles(plates, opts.holes || []);
  for (const pl of plates) g.add(plateMesh(pl, mat, lod));
  if (lod >= 300) {
    const sp = sectionProps(p);
    if (p.kind === 'L' && sp.r1) g.add(filletStrip(sp.r1, L, mat, new THREE.Vector3(p.t, p.t, 0), 1));
    if (p.kind === 'C' && sp.r1) { g.add(filletStrip(sp.r1, L, mat, new THREE.Vector3(p.t1, p.t2, 0), 1)); g.add(filletStrip(sp.r1, L, mat, new THREE.Vector3(p.t1, p.H - p.t2, 0), 3)); }
  }
  g.userData.plates = plates;
  return g;
}

// 断面 2D 輪郭（図面用 SVG / DXF 用）
export function sectionOutline(p) {
  switch (p.kind) {
    case 'L': return [[0, 0], [p.A, 0], [p.A, p.t], [p.t, p.t], [p.t, p.B], [0, p.B]];
    case 'C': return [[0, 0], [p.B, 0], [p.B, p.t2], [p.t1, p.t2], [p.t1, p.H - p.t2], [p.B, p.H - p.t2], [p.B, p.H], [0, p.H]];
    case 'LC': return [[0, 0], [p.A, 0], [p.A, p.C], [p.A - p.t, p.C], [p.A - p.t, p.t], [p.t, p.t], [p.t, p.H - p.t], [p.A - p.t, p.H - p.t], [p.A - p.t, p.H - p.C], [p.A, p.H - p.C], [p.A, p.H], [0, p.H]];
    case 'SQ': return [[0, 0], [p.A, 0], [p.A, p.B], [0, p.B]];
    case 'H': return [[-p.B / 2, 0], [p.B / 2, 0], [p.B / 2, p.t2], [p.t1 / 2, p.t2], [p.t1 / 2, p.H - p.t2], [p.B / 2, p.H - p.t2], [p.B / 2, p.H], [-p.B / 2, p.H], [-p.B / 2, p.H - p.t2], [-p.t1 / 2, p.H - p.t2], [-p.t1 / 2, p.t2], [-p.B / 2, p.t2]];
    case 'FB': return [[0, 0], [p.w, 0], [p.w, p.t], [0, p.t]];
    case 'PL': { const w = p.w || 100; return [[0, 0], [w, 0], [w, p.t], [0, p.t]]; }
    case 'PIPE': { const pts = []; for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; pts.push([Math.cos(a) * p.od / 2, Math.sin(a) * p.od / 2]); } return pts; }
    case 'RB': { const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([Math.cos(a) * p.d / 2, Math.sin(a) * p.d / 2]); } return pts; }
  }
  return [];
}
// 断面の外形寸法 (bbox) — 配置・接合計算用
export function sectionBox(p) {
  const pts = sectionOutline(p); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
// 穴面の一覧（UI 用）
export function holeFaces(p) {
  return ({ L: ['A', 'B'], C: ['web', 'ft', 'fb'], LC: ['web', 'ft', 'fb'], SQ: ['top', 'bottom', 'left', 'right'], H: ['web', 'ft', 'fb'], FB: ['face'], PL: ['face'], PIPE: [], RB: [] })[p.kind] || [];
}
export const FACE_LABEL = { A: '脚A（水平脚）', B: '脚B（垂直脚）', web: 'ウェブ', ft: '上フランジ', fb: '下フランジ', top: '上面', bottom: '下面', left: '左面', right: '右面', face: '板面' };
