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
  const S = { on: true };
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
    agents.length = 0; geo.setDrawRange(0, 0); B = null; points.visible = false; acc = [0, 0, 0];
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
    const flo = []; let fsum = 0; for (const [fl, zs] of byFloor) { fsum += 3; flo.push({ fl, zs, cum: fsum }); }
    const plain = zones.length && (bf?.use === 'ret' || bf?.use === 'att') ? 0 : 1;   // 商業・集客施設で区画が取れているなら、区画の無い階には行かせない
    if (plain) for (let fl = 0; fl < floors; fl++) if (!byFloor.has(fl)) { fsum += 1; flo.push({ fl, zs: null, cum: fsum }); }
    B = { bid, m, cores, ents, entSum, flo, fsum, floors, base, at, am, nm, len, wid, hasZones: zones.length > 0, bf, per: 1 };
    points.visible = S.on; prefill();
  }
  const floorY = fl => B.base + fl * FLOOR_H + 0.9 + Math.max(0, fl) * getGap();
  function pickTarget() {
    const r = Math.random() * B.fsum; const f = B.flo.find(q => q.cum >= r) ?? B.flo[B.flo.length - 1];
    if (f.zs) { let s = 0; const ws = f.zs.map(z => (s += CAT_W[z.zone?.category] ?? 0.6)); const q = Math.random() * s; const z = f.zs[ws.findIndex(v => v >= q)] ?? f.zs[0]; return { x: z.zx + (Math.random() - 0.5) * 5, y: z.zy + (Math.random() - 0.5) * 5, fl: f.fl, c: new THREE.Color(catColor(z.zone?.category)) }; }
    const [x, y] = B.at(B.am + (Math.random() - 0.5) * 0.75 * B.len, B.nm + (Math.random() - 0.5) * 0.7 * B.wid); return { x, y, fl: f.fl, c: OFFICE };
  }
  const pickEnt = () => { let r = Math.random() * B.entSum; for (const e of B.ents) { r -= e.w; if (r <= 0) return e; } return B.ents[0]; };
  // 経路: 同じ階なら直線、違う階なら 最寄りの昇降コアまで歩く → 昇降 → 目的の点まで歩く。各区間に所要時間 (秒) を持たせる
  function route(p, q) {
    const segs = [], walk = (a, b, fl) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > 0.3) segs.push({ x0: a[0], y0: a[1], f0: fl, x1: b[0], y1: b[1], f1: fl, T: d / WALK_SPEED }); };
    if (p.fl === q.fl) { walk([p.x, p.y], [q.x, q.y], p.fl); return segs; }
    let c = B.cores[0], bd = Infinity; for (const k of B.cores) { const d = Math.hypot(k[0] - p.x, k[1] - p.y) + Math.hypot(k[0] - q.x, k[1] - q.y); if (d < bd) { bd = d; c = k; } }
    const df = Math.abs(q.fl - p.fl), vT = df <= 4 ? df * FLOOR_H / 0.3 : 25 + df * FLOOR_H / 2.5;   // 4 層以内はエスカレーター (0.3 m/s 上昇)、それ以上はエレベーター (待ち 25 秒 + 2.5 m/s)
    walk([p.x, p.y], c, p.fl); segs.push({ x0: c[0], y0: c[1], f0: p.fl, x1: c[0], y1: c[1], f1: q.fl, T: vT }); walk(c, [q.x, q.y], q.fl); return segs;
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
    if (!B || !S.on) return; const ps = people.state;
    if (!ps.on) { if (agents.length) { agents.length = 0; geo.setDrawRange(0, 0); } return; }
    if (Math.abs(ps.hour - lastHour) > 0.3 || ps.day !== lastDay) { prefill(); } else if (Math.abs(ps.hour - lastHour) > 0.05) B.rate = rates();
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
  function set(o) { Object.assign(S, o); points.visible = S.on && !!B; if (S.on && B) prefill(); else { agents.length = 0; geo.setDrawRange(0, 0); } }
  return { setBuilding, update, set, infoHTML, state: S, get count() { return agents.length; }, get model() { return B; } };
}
