/* =========================================================================
   デジタルツイン（点群 × CCTV）ビュー
   - スマホ撮影の3Dスキャンを模した点群で店舗を再構成し、既設CCTVの視錐台・
     床カバレッジ・人物検出／トラッキングを重畳
   - 棚面の視線グリッド（STATS.shelves[].grid）を点群へ投影し、
     「棚のどこが注目されたか」を青→赤のヒートで可視化
   - 通常の3D表示とワンクリックで切替（既存ページはそのまま）
   ========================================================================= */

const CLOUD = {
  on: false, heat: true, frustum: true, detection: true, rays: true, window: 'live',
  group: null, points: null, base: null, uv: null, shelfIdx: null,
  cams: [], tracked: null, trackTimer: 0, hudTimer: 0,
  detLines: null, trackLabel: null, trackRing: null,
  gazeRays: null, splats: null, splatLife: null, splatCursor: 0, cellFrames: null, rayDots: null,
  heatTimer: 0, gazeRate: 0, gazeAcc: 0, rateTimer: 0, floorCanvas: null, floorTex: null, floorPlane: null,
  source: 'true',          // 'true'=シミュレーションの真値 / 'obs'=AIカメラ計測値
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

const PERSONA_RGB = null;
function personaRGB(idx) {
  const hex = PERSONA_COLORS[idx] != null ? PERSONA_COLORS[idx] : 0x0f9fba;
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/* ---------- CCTV 定義（施設寸法から生成） ---------- */

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
  // 施設切替・再構築時に追跡状態と計測レートをリセット
  CLOUD.tracked = null; CLOUD.trackTimer = 0;
  CLOUD.gazeAcc = 0; CLOUD.rateTimer = 0; CLOUD.gazeRate = 0;
  if (CLOUD.splatLife) CLOUD.splatLife.fill(0);
  if (CLOUD.group) { scene.remove(CLOUD.group); disposeObject(CLOUD.group); }
  CLOUD.trackLabel = null;
  CLOUD.group = new THREE.Group();
  CLOUD.group.visible = CLOUD.on;
  const W = STORE.floorW, D = STORE.floorD;

  // 床グリッド（暗色）
  const grid = new THREE.GridHelper(Math.max(W, D) * 1.6, Math.round(Math.max(W, D) * 1.6 / 1.5), 0x1d3050, 0x12203a);
  grid.position.y = -0.005;
  grid.material.transparent = true; grid.material.opacity = 0.55;
  CLOUD.group.add(grid);

  const pos = [], col = [], uvs = [], sidx = [];
  const density = FKEY === 'depato' ? 1250 : 2100;   // 点/m²
  const pushPoint = (x, y, z, c, u, v, si) => {
    pos.push(x + (cloudRng() - 0.5) * 0.032, y + (cloudRng() - 0.5) * 0.032, z + (cloudRng() - 0.5) * 0.032);
    col.push(c[0], c[1], c[2]); uvs.push(u, v); sidx.push(si);
  };
  const shade = (hex, k) => {
    const c = new THREE.Color(hex);
    return [clamp(c.r * k, 0, 1), clamp(c.g * k, 0, 1), clamp(c.b * k, 0, 1)];
  };
  // 商品ごとに色を固定するための決定的ハッシュ（同じ店舗なら同じ見え方）
  const hash01 = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000 / 1000;

  SHELVES.forEach((s, si) => {
    const palette = CAT_PRODUCT_COLORS[s.cat] || CAT_PRODUCT_COLORS.food;
    if (s.kind === 'counter') return;

    /* --- 島型ガラスケース（デパ地下）: トレー状のクラスタを並べる --- */
    if (s.kind === 'island-case') {
      const w = s.size[0], d = s.size[2];
      const cols = Math.max(3, Math.round(w / 0.32)), rows = 2;
      for (let r = 0; r < rows; r++) {
        for (let ci = 0; ci < cols; ci++) {
          const base = shade(palette[(ci + r * 2) % palette.length], 0.78 + hash01(ci, r) * 0.45);
          const cx = s.pos[0] - w / 2 + (ci + 0.5) * (w / cols);
          const cz = s.pos[2] + (r - 0.5) * d * 0.4;
          const ph = 0.10 + hash01(ci * 3, r * 5) * 0.16;
          const n = Math.max(40, Math.round((w / cols) * d * 0.42 * density));
          for (let i = 0; i < n; i++) {
            const x = cx + (cloudRng() - 0.5) * (w / cols) * 0.82;
            const z = cz + (cloudRng() - 0.5) * d * 0.34;
            const y = 0.52 + cloudRng() * ph;
            pushPoint(x, y, z, base,
              clamp((x - (s.pos[0] - w / 2)) / w, 0, 0.999), clamp((y - 0.5) / 0.55, 0, 0.999), si);
          }
        }
      }
      // ケース縁のハイライト
      const nEdge = Math.round(w / 0.02);
      for (let i = 0; i < nEdge; i++) {
        const x = s.pos[0] - w / 2 + (i / nEdge) * w;
        const g = 0.8 + cloudRng() * 0.2;
        pushPoint(x, 1.03, s.pos[2] + d / 2 * 0.98, [g, g, g * 1.04], clamp((i / nEdge), 0, 0.999), 0.95, si);
      }
      return;
    }

    /* --- 壁面什器 / ゴンドラ側面: 段 × フェイシングで商品ブロックを構成 --- */
    const alongX = s.normal[2] !== 0;
    const length = alongX ? s.size[0] : s.size[2];
    const depth = s.kind === 'gondola-side' ? 0.42 : (alongX ? s.size[2] : s.size[0]);
    const H = s.size[1];
    const baseY = 0.12;
    const tiers = H > 1.7 ? 4 : 3;
    const tierH = (H - baseY) / tiers;
    const nFace = Math.max(3, Math.round(length / 0.135));
    const faceW = length / nFace;

    for (let t2 = 0; t2 < tiers; t2++) {
      const y0 = baseY + t2 * tierH;
      const bandH = tierH * 0.76;
      for (let f = 0; f < nFace; f++) {
        const grp = Math.floor(f / 3);                       // 3フェイス同一商品（棚割準拠）
        const base = shade(palette[(grp + t2) % palette.length], 0.76 + hash01(grp, t2) * 0.5);
        const prodH = bandH * (0.52 + hash01(f, t2 * 7) * 0.44);
        const alongC = -length / 2 + (f + 0.5) * faceW;
        const n = Math.max(8, Math.round(faceW * prodH * density));
        for (let i = 0; i < n; i++) {
          const along = alongC + (cloudRng() - 0.5) * faceW * 0.86;
          const y = y0 + 0.035 + cloudRng() * prodH;
          const inward = cloudRng() * depth * 0.4;
          const x = alongX ? s.pos[0] + along : s.pos[0] + s.normal[0] * (depth / 2 - inward);
          const z = alongX ? s.pos[2] + s.normal[2] * (depth / 2 - inward) : s.pos[2] + along;
          pushPoint(x, y, z, base, clamp(along / length + 0.5, 0, 0.999), clamp(y / H, 0, 0.999), si);
        }
      }
      // プライスレール（段板前端の白い点列）
      const nRail = Math.round(length / 0.018);
      for (let i = 0; i < nRail; i++) {
        const along = -length / 2 + (i / nRail) * length;
        const g = 0.82 + cloudRng() * 0.18;
        const x = alongX ? s.pos[0] + along : s.pos[0] + s.normal[0] * (depth / 2 - 0.02);
        const z = alongX ? s.pos[2] + s.normal[2] * (depth / 2 - 0.02) : s.pos[2] + along;
        pushPoint(x, y0 + 0.014, z, [g, g, g * 1.03], clamp(along / length + 0.5, 0, 0.999), clamp(y0 / H, 0, 0.999), si);
      }
    }
  });

  // 床のスキャン点（疎・空間の手がかり）
  const floorN = Math.round(STORE.floorW * STORE.floorD * 34);
  for (let i = 0; i < floorN; i++) {
    const g = 0.2 + cloudRng() * 0.12;
    const fx = (cloudRng() - 0.5) * STORE.floorW, fz = (cloudRng() - 0.5) * STORE.floorD;
    pos.push(fx, 0.004 + cloudRng() * 0.012, fz);
    col.push(g * 0.8, g * 0.92, g * 1.18);
    // 床点は回遊ヒートを引くため、フロア内の正規化座標を uv に格納
    uvs.push(clamp((fx + STORE.floorW / 2) / STORE.floorW, 0, 0.999),
             clamp((fz + STORE.floorD / 2) / STORE.floorD, 0, 0.999));
    sidx.push(-1);
  }

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

  // 床の回遊ヒート（歩行の蓄積を面で表示。視線ヒート＝青→赤 と区別するためバイオレット系）
  CLOUD.floorCanvas = document.createElement('canvas');
  CLOUD.floorCanvas.width = heat.w; CLOUD.floorCanvas.height = heat.h;
  if (CLOUD.floorTex) CLOUD.floorTex.dispose();
  CLOUD.floorTex = new THREE.CanvasTexture(CLOUD.floorCanvas);
  CLOUD.floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(STORE.floorW, STORE.floorD),
    new THREE.MeshBasicMaterial({
      map: CLOUD.floorTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  CLOUD.floorPlane.rotation.x = -Math.PI / 2;
  CLOUD.floorPlane.position.y = 0.025;
  CLOUD.group.add(CLOUD.floorPlane);

  buildCameras();
  buildDetectionLines();
  buildGazeFx();
  buildCellFrames();
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
      color: 0x9bbf3a, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
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

const SPLAT_MAX = 200, RAY_MAX = 56, RAY_DOTS = 14, CELL_MAX = 12;
let softTex = null;
function softCircleTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}
function buildGazeFx() {
  // 視線レイ（各客の頭 → 棚面の注視点）
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_MAX * 2 * 3), 3));
  rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(RAY_MAX * 2 * 3), 3));
  CLOUD.gazeRays = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  CLOUD.gazeRays.frustumCulled = false;
  CLOUD.group.add(CLOUD.gazeRays);

  const rpg = new THREE.BufferGeometry();
  rpg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAY_MAX * RAY_DOTS * 3), 3));
  rpg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(RAY_MAX * RAY_DOTS * 3), 3));
  CLOUD.rayDots = new THREE.Points(rpg, new THREE.PointsMaterial({
    size: 0.085, map: softCircleTexture(), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  CLOUD.rayDots.frustumCulled = false;
  CLOUD.group.add(CLOUD.rayDots);

  // 注視スプラット（見られた瞬間に棚面へ落ちる光点。減衰して累積ヒートに溶ける）
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPLAT_MAX * 3), 3));
  sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPLAT_MAX * 3), 3));
  CLOUD.splats = new THREE.Points(sg, new THREE.PointsMaterial({
    size: 0.34, map: softCircleTexture(), vertexColors: true, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  CLOUD.splats.frustumCulled = false;
  CLOUD.splatLife = new Float32Array(SPLAT_MAX);
  CLOUD.splatCursor = 0;
  CLOUD.group.add(CLOUD.splats);
}

function spawnSplat(x, y, z, strength) {
  const i = CLOUD.splatCursor = (CLOUD.splatCursor + 1) % SPLAT_MAX;
  const pa = CLOUD.splats.geometry.attributes.position.array;
  pa[i * 3] = x + (cloudRng() - 0.5) * 0.07;
  pa[i * 3 + 1] = y + (cloudRng() - 0.5) * 0.07;
  pa[i * 3 + 2] = z + (cloudRng() - 0.5) * 0.07;
  CLOUD.splatLife[i] = clamp(0.85 + strength * 2.4, 0.6, 1.5);
  CLOUD.splats.geometry.attributes.position.needsUpdate = true;
}

function updateGazeFx(realDt) {
  const rayPos = CLOUD.gazeRays.geometry.attributes.position.array;
  const rayCol = CLOUD.gazeRays.geometry.attributes.color.array;
  const dotPos = CLOUD.rayDots.geometry.attributes.position.array;
  const dotCol = CLOUD.rayDots.geometry.attributes.color.array;
  const tNow = performance.now() / 1000;
  let n = 0;
  if (CLOUD.rays) {
    for (const a of agents) {
      if (n >= RAY_MAX) break;
      if (a.done || !a.gazing || !a.gazeHit) continue;
      const c = new THREE.Color(a.persona.color);
      const isTracked = a === CLOUD.tracked;
      const k = isTracked ? 1.5 : 0.95;
      rayPos[n * 6] = a.x; rayPos[n * 6 + 1] = (a.eyeH || 1.6); rayPos[n * 6 + 2] = a.z;
      rayPos[n * 6 + 3] = a.gazeHit[0]; rayPos[n * 6 + 4] = a.gazeHit[1]; rayPos[n * 6 + 5] = a.gazeHit[2];
      rayCol[n * 6] = c.r * k * 0.18; rayCol[n * 6 + 1] = c.g * k * 0.18; rayCol[n * 6 + 2] = c.b * k * 0.18;
      rayCol[n * 6 + 3] = c.r * k; rayCol[n * 6 + 4] = c.g * k; rayCol[n * 6 + 5] = c.b * k;
      // 視線上を流れる光の粒（頭 → 注視点）
      for (let d = 0; d < RAY_DOTS; d++) {
        const base = (n * RAY_DOTS + d) * 3;
        const flow = ((d / RAY_DOTS) + tNow * 0.55 + a.id * 0.13) % 1;
        dotPos[base] = lerp(a.x, a.gazeHit[0], flow);
        dotPos[base + 1] = lerp(a.eyeH || 1.6, a.gazeHit[1], flow);
        dotPos[base + 2] = lerp(a.z, a.gazeHit[2], flow);
        const br = (0.25 + flow * 0.95) * (isTracked ? 1.5 : 0.95);
        dotCol[base] = clamp(c.r * br, 0, 1);
        dotCol[base + 1] = clamp(c.g * br, 0, 1);
        dotCol[base + 2] = clamp(c.b * br, 0, 1);
      }
      n++;
      // 注視点に光を落とす（見た瞬間 → ヒートへ蓄積されるプロセスを可視化）
      if (cloudRng() < realDt * (isTracked ? 9 : 3.4)) spawnSplat(a.gazeHit[0], a.gazeHit[1], a.gazeHit[2], a.gazeW || 0.1);
    }
  }
  CLOUD.gazeRays.geometry.setDrawRange(0, n * 2);
  CLOUD.gazeRays.geometry.attributes.position.needsUpdate = true;
  CLOUD.gazeRays.geometry.attributes.color.needsUpdate = true;
  CLOUD.gazeRays.visible = CLOUD.rays && n > 0;
  CLOUD.rayDots.geometry.setDrawRange(0, n * RAY_DOTS);
  CLOUD.rayDots.geometry.attributes.position.needsUpdate = true;
  CLOUD.rayDots.geometry.attributes.color.needsUpdate = true;
  CLOUD.rayDots.visible = CLOUD.rays && n > 0;

  // スプラットの減衰
  const sc = CLOUD.splats.geometry.attributes.color.array;
  let alive = false;
  for (let i = 0; i < SPLAT_MAX; i++) {
    if (CLOUD.splatLife[i] <= 0) { sc[i * 3] = sc[i * 3 + 1] = sc[i * 3 + 2] = 0; continue; }
    CLOUD.splatLife[i] = Math.max(0, CLOUD.splatLife[i] - realDt * 0.62);
    const l = CLOUD.splatLife[i];
    const e = Math.pow(l, 1.4);
    sc[i * 3] = 0.75 * e; sc[i * 3 + 1] = 1.0 * e; sc[i * 3 + 2] = 1.0 * e;
    alive = true;
  }
  CLOUD.splats.geometry.attributes.color.needsUpdate = true;
  CLOUD.splats.visible = CLOUD.rays && alive;
}

// 注視セルの枠（棚面の 12×6 グリッド上に、いま計測されているセルを描く）
function buildCellFrames() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CELL_MAX * 8 * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CELL_MAX * 8 * 3), 3));
  CLOUD.cellFrames = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  CLOUD.cellFrames.frustumCulled = false;
  CLOUD.group.add(CLOUD.cellFrames);
}

function cellCorners(s, cellIdx) {
  const row = Math.floor(cellIdx / GRID_U), col = cellIdx % GRID_U;
  const alongX = s.normal[2] !== 0;
  const length = alongX ? s.size[0] : s.size[2];
  const depth = s.kind === 'gondola-side' ? 0.42 : (alongX ? s.size[2] : s.size[0]);
  const face = Math.max(depth / 2 - 0.02, 0.05);
  const a0 = (col / GRID_U - 0.5) * length, a1 = ((col + 1) / GRID_U - 0.5) * length;
  let y0, y1;
  if (s.kind === 'island-case') { y0 = 0.5 + (row / GRID_V) * 0.55; y1 = 0.5 + ((row + 1) / GRID_V) * 0.55; }
  else { y0 = (row / GRID_V) * s.size[1]; y1 = ((row + 1) / GRID_V) * s.size[1]; }
  const px = (a) => alongX ? s.pos[0] + a : s.pos[0] + s.normal[0] * face;
  const pz = (a) => alongX ? s.pos[2] + s.normal[2] * face : s.pos[2] + a;
  return [
    [px(a0), y0, pz(a0)], [px(a1), y0, pz(a1)],
    [px(a1), y1, pz(a1)], [px(a0), y1, pz(a0)],
  ];
}

function updateCellFrames(time) {
  const pa = CLOUD.cellFrames.geometry.attributes.position.array;
  const ca = CLOUD.cellFrames.geometry.attributes.color.array;
  let n = 0;
  for (const a of agents) {
    if (n >= CELL_MAX) break;
    if (a.done || !a.gazing || a.gazeCell == null || !a.gazeShelf) continue;
    const s = shelfById[a.gazeShelf];
    if (!s) continue;
    const c = cellCorners(s, a.gazeCell);
    const col = new THREE.Color(a.persona.color);
    const pulse = 0.55 + 0.45 * Math.sin(time * 6 + a.id);
    const k = (a === CLOUD.tracked ? 1.3 : 0.85) * pulse;
    for (let e = 0; e < 4; e++) {
      const p0 = c[e], p1 = c[(e + 1) % 4];
      const base = (n * 4 + e) * 6;
      pa[base] = p0[0]; pa[base + 1] = p0[1]; pa[base + 2] = p0[2];
      pa[base + 3] = p1[0]; pa[base + 4] = p1[1]; pa[base + 5] = p1[2];
      for (let q = 0; q < 2; q++) {
        ca[base + q * 3] = col.r * k; ca[base + q * 3 + 1] = col.g * k; ca[base + q * 3 + 2] = col.b * k;
      }
    }
    n++;
  }
  CLOUD.cellFrames.geometry.setDrawRange(0, n * 8);
  CLOUD.cellFrames.geometry.attributes.position.needsUpdate = true;
  CLOUD.cellFrames.geometry.attributes.color.needsUpdate = true;
  CLOUD.cellFrames.visible = CLOUD.rays && n > 0;
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

function gridFor(st) {
  // 計測値モードでは本日累計のみ（AIカメラの観測は時間窓を分けて持っていない）
  if (CLOUD.source === 'obs') return st.gridObs || st.grid;
  if (CLOUD.window === 'live' && st.gridLive) return st.gridLive;
  if (CLOUD.window === 'recent' && st.gridRecent) return st.gridRecent;
  return st.grid;
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
  const isLive = CLOUD.window === 'live' && CLOUD.source !== 'obs';   // 計測値は累計のみ
  const shelfMax = {}, shelfTot = {}, smooth = {}, liveG = {}, dayMax = {};
  let globalTot = 1e-6, liveMax = 1e-6, floorMax = 1e-6, liveAbsMax = 1e-6;
  // 床の回遊（歩行）グリッドの最大値
  if (heat.grid) for (let i = 0; i < heat.grid.length; i++) if (heat.grid[i] > floorMax) floorMax = heat.grid[i];
  SHELVES.forEach(s => {
    const st0 = STATS.shelves[s.id];
    const g = st0 && gridFor(st0);
    if (!g) { shelfMax[s.id] = 0; shelfTot[s.id] = 0; return; }
    const sm = smoothGrid(g);
    let m = 1e-6, sum = 0;
    for (let i = 0; i < sm.length; i++) { if (sm[i] > m) m = sm[i]; sum += g[i]; }
    // ライブ窓の下地として使う「本日累計」の棚内最大
    if (isLive && st0.grid) {
      const gd = smoothGrid(st0.grid);
      let dm = 1e-6;
      for (let i = 0; i < gd.length; i++) if (gd[i] > dm) dm = gd[i];
      dayMax[s.id] = dm; smooth[s.id + '__day'] = gd;
    }
    smooth[s.id] = sm; shelfMax[s.id] = m; shelfTot[s.id] = sum;
    if (sum > globalTot) globalTot = sum;
    if (m > liveAbsMax) liveAbsMax = m;
    const lv = st0.gridLive;
    if (lv) {
      const ls = smoothGrid(lv);
      liveG[s.id] = ls;
      for (let i = 0; i < ls.length; i++) if (ls[i] > liveMax) liveMax = ls[i];
    }
  });
  for (let i = 0; i < CLOUD.shelfIdx.length; i++) {
    const s = SHELVES[CLOUD.shelfIdx[i]];
    const st = s && STATS.shelves[s.id];
    const gi3 = i * 3;
    const dim = 0.72;
    const lum = (0.299 * CLOUD.base[gi3] + 0.587 * CLOUD.base[gi3 + 1] + 0.114 * CLOUD.base[gi3 + 2]) * dim;

    // 床の点: 歩行の回遊ヒートに連動（バイオレット系＝視線ヒートと区別）
    if (CLOUD.shelfIdx[i] < 0) {
      const gx = Math.min(heat.w - 1, Math.floor(CLOUD.uv[i * 2] * heat.w));
      const gz = Math.min(heat.h - 1, Math.floor(CLOUD.uv[i * 2 + 1] * heat.h));
      const fv = Math.log1p(clamp(heat.grid[gz * heat.w + gx] / floorMax, 0, 1) * 24) / Math.log1p(24);
      arr[gi3] = lerp(0.10, 0.34, fv);
      arr[gi3 + 1] = lerp(0.12, 0.30, fv);
      arr[gi3 + 2] = lerp(0.20, 0.46, fv);
      continue;
    }

    if (!st || !st.grid || shelfTot[s.id] <= 0) {
      arr[gi3] = lum * 0.92; arr[gi3 + 1] = lum * 0.97; arr[gi3 + 2] = lum * 1.08;
      continue;
    }
    const u = CLOUD.uv[i * 2], v = CLOUD.uv[i * 2 + 1];
    const ci = Math.floor(v * GRID_V) * GRID_U + Math.floor(u * GRID_U);
    const raw = smooth[s.id][ci];
    if (isLive) {
      // 下地 = 本日累計ヒートの地図（控えめ）
      const dayG = smooth[s.id + '__day'];
      const dayV = dayG ? clamp(dayG[ci] / (dayMax[s.id] || 1), 0, 1) : 0;
      let r0 = lum * 0.5, g0 = lum * 0.55, b0 = lum * 0.66;
      if (dayV > 0.05) {
        const [dr, dg, db] = heatRamp(Math.pow(dayV, 0.75));
        const dk = clamp(dayV * 0.85, 0, 0.6);
        r0 = lerp(r0, dr, dk); g0 = lerp(g0, dg, dk); b0 = lerp(b0, db, dk);
      }
      // 上乗せ = いま見られているセル（見ている人のペルソナ色 → 強いほど白熱）
      const inten = Math.pow(clamp(raw / Math.max(liveAbsMax, 1e-6), 0, 1), 0.55);
      if (inten < 0.04) {
        arr[gi3] = r0; arr[gi3 + 1] = g0; arr[gi3 + 2] = b0;
      } else {
        const pc = personaRGB(st.gridWho ? st.gridWho[ci] : 0);
        const wh = Math.pow(inten, 2.0);
        const kk = clamp(0.35 + inten * 0.65, 0, 1);
        arr[gi3] = clamp(lerp(r0, lerp(pc[0], 1, wh), kk) + inten * 0.45, 0, 1);
        arr[gi3 + 1] = clamp(lerp(g0, lerp(pc[1], 1, wh), kk) + inten * 0.5, 0, 1);
        arr[gi3 + 2] = clamp(lerp(b0, lerp(pc[2], 1, wh), kk) + inten * 0.52, 0, 1);
      }
      continue;
    }
    const within = raw / shelfMax[s.id];                         // 棚内のどこか
    const between = Math.pow(shelfTot[s.id] / globalTot, 0.45);  // どの棚が熱いか
    const cell = within * (0.45 + 0.55 * between);
    if (cell < 0.03) {
      arr[gi3] = lum * 0.92; arr[gi3 + 1] = lum * 0.97; arr[gi3 + 2] = lum * 1.08;
    } else {
      const [r, g2, b] = heatRamp(Math.pow(cell, 0.7));
      const k = clamp(0.45 + cell * 0.8, 0, 1);
      arr[gi3] = lerp(lum * 0.92, r, k);
      arr[gi3 + 1] = lerp(lum * 0.97, g2, k);
      arr[gi3 + 2] = lerp(lum * 1.08, b, k);
    }
    // 「今まさに見られている」セルを白く発光させる（人の動きと連動）
    const lg = isLive ? null : liveG[s.id];
    if (lg) {
      const live = Math.pow(clamp(lg[ci] / liveMax, 0, 1), 0.8);
      if (live > 0.02) {
        arr[gi3] = clamp(arr[gi3] + live * 0.72, 0, 1);
        arr[gi3 + 1] = clamp(arr[gi3 + 1] + live * 0.95, 0, 1);
        arr[gi3 + 2] = clamp(arr[gi3 + 2] + live * 1.05, 0, 1);
      }
    }
  }
  colAttr.needsUpdate = true;
}

function redrawFloorHeatCloud() {
  if (!CLOUD.floorCanvas || !heat.grid) return;
  const ctx = CLOUD.floorCanvas.getContext('2d');
  const img = ctx.createImageData(heat.w, heat.h);
  let max = 1e-6, lmax = 1e-6;
  for (let i = 0; i < heat.grid.length; i++) if (heat.grid[i] > max) max = heat.grid[i];
  if (heat.live) for (let i = 0; i < heat.live.length; i++) if (heat.live[i] > lmax) lmax = heat.live[i];
  const liveOnly = CLOUD.window === 'live';
  for (let i = 0; i < heat.grid.length; i++) {
    const acc = Math.log1p(clamp(heat.grid[i] / max, 0, 1) * 24) / Math.log1p(24);
    const v = liveOnly ? acc * 0.55 : acc;
    const lv = heat.live ? Math.pow(clamp(heat.live[i] / lmax, 0, 1), 0.45) : 0;
    // 蓄積=バイオレット、直後の足跡=シアン〜白（人が歩いた跡がそのまま伸びる）
    img.data[i * 4] = Math.round(lerp(lerp(28, 196, v), 210, lv));
    img.data[i * 4 + 1] = Math.round(lerp(lerp(18, 150, v), 250, lv));
    img.data[i * 4 + 2] = Math.round(lerp(lerp(62, 255, v), 255, lv));
    img.data[i * 4 + 3] = Math.round(clamp(v * 190 + lv * 200, 0, 240));
  }
  ctx.putImageData(img, 0, 0);
  CLOUD.floorTex.needsUpdate = true;
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
  sp.scale.multiplyScalar(0.34);
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
    if (a.bodyParts) a.bodyParts.forEach(m => m.visible = !CLOUD.on);
    if (a.ring) a.ring.visible = a.hasNovelty && !CLOUD.on;
    if (a.detDot) {
      a.detDot.visible = CLOUD.on && CLOUD.detection;
      if (a.detDot.visible) {
        const pulse = a.gazing ? 1 + Math.sin(performance.now() / 1000 * 8 + a.id) * 0.35 : 1;
        a.detDot.scale.setScalar(pulse);
        a.detDot.material.color.setHex(a.gazing ? 0x9be7ff : 0x31c5f0);
      }
    }
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
  if (CLOUD.floorPlane) CLOUD.floorPlane.visible = S.layers.floorheat;

  // トラッキング対象の更新
  CLOUD.trackTimer += realDt;
  if (followTarget && !followTarget.done) {
    CLOUD.tracked = followTarget;            // カメラ追従中はその人を計測対象に
  } else if (!CLOUD.tracked || CLOUD.tracked.done || CLOUD.trackTimer > 6) {
    CLOUD.trackTimer = 0; pickTracked();
  }
  const a = CLOUD.tracked;
  if (a && !a.done && CLOUD.detection) {
    const cams = camsSeeing(a);
    updateTrackLabel(a, cams);
    if (CLOUD.trackLabel) {
      CLOUD.trackLabel.visible = true;
      CLOUD.trackLabel.position.set(a.x, 2.05, a.z);
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

  // 視線レイ・注視スプラット・注視セル枠（毎フレーム）
  updateGazeFx(realDt);
  updateCellFrames(performance.now() / 1000);

  // ヒート再投影（人の動きに追随させるため高頻度）
  CLOUD.heatTimer += realDt;
  if (CLOUD.heatTimer > 0.25) {
    CLOUD.heatTimer = 0;
    updateCloudColors(); redrawFloorHeatCloud(); renderLiveActivity();
  }

  // 視線イベントのレート
  CLOUD.rateTimer += realDt;
  if (CLOUD.rateTimer >= 1) {
    if (CLOUD.gazeAcc > 0) CLOUD.gazeRate = Math.round((STATS.gazeEvents - CLOUD.gazeAcc) / CLOUD.rateTimer);
    CLOUD.gazeAcc = STATS.gazeEvents; CLOUD.rateTimer = 0;
  }

  // HUD
  CLOUD.hudTimer += realDt;
  if (CLOUD.hudTimer > 1.0) {
    CLOUD.hudTimer = 0;
    const portals = Object.values(EDGES).reduce((s, e) => s + e.length, 0) / 2;
    const tracked = CLOUD.tracked && !CLOUD.tracked.done ? 1 : 0;
    const el = document.getElementById('hud-top');
    if (el) el.textContent = `${CLOUD.cams.length} CAMERAS // ${tracked} TRACKED // ${portals} PORTALS`;
    const el2 = document.getElementById('hud-sub');
    if (el2) {
      const live = agents.filter(x => !x.done).length;
      el2.textContent = `${STORE.label.toUpperCase()} // ${live} DETECTIONS // ${CLOUD.gazeRate} GAZE/s // ${CLOUD.window === 'live' ? 'LIVE (60s)' : CLOUD.window === 'recent' ? 'LAST 30 MIN' : 'TODAY'}`;
    }
    const el3 = document.getElementById('hud-now');
    if (el3) {
      const a = CLOUD.tracked;
      if (a && !a.done && a.gazing && a.gazeShelf) {
        const sh = shelfById[a.gazeShelf];
        const row = Math.floor(a.gazeCell / GRID_U), colI = a.gazeCell % GRID_U;
        const tierName = ['最下段', '下段', '中段', '中上段', '上段', '最上段'][row] || '';
        el3.textContent = sh ? `NOW GAZING ▸ ${sh.name} / ${tierName} ${colI + 1}列目` : 'NOW GAZING ▸ —';
        el3.style.opacity = 1;
      } else { el3.style.opacity = 0.25; el3.textContent = 'NOW GAZING ▸ —'; }
    }
    renderHotspots();
    renderLiveActivity();
  }
}

/* ---------- 注目ホットスポット（HUD） ---------- */
function renderHotspots() {
  const el = document.getElementById('hud-hotspots');
  if (!el) return;
  const rows = SHELVES.map(s => {
    const st = STATS.shelves[s.id];
    const g = st && gridFor(st);
    let sum = 0;
    if (g) for (let i = 0; i < g.length; i++) sum += g[i];
    return { s, sum };
  }).filter(r => r.sum > 0).sort((a, b) => b.sum - a.sum);
  const total = rows.reduce((a, r) => a + r.sum, 0) || 1;
  if (!rows.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="color:#e8c37a;margin-bottom:3px">ATTENTION HOTSPOTS</div>' +
    rows.slice(0, 4).map((r, i) => {
      const share = r.sum / total;
      const [cr, cg, cb] = heatRamp(1 - i * 0.26);
      const hex = `rgb(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)})`;
      return `<div><i style="background:${hex}"></i>${i + 1}. ${r.s.name} — ${(share * 100).toFixed(1)}%</div>`;
    }).join('');
}

/* ---------- LIVE ACTIVITY（誰が何をしているか＝ヒートの供給源） ---------- */
const STATE_LABEL = {
  plan: '入店', walk: '回遊中', dwell: '立寄', toRegister: 'レジへ',
  queue: 'レジ待ち', pay: '会計中', exit: '退店中',
};
function renderLiveActivity() {
  const el = document.getElementById('la-rows');
  if (!el) return;
  const live = agents.filter(a => !a.done);
  if (!live.length) { el.innerHTML = '<div class="la-row">— 店内に検出なし —</div>'; return; }
  const rows = live.slice()
    .sort((a, b) => (b.gazing ? 1 : 0) - (a.gazing ? 1 : 0))
    .slice(0, 9)
    .map(a => {
      const c = '#' + new THREE.Color(a.persona.color).getHexString();
      let what = STATE_LABEL[a.state] || a.state;
      let cls = '';
      if (a.gazing && a.gazeShelf) {
        const sh = shelfById[a.gazeShelf];
        const row = Math.floor(a.gazeCell / GRID_U), colI = a.gazeCell % GRID_U;
        const tierName = ['最下段', '下段', '中段', '中上段', '上段', '最上段'][row] || '';
        const acc = a.gazeMap && a.gazeMap[a.gazeShelf] ? a.gazeMap[a.gazeShelf] : 0;
        what = `注視 ▸ ${sh ? sh.name : ''} ${tierName}${colI + 1}列 +${acc.toFixed(1)}s`;
        cls = 'la-gaze';
      } else if (a.state === 'dwell' && a.dwellShelf) {
        what = `立寄 ▸ ${a.dwellShelf.name}`;
      } else if (a.state === 'queue' && a.reg) {
        what = `レジ待ち ${a.reg.queue.indexOf(a) + 1}人目`;
      }
      const mark = a === CLOUD.tracked ? '▶' : ' ';
      return `<div class="la-row ${cls}">${mark}<i style="background:${c}"></i>#${100000 + (a.id % 9000)} ${a.persona.label.slice(0, 5)} ${what}</div>`;
    });
  el.innerHTML = rows.join('');
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
  if (hud) hud.style.display = CLOUD.on ? 'block' : 'none';
  document.body.classList.toggle('cloud-mode', CLOUD.on);
  if (CLOUD.on) {
    CLOUD.window = 'live';
    document.querySelectorAll('#heat-window button').forEach(x => x.classList.toggle('active', x.dataset.win === 'live'));
    CLOUD.gazeAcc = STATS.gazeEvents; CLOUD.rateTimer = 0; CLOUD.gazeRate = 0;
    redrawFloorHeatCloud();
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
document.getElementById('ly-rays').addEventListener('change', e => { CLOUD.rays = e.target.checked; });
document.getElementById('btn-reset-heat').addEventListener('click', () => {
  if (window.resetHeatmaps) resetHeatmaps();
});
document.getElementById('heat-source').addEventListener('click', e => {
  const b = e.target.closest('button[data-src]');
  if (!b) return;
  CLOUD.source = b.dataset.src;
  document.querySelectorAll('#heat-source button').forEach(x => x.classList.toggle('active', x === b));
  // 計測値は本日累計のみなので、窓の選択を合わせて無効化する
  document.querySelectorAll('#heat-window button').forEach(x => {
    x.disabled = CLOUD.source === 'obs';
    x.style.opacity = CLOUD.source === 'obs' ? 0.4 : 1;
  });
  updateCloudColors(); renderHotspots();
  if (selectedShelfId) drawShelfHeatMini(selectedShelfId);
});
document.getElementById('heat-window').addEventListener('click', e => {
  const b = e.target.closest('button[data-win]');
  if (!b) return;
  CLOUD.window = b.dataset.win;
  document.querySelectorAll('#heat-window button').forEach(x => x.classList.toggle('active', x === b));
  updateCloudColors(); renderHotspots();
  if (selectedShelfId) drawShelfHeatMini(selectedShelfId);
});

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
  const sm = smoothGrid(gridFor(st));
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
