/* ==========================================================================
   insole.js — インソール上面の生成（SPEC §4-5 / レイヤ L9）
   本モジュールの出力は接客説明のための可視化であり、製造データではない
   （SPEC §0-3）。STL / CAM 出力を足してはならない。

   足底面と違い、インソールは (s, t) のパラメトリック表現で持つ。
   s = 長さ方向、t = 幅方向の -1..1。理由は SPEC §4-5-1 に記載：
   足のグリッド（nx=96, 列ピッチ 1.6mm）で外形を持つと、面積のわりに
   外周が長いインソールの輪郭が目に見えて階段状になる。
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT;
  var CONST = FT.CONST;
  var INS = CONST.INSOLE;

  /* 処方カーネル（SPEC §3-6 の表）。u, v は右足空間の正規化グリッド座標。 */
  var KERNEL = {
    navicular:       { u: -0.16, v: 0.440, su: 0.15, sv: 0.115 },
    cuboid:          { u:  0.20, v: 0.400, su: 0.13, sv: 0.105 },
    metatarsale_tib: { u: -0.13, v: 0.655, su: 0.13, sv: 0.060 },
    metatarsale_fib: { u:  0.19, v: 0.615, su: 0.12, sv: 0.060 },
    transverse:      { u: -0.01, v: 0.600, su: 0.19, sv: 0.055 },
    heel:            { u:  0.00, v: 0.095, su: 0.24, sv: 0.085 }
  };
  FT.INSOLE_KERNEL = KERNEL;

  /* ラスト底面の半幅プロファイル。**足のシルエットではない**（SPEC §4-5-1）。
     値は足囲部の半幅に対する比。実物写真の観察（ref/insole_bestposition.md）：
       - 最大幅は足長比 0.70 付近
       - 踵は最大幅の 0.68 倍で、ウエストとの差が小さい（足型ほど締まらない）
       - 趾は分離せず、先端は単一の丸みで閉じる */
  var LAST_PROFILE = [
    [0.00, 0.30], [0.04, 0.50], [0.10, 0.625], [0.16, 0.672], [0.24, 0.685],
    [0.33, 0.670], [0.43, 0.692], [0.53, 0.790], [0.61, 0.915], [0.68, 0.985],
    [0.72, 1.000], [0.79, 0.980], [0.86, 0.918], [0.91, 0.845], [0.95, 0.735],
    [1.00, 0.560]
  ];
  /* 足囲部の半幅（u 単位）。HALFW の最大値と揃える。 */
  var BALL_HALF = 0.360;

  var RIM_MM = 13.0;     // 踵カップの縁とみなす幅（mm）
  var NW = 64;           // 幅方向のサンプル数

  /* ------------------------------------------------------------------ *
   * 足の高さ場の平滑化。
   * インソールは趾の細かい凹凸を写し取らない（実物のトップカバーは平滑）。
   * [1,2,1] の可分フィルタ。マスク外は平均に含めない。
   * ------------------------------------------------------------------ */
  /* 足のマスクを外側へ広げ、外側のセルを近傍の平均で埋める。
     インソールは足より一回り大きいので、足の縁の外を単に 0 にすると
     縁のところで高さが数 mm 落ちる崖ができ、面に折れ目として出る。
     数セル外まで値を伸ばしてから平滑化すると、縁が自然に寝る。 */
  var DILATE = 8;
  function dilateField(grid, src) {
    var nx = grid.nx, nz = grid.nz, n = nx * nz;
    var a = new Float32Array(src);
    var m = new Uint8Array(grid.mask);
    var nm = new Uint8Array(n);
    var i, j, k, t;
    for (t = 0; t < DILATE; t++) {
      nm.set(m);
      for (j = 0; j < nz; j++) {
        for (i = 0; i < nx; i++) {
          k = j * nx + i;
          if (m[k]) continue;
          var s = 0, c = 0;
          if (i > 0 && m[k - 1]) { s += a[k - 1]; c++; }
          if (i < nx - 1 && m[k + 1]) { s += a[k + 1]; c++; }
          if (j > 0 && m[k - nx]) { s += a[k - nx]; c++; }
          if (j < nz - 1 && m[k + nx]) { s += a[k + nx]; c++; }
          if (c) {
            // 外へ行くほど床へ寄せる。縁の値をそのまま伸ばすと台地になる。
            a[k] = (s / c) * 0.72;
            nm[k] = 1;
          }
        }
      }
      m.set(nm);
    }
    return { field: a, mask: m };
  }

  function blurHeight(grid, iter) {
    var nx = grid.nx, nz = grid.nz, m = grid.mask;
    var a = new Float32Array(grid.height);
    var b = new Float32Array(nx * nz);
    var i, j, k, t, s, w;
    for (t = 0; t < iter; t++) {
      for (j = 0; j < nz; j++) {
        for (i = 0; i < nx; i++) {
          k = j * nx + i;
          if (!m[k]) { b[k] = 0; continue; }
          s = 2 * a[k]; w = 2;
          if (i > 0 && m[k - 1]) { s += a[k - 1]; w++; }
          if (i < nx - 1 && m[k + 1]) { s += a[k + 1]; w++; }
          b[k] = s / w;
        }
      }
      for (j = 0; j < nz; j++) {
        for (i = 0; i < nx; i++) {
          k = j * nx + i;
          if (!m[k]) { a[k] = 0; continue; }
          s = 2 * b[k]; w = 2;
          if (j > 0 && m[k - nx]) { s += b[k - nx]; w++; }
          if (j < nz - 1 && m[k + nx]) { s += b[k + nx]; w++; }
          a[k] = s / w;
        }
      }
    }
    return a;
  }

  /* ------------------------------------------------------------------ *
   * 外形（SPEC §4-5-1）
   * 先端と踵は楕円キャップで閉じる。制御点補間だけで 0 に落とすと
   * smoothstep の端で接線が寝て、先端が丸みではなく平らに見える。
   * ------------------------------------------------------------------ */
  function outlineProfile(params, nS) {
    var ball = BALL_HALF * params.widthScale * INS.LAST_WIDTH;
    var w = new Float32Array(nS), s, i;
    for (i = 0; i < nS; i++) {
      s = i / (nS - 1);
      w[i] = FT.lerpSmooth(LAST_PROFILE, s) * ball;
    }
    var iToe = Math.round(INS.TOE_MERGE * (nS - 1));
    var wToe = w[iToe];
    for (i = iToe + 1; i < nS; i++) {
      var tT = (i - iToe) / (nS - 1 - iToe);
      w[i] = wToe * Math.sqrt(Math.max(0, 1 - tT * tT));
    }
    var iHeel = Math.round(INS.HEEL_ROUND * (nS - 1));
    var wHeel = w[iHeel];
    for (i = 0; i < iHeel; i++) {
      var tH = (iHeel - i) / iHeel;
      w[i] = wHeel * Math.sqrt(Math.max(0, 1 - tH * tH));
    }
    // 両端を厳密に 0 にすると幅方向の標本点が 1 点に潰れ、
    // 三角形が縮退して法線が暴れる（先端に黒い縁が出る）。
    // 実物も縁は角ではなく丸いので、下限を残すほうが形としても正しい。
    var wMin = INS.MIN_HALF_W;
    for (i = 0; i < nS; i++) { if (w[i] < wMin) w[i] = wMin; }
    return w;
  }

  /* ------------------------------------------------------------------ *
   * 補正場 lift(u,v)（mm）。処方の重ね合わせ。
   * 右足空間で計算する。左足はグリッド書き込み時に u の符号を反転する。
   * ------------------------------------------------------------------ */
  function liftAt(prescriptions, u, v, lengthMm) {
    var total = 0;
    for (var n = 0; n < prescriptions.length; n++) {
      var rx = prescriptions[n];
      var K = KERNEL[rx.landmark];
      if (!K) continue;
      var du = (u - K.u) / K.su, dv = (v - K.v) / K.sv;
      var g = Math.exp(-(du * du + dv * dv));
      total += (rx.lift_mm || 0) * g;
      if (rx.tilt_deg) {
        // 回転ではなく u 方向の線形勾配として実装する（SPEC §3-6）。
        // 内側（u < K.u）が持ち上がる向きを正とする。
        var armMm = (K.u - u) * CONST.U_TO_LEN * lengthMm;
        total += Math.tan(rx.tilt_deg * Math.PI / 180) * armMm * g;
      }
    }
    return total;
  }
  FT.liftAt = liftAt;

  /* 足グリッドの行 jF、ワールド x における足底面の高さ。
     行内は線形補間する。足の外は 0（＝床）。 */
  function sampleFootRow(grid, arr, mask, jF, x) {
    if (jF < 0 || jF >= grid.nz) return 0;
    var f = (x - grid.origin[0]) / grid.pitch_x;
    var i0 = Math.floor(f), i1 = i0 + 1, fr = f - i0;
    var b = jF * grid.nx;
    var h0 = (i0 >= 0 && i0 < grid.nx && mask[b + i0]) ? arr[b + i0] : 0;
    var h1 = (i1 >= 0 && i1 < grid.nx && mask[b + i1]) ? arr[b + i1] : 0;
    return h0 + (h1 - h0) * fr;
  }

  /* ------------------------------------------------------------------ *
   * インソール生成
   * 長さ方向は足グリッドの行ピッチに揃え、前後にだけ整数行ぶんはみ出させる。
   * こうすると足底面との差分に z 方向の補間誤差が入らない。
   * ------------------------------------------------------------------ */
  function buildInsole(footGrid, prescriptions) {
    prescriptions = prescriptions || [];
    var p = footGrid.params;
    var nzF = footGrid.nz;
    var zPad = Math.round((INS.LAST_SCALE - 1) * nzF / 2);
    var nS = nzF + 2 * zPad;
    var mirror = (footGrid.side === "L");
    var msign = mirror ? -1 : 1;
    var K = CONST.U_TO_LEN * p.length;      // u → mm

    var halfW = outlineProfile(p, nS);
    var center = new Float32Array(nS);
    var zRow = new Float32Array(nS);
    // 平滑化 → 外側へ拡張 の順。拡張してから平滑化すると足の縁が甘くなる。
    var ext = dilateField(footGrid, blurHeight(footGrid, INS.SMOOTH_ITER));
    var base = ext.field, baseMask = ext.mask;

    var top = new Float32Array(nS * NW);
    var diff = new Float32Array(nS * NW);
    var lift = new Float32Array(nS * NW);
    var xs = new Float32Array(nS * NW);

    var j, t, k, s, u;

    for (j = 0; j < nS; j++) {
      s = j / (nS - 1);
      // ラストは足より中心線がまっすぐ。ドリフトを 0.6 に抑える。
      center[j] = FT.lerpSmooth(FT.CLINE, s) * 0.6;
      zRow[j] = (j - zPad) * footGrid.pitch_z;
    }

    for (j = 0; j < nS; j++) {
      s = j / (nS - 1);
      var jF = j - zPad;                     // 対応する足グリッドの行
      var vF = jF / (nzF - 1);               // 足の v（範囲外にもなり得る）
      var cupV = INS.CUP_MM * Math.exp(-Math.pow((s - INS.CUP_V) / INS.CUP_SV, 2));
      var wMm = halfW[j] * K;

      for (t = 0; t < NW; t++) {
        k = j * NW + t;
        var tt = (NW === 1) ? 0 : (2 * t / (NW - 1) - 1);   // -1..1
        u = center[j] + tt * halfW[j];                       // 右足空間
        var xWorld = msign * u * K;
        xs[k] = xWorld;

        var lf = liftAt(prescriptions, u, vF, p.length);

        // 踵カップ：縁からの距離で立ち上げる
        var dEdge = (1 - Math.abs(tt)) * wMm;
        var rim = FT.clamp01(1 - dEdge / RIM_MM);
        var cup = cupV * Math.pow(rim, 1.5);

        var bh = sampleFootRow(footGrid, base, baseMask, jF, xWorld);
        // 差分は「実際の足底面」との差。こちらは拡張していない元の面を使う。
        var fh = sampleFootRow(footGrid, footGrid.height, footGrid.mask, jF, xWorld);

        var h = Math.max(bh + lf + cup, INS.BASE_THICK);
        top[k] = h;
        lift[k] = lf;
        diff[k] = h - fh;
      }
    }

    return {
      nS: nS, nW: NW, zPad: zPad,
      halfW: halfW, center: center, zRow: zRow,
      top: top, diff: diff, lift: lift, x: xs,
      uToMm: K, side: footGrid.side, params: p,
      prescriptions: prescriptions
    };
  }
  FT.buildInsole = buildInsole;

  /* 処方の適用位置をワールド座標で返す（L6 の矢印の根元に使う） */
  function rxAnchor(footGrid, rx) {
    var K = KERNEL[rx.landmark];
    if (!K) return null;
    var mirror = (footGrid.side === "L");
    var u = mirror ? -K.u : K.u;
    var x = u * CONST.U_TO_LEN * footGrid.params.length;
    var z = K.v * footGrid.params.length;
    var i = Math.round((x - footGrid.origin[0]) / footGrid.pitch_x);
    var j = Math.round(z / footGrid.pitch_z);
    i = FT.clamp(i, 0, footGrid.nx - 1);
    j = FT.clamp(j, 0, footGrid.nz - 1);
    var k = j * footGrid.nx + i;
    return [x, footGrid.mask[k] ? footGrid.height[k] : 0, z];
  }
  FT.rxAnchor = rxAnchor;

})(typeof window !== "undefined" ? window : this);
