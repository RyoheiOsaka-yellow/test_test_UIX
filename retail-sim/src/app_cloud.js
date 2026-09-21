/* =========================================================================
   デジタルツイン（点群 × CCTV）ビュー
   - スマホ撮影の3Dスキャンを模した点群で店舗を再構成し、既設CCTVの視錐台・
     床カバレッジ・人物検出／トラッキングを重畳
   - 棚面の視線グリッド（STATS.shelves[].grid）を点群へ投影し、
     「棚のどこが注目されたか」を青→赤のヒートで可視化
   - 通常の3D表示とワンクリックで切替（既存ページはそのまま）
   ========================================================================= */

const CLOUD = {
  on: false, heat: true, frustum: true, detection: true,
  group: null, points: null, base: null, uv: null, shelfIdx: null,
  cams: [], tracked: null, trackTimer: 0, hudTimer: 0,
  detLines: null, trackLabel: null, trackRing: null,
};
window.CLOUD = CLOUD;

const cloudRng = mulberry32(777);

/* ---------- ヒートランプ（青→シアン→緑→黄→赤） ---------- */
function heatRamp(t) {
  t = clamp(t, 0, 1);
  const stops = [
    [0.00, 29, 98, 196], [0.28, 32, 190, 220], [0.52, 74, 205, 110],
    [0.75, 236, 205, 55], [1.00, 226, 58, 44],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], k) / 255, lerp(a[2], b[2], k) / 255, lerp(a[3], b[3], k) / 255];
    }
  }
  return [1, 0.2, 0.15];
}

/* ---------- CCTV 定義（施設寸法から生成） ---------- */
function cctvDefs() {
  const W = STORE.floorW, D = STORE.floorD, H = STORE.wallH;
  const y = Math.min(H - 0.32, 2.75);
  const ix = W / 2 - 0.45, iz = D / 2 - 0.45;
  const range = Math.max(W, D) * 0.42;
  return [
    { name: 'FOSCAM_1', p: [-ix, y, iz], t: [-W * 0.12, 0.95, -D * 0.22], range },
    { name: 'FOSCAM_2', p: [ix, y, iz], t: [W * 0.14, 0.95, -D * 0.20], range },
    { name: 'FOSCAM_3', p: [-ix, y, -iz], t: [-W * 0.10, 0.95, D * 0.18], range },
    { name: 'FOSCAM_4', p: [ix, y, -iz], t: [W * 0.12, 0.95, D * 0.16], range },
  ];
}

/* ---------- 点群生成 ---------- */
function shelfPointSpec(s) {
  // 返り値: { alongX, length, depth, height, baseY }
  const [w, h, d] = s.size;
  const alongX = s.normal[2] !== 0;
  if (s.kind === 'island-case') return { island: true, w, d, height: 0.55, baseY: 0.5 };
  if (s.kind === 'gondola-side') return { alongX: false, length: d, depth: 0.42, height: h, baseY: 0.05 };
  return { alongX, length: alongX ? w : d, depth: alongX ? d : w, height: h, baseY: 0.12 };
}

function buildPointCloud() {
  if (CLOUD.group) { scene.remove(CLOUD.group); disposeObject(CLOUD.group); }
  CLOUD.group = new THREE.Group();
  CLOUD.group.visible = CLOUD.on;
  const W = STORE.floorW, D = STORE.floorD;

  // 床グリッド（暗色）
  const grid = new THREE.GridHelper(Math.max(W, D) * 1.6, Math.round(Math.max(W, D) * 1.6 / 1.5), 0x1d3050, 0x12203a);
  grid.position.y = -0.005;
  grid.material.transparent = true; grid.material.opacity = 0.55;
  CLOUD.group.add(grid);

  const pos = [], col = [], uvs = [], sidx = [];
  const density = FKEY === 'depato' ? 820 : 1500;   // 点/m²（面積換算）
  const shelfList = SHELVES;

  shelfList.forEach((s, si) => {
    const spec = shelfPointSpec(s);
    const palette = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
    const area = spec.island ? spec.w * spec.d : spec.length * spec.height;
    const n = Math.max(400, Math.round(area * density));
    for (let i = 0; i < n; i++) {
      let x, y, z, u, v;
      if (spec.island) {
        u = cloudRng(); v = cloudRng();
        x = s.pos[0] + (u - 0.5) * spec.w;
        z = s.pos[2] + (cloudRng() - 0.5) * spec.d;
        y = spec.baseY + v * spec.height;
      } else {
        u = cloudRng(); v = cloudRng();
        const along = (u - 0.5) * spec.length;
        const inward = cloudRng() * spec.depth * 0.55;
        y = spec.baseY + v * (spec.height - spec.baseY);
        if (spec.alongX) {
          x = s.pos[0] + along;
          z = s.pos[2] + s.normal[2] * (spec.depth / 2 - inward);
        } else {
          x = s.pos[0] + s.normal[0] * (spec.depth / 2 - inward);
          z = s.pos[2] + along;
        }
      }
      // スキャン由来のノイズ
      x += (cloudRng() - 0.5) * 0.05; y += (cloudRng() - 0.5) * 0.05; z += (cloudRng() - 0.5) * 0.05;

      let c;
      if (cloudRng() < 0.24) {           // 什器・プライスレール由来の白点
        const g = 0.72 + cloudRng() * 0.28;
        c = new THREE.Color(g, g, g * 1.02);
      } else {
        c = new THREE.Color(palette[Math.floor(cloudRng() * palette.length)]);
        const j = 0.72 + cloudRng() * 0.5;
        c.r = clamp(c.r * j, 0, 1); c.g = clamp(c.g * j, 0, 1); c.b = clamp(c.b * j, 0, 1);
      }
      pos.push(x, y, z); col.push(c.r, c.g, c.b); uvs.push(u, v); sidx.push(si);
    }
  });

  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(pos);
  const colArr = new Float32Array(col);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, sizeAttenuation: true });
  CLOUD.points = new THREE.Points(geo, mat);
  CLOUD.points.frustumCulled = false;
  CLOUD.base = new Float32Array(colArr);
  CLOUD.uv = new Float32Array(uvs);
  CLOUD.shelfIdx = new Int16Array(sidx);
  CLOUD.group.add(CLOUD.points);

  // 什器のバウンディングワイヤー（スキャン上の棚区画）
  const wire = [];
  SHELVES.forEach(s => {
    const spec = shelfPointSpec(s);
    const w = spec.island ? spec.w : (spec.alongX ? spec.length : spec.depth);
    const d = spec.island ? spec.d : (spec.alongX ? spec.depth : spec.length);
    const h = spec.island ? 1.05 : spec.height + 0.1;
    const x0 = s.pos[0] - w / 2, x1 = s.pos[0] + w / 2;
    const z0 = s.pos[2] - d / 2, z1 = s.pos[2] + d / 2;
    const c = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      wire.push(a[0], 0.02, a[2], b[0], 0.02, b[2]);
      wire.push(a[0], h, a[2], b[0], h, b[2]);
      wire.push(a[0], 0.02, a[2], a[0], h, a[2]);
    }
  });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wire), 3));
  CLOUD.group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({
    color: 0xc98500, transparent: true, opacity: 0.22,
  })));

  buildCameras();
  buildDetectionLines();
  scene.add(CLOUD.group);
  updateCloudColors();
}

/* ---------- CCTV（視錐台・床カバレッジ・ラベル） ---------- */
function buildCameras() {
  CLOUD.cams = [];
  cctvDefs().forEach(def => {
    const g = new THREE.Group();
    const p = new THREE.Vector3(...def.p), tg = new THREE.Vector3(...def.t);
    const fwd = tg.clone().sub(p).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const R = def.range;
    const halfH = Math.tan(0.30) * R, halfW = halfH * 1.5;
    const center = p.clone().add(fwd.clone().multiplyScalar(R));
    const corners = [
      center.clone().add(right.clone().multiplyScalar(-halfW)).add(up.clone().multiplyScalar(halfH)),
      center.clone().add(right.clone().multiplyScalar(halfW)).add(up.clone().multiplyScalar(halfH)),
      center.clone().add(right.clone().multiplyScalar(halfW)).add(up.clone().multiplyScalar(-halfH)),
      center.clone().add(right.clone().multiplyScalar(-halfW)).add(up.clone().multiplyScalar(-halfH)),
    ];
    // 視錐台ワイヤー
    const verts = [];
    corners.forEach(c => { verts.push(p.x, p.y, p.z, c.x, c.y, c.z); });
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    const frustum = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0xc98500, transparent: true, opacity: 0.45 }));
    g.add(frustum);

    // 床カバレッジ（視錐台を床面へ投影）
    const floorPts = corners.map(c => {
      const dir = c.clone().sub(p);
      const tHit = dir.y < -1e-4 ? -p.y / dir.y : 3;
      const q = p.clone().add(dir.multiplyScalar(clamp(tHit, 0, 3)));
      q.x = clamp(q.x, -STORE.floorW / 2, STORE.floorW / 2);
      q.z = clamp(q.z, -STORE.floorD / 2, STORE.floorD / 2);
      return q;
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      floorPts[0].x, 0.03, floorPts[0].z, floorPts[1].x, 0.03, floorPts[1].z, floorPts[2].x, 0.03, floorPts[2].z,
      floorPts[0].x, 0.03, floorPts[0].z, floorPts[2].x, 0.03, floorPts[2].z, floorPts[3].x, 0.03, floorPts[3].z,
    ]), 3));
    const cover = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({
      color: 0x9bbf3a, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false,
    }));
    g.add(cover);

    // 筐体＋ラベル
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xc98500 }));
    body.position.copy(p); body.lookAt(tg); g.add(body);
    const label = makeLabel(def.name, '#f0c060', 'rgba(12,16,28,0.9)');
    label.scale.multiplyScalar(0.72);
    label.position.set(p.x, p.y + 0.4, p.z);
    g.add(label);

    CLOUD.group.add(g);
    CLOUD.cams.push({ def, p, fwd, range: R * 2.4, cosLimit: Math.cos(0.62), frustum, cover, label, group: g });
  });
}

function buildDetectionLines() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 2 * 3), 3));
  CLOUD.detLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color: 0x31c5f0, transparent: true, opacity: 0.55,
  }));
  CLOUD.detLines.frustumCulled = false;
  CLOUD.group.add(CLOUD.detLines);

  CLOUD.trackRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x31c5f0, transparent: true, opacity: 0.8 }));
  CLOUD.trackRing.rotation.x = Math.PI / 2; CLOUD.trackRing.visible = false;
  CLOUD.group.add(CLOUD.trackRing);
}

/* 3x3 平滑化（計測ノイズをならし、注目の「塊」として見せる） */
function smoothGrid(g) {
  const sm = new Float32Array(GRID_U * GRID_V);
  for (let v = 0; v < GRID_V; v++) for (let u = 0; u < GRID_U; u++) {
    let acc = 0, wsum = 0;
    for (let dv = -1; dv <= 1; dv++) for (let du = -1; du <= 1; du++) {
      const vv = v + dv, uu = u + du;
      if (vv < 0 || vv >= GRID_V || uu < 0 || uu >= GRID_U) continue;
      const wgt = (dv === 0 && du === 0) ? 2.4 : (dv === 0 || du === 0 ? 1.0 : 0.6);
      acc += g[vv * GRID_U + uu] * wgt; wsum += wgt;
    }
    sm[v * GRID_U + u] = acc / wsum;
  }
  return sm;
}

/* ---------- ヒート投影 ---------- */
function updateCloudColors() {
  if (!CLOUD.points) return;
  const colAttr = CLOUD.points.geometry.attributes.color;
  const arr = colAttr.array;
  if (!CLOUD.heat) {
    arr.set(CLOUD.base);
    colAttr.needsUpdate = true;
    return;
  }
  // 棚内の相対（どこを見たか）× 棚間の相対（どの棚が見られたか）のハイブリッド正規化
  const shelfMax = {}, shelfTot = {}, smooth = {};
  let globalTot = 1e-6;
  SHELVES.forEach(s => {
    const g = STATS.shelves[s.id] && STATS.shelves[s.id].grid;
    if (!g) { shelfMax[s.id] = 0; shelfTot[s.id] = 0; return; }
    const sm = smoothGrid(g);
    let m = 1e-6, sum = 0;
    for (let i = 0; i < sm.length; i++) { if (sm[i] > m) m = sm[i]; sum += g[i]; }
    smooth[s.id] = sm; shelfMax[s.id] = m; shelfTot[s.id] = sum;
    if (sum > globalTot) globalTot = sum;
  });
  for (let i = 0; i < CLOUD.shelfIdx.length; i++) {
    const s = SHELVES[CLOUD.shelfIdx[i]];
    const st = s && STATS.shelves[s.id];
    const gi3 = i * 3;
    const dim = 0.62;
    if (!st || !st.grid || shelfTot[s.id] <= 0) {
      arr[gi3] = CLOUD.base[gi3] * dim; arr[gi3 + 1] = CLOUD.base[gi3 + 1] * dim; arr[gi3 + 2] = CLOUD.base[gi3 + 2] * dim;
      continue;
    }
    const u = CLOUD.uv[i * 2], v = CLOUD.uv[i * 2 + 1];
    const raw = smooth[s.id][Math.floor(v * GRID_V) * GRID_U + Math.floor(u * GRID_U)];
    const within = raw / shelfMax[s.id];                         // 棚内のどこか
    const between = Math.pow(shelfTot[s.id] / globalTot, 0.45);  // どの棚が熱いか
    const cell = within * (0.45 + 0.55 * between);
    if (cell < 0.03) {
      arr[gi3] = CLOUD.base[gi3] * dim; arr[gi3 + 1] = CLOUD.base[gi3 + 1] * dim; arr[gi3 + 2] = CLOUD.base[gi3 + 2] * dim;
    } else {
      const [r, g2, b] = heatRamp(Math.pow(cell, 0.7));
      const k = clamp(0.6 + cell * 0.4, 0, 1);
      arr[gi3] = lerp(CLOUD.base[gi3] * dim, r, k);
      arr[gi3 + 1] = lerp(CLOUD.base[gi3 + 1] * dim, g2, k);
      arr[gi3 + 2] = lerp(CLOUD.base[gi3 + 2] * dim, b, k);
    }
  }
  colAttr.needsUpdate = true;
}

/* ---------- トラッキング ---------- */
function camsSeeing(a) {
  const out = [];
  CLOUD.cams.forEach(c => {
    const d = new THREE.Vector3(a.x - c.p.x, 1.0 - c.p.y, a.z - c.p.z);
    const dist = d.length();
    if (dist > c.range) return;
    if (d.normalize().dot(c.fwd) < c.cosLimit) return;
    out.push(c);
  });
  return out;
}
function pickTracked() {
  const live = agents.filter(a => !a.done);
  if (!live.length) { CLOUD.tracked = null; return; }
  let best = null, bestScore = -1;
  live.forEach(a => {
    const cams = camsSeeing(a).length;
    if (cams === 0) return;
    const score = cams * 10 + (a.state === 'dwell' ? 5 : 0) + rng();
    if (score > bestScore) { bestScore = score; best = a; }
  });
  CLOUD.tracked = best;
}

function updateTrackLabel(a, cams) {
  const h = (a.eyeH + 0.12).toFixed(2);
  const conf = clamp(0.58 + cams.length * 0.13 + (a.state === 'dwell' ? 0.06 : 0), 0, 0.99);
  const txt = `#${100000 + (a.id % 9000)} · ${h} M · ${cams.length} CAM${cams.length === 1 ? '' : 'S'} · CONF ${conf.toFixed(2)}`;
  if (CLOUD.trackLabel && CLOUD.trackLabel.userData.txt === txt) return;
  if (CLOUD.trackLabel) { CLOUD.group.remove(CLOUD.trackLabel); disposeObject(CLOUD.trackLabel); }
  const sp = makeLabel(txt, '#d8f4ff', 'rgba(8,14,26,0.92)');
  sp.scale.multiplyScalar(0.5);
  sp.userData.txt = txt;
  CLOUD.trackLabel = sp;
  CLOUD.group.add(sp);
}

/* ---------- フレーム更新 ---------- */
function updateCloud(realDt) {
  if (!CLOUD.group) return;
  CLOUD.group.visible = CLOUD.on;
  if (storeGroup) storeGroup.visible = !CLOUD.on;

  agents.forEach(a => {
    if (!a.mesh) return;
    if (a.bodyMesh) a.bodyMesh.visible = !CLOUD.on;
    if (a.headMesh) a.headMesh.visible = !CLOUD.on;
    if (a.ring) a.ring.visible = a.hasNovelty && !CLOUD.on;
    if (a.detDot) a.detDot.visible = CLOUD.on && CLOUD.detection;
  });
  if (!CLOUD.on) {
    if (CLOUD.trackLabel) CLOUD.trackLabel.visible = false;
    if (CLOUD.trackRing) CLOUD.trackRing.visible = false;
    return;
  }

  CLOUD.cams.forEach(c => {
    c.frustum.visible = CLOUD.frustum;
    c.cover.visible = CLOUD.frustum;
    c.label.visible = S.layers.labels;
  });
  if (CLOUD.detLines) CLOUD.detLines.visible = CLOUD.detection;

  // トラッキング対象の更新
  CLOUD.trackTimer += realDt;
  if (!CLOUD.tracked || CLOUD.tracked.done || CLOUD.trackTimer > 6) {
    CLOUD.trackTimer = 0; pickTracked();
  }
  const a = CLOUD.tracked;
  if (a && !a.done && CLOUD.detection) {
    const cams = camsSeeing(a);
    updateTrackLabel(a, cams);
    if (CLOUD.trackLabel) {
      CLOUD.trackLabel.visible = true;
      CLOUD.trackLabel.position.set(a.x, 1.95, a.z);
    }
    CLOUD.trackRing.visible = true;
    CLOUD.trackRing.position.set(a.x, 0.04, a.z);
    const arr = CLOUD.detLines.geometry.attributes.position.array;
    let n = 0;
    cams.forEach(c => {
      if (n >= 4) return;
      arr[n * 6] = c.p.x; arr[n * 6 + 1] = c.p.y; arr[n * 6 + 2] = c.p.z;
      arr[n * 6 + 3] = a.x; arr[n * 6 + 4] = 1.1; arr[n * 6 + 5] = a.z;
      n++;
    });
    CLOUD.detLines.geometry.setDrawRange(0, n * 2);
    CLOUD.detLines.geometry.attributes.position.needsUpdate = true;
  } else {
    if (CLOUD.trackLabel) CLOUD.trackLabel.visible = false;
    if (CLOUD.trackRing) CLOUD.trackRing.visible = false;
    CLOUD.detLines.geometry.setDrawRange(0, 0);
  }

  // ヒート再投影・HUD
  CLOUD.hudTimer += realDt;
  if (CLOUD.hudTimer > 1.0) {
    CLOUD.hudTimer = 0;
    updateCloudColors();
    const portals = Object.values(EDGES).reduce((s, e) => s + e.length, 0) / 2;
    const tracked = CLOUD.tracked && !CLOUD.tracked.done ? 1 : 0;
    const el = document.getElementById('hud-top');
    if (el) el.textContent = `${CLOUD.cams.length} CAMERAS // ${tracked} TRACKED // ${portals} PORTALS`;
    const el2 = document.getElementById('hud-sub');
    if (el2) {
      const live = agents.filter(x => !x.done).length;
      el2.textContent = `${STORE.label.toUpperCase()} // ${live} DETECTIONS // ${fmtNum(CLOUD.shelfIdx.length)} POINTS // GAZE HEAT ${CLOUD.heat ? 'ON' : 'OFF'}`;
    }
  }
}

/* ---------- 表示モード切替 ---------- */
function setRenderMode(mode) {
  CLOUD.on = mode === 'cloud';
  document.querySelectorAll('#render-mode button').forEach(b => b.classList.toggle('active', b.dataset.rm === mode));
  const cl = document.getElementById('cloud-layers');
  if (cl) cl.style.display = CLOUD.on ? '' : 'none';
  const sl = document.getElementById('solid-layers');
  if (sl) sl.style.display = CLOUD.on ? 'none' : '';
  const hud = document.getElementById('cloud-hud');
  if (hud) hud.style.display = CLOUD.on ? '' : 'none';
  document.body.classList.toggle('cloud-mode', CLOUD.on);
  if (CLOUD.on) {
    CLOUD.hudTimer = 99;
    updateCloudColors();
    const pr = STORE.camPresets.over;
    tweenCam({ theta: pr.theta, phi: 0.86, r: pr.r * 1.08, tx: pr.tx, ty: 0.6, tz: pr.tz });
  }
  beacon(CLOUD.on ? 'デジタルツイン（点群×CCTV）表示に切替' : '通常表示に切替', '');
}
window.setRenderMode = setRenderMode;

document.getElementById('render-mode').addEventListener('click', e => {
  const b = e.target.closest('button[data-rm]');
  if (b) setRenderMode(b.dataset.rm);
});
document.getElementById('ly-cheat').addEventListener('change', e => { CLOUD.heat = e.target.checked; updateCloudColors(); });
document.getElementById('ly-frustum').addEventListener('change', e => { CLOUD.frustum = e.target.checked; });
document.getElementById('ly-detect').addEventListener('change', e => { CLOUD.detection = e.target.checked; });

/* ---------- 売場詳細パネルのミニ・ヒートグリッド ---------- */
function drawShelfHeatMini(shelfId) {
  const cv = document.getElementById('sd-heat');
  if (!cv) return;
  const st = STATS.shelves[shelfId];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.parentElement.clientWidth, h = 74;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = '100%'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!st || !st.grid) return;
  const sm = smoothGrid(st.grid);
  let max = 1e-6;
  for (let i = 0; i < sm.length; i++) if (sm[i] > max) max = sm[i];
  const cw = w / GRID_U, ch = h / GRID_V;
  for (let v = 0; v < GRID_V; v++) {
    for (let u = 0; u < GRID_U; u++) {
      const val = sm[v * GRID_U + u] / max;
      const y = h - (v + 1) * ch;   // v=0 が最下段
      if (val < 0.03) {
        ctx.fillStyle = '#eef2f7';
      } else {
        const [r, g, b] = heatRamp(Math.pow(val, 0.55));
        ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      }
      ctx.fillRect(u * cw + 0.5, y + 0.5, cw - 1, ch - 1);
    }
  }
  // ゴールデンゾーン帯（床上85-150cm相当）
  const s = shelfById[shelfId];
  if (s && s.kind !== 'island-case') {
    const hgt = s.size[1];
    const gy1 = h - (1.5 / hgt) * h, gy2 = h - (0.85 / hgt) * h;
    ctx.strokeStyle = 'rgba(201,133,0,0.85)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
    ctx.strokeRect(1, clamp(gy1, 0, h), w - 2, clamp(gy2 - gy1, 4, h));
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
}
window.drawShelfHeatMini = drawShelfHeatMini;

window.__cloudReady = true;   // これ以降 core からの呼び出しを許可（TDZ回避）
buildPointCloud();
setRenderMode('solid');
