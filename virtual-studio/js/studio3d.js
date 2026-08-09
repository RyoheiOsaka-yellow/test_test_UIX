/* =========================================================
 * Studio3D — 3Dテクニカルビュー (CineOS Phase 2 移植)
 * 依存ライブラリなしの自前パースペクティブ投影 (canvas 2D)。
 * 表示: 床グリッド / 被写体 / ライト+光錐 (照射角) / カメラ+視野角
 *       フラスタム / 被写界深度 (DOF) 面 / ドローン高度
 * 座標系は canonical と同じ: +X=右, +Y=被写体後方, +Z=上 (m)
 * 操作: ドラッグ=回転 / ホイール=ズーム / ダブルクリック=リセット
 * ======================================================= */

"use strict";

const S3D = {
  active: false,
  yaw: 0.55, pitch: 0.42, dist: 13.5,
  target: [0, 0, 1.0],
  dragging: null,
};

function s3dReset() { S3D.yaw = 0.55; S3D.pitch = 0.42; S3D.dist = 13.5; }

/* world(m) → screen */
function s3dMakeProjector(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  const cy = Math.cos(S3D.yaw), sy = Math.sin(S3D.yaw);
  const cp = Math.cos(S3D.pitch), sp = Math.sin(S3D.pitch);
  const f = Math.min(W, H) * 1.15;
  const [tx, ty, tz] = S3D.target;
  return (p) => {
    let x = p[0] - tx, y = p[1] - ty, z = p[2] - tz;
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    const y2 = y1 * cp - z * sp;
    const z2 = y1 * sp + z * cp;
    const depth = y2 + S3D.dist;
    if (depth < 0.3) return null;
    return { x: W / 2 + (x1 * f) / depth, y: H * 0.52 - (z2 * f) / depth, d: depth };
  };
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

function render3D() {
  const canvas = byId("studio3d");
  if (!canvas || !S3D.active) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
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
  ctx.fillStyle = col("--cv-surface", "#ffffff");
  ctx.fillRect(0, 0, W, H);

  const proj = s3dMakeProjector(canvas);
  const cut = activeCut();
  const camIt = cut.items.find(i => i.type === "camera");
  const subIt = cut.items.find(i => i.type === "subject");
  const camW = camIt ? s3dItemWorld(camIt) : [0, -2.7, 1.4];
  camW[2] = Math.max(0.1, (cut.camera.supportParam && CAMERA_SUPPORTS.find(s => s.id === cut.camera.support)?.param?.unit === "cm"
    ? cut.camera.supportParam / 100 : (camIt ? camIt.height / 100 : 1.4)) || 1.4);
  const subjH = cut.subjectType === "person" ? 1.7 : cut.subjectType === "car" ? 1.4 : 1.0;
  const subW = subIt ? [...s3dItemWorld(subIt).slice(0, 2), 0] : [0, 0, 0];
  const aim = [subW[0], subW[1], Math.min(subjH * 0.85, 1.5)];

  const line3 = (a, b, color, w, alpha = 1, dash = null) => {
    const pa = proj(a), pb = proj(b);
    if (!pa || !pb) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  };
  const polyList = []; // {d, fn} 奥から描く
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

  /* --- 床グリッド (10m x 7m) --- */
  const gMinor = col("--cv-grid-minor", "#eceef3"), gMajor = col("--cv-grid-major", "#dfe2e9");
  for (let x = -5; x <= 5; x += 0.5) line3([x, -3.7, 0], [x, 3.3, 0], x % 1 === 0 ? gMajor : gMinor, 1);
  for (let y = -3.5; y <= 3.5; y += 0.5) line3([-5, y, 0], [5, y, 0], y % 1 === 0 ? gMajor : gMinor, 1);
  /* 背景ホリゾント壁 */
  poly3([[-5, 2.4, 0], [5, 2.4, 0], [5, 2.4, 3.2], [-5, 2.4, 3.2]], col("--cv-grid-major", "#dfe2e9"), 0.25, gMajor);

  /* --- 被写体 --- */
  const subColor = "#5a6478";
  const segs = 10, r0 = cut.subjectType === "car" ? 0.9 : 0.28;
  const ring = (z, r) => Array.from({ length: segs }, (_, i) => {
    const a = (i / segs) * Math.PI * 2;
    return [subW[0] + r * Math.cos(a), subW[1] + r * Math.sin(a), z];
  });
  const b0 = ring(0, r0), b1 = ring(subjH, r0 * (cut.subjectType === "person" ? 0.7 : 1));
  for (let i = 0; i < segs; i++) {
    poly3([b0[i], b0[(i + 1) % segs], b1[(i + 1) % segs], b1[i]], subColor, 0.5, null);
  }
  if (cut.subjectType === "person") {
    const hz = subjH + 0.12;
    box3([subW[0], subW[1], subjH], 0.26, 0.26, 0.26, subColor, null);
    void hz;
  }
  label3([subW[0], subW[1], subjH + 0.55], "被写体", col("--cv-label", "#3a3a3c"));

  /* --- ライト + 光錐 --- */
  for (const it of cut.items) {
    if (!LIGHT_TYPES.includes(it.type) && !["reflector", "flag", "diff"].includes(it.type)) continue;
    const p = s3dItemWorld(it);
    const t = EQUIP_TYPES[it.type];
    if (LIGHT_TYPES.includes(it.type)) {
      box3(p.map((v, i) => i === 2 ? v - 0.15 : v), 0.3, 0.3, 0.3, t.color, null);
      if (it.power > 0 && it.type !== "sun") {
        const { a, r, u, len } = s3dBasis([aim[0] - p[0], aim[1] - p[1], aim[2] - p[2]]);
        const L = Math.min(len, 6);
        const rad = Math.tan(Math.min(60, (it.beamAngle ?? 60) / 2) * Math.PI / 180) * L;
        const base = [];
        for (let i = 0; i < 8; i++) {
          const th = (i / 8) * Math.PI * 2;
          base.push([
            p[0] + a[0] * L + (r[0] * Math.cos(th) + u[0] * Math.sin(th)) * rad,
            p[1] + a[1] * L + (r[1] * Math.cos(th) + u[1] * Math.sin(th)) * rad,
            Math.max(0, p[2] + a[2] * L + (r[2] * Math.cos(th) + u[2] * Math.sin(th)) * rad),
          ]);
        }
        for (let i = 0; i < 8; i++) poly3([p, base[i], base[(i + 1) % 8]], t.color, 0.06, null);
      }
      label3([p[0], p[1], p[2] + 0.35], t.label, col("--cv-sub", "#8a90a0"));
    } else {
      /* パネル類 (レフ/フラッグ/ディフューザー): 板 */
      const { r, u } = s3dBasis([aim[0] - p[0], aim[1] - p[1], 0]);
      const w2 = 0.5, h2 = 0.4;
      poly3([
        [p[0] - r[0] * w2, p[1] - r[1] * w2, p[2] - h2], [p[0] + r[0] * w2, p[1] + r[1] * w2, p[2] - h2],
        [p[0] + r[0] * w2, p[1] + r[1] * w2, p[2] + h2], [p[0] - r[0] * w2, p[1] - r[1] * w2, p[2] + h2],
      ], t.color, 0.55, "#8a90a0");
      void u;
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

  /* --- カメラ + フラスタム + DOF --- */
  const accent = col("--accent", "#0071e3");
  box3([camW[0], camW[1], camW[2] - 0.12], 0.34, 0.5, 0.24, accent, null);
  line3([camW[0], camW[1], 0], camW, "#8a90a0", 1.5, 0.6);
  const { a, r, u, len } = s3dBasis([aim[0] - camW[0], aim[1] - camW[1], aim[2] - camW[2]]);
  const hfov = Math.atan(18 / cut.camera.focalMm);           // 半水平視野角 (FF 36mm幅)
  const asp = aspectDims(cut.aspect); const vRatio = asp.H / asp.W;
  const frust = (L) => {
    const hw = Math.tan(hfov) * L, hh = hw * vRatio;
    return [
      [camW[0] + a[0] * L - r[0] * hw - u[0] * hh, camW[1] + a[1] * L - r[1] * hw - u[1] * hh, camW[2] + a[2] * L - r[2] * hw - u[2] * hh],
      [camW[0] + a[0] * L + r[0] * hw - u[0] * hh, camW[1] + a[1] * L + r[1] * hw - u[1] * hh, camW[2] + a[2] * L + r[2] * hw - u[2] * hh],
      [camW[0] + a[0] * L + r[0] * hw + u[0] * hh, camW[1] + a[1] * L + r[1] * hw + u[1] * hh, camW[2] + a[2] * L + r[2] * hw + u[2] * hh],
      [camW[0] + a[0] * L - r[0] * hw + u[0] * hh, camW[1] + a[1] * L - r[1] * hw + u[1] * hh, camW[2] + a[2] * L - r[2] * hw + u[2] * hh],
    ];
  };
  const far = frust(Math.max(len * 1.25, 3));
  for (const c of far) line3(camW, c, accent, 1.2, 0.55);
  poly3(far, accent, 0.06, accent);

  /* DOF: 合焦面 (オレンジ) + 前後の深度面 (緑) */
  const dof = computeDOF(cut.camera.focalMm, cut.camera.apertureF, cut.camera.focusM);
  const fp = frust(Math.min(cut.camera.focusM, 12));
  poly3(fp, "#e8920a", 0.16, "#e8920a");
  if (dof.near < 12) poly3(frust(Math.min(dof.near, 12)), "#2aa87e", 0.1, "#2aa87e");
  if (dof.far !== Infinity && dof.far < 12) poly3(frust(dof.far), "#2aa87e", 0.1, "#2aa87e");
  label3([camW[0], camW[1], camW[2] + 0.4], "カメラ", accent);

  /* 奥から描画 */
  polyList.sort((p1, p2) => p2.d - p1.d).forEach(p => p.fn());

  /* --- HUD --- */
  ctx.font = "600 12px -apple-system, 'Hiragino Sans', sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = col("--text2", "#515154");
  const farStr = dof.far === Infinity ? "∞" : dof.far.toFixed(2) + "m";
  ctx.fillText(`${cut.camera.focalMm}mm F${cut.camera.apertureF} ｜ フォーカス ${cut.camera.focusM}m ｜ 被写界深度 ${dof.near.toFixed(2)}m – ${farStr}`, 12, 20);
  ctx.fillStyle = col("--dim", "#86868b");
  ctx.font = "400 11px -apple-system, 'Hiragino Sans', sans-serif";
  ctx.fillText("ドラッグ: 回転 ｜ ホイール: ズーム ｜ ダブルクリック: リセット (編集は2Dビューで)", 12, H - 12);
  /* 凡例 */
  ctx.fillStyle = "#e8920a"; ctx.fillText("■ 合焦面", W - 190, 20);
  ctx.fillStyle = "#2aa87e"; ctx.fillText("■ 被写界深度", W - 130, 20);
  ctx.fillStyle = col("--accent", "#0071e3"); ctx.fillText("■ 視野角", W - 58, 20);
}

/* ---------- 操作 ---------- */
function setup3DControls() {
  const canvas = byId("studio3d");
  canvas.addEventListener("pointerdown", e => {
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
    e.preventDefault();
    S3D.dist = Math.min(30, Math.max(4, S3D.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
    render3D();
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { s3dReset(); render3D(); });
  window.addEventListener("resize", () => { if (S3D.active) render3D(); });
}
