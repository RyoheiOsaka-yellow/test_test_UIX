/* ==========================================================================
   cohort.js — 統計母集団（SPEC §3-7, §4-4）とデモ用 subject
   6万件を実生成せず、分布パラメータからサンプリングしてパーセンタイルを出す。
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT;
  var CONST = FT.CONST;

  /* ------------------------------------------------------------------ *
   * 性別・年齢別の分布（Phase 0 の暫定値）
   * 公表統計に合わせた概形であり、実データ由来ではない。
   * Phase 2 で全件の統計DB化とともに差し替える。
   * ------------------------------------------------------------------ */
  function dist(sex, age) {
    var d40 = age - 40;
    var male = (sex === "M");
    return {
      length:     { m: (male ? 250.5 : 232.0) - d40 * 0.05, s: male ? 11.0 : 9.5 },
      widthScale: { m: (male ? 1.000 : 0.972) + d40 * 0.0025, s: 0.075 },
      archAmp:    { m: (male ? 0.86 : 0.80) - d40 * 0.006, s: 0.30 },
      archPos:    { m: 0.440, s: 0.022 },
      archSkew:   { m: 0.000, s: 0.110 },
      transAmp:   { m: 0.300 - d40 * 0.0035, s: 0.130 },
      hvaDeg:     { m: (male ? 7.0 : 11.0) + d40 * 0.18, s: 5.5 },
      toeSpring:  { m: 0.250, s: 0.090 }
    };
  }

  /* archAmp と hvaDeg の相関（SPEC §4-4）。アーチ低下 ↔ HVA 増加。 */
  var RHO = -0.35;

  function sampleParams(rnd, sex, age) {
    var D = dist(sex, age);
    var g1 = FT.rng.gaussPair(rnd), g2 = FT.rng.gaussPair(rnd), g3 = FT.rng.gaussPair(rnd);
    var z = [g1[0], g1[1], g2[0], g2[1], g3[0], g3[1]];

    // コレスキー分解：L = [[1,0],[rho, sqrt(1-rho^2)]]
    var zA = z[0];
    var zH = RHO * z[0] + Math.sqrt(1 - RHO * RHO) * z[1];

    return FT.clampParams({
      length:     D.length.m + D.length.s * z[2],
      widthScale: D.widthScale.m + D.widthScale.s * z[3],
      archAmp:    D.archAmp.m + D.archAmp.s * zA,
      archPos:    D.archPos.m + D.archPos.s * z[4],
      archSkew:   D.archSkew.m + D.archSkew.s * z[5],
      transAmp:   D.transAmp.m + D.transAmp.s * FT.rng.gaussPair(rnd)[0],
      hvaDeg:     D.hvaDeg.m + D.hvaDeg.s * zH,
      toeSpring:  D.toeSpring.m + D.toeSpring.s * FT.rng.gaussPair(rnd)[0],
      age:        age
    });
  }
  FT.sampleParams = sampleParams;

  /* ------------------------------------------------------------------ *
   * 群（性別 × 年代）の統計。要求されたときに一度だけ作ってキャッシュする。
   * ------------------------------------------------------------------ */
  var METRIC_KEYS = ["asi", "arch_volume", "hva", "width_ratio", "transverse", "foot_length"];
  var cache = {};

  function decadeOf(age) { return Math.floor(FT.clamp(age, 20, 89) / 10) * 10; }

  function groupKey(sex, age) { return sex + "_" + decadeOf(age) + "s"; }
  FT.groupKey = groupKey;

  function groupLabel(sex, age) {
    return decadeOf(age) + "代" + (sex === "M" ? "男性" : "女性");
  }
  FT.groupLabel = groupLabel;

  function buildGroup(sex, age) {
    var dec = decadeOf(age);
    // シードを群ごとに固定する。再読み込みで顧客に違う順位を見せないため。
    var rnd = FT.rng.mulberry32(0x5EED + dec * 131 + (sex === "M" ? 7 : 13));
    var n = CONST.COHORT_SAMPLES;
    var cols = {}, k, q;
    for (q = 0; q < METRIC_KEYS.length; q++) cols[METRIC_KEYS[q]] = new Float64Array(n);
    var shares = {};

    for (var i = 0; i < n; i++) {
      var p = sampleParams(rnd, sex, dec + 5);
      var m = FT.fastMetrics(p);
      for (q = 0; q < METRIC_KEYS.length; q++) {
        k = METRIC_KEYS[q];
        cols[k][i] = m[k];
      }
      var a = nearestArchetype(p);
      shares[a.id] = (shares[a.id] || 0) + 1;
    }
    for (k in shares) { if (shares.hasOwnProperty(k)) shares[k] = shares[k] / n; }
    var stats = {};
    for (q = 0; q < METRIC_KEYS.length; q++) {
      k = METRIC_KEYS[q];
      Array.prototype.sort.call(cols[k], function (a, b) { return a - b; });
      var sum = 0, i2;
      for (i2 = 0; i2 < n; i2++) sum += cols[k][i2];
      var mean = sum / n, ss = 0;
      for (i2 = 0; i2 < n; i2++) ss += (cols[k][i2] - mean) * (cols[k][i2] - mean);
      stats[k] = { mean: mean, sd: Math.sqrt(ss / n) };
    }
    return { sex: sex, decade: dec, n: n, sorted: cols, stats: stats,
             shares: shares, label: groupLabel(sex, dec + 5) };
  }

  function group(sex, age) {
    var key = groupKey(sex, age);
    if (!cache[key]) cache[key] = buildGroup(sex, age);
    return cache[key];
  }
  FT.cohortGroup = group;

  /* 昇順配列内での順位（0–100）。線形補間（SPEC §7-2）。 */
  function percentile(g, metric, value) {
    var a = g.sorted[metric];
    if (!a) return null;
    var n = a.length;
    if (value <= a[0]) return 0;
    if (value >= a[n - 1]) return 100;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (a[mid] <= value) lo = mid; else hi = mid;
    }
    var span = a[hi] - a[lo];
    var t = span > 1e-12 ? (value - a[lo]) / span : 0;
    return (lo + t) / (n - 1) * 100;
  }
  FT.percentile = percentile;

  /* 「下位 18%」「上位 22%」の表記（SPEC §7-2） */
  function rankText(pct) {
    if (pct === null || isNaN(pct)) return "—";
    var p = Math.round(pct);
    if (p < 50) return "下位 " + Math.max(p, 1) + "%";
    return "上位 " + Math.max(100 - p, 1) + "%";
  }
  FT.rankText = rankText;

  /* ヒストグラム。counts は母集団サイズ（6万）に合わせて正規化する。 */
  function histogram(g, metric, nbins) {
    nbins = nbins || 26;
    var a = g.sorted[metric], n = a.length;
    var lo = a[Math.floor(n * 0.005)], hi = a[Math.floor(n * 0.995)];
    if (hi - lo < 1e-9) hi = lo + 1;
    var counts = new Array(nbins), i;
    for (i = 0; i < nbins; i++) counts[i] = 0;
    for (i = 0; i < n; i++) {
      var b = Math.floor((a[i] - lo) / (hi - lo) * nbins);
      if (b < 0) b = 0; if (b >= nbins) b = nbins - 1;
      counts[b]++;
    }
    var scale = CONST.COHORT_N / n;
    for (i = 0; i < nbins; i++) counts[i] = Math.round(counts[i] * scale);
    return { lo: lo, hi: hi, counts: counts, nbins: nbins };
  }
  FT.histogram = histogram;

  /* ------------------------------------------------------------------ *
   * 足型の 7 類型（SPEC §3-7 archetypes）
   * 公表されている足型分類研究の k=7 に対応させた暫定の代表パラメータ。
   * 実データ投入時にクラスタリングし直して差し替える。
   * ------------------------------------------------------------------ */
  var ARCHETYPES = [
    { id: "A1", name: "標準",           archAmp: 0.90, widthScale: 0.99, hvaDeg: 6,  transAmp: 0.32 },
    { id: "A2", name: "幅広・アーチ低め", archAmp: 0.52, widthScale: 1.13, hvaDeg: 11, transAmp: 0.18 },
    { id: "A3", name: "細身・アーチ高め", archAmp: 1.18, widthScale: 0.89, hvaDeg: 5,  transAmp: 0.42 },
    { id: "A4", name: "アーチ低下傾向",   archAmp: 0.34, widthScale: 1.04, hvaDeg: 16, transAmp: 0.12 },
    { id: "A5", name: "横アーチ低下",     archAmp: 0.86, widthScale: 1.08, hvaDeg: 19, transAmp: 0.08 },
    { id: "A6", name: "凹足傾向",         archAmp: 1.30, widthScale: 0.94, hvaDeg: 4,  transAmp: 0.50 },
    { id: "A7", name: "幅広・標準アーチ", archAmp: 0.80, widthScale: 1.16, hvaDeg: 8,  transAmp: 0.28 }
  ];
  FT.ARCHETYPES = ARCHETYPES;

  /* 正規化した4指標のユークリッド距離で最も近い類型を返す */
  function nearestArchetype(p) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < ARCHETYPES.length; i++) {
      var a = ARCHETYPES[i];
      var d = Math.pow((p.archAmp - a.archAmp) / 0.35, 2)
            + Math.pow((p.widthScale - a.widthScale) / 0.09, 2)
            + Math.pow((p.hvaDeg - a.hvaDeg) / 6.0, 2)
            + Math.pow((p.transAmp - a.transAmp) / 0.15, 2);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }
  FT.nearestArchetype = nearestArchetype;

  /* ------------------------------------------------------------------ *
   * 左足を右足空間へ正規化する（SPEC §2-2）。統計比較の前に必ず通す。
   * ------------------------------------------------------------------ */
  function normalizeToRight(grid) {
    if (grid.side === "R") return grid;
    var nx = grid.nx, nz = grid.nz;
    var h = new Float32Array(nx * nz), m = new Uint8Array(nx * nz);
    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        h[j * nx + i] = grid.height[j * nx + (nx - 1 - i)];
        m[j * nx + i] = grid.mask[j * nx + (nx - 1 - i)];
      }
    }
    return {
      nx: nx, nz: nz, pitch_x: grid.pitch_x, pitch_z: grid.pitch_z,
      origin: grid.origin.slice(), height: h, mask: m,
      side: "R", params: grid.params
    };
  }
  FT.normalizeToRight = normalizeToRight;

  /* 群の平均形状グリッド（L8 の比較対象）。代表パラメータで1件生成する。 */
  var meanCache = {};
  function meanGrid(sex, age, lengthMm) {
    // 足長だけは本人に合わせないと差分が「足の大きさの違い」で埋まる。
    // ただし 1mm 刻みでキャッシュするとタイムラインを動かすたびに作り直しになる。
    // 平均形状は 5mm 程度の足長差では見た目が変わらないので丸めて共有する。
    var bucket = Math.round(lengthMm / 5) * 5;
    var key = groupKey(sex, age) + "_" + bucket;
    if (meanCache[key]) return meanCache[key];
    var dec = decadeOf(age), D = dist(sex, dec + 5);
    var p = FT.clampParams({
      length: bucket, widthScale: D.widthScale.m, archAmp: D.archAmp.m,
      archPos: D.archPos.m, archSkew: D.archSkew.m, transAmp: D.transAmp.m,
      hvaDeg: D.hvaDeg.m, toeSpring: D.toeSpring.m, age: dec + 5
    });
    meanCache[key] = FT.buildGrid(p, "R");
    return meanCache[key];
  }
  FT.cohortMeanGrid = meanGrid;

  /* ------------------------------------------------------------------ *
   * デモ用 subject（SPEC §11 受け入れ基準2：3名以上）
   *
   * 時間軸は「インソール作製からの経過週」。年単位ではフォローの実務と
   * 目盛りが合わない（微調整は数週間ごとに来る）。
   * 0週＝作製時。scanWeeks が実際に計測した週で、その間は補間する。
   * ------------------------------------------------------------------ */
  var SUBJECTS = [
    {
      subject_id: "S000142", label: "S000142", sex: "M", age: 48,
      note: "腰部の不調を主訴に来店。内側縦アーチの低下。",
      params: { length: 265, widthScale: 1.06, archAmp: 0.42, archPos: 0.435,
                archSkew: -0.06, transAmp: 0.14, hvaDeg: 13, toeSpring: 0.22, age: 48 },
      scanWeeks: [0, 6, 26],
      complaints: [
        { region: "MLA", severity: 4, week: 0 },
        { region: "LOWBACK", severity: 3, week: 0 },
        { region: "MLA", severity: 2, week: 6 },
        { region: "LOWBACK", severity: 2, week: 6 },
        { region: "MTH", severity: 2, week: 26 },
        { region: "LOWBACK", severity: 1, week: 26 }
      ],
      prescriptions: [
        { landmark: "navicular", lift_mm: 6.5, tilt_deg: 1.2, week: 0, grade: "full" },
        { landmark: "cuboid", lift_mm: 3.0, tilt_deg: 0, week: 0, grade: "full" },
        { landmark: "transverse", lift_mm: 2.4, tilt_deg: 0, week: 6, grade: "full" }
      ],
      log: [
        { week: 0, kind: "作製", note: "フルオーダー。土踏まずと外側を支持" },
        { week: 6, kind: "調整", note: "指の付け根の当たりを訴え、横アーチを追加" },
        { week: 26, kind: "フォロー", note: "腰の訴えは軽快。沈み込みを確認" }
      ]
    },
    {
      subject_id: "S001987", label: "S001987", sex: "F", age: 35,
      note: "立ち仕事。前足部の荷重痛と母趾の傾き。",
      params: { length: 236, widthScale: 1.11, archAmp: 0.78, archPos: 0.450,
                archSkew: 0.04, transAmp: 0.07, hvaDeg: 22, toeSpring: 0.28, age: 35 },
      scanWeeks: [0, 4, 12],
      complaints: [
        { region: "MTH", severity: 4, week: 0 },
        { region: "KNEE", severity: 2, week: 0 },
        { region: "MTH", severity: 3, week: 4 },
        { region: "MTH", severity: 1, week: 12 },
        { region: "KNEE", severity: 1, week: 12 }
      ],
      prescriptions: [
        { landmark: "transverse", lift_mm: 4.2, tilt_deg: 0, week: 0, grade: "semi" },
        { landmark: "metatarsale_tib", lift_mm: 2.0, tilt_deg: 0, week: 0, grade: "semi" },
        { landmark: "navicular", lift_mm: 3.4, tilt_deg: 0.8, week: 4, grade: "semi" }
      ],
      log: [
        { week: 0, kind: "作製", note: "セミオーダー。中足骨パッドを主体に" },
        { week: 4, kind: "調整", note: "内側の支持を追加" },
        { week: 12, kind: "フォロー", note: "前足部の訴えは軽快" }
      ]
    },
    {
      subject_id: "S004310", label: "S004310", sex: "M", age: 25,
      note: "競技者。アーチは高く、踵の圧痛を訴える。",
      params: { length: 274, widthScale: 0.92, archAmp: 1.22, archPos: 0.430,
                archSkew: -0.10, transAmp: 0.46, hvaDeg: 4, toeSpring: 0.40, age: 25 },
      scanWeeks: [0, 2, 10, 32],
      complaints: [
        { region: "HEEL", severity: 3, week: 0 },
        { region: "HEEL", severity: 2, week: 2 },
        { region: "HEEL", severity: 1, week: 10 }
      ],
      prescriptions: [
        { landmark: "heel", lift_mm: 3.6, tilt_deg: 0, week: 0, grade: "athlete" },
        { landmark: "cuboid", lift_mm: 2.2, tilt_deg: 0, week: 0, grade: "athlete" },
        { landmark: "heel", lift_mm: 1.4, tilt_deg: 0, week: 32, grade: "athlete" }
      ],
      log: [
        { week: 0, kind: "作製", note: "アスリート仕様。踵の支持を厚めに" },
        { week: 2, kind: "フォロー", note: "練習量が多く、初期の沈みが速い" },
        { week: 10, kind: "フォロー", note: "圧痛は軽快" },
        { week: 32, kind: "調整", note: "沈み込みぶんを踵で戻す" }
      ]
    },
    {
      subject_id: "S005806", label: "S005806", sex: "F", age: 73,
      note: "アーチ低下と前足部の開張。既製パターンでは合わず。",
      params: { length: 228, widthScale: 1.17, archAmp: 0.26, archPos: 0.455,
                archSkew: 0.10, transAmp: 0.05, hvaDeg: 28, toeSpring: 0.16, age: 73 },
      scanWeeks: [0, 8, 24, 52],
      complaints: [
        { region: "MLA", severity: 3, week: 0 },
        { region: "MTH", severity: 5, week: 0 },
        { region: "KNEE", severity: 3, week: 0 },
        { region: "MTH", severity: 3, week: 8 },
        { region: "KNEE", severity: 2, week: 24 },
        { region: "MTH", severity: 2, week: 52 }
      ],
      prescriptions: [
        { landmark: "navicular", lift_mm: 5.2, tilt_deg: 1.6, week: 0, grade: "full" },
        { landmark: "transverse", lift_mm: 5.0, tilt_deg: 0, week: 0, grade: "full" },
        { landmark: "metatarsale_fib", lift_mm: 2.2, tilt_deg: 0, week: 8, grade: "full" },
        { landmark: "heel", lift_mm: 2.0, tilt_deg: 0, week: 24, grade: "full" }
      ],
      log: [
        { week: 0, kind: "作製", note: "フルオーダー。土踏まずと横アーチを同時に" },
        { week: 8, kind: "調整", note: "小趾側の支持を追加" },
        { week: 24, kind: "調整", note: "かかとの支持を追加" },
        { week: 52, kind: "フォロー", note: "1年経過。全体の沈み込みを確認" }
      ]
    }
  ];

  /* 各 subject の計測週ごとのパラメータ。
     0週を基準に加齢モデルを週へ換算して進め、実計測の揺らぎを固定シードで足す。 */
  function buildSubjects() {
    for (var s = 0; s < SUBJECTS.length; s++) {
      var sub = SUBJECTS[s];
      sub.params = FT.clampParams(sub.params);
      var rnd = FT.rng.mulberry32(parseInt(sub.subject_id.slice(1), 10));
      sub.scans = [];
      for (var y = 0; y < sub.scanWeeks.length; y++) {
        var wk = sub.scanWeeks[y];
        var p = FT.ageParamsWeeks(sub.params, wk);
        if (wk !== 0) {
          // 実計測は加齢直線には乗らない。計測ごとの揺らぎを入れる。
          var g = FT.rng.gaussPair(rnd);
          p = FT.clampParams({
            length: p.length, widthScale: p.widthScale * (1 + g[0] * 0.004),
            archAmp: p.archAmp * (1 + g[1] * 0.022), archPos: p.archPos,
            archSkew: p.archSkew, transAmp: p.transAmp,
            hvaDeg: p.hvaDeg, toeSpring: p.toeSpring, age: p.age
          });
        }
        sub.scans.push({ week: wk, params: p });
      }
      sub.lastScanWeek = sub.scanWeeks[sub.scanWeeks.length - 1];
    }
    return SUBJECTS;
  }
  FT.SUBJECTS = buildSubjects();

  /* 週 → パラメータ。記録した計測の間は線形補間、最後の計測より先は外挿。
     SPEC §7 のタイムラインスクラブの実体。 */
  function paramsAtWeek(subject, week) {
    var sc = subject.scans;
    if (week <= sc[0].week) return sc[0].params;
    for (var i = 0; i < sc.length - 1; i++) {
      if (week <= sc[i + 1].week) {
        var t = (week - sc[i].week) / (sc[i + 1].week - sc[i].week);
        return FT.lerpParams(sc[i].params, sc[i + 1].params, t);
      }
    }
    var last = sc[sc.length - 1];
    return FT.ageParamsWeeks(last.params, week - last.week);
  }
  FT.paramsAtWeek = paramsAtWeek;

  /* その週までに適用済みの処方（L6 / L9 に渡す） */
  function prescriptionsAtWeek(subject, week) {
    var out = [];
    for (var i = 0; i < subject.prescriptions.length; i++) {
      if (subject.prescriptions[i].week <= week) out.push(subject.prescriptions[i]);
    }
    return out;
  }
  FT.prescriptionsAtWeek = prescriptionsAtWeek;

  /* その週に有効な主訴。同じ部位は最新の記録で置き換える
     （軽快した訴えを古い強さのまま出さないため）。 */
  function complaintsAtWeek(subject, week) {
    var byRegion = {}, i, c;
    for (i = 0; i < subject.complaints.length; i++) {
      c = subject.complaints[i];
      if (c.week > week) continue;
      if (!byRegion[c.region] || c.week >= byRegion[c.region].week) byRegion[c.region] = c;
    }
    var out = [], k;
    for (k in byRegion) {
      if (byRegion.hasOwnProperty(k) && byRegion[k].severity > 0) out.push(byRegion[k]);
    }
    return out;
  }
  FT.complaintsAtWeek = complaintsAtWeek;

  /* 直近に材を足した週。ここを起点に沈み込みが進む。 */
  function lastAdjustWeek(subject, week) {
    var w = 0;
    for (var i = 0; i < subject.prescriptions.length; i++) {
      var rx = subject.prescriptions[i];
      if (rx.week <= week && rx.week > w) w = rx.week;
    }
    return w;
  }
  FT.lastAdjustWeek = lastAdjustWeek;

  /* その週の記録（作製・調整・フォロー） */
  function logAtWeek(subject, week) {
    var out = [];
    for (var i = 0; i < subject.log.length; i++) {
      if (subject.log[i].week <= week) out.push(subject.log[i]);
    }
    return out;
  }
  FT.logAtWeek = logAtWeek;

  /* 主訴の部位 → 足上の位置（u, v）。KNEE / LOWBACK は足の部位ではないので
     踵の外側にまとめて置き、ラベルで区別する。 */
  FT.COMPLAINT_POS = {
    MLA:     { u: -0.17, v: 0.45, label: "土踏まず" },
    MTH:     { u:  0.06, v: 0.63, label: "指の付け根" },
    HEEL:    { u:  0.00, v: 0.10, label: "かかと" },
    KNEE:    { u:  0.26, v: 0.30, label: "ひざ" },
    LOWBACK: { u:  0.26, v: 0.16, label: "腰" }
  };

})(typeof window !== "undefined" ? window : this);
