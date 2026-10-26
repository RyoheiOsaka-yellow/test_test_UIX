// 3D ビューワ: 加須工場モデル同等の描画品質（ACES・PMREM環境光・ソフトシャドウ・エッジ線）＋ Revit 的ビュー操作
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class Viewer {
  constructor(container, opts = {}) {
    this.container = container; this.opts = opts;
    const W = container.clientWidth || 800, H = container.clientHeight || 600;
    this.scene = new THREE.Scene();
    this.theme = opts.theme || 'light'; // light: Revit 風白背景 / dark: 工場モデル風
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.classList.add('gl'); container.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer(); this.labelRenderer.setSize(W, H); Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' }); container.appendChild(this.labelRenderer.domElement);
    // 環境光（PMREM）: 金属質感の要
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(42, W / H, 1, 60000); this.camera.position.set(2200, 1700, 2600);
    this.ortho = new THREE.OrthographicCamera(-1000, 1000, 750, -750, -50000, 50000);
    this.activeCamera = this.camera;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.target.set(0, 600, 0); this.controls.maxPolarAngle = Math.PI * 0.95;
    this.orthoControls = new OrbitControls(this.ortho, this.renderer.domElement); this.orthoControls.enableRotate = false; this.orthoControls.enabled = false; this.orthoControls.enableDamping = true;
    // ライト
    this.amb = new THREE.AmbientLight(0xffffff, 0.25); this.scene.add(this.amb);
    this.hemi = new THREE.HemisphereLight(0xdfe8f2, 0x5a5650, 0.55); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 1.6); this.sun.position.set(1800, 3200, 1400); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.bias = -0.00035; this.sun.shadow.normalBias = 1.2; this.sun.shadow.camera.near = 100; this.sun.shadow.camera.far = 12000;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0x9fb8ff, 0.3); this.fill.position.set(-2200, 1200, -1800); this.scene.add(this.fill);
    // 地面・グリッド・レベル
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.ShadowMaterial({ opacity: 0.22 })); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.ground.userData.helper = true; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(6000, 60, 0x9aa3ad, 0xd3d8de); this.grid.position.y = 0.5; this.grid.material.transparent = true; this.grid.material.opacity = 0.65; this.grid.userData.helper = true; this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(300); this.axes.userData.helper = true; this.scene.add(this.axes);
    this.modelRoot = new THREE.Group(); this.modelRoot.name = 'model'; this.scene.add(this.modelRoot);
    this.overlayRoot = new THREE.Group(); this.overlayRoot.name = 'overlay'; this.scene.add(this.overlayRoot);
    this.edgeRoot = new THREE.Group(); this.edgeRoot.name = 'edges'; this.scene.add(this.edgeRoot);
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement); this.gizmo.setTranslationSnap(5); this.gizmo.setRotationSnap(THREE.MathUtils.degToRad(15)); this.gizmo.setSize(0.8);
    this.gizmo.addEventListener('dragging-changed', e => { this.controls.enabled = !e.value; if (!e.value && this.onTransformEnd) this.onTransformEnd(this.gizmo.object); });
    this.gizmo.addEventListener('objectChange', () => { if (this.onTransformChange) this.onTransformChange(this.gizmo.object); });
    const gizmoHelper = this.gizmo.getHelper ? this.gizmo.getHelper() : this.gizmo; gizmoHelper.userData.helper = true; this.scene.add(gizmoHelper);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.displayStyle = 'shaded-edges'; this.selected = null; this.hovered = null; this.sectionPlanes = []; this.exploded = 0;
    this.setTheme(this.theme);
    this._bindPointer(); this._resizeObs = new ResizeObserver(() => this.resize()); this._resizeObs.observe(container);
    this._raf = () => { this._frame = requestAnimationFrame(this._raf); this.controls.update(); this.orthoControls.update(); this.render(); }; this._raf();
  }
  setTheme(t) {
    this.theme = t;
    if (t === 'dark') { this.scene.background = new THREE.Color(0x0d1117); this.scene.fog = new THREE.Fog(0x0d1117, 9000, 30000); this.grid.material.color.set(0x30363d); this.grid.material.opacity = 0.5; this.ground.material.opacity = 0.45; this.hemi.color.set(0x9fb8d8); this.hemi.groundColor.set(0x2a2f36); this.renderer.toneMappingExposure = 1.12; }
    else { this.scene.background = new THREE.Color(0xf4f5f7); this.scene.fog = null; this.grid.material.color.set(0xc3cad2); this.grid.material.opacity = 0.7; this.ground.material.opacity = 0.2; this.hemi.color.set(0xdfe8f2); this.hemi.groundColor.set(0x6a665f); this.renderer.toneMappingExposure = 1.02; }
  }
  resize() { const W = this.container.clientWidth, H = this.container.clientHeight; if (!W || !H) return; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); const a = W / H, s = this.ortho.top; this.ortho.left = -s * a; this.ortho.right = s * a; this.ortho.updateProjectionMatrix(); this.renderer.setSize(W, H); this.labelRenderer.setSize(W, H); }
  render() { this.renderer.render(this.scene, this.activeCamera); this.labelRenderer.render(this.scene, this.activeCamera); }
  dispose() { cancelAnimationFrame(this._frame); this._resizeObs.disconnect(); this.renderer.dispose(); }

  // ---- モデル操作 ----
  clear() { while (this.modelRoot.children.length) this.modelRoot.remove(this.modelRoot.children[0]); this.clearEdges(); this.clearOverlays(); this.select(null); }
  add(obj) { this.modelRoot.add(obj); this.applyDisplayStyle(); return obj; }
  remove(obj) { this.modelRoot.remove(obj); this.applyDisplayStyle(); }
  clearOverlays() { while (this.overlayRoot.children.length) { const c = this.overlayRoot.children[0]; this.overlayRoot.remove(c); c.traverse?.(o => { if (o.element?.parentNode) o.element.parentNode.removeChild(o.element); }); } }
  clearEdges() { while (this.edgeRoot.children.length) this.edgeRoot.remove(this.edgeRoot.children[0]); }
  // 影カメラをモデルに合わせる
  fitShadow() { const box = new THREE.Box3().setFromObject(this.modelRoot); if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.6 + 200; const sc = this.sun.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.updateProjectionMatrix(); this.sun.target.position.copy(c); this.sun.position.copy(c).add(new THREE.Vector3(1800, 3200, 1400).normalize().multiplyScalar(r * 2.2)); this.sun.shadow.camera.far = r * 6; }
  fit(obj = this.modelRoot, pad = 1.35) {
    const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()); const r = Math.max(size.x, size.y, size.z) * 0.5 * pad + 50;
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize(); const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.copy(c).add(dir.multiplyScalar(dist)); this.controls.target.copy(c); this.camera.near = Math.max(1, dist / 500); this.camera.far = dist * 50; this.camera.updateProjectionMatrix();
    const a = this.container.clientWidth / this.container.clientHeight; this.ortho.top = r; this.ortho.bottom = -r; this.ortho.left = -r * a; this.ortho.right = r * a; this.ortho.updateProjectionMatrix(); this.orthoControls.target.copy(c);
    this.grid.position.x = Math.round(c.x / 100) * 100; this.grid.position.z = Math.round(c.z / 100) * 100;
    this.fitShadow(); this.controls.update();
  }
  // ビュープリセット: 3d | plan | front | side | back | left | iso
  setView(name) {
    const box = new THREE.Box3().setFromObject(this.modelRoot); const c = box.isEmpty() ? new THREE.Vector3(0, 500, 0) : box.getCenter(new THREE.Vector3()); const r = box.isEmpty() ? 2000 : box.getSize(new THREE.Vector3()).length();
    if (name === '3d' || name === 'iso') { this.activeCamera = this.camera; this.controls.enabled = true; this.orthoControls.enabled = false; this.gizmo.camera = this.camera; if (name === 'iso') { this.camera.position.copy(c).add(new THREE.Vector3(1, 0.82, 1).normalize().multiplyScalar(r * 1.3)); this.controls.target.copy(c); } this.fit(); return; }
    const d = r * 2 + 1000; const dirs = { plan: [0, 1, 0], front: [0, 0, 1], back: [0, 0, -1], side: [1, 0, 0], right: [1, 0, 0], left: [-1, 0, 0], bottom: [0, -1, 0] };
    const v = new THREE.Vector3(...(dirs[name] || dirs.front)); this.ortho.position.copy(c).add(v.multiplyScalar(d)); this.ortho.up.set(0, name === 'plan' || name === 'bottom' ? -1 : 1, name === 'plan' ? -1 : 0); if (name === 'plan') this.ortho.up.set(0, 0, -1); if (name === 'bottom') this.ortho.up.set(0, 0, 1);
    this.ortho.lookAt(c); this.activeCamera = this.ortho; this.controls.enabled = false; this.orthoControls.enabled = true; this.orthoControls.target.copy(c); this.gizmo.camera = this.ortho; this.fit();
  }
  // 表示スタイル: realistic | shaded | shaded-edges | hidden-line | wireframe | ghost
  setDisplayStyle(s) { this.displayStyle = s; this.applyDisplayStyle(); }
  applyDisplayStyle() {
    const s = this.displayStyle; this.clearEdges();
    this.modelRoot.traverse(o => {
      if (!o.isMesh) return; const m = o.material; if (!m) return;
      if (!o.userData._mat) o.userData._mat = m;
      const base = o.userData._mat;
      if (s === 'realistic' || s === 'shaded' || s === 'shaded-edges') o.material = base;
      else if (s === 'hidden-line') { o.material = o.userData._white || (o.userData._white = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })); }
      else if (s === 'wireframe') { o.material = o.userData._wire || (o.userData._wire = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true })); }
      else if (s === 'ghost') { o.material = o.userData._ghost || (o.userData._ghost = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, transparent: true, opacity: 0.35, depthWrite: false })); }
      if (s === 'shaded-edges' || s === 'hidden-line') {
        const eg = o.userData._edges || (o.userData._edges = new THREE.EdgesGeometry(o.geometry, s === 'hidden-line' ? 12 : 22));
        const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: s === 'hidden-line' ? 0x111827 : (this.theme === 'dark' ? 0x0b0f14 : 0x1f2937), transparent: true, opacity: s === 'hidden-line' ? 1 : 0.55 }));
        o.updateWorldMatrix(true, false); ln.matrixAutoUpdate = false; ln.matrix.copy(o.matrixWorld); ln.userData.src = o; this.edgeRoot.add(ln);
      }
    });
    this.scene.environment.__intensity = s === 'realistic' ? 1 : 0.7;
  }
  syncEdges() { for (const ln of this.edgeRoot.children) { const o = ln.userData.src; if (o) { o.updateWorldMatrix(true, false); ln.matrix.copy(o.matrixWorld); ln.visible = o.visible && this._visibleUp(o); } } }
  _visibleUp(o) { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; }
  // 断面ボックス（6面クリッピング）
  setSectionBox(box) { // THREE.Box3 | null
    const mats = new Set(); this.modelRoot.traverse(o => { if (o.isMesh) mats.add(o.material); if (o.userData._mat) mats.add(o.userData._mat); });
    if (!box) { this.sectionPlanes = []; for (const m of mats) { m.clippingPlanes = null; m.clipShadows = false; m.needsUpdate = true; } this.sectionBoxHelper && (this.sectionBoxHelper.visible = false); return; }
    const p = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x), new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x), new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y), new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y), new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z), new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z)];
    this.sectionPlanes = p; for (const m of mats) { m.clippingPlanes = p; m.clipShadows = true; m.side = THREE.DoubleSide; m.needsUpdate = true; }
    if (!this.sectionBoxHelper) { this.sectionBoxHelper = new THREE.Box3Helper(box, 0xd97706); this.sectionBoxHelper.userData.helper = true; this.scene.add(this.sectionBoxHelper); } else { this.sectionBoxHelper.box = box; this.sectionBoxHelper.visible = true; }
  }
  // 分解表示: 各インスタンスを重心から放射状に
  setExplode(k) {
    this.exploded = k; const center = new THREE.Box3().setFromObject(this.modelRoot).getCenter(new THREE.Vector3());
    for (const inst of this.modelRoot.children) { if (!inst.userData._home) inst.userData._home = inst.position.clone(); const c = new THREE.Box3().setFromObject(inst).getCenter(new THREE.Vector3()); const off = c.sub(center).multiplyScalar(k * 0.9); inst.position.copy(inst.userData._home).add(k > 0 ? off : new THREE.Vector3()); }
    this.syncEdges();
  }
  // ラベル（CSS2D）
  label(text, pos, cls = 'tag') { const el = document.createElement('div'); el.className = 'v-label ' + cls; el.innerHTML = text; const o = new CSS2DObject(el); o.position.copy(pos); this.overlayRoot.add(o); return o; }
  // 寸法線（3D ライン + ラベル）
  dimension(a, b, offset = new THREE.Vector3(0, 0, 0), text = null) {
    const g = new THREE.Group(); const A = a.clone().add(offset), B = b.clone().add(offset); const mat = new THREE.LineBasicMaterial({ color: 0x2e5c8a });
    const pts = [a, A, B, b]; g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), mat)); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, A]), mat)); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([b, B]), mat));
    const mid = A.clone().add(B).multiplyScalar(0.5); const lbl = this.label(text ?? Math.round(a.distanceTo(b)), mid, 'dim'); g.add(lbl); this.overlayRoot.add(g); return g;
  }
  // ---- ピッキング ----
  _bindPointer() {
    const el = this.renderer.domElement; let down = null;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => { if (!down) return; const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = null; if (dx * dx + dy * dy > 16) return; const hit = this.pick(e); if (this.onPick) this.onPick(hit, e); });
    el.addEventListener('pointermove', e => { if (this.opts.hover === false) return; const hit = this.pick(e); this.setHover(hit ? hit.instance : null); if (this.onHover) this.onHover(hit, e); });
    el.addEventListener('dblclick', e => { const hit = this.pick(e); if (hit) this.fit(hit.instance); });
  }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.activeCamera); const hits = this.raycaster.intersectObjects(this.modelRoot.children, true).filter(h => h.object.visible && !h.object.userData.noPick);
    if (!hits.length) return null; const h = hits[0]; let inst = h.object; while (inst.parent && inst.parent !== this.modelRoot) inst = inst.parent; return { object: h.object, instance: inst, point: h.point, face: h.face, distance: h.distance };
  }
  setHover(inst) { if (this.hovered === inst) return; this._tint(this.hovered, null); this.hovered = inst; if (inst && inst !== this.selected) this._tint(inst, 0x22, 0.35); this.renderer.domElement.style.cursor = inst ? 'pointer' : ''; }
  select(inst) { if (this.selected) this._tint(this.selected, null); this.selected = inst; if (inst) this._tint(inst, 0x2563eb, 0.55); if (this.onSelect) this.onSelect(inst); }
  _tint(inst, color, k = 0.4) { if (!inst) return; inst.traverse(o => { if (!o.isMesh || !o.material) return; if (!o.userData._emis) o.userData._emis = (o.material.emissive ? o.material.emissive.getHex() : 0); if (o.material.emissive) { if (color == null) { o.material.emissive.setHex(o.userData._emis); o.material.emissiveIntensity = 1; } else { o.material = o.material.clone(); o.material.emissive.setHex(color); o.material.emissiveIntensity = k; } } }); }
  attachGizmo(inst, mode = 'translate') { if (!inst) { this.gizmo.detach(); return; } this.gizmo.attach(inst); this.gizmo.setMode(mode); }
  screenshot(w = 1600, h = 1000) { const pr = this.renderer.getPixelRatio(); const oldW = this.container.clientWidth, oldH = this.container.clientHeight; this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.render(this.scene, this.activeCamera); const url = this.renderer.domElement.toDataURL('image/png'); this.renderer.setPixelRatio(pr); this.renderer.setSize(oldW, oldH); this.camera.aspect = oldW / oldH; this.camera.updateProjectionMatrix(); return url; }
  setGrid(on) { this.grid.visible = on; this.axes.visible = on; }
  setShadows(on) { this.renderer.shadowMap.enabled = on; this.sun.castShadow = on; this.modelRoot.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; }); }
}
