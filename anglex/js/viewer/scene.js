// 3D ビューワ: 加須工場モデル同等の描画品質（ACES・PMREM環境光・ソフトシャドウ・エッジ線）＋ Revit 的ビュー操作
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { finishMaterial } from '../geo/materials.js';
const HDRI_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr';

export class Viewer {
  constructor(container, opts = {}) {
    this.container = container; this.opts = opts;
    const W = container.clientWidth || 800, H = container.clientHeight || 600;
    this.scene = new THREE.Scene();
    this.theme = opts.theme || 'light'; // light: Revit 風白背景 / dark: 工場モデル風
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false, logarithmicDepthBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.classList.add('gl'); container.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer(); this.labelRenderer.setSize(W, H); Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' }); container.appendChild(this.labelRenderer.domElement);
    // 環境光（PMREM）: 金属質感の要
    this.pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    if (opts.hdri !== false) this.loadHDRI();
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
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), finishMaterial('CONCRETE')); this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -0.5; this.floor.receiveShadow = true; this.floor.visible = false; this.floor.userData.helper = true; this.floor.userData.noPick = true; this.scene.add(this.floor);
    this.quality = opts.quality !== false; this._buildComposer();
    this.setTheme(this.theme);
    this._bindPointer(); this._resizeObs = new ResizeObserver(() => this.resize()); this._resizeObs.observe(container);
    // オンデマンド描画: 変化があったフレームだけ描画（GPU/バッテリー節約）。最低でも 1 秒に 1 回は描画してテクスチャ到着等を反映
    this._dirty = 2; this._lastRender = 0; this.invalidate = (n = 2) => { this._dirty = Math.max(this._dirty, n); };
    this.controls.addEventListener('change', () => this.invalidate()); this.orthoControls.addEventListener('change', () => this.invalidate()); this.gizmo.addEventListener('change', () => this.invalidate());
    this._raf = (t) => { this._frame = requestAnimationFrame(this._raf); const moved = this.controls.update() | this.orthoControls.update(); if (moved) this.invalidate(); if (this._dirty > 0 || t - this._lastRender > 1000) { this._dirty = Math.max(0, this._dirty - 1); this._lastRender = t; this.render(); } }; this._raf(0);
  }
  setTheme(t) { if (this.invalidate) this.invalidate();
    this.theme = t; this.scene.backgroundBlurriness = 0;
    if (t === 'dark') { this.scene.background = new THREE.Color(0x0d1117); this.scene.fog = new THREE.Fog(0x0d1117, 9000, 30000); this.grid.material.color.set(0x30363d); this.grid.material.opacity = 0.5; this.ground.material.opacity = 0.45; this.hemi.color.set(0x9fb8d8); this.hemi.groundColor.set(0x2a2f36); this.renderer.toneMappingExposure = 1.12; }
    else { this.scene.background = new THREE.Color(0xf4f5f7); this.scene.fog = null; this.grid.material.color.set(0xc3cad2); this.grid.material.opacity = 0.7; this.ground.material.opacity = 0.2; this.hemi.color.set(0xdfe8f2); this.hemi.groundColor.set(0x6a665f); this.renderer.toneMappingExposure = 1.02; }
  }
  resize() { const W = this.container.clientWidth, H = this.container.clientHeight; if (!W || !H) return; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); const a = W / H, s = this.ortho.top; this.ortho.left = -s * a; this.ortho.right = s * a; this.ortho.updateProjectionMatrix(); this.renderer.setSize(W, H); this.labelRenderer.setSize(W, H); this.invalidate(); if (this.composer) { this.composer.setSize(W, H); this.gtao?.setSize(W, H); } }
  render() { if (this.quality && this.composer) this.composer.render(); else this.renderer.render(this.scene, this.activeCamera); this.labelRenderer.render(this.scene, this.activeCamera); }
  // ポストプロセス: GTAO（接触陰影）+ SMAA（AA）+ Output（トーンマップ/色空間）
  _buildComposer() {
    const W = this.container.clientWidth || 800, H = this.container.clientHeight || 600;
    this.composer = new EffectComposer(this.renderer); this.composer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.composer.setSize(W, H);
    this.renderPass = new RenderPass(this.scene, this.activeCamera); this.composer.addPass(this.renderPass);
    try { this.gtao = new GTAOPass(this.scene, this.activeCamera, W, H); this.gtao.output = GTAOPass.OUTPUT.Default; this.gtao.updateGtaoMaterial({ radius: 28, distanceExponent: 1.2, thickness: 12, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false }); this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 8 }); this.gtao.blendIntensity = 0.85; this.composer.addPass(this.gtao); } catch (e) { console.warn('GTAO unavailable', e); this.gtao = null; }
    this.composer.addPass(new OutputPass()); this.smaa = new SMAAPass(); this.composer.addPass(this.smaa);
  }
  setQuality(on) { this.quality = on; this.invalidate(); // 低品質時はクリアコート/異方性/法線マップを外してシェーダ負荷を下げる（内蔵GPU・ソフトウェアGL向け）
    const mats = new Set(); this.scene.traverse(o => { if (o.isMesh && o.material) mats.add(o.material); if (o.userData?._mat) mats.add(o.userData._mat); });
    for (const m of mats) { if (!m.isMeshPhysicalMaterial && !m.isMeshStandardMaterial) continue; if (!m.userData._hq) m.userData._hq = { clearcoat: m.clearcoat, anisotropy: m.anisotropy, normalMap: m.normalMap, roughnessMap: m.roughnessMap }; const h = m.userData._hq; if (on) { if (m.isMeshPhysicalMaterial) { m.clearcoat = h.clearcoat; m.anisotropy = h.anisotropy; } m.normalMap = h.normalMap; m.roughnessMap = h.roughnessMap; } else { if (m.isMeshPhysicalMaterial) { m.clearcoat = 0; m.anisotropy = 0; } m.normalMap = null; m.roughnessMap = null; } m.needsUpdate = true; } }
  _syncCamera() { if (this.renderPass) this.renderPass.camera = this.activeCamera; if (this.gtao) { this.gtao.camera = this.activeCamera; } }
  async loadHDRI(url = HDRI_URL) { try { const hdr = await new RGBELoader().loadAsync(url); hdr.mapping = THREE.EquirectangularReflectionMapping; this.hdri = hdr; this.scene.environment = this.pmrem.fromEquirectangular(hdr).texture; this.scene.environmentIntensity = 1.0; this.applyDisplayStyle(); } catch (e) { console.warn('HDRI 読込失敗（RoomEnvironment を使用）', e.message); } }
  dispose() { cancelAnimationFrame(this._frame); this._resizeObs.disconnect(); this.renderer.dispose(); }

  // ---- モデル操作 ----
  clear() { this.invalidate(); while (this.modelRoot.children.length) this.modelRoot.remove(this.modelRoot.children[0]); this.clearEdges(); this.clearOverlays(); this.select(null); }
  add(obj) { this.modelRoot.add(obj); this.applyDisplayStyle(); this.invalidate(); return obj; }
  remove(obj) { this.modelRoot.remove(obj); this.applyDisplayStyle(); this.invalidate(); }
  clearOverlays() { this.invalidate(); while (this.overlayRoot.children.length) { const c = this.overlayRoot.children[0]; this.overlayRoot.remove(c); c.traverse?.(o => { if (o.element?.parentNode) o.element.parentNode.removeChild(o.element); }); } }
  clearEdges() { while (this.edgeRoot.children.length) this.edgeRoot.remove(this.edgeRoot.children[0]); }
  // 影カメラをモデルに合わせる
  fitShadow() { const box = new THREE.Box3().setFromObject(this.modelRoot); if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.6 + 200; const sc = this.sun.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.updateProjectionMatrix(); this.sun.target.position.copy(c); this.sun.position.copy(c).add(new THREE.Vector3(1800, 3200, 1400).normalize().multiplyScalar(r * 2.2)); this.sun.shadow.camera.far = r * 6; }
  fit(obj = this.modelRoot, pad = 1.35) { this.invalidate();
    const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()); const r = Math.max(size.x, size.y, size.z) * 0.5 * pad + 50;
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize(); const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.copy(c).add(dir.multiplyScalar(dist)); this.controls.target.copy(c); this.camera.near = Math.max(1, dist / 500); this.camera.far = dist * 50; this.camera.updateProjectionMatrix();
    const a = this.container.clientWidth / this.container.clientHeight; this.ortho.top = r; this.ortho.bottom = -r; this.ortho.left = -r * a; this.ortho.right = r * a; this.ortho.updateProjectionMatrix(); this.orthoControls.target.copy(c);
    this.grid.position.x = Math.round(c.x / 100) * 100; this.grid.position.z = Math.round(c.z / 100) * 100;
    this.fitShadow(); this.controls.update();
  }
  // ビュープリセット: 3d | plan | front | side | back | left | iso
  setView(name) { this.invalidate(3);
    const box = new THREE.Box3().setFromObject(this.modelRoot); const c = box.isEmpty() ? new THREE.Vector3(0, 500, 0) : box.getCenter(new THREE.Vector3()); const r = box.isEmpty() ? 2000 : box.getSize(new THREE.Vector3()).length();
    if (name === '3d' || name === 'iso') { this.activeCamera = this.camera; this._syncCamera(); this.controls.enabled = true; this.orthoControls.enabled = false; this.gizmo.camera = this.camera; if (name === 'iso') { this.camera.position.copy(c).add(new THREE.Vector3(1, 0.82, 1).normalize().multiplyScalar(r * 1.3)); this.controls.target.copy(c); } this.fit(); return; }
    const d = r * 2 + 1000; const dirs = { plan: [0, 1, 0], front: [0, 0, 1], back: [0, 0, -1], side: [1, 0, 0], right: [1, 0, 0], left: [-1, 0, 0], bottom: [0, -1, 0] };
    const v = new THREE.Vector3(...(dirs[name] || dirs.front)); this.ortho.position.copy(c).add(v.multiplyScalar(d)); this.ortho.up.set(0, name === 'plan' || name === 'bottom' ? -1 : 1, name === 'plan' ? -1 : 0); if (name === 'plan') this.ortho.up.set(0, 0, -1); if (name === 'bottom') this.ortho.up.set(0, 0, 1);
    this.ortho.lookAt(c); this.activeCamera = this.ortho; this._syncCamera(); this.controls.enabled = false; this.orthoControls.enabled = true; this.orthoControls.target.copy(c); this.gizmo.camera = this.ortho; this.fit();
  }
  // 表示スタイル: realistic | shaded | shaded-edges | hidden-line | wireframe | ghost
  setDisplayStyle(s) { this.displayStyle = s; this.applyDisplayStyle(); }
  applyDisplayStyle() {
    this.invalidate(); const s = this.displayStyle; this.clearEdges();
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
    this.floor.visible = (s === 'realistic'); this.sun.intensity = s === 'realistic' ? 2.2 : 1.6; this.hemi.intensity = s === 'realistic' ? 0.35 : 0.55; this.ground.visible = !this.floor.visible; this.grid.visible = this.gridOn !== false && s !== 'realistic';
    if (s === 'realistic' && this.hdri && this.theme === 'light') { this.scene.background = this.hdri; this.scene.backgroundBlurriness = 0.55; this.scene.backgroundIntensity = 0.9; } else this.setTheme(this.theme);
  }
  syncEdges() { this.invalidate(); for (const ln of this.edgeRoot.children) { const o = ln.userData.src; if (o) { o.updateWorldMatrix(true, false); ln.matrix.copy(o.matrixWorld); ln.visible = o.visible && this._visibleUp(o); } } }
  _visibleUp(o) { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; }
  // 断面ボックス（6面クリッピング）
  setSectionBox(box) { this.invalidate(); // THREE.Box3 | null
    const mats = new Set(); this.modelRoot.traverse(o => { if (o.isMesh) mats.add(o.material); if (o.userData._mat) mats.add(o.userData._mat); });
    if (!box) { this.sectionPlanes = []; for (const m of mats) { m.clippingPlanes = null; m.clipShadows = false; m.needsUpdate = true; } this.sectionBoxHelper && (this.sectionBoxHelper.visible = false); return; }
    const p = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x), new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x), new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y), new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y), new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z), new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z)];
    this.sectionPlanes = p; for (const m of mats) { m.clippingPlanes = p; m.clipShadows = true; m.side = THREE.DoubleSide; m.needsUpdate = true; }
    if (!this.sectionBoxHelper) { this.sectionBoxHelper = new THREE.Box3Helper(box, 0xd97706); this.sectionBoxHelper.userData.helper = true; this.scene.add(this.sectionBoxHelper); } else { this.sectionBoxHelper.box = box; this.sectionBoxHelper.visible = true; }
  }
  // 分解表示: 各インスタンスを重心から放射状に
  setExplode(k) { this.invalidate();
    this.exploded = k; const center = new THREE.Box3().setFromObject(this.modelRoot).getCenter(new THREE.Vector3());
    for (const inst of this.modelRoot.children) { if (!inst.userData._home) inst.userData._home = inst.position.clone(); const c = new THREE.Box3().setFromObject(inst).getCenter(new THREE.Vector3()); const off = c.sub(center).multiplyScalar(k * 0.9); inst.position.copy(inst.userData._home).add(k > 0 ? off : new THREE.Vector3()); }
    this.syncEdges();
  }
  // ラベル（CSS2D）
  label(text, pos, cls = 'tag') { this.invalidate(); const el = document.createElement('div'); el.className = 'v-label ' + cls; el.innerHTML = text; const o = new CSS2DObject(el); o.position.copy(pos); this.overlayRoot.add(o); return o; }
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
  setHover(inst) { if (this.hovered === inst) return; this.invalidate(); this._tint(this.hovered, null); this.hovered = inst; if (inst && inst !== this.selected) this._tint(inst, 0x22, 0.35); this.renderer.domElement.style.cursor = inst ? 'pointer' : ''; }
  select(inst) { this.invalidate(); if (this.selected) this._tint(this.selected, null); this.selected = inst; if (inst) this._tint(inst, 0x2563eb, 0.55); if (this.onSelect) this.onSelect(inst); }
  _tint(inst, color, k = 0.4) { if (!inst) return; inst.traverse(o => { if (!o.isMesh || !o.material) return; if (!o.userData._emis) o.userData._emis = (o.material.emissive ? o.material.emissive.getHex() : 0); if (o.material.emissive) { if (color == null) { o.material.emissive.setHex(o.userData._emis); o.material.emissiveIntensity = 1; } else { o.material = o.material.clone(); o.material.emissive.setHex(color); o.material.emissiveIntensity = k; } } }); }
  attachGizmo(inst, mode = 'translate') { this.invalidate(); if (!inst) { this.gizmo.detach(); return; } this.gizmo.attach(inst); this.gizmo.setMode(mode); }
  screenshot(w = 1600, h = 1000) { const pr = this.renderer.getPixelRatio(); const oldW = this.container.clientWidth, oldH = this.container.clientHeight; this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.quality && this.composer) { this.composer.setSize(w, h); this.gtao?.setSize(w, h); this.composer.render(); } else this.renderer.render(this.scene, this.activeCamera); const url = this.renderer.domElement.toDataURL('image/png'); if (this.composer) { this.composer.setSize(oldW, oldH); this.gtao?.setSize(oldW, oldH); } this.renderer.setPixelRatio(pr); this.renderer.setSize(oldW, oldH); this.camera.aspect = oldW / oldH; this.camera.updateProjectionMatrix(); return url; }
  setGrid(on) { this.invalidate(); this.gridOn = on; this.grid.visible = on && this.displayStyle !== 'realistic'; this.axes.visible = on; }
  setShadows(on) { this.invalidate(); this.renderer.shadowMap.enabled = on; this.sun.castShadow = on; this.modelRoot.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; }); }
}
