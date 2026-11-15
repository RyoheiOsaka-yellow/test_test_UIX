// 商圏・回遊の流線: 選んだ建物について「どの駅 (発着点) から何人来るか」と「次にどの建物へ向かうか」を、
// 立体の弧 (太さ = 人数) とその上を流れる粒で表す。数値は人流モデルの 1 日あたりの推計。
import * as THREE from 'three';

export const FLOW_COLORS = ['#4da3ff', '#ffb347', '#6fdc7a', '#ff6f91', '#1acbd9', '#ffd84a', '#ff7326', '#9a7bff', '#b0b7c3', '#e040fb'];

export function initFlows(ctx) {
  const { scene, people, buildingMeta, terrainSampler } = ctx;
  const group = new THREE.Group(); group.name = 'flows'; group.visible = false; scene.add(group);
  let cur = null;   // { bid, data, arcs: [{ curve, n, t0, back }], pts }
  const label = (text, color) => {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '30px sans-serif'; const w = Math.ceil(g.measureText(text).width) + 28; c.width = w; c.height = 48;
    g.fillStyle = 'rgba(8,12,24,0.85)'; g.beginPath(); g.roundRect(1, 1, w - 2, 46, 10); g.fill(); g.strokeStyle = color; g.lineWidth = 3; g.stroke(); g.font = '30px sans-serif'; g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.fillText(text, 14, 25);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, sizeAttenuation: false })); sp.scale.set(w / 48 * 0.026, 0.026, 1); sp.renderOrder = 45; return sp;
  };
  function clear() { for (const o of [...group.children]) { group.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); } cur = null; group.visible = false; }
  // その建物の 1 日の来訪 (発着点別) と、次に向かう先
  function compute(bid) {
    const model = people.model; if (!model) return null; const m = buildingMeta[bid]; if (!m) return null; const d = model.dests.find(x => (m.runtime ? x.extra : x.b === bid)); if (!d) return null;
    const day = people.day(), by = new Map();
    for (const c of model.classes) { const sh = c.share?.[d.idx]; if (!sh || c.station == null) continue; let daily = 0; for (let h = 0.25; h < 24; h += 0.5) daily += c.rate(h, day) * 0.5; if (daily <= 0) continue; const e = by.get(c.station) ?? { arrive: 0, leave: 0 }; if (c.dir === 'out') e.arrive += daily * sh; else e.leave += daily * sh; by.set(c.station, e); }
    // 鉄道以外 (駐車場・バス停・外周) は発着点が多数あるので、この建物にいちばん近い発着点から弧を引く
    const srcOf = S => { if (!S.nonRail) return [S.x, S.y]; let bn = -1, bd = Infinity; for (const c of d.cand) if (S.out.dist[c] < bd) { bd = S.out.dist[c]; bn = c; } if (bn < 0) return [S.x, S.y]; let v = bn, guard = 0; while (S.out.via[v] >= 0 && guard++ < 5000) v = S.out.par[v]; const nd = people.graphNode(v); return [nd.x, nd.y]; };
    const stations = [...by].map(([si, e], k) => { const S = model.stations[si], [x, y] = srcOf(S); return { si, n: S.n, x, y, nonRail: !!S.nonRail, ...e }; }).filter(s => s.arrive + s.leave >= 1).sort((a, b) => b.arrive - a.arrive); stations.forEach((s, k) => { s.color = FLOW_COLORS[k % FLOW_COLORS.length]; });
    const total = stations.reduce((a, s) => a + s.arrive, 0);
    const nx = (list, kind) => list.slice(0, kind === 'stroll' ? 6 : 4).filter(q => q.p > 0.02).map(q => { const t = model.dests[q.idx]; return { idx: q.idx, b: t.b, n: t.n ?? '（名称なし）', x: t.x, y: t.y, p: q.p, kind }; });
    return { bid, name: m.n ?? '（名称なし）', x: d.x, y: d.y, h: m.h ?? (m.z ? m.z[1] - m.z[0] : 30), stations, total, next: [...nx(model.strollFrom(d.idx), 'stroll'), ...nx(model.lunchFrom(d.idx), 'lunch')] };
  }
  function show(bid) {
    clear(); const data = compute(bid); if (!data) return null; const gy = (x, y) => Math.max(0, terrainSampler(x, y)) + 3, arcs = [];
    const B = new THREE.Vector3(data.x, gy(data.x, data.y) + Math.min(60, data.h * 0.4), -data.y);
    const addArc = (ax, ay, color, radius, n, back, text) => {
      const A = new THREE.Vector3(ax, gy(ax, ay), -ay), dist = A.distanceTo(B), C = A.clone().add(B).multiplyScalar(0.5); C.y += 50 + dist * 0.28;
      const curve = back ? new THREE.QuadraticBezierCurve3(B, C, A) : new THREE.QuadraticBezierCurve3(A, C, B);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 7, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false, fog: false })); tube.renderOrder = 42; group.add(tube);
      arcs.push({ curve, n, color: new THREE.Color(color) });
      if (text) { const sp = label(text, color); sp.position.copy(curve.getPoint(back ? 0.72 : 0.28)); group.add(sp); }
    };
    for (const s of data.stations) { if (s.arrive < data.total * 0.01 || Math.hypot(s.x - data.x, s.y - data.y) < 40) continue; addArc(s.x, s.y, s.color, Math.min(16, 2.2 + 0.16 * Math.sqrt(s.arrive)), Math.max(3, Math.min(70, Math.round(s.arrive / 250))), false, `${s.n} ${Math.round(s.arrive / data.total * 100)}%`); }
    for (const q of data.next) addArc(q.x, q.y, q.kind === 'stroll' ? '#9a7bff' : '#ff6f91', 2 + 14 * q.p, Math.max(2, Math.round(q.p * 40)), true, `→ ${q.n} ${Math.round(q.p * 100)}%`);
    const N = arcs.reduce((a, k) => a + k.n, 0), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), ph = new Float32Array(N); let o = 0;
    for (const a of arcs) for (let i = 0; i < a.n; i++) { ph[o] = (i + Math.random() * 0.6) / a.n; col.set([Math.min(1, a.color.r * 1.3 + 0.2), Math.min(1, a.color.g * 1.3 + 0.2), Math.min(1, a.color.b * 1.3 + 0.2)], o * 3); o++; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, depthTest: false, transparent: true, fog: false })); pts.renderOrder = 44; pts.frustumCulled = false; group.add(pts);
    cur = { bid, data, arcs, pts, ph }; group.visible = true; update(0); return data;
  }
  const v = new THREE.Vector3();
  function update(dt) {
    if (!cur) return; const p = cur.pts.geometry.attributes.position; let o = 0;
    for (const a of cur.arcs) for (let i = 0; i < a.n; i++) { cur.ph[o] = (cur.ph[o] + dt * 0.16) % 1; a.curve.getPoint(cur.ph[o], v); p.setXYZ(o, v.x, v.y, v.z); o++; }
    p.needsUpdate = true;
  }
  return { show, hide: clear, update, compute, get data() { return cur?.data ?? null; }, get bid() { return cur?.bid ?? -1; } };
}
