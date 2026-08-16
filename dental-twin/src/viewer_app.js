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
    chartTab: 'caries',        // 'caries' | 'perio'
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
        o.userData.__jaw = /upper/.test(nm) ? 'U' : 'L';
        // 骨吸収の頂点変位（SPEC §4.8）用に原形状を保持する
        o.userData.__base = o.geometry.attributes.position.array.slice();
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
    updateBoneLevels();
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
    dom.addEventListener('mouseleave', hideTip);
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

  // ツールチップは出しっぱなしにしない（古い所見が残ると誤読の原因。SPEC §5.15）
  function hideTip() {
    const tip = document.getElementById('tip');
    if (tip) tip.classList.add('hide');
  }
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
      hideTip();
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

    tip.innerHTML = tipHTML(t, surf);
    tip.classList.remove('hide');
    // ビュー矩形内に収める。右下に置けない場合は反転させる（SPEC §5.15）
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = cx - r.left + 14, ty = cy - r.top + 14;
    if (tx + tw > r.width - 6) tx = Math.max(6, cx - r.left - 14 - tw);
    if (ty + th > r.height - 6) ty = Math.max(6, cy - r.top - 14 - th);
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';

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
        syncLegend();
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
      closePop(); hideTip();            // 入力UIは術者モード専用。視点と選択歯は維持する
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
      stopSeq(); closePop(); hideTip(); setSimulated(false);
      S.selected = null; S.needsRecolor = true;
      setPreset('front'); renderDetail(null); updateChart();
    });

    /* --- B-3.3: 2D 表示モード（咬合面俯瞰ツインビュー） --- */
    document.getElementById('dimBtn').addEventListener('click', function () {
      S.view2d = !S.view2d;
      document.body.classList.toggle('mode2d', S.view2d);
      this.textContent = S.view2d ? '3D表示' : '2D表示';
      this.classList.toggle('on', S.view2d);
      stopSeq(); closePop(); hideTip();
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

    /* --- B-4: う蝕 / 歯周 のチャート切替（1段のみ） --- */
    document.querySelectorAll('[data-ctab]').forEach(function (b) {
      b.addEventListener('click', function () { setChartTab(b.dataset.ctab); });
    });
    document.getElementById('pdfBtn').addEventListener('click', openHandout);
    document.getElementById('hoClose').addEventListener('click', function () {
      document.getElementById('handout').classList.add('hide');
    });
    document.getElementById('hoSave').addEventListener('click', saveHandoutPDF);
    document.getElementById('hoPrint').addEventListener('click', function () { window.print(); });
    document.getElementById('hoNameOn').addEventListener('change', function () {
      const tx = document.getElementById('hoNameTxt');
      tx.disabled = !this.checked;          // 患者名の印字は既定オフ（SPEC §5.8）
      if (this.checked) tx.focus(); else tx.value = '';
      if (!document.getElementById('handout').classList.contains('hide')) renderHandout();
    });
    document.getElementById('hoNameTxt').addEventListener('change', renderHandout);

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

  // 歯周6点法の実測値（SPEC §5.7.2）。シミュレーションでは書き換えない値
  function setPerio(fdi, site, patch) {
    pushUndo();
    const rec = toothRec(fdi);
    if (!rec.perio) rec.perio = {};
    const cur = rec.perio[site] || { pd: 0, gm: 0, bop: false };
    rec.perio[site] = {
      pd: patch.pd !== undefined ? patch.pd : cur.pd,
      gm: cur.gm || 0,
      bop: patch.bop !== undefined ? patch.bop : !!cur.bop
    };
    refreshDisplay();
  }

  function setBoneLevel(fdi, mm) {
    pushUndo();
    toothRec(fdi).bone_level_mm = mm;
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
    syncChartHead();
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
      const svgWrap = document.createElement('div');
      let svg = '<svg viewBox="0 0 40 40">';
      CELL_REGIONS.forEach(function (r) {
        svg += '<path data-surf="' + map[r[0]] + '" d="' + r[1] +
               '" fill="#F2EDE4" stroke="#C9CFD6" stroke-width="1"/>';
      });
      svg += '<path class="mx" d="M9 9 L31 31 M31 9 L9 31" stroke="#9AA3AC"' +
             ' stroke-width="3.5" fill="none" style="display:none"/></svg>';
      svgWrap.innerHTML = svg;
      const perioWrap = document.createElement('div');
      perioWrap.className = 'pgrid';
      perioWrap.style.display = 'none';
      el.appendChild(svgWrap);
      el.appendChild(perioWrap);
      const tn = document.createElement('span');
      tn.className = 'tn'; tn.textContent = fdi;
      el.appendChild(tn);
      el.addEventListener('click', function () { onCellTap(fdi); });
      row.appendChild(el);
      S.chartCells.set(fdi, {
        el: el, svgWrap: svgWrap, perio: perioWrap,
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

  // 歯周チャートで入力を受け付けない歯（欠損・未萌出・埋伏）
  function perioNA(st) {
    return st === 'MISSING' || st === 'UNERUPTED' || st === 'IMPACTED';
  }

  const PERIO_ROW = [['MB', 'B', 'DB'], ['ML', 'L', 'DL']];

  function perioCellHTML(fdi, rec) {
    // 表示の左右をチャート上の歯の位置に合わせる（正中に近い側が M）
    const mesialRight = (Math.floor(fdi / 10) === 1 || Math.floor(fdi / 10) === 4);
    let h = '';
    PERIO_ROW.forEach(function (row, ri) {
      const order = mesialRight ? row.slice().reverse() : row;
      order.forEach(function (site) {
        const m = (rec && rec.perio) ? rec.perio[site] : null;
        const pd = m && typeof m.pd === 'number' ? m.pd : null;
        const col = pd == null ? '#C9CFD6' : cssHex(pdColor(pd));
        h += '<b class="' + (m && m.bop ? 'bop' : '') + '" style="background:' + col +
             '">' + (pd == null ? '–' : pd) + '</b>';
      });
      if (ri === 0) h += '<i class="sepr"></i>';
    });
    const bl = rec && typeof rec.bone_level_mm === 'number' ? rec.bone_level_mm : null;
    h += '<i class="blv" style="grid-column:1/4">骨 ' + (bl == null ? '–' : bl) + 'mm</i>';
    return h;
  }

  function updateChart() {
    if (!S.chartCells) return;
    const perioTab = (S.chartTab === 'perio');
    S.chartCells.forEach(function (cell, fdi) {
      const rec = S.byTooth ? S.byTooth.get(fdi) : null;
      const st = rec ? rec.status : 'SOUND';
      cell.el.classList.toggle('sel', S.selected === fdi);
      cell.svgWrap.style.display = perioTab ? 'none' : '';
      cell.perio.style.display = perioTab ? '' : 'none';
      cell.el.classList.toggle('na', perioTab && perioNA(st));

      if (perioTab) {
        cell.perio.innerHTML = perioCellHTML(fdi, rec);
        return;
      }
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

  function setChartTab(tab) {
    S.chartTab = tab;
    document.querySelectorAll('[data-ctab]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.ctab === tab);
    });
    closePop();
    updateChart();
    // 歯周タブを開いたら 3D 側も歯周レイヤを出す（見えているものと一致させる）
    if (tab === 'perio' && !S.layers.perio) setLayer('perio', true);
  }

  function onCellTap(fdi) {
    stopSeq();
    S.selected = fdi; S.needsRecolor = true;
    focusTooth(fdi); renderDetail(fdi); updateChart();
    // 入力は術者モード + 現在の状態表示のときだけ（シミュレーションは導出値なので編集不可）
    const rec = S.byTooth ? S.byTooth.get(fdi) : null;
    const na = S.chartTab === 'perio' && perioNA(rec ? rec.status : 'SOUND');
    if (S.mode === 'clinician' && !S.simulated && !na) openPop(fdi);
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

  const PERIO_SITE_KEYS = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];
  let popSite = 'MB';

  function openPop(fdi) {
    popFdi = fdi;
    const rec = baseRec(fdi);
    popSurf = (rec && rec.surfaces && rec.surfaces.length)
      ? normSurf(rec.surfaces[0].surface) : 'O';
    popSite = 'MB';
    renderPop();
    // 下にある常設要素（フッタ・チャート・凡例バー）の高さを積んで、
    // どれにも被らない位置に出す
    const pop = document.getElementById('pop');
    const h = function (sel) {
      const el = document.querySelector(sel);
      return (el && el.offsetParent !== null) ? el.offsetHeight : 0;
    };
    pop.style.bottom = (h('footer') + h('#chart') + h('#legend') + 12) + 'px';
    pop.classList.remove('hide');
  }

  function closePop() {
    popFdi = null;
    const pop = document.getElementById('pop');
    if (pop) pop.classList.add('hide');
  }

  const SITE_JA = {
    MB: 'MB 近心頬側', B: 'B 頬側', DB: 'DB 遠心頬側',
    ML: 'ML 近心舌側', L: 'L 舌側', DL: 'DL 遠心舌側'
  };

  function renderPerioPop() {
    const pop = document.getElementById('pop');
    const rec = baseRec(popFdi);
    const m = (rec && rec.perio) ? rec.perio[popSite] : null;
    const pd = m && typeof m.pd === 'number' ? m.pd : null;
    const bl = rec && typeof rec.bone_level_mm === 'number' ? rec.bone_level_mm : null;

    let h = '<div class="ph2"><b>' + popFdi + '（' + fdiToPalmer(popFdi) + '）</b>' +
      '<span style="color:var(--sub);font-size:13px">歯周ポケット 6点法</span>' +
      '<div class="spacer"></div><button id="popClose" data-pclose="1">閉じる</button></div>';

    h += '<h4>部位を選ぶ</h4><div class="grp">';
    PERIO_SITE_KEYS.forEach(function (k) {
      const v = (rec && rec.perio && rec.perio[k]) ? rec.perio[k].pd : null;
      h += '<button data-psite="' + k + '" class="' + (popSite === k ? 'fon' : '') + '">' +
        SITE_JA[k] + (typeof v === 'number' ? '<br>' + v : '') + '</button>';
    });
    h += '</div>';

    h += '<h4>' + SITE_JA[popSite] + ' の深さ (mm)</h4><div class="grp">';
    for (let v = 1; v <= 12; v++) {
      h += '<button data-ppd="' + v + '" class="' + (pd === v ? 'fon' : '') +
        '" style="min-width:60px">' + v + '</button>';
    }
    h += '</div>';

    h += '<h4>出血 (BOP)</h4><div class="grp">' +
      '<button data-pbop="0" class="' + (m && !m.bop ? 'fon' : '') + '">なし</button>' +
      '<button data-pbop="1" class="' + (m && m.bop ? 'fon' : '') + '">' +
      '<i class="sw" style="background:#C1121F"></i>あり</button></div>';

    h += '<h4>骨のレベル（CEJ からの距離 mm・X線から術者が入力）</h4><div class="grp">';
    for (let v = 0; v <= 12; v += 2) {
      h += '<button data-pbone="' + v + '" class="' + (bl === v ? 'fon' : '') +
        '" style="min-width:60px">' + v + '</button>';
    }
    h += '</div>';
    pop.innerHTML = h;
  }

  function renderPop() {
    if (popFdi == null) return;
    if (S.chartTab === 'perio') { renderPerioPop(); return; }
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
    if (b.dataset.psite) { popSite = b.dataset.psite; renderPop(); return; }
    if (b.dataset.ppd) {
      setPerio(popFdi, popSite, { pd: parseInt(b.dataset.ppd, 10) }); renderPop(); return;
    }
    if (b.dataset.pbop) {
      setPerio(popFdi, popSite, { bop: b.dataset.pbop === '1' }); renderPop(); return;
    }
    if (b.dataset.pbone) {
      setBoneLevel(popFdi, parseInt(b.dataset.pbone, 10)); renderPop(); return;
    }
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

  /* ------------------------------------------ 骨吸収レベルの 3D 反映（§4.8） */
  const BONE_BASE_MM = 2.0;   // アセット生成時の基準（dental_arch_gen.py と一致）
  const BONE_FALLOFF = 12.0;  // 骨頂からこの距離までを動かす

  function boneLevelOf(fdi) {
    const rec = S.byTooth ? S.byTooth.get(fdi) : null;
    if (rec && typeof rec.bone_level_mm === 'number') return rec.bone_level_mm;
    const t = S.teeth.get(fdi);
    if (t && typeof t.ex.bone_level_mm === 'number') return t.ex.bone_level_mm;
    return BONE_BASE_MM;
  }

  // 骨メッシュごとに「近い2歯とその重み」を一度だけ求めておく（毎フレーム探索しない）
  function prepareBoneBinding(mesh) {
    const base = mesh.userData.__base;
    const jaw = mesh.userData.__jaw;
    const list = [];
    S.teeth.forEach(function (t) { if (t.ex.jaw === jaw) list.push(t); });
    if (!list.length) return null;
    const n = base.length / 3;
    const i0 = new Int32Array(n), i1 = new Int32Array(n);
    const w0 = new Float32Array(n), wt = new Float32Array(n);
    const up = (jaw === 'U') ? 1 : -1;

    for (let i = 0; i < n; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      let a = -1, b = -1, da = Infinity, db = Infinity;
      for (let k = 0; k < list.length; k++) {
        const c = list[k].centroid;
        const d = (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z);
        if (d < da) { db = da; b = a; da = d; a = k; }
        else if (d < db) { db = d; b = k; }
      }
      if (b < 0) b = a;
      const ra = Math.sqrt(da) + 0.001, rb = Math.sqrt(db) + 0.001;
      const wa = (1 / ra) / (1 / ra + 1 / rb);
      i0[i] = a; i1[i] = b; w0[i] = wa;

      // 骨頂（cej_y から根尖方向へ BONE_BASE_MM）からの距離で減衰させる
      const cej = list[a].ex.cej_y * wa + list[b].ex.cej_y * (1 - wa);
      const d = up * (y - cej) - BONE_BASE_MM;
      wt[i] = Math.max(0, Math.min(1, 1 - d / BONE_FALLOFF));
    }
    mesh.userData.__bind = { list: list, i0: i0, i1: i1, w0: w0, wt: wt, up: up };
    return mesh.userData.__bind;
  }

  function updateBoneLevels() {
    S.bone.forEach(function (mesh) {
      const bind = mesh.userData.__bind || prepareBoneBinding(mesh);
      if (!bind) return;
      const base = mesh.userData.__base;
      const pos = mesh.geometry.attributes.position.array;
      const n = base.length / 3;
      const lv = bind.list.map(function (t) { return boneLevelOf(t.fdi) - BONE_BASE_MM; });

      let changed = false;
      for (let i = 0; i < n; i++) {
        const d = (lv[bind.i0[i]] * bind.w0[i] + lv[bind.i1[i]] * (1 - bind.w0[i]))
                  * bind.wt[i];
        const y = base[i * 3 + 1] + bind.up * d;
        if (pos[i * 3 + 1] !== y) { pos[i * 3 + 1] = y; changed = true; }
      }
      if (changed) {
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
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
    syncLegend();
    S.needsRecolor = true;
  }

  // 凡例は画面に出ている色だけを出す（SPEC §5.17）
  function syncLegend() {
    document.querySelectorAll('.perioLg').forEach(function (el) {
      el.classList.toggle('hide', !S.layers.perio);
    });
  }

  // シミュレーション中はチャート入力を受け付けないので、その理由を見出しに出す
  function syncChartHead() {
    const h = document.querySelector('#chartHead h3');
    if (!h) return;
    if (S.simulated) {
      h.innerHTML = '歯式チャート　<span class="simlock">' +
        'シミュレーション表示中は入力できません</span>';
    } else {
      h.textContent = '歯式チャート（セルをタップで入力）';
    }
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

  /* =======================================================================
     患者渡し物 PDF（A4 1枚・ローカル完結・外部ライブラリなし）— SPEC §5.8
     ページ全体を canvas に描いて 1 枚の JPEG として PDF に載せる。
     PDF 標準フォントに日本語がないため、文字も canvas で描いて画像化する。
     ======================================================================= */
  const A4 = { w: 1240, h: 1754, dpi: 150 };   // A4 210×297mm @150dpi

  // 現在のシーンを指定カメラでレンダリングして JPEG を取り出す
  function grabView(theta, phi, dist, target) {
    const cam = S.camera;
    const pos = cam.position.clone(), quat = cam.quaternion.clone();
    const mv = S.maxilla ? S.maxilla.visible : true;
    const lv = S.mandible ? S.mandible.visible : true;
    if (S.maxilla) S.maxilla.visible = true;
    if (S.mandible) S.mandible.visible = true;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    cam.position.set(target.x + dist * sp * Math.sin(theta),
                     target.y + dist * cp,
                     target.z + dist * sp * Math.cos(theta));
    cam.lookAt(target);
    S.renderer.render(S.scene, cam);
    const url = S.renderer.domElement.toDataURL('image/jpeg', 0.92);
    cam.position.copy(pos); cam.quaternion.copy(quat);
    if (S.maxilla) S.maxilla.visible = mv;
    if (S.mandible) S.mandible.visible = lv;
    return url;
  }

  function loadImg(url) {
    return new Promise(function (res) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = url;
    });
  }

  // モノクロ印刷でも判別できるようにするハッチ（色 + パターン併用: SPEC §5.8）
  function hatch(ctx, x, y, w, h, kind) {
    if (!kind || kind === 'none') return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(30,36,45,.62)'; ctx.lineWidth = 1.6;
    const step = 5;
    ctx.beginPath();
    if (kind === 'fwd' || kind === 'cross') {
      for (let i = -h; i < w; i += step) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
    }
    if (kind === 'back' || kind === 'cross') {
      for (let i = -h; i < w; i += step) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); }
    }
    if (kind === 'horz') {
      for (let j = 0; j < h; j += 4) { ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); }
    }
    ctx.stroke();
    if (kind === 'dot') {
      ctx.fillStyle = 'rgba(30,36,45,.55)';
      for (let j = 2; j < h; j += 5) for (let i = 2; i < w; i += 5) {
        ctx.beginPath(); ctx.arc(x + i, y + j, 1.0, 0, 6.284); ctx.fill();
      }
    }
    ctx.restore();
  }
  const HATCH = {
    SOUND: 'none', CO: 'dot', C1: 'fwd', C2: 'back', C3: 'cross', C4: 'cross',
    RESTORED: 'horz'
  };

  function drawChartCell(ctx, x, y, s, fdi, rec) {
    const st = rec ? rec.status : 'SOUND';
    const map = cellMap(fdi);
    const m = s * 0.32;
    const regions = [
      [map.top, [[0, 0], [s, 0], [s - m, m], [m, m]]],
      [map.bottom, [[0, s], [m, s - m], [s - m, s - m], [s, s]]],
      [map.left, [[0, 0], [m, m], [m, s - m], [0, s]]],
      [map.right, [[s, 0], [s, s], [s - m, s - m], [s - m, m]]],
      [map.center, [[m, m], [s - m, m], [s - m, s - m], [m, s - m]]]
    ];
    regions.forEach(function (r) {
      let hex = CONFIG.COLORS.SOUND, kind = 'none';
      if (st === 'MISSING') hex = 0xEDEFF2;
      else if (st === 'IMPLANT') { hex = CONFIG.COLORS.IMPLANT; kind = 'cross'; }
      else if (st === 'UNERUPTED' || st === 'IMPACTED') hex = 0xD8DDE3;
      else {
        hex = chartSurfaceColor(rec, r[0]);
        const f = findingOf(fdi, r[0]);
        if (f) kind = HATCH[f.finding] || 'none';
        if (st === 'CROWN' || st === 'BRIDGE_PONTIC') kind = 'horz';
      }
      ctx.beginPath();
      ctx.moveTo(x + r[1][0][0], y + r[1][0][1]);
      for (let i = 1; i < r[1].length; i++) ctx.lineTo(x + r[1][i][0], y + r[1][i][1]);
      ctx.closePath();
      ctx.fillStyle = cssHex(hex); ctx.fill();
      ctx.strokeStyle = '#9AA3AC'; ctx.lineWidth = 0.8; ctx.stroke();
      const bb = [x, y, s, s];
      ctx.save(); ctx.clip(); hatch(ctx, bb[0], bb[1], bb[2], bb[3], kind); ctx.restore();
    });
    if (st === 'MISSING') {
      ctx.strokeStyle = '#5A6675'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + s - 5, y + s - 5);
      ctx.moveTo(x + s - 5, y + 5); ctx.lineTo(x + 5, y + s - 5);
      ctx.stroke();
    }
    ctx.fillStyle = '#5A6675';
    ctx.font = '600 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(fdi), x + s / 2, y + s + 17);
  }

  // 歯ぐきの状態の集計（判定はしない。入力済みの実測値を数えるだけ）
  function perioSummary() {
    let deep = 0, bop = 0, bone = 0;
    const teeth = (S.baseDoc && S.baseDoc.teeth) ? S.baseDoc.teeth : [];
    teeth.forEach(function (t) {
      if (t.status === 'MISSING') return;
      if (t.perio) {
        Object.keys(t.perio).forEach(function (k) {
          const m = t.perio[k];
          if (m && typeof m.pd === 'number' && m.pd >= 4) deep++;
          if (m && m.bop) bop++;
        });
      }
      if (typeof t.bone_level_mm === 'number' && t.bone_level_mm >= 4) bone++;
    });
    let msg;
    if (!deep && !bop && !bone) msg = '歯ぐきの状態はおおむね良好です。今の歯みがきを続けましょう。';
    else if (bone) msg = '骨が下がっている歯があります。歯ぐきのケアと定期的なチェックが必要です。';
    else msg = '深いすき間や出血のあるところがあります。歯ぐきのケアを一緒に進めましょう。';
    return { deep: deep, bop: bop, bone: bone, msg: msg };
  }

  function planRows() {
    return planItems().map(function (p) {
      const rec = S.baseDoc ? baseRec(p.fdi) : null;
      let what = '';
      if (rec && rec.surfaces) {
        const hit = rec.surfaces.filter(function (s) { return (SEVERITY[s.finding] || 0) >= 1; });
        if (hit.length) what = FINDING_PT[hit[0].finding] || '';
      }
      if (!what && rec) what = STATUS_PT[rec.status] || '';
      return {
        fdi: p.fdi, tooth: fdiToPalmer(p.fdi) + 'の歯',
        cond: what || '—',
        proc: PROC_PT[p.procedure] || PROC_JA[p.procedure] || p.procedure,
        visits: p.visits ? p.visits + '回' : '—'
      };
    });
  }

  async function drawHandout(canvas, opt) {
    const ctx = canvas.getContext('2d');
    canvas.width = A4.w; canvas.height = A4.h;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, A4.w, A4.h);
    const M = 68;   // 余白

    // ---- ヘッダ
    ctx.fillStyle = '#1B2430';
    ctx.font = '700 34px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('お口の状態のご説明', M, M + 34);
    ctx.font = '500 19px sans-serif'; ctx.fillStyle = '#5A6675';
    const d = opt.date;
    ctx.textAlign = 'right';
    ctx.fillText(d, A4.w - M, M + 14);
    ctx.fillText(opt.clinic, A4.w - M, M + 42);
    if (opt.name) {
      ctx.textAlign = 'left';
      ctx.font = '600 21px sans-serif'; ctx.fillStyle = '#1B2430';
      ctx.fillText(opt.name + ' 様', M, M + 68);
    }
    ctx.strokeStyle = '#DCE1E6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, M + 88); ctx.lineTo(A4.w - M, M + 88); ctx.stroke();

    // ---- 3D キャプチャ 2 枚
    let y = M + 112;
    const iw = (A4.w - M * 2 - 20) / 2, ih = 400;
    const caps = ['今のお口の中', opt.closeLabel];
    for (let i = 0; i < 2; i++) {
      const x = M + i * (iw + 20);
      ctx.fillStyle = '#F4F6F8'; ctx.fillRect(x, y, iw, ih);
      const im = opt.images[i];
      if (im) {
        const r = Math.min(iw / im.width, ih / im.height);
        const w = im.width * r, h = im.height * r;
        ctx.drawImage(im, x + (iw - w) / 2, y + (ih - h) / 2, w, h);
      }
      ctx.strokeStyle = '#DCE1E6'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, iw, ih);
      ctx.fillStyle = '#1B2430'; ctx.font = '700 19px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(caps[i], x + 4, y + ih + 26);
    }
    y += ih + 52;

    // ---- 歯式チャート（見出しの行に左右の明示を置き、セルと重ねない）
    ctx.fillStyle = '#1B2430'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('歯の状態', M, y);
    ctx.fillStyle = '#5A6675'; ctx.font = '600 17px sans-serif';
    ctx.fillText('← 患者さんの右', M + 130, y);
    ctx.textAlign = 'right'; ctx.fillText('患者さんの左 →', A4.w - M, y);
    ctx.textAlign = 'left';
    y += 26;
    const cs = 58, gap = 5, mid = 16;
    const totalW = 16 * cs + 15 * gap + mid;
    const cx0 = (A4.w - totalW) / 2;
    const rowPitch = cs + 26;                 // セル + 歯番ラベル
    [CHART_U, CHART_L].forEach(function (row, ri) {
      const yy = y + ri * rowPitch;
      row.forEach(function (fdi, i) {
        const x = cx0 + i * (cs + gap) + (i >= 8 ? mid : 0);
        drawChartCell(ctx, x, yy, cs, fdi, S.baseDoc ? baseRec(fdi) : null);
      });
    });
    // 正中線（患者の右が紙面の左。3D・画面チャートと同じ規約）
    const midX = cx0 + 8 * (cs + gap) - gap + mid / 2;
    ctx.strokeStyle = '#9AA3AC'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(midX, y - 4); ctx.lineTo(midX, y + rowPitch + cs + 4);
    ctx.stroke();
    y += rowPitch + cs + 40;

    // ---- 凡例（色 + パターン）
    ctx.textAlign = 'left';
    const lg = [['SOUND', '健全'], ['CO', '要観察'], ['C1', '初期の虫歯'],
      ['C2', '内側まで進んだ虫歯'], ['C3', '神経に達した虫歯'], ['C4', '根だけ残った状態'],
      ['RESTORED', '治療済み']];
    let lx = M;
    lg.forEach(function (it) {
      const col = it[0] === 'RESTORED' ? CONFIG.COLORS.CR : CONFIG.COLORS[it[0]];
      ctx.fillStyle = cssHex(col); ctx.fillRect(lx, y - 14, 20, 20);
      hatch(ctx, lx, y - 14, 20, 20, HATCH[it[0]]);
      ctx.strokeStyle = '#9AA3AC'; ctx.lineWidth = 0.8; ctx.strokeRect(lx, y - 14, 20, 20);
      ctx.fillStyle = '#5A6675'; ctx.font = '500 16px sans-serif';
      ctx.fillText(it[1], lx + 26, y + 2);
      lx += 26 + ctx.measureText(it[1]).width + 22;
    });
    y += 34;

    // ---- 要処置一覧
    ctx.fillStyle = '#1B2430'; ctx.font = '700 22px sans-serif';
    ctx.fillText('これからの治療', M, y + 10);
    y += 28;
    const rows = planRows();
    const cols = [M + 6, M + 150, M + 520, A4.w - M - 12];
    ctx.fillStyle = '#EEF2F7'; ctx.fillRect(M, y, A4.w - M * 2, 40);
    ctx.fillStyle = '#5A6675'; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('歯', cols[0], y + 27);
    ctx.fillText('いまの状態', cols[1], y + 27);
    ctx.fillText('ご提案する治療', cols[2], y + 27);
    ctx.textAlign = 'right'; ctx.fillText('回数', cols[3], y + 27);
    y += 40;
    // 残りの紙面に収まる行数だけ出す（免責の手前で必ず止める）
    const RH = 46, bottomLimit = A4.h - M - 96;
    const maxRows = Math.max(0, Math.min(rows.length, Math.floor((bottomLimit - y) / RH)));
    for (let i = 0; i < maxRows; i++) {
      const r = rows[i];
      if (i % 2) { ctx.fillStyle = '#FAFBFC'; ctx.fillRect(M, y, A4.w - M * 2, RH); }
      ctx.fillStyle = '#1B2430'; ctx.font = '600 19px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(r.tooth, cols[0], y + 30);
      ctx.font = '500 19px sans-serif'; ctx.fillStyle = '#5A6675';
      ctx.fillText(r.cond, cols[1], y + 30);
      ctx.fillStyle = '#1B2430';
      ctx.fillText(r.proc, cols[2], y + 30);
      ctx.textAlign = 'right'; ctx.fillText(r.visits, cols[3], y + 30);
      ctx.strokeStyle = '#E7EBEF'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M, y + RH); ctx.lineTo(A4.w - M, y + RH); ctx.stroke();
      y += RH;
    }
    if (rows.length > maxRows) {
      ctx.fillStyle = '#5A6675'; ctx.font = '500 16px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('ほか ' + (rows.length - maxRows) + ' 件', cols[0], y + 22);
      y += 28;
    }
    if (!rows.length) {
      ctx.fillStyle = '#5A6675'; ctx.font = '500 18px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('現在ご提案中の治療はありません。', cols[0], y + 25);
      y += 38;
    }

    // ---- 歯ぐきの状態（SPEC §5.8 下段2）
    y += 26;
    ctx.fillStyle = '#1B2430'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('歯ぐきの状態', M, y + 10);
    y += 30;
    const ps = perioSummary();
    ctx.fillStyle = '#F7F9FB'; ctx.fillRect(M, y, A4.w - M * 2, 108);
    ctx.strokeStyle = '#E7EBEF'; ctx.lineWidth = 1.2;
    ctx.strokeRect(M, y, A4.w - M * 2, 108);
    const stat = [
      ['歯と歯ぐきのすき間が深いところ', ps.deep + ' か所', ps.deep > 0],
      ['歯ぐきから出血したところ', ps.bop + ' か所', ps.bop > 0],
      ['歯を支える骨が下がっている歯', ps.bone + ' 本', ps.bone > 0]
    ];
    stat.forEach(function (s, i) {
      const x = M + 24 + i * ((A4.w - M * 2 - 48) / 3);
      ctx.fillStyle = '#5A6675'; ctx.font = '500 16px sans-serif';
      ctx.fillText(s[0], x, y + 32);
      ctx.fillStyle = s[2] ? '#C1121F' : '#2A9D8F';
      ctx.font = '700 30px sans-serif';
      ctx.fillText(s[1], x, y + 70);
    });
    ctx.fillStyle = '#5A6675'; ctx.font = '500 16px sans-serif';
    ctx.fillText(ps.msg, M + 24, y + 95);
    y += 108;

    // ---- 免責（削除しない: CLAUDE.md §1-6）
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#DCE1E6'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(M, A4.h - M - 46); ctx.lineTo(A4.w - M, A4.h - M - 46); ctx.stroke();
    ctx.fillStyle = '#5A6675'; ctx.font = '500 15px sans-serif';
    ctx.fillText('本表示は説明用であり、診断結果を代替するものではありません。'
      + '3D の形は標準的な模型で、実際の歯の形とは異なります。', M, A4.h - M - 20);
    ctx.fillText('ご不明な点は担当の歯科医師・歯科衛生士におたずねください。', M, A4.h - M + 4);
  }

  /* ------------------------------------------------- 最小限の PDF ライタ */
  function asciiToU8(s) {
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xFF;
    return u;
  }
  function dataURLToU8(url) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  // JPEG を 1 枚全面に配置した 1 ページの PDF を組み立てる（DCTDecode）
  function buildPDF(jpeg, iw, ih) {
    const PW = 595.276, PH = 841.89;          // A4 (pt)
    const parts = [], offsets = [0];
    let len = 0;
    function put(x) {
      const u = (typeof x === 'string') ? asciiToU8(x) : x;
      parts.push(u); len += u.length;
    }
    function obj(n, body, stream) {
      offsets[n] = len;
      put(n + ' 0 obj\n' + body + '\n');
      if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
      put('endobj\n');
    }
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<</Type/Catalog/Pages 2 0 R>>');
    obj(2, '<</Type/Pages/Kids[3 0 R]/Count 1>>');
    obj(3, '<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) +
        ']/Resources<</XObject<</Im0 4 0 R>>/ProcSet[/PDF/ImageC]>>/Contents 5 0 R>>');
    obj(4, '<</Type/XObject/Subtype/Image/Width ' + iw + '/Height ' + ih +
        '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' +
        jpeg.length + '>>', jpeg);
    const content = 'q ' + PW.toFixed(2) + ' 0 0 ' + PH.toFixed(2) + ' 0 0 cm /Im0 Do Q';
    obj(5, '<</Length ' + content.length + '>>', asciiToU8(content));
    obj(6, '<</Type/Info/Title(DENTAL TWIN handout)/Creator(DENTAL TWIN)>>');

    const xref = len;
    let x = 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) {
      x += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    }
    put(x);
    put('trailer\n<</Size 7/Root 1 0 R/Info 6 0 R>>\nstartxref\n' + xref + '\n%%EOF\n');

    const out = new Uint8Array(len);
    let p = 0;
    parts.forEach(function (u) { out.set(u, p); p += u.length; });
    return out;
  }

  /* ------------------------------------------------------- 渡し物の導線 */
  async function renderHandout() {
    const target = new THREE.Vector3(0, 0, 0);
    const front = grabView(0, Math.PI / 2, 150, target);

    // クローズアップ: 選択歯 → なければ最も重い所見の歯
    let fdi = S.selected;
    if (fdi == null) { const w = worstCariesTooth(); fdi = w ? w.fdi : null; }
    if (fdi == null) { const p = planItems()[0]; fdi = p ? p.fdi : null; }
    let close = null, closeLabel = 'アップで見たところ';
    const t = fdi != null ? S.teeth.get(fdi) : null;
    if (t) {
      t.mesh.updateWorldMatrix(true, false);
      const c = t.centroid.clone().applyMatrix4(t.mesh.matrixWorld);
      const th = Math.atan2(c.x * 0.9 + t.ax.b.x * 20, c.z * 0.9 + t.ax.b.z * 20);
      close = grabView(th, Math.PI / 2 - t.ax.b.y * 0.6, 58, c);
      closeLabel = fdiToPalmer(fdi) + 'の歯（アップ）';
    }

    const images = await Promise.all([loadImg(front), close ? loadImg(close) : null]);
    const nameOn = document.getElementById('hoNameOn').checked;
    const nameTx = document.getElementById('hoNameTxt').value.trim();
    const now = new Date();
    await drawHandout(document.getElementById('hoCanvas'), {
      date: now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日',
      clinic: '○○歯科医院',
      name: nameOn && nameTx ? nameTx : '',
      images: images, closeLabel: closeLabel
    });
  }

  async function openHandout() {
    stopSeq(); closePop(); hideTip();
    document.getElementById('handout').classList.remove('hide');
    await renderHandout();
  }

  function saveHandoutPDF() {
    const canvas = document.getElementById('hoCanvas');
    const jpeg = dataURLToU8(canvas.toDataURL('image/jpeg', 0.9));
    const pdf = buildPDF(jpeg, canvas.width, canvas.height);
    const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dental_handout_' +
      (S.baseDoc && S.baseDoc.exam_id ? S.baseDoc.exam_id : 'sample') + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // 検証用フック
  S.api = {
    loadFindings: loadFindings, setSurfaceFinding: setSurfaceFinding,
    setToothStatus: setToothStatus, undo: undo, setSimulated: setSimulated,
    runSeq: runSeq, stopSeq: stopSeq, simulateAfter: simulateAfter,
    openPop: openPop, closePop: closePop,
    setPerio: setPerio, setBoneLevel: setBoneLevel, setChartTab: setChartTab,
    openHandout: openHandout, renderHandout: renderHandout,
    buildPDF: buildPDF, dataURLToU8: dataURLToU8, boneLevelOf: boneLevelOf
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
