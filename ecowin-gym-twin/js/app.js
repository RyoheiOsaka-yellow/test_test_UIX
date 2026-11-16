/* ecowinハイブリッド 体育館デジタルツイン — 画面（3D表示・時間軸・グラフ） */
(function () {
  'use strict';
  var M = window.GymModel, K = M.K;
  // 建物の選択：アドレスの # か、前回の選択から。切り替えるときはページを読み直して、3Dを作り直す
  var BKEY = (function () {
    var k = (location.hash || '').replace('#', '');
    if (!M.BUILDINGS[k]) { try { k = localStorage.getItem('ecowin-gym-building'); } catch (e) { k = null; } }
    return M.BUILDINGS[k] ? k : 'chuo';
  })();
  var G = M.setBuilding(BKEY);
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
    city: 'oita', insul: 'low', occupants: 80, sensible: 150, setHeat: 18, setCool: 27, opStart: 8, opEnd: 21,
    panels: 16, preheat: 0, field: true, layout: 'gallery', price: 22, basic: 1100,
    mode: 'eco', layer: 'ot', z: 1.1, t: 0, playing: false, speed: 0.05,
    wind: true, rays: true, volume: true, section: false, people: true, probe: null, split: true, left: 'ac', charts: false, rateMode: 'model', rateCustom: 30, capex: 1500, maint: 0, sheet: false, spec: null, palette: 'rainbow', acMode: 'auto', acCool: Math.round(K.capCool / K.ecoCap / 5000) * 5, acHeat: Math.round(K.capHeat / K.ecoCap / 5000) * 5, acCopC: 3.1, acCopH: 3.4
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
    LUT.div = ramp([[0, '#0d366b'], [0.14, '#1c5cab'], [0.28, '#3987e5'], [0.40, '#86b6ef'], [0.5, mid], [0.60, '#f0a39c'], [0.72, '#e34948'], [0.86, '#b02a2e'], [1, '#6e1220']], 512);
    // 虹色：青→水色→緑→黄→橙→赤（気流解析の図でよく使われる色の並び）
    LUT.rain = ramp([[0, '#1b2a9e'], [0.1, '#1f5fe0'], [0.22, '#18aeea'], [0.34, '#17d2c2'], [0.46, '#2fcf5d'], [0.56, '#8fdc2e'], [0.66, '#e9e225'], [0.78, '#ffb01f'], [0.9, '#f4571c'], [1, '#d61c1c']], 512);
    LUT.temp = S.palette === 'rainbow' ? LUT.rain : LUT.div;
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
    var sets = window.WX_SETS || {}, k = typeof S.city === 'string' && !sets[S.city] ? 6 : S.city;
    return wxCache[k] || (wxCache[k] = typeof k === 'string' ? M.weatherFromData(sets[k]) : M.generateWeather(k));
  }
  function params() { return { acSpec: S.acMode === 'custom' ? { cool: S.acCool, heat: S.acHeat, copC: S.acCopC, copH: S.acCopH } : null, custom: S.insul === 'custom' ? specIns(S.spec) : null, insul: S.insul === 'custom' ? 'low' : S.insul, occupants: S.occupants, sensible: S.sensible, setHeat: S.setHeat, setCool: S.setCool, opStart: S.opStart, opEnd: S.opEnd, panels: panels.length, preheat: S.preheat, price: S.price, basic: S.basic }; }
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
    var ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), row = new Float32Array(w);
    var xi = new Uint16Array(w), xf = new Float32Array(w), yi = new Uint16Array(h), yf = new Float32Array(h), i;
    for (i = 0; i < w; i++) { var gx = M.clamp((i + 0.5) / scale - 0.5, 0, nx - 1.001); xi[i] = Math.floor(gx); xf[i] = gx - xi[i]; }
    for (i = 0; i < h; i++) { var gy = M.clamp((i + 0.5) / scale - 0.5, 0, ny - 1.001); yi[i] = Math.floor(gy); yf[i] = gy - yi[i]; }
    return {
      canvas: cv,
      paint: function (vals, lut, lo, hi, step, line, band) { // band：等値線の間を1色で塗る（段階表示）
        var d = img.data, inv = 511 / (hi - lo), p = 0, lr = line[0], lg = line[1], lb = line[2], is = 1 / step;
        for (var y = 0; y < h; y++) {
          var r0 = yi[y] * nx, r1 = r0 + nx, fy = yf[y];
          for (var x = 0; x < w; x++, p++) {
            var a = xi[x], fx = xf[x];
            var v0 = vals[r0 + a] + (vals[r0 + a + 1] - vals[r0 + a]) * fx, v1 = vals[r1 + a] + (vals[r1 + a + 1] - vals[r1 + a]) * fx;
            var v = v0 + (v1 - v0) * fy, t = ((band ? (Math.floor(v * is) + 0.5) * step : v) - lo) * inv, li = (t < 0 ? 0 : t > 511 ? 511 : t | 0) * 3, o = p * 4;
            // 等値線：いちばん近い線までの距離（画素）を、値の傾きから求めて濃さにする
            var gxv = x > 0 ? v - row[x - 1] : 0, gyv = y > 0 ? v - row[x] : 0, gr = Math.sqrt(gxv * gxv + gyv * gyv) * is, fr = v * is; fr -= Math.floor(fr); if (fr > 0.5) fr = 1 - fr;
            row[x] = v;
            var k = gr > 0.004 ? 1.25 - fr / gr : 0; k = k < 0 ? 0 : k > 1 ? 0.42 : k * 0.42;
            d[o] = lut[li] + (lr - lut[li]) * k; d[o + 1] = lut[li + 1] + (lg - lut[li + 1]) * k; d[o + 2] = lut[li + 2] + (lb - lut[li + 2]) * k; d[o + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
    };
  }

  // ------------------------------------------------------------ 3D
  var scene3 = null;
  function shownModes() { return S.split ? [S.left, 'eco'] : [S.mode]; }
  function fm() { return S.split ? 'eco' : S.mode; } // 年間マップや表で強調する方式
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
    // ---- 体育館の内部（日出町 中央体育館の設計図をもとにした形）----
    var A = { x0: G.ax0, y0: G.ay0, x1: G.ax1, y1: G.ay1 }, GZ = G.galleryZ, GD = G.galleryD, TZ = G.trussZ;
    function tex(w, h, draw, rx, ry) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rx) t.repeat.set(rx, ry);
      t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
    }
    var rnd = (function (a) { return function () { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(11);
    function box(w, h, d, mat, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
    // フローリング
    var woodTex = tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#d7a04a'; c.fillRect(0, 0, w, h);
      for (var by = 0; by < 8; by++) for (var bx = 0; bx < 8; bx++) {
        var vert = (bx + by) % 2 === 0;
        for (var k = 0; k < 8; k++) {
          c.fillStyle = 'hsl(' + (34 + rnd() * 6) + ',' + (58 + rnd() * 10) + '%,' + (52 + rnd() * 16) + '%)';
          if (vert) c.fillRect(bx * 128 + k * 16, by * 128, 15.4, 127.4); else c.fillRect(bx * 128, by * 128 + k * 16, 127.4, 15.4);
        }
      }
    }, W / 6, D / 6);
    var floorMat = new THREE.MeshPhongMaterial({ map: woodTex, shininess: 70, specular: 0x4a3a22 });
    var floor = quad([[0, 0, D], [W, 0, D], [W, 0, 0], [0, 0, 0]], floorMat); scene.add(floor);
    var ground = quad([[-80, -0.05, D + 80], [W + 80, -0.05, D + 80], [W + 80, -0.05, -80], [-80, -0.05, -80]], new THREE.MeshBasicMaterial({ color: 0x888888 })); scene.add(ground);
    var lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    var lp = [];
    function seg(x1, y1, x2, y2) { lp.push(x1, 0.03, y1, x2, 0.03, y2); }
    function rect(x1, y1, x2, y2) { seg(x1, y1, x2, y1); seg(x2, y1, x2, y2); seg(x2, y2, x1, y2); seg(x1, y2, x1, y1); }
    function circle(x, y, r) { for (var a = 0; a < 32; a++) { var t1 = a / 32 * 6.2832, t2 = (a + 1) / 32 * 6.2832; seg(x + r * Math.cos(t1), y + r * Math.sin(t1), x + r * Math.cos(t2), y + r * Math.sin(t2)); } }
    rect(cx - 14, cz - 7.5, cx + 14, cz + 7.5); seg(cx, cz - 7.5, cx, cz + 7.5); circle(cx, cz, 1.8); // バスケットボールコート 28m×15m
    rect(cx - 14, cz - 2.45, cx - 8.2, cz + 2.45); rect(cx + 8.2, cz - 2.45, cx + 14, cz + 2.45);
    var bw2 = Math.min(16, W / 2 - 1.2);
    [cz - 9.5, cz + 9.5].forEach(function (yc) { rect(cx - bw2, yc - 3.05, cx - bw2 + 13.4, yc + 3.05); rect(cx + bw2 - 13.4, yc - 3.05, cx + bw2, yc + 3.05); }); // バドミントンコート 13.4m×6.1m を4面
    var courtLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), lineMat); scene.add(courtLines);

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
      var nz = Math.max(1, Math.round((w.z2 - w.z1) / 1.25));
      for (var j = 0; j <= nz; j++) { var z = w.z1 + (w.z2 - w.z1) * j / nz; mull.push.apply(mull, P(w.a1, z).concat(P(w.a2, z))); }
    });
    var mullMat = new THREE.LineBasicMaterial({ color: 0x2b2f33 });
    Object.keys(mullPts).forEach(function (k) { mullObj[k] = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(mullPts[k], 3)), mullMat); scene.add(mullObj[k]); });
    var fp = [];
    function e3(a, b) { fp.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    [[0, 0], [W, 0], [W, D], [0, D]].forEach(function (p, i, arr) { var n = arr[(i + 1) % 4]; e3([p[0], 0, p[1]], [n[0], 0, n[1]]); e3([p[0], H, p[1]], [n[0], H, n[1]]); e3([p[0], 0, p[1]], [p[0], H, p[1]]); });
    var frameMat = new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.55 });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)), frameMat));

    // 2階ギャラリー（南北の通路）と柱。手前側のギャラリーも床と手すりだけなので、中の見通しを妨げない
    var gal = { N: new THREE.Group(), S: new THREE.Group(), W: new THREE.Group() };
    var slabMat = new THREE.MeshLambertMaterial({ color: 0xb9bcc0 }), colMat = new THREE.MeshLambertMaterial({ color: 0xd8d9da }), railPts = [], cols = {};
    [['N', 0, 1], ['S', D, -1]].forEach(function (sd) {
      var g = gal[sd[0]], yw = sd[1], dir = sd[2];
      g.add(box(W, 0.25, GD, slabMat, cx, GZ - 0.125, yw + dir * GD / 2));
      var ye = yw + dir * GD;
      railPts.push(0, GZ + 1.1, ye, W, GZ + 1.1, ye, 0, GZ + 0.55, ye, W, GZ + 0.55, ye);
      for (var x = 0; x <= W + 0.01; x += W / 24) railPts.push(x, GZ, ye, x, GZ + 1.1, ye);
      var cg = new THREE.Group(); cols[sd[0]] = cg; // 柱は、視点がその壁の外にあるときは隠す
      G.bays.forEach(function (bx) { cg.add(box(0.5, TZ, 0.5, colMat, M.clamp(bx, 0.25, W - 0.25), TZ / 2, yw + dir * 0.25)); });
      scene.add(g); scene.add(cg);
    });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(railPts, 3)), new THREE.LineBasicMaterial({ color: 0x8d949b })));
    // ステージ（東側）
    var stageMat = new THREE.MeshLambertMaterial({ color: 0x3b3f45, side: THREE.BackSide });
    scene.add(quad([[W - 0.03, 1.0, cz + 7], [W - 0.03, 1.0, cz - 7], [W - 0.03, 5.2, cz - 7], [W - 0.03, 5.2, cz + 7]], stageMat));
    scene.add(box(0.5, 1.0, 14, new THREE.MeshLambertMaterial({ color: 0x8a7a66 }), W - 0.25, 0.5, cz));

    // 屋根のトラス（梁天端 7.5m から屋根 10.6m まで）と照明。視点が屋根より上にあるときは隠す
    var roofGroup = new THREE.Group(), tp = [], ZT = H - 0.15, ZB = TZ + 0.1, ix;
    function t3(x1, y1, z1, x2, y2, z2) { tp.push(x1, z1, y1, x2, z2, y2); }
    G.bays.forEach(function (bx) { // スパンごとの山形トラス（W形）
      var x = M.clamp(bx, 0.15, W - 0.15), n = 8, dy = D / n;
      t3(x, 0, ZB, x, D, ZB); t3(x, 0, ZT, x, D, ZT);
      for (var i = 0; i < n; i++) { t3(x, i * dy, ZT, x, (i + 0.5) * dy, ZB); t3(x, (i + 0.5) * dy, ZB, x, (i + 1) * dy, ZT); }
    });
    for (ix = 0; ix <= 8; ix++) { var yy = D * ix / 8; t3(0, yy, ZT, W, yy, ZT); if (ix < 8) t3(0, yy + D / 16, ZB, W, yy + D / 16, ZB); }
    roofGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)), new THREE.LineBasicMaterial({ color: 0xaab0b6, transparent: true, opacity: 0.9 })));
    var lampGeo = new THREE.BoxGeometry(0.8, 0.12, 0.8), lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbea });
    for (var ly = 0; ly < 4; ly++) for (ix = 0; ix < 6; ix++) { var lm = new THREE.Mesh(lampGeo, lampMat); lm.position.set(W * (ix + 0.5) / 6, ZB - 0.15, D * (ly + 0.5) / 4); roofGroup.add(lm); }
    scene.add(roofGroup);

    // 壁掛形エアコンと取付架台（ギャラリーの手すり位置。架台は W2,400 × H1,234）
    var acMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f2 }), frMat = new THREE.MeshLambertMaterial({ color: 0x6b7178 }), acGroup = new THREE.Group();
    M.AC_UNITS.forEach(function (u) {
      var ye = u.dir > 0 ? GD : D - GD;
      acGroup.add(box(2.4, 1.234, 0.05, frMat, u.x, GZ + 0.344 + 0.617, ye - u.dir * 0.06));
      acGroup.add(box(1.1, 0.3, 0.27, acMat, u.x, u.z0 - 0.05, ye + u.dir * 0.12));
    });
    scene.add(acGroup);

    // 評価面（体感温度などの分布）。左右比較のために2枚ぶん持つ
    var painters = [makeFieldPainter(G.NX, G.NY, 4), makeFieldPainter(G.NX, G.NY, 4)];
    var heatTex = painters.map(function (p) { var t = new THREE.CanvasTexture(p.canvas); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });
    var heatMat = new THREE.MeshBasicMaterial({ map: heatTex[0], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    var heatPlane = quad([[A.x0, 0, A.y1], [A.x1, 0, A.y1], [A.x1, 0, A.y0], [A.x0, 0, A.y0]], heatMat); heatPlane.renderOrder = 2; scene.add(heatPlane);
    // 断面（南北方向・空調機の正面を通る面）
    var SX = M.AC_UNITS[4].x, NZ = Math.round(H / 0.5), secPainter = makeFieldPainter(G.NY, NZ, 4), secTex = new THREE.CanvasTexture(secPainter.canvas), secVals = new Float32Array(G.NY * NZ);
    secTex.minFilter = THREE.LinearFilter; secTex.generateMipmaps = false;
    var sec = quad([[SX, 0, A.y0], [SX, 0, A.y1], [SX, H, A.y1], [SX, H, A.y0]], new THREE.MeshBasicMaterial({ map: secTex, transparent: true, opacity: 0.93, side: THREE.DoubleSide, depthWrite: false }));
    sec.renderOrder = 3; sec.visible = false; scene.add(sec);

    // パネル（ドラッグで移動、ダブルクリックで向きを変える）
    var panelGroup = new THREE.Group(), panelMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 });
    var panelGeo = new THREE.BoxGeometry(M.PANEL.w, M.PANEL.h, 0.09), grabGeo = new THREE.BoxGeometry(M.PANEL.w + 0.2, M.PANEL.h + 0.5, 0.8);
    var grabMat = new THREE.MeshBasicMaterial({ visible: false });
    scene.add(panelGroup);
    function place(mesh, p) { mesh.position.set(p.x, (p.z === undefined ? M.PANEL.z0 : p.z) + M.PANEL.h / 2, p.y); mesh.rotation.y = p.axis === 'x' ? Math.PI / 2 : 0; }
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
      var px = pi < 30 ? 5 + r() * 28 : 1.5 + r() * 1.5, py = pi < 30 ? (pi % 2 ? 3.5 + r() * 9 : 16 + r() * 9) : 5 + r() * 18;
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

    // 画面上で一定の太さを持つ、なめらかな帯（流線と輻射の線に使う）。1本＝始点と終点を持つ1区間
    var ribRes = { value: new THREE.Vector2(800, 600) };
    function makeRibbons(n, order) {
      var geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3)); // x：区間のどちらの端か、y：帯のどちら側か
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      var r = { A: new Float32Array(n * 3), B: new Float32Array(n * 3), C: new Float32Array(n * 3), W: new Float32Array(n * 4) }; // W＝始点の濃さ、終点の濃さ、始点の太さ、終点の太さ
      var at = { iA: new THREE.InstancedBufferAttribute(r.A, 3), iB: new THREE.InstancedBufferAttribute(r.B, 3), iC: new THREE.InstancedBufferAttribute(r.C, 3), iW: new THREE.InstancedBufferAttribute(r.W, 4) };
      for (var k in at) { at[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at[k]); }
      geo.instanceCount = n;
      var mat = new THREE.ShaderMaterial({
        uniforms: { uRes: ribRes }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: [
          'attribute vec3 iA; attribute vec3 iB; attribute vec3 iC; attribute vec4 iW; uniform vec2 uRes; varying vec3 vC; varying float vA; varying float vS;',
          'void main(){',
          '  vec4 a = projectionMatrix * modelViewMatrix * vec4(iA, 1.0); vec4 b = projectionMatrix * modelViewMatrix * vec4(iB, 1.0);',
          '  float e = position.x; vA = mix(iW.x, iW.y, e); vC = iC; vS = position.y;',
          '  if (a.w <= 0.05 || b.w <= 0.05 || vA <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
          '  vec2 sa = a.xy / a.w * uRes; vec2 sb = b.xy / b.w * uRes; vec2 d = sb - sa; float len = length(d);',
          '  vec2 nrm = len > 0.001 ? vec2(-d.y, d.x) / len : vec2(0.0, 1.0);',
          '  vec4 p = mix(a, b, e); p.xy += nrm * position.y * mix(iW.z, iW.w, e) / uRes * 2.0 * p.w;',
          '  gl_Position = p;',
          '}'].join('\n'),
        fragmentShader: 'varying vec3 vC; varying float vA; varying float vS;\nvoid main(){ float f = 1.0 - abs(vS); gl_FragColor = vec4(vC, vA * smoothstep(0.0, 0.75, f)); }'
      });
      r.obj = new THREE.Mesh(geo, mat); r.obj.frustumCulled = false; r.obj.renderOrder = order;
      r.flush = function () { for (var k in at) at[k].needsUpdate = true; };
      return r;
    }

    // パネルの近さの地図（0.5m格子）。パネルまわりの上昇・下降流に使う
    var PGX = G.NX, PGY = G.NY, panelProx = new Float32Array(PGX * PGY), panelZ = M.PANEL.z0;
    function buildPanelProx() {
      panelProx.fill(0); panelZ = panels.length && panels[0].z !== undefined ? panels[0].z : M.PANEL.z0;
      panels.forEach(function (P) {
        var i0 = Math.max(0, Math.floor((P.x - A.x0 - 3) / G.cell)), i1 = Math.min(PGX - 1, Math.ceil((P.x - A.x0 + 3) / G.cell));
        var j0 = Math.max(0, Math.floor((P.y - A.y0 - 3) / G.cell)), j1 = Math.min(PGY - 1, Math.ceil((P.y - A.y0 + 3) / G.cell)), hw = M.PANEL.w / 2;
        for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
          var x = M.gx(i) - P.x, y = M.gy(j) - P.y, along = P.axis === 'y' ? x : y, across = P.axis === 'y' ? y : x;
          var da = Math.max(0, Math.abs(along) - hw), v = Math.exp(-(da * da + across * across) / 0.6), k = j * PGX + i;
          if (v > panelProx[k]) panelProx[k] = v;
        }
      });
    }
    function proxAt(x, y) {
      var i = Math.floor((x - A.x0) / G.cell), j = Math.floor((y - A.y0) / G.cell);
      return i < 0 || j < 0 || i >= PGX || j >= PGY ? 0 : panelProx[j * PGX + i];
    }

    // 館内の空気の流れ（表示用）：吹出しの噴流、噴流への巻き込み、館内を回る循環、パネルまわりの上昇・下降流、乱れ
    var fv = { x: 0, y: 0, z: 0 }, LY = A.y1 - A.y0;
    function flowVel(mode, st, heat, x, y, z, t) {
      var u0 = K.u0[mode] * st.fan, vx = 0, vy = 0, vz = 0;
      if (u0 > 0.03) for (var i = 0; i < M.AC_UNITS.length; i++) {
        var u = M.AC_UNITS[i], s = (y - u.y) * u.dir; if (s < -1.5 || s > 34) continue;
        var ss = s < 0.3 ? 0.3 : s, az = M.jetAxisZ(ss, heat, u.z0), slope = (M.jetAxisZ(ss + 0.4, heat, u.z0) - az) / 0.4;
        var l = x - (u.x + 0.03 * ss * Math.sin(0.45 * ss - 1.1 * t + u.x)), dz = z - az, b = 0.35 + 0.11 * ss, r2 = (l * l + dz * dz) / (b * b), c = u0 * (ss < K.core ? 1 : K.core / ss);
        if (r2 < 9 && s > -0.3) { var g = Math.exp(-r2) * c / Math.sqrt(1 + slope * slope); vy += u.dir * g; vz += g * slope; }
        if (r2 > 0.5 && r2 < 60 && s > 0) { var rr = Math.sqrt(l * l + dz * dz), en = 0.1 * c * b / rr; vx -= en * l / rr; vz -= en * dz / rr; } // 巻き込み
      }
      // 循環：低いところを中央へ、中央で上がり、天井に沿って外へ、壁際で下りる
      var U = (mode === 'none' ? 0.05 : 0.05 + 0.1 * u0) + 0.04 * Math.min(2, Math.abs(st.G) * 3), eta = (y - A.y0) / LY, ze = z / H;
      vy += U * Math.sin(6.2832 * eta) * Math.cos(3.1416 * ze);
      vz -= U * (H / 3.1416) * (6.2832 / LY) * Math.cos(6.2832 * eta) * Math.sin(3.1416 * ze);
      if (mode === 'eco') { // 暖かいパネルの前は上昇流、冷たいパネルの前は下降流
        var px = proxAt(x, y);
        if (px > 0.02) {
          var k = (st.Tp - st.Ta) / 27, f = px * Math.exp(-Math.abs(z - panelZ - 0.3) / 2.2);
          vz += 0.42 * k * f;
          var gx = proxAt(x + 0.5, y) - proxAt(x - 0.5, y), gy = proxAt(x, y + 0.5) - proxAt(x, y - 0.5), near = Math.abs(z - panelZ - 0.3) < 1.2 ? 1 : 0;
          vx += 0.3 * k * gx * near; vy += 0.3 * k * gy * near;
        }
      }
      var sp = Math.sqrt(vx * vx + vy * vy + vz * vz), am = 0.035 + 0.2 * sp; // 乱れ：速いところほど大きくゆらぐ
      fv.x = vx + am * Math.sin(0.83 * y + 1.31 * z + 0.7 * t) * Math.cos(0.57 * x - 0.4 * t + 1.3);
      fv.y = vy + am * Math.sin(0.71 * x - 1.13 * z + 0.6 * t + 2.1) * Math.cos(0.49 * y + 0.5 * t);
      fv.z = vz + am * 0.6 * Math.sin(0.93 * x + 0.77 * y - 0.8 * t + 0.7);
      return sp;
    }

    // 流線：空気の流れに乗って漂う粒と、その通った跡（尾）。方式ごとに1組
    function gs() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.9; }
    var HOT = hex('#f0642c'), COLD = hex('#2f8fea');
    function makeFlow(mode) {
      var NP = mode === 'ac' ? 760 : mode === 'eco' ? 620 : 240, L = 18, rib = makeRibbons(NP * L, 5), puff = softPoints(NP, 4);
      var P = new Float32Array(NP * 3), Hs = new Float32Array(NP * L * 3), life = new Float32Array(NP), age = new Float32Array(NP), heatTag = new Float32Array(NP), spd = new Float32Array(NP), rec = 0, tt = Math.random() * 50, started = false;
      var obj = new THREE.Group(); obj.add(puff.obj); obj.add(rib.obj); obj.visible = false; scene.add(obj);
      function spawn(i, st, heat, anywhere) {
        var u0 = K.u0[mode] * st.fan, r = Math.random(), x, y, z, tag = 0;
        if (!anywhere && u0 > 0.05 && r < 0.62) { // 吹出し口から
          var un = M.AC_UNITS[(Math.random() * M.AC_UNITS.length) | 0], s = 0.3 + Math.random() * 0.8;
          x = un.x + gs() * 0.25; y = un.y + un.dir * s; z = M.jetAxisZ(s, heat, un.z0) + gs() * 0.25; tag = heat ? 1 : -1;
        } else if (!anywhere && mode === 'eco' && panels.length && Math.abs(st.Tp - st.Ta) > 3 && r < 0.8) { // パネルの前から
          var pn = panels[(Math.random() * panels.length) | 0], off = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.3), al = (Math.random() - 0.5) * M.PANEL.w;
          x = pn.axis === 'y' ? pn.x + al : pn.x + off; y = pn.axis === 'y' ? pn.y + off : pn.y + al; z = panelZ + Math.random() * M.PANEL.h; tag = st.Tp > st.Ta ? 0.8 : -0.8;
        } else { x = A.x0 + 0.5 + Math.random() * (A.x1 - A.x0 - 1); y = A.y0 + 0.5 + Math.random() * (LY - 1); z = 0.3 + Math.random() * (H - 1); }
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; heatTag[i] = tag; age[i] = 0; life[i] = 7 + Math.random() * 11;
        for (var j = 0, o = i * L * 3; j < L; j++, o += 3) { Hs[o] = x; Hs[o + 1] = y; Hs[o + 2] = z; }
      }
      function advance(step, st, heat) { // 粒を流れに乗せて進め、通った跡を記録する
        tt += step; rec += step;
        var push = rec > 0.07; if (push) rec = 0;
        for (var i = 0; i < NP; i++) {
          var o = i * 3, x = P[o], y = P[o + 1], z = P[o + 2], sp = flowVel(mode, st, heat, x, y, z, tt);
          x += fv.x * step; y += fv.y * step; z += fv.z * step; age[i] += step; spd[i] += (sp - spd[i]) * 0.2;
          heatTag[i] *= 1 - 0.16 * step;
          if (mode === 'eco') { var px = proxAt(x, y); if (px > 0.3 && Math.abs(z - panelZ) < 2) heatTag[i] += ((st.Tp > st.Ta ? 1 : -1) * px - heatTag[i]) * Math.min(1, 2 * step) * Math.min(1, Math.abs(st.Tp - st.Ta) / 15); }
          if (age[i] > life[i] || x < A.x0 + 0.1 || x > A.x1 - 0.1 || y < A.y0 + 0.1 || y > A.y1 - 0.1) { spawn(i, st, heat, false); continue; }
          if (z < 0.12) z = 0.12; else if (z > H - 0.3) z = H - 0.3;
          P[o] = x; P[o + 1] = y; P[o + 2] = z;
          if (push) { var h0 = i * L * 3; Hs.copyWithin(h0 + 3, h0, h0 + (L - 1) * 3); Hs[h0] = x; Hs[h0 + 1] = y; Hs[h0 + 2] = z; }
        }
      }
      return {
        obj: obj, on: false,
        update: function (dt, st, heat) {
          this.on = S.wind; if (!this.on) return;
          var i, j;
          if (!started) { // 表示した瞬間から流れているように、数秒ぶん先に進めておく
            for (i = 0; i < NP; i++) { spawn(i, st, heat, i % 3 === 0); age[i] = Math.random() * 5; }
            for (i = 0; i < 130; i++) advance(0.05, st, heat);
            started = true;
          }
          advance(Math.min(dt, 0.05), st, heat);
          var neu = hex(C['--ink-3']), pr = renderer.getPixelRatio();
          for (i = 0; i < NP; i++) {
            var o = i * 3, x = P[o], y = P[o + 1], z = P[o + 2], h0 = i * L * 3;
            // 色：吹出しやパネルの熱を帯びた空気は暖色・寒色、まわりと混ざると無彩色に近づく
            var a = Math.min(1, Math.abs(heatTag[i])), src = heatTag[i] > 0 ? HOT : COLD, cr = (neu[0] + (src[0] - neu[0]) * a) / 255, cg = (neu[1] + (src[1] - neu[1]) * a) / 255, cb = (neu[2] + (src[2] - neu[2]) * a) / 255;
            var fade = Math.min(1, age[i] / 0.8) * Math.min(1, (life[i] - age[i]) / 1.2), base = fade * Math.min(0.95, 0.22 + 0.6 * spd[i] + 0.3 * a), wHead = (1.5 + 1.7 * Math.min(1, spd[i])) * pr;
            for (j = 0; j < L; j++) {
              var k = i * L + j, k3 = k * 3, k4 = k * 4, hb = h0 + j * 3, t0 = j / L, t1 = (j + 1) / L;
              if (j === 0) { rib.A[k3] = x; rib.A[k3 + 1] = z; rib.A[k3 + 2] = y; } else { rib.A[k3] = Hs[hb - 3]; rib.A[k3 + 1] = Hs[hb - 1]; rib.A[k3 + 2] = Hs[hb - 2]; }
              rib.B[k3] = Hs[hb]; rib.B[k3 + 1] = Hs[hb + 2]; rib.B[k3 + 2] = Hs[hb + 1];
              rib.C[k3] = cr; rib.C[k3 + 1] = cg; rib.C[k3 + 2] = cb;
              rib.W[k4] = base * (1 - t0) * (1 - t0); rib.W[k4 + 1] = base * (1 - t1) * (1 - t1); rib.W[k4 + 2] = wHead * (1 - 0.7 * t0); rib.W[k4 + 3] = wHead * (1 - 0.7 * t1);
            }
            // 熱を帯びた空気のかたまり（煙）
            puff.pos[o] = x; puff.pos[o + 1] = z; puff.pos[o + 2] = y; puff.col[o] = cr; puff.col[o + 1] = cg; puff.col[o + 2] = cb;
            puff.size[i] = 0.9 + 0.45 * Math.min(age[i], 6); puff.alpha[i] = i % 2 ? 0 : 0.16 * a * fade;
          }
          rib.flush(); puff.flush();
        }
      };
    }
    var winds = { none: makeFlow('none'), ac: makeFlow('ac'), eco: makeFlow('eco') };

    // 輻射の線：パネルの面からまっすぐ進む短い光の筋（暖房：外へ／冷房：パネルへ向かって）
    var NR = 1500, ray3 = makeRibbons(NR, 6), rays = ray3.obj, rp = [], raysOn = false, RMAX = 6.5;
    rays.visible = false; scene.add(rays);
    function initRays() {
      rp = [];
      for (var i = 0; i < NR; i++) rp.push({ p: panels.length ? i % panels.length : 0, side: i % 2 ? 1 : -1, a: Math.random() - 0.5, h: Math.random(), dl: gs() * 0.75, dv: gs() * 0.5, r: Math.random() * RMAX, len: 0.35 + Math.random() * 0.5 });
      buildPanelProx();
    }
    function rayPoint(q, P, r, out, o) {
      var nx = r * q.side, lat = q.a * M.PANEL.w + q.dl * r, hz = (P.z === undefined ? M.PANEL.z0 : P.z) + q.h * M.PANEL.h + q.dv * r;
      out[o] = P.axis === 'y' ? P.x + lat : P.x + nx; out[o + 1] = hz; out[o + 2] = P.axis === 'y' ? P.y + nx : P.y + lat;
      return hz > 0.05 && hz < H - 0.1 && out[o] > A.x0 && out[o] < A.x1 && out[o + 2] > A.y0 && out[o + 2] < A.y1;
    }
    function updateRays(dt, st, heat) {
      var d = Math.abs(st.Tp - st.Ta); raysOn = S.rays && panels.length > 0 && d > 2; if (!raysOn) return;
      var hot = hex(heat ? '#ff9a4d' : '#6cc0ff'), sp = (heat ? 1 : -1) * 3.2 * Math.min(dt, 0.05), act = M.clamp(d / 22, 0.2, 1) * NR, pr = renderer.getPixelRatio();
      for (var i = 0; i < NR; i++) {
        var q = rp[i], o = i * 3, w = i * 4;
        if (i > act) { ray3.W[w] = ray3.W[w + 1] = 0; continue; }
        q.r += sp;
        if (q.r > RMAX) q.r = 0.05; else if (q.r < 0.05) q.r = RMAX;
        var P = panels[q.p], f = q.r / RMAX, ok = rayPoint(q, P, q.r, ray3.A, o) && rayPoint(q, P, Math.max(0.02, q.r - q.len), ray3.B, o);
        var al = ok ? 0.8 * Math.pow(1 - f, 1.4) * Math.min(1, q.r / 0.4) : 0;
        ray3.W[w] = al; ray3.W[w + 1] = 0; ray3.W[w + 2] = 1.6 * pr; ray3.W[w + 3] = 0.6 * pr;
        ray3.C[o] = hot[0] / 255; ray3.C[o + 1] = hot[1] / 255; ray3.C[o + 2] = hot[2] / 255;
      }
      ray3.flush();
    }

    // 空気の層：館内の空気温度を立体の格子に入れ、視線に沿って重ねて描く（WebGL2 が使える端末のみ）
    var VX = 38, VY = 28, VZ = 21, volOK = renderer.capabilities.isWebGL2 && !!THREE.DataTexture3D, volTex = [], volData = [], volRange = [{ lo: 0, hi: 1 }, { lo: 0, hi: 1 }], volMesh = null, volDirty = true, volT = 0, clockT = 0;
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
        uniforms: { map: { value: volTex[0] }, lut: { value: lutTex }, bmin: { value: new THREE.Vector3(A.x0, 0, A.y0) }, bmax: { value: new THREE.Vector3(A.x1, H, A.y1) }, uRef: { value: 0.5 }, uSpan: { value: 0.3 }, uDens: { value: 0.032 }, uTime: { value: 0 } },
        transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
        vertexShader: 'varying vec3 vW;\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'precision highp float; precision highp sampler3D;',
          'uniform sampler3D map; uniform sampler2D lut; uniform vec3 bmin; uniform vec3 bmax; uniform float uRef; uniform float uSpan; uniform float uDens; uniform float uTime;',
          'varying vec3 vW;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main(){',
          '  vec3 ro = cameraPosition; vec3 rd = normalize(vW - ro); vec3 inv = 1.0 / (rd + vec3(1e-6));',
          '  vec3 t0 = (bmin - ro) * inv; vec3 t1 = (bmax - ro) * inv; vec3 tn3 = min(t0, t1); vec3 tf3 = max(t0, t1);',
          '  float tn = max(max(tn3.x, tn3.y), max(tn3.z, 0.0)); float tf = min(tf3.x, min(tf3.y, tf3.z));',
          '  if (tf <= tn) discard;',
          '  float dt = (tf - tn) / 44.0; float t = tn + dt * hash(gl_FragCoord.xy); vec4 acc = vec4(0.0);',
          '  for (int i = 0; i < 44; i++) {',
          '    vec3 w = ro + rd * t;',
          '    w += 0.45 * vec3(sin(0.55 * w.z + 0.8 * w.y + 0.5 * uTime), 0.5 * sin(0.6 * w.x + 0.4 * uTime + 1.7), sin(0.5 * w.x - 0.7 * w.y - 0.45 * uTime));', // かげろうのようなゆらぎ
          '    vec3 u = clamp((w - bmin) / (bmax - bmin), 0.0, 1.0);',
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
      panels[i] = np; place(panelGroup.children[i], np); buildPanelProx();
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
      movePanel(drag.i, { axis: p.axis, x: x, y: y, z: p.z }); drag.moved = true; panelsEdited(false);
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
      var p = panels[i]; movePanel(i, { axis: p.axis === 'y' ? 'x' : 'y', x: p.x, y: p.y, z: p.z }); S.probe = null; panelsEdited(true);
    });

    // カメラ
    var CAMS = {
      iso: { p: [-11, 31, D + 25], t: [cx, 0.5, cz - 0.5] }, top: { p: [cx, 68, cz + 0.02], t: [cx, 0, cz] },
      eye: { p: [1.8, 5.3, cz - 5], t: [cx + 8, 2.2, cz - 1] }, side: { p: [-40, 6, cz], t: [SX, 5, cz] }
    }, fly = null;
    function setCam(name, instant) {
      var c = CAMS[name];
      if (name === 'side') { // 断面の全幅が収まる距離まで下がる
        var th = Math.tan(cam.fov * Math.PI / 360), dist = Math.max(13 / (2 * th), (A.y1 - A.y0 + 6) / (2 * th * cam.aspect));
        c = { p: [SX - dist, 5.4, cz], t: [SX, 5.1, cz] };
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
        painters[slot].paint(vals, lutFor(S.layer), range.lo, range.hi, range.step, hex(C['--ink']), banded() && S.layer !== 'wind' && S.layer !== 'wbgt');
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
        cols.N.visible = cam.position.z > 0; cols.S.visible = cam.position.z < D;
        mullObj.N.visible = cam.position.z > 0; mullObj.S.visible = cam.position.z < D; mullObj.E.visible = cam.position.x < W; mullObj.W.visible = cam.position.x > 0;
        people.visible = S.people; sec.visible = S.section;
        var day = M.clamp(sunI / 700, 0, 1); hemi.intensity = 0.78 + 0.2 * day; sun.intensity = 0.12 + 0.3 * day; winMat.emissive.setRGB(0.05 + 0.2 * day, 0.07 + 0.22 * day, 0.09 + 0.24 * day);
        var useVol = volOK && S.volume; volT += dt; clockT += Math.min(dt, 0.05);
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
          for (var wk in winds) winds[wk].obj.visible = wk === m && winds[wk].on;
          rays.visible = m === 'eco' && raysOn; ribRes.value.set(q.w * renderer.getPixelRatio(), q.h * renderer.getPixelRatio());
          if (m === 'eco') { var pc = tl ? colorAt(LUT.temp, st.Tp, range.lo, range.hi) : hex(C['--m-eco']); panelMat.color.setRGB(pc[0] / 255, pc[1] / 255, pc[2] / 255); panelMat.emissive.setRGB(pc[0] / 600, pc[1] / 600, pc[2] / 600); }
          if (S.section) {
            for (var j = 0; j < NZ; j++) for (var k = 0; k < G.NY; k++) {
              var a = M.airAt(SX, M.gy(k), (NZ - 1 - j + 0.5) * (H / NZ), m, st, heat);
              secVals[j * G.NY + k] = S.layer === 'wind' ? a.v : a.T;
            }
            var wl = S.layer === 'wind', lo = wl ? 0 : S.layer === 'wbgt' ? st.Ta - 8 : range.lo, hi = wl ? 2.5 : S.layer === 'wbgt' ? st.Ta + 8 : range.hi;
            secPainter.paint(secVals, wl ? LUT.wind : LUT.temp, lo, hi, wl ? 0.25 : range.step, hex(C['--ink']), banded() && !wl);
            secTex.needsUpdate = true;
          }
          ptScale.value = q.h * renderer.getPixelRatio() / (2 * Math.tan(cam.fov * Math.PI / 360));
          if (volMesh) {
            volMesh.visible = useVol;
            if (useVol) { var vr = volRange[i], vu = volMesh.material.uniforms; vu.map.value = volTex[i]; vu.uRef.value = (st.Ta - vr.lo) / (vr.hi - vr.lo); vu.uSpan.value = 5.5 / (vr.hi - vr.lo); vu.uTime.value = clockT; }
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
      t.innerHTML = '<div class="nm"><i style="background:var(--m-' + ms[i] + ')"></i>' + MODE_NAME[ms[i]] + '</div><div class="kv" id="kv' + i + '"></div>';
    });
    div.hidden = rs.length < 2;
    if (rs.length > 1) {
      var side = rs[1].x > 0;
      div.style.left = side ? rs[1].x + 'px' : '0'; div.style.top = side ? '0' : rs[1].y + 'px';
      div.style.width = side ? '2px' : '100%'; div.style.height = side ? '100%' : '2px';
    }
    dirty = true;
  }
  function panelsEdited(final) {
    if (S.layout !== 'custom') {
      S.layout = 'custom';
      press('layoutSeg', 'custom'); $('customNote').hidden = false;
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
    var key = metricKey(), o = sim[fm()][key], cv = document.createElement('canvas'); cv.width = 365; cv.height = 24;
    var c = cv.getContext('2d'), img = c.createImageData(365, 24), lut = S.layer === 'wbgt' ? LUT.wbgt : LUT.temp;
    for (var d = 0; d < 365; d++) {
      var set = K.heatMonths[M.monthOfDay(d)] ? S.setHeat : S.setCool;
      for (var h = 0; h < 24; h++) {
        var v = o[d * 24 + h], col = S.layer === 'wbgt' ? colorAt(lut, v, 15, 35) : colorAt(lut, v - set, -16, 16), p = (h * 365 + d) * 4;
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0); calImg = cv;
    $('calT').textContent = '年間マップ：' + MODE_NAME[fm()] + 'の' + (S.layer === 'wbgt' ? '暑さ指数' : '体感温度');
    $('calK').textContent = S.layer === 'wbgt' ? '青：ほぼ安全 → 赤：危険' : '青：設定より寒い　灰：設定どおり　赤：設定より暑い';
  }
  function drawCal() {
    var f = fit($('cal')), c = f.c; if (f.w < 40) return;
    var L = 26, T = 2, B = 14, w = f.w - L - 4, h = f.h - T - B;
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
    var f = fit($('day')), c = f.c; if (f.w < 40) return;
    var L = 30, R = 8, T = 6, B = 16, w = f.w - L - R, h = f.h - T - B;
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
    M.MODES.forEach(function (m) { if (m !== fm()) line(sim[m][key], C['--m-' + m], 2); });
    line(sim[fm()][key], C['--m-' + fm()], 3);
    var hr = S.t - d * 24, px = X(hr);
    c.strokeStyle = C['--ink']; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 0.5, T); c.lineTo(px + 0.5, T + h); c.stroke();
    var cur = stateAt(fm(), S.t)[key];
    c.fillStyle = C['--m-' + fm()]; c.strokeStyle = C['--surface']; c.lineWidth = 2; c.beginPath(); c.arc(px, Y(cur), 4.5, 0, 6.2832); c.fill(); c.stroke();
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

  // ------------------------------------------------------------ 読み値の表示
  function f1(v) { return v.toFixed(1); }
  function yen(v) { return Math.round(v / 10000).toLocaleString('ja-JP') + '万円'; }
  function shortName(m) { return m === 'eco' ? 'ecowin' : m === 'ac' ? 'エアコン' : MODE_NAME[m]; }
  function maxWind(s, m, heat) { return 0.1 + K.u0[m] * s.fan * jet.max[heat ? 'heat' : 'cool']; }
  function renderNow(sts, w) {
    var d = Math.floor(S.t / 24), heat = isHeat(Math.floor(S.t)), cur = fm();
    $('clockD').textContent = fmtDate(d) + ' ' + fmtHour(S.t - d * 24);
    $('clockW').textContent = (wx.city.short || wx.city.name) + '　' + SKY[w.sky] + '　外気 ' + f1(w.T) + '℃　' + (heat ? '暖房の季節' : '冷房の季節');
    $('now').innerHTML = '<span>外気温 <b>' + f1(w.T) + '</b>℃</span><span>湿度 <b>' + Math.round(w.RH) + '</b>%</span><span>日射 <b>' + Math.round(w.I) + '</b>W/㎡</span>';
    var rows = [
      ['体感温度', function (s) { return f1(s.OT) + '℃'; }],
      ['空気温度（腰の高さ）', function (s) { return f1(s.Ta) + '℃'; }],
      ['天井付近の空気', function (s) { return f1(s.Ta + s.G * (G.H - 0.5 - G.zRef)) + '℃'; }],
      ['屋根の内側の表面', function (s) { return f1(s.Tri) + '℃'; }],
      ['暑さ指数', function (s) { var b = wbgtBand(s.WBGT); return f1(s.WBGT) + ' <span class="pill" style="background:' + b.c + '">' + b.name + '</span>'; }],
      ['いちばん強い風', function (s, m) { return maxWind(s, m, heat).toFixed(1) + 'm/s'; }],
      ['消費電力', function (s) { return Math.round(s.P) + 'kW'; }]
    ];
    var h = '<thead><tr><th></th>' + M.MODES.map(function (m) { return '<th' + (m === cur ? ' class="cur"' : '') + '>' + shortName(m) + '<i style="background:var(--m-' + m + ')"></i></th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr><th>' + r[0] + '</th>' + M.MODES.map(function (m) { return '<td' + (m === cur ? ' class="cur"' : '') + '>' + r[1](sts[m], m) + '</td>'; }).join('') + '</tr>'; });
    $('cmp').innerHTML = h + '</tbody>';
    shownModes().forEach(function (m, i) { // 3Dの上の札に、要点の3つの数字を出す
      var e = $('kv' + i); if (!e) return; var s = sts[m];
      e.innerHTML = '<span>体感 <b>' + f1(s.OT) + '</b>℃</span><span>ムラ <b>±' + spread[m].toFixed(1) + '</b>℃</span><span>風 <b>' + maxWind(s, m, heat).toFixed(1) + '</b>m/s</span><span>電力 <b>' + Math.round(s.P) + '</b>kW</span>';
    });
  }
  function renderAnnual() {
    var s = sim.summary, a = s.modes.ac, e = s.modes.eco, n = s.modes.none;
    $('rate').innerHTML = '−' + (s.rate * 100).toFixed(0) + '<small>%</small>';
    $('rateCap').innerHTML = '1年間の消費電力量（エアコンのみと比べて）' + (s.capped ? '<br>計算値は ' + (s.rawRate * 100).toFixed(0) + '%。メーカー公表の最大値 34% を上限にしています。' : '<br>メーカー公表の最大値は 34% です。');
    function row(l, x, y, z) { return '<tr><th>' + l + '</th><td>' + x + '</td><td>' + y + '</td><td>' + z + '</td></tr>'; }
    $('ann').innerHTML = '<thead><tr><th></th><th>エアコン<i style="background:var(--m-ac)"></i></th><th>ecowin<i style="background:var(--m-eco)"></i></th><th>差</th></tr></thead><tbody>' +
      row('消費電力量', (a.kwh / 1000).toFixed(1) + 'MWh', (e.kwh / 1000).toFixed(1) + 'MWh', '−' + ((a.kwh - e.kwh) / 1000).toFixed(1)) +
      row('最大需要電力', Math.round(a.contract) + 'kW', Math.round(e.contract) + 'kW', '−' + Math.round(a.contract - e.contract)) +
      row('電力量料金', yen(a.energyCost), yen(e.energyCost), '−' + yen(a.energyCost - e.energyCost)) +
      row('基本料金', yen(a.basicCost), yen(e.basicCost), '−' + yen(a.basicCost - e.basicCost)) +
      row('電気代の合計', yen(a.cost), yen(e.cost), '−' + yen(a.cost - e.cost)) +
      row('CO2排出量', (a.co2 / 1000).toFixed(1) + 't', (e.co2 / 1000).toFixed(1) + 't', '−' + ((a.co2 - e.co2) / 1000).toFixed(1)) + '</tbody>';
    renderSavings();
    $('annNote').innerHTML = '空調なしの場合、利用時間のうち暑さ指数が「厳重警戒」以上（28以上）になるのは年間 <b class="num">' + n.wbgt28 + '</b> 時間、「危険」（31以上）は <b class="num">' + n.wbgt31 + '</b> 時間、体感温度が12℃未満は <b class="num">' + n.cold + '</b> 時間です。空調ありでは「厳重警戒」以上が エアコンのみ ' + a.wbgt28 + ' 時間、ecowin ' + e.wbgt28 + ' 時間になります。';
  }
  var LAYER_TEXT = {
    ot: ['人が感じる温度です。空気の温度と、床・壁・天井・パネルから受ける熱を合わせています。', ['寒い', '設定どおり', '暑い']],
    ta: ['空気そのものの温度です。', ['寒い', '設定どおり', '暑い']],
    mrt: ['まわりの床・壁・天井・パネルの表面から受ける熱を、温度で表した値です。', ['冷たい面が多い', '設定どおり', '熱い面が多い']],
    wind: ['選んだ高さでの風の強さです。風が弱いほど、羽根やボールが流されにくくなります。', ['ほぼ無風', '', '強い']],
    wbgt: ['熱中症の危険度を表す指数です。28以上は「厳重警戒」、31以上は「危険」とされます。', ['ほぼ安全', '警戒', '危険']]
  };
  function renderLegend() {
    var L = LAYER[S.layer], cv = $('legC'), c = cv.getContext('2d'), lut = lutFor(S.layer), tx = LAYER_TEXT[S.layer];
    for (var x = 0; x < 300; x++) { var i = Math.round(x / 299 * 511) * 3; c.fillStyle = 'rgb(' + lut[i] + ',' + lut[i + 1] + ',' + lut[i + 2] + ')'; c.fillRect(x, 0, 1, 12); }
    $('legT').textContent = L.name + '（' + L.unit + '）';
    $('legH').textContent = { 0.1: '足元（0.1m）', 1.1: '腰（1.1m）', 1.7: '頭（1.7m）' }[S.z] + 'の高さ';
    $('legD').textContent = tx[0];
    $('legW').innerHTML = tx[1].map(function (t) { return '<span>' + t + '</span>'; }).join('');
    var dg = S.layer === 'wind' ? 1 : 0, ticks = [];
    for (var k = 0; k <= 4; k++) ticks.push((range.lo + (range.hi - range.lo) * k / 4).toFixed(dg));
    $('legK').innerHTML = ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('');
  }
  function renderProbe(sts, heat) {
    if (!S.probe) return;
    var i = M.clamp(Math.floor((S.probe.x - G.ax0) / G.cell), 0, G.NX - 1), j = M.clamp(Math.floor((S.probe.y - G.ay0) / G.cell), 0, G.NY - 1), k = j * G.NX + i;
    var ms = shownModes(), rows = [['体感温度', 'ot', 1, '℃'], ['空気温度', 'ta', 1, '℃'], ['放射温度', 'mrt', 1, '℃'], ['風速', 'wind', 2, 'm/s'], ['暑さ指数', 'wbgt', 1, '']];
    var vals = ms.map(function (m) { var v = {}; rows.forEach(function (r) { M.computeField(r[1], m, sts[m], heat, S.z, F, heat ? jet.heat : jet.cool, scratch); v[r[1]] = scratch[k]; }); return v; });
    var h = '<table>' + (ms.length > 1 ? '<tr><td>この場所</td>' + ms.map(function (m) { return '<td>' + shortName(m) + '</td>'; }).join('') + '</tr>' : '');
    rows.forEach(function (r, ri) { h += '<tr><td>' + r[0] + '</td>' + vals.map(function (v) { var t = v[r[1]].toFixed(r[2]) + r[3]; return '<td>' + (ri === 0 ? '<b>' + t + '</b>' : t) + '</td>'; }).join('') + '</tr>'; });
    $('probe').innerHTML = h + '</table>';
  }
  function renderSource() {
    var ob = !!wx.observed;
    $('wxBadge').textContent = ob ? '気象：' + (wx.city.short || '') + ' 2025年の観測値' : '気象：平年値からの合成（ダミー）';
    $('annT').textContent = ob ? '年間の推計（' + (wx.city.short || '') + '・2025年の気象）' : '年間の推計（' + wx.city.name + '・合成気象）';
  }

  // ------------------------------------------------------------ 建物の仕様（図面・仕様書の値）
  // 熱伝導率 λ [W/mK]、または厚さによらない熱抵抗 R [㎡K/W]。いずれも一般的な目安の値
  var MATS = {
    steel: { name: '鋼板（折板・金属パネル）', lam: 55 }, conc: { name: 'コンクリート', lam: 1.6 }, alc: { name: 'ALCパネル', lam: 0.19 },
    board: { name: '石こうボード', lam: 0.22 }, ply: { name: '合板', lam: 0.16 }, wwcb: { name: '木毛セメント板', lam: 0.13 },
    gw16: { name: 'グラスウール 16K', lam: 0.045 }, gw24: { name: 'グラスウール 24K', lam: 0.038 }, rw: { name: 'ロックウール', lam: 0.038 },
    xps: { name: '押出法ポリスチレンフォーム', lam: 0.028 }, puf: { name: '硬質ウレタンフォーム', lam: 0.024 }, pus: { name: '吹付け硬質ウレタン', lam: 0.034 },
    air: { name: '空気層（密閉）', R: 0.09 }, refl: { name: '遮熱シート＋空気層', R: 0.3 }
  };
  var GLASS = {
    single: { name: '単板ガラス', sub: 'アルミサッシ', U: 6.0, g: 0.75 }, film: { name: '単板＋遮熱フィルム', sub: '日射をカット', U: 5.8, g: 0.45 },
    double: { name: '複層ガラス', sub: '空気層 6〜12mm', U: 3.5, g: 0.68 }, lowe: { name: 'Low-E 複層ガラス', sub: '樹脂・複合サッシ', U: 2.3, g: 0.42 }
  };
  var REFL = { none: { name: 'なし', a: 0.7 }, paint: { name: '遮熱塗装', a: 0.4 }, sheet: { name: '遮熱シート', a: 0.25 } };
  function defaultSpec() { return { roof: [{ m: 'steel', t: 0.8 }, { m: 'gw16', t: 10 }], wall: [{ m: 'alc', t: 100 }], glass: 'single', refl: 'none', ach: 1.0, image: null, imageName: '' }; }
  function layerR(l) { var m = MATS[l.m]; return !m ? 0 : m.R !== undefined ? m.R : Math.max(0, l.t) / 1000 / m.lam; }
  function uValue(layers, rs) { var r = rs; layers.forEach(function (l) { r += layerR(l); }); return 1 / r; }
  function specIns(sp) { // 仕様から、計算に使う値を求める
    var g = GLASS[sp.glass] || GLASS.single, rf = REFL[sp.refl] || REFL.none;
    return { Ur: uValue(sp.roof, 0.13), Uw: uValue(sp.wall, 0.15), Ug: g.U, shgc: g.g, ach: M.clamp(+sp.ach || 0.5, 0.1, 3), aRoof: rf.a };
  }
  function cleanSpec(o) { // 読み込んだデータを、決まった形だけ受け取る
    var d = defaultSpec(), s = {};
    function layers(a, def) { return Array.isArray(a) && a.length ? a.slice(0, 8).filter(function (l) { return l && MATS[l.m]; }).map(function (l) { return { m: l.m, t: M.clamp(+l.t || 0, 0, 1000) }; }) : def; }
    s.roof = layers(o && o.roof, d.roof); s.wall = layers(o && o.wall, d.wall);
    s.glass = o && GLASS[o.glass] ? o.glass : d.glass; s.refl = o && REFL[o.refl] ? o.refl : d.refl; s.ach = M.clamp(+(o && o.ach) || d.ach, 0.1, 3);
    s.image = o && typeof o.image === 'string' && o.image.indexOf('data:image/') === 0 ? o.image : null; s.imageName = o && typeof o.imageName === 'string' ? o.imageName.slice(0, 80) : '';
    return s;
  }
  function insulLabel() {
    if (S.insul !== 'custom') return M.INSUL[S.insul].label;
    var i = specIns(S.spec); return '詳細入力（屋根 U=' + i.Ur.toFixed(2) + '・壁 U=' + i.Uw.toFixed(2) + '・窓 U=' + i.Ug.toFixed(1) + '）';
  }

  // ------------------------------------------------------------ 断面図と平面図（2Dの図面表示）
  var sheetP = null, zMean = {}, NZS = Math.round(G.H / 0.5), CZS = G.H / NZS;
  function meanJetByHeight(heat) { // 高さごとの、館内平均の相対風速（噴流の温度の広がりに使う）
    var key = heat ? 'h' : 'c'; if (zMean[key]) return zMean[key];
    var out = new Float32Array(NZS);
    for (var j = 0; j < NZS; j++) { var s = 0, n = 0; for (var y = G.ay0 + 1; y < G.ay1; y += 1.5) for (var x = G.ax0 + 1; x < G.ax1; x += 1.5) { s += M.jetNorm(x, y, (j + 0.5) * CZS, heat); n++; } out[j] = s / n; }
    return (zMean[key] = out);
  }
  function profileT(mode, st, heat, j) {
    var dT = mode === 'none' ? 0 : K.dTs[mode][heat ? 'heat' : 'cool'] * (0.3 + 0.7 * Math.abs(st.lf)) * st.fan * 0.6;
    return st.Ta + st.G * ((j + 0.5) * CZS - G.zRef) + dT * meanJetByHeight(heat)[j];
  }
  function drawSheet(sts, heat) {
    var f = fit($('sheet')), c = f.c, w = f.w, h = f.h; if (w < 240 || h < 200) return;
    if (!sheetP) sheetP = { sec: [makeFieldPainter(G.NY, NZS, 6), makeFieldPainter(G.NY, NZS, 6)], plan: [makeFieldPainter(G.NX, G.NY, 4), makeFieldPainter(G.NX, G.NY, 4)], sv: new Float32Array(G.NY * NZS), pv: new Float32Array(N) };
    var ms = [S.left, 'eco'], SX = M.AC_UNITS[4].x, ff = getComputedStyle(document.body).fontFamily, nf = 'Barlow, ' + ff, ink = C['--ink'], ink2 = C['--ink-2'], ink3 = C['--ink-3'];
    var tempLayer = S.layer !== 'wind' && S.layer !== 'wbgt', tlo = tempLayer ? range.lo : sts.eco.Ta - 8, thi = tempLayer ? range.hi : sts.eco.Ta + 8, tstep = tempLayer ? range.step : 1;
    var pad = 14, gap = 18, profW = w < 760 ? 0 : Math.min(240, w * 0.22), colW = (w - pad * 2 - (profW ? profW + gap : 0) - gap) / 2, d = Math.floor(S.t / 24), LYm = G.ay1 - G.ay0, LXm = G.ax1 - G.ax0;
    c.fillStyle = C['--surface']; c.fillRect(0, 0, w, h);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = ink; c.font = '700 15px ' + ff;
    c.fillText('断面図と平面図', pad, 18); c.font = '12px ' + ff; c.fillStyle = ink2;
    c.fillText(fmtDate(d) + ' ' + fmtHour(S.t - d * 24) + '　外気 ' + f1(wxAt(S.t).T) + '℃　' + (heat ? '暖房' : '冷房') + '　※ 簡易モデルによる推計', pad + 122, 19);
    function tag(x, y, text, bold, align) { // 図の上の数値ラベル
      c.font = (bold ? '700 ' : '') + '12.5px ' + nf; var tw = c.measureText(text).width + 8, bx = align === 'left' ? x : x - tw / 2;
      c.fillStyle = C['--surface']; c.globalAlpha = 0.86; c.fillRect(bx, y - 9, tw, 18); c.globalAlpha = 1;
      c.fillStyle = ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, bx + 4, y + 0.5);
    }
    var sc = colW / G.D, secH = (G.H + 0.6) * sc, yHead = 36, ySec = yHead + 30, yPlanT = ySec + secH + 30;
    var ps = Math.min(colW / LXm, (h - yPlanT - 26) / LYm), planW = LXm * ps, planH = LYm * ps;
    ms.forEach(function (m, i) {
      var st = sts[m], x0 = pad + i * (colW + gap), k, j;
      // 見出し
      c.fillStyle = C['--m-' + m]; c.beginPath(); c.arc(x0 + 7, yHead + 10, 6, 0, 6.2832); c.fill();
      c.fillStyle = ink; c.font = '700 14px ' + ff; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(MODE_NAME[m], x0 + 19, yHead + 10);
      c.font = '12px ' + ff; c.fillStyle = ink2; c.textAlign = 'right';
      c.fillText('体感 ' + f1(st.OT) + '℃　ムラ ±' + spread[m].toFixed(1) + '℃　電力 ' + Math.round(st.P) + 'kW', x0 + colW, yHead + 10);
      // ---- A-A 断面（空気温度）
      for (j = 0; j < NZS; j++) for (k = 0; k < G.NY; k++) sheetP.sv[j * G.NY + k] = M.airAt(SX, M.gy(k), (NZS - 1 - j + 0.5) * CZS, m, st, heat).T;
      sheetP.sec[i].paint(sheetP.sv, LUT.temp, tlo, thi, tstep, hex(ink), banded());
      function Y(y) { return x0 + y * sc; } function Z(z) { return ySec + (G.H + 0.6 - z) * sc; }
      c.drawImage(sheetP.sec[i].canvas, Y(G.ay0), Z(G.H), LYm * sc, G.H * sc);
      // 建物の輪郭：外壁、屋根、トラス、2階ギャラリー、壁掛形エアコンとパネル
      c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(Y(0), Z(G.H), G.D * sc, G.H * sc);
      c.lineWidth = 3; c.beginPath(); c.moveTo(Y(-0.6), Z(G.H)); c.lineTo(Y(G.D + 0.6), Z(G.H)); c.stroke();
      c.strokeStyle = ink3; c.lineWidth = 1; c.globalAlpha = 0.8; c.beginPath();
      var nt = 8, dyt = G.D / nt;
      for (var ti = 0; ti < nt; ti++) { c.moveTo(Y(ti * dyt), Z(G.H - 0.15)); c.lineTo(Y((ti + 0.5) * dyt), Z(G.trussZ + 0.1)); c.lineTo(Y((ti + 1) * dyt), Z(G.H - 0.15)); }
      c.moveTo(Y(0), Z(G.trussZ + 0.1)); c.lineTo(Y(G.D), Z(G.trussZ + 0.1)); c.stroke(); c.globalAlpha = 1;
      [[0, 1], [G.D, -1]].forEach(function (sd) {
        var ye = sd[0] + sd[1] * G.galleryD, xa = Math.min(Y(sd[0]), Y(ye));
        c.fillStyle = C['--surface-2']; c.strokeStyle = ink; c.lineWidth = 1;
        c.fillRect(xa, Z(G.galleryZ), G.galleryD * sc, 0.25 * sc + 1); c.strokeRect(xa, Z(G.galleryZ), G.galleryD * sc, 0.25 * sc + 1);
        c.beginPath(); c.moveTo(Y(ye), Z(G.galleryZ)); c.lineTo(Y(ye), Z(G.galleryZ + 1.1)); c.stroke();
        c.fillStyle = '#f4f4f2'; c.fillRect(Y(ye) - (sd[1] > 0 ? 0 : 0.27 * sc), Z(5.05), 0.27 * sc, 0.3 * sc); c.strokeRect(Y(ye) - (sd[1] > 0 ? 0 : 0.27 * sc), Z(5.05), 0.27 * sc, 0.3 * sc); // 壁掛形エアコン
      });
      if (m === 'eco') { // 断面の近くにあるパネル
        var seen = {}; c.fillStyle = rgb(colorAt(LUT.temp, st.Tp, tlo, thi)); c.strokeStyle = ink; c.lineWidth = 1;
        panels.forEach(function (P) {
          var ky = Math.round(P.y * 2), pz = P.z === undefined ? M.PANEL.z0 : P.z; if (Math.abs(P.x - SX) > 2.6 || seen[ky]) return; seen[ky] = 1;
          var pw = Math.max(3, (P.axis === 'x' ? M.PANEL.w : 0.135) * sc); c.fillRect(Y(P.y) - pw / 2, Z(pz + M.PANEL.h), pw, M.PANEL.h * sc); c.strokeRect(Y(P.y) - pw / 2, Z(pz + M.PANEL.h), pw, M.PANEL.h * sc);
        });
      }
      // 床上1.5mの線と、その高さの温度
      c.strokeStyle = ink; c.lineWidth = 1; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(Y(G.ay0), Z(1.5)); c.lineTo(Y(G.ay1), Z(1.5)); c.stroke(); c.setLineDash([]);
      [G.ay0 + LYm * 0.17, G.ay0 + LYm * 0.5, G.ay0 + LYm * 0.83].forEach(function (yy) {
        c.fillStyle = ink; c.beginPath(); c.arc(Y(yy), Z(1.5), 2.2, 0, 6.2832); c.fill();
        tag(Y(yy), Z(1.5) - 13, f1(M.airAt(SX, yy, 1.5, m, st, heat).T) + '℃', true);
      });
      tag(Y(G.D / 2), Z(G.H - 1.6), '屋根の下 ' + f1(M.airAt(SX, G.D / 2, G.H - 1.6, m, st, heat).T) + '℃', true);
      c.font = '10.5px ' + ff; c.fillStyle = ink2; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('▼床上1.5m', Y(G.ay0) + 3, Z(1.5) + 2);
      c.font = '11.5px ' + ff; c.fillStyle = ink2; c.textBaseline = 'middle'; c.fillText('A−A 断面の空気温度', x0, ySec + secH + 12);
      // ---- 平面（選んだ高さ・選んだ値）
      var px0 = x0 + (colW - planW) / 2, py0 = yPlanT;
      M.computeField(S.layer, m, st, heat, S.z, F, heat ? jet.heat : jet.cool, sheetP.pv);
      sheetP.plan[i].paint(sheetP.pv, lutFor(S.layer), range.lo, range.hi, range.step, hex(ink), banded() && tempLayer);
      c.drawImage(sheetP.plan[i].canvas, px0, py0, planW, planH);
      function PX(x) { return px0 + (x - G.ax0) * ps; } function PY(y) { return py0 + (y - G.ay0) * ps; }
      c.strokeStyle = ink; c.lineWidth = 2; c.strokeRect(px0, py0, planW, planH);
      c.fillStyle = '#d9d0a9'; c.strokeStyle = ink3; c.lineWidth = 1;
      M.AC_UNITS.forEach(function (u) { var uy = u.dir > 0 ? py0 + G.galleryD * ps - 2 : py0 + planH - G.galleryD * ps - 2; if (PX(u.x) < px0 || PX(u.x) > px0 + planW) return; c.fillRect(PX(u.x) - 4, uy, 8, 4); c.strokeRect(PX(u.x) - 4, uy, 8, 4); });
      if (m === 'eco') { c.fillStyle = C['--m-eco']; panels.forEach(function (P) { var lw = Math.max(2, M.PANEL.w * ps), th = 2.4; if (P.axis === 'y') c.fillRect(PX(P.x) - lw / 2, PY(P.y) - th / 2, lw, th); else c.fillRect(PX(P.x) - th / 2, PY(P.y) - lw / 2, th, lw); }); }
      c.strokeStyle = '#d03b3b'; c.lineWidth = 1.5; c.setLineDash([7, 3, 2, 3]); c.beginPath(); c.moveTo(PX(SX), py0 - 8); c.lineTo(PX(SX), py0 + planH + 8); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#d03b3b'; c.font = '700 11px ' + nf; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', PX(SX) - 9, py0 - 7); c.fillText('A', PX(SX) - 9, py0 + planH + 8);
      var dg = S.layer === 'wind' ? 2 : 1, un = S.layer === 'wind' ? 'm/s' : S.layer === 'wbgt' ? '' : '℃';
      [0.14, 0.5, 0.86].forEach(function (fy) { [0.16, 0.5, 0.84].forEach(function (fx) {
        var gx = Math.floor(G.NX * fx), gy = Math.floor(G.NY * fy), xx = px0 + planW * fx, yy = py0 + planH * fy;
        c.fillStyle = ink; c.beginPath(); c.arc(xx, yy, 2.2, 0, 6.2832); c.fill();
        tag(xx, yy - 13, sheetP.pv[gy * G.NX + gx].toFixed(dg) + un, true);
      }); });
      c.font = '11.5px ' + ff; c.fillStyle = ink2; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('床上 ' + S.z + 'm の' + LAYER[S.layer].name + '（青い線：パネル　白い印：壁掛エアコン）', x0, py0 + planH + 14);
    });
    // ---- 高さごとの空気温度（館内平均）と凡例
    if (profW) {
      var gx0 = w - pad - profW, gy0 = ySec + 4, gh = Math.min(h - gy0 - 96, 380), L = 30, gw = profW - L - 8, lo = tlo, hi = thi;
      c.fillStyle = ink; c.font = '700 12.5px ' + ff; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('高さごとの空気温度', gx0, yHead + 4);
      c.font = '11px ' + ff; c.fillStyle = ink2; c.fillText('館内の平均', gx0, yHead + 20);
      function TX(t) { return gx0 + L + gw * M.clamp((t - lo) / (hi - lo), 0, 1); } function TZ(z) { return gy0 + gh * (1 - z / G.H); }
      c.strokeStyle = C['--line']; c.lineWidth = 1; c.fillStyle = ink2; c.font = '10.5px ' + nf;
      [0, 2, 4, 6, 8, 10].forEach(function (z) { c.beginPath(); c.moveTo(gx0 + L, TZ(z) + 0.5); c.lineTo(gx0 + L + gw, TZ(z) + 0.5); c.stroke(); c.textAlign = 'right'; c.fillText(z + 'm', gx0 + L - 4, TZ(z)); });
      for (var q2 = 0; q2 <= 4; q2++) { var tv = lo + (hi - lo) * q2 / 4; c.textAlign = 'center'; c.fillText(tv.toFixed(0), TX(tv), gy0 + gh + 10); }
      c.strokeStyle = ink3; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(gx0 + L, TZ(1.5)); c.lineTo(gx0 + L + gw, TZ(1.5)); c.stroke(); c.setLineDash([]);
      c.textAlign = 'right'; c.fillStyle = ink3; c.font = '10px ' + ff; c.fillText('人の高さ 1.5m', gx0 + L + gw, TZ(1.5) - 8);
      c.strokeStyle = ink; c.lineWidth = 1.5; c.strokeRect(gx0 + L, gy0, gw, gh);
      var note = [];
      ms.forEach(function (m, i) {
        c.strokeStyle = C['--m-' + m]; c.lineWidth = 2.5; c.lineJoin = 'round'; c.beginPath();
        for (var j = 0; j < NZS; j++) { var t = profileT(m, sts[m], heat, j), xq = TX(t), yq = TZ((j + 0.5) * CZS); if (j) c.lineTo(xq, yq); else c.moveTo(xq, yq); }
        c.stroke();
        var jl = Math.floor(1.5 / CZS), jt = NZS - 3, tLow = profileT(m, sts[m], heat, jl), tTop = profileT(m, sts[m], heat, jt);
        c.fillStyle = C['--m-' + m]; c.strokeStyle = C['--surface']; c.lineWidth = 2;
        [[tLow, (jl + 0.5) * CZS], [tTop, (jt + 0.5) * CZS]].forEach(function (pt) { c.beginPath(); c.arc(TX(pt[0]), TZ(pt[1]), 4, 0, 6.2832); c.fill(); c.stroke(); });
        note.push({ m: m, low: tLow, top: tTop });
      });
      var ny = gy0 + gh + 30;
      c.font = '11.5px ' + ff; c.textAlign = 'left'; c.fillStyle = ink2; c.fillText('屋根の下と人の高さの差', gx0, ny);
      note.forEach(function (nn, i) {
        var yy = ny + 19 + i * 19; c.fillStyle = C['--m-' + nn.m]; c.fillRect(gx0, yy - 2, 12, 4);
        c.fillStyle = ink; c.font = '12px ' + ff; c.fillText(shortName(nn.m), gx0 + 17, yy);
        c.font = '700 13.5px ' + nf; c.textAlign = 'right'; c.fillText((nn.top - nn.low >= 0 ? '+' : '−') + Math.abs(nn.top - nn.low).toFixed(1) + '℃', gx0 + profW, yy); c.textAlign = 'left';
      });
      // 凡例（断面の色）
      var ly = h - 30;
      for (var xb = 0; xb < profW; xb++) { var li = Math.round(xb / (profW - 1) * 511) * 3; c.fillStyle = 'rgb(' + LUT.temp[li] + ',' + LUT.temp[li + 1] + ',' + LUT.temp[li + 2] + ')'; c.fillRect(gx0 + xb, ly, 1.5, 10); }
      c.fillStyle = ink2; c.font = '10.5px ' + nf; c.textBaseline = 'middle';
      for (var q3 = 0; q3 <= 4; q3++) { c.textAlign = q3 === 0 ? 'left' : q3 === 4 ? 'right' : 'center'; c.fillText((tlo + (thi - tlo) * q3 / 4).toFixed(0), gx0 + profW * q3 / 4, ly + 20); }
      c.textAlign = 'left'; c.font = '10.5px ' + ff; c.fillText('空気温度（℃）', gx0, ly - 9);
    }
  }

  // ------------------------------------------------------------ 検証シート（縦のレポート。1枚の画像として描く）
  var repP = null, jet15 = {};
  function banded() { return S.palette === 'rainbow'; }
  function drawReport(cv, sts, heat) {
    var RW = 1240, RH = 1754, c = cv.getContext('2d'); cv.width = RW; cv.height = RH;
    if (!repP) repP = { sec: [makeFieldPainter(G.NY, NZS, 8), makeFieldPainter(G.NY, NZS, 8)], plan: [makeFieldPainter(G.NX, G.NY, 6), makeFieldPainter(G.NX, G.NY, 6)], sv: new Float32Array(G.NY * NZS), pv: new Float32Array(N) };
    var key = heat ? 'h' : 'c'; if (!jet15[key]) jet15[key] = M.computeJetPattern(1.5, heat);
    var ff = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", "IPAPGothic", sans-serif', nf = 'Barlow, ' + ff;
    var INK = '#1b2733', INK2 = '#4c5966', CY = '#2aa7e1', CYD = '#1479b8', RED = '#d6352b', ms = [S.left, 'eco'], SX = M.AC_UNITS[4].x;
    var d = Math.floor(S.t / 24), w = wxAt(S.t), sum = sim.summary, a = sum.modes.ac, e = sum.modes.eco, ins = S.insul === 'custom' ? specIns(S.spec) : M.INSUL[S.insul];
    // 色の範囲は、1℃刻みで読みやすい幅にそろえる
    var lo = Math.floor(range.lo), hi = Math.ceil(range.hi), step = (hi - lo) > 16 ? 1 : 0.5;
    if (S.layer === 'wind' || S.layer === 'wbgt') { lo = Math.floor(sts.eco.Ta - 8); hi = lo + 16; step = 0.5; }
    function T(text, x, y, font, color, align) { c.font = font; c.fillStyle = color || INK; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(text, x, y); }
    function wrap(text, x, y, maxW, lh, font, color) { // 日本語の文を、幅に合わせて折り返す
      c.font = font; c.fillStyle = color || INK; c.textAlign = 'left'; c.textBaseline = 'middle'; var line = '';
      for (var i = 0; i < text.length; i++) { var ch = text[i]; if (ch === '\n' || c.measureText(line + ch).width > maxW) { c.fillText(line, x, y); y += lh; line = ch === '\n' ? '' : ch; } else line += ch; }
      if (line) { c.fillText(line, x, y); y += lh; } return y;
    }
    function rr(x, y, w2, h2, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w2, y, x + w2, y + h2, r); c.arcTo(x + w2, y + h2, x, y + h2, r); c.arcTo(x, y + h2, x, y, r); c.arcTo(x, y, x + w2, y, r); c.closePath(); }
    function label(x, y, text, size) { c.font = '700 ' + (size || 19) + 'px ' + nf; var tw = c.measureText(text).width; c.fillStyle = 'rgba(255,255,255,.82)'; c.fillRect(x - tw / 2 - 4, y - 12, tw + 8, 24); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1); }
    function heading(text, y) { c.font = '700 25px ' + ff; var tw = c.measureText(text).width; c.fillStyle = '#bfe3f7'; c.beginPath(); c.moveTo(30, y + 10); c.lineTo(tw + 70, y + 10); c.lineTo(tw + 56, y + 22); c.lineTo(30, y + 22); c.closePath(); c.fill(); T(text, 34, y, '700 25px ' + ff, INK); }
    function legend(x, y, w2) {
      for (var i = 0; i < w2; i++) { var v = lo + (hi - lo) * i / (w2 - 1), vb = banded() ? (Math.floor(v / step) + 0.5) * step : v, col = colorAt(LUT.temp, vb, lo, hi); c.fillStyle = rgb(col); c.fillRect(x + i, y, 1.5, 13); }
      c.strokeStyle = INK2; c.lineWidth = 1; c.strokeRect(x, y, w2, 13);
      var n = (hi - lo) <= 12 ? (hi - lo) / 2 : (hi - lo) / 4; for (var k = 0; k <= n; k++) T(String(Math.round(lo + (hi - lo) * k / n)), x + w2 * k / n, y + 26, '15px ' + nf, INK2, 'center');
      T('℃', x + w2 + 14, y + 26, '14px ' + ff, INK2);
    }
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, RW, RH);
    // ---- 見出しの帯
    c.fillStyle = '#e9edf2'; c.fillRect(0, 0, RW, 132);
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(74, 66, 50, 0, 6.2832); c.fill(); c.stroke();
    T('検 証', 74, 46, '700 22px ' + ff, INK, 'center'); T('1', 74, 82, '700 40px ' + nf, INK, 'center');
    T('【空調方式】', 150, 24, '700 21px ' + ff, INK); c.fillStyle = '#62c0c7'; rr(150, 42, 250, 70, 6); c.fill(); T('対流式', 275, 62, '700 22px ' + ff, '#fff', 'center'); T('＋ 輻射パネル', 275, 92, '700 22px ' + ff, '#fff', 'center');
    T('【比べる相手】', 420, 24, '700 21px ' + ff, INK); c.fillStyle = CYD; rr(420, 42, 220, 70, 6); c.fill(); T(MODE_NAME[ms[0]], 530, 77, '700 23px ' + ff, '#fff', 'center');
    wrap('本検証は、簡易的な建物モデルを用いて、ecowinハイブリッド（壁掛形エアコン＋輻射パネル）の有無による違いを比較したものです。実際の施設に必要な空調設備の能力は、建物の仕様や運用条件、夏季・冬季の使用状況を踏まえて、個別に検討する必要があります。', 668, 24, 552, 25, '17px ' + ff, INK2);
    // ---- KEY PLAN と仕様表
    T('KEY PLAN', 34, 172, '20px ' + nf, INK);
    var kx = 150, ky = 150, ks = 300 / G.W, kw = G.W * ks, kh = G.D * ks;
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(kx, ky, kw, kh); c.lineWidth = 1; c.strokeStyle = '#9aa3ad';
    c.strokeRect(kx, ky, kw, G.galleryD * ks); c.strokeRect(kx, ky + kh - G.galleryD * ks, kw, G.galleryD * ks);
    M.AC_UNITS.forEach(function (u) {
      var ux = kx + u.x * ks, uy = ky + u.y * ks; c.fillStyle = RED; c.fillRect(ux - 7, uy - 2, 14, 4);
      c.strokeStyle = '#2f8fea'; c.lineWidth = 2; c.beginPath(); c.moveTo(ux, uy + u.dir * 8); c.lineTo(ux, uy + u.dir * 34); c.stroke();
      c.fillStyle = '#2f8fea'; c.beginPath(); c.moveTo(ux, uy + u.dir * 40); c.lineTo(ux - 5, uy + u.dir * 30); c.lineTo(ux + 5, uy + u.dir * 30); c.closePath(); c.fill();
    });
    c.strokeStyle = RED; c.lineWidth = 1.5; c.beginPath(); c.moveTo(kx + SX * ks, ky - 12); c.lineTo(kx + SX * ks, ky + kh + 12); c.stroke();
    T('A', kx + SX * ks - 12, ky - 10, '700 15px ' + nf, RED, 'center'); T('A', kx + SX * ks - 12, ky + kh + 12, '700 15px ' + nf, RED, 'center');
    T('赤い印は室内機（16台）を示す', kx, ky + kh + 30, '15px ' + ff, INK2);
    var tx = 500, ty = 150, tw1 = 330, tw2 = 386, th = 46;
    c.fillStyle = '#55c0ee'; c.fillRect(tx, ty, tw1 + tw2, th); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx + tw1, ty); c.lineTo(tx + tw1, ty + th); c.stroke();
    T('空調設備の仕様', tx + tw1 / 2, ty + th / 2, '700 20px ' + ff, '#fff', 'center'); T('建物の仕様', tx + tw1 + tw2 / 2, ty + th / 2, '700 20px ' + ff, '#fff', 'center');
    c.strokeStyle = '#55c0ee'; c.lineWidth = 1.5; c.strokeRect(tx, ty, tw1 + tw2, 232); c.beginPath(); c.moveTo(tx + tw1, ty + th); c.lineTo(tx + tw1, ty + 232); c.moveTo(tx, ty + 139); c.lineTo(tx + tw1, ty + 139); c.stroke();
    T(MODE_NAME[ms[0]], tx + tw1 / 2, ty + 68, '700 18px ' + ff, INK, 'center');
    T(ms[0] === 'none' ? '空調を運転しない場合' : '壁掛形 冷房 約' + Math.round(sum.cap.ac.cool / 1000) + 'kW 相当', tx + tw1 / 2, ty + 96, '17px ' + ff, INK, 'center');
    T(ms[0] === 'none' ? '' : S.acMode === 'custom' ? '（入力した能力。COP 冷房 ' + S.acCopC.toFixed(1) + '・暖房 ' + S.acCopH.toFixed(1) + '）' : '（補正係数 0.7 で割り戻した仮定）', tx + tw1 / 2, ty + 120, '14.5px ' + ff, INK2, 'center');
    T('ecowinハイブリッド', tx + tw1 / 2, ty + 160, '700 18px ' + ff, RED, 'center');
    T('室内機 冷房 10.0kW × 16台／室外機 20.0kW × 8台', tx + tw1 / 2, ty + 186, '15.5px ' + ff, INK, 'center');
    T('輻射パネル W2,200×H600 × ' + panels.length + '台', tx + tw1 / 2, ty + 210, '15.5px ' + ff, INK, 'center');
    var bx = tx + tw1 + 16, rows = [['建物', G.name + '（設計図）'], ['アリーナ', G.W + 'm × ' + G.D.toFixed(1) + 'm、屋根まで ' + G.H + 'm'], ['断熱', S.insul === 'custom' ? '図面・仕様書から入力' : M.INSUL[S.insul].label],
      ['屋根／壁／窓', 'U = ' + ins.Ur.toFixed(2) + ' ／ ' + ins.Uw.toFixed(2) + ' ／ ' + ins.Ug.toFixed(1) + ' W/㎡K'], ['使い方', S.occupants + '人、' + S.opStart + '時〜' + S.opEnd + '時、設定 冬' + S.setHeat + '℃・夏' + S.setCool + '℃'], ['気象', (wx.city.short || wx.city.name) + (wx.observed ? '（2025年の観測値）' : '（合成）')]];
    rows.forEach(function (r, i) { T(r[0], bx, ty + 68 + i * 28, '700 15.5px ' + ff, INK2); T(r[1], bx + 104, ty + 68 + i * 28, '15.5px ' + ff, INK); });
    // ---- 温度分布
    heading(fmtDate(d) + ' ' + fmtHour(S.t - d * 24) + ' の温度分布（外気 ' + f1(w.T) + '℃・' + (heat ? '暖房' : '冷房') + '）', 432);
    var colW = 575, gap = 30, x0s = [30, 30 + colW + gap], sc = colW / (G.D + 1.2), secH = (G.H + 0.5) * sc, ySec = 512, spreadT = [0, 0], topT = [0, 0], lowT = [0, 0], cen = [0, 0], edge = [0, 0];
    ms.forEach(function (m, i) {
      var st = sts[m], x0 = x0s[i], j, k;
      T('CASE', x0 + colW / 2 - 118, 478, '26px ' + nf, INK, 'center'); T(String(i + 1), x0 + colW / 2 - 70, 474, '700 36px ' + nf, INK, 'center'); T(MODE_NAME[m], x0 + colW / 2 - 46, 478, '700 24px ' + ff, INK);
      for (j = 0; j < NZS; j++) for (k = 0; k < G.NY; k++) repP.sv[j * G.NY + k] = M.airAt(SX, M.gy(k), (NZS - 1 - j + 0.5) * CZS, m, st, heat).T;
      repP.sec[i].paint(repP.sv, LUT.temp, lo, hi, step, [20, 28, 36], banded());
      function Y(y) { return x0 + (y + 0.6) * sc; } function Z(z) { return ySec + (G.H + 0.5 - z) * sc; }
      c.fillStyle = '#f3f5f7'; c.fillRect(x0, ySec - 6, colW, secH + 12); c.strokeStyle = '#b7bfc7'; c.lineWidth = 1; c.strokeRect(x0, ySec - 6, colW, secH + 56);
      c.drawImage(repP.sec[i].canvas, Y(G.ay0), Z(G.H), (G.ay1 - G.ay0) * sc, G.H * sc);
      c.strokeStyle = '#111'; c.lineWidth = 3; c.strokeRect(Y(0), Z(G.H), G.D * sc, G.H * sc); c.lineWidth = 5; c.beginPath(); c.moveTo(Y(-0.5), Z(G.H)); c.lineTo(Y(G.D + 0.5), Z(G.H)); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1; c.beginPath();
      for (var ti = 0; ti < 8; ti++) { c.moveTo(Y(ti * G.D / 8), Z(G.H - 0.15)); c.lineTo(Y((ti + 0.5) * G.D / 8), Z(G.trussZ + 0.1)); c.lineTo(Y((ti + 1) * G.D / 8), Z(G.H - 0.15)); }
      c.moveTo(Y(0), Z(G.trussZ + 0.1)); c.lineTo(Y(G.D), Z(G.trussZ + 0.1)); c.stroke();
      [[0, 1], [G.D, -1]].forEach(function (sd) {
        var ye = sd[0] + sd[1] * G.galleryD, xa = Math.min(Y(sd[0]), Y(ye));
        c.fillStyle = '#111'; c.fillRect(xa, Z(G.galleryZ), G.galleryD * sc, 4); c.fillRect(Y(ye) - 1, Z(G.galleryZ + 1.1), 2, 1.1 * sc);
        c.fillStyle = '#fff'; c.strokeStyle = RED; c.lineWidth = 2; var ux = Y(ye) - (sd[1] > 0 ? 0 : 0.3 * sc); c.fillRect(ux, Z(5.05), 0.3 * sc + 2, 0.3 * sc); c.strokeRect(ux, Z(5.05), 0.3 * sc + 2, 0.3 * sc);
        if (m === 'eco') panels.forEach(function (P, pi) { if (pi > 1 || (P.y < G.D / 2) !== (sd[1] > 0)) return; var pz = P.z === undefined ? M.PANEL.z0 : P.z; c.fillStyle = '#1479b8'; c.fillRect(Y(P.y) - 2, Z(pz + M.PANEL.h), 4, M.PANEL.h * sc); });
      });
      c.strokeStyle = '#111'; c.lineWidth = 1; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(Y(G.ay0), Z(1.5)); c.lineTo(Y(G.ay1), Z(1.5)); c.stroke(); c.setLineDash([]);
      T('▼1FL+1,500', Y(0.4), Z(1.5) - 10, '12px ' + nf, '#111'); T('▼1FL', Y(0.4), Z(0) - 9, '12px ' + nf, '#111');
      [0.2, 0.5, 0.8].forEach(function (fq) { var yy = G.ay0 + (G.ay1 - G.ay0) * fq; label(Y(yy), Z(1.5) - 16, f1(M.airAt(SX, yy, 1.5, m, st, heat).T) + '℃'); });
      topT[i] = M.airAt(SX, G.D / 2, G.H - 1.6, m, st, heat).T; lowT[i] = M.airAt(SX, G.D / 2, 1.5, m, st, heat).T; label(Y(G.D / 2), Z(G.H - 1.6), f1(topT[i]) + '℃');
      T('アリーナ A−A 断面の温度分布図', x0 + 10, ySec + secH + 28, '15px ' + ff, INK); legend(x0 + 262, ySec + secH + 10, 270);
      // 床上1.5mの温度分布（斜めから見た図）
      M.computeField('ta', m, st, heat, 1.5, F, jet15[key], repP.pv);
      repP.plan[i].paint(repP.pv, LUT.temp, lo, hi, step, [20, 28, 36], banded());
      var py = ySec + secH + 78, ph = 388, pw = colW, ox = x0 + 208, oy = py + 44, ax = 9.2, ay = 3.9, bxv = -4.7, byv = 7.9; // 斜めの軸：x方向（東）と y方向（南）の1mあたりの画素
      c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 1.5; c.fillRect(x0, py, pw, ph); c.strokeRect(x0, py, pw, ph);
      function OP(x, y) { return [ox + x * ax + y * bxv, oy + x * ay + y * byv]; }
      function poly(pts, fill, stroke) { c.beginPath(); pts.forEach(function (p, q) { if (q) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } }
      poly([OP(-2.5, -2.5), OP(G.W + 2.5, -2.5), OP(G.W + 2.5, G.D + 2.5), OP(-2.5, G.D + 2.5)], '#d5d8dc', '#8d949b'); // 外まわりの床
      var p3 = OP(G.W + 2.5, G.D + 2.5), p4 = OP(-2.5, G.D + 2.5), p2 = OP(G.W + 2.5, -2.5);
      poly([p4, p3, [p3[0], p3[1] + 14], [p4[0], p4[1] + 14]], '#b9bec4', '#8d949b'); poly([p3, p2, [p2[0], p2[1] + 14], [p3[0], p3[1] + 14]], '#c6cace', '#8d949b');
      c.save(); c.setTransform(ax, ay, bxv, byv, ox, oy); c.imageSmoothingEnabled = true;
      c.drawImage(repP.plan[i].canvas, G.ax0, G.ay0, G.ax1 - G.ax0, G.ay1 - G.ay0); c.restore();
      poly([OP(G.ax0, G.ay0), OP(G.ax1, G.ay0), OP(G.ax1, G.ay1), OP(G.ax0, G.ay1)], null, '#111');
      M.AC_UNITS.forEach(function (u) { var q = OP(u.x, u.dir > 0 ? -0.6 : G.D + 0.6); c.fillStyle = '#fff'; c.strokeStyle = '#555'; c.lineWidth = 1; c.beginPath(); c.ellipse(q[0], q[1], 9, 4, 0.4, 0, 6.2832); c.fill(); c.stroke(); });
      [[0.2, 0.22], [0.5, 0.22], [0.8, 0.22], [0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.2, 0.78], [0.5, 0.78], [0.8, 0.78]].forEach(function (fq) {
        var gx = Math.floor(G.NX * fq[0]), gy = Math.floor(G.NY * fq[1]), q = OP(M.gx(gx), M.gy(gy)), v = repP.pv[gy * G.NX + gx];
        c.fillStyle = '#111'; c.beginPath(); c.arc(q[0], q[1], 2.5, 0, 6.2832); c.fill(); label(q[0], q[1] - 16, f1(v) + '℃');
      });
      c.fillStyle = '#fff'; c.strokeStyle = '#b7bfc7'; c.lineWidth = 1; c.fillRect(x0 + 12, py + ph - 40, 250, 28); c.strokeRect(x0 + 12, py + ph - 40, 250, 28); T('アリーナ床上1.5mの温度分布図', x0 + 22, py + ph - 26, '15px ' + ff, INK);
      var s1 = 0, s2 = 0, n1 = 0, n2 = 0, mean = 0, vv = 0, q2;
      for (q2 = 0; q2 < N; q2++) mean += repP.pv[q2]; mean /= N; for (q2 = 0; q2 < N; q2++) { var dd = repP.pv[q2] - mean; vv += dd * dd; var jy = Math.floor(q2 / G.NX); if (jy > G.NY * 0.35 && jy < G.NY * 0.65) { s1 += repP.pv[q2]; n1++; } else if (jy < G.NY * 0.12 || jy > G.NY * 0.88) { s2 += repP.pv[q2]; n2++; } }
      spreadT[i] = Math.sqrt(vv / N); cen[i] = s1 / n1; edge[i] = s2 / n2;
    });
    // ---- 説明文
    var yT = ySec + secH + 78 + 388 + 34, on0 = Math.abs(sts[ms[0]].lf) > 0.02 || sts[ms[0]].fan > 0.02, wA = maxWind(sts[ms[0]], ms[0], heat), wE = maxWind(sts.eco, 'eco', heat);
    var txt = '　温度分布図では、' + (ms[0] === 'none' ? '空調を運転しない場合、アリーナ中央部の床上1.5mの温度は ' + f1(cen[0]) + '℃ となった。' :
      on0 ? MODE_NAME[ms[0]] + 'は吹出し気流が届くアリーナ中央部（' + f1(cen[0]) + '℃）と、気流が届きにくい周辺部（' + f1(edge[0]) + '℃）で温度に差があり、床上1.5mのばらつきは ±' + spreadT[0].toFixed(1) + '℃ であった。' : 'この時刻は空調の運転時間外で、床上1.5mの温度は ' + f1(cen[0]) + '℃ であった。') +
      '\n　ecowinハイブリッドでは、床上1.5mの温度は中央部 ' + f1(cen[1]) + '℃・周辺部 ' + f1(edge[1]) + '℃、ばらつきは ±' + spreadT[1].toFixed(1) + '℃ となった。屋根の下と床上1.5mの温度差は ' + MODE_NAME[ms[0]] + ' ' + f1(Math.abs(topT[0] - lowT[0])) + '℃ に対して ' + f1(Math.abs(topT[1] - lowT[1])) + '℃、人の高さのいちばん強い風は ' + wA.toFixed(1) + 'm/s に対して ' + wE.toFixed(1) + 'm/s である。';
    yT = wrap(txt, 30, yT, RW - 60, 30, '19px ' + ff, INK);
    // ---- 年間の比較
    heading('年間の消費電力量と最大需要電力の比較', yT + 26);
    var yB = yT + 74, pk = a.contract > 0 ? (1 - e.contract / a.contract) * 100 : 0;
    T('　エアコンのみと ecowinハイブリッドを1年間（' + (wx.city.short || wx.city.name) + 'の気象）で比べた結果、', 30, yB, '19px ' + ff, INK);
    T('最大需要電力が', 30, yB + 40, '700 20px ' + ff, INK); T(pk.toFixed(0) + '%低減', 196, yB + 38, '700 34px ' + nf, CYD);
    c.font = '700 34px ' + nf; var w1 = c.measureText(pk.toFixed(0) + '%低減').width;
    T('、年間の消費電力量が', 204 + w1, yB + 40, '700 20px ' + ff, INK); T((sum.rate * 100).toFixed(0) + '%低減', 418 + w1, yB + 38, '700 34px ' + nf, CYD);
    c.font = '700 34px ' + nf; var w2 = c.measureText((sum.rate * 100).toFixed(0) + '%低減').width; T('する結果となった。', 428 + w1 + w2, yB + 40, '20px ' + ff, INK);
    T('　電気代は年間 ' + man(a.cost) + '万円 → ' + man(e.cost) + '万円（基本料金を含む。単価 ' + S.price + '円/kWh、基本料金 ' + S.basic + '円/kW月）。', 30, yB + 82, '19px ' + ff, INK);
    // ---- CASE の箱
    var cy = yB + 116; c.fillStyle = '#55c0ee'; c.fillRect(270, cy, 320, 76); c.strokeStyle = '#55c0ee'; c.lineWidth = 3; c.strokeRect(270, cy, 700, 76);
    T('ecowinハイブリッド', 430, cy + 24, '700 22px ' + ff, INK, 'center'); T('設計図の設備容量', 430, cy + 54, '20px ' + ff, INK, 'center');
    T('室内機冷房能力：10.0kW × 16台', 612, cy + 24, '19px ' + ff, INK); T('室外機：20.0kW × 8台　輻射パネル：' + panels.length + '台', 612, cy + 54, '19px ' + ff, INK);
    T('※ 数値はすべて簡易モデルによる推計値で、実測値や保証値ではありません。3次元の気流解析（CFD）ではなく、噴流の近似式による分布です。', 30, RH - 26, '14.5px ' + ff, INK2);
  }

  // ------------------------------------------------------------ 営業向け：強みの比較と節約額
  var spread = { none: 0, ac: 0, eco: 0 };
  function fieldSpread(mode, st, heat) { // 体感温度の場所によるばらつき（標準偏差）
    var mean = M.computeField('ot', mode, st, heat, S.z, F, heat ? jet.heat : jet.cool, scratch), v = 0;
    for (var i = 0; i < N; i++) { var d = scratch[i] - mean; v += d * d; }
    return Math.sqrt(v / N);
  }
  function renderScore(sts, heat) {
    var a = sts.ac, e = sts.eco, top = G.H - 0.5 - G.zRef;
    var rows = [
      ['風の強さ', '弱いほど、羽根やボールが流されにくい', maxWind(a, 'ac', heat), maxWind(e, 'eco', heat), 1, 'm/s', true],
      ['場所による温度のムラ', '小さいほど、どこにいても同じ体感', spread.ac, spread.eco, 1, '℃', true, '±'],
      ['屋根の下にたまる熱', '腰の高さとの空気温度の差。小さいほど無駄が少ない', Math.abs(a.G * top), Math.abs(e.G * top), 1, '℃', true],
      ['消費電力', 'いまこの瞬間に使っている電力', a.P, e.P, 0, 'kW', true],
      ['体感温度', '同じ体感になるように運転しています', a.OT, e.OT, 1, '℃', false]
    ];
    $('score').innerHTML = rows.map(function (r) {
      var mx = Math.max(Math.abs(r[2]), Math.abs(r[3]), 1e-6), chip, cls = 'same';
      if (!r[6]) chip = Math.abs(r[2] - r[3]) < 0.35 ? 'ほぼ同じ' : (r[3] > r[2] ? '+' : '−') + Math.abs(r[3] - r[2]).toFixed(1) + '℃';
      else if (r[2] < 0.05 && r[3] < 0.05) chip = '差なし';
      else { var p = (r[3] - r[2]) / Math.max(r[2], 1e-6); if (p < -0.03) { chip = '−' + Math.round(-p * 100) + '%'; cls = 'good'; } else if (p > 0.03) { chip = '+' + Math.round(p * 100) + '%'; cls = 'more'; } else chip = 'ほぼ同じ'; }
      function bar(v, m) { return '<div class="scb"><span class="scn">' + (m === 'ac' ? 'エアコン' : 'ecowin') + '</span><div class="track"><div class="bar" style="width:' + (r[6] ? Math.max(2, Math.abs(v) / mx * 100) : 100) + '%;background:var(--m-' + m + ')"></div></div><b>' + (r[7] || '') + v.toFixed(r[4]) + r[5] + '</b></div>'; }
      return '<div class="sc"><div class="sch"><div><b>' + r[0] + '</b><small>' + r[1] + '</small></div><span class="scd ' + cls + '">' + (cls === 'good' ? '<svg class="ic"><use href="#i-check"/></svg>' : '') + chip + '</span></div>' + bar(r[2], 'ac') + bar(r[3], 'eco') + '</div>';
    }).join('');
  }
  var sav = null, savGeom = null;
  function calcSavings() {
    var s = sim.summary, a = s.modes.ac, e = s.modes.eco;
    var r = S.rateMode === 'max' ? K.capRate : S.rateMode === 'custom' ? S.rateCustom / 100 : s.rate;
    var yE = a.kwh * r * S.price, yB = Math.max(0, a.contract - e.contract) * S.basic * 12, yM = S.maint * 1e4, year = yE + yB + yM;
    sav = { r: r, kwh: a.kwh * r, yE: yE, yB: yB, yM: yM, year: year, capex: S.capex * 1e4, pay: year > 0 ? S.capex * 1e4 / year : Infinity, co2: a.kwh * r * K.co2 };
    return sav;
  }
  function man(v) { return Math.round(v / 1e4).toLocaleString('ja-JP'); }
  function renderSavings() {
    var v = calcSavings(), s = sim.summary;
    $('svYear').textContent = man(v.year);
    $('svSub').innerHTML = '月あたり 約<b>' + man(v.year / 12) + '</b>万円　／　15年で 約<b>' + man(v.year * 15) + '</b>万円';
    $('savePillV').textContent = man(v.year);
    $('rateOut').textContent = '−' + (v.r * 100).toFixed(0) + '%';
    $('rateR').hidden = S.rateMode !== 'custom'; $('rateEnds').hidden = S.rateMode !== 'custom';
    $('rateNote').textContent = S.rateMode === 'model' ? 'この画面の条件（建物・気象・使い方・パネル配置）で計算した値です。' + (s.capped ? 'メーカー公表の最大値 34% を上限にしています。' : '')
      : S.rateMode === 'max' ? 'メーカーが公表している最大値（高性能エアコン単体との比較）です。条件により効果は変わります。' : '見積や実績に合わせて 1〜34% の範囲で決められます。';
    function row(l, x, strong) { return '<tr' + (strong ? ' class="tot"' : '') + '><th>' + l + '</th><td>' + x + '</td></tr>'; }
    $('svTable').innerHTML = '<tbody>' +
      row('電力量料金の節約', man(v.yE) + '万円') + row('基本料金の節約（最大需要電力が下がる分）', man(v.yB) + '万円') +
      (v.yM > 0 ? row('保守費の差', man(v.yM) + '万円') : '') + row('1年間の節約額', man(v.year) + '万円', true) +
      row('導入費用の差額を回収するまで', isFinite(v.pay) ? (v.capex <= 0 ? '差額なし' : '約 ' + v.pay.toFixed(1) + ' 年') : '—', true) +
      row('10年間の差し引き', man(v.year * 10 - v.capex) + '万円') + row('20年間の差し引き', man(v.year * 20 - v.capex) + '万円') +
      row('CO2の削減', (v.co2 / 1000).toFixed(1) + 't／年（杉の木 約' + Math.round(v.co2 / 14).toLocaleString('ja-JP') + '本分）') + '</tbody>';
  }
  function drawSav() {
    if (!sav) return;
    var f = fit($('sav')), c = f.c; if (f.w < 40) return;
    var L = 42, R = 10, T = 8, B = 16, w = f.w - L - R, h = f.h - T - B, Y = 20, v0 = -sav.capex / 1e4, v1 = (sav.year * Y - sav.capex) / 1e4;
    var lo = Math.min(0, v0), hi = Math.max(v1, 1), span = hi - lo, stp = Math.pow(10, Math.floor(Math.log10(span / 3)));
    if (span / stp > 8) stp *= 2.5; if (span / stp > 8) stp *= 2;
    function X(y) { return L + w * y / Y; } function Yp(v) { return T + h * (1 - (v - lo) / span); }
    savGeom = { L: L, w: w, Y: Y };
    c.strokeStyle = C['--line']; c.fillStyle = C['--ink-2']; c.lineWidth = 1; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (var g = Math.ceil(lo / stp) * stp; g <= hi; g += stp) { c.beginPath(); c.moveTo(L, Yp(g) + 0.5); c.lineTo(L + w, Yp(g) + 0.5); c.stroke(); c.fillText(Math.round(g).toLocaleString('ja-JP'), L - 4, Yp(g)); }
    c.textAlign = 'center'; c.textBaseline = 'top';
    [0, 5, 10, 15, 20].forEach(function (y) { c.fillText(y + '年', X(y) + (y === 0 ? 8 : y === Y ? -8 : 0), T + h + 3); });
    c.strokeStyle = C['--ink-3']; c.beginPath(); c.moveTo(L, Yp(0) + 0.5); c.lineTo(L + w, Yp(0) + 0.5); c.stroke();
    var py = Math.min(sav.pay, Y); // 回収後（黒字）の部分を塗る
    if (sav.pay < Y) { c.fillStyle = C['--m-eco']; c.globalAlpha = 0.16; c.beginPath(); c.moveTo(X(py), Yp(0)); c.lineTo(X(Y), Yp(v1)); c.lineTo(X(Y), Yp(0)); c.closePath(); c.fill(); c.globalAlpha = 1; }
    c.strokeStyle = C['--m-eco']; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(0), Yp(v0)); c.lineTo(X(Y), Yp(v1)); c.stroke();
    if (sav.pay > 0 && sav.pay < Y) {
      c.fillStyle = C['--surface']; c.strokeStyle = C['--m-eco']; c.lineWidth = 2; c.beginPath(); c.arc(X(py), Yp(0), 4.5, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = C['--ink']; c.textAlign = py > Y * 0.7 ? 'right' : 'left'; c.textBaseline = 'bottom'; c.font = '700 11px ' + getComputedStyle(document.body).fontFamily;
      c.fillText('約' + sav.pay.toFixed(1) + '年で回収', X(py) + (py > Y * 0.7 ? -8 : 8), Yp(0) - 5);
    }
  }

  // ------------------------------------------------------------ 操作
  function press(seg, v) { [].forEach.call($(seg).querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); }); }
  var debounce = null;
  function later(fn) { clearTimeout(debounce); debounce = setTimeout(fn, 120); }
  function setTime(t) { S.t = ((t % 8760) + 8760) % 8760; dirty = true; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function syncSliders() {
    var d = Math.floor(S.t / 24), m = M.monthOfDay(d);
    $('hourR').value = (S.t - d * 24).toFixed(2);
    $('dateIn').value = '2025-' + pad2(m + 1) + '-' + pad2(d - M.MSTART[m] + 1);
    $('dateLbl').textContent = fmtDate(d);
  }

  function initUI() {
    var SETS = window.WX_SETS || {};
    [['oita', '大分（2025年の観測値・日出町の最寄り）'], ['nerima', '東京都練馬区（2025年の観測値）']].forEach(function (o) { if (!SETS[o[0]]) return; var e = document.createElement('option'); e.value = o[0]; e.textContent = o[1]; $('city').appendChild(e); });
    if (!SETS[S.city]) S.city = 6;
    M.CITIES.forEach(function (c, i) { var o = document.createElement('option'); o.value = i; o.textContent = c.name + '（合成気象）'; $('city').appendChild(o); });
    [['low', '低', '既存の体育館・断熱なし'], ['mid', '中', '一部を断熱改修'], ['high', '高', '新築・断熱改修済み'], ['custom', '図面・仕様書から入力', '屋根・壁・窓の材料と厚さを指定']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.dataset.v = o[0];
      b.innerHTML = '<span class="rd"></span><b>' + o[1] + '</b><small>' + o[2] + '</small>'; $('insul').appendChild(b);
    });
    // 増減ボタン付きの数値
    var steppers = [].slice.call(document.querySelectorAll('.stepper'));
    steppers.forEach(function (el) {
      var key = el.dataset.key, lo = +el.dataset.min, hi = +el.dataset.max, st = +el.dataset.step;
      el.innerHTML = '<button type="button" data-d="-1" aria-label="下げる">−</button><output></output><button type="button" data-d="1" aria-label="上げる">＋</button>';
      var dec = st < 1 ? 1 : 0;
      el.refresh = function () { el.children[1].textContent = S[key].toFixed(dec) + el.dataset.unit; el.children[0].disabled = S[key] <= lo; el.children[2].disabled = S[key] >= hi; };
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S[key] = Math.round(M.clamp(S[key] + st * +b.dataset.d, lo, hi) * 100) / 100; el.refresh(); later(function () { recomputeSim(); jumpsReady = false; });
      });
    });
    function outs() { $('occOut').textContent = S.occupants + '人'; $('panelsOut').textContent = S.panels + '台'; }
    function applySplit() {
      press('splitSeg', S.sheet ? 2 : S.split ? 1 : 0); $('modeGrp').hidden = S.split || S.sheet; $('leftGrp').hidden = !(S.split || S.sheet);
      $('view').classList.toggle('sheet', S.sheet); $('sheet').hidden = !S.sheet; sheetDirty = true;
      if (scene3) scene3.resize();
    }
    function setPlayIcon() { $('playIc').setAttribute('href', S.playing ? '#i-pause' : '#i-play'); $('play').setAttribute('aria-label', S.playing ? '停止' : '再生'); }
    function syncInputs() { // 状態を画面の部品へ反映する
      $('city').value = S.city; $('occ').value = S.occupants; $('panels').value = S.panels;
      press('insul', S.insul); $('editSpec').hidden = S.insul !== 'custom'; press('actSeg', S.sensible); press('preheatSeg', S.preheat);
      press('layoutSeg', S.layout); $('customNote').hidden = S.layout !== 'custom'; press('palSeg', S.palette); press('acSeg', S.acMode); $('acBox').hidden = S.acMode !== 'custom'; press('bldSeg', BKEY);
      press('rateSeg', S.rateMode); $('rateR').value = S.rateCustom;
      press('modeSeg', S.mode); press('leftSeg', S.left); press('layerSeg', S.layer); press('zSeg', S.z); press('speedSeg', S.speed);
      [].forEach.call($('overlays').querySelectorAll('.chip'), function (b) { b.setAttribute('aria-pressed', String(!!S[b.dataset.k])); });
      $('chartsToggle').setAttribute('aria-pressed', String(S.charts)); $('charts').hidden = !S.charts;
      steppers.forEach(function (el) { el.refresh(); });
      outs(); applySplit(); setPlayIcon(); syncSliders(); speedLabel();
    }
    // 1つだけ選ぶボタンの共通処理
    function seg(id, key, conv, after) {
      $(id).addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S[key] = conv ? conv(b.dataset.v) : b.dataset.v; press(id, b.dataset.v); clearScene(); after();
      });
    }
    function clearScene() { [].forEach.call($('scenes').children, function (b) { b.removeAttribute('aria-current'); }); }
    function redraw() { dirty = true; chartsDirty = true; }
    seg('modeSeg', 'mode', null, function () { if (scene3) scene3.resize(); redraw(); });
    seg('leftSeg', 'left', null, function () { if (scene3) scene3.resize(); redraw(); });
    $('splitSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === '2') S.sheet = true; else { S.sheet = false; S.split = b.dataset.v === '1'; }
      clearScene(); S.probe = null; first = true; applySplit(); redraw();
    });
    seg('layerSeg', 'layer', null, redraw);
    seg('zSeg', 'z', parseFloat, function () { recomputeGeometry(); dirty = true; });
    function speedLabel() { var b = $('speedSeg').querySelector('[aria-pressed=true]'); $('speedLbl').textContent = (b ? b.textContent : '') + '／秒'; }
    seg('speedSeg', 'speed', parseFloat, function () { speedLabel(); closePops(null); });
    seg('insul', 'insul', null, function () { $('editSpec').hidden = S.insul !== 'custom'; if (S.insul === 'custom') openSpec(); recomputeSim(); });
    seg('actSeg', 'sensible', parseFloat, recomputeSim);
    seg('preheatSeg', 'preheat', parseFloat, recomputeSim);
    seg('rateSeg', 'rateMode', null, function () { renderSavings(); chartsDirty = true; dirty = true; });
    $('rateR').addEventListener('input', function () { S.rateCustom = +$('rateR').value; renderSavings(); chartsDirty = true; dirty = true; });
    $('savePill').addEventListener('click', function () { setSide(true); showTab('year'); });
    var savC = $('sav');
    savC.addEventListener('pointermove', function (e) {
      if (!savGeom || !sav) return; var b = savC.getBoundingClientRect(), y = Math.round(M.clamp((e.clientX - b.left - savGeom.L) / savGeom.w, 0, 1) * savGeom.Y);
      showTip(e, y + '年後<br>節約額の合計 <b>' + man(sav.year * y) + '</b>万円<br>導入費用の差額を引くと <b>' + man(sav.year * y - sav.capex) + '</b>万円');
    });
    savC.addEventListener('pointerleave', hideTip);
    seg('layoutSeg', 'layout', null, function () { $('customNote').hidden = true; recomputeAll(); });
    $('occ').addEventListener('input', function () { S.occupants = +$('occ').value; outs(); later(recomputeSim); });
    $('panels').addEventListener('input', function () { S.panels = +$('panels').value; outs(); if (S.layout === 'custom') { S.layout = 'gallery'; press('layoutSeg', 'gallery'); $('customNote').hidden = true; } later(recomputeAll); });
    $('city').addEventListener('change', function () { var v = $('city').value; S.city = isNaN(parseInt(v, 10)) ? v : parseInt(v, 10); recomputeSim(); jumpsReady = false; });
    // 入・切のチップ
    $('overlays').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b || b.disabled) return; var k = b.dataset.k;
      S[k] = !S[k]; b.setAttribute('aria-pressed', String(S[k])); clearScene();
      if (k === 'section' && scene3) { scene3.resize(); scene3.setCam(S.section ? 'side' : 'iso'); press('cams', S.section ? '' : 'iso'); }
      dirty = true;
    });
    $('chartsToggle').addEventListener('click', function () { S.charts = !S.charts; $('chartsToggle').setAttribute('aria-pressed', String(S.charts)); $('charts').hidden = !S.charts; redraw(); });
    $('cams').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && scene3) { scene3.setCam(b.dataset.v); press('cams', b.dataset.v); } });
    $('gl').addEventListener('pointerdown', function () { press('cams', ''); });
    press('cams', 'iso');

    // 時間の操作
    $('play').addEventListener('click', function () { S.playing = !S.playing; setPlayIcon(); });
    // ボタンの下（上）に開く小さなパネル。外側を押すか Esc で閉じる
    var popBtns = [].slice.call(document.querySelectorAll('[data-pop]'));
    function closePops(except) { popBtns.forEach(function (b) { if (b !== except) { $(b.dataset.pop).hidden = true; b.setAttribute('aria-expanded', 'false'); } }); }
    popBtns.forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var p = $(b.dataset.pop), open = p.hidden; closePops(b); p.hidden = !open; b.setAttribute('aria-expanded', String(open)); });
      $(b.dataset.pop).addEventListener('click', function (e) { e.stopPropagation(); });
    });
    document.addEventListener('click', function () { closePops(null); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePops(null); });
    $('gl').addEventListener('pointerdown', function () { closePops(null); });
    // 3Dだけを大きく表示する
    $('focusBtn').addEventListener('click', function () {
      var on = document.querySelector('.app').classList.toggle('focus');
      $('focusBtn').setAttribute('aria-pressed', String(on)); $('focusBtn').lastElementChild.textContent = on ? '戻す' : '拡大'; redraw();
    });
    $('prevDay').addEventListener('click', function () { setTime(S.t - 24); syncSliders(); });
    $('nextDay').addEventListener('click', function () { setTime(S.t + 24); syncSliders(); });
    $('dateIn').addEventListener('change', function () {
      var p = $('dateIn').value.split('-'); if (p.length !== 3) return;
      var m = M.clamp(parseInt(p[1], 10) - 1, 0, 11), dd = M.clamp(parseInt(p[2], 10), 1, M.MDAYS[m]);
      setTime((M.MSTART[m] + dd - 1) * 24 + (S.t - Math.floor(S.t / 24) * 24)); syncSliders();
    });
    $('hourR').addEventListener('input', function () { setTime(Math.floor(S.t / 24) * 24 + parseFloat($('hourR').value)); syncSliders(); });
    var jumpsReady = false, hotD = 0, coldD = 0;
    function jumps() {
      if (jumpsReady) return; var mx = -99, mn = 99;
      for (var d = 0; d < 365; d++) { if (wx.tmax[d] > mx && wx.sky[d] === 0) { mx = wx.tmax[d]; hotD = d; } if (wx.tmin[d] < mn) { mn = wx.tmin[d]; coldD = d; } }
      jumpsReady = true;
    }
    $('jumpHot').addEventListener('click', function () { jumps(); setTime(hotD * 24 + 14); syncSliders(); });
    $('jumpCold').addEventListener('click', function () { jumps(); setTime(coldD * 24 + 9); syncSliders(); });

    // 左のパネル
    function showTab(v) {
      press('tabs', v);
      [].forEach.call(document.querySelectorAll('.pane'), function (p) { p.hidden = p.dataset.pane !== v; });
      redraw();
    }
    function setSide(open) {
      $('main').classList.toggle('wide', !open); $('sideToggle').setAttribute('aria-expanded', String(open));
      redraw();
    }
    $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showTab(b.dataset.v); });
    $('sideToggle').addEventListener('click', function () { setSide($('main').classList.contains('wide')); });
    showTab('cond');

    // 見どころ：押すと、その場面の日時・方式・表示に切り替える
    S.spec = defaultSpec();
    var SCENES = {
      s1: { split: false, mode: 'none', layer: 'wbgt', section: false, time: 'hot', cam: 'iso' },
      s2: { split: true, left: 'ac', layer: 'ot', section: false, time: 'hot', cam: 'iso' },
      s3: { split: true, left: 'ac', layer: 'ta', section: true, volume: true, time: 'cold', cam: 'side' },
      s4: { split: true, left: 'ac', layer: 'wind', section: false, wind: true, time: 'cold', cam: 'top' },
      s5: { tab: 'year' },
      s6: { sheet: true, left: 'ac', layer: 'ta', section: false, time: 'cold' }
    };
    $('scenes').addEventListener('click', function (e) {
      var b = e.target.closest('.scene'); if (!b) return; var sc = SCENES[b.dataset.v];
      clearScene(); b.setAttribute('aria-current', 'true');
      if (sc.tab) { showTab(sc.tab); return; }
      jumps();
      S.sheet = !!sc.sheet;
      ['split', 'mode', 'left', 'layer', 'section', 'volume', 'wind'].forEach(function (k) { if (sc[k] !== undefined) S[k] = sc[k]; });
      if (scene3 && !scene3.volOK) S.volume = false;
      S.field = true; S.probe = null; setTime(sc.time === 'hot' ? hotD * 24 + 14 : coldD * 24 + 9);
      syncInputs(); first = true; redraw();
      if (scene3 && sc.cam) { scene3.resize(); scene3.setCam(sc.cam); press('cams', sc.cam === 'side' ? '' : sc.cam); }
    });

    // 年間マップ：なぞって日時を選ぶ
    var cal = $('cal'), calDown = false;
    function calSet(e) { var p = calPick(e); setTime(p.d * 24 + p.h); syncSliders(); }
    cal.addEventListener('pointerdown', function (e) { calDown = true; cal.setPointerCapture(e.pointerId); calSet(e); });
    cal.addEventListener('pointermove', function (e) {
      var p = calPick(e), k = p.d * 24 + Math.floor(p.h), key = metricKey();
      if (calDown) calSet(e);
      showTip(e, fmtDate(p.d) + ' ' + Math.floor(p.h) + '時　' + SKY[wx.sky[p.d]] + '<br>外気 <b>' + f1(wx.T[k]) + '</b>℃　' + (key === 'WBGT' ? '暑さ指数' : '体感') + ' <b>' + f1(sim[fm()][key][k]) + '</b>' + (key === 'WBGT' ? '' : '℃'));
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
      showTip(e, Math.floor(h) + '時　外気 <b>' + f1(wx.T[k]) + '</b>℃<br>' + M.MODES.map(function (m) { return MODE_NAME[m] + ' <b>' + f1(sim[m][key][k]) + '</b>'; }).join('<br>'));
    });
    day.addEventListener('pointerup', function () { dayDown = false; });
    day.addEventListener('pointerleave', hideTip);
    var mon = $('mon');
    mon.addEventListener('pointermove', function (e) {
      if (!monGeom) return;
      var b = mon.getBoundingClientRect(), m = M.clamp(Math.floor((e.clientX - b.left - monGeom.L) / monGeom.bw), 0, 11), a = sim.summary.modes.ac.monthly[m], ec = sim.summary.modes.eco.monthly[m];
      showTip(e, (m + 1) + '月<br>エアコンのみ <b>' + (a / 1000).toFixed(1) + '</b>MWh<br>ecowin <b>' + (ec / 1000).toFixed(1) + '</b>MWh' + (a > 0 ? '（−' + Math.round((1 - ec / a) * 100) + '%）' : ''));
    });
    mon.addEventListener('pointerleave', hideTip);

    // 建物の仕様（図面・仕様書の値を入力する画面）
    var specDraft = null;
    function renderSpec() {
      var sp = specDraft, ins = specIns(sp);
      ['roof', 'wall'].forEach(function (el) {
        var box = $(el === 'roof' ? 'lyRoof' : 'lyWall');
        box.innerHTML = sp[el].map(function (l, i) {
          var fixed = MATS[l.m].R !== undefined;
          return '<div class="layer" data-el="' + el + '" data-i="' + i + '"><select aria-label="材料">' + Object.keys(MATS).map(function (k) { return '<option value="' + k + '"' + (k === l.m ? ' selected' : '') + '>' + MATS[k].name + '</option>'; }).join('') +
            '</select><input type="number" min="0" max="1000" step="1" value="' + l.t + '" aria-label="厚さ（mm）"' + (fixed ? ' disabled' : '') + '><span class="u">mm</span><span class="r num">R ' + layerR(l).toFixed(2) + '</span><button type="button" class="btn icon del" aria-label="この層を削除"' + (sp[el].length < 2 ? ' disabled' : '') + '><svg class="ic"><use href="#i-x"/></svg></button></div>';
        }).join('');
      });
      $('uRoof').textContent = 'U = ' + ins.Ur.toFixed(2) + ' W/㎡K'; $('uWall').textContent = 'U = ' + ins.Uw.toFixed(2) + ' W/㎡K';
      $('uGlass').textContent = 'U = ' + ins.Ug.toFixed(1) + ' W/㎡K　日射取得率 ' + ins.shgc.toFixed(2);
      press('reflSeg', sp.refl); press('glassSeg', sp.glass); $('achOut').textContent = sp.ach.toFixed(1) + ' 回/時';
      $('specImg').hidden = !sp.image; if (sp.image) $('specImg').src = sp.image; $('specImgName').textContent = sp.image ? sp.imageName || '図面' : '図面の画像はまだありません';
      var lv = [['低', M.INSUL.low], ['中', M.INSUL.mid], ['高', M.INSUL.high]];
      $('specCmp').innerHTML = '<thead><tr><th></th><th>屋根 U</th><th>壁 U</th><th>窓 U</th><th>すきま風</th></tr></thead><tbody><tr class="tot"><th>入力した仕様</th><td>' + ins.Ur.toFixed(2) + '</td><td>' + ins.Uw.toFixed(2) + '</td><td>' + ins.Ug.toFixed(1) + '</td><td>' + ins.ach.toFixed(1) + '</td></tr>' +
        lv.map(function (v) { return '<tr><th>目安「' + v[0] + '」</th><td>' + v[1].Ur.toFixed(2) + '</td><td>' + v[1].Uw.toFixed(2) + '</td><td>' + v[1].Ug.toFixed(1) + '</td><td>' + v[1].ach.toFixed(1) + '</td></tr>'; }).join('') + '</tbody>';
    }
    function openSpec() { specDraft = cleanSpec(S.spec); renderSpec(); $('specMsg').textContent = ''; var d = $('specDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    Object.keys(GLASS).forEach(function (k) { var b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.dataset.v = k; b.innerHTML = '<span class="rd"></span><b>' + GLASS[k].name + '</b><small>' + GLASS[k].sub + '</small>'; $('glassSeg').appendChild(b); });
    Object.keys(REFL).forEach(function (k) { var b = document.createElement('button'); b.type = 'button'; b.dataset.v = k; b.textContent = REFL[k].name; $('reflSeg').appendChild(b); });
    $('specDlg').addEventListener('change', function (e) {
      var row = e.target.closest('.layer'); if (!row) return; var l = specDraft[row.dataset.el][+row.dataset.i];
      if (e.target.tagName === 'SELECT') { l.m = e.target.value; if (MATS[l.m].R !== undefined) l.t = 0; else if (!l.t) l.t = 50; } else l.t = M.clamp(+e.target.value || 0, 0, 1000);
      renderSpec();
    });
    $('specDlg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.layer');
      if (row && b.classList.contains('del')) { specDraft[row.dataset.el].splice(+row.dataset.i, 1); renderSpec(); }
      else if (b.dataset.add) { specDraft[b.dataset.add].push({ m: 'gw24', t: 50 }); renderSpec(); }
      else if (b.closest('#reflSeg')) { specDraft.refl = b.dataset.v; renderSpec(); }
      else if (b.closest('#glassSeg')) { specDraft.glass = b.dataset.v; renderSpec(); }
      else if (b.dataset.ach) { specDraft.ach = M.clamp(Math.round((specDraft.ach + 0.1 * +b.dataset.ach) * 10) / 10, 0.1, 3); renderSpec(); }
    });
    $('specApply').addEventListener('click', function () {
      S.spec = cleanSpec(specDraft); S.insul = 'custom'; press('insul', 'custom'); recomputeSim(); jumpsReady = false;
      var d = $('specDlg'); if (d.close) d.close(); else d.removeAttribute('open'); say('建物の仕様を反映しました');
    });
    $('closeSpec').addEventListener('click', function () { var d = $('specDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
    $('editSpec').addEventListener('click', openSpec);
    // 図面の画像を添える（計算には使わず、仕様と一緒に持っておく）
    $('specImgIn').addEventListener('change', function () {
      var fl = $('specImgIn').files[0]; if (!fl) return;
      if (fl.type.indexOf('image/') !== 0) { $('specMsg').textContent = '画像ファイル（PNG・JPEG）を選んでください。PDFの図面は画像にしてから取り込めます。'; return; }
      var fr = new FileReader(); fr.onload = function () { specDraft.image = fr.result; specDraft.imageName = fl.name; renderSpec(); }; fr.readAsDataURL(fl);
    });
    $('specImgDel').addEventListener('click', function () { specDraft.image = null; specDraft.imageName = ''; $('specImgIn').value = ''; renderSpec(); });
    // 仕様データの読み込みと書き出し（JSON）
    $('specFile').addEventListener('change', function () {
      var fl = $('specFile').files[0]; if (!fl) return;
      var fr = new FileReader();
      fr.onload = function () { try { specDraft = cleanSpec(JSON.parse(fr.result)); renderSpec(); $('specMsg').textContent = '「' + fl.name + '」を読み込みました。内容を確かめて「この仕様で計算する」を押してください。'; } catch (err) { $('specMsg').textContent = 'このファイルは読み込めませんでした。書き出した仕様データ（.json）を選んでください。'; } };
      fr.readAsText(fl); $('specFile').value = '';
    });
    $('specExport').addEventListener('click', function () {
      var txt = JSON.stringify(Object.assign({ format: 'ecowin-gym-spec', version: 1 }, specDraft), null, 1), a = $('specDl');
      $('specJson').value = txt; $('specJson').hidden = false; a.hidden = false;
      try { a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'building-spec.json'; } catch (err) { a.hidden = true; }
      $('specMsg').textContent = '下の「ファイルに保存」を押すか、表示された文字をコピーして保存してください。';
    });

    // 建物の切り替え（ページを読み直す）
    $('bldNote').innerHTML = '<b>' + G.name + '</b>の設計図をもとにしています（アリーナ ' + G.W + 'm × ' + G.D.toFixed(1) + 'm、屋根まで ' + G.H + 'm）。';
    $('bldSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.dataset.v === BKEY) return;
      try { localStorage.setItem('ecowin-gym-building', b.dataset.v); } catch (err) { /* 保存できない環境では # だけで切り替える */ }
      location.hash = b.dataset.v; location.reload();
    });
    // 比べるエアコン（エアコンのみ）の能力と効率
    seg('acSeg', 'acMode', null, function () { $('acBox').hidden = S.acMode !== 'custom'; recomputeSim(); jumpsReady = false; });
    // パネルの置き方を比べる：置き方ごとに年間計算を回して表にする
    $('cmpLayout').addEventListener('click', function () {
      var cases = [['設計図どおり（2階ギャラリー）', M.buildPanels('gallery', S.panels)], ['1階の壁際に下ろした場合', M.buildPanels('floor', S.panels)]];
      if (S.layout === 'custom') cases.push(['いまの配置（ドラッグで変更）', panels]);
      var p = params(), h = '<thead><tr><th>置き方</th><th>人から見える<br>パネルの割合</th><th>冬の体感<br>（平均）</th><th>夏の体感<br>（平均）</th><th>年間の<br>消費電力量</th><th>エアコンのみ<br>との差</th><th>最大<br>需要電力</th></tr></thead><tbody>';
      cases.forEach(function (cs) {
        p.panels = cs[1].length; var Fm = M.computeViewWeights(1.1, cs[1]).mean, r = M.simulate(p, wx, Fm, jet.m11), o = r.eco, sh = 0, nh = 0, sc = 0, nc = 0;
        for (var k = 0; k < 8760; k++) { var hh = k % 24; if (hh < S.opStart + 2 || hh >= S.opEnd) continue; if (isHeat(k)) { sh += o.OT[k]; nh++; } else { sc += o.OT[k]; nc++; } }
        var sm = r.summary;
        h += '<tr><th>' + cs[0] + '</th><td>' + (Fm.panel * 100).toFixed(1) + '%</td><td>' + f1(sh / nh) + '℃</td><td>' + f1(sc / nc) + '℃</td><td>' + (sm.modes.eco.kwh / 1000).toFixed(1) + 'MWh</td><td>' + (sm.rate >= 0 ? '−' : '+') + Math.abs(sm.rate * 100).toFixed(1) + '%</td><td>' + Math.round(sm.modes.eco.contract) + 'kW</td></tr>';
      });
      $('layoutTable').innerHTML = h + '</tbody>';
      var d = $('layoutDlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    });
    $('closeLayout').addEventListener('click', function () { var d = $('layoutDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });

    // 取り込んだ設計資料の一覧
    (function () {
      var dd = window.DESIGN_DOCS; if (!dd) { $('openDocs').hidden = true; return; }
      var h = '<p><b>' + dd.title + '</b><br><span class="note">' + dd.source + '</span></p><h3>3施設に共通の機器</h3><ul>' + Object.keys(dd.common).map(function (k) { return '<li>' + dd.common[k] + '</li>'; }).join('') + '</ul>';
      dd.sites.forEach(function (st) {
        h += '<h3>' + st.name + (st.key === BKEY ? '　<span class="pill" style="background:var(--accent-soft);color:var(--ink)">この画面でモデル化</span>' : '') + '</h3>' + (st.size ? '<p class="note">平面：' + st.size + '　／　高さ：' + st.height + '</p>' : '') +
          '<table class="cmp sv"><tbody>' + st.rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>';
      });
      $('docsBody').innerHTML = h + '<p class="note">金額は資料に記載がないため取り込んでいません。断熱の仕様（屋根・壁・窓の材料）もこの資料には記載がないため、「断熱性能」は目安の3段階か、「図面・仕様書から入力」で指定します。</p>';
      dlg('docsDlg', 'openDocs', 'closeDocs');
    })();

    // 配置と条件の保存・読込（このブラウザの中に保存する）
    var KEYS = ['city', 'insul', 'occupants', 'sensible', 'setHeat', 'setCool', 'opStart', 'opEnd', 'panels', 'preheat', 'layout', 'price', 'basic', 'mode', 'left', 'layer', 'z', 't', 'wind', 'rays', 'section', 'people', 'field', 'split', 'volume', 'speed', 'charts', 'rateMode', 'rateCustom', 'capex', 'maint', 'sheet', 'palette', 'acMode', 'acCool', 'acHeat', 'acCopC', 'acCopH'];
    function say(t) { var e = $('saveMsg'); e.textContent = t; clearTimeout(say.t); say.t = setTimeout(function () { e.textContent = ''; }, 4000); }
    $('saveScene').addEventListener('click', function () {
      var o = { v: 5 }; KEYS.forEach(function (k) { o[k] = S[k]; });
      o.panelList = panels; o.spec = S.spec; if (o.spec && o.spec.image && o.spec.image.length > 400000) o.spec = Object.assign({}, o.spec, { image: null, imageName: '' }); // 大きな図面の画像は保存しない
      try { localStorage.setItem('ecowin-gym-scene', JSON.stringify(o)); say('保存しました'); } catch (e) { say('このブラウザでは保存できません'); }
    });
    $('loadScene').addEventListener('click', function () {
      var o = null; try { o = JSON.parse(localStorage.getItem('ecowin-gym-scene')); } catch (e) { o = null; }
      if (!o || o.v !== 5) { say('保存したものがありません'); return; }
      KEYS.forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
      if (typeof S.city === 'string' && !(window.WX_SETS || {})[S.city]) S.city = 6;
      S.spec = cleanSpec(o.spec);
      if (scene3 && !scene3.volOK) S.volume = false;
      if (S.layout === 'custom' && Array.isArray(o.panelList)) panels = o.panelList.map(function (q) { return { axis: q.axis === 'x' ? 'x' : 'y', x: +q.x, y: +q.y, z: M.clamp(+q.z || 0, 0, 8) }; });
      S.probe = null; S.playing = false; clearScene();
      recomputeAll(); jumpsReady = false; first = true; syncInputs(); if (scene3) scene3.resize(); say('読み込みました');
    });
    // いまの表示を1枚の画像にする
    $('shot').addEventListener('click', function () {
      if (!scene3) { say('3D表示が使えないため画像にできません'); return; }
      var gl = S.sheet ? $('sheet') : scene3.canvas, sc = gl.width / gl.clientWidth, head = Math.round(64 * sc), foot = Math.round(58 * sc), pad = Math.round(16 * sc);
      var cv = document.createElement('canvas'); cv.width = gl.width; cv.height = gl.height + head + foot;
      var c = cv.getContext('2d'), d = Math.floor(S.t / 24), w = wxAt(S.t), ms = shownModes(), rs = scene3.rects(), ff = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic UI", sans-serif';
      c.fillStyle = C['--surface']; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(gl, 0, head);
      c.fillStyle = C['--ink']; c.textBaseline = 'middle'; c.font = '700 ' + Math.round(18 * sc) + 'px ' + ff;
      c.fillText('体育館デジタルツイン　ecowinハイブリッド 設置効果の推計', pad, head * 0.34);
      c.font = Math.round(13 * sc) + 'px ' + ff; c.fillStyle = C['--ink-2'];
      c.fillText(wx.city.name + '　' + fmtDate(d) + ' ' + fmtHour(S.t - d * 24) + '　' + SKY[w.sky] + '　外気 ' + f1(w.T) + '℃　断熱：' + insulLabel() + '　' + S.occupants + '人　パネル ' + panels.length + '台', pad, head * 0.74);
      if (!S.sheet) ms.forEach(function (m, i) { // 方式名の札
        var q = rs[i], t = MODE_NAME[m]; c.font = '700 ' + Math.round(14 * sc) + 'px ' + ff;
        var tw = c.measureText(t).width + 34 * sc, x = (q.x + q.w) * sc - tw - 12 * sc, y = head + (q.y + 10) * sc, hh = 26 * sc;
        c.fillStyle = C['--surface']; c.fillRect(x, y, tw, hh); c.fillStyle = C['--m-' + m]; c.beginPath(); c.arc(x + 13 * sc, y + hh / 2, 5 * sc, 0, 6.2832); c.fill();
        c.fillStyle = C['--ink']; c.fillText(t, x + 24 * sc, y + hh / 2);
      });
      if (rs.length > 1 && !S.sheet) { c.fillStyle = C['--surface']; if (rs[1].x > 0) c.fillRect(rs[1].x * sc - sc, head, 2 * sc, gl.height); else c.fillRect(0, head + rs[1].y * sc - sc, cv.width, 2 * sc); }
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

    function dlg(id, openBtn, closeBtn) {
      $(openBtn).addEventListener('click', function () { var d = $(id); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); });
      $(closeBtn).addEventListener('click', function () { var d = $(id); if (d.close) d.close(); else d.removeAttribute('open'); });
    }
    dlg('helpDlg', 'openHelp', 'closeHelp');
    // 色の付け方
    function repaint() { buildColors(); if (scene3) scene3.applyTheme(); legendKey = ''; first = true; redraw(); }
    seg('palSeg', 'palette', null, repaint);
    // 検証シート（縦のレポート）
    $('openReport').addEventListener('click', function () {
      var sts = {}, heat = isHeat(Math.floor(S.t)); M.MODES.forEach(function (m) { sts[m] = stateAt(m, S.t); });
      var cv = $('reportCv'); drawReport(cv, sts, heat);
      var a = $('reportDl'), d0 = Math.floor(S.t / 24); try { a.href = cv.toDataURL('image/png'); a.download = 'ecowin-kensho-' + fmtDate(d0) + '.png'; } catch (err) { a.hidden = true; }
      var dg = $('reportDlg'); if (dg.showModal) dg.showModal(); else dg.setAttribute('open', '');
    });
    $('closeReport').addEventListener('click', function () { var d = $('reportDlg'); if (d.close) d.close(); else d.removeAttribute('open'); });
    // 操作の説明の帯は、閉じたら次回から出さない
    try { if (localStorage.getItem('ecowin-gym-tips') === '1') $('tips').hidden = true; } catch (e) { /* 保存できない環境では毎回表示する */ }
    $('tipsClose').addEventListener('click', function () { $('tips').hidden = true; try { localStorage.setItem('ecowin-gym-tips', '1'); } catch (e) { /* 同上 */ } });
    if (scene3 && !scene3.volOK) { S.volume = false; var vb = $('overlays').querySelector('[data-k=volume]'); vb.disabled = true; vb.title = 'この端末では表示できません'; }
    S.split = window.innerWidth >= 900;
    jumps(); setTime(hotD * 24 + 14); syncInputs();

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
  var last = 0, legendKey = '', lastDay = -1, settle = 0, sheetDirty = true;
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.25, (now - last) / 1000 || 0.016); last = now;
    if (S.playing) { setTime(S.t + dt * S.speed); syncSliders(); }
    var heat = isHeat(Math.floor(S.t)), ms = shownModes(), sts = {};
    M.MODES.forEach(function (m) { sts[m] = stateAt(m, S.t); });
    if (dirty) {
      updateRangeTarget();
      ms.forEach(function (m, i) { M.computeField(S.layer, m, sts[m], heat, S.z, F, heat ? jet.heat : jet.cool, target[i]); });
      M.MODES.forEach(function (m) { spread[m] = fieldSpread(m, sts[m], heat); });
      var wn = wxAt(S.t); sunI = wn.I; renderNow(sts, wn); renderScore(sts, heat); renderProbe(sts, heat); if (scene3) scene3.markVolume();
      var d = Math.floor(S.t / 24);
      if (chartsDirty || d !== lastDay) { if (chartsDirty) { buildCal(); drawMon(); drawSav(); } lastDay = d; chartsDirty = false; }
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
      var lk = S.layer + S.z + range.lo.toFixed(1) + range.hi.toFixed(1) + C['--div-mid'] + S.palette;
      if (lk !== legendKey) { renderLegend(); legendKey = lk; }
      settle = (mx > 0.004 || rd > 0.02) ? 1 : 0; first = false; sheetDirty = true;
    }
    if (S.sheet) { if (sheetDirty) { drawSheet(sts, heat); sheetDirty = false; } }
    else if (scene3) scene3.frame(dt, ms.map(function (m) { return { mode: m, st: sts[m] }; }), heat);
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
