/* ==========================================================================
   ui.js — パネル / レイヤ / コホート / タイムライン
   顧客提示の文言は SPEC §13 の右列に揃える。禁止表現は §9-4。
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT;
  var CONST = FT.CONST;
  var $ = function (id) { return document.getElementById(id); };

  /* レイヤ定義（SPEC §6）。ラベルは顧客提示の言い方にする。 */
  var LAYERS = [
    { id: "L0_surface",   n: "0", t: "足底面",           h: "計測した足の裏の形",            on: true },
    { id: "L1_contour",   n: "1", t: "等高線",           h: "2mm 間隔／6mm ごとに太線",      on: true },
    { id: "L2_height",    n: "2", t: "高さの色分け",      h: "床からの高さ 0–30mm",           on: true },
    { id: "L3_landmark",  n: "3", t: "基準点",           h: "計測の基準になる6点",           on: false },
    { id: "L4_pressure",  n: "4", t: "荷重の分布（推定）", h: "形状からの推定。実測ではない",  on: false },
    { id: "L5_complaint", n: "5", t: "不調の申告部位",    h: "来店時に伺った箇所",            on: false },
    { id: "L6_rx",        n: "6", t: "インソールの補正",  h: "どこを何mm持ち上げたか",        on: false },
    { id: "L7_drift",     n: "7", t: "経年の変化",        h: "2013年の計測との差 ±5mm",       on: false },
    { id: "L8_cohort",    n: "8", t: "6万人平均との差",   h: "同年代・同性の平均形状との差",  on: false },
    { id: "L9_insole",    n: "9", t: "インソール形状",    h: "補正を反映した上面（参考表示）", on: false }
  ];

  var DIVERGE = "linear-gradient(90deg,#A63A2B,#EDEDE8,#1D6B66)";
  var COLOR_LEGEND = {
    L2_height:   { title: "床からの高さ", lo: "0 mm", hi: "28 mm",
                   css: "linear-gradient(90deg,#F2F4F0,#7FB2AA,#1D6B66,#0E3D3A)" },
    L4_pressure: { title: "荷重の分布（推定）", lo: "低", hi: "高",
                   css: "linear-gradient(90deg,#F5F2EA,#D8A64A,#A8851C)" },
    L7_drift:    { title: "2013年の計測との差", lo: "−2 mm", hi: "+2 mm", css: DIVERGE },
    L8_cohort:   { title: "6万人平均との差", lo: "−5 mm", hi: "+5 mm", css: DIVERGE },
    L9_insole:   { title: "インソールが足を持ち上げている量", lo: "0 mm", hi: "+8 mm",
                   css: DIVERGE }
  };

  var HIST_METRICS = [
    { key: "asi", label: "土踏まずの高さ", fmt: function (v) { return v.toFixed(1) + " %"; } },
    { key: "arch_volume", label: "ボリューム", fmt: function (v) { return (v / 1000).toFixed(1) + " cm³"; } },
    { key: "hva", label: "母趾の傾き", fmt: function (v) { return v.toFixed(1) + "°"; } },
    { key: "width_ratio", label: "幅長比", fmt: function (v) { return (v * 100).toFixed(1) + " %"; } }
  ];

  var GRADE_JP = { athlete: "アスリート", full: "フルオーダー", semi: "セミオーダー", pattern: "パターンオーダー" };
  var RX_JP = {
    navicular: "土踏まず（内側）", cuboid: "外側アーチ",
    metatarsale_tib: "母趾の付け根", metatarsale_fib: "小趾の付け根",
    transverse: "指の付け根（横アーチ）", heel: "かかと"
  };

  /* ------------------------------------------------------------------ *
   * 状態
   * ------------------------------------------------------------------ */
  var S = {
    subject: null, side: "R", year: CONST.YEAR_NOW,
    layers: {}, histMetric: "asi", viewer: null,
    lastHeavyAt: 0, contours: null, insole: null, scrubbing: false, raf: 0,
    bootMs: 0, lastRebuildMs: 0
  };

  function initLayers() {
    for (var i = 0; i < LAYERS.length; i++) S.layers[LAYERS[i].id] = LAYERS[i].on;
  }

  /* ------------------------------------------------------------------ *
   * 再構築
   * ------------------------------------------------------------------ */
  function rebuild() {
    var t0 = performance.now();
    var sub = S.subject;
    var params = FT.paramsAtYear(sub, S.year);
    // 表示中のグリッドは毎フレーム作り直すので配列を使い回す。
    // 保持する過去 scan / 母集団平均には reuse を渡さない。
    var grid = FT.buildGrid(params, S.side, S.gridBuf);
    S.gridBuf = grid;
    var lm = FT.landmarks(grid);
    var mt = FT.metrics(grid, lm);

    // 処方は「その年までに適用済み」のもの。将来外挿の年でも現在の処方までしか出さない。
    var rxYear = Math.min(S.year, CONST.YEAR_NOW);
    var rx = FT.prescriptionsAtYear(sub, rxYear);
    var cp = FT.complaintsAtYear(sub, rxYear);

    var st = {
      grid: grid, landmarks: lm, metrics: mt,
      prescriptions: rx, complaints: cp, params: params
    };
    st.fast = false;   // heavy 判定のあとで確定させる

    if (S.layers.L4_pressure) {
      st.pressure = FT.estimatePressure(grid, S.pressureBuf);
      S.pressureBuf = st.pressure;
    }
    if (S.layers.L7_drift) {
      // 比較対象は最初の計測。スクラブ中も変わらないので作り直さない。
      var pk = sub.subject_id + S.side;
      if (S.pastKey !== pk) { S.pastGrid = FT.buildGrid(sub.scans[0].params, S.side); S.pastKey = pk; }
      st.pastGrid = S.pastGrid;
    }
    if (S.layers.L8_cohort) {
      var mg = FT.cohortMeanGrid(sub.sex, params.age, params.length);
      // 母集団平均は右足空間で作ってあるので、左足表示のときは向きを揃える
      st.meanGrid = (S.side === "L") ? mirrorGrid(mg) : mg;
    }
    /* 等高線の連結処理とインソール生成は他より一桁重い。
       スクラブ中はメッシュだけ毎フレーム更新し、この2つは 90ms に1回に落とす。
       主役のサーフェスが滑らかに動けば、体感は 60fps のままになる。 */
    var now = Date.now();
    var heavy = !S.scrubbing || (now - S.lastHeavyAt > 90);
    if (heavy) S.lastHeavyAt = now;
    st.fast = !heavy;

    if (S.layers.L9_insole) {
      if (heavy || !S.insole) S.insole = FT.buildInsole(grid, rx);
      st.insole = S.insole;
    }
    if (S.layers.L1_contour) {
      if (heavy || !S.contours) S.contours = FT.contours(grid);
      st.contours = S.contours;
    }

    S.viewer.setLayers(S.layers);
    S.viewer.update(st);
    S.state = st;
    renderPanel(st, heavy);
    // 描画投入ぶんを除いた JS の所要時間。これが我々の制御下にある予算。
    S.lastRenderMs = S.viewer.lastRenderMs || 0;
    S.lastRebuildMs = (performance.now() - t0) - S.lastRenderMs;
  }

  /* 左表示のときの母集団平均。元グリッドに結果をぶら下げて再利用する。
     キー文字列でキャッシュすると、タイムラインで足長が動くたびに
     取りこぼして毎フレーム Float32Array を作り直すことになる。 */
  function mirrorGrid(g) {
    if (g.__mirror) return g.__mirror;
    var nx = g.nx, nz = g.nz;
    var h = new Float32Array(nx * nz), m = new Uint8Array(nx * nz);
    for (var j = 0; j < nz; j++) {
      for (var i = 0; i < nx; i++) {
        h[j * nx + i] = g.height[j * nx + (nx - 1 - i)];
        m[j * nx + i] = g.mask[j * nx + (nx - 1 - i)];
      }
    }
    g.__mirror = {
      nx: nx, nz: nz, pitch_x: g.pitch_x, pitch_z: g.pitch_z,
      origin: g.origin.slice(), height: h, mask: m, side: "L", params: g.params
    };
    return g.__mirror;
  }

  function schedule() {
    if (S.raf) return;
    S.raf = requestAnimationFrame(function () { S.raf = 0; rebuild(); });
  }

  /* ------------------------------------------------------------------ *
   * パネル描画
   * ------------------------------------------------------------------ */
  /* full=false のとき（スクラブ中）は、動かして意味のある計測値の表だけを
     書き換える。ヒストグラム・類型・処方リストの innerHTML 生成は
     1フレームの予算を超えるので間引く。 */
  function renderPanel(st, full) {
    var g = FT.cohortGroup(S.subject.sex, st.params.age);
    var m = st.metrics;

    /* --- 計測結果 --- */
    var rows = [
      ["足長", m.foot_length.toFixed(1) + " mm", rank(g, "foot_length", m.foot_length)],
      ["足幅", m.foot_width.toFixed(1) + " mm", ""],
      ["足囲（推定）", m.ball_girth.toFixed(0) + " mm", ""],
      ["かかと幅", m.heel_width.toFixed(1) + " mm", ""],
      ["土踏まずの高さ", m.asi.toFixed(1) + " %", rank(g, "asi", m.asi)],
      ["土踏まずの最大高さ", m.instep_height.toFixed(1) + " mm", ""],
      ["土踏まずのボリューム", (m.arch_volume / 1000).toFixed(1) + " cm³", rank(g, "arch_volume", m.arch_volume)],
      ["横アーチ", m.transverse.toFixed(2), rank(g, "transverse", m.transverse)],
      ["母趾の傾き", m.hva.toFixed(1) + "°", rank(g, "hva", m.hva)],
      ["幅長比", (m.width_ratio * 100).toFixed(1) + " %", rank(g, "width_ratio", m.width_ratio)]
    ];
    var html = "", i;
    for (i = 0; i < rows.length; i++) {
      html += '<tr><td class="lab">' + rows[i][0] + '</td>'
            + '<td class="val">' + rows[i][1] + '</td>'
            + '<td class="rank">' + rows[i][2] + '</td></tr>';
    }
    $("metricBody").innerHTML = html;
    renderTime();
    if (!full) return;

    /* --- 類型 --- */
    var a = FT.nearestArchetype(st.params);
    var share = g.shares[a.id] || 0;
    $("archeBox").innerHTML =
      '<div class="t">6万人の中での類型</div>'
      + '<div class="n">' + a.id + ' — ' + a.name + '</div>'
      + '<div class="d">' + g.label + 'では、この類型が '
      + Math.round(share * 100) + '%（約 '
      + Math.round(share * CONST.COHORT_N / 100) * 100 + ' 人）を占める</div>';

    /* --- 凡例 --- */
    // L9 が ON のときはインソールが主役なので、そちらの凡例を出す
    var mode = S.layers.L9_insole ? "L9_insole" : S.viewer.activeColorLayer();
    var lg = COLOR_LEGEND[mode];
    $("legend").style.display = lg ? "block" : "none";
    if (lg) {
      $("legend").innerHTML = '<b>' + lg.title + '</b>'
        + '<div class="bar" style="background:' + lg.css + '"></div>'
        + '<div class="ends"><span>' + lg.lo + '</span><span>' + lg.hi + '</span></div>';
    }

    /* --- 処方 --- */
    var rxHtml = "";
    if (!st.prescriptions.length) {
      rxHtml = '<p class="hnote">この時点の補正の記録はありません。</p>';
    } else {
      for (i = 0; i < st.prescriptions.length; i++) {
        var rx = st.prescriptions[i];
        rxHtml += '<div class="rxrow"><div>' + (RX_JP[rx.landmark] || rx.landmark)
          + '<span class="yr"> ／ ' + rx.applied_at.slice(0, 4) + ' ／ '
          + (GRADE_JP[rx.grade] || rx.grade) + '</span></div>'
          + '<div class="mm">+' + rx.lift_mm.toFixed(1) + ' mm</div></div>';
      }
      rxHtml += '<p class="hnote">レイヤ 9 で、この補正を反映したインソール形状を表示します。'
        + '画面上の形状は説明用の参考表示です。</p>';
    }
    $("rxList").innerHTML = rxHtml;
    renderHist(g, m);
  }

  function rank(g, key, v) {
    var p = FT.percentile(g, key, v);
    return p === null ? "" : FT.rankText(p);
  }

  /* --- ヒストグラム --- */
  function renderHist(g, m) {
    var def = null, i;
    for (i = 0; i < HIST_METRICS.length; i++) {
      if (HIST_METRICS[i].key === S.histMetric) def = HIST_METRICS[i];
    }
    var h = FT.histogram(g, def.key, 26);
    var val = m[def.key];
    var W = 300, H = 118, PB = 16;
    var mx = 0;
    for (i = 0; i < h.counts.length; i++) mx = Math.max(mx, h.counts[i]);
    var bw = W / h.nbins;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="分布">';
    for (i = 0; i < h.nbins; i++) {
      var bh = mx > 0 ? (h.counts[i] / mx) * (H - PB - 6) : 0;
      svg += '<rect x="' + (i * bw + 0.6).toFixed(1) + '" y="' + (H - PB - bh).toFixed(1)
           + '" width="' + (bw - 1.2).toFixed(1) + '" height="' + bh.toFixed(1)
           + '" fill="#C6CCC4"/>';
    }
    var t = FT.clamp01((val - h.lo) / (h.hi - h.lo));
    var x = t * W;
    svg += '<line x1="' + x.toFixed(1) + '" y1="2" x2="' + x.toFixed(1) + '" y2="' + (H - PB)
         + '" stroke="#A8851C" stroke-width="2"/>';
    svg += '<circle cx="' + x.toFixed(1) + '" cy="6" r="3.6" fill="#A8851C"/>';
    svg += '<line x1="0" y1="' + (H - PB) + '" x2="' + W + '" y2="' + (H - PB)
         + '" stroke="#14202A" stroke-width="1"/>';
    svg += '<text x="0" y="' + (H - 4) + '" font-size="10" fill="#8A959C"'
         + ' font-family="ui-monospace,monospace">' + def.fmt(h.lo) + '</text>';
    svg += '<text x="' + W + '" y="' + (H - 4) + '" text-anchor="end" font-size="10"'
         + ' fill="#8A959C" font-family="ui-monospace,monospace">' + def.fmt(h.hi) + '</text>';
    svg += '</svg>';
    $("histWrap").innerHTML = svg;

    var pct = FT.percentile(g, def.key, val);
    $("histNote").innerHTML = def.label + ' <b>' + def.fmt(val) + '</b> ／ '
      + g.label + ' ' + CONST.COHORT_N.toLocaleString() + ' 人中 <b>'
      + FT.rankText(pct) + '</b>';
  }

  /* --- タイムライン --- */
  function renderTime() {
    var future = S.year > CONST.YEAR_NOW;
    var isScan = false;
    for (var i = 0; i < FT.SCAN_YEARS.length; i++) {
      if (FT.SCAN_YEARS[i] === S.year) isScan = true;
    }
    $("yearLabel").textContent = S.year;
    $("yearKind").textContent = future ? "参考表示" : (isScan ? "計測" : "計測間の補間");
    var d = $("disc");
    d.textContent = future
      ? "※ 現在の計測値を年齢変化の一般的傾向で延長した参考表示です。個別の予後を示すものではありません。"
      : "2013 / 2019 / 2026 が計測、その間は補間です。2026 より先は参考表示に切り替わります。";
    d.className = future ? "on" : "";
  }

  /* ------------------------------------------------------------------ *
   * ホバー / ピン
   * ------------------------------------------------------------------ */
  function hudDefault() {
    var st = S.state;
    if (!st) return;
    $("hud").innerHTML =
      '<b>' + S.subject.label + '</b> ／ ' + (S.side === "R" ? "右足" : "左足")
      + ' ／ ' + S.year + '<br>'
      + '<span class="k">足長</span>' + st.metrics.foot_length.toFixed(1) + ' mm<br>'
      + '<span class="k">土踏まず</span>' + st.metrics.asi.toFixed(1) + ' %<br>'
      + '<span class="k">操作</span>ドラッグで回転／ホイールで拡大';
  }

  function onHover(e) {
    var st = S.state;
    if (!st) return;
    var hit = S.viewer.pick(e.clientX, e.clientY);
    if (!hit) { hudDefault(); return; }
    var mean = FT.cohortMeanGrid(S.subject.sex, st.params.age, st.params.length);
    var mk = (S.side === "L") ? mirrorGrid(mean) : mean;
    var dm = mk.mask[hit.cell] ? (hit.height - mk.height[hit.cell]) : null;
    $("hud").innerHTML =
      '<b>' + hit.height.toFixed(2) + ' mm</b> <span class="k" style="min-width:0">床から</span><br>'
      + '<span class="k">前後位置</span>' + (hit.v * 100).toFixed(0) + ' %（かかと基準）<br>'
      + '<span class="k">左右位置</span>' + (hit.u >= 0 ? "外側 " : "内側 ")
      + Math.abs(hit.u * CONST.U_TO_LEN * st.params.length).toFixed(0) + ' mm<br>'
      + '<span class="k">平均との差</span>'
      + (dm === null ? "—" : (dm >= 0 ? "+" : "") + dm.toFixed(2) + ' mm');
  }

  function onClick(e) {
    var hit = S.viewer.pick(e.clientX, e.clientY);
    if (!hit) return;
    var pins = S.viewer.addPin(hit);
    var box = $("pinbox");
    if (pins.length < 2) {
      box.className = "";
      box.innerHTML = '<b>ピン 1</b> 高さ ' + hit.height.toFixed(2)
        + ' mm<br><span style="color:#8A959C">もう1点クリックすると2点間を測ります</span>';
      return;
    }
    var a = pins[pins.length - 2], b = pins[pins.length - 1];
    var dx = b.world[0] - a.world[0], dz = b.world[2] - a.world[2];
    var dh = b.world[1] - a.world[1];
    box.className = "";
    box.innerHTML = '<b>2点間</b><br>水平距離 ' + Math.hypot(dx, dz).toFixed(1)
      + ' mm<br>高低差 ' + (dh >= 0 ? "+" : "") + dh.toFixed(2) + ' mm'
      + '<br><span style="color:#8A959C">ダブルクリックで消去</span>';
  }

  /* ------------------------------------------------------------------ *
   * 起動
   * ------------------------------------------------------------------ */
  function boot() {
    initLayers();
    S.subject = FT.SUBJECTS[0];
    S.viewer = new FT.Viewer($("stage"));

    /* subject */
    var sel = $("subjectSel"), i;
    for (i = 0; i < FT.SUBJECTS.length; i++) {
      var s = FT.SUBJECTS[i];
      var o = document.createElement("option");
      o.value = s.subject_id;
      o.textContent = s.label + "　" + (s.sex === "M" ? "男性" : "女性")
        + " " + (CONST.YEAR_NOW - s.birth_year) + "歳";
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () {
      for (var q = 0; q < FT.SUBJECTS.length; q++) {
        if (FT.SUBJECTS[q].subject_id === sel.value) S.subject = FT.SUBJECTS[q];
      }
      S.viewer.clearPins();
      $("pinbox").className = "empty";
      schedule();
    });

    /* 左右 */
    var seg = $("sideSeg");
    seg.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      S.side = b.getAttribute("data-side");
      var bs = seg.getElementsByTagName("button");
      for (var q = 0; q < bs.length; q++) {
        bs[q].setAttribute("aria-pressed", bs[q] === b ? "true" : "false");
      }
      S.viewer.clearPins();
      S.contours = null;
      schedule();
    });

    /* 定型ビュー */
    $("viewbtns").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (b) S.viewer.setView(b.getAttribute("data-view"), S.side);
    });
    $("resetBtn").addEventListener("click", function () { S.viewer.setView("R", S.side); });

    /* レイヤ */
    var list = $("layerList");
    for (i = 0; i < LAYERS.length; i++) {
      (function (L) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "layer";
        b.setAttribute("aria-pressed", L.on ? "true" : "false");
        b.setAttribute("data-layer", L.id);
        b.innerHTML = '<span class="ln">' + L.n + '</span>'
          + '<span><span class="lt">' + L.t + '</span>'
          + '<span class="lh">' + L.h + '</span></span>'
          + '<span class="sw"><i></i></span>';
        b.addEventListener("click", function () { toggleLayer(L.id); });
        list.appendChild(b);
      })(LAYERS[i]);
    }

    /* コホートの指標切替 */
    var ms = $("metricSel");
    for (i = 0; i < HIST_METRICS.length; i++) {
      (function (H) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = H.label;
        b.setAttribute("aria-pressed", H.key === S.histMetric ? "true" : "false");
        b.addEventListener("click", function () {
          S.histMetric = H.key;
          var bs = ms.getElementsByTagName("button");
          for (var q = 0; q < bs.length; q++) {
            bs[q].setAttribute("aria-pressed", bs[q] === b ? "true" : "false");
          }
          renderHist(FT.cohortGroup(S.subject.sex, S.state.params.age), S.state.metrics);
        });
        ms.appendChild(b);
      })(HIST_METRICS[i]);
    }

    /* タイムライン */
    var range = $("yearRange");
    range.min = CONST.YEAR_MIN; range.max = CONST.YEAR_MAX; range.value = CONST.YEAR_NOW;
    var ticks = $("ticks"), marks = [2013, 2019, 2026, 2036];
    for (i = 0; i < marks.length; i++) {
      var sp = document.createElement("span");
      var t = (marks[i] - CONST.YEAR_MIN) / (CONST.YEAR_MAX - CONST.YEAR_MIN);
      sp.style.left = (t * 100) + "%";
      sp.textContent = marks[i] + (marks[i] === 2036 ? " 参考" : "");
      var cls = [];
      if (marks[i] > CONST.YEAR_NOW) cls.push("ex");
      if (i === 0) cls.push("first");
      if (i === marks.length - 1) cls.push("last");
      sp.className = cls.join(" ");
      ticks.appendChild(sp);
    }
    range.addEventListener("input", function () {
      S.year = parseInt(range.value, 10);
      S.scrubbing = true;
      schedule();
    });
    range.addEventListener("change", function () {
      S.scrubbing = false;
      S.contours = null;
      schedule();
    });

    /* ホバー / クリック */
    var stage = $("stage");
    stage.addEventListener("mousemove", onHover);
    stage.addEventListener("mouseleave", hudDefault);
    stage.addEventListener("click", onClick);
    stage.addEventListener("dblclick", function () {
      S.viewer.clearPins();
      $("pinbox").className = "empty";
    });

    /* キーボード（SPEC §7） */
    window.addEventListener("keydown", function (e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      var k = e.key;
      if (k >= "0" && k <= "9") {
        var idx = parseInt(k, 10);
        if (LAYERS[idx]) { toggleLayer(LAYERS[idx].id); e.preventDefault(); }
        return;
      }
      var up = k.toUpperCase();
      if (up === "R") S.viewer.setView("R", S.side);
      else if (up === "T" || up === "B" || up === "M" || up === "L") S.viewer.setView(up, S.side);
    });

    window.addEventListener("resize", function () {
      S.viewer.resize();
      S.viewer.render();
    });

    rebuild();
    hudDefault();
    S.viewer.setView("R", S.side);
    S.bootMs = performance.now();

    // 検証用フック。verify.py がレイヤ操作とスクリーンショットに使う。
    root.FOOT_TWIN = {
      zoom: function (r) { S.viewer.controls.radius = r; S.viewer.controls.apply(); S.viewer.render(); },
      bootMs: function () { return S.bootMs; },
      rebuildMs: function () { return S.lastRebuildMs; },
      renderMs: function () { return S.lastRenderMs; },
      setLayer: function (id, on) { S.layers[id] = !!on; syncLayerButtons(); rebuild(); },
      toggleLayer: toggleLayer,
      setYear: function (y) { S.year = y; $("yearRange").value = y; rebuild(); },
      setSubject: function (id) {
        for (var q = 0; q < FT.SUBJECTS.length; q++) {
          if (FT.SUBJECTS[q].subject_id === id) S.subject = FT.SUBJECTS[q];
        }
        $("subjectSel").value = id;
        rebuild();
      },
      setSide: function (s) {
        S.side = s; S.contours = null;
        var bs = $("sideSeg").getElementsByTagName("button");
        for (var q = 0; q < bs.length; q++) {
          bs[q].setAttribute("aria-pressed", bs[q].getAttribute("data-side") === s ? "true" : "false");
        }
        rebuild();
      },
      setView: function (v) { S.viewer.setView(v, S.side); },
      state: function () { return S; },
      FT: FT
    };
  }

  function toggleLayer(id) {
    S.layers[id] = !S.layers[id];
    syncLayerButtons();
    rebuild();
  }

  function syncLayerButtons() {
    var bs = $("layerList").getElementsByTagName("button");
    for (var i = 0; i < bs.length; i++) {
      var id = bs[i].getAttribute("data-layer");
      bs[i].setAttribute("aria-pressed", S.layers[id] ? "true" : "false");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})(typeof window !== "undefined" ? window : this);
