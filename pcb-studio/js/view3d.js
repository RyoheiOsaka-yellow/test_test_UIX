// 3D 表示（three.js）。基板・部品を立体で確認し、銅箔 4 層を上下に分解して見られる。
import { compBox } from './core.js';
import { drawLayerTexture, realColor } from './render.js';

const T = 0.8; // 基板厚の半分 (mm)
function heightOf(p) {
  const f = p.family;
  if (f === 'gpu') return 2.4; if (f === 'vram') return 1.1;
  if (f === 'ind' || f === 'indin') return Math.min(6, p.w * 0.45); if (f === 'indaux') return 2;
  if (f === 'bulk') return 1.9; if (f === 'bulkin') return 8;
  if (f === 'mlcc' || f === 'res') return p.w > 2 ? 0.8 : 0.5;
  if (f === 'shunt' || f === 'fuse') return 0.7;
  if (f === 'pwrconn') return 10; if (f === 'pwrconn8') return 12;
  if (f === 'dp') return 6; if (f === 'hdmi') return 6.5; if (f === 'fan') return 6;
  if (f === 'pcie') return 0.06; if (f === 'flash') return 1.6;
  if (/^kicad/.test(f)) return Math.max(0.5, Math.min(8, Math.min(p.w, p.h) * (p.th ? 0.7 : 0.3)));
  return 0.9;
}

export class View3D {
  constructor(canvas) {
    const THREE = window.THREE;
    this.ok = !!THREE; if (!this.ok) return;
    this.THREE = THREE; this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x0d1216);
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(32, 1, 1, 4000);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(-0.5, 1, 0.7); this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.45); d2.position.set(0.4, -1, -0.3); this.scene.add(d2);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.az = -0.45; this.el = 0.85; this.dist = 400; this.target = new THREE.Vector3();
    this.explode = 0; this.board = null; this.texAt = 0;
    this.bind();
  }
  bind() {
    const cv = this.canvas, ptrs = new Map(); let pinch = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) this.dist = Math.max(30, Math.min(1500, this.dist * pinch / d)); pinch = d; }
      else if (p.pan) { const k = this.dist / 900; this.target.x -= (Math.cos(this.az) * dx) * k; this.target.z -= (-Math.sin(this.az) * dx) * k; this.target.x -= Math.sin(this.az) * dy * k; this.target.z -= Math.cos(this.az) * dy * k; }
      else { this.az -= dx * 0.006; this.el = Math.max(-1.5, Math.min(1.5, this.el + dy * 0.006)); }
      this.dirty = true;
    });
    const up = e => { ptrs.delete(e.pointerId); pinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); this.dist = Math.max(30, Math.min(1500, this.dist * Math.exp(e.deltaY * 0.0012))); this.dirty = true; }, { passive: false });
  }
  resize(w, h, dpr) { if (!this.ok) return; this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.dirty = true; }
  frameAll() { const b = this.board; if (!b) return; this.target.set(b.w / 2, 0, b.gridH / 2); this.dist = Math.max(b.w, b.gridH * 1.6) * 2.25; this.az = -0.4; this.el = 0.9; this.dirty = true; }

  // 基板が変わったら作り直す
  setBoard(b) {
    if (!this.ok) return;
    const THREE = this.THREE, first = this.board !== b && (!this.board || this.board.w !== b.w || this.board.gridH !== b.gridH);
    this.board = b;
    while (this.root.children.length) { const m = this.root.children.pop(); m.geometry && m.geometry.dispose(); if (m.material) { m.material.map && m.material.map.dispose(); m.material.dispose(); } }
    const W = b.w, H = b.gridH;
    this.sc = Math.max(3, Math.min(10, Math.floor(4096 / Math.max(W, H))));
    this.slabMat = new THREE.MeshStandardMaterial({ color: 0x11161b, roughness: 0.8, transparent: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 2 * T - 0.04, b.h), this.slabMat); slab.position.set(W / 2, 0, b.h / 2); this.root.add(slab);
    if (b.tab) { const t = b.tab, tb = new THREE.Mesh(new THREE.BoxGeometry(t.x1 - t.x0, 2 * T - 0.04, t.h), this.slabMat); tb.position.set((t.x0 + t.x1) / 2, 0, b.h + t.h / 2); this.root.add(tb); }
    if (b.meta && b.meta.kind === 'gpu') { // ブラケット
      const br = new THREE.Mesh(new THREE.BoxGeometry(1, 40, b.h + 9), new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.7, roughness: 0.4 }));
      br.position.set(-2.6, 8, b.h / 2 - 0.5); this.root.add(br); this.bracket = br;
    } else this.bracket = null;
    {
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
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    const n = b.comps.length + 8; this.cap = n;
    this.inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }), n);
    this.root.add(this.inst);
    this.paint(); this.sync();
    if (first) this.frameAll();
  }
  paint() { for (const p of this.planes) { drawLayerTexture(p.cv.getContext('2d'), this.board, p.kind, this.sc); p.tex.needsUpdate = true; } this.texAt = performance.now(); this.dirty = true; }
  layerY(i) { const e = this.explode; return [T + 0.01 + 20 * e, 0.27 + 7 * e, -0.27 - 7 * e, -T - 0.01 - 20 * e][i]; }
  // 部品の位置・色を更新（アニメーション中は毎フレーム呼ぶ）
  sync() {
    if (!this.ok || !this.board) return;
    const THREE = this.THREE, b = this.board, M = new THREE.Matrix4(), col = new THREE.Color(), dark = new THREE.Color(0x20262c);
    this.planes.forEach((p, i) => { p.mesh.position.y = this.layerY(i); });
    if (this.bracket) this.bracket.visible = this.explode < 0.03;
    this.slabMat.opacity = 1 - this.explode * 0.9; this.slabMat.depthWrite = this.explode < 0.05;
    let k = 0;
    const put = (x, z, sw, sh, hgt, base, sign, c) => { M.makeScale(sw, hgt, sh); M.setPosition(x, base + sign * hgt / 2, z); this.inst.setMatrixAt(k, M); this.inst.setColorAt(k, c); k++; };
    for (const c of b.comps) {
      if (k >= this.cap - 1) break;
      const B = compBox(c), hgt = heightOf(c.part), top = c.side === 'T' || c.part.th;
      const g = b.group(c.group);
      if (this.style === 'real') col.set(realColor(c.part)).convertSRGBToLinear();
      else col.set(g ? g.color : '#9aa3ad').convertSRGBToLinear().lerp(dark, /^(gpu|vram)$/.test(c.part.family) ? 0.55 : 0.2);
      put(c.x, c.y, B.x1 - B.x0, B.y1 - B.y0, hgt, top ? this.layerY(0) : this.layerY(3), top ? 1 : -1, col);
      if (c.part.family === 'gpu') { col.set(this.style === 'real' ? 0xc3c9cf : 0x8f979f); put(c.x, c.y, (B.x1 - B.x0) * 0.46, (B.y1 - B.y0) * 0.46, 0.8, this.layerY(0) + hgt, 1, col); }
    }
    this.inst.count = k; this.inst.instanceMatrix.needsUpdate = true; if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
    this.dirty = true;
  }
  render() {
    if (!this.ok) return;
    const c = this.cam, t = this.target, ce = Math.cos(this.el);
    c.position.set(t.x + this.dist * ce * Math.sin(this.az), t.y + this.dist * Math.sin(this.el), t.z + this.dist * ce * Math.cos(this.az));
    c.up.set(0, 1, 0); c.lookAt(t);
    this.renderer.render(this.scene, c); this.dirty = false;
  }
}
