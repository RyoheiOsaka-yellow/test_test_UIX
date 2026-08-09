/* =========================================================
 * Studio3D — 3Dテクニカルビュー + POV (CineOS Phase 2 移植)
 * 依存ライブラリなしの自前パースペクティブ投影 (canvas 2D)。
 * 3D: 床グリッド / 被写体 / ライト光錐 / カメラ視野角フラスタム /
 *     被写界深度面 / ドローン / カメラワークの軌道パス+再生マーカー
 * POV: カメラ位置からレンズ画角で見る実尺プレビュー (再生でパス移動)
 * 座標系は canonical と同じ: +X=右, +Y=被写体後方, +Z=上 (m)
 * ======================================================= */

"use strict";

const S3D = {
  active: false,
  pov: false,
  yaw: 0.55, pitch: 0.42, dist: 13.5,
  target: [0, 0, 1.0],
  dragging: null,
  animT: null, // 再生中の 0..1 (app.js の再生ループが更新)
};

function s3dReset() { S3D.yaw = 0.55; S3D.pitch = 0.42; S3D.dist = 13.5; }

/* =========================================================
 * 簡易ライティングシェーディング (POV用 — Phase 3 の入口)
 * 色温度→RGB / ランバート面 / ビーム円錐 / 距離減衰
 * ======================================================= */
function kelvinToRGB(k) {
  k = Math.min(12000, Math.max(1500, k)) / 100;
  let r, g, b;
  r = k <= 66 ? 255 : 329.7 * Math.pow(k - 60, -0.1332);
  g = k <= 66 ? 99.47 * Math.log(k) - 161.12 : 288.12 * Math.pow(k - 60, -0.0755);
  b = k >= 66 ? 255 : k <= 19 ? 0 : 138.52 * Math.log(k - 10) - 305.04;
  const c = v => Math.min(255, Math.max(0, v));
  return [c(r), c(g), c(b)];
}

/* 灯の前計算 (位置/照射軸/ビーム/色) */
function s3dPrepareLights(cut, aim) {
  const out = [];
  for (const it of cut.items) {
    if (!LIGHT_TYPES.includes(it.type) || it.power <= 0) continue;
    const p = s3dItemWorld(it);
    const ax = [aim[0] - p[0], aim[1] - p[1], aim[2] - p[2]];
    const al = Math.hypot(...ax) || 1;
    const gel = (typeof GEL_RGB !== "undefined" && GEL_RGB[it.modifier]) || null;
    out.push({
      p, axis: ax.map(v => v / al),
      cosHalf: Math.cos(Math.min(60, (it.beamAngle ?? 60) / 2) * Math.PI / 180),
      power: it.power / 100,
      rgb: (gel || kelvinToRGB(it.colorTemp)).map(v => v / 255),
      isSun: it.type === "sun",
    });
  }
  return out;
}

/* 点+法線のシェーディング → [r,g,b] (0..1超えあり) */
function s3dShadePoint(pt, normal, lights) {
  let r = 0.10, g = 0.10, b = 0.12; // アンビエント
  for (const L of lights) {
    const toL = [L.p[0] - pt[0], L.p[1] - pt[1], L.p[2] - pt[2]];
    const d = Math.hypot(...toL) || 0.001;
    const dir = toL.map(v => v / d);
    let lam = 1;
    if (normal) {
      lam = dir[0] * normal[0] + dir[1] * normal[1] + dir[2] * normal[2];
      if (lam <= 0) continue;
    }
    // ビーム円錐: 灯の照射軸と「灯→この点」の角度
    let beam = 1;
    if (!L.isSun) {
      const cosA = -(dir[0] * L.axis[0] + dir[1] * L.axis[1] + dir[2] * L.axis[2]);
      if (cosA <= L.cosHalf) continue;
      beam = Math.pow((cosA - L.cosHalf) / (1 - L.cosHalf), 0.6);
    }
    const fall = L.isSun ? 0.9 : Math.min(1, 3.2 / (d * d));
    const I = L.power * lam * beam * fall * 1.6;
    r += I * L.rgb[0]; g += I * L.rgb[1]; b += I * L.rgb[2];
  }
  return [r, g, b];
}

function s3dShadedColor(albedo, light) {
  const c = (a, l) => Math.min(255, Math.round(a * l * 255));
  return `rgb(${c(albedo[0], light[0])},${c(albedo[1], light[1])},${c(albedo[2], light[2])})`;
}

/* 被写界深度 (mm系, 許容錯乱円 0.03mm フルサイズ) */
function computeDOF(focalMm, apertureF, focusM) {
  const f = focalMm, N = Math.max(0.7, apertureF), c = 0.03, s = focusM * 1000;
  const Hy = (f * f) / (N * c) + f;
  const near = (s * (Hy - f)) / (Hy + s - 2 * f) / 1000;
  const far = s >= Hy ? Infinity : (s * (Hy - f)) / (Hy - s) / 1000;
  return { near: Math.max(0.05, near), far };
}

function s3dItemWorld(it) {
  return [(it.x - SUBJECT_POS.x) / 100, (SUBJECT_POS.y - it.y) / 100, (it.height || 0) / 100];
}

/* 軸ベクトルの直交基底 */
function s3dBasis(axis) {
  const len = Math.hypot(...axis) || 1;
  const a = axis.map(v => v / len);
  let up = Math.abs(a[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const rt = [a[1] * up[2] - a[2] * up[1], a[2] * up[0] - a[0] * up[2], a[0] * up[1] - a[1] * up[0]];
  const rl = Math.hypot(...rt) || 1;
  const r = rt.map(v => v / rl);
  const u = [r[1] * a[2] - r[2] * a[1], r[2] * a[0] - r[0] * a[2], r[0] * a[1] - r[1] * a[0]];
  return { a, r, u, len };
}

/* =========================================================
 * カメラワーク → 3D軌道パス (サンプル点列)
 * ======================================================= */
function camPathPoints(cut, camW, aim) {
  const move = cut.camera.move;
  const { a, r, len } = s3dBasis([aim[0] - camW[0], aim[1] - camW[1], aim[2] - camW[2]]);
  const N = 40;
  const pts = [];
  const lerp = (fn) => { for (let i = 0; i <= N; i++) pts.push(fn(i / N)); return pts; };
  const along = (v, s) => [camW[0] + v[0] * s, camW[1] + v[1] * s, Math.max(0.15, camW[2] + v[2] * s)];
  const orbitR = Math.hypot(camW[0] - aim[0], camW[1] - aim[1]);
  const ang0 = Math.atan2(camW[1] - aim[1], camW[0] - aim[0]);
  const orbitPt = (th, z) => [aim[0] + orbitR * Math.cos(th), aim[1] + orbitR * Math.sin(th), z];

  switch (move) {
    case "dollyin": case "zoomin": return lerp(t => along(a, t * Math.min(len - 0.8, len * 0.55)));
    case "dollyout": return lerp(t => along(a, -t * len * 0.6));
    case "track": case "d_side": return lerp(t => along(r, (t - 0.5) * Math.min(6, len * 1.6)));
    case "slider": return lerp(t => along(r, (t - 0.5) * 1.0));
    case "arc": return lerp(t => orbitPt(ang0 + (t - 0.5) * 1.4, camW[2]));
    case "orbit": case "d_orbit": return lerp(t => orbitPt(ang0 + t * Math.PI * 2, camW[2]));
    case "d_spiral": return lerp(t => orbitPt(ang0 + t * Math.PI * 2, camW[2] + t * 2.5));
    case "crane": return lerp(t => along([a[0] * 0.3, a[1] * 0.3, 1], t * 2.2));
    case "pedestal": return lerp(t => [camW[0], camW[1], Math.max(0.2, camW[2] + (t - 0.5) * 1.6)]);
    case "d_reveal": return lerp(t => along([a[0] * 0.5, a[1] * 0.5, 1], t * 3));
    case "d_pullback": case "d_dronie": return lerp(t => along([-a[0], -a[1], 0.55], t * len * 0.9));
    case "d_flyover": case "d_lowpass": case "d_chase": case "d_gap":
      return lerp(t => along(a, (t - 0.2) * len * 1.3));
    case "d_lead": return lerp(t => along([-a[0], -a[1], 0], t * len * 0.8));
    case "d_topdown": return lerp(t => [camW[0], camW[1], Math.max(0.5, camW[2] * (1 - t * 0.5))]);
    case "d_dive": return lerp(t => [camW[0], camW[1], Math.max(0.4, camW[2] * (1 - t * 0.85))]);
    case "d_dzoom": case "dollyzoom": return lerp(t => along(a, -t * len * 0.4));
    default: return null; // fix/pan/tilt/handheld/gimbal/whip は定点扱い
  }
}

/* =========================================================
 * メイン描画
 * ======================================================= */
function render3D() {
  const canvas = byId("studio3d");
  if (!canvas || !S3D.active) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 4) return;
  if (canvas.width !== Math.round(rect.width * dpr)) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = canvas.width / dpr, H = canvas.height / dpr;
  const cs = getComputedStyle(document.documentElement);
  const col = (name, fb) => (cs.getPropertyValue(name) || fb).trim() || fb;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = S3D.pov ? "#101114" : col("--cv-surface", "#ffffff");
  ctx.fillRect(0, 0, W, H);

  const cut = activeCut();
  const camIt = cut.items.find(i => i.type === "camera");
  const subIt = cut.items.find(i => i.type === "subject");
  const camW = camIt ? s3dItemWorld(camIt) : [0, -2.7, 1.4];
  camW[2] = Math.max(0.1, (cut.camera.supportParam && CAMERA_SUPPORTS.find(s => s.id === cut.camera.support)?.param?.unit === "cm"
    ? cut.camera.supportParam / 100 : (camIt ? camIt.height / 100 : 1.4)) || 1.4);
  const subjH = cut.subjectType === "person" ? 1.7 : cut.subjectType === "car" ? 1.4 : 1.0;
  const subW = subIt ? [...s3dItemWorld(subIt).slice(0, 2), 0] : [0, 0, 0];
  const aim = [subW[0], subW[1], Math.min(subjH * 0.85, 1.5)];
  const path = camPathPoints(cut, camW, aim);
  const hfov = Math.atan(18 / cut.camera.focalMm);
  const asp = aspectDims(cut.aspect); const vRatio = asp.H / asp.W;

  /* --- プロジェクタ: オービット or POV --- */
  let proj;
  let eye = camW;
  if (S3D.pov) {
    if (path && S3D.animT != null) {
      eye = path[Math.min(path.length - 1, Math.floor(S3D.animT * path.length))];
    }
    const { a, r, u } = s3dBasis([aim[0] - eye[0], aim[1] - eye[1], aim[2] - eye[2]]);
    const fpx = (W * 0.42) / Math.tan(hfov); // 少し余白を持たせたPOV焦点
    proj = (p) => {
      const v = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
      const d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
      if (d < 0.15) return null;
      const x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2];
      const z = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
      return { x: W / 2 + (x * fpx) / d, y: H / 2 - (z * fpx) / d, d };
    };
  } else {
    const cyw = Math.cos(S3D.yaw), syw = Math.sin(S3D.yaw);
    const cp = Math.cos(S3D.pitch), sp = Math.sin(S3D.pitch);
    const f = Math.min(W, H) * 1.15;
    const [tx, ty, tz] = S3D.target;
    proj = (p) => {
      let x = p[0] - tx, y = p[1] - ty, z = p[2] - tz;
      const x1 = x * cyw - y * syw;
      const y1 = x * syw + y * cyw;
      const y2 = y1 * cp - z * sp;
      const z2 = y1 * sp + z * cp;
      const depth = y2 + S3D.dist;
      if (depth < 0.3) return null;
      return { x: W / 2 + (x1 * f) / depth, y: H * 0.52 - (z2 * f) / depth, d: depth };
    };
  }

  const line3 = (a, b, color, w, alpha = 1, dash = null) => {
    const pa = proj(a), pb = proj(b);
    if (!pa || !pb) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  const polyList = [];
  const poly3 = (pts, fill, alpha, stroke) => {
    const pp = pts.map(proj);
    if (pp.some(p => !p)) return;
    const d = pp.reduce((s, p) => s + p.d, 0) / pp.length;
    polyList.push({
      d, fn: () => {
        ctx.globalAlpha = alpha; ctx.fillStyle = fill;
        ctx.beginPath(); ctx.moveTo(pp[0].x, pp[0].y);
        for (let i = 1; i < pp.length; i++) ctx.lineTo(pp[i].x, pp[i].y);
        ctx.closePath(); ctx.fill();
        if (stroke) { ctx.globalAlpha = Math.min(1, alpha * 2.2); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    });
  };
  const label3 = (p, text, color) => {
    if (S3D.pov) return; // POVはHUDのみ
    const pp = proj(p);
    if (!pp) return;
    polyList.push({
      d: pp.d - 5, fn: () => {
        ctx.font = "600 11px -apple-system, 'Hiragino Sans', sans-serif";
        ctx.fillStyle = color; ctx.textAlign = "center";
        ctx.fillText(text, pp.x, pp.y);
      }
    });
  };
  const box3 = (c, sx, sy, sz, fill, stroke) => {
    const [x, y, z] = c, hx = sx / 2, hy = sy / 2;
    const B = [[x - hx, y - hy, z], [x + hx, y - hy, z], [x + hx, y + hy, z], [x - hx, y + hy, z]];
    const T = B.map(p => [p[0], p[1], z + sz]);
    poly3([B[0], B[1], T[1], T[0]], fill, 0.85, stroke);
    poly3([B[1], B[2], T[2], T[1]], fill, 0.7, stroke);
    poly3([B[3], B[0], T[0], T[3]], fill, 0.7, stroke);
    poly3([T[0], T[1], T[2], T[3]], fill, 0.95, stroke);
  };

  /* --- POV用: 簡易ライティングの前計算 --- */
  const povLights = S3D.pov ? s3dPrepareLights(cut, aim) : null;

  /* --- 床グリッド + ホリゾント --- */
  if (S3D.pov) {
    // 床と壁をライトで面シェーディング (光だまりが見える)
    const floorAlb = [0.40, 0.40, 0.42];
    for (let x = -5; x < 5; x += 0.5) {
      for (let y = -3.5; y < 3; y += 0.5) {
        const lit = s3dShadePoint([x + 0.25, y + 0.25, 0], [0, 0, 1], povLights);
        poly3([[x, y, 0], [x + 0.5, y, 0], [x + 0.5, y + 0.5, 0], [x, y + 0.5, 0]],
          s3dShadedColor(floorAlb, lit), 1, null);
      }
    }
    const wallAlb = [0.5, 0.5, 0.52];
    for (let x = -5; x < 5; x += 0.5) {
      for (let z = 0; z < 3.2; z += 0.8) {
        const lit = s3dShadePoint([x + 0.25, 2.4, z + 0.4], [0, -1, 0], povLights);
        poly3([[x, 2.4, z], [x + 0.5, 2.4, z], [x + 0.5, 2.4, z + 0.8], [x, 2.4, z + 0.8]],
          s3dShadedColor(wallAlb, lit), 1, null);
      }
    }
  } else {
    const gMinor = col("--cv-grid-minor", "#eceef3");
    const gMajor = col("--cv-grid-major", "#dfe2e9");
    for (let x = -5; x <= 5; x += 0.5) line3([x, -3.7, 0], [x, 3.3, 0], x % 1 === 0 ? gMajor : gMinor, 1);
    for (let y = -3.5; y <= 3.5; y += 0.5) line3([-5, y, 0], [5, y, 0], y % 1 === 0 ? gMajor : gMinor, 1);
    poly3([[-5, 2.4, 0], [5, 2.4, 0], [5, 2.4, 3.2], [-5, 2.4, 3.2]], gMajor, 0.25, gMajor);
  }

  /* --- 被写体 --- */
  const SUBJ_ALBEDO = {
    person: [0.85, 0.71, 0.56], bottle: [0.50, 0.72, 0.85], cosme: [0.91, 0.78, 0.85],
    food: [0.88, 0.63, 0.35], car: [0.69, 0.29, 0.33], arch: [0.54, 0.58, 0.66],
  };
  const subAlb = SUBJ_ALBEDO[cut.subjectType] || SUBJ_ALBEDO.person;
  const subColor = "#5a6478";
  const segs = 10, r0 = cut.subjectType === "car" ? 0.9 : 0.28;
  const ring = (z, r) => Array.from({ length: segs }, (_, i) => {
    const a2 = (i / segs) * Math.PI * 2;
    return [subW[0] + r * Math.cos(a2), subW[1] + r * Math.sin(a2), z];
  });
  const b0 = ring(0, r0), b1 = ring(subjH, r0 * (cut.subjectType === "person" ? 0.7 : 1));
  for (let i = 0; i < segs; i++) {
    if (S3D.pov) {
      // 各面の中心と外向き法線でシェーディング
      const midA = ((i + 0.5) / segs) * Math.PI * 2;
      const normal = [Math.cos(midA), Math.sin(midA), 0];
      const center = [subW[0] + r0 * normal[0], subW[1] + r0 * normal[1], subjH * 0.55];
      const lit = s3dShadePoint(center, normal, povLights);
      poly3([b0[i], b0[(i + 1) % segs], b1[(i + 1) % segs], b1[i]], s3dShadedColor(subAlb, lit), 1, null);
    } else {
      poly3([b0[i], b0[(i + 1) % segs], b1[(i + 1) % segs], b1[i]], subColor, 0.5, null);
    }
  }
  if (cut.subjectType === "person") {
    if (S3D.pov) {
      // 頭部: 前後左右の平均照度で近似シェーディング
      const headC = [subW[0], subW[1], subjH + 0.13];
      const hb = 0.13;
      const faces = [
        { n: [0, -1, 0] }, { n: [1, 0, 0] }, { n: [-1, 0, 0] }, { n: [0, 0, 1] },
      ];
      const B = [[-hb, -hb], [hb, -hb], [hb, hb], [-hb, hb]];
      for (const f of faces) {
        const lit = s3dShadePoint([headC[0] + f.n[0] * hb, headC[1] + f.n[1] * hb, headC[2] + f.n[2] * hb + 0.1], f.n, povLights);
        const colr = s3dShadedColor(subAlb, lit);
        if (f.n[2] === 1) {
          poly3(B.map(p => [headC[0] + p[0], headC[1] + p[1], headC[2] + 0.26]), colr, 1, null);
        } else if (f.n[1] === -1) {
          poly3([[headC[0] - hb, headC[1] - hb, headC[2]], [headC[0] + hb, headC[1] - hb, headC[2]],
                 [headC[0] + hb, headC[1] - hb, headC[2] + 0.26], [headC[0] - hb, headC[1] - hb, headC[2] + 0.26]], colr, 1, null);
        } else {
          const sx = f.n[0];
          poly3([[headC[0] + sx * hb, headC[1] - hb, headC[2]], [headC[0] + sx * hb, headC[1] + hb, headC[2]],
                 [headC[0] + sx * hb, headC[1] + hb, headC[2] + 0.26], [headC[0] + sx * hb, headC[1] - hb, headC[2] + 0.26]], colr, 1, null);
        }
      }
    } else {
      box3([subW[0], subW[1], subjH], 0.26, 0.26, 0.26, subColor, null);
    }
  }
  label3([subW[0], subW[1], subjH + 0.55], "被写体", col("--cv-label", "#3a3a3c"));

  /* --- ライト + 光錐 / パネル --- */
  for (const it of cut.items) {
    if (!LIGHT_TYPES.includes(it.type) && !["reflector", "flag", "diff"].includes(it.type)) continue;
    const p = s3dItemWorld(it);
    const t = EQUIP_TYPES[it.type];
    if (LIGHT_TYPES.includes(it.type)) {
      box3(p.map((v, i) => i === 2 ? v - 0.15 : v), 0.3, 0.3, 0.3, t.color, null);
      if (it.power > 0 && it.type !== "sun") {
        const { a: la, r: lr, u: lu, len: ll } = s3dBasis([aim[0] - p[0], aim[1] - p[1], aim[2] - p[2]]);
        const L = Math.min(ll, 6);
        const rad = Math.tan(Math.min(60, (it.beamAngle ?? 60) / 2) * Math.PI / 180) * L;
        const base = [];
        for (let i = 0; i < 8; i++) {
          const th = (i / 8) * Math.PI * 2;
          base.push([
            p[0] + la[0] * L + (lr[0] * Math.cos(th) + lu[0] * Math.sin(th)) * rad,
            p[1] + la[1] * L + (lr[1] * Math.cos(th) + lu[1] * Math.sin(th)) * rad,
            Math.max(0, p[2] + la[2] * L + (lr[2] * Math.cos(th) + lu[2] * Math.sin(th)) * rad),
          ]);
        }
        for (let i = 0; i < 8; i++) poly3([p, base[i], base[(i + 1) % 8]], t.color, S3D.pov ? 0.05 : 0.06, null);
      }
      label3([p[0], p[1], p[2] + 0.35], t.label, col("--cv-sub", "#8a90a0"));
    } else {
      const { r: pr } = s3dBasis([aim[0] - p[0], aim[1] - p[1], 0]);
      const w2 = 0.5, h2 = 0.4;
      poly3([
        [p[0] - pr[0] * w2, p[1] - pr[1] * w2, p[2] - h2], [p[0] + pr[0] * w2, p[1] + pr[1] * w2, p[2] - h2],
        [p[0] + pr[0] * w2, p[1] + pr[1] * w2, p[2] + h2], [p[0] - pr[0] * w2, p[1] - pr[1] * w2, p[2] + h2],
      ], t.color, 0.55, "#8a90a0");
    }
  }

  /* --- ドローン --- */
  for (const it of cut.items.filter(i => i.type === "drone")) {
    const p = s3dItemWorld(it);
    p[2] = Math.min(p[2], 6);
    box3(p, 0.5, 0.5, 0.14, EQUIP_TYPES.drone.color, null);
    line3([p[0], p[1], 0], p, EQUIP_TYPES.drone.color, 1, 0.5, [4, 4]);
    label3([p[0], p[1], p[2] + 0.35], `ドローン ${(it.height / 100).toFixed(0)}m`, col("--cv-sub", "#8a90a0"));
  }

  const accent = col("--accent", "#0071e3");

  /* --- カメラワーク軌道パス (3Dビューのみ) --- */
  if (!S3D.pov && path) {
    for (let i = 0; i < path.length - 1; i++) {
      line3(path[i], path[i + 1], accent, 2, 0.7, [6, 5]);
    }
    // 終端矢印
    const pe = proj(path[path.length - 1]), pp2 = proj(path[path.length - 2]);
    if (pe && pp2) {
      const ang = Math.atan2(pe.y - pp2.y, pe.x - pp2.x);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(pe.x, pe.y);
      ctx.lineTo(pe.x - 10 * Math.cos(ang - 0.45), pe.y - 10 * Math.sin(ang - 0.45));
      ctx.moveTo(pe.x, pe.y);
      ctx.lineTo(pe.x - 10 * Math.cos(ang + 0.45), pe.y - 10 * Math.sin(ang + 0.45));
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // 再生マーカー
    if (S3D.animT != null) {
      const mp = path[Math.min(path.length - 1, Math.floor(S3D.animT * path.length))];
      box3([mp[0], mp[1], Math.max(0.05, mp[2] - 0.1)], 0.28, 0.28, 0.2, "#e8920a", accent);
    }
  }

  /* --- カメラ + フラスタム + DOF (3Dビューのみ) --- */
  const dof = computeDOF(cut.camera.focalMm, cut.camera.apertureF, cut.camera.focusM);
  if (!S3D.pov) {
    box3([camW[0], camW[1], camW[2] - 0.12], 0.34, 0.5, 0.24, accent, null);
    line3([camW[0], camW[1], 0], camW, "#8a90a0", 1.5, 0.6);
    const { a: ca, r: cr, u: cu, len: cl } = s3dBasis([aim[0] - camW[0], aim[1] - camW[1], aim[2] - camW[2]]);
    const frust = (L) => {
      const hw = Math.tan(hfov) * L, hh = hw * vRatio;
      return [
        [camW[0] + ca[0] * L - cr[0] * hw - cu[0] * hh, camW[1] + ca[1] * L - cr[1] * hw - cu[1] * hh, camW[2] + ca[2] * L - cr[2] * hw - cu[2] * hh],
        [camW[0] + ca[0] * L + cr[0] * hw - cu[0] * hh, camW[1] + ca[1] * L + cr[1] * hw - cu[1] * hh, camW[2] + ca[2] * L + cr[2] * hw - cu[2] * hh],
        [camW[0] + ca[0] * L + cr[0] * hw + cu[0] * hh, camW[1] + ca[1] * L + cr[1] * hw + cu[1] * hh, camW[2] + ca[2] * L + cr[2] * hw + cu[2] * hh],
        [camW[0] + ca[0] * L - cr[0] * hw + cu[0] * hh, camW[1] + ca[1] * L - cr[1] * hw + cu[1] * hh, camW[2] + ca[2] * L - cr[2] * hw + cu[2] * hh],
      ];
    };
    const far = frust(Math.max(cl * 1.25, 3));
    for (const c of far) line3(camW, c, accent, 1.2, 0.55);
    poly3(far, accent, 0.06, accent);
    const fp = frust(Math.min(cut.camera.focusM, 12));
    poly3(fp, "#e8920a", 0.16, "#e8920a");
    if (dof.near < 12) poly3(frust(Math.min(dof.near, 12)), "#2aa87e", 0.1, "#2aa87e");
    if (dof.far !== Infinity && dof.far < 12) poly3(frust(dof.far), "#2aa87e", 0.1, "#2aa87e");
    label3([camW[0], camW[1], camW[2] + 0.4], "カメラ", accent);
  }

  polyList.sort((p1, p2) => p2.d - p1.d).forEach(p => p.fn());

  /* --- POV: フレームマスク (アスペクト比) + 三分割線 --- */
  if (S3D.pov) {
    const frameW = W * 0.84;
    const frameH = frameW * vRatio;
    const fx = (W - frameW) / 2, fy = (H - frameH) / 2;
    ctx.fillStyle = "rgba(6,6,8,0.72)";
    ctx.fillRect(0, 0, W, fy); ctx.fillRect(0, fy + frameH, W, H - fy - frameH);
    ctx.fillRect(0, fy, fx, frameH); ctx.fillRect(fx + frameW, fy, W - fx - frameW, frameH);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, fy, frameW, frameH);
    ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(fx + (frameW * i) / 3, fy); ctx.lineTo(fx + (frameW * i) / 3, fy + frameH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy + (frameH * i) / 3); ctx.lineTo(fx + frameW, fy + (frameH * i) / 3); ctx.stroke();
    }
  }

  /* --- HUD (重なり防止: 凡例幅を実測し、情報行は残り幅に収める) --- */
  const fitText = (txt, maxW) => {
    if (ctx.measureText(txt).width <= maxW) return txt;
    while (txt.length > 1 && ctx.measureText(txt + "…").width > maxW) txt = txt.slice(0, -1);
    return txt + "…";
  };
  const farStr = dof.far === Infinity ? "∞" : dof.far.toFixed(2) + "m";
  const movLabel = (CAM_MOVES.find(m => m.id === cut.camera.move) || {}).label || "";

  // 凡例 (3Dのみ・右詰め)
  let legendW = 0;
  if (!S3D.pov) {
    ctx.font = "400 11px -apple-system, 'Hiragino Sans', sans-serif";
    const legend = [["■ 合焦面", "#e8920a"], ["■ 被写界深度", "#2aa87e"], ["■ 視野角", accent]];
    if (path) legend.push(["┈ 軌道", accent]);
    const gap = 10;
    legendW = legend.reduce((s, [t]) => s + ctx.measureText(t).width + gap, 0);
    let lx = W - 12 - legendW + gap;
    for (const [t, c] of legend) {
      ctx.fillStyle = c;
      ctx.textAlign = "left";
      ctx.fillText(t, lx, 20);
      lx += ctx.measureText(t).width + gap;
    }
  }

  // 情報行 (左・凡例と被らない幅に切り詰め)
  ctx.font = "600 12px -apple-system, 'Hiragino Sans', sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = S3D.pov ? "#e8e8ec" : col("--text2", "#515154");
  const info = S3D.pov
    ? `POV — ${cut.camera.focalMm}mm F${cut.camera.apertureF} ｜ ${cut.aspect} ｜ ${movLabel} ｜ 簡易ライティング${S3D.animT != null ? " ▶ 再生中" : ""}`
    : `${cut.camera.focalMm}mm F${cut.camera.apertureF} ｜ フォーカス ${cut.camera.focusM}m ｜ 被写界深度 ${dof.near.toFixed(2)}m – ${farStr}`;
  ctx.fillText(fitText(info, W - 24 - legendW - 12), 12, 20);

  // 下部ヒント (幅に収める)
  ctx.fillStyle = S3D.pov ? "#9a9aa2" : col("--dim", "#86868b");
  ctx.font = "400 11px -apple-system, 'Hiragino Sans', sans-serif";
  const hint = S3D.pov
    ? "カメラ視点 (レンズ画角で表示)。プレビューの再生ボタンで軌道を移動 (編集は2Dビューで)"
    : `ドラッグ: 回転 ｜ ホイール: ズーム ｜ ダブルクリック: リセット${path ? ` ｜ 点線=カメラ軌道 (${movLabel})` : ""} (編集は2Dビューで)`;
  ctx.fillText(fitText(hint, W - 24), 12, H - 12);
}

/* ---------- 操作 ---------- */
function setup3DControls() {
  const canvas = byId("studio3d");
  canvas.addEventListener("pointerdown", e => {
    if (S3D.pov) return;
    S3D.dragging = { x: e.clientX, y: e.clientY, yaw: S3D.yaw, pitch: S3D.pitch };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  });
  canvas.addEventListener("pointermove", e => {
    if (!S3D.dragging) return;
    S3D.yaw = S3D.dragging.yaw + (e.clientX - S3D.dragging.x) * 0.006;
    S3D.pitch = Math.min(1.35, Math.max(0.06, S3D.dragging.pitch + (e.clientY - S3D.dragging.y) * 0.005));
    render3D();
  });
  canvas.addEventListener("pointerup", () => { S3D.dragging = null; });
  canvas.addEventListener("pointercancel", () => { S3D.dragging = null; });
  canvas.addEventListener("wheel", e => {
    if (S3D.pov) return;
    e.preventDefault();
    S3D.dist = Math.min(30, Math.max(4, S3D.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    render3D();
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { if (!S3D.pov) { s3dReset(); render3D(); } });
  window.addEventListener("resize", () => { if (S3D.active) render3D(); });
}
