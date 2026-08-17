/* ==========================================================================
   viewer.js — Three.js シーン / レイヤ L0–L9 / ピッキング / カメラ
   SPEC §5, §6, §7
   ========================================================================== */
(function (root) {
  "use strict";

  var FT = root.FT;
  var CONST = FT.CONST;

  /* ------------------------------------------------------------------ *
   * カラーマップ（SPEC §8）。すべて sRGB 直値。
   * r128 は ColorManagement を前提にしないので変換を挟まない。
   * ------------------------------------------------------------------ */
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function rampFactory(stops) {
    var cols = [], i;
    for (i = 0; i < stops.length; i++) cols.push(hexToRgb(stops[i]));
    return function (t, out) {
      t = FT.clamp01(t) * (cols.length - 1);
      var i0 = Math.floor(t), i1 = Math.min(i0 + 1, cols.length - 1), f = t - i0;
      out[0] = cols[i0][0] + (cols[i1][0] - cols[i0][0]) * f;
      out[1] = cols[i0][1] + (cols[i1][1] - cols[i0][1]) * f;
      out[2] = cols[i0][2] + (cols[i1][2] - cols[i0][2]) * f;
      return out;
    };
  }
  /* カラーマップは 512 段の参照表にしておく。頂点ごとに補間関数を呼ぶと
     1万頂点 × 毎フレームでフレーム予算のかなりを占めるため。 */
  var LUT_N = 512;
  function lutFactory(stops) {
    var f = rampFactory(stops), a = new Float32Array(LUT_N * 3), t = [0, 0, 0], i;
    for (i = 0; i < LUT_N; i++) {
      f(i / (LUT_N - 1), t);
      a[i * 3] = t[0]; a[i * 3 + 1] = t[1]; a[i * 3 + 2] = t[2];
    }
    return a;
  }
  function lutAt(lut, t, out) {
    var i = (FT.clamp01(t) * (LUT_N - 1)) | 0;
    out[0] = lut[i * 3]; out[1] = lut[i * 3 + 1]; out[2] = lut[i * 3 + 2];
    return out;
  }
  var LUT = {
    height:   lutFactory(["#F2F4F0", "#7FB2AA", "#1D6B66", "#0E3D3A"]),
    pressure: lutFactory(["#F5F2EA", "#D8A64A", "#A8851C"]),
    // 発散マップは1本の表にまとめる。中央 0.5 が無彩色。
    diverge:  lutFactory(["#A63A2B", "#EDEDE8", "#1D6B66"])
  };
  var RAMP = {
    height:   function (t, o) { return lutAt(LUT.height, t, o); },
    pressure: function (t, o) { return lutAt(LUT.pressure, t, o); }
  };
  /* range は用途ごとの固定値。自動スケーリングはしない（SPEC §8）。 */
  function diffColor(d, range, out) {
    return lutAt(LUT.diverge, 0.5 + 0.5 * FT.clamp(d / range, -1, 1), out);
  }
  FT.RAMP = RAMP;
  FT.diffColor = diffColor;

  /* 高さの色付けも足ごとに正規化せず固定レンジで行う。
     可変にすると個体間で見た目が比較できなくなる（SPEC §8 の差分と同じ理由）。 */
  var HEIGHT_RANGE = 28.0;

  /* 等高線の帯の半幅（mm）。主曲線を太くする（SPEC §6 L1） */
  var CONTOUR_W = { major: 0.45, minor: 0.22 };

  /* 甲側の色。医療的な意味を持たせないよう、無彩色に近い紙色にする。
     白に寄せすぎると陰影が飛んで立体に見えないので、中明度に落とす。 */
  var SKIN_RGB = hexToRgb("#B9BFB4");
  /* 色レイヤが全部 OFF のときの足底の色 */
  var SOLE_NEUTRAL = "#C9D2CE";

  /* ------------------------------------------------------------------ *
   * 高さ場 → BufferGeometry（SPEC §5-2）
   * 事前に最大サイズで確保し、更新時は詰め直すだけにする。
   * タイムラインスクラブ中に毎フレーム作り直すと GC で落ちるため。
   * ------------------------------------------------------------------ */
  function FieldMesh(nx, nz, material) {
    var maxV = nx * nz;
    var maxI = (nx - 1) * (nz - 1) * 6;
    this.nx = nx; this.nz = nz;
    this.pos = new Float32Array(maxV * 3);
    this.nrm = new Float32Array(maxV * 3);
    this.col = new Float32Array(maxV * 3);
    this.idx = new Uint32Array(maxI);
    this.vertexToCell = new Int32Array(maxV);
    this.cellToVertex = new Int32Array(maxV);

    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.geom = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  /* colorFn(cellIndex, i, j, out[3]) で各頂点の色を決める。
     yOf(cellIndex) を渡すと高さを差し替えられる（底面キャップ用）。 */
  FieldMesh.prototype.update = function (grid, colorFn, yOffset) {
    yOffset = yOffset || 0;
    var nx = grid.nx, nz = grid.nz;
    var c2v = this.cellToVertex, v2c = this.vertexToCell;
    var pos = this.pos, nrm = this.nrm, col = this.col, idx = this.idx;
    var i, j, k, nv = 0, rgb = [0, 0, 0];
    var H = grid.height, M = grid.mask;
    var ox = grid.origin[0], oz = grid.origin[2];
    var px = grid.pitch_x, pz = grid.pitch_z;
    var inv2px = 1 / (2 * px), inv2pz = 1 / (2 * pz);

    for (k = 0; k < nx * nz; k++) c2v[k] = -1;

    for (j = 0; j < nz; j++) {
      for (i = 0; i < nx; i++) {
        k = j * nx + i;
        if (!M[k]) continue;
        c2v[k] = nv; v2c[nv] = k;
        var o = nv * 3;
        pos[o] = ox + i * px;
        pos[o + 1] = H[k] + yOffset;
        pos[o + 2] = oz + j * pz;

        // 高さ場の中央差分から法線を作る。computeVertexNormals より速く、
        // 単一値関数なのでこれが正しい滑らかな法線になる。
        var h0 = H[k];
        var hL = (i > 0 && M[k - 1]) ? H[k - 1] : h0;
        var hR = (i < nx - 1 && M[k + 1]) ? H[k + 1] : h0;
        var hD = (j > 0 && M[k - nx]) ? H[k - nx] : h0;
        var hU = (j < nz - 1 && M[k + nx]) ? H[k + nx] : h0;
        var dx = (hR - hL) * inv2px;
        var dz = (hU - hD) * inv2pz;
        var nlen = Math.sqrt(dx * dx + 1 + dz * dz);
        nrm[o] = -dx / nlen; nrm[o + 1] = 1 / nlen; nrm[o + 2] = -dz / nlen;

        colorFn(k, i, j, rgb);
        col[o] = rgb[0]; col[o + 1] = rgb[1]; col[o + 2] = rgb[2];
        nv++;
      }
    }

    /* 三角形。4隅すべてが足内なら2枚、3隅なら1枚。
       3隅のケースを拾うことで縁のギザつきが減る。 */
    var ni = 0;
    for (j = 0; j < nz - 1; j++) {
      for (i = 0; i < nx - 1; i++) {
        var a = c2v[j * nx + i], b = c2v[j * nx + i + 1];
        var c = c2v[(j + 1) * nx + i], d = c2v[(j + 1) * nx + i + 1];
        var cnt = (a >= 0 ? 1 : 0) + (b >= 0 ? 1 : 0) + (c >= 0 ? 1 : 0) + (d >= 0 ? 1 : 0);
        if (cnt === 4) {
          idx[ni++] = a; idx[ni++] = c; idx[ni++] = b;
          idx[ni++] = b; idx[ni++] = c; idx[ni++] = d;
        } else if (cnt === 3) {
          if (a < 0) { idx[ni++] = b; idx[ni++] = c; idx[ni++] = d; }
          else if (b < 0) { idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
          else if (c < 0) { idx[ni++] = a; idx[ni++] = d; idx[ni++] = b; }
          else { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; }
        }
      }
    }

    this.geom.attributes.position.updateRange = { offset: 0, count: nv * 3 };
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;
    this.geom.attributes.color.needsUpdate = true;
    this.geom.index.needsUpdate = true;
    this.geom.setDrawRange(0, ni);
    this.geom.computeBoundingSphere();
    this.vertexCount = nv;
    this.indexCount = ni;
  };
  FT.FieldMesh = FieldMesh;

  /* ------------------------------------------------------------------ *
   * 閉じた立体の足 → BufferGeometry（SPEC §4-6）
   * 断面リングを z 方向につないだ筒。両端はリングが 1 点近くまで縮んで閉じる。
   * 巻き順と法線をそろえてあるので FrontSide で描け、内側が透けない。
   * ------------------------------------------------------------------ */
  function SolidMesh(maxRows, NC, material) {
    var maxV = maxRows * NC;
    this.NC = NC;
    this.col = new Float32Array(maxV * 3);
    this.idx = new Uint32Array((maxRows - 1) * NC * 6);
    var g = new THREE.BufferGeometry();
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.geom = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.built = null;
  }

  /* soleColor(cellIndex, out) が足底側の色を返す。甲側は skin 一色。 */
  SolidMesh.prototype.update = function (S, soleColor, skin, yLift) {
    var nz = S.nz, NC = S.NC, nV = S.nV;
    var pos = S.pos, nrm = S.nrm, col = this.col, idx = this.idx;
    var j, c, k, o, rgb = [0, 0, 0];

    /* 位置属性は buildSolid の配列をそのまま参照する。
       毎回コピーすると 16k 頂点ぶんの転記が無駄になる。 */
    if (this.built !== S.pos) {
      this.geom.setAttribute("position", new THREE.BufferAttribute(S.pos, 3));
      this.geom.setAttribute("normal", new THREE.BufferAttribute(S.nrm, 3));
      this.built = S.pos;
    }
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;

    /* 法線：周方向と長さ方向の接ベクトルの外積。
       外向きになる順（t_c × t_j）に取ってある。 */
    for (j = 0; j < nz; j++) {
      var jm = (j > 0 ? j - 1 : j) * NC, jp = (j < nz - 1 ? j + 1 : j) * NC;
      var base = j * NC;
      for (c = 0; c < NC; c++) {
        k = base + c; o = k * 3;
        var cm = base + (c === 0 ? NC - 1 : c - 1), cp = base + (c + 1) % NC;
        var ax = pos[cp * 3] - pos[cm * 3];
        var ay = pos[cp * 3 + 1] - pos[cm * 3 + 1];
        var az = pos[cp * 3 + 2] - pos[cm * 3 + 2];
        var bx = pos[(jp + c) * 3] - pos[(jm + c) * 3];
        var by = pos[(jp + c) * 3 + 1] - pos[(jm + c) * 3 + 1];
        var bz = pos[(jp + c) * 3 + 2] - pos[(jm + c) * 3 + 2];
        var nx2 = ay * bz - az * by;
        var ny2 = az * bx - ax * bz;
        var nz2 = ax * by - ay * bx;
        var ln = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2);
        if (ln < 1e-9) { nrm[o] = 0; nrm[o + 1] = S.isSole[k] ? -1 : 1; nrm[o + 2] = 0; }
        else { nrm[o] = nx2 / ln; nrm[o + 1] = ny2 / ln; nrm[o + 2] = nz2 / ln; }

        if (S.isSole[k]) soleColor(S.cell[k], k, rgb);
        else { rgb[0] = skin[0]; rgb[1] = skin[1]; rgb[2] = skin[2]; }
        col[o] = rgb[0]; col[o + 1] = rgb[1]; col[o + 2] = rgb[2];
      }
    }

    var ni = 0;
    for (j = 0; j < nz - 1; j++) {
      for (c = 0; c < NC; c++) {
        var c2 = (c + 1) % NC;
        var a = j * NC + c, b = j * NC + c2;
        var d = (j + 1) * NC + c, e = (j + 1) * NC + c2;
        idx[ni++] = a; idx[ni++] = b; idx[ni++] = d;
        idx[ni++] = b; idx[ni++] = e; idx[ni++] = d;
      }
    }

    this.mesh.position.y = yLift || 0;
    this.geom.attributes.color.needsUpdate = true;
    this.geom.index.needsUpdate = true;
    this.geom.setDrawRange(0, ni);
    this.geom.computeBoundingSphere();
    this.solid = S;
    this.vertexCount = nV;
  };

  /* ------------------------------------------------------------------ *
   * パラメトリック曲面 → BufferGeometry（インソール用 / SPEC §4-5）
   * 全頂点が有効なので穴もマスクもない。外形が標本点そのものになるため、
   * グリッド表現のような階段状の輪郭が出ない。
   * ------------------------------------------------------------------ */
  function ParamMesh(maxS, nW, material) {
    var maxV = maxS * nW;
    this.nW = nW;
    this.pos = new Float32Array(maxV * 3);
    this.nrm = new Float32Array(maxV * 3);
    this.col = new Float32Array(maxV * 3);
    this.idx = new Uint32Array((maxS - 1) * (nW - 1) * 6);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.geom = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  ParamMesh.prototype.update = function (ins) {
    var nS = ins.nS, nW = ins.nW;
    var pos = this.pos, nrm = this.nrm, col = this.col, idx = this.idx;
    var rgb = [0, 0, 0], j, t, k, o;

    for (j = 0; j < nS; j++) {
      for (t = 0; t < nW; t++) {
        k = j * nW + t; o = k * 3;
        pos[o] = ins.x[k]; pos[o + 1] = ins.top[k]; pos[o + 2] = ins.zRow[j];
        diffColor(ins.diff[k], CONST.INSOLE_RANGE, rgb);
        col[o] = rgb[0]; col[o + 1] = rgb[1]; col[o + 2] = rgb[2];
      }
    }

    // 法線は隣接標本の外積から。等間隔ではないので差分を直接使う。
    for (j = 0; j < nS; j++) {
      for (t = 0; t < nW; t++) {
        k = j * nW + t; o = k * 3;
        var jm = j > 0 ? k - nW : k, jp = j < nS - 1 ? k + nW : k;
        var tm = t > 0 ? k - 1 : k, tp = t < nW - 1 ? k + 1 : k;
        var ax = ins.x[tp] - ins.x[tm];
        var ay = ins.top[tp] - ins.top[tm];
        var bz = ins.zRow[j < nS - 1 ? j + 1 : j] - ins.zRow[j > 0 ? j - 1 : j];
        var bx = ins.x[jp] - ins.x[jm];
        var by = ins.top[jp] - ins.top[jm];
        // n = b × a （上向きになる向き）
        var nx2 = by * 0 - bz * ay;
        var ny2 = bz * ax - bx * 0;
        var nz2 = bx * ay - by * ax;
        var ln = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2) || 1;
        if (ny2 < 0) ln = -ln;
        nrm[o] = nx2 / ln; nrm[o + 1] = ny2 / ln; nrm[o + 2] = nz2 / ln;
      }
    }

    var ni = 0;
    for (j = 0; j < nS - 1; j++) {
      for (t = 0; t < nW - 1; t++) {
        var a = j * nW + t, b = a + 1, c = a + nW, d = c + 1;
        idx[ni++] = a; idx[ni++] = c; idx[ni++] = b;
        idx[ni++] = b; idx[ni++] = c; idx[ni++] = d;
      }
    }

    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;
    this.geom.attributes.color.needsUpdate = true;
    this.geom.index.needsUpdate = true;
    this.geom.setDrawRange(0, ni);
    this.geom.computeBoundingSphere();
  };

  /* ------------------------------------------------------------------ *
   * ラベルスプライト（SPEC §5-3 landmarkGroup は Sprite）
   * ------------------------------------------------------------------ */
  /* ラベルは canvas を焼いてテクスチャにするので 1枚あたり 1ms 近くかかる。
     同じ文字列は使い回す。使い回した材質は _clear で破棄させない。 */
  var labelCache = {};
  function labelSprite(text, color, heightMm) {
    var ck = text + "|" + color + "|" + heightMm;
    if (labelCache[ck]) {
      var sp2 = new THREE.Sprite(labelCache[ck].mat);
      sp2.scale.copy(labelCache[ck].scale);
      sp2.renderOrder = 20;
      sp2.userData.cached = true;
      return sp2;
    }
    var pad = 8, fs = 34;
    var cv = document.createElement("canvas");
    var ctx = cv.getContext("2d");
    ctx.font = "700 " + fs + "px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
    var w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    var h = fs + pad * 2;
    cv.width = w; cv.height = h;
    ctx = cv.getContext("2d");
    ctx.fillStyle = "rgba(244,245,242,0.92)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.font = "700 " + fs + "px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad, h / 2 + 1);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false
    }));
    var mm = heightMm || 9;
    sp.scale.set(mm * w / h, mm, 1);
    sp.renderOrder = 20;
    sp.userData.cached = true;
    labelCache[ck] = { mat: sp.material, scale: sp.scale.clone() };
    return sp;
  }

  /* ------------------------------------------------------------------ *
   * 自前 OrbitControls（r128 に同梱されないため / SPEC §7）
   * 球面座標で持ち、phi をクランプしてジンバルロックを避ける。
   * ------------------------------------------------------------------ */
  function Orbit(camera, dom, target) {
    this.cam = camera; this.dom = dom;
    this.target = target.clone();
    this.theta = -0.62; this.phi = 0.78; this.radius = CONST.CAM.initDist;
    this.enabled = true;
    var self = this, mode = 0, px = 0, py = 0;

    function apply() {
      self.phi = FT.clamp(self.phi, 0.02, Math.PI - 0.02);
      self.radius = FT.clamp(self.radius, CONST.CAM.minDist, CONST.CAM.maxDist);
      var sp = Math.sin(self.phi), cp = Math.cos(self.phi);
      self.cam.position.set(
        self.target.x + self.radius * sp * Math.sin(self.theta),
        self.target.y + self.radius * cp,
        self.target.z + self.radius * sp * Math.cos(self.theta)
      );
      self.cam.up.set(0, 1, 0);
      self.cam.lookAt(self.target);
    }
    this.apply = apply;

    function pan(dx, dy) {
      var d = self.radius / 420;
      var right = new THREE.Vector3().setFromMatrixColumn(self.cam.matrix, 0);
      var up = new THREE.Vector3().setFromMatrixColumn(self.cam.matrix, 1);
      self.target.addScaledVector(right, -dx * d);
      self.target.addScaledVector(up, dy * d);
      apply();
    }

    dom.addEventListener("mousedown", function (e) {
      if (!self.enabled) return;
      mode = (e.button === 2 || e.shiftKey) ? 2 : 1;
      px = e.clientX; py = e.clientY;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!mode) return;
      var dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      if (mode === 1) { self.theta -= dx * 0.0075; self.phi -= dy * 0.0075; apply(); }
      else pan(dx, dy);
    });
    window.addEventListener("mouseup", function () { mode = 0; });
    dom.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    dom.addEventListener("wheel", function (e) {
      if (!self.enabled) return;
      e.preventDefault();
      self.radius *= Math.pow(1.0015, e.deltaY);
      apply();
    }, { passive: false });

    var tPrev = null, tDist = 0;
    dom.addEventListener("touchstart", function (e) {
      if (e.touches.length === 1) { tPrev = [e.touches[0].clientX, e.touches[0].clientY]; }
      else if (e.touches.length === 2) {
        tDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
        tPrev = [(e.touches[0].clientX + e.touches[1].clientX) / 2,
                 (e.touches[0].clientY + e.touches[1].clientY) / 2];
      }
    }, { passive: true });
    dom.addEventListener("touchmove", function (e) {
      if (!self.enabled || !tPrev) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        var dx = e.touches[0].clientX - tPrev[0], dy = e.touches[0].clientY - tPrev[1];
        tPrev = [e.touches[0].clientX, e.touches[0].clientY];
        self.theta -= dx * 0.008; self.phi -= dy * 0.008; apply();
      } else if (e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
        var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (tDist > 0) self.radius *= tDist / Math.max(d, 1);
        pan(cx - tPrev[0], cy - tPrev[1]);
        tDist = d; tPrev = [cx, cy];
      }
    }, { passive: false });
    dom.addEventListener("touchend", function () { tPrev = null; tDist = 0; }, { passive: true });

    apply();
  }

  /* ------------------------------------------------------------------ *
   * Viewer 本体
   * ------------------------------------------------------------------ */
  function Viewer(container) {
    var self = this;
    this.container = container;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(CONST.COL.bg3d);
    this.scene = scene;

    var cam = new THREE.PerspectiveCamera(38, 1, 1, 4000);
    this.camera = cam;

    // preserveDrawingBuffer は画像の書き出し（SPEC §10-2）に要る。
    // 常時 true は描画コストが上がるが、店頭端末の解像度では実測で誤差の範囲。
    var rend = new THREE.WebGLRenderer({
      antialias: true, alpha: false, preserveDrawingBuffer: true });
    rend.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rend.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(rend.domElement);
    this.renderer = rend;

    /* footRoot は undo/store の対象、ctxRoot は対象外（SPEC §5-3, CLAUDE.md 規約7） */
    this.footRoot = new THREE.Group();
    this.ctxRoot = new THREE.Group();
    scene.add(this.footRoot);
    scene.add(this.ctxRoot);

    // ライト（ctxRoot 配下）
    /* 立体になったので、面の向きが読めるだけの陰影が要る。
       環境光を落として主光源を立て、床からの照り返しを半球光で足す。 */
    this.ctxRoot.add(new THREE.AmbientLight(0xffffff, 0.22));
    this.ctxRoot.add(new THREE.HemisphereLight(0xF2F4F0, 0xA9B0A6, 0.34));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.62); d1.position.set(-210, 360, 190);
    var d2 = new THREE.DirectionalLight(0xffffff, 0.26); d2.position.set(260, 130, -240);
    // 底面ビューで足裏を読ませるための下からの光。立体化して初めて必要になった。
    var d3 = new THREE.DirectionalLight(0xffffff, 0.52); d3.position.set(70, -240, 60);
    this.ctxRoot.add(d1); this.ctxRoot.add(d2); this.ctxRoot.add(d3);

    // 床グリッドとスケールバー
    this.floorGrid = new THREE.GridHelper(600, 30, 0xC6CCC4, 0xDCE0DA);
    this.floorGrid.position.y = -0.4;
    this.ctxRoot.add(this.floorGrid);
    this.scaleBar = this._makeScaleBar();
    this.ctxRoot.add(this.scaleBar);

    // 足の立体（L0）。閉じた面なので FrontSide で描く
    var matFoot = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.FrontSide, shininess: 22,
      specular: 0x3a3d38, transparent: true, opacity: 1
    });
    this.matFoot = matFoot;
    this.footMesh = new SolidMesh(CONST.NZ, CONST.SOLID_NB + CONST.SOLID_NT - 2, matFoot);
    this.footRoot.add(this.footMesh.mesh);

    // 等高線（L1）。主曲線 72% / 副曲線 36%（SPEC §8）
    this.contourMajor = new RibbonMesh(24000, CONST.COL.ink, 0.72);
    this.contourMinor = new RibbonMesh(24000, CONST.COL.ink, 0.36);
    this.contourGroup = new THREE.Group();
    this.contourGroup.add(this.contourMajor.mesh);
    this.contourGroup.add(this.contourMinor.mesh);
    this.footRoot.add(this.contourGroup);

    // 経年の過去輪郭（L7 の補助）
    this.driftLines = this._makeLines(CONST.COL.teal, 0.55, 1);
    this.driftGroup = new THREE.Group();
    this.driftGroup.add(this.driftLines.obj);
    this.footRoot.add(this.driftGroup);

    this.landmarkGroup = new THREE.Group(); this.footRoot.add(this.landmarkGroup);
    this.complaintGroup = new THREE.Group(); this.footRoot.add(this.complaintGroup);
    this.rxGroup = new THREE.Group(); this.footRoot.add(this.rxGroup);

    // インソール（L9）
    var matIns = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide, shininess: 3, specular: 0x121212
    });
    this.matInsole = matIns;
    this.insoleTop = new ParamMesh(CONST.NZ + 32, 64, matIns);
    // 側面・底面の帯の分割数の上限（長さ方向のサンプル数ぶん）
    var maxRim = 2 * (CONST.NZ + 32);
    var leather = function () {
      return new THREE.MeshPhongMaterial({
        color: CONST.COL.leather, side: THREE.DoubleSide, shininess: 2 });
    };
    this.insoleSkirt = new RimMesh(maxRim, leather());
    this.insoleBottom = new RimMesh(maxRim, leather());
    this.insoleGroup = new THREE.Group();
    this.insoleGroup.add(this.insoleTop.mesh);
    this.insoleGroup.add(this.insoleBottom.mesh);
    this.insoleGroup.add(this.insoleSkirt.mesh);
    this.footRoot.add(this.insoleGroup);

    // 断面の位置を示すリング
    this.sectionRing = new THREE.Line(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: new THREE.Color(CONST.COL.brass),
        transparent: true, opacity: 0.95, depthTest: false }));
    this.sectionRing.renderOrder = 24;
    this.sectionRing.frustumCulled = false;
    this.footRoot.add(this.sectionRing);

    // ピン（クリックで留めた点）
    this.pinGroup = new THREE.Group(); this.footRoot.add(this.pinGroup);
    this.pins = [];

    this.controls = new Orbit(cam, rend.domElement, new THREE.Vector3(0, 12, 125));
    this.raycaster = new THREE.Raycaster();

    this.resize();
    window.addEventListener("resize", function () { self.resize(); });
  }

  Viewer.prototype._makeScaleBar = function () {
    var g = new THREE.Group();
    var mat = new THREE.LineBasicMaterial({ color: 0x8A959C });
    var pts = [], i;
    // 50mm 刻みの目盛。外側に置いて足の邪魔をしない位置にする。
    for (i = 0; i <= 6; i++) {
      var z = i * 50;
      pts.push(new THREE.Vector3(-110, 0.2, z), new THREE.Vector3(i % 2 === 0 ? -122 : -116, 0.2, z));
    }
    pts.push(new THREE.Vector3(-110, 0.2, 0), new THREE.Vector3(-110, 0.2, 300));
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.LineSegments(geo, mat));
    var lab = labelSprite("50mm", "#8A959C", 11);
    lab.position.set(-142, 0.5, 25);
    g.add(lab);
    return g;
  };

  /* 等高線はリボン（XZ 平面の帯）で描く。
     WebGL の LineBasicMaterial は linewidth が効かず常に 1px になるため、
     店頭の大画面では線が消える。帯なら太さを mm で指定でき、
     ズームに追従して等高線図らしい見え方になる。 */
  function RibbonMesh(maxSegs, color, opacity) {
    this.pos = new Float32Array(maxSegs * 6 * 3);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setDrawRange(0, 0);
    this.geom = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: new THREE.Color(color), transparent: true, opacity: opacity,
      side: THREE.DoubleSide, depthWrite: false
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
  }
  /* polylines: [{ level, pts:[[x,z],...] }, ...] */
  RibbonMesh.prototype.fill = function (polylines, halfW, yOff) {
    var p = this.pos, n = 0, cap = p.length;
    for (var a = 0; a < polylines.length; a++) {
      var pl = polylines[a], pts = pl.pts, y = pl.level + yOff;
      for (var i = 0; i < pts.length - 1; i++) {
        if (n + 18 > cap) break;
        var x0 = pts[i][0], z0 = pts[i][1], x1 = pts[i + 1][0], z1 = pts[i + 1][1];
        var dx = x1 - x0, dz = z1 - z0, ln = Math.sqrt(dx * dx + dz * dz);
        if (ln < 1e-9) continue;
        var ox = -dz / ln * halfW, oz = dx / ln * halfW;
        p[n] = x0 - ox; p[n + 1] = y; p[n + 2] = z0 - oz;
        p[n + 3] = x1 - ox; p[n + 4] = y; p[n + 5] = z1 - oz;
        p[n + 6] = x0 + ox; p[n + 7] = y; p[n + 8] = z0 + oz;
        p[n + 9] = x1 - ox; p[n + 10] = y; p[n + 11] = z1 - oz;
        p[n + 12] = x1 + ox; p[n + 13] = y; p[n + 14] = z1 + oz;
        p[n + 15] = x0 + ox; p[n + 16] = y; p[n + 17] = z0 + oz;
        n += 18;
      }
    }
    this.geom.attributes.position.needsUpdate = true;
    this.geom.setDrawRange(0, n / 3);
    this.geom.computeBoundingSphere();
  };

  Viewer.prototype._makeLines = function (color, opacity, width) {
    var buf = new Float32Array(240000);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color), transparent: true, opacity: opacity, linewidth: width
    });
    var obj = new THREE.LineSegments(geo, mat);
    obj.frustumCulled = false;
    return { buf: buf, geom: geo, obj: obj };
  };

  Viewer.prototype._fillLines = function (holder, polylines, yFn) {
    var buf = holder.buf, n = 0;
    for (var a = 0; a < polylines.length; a++) {
      var pl = polylines[a], pts = pl.pts || pl;
      var y = yFn(pl);
      for (var i = 0; i < pts.length - 1; i++) {
        if (n + 6 > buf.length) break;
        buf[n++] = pts[i][0]; buf[n++] = y; buf[n++] = pts[i][1];
        buf[n++] = pts[i + 1][0]; buf[n++] = y; buf[n++] = pts[i + 1][1];
      }
    }
    holder.geom.attributes.position.needsUpdate = true;
    holder.geom.setDrawRange(0, n / 3);
    holder.geom.computeBoundingSphere();
  };

  Viewer.prototype.resize = function () {
    var w = this.container.clientWidth, h = this.container.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // updateStyle を切ると canvas の CSS 幅が古いまま残り、
    // 狭い画面で横スクロールが出る。必ず style も更新させる。
    this.renderer.setSize(w, h);
  };

  /* ---------------- レイヤ状態 ---------------- */
  Viewer.prototype.setLayers = function (L) { this.layers = L; };

  /* サーフェスの色を決めるレイヤの優先順位。
     複数の色レイヤが同時に ON でも1つに決まるようにする（凡例に表示する）。 */
  Viewer.prototype.activeColorLayer = function () {
    var L = this.layers;
    if (L.L7_drift) return "L7_drift";
    if (L.L8_cohort) return "L8_cohort";
    if (L.L4_pressure) return "L4_pressure";
    if (L.L2_height) return "L2_height";
    return null;
  };

  /* ---------------- 更新 ---------------- *
   * st = { grid, insole, metrics, landmarks, complaints, prescriptions,
   *        pastGrid, meanGrid, pressure }
   */
  Viewer.prototype.update = function (st) {
    var L = this.layers, self = this;
    this.state = st;
    var grid = st.grid;
    var mode = this.activeColorLayer();
    var pressure = st.pressure;
    var past = st.pastGrid, mean = st.meanGrid;
    var flat = hexToRgb(SOLE_NEUTRAL);

    // L9 が ON のときは足をインソールの厚みぶん持ち上げて、上に載せて見せる
    var lift = L.L9_insole ? CONST.INSOLE.BASE_THICK : 0;
    this.footLift = lift;

    this.footMesh.update(st.solid, function (k, vi, out) {
      if (mode === "L2_height") return RAMP.height(grid.height[k] / HEIGHT_RANGE, out);
      if (mode === "L4_pressure") return RAMP.pressure(pressure[k], out);
      if (mode === "L7_drift") {
        var hp = (past && past.mask[k]) ? past.height[k] : grid.height[k];
        return diffColor(grid.height[k] - hp, CONST.DRIFT_RANGE, out);
      }
      if (mode === "L8_cohort") {
        var hm = (mean && mean.mask[k]) ? mean.height[k] : grid.height[k];
        return diffColor(grid.height[k] - hm, CONST.DIFF_RANGE, out);
      }
      out[0] = flat[0]; out[1] = flat[1]; out[2] = flat[2];
      return out;
    }, SKIN_RGB, lift);

    this.footMesh.mesh.visible = !!L.L0_surface;
    // L9 が ON のとき L0 は半透明にする。消さずに関係を見せる（SPEC §6）
    this.matFoot.opacity = L.L9_insole ? 0.30 : 1.0;
    this.matFoot.depthWrite = !L.L9_insole;
    // 等高線・ランドマーク等は足底面に載っているので、足と一緒に持ち上げる
    this.contourGroup.position.y = lift;
    this.landmarkGroup.position.y = lift;
    this.complaintGroup.position.y = lift;
    this.driftGroup.position.y = lift;

    /* --- L1 等高線 --- */
    this.contourGroup.visible = !!L.L1_contour;
    if (L.L1_contour) {
      var cs = st.contours || FT.contours(grid);
      // 等高線の生成はスクラブ中に間引いてある。同じ結果なら詰め直しも省く。
      if (cs !== this._lastContours) {
        var maj = [], min = [], c;
        for (c = 0; c < cs.length; c++) (cs[c].major ? maj : min).push(cs[c]);
        // 足底面は立体の「外側が下向き」の面なので、等高線は面の下に置く。
        // 上に置くと足の内部に入ってしまい、底面ビューで隠れる。
        this.contourMajor.fill(maj, CONTOUR_W.major, -0.35);
        this.contourMinor.fill(min, CONTOUR_W.minor, -0.35);
        this._lastContours = cs;
      }
    }

    /* --- L3 / L5 / L6 のオーバーレイ ---
       ラベルは Sprite ごとに canvas テクスチャを作り直すので、毎フレーム
       組み直すとスクラブ中のフレーム予算を食い潰す。st.fast のときは
       前フレームの内容を据え置く（最大 90ms のラグ。等高線と同じ扱い）。 */
    var rebuildOverlays = !st.fast;

    /* --- L3 ランドマーク --- */
    this.landmarkGroup.visible = !!L.L3_landmark;
    if (rebuildOverlays) this._clear(this.landmarkGroup);
    if (L.L3_landmark && rebuildOverlays) {
      var LMJP = {
        pternion: "踵後端", acropodion: "趾先", metatarsale_tib: "母趾側",
        metatarsale_fib: "小趾側", navicular: "土踏まずの基準", sphyrion: "内くるぶし"
      };
      // 引き出し線の高さを点ごとに変えて、ラベルの重なりを避ける
      var LMH = {
        pternion: 26, acropodion: 26, metatarsale_tib: 40,
        metatarsale_fib: 54, navicular: 30, sphyrion: 46
      };
      var lm = st.landmarks, key;
      var leadMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(CONST.COL.brass), transparent: true, opacity: 0.75 });
      for (key in lm) {
        if (!lm.hasOwnProperty(key)) continue;
        var pt = lm[key], lh = LMH[key] || 30;
        var ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 5.2, 24),
          new THREE.MeshBasicMaterial({ color: CONST.COL.brass, side: THREE.DoubleSide,
            transparent: true, opacity: 0.9, depthTest: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pt[0], pt[1] + 0.8, pt[2]);
        ring.renderOrder = 14;
        this.landmarkGroup.add(ring);
        var dot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10),
          new THREE.MeshBasicMaterial({ color: CONST.COL.brass, depthTest: false }));
        dot.position.set(pt[0], pt[1] + 0.8, pt[2]);
        dot.renderOrder = 14;
        this.landmarkGroup.add(dot);
        var lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(pt[0], pt[1] + 1, pt[2]),
          new THREE.Vector3(pt[0], pt[1] + lh, pt[2])
        ]), leadMat);
        lead.renderOrder = 14;
        this.landmarkGroup.add(lead);
        var sp = labelSprite(LMJP[key] || key, "#A8851C", 11);
        sp.position.set(pt[0], pt[1] + lh + 6, pt[2]);
        this.landmarkGroup.add(sp);
      }
    }

    /* --- L5 主訴 --- */
    this.complaintGroup.visible = !!L.L5_complaint;
    if (rebuildOverlays) this._clear(this.complaintGroup);
    if (L.L5_complaint && rebuildOverlays) {
      var msign = FT.medialSign(grid.side);
      for (var q = 0; q < st.complaints.length; q++) {
        var cp = st.complaints[q];
        var P = FT.COMPLAINT_POS[cp.region];
        if (!P) continue;
        var ux = (msign < 0 ? P.u : -P.u) * CONST.U_TO_LEN * grid.params.length;
        var uz = P.v * grid.params.length;
        var r = 10 + cp.severity * 3.5;
        var y0 = this._heightAtWorld(grid, ux, uz);
        // 塗りつぶした円＋輪郭。細い輪だけだと店頭の画面で見落とされる。
        var disc = new THREE.Mesh(new THREE.CircleGeometry(r, 36),
          new THREE.MeshBasicMaterial({ color: CONST.COL.alert, transparent: true,
            opacity: 0.30, side: THREE.DoubleSide, depthTest: false }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(ux, y0 + 1.2, uz);
        disc.renderOrder = 12;
        this.complaintGroup.add(disc);
        var ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 36),
          new THREE.MeshBasicMaterial({ color: CONST.COL.alert, transparent: true,
            opacity: 0.95, side: THREE.DoubleSide, depthTest: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(ux, y0 + 1.4, uz);
        ring.renderOrder = 13;
        this.complaintGroup.add(ring);
        var lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ux, y0 + 1.4, uz), new THREE.Vector3(ux, y0 + 34, uz)
        ]), new THREE.LineBasicMaterial({ color: new THREE.Color(CONST.COL.alert) }));
        lead.renderOrder = 13;
        this.complaintGroup.add(lead);
        var lb = labelSprite(P.label + " 強さ" + cp.severity, "#A63A2B", 11);
        lb.position.set(ux, y0 + 40, uz);
        this.complaintGroup.add(lb);
      }
    }

    /* --- L6 処方 --- */
    this.rxGroup.visible = !!L.L6_rx;
    if (rebuildOverlays) this._clear(this.rxGroup);
    if (L.L6_rx && rebuildOverlays) {
      // ArrowHelper の軸は 1px の線で、店頭の画面では見えない。
      // 太さを持つ円柱＋円錐で描く。
      var brass = new THREE.MeshPhongMaterial({
        color: CONST.COL.brass, shininess: 20, depthTest: false });
      for (var r2 = 0; r2 < st.prescriptions.length; r2++) {
        var rx = st.prescriptions[r2];
        var an = FT.rxAnchor(grid, rx);
        if (!an) continue;
        var len = Math.max(rx.lift_mm * 4.0, 16);
        var head = len * 0.34, shaft = len - head;
        var K = FT.INSOLE_KERNEL[rx.landmark];

        // 補正が効く範囲を床面の円で示す
        var foot = new THREE.Mesh(
          new THREE.RingGeometry(0, K.su * CONST.U_TO_LEN * grid.params.length, 32),
          new THREE.MeshBasicMaterial({ color: CONST.COL.brass, transparent: true,
            opacity: 0.16, side: THREE.DoubleSide, depthTest: false }));
        foot.rotation.x = -Math.PI / 2;
        foot.position.set(an[0], an[1] + 0.5, an[2]);
        foot.renderOrder = 15;
        this.rxGroup.add(foot);

        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, shaft, 14), brass);
        cyl.position.set(an[0], an[1] + 1 + shaft / 2, an[2]);
        cyl.renderOrder = 16;
        this.rxGroup.add(cyl);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(4.6, head, 16), brass);
        cone.position.set(an[0], an[1] + 1 + shaft + head / 2, an[2]);
        cone.renderOrder = 16;
        this.rxGroup.add(cone);

        var lab2 = labelSprite("+" + rx.lift_mm.toFixed(1) + "mm", "#A8851C", 11);
        lab2.position.set(an[0], an[1] + len + 10, an[2]);
        this.rxGroup.add(lab2);
      }
    }

    /* --- L7 過去の輪郭 --- */
    this.driftGroup.visible = !!L.L7_drift;
    if (L.L7_drift && past) {
      // 比較対象のグリッドは変わらないので、外形線の抽出結果を持たせておく
      if (!past.__outline) past.__outline = FT.outline(past);
      if (this._lastDrift !== past) {
        this._fillLines(this.driftLines, past.__outline, function () { return -0.6; });
        this._lastDrift = past;
      }
    }

    /* --- L9 インソール ---
       インソールの生成自体を間引いてあるので、同じオブジェクトが来たら
       3枚のメッシュを組み直す必要もない。 */
    this.insoleGroup.visible = !!L.L9_insole;
    if (L.L9_insole && st.insole && st.insole !== this._lastInsole) {
      this._updateInsole(st.insole);
      this._lastInsole = st.insole;
    }

    // 描画の投げ込みだけ別に測る。SwiftShader ではここがソフトウェア
    // ラスタライズを含んで大きく出るため、JS 側の予算と混ぜない。
    var tr = performance.now();
    this.render();
    this.lastRenderMs = performance.now() - tr;
  };

  /* 側面スカートと底面は外形線から作る。
     どちらも頂点数が外形の長さで決まるので、上限ぶんを一度確保して
     以後は詰め直すだけにする。毎フレーム BufferAttribute を作り直すと
     GPU への再アップロードが走り、スクラブが目に見えて重くなる。 */
  function RimMesh(maxSegs, material) {
    this.pos = new Float32Array(maxSegs * 6 * 3);
    this.nrm = new Float32Array(maxSegs * 6 * 3);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
    g.setDrawRange(0, 0);
    this.geom = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }
  RimMesh.prototype.commit = function (nVerts) {
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;
    this.geom.setDrawRange(0, nVerts);
    this.geom.computeBoundingSphere();
  };

  Viewer.prototype._updateInsole = function (ins) {
    this.insoleTop.update(ins);

    /* 側面と底面は t = ±1 の縁の列から作る。上面と同じ標本点を使うので
       継ぎ目が開かない。 */
    var nS = ins.nS, nW = ins.nW;
    var sp = this.insoleSkirt.pos, sn = this.insoleSkirt.nrm, sv = 0;
    var bp = this.insoleBottom.pos, bn = this.insoleBottom.nrm, bv = 0;
    var j, q, side, s, b;

    for (side = 0; side < 2; side++) {
      var col = side === 0 ? 0 : nW - 1;
      for (j = 0; j < nS - 1; j++) {
        var k0 = j * nW + col, k1 = (j + 1) * nW + col;
        var x0 = ins.x[k0], z0 = ins.zRow[j], h0 = ins.top[k0];
        var x1 = ins.x[k1], z1 = ins.zRow[j + 1], h1 = ins.top[k1];
        var dx = x1 - x0, dz = z1 - z0;
        var ln = Math.hypot(dx, dz) || 1;
        // 外向き法線。col=0 側と col=nW-1 側で向きが逆になる
        var sgn = side === 0 ? -1 : 1;
        var nx2 = sgn * dz / ln, nz2 = -sgn * dx / ln;
        if (sv * 3 + 18 > sp.length) break;
        s = sv * 3;
        sp[s] = x0; sp[s + 1] = 0; sp[s + 2] = z0;
        sp[s + 3] = x1; sp[s + 4] = 0; sp[s + 5] = z1;
        sp[s + 6] = x0; sp[s + 7] = h0; sp[s + 8] = z0;
        sp[s + 9] = x1; sp[s + 10] = 0; sp[s + 11] = z1;
        sp[s + 12] = x1; sp[s + 13] = h1; sp[s + 14] = z1;
        sp[s + 15] = x0; sp[s + 16] = h0; sp[s + 17] = z0;
        for (q = 0; q < 6; q++) {
          sn[s + q * 3] = nx2; sn[s + q * 3 + 1] = 0; sn[s + q * 3 + 2] = nz2;
        }
        sv += 6;
      }
    }

    // 底面：床に接する平面。左右の縁を結ぶ帯で埋める。
    for (j = 0; j < nS - 1; j++) {
      var a0 = j * nW, a1 = j * nW + nW - 1;
      var c0 = (j + 1) * nW, c1 = (j + 1) * nW + nW - 1;
      if (bv * 3 + 18 > bp.length) break;
      b = bv * 3;
      var zA = ins.zRow[j], zB = ins.zRow[j + 1];
      bp[b] = ins.x[a0]; bp[b + 1] = 0; bp[b + 2] = zA;
      bp[b + 3] = ins.x[a1]; bp[b + 4] = 0; bp[b + 5] = zA;
      bp[b + 6] = ins.x[c0]; bp[b + 7] = 0; bp[b + 8] = zB;
      bp[b + 9] = ins.x[a1]; bp[b + 10] = 0; bp[b + 11] = zA;
      bp[b + 12] = ins.x[c1]; bp[b + 13] = 0; bp[b + 14] = zB;
      bp[b + 15] = ins.x[c0]; bp[b + 16] = 0; bp[b + 17] = zB;
      // 底面は床向き。巻き順に依存させないよう法線を直接与え、材質は両面。
      for (q = 0; q < 6; q++) {
        bn[b + q * 3] = 0; bn[b + q * 3 + 1] = -1; bn[b + q * 3 + 2] = 0;
      }
      bv += 6;
    }

    this.insoleSkirt.commit(sv);
    this.insoleBottom.commit(bv);
  };

  Viewer.prototype._heightAtWorld = function (grid, x, z) {
    var i = Math.round((x - grid.origin[0]) / grid.pitch_x);
    var j = Math.round((z - grid.origin[2]) / grid.pitch_z);
    i = FT.clamp(i, 0, grid.nx - 1); j = FT.clamp(j, 0, grid.nz - 1);
    var k = j * grid.nx + i;
    return grid.mask[k] ? grid.height[k] : 0;
  };

  Viewer.prototype._clear = function (g) {
    while (g.children.length) {
      var c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      // キャッシュ済みのラベル材質は他のフレームでも使い回すので破棄しない
      if (c.material && !c.userData.cached) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    }
  };

  /* ---------------- ピッキング（SPEC §7-1） ----------------
     face.a から vertexToCell で (i,j) を逆算する。
     交差点座標からの逆算はグリッド境界で誤差が出るので使わない。 */
  Viewer.prototype.pick = function (clientX, clientY) {
    if (!this.state) return null;
    var r = this.renderer.domElement.getBoundingClientRect();
    var m = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(m, this.camera);
    var hits = this.raycaster.intersectObject(this.footMesh.mesh, false);
    if (!hits.length || !hits[0].face) return null;
    var S = this.footMesh.solid;
    var vi = hits[0].face.a;
    var grid = this.state.grid;
    var cell = S.cell[vi];
    var i = cell % grid.nx, j = Math.floor(cell / grid.nx);
    return {
      vertex: vi, cell: cell, i: i, j: j,
      sole: !!S.isSole[vi],
      u: S.uu[vi], v: S.vv[vi],
      // 立体の標本点そのものの高さを返す。セル中心の値ではないので、
      // 断面リング上のどこを指したかが 0.05mm 未満の誤差で読み出せる。
      height: S.hgt[vi],
      world: [S.pos[vi * 3], S.pos[vi * 3 + 1] + this.footLift, S.pos[vi * 3 + 2]]
    };
  };

  Viewer.prototype.addPin = function (hit) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: CONST.COL.alert, depthTest: false }));
    m.position.set(hit.world[0], hit.world[1] + 1, hit.world[2]);
    m.renderOrder = 22;
    this.pinGroup.add(m);
    this.pins.push(hit);
    if (this.pins.length > 4) { this.pins.shift(); this.pinGroup.remove(this.pinGroup.children[0]); }
    this.render();
    return this.pins;
  };

  Viewer.prototype.clearPins = function () {
    this._clear(this.pinGroup);
    this.pins = [];
    this.render();
  };

  /* ---------------- 定型ビュー（SPEC §7） ---------------- */
  Viewer.prototype.setView = function (name, side) {
    var c = this.controls;
    var medialIsMinusX = (FT.medialSign(side || "R") < 0);
    if (name === "T") { c.theta = 0; c.phi = 0.05; }
    else if (name === "B") { c.theta = 0; c.phi = Math.PI - 0.05; }
    else if (name === "M") { c.theta = medialIsMinusX ? -Math.PI / 2 : Math.PI / 2; c.phi = Math.PI / 2 - 0.06; }
    else if (name === "L") { c.theta = medialIsMinusX ? Math.PI / 2 : -Math.PI / 2; c.phi = Math.PI / 2 - 0.06; }
    else { c.theta = -0.62; c.phi = 0.78; c.radius = CONST.CAM.initDist;
           c.target.set(0, 12, (this.state ? this.state.grid.params.length : 250) / 2); }
    c.apply();
    this.render();
  };

  /* パネルの断面と同じ位置を 3D 側にも示す。
     どこを切っているかが分からないと、断面図だけでは伝わらない。 */
  Viewer.prototype.setSectionRow = function (row) {
    var S = this.footMesh.solid;
    if (!S) return;
    this._sectionRow = row;
    row = FT.clamp(Math.round(row), 0, S.nz - 1);
    var pts = [], c;
    for (c = 0; c <= S.NC; c++) {
      var k = (row * S.NC + (c % S.NC)) * 3;
      pts.push(new THREE.Vector3(S.pos[k], S.pos[k + 1] + (this.footLift || 0), S.pos[k + 2]));
    }
    this.sectionRing.geometry.dispose();
    this.sectionRing.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.render();
  };

  Viewer.prototype.render = function () {
    // 床より下から見ているときは床グリッドを消す。
    // 残すと足裏の手前に線が重なって、等高線と見分けがつかなくなる。
    this.floorGrid.visible = this.camera.position.y > 0.5;
    this.scaleBar.visible = this.floorGrid.visible;
    this.renderer.render(this.scene, this.camera);
  };

  FT.Viewer = Viewer;
  FT.labelSprite = labelSprite;

})(typeof window !== "undefined" ? window : this);
