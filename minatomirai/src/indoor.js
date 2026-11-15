// 建物内の人の動き (推計): 選択した建物のフロア展開の中で、入口 → 昇降コア (エスカレーター/エレベーター) → 各階のテナント へ向かう人を流す。
//  - 出入りの量は people.js の OD モデル (その建物と駅の間の歩行者) から、館内の回遊は滞在人数から決める
//  - 行き先はフロアガイド/区画がある階はテナント区画 (用途で重み付け)、無い階は執務フロアとして階の中の適当な点
//  - 入口は歩行者ネットワークからその建物に入るノード (地上・デッキ・地下)。昇降コアは建物の長軸上に 1〜3 か所と仮定
import * as THREE from 'three';
import { WALK_SPEED } from './people_model.js';

const MAXI = 4000;
const CAT_W = { '飲食': 1.4, '物販': 1.2, 'サービス': 0.8, 'オフィス': 1.5, '宿泊': 0.7, '公共': 0.8, '医療': 0.6, 'その他': 0.6 };

export function initIndoor(ctx) {
  const { scene, people, graph, buildingMeta, FLOOR_H, catColor, getSel, getGap, footprintPts, terrainSampler, levelY, renderer } = ctx;
  const S = { on: true, flow: false };
  let B = null;   // 選択中の建物の館内モデル
  const agents = []; let acc = [0, 0, 0], statT = 0;
  const pos = new Float32Array(MAXI * 3), col = new Float32Array(MAXI * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: innerHeight / 2 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec3 color; varying vec3 vC; uniform float uScale, uPR; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(1.3 * uScale / max(1.0, -mv.z), 3.0, 9.0) * uPR; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float e = smoothstep(1.0, 0.8, r); gl_FragColor = vec4(mix(vec3(0.05, 0.07, 0.12), vC, smoothstep(0.95, 0.7, r)), e); }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 16; points.visible = false; points.name = 'indoor-people'; scene.add(points);
  const OFFICE = new THREE.Color('#7f93b8'), LEAVE = new THREE.Color('#c9d2e3');

  function setBuilding(bid) {
    agents.length = 0; geo.setDrawRange(0, 0); B = null; points.visible = false; acc = [0, 0, 0]; disposeGrids();
    if (bid == null || bid < 0) return; const sel = getSel(); const m = buildingMeta[bid]; if (!m || !sel || sel.bid !== bid) return;
    const pts = footprintPts(bid); if (pts.length < 3) return;
    // 平面の主軸 (PCA) と範囲
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
    let sxx = 0, sxy = 0, syy = 0; for (const p of pts) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ax = Math.cos(th), ay = Math.sin(th), nx = -ay, ny = ax;
    let a0 = Infinity, a1 = -Infinity, n0 = Infinity, n1 = -Infinity; for (const p of pts) { const a = (p[0] - cx) * ax + (p[1] - cy) * ay, n = (p[0] - cx) * nx + (p[1] - cy) * ny; a0 = Math.min(a0, a); a1 = Math.max(a1, a); n0 = Math.min(n0, n); n1 = Math.max(n1, n); }
    const am = (a0 + a1) / 2, nm = (n0 + n1) / 2, len = a1 - a0, wid = n1 - n0, at = (a, n) => [cx + ax * a + nx * n, cy + ay * a + ny * n];
    const cores = (len > 90 ? [-0.27, 0, 0.27] : [0]).map(k => at(am + k * len, nm));
    const floors = Math.max(1, sel.floors), base = sel.base, minFl = Math.min(0, ...sel.zones.map(z => z.fl));
    // 入口: OD モデルでこの建物に人が入るノード (多い順に 4 か所まで)
    const bf = people.buildingFlows(m.runtime ? -2 : bid); const ents = [];
    if (bf?.dest?.entr) for (const [nd, w] of [...bf.dest.entr].sort((p, q) => q[1] - p[1]).slice(0, 4)) { const n = graph.nodes[nd]; ents.push({ x: n.x, y: n.y, fl: Math.max(minFl, Math.min(floors - 1, n.lv)), w }); }   // ネットワークの階層 (0=地上, 1=デッキ=2F, -1=B1) をそのまま階に対応させる
    if (!ents.length) ents.push({ x: at(a0, nm)[0], y: at(a0, nm)[1], fl: 0, w: 1 });
    const entSum = ents.reduce((s, e) => s + e.w, 0);
    // 行き先: 区画のある階はテナント、無い階は執務フロア
    const zones = sel.zones.filter(z => !z.isCor), byFloor = new Map(); for (const z of zones) { if (!byFloor.has(z.fl)) byFloor.set(z.fl, []); byFloor.get(z.fl).push(z); }
    const flo = []; let fsum = 0; for (const [fl, zs] of byFloor) { fsum += Math.max(1, zs.reduce((s, z) => s + (CAT_W[z.zone?.category] ?? 0.6), 0) * 0.5); flo.push({ fl, zs, cum: fsum }); }   // 区画のある階は、テナントの数と用途の重みに比例
    const plain = zones.length && (bf?.use === 'ret' || bf?.use === 'att') ? 0 : 1;   // 商業・集客施設で区画が取れているなら、区画の無い階には行かせない
    if (plain) for (let fl = 0; fl < floors; fl++) if (!byFloor.has(fl)) { fsum += 1; flo.push({ fl, zs: null, cum: fsum }); }
    B = { bid, m, cores, ents, entSum, flo, fsum, floors, base, at, am, nm, len, wid, hasZones: zones.length > 0, bf, per: 1 };
    buildGrids(sel, zones); points.visible = S.on; prefill(); refreshFlow();
  }
  const floorY = fl => B.base + fl * FLOOR_H + 0.9 + Math.max(0, fl) * getGap();
  function pickTarget() {
    const r = Math.random() * B.fsum; const f = B.flo.find(q => q.cum >= r) ?? B.flo[B.flo.length - 1];
    if (f.zs) { let s = 0; const ws = f.zs.map(z => (s += CAT_W[z.zone?.category] ?? 0.6)); const q = Math.random() * s; const z = f.zs[ws.findIndex(v => v >= q)] ?? f.zs[0]; return { x: z.zx + (Math.random() - 0.5) * 5, y: z.zy + (Math.random() - 0.5) * 5, fl: f.fl, c: new THREE.Color(catColor(z.zone?.category)), z }; }
    const [x, y] = B.at(B.am + (Math.random() - 0.5) * 0.75 * B.len, B.nm + (Math.random() - 0.5) * 0.7 * B.wid); return { x, y, fl: f.fl, c: OFFICE };
  }
  const pickEnt = () => { let r = Math.random() * B.entSum; for (const e of B.ents) { r -= e.w; if (r <= 0) return e; } return B.ents[0]; };
  // 経路: 同じ階なら直線、違う階なら 最寄りの昇降コアまで歩く → 昇降 → 目的の点まで歩く。各区間に所要時間 (秒) を持たせる
  // ---- 通路グリッド (区画形状のある階): 建物の外形から区画を除いた部分を歩ける場所とし、通路に沿った経路と動線密度を作る ----
  const GC = 1.5, flowGroup = new THREE.Group(); flowGroup.name = 'indoor-flow'; flowGroup.visible = false; scene.add(flowGroup);
  const RAMP = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const pinPoly = (x, y, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  function disposeGrids() { for (const o of [...flowGroup.children]) { flowGroup.remove(o); o.geometry.dispose(); o.material.map.dispose(); o.material.dispose(); } }
  function buildGrids(sel, zones) {
    B.grids = new Map(); const hull = sel.hull; if (!hull || hull.length < 3 || !zones.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of hull) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const nx = Math.ceil((x1 - x0) / GC), ny = Math.ceil((y1 - y0) / GC); if (nx * ny > 60000) return;
    const inHull = new Uint8Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) inHull[j * nx + i] = pinPoly(x0 + (i + 0.5) * GC, y0 + (j + 0.5) * GC, hull) ? 1 : 0;
    const byFl = new Map(); for (const z of zones) { if (!z.poly) continue; if (!byFl.has(z.fl)) byFl.set(z.fl, []); byFl.get(z.fl).push(z); }
    for (const [fl, zs] of byFl) {
      const walk = inHull.slice(); let nHull = 0, nWalk = 0;
      const bbs = zs.map(z => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of z.poly) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b, c, d]; });
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!inHull[k]) continue; nHull++; const x = x0 + (i + 0.5) * GC, y = y0 + (j + 0.5) * GC; for (let q = 0; q < zs.length; q++) { const bb = bbs[q]; if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue; if (pinPoly(x, y, zs[q].poly)) { walk[k] = 0; break; } } if (walk[k]) nWalk++; }
      const open = nWalk < nHull * 0.06; if (open) walk.set(inHull);   // 区画が階を埋め尽くしている (通路が取れていない) 階は、階全体を歩けることにする
      const cells = []; for (let k = 0; k < walk.length; k++) if (walk[k]) cells.push(k);
      if (cells.length < 20) continue;
      const data = new Uint8Array(nx * ny * 4), tex = new THREE.DataTexture(data, nx, ny, THREE.RGBAFormat, THREE.UnsignedByteType); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = tex.minFilter = THREE.LinearFilter;
      const pgm = new THREE.PlaneGeometry(nx * GC, ny * GC); pgm.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(pgm, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); mesh.position.set(x0 + nx * GC / 2, 0, -(y0 + ny * GC / 2)); mesh.renderOrder = 7; flowGroup.add(mesh);
      B.grids.set(fl, { fl, x0, y0, nx, ny, walk, cells, open, fields: new Map(), snapCache: new Map(), pc: new Map(), heat: new Float32Array(nx * ny), data, tex, mesh });
    }
  }
  const cellXY = (g, k) => [g.x0 + ((k % g.nx) + 0.5) * GC, g.y0 + (Math.floor(k / g.nx) + 0.5) * GC];
  function snap(g, x, y) {   // 最寄りの歩けるセル
    const key = Math.round(x * 2) + '|' + Math.round(y * 2); let k = g.snapCache.get(key); if (k !== undefined) return k; const i = Math.floor((x - g.x0) / GC), j = Math.floor((y - g.y0) / GC);
    if (i >= 0 && j >= 0 && i < g.nx && j < g.ny && g.walk[j * g.nx + i]) k = j * g.nx + i; else { let bd = Infinity; for (const c of g.cells) { const dx = g.x0 + ((c % g.nx) + 0.5) * GC - x, dy = g.y0 + (Math.floor(c / g.nx) + 0.5) * GC - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; k = c; } } }
    if (g.snapCache.size < 4000) g.snapCache.set(key, k); return k;
  }
  function field(g, src) {   // src セルからの距離場 (8 近傍: 直進 10・斜め 14、角の斜め抜けは不可)
    let f = g.fields.get(src); if (f) return f; const { nx, ny, walk } = g; f = new Int32Array(nx * ny).fill(1e9); f[src] = 0; const buckets = [[src]];
    for (let d = 0; d < buckets.length; d++) { const b = buckets[d]; if (!b) continue; for (let q = 0; q < b.length; q++) { const k = b[q]; if (f[k] !== d) continue; const i = k % nx, j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const kk = jj * nx + ii; if (!walk[kk]) continue; if (di && dj && (!walk[j * nx + ii] || !walk[jj * nx + i])) continue; const nd = d + (di && dj ? 14 : 10); if (nd < f[kk]) { f[kk] = nd; (buckets[nd] ??= []).push(kk); } } } }
    if (g.fields.size < 120) g.fields.set(src, f); return f;
  }
  function pathCells(g, from, to) {   // from → to のセル列。届かなければ null
    const f = field(g, to); if (f[from] >= 1e9) return null; const { nx, ny } = g, out = [from]; let k = from, guard = 0;
    while (k !== to && guard++ < 6000) { const i = k % nx, j = (k - i) / nx; let best = k, bd = f[k]; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const kk = jj * nx + ii; if (f[kk] < bd && !(di && dj && (!g.walk[j * nx + ii] || !g.walk[jj * nx + i]))) { bd = f[kk]; best = kk; } } if (best === k) break; k = best; out.push(k); }
    return out;
  }
  // 動線密度: 各区画へ向かう人と入口を通る人を、通路の経路に沿って足し合わせる (人/時、1.5 m セル)
  function refreshFlow() {
    if (!B?.grids?.size) { if (B) B.flowMax = 0; return; } const r = B.rate || rates(), sh = shares(), io = r[0] + r[1], mv = r[2];
    const coreOf = (g, k, toCore) => { let best = null, bd = 1e9; for (const c of B.cores) { const ck = snap(g, c[0], c[1]), d = toCore ? field(g, ck)[k] : field(g, k)[ck]; if (d < bd) { bd = d; best = ck; } } return best; };
    const cached = (g, key, mk) => { let v = g.pc.get(key); if (v === undefined) g.pc.set(key, v = mk()); return v; };
    for (const g of B.grids.values()) g.heat.fill(0);
    for (const [z, s] of sh.zones) { const g = B.grids.get(z.fl); if (!g) continue; const door = snap(g, z.zx, z.zy), pc = cached(g, 'z' + door, () => { const c = coreOf(g, door, false); return c == null ? null : pathCells(g, c, door); }); if (pc) { const w = s * (io + mv * 2); for (const k of pc) g.heat[k] += w; } }
    for (const e of B.ents) { const g = B.grids.get(e.fl); if (!g) continue; const ek = snap(g, e.x, e.y), pc = cached(g, 'e' + ek, () => { const c = coreOf(g, ek, true); return c == null ? null : pathCells(g, ek, c); }); if (pc) { const w = io * e.w / B.entSum; for (const k of pc) g.heat[k] += w; } }
    let mx = 0; for (const g of B.grids.values()) { const { nx, ny, walk, heat } = g, t = new Float32Array(heat.length);   // 通路の中だけでならす
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!walk[k]) continue; let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || !walk[jj * nx + ii]) continue; s += heat[jj * nx + ii]; n++; } t[k] = s / n * 2.2; }
      heat.set(t); for (const v of heat) if (v > mx) mx = v; }
    B.flowMax = mx;
    for (const g of B.grids.values()) { const d = g.data; for (let k = 0; k < g.heat.length; k++) { const v = g.heat[k], o = k * 4; if (v <= mx * 0.012) { d[o + 3] = g.walk[k] ? 26 : 0; d[o] = d[o + 1] = d[o + 2] = 255; continue; } const tt = Math.sqrt(Math.min(1, v / mx)) * (RAMP.length - 1), a = Math.min(RAMP.length - 2, Math.floor(tt)), f = tt - a; d[o] = RAMP[a][0] + (RAMP[a + 1][0] - RAMP[a][0]) * f; d[o + 1] = RAMP[a][1] + (RAMP[a + 1][1] - RAMP[a][1]) * f; d[o + 2] = RAMP[a][2] + (RAMP[a + 1][2] - RAMP[a][2]) * f; d[o + 3] = 235; } g.tex.needsUpdate = true; }
  }
  // 経路: 区画形状のある階は通路グリッドに沿って、無い階は直線で歩く。違う階へは 最寄りの昇降コアまで歩く → 昇降 → 目的の点まで歩く。各区間に所要時間 (秒) を持たせる
  function legs(a, b, fl, segs) {
    const g = B.grids?.get(fl); let pts = [a, b];
    if (g) { const pc = pathCells(g, snap(g, a[0], a[1]), snap(g, b[0], b[1])); if (pc && pc.length > 2) { pts = [a]; for (let i = 1; i < pc.length - 1; i += 2) pts.push(cellXY(g, pc[i])); pts.push(b); } }
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d > 0.3) segs.push({ x0: pts[i - 1][0], y0: pts[i - 1][1], f0: fl, x1: pts[i][0], y1: pts[i][1], f1: fl, T: d / WALK_SPEED }); }
  }
  function route(p, q) {
    const segs = []; if (p.fl === q.fl) { legs([p.x, p.y], [q.x, q.y], p.fl, segs); return segs; }
    let c = B.cores[0], bd = Infinity; for (const k of B.cores) { const d = Math.hypot(k[0] - p.x, k[1] - p.y) + Math.hypot(k[0] - q.x, k[1] - q.y); if (d < bd) { bd = d; c = k; } }
    const df = Math.abs(q.fl - p.fl), vT = df <= 4 ? df * FLOOR_H / 0.3 : 25 + df * FLOOR_H / 2.5;   // 4 層以内はエスカレーター (0.3 m/s 上昇)、それ以上はエレベーター (待ち 25 秒 + 2.5 m/s)
    const gp = B.grids?.get(p.fl), gq = B.grids?.get(q.fl), cp = gp ? cellXY(gp, snap(gp, c[0], c[1])) : c, cq = gq ? cellXY(gq, snap(gq, c[0], c[1])) : c;   // コアは歩けるセルへ寄せる
    legs([p.x, p.y], cp, p.fl, segs); segs.push({ x0: cp[0], y0: cp[1], f0: p.fl, x1: cq[0], y1: cq[1], f1: q.fl, T: vT }); legs(cq, [q.x, q.y], q.fl, segs); return segs;
  }
  function spawn(kind, progress) {
    if (agents.length >= MAXI || !B) return; let segs, color;
    if (kind === 0) { const t = pickTarget(); segs = route(pickEnt(), t); color = t.c; }           // 入館
    else if (kind === 1) { const t = pickTarget(); segs = route(t, pickEnt()); color = LEAVE; }    // 退館
    else { const a = pickTarget(), b = pickTarget(); segs = route(a, b); color = b.c; }             // 館内の移動
    if (!segs.length) return; const a = { segs, k: 0, t: 0, c: color };
    if (progress) { a.k = Math.floor(Math.random() * segs.length); a.t = Math.random() * segs[a.k].T; }
    agents.push(a);
  }
  // 人/時: [入館, 退館, 館内移動]。館内移動は 滞在人数 × (商業 5 回/時, それ以外 0.5 回/時) と仮定
  function rates() { const f = people.buildingFlows(B.m.runtime ? -2 : B.bid); if (!f) return [0, 0, 0]; B.bf = f; return [f.arrive, f.leave, f.presence * (B.hasZones ? 5 : 0.5)]; }
  function prefill() {
    agents.length = 0; if (!B || !S.on || !people.state.on) return; const r = rates(); const trip = 90;   // 平均所要 90 秒と見て、その時刻に動いている人数を置く
    const exp = r.map(v => v * trip / 3600), tot = exp[0] + exp[1] + exp[2]; B.per = tot <= 2500 ? 1 : tot <= 5000 ? 2 : tot <= 12500 ? 5 : 10; B.rate = r;
    exp.forEach((n, k) => { const v = n / B.per; let c = Math.floor(v); if (Math.random() < v - c) c++; for (let i = 0; i < c; i++) spawn(k, true); });
  }
  let lastHour = -99, lastDay = '';
  function update(dt) {
    flowGroup.visible = !!(B && S.flow && B.grids?.size); if (flowGroup.visible) for (const g of B.grids.values()) g.mesh.position.y = floorY(g.fl) + 0.04;
    if (!B || !S.on) return; const ps = people.state;
    if (!ps.on) { if (agents.length) { agents.length = 0; geo.setDrawRange(0, 0); } return; }
    if (Math.abs(ps.hour - lastHour) > 0.3 || ps.day !== lastDay) { prefill(); if (S.flow) refreshFlow(); } else if (Math.abs(ps.hour - lastHour) > 0.05) { B.rate = rates(); if (S.flow) refreshFlow(); }
    if (Math.abs(ps.hour - lastHour) > 0.05 || ps.day !== lastDay) { lastHour = ps.hour; lastDay = ps.day; }
    const sim = Math.min(dt, 0.05) * (ps.playing ? Math.max(ps.accel, 40) : ps.accel), r = B.rate || [0, 0, 0];
    for (let k = 0; k < 3; k++) { acc[k] += r[k] / 3600 * sim / B.per; let n = 0; while (acc[k] >= 1 && n < 40) { acc[k] -= 1; n++; spawn(k, false); } if (acc[k] > 40) acc[k] = 0; }
    let n = 0;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]; a.t += sim; let s = a.segs[a.k];
      while (a.t >= s.T) { a.t -= s.T; a.k++; if (a.k >= a.segs.length) { s = null; break; } s = a.segs[a.k]; }
      if (!s) { agents[i] = agents[agents.length - 1]; agents.pop(); i--; continue; }
      const u = a.t / s.T, o = n * 3; pos[o] = s.x0 + (s.x1 - s.x0) * u; pos[o + 1] = floorY(s.f0) + (floorY(s.f1) - floorY(s.f0)) * u; pos[o + 2] = -(s.y0 + (s.y1 - s.y0) * u);
      col[o] = a.c.r; col[o + 1] = a.c.g; col[o + 2] = a.c.b; n++;
    }
    geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; mat.uniforms.uScale.value = renderer.domElement.clientHeight / 2;
    statT += dt; if (statT > 0.5) { statT = 0; const el = document.getElementById('indoor-info'); if (el) el.innerHTML = infoHTML(); }
  }
  const fmt = v => Math.round(v).toLocaleString();
  function infoHTML() {
    if (!B) return ''; const f = B.bf, r = B.rate || [0, 0, 0];
    return `館内の人の動き（推計）: 滞在 約 ${fmt(f?.presence ?? 0)} 人 ／ 入館 ${fmt(r[0])}・退館 ${fmt(r[1])}・館内移動 ${fmt(r[2])} 人/時<br>表示 ${fmt(agents.length)} 点（1 点 = ${B.per} 人）／ 入口 ${B.ents.length} か所・昇降コア ${B.cores.length} か所（仮定）<span style="color:#7f93b8"> ●執務階</span><span style="color:#c9d2e3"> ●退館</span> ほかは行き先の用途色`;
  }
  function set(o) { const flowOnly = Object.keys(o).every(k => k === 'flow'); Object.assign(S, o); if (S.flow && B) refreshFlow(); if (flowOnly) return; points.visible = S.on && !!B; if (S.on && B) prefill(); else { agents.length = 0; geo.setDrawRange(0, 0); } }
  // 分析用: 階ごと・区画ごとの配分 (行き先に選ばれる割合)。滞在人数や来訪者数に掛けて使う
  function shares() {
    if (!B) return null; const floors = new Map(), zones = new Map();
    let prev = 0; for (const f of B.flo) { const w = (f.cum - prev) / B.fsum; prev = f.cum; floors.set(f.fl, (floors.get(f.fl) ?? 0) + w); if (f.zs) { const tot = f.zs.reduce((s, z) => s + (CAT_W[z.zone?.category] ?? 0.6), 0); for (const z of f.zs) zones.set(z, w * (CAT_W[z.zone?.category] ?? 0.6) / tot); } }
    return { floors, zones };
  }
  return { setBuilding, update, set, infoHTML, shares, state: S, get count() { return agents.length; }, get model() { return B; }, get flowMax() { return B?.flowMax ?? 0; }, get gridFloors() { return B?.grids ? [...B.grids.values()].map(g => ({ fl: g.fl, open: g.open, cells: g.cells.length })) : []; } };
}
