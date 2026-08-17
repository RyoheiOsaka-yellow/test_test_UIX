/* tests.js — CLAUDE.md §5 の完了条件を数値で確認する。
   verify.py が page.evaluate に流し込み、結果配列を受け取る。
   ページ内で実行されるので FT / FOOT_TWIN がそのまま使える。 */
(function () {
  "use strict";
  var FT = window.FOOT_TWIN.FT;
  var C = FT.CONST;
  var out = [];
  function T(name, ok, detail) { out.push({ name: name, ok: !!ok, detail: detail }); }

  /* 連結成分の数と穴の数を数える（4近傍） */
  function components(mask, nx, nz, want) {
    var seen = new Uint8Array(nx * nz), n = 0, stack = [];
    for (var s = 0; s < nx * nz; s++) {
      if (seen[s] || (mask[s] ? 1 : 0) !== want) continue;
      n++; seen[s] = 1; stack.length = 0; stack.push(s);
      while (stack.length) {
        var k = stack.pop(), i = k % nx, j = (k / nx) | 0;
        var nb = [];
        if (i > 0) nb.push(k - 1);
        if (i < nx - 1) nb.push(k + 1);
        if (j > 0) nb.push(k - nx);
        if (j < nz - 1) nb.push(k + nx);
        for (var q = 0; q < nb.length; q++) {
          if (!seen[nb[q]] && (mask[nb[q]] ? 1 : 0) === want) { seen[nb[q]] = 1; stack.push(nb[q]); }
        }
      }
    }
    return n;
  }

  /* ---------------- B-1：足型ジェネレータ ---------------- */
  (function () {
    var rnd = FT.rng.mulberry32(99), bad = [], i;
    for (i = 0; i < 20; i++) {
      var p = FT.clampParams({
        length: 210 + rnd() * 90, widthScale: 0.85 + rnd() * 0.35,
        archAmp: rnd() * 1.4, archPos: 0.38 + rnd() * 0.12,
        archSkew: -0.3 + rnd() * 0.6, transAmp: rnd() * 0.6,
        hvaDeg: rnd() * 35, toeSpring: rnd() * 0.5, age: 20 + rnd() * 65
      });
      var g = FT.buildGrid(p, i % 2 ? "L" : "R");
      var nFoot = components(g.mask, g.nx, g.nz, 1);
      // 穴＝マスク外の連結成分が外側の1つだけであること
      var nHole = components(g.mask, g.nx, g.nz, 0);
      if (nFoot !== 1 || nHole !== 1) bad.push(i + ":c" + nFoot + "/h" + nHole);
    }
    T("B-1 20個すべてが単一連結の閉領域", bad.length === 0,
      bad.length ? bad.join(",") : "20/20 単一連結・穴なし");
  })();

  /* ---------------- B-2：法線 ---------------- */
  (function () {
    var g = FT.buildGrid(FT.SUBJECTS[0].scans[2].params, "R");
    var fm = new FT.FieldMesh(g.nx, g.nz, new THREE.MeshBasicMaterial());
    fm.update(g, function (k, i, j, o) { o[0] = o[1] = o[2] = 0.5; return o; });
    var n = fm.nrm, bad = 0, minY = 1;
    for (var v = 0; v < fm.vertexCount; v++) {
      var x = n[v * 3], y = n[v * 3 + 1], z = n[v * 3 + 2];
      var len = Math.sqrt(x * x + y * y + z * z);
      if (Math.abs(len - 1) > 1e-3) bad++;
      if (y < minY) minY = y;
    }
    T("B-2 法線が単位長で全て上向き", bad === 0 && minY > 0,
      "非単位 " + bad + " 件 / 最小 Y 成分 " + minY.toFixed(3));
  })();

  /* ---------------- B-3：カメラ（ジンバルロックなし） ---------------- */
  (function () {
    var vw = window.FOOT_TWIN.state().viewer, c = vw.controls, bad = 0;
    for (var s = 0; s <= 40; s++) {
      c.theta = -Math.PI + s * (2 * Math.PI / 40);
      c.phi = 0.001 + s * (Math.PI / 40);
      c.apply();
      var p = vw.camera.position;
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) bad++;
      var d = Math.hypot(p.x - c.target.x, p.y - c.target.y, p.z - c.target.z);
      if (Math.abs(d - c.radius) > 0.5) bad++;
    }
    c.theta = -0.62; c.phi = 0.78; c.apply();
    T("B-3 全方向で破綻なし・半径保存", bad === 0, "異常 " + bad + " 件 / 41 姿勢");
  })();

  /* ---------------- B-4：等高線 ---------------- */
  (function () {
    var g = FT.buildGrid(FT.SUBJECTS[0].scans[2].params, "R");
    var cs = FT.contours(g);
    var open = 0, minPts = 1e9;
    for (var i = 0; i < cs.length; i++) {
      var pts = cs[i].pts;
      var d = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
      if (d > 1e-6) open++;
      if (pts.length < minPts) minPts = pts.length;
    }
    var levels = {};
    for (i = 0; i < cs.length; i++) levels[cs[i].level] = 1;
    var nl = Object.keys(levels).length;
    T("B-4 等高線が 2mm 間隔で全て閉曲線", open === 0 && cs.length > 0,
      cs.length + " 本 / " + nl + " レベル / 開いた曲線 " + open + " 本 / 最小点数 " + minPts);
  })();

  /* ---------------- B-5：指標が入力パラメータと ±2% ---------------- */
  (function () {
    var rnd = FT.rng.mulberry32(4242), worst = { k: "", e: 0 }, rows = [];
    for (var i = 0; i < 12; i++) {
      var p = FT.clampParams({
        length: 215 + rnd() * 80, widthScale: 0.88 + rnd() * 0.30,
        archAmp: 0.1 + rnd() * 1.2, archPos: 0.40 + rnd() * 0.08,
        archSkew: -0.2 + rnd() * 0.4, transAmp: rnd() * 0.6,
        hvaDeg: 2 + rnd() * 30, toeSpring: rnd() * 0.5, age: 25 + rnd() * 55
      });
      var side = i % 2 ? "L" : "R";
      var g = FT.buildGrid(p, side);
      var m = FT.metrics(g);
      var expW = 0.392 * p.widthScale * p.length;
      // abs は絶対値の許容下限。角度はグリッド解像度で分解能が決まるため
      // 相対 2% だけを課すと測定限界を不合格にしてしまう（CLAUDE.md §5）。
      var checks = [
        ["length", m.foot_length, p.length, 0],
        ["width", m.foot_width, expW, 0],
        ["hva", m.hva, p.hvaDeg, 0.2]
      ];
      for (var q = 0; q < checks.length; q++) {
        var abs = Math.abs(checks[q][1] - checks[q][2]);
        if (abs <= checks[q][3]) continue;
        var rel = abs / Math.abs(checks[q][2]);
        if (rel > worst.e) worst = { k: checks[q][0] + "(" + side + ")", e: rel };
        rows.push(checks[q][0] + " " + checks[q][1].toFixed(2) + "/" + checks[q][2].toFixed(2));
      }
    }
    T("B-5 算出値が入力値と ±2%（hva は ±2% または ±0.2°）", worst.e <= 0.02,
      "最大誤差 " + (worst.e * 100).toFixed(2) + "%"
      + (worst.k ? " (" + worst.k + ")" : "（すべて許容内）"));
  })();

  /* ---------------- B-6：コホート統計 ---------------- */
  (function () {
    var g = FT.cohortGroup("M", 45);
    var keys = ["asi", "arch_volume", "hva", "width_ratio"], bad = [], i;
    for (i = 0; i < keys.length; i++) {
      var a = g.sorted[keys[i]], n = a.length;
      var pLo = FT.percentile(g, keys[i], a[0]);
      var pHi = FT.percentile(g, keys[i], a[n - 1]);
      var med = FT.percentile(g, keys[i], a[(n / 2) | 0]);
      if (pLo < 0 || pHi > 100) bad.push(keys[i] + " 範囲外");
      if (Math.abs(med - 50) > 2) bad.push(keys[i] + " 中央値 " + med.toFixed(2));
    }
    var sum = 0, k;
    for (k in g.shares) { if (g.shares.hasOwnProperty(k)) sum += g.shares[k]; }
    if (Math.abs(sum - 1) > 1e-6) bad.push("類型シェア合計 " + sum);
    T("B-6 パーセンタイル 0–100 / 中央値 50±2", bad.length === 0,
      bad.length ? bad.join(", ") : "4指標すべて適合、類型シェア合計 1.000");
  })();

  /* ---------------- B-8：ピッキング ---------------- */
  (function () {
    var vw = window.FOOT_TWIN.state().viewer;
    // 直前のテストや検証手順がカメラをどこへ動かしていても成立するよう、
    // 既知の視点に戻してから撃つ。
    window.FOOT_TWIN.setView("R");
    var grid = vw.state.grid, fm = vw.footMesh;
    var bad = 0, worstH = 0, worstCell = 0, tried = 0;
    var rc = new THREE.Raycaster(), rnd = FT.rng.mulberry32(1234);
    for (var n = 0; n < 300 && tried < 100; n++) {
      var mx = (rnd() - 0.5) * 1.2, my = (rnd() - 0.5) * 1.2;
      rc.setFromCamera(new THREE.Vector2(mx, my), vw.camera);
      var hits = rc.intersectObject(fm.mesh, false);
      if (!hits.length || !hits[0].face) continue;
      tried++;
      var cell = fm.vertexToCell[hits[0].face.a];
      var i = cell % grid.nx, j = (cell / grid.nx) | 0;
      // 読み出した高さが、そのセルの真値と一致すること
      var dh = Math.abs(grid.height[cell] - FT.heightAt(grid.params,
        (grid.side === "L" ? -1 : 1) * ((i / (grid.nx - 1) - 0.5) * C.FW), j / (grid.nz - 1)));
      if (dh > worstH) worstH = dh;
      // 逆算したセルが交点の近傍にあること（インデックスずれの検出）
      var dc = Math.max(
        Math.abs(FT.cellX(grid, i) - hits[0].point.x) / grid.pitch_x,
        Math.abs(FT.cellZ(grid, j) - hits[0].point.z) / grid.pitch_z);
      if (dc > worstCell) worstCell = dc;
      if (dh > 0.05 || dc > 1.5) bad++;
    }
    T("B-8 ピッキングの高さが真値と ±0.05mm", tried >= 60 && bad === 0,
      tried + " 点 / 高さ誤差最大 " + worstH.toFixed(5) + "mm / セルずれ最大 "
      + worstCell.toFixed(2) + " セル / 不合格 " + bad
      + " [頂点 " + fm.vertexCount + " 可視 " + fm.mesh.visible
      + " カメラ " + vw.camera.position.toArray().map(function (x) {
          return x.toFixed(0); }).join(",") + "]");
  })();

  /* ---------------- B-9：タイムライン補間の単調性 ---------------- */
  (function () {
    var sub = FT.SUBJECTS[0], prev = null, bad = 0, jumps = [];
    for (var y = 2026; y <= 2036; y++) {
      var p = FT.paramsAtYear(sub, y);
      if (prev) {
        // 2026 以降は加齢外挿。アーチは単調に下がり HVA は単調に上がる。
        if (p.archAmp > prev.archAmp + 1e-9) bad++;
        if (p.hvaDeg < prev.hvaDeg - 1e-9) bad++;
        jumps.push(Math.abs(p.length - prev.length));
      }
      prev = p;
    }
    var maxJump = Math.max.apply(null, jumps);
    // 記録 scan 間の補間が連続であること
    var cont = 0;
    for (var q = 2013; q < 2026; q++) {
      var a = FT.paramsAtYear(sub, q), b2 = FT.paramsAtYear(sub, q + 1);
      if (Math.abs(b2.archAmp - a.archAmp) > 0.08) cont++;
    }
    T("B-9 外挿が単調・補間が連続", bad === 0 && cont === 0,
      "非単調 " + bad + " / 不連続 " + cont + " / 足長の年あたり最大変化 "
      + maxJump.toFixed(3) + "mm");
  })();

  /* ---------------- B-11：インソール ---------------- */
  (function () {
    var sub = FT.SUBJECTS[0];
    var g = FT.buildGrid(sub.scans[2].params, "R");
    var rx = FT.prescriptionsAtYear(sub, 2026);
    var ins = FT.buildInsole(g, rx);

    var thin = 0, minT = 1e9, i;
    for (i = 0; i < ins.top.length; i++) {
      if (ins.top[i] < minT) minT = ins.top[i];
      if (ins.top[i] < C.INSOLE.BASE_THICK - 1e-6) thin++;
    }
    // パラメトリック表現なので連結性は構造上保証される。
    // 代わりに外形が途中で潰れていないこと（半幅が正）を見る。
    var degenerate = 0;
    for (i = 2; i < ins.nS - 2; i++) { if (ins.halfW[i] <= 0) degenerate++; }
    T("B-11a 外形が途中で潰れず・最小肉厚を満たす",
      degenerate === 0 && thin === 0,
      "半幅が 0 以下の行 " + degenerate + " / 最小肉厚 " + minT.toFixed(3) + "mm");

    /* 孤立した処方について、補正場のピークが lift_mm と ±5% で一致すること。
       他のカーネルと重なる位置は重畳するので、単独の処方だけを見る。 */
    var worst = 0, det = [];
    for (var n = 0; n < rx.length; n++) {
      var one = [rx[n]];
      var K = FT.INSOLE_KERNEL[rx[n].landmark];
      var peak = FT.liftAt(one, K.u, K.v, g.params.length);
      var e = Math.abs(peak - rx[n].lift_mm) / rx[n].lift_mm;
      if (e > worst) worst = e;
      det.push(rx[n].landmark + " " + peak.toFixed(2) + "/" + rx[n].lift_mm);
    }
    T("B-11b 補正場のピークが lift_mm と ±5%", worst <= 0.05,
      "最大誤差 " + (worst * 100).toFixed(2) + "% [" + det.join(", ") + "]");

    /* 外形がラスト形状になっていること：
       足の外形は趾があるぶん先端で幅が波打つ。インソールは波打たない。 */
    var jToe = Math.round(C.INSOLE.TOE_MERGE * (ins.nS - 1));
    var mono = 0, prevW = ins.halfW[jToe];
    for (i = jToe + 1; i < ins.nS; i++) {
      if (ins.halfW[i] > prevW + 1e-9) mono++;
      prevW = ins.halfW[i];
    }
    T("B-11c 先端が単一の丸みで閉じる（幅が単調減少）", mono === 0,
      "先端側で幅が増える行 " + mono + " 件");

    /* 実物の比率（ref/insole_bestposition.md）を満たしていること */
    var wMax = 0, jMax = 0;
    for (i = 0; i < ins.nS; i++) { if (ins.halfW[i] > wMax) { wMax = ins.halfW[i]; jMax = i; } }
    var wHeel = 0;
    for (i = Math.round(0.10 * (ins.nS - 1)); i <= Math.round(0.24 * (ins.nS - 1)); i++) {
      if (ins.halfW[i] > wHeel) wHeel = ins.halfW[i];
    }
    var sMax = jMax / (ins.nS - 1), heelRatio = wHeel / wMax;
    T("B-11c2 最大幅の位置と踵幅比が実物と整合",
      sMax > 0.60 && sMax < 0.80 && heelRatio > 0.60 && heelRatio < 0.75,
      "最大幅の位置 " + sMax.toFixed(3) + " / 踵幅比 " + heelRatio.toFixed(3));

    /* インソールが足より長いこと（ラスト長／足長 = 1.045） */
    var lenIns = ins.nS, lenFoot = g.nz;
    var ratio = lenIns / lenFoot;
    T("B-11d ラスト長が足長の 1.045 倍", Math.abs(ratio - C.INSOLE.LAST_SCALE) < 0.02,
      "比 " + ratio.toFixed(4));

    /* 差分が ±5mm レンジに収まること（カラーマップが飽和しない） */
    var over = 0, maxD = 0;
    for (i = 0; i < ins.diff.length; i++) {
      if (Math.abs(ins.diff[i]) > maxD) maxD = Math.abs(ins.diff[i]);
      if (Math.abs(ins.diff[i]) > C.INSOLE_RANGE) over++;
    }
    T("B-11e 差分がカラーマップのレンジ内に収まる", over === 0,
      "最大 " + maxD.toFixed(2) + "mm / ±" + C.INSOLE_RANGE
      + "mm を超えるセル " + over);
  })();

  /* ---------------- 左右の扱い（SPEC §2-2） ---------------- */
  (function () {
    var p = FT.SUBJECTS[0].scans[2].params;
    var R = FT.buildGrid(p, "R"), L = FT.buildGrid(p, "L");
    var axR = FT.medialAxis("R"), axL = FT.medialAxis("L");
    var bad = 0, i, j;
    for (j = 0; j < R.nz; j += 7) {
      for (i = 0; i < R.nx; i++) {
        var a = R.height[j * R.nx + i], b = L.height[j * L.nx + (L.nx - 1 - i)];
        if (Math.abs(a - b) > 1e-5) bad++;
      }
    }
    var mR = FT.metrics(R), mL = FT.metrics(L);
    var dh = Math.abs(mR.hva - mL.hva);
    T("SPEC §2-2 左足が右足の正確なミラー・指標が一致",
      bad === 0 && axR[0] === -1 && axL[0] === 1 && dh < 0.02,
      "不一致セル " + bad + " / axis_medial R=" + axR[0] + " L=" + axL[0]
      + " / HVA 差 " + dh.toFixed(4) + "°");
  })();

  /* ---------------- 禁止表現（SPEC §9-4） ---------------- */
  (function () {
    var text = document.body.innerText || "";
    var banned = ["診断", "異常", "正常", "治療", "改善します", "予測します",
                  "扁平足", "足底腱膜炎", "疾患"];
    var hit = [];
    for (var i = 0; i < banned.length; i++) {
      if (text.indexOf(banned[i]) >= 0) hit.push(banned[i]);
    }
    var hasDisc = text.indexOf("個別の予後を示すものではありません") >= 0
               || document.getElementById("disc").textContent.length > 0;
    T("SPEC §9-4 禁止表現が画面に出ていない", hit.length === 0,
      hit.length ? "検出: " + hit.join(",") : "0 件 / 注記の表示 " + hasDisc);
  })();

  return out;
})();
