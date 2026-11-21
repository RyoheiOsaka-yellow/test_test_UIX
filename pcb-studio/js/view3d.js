// 3D 表示（three.js）。床と影の上に基板を置き、グループ色の立体部品・接続線・銅箔面を描く。
// つかんで動かすための当たり判定（pick / point）もここで行う。
import { compBox, padWorld, G } from './core.js';
import { drawLayerTexture, realColor } from './render.js';

const T = 0.8; // 基板厚の半分 (mm)
export function heightOf(p) {
  const f = p.family;
  if (f === 'gpu') return 2.4; if (f === 'vram') return 1.1;
  if (f === 'ind' || f === 'indin') return Math.min(6, p.w * 0.45); if (f === 'indaux') return 2;
  if (f === 'bulk') return 1.9; if (f === 'bulkin') return 8;
  if (f === 'mlcc' || f === 'res') return p.w > 2 ? 0.8 : 0.5;
  if (f === 'shunt' || f === 'fuse') return 0.7;
  if (f === 'pwrconn') return 10; if (f === 'pwrconn8') return 12;
  if (f === 'dp') return 6; if (f === 'hdmi') return 6.5; if (f === 'fan') return 6;
  if (f === 'flash') return 1.6;
  if (/^kicad/.test(f)) return Math.max(0.5, Math.min(8, Math.min(p.w, p.h) * (p.th ? 0.7 : 0.3)));
  return 0.9;
}
const EDGE = [[0, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 1], [1, 0, 1, 0, 0, 1], [0, 0, 1, 0, 0, 0], [0, 1, 0, 1, 1, 0], [1, 1, 0, 1, 1, 1], [1, 1, 1, 0, 1, 1], [0, 1, 1, 0, 1, 0], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [1, 0, 1, 1, 1, 1], [0, 0, 1, 0, 1, 1]];

export class View3D {
  constructor(canvas) {
    const THREE = window.THREE;
    this.ok = !!THREE; if (!this.ok) return;
    this.THREE = THREE; this.canvas = canvas;
    const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    R.setClearColor(0x2c2e31); R.outputEncoding = THREE.sRGBEncoding;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x2c2e31, 600, 2200);
    this.cam = new THREE.PerspectiveCamera(32, 1, 2, 6000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2c30, 0.62));
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 0.62); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.radius = 4;
    this.scene.add(sun); this.scene.add(sun.target);
    const under = new THREE.DirectionalLight(0xffffff, 0.3); under.position.set(0.3, -1, -0.2); this.scene.add(under);
    const floor = this.floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.ShadowMaterial({ opacity: 0.5 }));   // 床は影だけを受ける
    floor.rotation.x = -Math.PI / 2; floor.position.y = -22; floor.receiveShadow = true; this.scene.add(floor);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.ray = new THREE.Raycaster();
    this.az = -0.5; this.el = 0.72; this.dist = 400; this.target = new THREE.Vector3();
    this.explode = 0; this.board = null; this.texAt = 0; this.style = 'design'; this.pour = 0;
  }
  resize(w, h, dpr) { if (!this.ok) return; this.w = w; this.h = h; this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.dirty = true; }
  frameAll() {
    const b = this.board; if (!b) return;
    this.target.set(b.w / 2, 0, b.gridH / 2 + 4); this.dist = Math.max(b.w * 1.05, b.gridH * 2.2) * (this.cam.aspect < 1.3 ? 2.4 : 1.55);
    this.az = -0.5; this.el = 0.72; this.dirty = true;
  }
  side() { return this.el >= 0 ? 'T' : 'B'; }
  orbit(dx, dy) { this.az -= dx * 0.006; this.el = Math.max(-1.5, Math.min(1.5, this.el + dy * 0.006)); this.dirty = true; }
  pan(dx, dy) { const k = this.dist / 900, c = Math.cos(this.az), s = Math.sin(this.az); this.target.x -= (c * dx + s * dy) * k; this.target.z -= (-s * dx + c * dy) * k; this.dirty = true; }
  zoom(f) { this.dist = Math.max(25, Math.min(2500, this.dist * f)); this.dirty = true; }
  focus(x, y, d) { this.target.set(x, 0, y); if (d) this.dist = d; this.dirty = true; }
  updateCam() {
    const c = this.cam, t = this.target, ce = Math.cos(this.el);
    c.position.set(t.x + this.dist * ce * Math.sin(this.az), t.y + this.dist * Math.sin(this.el), t.z + this.dist * ce * Math.cos(this.az));
    c.up.set(0, 1, 0); c.lookAt(t); c.updateMatrixWorld();
  }
  aim(sx, sy) { this.updateCam(); this.ray.setFromCamera({ x: sx / this.w * 2 - 1, y: -(sy / this.h) * 2 + 1 }, this.cam); }
  // 画面上の点にある部品
  pick(sx, sy) {
    if (!this.ok || !this.board) return null;
    this.aim(sx, sy);
    const hits = this.ray.intersectObjects(this.meshes.map(m => m.mesh));
    for (const h of hits) { const m = this.meshes.find(q => q.mesh === h.object), c = m && m.map[h.instanceId]; if (c) return c; }
    return null;
  }
  // 画面上の点を、見えている側の基板面の座標へ
  point(sx, sy) {
    if (!this.ok || !this.board) return null;
    this.aim(sx, sy);
    const o = this.ray.ray.origin, d = this.ray.ray.direction, y = this.layerY(this.side() === 'T' ? 0 : 3);
    if (Math.abs(d.y) < 1e-6) return null;
    const t = (y - o.y) / d.y; if (t <= 0) return null;
    return { x: o.x + d.x * t, y: o.z + d.z * t };
  }
  layerY(i) { const e = this.explode; return [T + 0.01 + 20 * e, 0.27 + 7 * e, -0.27 - 7 * e, -T - 0.01 - 20 * e][i]; }

  setBoard(b, S) {
    if (!this.ok) return;
    const THREE = this.THREE, first = !this.board || this.board.w !== b.w || this.board.gridH !== b.gridH;
    if (this.board === b && this.nComps === b.comps.length && this.planes) { this.paint(S); this.sync(S); return; }   // 部品数が同じなら描き直すだけ
    this.board = b; this.nComps = b.comps.length;
    while (this.root.children.length) { const m = this.root.children.pop(); m.geometry && m.geometry.dispose(); if (m.material) { m.material.map && m.material.map.dispose(); m.material.dispose(); } }
    const W = b.w, H = b.gridH;
    this.sc = Math.max(3, Math.min(10, Math.floor(4096 / Math.max(W, H))));
    this.slabMat = new THREE.MeshStandardMaterial({ color: 0x183326, roughness: 0.75, transparent: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 2 * T - 0.04, b.h), this.slabMat); slab.position.set(W / 2, 0, b.h / 2); slab.castShadow = true; this.root.add(slab);
    if (b.tab) { const t = b.tab, tb = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0, 2 * T - 0.04, t.h), this.slabMat); tb.position.set((t.x0 + t.x1) / 2, 0, b.h + t.h / 2); tb.castShadow = true; this.root.add(tb); }
    this.bracket = null;
    if (b.meta && b.meta.kind === 'gpu') {
      const br = new THREE.Mesh(new THREE.BoxGeometry(1, 40, b.h + 9), new THREE.MeshStandardMaterial({ color: 0xaab0b6, metalness: 0.5, roughness: 0.45, transparent: true, opacity: 0.4 }));
      br.position.set(-2.6, 8, b.h / 2 - 0.5); this.root.add(br); this.bracket = br;
    }
    this.planes = [];
    for (const kind of ['top', 1, 2, 'bottom']) {
      const cv = document.createElement('canvas'); cv.width = Math.round(W * this.sc); cv.height = Math.round(H * this.sc);
      const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const outer = typeof kind === 'string';
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: outer ? 0.5 : 0.02, depthWrite: outer });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0, H / 2); m.renderOrder = outer ? 0 : 2;
      this.root.add(m); this.planes.push({ kind, cv, tex, mesh: m });
    }
    // 部品：不透明の箱、半透明の箱（固定コネクタ・BGA）、円筒（電解コンデンサ）とその天面
    const n = b.comps.length + 16, box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
    const mk = (geo, mat, shadow) => { const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.castShadow = shadow; mesh.frustumCulled = false; this.root.add(mesh); return { mesh, map: [] }; };
    this.mBox = mk(box, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), true);
    this.mGlass = mk(box, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.5, depthWrite: false }), true);
    this.mCan = mk(cyl, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), true);
    this.mCap = mk(cyl, new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0xffffff }), false);
    // 端子・足（金属）、面取りした角柱（インダクタ）、コンデンサ天面の極性マーク
    const many = geo2 => { const mesh = new THREE.InstancedMesh(geo2, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.75, color: 0xffffff }), n * 6); mesh.frustumCulled = false; this.root.add(mesh); return { mesh, map: [] }; };
    this.mLeg = many(box);
    const oct = new THREE.CylinderGeometry(0.5412, 0.5412, 1, 8); oct.rotateY(Math.PI / 8);
    this.mOct = mk(oct, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.15 }), true);
    this.mSec = mk(new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false, 0.4, 2.1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), false);
    this.mGlass.mesh.renderOrder = 3;
    this.meshes = [this.mBox, this.mGlass, this.mCan, this.mOct];
    this.all = [this.mBox, this.mGlass, this.mCan, this.mCap, this.mLeg, this.mOct, this.mSec];
    // 線：接続線、強調ネット、選択枠、領域
    const line = (max, color, opacity, vc) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 6), 3));
      if (vc) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 6), 3));
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, vertexColors: !!vc, depthTest: false })); l.frustumCulled = false; l.renderOrder = 5; this.root.add(l);
      return { l, max, n: 0, pos: g.attributes.position.array, col: vc ? g.attributes.color.array : null };
    };
    this.lRats = line(3000, 0xffffff, 0.8); this.lHi = line(6000, 0xffffff, 1); this.lSel = line(1200, 0xffffff, 1); this.lReg = line(200, 0xffffff, 0.95, true);
    // 基板の縁
    const o = [[0, 0], [W, 0], [W, b.h]]; if (b.tab) { const t = b.tab; o.push([t.x1, b.h], [t.x1, b.h + t.h], [t.x0, b.h + t.h], [t.x0, b.h]); } o.push([0, b.h]);
    const og = new THREE.BufferGeometry().setFromPoints(o.map(p => new THREE.Vector3(p[0], 0, p[1])));
    this.edge = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: 0xb9d2c4, transparent: true, opacity: 0.7 })); this.root.add(this.edge);
    this.sun.shadow.camera.left = -W; this.sun.shadow.camera.right = W; this.sun.shadow.camera.top = W; this.sun.shadow.camera.bottom = -W; this.sun.shadow.camera.far = W * 6; this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(W / 2 - W * 0.5, W * 1.6, H / 2 + W * 0.9); this.sun.target.position.set(W / 2, 0, H / 2);
    this.paint(S); this.sync(S);
    if (first) this.frameAll();
  }
  // 銅箔面のテクスチャを描き直す。outerOnly=true なら表裏だけ（ドラッグ中用）
  paint(S, outerOnly) {
    if (!this.ok || !this.board) return;
    for (const p of this.planes) { if (outerOnly && typeof p.kind !== 'string') continue; drawLayerTexture(p.cv.getContext('2d'), this.board, p.kind, this.sc, { pour: this.pour, hide: S && S.hidePads }); p.tex.needsUpdate = true; }
    this.texAt = performance.now(); this.dirty = true;
  }
  seg(L, x0, y0, z0, x1, y1, z1, c) {
    if (L.n >= L.max) return; const i = L.n * 6;
    L.pos[i] = x0; L.pos[i + 1] = y0; L.pos[i + 2] = z0; L.pos[i + 3] = x1; L.pos[i + 4] = y1; L.pos[i + 5] = z1;
    if (L.col && c) { L.col[i] = L.col[i + 3] = c.r; L.col[i + 1] = L.col[i + 4] = c.g; L.col[i + 2] = L.col[i + 5] = c.b; }
    L.n++;
  }
  wireBox(L, B, y0, y1) { const w = B.x1 - B.x0, d = B.y1 - B.y0, h = y1 - y0; for (const e of EDGE) this.seg(L, B.x0 + e[0] * w, y0 + e[1] * h, B.y0 + e[2] * d, B.x0 + e[3] * w, y0 + e[4] * h, B.y0 + e[5] * d); }
  // 部品・線を現在の状態に合わせる（軽い処理。毎フレーム呼んでよい）
  sync(S) {
    if (!this.ok || !this.board) return;
    const THREE = this.THREE, b = this.board, M = new THREE.Matrix4(), col = new THREE.Color(), dark = new THREE.Color(0x101214), white = new THREE.Color(0xffffff), grey = new THREE.Color(0xb4bac0).convertSRGBToLinear();
    this.planes.forEach((p, i) => { p.mesh.position.y = this.layerY(i); });
    this.edge.position.y = this.layerY(0) + 0.02;
    this.slabMat.opacity = (1 - this.explode * 0.9) * 0.96; this.slabMat.depthWrite = this.explode < 0.05;
    if (this.bracket) this.bracket.visible = this.explode < 0.03;
    const sel = S ? S.sel : new Set(), hg = S && S.hiGroup;
    for (const m of this.all) { m.k = 0; m.map.length = 0; }
    const metal = new THREE.Color(0xc9ced4).convertSRGBToLinear(), tmp = new THREE.Color();
    const put = (m, c, x, z, sw, sh, hgt, base, sign, color) => { if (m.k >= m.mesh.instanceMatrix.count) return; M.makeScale(sw, hgt, sh); M.setPosition(x, base + sign * hgt / 2, z); m.mesh.setMatrixAt(m.k, M); m.mesh.setColorAt(m.k, color); m.map[m.k] = c; m.k++; };
    for (const L of [this.lRats, this.lHi, this.lSel, this.lReg]) L.n = 0;
    for (const c of b.comps) {
      const f = c.part.family; if (f === 'pcie' || f === 'hole') continue;
      const B = compBox(c), hgt = heightOf(c.part), top = c.side === 'T' || c.part.th, base = top ? this.layerY(0) : this.layerY(3), sg = top ? 1 : -1;
      const g = b.group(c.group), w = B.x1 - B.x0, d = B.y1 - B.y0;
      const glassy = (c.fixed && f !== 'gpu') || c.part.pads.length > 60;
      if (this.style === 'real') col.set(realColor(c.part)).convertSRGBToLinear();
      else if (c.fixed && f !== 'gpu') col.copy(grey);
      else col.set(g ? g.color : '#9aa3ad').convertSRGBToLinear().lerp(dark, 0.12);
      if (hg && hg !== c.group) col.lerp(dark, 0.75);
      if (sel.has(c)) { col.lerp(white, 0.45); this.wireBox(this.lSel, compBox(c, 0.3), base, base + sg * (hgt + 0.3)); }
      const pads = c.part.pads, dimmed = hg && hg !== c.group;
      if (dimmed) tmp.copy(metal).lerp(dark, 0.75); else tmp.copy(metal);
      if (f === 'bulkin') {                                    // 電解コンデンサ：台座＋円筒＋白い天面＋極性マーク
        const r = Math.min(w, d) * 0.94;
        put(this.mBox, c, c.x, c.y, w, d, 0.9, base, sg, tmp.copy(col).lerp(dark, 0.55));
        put(this.mCan, c, c.x, c.y, r, r, hgt, base, sg, col);
        put(this.mCap, c, c.x, c.y, r * 0.97, r * 0.97, 0.12, base + sg * hgt, sg, tmp.set(0xf4f4f4));
        put(this.mSec, c, c.x, c.y, r * 0.97, r * 0.97, 0.14, base + sg * hgt, sg, tmp.copy(col).lerp(dark, 0.25));
      } else if (f === 'ind' || f === 'indin' || f === 'indaux') { // インダクタ：角を落とした角柱＋天面のくぼみ
        put(this.mOct, c, c.x, c.y, w, d, hgt, base, sg, col);
        put(this.mOct, c, c.x, c.y, w * 0.62, d * 0.62, 0.25, base + sg * hgt, sg, tmp.copy(col).lerp(dark, 0.4));
        for (const pad of pads) { const p = padWorld(c, pad); put(this.mLeg, null, p.x, p.y, p.w, p.h, 0.5, base, sg, dimmed ? tmp.copy(metal).lerp(dark, 0.75) : metal); }
      } else if (pads.length === 2 && !c.part.th && !glassy) {  // チップ部品：本体＋両端の電極
        const horiz = w >= d, e = (horiz ? w : d) * 0.22;
        put(this.mBox, c, c.x, c.y, horiz ? w - 2 * e : w, horiz ? d : d - 2 * e, hgt, base, sg, col);
        for (const s2 of [-1, 1]) put(this.mLeg, null, horiz ? c.x + s2 * (w - e) / 2 : c.x, horiz ? c.y : c.y + s2 * (d - e) / 2, horiz ? e : w, horiz ? d : e, hgt * 1.02, base, sg, tmp);
      } else if (!glassy && !c.part.th && pads.length > 2 && pads.length <= 60 && f !== 'drmos') { // IC：本体を少し小さくして足を見せる
        put(this.mBox, c, c.x, c.y, w * 0.84, d * 0.84, hgt, base, sg, col);
        for (const pad of pads) { const p = padWorld(c, pad); put(this.mLeg, null, p.x, p.y, Math.max(0.25, p.w), Math.max(0.25, p.h), 0.3, base, sg, tmp); }
        put(this.mCap, null, c.x - w * 0.3, c.y - d * 0.3, 0.5, 0.5, 0.05, base + sg * hgt, sg, tmp.copy(col).lerp(white, 0.5));   // 1 番ピンの印
      } else {
        put(glassy ? this.mGlass : this.mBox, c, c.x, c.y, w, d, hgt, base, sg, col);
        if (c.part.th && f !== 'hole') for (const pad of pads) { const p = padWorld(c, pad), ph = f === 'fan' ? hgt * 0.85 : Math.min(3.5, hgt * 0.5); put(this.mLeg, null, p.x, p.y, Math.min(0.8, p.w * 0.5), Math.min(0.8, p.h * 0.5), ph, base, sg, tmp); }  // コネクタのピン
      }
      if (f === 'gpu') { col.set(this.style === 'real' ? 0xc3c9cf : 0x8f979f); put(this.mBox, c, c.x, c.y, w * 0.46, d * 0.46, 0.8, base + sg * hgt, sg, col); }
      else if (f === 'drmos') put(this.mCap, null, c.x - w * 0.3, c.y - d * 0.3, 0.6, 0.6, 0.05, base + sg * hgt, sg, tmp.copy(col).lerp(white, 0.5));
    }
    for (const m of this.all) { m.mesh.count = m.k; m.mesh.instanceMatrix.needsUpdate = true; if (m.mesh.instanceColor) m.mesh.instanceColor.needsUpdate = true; }
    if (S) {
      const yT = this.layerY(0) + 0.3, yB = this.layerY(3) - 0.3, hi = S.hiNet;
      const sideY = q => (q.side === 'B' ? yB : yT);
      if (S.show.rats) for (const r of S.rats) this.seg(this.lRats, r.a.x, yT, r.a.y, r.b.x, yT, r.b.y);
      if (hi && hi.route) {
        for (const s of hi.route.segs) { const y = this.layerY(s.l) + (s.l < 2 ? 0.06 : -0.06), p = s.pts; for (let i = 0; i + 3 < p.length; i += 2) this.seg(this.lHi, p[i], y, p[i + 1], p[i + 2], y, p[i + 3]); }
        if (!hi.route.plane) for (const v of hi.route.vias) this.seg(this.lHi, v.x, this.layerY(0) + 0.06, v.y, v.x, this.layerY(3) - 0.06, v.y);
      }
      if (hi) for (const r of S.rats) if (r.net === hi) this.seg(this.lHi, r.a.x, yT, r.a.y, r.b.x, yT, r.b.y);
      if (S.manPrev) { const y = this.layerY(S.manPrev.l) + (S.manPrev.l < 2 ? 0.12 : -0.12), q = S.manPrev.pts; for (let i = 0; i + 1 < q.length; i++) this.seg(this.lSel, q[i][0], y, q[i][1], q[i + 1][0], y, q[i + 1][1]); }
      if (S.man) { const m = S.man, y = this.layerY(m.l); this.wireBox(this.lSel, { x0: m.ix * G - 0.3, y0: m.iy * G - 0.3, x1: m.ix * G + 0.3, y1: m.iy * G + 0.3 }, y - 0.3, y + 0.3); }
      if (S.wire) this.seg(this.lHi, S.wire.from.x, yT, S.wire.from.y, S.wire.to.x, yT, S.wire.to.y);
      if (S.ghost) { const g = S.ghost, y = sideY(g); this.wireBox(this.lSel, compBox(g), y, y + (g.side === 'B' ? -1 : 1) * heightOf(g.part)); }
      if (S.hoverPad) { const p = S.hoverPad; this.wireBox(this.lSel, { x0: p.x - p.w / 2 - 0.2, y0: p.y - p.h / 2 - 0.2, x1: p.x + p.w / 2 + 0.2, y1: p.y + p.h / 2 + 0.2 }, yT - 0.25, yT); }
      if (S.regions) for (const r of S.regions) { col.set(r.color).convertSRGBToLinear(); const y = yT + 0.1; for (const [a, c2, e, f2] of [[r.x0, r.y0, r.x1, r.y0], [r.x1, r.y0, r.x1, r.y1], [r.x1, r.y1, r.x0, r.y1], [r.x0, r.y1, r.x0, r.y0]]) this.seg(this.lReg, a, y, c2, e, y, f2, col); }
      if (S.issues && !S.regions) for (const q of S.issues) { const y = sideY(q); this.seg(this.lSel, q.x, y, q.y, q.x, y + (q.side === 'B' ? -9 : 9), q.y); }
    }
    for (const L of [this.lRats, this.lHi, this.lSel, this.lReg]) { L.l.geometry.setDrawRange(0, L.n * 2); L.l.geometry.attributes.position.needsUpdate = true; if (L.col) L.l.geometry.attributes.color.needsUpdate = true; }
    this.dirty = true;
  }
  render() {
    if (!this.ok) return;
    this.updateCam();
    this.scene.fog.near = this.dist * 1.6; this.scene.fog.far = this.dist * 6;
    this.renderer.render(this.scene, this.cam); this.dirty = false;
  }
}
