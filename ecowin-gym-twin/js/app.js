/* ecowinハイブリッド 体育館デジタルツイン — 画面（3D表示・時間軸・グラフ） */
(function () {
  'use strict';
  var M = window.GymModel, G = M.GEOM, K = M.K;
  var $ = function (id) { return document.getElementById(id); };
  var N = G.NX * G.NY;
  var MODE_NAME = { none: '空調なし', ac: 'エアコンのみ', eco: 'ecowinハイブリッド' };
  var LAYER = {
    ot: { name: '体感温度', unit: '℃' }, ta: { name: '空気温度', unit: '℃' }, mrt: { name: '放射温度', unit: '℃' },
    wind: { name: '風速', unit: 'm/s' }, wbgt: { name: '暑さ指数 WBGT', unit: '℃' }
  };
  var WBGT_BANDS = [
    { lo: -99, name: 'ほぼ安全', c: '#5fa6dc' }, { lo: 21, name: '注意', c: '#86cfa0' }, { lo: 25, name: '警戒', c: '#f2d94a' },
    { lo: 28, name: '厳重警戒', c: '#f08a3c' }, { lo: 31, name: '危険', c: '#d6352b' }
  ];
  function wbgtBand(v) { var b = WBGT_BANDS[0]; WBGT_BANDS.forEach(function (x) { if (v >= x.lo) b = x; }); return b; }

  var S = {
    city: 3, insul: 'low', occupants: 80, sensible: 150, setHeat: 18, setCool: 27, opStart: 8, opEnd: 21,
    panels: 48, layout: 'rows', price: 22, basic: 1100,
    mode: 'eco', layer: 'ot', z: 1.1, t: 0, playing: false, speed: 4,
    wind: true, rays: true, section: false, people: true, probe: null
  };
  var wxCache = {}, wx, panels = [], F, F11, jet = {}, sim, dirty = true, chartsDirty = true;
  var target = new Float32Array(N), shown = new Float32Array(N), scratch = new Float32Array(N), first = true;
  var range = { lo: 10, hi: 26, c: 18, step: 1 }, rangeT = { lo: 10, hi: 26, c: 18, step: 1 };

  // ------------------------------------------------------------ 色
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function ramp(stops, n) { // stops: [[pos, '#hex'], ...]
    var out = new Uint8Array(n * 3);
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), a = stops[0], b = stops[stops.length - 1];
      for (var s = 0; s < stops.length - 1; s++) if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
      var f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0, ca = hex(a[1]), cb = hex(b[1]);
      for (var c = 0; c < 3; c++) out[i * 3 + c] = Math.round(ca[c] + (cb[c] - ca[c]) * f);
    }
    return out;
  }
  var LUT = {}, C = {};
  function buildColors() {
    ['--bg', '--surface', '--surface-2', '--ink', '--ink-2', '--ink-3', '--line', '--m-none', '--m-ac', '--m-eco', '--div-mid', '--scene', '--wood', '--accent'].forEach(function (k) { C[k] = css(k) || '#888888'; });
    var mid = C['--div-mid'];
    // 温度：設定温度を中央の無彩色に置く、青（寒い）と赤（暑い）の2色の尺度
    LUT.temp = ramp([[0, '#0d366b'], [0.14, '#1c5cab'], [0.28, '#3987e5'], [0.40, '#86b6ef'], [0.5, mid], [0.60, '#f0a39c'], [0.72, '#e34948'], [0.86, '#b02a2e'], [1, '#6e1220']], 512);
    // 風速：1色の濃淡
    LUT.wind = ramp([[0, mid], [0.2, '#b7d3f6'], [0.45, '#5598e7'], [0.7, '#1c5cab'], [1, '#0d366b']], 512);
    // 暑さ指数：運動指針の5区分（15〜35℃）
    LUT.wbgt = ramp([[0, '#5fa6dc'], [0.28, '#5fa6dc'], [0.32, '#86cfa0'], [0.48, '#86cfa0'], [0.52, '#f2d94a'], [0.63, '#f2d94a'], [0.67, '#f08a3c'], [0.78, '#f08a3c'], [0.82, '#d6352b'], [1, '#a31220']], 512);
  }
  function lutFor(layer) { return layer === 'wind' ? LUT.wind : layer === 'wbgt' ? LUT.wbgt : LUT.temp; }
  function colorAt(lut, v, lo, hi) { var i = Math.round(M.clamp((v - lo) / (hi - lo), 0, 1) * 511) * 3; return [lut[i], lut[i + 1], lut[i + 2]]; }
  function rgb(a) { return 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; }

  // ------------------------------------------------------------ 計算の更新
  function params() { return { city: S.city, insul: S.insul, occupants: S.occupants, sensible: S.sensible, setHeat: S.setHeat, setCool: S.setCool, opStart: S.opStart, opEnd: S.opEnd, panels: S.panels, price: S.price, basic: S.basic }; }
  function recomputeGeometry() {
    panels = M.buildPanels(S.layout, S.panels);
    F11 = M.computeViewWeights(1.1, panels);
    F = S.z === 1.1 ? F11 : M.computeViewWeights(S.z, panels);
    jet.heat = M.computeJetPattern(S.z, true); jet.cool = M.computeJetPattern(S.z, false);
    jet.max = { heat: Math.max.apply(null, jet.heat), cool: Math.max.apply(null, jet.cool) };
    if (!jet.m11) jet.m11 = { heat: M.computeJetPattern(1.1, true).mean, cool: M.computeJetPattern(1.1, false).mean };
    if (scene3) scene3.rebuildPanels();
  }
  function recomputeSim() {
    wx = wxCache[S.city] || (wxCache[S.city] = M.generateWeather(S.city));
    sim = M.simulate(params(), wx, F11.mean, jet.m11);
    dirty = true; chartsDirty = true;
    renderAnnual();
  }
  function recomputeAll() { recomputeGeometry(); recomputeSim(); }

  function isHeat(k) { return K.heatMonths[M.monthOfDay(Math.floor(k / 24))] === 1; }
  function stateAt(mode, t) {
    var k0 = Math.floor(t) % 8760, k1 = (k0 + 1) % 8760, f = t - Math.floor(t), o = sim[mode], st = {};
    for (var i = 0; i < M.FIELDS.length; i++) { var n = M.FIELDS[i]; st[n] = o[n][k0] + (o[n][k1] - o[n][k0]) * f; }
    return st;
  }
  function wxAt(t) {
    var k0 = Math.floor(t) % 8760, k1 = (k0 + 1) % 8760, f = t - Math.floor(t);
    return { T: M.lerp(wx.T[k0], wx.T[k1], f), I: M.lerp(wx.I[k0], wx.I[k1], f), RH: M.lerp(wx.RH[k0], wx.RH[k1], f), sky: wx.sky[Math.floor(k0 / 24)] };
  }
  function metricKey() { return S.layer === 'wbgt' ? 'WBGT' : 'OT'; }

  function updateRangeTarget() {
    if (S.layer === 'wind') { rangeT = { lo: 0, hi: 2.5, c: 1.25, step: 0.25 }; return; }
    if (S.layer === 'wbgt') { rangeT = { lo: 15, hi: 35, c: 25, step: 1 }; return; }
    // 尺度は空調ありの2方式の運転時間中の値で決める（空調なしが外れる日は端の色で表す）
    var d = Math.floor(S.t / 24), heat = isHeat(d * 24), c = heat ? S.setHeat : S.setCool, dev = 3;
    ['ac', 'eco'].forEach(function (m) {
      for (var h = S.opStart + 1; h < S.opEnd; h++) {
        var k = d * 24 + h;
        dev = Math.max(dev, Math.abs(sim[m].OT[k] - c), Math.abs(sim[m].Ta[k] - c));
      }
    });
    dev = Math.min(12, Math.ceil(dev + 1.5));
    rangeT = { lo: c - dev, hi: c + dev, c: c, step: dev > 8 ? 1 : 0.5 };
  }

  // ------------------------------------------------------------ 分布の描画（格子 → なめらかな画像）
  function makeFieldPainter(nx, ny, scale) {
    var w = nx * scale, h = ny * scale, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), q = new Int16Array(w * h);
    var xi = new Uint16Array(w), xf = new Float32Array(w), yi = new Uint16Array(h), yf = new Float32Array(h), i;
    for (i = 0; i < w; i++) { var gx = M.clamp((i + 0.5) / scale - 0.5, 0, nx - 1.001); xi[i] = Math.floor(gx); xf[i] = gx - xi[i]; }
    for (i = 0; i < h; i++) { var gy = M.clamp((i + 0.5) / scale - 0.5, 0, ny - 1.001); yi[i] = Math.floor(gy); yf[i] = gy - yi[i]; }
    return {
      canvas: cv,
      paint: function (vals, lut, lo, hi, step, line) {
        var d = img.data, inv = 511 / (hi - lo), p = 0, lr = line[0], lg = line[1], lb = line[2];
        for (var y = 0; y < h; y++) {
          var r0 = yi[y] * nx, r1 = r0 + nx, fy = yf[y];
          for (var x = 0; x < w; x++, p++) {
            var a = xi[x], fx = xf[x];
            var v0 = vals[r0 + a] + (vals[r0 + a + 1] - vals[r0 + a]) * fx, v1 = vals[r1 + a] + (vals[r1 + a + 1] - vals[r1 + a]) * fx;
            var v = v0 + (v1 - v0) * fy, t = (v - lo) * inv;
            var li = (t < 0 ? 0 : t > 511 ? 511 : t | 0) * 3, o = p * 4, lv = Math.floor(v / step);
            q[p] = lv;
            var edge = (x > 0 && q[p - 1] !== lv) || (y > 0 && q[p - w] !== lv);
            if (edge) { d[o] = (lut[li] + lr) >> 1; d[o + 1] = (lut[li + 1] + lg) >> 1; d[o + 2] = (lut[li + 2] + lb) >> 1; }
            else { d[o] = lut[li]; d[o + 1] = lut[li + 1]; d[o + 2] = lut[li + 2]; }
            d[o + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
    };
  }

  // ------------------------------------------------------------ 3D
  var scene3 = null;
  function initScene() {
    var THREE = window.THREE, canvas = $('gl'), view = $('view');
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
    catch (e) { var f = document.createElement('div'); f.className = 'glfail'; f.textContent = 'この端末では3D表示を使えません。下の年間マップとグラフ、右の読み値はそのまま使えます。'; view.appendChild(f); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.3, 400);
    var ctl = new THREE.OrbitControls(cam, canvas);
    ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495; ctl.minDistance = 4; ctl.maxDistance = 160;
    var W = G.W, D = G.D, H = G.H, cx = W / 2, cz = D / 2;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.95));
    var sun = new THREE.DirectionalLight(0xffffff, 0.35); sun.position.set(-30, 60, 40); scene.add(sun);

    function quad(pts, mat, uv) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], pts), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv || [0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    }
    // 床（木の色）とコートの線
    var floorMat = new THREE.MeshLambertMaterial({ color: 0xd9c6a3 });
    var floor = quad([[0, 0, D], [W, 0, D], [W, 0, 0], [0, 0, 0]], floorMat); scene.add(floor);
    var ground = quad([[-60, -0.05, D + 60], [W + 60, -0.05, D + 60], [W + 60, -0.05, -60], [-60, -0.05, -60]], new THREE.MeshBasicMaterial({ color: 0x888888 })); scene.add(ground);
    var lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    var lp = [];
    function seg(x1, y1, x2, y2) { lp.push(x1, 0.03, y1, x2, 0.03, y2); }
    function rect(x1, y1, x2, y2) { seg(x1, y1, x2, y1); seg(x2, y1, x2, y2); seg(x2, y2, x1, y2); seg(x1, y2, x1, y1); }
    function circle(x, y, r) { for (var a = 0; a < 32; a++) { var t1 = a / 32 * 6.2832, t2 = (a + 1) / 32 * 6.2832; seg(x + r * Math.cos(t1), y + r * Math.sin(t1), x + r * Math.cos(t2), y + r * Math.sin(t2)); } }
    [11.5, 30.5].forEach(function (yc) { // バスケットボールコート 28m×15m を2面
      rect(6, yc - 7.5, 34, yc + 7.5); seg(20, yc - 7.5, 20, yc + 7.5); circle(20, yc, 1.8);
      rect(6, yc - 2.45, 11.8, yc + 2.45); rect(28.2, yc - 2.45, 34, yc + 2.45);
    });
    var courtLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), lineMat); scene.add(courtLines);

    // 壁・屋根は内側の面だけ描く（外から見ると手前の壁が消え、中が見える）
    function inner() { return new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.BackSide }); }
    var wallMats = { N: inner(), S: inner(), E: inner(), W: inner() }, roofMat = inner();
    // 外向きの法線になるよう頂点を並べ、BackSide で室内側だけを描く
    scene.add(quad([[W, 0, 0], [0, 0, 0], [0, H, 0], [W, H, 0]], wallMats.N));
    scene.add(quad([[0, 0, D], [W, 0, D], [W, H, D], [0, H, D]], wallMats.S));
    scene.add(quad([[W, 0, D], [W, 0, 0], [W, H, 0], [W, H, D]], wallMats.E));
    scene.add(quad([[0, 0, 0], [0, 0, D], [0, H, D], [0, H, 0]], wallMats.W));
    scene.add(quad([[0, H, 0], [0, H, D], [W, H, D], [W, H, 0]], roofMat));
    var winMat = new THREE.MeshLambertMaterial({ color: 0x9cc4e6, side: THREE.BackSide });
    M.WINDOWS.forEach(function (w) {
      var z = w.wall === 'N' ? 0.03 : D - 0.03;
      scene.add(w.wall === 'N' ? quad([[w.x2, w.z1, z], [w.x1, w.z1, z], [w.x1, w.z2, z], [w.x2, w.z2, z]], winMat)
        : quad([[w.x1, w.z1, z], [w.x2, w.z1, z], [w.x2, w.z2, z], [w.x1, w.z2, z]], winMat));
    });
    // 骨組み（輪郭と梁）
    var fp = [];
    function e3(a, b) { fp.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    [[0, 0], [W, 0], [W, D], [0, D]].forEach(function (p, i, arr) { var n = arr[(i + 1) % 4]; e3([p[0], 0, p[1]], [n[0], 0, n[1]]); e3([p[0], H, p[1]], [n[0], H, n[1]]); e3([p[0], 0, p[1]], [p[0], H, p[1]]); });
    for (var bx = 5; bx < W; bx += 5) e3([bx, H - 0.05, 0], [bx, H - 0.05, D]);
    var frameMat = new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.55 });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)), frameMat));
    // ステージ
    var stageMat = new THREE.MeshLambertMaterial({ color: 0x8a7a66 });
    var stage = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 26), stageMat); stage.position.set(W - 2.5, 0.5, cz); scene.add(stage);

    // 評価面（体感温度などの分布）
    var painter = makeFieldPainter(G.NX, G.NY, 4), heatTex = new THREE.CanvasTexture(painter.canvas);
    heatTex.minFilter = THREE.LinearFilter; heatTex.generateMipmaps = false;
    var heatMat = new THREE.MeshBasicMaterial({ map: heatTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    var heatPlane = quad([[0, 0, D], [W, 0, D], [W, 0, 0], [0, 0, 0]], heatMat); heatPlane.renderOrder = 2; scene.add(heatPlane);
    // 断面（南北方向・空調機の正面を通る面）
    var SX = 16, NZ = 20, secPainter = makeFieldPainter(G.NY, NZ, 4), secTex = new THREE.CanvasTexture(secPainter.canvas), secVals = new Float32Array(G.NY * NZ);
    secTex.minFilter = THREE.LinearFilter; secTex.generateMipmaps = false;
    var sec = quad([[SX, 0, 0], [SX, 0, D], [SX, H, D], [SX, H, 0]], new THREE.MeshBasicMaterial({ map: secTex, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
    sec.renderOrder = 3; sec.visible = false; scene.add(sec);

    // 空調機
    var acGroup = new THREE.Group(), acMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    M.AC_UNITS.forEach(function (u) { var b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.1, 0.6), acMat); b.position.set(u.x, 1.55, u.y + (u.dir > 0 ? -0.15 : 0.15)); acGroup.add(b); });
    scene.add(acGroup);
    // パネル
    var panelGroup = new THREE.Group(), panelMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
    scene.add(panelGroup);
    function rebuildPanels() {
      while (panelGroup.children.length) panelGroup.remove(panelGroup.children[0]);
      panels.forEach(function (p) {
        var b = new THREE.Mesh(new THREE.BoxGeometry(p.axis === 'y' ? M.PANEL.w : 0.07, M.PANEL.h, p.axis === 'y' ? 0.07 : M.PANEL.w), panelMat);
        b.position.set(p.x, M.PANEL.z0 + M.PANEL.h / 2, p.y); panelGroup.add(b);
      });
      initRays();
    }
    // 人
    var people = new THREE.Group(), bodyMat = new THREE.MeshLambertMaterial({ color: 0x39424d }), r = mul(7);
    function mul(a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; }
    for (var pi = 0; pi < 34; pi++) {
      var px = pi < 26 ? 7 + r() * 26 : 2 + r() * 2, py = pi < 26 ? (pi % 2 ? 5 + r() * 13 : 24 + r() * 13) : 6 + r() * 30;
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 1.35, 8), bodyMat); body.position.set(px, 0.68, py);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bodyMat); head.position.set(px, 1.52, py);
      people.add(body); people.add(head);
    }
    scene.add(people);

    // 気流の粒子（短い線）
    var NP = 1500, wPos = new Float32Array(NP * 6), wCol = new Float32Array(NP * 6), wp = [];
    for (var i = 0; i < NP; i++) wp.push({ u: i % M.AC_UNITS.length, s: Math.random() * 30, lx: 0, lz: 0, life: 0 });
    var wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3)); wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
    var windLines = new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
    windLines.frustumCulled = false; windLines.renderOrder = 4; scene.add(windLines);
    function gs() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.9; }
    function respawn(p) { p.s = 0.3 + Math.random() * 1.2; p.lx = gs(); p.lz = gs(); p.life = 6 + Math.random() * 10; }
    function updateWind(dt, st, heat) {
      var u0 = K.u0[S.mode] * st.fan, on = S.wind && u0 > 0.05;
      windLines.visible = on; if (!on) return;
      var hot = hex(heat ? '#eb6834' : '#3987e5'), neu = hex(C['--ink-3']), active = S.mode === 'eco' ? NP * 0.45 : NP;
      for (var i = 0; i < NP; i++) {
        var p = wp[i], o = i * 6;
        if (i >= active) { wPos[o] = wPos[o + 3] = 0; wPos[o + 1] = wPos[o + 4] = -5; wPos[o + 2] = wPos[o + 5] = 0; continue; }
        var e = Math.exp(-(p.lx * p.lx + p.lz * p.lz)), vl = u0 * Math.min(1, 3.5 / p.s) * e;
        p.s += Math.max(vl, 0.05) * dt; p.life -= dt;
        if (p.life < 0 || p.s > D - 1.2 || vl < 0.07) { respawn(p); vl = u0 * e; }
        var un = M.AC_UNITS[p.u], tail = M.clamp(vl * 0.45, 0.12, 1.5);
        for (var q = 0; q < 2; q++) {
          var s = Math.max(0.2, p.s - q * tail), b = 0.35 + 0.11 * s;
          wPos[o + q * 3] = M.clamp(un.x + p.lx * b * 0.8, 0.2, W - 0.2);
          wPos[o + q * 3 + 1] = M.clamp(M.jetAxisZ(s, heat, un.z0) + p.lz * b * 0.8, 0.12, H - 0.15);
          wPos[o + q * 3 + 2] = un.y + un.dir * s;
        }
        var f = M.clamp(p.s / 26, 0, 1);
        for (var k = 0; k < 3; k++) { var c = (hot[k] + (neu[k] - hot[k]) * f) / 255; wCol[o + k] = c; wCol[o + 3 + k] = c; }
      }
      wGeo.attributes.position.needsUpdate = true; wGeo.attributes.color.needsUpdate = true;
    }

    // 輻射の粒子（暖房：パネルから外へ／冷房：パネルへ向かって）
    var NR = 1400, rPos = new Float32Array(NR * 3), rCol = new Float32Array(NR * 3), rp = [];
    var rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3)); rGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
    var dot = document.createElement('canvas'); dot.width = dot.height = 32; var dc = dot.getContext('2d');
    var gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
    var rays = new THREE.Points(rGeo, new THREE.PointsMaterial({ size: 0.34, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.9 }));
    rays.frustumCulled = false; rays.renderOrder = 5; scene.add(rays);
    var RMAX = 5.5;
    function initRays() {
      rp = [];
      for (var i = 0; i < NR; i++) rp.push({ p: panels.length ? i % panels.length : 0, side: i % 2 ? 1 : -1, a: Math.random() - 0.5, h: Math.random(), dl: gs() * 0.7, dv: gs() * 0.45, r: Math.random() * RMAX });
    }
    function updateRays(dt, st, heat) {
      var d = Math.abs(st.Tp - st.Ta), on = S.rays && S.mode === 'eco' && panels.length > 0 && d > 2;
      rays.visible = on; if (!on) return;
      var hot = hex(heat ? '#ff8a3d' : '#59b6ff'), bg = hex(C['--scene']), sp = (heat ? 1 : -1) * 2.0 * dt, act = M.clamp(d / 25, 0.15, 1) * NR;
      for (var i = 0; i < NR; i++) {
        var q = rp[i], o = i * 3;
        if (i > act) { rPos[o + 1] = -5; continue; }
        q.r += sp;
        if (q.r > RMAX) q.r = 0.05; else if (q.r < 0.05) q.r = RMAX;
        var P = panels[q.p], nx = q.r * q.side, lat = q.a * M.PANEL.w + q.dl * q.r, hz = M.PANEL.z0 + q.h * M.PANEL.h + q.dv * q.r;
        var x = P.axis === 'y' ? P.x + lat : P.x + nx, y = P.axis === 'y' ? P.y + nx : P.y + lat;
        if (x < 0.1 || x > W - 0.1 || y < 0.1 || y > D - 0.1 || hz < 0.05 || hz > H - 0.1) { rPos[o + 1] = -5; continue; }
        rPos[o] = x; rPos[o + 1] = hz; rPos[o + 2] = y;
        var f = Math.pow(q.r / RMAX, 0.8);
        for (var k = 0; k < 3; k++) rCol[o + k] = (hot[k] + (bg[k] - hot[k]) * f) / 255;
      }
      rGeo.attributes.position.needsUpdate = true; rGeo.attributes.color.needsUpdate = true;
    }

    // 地点の読み取り
    var probeMark = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    probeMark.add(pole); probeMark.add(ball); probeMark.visible = false; scene.add(probeMark);
    var ray = new THREE.Raycaster(), down = null;
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!down || Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) return;
      var b = canvas.getBoundingClientRect();
      ray.setFromCamera({ x: (e.clientX - b.left) / b.width * 2 - 1, y: -(e.clientY - b.top) / b.height * 2 + 1 }, cam);
      var hit = ray.intersectObject(floor)[0];
      S.probe = hit && hit.point.x > 0.3 && hit.point.x < W - 0.3 && hit.point.z > 0.3 && hit.point.z < D - 0.3 ? { x: hit.point.x, y: hit.point.z } : null;
      dirty = true;
    });

    // カメラ
    var CAMS = {
      iso: { p: [-16, 30, D + 30], t: [cx + 1, 1.5, cz - 1] }, top: { p: [cx, 78, cz + 0.02], t: [cx, 0, cz] },
      eye: { p: [3.5, 1.6, D - 3], t: [cx + 6, 2.2, cz - 4] }, side: { p: [-44, 7, cz], t: [SX, 4.6, cz] }
    }, fly = null;
    function setCam(name, instant) {
      var c = CAMS[name];
      if (instant) { cam.position.set(c.p[0], c.p[1], c.p[2]); ctl.target.set(c.t[0], c.t[1], c.t[2]); ctl.update(); return; }
      fly = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: new THREE.Vector3(c.p[0], c.p[1], c.p[2]), t1: new THREE.Vector3(c.t[0], c.t[1], c.t[2]), a: 0 };
    }
    setCam('iso', true);
    canvas.addEventListener('pointerdown', function () { fly = null; });
    canvas.addEventListener('wheel', function () { fly = null; }, { passive: true });

    function resize() {
      var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < 520 ? 52 : 38; cam.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(view); resize();

    var tmpV = new THREE.Vector3();
    function tint(mat, base, T, on) {
      var c = on ? colorAt(LUT.temp, T, range.lo, range.hi) : base, f = on ? 0.62 : 0;
      mat.color.setRGB((base[0] + (c[0] - base[0]) * f) / 255, (base[1] + (c[1] - base[1]) * f) / 255, (base[2] + (c[2] - base[2]) * f) / 255);
    }
    return {
      rebuildPanels: rebuildPanels, setCam: setCam,
      applyTheme: function () {
        renderer.setClearColor(new THREE.Color(C['--scene']), 1);
        ground.material.color.set(C['--scene']); floorMat.color.set(C['--wood']);
        lineMat.color.set(C['--surface']); frameMat.color.set(C['--ink-3']);
        pole.material.color.set(C['--ink']);
      },
      paintHeat: function () {
        painter.paint(shown, lutFor(S.layer), range.lo, range.hi, range.step, hex(C['--ink']));
        heatTex.needsUpdate = true;
      },
      frame: function (dt, st, heat) {
        if (fly) {
          fly.a = Math.min(1, fly.a + dt / 0.9); var e = fly.a * fly.a * (3 - 2 * fly.a);
          cam.position.lerpVectors(fly.p0, fly.p1, e); ctl.target.lerpVectors(fly.t0, fly.t1, e); if (fly.a >= 1) fly = null;
        }
        ctl.update();
        heatPlane.position.y = S.z + 0.01; courtLines.position.y = S.z + 0.02;
        var tl = S.layer !== 'wind' && S.layer !== 'wbgt', wb = hex(C['--surface-2']);
        tint(wallMats.N, wb, 0.8 * st.Twall + 0.2 * st.Twin, tl); tint(wallMats.S, wb, 0.8 * st.Twall + 0.2 * st.Twin, tl);
        tint(wallMats.E, wb, st.Twall, tl); tint(wallMats.W, wb, st.Twall, tl); tint(roofMat, wb, st.Tri, tl);
        tint(winMat, [156, 196, 230], st.Twin, tl);
        panelGroup.visible = S.mode === 'eco'; acGroup.visible = S.mode !== 'none'; people.visible = S.people;
        if (S.mode === 'eco') { var pc = colorAt(LUT.temp, st.Tp, range.lo, range.hi); panelMat.color.setRGB(pc[0] / 255, pc[1] / 255, pc[2] / 255); panelMat.emissive.setRGB(pc[0] / 600, pc[1] / 600, pc[2] / 600); }
        sec.visible = S.section;
        if (S.section) {
          for (var j = 0; j < NZ; j++) for (var i = 0; i < G.NY; i++) {
            var a = M.airAt(SX, (i + 0.5) * G.cell, (NZ - 1 - j + 0.5) * (H / NZ), S.mode, st, heat);
            secVals[j * G.NY + i] = S.layer === 'wind' ? a.v : a.T;
          }
          var wl = S.layer === 'wind', lo = wl ? 0 : S.layer === 'wbgt' ? st.Ta - 8 : range.lo, hi = wl ? 2.5 : S.layer === 'wbgt' ? st.Ta + 8 : range.hi;
          secPainter.paint(secVals, wl ? LUT.wind : LUT.temp, lo, hi, wl ? 0.25 : range.step, hex(C['--ink']));
          secTex.needsUpdate = true;
        }
        updateWind(dt, st, heat); updateRays(dt, st, heat);
        var pe = $('probe');
        if (S.probe) {
          probeMark.visible = true; probeMark.position.set(S.probe.x, 0, S.probe.y);
          pole.scale.y = S.z + 0.3; pole.position.y = (S.z + 0.3) / 2; ball.position.y = S.z + 0.3;
          tmpV.set(S.probe.x, S.z + 0.5, S.probe.y).project(cam);
          var b = view.getBoundingClientRect();
          pe.style.left = ((tmpV.x + 1) / 2 * b.width) + 'px'; pe.style.top = ((1 - tmpV.y) / 2 * b.height) + 'px';
          pe.hidden = tmpV.z > 1;
        } else { probeMark.visible = false; pe.hidden = true; }
        renderer.render(scene, cam);
      }
    };
  }

  // ------------------------------------------------------------ 2Dグラフ共通
  function fit(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.font = '11px Barlow, "Zen Kaku Gothic New", sans-serif';
    return { c: c, w: w, h: h };
  }
  var tip = $('tip');
  function showTip(e, html) {
    tip.innerHTML = html; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, x = e.clientX + 14, y = e.clientY - h - 10;
    if (x + w > window.innerWidth - 6) x = e.clientX - w - 14; if (y < 6) y = e.clientY + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }
  function fmtDate(d) { var m = M.monthOfDay(d); return (m + 1) + '月' + (d - M.MSTART[m] + 1) + '日'; }
  function fmtHour(h) { var hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return hh + ':' + (mm < 10 ? '0' : '') + mm; }
  var SKY = ['晴れ', 'くもり', '雨'];

  // 年間マップ（365日×24時間）
  var calImg = null, calGeom = null;
  function buildCal() {
    var key = metricKey(), o = sim[S.mode][key], cv = document.createElement('canvas'); cv.width = 365; cv.height = 24;
    var c = cv.getContext('2d'), img = c.createImageData(365, 24), lut = S.layer === 'wbgt' ? LUT.wbgt : LUT.temp;
    for (var d = 0; d < 365; d++) {
      var set = K.heatMonths[M.monthOfDay(d)] ? S.setHeat : S.setCool;
      for (var h = 0; h < 24; h++) {
        var v = o[d * 24 + h], col = S.layer === 'wbgt' ? colorAt(lut, v, 15, 35) : colorAt(lut, v - set, -16, 16), p = (h * 365 + d) * 4;
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0); calImg = cv;
    $('calT').textContent = '年間マップ：' + MODE_NAME[S.mode] + 'の' + (S.layer === 'wbgt' ? '暑さ指数' : '体感温度');
    $('calK').textContent = S.layer === 'wbgt' ? '青：ほぼ安全 → 赤：危険' : '青：設定より寒い　灰：設定どおり　赤：設定より暑い';
  }
  function drawCal() {
    var f = fit($('cal')), c = f.c, L = 26, T = 2, B = 14, w = f.w - L - 4, h = f.h - T - B;
    calGeom = { L: L, T: T, w: w, h: h };
    c.imageSmoothingEnabled = false; c.drawImage(calImg, L, T, w, h);
    c.fillStyle = C['--ink-2']; c.textAlign = 'right'; c.textBaseline = 'middle';
    [0, 6, 12, 18, 24].forEach(function (hh) { c.fillText(hh + '時', L - 4, T + h * hh / 24 + (hh === 0 ? 4 : hh === 24 ? -4 : 0)); });
    c.textAlign = 'left'; c.textBaseline = 'top';
    for (var m = 0; m < 12; m++) {
      var x = L + w * M.MSTART[m] / 365;
      if (m) { c.fillStyle = C['--surface']; c.globalAlpha = 0.5; c.fillRect(x, T, 1, h); c.globalAlpha = 1; }
      c.fillStyle = C['--ink-2']; if (w > 420 || m % 2 === 0) c.fillText((m + 1) + '月', x + 2, T + h + 2);
    }
    // 空調の運転時間帯
    c.strokeStyle = C['--ink']; c.globalAlpha = 0.35; c.setLineDash([3, 3]); c.lineWidth = 1;
    [S.opStart, S.opEnd].forEach(function (hh) { c.beginPath(); c.moveTo(L, T + h * hh / 24 + 0.5); c.lineTo(L + w, T + h * hh / 24 + 0.5); c.stroke(); });
    c.setLineDash([]); c.globalAlpha = 1;
    var d = Math.floor(S.t / 24), hr = S.t - d * 24, px = L + w * (d + 0.5) / 365, py = T + h * hr / 24;
    c.strokeStyle = C['--ink']; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 0.5, T); c.lineTo(px + 0.5, T + h); c.stroke();
    c.fillStyle = C['--surface']; c.strokeStyle = C['--ink']; c.lineWidth = 2; c.beginPath(); c.arc(px + 0.5, py, 4.5, 0, 6.2832); c.fill(); c.stroke();
  }
  function calPick(e) {
    var b = $('cal').getBoundingClientRect(), g = calGeom;
    return { d: M.clamp(Math.floor((e.clientX - b.left - g.L) / g.w * 365), 0, 364), h: M.clamp((e.clientY - b.top - g.T) / g.h * 24, 0, 23.99) };
  }

  // 1日の推移
  var dayGeom = null;
  function drawDay() {
    var f = fit($('day')), c = f.c, L = 30, R = 8, T = 6, B = 16, w = f.w - L - R, h = f.h - T - B;
    var d = Math.floor(S.t / 24), key = metricKey(), lo = 1e9, hi = -1e9, k, hh;
    for (hh = 0; hh < 24; hh++) {
      k = d * 24 + hh; lo = Math.min(lo, wx.T[k]); hi = Math.max(hi, wx.T[k]);
      M.MODES.forEach(function (m) { lo = Math.min(lo, sim[m][key][k]); hi = Math.max(hi, sim[m][key][k]); });
    }
    lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1); var stp = hi - lo > 16 ? 5 : 2;
    function X(x) { return L + w * x / 24; } function Y(v) { return T + h * (1 - (v - lo) / (hi - lo)); }
    dayGeom = { L: L, w: w, d: d };
    c.fillStyle = C['--surface-2']; c.fillRect(X(S.opStart), T, X(S.opEnd) - X(S.opStart), h);
    c.strokeStyle = C['--line']; c.lineWidth = 1; c.fillStyle = C['--ink-2']; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (var v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) { c.beginPath(); c.moveTo(L, Y(v) + 0.5); c.lineTo(L + w, Y(v) + 0.5); c.stroke(); c.fillText(v + '℃', L - 4, Y(v)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    [0, 6, 12, 18, 24].forEach(function (x) { c.fillText(x + '時', X(x) + (x === 0 ? 8 : x === 24 ? -10 : 0), T + h + 3); });
    c.fillStyle = C['--ink-3']; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('空調の運転時間', X(S.opStart) + 4, T + h - 2);
    function line(arr, col, wd, dash) {
      c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash || []); c.lineJoin = 'round'; c.beginPath();
      for (var x = 0; x <= 24; x++) { var kk = (d * 24 + x) % 8760; if (x) c.lineTo(X(x), Y(arr[kk])); else c.moveTo(X(x), Y(arr[kk])); }
      c.stroke(); c.setLineDash([]);
    }
    line(wx.T, C['--ink-3'], 1.5, [3, 3]);
    M.MODES.forEach(function (m) { if (m !== S.mode) line(sim[m][key], C['--m-' + m], 2); });
    line(sim[S.mode][key], C['--m-' + S.mode], 3);
    var hr = S.t - d * 24, px = X(hr);
    c.strokeStyle = C['--ink']; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 0.5, T); c.lineTo(px + 0.5, T + h); c.stroke();
    var cur = stateAt(S.mode, S.t)[key];
    c.fillStyle = C['--m-' + S.mode]; c.strokeStyle = C['--surface']; c.lineWidth = 2; c.beginPath(); c.arc(px, Y(cur), 4.5, 0, 6.2832); c.fill(); c.stroke();
    $('dayT').textContent = fmtDate(d) + 'の' + (S.layer === 'wbgt' ? '暑さ指数' : '体感温度') + '（館内の平均）';
  }

  // 月ごとの電力量
  var monGeom = null;
  function drawMon() {
    var f = fit($('mon')), c = f.c, L = 26, T = 6, B = 15, w = f.w - L - 2, h = f.h - T - B, a = sim.summary.modes.ac.monthly, e = sim.summary.modes.eco.monthly;
    var mx = 1; for (var m = 0; m < 12; m++) mx = Math.max(mx, a[m] / 1000);
    var stp = mx > 30 ? 10 : mx > 12 ? 5 : mx > 4 ? 2 : 1; mx = Math.ceil(mx / stp) * stp;
    c.strokeStyle = C['--line']; c.fillStyle = C['--ink-2']; c.textAlign = 'right'; c.textBaseline = 'middle'; c.lineWidth = 1;
    for (var v = 0; v <= mx; v += stp) { var y = T + h * (1 - v / mx); c.beginPath(); c.moveTo(L, y + 0.5); c.lineTo(L + w, y + 0.5); c.stroke(); c.fillText(v, L - 4, y); }
    var bw = w / 12, bar = Math.max(3, Math.min(11, (bw - 6) / 2));
    monGeom = { L: L, bw: bw };
    function rr(x, v, col) {
      var bh = h * v / mx; if (bh < 0.5) return; var r = Math.min(3, bh), y0 = T + h - bh;
      c.fillStyle = col; c.beginPath(); c.moveTo(x, T + h); c.lineTo(x, y0 + r); c.quadraticCurveTo(x, y0, x + r, y0); c.lineTo(x + bar - r, y0); c.quadraticCurveTo(x + bar, y0, x + bar, y0 + r); c.lineTo(x + bar, T + h); c.fill();
    }
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (m = 0; m < 12; m++) {
      var x0 = L + bw * m + (bw - bar * 2 - 2) / 2;
      rr(x0, a[m] / 1000, C['--m-ac']); rr(x0 + bar + 2, e[m] / 1000, C['--m-eco']);
      c.fillStyle = C['--ink-2']; c.fillText(m + 1, L + bw * (m + 0.5), T + h + 3);
    }
  }

  // ------------------------------------------------------------ 右側の読み値
  function f1(v) { return v.toFixed(1); }
  function yen(v) { return Math.round(v / 10000).toLocaleString('ja-JP') + '万円'; }
  function renderNow(sts, w) {
    var d = Math.floor(S.t / 24), heat = isHeat(Math.floor(S.t));
    $('clockD').textContent = fmtDate(d) + ' ' + fmtHour(S.t - d * 24);
    $('clockW').textContent = wx.city.name + '　' + SKY[w.sky] + '　外気 ' + f1(w.T) + '℃　' + (heat ? '暖房期' : '冷房期');
    $('now').innerHTML = '<span>外気温 <b>' + f1(w.T) + '</b>℃</span><span>湿度 <b>' + Math.round(w.RH) + '</b>%</span><span>日射 <b>' + Math.round(w.I) + '</b>W/㎡</span>';
    var rows = [
      ['空気温度（腰の高さ）', function (s) { return f1(s.Ta) + '℃'; }],
      ['体感温度（平均）', function (s) { return f1(s.OT) + '℃'; }],
      ['天井付近の空気', function (s) { return f1(s.Ta + s.G * (G.H - 0.5 - G.zRef)) + '℃'; }],
      ['屋根の内側の表面', function (s) { return f1(s.Tri) + '℃'; }],
      ['暑さ指数 WBGT', function (s) { var b = wbgtBand(s.WBGT); return f1(s.WBGT) + ' <span class="pill" style="background:' + b.c + '">' + b.name + '</span>'; }],
      ['最大風速（評価面）', function (s, m) { return (0.1 + K.u0[m] * s.fan * jet.max[heat ? 'heat' : 'cool']).toFixed(1) + 'm/s'; }],
      ['消費電力', function (s) { return Math.round(s.P) + 'kW'; }]
    ];
    var h = '<thead><tr><th></th>' + M.MODES.map(function (m) { return '<th' + (m === S.mode ? ' class="cur"' : '') + '>' + (m === 'eco' ? 'ecowin' : m === 'ac' ? 'エアコン' : MODE_NAME[m]) + '<i style="background:var(--m-' + m + ')"></i></th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><th>' + r[0] + '</th>' + M.MODES.map(function (m) { return '<td' + (m === S.mode ? ' class="cur"' : '') + '>' + r[1](sts[m], m) + '</td>'; }).join('') + '</tr>'; });
    $('cmp').innerHTML = h + '</tbody>';
  }
  function renderAnnual() {
    var s = sim.summary, a = s.modes.ac, e = s.modes.eco, n = s.modes.none;
    $('rate').innerHTML = '−' + (s.rate * 100).toFixed(0) + '<small>%</small>';
    $('rateCap').innerHTML = '年間の消費電力量（エアコンのみとの比較）' + (s.capped ? '<br>計算値は ' + (s.rawRate * 100).toFixed(0) + '%。メーカー公表の最大値 34% を上限にしています。' : '<br>メーカー公表の最大値は 34% です。');
    function row(l, x, y, z) { return '<tr><th>' + l + '</th><td>' + x + '</td><td>' + y + '</td><td>' + z + '</td></tr>'; }
    $('ann').innerHTML = '<thead><tr><th></th><th>エアコン<i style="background:var(--m-ac)"></i></th><th>ecowin<i style="background:var(--m-eco)"></i></th><th>差</th></tr></thead><tbody>' +
      row('消費電力量', (a.kwh / 1000).toFixed(1) + 'MWh', (e.kwh / 1000).toFixed(1) + 'MWh', '−' + ((a.kwh - e.kwh) / 1000).toFixed(1)) +
      row('最大需要電力', Math.round(a.contract) + 'kW', Math.round(e.contract) + 'kW', '−' + Math.round(a.contract - e.contract)) +
      row('電力量料金', yen(a.energyCost), yen(e.energyCost), '−' + yen(a.energyCost - e.energyCost)) +
      row('基本料金', yen(a.basicCost), yen(e.basicCost), '−' + yen(a.basicCost - e.basicCost)) +
      row('電気代の合計', yen(a.cost), yen(e.cost), '−' + yen(a.cost - e.cost)) +
      row('CO2排出量', (a.co2 / 1000).toFixed(1) + 't', (e.co2 / 1000).toFixed(1) + 't', '−' + ((a.co2 - e.co2) / 1000).toFixed(1)) + '</tbody>';
    $('annNote').innerHTML = '空調なしの場合、利用時間のうち暑さ指数が「厳重警戒」以上（28℃以上）になるのは年間 <b class="num">' + n.wbgt28 + '</b> 時間、「危険」（31℃以上）は <b class="num">' + n.wbgt31 + '</b> 時間、体感温度が12℃未満は <b class="num">' + n.cold + '</b> 時間です。空調ありでは「厳重警戒」以上が エアコンのみ ' + a.wbgt28 + ' 時間、ecowin ' + e.wbgt28 + ' 時間になります。';
  }
  function renderLegend() {
    var L = LAYER[S.layer], cv = $('legC'), c = cv.getContext('2d'), lut = lutFor(S.layer);
    for (var x = 0; x < 300; x++) { var i = Math.round(x / 299 * 511) * 3; c.fillStyle = 'rgb(' + lut[i] + ',' + lut[i + 1] + ',' + lut[i + 2] + ')'; c.fillRect(x, 0, 1, 10); }
    $('legT').textContent = L.name + '（' + L.unit + '）　高さ ' + S.z + 'm';
    var dg = S.layer === 'wind' ? 1 : 0, ticks = [];
    for (var k = 0; k <= 4; k++) ticks.push((range.lo + (range.hi - range.lo) * k / 4).toFixed(dg));
    $('legK').innerHTML = ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    $('legH').textContent = S.layer === 'wind' ? '線は0.25m/sごと' : S.layer === 'wbgt' ? '28以上は厳重警戒' : '中央の灰色＝設定 ' + range.c.toFixed(0) + '℃';
  }
  function renderProbe(st, heat) {
    if (!S.probe) return;
    var i = M.clamp(Math.floor(S.probe.x / G.cell), 0, G.NX - 1), j = M.clamp(Math.floor(S.probe.y / G.cell), 0, G.NY - 1), k = j * G.NX + i, v = {};
    ['ot', 'ta', 'mrt', 'wind', 'wbgt'].forEach(function (l) { M.computeField(l, S.mode, st, heat, S.z, F, heat ? jet.heat : jet.cool, scratch); v[l] = scratch[k]; });
    var b = wbgtBand(v.wbgt);
    $('probe').innerHTML = '体感 <b>' + f1(v.ot) + '</b>℃<table><tr><td>空気</td><td>' + f1(v.ta) + '℃</td></tr><tr><td>放射</td><td>' + f1(v.mrt) + '℃</td></tr><tr><td>風速</td><td>' + v.wind.toFixed(2) + 'm/s</td></tr><tr><td>WBGT</td><td>' + f1(v.wbgt) + ' ' + b.name + '</td></tr></table>';
  }

  // ------------------------------------------------------------ 操作
  function press(seg, v) { [].forEach.call($(seg).children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); }); }
  function bindSeg(seg, key, conv, after) {
    $(seg).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S[key] = conv ? conv(b.dataset.v) : b.dataset.v; press(seg, b.dataset.v); after(); });
    press(seg, S[key]);
  }
  var debounce = null;
  function later(fn) { clearTimeout(debounce); debounce = setTimeout(fn, 120); }
  function setTime(t) { S.t = ((t % 8760) + 8760) % 8760; dirty = true; }
  function syncSliders() { $('hourR').value = (S.t - Math.floor(S.t / 24) * 24).toFixed(2); }
  function refreshMode() { $('modeDot').style.background = 'var(--m-' + S.mode + ')'; $('modeName').textContent = MODE_NAME[S.mode]; }

  function initUI() {
    M.CITIES.forEach(function (c, i) { var o = document.createElement('option'); o.value = i; o.textContent = c.name; $('city').appendChild(o); });
    Object.keys(M.INSUL).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = M.INSUL[k].label; $('insul').appendChild(o); });
    $('city').value = S.city; $('insul').value = S.insul; $('occ').value = S.occupants; $('act').value = S.sensible;
    $('setHeat').value = S.setHeat; $('setCool').value = S.setCool; $('opStart').value = S.opStart; $('opEnd').value = S.opEnd;
    $('panels').value = S.panels; $('layout').value = S.layout; $('price').value = S.price; $('basic').value = S.basic;
    function outs() { $('occOut').textContent = S.occupants + '人'; $('panelsOut').textContent = S.panels + '台'; }
    outs();
    bindSeg('modeSeg', 'mode', null, function () { refreshMode(); dirty = true; chartsDirty = true; });
    bindSeg('layerSeg', 'layer', null, function () { dirty = true; chartsDirty = true; });
    bindSeg('zSeg', 'z', parseFloat, function () { recomputeGeometry(); dirty = true; });
    refreshMode();
    function num(id, key, lo, hi, geo) {
      $(id).addEventListener('input', function () {
        var v = parseFloat($(id).value); if (isNaN(v)) return; S[key] = M.clamp(v, lo, hi); outs();
        later(function () { if (geo) recomputeAll(); else recomputeSim(); jumpsReady = false; });
      });
    }
    num('occ', 'occupants', 0, 600); num('setHeat', 'setHeat', 12, 24); num('setCool', 'setCool', 22, 30);
    num('opStart', 'opStart', 5, 12); num('opEnd', 'opEnd', 14, 23); num('panels', 'panels', 0, 72, true);
    num('price', 'price', 5, 60); num('basic', 'basic', 0, 3000); num('act', 'sensible', 50, 300); num('city', 'city', 0, 6);
    $('insul').addEventListener('change', function () { S.insul = $('insul').value; recomputeSim(); });
    $('layout').addEventListener('change', function () { S.layout = $('layout').value; recomputeAll(); });
    [['ckWind', 'wind'], ['ckRays', 'rays'], ['ckSection', 'section'], ['ckPeople', 'people']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { S[p[1]] = $(p[0]).checked; if (p[1] === 'section' && S.section && scene3) scene3.setCam('side'); dirty = true; });
    });
    $('cams').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && scene3) scene3.setCam(b.dataset.v); });
    $('play').addEventListener('click', function () { S.playing = !S.playing; $('play').textContent = S.playing ? '❚❚ 停止' : '▶ 再生'; });
    $('speed').addEventListener('change', function () { S.speed = parseFloat($('speed').value); });
    $('hourR').addEventListener('input', function () { setTime(Math.floor(S.t / 24) * 24 + parseFloat($('hourR').value)); });
    var jumpsReady = false, hotD = 0, coldD = 0;
    function jumps() {
      if (jumpsReady) return; var mx = -99, mn = 99;
      for (var d = 0; d < 365; d++) { if (wx.tmax[d] > mx && wx.sky[d] === 0) { mx = wx.tmax[d]; hotD = d; } if (wx.tmin[d] < mn) { mn = wx.tmin[d]; coldD = d; } }
      jumpsReady = true;
    }
    $('jumpHot').addEventListener('click', function () { jumps(); setTime(hotD * 24 + 14); syncSliders(); });
    $('jumpCold').addEventListener('click', function () { jumps(); setTime(coldD * 24 + 9); syncSliders(); });
    jumps(); setTime(hotD * 24 + 14); syncSliders();

    // 年間マップ：なぞって日時を選ぶ
    var cal = $('cal'), calDown = false;
    function calSet(e) { var p = calPick(e); setTime(p.d * 24 + p.h); syncSliders(); }
    cal.addEventListener('pointerdown', function (e) { calDown = true; cal.setPointerCapture(e.pointerId); calSet(e); });
    cal.addEventListener('pointermove', function (e) {
      var p = calPick(e), k = p.d * 24 + Math.floor(p.h), key = metricKey();
      if (calDown) calSet(e);
      showTip(e, fmtDate(p.d) + ' ' + Math.floor(p.h) + '時　' + SKY[wx.sky[p.d]] + '<br>外気 <b>' + f1(wx.T[k]) + '</b>℃　' + (key === 'WBGT' ? '暑さ指数' : '体感') + ' <b>' + f1(sim[S.mode][key][k]) + '</b>℃');
    });
    cal.addEventListener('pointerup', function () { calDown = false; });
    cal.addEventListener('pointerleave', hideTip);
    // 1日の推移：なぞって時刻を選ぶ
    var day = $('day'), dayDown = false;
    function dayHour(e) { var b = day.getBoundingClientRect(); return M.clamp((e.clientX - b.left - dayGeom.L) / dayGeom.w * 24, 0, 23.99); }
    day.addEventListener('pointerdown', function (e) { dayDown = true; day.setPointerCapture(e.pointerId); setTime(dayGeom.d * 24 + dayHour(e)); syncSliders(); });
    day.addEventListener('pointermove', function (e) {
      var h = dayHour(e), k = dayGeom.d * 24 + Math.floor(h), key = metricKey();
      if (dayDown) { setTime(dayGeom.d * 24 + h); syncSliders(); }
      showTip(e, Math.floor(h) + '時　外気 <b>' + f1(wx.T[k]) + '</b>℃<br>' + M.MODES.map(function (m) { return MODE_NAME[m] + ' <b>' + f1(sim[m][key][k]) + '</b>℃'; }).join('<br>'));
    });
    day.addEventListener('pointerup', function () { dayDown = false; });
    day.addEventListener('pointerleave', hideTip);
    var mon = $('mon');
    mon.addEventListener('pointermove', function (e) {
      var b = mon.getBoundingClientRect(), m = M.clamp(Math.floor((e.clientX - b.left - monGeom.L) / monGeom.bw), 0, 11), a = sim.summary.modes.ac.monthly[m], ec = sim.summary.modes.eco.monthly[m];
      showTip(e, (m + 1) + '月<br>エアコンのみ <b>' + (a / 1000).toFixed(1) + '</b>MWh<br>ecowin <b>' + (ec / 1000).toFixed(1) + '</b>MWh' + (a > 0 ? '（−' + Math.round((1 - ec / a) * 100) + '%）' : ''));
    });
    mon.addEventListener('pointerleave', hideTip);

    $('openNotes').addEventListener('click', function () { var d = $('notes'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); });
    $('closeNotes').addEventListener('click', function () { var d = $('notes'); if (d.close) d.close(); else d.removeAttribute('open'); });
    window.addEventListener('keydown', function (e) {
      if (e.target.matches('input, select, textarea, button')) return;
      if (e.key === ' ') { e.preventDefault(); $('play').click(); }
      else if (e.key === 'ArrowRight') { setTime(S.t + (e.shiftKey ? 24 : 1)); syncSliders(); }
      else if (e.key === 'ArrowLeft') { setTime(S.t - (e.shiftKey ? 24 : 1)); syncSliders(); }
    });
    new ResizeObserver(function () { chartsDirty = true; dirty = true; }).observe($('cal'));
    var themed = function () { buildColors(); if (scene3) scene3.applyTheme(); chartsDirty = true; dirty = true; first = true; };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themed);
    new MutationObserver(themed).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { chartsDirty = true; dirty = true; });
  }

  // ------------------------------------------------------------ 毎フレーム
  var last = 0, legendKey = '', lastDay = -1, settle = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
    if (S.playing) { setTime(S.t + dt * S.speed); syncSliders(); }
    var heat = isHeat(Math.floor(S.t)), st = stateAt(S.mode, S.t);
    if (dirty) {
      updateRangeTarget();
      M.computeField(S.layer, S.mode, st, heat, S.z, F, heat ? jet.heat : jet.cool, target);
      var sts = {}; M.MODES.forEach(function (m) { sts[m] = m === S.mode ? st : stateAt(m, S.t); });
      renderNow(sts, wxAt(S.t)); renderProbe(st, heat);
      var d = Math.floor(S.t / 24);
      if (chartsDirty || d !== lastDay) { if (chartsDirty) { buildCal(); drawMon(); } lastDay = d; chartsDirty = false; }
      drawCal(); drawDay();
      dirty = false; settle = 1;
    }
    if (settle > 0 || first) {
      var a = first ? 1 : 1 - Math.exp(-dt / 0.16), mx = 0, i;
      for (i = 0; i < N; i++) { var df = target[i] - shown[i]; shown[i] += df * a; if (df > mx) mx = df; else if (-df > mx) mx = -df; }
      var rd = Math.abs(rangeT.lo - range.lo) + Math.abs(rangeT.hi - range.hi);
      if (first || rangeT.step !== range.step && rd < 0.5) range.step = rangeT.step;
      range.lo += (rangeT.lo - range.lo) * a; range.hi += (rangeT.hi - range.hi) * a; range.c = rangeT.c;
      if (first) range.step = rangeT.step;
      if (scene3) scene3.paintHeat();
      var lk = S.layer + S.z + range.lo.toFixed(1) + range.hi.toFixed(1) + C['--div-mid'];
      if (lk !== legendKey) { renderLegend(); legendKey = lk; }
      settle = (mx > 0.004 || rd > 0.02) ? 1 : 0; first = false;
    }
    if (scene3) scene3.frame(dt, st, heat);
  }

  // ------------------------------------------------------------ 起動
  buildColors();
  recomputeGeometry();
  wx = wxCache[S.city] = M.generateWeather(S.city);
  sim = M.simulate(params(), wx, F11.mean, jet.m11);
  if (window.THREE) { scene3 = initScene(); if (scene3) { scene3.applyTheme(); scene3.rebuildPanels(); } }
  initUI();
  renderAnnual();
  requestAnimationFrame(tick);
  window.__twin = { S: S, setTime: function (t) { setTime(t); syncSliders(); } };
})();
