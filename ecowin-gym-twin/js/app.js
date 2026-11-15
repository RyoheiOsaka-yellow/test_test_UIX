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
    city: 'obs', insul: 'low', occupants: 80, sensible: 150, setHeat: 18, setCool: 27, opStart: 8, opEnd: 21,
    panels: 72, preheat: 1, field: true, layout: 'rows', price: 22, basic: 1100,
    mode: 'eco', layer: 'ot', z: 1.1, t: 0, playing: false, speed: 0.05,
    wind: true, rays: true, volume: true, section: false, people: true, probe: null, split: true
  };
  var wxCache = {}, wx, panels = [], F, F11, jet = {}, sim, dirty = true, chartsDirty = true;
  var target = [new Float32Array(N), new Float32Array(N)], shown = [new Float32Array(N), new Float32Array(N)], scratch = new Float32Array(N), first = true;
  var shownField = shown, sunI = 0;
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
  function getWx() {
    var k = S.city === 'obs' && !window.WX_OBS ? 3 : S.city;
    return wxCache[k] || (wxCache[k] = k === 'obs' ? M.weatherFromData(window.WX_OBS) : M.generateWeather(k));
  }
  function params() { return { insul: S.insul, occupants: S.occupants, sensible: S.sensible, setHeat: S.setHeat, setCool: S.setCool, opStart: S.opStart, opEnd: S.opEnd, panels: panels.length, preheat: S.preheat, price: S.price, basic: S.basic }; }
  function recomputeGeometry() {
    if (S.layout !== 'custom') panels = M.buildPanels(S.layout, S.panels);
    F11 = M.computeViewWeights(1.1, panels);
    F = S.z === 1.1 ? F11 : M.computeViewWeights(S.z, panels);
    jet.heat = M.computeJetPattern(S.z, true); jet.cool = M.computeJetPattern(S.z, false);
    jet.max = { heat: Math.max.apply(null, jet.heat), cool: Math.max.apply(null, jet.cool) };
    if (!jet.m11) jet.m11 = { heat: M.computeJetPattern(1.1, true).mean, cool: M.computeJetPattern(1.1, false).mean };
    if (scene3) scene3.rebuildPanels();
  }
  function recomputeSim() {
    wx = getWx();
    sim = M.simulate(params(), wx, F11.mean, jet.m11);
    dirty = true; chartsDirty = true;
    renderAnnual(); renderSource();
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
  function shownModes() { return S.split ? [S.mode === 'eco' ? 'ac' : S.mode, 'eco'] : [S.mode]; }
  function initScene() {
    var THREE = window.THREE, canvas = $('gl'), view = $('view');
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true }); }
    catch (e) { var f = document.createElement('div'); f.className = 'glfail'; f.textContent = 'この端末では3D表示を使えません。下の年間マップとグラフ、右の読み値はそのまま使えます。'; view.appendChild(f); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.3, 400);
    var ctl = new THREE.OrbitControls(cam, canvas);
    ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.maxPolarAngle = Math.PI * 0.495; ctl.minDistance = 4; ctl.maxDistance = 160;
    var W = G.W, D = G.D, H = G.H, cx = W / 2, cz = D / 2, vw = 1, vh = 1;
    var hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.95); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 0.35); sun.position.set(-30, 60, 40); scene.add(sun);

    // 表示領域（左右2分割のときは2つ。幅が狭いときは上下に分ける）
    function rects() {
      if (!S.split) return [{ x: 0, y: 0, w: vw, h: vh }];
      if (vw >= 640 && !S.section) { var hw = Math.floor(vw / 2); return [{ x: 0, y: 0, w: hw, h: vh }, { x: vw - hw, y: 0, w: hw, h: vh }]; }
      var hh = Math.floor(vh / 2); return [{ x: 0, y: 0, w: vw, h: hh }, { x: 0, y: vh - hh, w: vw, h: hh }];
    }

    function quad(pts, mat, uv) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], pts), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv || [0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      return new THREE.Mesh(g, mat);
    }
    // ---- 体育館の内部（写真をもとにした想定）----
    var A = { x0: G.ax0, y0: G.ay0, x1: G.ax1, y1: G.ay1 }, GZ = G.galleryZ, TIER = 5, STEP = 0.4;
    function tex(w, h, draw, rx, ry) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rx) t.repeat.set(rx, ry);
      t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
    }
    var rnd = (function (a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(11);
    // フローリング（寄木のパネル張り）
    var woodTex = tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#d7a04a'; c.fillRect(0, 0, w, h);
      for (var by = 0; by < 8; by++) for (var bx = 0; bx < 8; bx++) {
        var vert = (bx + by) % 2 === 0;
        for (var k = 0; k < 8; k++) {
          var l = 52 + rnd() * 16, hu = 34 + rnd() * 6;
          c.fillStyle = 'hsl(' + hu + ',' + (58 + rnd() * 10) + '%,' + l + '%)';
          if (vert) c.fillRect(bx * 128 + k * 16, by * 128, 15.4, 127.4); else c.fillRect(bx * 128, by * 128 + k * 16, 127.4, 15.4);
        }
      }
    }, (A.x1 - A.x0) / 6, (A.y1 - A.y0) / 6);
    var floorMat = new THREE.MeshPhongMaterial({ map: woodTex, shininess: 70, specular: 0x4a3a22 });
    var floor = quad([[A.x0, 0, A.y1], [A.x1, 0, A.y1], [A.x1, 0, A.y0], [A.x0, 0, A.y0]], floorMat); scene.add(floor);
    var ground = quad([[-80, -0.05, D + 80], [W + 80, -0.05, D + 80], [W + 80, -0.05, -80], [-80, -0.05, -80]], new THREE.MeshBasicMaterial({ color: 0x888888 })); scene.add(ground);
    var lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    var lp = [];
    function seg(x1, y1, x2, y2) { lp.push(x1, 0.03, y1, x2, 0.03, y2); }
    function rect(x1, y1, x2, y2) { seg(x1, y1, x2, y1); seg(x2, y1, x2, y2); seg(x2, y2, x1, y2); seg(x1, y2, x1, y1); }
    function circle(x, y, r) { for (var a = 0; a < 32; a++) { var t1 = a / 32 * 6.2832, t2 = (a + 1) / 32 * 6.2832; seg(x + r * Math.cos(t1), y + r * Math.sin(t1), x + r * Math.cos(t2), y + r * Math.sin(t2)); } }
    [14.5, 33.5].forEach(function (yc) { // バスケットボールコート 28m×15m を2面
      rect(14, yc - 7.5, 42, yc + 7.5); seg(28, yc - 7.5, 28, yc + 7.5); circle(28, yc, 1.8);
      rect(14, yc - 2.45, 19.8, yc + 2.45); rect(36.2, yc - 2.45, 42, yc + 2.45);
    });
    var courtLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), lineMat); scene.add(courtLines);

    // アリーナを囲む1階の壁（濃い灰色のルーバーと扉）と、観覧席の腰壁
    var louverTex = tex(512, 256, function (c, w, h) {
      c.fillStyle = '#4b4f55'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3a3d42'; for (var y = 6; y < h; y += 14) c.fillRect(0, y, w, 3);
      c.fillStyle = '#7c8088'; c.fillRect(196, 60, 120, 196); c.fillStyle = '#5c6068'; c.fillRect(254, 60, 4, 196); c.strokeStyle = '#2f3237'; c.lineWidth = 4; c.strokeRect(196, 60, 120, 196);
      c.fillStyle = '#35c26b'; c.fillRect(236, 40, 40, 14);
    });
    var louverMat = new THREE.MeshLambertMaterial({ map: louverTex }), bandMat = new THREE.MeshLambertMaterial({ color: 0xdcdedd });
    var stepMat = new THREE.MeshLambertMaterial({ color: 0x9a9c9e, side: THREE.DoubleSide }), railMat = new THREE.LineBasicMaterial({ color: 0x9aa0a6 });
    var gal = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group() };
    // 辺ごとの座標変換：a＝壁に沿った位置、d＝アリーナの縁から外向きの距離
    var SIDE = {
      N: { a0: 0, a1: W, w0: A.x0, w1: A.x1, P: function (a, d, z) { return [a, z, A.y0 - d]; }, flip: false },
      S: { a0: 0, a1: W, w0: A.x0, w1: A.x1, P: function (a, d, z) { return [a, z, A.y1 + d]; }, flip: true },
      W: { a0: A.y0, a1: A.y1, w0: A.y0, w1: A.y1, P: function (a, d, z) { return [A.x0 - d, z, a]; }, flip: true },
      E: { a0: A.y0, a1: A.y1, w0: A.y0, w1: A.y1, P: function (a, d, z) { return [A.x1 + d, z, a]; }, flip: false }
    };
    var railPts = [], seatGeo = new THREE.BoxGeometry(0.44, 0.46, 0.44), seatMat = new THREE.MeshLambertMaterial({ color: 0xd4d7da }), mtx = new THREE.Matrix4();
    Object.keys(SIDE).forEach(function (key) {
      var s = SIDE[key], g = gal[key], L = s.w1 - s.w0, seatPos = [];
      function face(a0, a1, d0, z0, d1, z1, mat, uv) { // アリーナ側（内向き）が表になる向きで張る
        var p = [s.P(a0, d0, z0), s.P(a1, d0, z0), s.P(a1, d1, z1), s.P(a0, d1, z1)];
        if (s.flip) { p = [p[1], p[0], p[3], p[2]]; if (uv) uv = [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]]; }
        g.add(quad(p, mat, uv));
      }
      face(s.w0, s.w1, 0, 0, 0, GZ, louverMat, [0, 0, L / 9, 0, L / 9, 1, 0, 1]);
      face(s.w0, s.w1, 0, GZ, 0, GZ + 0.9, bandMat);
      railPts.push.apply(railPts, s.P(s.w0, 0, GZ + 1.25).concat(s.P(s.w1, 0, GZ + 1.25)));
      for (var a = s.w0; a <= s.w1 + 0.01; a += L / Math.round(L / 2)) railPts.push.apply(railPts, s.P(a, 0, GZ + 0.9).concat(s.P(a, 0, GZ + 1.25)));
      for (var k = 0; k < TIER; k++) { // 段床と蹴上げ
        var z = GZ + 0.1 + k * STEP;
        g.add(quad([s.P(s.a0, k, z), s.P(s.a1, k, z), s.P(s.a1, k + 1, z), s.P(s.a0, k + 1, z)], stepMat));
        if (k) face(s.a0, s.a1, k, z - STEP, k, z, bandMat);
        if (k < TIER - 1) for (var q = s.a0 + 0.8; q < s.a1 - 0.6; q += 0.56) { if (Math.floor((q - s.a0) / 0.56) % 17 < 2) continue; seatPos.push(s.P(q, k + 0.55, z + 0.24)); }
      }
      var seats = new THREE.InstancedMesh(seatGeo, seatMat, seatPos.length);
      seatPos.forEach(function (sp, i) { mtx.makeTranslation(sp[0], sp[1], sp[2]); seats.setMatrixAt(i, mtx); });
      g.add(seats); scene.add(g);
    });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(railPts, 3)), railMat));

    // 外壁・屋根は内側の面だけ描く（外から見ると手前の壁が消え、中が見える）
    function inner() { return new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.BackSide }); }
    var wallMats = { N: inner(), S: inner(), E: inner(), W: inner() }, roofMat = inner();
    scene.add(quad([[W, 0, 0], [0, 0, 0], [0, H, 0], [W, H, 0]], wallMats.N));
    scene.add(quad([[0, 0, D], [W, 0, D], [W, H, D], [0, H, D]], wallMats.S));
    scene.add(quad([[W, 0, D], [W, 0, 0], [W, H, 0], [W, H, D]], wallMats.E));
    scene.add(quad([[0, 0, 0], [0, 0, D], [0, H, D], [0, H, 0]], wallMats.W));
    scene.add(quad([[0, H, 0], [0, H, D], [W, H, D], [W, H, 0]], roofMat));
    var winMat = new THREE.MeshLambertMaterial({ color: 0xb9d6ee, side: THREE.BackSide, emissive: 0x25313a }), mullPts = { N: [], S: [], E: [], W: [] }, mullObj = {};
    M.WINDOWS.forEach(function (w) {
      var e = 0.04, P = w.wall === 'N' ? function (a, z) { return [a, z, e]; } : w.wall === 'S' ? function (a, z) { return [a, z, D - e]; } : w.wall === 'W' ? function (a, z) { return [e, z, a]; } : function (a, z) { return [W - e, z, a]; };
      var rev = w.wall === 'N' || w.wall === 'E';
      scene.add(quad(rev ? [P(w.a2, w.z1), P(w.a1, w.z1), P(w.a1, w.z2), P(w.a2, w.z2)] : [P(w.a1, w.z1), P(w.a2, w.z1), P(w.a2, w.z2), P(w.a1, w.z2)], winMat));
      var mull = mullPts[w.wall];
      for (var i = 0; i <= 3; i++) { var a = w.a1 + (w.a2 - w.a1) * i / 3; mull.push.apply(mull, P(a, w.z1).concat(P(a, w.z2))); }
      var nz = Math.round((w.z2 - w.z1) / 1.05);
      for (var j = 0; j <= nz; j++) { var z = w.z1 + (w.z2 - w.z1) * j / nz; mull.push.apply(mull, P(w.a1, z).concat(P(w.a2, z))); }
    });
    var mullMat = new THREE.LineBasicMaterial({ color: 0x2b2f33 });
    Object.keys(mullPts).forEach(function (k) { mullObj[k] = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(mullPts[k], 3)), mullMat); scene.add(mullObj[k]); });
    var fp = [];
    function e3(a, b) { fp.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    [[0, 0], [W, 0], [W, D], [0, D]].forEach(function (p, i, arr) { var n = arr[(i + 1) % 4]; e3([p[0], 0, p[1]], [n[0], 0, n[1]]); e3([p[0], H, p[1]], [n[0], H, n[1]]); e3([p[0], 0, p[1]], [p[0], H, p[1]]); });
    var frameMat = new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.55 });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)), frameMat));

    // 天井の立体トラスと照明（視点が屋根より上にあるときは隠して、中を見やすくする）
    var roofGroup = new THREE.Group(), tp = [], MOD = 4, ZT = H - 0.25, ZB = H - 2.0, nxT = W / MOD, nyT = D / MOD, ix, iy;
    function t3(x1, y1, z1, x2, y2, z2) { tp.push(x1, z1, y1, x2, z2, y2); }
    for (iy = 0; iy <= nyT; iy++) for (ix = 0; ix <= nxT; ix++) {
      if (ix < nxT) t3(ix * MOD, iy * MOD, ZT, (ix + 1) * MOD, iy * MOD, ZT);
      if (iy < nyT) t3(ix * MOD, iy * MOD, ZT, ix * MOD, (iy + 1) * MOD, ZT);
    }
    for (iy = 0; iy < nyT; iy++) for (ix = 0; ix < nxT; ix++) {
      var bx = (ix + 0.5) * MOD, by = (iy + 0.5) * MOD;
      if (ix < nxT - 1) t3(bx, by, ZB, bx + MOD, by, ZB);
      if (iy < nyT - 1) t3(bx, by, ZB, bx, by + MOD, ZB);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (o) { t3(bx, by, ZB, (ix + o[0]) * MOD, (iy + o[1]) * MOD, ZT); });
    }
    roofGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)), new THREE.LineBasicMaterial({ color: 0xc9b062, transparent: true, opacity: 0.9 })));
    var lampGeo = new THREE.BoxGeometry(0.9, 0.14, 0.9), lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbea });
    for (iy = 0; iy < 5; iy++) for (ix = 0; ix < 6; ix++) { var lm = new THREE.Mesh(lampGeo, lampMat); lm.position.set(10 + ix * 7.2, ZB - 0.15, 8 + iy * 8); roofGroup.add(lm); }
    scene.add(roofGroup);

    // 既存の空調ダクトとノズル
    var ductMat = new THREE.MeshLambertMaterial({ color: 0xd9d0a9 }), nozMat = new THREE.MeshLambertMaterial({ color: 0xe9e9e6 });
    [6.5, D - 6.5].forEach(function (y) {
      var d = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, A.x1 - A.x0 + 2, 20), ductMat); d.rotation.z = Math.PI / 2; d.position.set(W / 2, 8.75, y + (y < D / 2 ? -0.5 : 0.5)); scene.add(d);
    });
    M.AC_UNITS.forEach(function (u) {
      var n = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.8, 14), nozMat); n.position.set(u.x, u.z0 + 0.15, u.y); n.rotation.x = -u.dir * 0.95; scene.add(n);
    });

    // 評価面（体感温度などの分布）。左右比較のために2枚ぶん持つ
    var painters = [makeFieldPainter(G.NX, G.NY, 4), makeFieldPainter(G.NX, G.NY, 4)];
    var heatTex = painters.map(function (p) { var t = new THREE.CanvasTexture(p.canvas); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });
    var heatMat = new THREE.MeshBasicMaterial({ map: heatTex[0], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    var heatPlane = quad([[A.x0, 0, A.y1], [A.x1, 0, A.y1], [A.x1, 0, A.y0], [A.x0, 0, A.y0]], heatMat); heatPlane.renderOrder = 2; scene.add(heatPlane);
    // 断面（南北方向・空調機の正面を通る面）
    var SX = 16, NZ = 25, secPainter = makeFieldPainter(G.NY, NZ, 4), secTex = new THREE.CanvasTexture(secPainter.canvas), secVals = new Float32Array(G.NY * NZ);
    secTex.minFilter = THREE.LinearFilter; secTex.generateMipmaps = false;
    var sec = quad([[SX, 0, A.y0], [SX, 0, A.y1], [SX, H, A.y1], [SX, H, A.y0]], new THREE.MeshBasicMaterial({ map: secTex, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
    sec.renderOrder = 3; sec.visible = false; scene.add(sec);

    // パネル（ドラッグで移動、ダブルクリックで向きを変える）
    var panelGroup = new THREE.Group(), panelMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
    var panelGeo = new THREE.BoxGeometry(M.PANEL.w, M.PANEL.h, 0.09), grabGeo = new THREE.BoxGeometry(M.PANEL.w + 0.3, M.PANEL.h + 0.2, 0.7);
    var grabMat = new THREE.MeshBasicMaterial({ visible: false });
    scene.add(panelGroup);
    function place(mesh, p) { mesh.position.set(p.x, M.PANEL.z0 + M.PANEL.h / 2, p.y); mesh.rotation.y = p.axis === 'x' ? Math.PI / 2 : 0; }
    function rebuildPanels() {
      while (panelGroup.children.length) panelGroup.remove(panelGroup.children[0]);
      panels.forEach(function (p, i) {
        var b = new THREE.Mesh(panelGeo, panelMat), g = new THREE.Mesh(grabGeo, grabMat); // g：つかみやすくするための見えない当たり判定
        b.add(g); g.userData.i = i; place(b, p); panelGroup.add(b);
      });
      initRays();
    }
    // 人（色は立っている場所の値で塗る。サーモグラフィのように見せる）
    var people = new THREE.Group(), persons = [], r = mul(7);
    function mul(a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; }
    var legGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.82, 8), bodyGeo = new THREE.CylinderGeometry(0.22, 0.15, 0.62, 10), headGeo = new THREE.SphereGeometry(0.13, 12, 10);
    for (var pi = 0; pi < 40; pi++) {
      var px = pi < 30 ? 15 + r() * 26 : 7 + r() * 2.5, py = pi < 30 ? (pi % 2 ? 8 + r() * 13 : 27 + r() * 13) : 9 + r() * 30;
      var pm = new THREE.MeshLambertMaterial({ color: 0x39424d }), fig = new THREE.Group();
      var leg = new THREE.Mesh(legGeo, pm); leg.position.y = 0.41; var body = new THREE.Mesh(bodyGeo, pm); body.position.y = 1.13; var head = new THREE.Mesh(headGeo, pm); head.position.y = 1.6;
      fig.add(leg); fig.add(body); fig.add(head); fig.position.set(px, 0, py); people.add(fig);
      persons.push({ mat: pm, k: Math.floor((py - A.y0) / G.cell) * G.NX + Math.floor((px - A.x0) / G.cell) });
    }
    scene.add(people);

    // やわらかい光の粒（粒ごとに大きさと濃さを持つ）。気流の煙と輻射の粒に使う
    var ptScale = { value: 400 };
    function softPoints(n, order) {
      var geo = new THREE.BufferGeometry(), a = { pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n) };
      geo.setAttribute('position', new THREE.BufferAttribute(a.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(a.col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(a.size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(a.alpha, 1));
      var mat = new THREE.ShaderMaterial({
        uniforms: { uScale: ptScale }, transparent: true, depthWrite: false,
        vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 color; uniform float uScale; varying vec3 vC; varying float vA;\nvoid main(){ vC = color; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(aSize * uScale / max(-mv.z, 0.5), 420.0); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vC; varying float vA;\nvoid main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC, a * a * vA); }'
      });
      var obj = new THREE.Points(geo, mat); obj.frustumCulled = false; obj.renderOrder = order;
      a.obj = obj; a.flush = function () { for (var k in geo.attributes) geo.attributes[k].needsUpdate = true; };
      return a;
    }

    // 気流：流れの向きを示す短い線と、吹出しの空気のかたまりを示す煙。方式ごとに1組
    function gs() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.9; }
    function makeWind(mode) {
      var NP = mode === 'eco' ? 520 : 1300, pos = new Float32Array(NP * 6), col = new Float32Array(NP * 6), ps = [], puff = softPoints(NP, 4);
      for (var i = 0; i < NP; i++) ps.push({ u: i % M.AC_UNITS.length, s: Math.random() * 30, lx: gs(), lz: gs(), life: Math.random() * 10 });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }));
      lines.frustumCulled = false; lines.renderOrder = 5;
      var obj = new THREE.Group(); obj.add(puff.obj); obj.add(lines); obj.visible = false; scene.add(obj);
      return {
        obj: obj, on: false,
        update: function (dt, st, heat) {
          var u0 = K.u0[mode] * st.fan; this.on = S.wind && u0 > 0.05; if (!this.on) return;
          var load = 0.35 + 0.65 * Math.abs(st.lf), hot = hex(heat ? '#f0642c' : '#2f8fea'), neu = hex(C['--ink-3']);
          for (var i = 0; i < NP; i++) {
            var p = ps[i], o = i * 6, e = Math.exp(-(p.lx * p.lx + p.lz * p.lz)), vl = u0 * Math.min(1, 3.5 / p.s) * e;
            p.s += Math.max(vl, 0.05) * dt; p.life -= dt;
            if (p.life < 0 || p.s > D - 14 || vl < 0.07) { p.s = 0.3 + Math.random() * 1.2; p.lx = gs(); p.lz = gs(); p.life = 6 + Math.random() * 10; vl = u0 * e; }
            var un = M.AC_UNITS[p.u], tail = M.clamp(vl * 0.45, 0.12, 1.5);
            for (var q = 0; q < 2; q++) {
              var s = Math.max(0.2, p.s - q * tail), b = 0.35 + 0.11 * s;
              pos[o + q * 3] = M.clamp(un.x + p.lx * b * 0.8, A.x0 + 0.2, A.x1 - 0.2);
              pos[o + q * 3 + 1] = M.clamp(M.jetAxisZ(s, heat, un.z0) + p.lz * b * 0.8, 0.12, H - 0.15);
              pos[o + q * 3 + 2] = un.y + un.dir * s;
            }
            var f = M.clamp(p.s / 24, 0, 1), j = i * 3;
            for (var k = 0; k < 3; k++) { var c = (hot[k] + (neu[k] - hot[k]) * f) / 255; col[o + k] = c; col[o + 3 + k] = c; puff.col[j + k] = (hot[k] + (neu[k] - hot[k]) * f * 0.6) / 255; }
            puff.pos[j] = pos[o]; puff.pos[j + 1] = pos[o + 1]; puff.pos[j + 2] = pos[o + 2];
            puff.size[i] = 0.9 + 0.2 * p.s; // 噴流は進むほど広がる
            puff.alpha[i] = i % 2 ? 0 : 0.2 * load * (1 - f) * Math.min(1, p.s / 1.5);
          }
          geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; puff.flush();
        }
      };
    }
    var winds = { ac: makeWind('ac'), eco: makeWind('eco') };

    // 輻射の粒（暖房：パネルから外へ／冷房：パネルへ向かって）
    var NR = 1800, ray3 = softPoints(NR, 6), rays = ray3.obj, rp = [], raysOn = false, RMAX = 6;
    rays.visible = false; scene.add(rays);
    function initRays() {
      rp = [];
      for (var i = 0; i < NR; i++) rp.push({ p: panels.length ? i % panels.length : 0, side: i % 2 ? 1 : -1, a: Math.random() - 0.5, h: Math.random(), dl: gs() * 0.7, dv: gs() * 0.45, r: Math.random() * RMAX });
    }
    function updateRays(dt, st, heat) {
      var d = Math.abs(st.Tp - st.Ta); raysOn = S.rays && panels.length > 0 && d > 2; if (!raysOn) return;
      var hot = hex(heat ? '#ff8a3d' : '#59b6ff'), sp = (heat ? 1 : -1) * 2.0 * dt, act = M.clamp(d / 25, 0.15, 1) * NR;
      for (var i = 0; i < NR; i++) {
        var q = rp[i], o = i * 3;
        if (i > act) { ray3.alpha[i] = 0; continue; }
        q.r += sp;
        if (q.r > RMAX) q.r = 0.05; else if (q.r < 0.05) q.r = RMAX;
        var P = panels[q.p], nx = q.r * q.side, lat = q.a * M.PANEL.w + q.dl * q.r, hz = M.PANEL.z0 + q.h * M.PANEL.h + q.dv * q.r;
        var x = P.axis === 'y' ? P.x + lat : P.x + nx, y = P.axis === 'y' ? P.y + nx : P.y + lat;
        if (x < A.x0 + 0.1 || x > A.x1 - 0.1 || y < A.y0 + 0.1 || y > A.y1 - 0.1 || hz < 0.05 || hz > H - 0.1) { ray3.alpha[i] = 0; continue; }
        ray3.pos[o] = x; ray3.pos[o + 1] = hz; ray3.pos[o + 2] = y;
        var f = q.r / RMAX;
        ray3.size[i] = 0.22 + 0.5 * f; ray3.alpha[i] = 0.85 * Math.pow(1 - f, 1.3);
        for (var k = 0; k < 3; k++) ray3.col[o + k] = hot[k] / 255;
      }
      ray3.flush();
    }

    // 空気の層：館内の空気温度を立体の格子に入れ、視線に沿って重ねて描く（WebGL2 が使える端末のみ）
    var VX = 46, VY = 38, VZ = 25, volOK = renderer.capabilities.isWebGL2 && !!THREE.DataTexture3D, volTex = [], volData = [], volRange = [{ lo: 0, hi: 1 }, { lo: 0, hi: 1 }], volMesh = null, volDirty = true, volT = 0;
    var lutData = new Uint8Array(512 * 4), lutTex = new THREE.DataTexture(lutData, 512, 1, THREE.RGBAFormat);
    lutTex.minFilter = lutTex.magFilter = THREE.LinearFilter;
    if (volOK) {
      for (var vi = 0; vi < 2; vi++) {
        volData.push(new Uint8Array(VX * VY * VZ));
        var t3d = new THREE.DataTexture3D(volData[vi], VX, VY, VZ);
        t3d.format = THREE.RedFormat; t3d.type = THREE.UnsignedByteType; t3d.minFilter = t3d.magFilter = THREE.LinearFilter; t3d.unpackAlignment = 1; t3d.needsUpdate = true;
        volTex.push(t3d);
      }
      var volMat = new THREE.ShaderMaterial({
        uniforms: { map: { value: volTex[0] }, lut: { value: lutTex }, bmin: { value: new THREE.Vector3(A.x0, 0, A.y0) }, bmax: { value: new THREE.Vector3(A.x1, H, A.y1) }, uRef: { value: 0.5 }, uSpan: { value: 0.3 }, uDens: { value: 0.032 } },
        transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
        vertexShader: 'varying vec3 vW;\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'precision highp float; precision highp sampler3D;',
          'uniform sampler3D map; uniform sampler2D lut; uniform vec3 bmin; uniform vec3 bmax; uniform float uRef; uniform float uSpan; uniform float uDens;',
          'varying vec3 vW;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main(){',
          '  vec3 ro = cameraPosition; vec3 rd = normalize(vW - ro); vec3 inv = 1.0 / (rd + vec3(1e-6));',
          '  vec3 t0 = (bmin - ro) * inv; vec3 t1 = (bmax - ro) * inv; vec3 tn3 = min(t0, t1); vec3 tf3 = max(t0, t1);',
          '  float tn = max(max(tn3.x, tn3.y), max(tn3.z, 0.0)); float tf = min(tf3.x, min(tf3.y, tf3.z));',
          '  if (tf <= tn) discard;',
          '  float dt = (tf - tn) / 44.0; float t = tn + dt * hash(gl_FragCoord.xy); vec4 acc = vec4(0.0);',
          '  for (int i = 0; i < 44; i++) {',
          '    vec3 u = (ro + rd * t - bmin) / (bmax - bmin);',
          '    float v = texture(map, vec3(u.x, u.z, u.y)).r;',
          '    float a = smoothstep(0.28, 1.15, abs(v - uRef) / uSpan) * uDens * dt;',
          '    vec3 c = texture2D(lut, vec2(clamp(0.5 + (v - uRef) / uSpan * 0.3, 0.02, 0.98), 0.5)).rgb;',
          '    acc.rgb += (1.0 - acc.a) * a * c; acc.a += (1.0 - acc.a) * a;',
          '    if (acc.a > 0.62) break; t += dt;',
          '  }',
          '  gl_FragColor = vec4(acc.rgb / max(acc.a, 1e-4), min(acc.a, 0.6));',
          '}'].join('\n')
      });
      volMesh = new THREE.Mesh(new THREE.BoxGeometry(A.x1 - A.x0, H, A.y1 - A.y0), volMat);
      volMesh.position.set((A.x0 + A.x1) / 2, H / 2, (A.y0 + A.y1) / 2); volMesh.renderOrder = 7; volMesh.frustumCulled = false; volMesh.visible = false; scene.add(volMesh);
    }
    // 噴流の形は変わらないので、立体格子の相対風速は暖房・冷房ごとに1回だけ求めておく
    var volJet = {};
    function volPattern(heat) {
      var key = heat ? 'h' : 'c'; if (volJet[key]) return volJet[key];
      var out = new Float32Array(VX * VY * VZ), i = 0, cxv = (A.x1 - A.x0) / VX, cyv = (A.y1 - A.y0) / VY, czv = H / VZ;
      for (var z = 0; z < VZ; z++) for (var y = 0; y < VY; y++) for (var x = 0; x < VX; x++, i++) out[i] = M.jetNorm(A.x0 + (x + 0.5) * cxv, A.y0 + (y + 0.5) * cyv, (z + 0.5) * czv, heat);
      return (volJet[key] = out);
    }
    function updateVolume(slot, mode, st, heat) {
      var d = volData[slot], lo = range.lo, hi = range.hi, jn = volPattern(heat), i = 0, czv = H / VZ, n2 = VX * VY;
      if (S.layer === 'wind' || S.layer === 'wbgt') { lo = st.Ta - 8; hi = st.Ta + 8; }
      var sc = 255 / (hi - lo), dT = mode === 'none' ? 0 : K.dTs[mode][heat ? 'heat' : 'cool'] * (0.3 + 0.7 * Math.abs(st.lf)) * st.fan * 0.6;
      for (var z = 0; z < VZ; z++) {
        var base = (st.Ta + st.G * ((z + 0.5) * czv - G.zRef) - lo) * sc, k = dT * sc;
        for (var q = 0; q < n2; q++, i++) { var v = base + k * jn[i]; d[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
      }
      volRange[slot] = { lo: lo, hi: hi }; volTex[slot].needsUpdate = true;
    }

    // 地点の読み取りと、パネルのドラッグ
    var probeMark = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    probeMark.add(pole); probeMark.add(ball); probeMark.visible = false; scene.add(probeMark);
    var ray = new THREE.Raycaster(), down = null, drag = null, plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitV = new THREE.Vector3();
    function aim(e) { // ポインタのある表示領域から視線を作る。領域の番号を返す
      var b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top, rs = rects();
      for (var i = 0; i < rs.length; i++) {
        var q = rs[i];
        if (px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h) { ray.setFromCamera({ x: (px - q.x) / q.w * 2 - 1, y: -((py - q.y) / q.h * 2 - 1) }, cam); return i; }
      }
      return -1;
    }
    function pickPanel(e) {
      var vi = aim(e); if (vi < 0 || shownModes()[vi] !== 'eco') return -1;
      panelGroup.visible = true; panelGroup.updateMatrixWorld(true);
      var hit = ray.intersectObjects(panelGroup.children, true)[0];
      if (!hit) return -1;
      hitV.copy(hit.point);
      return hit.object.userData.i !== undefined ? hit.object.userData.i : panelGroup.children.indexOf(hit.object);
    }
    function movePanel(i, np) {
      var old = panels[i];
      M.movePanelWeights(F, old, np); if (F11 !== F) M.movePanelWeights(F11, old, np);
      panels[i] = np; place(panelGroup.children[i], np);
    }
    canvas.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY }; fly = null;
      var i = pickPanel(e);
      if (i >= 0) {
        ctl.enabled = false; plane.constant = -hitV.y;
        drag = { i: i, ox: panels[i].x - hitV.x, oy: panels[i].y - hitV.z, moved: false };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 対応していない環境ではそのまま続ける */ }
        canvas.style.cursor = 'grabbing';
      }
    }, true);
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) { canvas.style.cursor = e.buttons ? '' : (pickPanel(e) >= 0 ? 'move' : ''); return; }
      if (aim(e) < 0 || !ray.ray.intersectPlane(plane, hitV)) return;
      var p = panels[drag.i], x = M.clamp(Math.round((hitV.x + drag.ox) * 10) / 10, A.x0 + 0.6, A.x1 - 0.6), y = M.clamp(Math.round((hitV.z + drag.oy) * 10) / 10, A.y0 + 0.6, A.y1 - 0.6);
      if (x === p.x && y === p.y) return;
      movePanel(drag.i, { axis: p.axis, x: x, y: y }); drag.moved = true; panelsEdited(false);
    });
    function endDrag() { if (!drag) return; ctl.enabled = true; canvas.style.cursor = ''; if (drag.moved) panelsEdited(true); drag = null; }
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerup', function (e) {
      if (drag) { var mv = drag.moved; endDrag(); if (mv) return; }
      if (!down || Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) return;
      if (pickPanel(e) >= 0) return;
      var vi = aim(e); plane.constant = 0;
      var ok = vi >= 0 && ray.ray.intersectPlane(plane, hitV) && hitV.x > A.x0 + 0.3 && hitV.x < A.x1 - 0.3 && hitV.z > A.y0 + 0.3 && hitV.z < A.y1 - 0.3;
      S.probe = ok ? { x: hitV.x, y: hitV.z, view: vi } : null;
      dirty = true;
    });
    canvas.addEventListener('dblclick', function (e) {
      var i = pickPanel(e); if (i < 0) return;
      var p = panels[i]; movePanel(i, { axis: p.axis === 'y' ? 'x' : 'y', x: p.x, y: p.y }); S.probe = null; panelsEdited(true);
    });

    // カメラ
    var CAMS = {
      iso: { p: [-9, 37, D + 23], t: [cx, 1.0, cz - 1] }, top: { p: [cx, 96, cz + 0.02], t: [cx, 0, cz] },
      eye: { p: [1.6, 6.8, cz - 7], t: [cx + 12, 2.2, cz - 2] }, side: { p: [-50, 8, cz], t: [SX, 5.6, cz] }
    }, fly = null;
    function setCam(name, instant) {
      var c = CAMS[name];
      if (name === 'side') { // 断面の全幅が収まる距離まで下がる
        var th = Math.tan(cam.fov * Math.PI / 360), dist = Math.max(15 / (2 * th), (A.y1 - A.y0 + 6) / (2 * th * cam.aspect));
        c = { p: [SX - dist, 6.4, cz], t: [SX, 6.0, cz] };
      }
      if (instant) { cam.position.set(c.p[0], c.p[1], c.p[2]); ctl.target.set(c.t[0], c.t[1], c.t[2]); ctl.update(); return; }
      fly = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: new THREE.Vector3(c.p[0], c.p[1], c.p[2]), t1: new THREE.Vector3(c.t[0], c.t[1], c.t[2]), a: 0 };
    }
    setCam('iso', true);
    canvas.addEventListener('wheel', function () { fly = null; }, { passive: true });

    function resize() {
      var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
      vw = w; vh = h; renderer.setSize(w, h, false);
      var q = rects()[0]; cam.aspect = q.w / q.h; cam.fov = q.w < 520 ? 52 : 38; cam.updateProjectionMatrix();
      layoutHud(rects(), vw, vh);
    }
    new ResizeObserver(resize).observe(view); resize();

    var tmpV = new THREE.Vector3();
    function tint(mat, base, T, on) {
      var c = on ? colorAt(LUT.temp, T, range.lo, range.hi) : base, f = on ? 0.62 : 0;
      mat.color.setRGB((base[0] + (c[0] - base[0]) * f) / 255, (base[1] + (c[1] - base[1]) * f) / 255, (base[2] + (c[2] - base[2]) * f) / 255);
    }
    return {
      rebuildPanels: rebuildPanels, setCam: setCam, resize: resize, canvas: canvas, rects: rects, volOK: volOK,
      markVolume: function () { volDirty = true; },
      applyTheme: function () {
        renderer.setClearColor(new THREE.Color(C['--scene']), 1);
        ground.material.color.set(C['--scene']);
        lineMat.color.set(C['--surface']); frameMat.color.set(C['--ink-3']);
        pole.material.color.set(C['--ink']);
        for (var i = 0; i < 512; i++) { lutData[i * 4] = LUT.temp[i * 3]; lutData[i * 4 + 1] = LUT.temp[i * 3 + 1]; lutData[i * 4 + 2] = LUT.temp[i * 3 + 2]; lutData[i * 4 + 3] = 255; }
        lutTex.needsUpdate = true;
      },
      paintHeat: function (slot, vals) {
        painters[slot].paint(vals, lutFor(S.layer), range.lo, range.hi, range.step, hex(C['--ink']));
        heatTex[slot].needsUpdate = true;
      },
      // views: [{ mode, st }]（1つ、または左右比較の2つ）
      frame: function (dt, views, heat) {
        if (fly) {
          fly.a = Math.min(1, fly.a + dt / 0.9); var e = fly.a * fly.a * (3 - 2 * fly.a);
          cam.position.lerpVectors(fly.p0, fly.p1, e); ctl.target.lerpVectors(fly.t0, fly.t1, e); if (fly.a >= 1) fly = null;
        }
        ctl.update();
        heatPlane.visible = S.field; heatPlane.position.y = S.z + 0.01; courtLines.position.y = S.field ? S.z + 0.02 : 0;
        roofGroup.visible = cam.position.y < H - 0.6; gal.W.visible = !S.section;
        mullObj.N.visible = cam.position.z > 0; mullObj.S.visible = cam.position.z < D; mullObj.E.visible = cam.position.x < W; mullObj.W.visible = cam.position.x > 0;
        people.visible = S.people; sec.visible = S.section;
        var day = M.clamp(sunI / 700, 0, 1); hemi.intensity = 0.78 + 0.2 * day; sun.intensity = 0.12 + 0.3 * day; winMat.emissive.setRGB(0.05 + 0.2 * day, 0.07 + 0.22 * day, 0.09 + 0.24 * day);
        var useVol = volOK && S.volume; volT += dt;
        if (useVol && volDirty && volT > 0.14) { views.forEach(function (v, i) { updateVolume(i, v.mode, v.st, heat); }); volDirty = false; volT = 0; }
        var rs = rects(), tl = S.layer !== 'wind' && S.layer !== 'wbgt', wb = hex(C['--surface-2']), eco = null;
        views.forEach(function (v) { if (winds[v.mode]) winds[v.mode].update(dt, v.st, heat); if (v.mode === 'eco') eco = v; });
        if (eco) updateRays(dt, eco.st, heat);
        if (S.probe) {
          probeMark.visible = true; probeMark.position.set(S.probe.x, 0, S.probe.y);
          pole.scale.y = S.z + 0.3; pole.position.y = (S.z + 0.3) / 2; ball.position.y = S.z + 0.3;
        } else probeMark.visible = false;
        renderer.setScissorTest(true);
        views.forEach(function (v, i) {
          var q = rs[i], st = v.st, m = v.mode;
          heatMat.map = heatTex[i];
          tint(wallMats.N, wb, 0.8 * st.Twall + 0.2 * st.Twin, tl); tint(wallMats.S, wb, 0.8 * st.Twall + 0.2 * st.Twin, tl);
          tint(wallMats.E, wb, st.Twall, tl); tint(wallMats.W, wb, st.Twall, tl); tint(roofMat, wb, st.Tri, tl);
          tint(winMat, [156, 196, 230], st.Twin, tl);
          panelGroup.visible = m === 'eco';
          winds.ac.obj.visible = m === 'ac' && winds.ac.on; winds.eco.obj.visible = m === 'eco' && winds.eco.on; rays.visible = m === 'eco' && raysOn;
          if (m === 'eco') { var pc = colorAt(LUT.temp, st.Tp, range.lo, range.hi); panelMat.color.setRGB(pc[0] / 255, pc[1] / 255, pc[2] / 255); panelMat.emissive.setRGB(pc[0] / 600, pc[1] / 600, pc[2] / 600); }
          if (S.section) {
            for (var j = 0; j < NZ; j++) for (var k = 0; k < G.NY; k++) {
              var a = M.airAt(SX, M.gy(k), (NZ - 1 - j + 0.5) * (H / NZ), m, st, heat);
              secVals[j * G.NY + k] = S.layer === 'wind' ? a.v : a.T;
            }
            var wl = S.layer === 'wind', lo = wl ? 0 : S.layer === 'wbgt' ? st.Ta - 8 : range.lo, hi = wl ? 2.5 : S.layer === 'wbgt' ? st.Ta + 8 : range.hi;
            secPainter.paint(secVals, wl ? LUT.wind : LUT.temp, lo, hi, wl ? 0.25 : range.step, hex(C['--ink']));
            secTex.needsUpdate = true;
          }
          ptScale.value = q.h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
          if (volMesh) {
            volMesh.visible = useVol;
            if (useVol) { var vr = volRange[i], vu = volMesh.material.uniforms; vu.map.value = volTex[i]; vu.uRef.value = (st.Ta - vr.lo) / (vr.hi - vr.lo); vu.uSpan.value = 5.5 / (vr.hi - vr.lo); }
          }
          var plut = lutFor(S.layer), sh = shownField[i];
          if (S.people) persons.forEach(function (pp) { if (S.field) { var pc2 = colorAt(plut, sh[pp.k], range.lo, range.hi); pp.mat.color.setRGB(pc2[0] / 255, pc2[1] / 255, pc2[2] / 255); } else pp.mat.color.setHex(0x39424d); });
          renderer.setViewport(q.x, vh - q.y - q.h, q.w, q.h); renderer.setScissor(q.x, vh - q.y - q.h, q.w, q.h);
          renderer.render(scene, cam);
        });
        var pe = $('probe');
        if (S.probe) {
          var pr = rs[Math.min(S.probe.view || 0, rs.length - 1)];
          tmpV.set(S.probe.x, S.z + 0.5, S.probe.y).project(cam);
          pe.style.left = (pr.x + (tmpV.x + 1) / 2 * pr.w) + 'px'; pe.style.top = (pr.y + (1 - tmpV.y) / 2 * pr.h) + 'px';
          pe.hidden = tmpV.z > 1;
        } else pe.hidden = true;
      }
    };
  }
  // 方式名の札と、左右比較の境界線の位置
  function layoutHud(rs, vw, vh) {
    var ms = shownModes(), div = $('divider');
    [0, 1].forEach(function (i) {
      var t = $('tag' + i);
      if (i >= rs.length) { t.hidden = true; return; }
      t.hidden = false; t.style.left = (rs[i].x + rs[i].w - 12) + 'px'; t.style.top = (rs[i].y + 10) + 'px';
      t.innerHTML = '<i style="background:var(--m-' + ms[i] + ')"></i><span>' + MODE_NAME[ms[i]] + '</span>';
    });
    div.hidden = rs.length < 2;
    if (rs.length > 1) {
      var side = rs[1].x > 0;
      div.style.left = side ? rs[1].x + 'px' : '0'; div.style.top = side ? '0' : rs[1].y + 'px';
      div.style.width = side ? '2px' : '100%'; div.style.height = side ? '100%' : '2px';
    }
    $('hint').hidden = rs.length > 1;
  }
  function panelsEdited(final) {
    if (S.layout !== 'custom') {
      S.layout = 'custom'; var sel = $('layout');
      if (!sel.querySelector('[value=custom]')) { var o = document.createElement('option'); o.value = 'custom'; o.textContent = '自由配置（ドラッグで変更）'; sel.appendChild(o); }
      sel.value = 'custom';
    }
    dirty = true;
    if (final) recomputeSim();
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
    lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1); var stp = hi - lo > 24 ? 10 : hi - lo > 9 ? 5 : 2;
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
    var f = fit($('mon')), c = f.c; if (f.w < 40) return;
    var L = 26, T = 6, B = 15, w = f.w - L - 2, h = f.h - T - B, a = sim.summary.modes.ac.monthly, e = sim.summary.modes.eco.monthly;
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
    $('clockW').textContent = (wx.city.short || wx.city.name) + '　' + SKY[w.sky] + '　外気 ' + f1(w.T) + '℃　' + (heat ? '暖房期' : '冷房期');
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
  function renderProbe(sts, heat) {
    if (!S.probe) return;
    var i = M.clamp(Math.floor((S.probe.x - G.ax0) / G.cell), 0, G.NX - 1), j = M.clamp(Math.floor((S.probe.y - G.ay0) / G.cell), 0, G.NY - 1), k = j * G.NX + i;
    var ms = shownModes(), rows = [['体感', 'ot', 1, '℃'], ['空気', 'ta', 1, '℃'], ['放射', 'mrt', 1, '℃'], ['風速', 'wind', 2, 'm/s'], ['WBGT', 'wbgt', 1, '']];
    var vals = ms.map(function (m) { var v = {}; rows.forEach(function (r) { M.computeField(r[1], m, sts[m], heat, S.z, F, heat ? jet.heat : jet.cool, scratch); v[r[1]] = scratch[k]; }); return v; });
    var h = '<table>' + (ms.length > 1 ? '<tr><td></td>' + ms.map(function (m) { return '<td>' + (m === 'eco' ? 'ecowin' : m === 'ac' ? 'エアコン' : MODE_NAME[m]) + '</td>'; }).join('') + '</tr>' : '');
    rows.forEach(function (r, ri) { h += '<tr><td>' + r[0] + '</td>' + vals.map(function (v) { var t = v[r[1]].toFixed(r[2]) + r[3]; return '<td>' + (ri === 0 ? '<b>' + t + '</b>' : t) + '</td>'; }).join('') + '</tr>'; });
    $('probe').innerHTML = h + '</table>';
  }
  function renderSource() {
    var ob = !!wx.observed;
    $('wxBadge').textContent = ob ? '気象：練馬アメダス 2025年の観測値' : '気象：平年値からの合成（ダミー）';
    $('annT').textContent = ob ? '年間の推計（練馬・2025年の観測気象）' : '年間の推計（' + wx.city.name + '・合成気象）';
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
  function refreshMode() { if (scene3) scene3.resize(); }

  function initUI() {
    if (window.WX_OBS) { var oo = document.createElement('option'); oo.value = 'obs'; oo.textContent = '東京都練馬区（2025年の観測値）'; $('city').appendChild(oo); } else S.city = 3;
    M.CITIES.forEach(function (c, i) { var o = document.createElement('option'); o.value = i; o.textContent = c.name + '（合成気象）'; $('city').appendChild(o); });
    Object.keys(M.INSUL).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = M.INSUL[k].label; $('insul').appendChild(o); });
    function outs() { $('occOut').textContent = S.occupants + '人'; $('panelsOut').textContent = S.panels + '台'; }
    function syncInputs() { // 状態を入力欄へ反映する
      $('city').value = S.city; $('insul').value = S.insul; $('occ').value = S.occupants; $('act').value = S.sensible;
      $('setHeat').value = S.setHeat; $('setCool').value = S.setCool; $('opStart').value = S.opStart; $('opEnd').value = S.opEnd;
      $('panels').value = S.panels; $('price').value = S.price; $('basic').value = S.basic; $('preheat').value = S.preheat;
      if (S.layout === 'custom' && !$('layout').querySelector('[value=custom]')) { var o = document.createElement('option'); o.value = 'custom'; o.textContent = '自由配置（ドラッグで変更）'; $('layout').appendChild(o); }
      $('layout').value = S.layout;
      $('ckWind').checked = S.wind; $('ckRays').checked = S.rays; $('ckSection').checked = S.section; $('ckPeople').checked = S.people; $('ckField').checked = S.field; $('ckVolume').checked = S.volume; $('speed').value = String(S.speed);
      press('modeSeg', S.mode); press('layerSeg', S.layer); press('zSeg', S.z); outs();
    }
    syncInputs();
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
    num('opStart', 'opStart', 5, 12); num('opEnd', 'opEnd', 14, 23);
    $('panels').addEventListener('input', function () { S.panels = parseInt($('panels').value, 10); outs(); if (S.layout === 'custom') { S.layout = 'rows'; $('layout').value = 'rows'; } later(recomputeAll); });
    num('price', 'price', 5, 60); num('basic', 'basic', 0, 3000); num('act', 'sensible', 50, 300);
    $('city').addEventListener('change', function () { var v = $('city').value; S.city = v === 'obs' ? 'obs' : parseInt(v, 10); recomputeSim(); jumpsReady = false; });
    $('insul').addEventListener('change', function () { S.insul = $('insul').value; recomputeSim(); });
    $('preheat').addEventListener('change', function () { S.preheat = parseInt($('preheat').value, 10); recomputeSim(); });
    $('layout').addEventListener('change', function () { S.layout = $('layout').value; if (S.layout !== 'custom') recomputeAll(); });
    [['ckWind', 'wind'], ['ckRays', 'rays'], ['ckSection', 'section'], ['ckPeople', 'people'], ['ckField', 'field'], ['ckVolume', 'volume']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { S[p[1]] = $(p[0]).checked; if (p[1] === 'section' && scene3) { scene3.resize(); scene3.setCam(S.section ? 'side' : 'iso'); } dirty = true; });
    });
    $('cams').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && b.dataset.v && scene3) scene3.setCam(b.dataset.v); });
    function setSplit(v) { S.split = v; $('split').setAttribute('aria-pressed', String(v)); S.probe = null; first = true; dirty = true; if (scene3) scene3.resize(); }
    $('split').addEventListener('click', function () { setSplit(!S.split); });
    setSplit(window.innerWidth >= 900);
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

    // 配置と条件の保存・読込（このブラウザの中に保存する）
    var KEYS = ['city', 'insul', 'occupants', 'sensible', 'setHeat', 'setCool', 'opStart', 'opEnd', 'panels', 'preheat', 'layout', 'price', 'basic', 'mode', 'layer', 'z', 't', 'wind', 'rays', 'section', 'people', 'field', 'split', 'volume', 'speed'];
    function say(t) { var e = $('saveMsg'); e.textContent = t; clearTimeout(say.t); say.t = setTimeout(function () { e.textContent = ''; }, 4000); }
    $('saveScene').addEventListener('click', function () {
      var o = { v: 3 }; KEYS.forEach(function (k) { o[k] = S[k]; });
      o.panelList = panels;
      try { localStorage.setItem('ecowin-gym-scene', JSON.stringify(o)); say('保存しました'); } catch (e) { say('このブラウザでは保存できません'); }
    });
    $('loadScene').addEventListener('click', function () {
      var o = null; try { o = JSON.parse(localStorage.getItem('ecowin-gym-scene')); } catch (e) { o = null; }
      if (!o || o.v !== 3) { say('保存した配置がありません'); return; }
      KEYS.forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
      if (S.city === 'obs' && !window.WX_OBS) S.city = 3;
      if (S.layout === 'custom' && Array.isArray(o.panelList)) panels = o.panelList.map(function (q) { return { axis: q.axis === 'x' ? 'x' : 'y', x: +q.x, y: +q.y }; });
      S.probe = null; syncInputs(); $('split').setAttribute('aria-pressed', String(S.split)); $('play').textContent = '▶ 再生'; S.playing = false;
      recomputeAll(); jumpsReady = false; first = true; syncSliders(); if (scene3) scene3.resize(); say('読み込みました');
    });
    // いまの表示を1枚の画像にする
    $('shot').addEventListener('click', function () {
      if (!scene3) { say('3D表示が使えないため画像にできません'); return; }
      var gl = scene3.canvas, sc = gl.width / gl.clientWidth, head = Math.round(64 * sc), foot = Math.round(58 * sc), pad = Math.round(16 * sc);
      var cv = document.createElement('canvas'); cv.width = gl.width; cv.height = gl.height + head + foot;
      var c = cv.getContext('2d'), d = Math.floor(S.t / 24), w = wxAt(S.t), ms = shownModes(), rs = scene3.rects(), ff = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';
      c.fillStyle = C['--surface']; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(gl, 0, head);
      c.fillStyle = C['--ink']; c.textBaseline = 'middle'; c.font = '700 ' + Math.round(18 * sc) + 'px ' + ff;
      c.fillText('体育館デジタルツイン　ecowinハイブリッド 設置効果の推計', pad, head * 0.34);
      c.font = Math.round(13 * sc) + 'px ' + ff; c.fillStyle = C['--ink-2'];
      c.fillText(wx.city.name + '　' + fmtDate(d) + ' ' + fmtHour(S.t - d * 24) + '　' + SKY[w.sky] + '　外気 ' + f1(w.T) + '℃　断熱：' + M.INSUL[S.insul].label + '　' + S.occupants + '人　パネル ' + panels.length + '台', pad, head * 0.74);
      ms.forEach(function (m, i) { // 方式名の札
        var q = rs[i], t = MODE_NAME[m]; c.font = '700 ' + Math.round(14 * sc) + 'px ' + ff;
        var tw = c.measureText(t).width + 34 * sc, x = (q.x + q.w) * sc - tw - 12 * sc, y = head + (q.y + 10) * sc, hh = 26 * sc;
        c.fillStyle = C['--surface']; c.fillRect(x, y, tw, hh); c.fillStyle = C['--m-' + m]; c.beginPath(); c.arc(x + 13 * sc, y + hh / 2, 5 * sc, 0, 6.2832); c.fill();
        c.fillStyle = C['--ink']; c.fillText(t, x + 24 * sc, y + hh / 2);
      });
      if (rs.length > 1) { c.fillStyle = C['--surface']; if (rs[1].x > 0) c.fillRect(rs[1].x * sc - sc, head, 2 * sc, gl.height); else c.fillRect(0, head + rs[1].y * sc - sc, cv.width, 2 * sc); }
      var y0 = head + gl.height, lw = Math.min(cv.width - pad * 2, 420 * sc), lut = lutFor(S.layer), L = LAYER[S.layer];
      c.font = Math.round(12 * sc) + 'px ' + ff; c.fillStyle = C['--ink-2'];
      c.fillText(L.name + '（' + L.unit + '）　高さ ' + S.z + 'm', pad, y0 + foot * 0.2);
      for (var x2 = 0; x2 < lw; x2++) { var li = Math.round(x2 / (lw - 1) * 511) * 3; c.fillStyle = 'rgb(' + lut[li] + ',' + lut[li + 1] + ',' + lut[li + 2] + ')'; c.fillRect(pad + x2, y0 + foot * 0.38, 1.5, 10 * sc); }
      c.fillStyle = C['--ink-2'];
      for (var k2 = 0; k2 <= 4; k2++) { c.textAlign = k2 === 0 ? 'left' : k2 === 4 ? 'right' : 'center'; c.fillText((range.lo + (range.hi - range.lo) * k2 / 4).toFixed(S.layer === 'wind' ? 1 : 0), pad + lw * k2 / 4, y0 + foot * 0.8); }
      c.textAlign = 'right'; c.fillText('簡易モデルによる推計値（実測ではありません）', cv.width - pad, y0 + foot * 0.5);
      var url = cv.toDataURL('image/png'), dl = $('shotDl');
      $('shotImg').src = url; dl.href = url; dl.download = 'ecowin-gym-' + fmtDate(d) + '.png';
      var dg = $('shotDlg'); if (dg.showModal) dg.showModal(); else dg.setAttribute('open', '');
    });
    $('closeShot').addEventListener('click', function () { var d = $('shotDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });

    // 左のパネルの切り替えと開閉
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; press('tabs', b.dataset.v);
      [].forEach.call(document.querySelectorAll('.pane'), function (p) { p.hidden = p.dataset.pane !== b.dataset.v; });
      chartsDirty = true; dirty = true;
    });
    press('tabs', 'cond');
    $('sideToggle').addEventListener('click', function () {
      var w = $('main').classList.toggle('wide'); $('sideToggle').textContent = w ? 'パネルを表示' : 'パネルを隠す'; $('sideToggle').setAttribute('aria-expanded', String(!w)); chartsDirty = true; dirty = true;
    });
    if (scene3 && !scene3.volOK) { $('ckVolume').checked = false; $('ckVolume').disabled = true; S.volume = false; }

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
    var dt = Math.min(0.25, (now - last) / 1000 || 0.016); last = now;
    if (S.playing) { setTime(S.t + dt * S.speed); syncSliders(); }
    var heat = isHeat(Math.floor(S.t)), ms = shownModes(), sts = {};
    M.MODES.forEach(function (m) { sts[m] = stateAt(m, S.t); });
    if (dirty) {
      updateRangeTarget();
      ms.forEach(function (m, i) { M.computeField(S.layer, m, sts[m], heat, S.z, F, heat ? jet.heat : jet.cool, target[i]); });
      var wn = wxAt(S.t); sunI = wn.I; renderNow(sts, wn); renderProbe(sts, heat); if (scene3) scene3.markVolume();
      var d = Math.floor(S.t / 24);
      if (chartsDirty || d !== lastDay) { if (chartsDirty) { buildCal(); drawMon(); } lastDay = d; chartsDirty = false; }
      drawCal(); drawDay();
      dirty = false; settle = 1;
    }
    if (settle > 0 || first) {
      var a = first ? 1 : 1 - Math.exp(-dt / 0.16), mx = 0;
      ms.forEach(function (m, s) {
        var tg = target[s], sh = shown[s];
        for (var i = 0; i < N; i++) { var df = tg[i] - sh[i]; sh[i] += df * a; if (df > mx) mx = df; else if (-df > mx) mx = -df; }
      });
      var rd = Math.abs(rangeT.lo - range.lo) + Math.abs(rangeT.hi - range.hi);
      if (first || rd < 0.5) range.step = rangeT.step;
      range.lo += (rangeT.lo - range.lo) * a; range.hi += (rangeT.hi - range.hi) * a; range.c = rangeT.c;
      if (scene3) ms.forEach(function (m, s) { scene3.paintHeat(s, shown[s]); });
      var lk = S.layer + S.z + range.lo.toFixed(1) + range.hi.toFixed(1) + C['--div-mid'];
      if (lk !== legendKey) { renderLegend(); legendKey = lk; }
      settle = (mx > 0.004 || rd > 0.02) ? 1 : 0; first = false;
    }
    if (scene3) scene3.frame(dt, ms.map(function (m) { return { mode: m, st: sts[m] }; }), heat);
  }

  // ------------------------------------------------------------ 起動
  buildColors();
  recomputeGeometry();
  wx = getWx();
  sim = M.simulate(params(), wx, F11.mean, jet.m11);
  if (window.THREE) { scene3 = initScene(); if (scene3) { scene3.applyTheme(); scene3.rebuildPanels(); } }
  initUI();
  renderAnnual(); renderSource();
  requestAnimationFrame(tick);
  window.__twin = { S: S, panels: function () { return panels; }, summary: function () { return sim.summary; }, setTime: function (t) { setTime(t); syncSliders(); } };
})();
