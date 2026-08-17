/* ==========================================================================
   metrics.js — ランドマーク検出と指標算出（SPEC §3-3, §3-4）
   ランドマークは可能な限りグリッドから実測する。Phase 1 で実スキャンに
   差し替えたときに同じ関数がそのまま使えるようにするため。
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT;
  var CONST = FT.CONST;

  /* 足囲の背側は Phase 0 でモデル化していない。半楕円で近似する際の
     短半径 ÷ 足幅。UI では必ず「推定」と表示すること（SPEC §9-4）。 */
  var DORSAL_RATIO = 0.52;

  /* 母趾内側縁を直線近似する v 帯。
     手前は CONST.HVA_V0（振れの始まり）より前、奥は趾先の sqrt キャップ
     （v>0.925 で効き始める）の手前。この帯の中では縁が直線になる。 */
  var HALLUX_BAND = [0.80, 0.92];

  function rowIndex(grid, v) {
    return Math.round(FT.clamp01(v) * (grid.nz - 1));
  }

  /* 指定行の足の範囲。masked でない行は null。 */
  function rowExtent(grid, j) {
    var nx = grid.nx, base = j * nx, iMin = -1, iMax = -1;
    for (var i = 0; i < nx; i++) {
      if (grid.mask[base + i]) { if (iMin < 0) iMin = i; iMax = i; }
    }
    if (iMin < 0) return null;
    return {
      iMin: iMin, iMax: iMax,
      xMin: FT.cellX(grid, iMin), xMax: FT.cellX(grid, iMax),
      xMid: (FT.cellX(grid, iMin) + FT.cellX(grid, iMax)) / 2,
      width: FT.cellX(grid, iMax) - FT.cellX(grid, iMin)
    };
  }

  function rowMaxHeight(grid, j) {
    var nx = grid.nx, base = j * nx, m = 0;
    for (var i = 0; i < nx; i++) {
      if (grid.mask[base + i] && grid.height[base + i] > m) m = grid.height[base + i];
    }
    return m;
  }

  /* 縁の x をセル未満の精度で求める。
     マスクの最外セルをそのまま使うと ±pitch_x/2（約 0.8mm）の量子化誤差が乗り、
     30mm ほどの区間で傾きを取る HVA が 1° 以上ぶれる。
     縁の近くでは高さが縁からの距離にほぼ比例する（h ∝ silhouette/EDGE_FALLOFF）ので、
     内側2セルから高さ 0 の位置へ外挿する。実スキャンでも同じ性質が使える。 */
  function edgeXSub(grid, j, wantMin) {
    var e = rowExtent(grid, j);
    if (!e) return null;
    var b = j * grid.nx;
    var i0 = wantMin ? e.iMin : e.iMax;
    var i1 = wantMin ? i0 + 1 : i0 - 1;
    if (i1 < e.iMin || i1 > e.iMax) return FT.cellX(grid, i0);
    var h0 = grid.height[b + i0], h1 = grid.height[b + i1];
    if (h1 <= h0) return FT.cellX(grid, i0);
    var t = FT.clamp01(h0 / (h1 - h0));
    return FT.cellX(grid, i0) + (wantMin ? -t : t) * grid.pitch_x;
  }

  /* 行の中心。両縁の平均を取るので、片側だけを見るより誤差が小さい。 */
  function rowMidSub(grid, j) {
    var a = edgeXSub(grid, j, true), b = edgeXSub(grid, j, false);
    return (a === null || b === null) ? null : (a + b) / 2;
  }

  /* ------------------------------------------------------------------ *
   * ランドマーク（SPEC §3-3）
   * ------------------------------------------------------------------ */
  function landmarks(grid) {
    var p = grid.params;
    var msign = FT.medialSign(grid.side);
    var nz = grid.nz, j;

    // 踵後端・最長趾先端：マスクが存在する最初／最後の行
    var jHeel = -1, jToe = -1;
    for (j = 0; j < nz; j++) { if (rowExtent(grid, j)) { jHeel = j; break; } }
    for (j = nz - 1; j >= 0; j--) { if (rowExtent(grid, j)) { jToe = j; break; } }

    var eHeel = rowExtent(grid, jHeel), eToe = rowExtent(grid, jToe);

    // 中足骨頭部：v∈[0.55,0.72] の帯で内側／外側の最突出点をそれぞれ探す
    var j0 = rowIndex(grid, 0.55), j1 = rowIndex(grid, 0.72);
    var medX = null, medJ = j0, latX = null, latJ = j0;
    for (j = j0; j <= j1; j++) {
      var e = rowExtent(grid, j);
      if (!e) continue;
      var mx = edgeXSub(grid, j, msign < 0);
      var lx = edgeXSub(grid, j, msign >= 0);
      if (medX === null || msign * (mx - medX) > 0) { medX = mx; medJ = j; }
      if (latX === null || msign * (lx - latX) < 0) { latX = lx; latJ = j; }
    }

    // 舟状骨：内側縦アーチ頂点の v 位置。高さは archAmp から与える既知値。
    // Phase 1 では実スキャンの内側輪郭曲率から自動検出に差し替える。
    var jNav = rowIndex(grid, CONST.LM_V.navicular);
    var eNav = rowExtent(grid, jNav);
    var navX = eNav ? (msign < 0 ? eNav.xMin + eNav.width * 0.22
                                 : eNav.xMax - eNav.width * 0.22) : 0;
    var navY = CONST.NAV_BASE + p.archAmp * CONST.NAV_GAIN;

    var jSph = rowIndex(grid, CONST.LM_V.sphyrion);
    var eSph = rowExtent(grid, jSph);
    var sphX = eSph ? (msign < 0 ? eSph.xMin + eSph.width * 0.18
                                 : eSph.xMax - eSph.width * 0.18) : 0;

    return {
      pternion:        [eHeel ? eHeel.xMid : 0, 0, FT.cellZ(grid, jHeel)],
      acropodion:      [eToe ? eToe.xMid : 0, 0, FT.cellZ(grid, jToe)],
      metatarsale_tib: [medX, rowMaxHeight(grid, medJ), FT.cellZ(grid, medJ)],
      metatarsale_fib: [latX, rowMaxHeight(grid, latJ), FT.cellZ(grid, latJ)],
      navicular:       [navX, navY, FT.cellZ(grid, jNav)],
      sphyrion:        [sphX, CONST.SPHYRION_RATIO * p.length, FT.cellZ(grid, jSph)]
    };
  }
  FT.landmarks = landmarks;

  /* ------------------------------------------------------------------ *
   * 外反母趾角
   * 母趾領域は中心線ごと外側へ平行移動している（SPEC §4-2）。
   * その区間で行の中心 x の傾き dx/dz を最小二乗で求め、
   * 振れのない基準輪郭の傾きとの差を角度に直す。
   * 基準は解析プロファイルから求めるので、grid 側の量子化誤差だけが残る。
   * Phase 1 の実スキャンでは基準傾きを母集団平均へ差し替える。
   * ------------------------------------------------------------------ */
  function midSlope(grid, vLo, vHi) {
    var jLo = rowIndex(grid, vLo), jHi = rowIndex(grid, vHi);
    var n = 0, sz = 0, sx = 0, szz = 0, szx = 0;
    for (var j = jLo; j <= jHi; j++) {
      var x = rowMidSub(grid, j);
      if (x === null) continue;
      var z = FT.cellZ(grid, j);
      n++; sz += z; sx += x; szz += z * z; szx += z * x;
    }
    if (n < 3) return 0;
    var den = n * szz - sz * sz;
    if (Math.abs(den) < 1e-9) return 0;
    return (n * szx - sz * sx) / den;
  }

  /* 基準（振れなし）の中心線の傾き。解析プロファイルから直接求める。 */
  function baseMidSlope(p) {
    var n = 0, sz = 0, sx = 0, szz = 0, szx = 0;
    for (var s = 0; s <= 40; s++) {
      var v = HALLUX_BAND[0] + (HALLUX_BAND[1] - HALLUX_BAND[0]) * (s / 40);
      var x = FT.lerpSmooth(FT.CLINE, v) * CONST.U_TO_LEN * p.length;
      var z = v * p.length;
      n++; sz += z; sx += x; szz += z * z; szx += z * x;
    }
    return (n * szx - sz * sx) / (n * szz - sz * sz);
  }

  function hvaOf(grid) {
    var msign = FT.medialSign(grid.side);
    var measured = midSlope(grid, HALLUX_BAND[0], HALLUX_BAND[1]);
    var base = baseMidSlope(grid.params);
    // 左足は x が反転しているので、右足空間の基準と比べる前に符号を戻す
    var d = (msign < 0 ? measured : -measured) - base;
    return Math.atan(d) * 180 / Math.PI;
  }

  /* ------------------------------------------------------------------ *
   * 足囲（推定）：足底の断面弧長 ＋ 背側を半楕円で近似した弧長
   * 背側形状は Phase 0 で計測していない。UI では「推定」を必ず添える。
   * ------------------------------------------------------------------ */
  function ballGirth(grid, j) {
    var e = rowExtent(grid, j);
    if (!e) return 0;
    var base = j * grid.nx, arc = 0;
    for (var i = e.iMin; i < e.iMax; i++) {
      var dh = grid.height[base + i + 1] - grid.height[base + i];
      arc += Math.sqrt(grid.pitch_x * grid.pitch_x + dh * dh);
    }
    var a = e.width / 2, b = DORSAL_RATIO * e.width;
    // Ramanujan 近似の周長の半分
    var per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    return arc + per / 2;
  }

  /* ------------------------------------------------------------------ *
   * アーチ容積：内側かつ v∈[0.28,0.62] の高さ積分（mm³）
   * ------------------------------------------------------------------ */
  function archVolume(grid) {
    var msign = FT.medialSign(grid.side);
    var jLo = rowIndex(grid, CONST.ARCH_VOL_V[0]);
    var jHi = rowIndex(grid, CONST.ARCH_VOL_V[1]);
    var cell = grid.pitch_x * grid.pitch_z, sum = 0;
    for (var j = jLo; j <= jHi; j++) {
      var e = rowExtent(grid, j);
      if (!e) continue;
      var base = j * grid.nx;
      for (var i = e.iMin; i <= e.iMax; i++) {
        if (!grid.mask[base + i]) continue;
        var x = FT.cellX(grid, i);
        if (msign * (x - e.xMid) > 0) sum += grid.height[base + i] * cell;
      }
    }
    return sum;
  }

  /* ------------------------------------------------------------------ *
   * 指標一式（SPEC §3-4）
   * ------------------------------------------------------------------ */
  function metrics(grid, lm) {
    lm = lm || landmarks(grid);
    var footLength = lm.acropodion[2] - lm.pternion[2];
    var footWidth = Math.abs(lm.metatarsale_fib[0] - lm.metatarsale_tib[0]);
    var jHeelW = rowIndex(grid, CONST.HEEL_W_V);
    var hwA = edgeXSub(grid, jHeelW, true), hwB = edgeXSub(grid, jHeelW, false);
    var truncated = footLength * (1 - CONST.TOE_LEN_RATIO);

    return {
      foot_length: footLength,
      foot_width: footWidth,
      ball_girth: ballGirth(grid, rowIndex(grid, CONST.BALL_V)),
      heel_width: (hwA === null || hwB === null) ? 0 : (hwB - hwA),
      instep_height: rowMaxHeight(grid, rowIndex(grid, CONST.INSTEP_V)),
      navicular_height: lm.navicular[1],
      asi: lm.navicular[1] / truncated * 100,
      arch_volume: archVolume(grid),
      hva: hvaOf(grid),
      width_ratio: footWidth / footLength,
      transverse: grid.params.transAmp
    };
  }
  FT.metrics = metrics;

  /* パラメータのみからの近似指標。母集団を2万件サンプリングする際、
     グリッドを実生成せずに済ませるために使う（SPEC §3-7）。
     archVolume の係数だけは実グリッドで一度校正する。 */
  var VOL_K = null;
  function refGrid(archAmp, transAmp) {
    return FT.buildGrid(FT.clampParams({
      length: 250, widthScale: 1.0, archAmp: archAmp, archPos: 0.44, archSkew: 0,
      transAmp: transAmp, hvaDeg: 0, toeSpring: 0.25, age: 40
    }), "R");
  }
  /* アーチ容積を vol = L³·widthScale·(k1·archAmp + k2·transAmp + k0) で近似する。
     archAmp=0 でも外側アーチ・踵パッドの寄与で容積は 0 にならないので、
     単純な比例式にすると扁平側のパーセンタイルが全部 0% に潰れる。 */
  function calibrate() {
    var L3 = Math.pow(250, 3);
    var v0 = archVolume(refGrid(0.0, 0.0)) / L3;
    var v1 = archVolume(refGrid(1.0, 0.0)) / L3;
    var v2 = archVolume(refGrid(0.0, 0.6)) / L3;
    VOL_K = { k0: v0, k1: v1 - v0, k2: (v2 - v0) / 0.6 };
  }
  function fastMetrics(p) {
    if (VOL_K === null) calibrate();
    var truncated = p.length * (1 - CONST.TOE_LEN_RATIO);
    var nav = CONST.NAV_BASE + p.archAmp * CONST.NAV_GAIN;
    return {
      foot_length: p.length,
      asi: nav / truncated * 100,
      arch_volume: Math.pow(p.length, 3) * p.widthScale *
                   (VOL_K.k0 + VOL_K.k1 * p.archAmp + VOL_K.k2 * p.transAmp),
      hva: p.hvaDeg,
      width_ratio: 0.392 * p.widthScale,
      transverse: p.transAmp,
      navicular_height: nav
    };
  }
  FT.fastMetrics = fastMetrics;

  /* ------------------------------------------------------------------ *
   * 接地圧の擬似分布（L4）。実測圧力ではない（SPEC §6）。
   * 床に近いセルほど、また踵・中足骨頭という支持部位ほど高く出す。
   * ------------------------------------------------------------------ */
  function estimatePressure(grid, reuse) {
    var nx = grid.nx, nz = grid.nz, n = nx * nz;
    var H = grid.height, M = grid.mask;
    var out = (reuse && reuse.length === n) ? reuse : new Float32Array(n);
    var H0 = 6.0;   // mm。これだけ床から離れると接地寄与がほぼ消える
    var invH0 = 1 / H0, mx = 0, i, j, k;

    // 行ごとに v 依存の係数を1回だけ求め、最大値は本ループ内で拾う。
    // 別パスで走査すると 2万セルを 3 周することになる。
    for (j = 0; j < nz; j++) {
      var base = j * nx;
      var v = j / (nz - 1);
      var t1 = (v - 0.10) / 0.10, t2 = (v - 0.63) / 0.09, t3 = (v - 0.94) / 0.06;
      var region = 0.22 + Math.exp(-t1 * t1) + 0.95 * Math.exp(-t2 * t2)
                 + 0.5 * Math.exp(-t3 * t3);
      var lo = -1, hi = -1;
      for (i = 0; i < nx; i++) { if (M[base + i]) { if (lo < 0) lo = i; hi = i; } }
      for (i = 0; i < nx; i++) {
        k = base + i;
        if (lo < 0 || i < lo || i > hi || !M[k]) { out[k] = 0; continue; }
        // 縁は接地しても圧が逃げるので落とす
        var d = i - lo; if (hi - i < d) d = hi - i;
        var edge = d > 4 ? 1 : d / 4;
        var p = Math.exp(-H[k] * invH0) * region * (0.35 + 0.65 * edge);
        out[k] = p;
        if (p > mx) mx = p;
      }
    }
    if (mx > 0) { var s = 1 / mx; for (k = 0; k < n; k++) out[k] *= s; }
    return out;
  }
  FT.estimatePressure = estimatePressure;

  FT.rowExtent = rowExtent;
  FT.rowIndex = rowIndex;

})(typeof window !== "undefined" ? window : this);
