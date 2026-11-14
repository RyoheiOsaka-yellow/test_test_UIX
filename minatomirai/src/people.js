// 人流の可視化: people_model.js の OD モデルから歩行者を発生させ、歩行者ネットワーク上を目的地まで歩かせる。
//  - 人: 目的別に色分けした点 (全テーマ) + リアル表示ではカプセル形の人
//  - 通行量マップ: リンクごとの通行量 (人/時) を帯の太さと色で表示
//  - 時刻 (0〜24 時)・平日/休日で発生量が変わる。集計 (歩行中の人数、駅ごとの出入り、24 時間の推移) をパネルに出す
import * as THREE from 'three';
import { buildPeopleModel, GROUPS, DAY_TYPES, WALK_SPEED } from './people_model.js';

const MAX = 14000;
const RAMP = ['#2b6cff', '#1acbd9', '#ffd84a', '#ff7326', '#ff2a30'].map(h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; });   // 線形色空間に変換
const ramp = (t, out, o) => { const x = Math.max(0, Math.min(0.9999, t)) * (RAMP.length - 1), i = Math.floor(x), f = x - i, a = RAMP[i], b = RAMP[i + 1]; out[o] = a[0] + (b[0] - a[0]) * f; out[o + 1] = a[1] + (b[1] - a[1]) * f; out[o + 2] = a[2] + (b[2] - a[2]) * f; };
export const VOL_MAX = 10000, VOL_MIN = 30;
const volT = v => Math.log(v / VOL_MIN) / Math.log(VOL_MAX / VOL_MIN);

export function initPeople(ctx) {
  const { scene, graph, header, buildingMeta, terrainSampler, levelY, linkVisible, renderer, extraDest = () => [], onClock } = ctx;
  const S = { on: true, hour: 15, day: 'weekday', accel: 8, agents: true, vol: true, per: 1, real: false, dark: false, playing: false };
  let model = null, L = 0;
  let gA, gB, dirX, dirY, hLen, visL, vol, acc;
  // ---- 歩行者 ----
  const path = new Array(MAX), step = new Int32Array(MAX), sArr = new Float32Array(MAX), spd = new Float32Array(MAX), lat = new Float32Array(MAX), grp = new Uint8Array(MAX);
  let count = 0;
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const gcol = GROUPS.map(g => new THREE.Color(g.color));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  const pmat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 1.5 }, uMin: { value: 1.8 }, uMax: { value: 6 }, uOpacity: { value: 0.95 }, uScale: { value: innerHeight / 2 }, uPR: { value: renderer.getPixelRatio() }, uGain: { value: 1 } },
    vertexShader: `attribute vec3 color; varying vec3 vC; uniform float uSize, uMin, uMax, uScale, uPR; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); float s = uSize * uScale / max(1.0, -mv.z); gl_PointSize = clamp(s, uMin, uMax) * uPR; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; uniform float uOpacity, uGain; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; float a = smoothstep(1.0, 0.72, r); gl_FragColor = vec4(vC * uGain, a * uOpacity); }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geo, pmat); points.frustumCulled = false; points.renderOrder = 6; points.name = 'people'; scene.add(points);
  // リアル表示用: カプセル形の人
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 0.95, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), MAX);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); body.frustumCulled = false; body.count = 0; body.visible = false; body.name = 'people-body'; scene.add(body);
  { const m = body.instanceMatrix.array; for (let i = 0; i < MAX; i++) { m[i * 16] = m[i * 16 + 5] = m[i * 16 + 10] = m[i * 16 + 15] = 1; } body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); body.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  // ---- 通行量マップ (リンクごとの帯) ----
  let ribbon = null, rpos = null, rcol = null, maxVol = 0, volDirty = true, lastVolHour = -99;
  const rmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  function refreshHeights() {
    if (!model) return;
    for (let i = 0; i < L; i++) { const l = graph.links[i], na = graph.nodes[l.a], nb = graph.nodes[l.b]; gA[i] = terrainSampler(l.ax, l.ay) + levelY(na.lv); gB[i] = terrainSampler(l.bx, l.by) + levelY(nb.lv); visL[i] = linkVisible(l) ? 1 : 0; }
    volDirty = true;
  }
  function rebuild() {
    model = buildPeopleModel({ graph, header, buildingMeta, extraDest: extraDest() }); L = graph.links.length;
    gA = new Float32Array(L); gB = new Float32Array(L); dirX = new Float32Array(L); dirY = new Float32Array(L); hLen = new Float32Array(L); visL = new Uint8Array(L); vol = new Float32Array(L); acc = new Float32Array(model.classes.length);
    for (let i = 0; i < L; i++) { const l = graph.links[i]; const dx = l.bx - l.ax, dy = l.by - l.ay, h = Math.hypot(dx, dy); hLen[i] = h; if (h > 0.5) { dirX[i] = dx / h; dirY[i] = dy / h; } }
    if (ribbon) { scene.remove(ribbon); ribbon.geometry.dispose(); }
    rpos = new Float32Array(L * 12); rcol = new Float32Array(L * 12); const idx = new Uint32Array(L * 6);
    for (let i = 0; i < L; i++) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3)); rg.setAttribute('color', new THREE.BufferAttribute(rcol, 3)); rg.setIndex(new THREE.BufferAttribute(idx, 1));
    ribbon = new THREE.Mesh(rg, rmat); ribbon.frustumCulled = false; ribbon.renderOrder = 4; ribbon.name = 'people-volume'; scene.add(ribbon);
    refreshHeights(); profileCache = null; reset(); applyVisibility(); updateStats(true);
    console.log(`people model: ${model.dests.length} dests, ${model.classes.length} classes, ${model.buildMs} ms`);
  }
  const day = () => DAY_TYPES[S.day];
  function updateVolumes() {
    model.volumes(S.hour, day(), vol); maxVol = 0; const lift = S.real ? 0.42 : 0.5;
    for (let i = 0; i < L; i++) {
      const v = vol[i], o = i * 12, l = graph.links[i];
      if (hLen[i] > 1 && visL[i]) { if (v > maxVol) maxVol = v; }
      if (v < VOL_MIN || hLen[i] < 1 || !visL[i]) { for (let k = 0; k < 12; k++) rpos[o + k] = 0; continue; }
      const hw = (1.0 + 0.09 * Math.sqrt(v)) / 2, nx = -dirY[i] * hw, ny = dirX[i] * hw, ya = gA[i] + lift, yb = gB[i] + lift;
      rpos[o] = l.ax + nx; rpos[o + 1] = ya; rpos[o + 2] = -(l.ay + ny); rpos[o + 3] = l.ax - nx; rpos[o + 4] = ya; rpos[o + 5] = -(l.ay - ny);
      rpos[o + 6] = l.bx - nx; rpos[o + 7] = yb; rpos[o + 8] = -(l.by - ny); rpos[o + 9] = l.bx + nx; rpos[o + 10] = yb; rpos[o + 11] = -(l.by + ny);
      const t = volT(v); for (let k = 0; k < 4; k++) ramp(t, rcol, o + k * 3);
    }
    ribbon.geometry.attributes.position.needsUpdate = true; ribbon.geometry.attributes.color.needsUpdate = true; volDirty = false; lastVolHour = S.hour;
  }
  // ---- 歩行者の生成・移動 ----
  function setColor(i) { const c = gcol[grp[i]]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; body.instanceColor.array.set([c.r, c.g, c.b], i * 3); }
  function spawn(ci, progress) {
    if (count >= MAX) return; const c = model.classes[ci]; const p = c.sample(Math.random); if (!p || !p.length) return;
    const i = count++; path[i] = p; grp[i] = c.group; spd[i] = WALK_SPEED * (0.8 + Math.random() * 0.5); lat[i] = 0.3 + Math.random() * 2.6;
    if (progress) { step[i] = Math.floor(Math.random() * p.length); sArr[i] = Math.random() * graph.links[p[step[i]] >> 1].length; } else { step[i] = 0; sArr[i] = 0; }
    setColor(i);
  }
  function kill(i) { const j = --count; if (i !== j) { path[i] = path[j]; step[i] = step[j]; sArr[i] = sArr[j]; spd[i] = spd[j]; lat[i] = lat[j]; grp[i] = grp[j]; setColor(i); } path[j] = null; }
  // その時刻に歩いているはずの人数を、経路の途中にばらまいて初期化する
  function reset() {
    count = 0; if (!model || !S.on) { geo.setDrawRange(0, 0); body.count = 0; return; }
    const d = day(); let total = 0; const exp = model.classes.map(c => { const n = c.rate(S.hour, d) * c.meanDist / WALK_SPEED / 3600; total += n; return n; });
    let peak = 0; for (let h = 0; h < 24; h += 0.5) { const w = model.walking(h, d); let s = 0; for (const x of w) s += x; peak = Math.max(peak, s); }
    S.per = peak <= 9000 ? 1 : peak <= 18000 ? 2 : peak <= 45000 ? 5 : 10;
    exp.forEach((n, ci) => { const k = n / S.per; let m = Math.floor(k); if (Math.random() < k - m) m++; for (let j = 0; j < m; j++) spawn(ci, true); });
    acc.fill(0);
  }
  function update(dt) {
    if (!model) return;
    if (S.playing) { let h = S.hour + dt / 15; if (h >= 24) h -= 24; setHour(h, true); if (onClock) onClock(h); }
    if (S.vol && (volDirty || Math.abs(S.hour - lastVolHour) > 0.04)) updateVolumes();
    if (!S.on) return;
    const accel = S.playing ? Math.max(S.accel, 40) : S.accel, sim = Math.min(dt, 0.05) * accel, d = day();
    for (let ci = 0; ci < model.classes.length; ci++) {
      acc[ci] += model.classes[ci].rate(S.hour, d) / 3600 * sim / S.per; let n = 0;
      while (acc[ci] >= 1 && n < 60) { acc[ci] -= 1; n++; spawn(ci, false); }
      if (acc[ci] > 60) acc[ci] = 0;
    }
    const links = graph.links, real = S.real, yOff = real ? 0.87 : 1.2, m = body.instanceMatrix.array;
    for (let i = 0; i < count; i++) {
      const p = path[i]; let k = step[i], code = p[k], li = code >> 1, l = links[li], s = sArr[i] + spd[i] * sim * (l.vt ? 0.6 : 1);
      let dead = false;
      while (s >= l.length) { s -= l.length; k++; if (k >= p.length) { dead = true; break; } code = p[k]; li = code >> 1; l = links[li]; }
      if (dead) { kill(i); i--; continue; }
      step[i] = k; sArr[i] = s;
      const fwd = code & 1; let t = s / l.length; if (!fwd) t = 1 - t; const sg = fwd ? 1 : -1, o = lat[i];
      const x = l.ax + (l.bx - l.ax) * t - dirY[li] * sg * o, yN = l.ay + (l.by - l.ay) * t + dirX[li] * sg * o;   // 左側通行: 進行方向の左へ寄せる
      const y = visL[li] ? gA[li] + (gB[li] - gA[li]) * t + yOff : -9999;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = -yN;
      if (real) { m[i * 16 + 12] = x; m[i * 16 + 13] = y; m[i * 16 + 14] = -yN; }
    }
    geo.setDrawRange(0, count); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    if (real) { body.count = count; body.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = true; }
    pmat.uniforms.uScale.value = renderer.domElement.clientHeight / 2;
    statT += dt; if (statT > 0.5) { statT = 0; updateStats(false); }
  }
  let statT = 0;
  function applyVisibility() {
    points.visible = S.on && S.agents; body.visible = S.on && S.agents && S.real; if (ribbon) ribbon.visible = S.on && S.vol;
    pmat.blending = S.dark ? THREE.AdditiveBlending : THREE.NormalBlending; pmat.uniforms.uGain.value = S.dark ? 1.0 : S.real ? 0.9 : 0.7; pmat.uniforms.uMax.value = S.real ? 3.2 : 7; pmat.uniforms.uMin.value = S.dark ? 2.2 : S.real ? 2.0 : 2.8; pmat.uniforms.uSize.value = S.real ? 1.2 : 2.2; pmat.needsUpdate = true;
    rmat.opacity = S.dark ? 0.75 : S.real ? 0.7 : 0.7;
  }
  function setTheme(t) { S.real = !!t.real; S.dark = new THREE.Color(t.bg).getHSL({}).l < 0.3 && !t.real; volDirty = true; applyVisibility(); }
  function setHour(h, soft) { const jump = Math.abs(h - S.hour) > 0.3; S.hour = h; if (!soft && jump) reset(); if (model && S.vol) updateVolumes(); updateStats(true); }
  function set(o) { const before = { ...S }; Object.assign(S, o); if (S.day !== before.day) { profileCache = null; reset(); if (model) updateVolumes(); } if (S.on !== before.on) reset(); applyVisibility(); updateStats(true); }

  // ---- パネル (集計) ----
  let profileCache = null;
  const profile = () => { if (profileCache) return profileCache; const d = day(), rows = []; for (let h = 0; h <= 24; h += 0.5) rows.push(Array.from(model.walking(Math.min(h, 23.99), d))); return (profileCache = rows); };
  const fmt = n => Math.round(n).toLocaleString();
  function updateStats(full) {
    const el = id => document.getElementById(id); if (!model || !el('p-stats')) return;
    const w = model.walking(S.hour, day()); let tot = 0; for (const x of w) tot += x;
    el('p-stats').innerHTML = S.on ? `歩行中 約 <b>${fmt(tot)}</b> 人（表示 ${fmt(count)} 点・1 点 = ${S.per} 人）<br>最も混む区間 約 <b>${fmt(maxVol)}</b> 人/時` : '人流はオフ';
    if (!full) return;
    el('p-legend').innerHTML = GROUPS.map((g, i) => `<span><i style="background:${g.color}"></i>${g.n} ${fmt(w[i])}</span>`).join('');
    const hh = Math.floor(S.hour), mm = Math.round((S.hour - hh) * 60); el('p-hour-v').textContent = `${hh}:${String(mm).padStart(2, '0')}`; if (document.activeElement !== el('p-hour')) el('p-hour').value = S.hour;
    // 24 時間の推移 (目的別の積み上げ) と現在時刻
    const rows = profile(), W = 216, H = 46; let mx = 1; for (const r of rows) mx = Math.max(mx, r.reduce((a, b) => a + b, 0));
    const base = rows.map(() => 0); let svg = '';
    GROUPS.forEach((g, gi) => { const top = rows.map((r, i) => base[i] + r[gi]); const X = i => (i / (rows.length - 1) * W).toFixed(1), Y = v => (H - v / mx * (H - 4)).toFixed(1); svg += `<path d="M${rows.map((_, i) => `${X(i)},${Y(top[i])}`).join('L')}L${rows.map((_, i) => `${X(rows.length - 1 - i)},${Y(base[rows.length - 1 - i])}`).join('L')}Z" fill="${g.color}" opacity="0.85"/>`; top.forEach((v, i) => { base[i] = v; }); });
    const cx = (S.hour / 24 * W).toFixed(1); svg += `<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="#fff" stroke-width="1"/>`;
    for (const h of [6, 12, 18]) svg += `<text x="${h / 24 * W}" y="${H + 9}" font-size="8" fill="#7d93b5" text-anchor="middle">${h}時</text>`;
    el('p-spark').innerHTML = `<svg viewBox="0 0 ${W} ${H + 11}" width="100%" style="display:block">${svg}</svg><div class="note" style="margin-top:0">歩行中の人数の推移（最大 約 ${fmt(mx)} 人）</div>`;
    el('p-stations').innerHTML = '<tr><th>駅（人/時）</th><th>駅→街</th><th>街→駅</th></tr>' + model.stationFlows(S.hour, day()).map(s => `<tr><td>${s.n}${s.assumed ? '<sup>仮</sup>' : ''}</td><td>${fmt(s.toCity)}</td><td>${fmt(s.toStation)}</td></tr>`).join('');
  }
  // 建物ごとの出入り (駅との間の歩行者のみ)
  function buildingFlows(b) { if (!model) return null; const d = model.dests.find(x => (b === -2 ? x.extra : x.b === b)); if (!d) return null; const f = model.destFlows(d.idx, S.hour, day()); let peak = 0, ph = 0; for (let h = 5; h < 24; h += 0.5) { const g = model.destFlows(d.idx, h, day()); if (g.arrive + g.leave > peak) { peak = g.arrive + g.leave; ph = h; } } return { ...f, peak, peakHour: ph, use: d.u }; }
  return { rebuild, update, refreshHeights, setTheme, setHour, set, state: S, buildingFlows, get model() { return model; }, get count() { return count; }, get maxVol() { return maxVol; } };
}
