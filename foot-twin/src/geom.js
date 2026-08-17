/* ==========================================================================
   geom.js — 定数 / 手続き的足型ジェネレータ / グリッド / 等高線
   SPEC §2, §4-1〜4-4, §4-5 の一部（外形の元になる半幅プロファイル）
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT = root.FT || {};

  /* ------------------------------------------------------------------ *
   * 定数（CLAUDE.md 規約9：マジックナンバーはここに集約する）
   * ------------------------------------------------------------------ */
  var CONST = {
    /* グリッド解像度（SPEC §3-1） */
    NX: 96,
    NZ: 208,

    /* 正規化座標 u の全幅。
       足の半幅は最大 0.360×1.20(widthScale)=0.432、中心線ドリフトが最大 0.090。
       合計 0.522 なので、u∈[-0.55,0.55] にしないと幅広足がグリッド外へ出る。 */
    FW: 1.10,

    /* u=1.0 が対応する物理長 ÷ 足長。
       足囲部の全幅 = 2×0.360×U_TO_LEN = 足長×0.392 となるよう決めた
       （日本人成人の幅長比 0.36〜0.42 の中央付近）。 */
    U_TO_LEN: 0.5444,

    /* 高さ場の各解剖学的項の mm ゲイン（SPEC §4-2 の各項に掛かる）。
       高さ場は「接地シルエットの内側で、足底面が床からどれだけ離れているか」。
       踵と前足部は接地するので小さく、内側縦アーチが最大になる。 */
    H: { arch: 26.0, lat: 9.0, trans: 7.0, heel: 3.2, toe: 9.0 },

    /* 高さ場の形状パラメータ */
    ARCH_SIGMA: 0.155,
    LAT_V: 0.40, LAT_SV: 0.19,
    TRANS_V: 0.615, TRANS_SV: 0.075, TRANS_SU: 0.20,
    HEEL_V: 0.075, HEEL_SV: 0.075, HEEL_SU: 0.24,
    TOE_V: 0.945, TOE_SV: 0.075,
    EDGE_FALLOFF: 0.045,      // u 単位。縁で高さを 0 に落とす幅
    CAP_HEEL: 0.085,          // sqrt キャップの範囲（踵）
    CAP_TOE: 0.075,           // 同（趾先）

    /* 外反母趾：v=HVA_V0 より前方（母趾の領域）を外側へ振る。
       内側縁だけをずらすと趾先で幅が潰れて足長が短くなるため、
       中心線ごとずらす（幅と足長が保存され、傾きから角度が厳密に戻る）。 */
    HVA_V0: 0.78,

    /* ランドマーク（SPEC §3-3）の v 位置 */
    LM_V: {
      navicular: 0.44, metatarsale_tib: 0.655, metatarsale_fib: 0.615, sphyrion: 0.20
    },
    /* 舟状骨高 = NAV_BASE + archAmp×NAV_GAIN（mm）。
       ASI が 17〜30 の範囲に収まるよう決めた。 */
    NAV_BASE: 30.0, NAV_GAIN: 20.0,
    SPHYRION_RATIO: 0.26,     // 内果下端の高さ ÷ 足長

    /* 指標（SPEC §3-4） */
    TOE_LEN_RATIO: 0.235,     // 趾長 ÷ 足長。ASI の分母に使う
    HEEL_W_V: 0.16,
    INSTEP_V: 0.50,
    BALL_V: 0.62,
    ARCH_VOL_V: [0.28, 0.62], // アーチ容積を積分する v 範囲

    /* 等高線（SPEC §6 L1） */
    CONTOUR_STEP: 2.0,        // mm
    CONTOUR_MAJOR_EVERY: 3,   // 6mm ごとに主曲線
    CONTOUR_MAX: 40.0,        // mm。これ以上の高さは出ない

    /* 差分レンジ（SPEC §8：いずれも固定。自動スケーリング禁止）。
       用途ごとに実際に出る量の桁が違うので別の固定値を持つ。
       L7 経年 ±2mm ／ L8 コホート ±5mm ／ L9 インソール補正 ±8mm */
    DRIFT_RANGE: 2.0,
    DIFF_RANGE: 5.0,
    INSOLE_RANGE: 8.0,

    /* 加齢モデル（SPEC §4-3）。Phase 0 の暫定値であり実データ由来ではない。 */
    AGING_COEFF: {
      archAmp: -0.006, widthScale: 0.0025, hvaDeg: 0.18, length: 0.0004
    },

    /* インソール（SPEC §4-5-4） */
    INSOLE: {
      LAST_SCALE: 1.045, LAST_WIDTH: 1.02,
      TOE_MERGE: 0.88, HEEL_ROUND: 0.10,
      BASE_THICK: 2.5, SMOOTH_ITER: 6, CUP_MM: 4.5,
      CUP_V: 0.10, CUP_SV: 0.09,
      MIN_HALF_W: 0.009        // u 単位。先端の三角形が縮退しないための下限
    },

    /* カメラ（SPEC §7） */
    CAM: { minDist: 60, maxDist: 600, initDist: 430 },

    /* 配色（SPEC §9-2 / §8） */
    COL: {
      paper: "#E9EBE6", ink: "#14202A", ink2: "#54636D", ink3: "#8A959C",
      rule: "#C6CCC4", teal: "#1D6B66", brass: "#A8851C", alert: "#A63A2B",
      bg3d: "#F4F5F2", leather: "#B99A6B"
    },

    /* タイムライン（SPEC §11 受け入れ基準4） */
    YEAR_MIN: 2013, YEAR_NOW: 2026, YEAR_MAX: 2036,

    COHORT_N: 60000,          // 母集団サイズ（表示用）
    COHORT_SAMPLES: 12000     // パーセンタイル推定に使うサンプル数
  };
  FT.CONST = CONST;

  /* ------------------------------------------------------------------ *
   * 乱数：シード固定。プリセットや母集団を毎回同じにするため
   * （Math.random だと再読み込みのたび顧客に違う数字を見せることになる）
   * ------------------------------------------------------------------ */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussPair(rnd) {
    // Box-Muller。u1=0 で -Infinity になるので下限を切る
    var u1 = Math.max(rnd(), 1e-12), u2 = rnd();
    var r = Math.sqrt(-2 * Math.log(u1));
    return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
  }
  FT.rng = { mulberry32: mulberry32, gaussPair: gaussPair };

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function clamp01(x) { return clamp(x, 0, 1); }
  FT.clamp = clamp;
  FT.clamp01 = clamp01;

  /* ------------------------------------------------------------------ *
   * 制御点の smoothstep 補間（SPEC §4-2）
   * ------------------------------------------------------------------ */
  function lerpSmooth(pts, v) {
    var n = pts.length;
    if (v <= pts[0][0]) return pts[0][1];
    if (v >= pts[n - 1][0]) return pts[n - 1][1];
    for (var i = 0; i < n - 1; i++) {
      if (v >= pts[i][0] && v <= pts[i + 1][0]) {
        var t = (v - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
        t = t * t * (3 - 2 * t);
        return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
      }
    }
    return pts[n - 1][1];
  }
  FT.lerpSmooth = lerpSmooth;

  /* 半幅プロファイル HALFW(v) と中心線 CLINE(v)。v=0 が踵、v=1 が趾先。
     円の union で作らないこと（SPEC §4-2 / CLAUDE.md §6：島に割れる） */
  /* 足囲部（v=0.62）の 0.360 が全幅 0.392·足長 に対応する（U_TO_LEN の定義）。
     他の制御点はそこからの比で決めている：
       踵幅 / 足囲幅 ≈ 0.64（踵幅は足長の約 0.25）
       ウエスト / 足囲幅 ≈ 0.58
     提案書の図に使った旧プロファイルは踵が 0.79 倍あり、
     かかと幅が実寸より 20mm ほど広く出ていた。 */
  var HALFW = [[0.00, 0.150], [0.05, 0.205], [0.12, 0.228], [0.18, 0.230],
               [0.28, 0.208], [0.38, 0.216], [0.50, 0.268], [0.62, 0.360],
               [0.72, 0.345], [0.82, 0.290], [0.90, 0.240], [0.96, 0.170],
               [1.00, 0.080]];
  var CLINE = [[0.00, 0.000], [0.30, -0.010], [0.62, -0.024], [1.00, -0.090]];
  FT.HALFW = HALFW;
  FT.CLINE = CLINE;

  /* ------------------------------------------------------------------ *
   * パラメータ（SPEC §4-1）
   * ------------------------------------------------------------------ */
  var PARAM_RANGE = {
    length:     [210, 300],
    widthScale: [0.85, 1.20],
    archAmp:    [0.00, 1.40],
    archPos:    [0.38, 0.50],
    archSkew:   [-0.30, 0.30],
    transAmp:   [0.00, 0.60],
    hvaDeg:     [0, 35],
    toeSpring:  [0.00, 0.50],
    age:        [20, 85]
  };
  FT.PARAM_RANGE = PARAM_RANGE;

  function clampParams(p) {
    var out = {}, k;
    for (k in PARAM_RANGE) {
      if (PARAM_RANGE.hasOwnProperty(k)) {
        out[k] = clamp(p[k] === undefined ? PARAM_RANGE[k][0] : p[k],
                       PARAM_RANGE[k][0], PARAM_RANGE[k][1]);
      }
    }
    return out;
  }
  FT.clampParams = clampParams;

  /* ------------------------------------------------------------------ *
   * シルエットと高さ場
   * ------------------------------------------------------------------ */

  /* 母趾の外側への振れ（u 単位）。v が前方ほど大きい。
     tan(hva) × 前方距離 を u 単位に直している。 */
  function hvaShift(p, v) {
    if (v <= CONST.HVA_V0) return 0;
    var aheadV = v - CONST.HVA_V0;                 // 足長比
    var aheadU = aheadV / CONST.U_TO_LEN;          // u 単位の前方距離
    return Math.tan(p.hvaDeg * Math.PI / 180) * aheadU;
  }

  function halfWidthAt(p, v) {
    if (v < 0 || v > 1) return 0;
    var capH = Math.sqrt(clamp01(v / CONST.CAP_HEEL));
    var capT = Math.sqrt(clamp01((1 - v) / CONST.CAP_TOE));
    return lerpSmooth(HALFW, v) * p.widthScale * capH * capT;
  }

  /* 中心線。母趾領域は hvaShift ぶん外側へ平行移動する。 */
  function centerlineAt(p, v) { return lerpSmooth(CLINE, v) + hvaShift(p, v); }

  /* 符号付き距離。>0 が足の内側。 */
  function silhouette(p, u, v) {
    if (v < 0 || v > 1) return -1;
    var w = halfWidthAt(p, v);
    if (w <= 0) return -1;
    var c = centerlineAt(p, v);
    return w - Math.abs(u - c);
  }
  FT.silhouette = silhouette;

  function gauss(x, s) { var t = x / s; return Math.exp(-t * t); }

  /* v にだけ依存する係数。行ごとに1回だけ計算すればよい。
     セルごとに計算すると 2万セル × 5回の exp が無駄に走り、
     タイムラインスクラブのフレーム予算を食う。 */
  function rowCoef(p, v, out) {
    out.c = centerlineAt(p, v);
    out.w = halfWidthAt(p, v);
    out.arch = p.archAmp * CONST.H.arch * gauss(v - p.archPos, CONST.ARCH_SIGMA);
    out.lat = p.archAmp * 0.55 * CONST.H.lat * gauss(v - CONST.LAT_V, CONST.LAT_SV);
    out.trans = p.transAmp * CONST.H.trans * gauss(v - CONST.TRANS_V, CONST.TRANS_SV);
    out.heel = CONST.H.heel * gauss(v - CONST.HEEL_V, CONST.HEEL_SV);
    out.toe = p.toeSpring * CONST.H.toe * gauss(v - CONST.TOE_V, CONST.TOE_SV);
    out.skew = 0.04 - p.archSkew * 0.10;
    return out;
  }

  /* 行係数を使った高さ。u だけを変えて呼ぶ。 */
  function heightInRow(R, u) {
    var s = R.w - Math.abs(u - R.c);
    if (s <= 0) return -1;                       // 足の外
    var uu = u - R.c;
    var h = R.arch / (1 + Math.exp((uu + R.skew) * 7.0))
          + R.lat / (1 + Math.exp(-(uu - 0.16) * 9.0))   // 外側縦アーチは内側に追従する
          + R.trans * gauss(uu, CONST.TRANS_SU)
          + R.heel * gauss(uu, CONST.HEEL_SU)
          + R.toe;
    return h * Math.min(1, s / CONST.EDGE_FALLOFF);
  }

  /* 足底面の高さ場（mm）。床に接する箇所が 0、アーチが最大。
     SPEC §4-2 の式に CONST.H の mm ゲインを掛けたもの。 */
  var _scratchRow = {};
  function heightAt(p, u, v) {
    if (v < 0 || v > 1) return -1;
    return heightInRow(rowCoef(p, v, _scratchRow), u);
  }
  FT.heightAt = heightAt;

  /* ------------------------------------------------------------------ *
   * グリッド生成（SPEC §3-1 の grid）
   * side="L" は右足空間で生成してから i を反転して書き込む。
   * 行列のミラー変換を使わないので法線・巻き順が破綻しない（SPEC §2-2）。
   * ------------------------------------------------------------------ */
  /* reuse に前回の戻り値を渡すと、その配列を書き換えて返す。
     タイムラインスクラブでは毎フレーム呼ぶので、80KB の確保を繰り返すと
     GC がフレーム予算を食う。保持したいグリッド（過去 scan、母集団平均）には
     渡さないこと。 */
  function buildGrid(params, side, reuse) {
    var p = clampParams(params);
    var nx = CONST.NX, nz = CONST.NZ;
    var xSpan = CONST.FW * CONST.U_TO_LEN * p.length;
    var pitchX = xSpan / (nx - 1);
    var pitchZ = p.length / (nz - 1);
    var ok = reuse && reuse.nx === nx && reuse.nz === nz;
    var height = ok ? reuse.height : new Float32Array(nx * nz);
    var mask = ok ? reuse.mask : new Uint8Array(nx * nz);
    var mirror = (side === "L");

    var R = {};
    for (var j = 0; j < nz; j++) {
      rowCoef(p, j / (nz - 1), R);
      for (var i = 0; i < nx; i++) {
        var srcI = mirror ? (nx - 1 - i) : i;
        var u = (srcI / (nx - 1) - 0.5) * CONST.FW;
        var h = heightInRow(R, u);
        var k = j * nx + i;
        if (h < 0) { height[k] = 0; mask[k] = 0; }
        else { height[k] = h; mask[k] = 1; }
      }
    }
    if (ok) {
      reuse.pitch_x = pitchX; reuse.pitch_z = pitchZ;
      reuse.origin[0] = -0.5 * xSpan;
      reuse.side = side; reuse.params = p;
      reuse.__mirror = null;      // 派生キャッシュを無効化する
      return reuse;
    }
    return {
      nx: nx, nz: nz, pitch_x: pitchX, pitch_z: pitchZ,
      origin: [-0.5 * xSpan, 0, 0],
      height: height, mask: mask,
      side: side, params: p, __mirror: null
    };
  }
  FT.buildGrid = buildGrid;

  /* グリッド座標 → ワールド mm */
  function cellX(g, i) { return g.origin[0] + i * g.pitch_x; }
  function cellZ(g, j) { return g.origin[2] + j * g.pitch_z; }
  FT.cellX = cellX;
  FT.cellZ = cellZ;

  /* 内側方向（SPEC §2-2：外積や side からの導出をしない。明示保存する） */
  function medialAxis(side) { return side === "L" ? [1, 0, 0] : [-1, 0, 0]; }
  FT.medialAxis = medialAxis;

  /* 内側方向の符号。u（=x）が小さい側が内側なら -1 */
  function medialSign(scanOrSide) {
    var ax = (typeof scanOrSide === "string") ? medialAxis(scanOrSide) : scanOrSide.axis_medial;
    return ax[0] < 0 ? -1 : 1;
  }
  FT.medialSign = medialSign;

  /* ------------------------------------------------------------------ *
   * 等高線（marching squares）
   * CLAUDE.md §6 の2つの落とし穴に対処している：
   *   - 鞍点 case 5 / 10 は2線分に分解する
   *   - 端点は toFixed でキー化して連結する（浮動小数の直接比較をしない）
   * ------------------------------------------------------------------ */
  var MS_TABLE = {
    1: [["l", "b"]], 2: [["b", "r"]], 3: [["l", "r"]], 4: [["r", "t"]],
    5: [["l", "t"], ["b", "r"]],                       // 鞍点
    6: [["b", "t"]], 7: [["l", "t"]], 8: [["t", "l"]], 9: [["t", "b"]],
    10: [["t", "r"], ["l", "b"]],                      // 鞍点
    11: [["t", "r"]], 12: [["r", "l"]], 13: [["r", "b"]], 14: [["b", "l"]]
  };

  /* field: Float32Array(nx*nz)。mask=0 のセルは OUTSIDE 値として扱い、
     等高線が必ずマスク内で閉じるようにする。 */
  var OUTSIDE = -1000;

  function marchingSquares(field, mask, nx, nz, level) {
    var segs = [];
    function val(i, j) {
      var k = j * nx + i;
      return mask[k] ? field[k] : OUTSIDE;
    }
    function ip(ax, ay, bx, by, va, vb) {
      var t = (level - va) / (vb - va);
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    for (var j = 0; j < nz - 1; j++) {
      for (var i = 0; i < nx - 1; i++) {
        var v00 = val(i, j), v10 = val(i + 1, j), v11 = val(i + 1, j + 1), v01 = val(i, j + 1);
        var idx = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) |
                  (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        var e = {
          b: function () { return ip(i, j, i + 1, j, v00, v10); },
          r: function () { return ip(i + 1, j, i + 1, j + 1, v10, v11); },
          t: function () { return ip(i, j + 1, i + 1, j + 1, v01, v11); },
          l: function () { return ip(i, j, i, j + 1, v00, v01); }
        };
        var list = MS_TABLE[idx];
        for (var m = 0; m < list.length; m++) {
          segs.push([e[list[m][0]](), e[list[m][1]]()]);
        }
      }
    }
    return segs;
  }

  function chainSegments(segs) {
    /* 端点は浮動小数の直接比較では一致しない（CLAUDE.md §6）。
       量子化した整数をキーにする。文字列キーより桁違いに速い。 */
    var Q = 4096;
    function key(pt) { return Math.round(pt[0] * Q) * 8388608 + Math.round(pt[1] * Q); }
    var map = {}, used = new Array(segs.length), i, e, k;
    for (i = 0; i < segs.length; i++) {
      used[i] = false;
      for (e = 0; e < 2; e++) {
        k = key(segs[i][e]);
        if (!map[k]) map[k] = [];
        map[k].push({ i: i, e: e });
      }
    }
    var lines = [];
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      var pts = [segs[i][0].slice(), segs[i][1].slice()];
      for (var dir = 0; dir < 2; dir++) {
        var guard = 0;
        while (guard++ < 20000) {
          var end = (dir === 0) ? pts[pts.length - 1] : pts[0];
          var cands = map[key(end)] || null;
          if (!cands) break;
          var nx2 = null;
          for (var c = 0; c < cands.length; c++) {
            if (!used[cands[c].i]) { nx2 = cands[c]; break; }
          }
          if (!nx2) break;
          used[nx2.i] = true;
          var other = segs[nx2.i][1 - nx2.e].slice();
          if (dir === 0) pts.push(other); else pts.unshift(other);
        }
      }
      if (pts.length > 2) lines.push(pts);
    }
    return lines;
  }

  /* 高さ場から等高線をワールド座標のポリライン群として取り出す。
     戻り値: [{ level, major, pts: [[x,z], ...] }, ...] */
  function contours(grid, step, majorEvery) {
    step = step || CONST.CONTOUR_STEP;
    majorEvery = majorEvery || CONST.CONTOUR_MAJOR_EVERY;
    var out = [];
    var maxH = 0, i;
    for (i = 0; i < grid.height.length; i++) {
      if (grid.mask[i] && grid.height[i] > maxH) maxH = grid.height[i];
    }
    var n = Math.min(Math.floor(maxH / step), Math.floor(CONST.CONTOUR_MAX / step));
    for (var s = 1; s <= n; s++) {
      var level = s * step;
      var segs = marchingSquares(grid.height, grid.mask, grid.nx, grid.nz, level);
      var lines = chainSegments(segs);
      for (var m = 0; m < lines.length; m++) {
        var pts = lines[m], world = new Array(pts.length);
        for (var q = 0; q < pts.length; q++) {
          world[q] = [cellX(grid, pts[q][0]), cellZ(grid, pts[q][1])];
        }
        out.push({ level: level, major: (s % majorEvery === 0), pts: world });
      }
    }
    return out;
  }
  FT.contours = contours;
  FT.marchingSquares = marchingSquares;
  FT.chainSegments = chainSegments;

  /* マスク境界（足の外形線）。level=0.5 のマスク等高線として取る。 */
  function outline(grid) {
    var f = new Float32Array(grid.mask.length);
    var m = new Uint8Array(grid.mask.length);
    for (var i = 0; i < grid.mask.length; i++) { f[i] = grid.mask[i]; m[i] = 1; }
    var segs = marchingSquares(f, m, grid.nx, grid.nz, 0.5);
    var lines = chainSegments(segs), out = [];
    for (var k = 0; k < lines.length; k++) {
      var pts = lines[k], w = new Array(pts.length);
      for (var q = 0; q < pts.length; q++) {
        w[q] = [cellX(grid, pts[q][0]), cellZ(grid, pts[q][1])];
      }
      out.push(w);
    }
    return out;
  }
  FT.outline = outline;

  /* ------------------------------------------------------------------ *
   * 加齢モデル（SPEC §4-3）
   * 統計モデルでも機械学習でもない。決定論的なパラメータ外挿である。
   * ------------------------------------------------------------------ */
  function ageParams(p, dYears) {
    var A = CONST.AGING_COEFF;
    var q = {
      length:     p.length * (1 + A.length * dYears),
      widthScale: p.widthScale * (1 + A.widthScale * dYears),
      archAmp:    p.archAmp * (1 + A.archAmp * dYears),
      archPos:    p.archPos,
      archSkew:   p.archSkew,
      transAmp:   p.transAmp * (1 + A.archAmp * dYears * 0.6),
      hvaDeg:     p.hvaDeg + A.hvaDeg * dYears,
      toeSpring:  p.toeSpring,
      age:        p.age + dYears
    };
    return clampParams(q);
  }
  FT.ageParams = ageParams;

  function lerpParams(a, b, t) {
    var out = {}, k;
    for (k in PARAM_RANGE) {
      if (PARAM_RANGE.hasOwnProperty(k)) out[k] = a[k] + (b[k] - a[k]) * t;
    }
    return clampParams(out);
  }
  FT.lerpParams = lerpParams;

})(typeof window !== "undefined" ? window : this);
