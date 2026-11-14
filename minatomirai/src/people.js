// 人流の可視化: people_model.js の OD モデルから歩行者を発生させ、歩行者ネットワーク上を目的地まで歩かせる。
//  - 人: 目的別に色分けした点 (全テーマ) + リアル表示ではカプセル形の人
//  - 帯: リンクごとの 通行量 (人/時) / 混雑度 (歩道幅あたりの流動係数) / 通常との差 (シナリオ比較)
//  - 混雑すると歩行速度が落ち、横断歩道では信号待ちで滞留する
//  - シナリオ: 雨天、イベント (K アリーナ・ぴあアリーナ・パシフィコ)。時刻・平日/休日・月で発生量が変わる
//  - 較正: 国交省 人流オープンデータ (1km メッシュの滞在人口) に合わせた係数を使い、実測とモデルをメッシュ単位で見比べられる
import * as THREE from 'three';
import { buildPeopleModel, GROUPS, WALK_SPEED, EVENTS, dayContext } from './people_model.js';

const MAX = 16000;
const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const RAMP = ['#2b6cff', '#1acbd9', '#ffd84a', '#ff7326', '#ff2a30'].map(lin);
const ramp = (t, out, o) => { const x = Math.max(0, Math.min(0.9999, t)) * (RAMP.length - 1), i = Math.floor(x), f = x - i, a = RAMP[i], b = RAMP[i + 1]; out[o] = a[0] + (b[0] - a[0]) * f; out[o + 1] = a[1] + (b[1] - a[1]) * f; out[o + 2] = a[2] + (b[2] - a[2]) * f; };
export const VOL_MAX = 10000, VOL_MIN = 30;
const volT = v => Math.log(v / VOL_MIN) / Math.log(VOL_MAX / VOL_MIN);
// 歩行者サービス水準 (Fruin, 歩行路): 流動係数 = 通行量 / 有効幅員 [人/m/分]
export const LOS = [{ k: 'A', max: 23, c: '#a9bdd6' }, { k: 'B', max: 33, c: '#1acbd9' }, { k: 'C', max: 49, c: '#7ed957' }, { k: 'D', max: 66, c: '#ffd84a' }, { k: 'E', max: 82, c: '#ff7326' }, { k: 'F', max: Infinity, c: '#ff2a30' }];
const LOSC = LOS.map(l => lin(l.c));
const losIndex = f => { for (let i = 0; i < LOS.length; i++) if (f < LOS[i].max) return i; return LOS.length - 1; };
const speedFactor = f => f <= 23 ? 1 : Math.max(0.35, 1 - 0.65 * (f - 23) / (82 - 23));   // LOS A までは自由歩行、F で 35%
const SIG_CYCLE = 90, SIG_GREEN = 38;   // 歩行者信号 (秒): 1 サイクル 90 秒のうち青 38 秒 (仮定)
const UP = lin('#ff3b30'), DOWN = lin('#2b6cff');

export function initPeople(ctx) {
  const { scene, graph, header, buildingMeta, terrainSampler, levelY, linkVisible, renderer, extraDest = () => [], onClock, calib = null, getMonth = () => 1 } = ctx;
  const S = { on: true, hour: 15, day: 'weekday', accel: 8, agents: true, vol: true, per: 1, real: false, dark: false, playing: false, rain: false, event: null, ribbon: 'volume', signals: true, meshes: false };
  let model = null, base = null, L = 0, simT = 0;
  let gA, gB, dirX, dirY, hLen, visL, vol, baseVol, acc, sf, crossL, sigOff;
  // ---- 歩行者 ----
  const path = new Array(MAX), step = new Int32Array(MAX), sArr = new Float32Array(MAX), spd = new Float32Array(MAX), lat = new Float32Array(MAX), grp = new Uint8Array(MAX);
  let count = 0, waiting = 0;
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
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 0.95, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), MAX);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); body.frustumCulled = false; body.count = 0; body.visible = false; body.name = 'people-body'; scene.add(body);
  { const m = body.instanceMatrix.array; for (let i = 0; i < MAX; i++) { m[i * 16] = m[i * 16 + 5] = m[i * 16 + 10] = m[i * 16 + 15] = 1; } body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); body.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  // ---- 帯 ----
  let ribbon = null, rpos = null, rcol = null, volDirty = true, lastVolHour = -99;
  const stat = { maxVol: 0, baseMaxVol: 0, maxF: 0, efLen: 0, baseEfLen: 0 };
  const rmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // ---- 検証用: 1km メッシュ (実測とモデルの昼間人口) ----
  const meshGroup = new THREE.Group(); meshGroup.visible = false; meshGroup.name = 'people-mesh'; scene.add(meshGroup);
  const textSprite = (lines, color) => { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'); g.fillStyle = 'rgba(8,12,24,0.78)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 18); g.fill(); g.strokeStyle = color; g.lineWidth = 4; g.stroke(); g.textAlign = 'center'; g.fillStyle = '#ffffff'; lines.forEach((t, i) => { g.font = `${i === 0 ? 34 : 40}px sans-serif`; g.fillStyle = i === 0 ? '#9fb3d1' : i === 1 ? '#ffd94d' : '#7fd4ff'; g.fillText(t, 256, 46 + i * 46); }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(430, 134, 1); sp.renderOrder = 30; return sp; };
  function buildMeshOverlay() {
    for (const o of [...meshGroup.children]) { meshGroup.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }
    if (!calib) return; const hol = S.day === 'holiday', man = v => (v / 10000).toFixed(1) + '万'; const lines = [];
    for (const q of calib.meshes) {
      if (q.overlap < 0.2) continue; const [x0, y0, x1, y1] = q.rect, y = 3;
      lines.push(x0, y, -y0, x1, y, -y0, x1, y, -y0, x1, y, -y1, x1, y, -y1, x0, y, -y1, x0, y, -y1, x0, y, -y0);
      const sp = textSprite([`${q.id}${q.use ? '' : '（範囲外が多く参考）'}`, `実測 ${man(hol ? q.obsHol : q.obsWk)}人`, `モデル ${man(hol ? q.modelHol : q.modelWk)}人`], q.use ? '#ffd94d' : '#55667e');
      sp.position.set(Math.max(-1250, Math.min(1450, (x0 + x1) / 2)), 120, -Math.max(-1300, Math.min(1150, (y0 + y1) / 2))); meshGroup.add(sp);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); meshGroup.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffb300', depthTest: false, transparent: true, opacity: 0.9 })));
  }

  function refreshHeights() {
    if (!model) return;
    for (let i = 0; i < L; i++) { const l = graph.links[i], na = graph.nodes[l.a], nb = graph.nodes[l.b]; gA[i] = terrainSampler(l.ax, l.ay) + levelY(na.lv); gB[i] = terrainSampler(l.bx, l.by) + levelY(nb.lv); visL[i] = linkVisible(l) ? 1 : 0; }
    volDirty = true;
  }
  const scenarioOn = () => S.rain || !!S.event;
  const build = withScenario => buildPeopleModel({ graph, header, buildingMeta, extraDest: extraDest(), calib, scenario: withScenario ? { rain: S.rain, event: S.event } : {} });
  function rebuildScenario() {   // シナリオだけ変わったとき: 通常時のモデル (比較用) は使い回す
    model = scenarioOn() ? build(true) : base; acc = new Float32Array(model.classes.length);
    profileCache = null; baseProfileCache = null; reset(); volDirty = true; if (S.vol) updateVolumes(); updateStats(true);
  }
  function rebuild() {
    base = build(false); model = base; L = graph.links.length;
    gA = new Float32Array(L); gB = new Float32Array(L); dirX = new Float32Array(L); dirY = new Float32Array(L); hLen = new Float32Array(L); visL = new Uint8Array(L); vol = new Float32Array(L); baseVol = new Float32Array(L); sf = new Float32Array(L).fill(1); crossL = new Uint8Array(L); sigOff = new Float32Array(L);
    for (let i = 0; i < L; i++) {
      const l = graph.links[i]; const dx = l.bx - l.ax, dy = l.by - l.ay, h = Math.hypot(dx, dy); hLen[i] = h; if (h > 0.5) { dirX[i] = dx / h; dirY[i] = dy / h; }
      if (l.cross) {   // 交差点ごとに位相をずらし、直交する横断歩道は逆位相にする
        crossL[i] = 1; const th = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI, grpPhase = th > Math.PI / 4 && th < Math.PI * 3 / 4 ? 0 : SIG_CYCLE / 2;
        const hx = Math.floor((l.ax + l.bx) / 2 / 70), hy = Math.floor((l.ay + l.by) / 2 / 70); sigOff[i] = grpPhase + (((hx * 73856093) ^ (hy * 19349663)) >>> 0) % SIG_CYCLE;
      }
    }
    if (ribbon) { scene.remove(ribbon); ribbon.geometry.dispose(); }
    rpos = new Float32Array(L * 12); rcol = new Float32Array(L * 12); const idx = new Uint32Array(L * 6);
    for (let i = 0; i < L; i++) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3)); rg.setAttribute('color', new THREE.BufferAttribute(rcol, 3)); rg.setIndex(new THREE.BufferAttribute(idx, 1));
    ribbon = new THREE.Mesh(rg, rmat); ribbon.frustumCulled = false; ribbon.renderOrder = 4; ribbon.name = 'people-volume'; scene.add(ribbon);
    refreshHeights(); buildMeshOverlay();
    if (scenarioOn()) rebuildScenario(); else { acc = new Float32Array(model.classes.length); profileCache = null; baseProfileCache = null; reset(); applyVisibility(); updateStats(true); }
    console.log(`people model: ${model.dests.length} dests, ${model.classes.length} classes, ${model.buildMs} ms${calib ? ', calibrated' : ''}`);
  }
  const day = () => dayContext(S.day, getMonth(), calib);
  const green = li => !S.signals || ((simT + sigOff[li]) % SIG_CYCLE) < SIG_GREEN;
  function updateVolumes() {
    const d = day(); model.volumes(S.hour, d, vol); if (scenarioOn()) base.volumes(S.hour, d, baseVol); else baseVol.set(vol);
    stat.maxVol = stat.baseMaxVol = stat.maxF = stat.efLen = stat.baseEfLen = 0; const lift = S.real ? 0.42 : 0.5, mode = S.ribbon;
    for (let i = 0; i < L; i++) {
      const v = vol[i], bv = baseVol[i], o = i * 12, l = graph.links[i], horiz = hLen[i] > 1 && visL[i];
      const f = v / (60 * l.w); sf[i] = speedFactor(f);
      if (horiz) { if (v > stat.maxVol) stat.maxVol = v; if (bv > stat.baseMaxVol) stat.baseMaxVol = bv; if (f > stat.maxF) stat.maxF = f; if (f >= 66) stat.efLen += hLen[i]; if (bv / (60 * l.w) >= 66) stat.baseEfLen += hLen[i]; }
      const val = mode === 'diff' ? Math.abs(v - bv) : v;
      if (val < VOL_MIN || !horiz) { for (let k = 0; k < 12; k++) rpos[o + k] = 0; continue; }
      const hw = (mode === 'los' ? Math.max(1.2, l.w) : (mode === 'diff' ? 1.6 : 1.0) + 0.09 * Math.sqrt(val)) / 2, nx = -dirY[i] * hw, ny = dirX[i] * hw, ya = gA[i] + lift, yb = gB[i] + lift;
      rpos[o] = l.ax + nx; rpos[o + 1] = ya; rpos[o + 2] = -(l.ay + ny); rpos[o + 3] = l.ax - nx; rpos[o + 4] = ya; rpos[o + 5] = -(l.ay - ny);
      rpos[o + 6] = l.bx - nx; rpos[o + 7] = yb; rpos[o + 8] = -(l.by - ny); rpos[o + 9] = l.bx + nx; rpos[o + 10] = yb; rpos[o + 11] = -(l.by + ny);
      if (mode === 'los') { const c = LOSC[losIndex(f)]; for (let k = 0; k < 4; k++) rcol.set(c, o + k * 3); }
      else if (mode === 'diff') { const c = v >= bv ? UP : DOWN, a = 0.6 + 0.4 * Math.min(1, volT(val)); for (let k = 0; k < 4; k++) { rcol[o + k * 3] = c[0] * a + (1 - a); rcol[o + k * 3 + 1] = c[1] * a + (1 - a); rcol[o + k * 3 + 2] = c[2] * a + (1 - a); } }
      else { const t = volT(v); for (let k = 0; k < 4; k++) ramp(t, rcol, o + k * 3); }
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
  const total = w => { let s = 0; for (const x of w) s += x; return s; };
  function reset() {   // その時刻に歩いているはずの人数を、経路の途中にばらまいて初期化する
    count = 0; if (!model || !S.on) { geo.setDrawRange(0, 0); body.count = 0; return; }
    const d = day(); const exp = model.classes.map(c => c.rate(S.hour, d) * c.meanDist / WALK_SPEED / 3600);
    let peak = 0; for (let h = 0; h < 24; h += 0.25) peak = Math.max(peak, total(model.walking(h, d)));
    S.per = peak <= 11000 ? 1 : peak <= 22000 ? 2 : peak <= 55000 ? 5 : 10;
    exp.forEach((n, ci) => { const k = n / S.per; let m = Math.floor(k); if (Math.random() < k - m) m++; for (let j = 0; j < m; j++) spawn(ci, true); });
    acc.fill(0);
  }
  let statT = 0;
  function update(dt) {
    if (!model) return;
    if (S.playing) { let h = S.hour + dt / 15; if (h >= 24) h -= 24; setHour(h, true); if (onClock) onClock(h); }
    if (S.vol && (volDirty || Math.abs(S.hour - lastVolHour) > 0.04)) updateVolumes();
    if (!S.on) return;
    const accel = S.playing ? Math.max(S.accel, 40) : S.accel, sim = Math.min(dt, 0.05) * accel, d = day(); simT += sim;
    for (let ci = 0; ci < model.classes.length; ci++) {
      acc[ci] += model.classes[ci].rate(S.hour, d) / 3600 * sim / S.per; let n = 0;
      while (acc[ci] >= 1 && n < 80) { acc[ci] -= 1; n++; spawn(ci, false); }
      if (acc[ci] > 80) acc[ci] = 0;
    }
    const links = graph.links, real = S.real, yOff = real ? 0.87 : 1.2, m = body.instanceMatrix.array; let wait = 0;
    for (let i = 0; i < count; i++) {
      const p = path[i]; let k = step[i], code = p[k], li = code >> 1, l = links[li], s = sArr[i];
      // 信号待ち: 横断歩道の入口 (経路上で直前が横断歩道でないリンク) で赤なら止まる
      const hold = crossL[li] && s < 0.05 && (k === 0 || !crossL[p[k - 1] >> 1]) && !green(li);
      if (hold) wait++;
      else {
        s += spd[i] * sim * (l.vt ? 0.6 : 1) * sf[li]; let dead = false;
        while (s >= l.length) {
          s -= l.length; k++; if (k >= p.length) { dead = true; break; } const prev = li; code = p[k]; li = code >> 1; l = links[li];
          if (crossL[li] && !crossL[prev] && !green(li)) { s = 0; break; }
        }
        if (dead) { kill(i); i--; continue; }
        step[i] = k; sArr[i] = s;
      }
      const fwd = code & 1; let t = s / l.length; if (!fwd) t = 1 - t; const sg = fwd ? 1 : -1, o = lat[i];
      const x = l.ax + (l.bx - l.ax) * t - dirY[li] * sg * o, yN = l.ay + (l.by - l.ay) * t + dirX[li] * sg * o;   // 左側通行: 進行方向の左へ寄せる
      const y = visL[li] ? gA[li] + (gB[li] - gA[li]) * t + yOff : -9999;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = -yN;
      if (real) { m[i * 16 + 12] = x; m[i * 16 + 13] = y; m[i * 16 + 14] = -yN; }
    }
    waiting = wait;
    geo.setDrawRange(0, count); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    if (real) { body.count = count; body.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = true; }
    pmat.uniforms.uScale.value = renderer.domElement.clientHeight / 2;
    statT += dt; if (statT > 0.5) { statT = 0; updateStats(false); }
  }
  function applyVisibility() {
    points.visible = S.on && S.agents; body.visible = S.on && S.agents && S.real; if (ribbon) ribbon.visible = S.on && S.vol; meshGroup.visible = S.meshes;
    pmat.blending = S.dark ? THREE.AdditiveBlending : THREE.NormalBlending; pmat.uniforms.uGain.value = S.dark ? 1.0 : S.real ? 0.9 : 0.7; pmat.uniforms.uMax.value = S.real ? 3.2 : 7; pmat.uniforms.uMin.value = S.dark ? 2.2 : S.real ? 2.0 : 2.8; pmat.uniforms.uSize.value = S.real ? 1.2 : 2.2; pmat.needsUpdate = true;
    rmat.opacity = S.ribbon === 'los' ? 0.6 : S.dark ? 0.75 : S.ribbon === 'diff' ? 0.85 : 0.7;
  }
  function setTheme(t) { S.real = !!t.real; S.dark = new THREE.Color(t.bg).getHSL({}).l < 0.3 && !t.real; volDirty = true; applyVisibility(); }
  function setHour(h, soft) { const jump = Math.abs(h - S.hour) > 0.3; S.hour = h; if (!soft && jump) reset(); if (model && S.vol) updateVolumes(); updateStats(true); }
  function set(o) {
    const before = { ...S }; Object.assign(S, o); if (!model) return;
    if (S.rain !== before.rain || S.event !== before.event) rebuildScenario();
    else if (S.day !== before.day) { profileCache = null; baseProfileCache = null; reset(); updateVolumes(); buildMeshOverlay(); }
    else if (S.on !== before.on) reset();
    if (S.ribbon !== before.ribbon) updateVolumes();
    applyVisibility(); updateStats(true);
  }
  function monthChanged() { if (!model) return; profileCache = null; baseProfileCache = null; reset(); updateVolumes(); updateStats(true); }

  // ---- パネル (集計) ----
  let profileCache = null, baseProfileCache = null;
  const mkProfile = mdl => { const d = day(), rows = []; for (let h = 0; h <= 24; h += 0.25) rows.push(Array.from(mdl.walking(Math.min(h, 23.99), d))); return rows; };
  const profile = () => profileCache ?? (profileCache = mkProfile(model));
  const baseProfile = () => baseProfileCache ?? (baseProfileCache = mkProfile(base));
  const fmt = n => Math.round(n).toLocaleString(), pct = (a, b) => b > 0 ? `${a >= b ? '+' : '−'}${Math.abs(Math.round((a / b - 1) * 100))}%` : '—';
  function updateStats(full) {
    const el = id => document.getElementById(id); if (!model || !el('p-stats')) return;
    const d = day(), w = model.walking(S.hour, d), tot = total(w), li = losIndex(stat.maxF);
    el('p-stats').innerHTML = S.on ? `歩行中 約 <b>${fmt(tot)}</b> 人（表示 ${fmt(count)} 点・1 点 = ${S.per} 人）<br>最も混む区間 約 <b>${fmt(stat.maxVol)}</b> 人/時 ／ 混雑度 最大 <b style="color:${LOS[li].c}">${LOS[li].k}</b>（${stat.maxF.toFixed(0)} 人/m/分）<br>混雑区間（D〜F）延べ <b>${fmt(stat.efLen)}</b> m${S.signals ? ` ／ 信号待ち <b>${fmt(waiting * S.per)}</b> 人` : ''}` : '人流はオフ';
    if (!full) return;
    el('p-legend').innerHTML = GROUPS.map((g, i) => w[i] > 0.5 || i < 5 ? `<span><i style="background:${g.color}"></i>${g.n} ${fmt(w[i])}</span>` : '').join('');
    const hh = Math.floor(S.hour), mm = Math.round((S.hour - hh) * 60); el('p-hour-v').textContent = `${hh}:${String(mm).padStart(2, '0')}`; if (document.activeElement !== el('p-hour')) el('p-hour').value = S.hour;
    // 24 時間の推移 (目的別の積み上げ)。シナリオ中は通常時の合計を破線で重ねる
    const rows = profile(), W = 216, H = 46; let mx = 1; for (const r of rows) mx = Math.max(mx, total(r)); const bp = scenarioOn() ? baseProfile() : null; if (bp) for (const r of bp) mx = Math.max(mx, total(r));
    const X = i => (i / (rows.length - 1) * W).toFixed(1), Y = v => (H - v / mx * (H - 4)).toFixed(1); const baseY = rows.map(() => 0); let svg = '';
    GROUPS.forEach((g, gi) => { const top = rows.map((r, i) => baseY[i] + r[gi]); svg += `<path d="M${rows.map((_, i) => `${X(i)},${Y(top[i])}`).join('L')}L${rows.map((_, i) => `${X(rows.length - 1 - i)},${Y(baseY[rows.length - 1 - i])}`).join('L')}Z" fill="${g.color}" opacity="0.85"/>`; top.forEach((v, i) => { baseY[i] = v; }); });
    if (bp) svg += `<path d="M${bp.map((r, i) => `${X(i)},${Y(total(r))}`).join('L')}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 2"/>`;
    const cx = (S.hour / 24 * W).toFixed(1); svg += `<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="#fff" stroke-width="1"/>`;
    for (const h of [6, 12, 18]) svg += `<text x="${h / 24 * W}" y="${H + 9}" font-size="8" fill="#7d93b5" text-anchor="middle">${h}時</text>`;
    el('p-spark').innerHTML = `<svg viewBox="0 0 ${W} ${H + 11}" width="100%" style="display:block">${svg}</svg><div class="note" style="margin-top:0">歩行中の人数の推移（最大 約 ${fmt(mx)} 人）${bp ? '／破線 = 通常時' : ''}</div>`;
    el('p-stations').innerHTML = '<tr><th>駅（人/時）</th><th>駅→街</th><th>街→駅</th></tr>' + model.stationFlows(S.hour, d).map(s => `<tr><td>${s.n}${s.assumed ? `<sup>${calib ? '較' : '仮'}</sup>` : ''}</td><td>${fmt(s.toCity)}</td><td>${fmt(s.toStation)}</td></tr>`).join('');
    // 帯の凡例
    el('p-rlegend').innerHTML = S.ribbon === 'los' ? '<span>混雑度（人/m/分）:</span>' + LOS.map((l, i) => `<span><i style="background:${l.c}"></i>${l.k} ${i === 0 ? '〜23' : i === LOS.length - 1 ? '82〜' : '〜' + l.max}</span>`).join('') + '<span>帯の幅 = 歩道の有効幅員</span>'
      : S.ribbon === 'diff' ? '<span>通常との差（人/時）:</span><span><i style="background:#ff3b30"></i>増える</span><span><i style="background:#2b6cff"></i>減る</span><span>太いほど差が大きい</span>'
      : '<span>通行量（帯）:</span><span><i style="background:#2b6cff"></i>30</span><span><i style="background:#1acbd9"></i>130</span><span><i style="background:#ffd84a"></i>550</span><span><i style="background:#ff7326"></i>2,300</span><span><i style="background:#ff2a30"></i>10,000 人/時</span>';
    // シナリオの比較
    let scn = '';
    if (scenarioOn()) {
      const bw = total(base.walking(S.hour, d)); scn = `<b>通常時との比較（${hh}:${String(mm).padStart(2, '0')}）</b><br>歩行中 ${fmt(bw)} → ${fmt(tot)} 人（${pct(tot, bw)}）<br>最も混む区間 ${fmt(stat.baseMaxVol)} → ${fmt(stat.maxVol)} 人/時（${pct(stat.maxVol, stat.baseMaxVol)}）<br>混雑区間（D〜F）${fmt(stat.baseEfLen)} → ${fmt(stat.efLen)} m`;
      if (S.rain) { let cv = 0, un = 0, bcv = 0, bun = 0; for (let i = 0; i < L; i++) { const pk = hLen[i]; if (graph.links[i].cov) { cv += vol[i] * pk; bcv += baseVol[i] * pk; } else { un += vol[i] * pk; bun += baseVol[i] * pk; } } scn += `<br>屋根のある区間を歩く割合 ${Math.round(bcv / (bcv + bun) * 100)}% → ${Math.round(cv / (cv + un) * 100)}%`; }
      const ei = model.eventInfo; if (ei) scn += `<br>${ei.venue} 来場 ${fmt(ei.people)} 人の利用駅: ${ei.split.map(s => `${s.n} ${Math.round(s.share * 100)}%（${s.m} m）`).join('、')}`; else if (S.event) scn += '<br>会場が見つかりません';
    }
    el('p-scn').innerHTML = scn; el('p-scn').style.display = scn ? '' : 'none';
    if (el('p-calib')) el('p-calib').innerHTML = calib ? `<b>実測データで較正済み</b>（${calib.source}）<br>建物の集客力をメッシュ別の昼間人口に、休日の総量（×${calib.holidayTotal}）と月別係数（${getMonth()}月 ×${(S.day === 'holiday' ? calib.monthHol : calib.monthWk)[getMonth() - 1]}）を実測比に合わせています。横浜駅東口方面は ${fmt(calib.yokoDaily)} 人/日と推定。<br>鉄道で来た人だけで説明できるのは実測の昼間人口の約 ${Math.round(100 / calib.kappa)}% です（残りは車・バス・徒歩など）。時間帯分布は較正できていません（データが昼・深夜の 2 区分のため）。` : '';
  }
  // 建物ごとの出入り (駅との間の歩行者のみ) と滞在人数
  function buildingFlows(b) { if (!model) return null; const d = model.dests.find(x => (b === -2 ? x.extra : x.b === b)); if (!d) return null; const dd = day(); const f = model.destFlows(d.idx, S.hour, dd); let peak = 0, ph = 0; for (let h = 5; h < 24; h += 0.5) { const g = model.destFlows(d.idx, h, dd); if (g.arrive + g.leave > peak) { peak = g.arrive + g.leave; ph = h; } } return { ...f, peak, peakHour: ph, use: d.u, dest: d, presence: Math.max(0, model.presence(S.hour, dd)[d.idx]) }; }
  return { rebuild, update, refreshHeights, setTheme, setHour, set, monthChanged, state: S, buildingFlows, day, stat, get model() { return model; }, get base() { return base; }, get count() { return count; }, get waiting() { return waiting; }, get maxVol() { return stat.maxVol; }, get simT() { return simT; } };
}
