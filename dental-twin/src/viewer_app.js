/* =========================================================================
   DENTAL TWIN Viewer — 3D core (SPEC.md Phase 1 / B-2)
   Three.js r128 / 単一HTML / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;

  /* ---------------------------------------------------------------- CONFIG */
  const CONFIG = {
    SURFACE_PICK: {
      OCC_ANGLE_LO: Math.cos(52 * Math.PI / 180), // 咬合面判定の角度下限
      OCC_ANGLE_HI: Math.cos(26 * Math.PI / 180), // 同 上限
      OCC_HR_LO: 0.42,                            // 咬合面とみなす高さ比 下限
      OCC_HR_HI: 0.68,
      LATERAL_T: 0.16,                            // 側面 softmax の温度
      ROOT_HR: 0.015,                             // これ未満は歯根
      CERVICAL_HR: 0.20
    },
    COLORS: {
      SOUND: 0xF2EDE4, CO: 0xFFF3B0, C1: 0xFFD166, C2: 0xF3722C,
      C3: 0xD62828, C4: 0x6A040F,
      ROOT: 0xE8DCC0, GINGIVA: 0xE5A3A0, BONE: 0xDCD5C8,
      CR: 0xA8DADC, IN_METAL: 0x9AA3AC, FMC: 0x9AA3AC,
      CERAMIC: 0xEFEDE8, PFM: 0xE3E0D8, IMPLANT: 0x4A5A6A,
      GHOST: 0xC9C9C9, HILITE: 0x2F6FEB,
      PD_OK: 0x2A9D8F, PD_MID: 0xE9C46A, PD_BAD: 0xE63946
    },
    CAMERA: { LERP: 0.14, FOV: 32, MIN_D: 40, MAX_D: 320 },
    GINGIVA_ALPHA: [1.0, 0.25, 0.18],  // 表示段階 ①②③
    BONE_VISIBLE: [false, false, true]
  };

  const SURF_JA = { O: '咬合面', I: '切縁', B: '頬側面', L: '舌側面', M: '近心面', D: '遠心面' };
  const SURF_JA_ANT = { B: '唇側面', L: '口蓋・舌側面' };
  const FINDING_JA = {
    SOUND: '健全', CO: '要観察歯 (CO)', C1: 'エナメル質う蝕 (C1)',
    C2: '象牙質う蝕 (C2)', C3: '歯髄に到達 (C3)', C4: '残根 (C4)',
    RESTORED: '修復物'
  };
  const FINDING_PT = {
    SOUND: '問題ありません', CO: '초기 — 要観察の初期変化', C1: '表面の初期の虫歯',
    C2: '内側（象牙質）まで進んだ虫歯', C3: '神経に達した虫歯',
    C4: '歯の根だけが残った状態', RESTORED: '治療済み（詰め物・かぶせ物）'
  };
  FINDING_PT.CO = '要観察（初期の変化）';
  const STATUS_JA = {
    SOUND: '健全', CARIES: 'う蝕', RESTORED: '修復済み', CROWN: '全部被覆冠',
    ROOT_CANAL_TREATED: '根管治療済み', IMPLANT: 'インプラント',
    MISSING: '欠損', UNERUPTED: '未萌出', IMPACTED: '埋伏', RETAINED_ROOT: '残根',
    BRIDGE_PONTIC: 'ブリッジ（人工歯）', BRIDGE_ABUTMENT: 'ブリッジ支台'
  };
  const STATUS_PT = {
    SOUND: '問題ありません', CARIES: '虫歯があります', RESTORED: '治療済みです',
    CROWN: 'かぶせ物が入っています', ROOT_CANAL_TREATED: '神経の治療が済んでいます',
    IMPLANT: 'インプラントです', MISSING: '歯がありません',
    UNERUPTED: 'まだ生えていません', IMPACTED: '埋まっている歯です',
    RETAINED_ROOT: '歯の根だけが残っています', BRIDGE_PONTIC: 'ブリッジ（人工の歯）です'
  };
  const PROC_JA = {
    CR_FILLING: 'コンポジットレジン充填', RCT: '根管治療', INLAY: 'インレー',
    CROWN: 'クラウン', EXTRACTION: '抜歯', SRP: 'スケーリング・ルートプレーニング',
    BRIDGE: 'ブリッジ', OBSERVE: '経過観察'
  };

  /* --------------------------------------------------------------- 歯番変換 */
  function fdiToPalmer(fdi) {
    const q = Math.floor(fdi / 10), n = fdi % 10;
    const jaw = (q === 1 || q === 2) ? '上' : '下';
    const side = (q === 1 || q === 4) ? '右' : '左';
    return jaw + side + n;
  }
  function isAnterior(fdi) { return (fdi % 10) <= 3; }

  /* ---------------------------------------------------------------- 色ヘルパ */
  const _c = new THREE.Color();
  function lin(hex) { _c.setHex(hex).convertSRGBToLinear(); return [_c.r, _c.g, _c.b]; }
  function linColor(hex) { return new THREE.Color().setHex(hex).convertSRGBToLinear(); }
  function smoothstep(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function normAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }  // -π..π

  /* ------------------------------------------------------------------ STATE */
  const S = {
    renderer: null, scene: null, camera: null, raycaster: new THREE.Raycaster(),
    maxilla: null, mandible: null,
    teeth: new Map(),          // fdi -> {mesh, ex, w, isRoot, axes...}
    gingiva: [], bone: [],
    findings: null,
    baseDoc: null,             // 現在の状態（唯一の編集対象。シミュレーションは導出値）
    simulated: false,          // 治療後シミュレーション表示中か
    undoStack: [],
    layers: { caries: true, restoration: true, root: false, bone: false, perio: false },
    stage: 0,                  // 0=通常 1=歯根 2=骨
    mode: 'clinician',         // 'clinician' | 'patient'
    openDeg: 0, openCur: 0,    // 開口: スライダー値と表示値（lerp で追従）
    gAlphaCur: 1.0, gAlphaTarget: 1.0,     // 歯肉の不透明度（滑らかに遷移）
    boneAlphaCur: 0.0, boneAlphaTarget: 0.0,
    selected: null, hovered: null,
    target: new THREE.Vector3(0, 0, 0),
    desired: { theta: 0, phi: Math.PI / 2, dist: 165, target: new THREE.Vector3(0, 0, 0) },
    cur: { theta: 0, phi: Math.PI / 2, dist: 165, target: new THREE.Vector3(0, 0, 0) },
    needsRecolor: true, ready: false
  };
  window.__DT = S;   // 検証用フック

  /* ------------------------------------------------------------------- 初期化 */
  function init() {
    const host = document.getElementById('view');
    S.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    S.renderer.setSize(host.clientWidth, host.clientHeight);
    S.renderer.outputEncoding = THREE.sRGBEncoding;
    S.renderer.setClearColor(0xF4F6F8, 1);
    host.appendChild(S.renderer.domElement);

    S.scene = new THREE.Scene();
    S.camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.FOV,
      host.clientWidth / host.clientHeight, 1, 2000);

    // 2D モード用: 上下顎の咬合面を俯瞰する平行投影カメラ（SPEC §5.11）。
    // 両ビューとも患者の右が画面左、前歯が画面の外側（開いた口を覗く向き）
    S.cam2dU = new THREE.OrthographicCamera(-50, 50, 36, -36, 1, 500);
    S.cam2dU.position.set(0, -140, -8);
    S.cam2dU.up.set(0, 0, 1);
    S.cam2dU.lookAt(0, 0, -8);
    S.cam2dL = new THREE.OrthographicCamera(-50, 50, 36, -36, 1, 500);
    S.cam2dL.position.set(0, 140, -8);
    S.cam2dL.up.set(0, 0, -1);
    S.cam2dL.lookAt(0, 0, -8);

    S.scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x9AA5B1, 0.72));
    const d1 = new THREE.DirectionalLight(0xFFFFFF, 0.62); d1.position.set(60, 90, 120);
    const d2 = new THREE.DirectionalLight(0xFFFFFF, 0.30); d2.position.set(-80, 40, -90);
    const d3 = new THREE.DirectionalLight(0xFFFFFF, 0.22); d3.position.set(0, -110, 40);
    S.scene.add(d1, d2, d3);

    bindOrbit(S.renderer.domElement);
    bindUI();
    window.addEventListener('resize', onResize);

    loadModel();
    animate();
  }

  function onResize() {
    const host = document.getElementById('view');
    S.camera.aspect = host.clientWidth / host.clientHeight;
    S.camera.updateProjectionMatrix();
    S.renderer.setSize(host.clientWidth, host.clientHeight);
  }

  /* ------------------------------------------------------------- モデル読み込み */
  function b64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }

  function loadModel() {
    const loader = new THREE.GLTFLoader();
    let ab;
    try {
      ab = b64ToArrayBuffer(window.__DENTAL_GLB_B64);
    } catch (e) {
      fail('モデルデータの復号に失敗しました: ' + e.message); return;
    }
    loader.parse(ab, '', function (gltf) {
      try { setupScene(gltf.scene); } catch (e) { fail('モデル構築エラー: ' + e.message); }
    }, function (e) { fail('GLB の解析に失敗しました: ' + e); });
  }

  function fail(msg) {
    const el = document.getElementById('loading');
    el.classList.remove('hide');
    el.innerHTML = '<div class="err">' + msg + '</div>';
  }

  function setupScene(root) {
    S.scene.add(root);
    const unknown = [];

    root.traverse(function (o) {
      if (o.name === 'maxilla') S.maxilla = o;
      if (o.name === 'mandible') S.mandible = o;
      if (!o.isMesh) return;

      const nm = o.name;
      if (/^tooth_\d{2}$/.test(nm)) {
        const ex = o.userData || {};
        if (typeof ex.fdi !== 'number') { unknown.push(nm + ' (extras欠落)'); return; }
        o.material = new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.42, metalness: 0.0,
          transparent: true, opacity: 1.0
        });
        prepareTooth(o, ex);
      } else if (/^(gingiva_(upper|lower)|palate_upper|floor_lower)$/.test(nm)) {
        o.material = new THREE.MeshStandardMaterial({
          color: linColor(CONFIG.COLORS.GINGIVA), roughness: 0.78, metalness: 0.0,
          transparent: true, opacity: 1.0, depthWrite: true, side: THREE.DoubleSide
        });
        o.userData.__jawGroup = /upper/.test(nm) ? 'U' : 'L';
        S.gingiva.push(o);
      } else if (/^bone_(upper|lower)$/.test(nm)) {
        o.material = new THREE.MeshStandardMaterial({
          color: linColor(CONFIG.COLORS.BONE), roughness: 0.9, metalness: 0.0,
          transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide
        });
        o.visible = false;
        S.bone.push(o);
      } else {
        unknown.push(nm);
      }
    });

    if (unknown.length) console.warn('[DENTAL TWIN] 命名規約外のノード:', unknown);
    if (S.teeth.size !== 32) console.warn('[DENTAL TWIN] 歯ノード数が32でない:', S.teeth.size);
    if (!S.mandible) console.warn('[DENTAL TWIN] mandible グループが見つかりません');

    // 歯周マーカー用オーバーレイ（顎グループの子にして開口に追従させる）
    S.perioU = new THREE.Group(); S.perioU.name = 'overlays_upper';
    S.perioL = new THREE.Group(); S.perioL.name = 'overlays_lower';
    if (S.maxilla) S.maxilla.add(S.perioU); else S.scene.add(S.perioU);
    if (S.mandible) S.mandible.add(S.perioL); else S.scene.add(S.perioL);

    buildChart();
    loadFindings(window.__FINDINGS || null);
    setPreset('front', true);
    S.ready = true;
    document.getElementById('loading').classList.add('hide');
    document.getElementById('meta').textContent =
      '歯 ' + S.teeth.size + ' / 三角形 ' + countTris().toLocaleString();
  }

  function countTris() {
    let n = 0;
    S.scene.traverse(function (o) {
      if (o.isMesh && o.geometry.index) n += o.geometry.index.count / 3;
    });
    return Math.round(n);
  }

  /* ------------------------------------------------- 歯面判定（SPEC §5.1 実装） */
  function classify(nx, ny, nz, hr, ax) {
    const P = CONFIG.SURFACE_PICK;
    const no = nx * ax.o.x + ny * ax.o.y + nz * ax.o.z;
    const wO = smoothstep(P.OCC_ANGLE_LO, P.OCC_ANGLE_HI, no) *
               smoothstep(P.OCC_HR_LO, P.OCC_HR_HI, hr);
    const dB = nx * ax.b.x + ny * ax.b.y + nz * ax.b.z;
    const dM = nx * ax.m.x + ny * ax.m.y + nz * ax.m.z;
    const d = [dB, -dB, dM, -dM];          // B, L, M, D
    let mx = -Infinity;
    for (let i = 0; i < 4; i++) if (d[i] > mx) mx = d[i];
    let sum = 0; const e = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { e[i] = Math.exp((d[i] - mx) / P.LATERAL_T); sum += e[i]; }
    const k = (1 - wO) / sum;
    return [wO, e[0] * k, e[1] * k, e[2] * k, e[3] * k];   // O,B,L,M,D
  }

  function prepareTooth(mesh, ex) {
    const g = mesh.geometry;
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const n = g.attributes.position.count;

    const ax = {
      o: new THREE.Vector3().fromArray(ex.axis_occlusal),
      b: new THREE.Vector3().fromArray(ex.axis_buccal),
      m: new THREE.Vector3().fromArray(ex.axis_mesial)
    };
    const c = new THREE.Vector3().fromArray(ex.centroid);
    const span = ex.crown_top_h - ex.cej_h;

    const W = new Float32Array(n * 5);
    const isRoot = new Uint8Array(n);
    const hrArr = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const px = pos[i * 3] - c.x, py = pos[i * 3 + 1] - c.y, pz = pos[i * 3 + 2] - c.z;
      const h = px * ax.o.x + py * ax.o.y + pz * ax.o.z;
      const hr = (h - ex.cej_h) / span;
      hrArr[i] = hr;
      if (hr < CONFIG.SURFACE_PICK.ROOT_HR) { isRoot[i] = 1; continue; }
      const w = classify(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], hr, ax);
      W[i * 5] = w[0]; W[i * 5 + 1] = w[1]; W[i * 5 + 2] = w[2];
      W[i * 5 + 3] = w[3]; W[i * 5 + 4] = w[4];
    }

    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    S.teeth.set(ex.fdi, {
      fdi: ex.fdi, mesh: mesh, ex: ex, ax: ax, centroid: c,
      W: W, isRoot: isRoot, hr: hrArr, span: span
    });
    mesh.userData.__fdi = ex.fdi;
  }

  /* --------------------------------------------------------------- 所見の適用 */
  function applyFindings(doc) {
    S.findings = doc;
    S.byTooth = new Map();
    if (doc && doc.teeth) {
      doc.teeth.forEach(function (t) { S.byTooth.set(t.fdi, t); });
    }
    S.plan = new Map();
    if (doc && doc.plan) doc.plan.forEach(function (p) {
      if (!S.plan.has(p.fdi)) S.plan.set(p.fdi, []);
      S.plan.get(p.fdi).push(p);
    });
    S.needsRecolor = true;
    renderChartSummary();
  }

  const SEVERITY = { SOUND: 0, CO: 1, C1: 2, C2: 3, C3: 4, C4: 5 };

  function surfaceColorFor(fdi, rec, surf) {
    const C = CONFIG.COLORS;
    if (!rec) return C.SOUND;
    if (rec.status === 'IMPLANT') return C.IMPLANT;
    if (rec.status === 'CROWN' || rec.status === 'BRIDGE_PONTIC') return C.CERAMIC;
    if (!rec.surfaces) return C.SOUND;
    for (let i = 0; i < rec.surfaces.length; i++) {
      const s = rec.surfaces[i];
      const key = (s.surface === 'I') ? 'O' : s.surface;
      if (key !== surf) continue;
      if (s.finding === 'RESTORED') {
        if (!S.layers.restoration) return C.SOUND;
        const m = s.material || 'CR';
        return C[m] || C.CR;
      }
      if (!S.layers.caries) return C.SOUND;
      return C[s.finding] !== undefined ? C[s.finding] : C.SOUND;
    }
    return C.SOUND;
  }

  function recolorAll() {
    S.teeth.forEach(function (t) {
      const rec = S.byTooth ? S.byTooth.get(t.fdi) : null;
      const st = rec ? rec.status : 'SOUND';

      if (st === 'MISSING') { t.mesh.visible = false; return; }
      t.mesh.visible = true;
      const faded = (st === 'UNERUPTED' || st === 'IMPACTED');
      t.mesh.material.opacity = faded ? 0.35 : 1.0;
      t.mesh.material.transparent = faded || S.stage > 0;

      const cO = lin(surfaceColorFor(t.fdi, rec, 'O'));
      const cB = lin(surfaceColorFor(t.fdi, rec, 'B'));
      const cL = lin(surfaceColorFor(t.fdi, rec, 'L'));
      const cM = lin(surfaceColorFor(t.fdi, rec, 'M'));
      const cD = lin(surfaceColorFor(t.fdi, rec, 'D'));
      let rootCol = lin(CONFIG.COLORS.ROOT);
      if (st === 'IMPLANT') rootCol = lin(CONFIG.COLORS.IMPLANT);
      if (st === 'ROOT_CANAL_TREATED') rootCol = lin(0xD9C9A8);
      if (st === 'BRIDGE_PONTIC') rootCol = lin(CONFIG.COLORS.CERAMIC);

      const col = t.mesh.geometry.attributes.color.array;
      const W = t.W, isRoot = t.isRoot, n = t.isRoot.length;
      const hi = (S.selected === t.fdi) ? 0.22 : 0.0;
      const hc = lin(CONFIG.COLORS.HILITE);

      for (let i = 0; i < n; i++) {
        let r, g, b;
        if (isRoot[i]) { r = rootCol[0]; g = rootCol[1]; b = rootCol[2]; }
        else {
          const o = W[i * 5], wb = W[i * 5 + 1], wl = W[i * 5 + 2],
                wm = W[i * 5 + 3], wd = W[i * 5 + 4];
          r = o * cO[0] + wb * cB[0] + wl * cL[0] + wm * cM[0] + wd * cD[0];
          g = o * cO[1] + wb * cB[1] + wl * cL[1] + wm * cM[1] + wd * cD[1];
          b = o * cO[2] + wb * cB[2] + wl * cL[2] + wm * cM[2] + wd * cD[2];
        }
        if (hi > 0) { r += (hc[0] - r) * hi; g += (hc[1] - g) * hi; b += (hc[2] - b) * hi; }
        col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      }
      t.mesh.geometry.attributes.color.needsUpdate = true;
    });

    // 不透明度は目標値だけ更新し、実際の遷移は animate() が毎フレーム lerp する
    S.gAlphaTarget = CONFIG.GINGIVA_ALPHA[S.stage];
    S.boneAlphaTarget = (CONFIG.BONE_VISIBLE[S.stage] || S.layers.bone) ? 0.34 : 0.0;
    updatePerioMarkers();
    S.needsRecolor = false;
  }

  /* ------------------------------------------------------------ カメラプリセット */
  const PRESETS = {
    front:    { theta: 0,            phi: Math.PI / 2,      dist: 150, t: [0, 0, 0] },
    occ_up:   { theta: 0,            phi: Math.PI - 0.001,  dist: 150, t: [0, 6, 3] },
    occ_low:  { theta: 0,            phi: 0.001,            dist: 150, t: [0, -6, 3] },
    right:    { theta: -Math.PI / 2, phi: Math.PI / 2,      dist: 150, t: [0, 0, 0] },
    left:     { theta: Math.PI / 2,  phi: Math.PI / 2,      dist: 150, t: [0, 0, 0] }
  };

  function setPreset(k, instant) {
    const p = PRESETS[k]; if (!p) return;
    // 咬合面観は対合顎が手前に来て視界を塞ぐため、対合顎を隠す
    if (S.maxilla) S.maxilla.visible = (k !== 'occ_low');
    if (S.mandible) S.mandible.visible = (k !== 'occ_up');
    S.isolated = (k === 'occ_up') ? 'U' : (k === 'occ_low' ? 'L' : null);
    const iso = document.getElementById('isoNote');
    if (iso) {
      iso.textContent = S.isolated === 'U' ? '上顎のみ表示中'
                      : (S.isolated === 'L' ? '下顎のみ表示中' : '');
      iso.classList.toggle('hide', !S.isolated);
    }
    S.desired.theta = p.theta; S.desired.phi = p.phi; S.desired.dist = p.dist;
    S.desired.target.set(p.t[0], p.t[1], p.t[2]);
    S.needsRecolor = true;   // 顎の表示切替に歯周マーカー等を追従させる
    if (instant) {
      S.cur.theta = p.theta; S.cur.phi = p.phi; S.cur.dist = p.dist;
      S.cur.target.copy(S.desired.target);
    }
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.preset === k);
    });
  }

  function focusTooth(fdi) {
    if (S.view2d) return;   // 2D は固定ビュー（選択のみ。カメラは動かさない）
    const t = S.teeth.get(fdi); if (!t) return;
    if (!S.isolated) {
      if (S.maxilla) S.maxilla.visible = true;
      if (S.mandible) S.mandible.visible = true;
    }
    // 開口中の下顎回転を含むワールド座標でフレーミングする
    t.mesh.updateWorldMatrix(true, false);
    S.desired.target.copy(t.centroid).applyMatrix4(t.mesh.matrixWorld);
    S.desired.dist = 62;
    const c = t.centroid;
    S.desired.theta = Math.atan2(c.x * 0.9 + t.ax.b.x * 20, c.z * 0.9 + t.ax.b.z * 20);
    S.desired.phi = Math.PI / 2 - t.ax.b.y * 0.6;
    document.querySelectorAll('[data-preset]').forEach(function (b) { b.classList.remove('on'); });
  }

  /* ------------------------------------------------------------- Orbit（自前） */
  function bindOrbit(dom) {
    let dragging = false, panning = false, lx = 0, ly = 0, moved = 0;
    let pinch = 0;

    function down(x, y, isPan) { dragging = true; panning = isPan; lx = x; ly = y; moved = 0; }
    function move(x, y) {
      if (!dragging) return;
      const dx = x - lx, dy = y - ly; lx = x; ly = y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (S.view2d) return;   // 2D は固定ビュー（タップ判定のための moved 加算のみ）
      if (panning) {
        const s = S.desired.dist * 0.0016;
        const right = new THREE.Vector3().setFromMatrixColumn(S.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(S.camera.matrix, 1);
        S.desired.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else {
        S.desired.theta -= dx * 0.0075;
        S.desired.phi = Math.max(0.02, Math.min(Math.PI - 0.02, S.desired.phi - dy * 0.0075));
      }
    }
    function up() { dragging = false; panning = false; }

    dom.addEventListener('mousedown', function (e) {
      e.preventDefault(); down(e.clientX, e.clientY, e.button === 2 || e.shiftKey);
    });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', function (e) {
      if (dragging && moved < 5 && !panning) pick(e.clientX, e.clientY, true);
      up();
    });
    dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    dom.addEventListener('mousemove', function (e) {
      if (!dragging) pick(e.clientX, e.clientY, false);
    });
    dom.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (S.view2d) return;
      const d = S.desired.dist * (1 + Math.sign(e.deltaY) * 0.09);
      S.desired.dist = Math.max(CONFIG.CAMERA.MIN_D, Math.min(CONFIG.CAMERA.MAX_D, d));
    }, { passive: false });

    dom.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY, false);
      else if (e.touches.length === 2) {
        dragging = false;
        pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    dom.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2 && pinch && !S.view2d) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                             e.touches[0].clientY - e.touches[1].clientY);
        S.desired.dist = Math.max(CONFIG.CAMERA.MIN_D,
          Math.min(CONFIG.CAMERA.MAX_D, S.desired.dist * pinch / d));
        pinch = d;
      }
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchend', function (e) {
      if (dragging && moved < 8 && e.changedTouches.length) {
        pick(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
      }
      up(); pinch = 0;
    });
  }

  /* -------------------------------------------------------------- ピッキング */
  const _ndc = new THREE.Vector2();
  function pick(cx, cy, isClick) {
    if (!S.ready) return;
    const host = document.getElementById('view');
    const r = host.getBoundingClientRect();
    let cam = S.camera, jawFilter = null;
    if (S.view2d) {
      // 上半分 = 上顎ビュー / 下半分 = 下顎ビュー のカメラでピッキング
      const topHalf = (cy - r.top) < r.height / 2;
      cam = topHalf ? S.cam2dU : S.cam2dL;
      jawFilter = topHalf ? 'U' : 'L';
      const subTop = topHalf ? r.top : r.top + r.height / 2;
      _ndc.x = ((cx - r.left) / r.width) * 2 - 1;
      _ndc.y = -((cy - subTop) / (r.height / 2)) * 2 + 1;
    } else {
      _ndc.x = ((cx - r.left) / r.width) * 2 - 1;
      _ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    }
    S.raycaster.setFromCamera(_ndc, cam);

    const meshes = [];
    S.teeth.forEach(function (t) {
      if (!t.mesh.visible) return;
      const jaw = t.ex.jaw;
      if (S.isolated && S.isolated !== jaw) return;
      if (jawFilter && jaw !== jawFilter) return;
      meshes.push(t.mesh);
    });
    const hits = S.raycaster.intersectObjects(meshes, false);

    const tip = document.getElementById('tip');
    if (!hits.length) {
      tip.classList.add('hide');
      if (isClick) {
        S.selected = null; S.needsRecolor = true; renderDetail(null);
        updateChart(); closePop();   // 2D チャートの選択ハイライトと入力UIも解除する
      }
      return;
    }
    const h = hits[0];
    const fdi = h.object.userData.__fdi;
    const t = S.teeth.get(fdi);
    const surf = surfaceAt(t, h);

    tip.classList.remove('hide');
    tip.style.left = (cx - r.left + 14) + 'px';
    tip.style.top = (cy - r.top + 14) + 'px';
    tip.innerHTML = tipHTML(t, surf);

    if (isClick) {
      S.selected = fdi; S.needsRecolor = true;
      focusTooth(fdi); renderDetail(fdi, surf);
      // 2D チャートへ同期（3D タップでは所見登録もポップオーバーも行わない: SPEC §5.7）
      updateChart();
      if (!document.getElementById('pop').classList.contains('hide')) openPop(fdi);
    }
  }

  function surfaceAt(t, hit) {
    // ヒット点はワールド座標。開口中の下顎は回転しているため、
    // extras の軸（ローカル座標）と比較する前に必ずローカルへ戻す
    const p = t.mesh.worldToLocal(hit.point.clone()).sub(t.centroid);
    const h = p.dot(t.ax.o);
    const hr = (h - t.ex.cej_h) / t.span;
    if (hr < CONFIG.SURFACE_PICK.ROOT_HR) return { key: 'ROOT', hr: hr, cervical: false };
    const n = hit.face.normal.clone();
    const w = classify(n.x, n.y, n.z, hr, t.ax);
    const keys = ['O', 'B', 'L', 'M', 'D'];
    let bi = 0;
    for (let i = 1; i < 5; i++) if (w[i] > w[bi]) bi = i;
    let key = keys[bi];
    if (key === 'O' && isAnterior(t.fdi)) key = 'I';
    return { key: key, hr: hr, cervical: hr < CONFIG.SURFACE_PICK.CERVICAL_HR, w: w };
  }

  function surfName(fdi, key) {
    if (key === 'ROOT') return '歯根';
    if (isAnterior(fdi) && SURF_JA_ANT[key]) return SURF_JA_ANT[key];
    return SURF_JA[key] || key;
  }

  function findingOf(fdi, key) {
    const rec = S.byTooth ? S.byTooth.get(fdi) : null;
    if (!rec || !rec.surfaces) return null;
    const k = (key === 'I') ? 'O' : key;
    for (let i = 0; i < rec.surfaces.length; i++) {
      const s = rec.surfaces[i];
      if (((s.surface === 'I') ? 'O' : s.surface) === k) return s;
    }
    return null;
  }

  function tipHTML(t, surf) {
    const rec = S.byTooth ? S.byTooth.get(t.fdi) : null;
    const st = rec ? rec.status : 'SOUND';
    const f = findingOf(t.fdi, surf.key);
    const pt = S.mode === 'patient';
    let line2;
    if (surf.key === 'ROOT') line2 = '歯根';
    else if (!f) line2 = surfName(t.fdi, surf.key) + '：' + (pt ? '問題ありません' : '健全');
    else {
      const lab = pt ? (FINDING_PT[f.finding] || f.finding) : (FINDING_JA[f.finding] || f.finding);
      line2 = surfName(t.fdi, surf.key) + '：' + lab;
    }
    const head = pt ? fdiToPalmer(t.fdi) + 'の歯'
                    : t.fdi + '（' + fdiToPalmer(t.fdi) + '）　' + (STATUS_JA[st] || st);
    return '<b>' + head + '</b><br>' + line2 +
           (surf.cervical && !pt ? '<br><span class="sub">歯頸部</span>' : '');
  }

  /* -------------------------------------------------------------------- UI */
  function bindUI() {
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { setPreset(b.dataset.preset); });
    });
    document.querySelectorAll('[data-layer]').forEach(function (b) {
      b.addEventListener('click', function () {
        const k = b.dataset.layer;
        S.layers[k] = !S.layers[k];
        b.classList.toggle('on', S.layers[k]);
        S.needsRecolor = true;
      });
    });
    const stage = document.getElementById('stage');
    stage.addEventListener('input', function () {
      S.stage = parseInt(stage.value, 10);
      document.getElementById('stageLabel').textContent =
        ['① 通常', '② 歯ぐきの中', '③ 骨の状態'][S.stage];
      S.needsRecolor = true;
    });
    const open = document.getElementById('open');
    open.addEventListener('input', function () {
      S.openDeg = parseFloat(open.value);
      const lb = document.getElementById('openLabel');
      if (lb) lb.textContent = S.openDeg > 0 ? '開口 ' + Math.round(S.openDeg) + '°' : '開口';
    });

    document.getElementById('modeBtn').addEventListener('click', function () {
      S.mode = (S.mode === 'clinician') ? 'patient' : 'clinician';
      document.body.classList.toggle('patient', S.mode === 'patient');
      this.textContent = (S.mode === 'patient') ? '患者説明モード' : '術者モード';
      closePop();                       // 入力UIは術者モード専用。視点と選択歯は維持する
      renderDetail(S.selected);
      renderChartSummary();
    });

    // 所見JSONの読み込みUIはプロトタイプ評価中は撤去（SPEC §5.13）。
    // input#file を復活させればそのまま動く
    const fileEl = document.getElementById('file');
    if (fileEl) fileEl.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = function () {
        try {
          const doc = JSON.parse(rd.result);
          loadFindings(doc);
          document.getElementById('meta').textContent =
            '読み込み: ' + (doc.exam_id || f.name);
        } catch (err) { alert('JSON の読み込みに失敗しました: ' + err.message); }
      };
      rd.readAsText(f);
    });
    document.getElementById('reset').addEventListener('click', function () {
      stopSeq(); closePop(); setSimulated(false);
      S.selected = null; S.needsRecolor = true;
      setPreset('front'); renderDetail(null); updateChart();
    });

    /* --- B-3.3: 2D 表示モード（咬合面俯瞰ツインビュー） --- */
    document.getElementById('dimBtn').addEventListener('click', function () {
      S.view2d = !S.view2d;
      document.body.classList.toggle('mode2d', S.view2d);
      this.textContent = S.view2d ? '3D表示' : '2D表示';
      this.classList.toggle('on', S.view2d);
      stopSeq(); closePop();
      document.getElementById('jawTagU').classList.toggle('hide', !S.view2d);
      document.getElementById('jawTagL').classList.toggle('hide', !S.view2d);
      document.getElementById('split2d').classList.toggle('hide', !S.view2d);
      if (S.view2d) {
        // 顎の isolation を解除して両顎を表示（3D のカメラ状態は保持したまま）
        if (S.maxilla) S.maxilla.visible = true;
        if (S.mandible) S.mandible.visible = true;
        S.isolated = null;
        const iso = document.getElementById('isoNote');
        if (iso) iso.classList.add('hide');
        document.querySelectorAll('[data-preset]').forEach(function (b) {
          b.classList.remove('on');
        });
      }
      onResize();
      updateChart();
    });

    /* --- B-3.3: パネルの折りたたみ（3Dを最大化） --- */
    document.getElementById('sideTgl').addEventListener('click', function () {
      const closed = document.body.classList.toggle('noside');
      this.textContent = closed ? '⟨' : '⟩';
      this.title = closed ? '右パネルをひらく' : '右パネルをたたむ';
      onResize();
    });
    document.getElementById('chartTgl').addEventListener('click', function () {
      const closed = document.body.classList.toggle('nochart');
      this.textContent = closed ? 'ひらく' : 'たたむ';
      onResize();
    });

    /* --- B-3: チャート入力・シミュレーション・プリセット --- */
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('saveBtn').addEventListener('click', saveFindings);
    document.getElementById('simBtn').addEventListener('click', function () {
      setSimulated(!S.simulated);
    });
    document.querySelectorAll('[data-seq]').forEach(function (b) {
      b.addEventListener('click', function () { runSeq(b.dataset.seq); });
    });
    // 3D ビューへのタッチで自動再生を即時中断する（SPEC §5.6 追記）
    document.getElementById('view').addEventListener('pointerdown', function () { stopSeq(); });
  }

  function renderDetail(fdi, surf) {
    const el = document.getElementById('detail');
    if (fdi == null) {
      el.innerHTML = '<div class="ph">歯をタップすると詳細が表示されます</div>';
      return;
    }
    const rec = S.byTooth ? S.byTooth.get(fdi) : null;
    const pt = S.mode === 'patient';
    const st = rec ? rec.status : 'SOUND';
    let h = '<div class="dh">' + (pt ? fdiToPalmer(fdi) + 'の歯'
      : fdi + '　' + fdiToPalmer(fdi)) + '</div>';
    h += '<div class="drow"><span>状態</span><b>' +
         ((pt ? STATUS_PT[st] : STATUS_JA[st]) || st) + '</b></div>';

    if (rec && rec.surfaces && rec.surfaces.length) {
      h += '<div class="dsec">歯面ごとの所見</div>';
      rec.surfaces.forEach(function (s) {
        const lab = pt ? (FINDING_PT[s.finding] || s.finding)
                       : (FINDING_JA[s.finding] || s.finding);
        const col = s.finding === 'RESTORED'
          ? (CONFIG.COLORS[s.material || 'CR'] || CONFIG.COLORS.CR)
          : (CONFIG.COLORS[s.finding] || CONFIG.COLORS.SOUND);
        h += '<div class="drow"><span><i class="sw" style="background:#' +
             ('000000' + col.toString(16)).slice(-6) + '"></i>' +
             surfName(fdi, s.surface) + '</span><b>' + lab + '</b></div>';
      });
    }
    if (!pt && rec && rec.perio) {
      const sites = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];
      h += '<div class="dsec">歯周ポケット (mm)</div><div class="perio">';
      sites.forEach(function (k) {
        const m = rec.perio[k]; if (!m) return;
        const cls = m.pd >= 6 ? 'bad' : (m.pd >= 4 ? 'mid' : 'ok');
        h += '<div class="pc ' + cls + '"><em>' + k + '</em>' + m.pd +
             (m.bop ? '<u>･</u>' : '') + '</div>';
      });
      h += '</div>';
    }
    const pl = S.plan ? S.plan.get(fdi) : null;
    if (pl && pl.length) {
      h += '<div class="dsec">' + (pt ? 'これからの治療' : '治療計画') + '</div>';
      pl.forEach(function (p) {
        h += '<div class="drow"><span>' + (PROC_JA[p.procedure] || p.procedure) +
             '</span><b>' + (p.visits ? p.visits + '回' : '—') + '</b></div>';
        if (p.note && !pt) h += '<div class="note">' + p.note + '</div>';
      });
    }
    el.innerHTML = h;
  }

  function renderChartSummary() {
    // KPI は常に「現在の状態」(baseDoc) から計算する。シミュレーションに引きずられない
    const el = document.getElementById('summary');
    if (!S.baseDoc || !S.baseDoc.teeth) { el.textContent = ''; return; }
    let caries = 0, missing = 0, restored = 0, deep = 0;
    S.baseDoc.teeth.forEach(function (t) {
      if (t.status === 'MISSING') missing++;
      if (t.status === 'RESTORED' || t.status === 'CROWN') restored++;
      (t.surfaces || []).forEach(function (s) {
        if (SEVERITY[s.finding] >= 2) caries++;
        if (SEVERITY[s.finding] >= 4) deep++;
      });
    });
    el.innerHTML =
      '<span class="kpi"><b>' + caries + '</b>面 要処置</span>' +
      '<span class="kpi"><b>' + deep + '</b>面 進行</span>' +
      '<span class="kpi"><b>' + missing + '</b>本 欠損</span>' +
      '<span class="kpi"><b>' + restored + '</b>本 治療済</span>';
  }

  /* =======================================================================
     B-3 — 所見入力（2Dチャート） / 治療後シミュレーション / 歯周3D重畳 /
           説明プリセット   （SPEC §5.6 / §5.7.1 / §5.9 / §5.10）
     ======================================================================= */

  /* ------------------------------------------------ 現在の状態（編集の唯一の対象） */
  function ensureDoc() {
    if (!S.baseDoc) {
      S.baseDoc = {
        schema_version: '1.0', patient_ref: 'P-000000', exam_id: 'E-LOCAL-EDIT',
        notation: 'FDI', note: 'ビューア上で手入力された所見', teeth: [], plan: []
      };
    }
    return S.baseDoc;
  }

  function loadFindings(doc) {
    S.baseDoc = doc ? JSON.parse(JSON.stringify(doc)) : null;
    S.undoStack.length = 0; syncUndoBtn();
    if (S.simulated) setSimulatedUI(false);
    refreshDisplay();
  }

  function refreshDisplay() {
    const doc = (S.simulated && S.baseDoc) ? simulateAfter(S.baseDoc) : S.baseDoc;
    applyFindings(doc);
    updateChart();
    if (S.selected != null) renderDetail(S.selected);
  }

  function baseRec(fdi) {
    if (!S.baseDoc || !S.baseDoc.teeth) return null;
    for (let i = 0; i < S.baseDoc.teeth.length; i++) {
      if (S.baseDoc.teeth[i].fdi === fdi) return S.baseDoc.teeth[i];
    }
    return null;
  }

  function toothRec(fdi) {
    ensureDoc();
    let rec = baseRec(fdi);
    if (!rec) { rec = { fdi: fdi, status: 'SOUND', surfaces: [] }; S.baseDoc.teeth.push(rec); }
    return rec;
  }

  /* ----------------------------------------------------------------- Undo */
  function pushUndo() {
    ensureDoc();
    S.undoStack.push(JSON.stringify(S.baseDoc));
    if (S.undoStack.length > 50) S.undoStack.shift();
    syncUndoBtn();
  }
  function undo() {
    const s = S.undoStack.pop(); syncUndoBtn();
    if (!s) return;
    S.baseDoc = JSON.parse(s);
    refreshDisplay();
    if (popFdi != null) renderPop();
  }
  function syncUndoBtn() {
    const b = document.getElementById('undoBtn');
    if (b) b.disabled = !S.undoStack.length;
  }

  /* ----------------------------------------------------- 所見の変更（術者入力） */
  function normSurf(k) { return k === 'I' ? 'O' : k; }

  function deriveStatus(rec) {
    // 歯単位ステータスが所見系のときのみ、面所見から導出し直す
    if (['SOUND', 'CARIES', 'RESTORED'].indexOf(rec.status) < 0) return;
    let anyCaries = false, anyRest = false;
    (rec.surfaces || []).forEach(function (s) {
      if ((SEVERITY[s.finding] || 0) >= 1) anyCaries = true;
      if (s.finding === 'RESTORED') anyRest = true;
    });
    rec.status = anyCaries ? 'CARIES' : (anyRest ? 'RESTORED' : 'SOUND');
  }

  function setSurfaceFinding(fdi, surf, finding, material) {
    pushUndo();
    const rec = toothRec(fdi);
    const k = normSurf(surf);
    rec.surfaces = (rec.surfaces || []).filter(function (s) {
      return normSurf(s.surface) !== k;
    });
    if (finding === 'RESTORED') {
      rec.surfaces.push({ surface: k, finding: 'RESTORED', material: material || 'CR' });
    } else if (finding !== 'SOUND') {
      rec.surfaces.push({ surface: k, finding: finding });
    }
    deriveStatus(rec);
    refreshDisplay();
  }

  function setToothStatus(fdi, status) {
    pushUndo();
    const rec = toothRec(fdi);
    rec.status = status;
    if (status === 'SOUND') { rec.surfaces = []; }
    refreshDisplay();
  }

  /* ------------------------------------------------------- 所見JSONローカル保存 */
  function saveFindings() {
    if (!S.baseDoc) ensureDoc();
    const blob = new Blob([JSON.stringify(S.baseDoc, null, 1)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'findings_' + (S.baseDoc.exam_id || 'edited') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* -------------------------------------------- 治療後シミュレーション（導出値） */
  const PROC_PT = {
    CR_FILLING: '虫歯を削って白い詰め物をします', INLAY: '型どりした詰め物を入れます',
    RCT: '歯の神経の治療をします', CROWN: 'かぶせ物をします',
    EXTRACTION: '歯を抜きます', SRP: '歯石とりと根の清掃を行います',
    BRIDGE: '両どなりの歯で支えるブリッジを入れます', OBSERVE: '経過を観察します'
  };

  function restoreSurfaces(rec, surfStr, mat) {
    const targets = (surfStr || '').split('');
    targets.forEach(function (ch) {
      const k = normSurf(ch);
      if ('MDBLO'.indexOf(k) < 0) return;
      rec.surfaces = (rec.surfaces || []).filter(function (s) {
        return normSurf(s.surface) !== k;
      });
      rec.surfaces.push({ surface: k, finding: 'RESTORED', material: mat, simulated: true });
    });
  }

  function simulateAfter(doc) {
    const sim = JSON.parse(JSON.stringify(doc));
    const byT = new Map();
    (sim.teeth || []).forEach(function (t) { byT.set(t.fdi, t); });
    (sim.plan || []).forEach(function (p) {
      let rec = byT.get(p.fdi);
      if (!rec) { rec = { fdi: p.fdi, status: 'SOUND', surfaces: [] }; sim.teeth.push(rec); byT.set(p.fdi, rec); }
      switch (p.procedure) {
        case 'CR_FILLING': restoreSurfaces(rec, p.surfaces, 'CR'); deriveStatus(rec); break;
        case 'INLAY': restoreSurfaces(rec, p.surfaces, 'IN_METAL'); deriveStatus(rec); break;
        case 'RCT':
          (rec.surfaces || []).forEach(function (s) {
            if ((SEVERITY[s.finding] || 0) >= 1) { s.finding = 'RESTORED'; s.material = 'CR'; s.simulated = true; }
          });
          rec.status = 'ROOT_CANAL_TREATED'; break;
        case 'CROWN':
          rec.surfaces = []; rec.status = 'CROWN'; break;
        case 'EXTRACTION': rec.status = 'MISSING'; break;
        case 'BRIDGE': if (rec.status === 'MISSING') rec.status = 'BRIDGE_PONTIC'; break;
        default: break; // SRP / OBSERVE: 形状・実測値とも変化させない
      }
    });
    sim.simulated = true;
    return sim;
  }

  function setSimulatedUI(on) {
    S.simulated = on;
    const b = document.getElementById('simBtn');
    if (b) {
      b.classList.toggle('on', on);
      b.textContent = on ? '現在の状態に戻す' : '治療後シミュレーション';
    }
    const note = document.getElementById('simNote');
    if (note) note.classList.toggle('hide', !on);
  }

  function setSimulated(on) {
    if (on && !S.baseDoc) return;
    if (S.simulated === on) return;
    setSimulatedUI(on);
    closePop();
    refreshDisplay();
  }

  /* ------------------------------------------------ 2D 歯式チャート（§5.7.1） */
  const CHART_U = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const CHART_L = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const CELL_REGIONS = [
    ['top', 'M1 1 L39 1 L27 13 L13 13 Z'],
    ['bottom', 'M1 39 L13 27 L27 27 L39 39 Z'],
    ['left', 'M1 1 L13 13 L13 27 L1 39 Z'],
    ['right', 'M39 1 L39 39 L27 27 L27 13 Z'],
    ['center', 'M13 13 L27 13 L27 27 L13 27 Z']
  ];

  function cellMap(fdi) {
    const q = Math.floor(fdi / 10);
    const upper = (q === 1 || q === 2);
    const mesialRight = (q === 1 || q === 4);   // 画面左半分の歯は正中（M）が右側
    return {
      top: upper ? 'B' : 'L', bottom: upper ? 'L' : 'B',
      left: mesialRight ? 'D' : 'M', right: mesialRight ? 'M' : 'D',
      center: 'O'
    };
  }

  function cssHex(h) { return '#' + ('000000' + h.toString(16)).slice(-6); }

  function buildChart() {
    const rowU = document.getElementById('rowU');
    const rowL = document.getElementById('rowL');
    if (!rowU || !rowL) return;
    S.chartCells = new Map();

    function mk(fdi, row) {
      const map = cellMap(fdi);
      const el = document.createElement('div');
      el.className = 'tc'; el.dataset.fdi = fdi;
      let svg = '<svg viewBox="0 0 40 40">';
      CELL_REGIONS.forEach(function (r) {
        svg += '<path data-surf="' + map[r[0]] + '" d="' + r[1] +
               '" fill="#F2EDE4" stroke="#C9CFD6" stroke-width="1"/>';
      });
      svg += '<path class="mx" d="M9 9 L31 31 M31 9 L9 31" stroke="#9AA3AC"' +
             ' stroke-width="3.5" fill="none" style="display:none"/></svg>';
      el.innerHTML = svg + '<span class="tn">' + fdi + '</span>';
      el.addEventListener('click', function () { onCellTap(fdi); });
      row.appendChild(el);
      S.chartCells.set(fdi, {
        el: el,
        paths: Array.prototype.slice.call(el.querySelectorAll('path[data-surf]')),
        mx: el.querySelector('.mx')
      });
    }

    CHART_U.forEach(function (fdi, i) {
      if (i === 8) { const d = document.createElement('div'); d.className = 'mline'; rowU.appendChild(d); }
      mk(fdi, rowU);
    });
    CHART_L.forEach(function (fdi, i) {
      if (i === 8) { const d = document.createElement('div'); d.className = 'mline'; rowL.appendChild(d); }
      mk(fdi, rowL);
    });
  }

  function chartSurfaceColor(rec, surf) {
    const C = CONFIG.COLORS;
    if (!rec) return C.SOUND;
    if (rec.status === 'CROWN' || rec.status === 'BRIDGE_PONTIC') return C.CERAMIC;
    const list = rec.surfaces || [];
    for (let i = 0; i < list.length; i++) {
      if (normSurf(list[i].surface) !== surf) continue;
      const s = list[i];
      if (s.finding === 'RESTORED') return C[s.material || 'CR'] || C.CR;
      return C[s.finding] !== undefined ? C[s.finding] : C.SOUND;
    }
    return C.SOUND;
  }

  function updateChart() {
    if (!S.chartCells) return;
    S.chartCells.forEach(function (cell, fdi) {
      const rec = S.byTooth ? S.byTooth.get(fdi) : null;
      const st = rec ? rec.status : 'SOUND';
      cell.el.classList.toggle('sel', S.selected === fdi);
      const missing = (st === 'MISSING');
      cell.mx.style.display = missing ? '' : 'none';
      cell.paths.forEach(function (p) {
        let hex;
        if (missing) hex = 0xEDEFF2;
        else if (st === 'IMPLANT') hex = CONFIG.COLORS.IMPLANT;
        else if (st === 'UNERUPTED' || st === 'IMPACTED') hex = 0xD8DDE3;
        else hex = chartSurfaceColor(rec, p.dataset.surf);
        p.setAttribute('fill', cssHex(hex));
      });
    });
  }

  function onCellTap(fdi) {
    stopSeq();
    S.selected = fdi; S.needsRecolor = true;
    focusTooth(fdi); renderDetail(fdi); updateChart();
    // 入力は術者モード + 現在の状態表示のときだけ（シミュレーションは導出値なので編集不可）
    if (S.mode === 'clinician' && !S.simulated) openPop(fdi);
    else closePop();
  }

  /* ------------------------------------------------ 入力ポップオーバー（1段のみ） */
  const POP_FINDINGS = [['SOUND', '健全'], ['CO', 'CO'], ['C1', 'C1'],
    ['C2', 'C2'], ['C3', 'C3'], ['C4', 'C4']];
  const POP_REST = [['CR', 'レジン'], ['IN_METAL', '金属'], ['CERAMIC', 'セラミック']];
  const POP_STATUS = [['SOUND', '健全に戻す'], ['MISSING', '欠損'],
    ['IMPLANT', 'インプラント'], ['IMPACTED', '埋伏'], ['UNERUPTED', '未萌出'],
    ['ROOT_CANAL_TREATED', '根治済'], ['CROWN', 'クラウン']];
  let popFdi = null, popSurf = 'O';

  function surfBtnLabel(fdi, k) {
    const ant = isAnterior(fdi);
    if (k === 'O') return ant ? 'I 切縁' : 'O 咬合';
    if (k === 'B') return ant ? 'B 唇側' : 'B 頬側';
    return { M: 'M 近心', D: 'D 遠心', L: 'L 舌側' }[k] || k;
  }

  function openPop(fdi) {
    popFdi = fdi;
    const rec = baseRec(fdi);
    popSurf = (rec && rec.surfaces && rec.surfaces.length)
      ? normSurf(rec.surfaces[0].surface) : 'O';
    renderPop();
    const pop = document.getElementById('pop');
    const chart = document.getElementById('chart');
    const footer = document.querySelector('footer');
    // 3D: チャートの上に重ならない位置 / 2D: 画面下部（チャートが主役なので浅めに）
    pop.style.bottom = ((footer ? footer.offsetHeight : 0) +
      (S.view2d ? 20 : (chart ? chart.offsetHeight : 0) + 14)) + 'px';
    pop.classList.remove('hide');
  }

  function closePop() {
    popFdi = null;
    const pop = document.getElementById('pop');
    if (pop) pop.classList.add('hide');
  }

  function renderPop() {
    if (popFdi == null) return;
    const pop = document.getElementById('pop');
    const rec = baseRec(popFdi);
    const st = rec ? rec.status : 'SOUND';
    let curFind = 'SOUND', curMat = null;
    if (rec) {
      (rec.surfaces || []).forEach(function (s) {
        if (normSurf(s.surface) === popSurf) { curFind = s.finding; curMat = s.material || null; }
      });
    }
    let h = '<div class="ph2"><b>' + popFdi + '（' + fdiToPalmer(popFdi) + '）</b>' +
      '<span style="color:var(--sub);font-size:13px">' + (STATUS_JA[st] || st) + '</span>' +
      '<div class="spacer"></div><button id="popClose" data-pclose="1">閉じる</button></div>';

    h += '<h4>面を選ぶ</h4><div class="grp">';
    ['M', 'D', 'B', 'L', 'O'].forEach(function (k) {
      h += '<button data-psurf="' + k + '" class="' + (popSurf === k ? 'fon' : '') + '">' +
        surfBtnLabel(popFdi, k) + '</button>';
    });
    h += '</div>';

    h += '<h4>この面の所見</h4><div class="grp">';
    POP_FINDINGS.forEach(function (f) {
      const on = (curFind === f[0]) ? ' fon' : '';
      h += '<button data-pfind="' + f[0] + '" class="' + on + '">' +
        '<i class="sw" style="background:' + cssHex(CONFIG.COLORS[f[0]] || CONFIG.COLORS.SOUND) +
        '"></i>' + f[1] + '</button>';
    });
    POP_REST.forEach(function (m) {
      const on = (curFind === 'RESTORED' && curMat === m[0]) ? ' fon' : '';
      h += '<button data-pmat="' + m[0] + '" class="' + on + '">' +
        '<i class="sw" style="background:' + cssHex(CONFIG.COLORS[m[0]] || CONFIG.COLORS.CR) +
        '"></i>' + m[1] + '</button>';
    });
    h += '</div>';

    h += '<h4>歯全体の状態</h4><div class="grp">';
    POP_STATUS.forEach(function (s) {
      const on = (st === s[0]) ? ' fon' : '';
      h += '<button data-pstat="' + s[0] + '" class="' + on + '">' + s[1] + '</button>';
    });
    h += '</div>';
    pop.innerHTML = h;
  }

  document.getElementById('pop').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || popFdi == null) return;
    if (b.dataset.pclose) { closePop(); return; }
    if (b.dataset.psurf) { popSurf = b.dataset.psurf; renderPop(); return; }
    if (b.dataset.pfind) { setSurfaceFinding(popFdi, popSurf, b.dataset.pfind); renderPop(); return; }
    if (b.dataset.pmat) { setSurfaceFinding(popFdi, popSurf, 'RESTORED', b.dataset.pmat); renderPop(); return; }
    if (b.dataset.pstat) { setToothStatus(popFdi, b.dataset.pstat); renderPop(); return; }
  });

  /* -------------------------------------------- 歯周ポケットの 3D 重畳（§5.10） */
  const PERIO_GEO = new THREE.SphereGeometry(0.85, 10, 8);
  const BOP_GEO = new THREE.SphereGeometry(0.42, 8, 6);
  const PERIO_SITES = [
    ['MB', 1, 0.32], ['B', 1, 0], ['DB', 1, -0.32],
    ['ML', -1, 0.32], ['L', -1, 0], ['DL', -1, -0.32]
  ];
  const _perioMats = {};
  function perioMat(hex) {
    if (!_perioMats[hex]) {
      _perioMats[hex] = new THREE.MeshStandardMaterial({
        color: linColor(hex), emissive: linColor(hex), emissiveIntensity: 0.35,
        roughness: 0.5, metalness: 0.0
      });
    }
    return _perioMats[hex];
  }
  function pdColor(pd) {
    const C = CONFIG.COLORS;
    return pd >= 6 ? C.PD_BAD : (pd >= 4 ? C.PD_MID : C.PD_OK);
  }
  function clearGroup(g) {
    if (!g) return;
    for (let i = g.children.length - 1; i >= 0; i--) g.remove(g.children[i]);
  }

  function updatePerioMarkers() {
    clearGroup(S.perioU); clearGroup(S.perioL);
    if (!S.layers.perio || !S.byTooth) return;
    const v = new THREE.Vector3();
    S.teeth.forEach(function (t) {
      const rec = S.byTooth.get(t.fdi);
      if (!rec || !rec.perio) return;
      if (rec.status === 'MISSING') return;
      const jaw = t.ex.jaw;
      if (S.isolated && S.isolated !== jaw) return;
      const group = (jaw === 'U') ? S.perioU : S.perioL;
      const bl = (t.ex.bl_width || 9), md = (t.ex.md_width || 8);
      PERIO_SITES.forEach(function (site, idx) {
        const m = rec.perio[site[0]];
        if (!m || typeof m.pd !== 'number') return;
        v.copy(t.centroid)
          .addScaledVector(t.ax.o, t.ex.cej_h)
          .addScaledVector(t.ax.b, site[1] * (bl * 0.5 + 0.7))
          .addScaledVector(t.ax.m, site[2] * md);
        const mk = new THREE.Mesh(PERIO_GEO, perioMat(pdColor(m.pd)));
        mk.position.copy(v);
        mk.name = 'finding_' + t.fdi + '_' + site[0] + '_' + idx;
        group.add(mk);
        if (m.bop) {
          const bp = new THREE.Mesh(BOP_GEO, perioMat(0xC1121F));
          bp.position.copy(v).addScaledVector(t.ax.o, 1.5);
          bp.name = 'finding_' + t.fdi + '_' + site[0] + '_bop';
          group.add(bp);
        }
      });
    });
  }

  /* ------------------------------------------- 説明プリセット（ワンタップ再生） */
  const SEQ = { timers: [], name: null };

  function stopSeq() {
    SEQ.timers.forEach(clearTimeout);
    SEQ.timers = []; SEQ.name = null;
    const el = document.getElementById('seqNote');
    if (el) el.classList.add('hide');
    document.querySelectorAll('[data-seq]').forEach(function (b) { b.classList.remove('on'); });
  }
  function at(ms, fn) { SEQ.timers.push(setTimeout(fn, ms)); }
  function narrate(t) {
    const el = document.getElementById('seqNote');
    if (!el) return;
    if (!t) { el.classList.add('hide'); return; }
    el.textContent = t; el.classList.remove('hide');
  }
  function selectTooth(fdi) {
    S.selected = fdi; S.needsRecolor = true;
    focusTooth(fdi); renderDetail(fdi); updateChart();
  }
  function setStage(v) {
    S.stage = v;
    const el = document.getElementById('stage');
    if (el) el.value = v;
    const lb = document.getElementById('stageLabel');
    if (lb) lb.textContent = ['① 通常', '② 歯ぐきの中', '③ 骨の状態'][v];
    S.needsRecolor = true;
  }
  function setLayer(k, on) {
    S.layers[k] = on;
    const b = document.querySelector('[data-layer=' + k + ']');
    if (b) b.classList.toggle('on', on);
    S.needsRecolor = true;
  }

  function worstCariesTooth() {
    let best = null;
    if (!S.baseDoc || !S.baseDoc.teeth) return null;
    S.baseDoc.teeth.forEach(function (t) {
      (t.surfaces || []).forEach(function (s) {
        const sev = SEVERITY[s.finding] || 0;
        if (sev >= 1 && (!best || sev > best.sev)) {
          best = { fdi: t.fdi, finding: s.finding, sev: sev };
        }
      });
    });
    return best;
  }
  function worstPerioTooth() {
    let best = null;
    if (!S.baseDoc || !S.baseDoc.teeth) return null;
    S.baseDoc.teeth.forEach(function (t) {
      if (!t.perio || t.status === 'MISSING') return;
      Object.keys(t.perio).forEach(function (k) {
        const pd = t.perio[k] && t.perio[k].pd;
        if (typeof pd === 'number' && (!best || pd > best.pd)) best = { fdi: t.fdi, pd: pd };
      });
    });
    return best;
  }
  function planItems() {
    if (!S.baseDoc || !S.baseDoc.plan) return [];
    return S.baseDoc.plan.slice().sort(function (a, b) {
      return (a.priority || 9) - (b.priority || 9);
    });
  }
  function computeKPI() {
    let caries = 0, missing = 0, restored = 0, deep = 0;
    if (S.baseDoc && S.baseDoc.teeth) {
      S.baseDoc.teeth.forEach(function (t) {
        if (t.status === 'MISSING') missing++;
        if (t.status === 'RESTORED' || t.status === 'CROWN') restored++;
        (t.surfaces || []).forEach(function (s) {
          if (SEVERITY[s.finding] >= 2) caries++;
          if (SEVERITY[s.finding] >= 4) deep++;
        });
      });
    }
    return { caries: caries, missing: missing, restored: restored, deep: deep };
  }

  function runSeq(name) {
    stopSeq(); closePop();
    SEQ.name = name;
    const btn = document.querySelector('[data-seq=' + name + ']');
    if (btn) btn.classList.add('on');

    if (name === 'caries') {
      const w = worstCariesTooth();
      at(0, function () {
        setSimulated(false); setLayer('caries', true); setStage(0); setPreset('front');
        S.selected = null; S.needsRecolor = true; updateChart();
        narrate('現在のお口の状態です');
      });
      if (!w) {
        at(2000, function () { narrate('虫歯の所見はありません'); });
        at(4500, stopSeq);
      } else {
        at(2000, function () {
          selectTooth(w.fdi);
          narrate(fdiToPalmer(w.fdi) + 'の歯：' + (FINDING_PT[w.finding] || '虫歯があります'));
        });
        at(4800, function () { narrate('色が濃い面ほど、虫歯が深く進んでいます'); });
        at(7400, stopSeq);
      }

    } else if (name === 'perio') {
      const p = worstPerioTooth();
      at(0, function () {
        setSimulated(false); setLayer('perio', true); setStage(0); setPreset('front');
        narrate('歯ぐきの検査結果を表示します');
      });
      at(2000, function () { setStage(1); narrate('歯ぐきを透かして、中の状態を見ています'); });
      at(4000, function () {
        setStage(2);
        narrate('丸い印は「歯と歯ぐきのすき間」の深さです（緑 → 黄 → 赤の順に深い）');
      });
      if (p) {
        at(6200, function () {
          selectTooth(p.fdi);
          narrate(fdiToPalmer(p.fdi) + 'の歯のすき間がいちばん深くなっています（' + p.pd + 'mm）');
        });
      }
      at(9000, stopSeq);

    } else if (name === 'plan') {
      const items = planItems();
      at(0, function () {
        setSimulated(false); setStage(0); setPreset('front');
        S.selected = null; S.needsRecolor = true; updateChart();
        narrate('現在の状態から、治療の流れをご説明します');
      });
      items.forEach(function (it, i) {
        at(2200 + 2300 * i, function () {
          selectTooth(it.fdi);
          narrate(fdiToPalmer(it.fdi) + '：' +
            (PROC_PT[it.procedure] || PROC_JA[it.procedure] || it.procedure));
        });
      });
      const tEnd = 2200 + 2300 * items.length;
      at(tEnd, function () {
        S.selected = null; S.needsRecolor = true;
        setPreset('front'); setSimulated(true); updateChart();
        narrate('すべての治療が終わると、このようになります（シミュレーション）');
      });
      at(tEnd + 3400, stopSeq);

    } else if (name === 'summary') {
      const k = computeKPI();
      const items = planItems();
      at(0, function () {
        setSimulated(false); setStage(0); setPreset('front');
        S.selected = null; S.needsRecolor = true; updateChart();
        narrate('要処置 ' + k.caries + '面（うち進行 ' + k.deep + '面）・欠損 ' +
          k.missing + '本・治療済 ' + k.restored + '本');
      });
      items.forEach(function (it, i) {
        at(2600 + 1500 * i, function () { selectTooth(it.fdi); });
      });
      at(2600 + 1500 * items.length + 1200, stopSeq);
    }
  }

  // 検証用フック
  S.api = {
    loadFindings: loadFindings, setSurfaceFinding: setSurfaceFinding,
    setToothStatus: setToothStatus, undo: undo, setSimulated: setSimulated,
    runSeq: runSeq, stopSeq: stopSeq, simulateAfter: simulateAfter,
    openPop: openPop, closePop: closePop
  };

  /* ------------------------------------------------------------ 患者右左ラベル */
  const _vx = new THREE.Vector3();
  function updateSideLabels() {
    if (S.view2d) {
      // 2D の両ビューは患者の右=画面左に固定してある（SPEC §5.11）
      document.getElementById('sideL').textContent = '← 患者さんの右';
      document.getElementById('sideR').textContent = '患者さんの左 →';
      document.getElementById('sideL').style.opacity = 1;
      document.getElementById('sideR').style.opacity = 1;
      return;
    }
    _vx.set(1, 0, 0).project(S.camera);
    const o = new THREE.Vector3(0, 0, 0).project(S.camera);
    const leftEl = document.getElementById('sideL');
    const rightEl = document.getElementById('sideR');
    const patientLeftOnScreenRight = (_vx.x - o.x) > 0;
    leftEl.textContent = patientLeftOnScreenRight ? '← 患者さんの右' : '← 患者さんの左';
    rightEl.textContent = patientLeftOnScreenRight ? '患者さんの左 →' : '患者さんの右 →';
    const amb = Math.abs(_vx.x - o.x) < 0.06;
    leftEl.style.opacity = amb ? 0.25 : 1;
    rightEl.style.opacity = amb ? 0.25 : 1;
  }

  /* ---------------------------------------------------------------- ループ */
  const _lookTmp = new THREE.Vector3();

  // 模型式開口のヒンジ。解剖学的な顆頭 (z=-75) だと開口時の上下の隙間が
  // 大きくなりすぎるため、顎模型と同じく臼歯直後に置く（SPEC §5.4）
  const MODEL_HINGE = [0, -10, -48];

  // 顎グループをヒンジ回りに deg 度回転させる。
  // ヒンジ前方の点は y' = y·cosθ − z_rel·sinθ なので、下顎は正・上顎は負が「開く」向き
  function applyHinge(group, deg, hpOverride) {
    const hp = hpOverride ||
      (group.userData && group.userData.hinge_point) || [0, -12, -75];
    const a = deg * Math.PI / 180;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrix();
    const m = new THREE.Matrix4()
      .makeTranslation(hp[0], hp[1], hp[2])
      .multiply(new THREE.Matrix4().makeRotationX(a))
      .multiply(new THREE.Matrix4().makeTranslation(-hp[0], -hp[1], -hp[2]));
    m.decompose(group.position, group.quaternion, group.scale);
  }

  function animate() {
    requestAnimationFrame(animate);
    const L = CONFIG.CAMERA.LERP;
    // 方位角は最短経路で補間する（何周も回した後にプリセットで長回りしない）
    let dth = S.desired.theta - S.cur.theta;
    dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    S.cur.theta += dth * L;
    if (Math.abs(dth) < 1e-4) S.cur.theta = S.desired.theta = normAngle(S.desired.theta);
    S.cur.phi += (S.desired.phi - S.cur.phi) * L;
    S.cur.dist += (S.desired.dist - S.cur.dist) * L;
    S.cur.target.lerp(S.desired.target, L);

    // 歯肉・歯槽骨の不透明度と開口角を滑らかに遷移させる。
    // フレームレート非依存（SwiftShader のような低 fps 環境でも同じ速度で収束する）
    const now = performance.now();
    const dt = Math.min(0.1, (now - (S._lastT || now)) / 1000);
    S._lastT = now;
    const fA = 1 - Math.exp(-6 * dt);    // 不透明度: 時定数 ~1/6 s
    const fO = 1 - Math.exp(-9 * dt);    // 開口: すこし速め

    S.gAlphaCur += (S.gAlphaTarget - S.gAlphaCur) * fA;
    if (Math.abs(S.gAlphaTarget - S.gAlphaCur) < 0.004) S.gAlphaCur = S.gAlphaTarget;
    S.gingiva.forEach(function (m) {
      m.material.opacity = S.gAlphaCur;
      m.material.transparent = S.gAlphaCur < 0.995;
      m.material.depthWrite = S.gAlphaCur > 0.95;
    });
    S.boneAlphaCur += (S.boneAlphaTarget - S.boneAlphaCur) * fA;
    if (Math.abs(S.boneAlphaTarget - S.boneAlphaCur) < 0.004) S.boneAlphaCur = S.boneAlphaTarget;
    S.bone.forEach(function (m) {
      m.visible = S.boneAlphaCur > 0.01;
      m.material.opacity = S.boneAlphaCur;
    });
    // 2D（咬合面観）中は開口を閉じる（回転した顎の咬合面観は成立しない）
    const openTgt = S.view2d ? 0 : S.openDeg;
    S.openCur += (openTgt - S.openCur) * fO;
    if (Math.abs(openTgt - S.openCur) < 0.02) S.openCur = openTgt;

    // 開口中の全体ビューは注視点・距離・仰角を補正して両顎を俯瞰で収める（SPEC §5.4）
    let ty = S.cur.target.y, td = S.cur.dist, tphi = S.cur.phi;
    if (S.selected == null) {
      ty -= S.openCur * 0.15;
      td *= 1 + S.openCur * 0.018;
      tphi = Math.max(0.3, tphi - S.openCur * 0.007);
    }
    const sp = Math.sin(tphi), cp = Math.cos(tphi);
    S.camera.position.set(
      S.cur.target.x + td * sp * Math.sin(S.cur.theta),
      ty + td * cp,
      S.cur.target.z + td * sp * Math.cos(S.cur.theta)
    );
    _lookTmp.set(S.cur.target.x, ty, S.cur.target.z);
    S.camera.lookAt(_lookTmp);

    // 模型式の両開き（SPEC §5.4）: 下顎 +θ（前方が下がる）、上顎 −0.8θ（前方が上がる）。
    // 開口すると上下両方の咬合面が視線側を向き、俯瞰で観察できる
    if (S.mandible) applyHinge(S.mandible, S.openCur, MODEL_HINGE);
    if (S.maxilla) applyHinge(S.maxilla, -S.openCur * 0.8, MODEL_HINGE);

    if (S.needsRecolor && S.ready) recolorAll();
    if (S.ready) updateSideLabels();

    if (S.view2d) render2D();
    else S.renderer.render(S.scene, S.camera);
  }

  /* ------------------------------------ 2D: 上下顎の咬合面俯瞰ツインビュー */
  function updateOrtho(cam, wpix, hpix) {
    const aspect = wpix / Math.max(1, hpix);
    let halfH = 36, halfW = halfH * aspect;
    if (halfW < 52) { halfH *= 52 / halfW; halfW = 52; }
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    cam.updateProjectionMatrix();
  }

  function render2D() {
    const host = document.getElementById('view');
    const w = host.clientWidth, h = host.clientHeight, hh = Math.floor(h / 2);
    const mv = S.maxilla ? S.maxilla.visible : true;
    const lv = S.mandible ? S.mandible.visible : true;
    S.renderer.setScissorTest(true);

    if (S.maxilla) S.maxilla.visible = true;
    if (S.mandible) S.mandible.visible = false;
    updateOrtho(S.cam2dU, w, h - hh);
    S.renderer.setViewport(0, hh, w, h - hh);
    S.renderer.setScissor(0, hh, w, h - hh);
    S.renderer.render(S.scene, S.cam2dU);

    if (S.maxilla) S.maxilla.visible = false;
    if (S.mandible) S.mandible.visible = true;
    updateOrtho(S.cam2dL, w, hh);
    S.renderer.setViewport(0, 0, w, hh);
    S.renderer.setScissor(0, 0, w, hh);
    S.renderer.render(S.scene, S.cam2dL);

    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, w, h);
    if (S.maxilla) S.maxilla.visible = mv;
    if (S.mandible) S.mandible.visible = lv;
  }

  /* -------------------------------------------------- 検証用: 歯面判定テスト */
  window.__surfaceTest = function () {
    const res = { total: 0, pass: 0, fails: [] };
    const dirs = [['B', 'b', 1], ['L', 'b', -1], ['M', 'm', 1], ['D', 'm', -1]];
    S.teeth.forEach(function (t) {
      // 側面4方向: 歯冠中央高さで軸方向に法線を置いて判定
      dirs.forEach(function (d) {
        const n = t.ax[d[1]].clone().multiplyScalar(d[2]);
        const hr = 0.35;
        const w = classify(n.x, n.y, n.z, hr, t.ax);
        const keys = ['O', 'B', 'L', 'M', 'D'];
        let bi = 0; for (let i = 1; i < 5; i++) if (w[i] > w[bi]) bi = i;
        res.total++;
        if (keys[bi] === d[0]) res.pass++;
        else res.fails.push(t.fdi + ':expect ' + d[0] + ' got ' + keys[bi]);
      });
      // 咬合面
      const n = t.ax.o.clone();
      const w = classify(n.x, n.y, n.z, 0.95, t.ax);
      const keys = ['O', 'B', 'L', 'M', 'D'];
      let bi = 0; for (let i = 1; i < 5; i++) if (w[i] > w[bi]) bi = i;
      res.total++;
      if (keys[bi] === 'O') res.pass++;
      else res.fails.push(t.fdi + ':expect O got ' + keys[bi]);
    });
    return res;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
