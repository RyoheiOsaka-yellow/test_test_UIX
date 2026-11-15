/* ecowinハイブリッド 体育館デジタルツイン — 計算エンジン（描画に依存しない純粋な計算）
 * すべて簡易モデルによる推計。係数の根拠と区分（出典／推計／仮定）は docs/calc_logic_gym.md を参照。 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- 建物
  // 写真をもとにした想定寸法：アリーナ 46m×38m を四周の観覧席（奥行5m）が囲む。屋内全体は 56m×48m、天井高 12.5m。
  // 熱の計算は屋内全体を1つの箱として扱い、分布はアリーナの床の範囲（ax0〜ax1, ay0〜ay1）で評価する。
  var GEOM = { W: 56, D: 48, H: 12.5, zRef: 1.1, cell: 0.5, ax0: 5, ay0: 5, ax1: 51, ay1: 43, galleryZ: 3.2 };
  GEOM.NX = Math.round((GEOM.ax1 - GEOM.ax0) / GEOM.cell);
  GEOM.NY = Math.round((GEOM.ay1 - GEOM.ay0) / GEOM.cell);
  GEOM.Af = GEOM.W * GEOM.D;
  GEOM.V = GEOM.Af * GEOM.H;
  // 窓：南面は観覧席の上に縦長の窓が8か所、北面と東面は小窓が4か所ずつ。a は壁に沿った位置
  var WINDOWS = [];
  for (var wi = 0; wi < 8; wi++) WINDOWS.push({ wall: 'S', a1: 6.4 + wi * 5.6, a2: 10.2 + wi * 5.6, z1: 4.8, z2: 9.0 });
  [9, 19.5, 33.3, 43.8].forEach(function (a) { WINDOWS.push({ wall: 'N', a1: a, a2: a + 3.2, z1: 5.0, z2: 7.4 }); });
  [9, 17.6, 27.2, 35.8].forEach(function (a) { WINDOWS.push({ wall: 'E', a1: a, a2: a + 3.2, z1: 5.0, z2: 7.4 }); });
  GEOM.Ag = WINDOWS.reduce(function (s, w) { return s + (w.a2 - w.a1) * (w.z2 - w.z1); }, 0);
  GEOM.Awall = 2 * (GEOM.W + GEOM.D) * GEOM.H - GEOM.Ag;

  // 空調の吹出し：観覧席の上を通る南北2本のダクトに、ノズルが6個ずつ。高さ 8.2m からアリーナ中央へ吹き下ろす
  var AC_UNITS = [];
  for (var ui = 0; ui < 6; ui++) {
    AC_UNITS.push({ x: 8.5 + ui * 7.5, y: 6.5, dir: 1, z0: 8.2 });
    AC_UNITS.push({ x: 10 + ui * 7.5, y: GEOM.D - 6.5, dir: -1, z0: 8.2 });
  }

  var PANEL = { w: 0.86, h: 2.35, z0: 0.1, faceArea: 0.86 * 2.35 };

  // ---------------------------------------------------------------- 係数
  var INSUL = {
    low: { label: '低（既存体育館・無断熱）', Ur: 2.5, Uw: 2.0, Ug: 6.0, ach: 1.0, shgc: 0.75 },
    mid: { label: '中（一部改修）', Ur: 1.0, Uw: 1.0, Ug: 4.0, ach: 0.6, shgc: 0.65 },
    high: { label: '高（新築・断熱改修済み）', Ur: 0.4, Uw: 0.5, Ug: 2.3, ach: 0.3, shgc: 0.45 }
  };
  var K = {
    Uf: 0.5,            // 床の熱貫流（地盤へ）
    hi: 8,              // 室内側の表面熱伝達率
    hAm: 3,             // 空気と構造体の対流熱伝達率
    CaFactor: 3,        // 空気の熱容量に対する、備品等を含めた倍率
    Cm: 700e6,          // 床・壁の有効熱容量 [J/K]
    light: 8,           // 照明 [W/㎡]
    ventPer: 20,        // 1人あたり換気量 [m3/h]
    loadCool: 300,      // 冷房の単位負荷 [W/㎡]（熱負荷計算書）
    loadHeat: 185,      // 暖房の単位負荷 [W/㎡]（熱負荷計算書）
    ecoCap: 0.7,        // 余熱時間補正係数（熱負荷計算書）
    hp: 11,             // パネル表面の総合熱伝達率 [W/㎡K]
    radFrac: 0.55,      // パネル放熱のうち輻射の割合
    TpHeat: 45,         // 暖房時パネル表面温度（S4: 45〜50℃の下限）
    TpCool: 15,         // 冷房時パネル表面温度【仮定】
    relaxMax: 2.5,      // 同じ体感にするための空気設定の調整幅の上限
    gStrat: { none: 0, ac: 0.03, eco: 0.01 },   // 暖房時の上下温度勾配の係数
    gRoof: 0.04,        // 屋根面の加熱による成層の係数
    u0: { none: 0, ac: 5.0, eco: 1.5 },         // 吹出し風速 [m/s]
    dTs: { ac: { heat: 16, cool: -11 }, eco: { heat: 9, cool: -6 } }, // 吹出し温度差
    fanKW: { none: 0, ac: 18, eco: 6 },
    latent: 1.25,       // 冷房時の潜熱分の割増
    capRate: 0.34,      // メーカー公表の最大削減率
    co2: 0.423,         // kg-CO2/kWh
    heatMonths: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1]
  };

  // ---------------------------------------------------------------- 都市（平年値の近似）
  // coefCool / coefHeat は「熱負荷計算書（標準）」の地域係数
  var CITIES = [
    { name: '札幌', lat: 43.06, coefCool: 0.54, coefHeat: 1.45,
      max: [-0.4, 0.4, 4.5, 11.7, 17.9, 21.8, 25.4, 26.4, 22.8, 16.4, 8.7, 2.0],
      min: [-6.4, -6.2, -2.4, 3.4, 9.0, 13.4, 17.9, 19.1, 14.8, 8.0, 1.6, -4.0],
      rh: [69, 68, 65, 61, 65, 72, 75, 75, 71, 67, 67, 68],
      clear: [0.30, 0.35, 0.42, 0.50, 0.50, 0.45, 0.42, 0.45, 0.48, 0.45, 0.30, 0.27] },
    { name: '仙台', lat: 38.26, coefCool: 0.84, coefHeat: 1.12,
      max: [5.6, 6.5, 10.0, 15.5, 20.2, 23.1, 26.6, 28.2, 25.0, 19.8, 14.1, 8.3],
      min: [-1.3, -1.1, 1.4, 6.3, 11.7, 16.1, 20.2, 21.6, 18.0, 11.5, 5.2, 0.9],
      rh: [66, 64, 61, 63, 70, 79, 83, 81, 78, 72, 68, 67],
      clear: [0.50, 0.50, 0.50, 0.50, 0.45, 0.30, 0.33, 0.40, 0.38, 0.45, 0.48, 0.48] },
    { name: '新潟', lat: 37.89, coefCool: 0.89, coefHeat: 1.09,
      max: [5.3, 6.3, 10.3, 16.3, 21.5, 24.8, 28.5, 30.6, 26.4, 20.4, 14.1, 8.3],
      min: [0.1, 0.0, 2.2, 7.1, 12.8, 17.7, 21.8, 23.3, 19.1, 12.7, 6.8, 2.2],
      rh: [76, 74, 69, 66, 69, 75, 78, 74, 74, 73, 74, 75],
      clear: [0.15, 0.22, 0.38, 0.50, 0.52, 0.42, 0.42, 0.55, 0.45, 0.42, 0.28, 0.17] },
    { name: '東京', lat: 35.69, coefCool: 1.0, coefHeat: 1.0,
      max: [9.8, 10.9, 14.2, 19.4, 23.6, 26.1, 29.9, 31.3, 27.5, 22.0, 16.7, 12.0],
      min: [1.2, 2.1, 5.0, 9.8, 14.6, 18.5, 22.4, 23.5, 20.3, 14.8, 8.8, 3.8],
      rh: [51, 52, 57, 62, 68, 75, 76, 74, 75, 71, 64, 56],
      clear: [0.62, 0.58, 0.50, 0.48, 0.45, 0.30, 0.40, 0.50, 0.38, 0.45, 0.52, 0.60] },
    { name: '名古屋', lat: 35.17, coefCool: 1.0, coefHeat: 1.0,
      max: [9.3, 10.5, 14.5, 20.1, 24.6, 27.6, 31.4, 33.2, 29.1, 23.3, 17.3, 11.7],
      min: [1.1, 1.6, 4.8, 10.1, 15.2, 19.6, 23.6, 24.7, 21.0, 14.8, 8.4, 3.2],
      rh: [64, 60, 58, 59, 64, 71, 74, 70, 70, 67, 66, 66],
      clear: [0.58, 0.58, 0.55, 0.52, 0.48, 0.33, 0.42, 0.52, 0.42, 0.50, 0.55, 0.58] },
    { name: '大阪', lat: 34.68, coefCool: 1.05, coefHeat: 0.92,
      max: [9.7, 10.5, 14.2, 19.9, 24.9, 28.0, 31.8, 33.7, 29.5, 23.7, 17.8, 12.3],
      min: [3.0, 3.2, 6.0, 10.9, 16.0, 20.3, 24.6, 25.8, 22.0, 16.0, 10.2, 5.3],
      rh: [61, 60, 59, 58, 61, 68, 70, 66, 67, 65, 64, 62],
      clear: [0.48, 0.48, 0.50, 0.52, 0.50, 0.35, 0.45, 0.55, 0.43, 0.50, 0.50, 0.50] },
    { name: '福岡', lat: 33.58, coefCool: 1.04, coefHeat: 0.91,
      max: [10.2, 11.6, 15.0, 19.9, 24.4, 27.2, 31.2, 32.5, 28.6, 23.7, 18.2, 12.6],
      min: [3.9, 4.4, 7.1, 11.5, 16.1, 20.3, 24.6, 25.4, 21.6, 15.8, 10.6, 5.9],
      rh: [63, 62, 63, 64, 67, 75, 75, 72, 72, 67, 66, 63],
      clear: [0.35, 0.42, 0.45, 0.50, 0.50, 0.33, 0.42, 0.50, 0.45, 0.52, 0.48, 0.38] }
  ];
  // 2025年の高温傾向を模した月別の上乗せ【ダミー】
  var ANOM = [0.3, -0.4, 0.8, 0.8, 0.9, 2.0, 2.3, 1.7, 2.0, 1.3, 0.5, 0.2];
  var MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var MSTART = [0]; for (var i = 0; i < 12; i++) MSTART.push(MSTART[i] + MDAYS[i]);

  function monthOfDay(d) { for (var m = 0; m < 12; m++) if (d < MSTART[m + 1]) return m; return 11; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------------------------------------------------------------- 湿り空気
  function psat(T) { return 610.94 * Math.exp(17.625 * T / (T + 243.04)); }
  function humRatio(T, rh) { var p = rh / 100 * psat(T); return 0.622 * p / (101325 - p); }
  function rhFromW(T, w) { return clamp(100 * w * 101325 / ((0.622 + w) * psat(T)), 1, 100); }
  function wetBulb(T, rh) { // Stull (2011)
    return T * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(T + rh) - Math.atan(rh - 1.676331) +
      0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
  }
  function globeTemp(Ta, mrt, v) { var c = 2.5e8 * Math.pow(Math.max(v, 0.1), 0.6); return (1.08e8 * mrt + c * Ta) / (1.08e8 + c); }
  function wbgt(Ta, mrt, v, rh) { return 0.7 * wetBulb(Ta, rh) + 0.3 * globeTemp(Ta, mrt, v); }
  function otCoef(v) { return 0.5 + 0.2 * clamp((v - 0.2) / 0.8, 0, 1); }
  function opTemp(Ta, mrt, v) { var a = otCoef(v); return a * Ta + (1 - a) * mrt; }

  // ---------------------------------------------------------------- 気象（合成・ダミー）
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normalAt(arr, d) { // 月の中日を通る線形補間
    var m = monthOfDay(d), mid = MSTART[m] + MDAYS[m] / 2, m2, t;
    if (d >= mid) { m2 = (m + 1) % 12; t = (d - mid) / ((MDAYS[m] + MDAYS[m2]) / 2); }
    else { m2 = (m + 11) % 12; t = (mid - d) / ((MDAYS[m] + MDAYS[m2]) / 2); }
    return lerp(arr[m], arr[m2], t);
  }
  function generateWeather(cityIdx) {
    var c = CITIES[cityIdx], r = rng(20250101 + cityIdx * 977);
    function gauss() { var u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var tmax = new Float32Array(365), tmin = new Float32Array(365), sky = new Uint8Array(365), rhd = new Float32Array(365);
    var a = 0, s = 1, d, m;
    for (d = 0; d < 365; d++) {
      m = monthOfDay(d);
      if (r() > 0.55) { var p = c.clear[m], u = r(); s = u < p ? 0 : (u < p + (1 - p) * 0.55 ? 1 : 2); }
      a = 0.7 * a + 1.8 * gauss();
      sky[d] = s;
      var an = a + ANOM[m];
      tmax[d] = normalAt(c.max, d) + an + (s === 0 ? 1.0 : s === 1 ? -0.5 : -2.0);
      tmin[d] = normalAt(c.min, d) + an + (s === 0 ? -1.0 : s === 1 ? 0.3 : 0.8);
      if (tmax[d] < tmin[d] + 1.5) tmax[d] = tmin[d] + 1.5;
      rhd[d] = clamp(normalAt(c.rh, d) + (s === 0 ? -6 : s === 1 ? 4 : 15) + 3 * gauss(), 25, 96);
    }
    var T = new Float32Array(8760), I = new Float32Array(8760), RH = new Float32Array(8760), WS = new Float32Array(8760);
    var phi = c.lat * Math.PI / 180, wsm = 2;
    for (d = 0; d < 365; d++) {
      var dp = (d + 364) % 365, dn = (d + 1) % 365;
      var decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + d + 1) / 365);
      var w = humRatio((tmax[d] + tmin[d]) / 2, rhd[d]);
      var kc = sky[d] === 0 ? 0.92 : sky[d] === 1 ? 0.45 : 0.16;
      for (var h = 0; h < 24; h++) {
        var t;
        if (h < 5.5) t = tmin[d] + (tmax[dp] - tmin[d]) * 0.5 * (1 + Math.cos(Math.PI * (h + 24 - 14) / 15.5));
        else if (h <= 14) t = tmin[d] + (tmax[d] - tmin[d]) * 0.5 * (1 - Math.cos(Math.PI * (h - 5.5) / 8.5));
        else t = tmin[dn] + (tmax[d] - tmin[dn]) * 0.5 * (1 + Math.cos(Math.PI * (h - 14) / 15.5));
        var k = d * 24 + h;
        T[k] = t;
        var sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(15 * (h - 12) * Math.PI / 180);
        I[k] = sinAlt > 0 ? 1050 * Math.pow(sinAlt, 1.2) * kc * (0.88 + 0.24 * r()) : 0;
        RH[k] = Math.min(98, rhFromW(t, w));
        wsm = 0.8 * wsm + 0.2 * (1 + 3.5 * r());
        WS[k] = wsm;
      }
    }
    return { city: c, T: T, I: I, RH: RH, WS: WS, sky: sky, tmax: tmax, tmin: tmin };
  }

  // 観測値（data/*.js）を計算用の形にする
  function weatherFromData(o) {
    var T = Float32Array.from(o.T), tmax = new Float32Array(365), tmin = new Float32Array(365);
    for (var d = 0; d < 365; d++) {
      var a = -99, b = 99;
      for (var h = 0; h < 24; h++) { var v = T[d * 24 + h]; if (v > a) a = v; if (v < b) b = v; }
      tmax[d] = a; tmin[d] = b;
    }
    return { city: { name: o.name, short: o.short || o.name, lat: o.lat, coefCool: o.coefCool, coefHeat: o.coefHeat }, observed: true,
      T: T, I: Float32Array.from(o.I), RH: Float32Array.from(o.RH), WS: Float32Array.from(o.WS), sky: Uint8Array.from(o.sky), tmax: tmax, tmin: tmin };
  }

  // ---------------------------------------------------------------- パネル配置
  function distribute(n, shares) { // 合計が n になるよう各列へ配分
    var tot = shares.reduce(function (s, v) { return s + v; }, 0), out = [], used = 0;
    shares.forEach(function (sh, i) { var k = i === shares.length - 1 ? n - used : Math.round(n * sh / tot); k = Math.max(0, Math.min(k, n - used)); out.push(k); used += k; });
    return out;
  }
  function buildPanels(layout, count) {
    var g = GEOM, rows, list = [], xa = g.ax0 + 3, xb = g.ax1 - 3;
    if (layout === 'rows') rows = [{ axis: 'y', c: g.ay0 + 1.2, a: xa, b: xb }, { axis: 'y', c: (g.ay0 + g.ay1) / 2, a: xa, b: xb }, { axis: 'y', c: g.ay1 - 1.2, a: xa, b: xb }];
    else if (layout === 'perimeter') rows = [{ axis: 'y', c: g.ay0 + 1.0, a: xa, b: xb }, { axis: 'y', c: g.ay1 - 1.0, a: xa, b: xb }, { axis: 'x', c: g.ax0 + 1.0, a: g.ay0 + 3, b: g.ay1 - 3 }];
    else rows = [{ axis: 'y', c: g.ay0 + 1.0, a: xa, b: xb }, { axis: 'y', c: g.ay1 - 1.0, a: xa, b: xb }];
    var ns = distribute(count, rows.map(function (r) { return r.b - r.a; }));
    rows.forEach(function (r, i) {
      var n = ns[i];
      for (var j = 0; j < n; j++) {
        var t = r.a + (r.b - r.a) * (j + 0.5) / n;
        list.push(r.axis === 'y' ? { axis: 'y', x: t, y: r.c } : { axis: 'x', x: r.c, y: t });
      }
    });
    return list;
  }

  // ---------------------------------------------------------------- 立体角（長方形の厳密式）
  function fT(u, v, h) { return Math.atan(u * v / (h * Math.sqrt(u * u + v * v + h * h))); }
  function rectOmega(h, u1, u2, v1, v2) { // 点から距離 h の平面上の長方形
    h = Math.max(Math.abs(h), 0.05);
    return Math.abs(fT(u2, v2, h) - fT(u1, v2, h) - fT(u2, v1, h) + fT(u1, v1, h));
  }
  function winOmega(g, x, y, z) {
    if (g.wall === 'N') return rectOmega(y, g.a1 - x, g.a2 - x, g.z1 - z, g.z2 - z);
    if (g.wall === 'S') return rectOmega(GEOM.D - y, g.a1 - x, g.a2 - x, g.z1 - z, g.z2 - z);
    if (g.wall === 'W') return rectOmega(x, g.a1 - y, g.a2 - y, g.z1 - z, g.z2 - z);
    return rectOmega(GEOM.W - x, g.a1 - y, g.a2 - y, g.z1 - z, g.z2 - z);
  }
  function gx(i) { return GEOM.ax0 + (i + 0.5) * GEOM.cell; }
  function gy(j) { return GEOM.ay0 + (j + 0.5) * GEOM.cell; }
  function panelOmega(P, x, y, z) {
    var hw = PANEL.w / 2, z1 = PANEL.z0 - z, z2 = PANEL.z0 + PANEL.h - z;
    return P.axis === 'y' ? rectOmega(P.y - y, P.x - hw - x, P.x + hw - x, z1, z2) : rectOmega(P.x - x, P.y - hw - y, P.y + hw - y, z1, z2);
  }
  function normalizeWeights(F) {
    var n = GEOM.NX * GEOM.NY, R = F.raw, m = { floor: 0, roof: 0, wall: 0, win: 0, panel: 0 };
    for (var k = 0; k < n; k++) {
      var pn = Math.max(0, R.panel[k]), s = R.floor[k] + R.roof[k] + R.wall[k] + R.win[k] + pn;
      F.floor[k] = R.floor[k] / s; F.roof[k] = R.roof[k] / s; F.wall[k] = R.wall[k] / s; F.win[k] = R.win[k] / s; F.panel[k] = pn / s;
      m.floor += F.floor[k]; m.roof += F.roof[k]; m.wall += F.wall[k]; m.win += F.win[k]; m.panel += F.panel[k];
    }
    for (var key in m) m[key] /= n;
    F.mean = m;
    return F;
  }
  // 評価高さ z の格子点から各面が見える割合（合計1）。MRT = Σ 割合 × 表面温度
  function computeViewWeights(z, panels) {
    var W = GEOM.W, D = GEOM.D, H = GEOM.H, NX = GEOM.NX, NY = GEOM.NY, n = NX * NY;
    function set() { return { floor: new Float32Array(n), roof: new Float32Array(n), wall: new Float32Array(n), win: new Float32Array(n), panel: new Float32Array(n) }; }
    var F = set(); F.raw = set(); F.z = z;
    var R = F.raw;
    for (var j = 0; j < NY; j++) {
      var y = gy(j);
      for (var i = 0; i < NX; i++) {
        var x = gx(i), k = j * NX + i;
        R.floor[k] = rectOmega(z, -x, W - x, -y, D - y);
        R.roof[k] = rectOmega(H - z, -x, W - x, -y, D - y);
        var wl = rectOmega(y, -x, W - x, -z, H - z) + rectOmega(D - y, -x, W - x, -z, H - z) +
          rectOmega(x, -y, D - y, -z, H - z) + rectOmega(W - x, -y, D - y, -z, H - z);
        var wn = 0;
        for (var q = 0; q < WINDOWS.length; q++) wn += winOmega(WINDOWS[q], x, y, z);
        R.wall[k] = wl - wn; R.win[k] = wn;
        var pn = 0;
        for (var p = 0; p < panels.length; p++) pn += panelOmega(panels[p], x, y, z);
        R.panel[k] = pn;
      }
    }
    return normalizeWeights(F);
  }
  // パネル1台を動かしたときの更新（そのパネルの分だけ差し替える）
  function movePanelWeights(F, oldP, newP) {
    var NX = GEOM.NX, NY = GEOM.NY, R = F.raw.panel;
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var x = gx(i), y = gy(j);
      R[j * NX + i] += panelOmega(newP, x, y, F.z) - panelOmega(oldP, x, y, F.z);
    }
    return normalizeWeights(F);
  }

  // ---------------------------------------------------------------- 気流（自由噴流の近似）
  // 噴流の軸の高さ。暖房の温風は中央付近で人の高さに届いたあと浮き上がり、冷房の冷風は床に沿って流れる
  function jetAxisZ(s, heat, z0) {
    var z = heat ? z0 - 0.75 * s + 0.022 * s * s : z0 - 0.5 * s - 0.002 * s * s;
    return clamp(z, heat ? 0.5 : 0.6, GEOM.H - 0.8);
  }
  // 吹出し風速に対する相対風速（0〜1程度）
  function jetNorm(x, y, z, heat) {
    var sum = 0;
    for (var i = 0; i < AC_UNITS.length; i++) {
      var u = AC_UNITS[i], s = (y - u.y) * u.dir;
      if (s < 0.2) continue;
      var l = x - u.x, dz = z - jetAxisZ(s, heat, u.z0), b = 0.35 + 0.11 * s;
      var e = (l * l + dz * dz) / (b * b);
      if (e > 9) continue;
      sum += Math.min(1, 3.5 / s) * Math.exp(-e);
    }
    return sum;
  }
  function computeJetPattern(z, heat) {
    var NX = GEOM.NX, NY = GEOM.NY, out = new Float32Array(NX * NY), m = 0;
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var v = jetNorm(gx(i), gy(j), z, heat); out[j * NX + i] = v; m += v;
    }
    out.mean = m / (NX * NY);
    return out;
  }
  function wallProx(x, y) { // 外壁の近さ（0〜1）と、南北の壁かどうか
    var dn = Math.min(y, GEOM.D - y), de = Math.min(x, GEOM.W - x);
    return { p: Math.exp(-Math.min(dn, de) / 1.5), ns: dn <= de };
  }

  // ---------------------------------------------------------------- 年間計算（1時間ごと・内部は5分刻み）
  var MODES = ['none', 'ac', 'eco'];
  var FIELDS = ['Ta', 'Tm', 'Tri', 'Twall', 'Twin', 'Tp', 'G', 'lf', 'fan', 'RH', 'P', 'MRT', 'OT', 'WBGT', 'v'];

  function capacities(wx) {
    var c = wx.city;
    var cool = K.loadCool * GEOM.Af * c.coefCool, heat = K.loadHeat * GEOM.Af * c.coefHeat;
    return { ac: { cool: cool, heat: heat }, eco: { cool: cool * K.ecoCap, heat: heat * K.ecoCap } };
  }
  function copHeat(To) { return clamp(3.6 + 0.08 * (To - 7), 2.0, 4.6); }
  function copCool(To) { return clamp(3.4 - 0.07 * (To - 35), 2.6, 5.6); }

  function simulate(p, wx, Fm, jetMean) {
    var ins = INSUL[p.insul], cap = capacities(wx), Af = GEOM.Af, H = GEOM.H, zr = GEOM.zRef;
    var Ca = 1.2 * 1005 * GEOM.V * K.CaFactor, Cm = K.Cm, hA = K.hAm * (Af + GEOM.Awall);
    var Ap = p.panels * PANEL.faceArea * 2;
    var Tg = 0; for (var i = 0; i < 8760; i++) Tg += wx.T[i]; Tg /= 8760;
    var dt = 300, NS = 12;
    var res = {};
    MODES.forEach(function (mode) {
      var o = {}; FIELDS.forEach(function (f) { o[f] = new Float32Array(8760); });
      var eco = mode === 'eco', hvac = mode !== 'none';
      var Fp = eco ? Fm.panel : 0, nf = eco ? 1 : 1 / (1 - Fm.panel); // パネルなしの方式は残りの面で正規化
      var Ff = Fm.floor * nf, Fr = Fm.roof * nf, Fw = Fm.wall * nf, Fg = Fm.win * nf;
      var Ta = wx.T[0] + 2, Tm = wx.T[0] + 3, Tri = Ta, heatFrac = 0;
      for (var k = -72; k < 8760; k++) {
        var kk = (k + 8760) % 8760, d = Math.floor(kk / 24), h = kk % 24, m = monthOfDay(d);
        var To = wx.T[kk], I = wx.I[kk], heat = K.heatMonths[m] === 1;
        var on = hvac && h >= p.opStart - (eco ? (p.preheat || 0) : 0) && h < p.opEnd, occ = (h >= p.opStart && h < p.opEnd) ? p.occupants : 0;
        var Tsol = To + 0.7 * I / 23, Twsol = To + 0.15 * I / 23;
        var qInt = occ * p.sensible + (occ > 0 ? K.light * Af : 0), qSol = ins.shgc * GEOM.Ag * 0.35 * I;
        var C = heat ? cap[eco ? 'eco' : 'ac'].heat : cap[eco ? 'eco' : 'ac'].cool;
        var jm = heat ? jetMean.heat : jetMean.cool, aAc = otCoef(0.1 + K.u0.ac * jm), aEco = otCoef(0.1 + K.u0.eco * jm);
        var sG = 0, sQa = 0, sQp = 0, sFan = 0, sPf = 0, E = 0, G = 0;
        for (var s = 0; s < NS; s++) {
          G = K.gRoof * Math.max(0, Tri - Ta) + (heat && heatFrac > 0 ? K.gStrat[mode] * Math.max(0, Ta - To) * (0.4 + 0.6 * heatFrac) : 0);
          var Ttop = Ta + G * (H - zr), Tmean = Ta + G * (H / 2 - zr);
          Tri = Ttop + ins.Ur / K.hi * (Tsol - Ttop);
          var Twall = Tm + ins.Uw / K.hi * (To - Tm), Twin = Ta + ins.Ug / K.hi * (To - Ta);
          var Qam = hA * (Tm - Ta);
          var Q0 = ins.Ur * Af * (Tsol - Ttop) + ins.Ug * GEOM.Ag * (To - Ta) +
            0.33 * (ins.ach * GEOM.V + K.ventPer * occ) * (To - Tmean) + Qam + 0.5 * qInt;
          var Qa = 0, Qp = 0, pf = 0;
          if (on) {
            var Tt = heat ? p.setHeat : p.setCool;
            if (eco && Fp > 0) {
              // 同じ体感で比べる：この部屋をエアコンだけで設定温度にしたときの体感温度を目標にして、
              // パネルの輻射と風の弱さを織り込んだうえで必要な空気温度を求める
              var mNo = (Fm.floor * Tm + Fm.roof * Tri + Fm.wall * Twall + Fm.win * Twin) / (1 - Fp);
              var mEco = mNo * (1 - Fp) + Fp * (heat ? K.TpHeat : K.TpCool);
              var Tneed = (aAc * Tt + (1 - aAc) * mNo - (1 - aEco) * mEco) / aEco;
              Tt = clamp(Tneed, Tt - K.relaxMax, Tt + K.relaxMax);
            }
            var req = (Tt - Ta) * Ca / dt - Q0, need = heat ? req : -req;
            if (need > 0) {
              if (eco && Ap > 0) {
                var full = K.hp * Ap * Math.max(0, heat ? K.TpHeat - Ta : Ta - K.TpCool);
                Qp = Math.min(full, need / (1 - K.radFrac), C);
                pf = full > 0 ? Qp / full : 0;
              }
              Qa = clamp(need - (1 - K.radFrac) * Qp, 0, C - Qp);
              sFan++;
            }
          }
          var sg = heat ? 1 : -1;
          heatFrac = heat && Qa > 0 ? Qa / C : 0;
          Ta += dt * (Q0 + sg * (Qa + (1 - K.radFrac) * Qp)) / Ca;
          Tm += dt * (-Qam + 0.5 * qInt + qSol + ins.Uw * GEOM.Awall * (Twsol - Tm) + K.Uf * Af * (Tg - Tm) + sg * K.radFrac * Qp) / Cm;
          var q = Qa + Qp;
          E += heat ? q / copHeat(To) : q * K.latent / copCool(To);
          sG += G; sQa += sg * Qa / C; sQp += Qp; sPf += pf;
        }
        if (k < 0) continue;
        var fan = sFan / NS, lf = sQa / NS, pfa = sPf / NS;
        var Twl = Tm + ins.Uw / K.hi * (To - Tm), Twn = Ta + ins.Ug / K.hi * (To - Ta);
        var Tp = eco ? Ta + pfa * ((heat ? K.TpHeat : K.TpCool) - Ta) : Ta;
        var mrt = Ff * Tm + Fr * Tri + Fw * Twl + Fg * Twn + Fp * Tp;
        var v = 0.1 + K.u0[mode] * fan * (heat ? jetMean.heat : jetMean.cool);
        var w = humRatio(To, wx.RH[kk]) + (occ > 0 ? 0.0008 : 0);
        var rh = rhFromW(Ta, w);
        if (!heat && fan > 0) rh = Math.min(rh, 60 + 40 * (1 - fan));
        o.Ta[k] = Ta; o.Tm[k] = Tm; o.Tri[k] = Tri; o.Twall[k] = Twl; o.Twin[k] = Twn; o.Tp[k] = Tp;
        o.G[k] = sG / NS; o.lf[k] = lf; o.fan[k] = fan; o.RH[k] = rh;
        o.P[k] = E / NS / 1000 + K.fanKW[mode] * fan;
        o.MRT[k] = mrt; o.v[k] = v; o.OT[k] = opTemp(Ta, mrt, v); o.WBGT[k] = wbgt(Ta, mrt, v, rh);
      }
      res[mode] = o;
    });
    res.summary = summarize(p, wx, res, cap);
    return res;
  }

  function summarize(p, wx, res, cap) {
    var S = { modes: {}, capped: false };
    MODES.forEach(function (mode) {
      var o = res[mode], s = { kwh: 0, monthly: new Float64Array(12), wbgt28: 0, wbgt31: 0, cold: 0, peak: 0, opHours: 0 };
      for (var k = 0; k < 8760; k++) {
        var h = k % 24, m = monthOfDay(Math.floor(k / 24));
        s.kwh += o.P[k]; s.monthly[m] += o.P[k]; if (o.P[k] > s.peak) s.peak = o.P[k];
        if (h >= p.opStart && h < p.opEnd) {
          s.opHours++;
          if (o.WBGT[k] >= 31) s.wbgt31++; if (o.WBGT[k] >= 28) s.wbgt28++;
          if (o.OT[k] < 12) s.cold++;
        }
      }
      S.modes[mode] = s;
    });
    var a = S.modes.ac, e = S.modes.eco;
    S.rawRate = a.kwh > 0 ? 1 - e.kwh / a.kwh : 0;
    if (S.rawRate > K.capRate) { // メーカー公表の最大削減率を上限とする
      var f = a.kwh * (1 - K.capRate) / e.kwh;
      for (var k2 = 0; k2 < 8760; k2++) res.eco.P[k2] *= f;
      e.kwh *= f; e.peak *= f; for (var m2 = 0; m2 < 12; m2++) e.monthly[m2] *= f;
      S.capped = true;
    }
    S.rate = a.kwh > 0 ? 1 - e.kwh / a.kwh : 0;
    // 契約電力は、計算上の最大需要電力（1時間平均の最大値）とする
    MODES.forEach(function (mode) { S.modes[mode].contract = S.modes[mode].peak; });
    MODES.forEach(function (mode) {
      var s = S.modes[mode];
      s.energyCost = s.kwh * p.price; s.basicCost = s.contract * p.basic * 12; s.cost = s.energyCost + s.basicCost;
      s.co2 = s.kwh * K.co2;
    });
    S.cap = cap;
    return S;
  }

  // ---------------------------------------------------------------- ある時刻の分布（評価面）
  // st: 1時間値を補間した状態。out: 格子の値。layer: ot | ta | mrt | wind | wbgt
  function computeField(layer, mode, st, heat, z, F, jet, out) {
    var NX = GEOM.NX, NY = GEOM.NY, eco = mode === 'eco';
    var u0 = K.u0[mode] * st.fan;
    var dT = mode === 'none' ? 0 : K.dTs[mode][heat ? 'heat' : 'cool'] * (0.3 + 0.7 * Math.abs(st.lf)) * st.fan * 0.6;
    var base = st.Ta + st.G * (z - GEOM.zRef);
    var Tns = 0.7 * st.Twall + 0.3 * st.Twin;
    var w = humRatio(st.Ta, st.RH), sum = 0;
    for (var j = 0; j < NY; j++) {
      var y = gy(j);
      for (var i = 0; i < NX; i++) {
        var k = j * NX + i, x = gx(i), val;
        var v = 0.1 + u0 * jet[k];
        if (layer === 'wind') val = v;
        else {
          var wp = wallProx(x, y);
          var Ta = base + dT * jet[k] + 0.4 * ((wp.ns ? Tns : st.Twall) - st.Ta) * wp.p;
          if (layer === 'ta') val = Ta;
          else {
            var fp = F.panel[k], mrt;
            if (eco) mrt = F.floor[k] * st.Tm + F.roof[k] * st.Tri + F.wall[k] * st.Twall + F.win[k] * st.Twin + fp * st.Tp;
            else mrt = (F.floor[k] * st.Tm + F.roof[k] * st.Tri + F.wall[k] * st.Twall + F.win[k] * st.Twin) / (1 - fp);
            if (layer === 'mrt') val = mrt;
            else if (layer === 'ot') val = opTemp(Ta, mrt, v);
            else val = wbgt(Ta, mrt, v, rhFromW(Ta, w));
          }
        }
        out[k] = val; sum += val;
      }
    }
    return sum / (NX * NY);
  }
  // 任意の点の空気温度と風速（断面表示・気流の粒子に使う）
  function airAt(x, y, z, mode, st, heat) {
    var jn = mode === 'none' ? 0 : jetNorm(x, y, z, heat);
    var dT = mode === 'none' ? 0 : K.dTs[mode][heat ? 'heat' : 'cool'] * (0.3 + 0.7 * Math.abs(st.lf)) * st.fan * 0.6;
    var wp = wallProx(x, y);
    return {
      T: st.Ta + st.G * (z - GEOM.zRef) + dT * jn + 0.4 * ((wp.ns ? 0.7 * st.Twall + 0.3 * st.Twin : st.Twall) - st.Ta) * wp.p,
      v: 0.1 + K.u0[mode] * st.fan * jn
    };
  }

  var api = {
    GEOM: GEOM, WINDOWS: WINDOWS, AC_UNITS: AC_UNITS, PANEL: PANEL, INSUL: INSUL, K: K, CITIES: CITIES, MODES: MODES, FIELDS: FIELDS,
    MSTART: MSTART, MDAYS: MDAYS, monthOfDay: monthOfDay, clamp: clamp, lerp: lerp,
    generateWeather: generateWeather, weatherFromData: weatherFromData, buildPanels: buildPanels, computeViewWeights: computeViewWeights, movePanelWeights: movePanelWeights,
    gx: gx, gy: gy, computeJetPattern: computeJetPattern, jetNorm: jetNorm, jetAxisZ: jetAxisZ, simulate: simulate,
    computeField: computeField, airAt: airAt, wbgt: wbgt, opTemp: opTemp, rhFromW: rhFromW, humRatio: humRatio, capacities: capacities
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GymModel = api;
})(typeof window !== 'undefined' ? window : this);
