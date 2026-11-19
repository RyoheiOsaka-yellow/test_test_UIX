// ================= XANTALOS Space：当たり判定と経路探索 =================
// シーンの形状から階ごとの通行グリッド（0.2 m）を作る。腰の高さ帯（床+0.2〜1.7 m）にかかる三角形を障害物として塗り、
// アバターの半径ぶん膨らませてから、扉・席を開ける。クリック移動は A* で経路を引き、見通しで間引いて歩く。
const NAV = { cell:0.2, floors:{}, ready:false, building:false, builtAt:0, assetsSeen:-1, stats:null };
const NAV_BAND = [0.2, 1.7], NAV_RADIUS = 1;   // 膨張セル数（0.2 m）

function navBoundsFor(f){ const { x0, x1, zh, terraceZ } = BLD;
  return f === 1 ? { x0: -SITE.w / 2, x1: SITE.w / 2, z0: -SITE.d / 2, z1: SITE.d / 2 + 14 } : { x0: x0 - 0.5, x1: x1 + 0.5, z0: zh - 2.2, z1: terraceZ + 0.2 }; }
function navGrid(f){ return NAV.floors[f]; }
function navIdx(g, x, z){ const ix = Math.floor((x - g.x0) / NAV.cell), iz = Math.floor((z - g.z0) / NAV.cell); if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) return -1; return iz * g.nx + ix; }
function navFree(f, x, z){ if (!NAV.ready) return true; const g = navGrid(f); if (!g) return true; const i = navIdx(g, x, z); return i >= 0 && !g.block[i]; }

// 扉の開口（建物の作りと同じ規則で求める）：{ f, x, z, w, across:"x"|"z" }（across＝通り抜ける向き）
function navDoors(){ const { zh, z1, x0, x1 } = BLD; const out = [];
  for (const zn of ZONES.filter(z => z[2] === 1 && z[6] === 2 && z[7] === 18)){ if (zn[0] === "show") continue; out.push({ f:1, x:(zn[4] + zn[5]) / 2, z:zh, w:1.6, across:"z" }); }
  for (const f of [1, 2, 3]){ const zs = ZONES.filter(z => z[2] === f && z[6] === 2 && z[7] === 18).sort((a, b) => a[4] - b[4]);
    for (let i = 0; i < zs.length - 1; i++){ if (zs[i][0] === "lobby" && zs[i + 1][0] === "show") continue; out.push({ f, x:zs[i][5], z:zh + 3, w:1.6, across:"x" }); } }
  out.push({ f:1, x:x0 + 7.1, z:z1 + 0.2, w:2.6, across:"z" });                            // 正面玄関
  for (const x of [x0 + 10, x1 - 10]) out.push({ f:2, x, z:z1 + 0.15, w:2.2, across:"z" }); // テラス出入口
  return out; }

function navCollectMeshes(){ const list = []; const floorRoots = new Set([FL[1], FL[2], FL[3], FL.roof].filter(Boolean));
  (function walk(o){ if (o === SP_ROOT || o === MOVERS) return; if (!o.visible && !floorRoots.has(o)) return;
    if (o.userData.person || o.userData.legs || o.name === "seatedPeople" || o.isSprite || o.isLine || o.isPoints) return;
    if (o.isMesh && o.geometry && o.geometry.attributes.position){ const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.visible !== false && m.colorWrite !== false && !(m.transparent && m.opacity < 0.05)) list.push(o); }
    for (const c of o.children) walk(c); })(scene);
  return list; }

// 三角形をグリッドに塗る（辺は 0.5 セル刻みで、面は中心点の内外判定で）
function navRasterTri(g, ax, az, bx, bz, cx, cz){ const c = NAV.cell, inv = 1 / c; const mark = (x, z) => { const ix = Math.floor((x - g.x0) * inv), iz = Math.floor((z - g.z0) * inv); if (ix >= 0 && iz >= 0 && ix < g.nx && iz < g.nz) g.block[iz * g.nx + ix] = 1; };
  for (const [px, pz, qx, qz] of [[ax, az, bx, bz], [bx, bz, cx, cz], [cx, cz, ax, az]]){ const L = Math.hypot(qx - px, qz - pz); const n = Math.max(1, Math.ceil(L / (c * 0.5))); for (let k = 0; k <= n; k++){ const t = k / n; mark(px + (qx - px) * t, pz + (qz - pz) * t); } }
  const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az); if (Math.abs(area) < c * c * 0.5) return;
  const mnx = Math.max(0, Math.floor((Math.min(ax, bx, cx) - g.x0) * inv)), mxx = Math.min(g.nx - 1, Math.floor((Math.max(ax, bx, cx) - g.x0) * inv));
  const mnz = Math.max(0, Math.floor((Math.min(az, bz, cz) - g.z0) * inv)), mxz = Math.min(g.nz - 1, Math.floor((Math.max(az, bz, cz) - g.z0) * inv));
  const s = Math.sign(area);
  for (let iz = mnz; iz <= mxz; iz++){ const pz = g.z0 + (iz + 0.5) * c; for (let ix = mnx; ix <= mxx; ix++){ const px = g.x0 + (ix + 0.5) * c;
    const w0 = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) * s, w1 = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) * s, w2 = ((ax - px) * (bz - pz) - (bx - px) * (az - pz)) * s;
    if (w0 >= 0 && w1 >= 0 && w2 >= 0) g.block[iz * g.nx + ix] = 1; } } }

// グリッドを作る（重いので数ミリ秒ずつ分けて実行し、操作を止めない）
async function navBuild(){ if (NAV.building) return; NAV.building = true; if (typeof AS !== "undefined") NAV.assetsSeen = AS.loaded; const t0 = performance.now(); const floors = {};
  for (const f of [1, 2, 3]){ const b = navBoundsFor(f); const nx = Math.ceil((b.x1 - b.x0) / NAV.cell), nz = Math.ceil((b.z1 - b.z0) / NAV.cell); floors[f] = { f, x0:b.x0, z0:b.z0, nx, nz, block:new Uint8Array(nx * nz), y:BLD.lv[f - 1] }; }
  const meshes = navCollectMeshes(); scene.updateMatrixWorld(true);
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4(); let tris = 0, slice = performance.now();
  for (const mesh of meshes){ const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index; const nInst = mesh.isInstancedMesh ? mesh.count : 1;
    const ntri = idx ? idx.count / 3 : pos.count / 3; const wp = new Float32Array(pos.count * 3);
    for (let inst = 0; inst < nInst; inst++){ if (mesh.isInstancedMesh){ mesh.getMatrixAt(inst, im); m4.multiplyMatrices(mesh.matrixWorld, im); } else m4.copy(mesh.matrixWorld);
      let ymin = Infinity, ymax = -Infinity;
      for (let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i).applyMatrix4(m4); wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z; if (v.y < ymin) ymin = v.y; if (v.y > ymax) ymax = v.y; }
      for (const f of [1, 2, 3]){ const g = floors[f]; const lo = g.y + NAV_BAND[0], hi = g.y + NAV_BAND[1]; if (ymax < lo || ymin > hi) continue;
        for (let t = 0; t < ntri; t++){ const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          const ay = wp[a * 3 + 1], by = wp[b * 3 + 1], cy = wp[c * 3 + 1]; if (Math.max(ay, by, cy) < lo || Math.min(ay, by, cy) > hi) continue;
          navRasterTri(g, wp[a * 3], wp[a * 3 + 2], wp[b * 3], wp[b * 3 + 2], wp[c * 3], wp[c * 3 + 2]); tris++; } } }
    if (performance.now() - slice > 12){ await new Promise(r => setTimeout(r, 0)); slice = performance.now(); } }
  // 膨張（アバターの半径）→ 扉と席を開ける
  for (const f of [1, 2, 3]){ const g = floors[f]; const src = g.block, dst = new Uint8Array(src.length);
    for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++){ if (!src[iz * g.nx + ix]) continue;
      for (let dz = -NAV_RADIUS; dz <= NAV_RADIUS; dz++) for (let dx = -NAV_RADIUS; dx <= NAV_RADIUS; dx++){ const x = ix + dx, z = iz + dz; if (x >= 0 && z >= 0 && x < g.nx && z < g.nz) dst[z * g.nx + x] = 1; } }
    g.block = dst; }
  const clearRect = (g, xa, xb, za, zb) => { for (let z = za; z <= zb; z += NAV.cell * 0.5) for (let x = xa; x <= xb; x += NAV.cell * 0.5){ const i = navIdx(g, x, z); if (i >= 0) g.block[i] = 0; } };
  for (const d of navDoors()){ const g = floors[d.f]; if (d.across === "z") clearRect(g, d.x - d.w / 2 + 0.2, d.x + d.w / 2 - 0.2, d.z - 0.7, d.z + 0.7); else clearRect(g, d.x - 0.7, d.x + 0.7, d.z - d.w / 2 + 0.2, d.z + d.w / 2 - 0.2); }
  for (const st of spSeats()){ const g = floors[st.f]; const r = 0.42; for (let z = -r; z <= r; z += 0.1) for (let x = -r; x <= r; x += 0.1){ if (x * x + z * z > r * r) continue; const i = navIdx(g, st.x + x, st.z + z); if (i >= 0) g.block[i] = 0; } }
  NAV.floors = floors; NAV.ready = true; NAV.building = false; NAV.builtAt = performance.now();
  NAV.stats = { meshes: meshes.length, tris, ms: Math.round(performance.now() - t0), free: [1, 2, 3].map(f => { const g = floors[f]; let n = 0; for (const b of g.block) if (!b) n++; return +(n / g.block.length).toFixed(2); }) };
  console.info("[space] nav grid", NAV.stats);
  spNavFixPosition(); }

// アセット（実物モデル）が読み込まれたら作り直す（10 秒に 1 回まで）
setInterval(() => { if (!SP.started || NAV.building || typeof AS === "undefined") return; if (AS.loaded !== NAV.assetsSeen && performance.now() - NAV.builtAt > 10000){ NAV.assetsSeen = AS.loaded; navBuild(); } }, 3000);

// いまの位置がふさがっていたら近くの空きへずらす（ワープ直後など）
function navNearestFree(f, x, z, maxR = 4){ const g = navGrid(f); if (!g || !NAV.ready) return { x, z }; const i0 = navIdx(g, x, z); if (i0 >= 0 && !g.block[i0]) return { x, z };
  const c = NAV.cell; for (let r = 1; r * c <= maxR; r++){ let best = null, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++){ if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const px = x + dx * c, pz = z + dz * c; const i = navIdx(g, px, pz); if (i >= 0 && !g.block[i]){ const d = dx * dx + dz * dz; if (d < bd){ bd = d; best = { x:px, z:pz }; } } }
    if (best) return best; }
  return null; }
function spNavFixPosition(){ const p = SP.pos; if (p.po) return; const q = navNearestFree(p.f, p.x, p.z); if (q && (q.x !== p.x || q.z !== p.z)){ p.x = q.x; p.z = q.z; spSendPos(true); } }

// 1 歩ぶんの移動（壁沿いに滑る）。いまの場所がふさがっているときは抜け出せるよう許す
function navStep(p, dx, dz){ if (!NAV.ready) { p.x += dx; p.z += dz; return true; }
  if (!navFree(p.f, p.x, p.z) || navFree(p.f, p.x + dx, p.z + dz)){ p.x += dx; p.z += dz; return true; }
  if (Math.abs(dx) > 1e-4 && navFree(p.f, p.x + dx, p.z)){ p.x += dx; return true; }
  if (Math.abs(dz) > 1e-4 && navFree(p.f, p.x, p.z + dz)){ p.z += dz; return true; }
  return false; }

// 見通し（0.1 m 刻みで空きを確認）
function navLOS(f, ax, az, bx, bz){ const L = Math.hypot(bx - ax, bz - az); const n = Math.ceil(L / 0.1); for (let k = 1; k <= n; k++){ const t = k / n; if (!navFree(f, ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }

// A*（8 方向・角の素通りなし）。戻り値は間引いた経由点の列、届かなければ null
function navPath(f, sx, sz, tx, tz){ if (!NAV.ready) return [{ x:tx, z:tz }]; const g = navGrid(f); if (!g) return [{ x:tx, z:tz }];
  if (navLOS(f, sx, sz, tx, tz)) return [{ x:tx, z:tz }];
  const s = navIdx(g, sx, sz), t = navIdx(g, tx, tz); if (s < 0 || t < 0 || g.block[t]) return null;
  const N = g.nx * g.nz; const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const tix = t % g.nx, tiz = (t / g.nx) | 0; const h = i => { const dx = Math.abs(i % g.nx - tix), dz = Math.abs(((i / g.nx) | 0) - tiz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  const heap = [], fs = []; const push = (i, fv) => { heap.push(i); fs.push(fv); let k = heap.length - 1; while (k > 0){ const p = (k - 1) >> 1; if (fs[p] <= fs[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [fs[p], fs[k]] = [fs[k], fs[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const li = heap.pop(), lf = fs.pop(); if (heap.length){ heap[0] = li; fs[0] = lf; let k = 0; for (;;){ const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && fs[l] < fs[m]) m = l; if (r < heap.length && fs[r] < fs[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [fs[m], fs[k]] = [fs[k], fs[m]]; k = m; } } return top; };
  let start = s; if (g.block[s]){ const q = navNearestFree(f, sx, sz, 1.5); if (q) start = navIdx(g, q.x, q.z); }
  gs[start] = 0; push(start, h(start)); let n = 0; const DIRS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
  while (heap.length && n++ < 400000){ const i = pop(); if (i === t) break; if (closed[i]) continue; closed[i] = 1; const ix = i % g.nx, iz = (i / g.nx) | 0;
    for (const [dx, dz, cost] of DIRS){ const x = ix + dx, z = iz + dz; if (x < 0 || z < 0 || x >= g.nx || z >= g.nz) continue; const j = z * g.nx + x; if (g.block[j] || closed[j]) continue;
      if (dx && dz && (g.block[iz * g.nx + x] || g.block[z * g.nx + ix])) continue;
      const ng = gs[i] + cost; if (ng < gs[j]){ gs[j] = ng; from[j] = i; push(j, ng + h(j)); } } }
  if (from[t] < 0 && t !== start) return null;
  const cells = []; for (let i = t; i !== -1 && i !== start; i = from[i]) cells.push(i); cells.reverse();
  const pts = cells.map(i => ({ x: g.x0 + (i % g.nx + 0.5) * NAV.cell, z: g.z0 + (((i / g.nx) | 0) + 0.5) * NAV.cell })); pts[pts.length - 1] = { x:tx, z:tz };
  // 見通しで間引く
  const out = []; let cx = sx, cz = sz, k = 0; while (k < pts.length){ let far = k; for (let j = pts.length - 1; j > k; j--){ if (navLOS(f, cx, cz, pts[j].x, pts[j].z)){ far = j; break; } } out.push(pts[far]); cx = pts[far].x; cz = pts[far].z; k = far + 1; }
  return out; }

// 目的地へ歩き出す（ふさがった場所なら近くの空きへ）。sit/face などの到着後動作は呼び出し側が SP に置く
function spWalkTo(x, z, opts = {}){ const p = SP.pos; let tx = x, tz = z;
  if (NAV.ready && !opts.exact && !navFree(p.f, tx, tz)){ const q = navNearestFree(p.f, tx, tz, 3); if (!q){ spToast("そこへは行けません", "info"); return false; } tx = q.x; tz = q.z; }
  const path = navPath(p.f, p.x, p.z, tx, tz); if (!path || !path.length){ spToast("そこへは行けません", "info"); return false; }
  SP.path = path; SP.target = path[0]; return true; }
