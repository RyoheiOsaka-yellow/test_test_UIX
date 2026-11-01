// 3D ビューワ（ANGLEX と同等の描画品質: ACES・PMREM 環境光・ソフトシャドウ・GTAO・SMAA・エッジ線）
// + 検査オーバーレイ: 特徴ハイライト（円筒・平面・距離）、吹き出し（バルーン No + 測定値）、プローブ点と偏差ベクトル、断面
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const STATUS_HEX = { ok: 0x3e6b4a, warn: 0xb8862a, ng: 0xc0392b, na: 0x6f6f68, sel: 0x2563eb };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class Viewer {
  constructor(container, opts = {}) {
    this.container = container; this.opts = opts; const W = container.clientWidth || 800, H = container.clientHeight || 600;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0xf4f5f7);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05; this.renderer.localClippingEnabled = true;
    this.renderer.domElement.classList.add('gl'); container.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer(); this.labelRenderer.setSize(W, H); Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' }); container.appendChild(this.labelRenderer.domElement);
    this.pmrem = new THREE.PMREMGenerator(this.renderer); this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 1.0;
    this.camera = new THREE.PerspectiveCamera(36, W / H, 1, 6000); this.camera.position.set(160, 120, 190);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.1; this.controls.zoomToCursor = true; this.controls.target.set(0, 20, 0); this.controls.maxPolarAngle = Math.PI * 0.95;
    this.amb = new THREE.AmbientLight(0xffffff, 0.22); this.scene.add(this.amb); this.hemi = new THREE.HemisphereLight(0xdfe8f2, 0x6a665f, 0.5); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 1.7); this.sun.position.set(180, 320, 140); this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096); this.sun.shadow.bias = -0.00025; this.sun.shadow.normalBias = 0.6; this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 2000; this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0x9fb8ff, 0.3); this.fill.position.set(-220, 120, -180); this.scene.add(this.fill);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.2 })); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(600, 60, 0xb8bec6, 0xd9dde2); this.grid.position.y = -0.2; this.grid.material.transparent = true; this.grid.material.opacity = 0.7; this.scene.add(this.grid);
    this.modelRoot = new THREE.Group(); this.scene.add(this.modelRoot); this.edgeRoot = new THREE.Group(); this.scene.add(this.edgeRoot); this.overlayRoot = new THREE.Group(); this.scene.add(this.overlayRoot); this.probeRoot = new THREE.Group(); this.scene.add(this.probeRoot);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.displayStyle = 'shaded-edges'; this.quality = opts.quality !== false; this._buildComposer();
    this._dirty = 2; this._lastRender = 0; this.invalidate = (n = 2) => { this._dirty = Math.max(this._dirty, n); };
    this.controls.addEventListener('change', () => this.invalidate()); this._resizeObs = new ResizeObserver(() => this.resize()); this._resizeObs.observe(container);
    this._raf = (t) => { this._frame = requestAnimationFrame(this._raf); if (!this.container.clientWidth || !this.container.clientHeight) return; /* 非表示中は描画しない */ if (this._tween) this._stepTween(); const moved = this.controls.update(); if (moved) this.invalidate(); if (this._dirty > 0 || t - this._lastRender > 1000) { this._dirty = Math.max(0, this._dirty - 1); this._lastRender = t; this.render(); } }; this._raf(0);
    this._bindPointer();
  }
  _buildComposer() {
    const W = this.container.clientWidth || 800, H = this.container.clientHeight || 600; let rt = null; try { if (this.renderer.capabilities.isWebGL2) rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }); } catch { rt = null; }
    this.composer = new EffectComposer(this.renderer, rt || undefined); this.composer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.composer.setSize(W, H); this.composer.addPass(new RenderPass(this.scene, this.camera));
    try { this.gtao = new GTAOPass(this.scene, this.camera, W, H); this.gtao.output = GTAOPass.OUTPUT.Default; this.gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.2, thickness: 3, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false }); this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 8 }); this.gtao.blendIntensity = 0.8; this.composer.addPass(this.gtao); } catch (e) { console.warn('GTAO unavailable', e); this.gtao = null; }
    this.composer.addPass(new OutputPass()); this.composer.addPass(new SMAAPass());
  }
  setQuality(on) { this.quality = on; this.invalidate(); }
  resize() { const W = this.container.clientWidth, H = this.container.clientHeight; if (!W || !H) return; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.renderer.setSize(W, H); this.labelRenderer.setSize(W, H); this.composer.setSize(W, H); this.gtao?.setSize(W, H); this.invalidate(); }
  render() { if (this.quality && this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); this.labelRenderer.render(this.scene, this.camera); }
  screenshot(w = 1600, h = 1000) { const pr = this.renderer.getPixelRatio(); const oW = this.container.clientWidth, oH = this.container.clientHeight; this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.composer.setSize(w, h); this.gtao?.setSize(w, h); this.composer.render(); const url = this.renderer.domElement.toDataURL('image/png'); this.composer.setSize(oW, oH); this.gtao?.setSize(oW, oH); this.renderer.setPixelRatio(pr); this.renderer.setSize(oW, oH); this.camera.aspect = oW / oH; this.camera.updateProjectionMatrix(); this.invalidate(); return url; }

  // ---- モデル ----
  setPart(built) { this.clear(); this.built = built; this.modelRoot.add(built.group); this.applyDisplayStyle(); this.fitShadow(); this.setView('iso', false); }
  clear() { this.setSection(null); /* 先にクリッピングを外す（キャッシュ材質に残らないように） */ while (this.modelRoot.children.length) this.modelRoot.remove(this.modelRoot.children[0]); this.clearEdges(); this.clearOverlays(); this.clearProbes(); this.invalidate(); }
  clearEdges() { while (this.edgeRoot.children.length) this.edgeRoot.remove(this.edgeRoot.children[0]); }
  fitShadow() { const box = new THREE.Box3().setFromObject(this.modelRoot); if (box.isEmpty()) return; const c = box.getCenter(V3()), r = box.getSize(V3()).length() * 0.7 + 20; const sc = this.sun.shadow.camera; sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.updateProjectionMatrix(); this.sun.target.position.copy(c); this.sun.position.copy(c).add(V3(180, 320, 140).normalize().multiplyScalar(r * 2.5)); this.sun.shadow.camera.far = r * 6; this.grid.position.set(0, box.min.y - 0.2, 0); this.ground.position.y = box.min.y - 0.25; }
  fit(obj = this.modelRoot, pad = 1.25, { animate = true, ms = 420 } = {}) { const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return; const c = box.getCenter(V3()), size = box.getSize(V3()); const r = Math.max(size.x, size.y, size.z) * 0.5 * pad + 5; const dir = V3().subVectors(this.camera.position, this.controls.target).normalize(); const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)); const p1 = c.clone().add(dir.multiplyScalar(dist)); if (!animate) { this.camera.position.copy(p1); this.controls.target.copy(c); this.controls.update(); this.invalidate(); return; } this.animateTo(p1, c, { ms }); }
  setView(name, animate = true) { const box = new THREE.Box3().setFromObject(this.modelRoot); const c = box.isEmpty() ? V3(0, 20, 0) : box.getCenter(V3()); const r = box.isEmpty() ? 200 : box.getSize(V3()).length(); const dirs = { iso: [1, 0.75, 1], top: [0.001, 1, 0.001], front: [0, 0.001, 1], side: [1, 0.001, 0], bottom: [0.001, -1, 0.001], back: [0, 0.001, -1] }; const d = V3(...(dirs[name] || dirs.iso)).normalize(); const dist = (r * 0.5 * 1.08 + 4) / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)); const p1 = c.clone().add(d.multiplyScalar(dist)); if (!animate) { this.camera.position.copy(p1); this.controls.target.copy(c); this.controls.update(); this.invalidate(); return; } this.animateTo(p1, c, { ms: 420 }); }
  animateTo(pos, target, { ms = 420, onDone = null } = {}) { this._tween = { t0: performance.now(), ms, p0: this.camera.position.clone(), t0v: this.controls.target.clone(), p1: pos.clone(), t1: target.clone(), onDone }; this.invalidate(2); }
  _stepTween() { const tw = this._tween; if (!tw) return; const k = Math.max(0, Math.min(1, (performance.now() - tw.t0) / tw.ms)); const e = 1 - Math.pow(1 - k, 3); this.camera.position.lerpVectors(tw.p0, tw.p1, e); this.controls.target.lerpVectors(tw.t0v, tw.t1, e); this.invalidate(2); if (k >= 1) { this._tween = null; tw.onDone && tw.onDone(); } }
  get animating() { return !!this._tween; }
  // 表示スタイル: shaded-edges | shaded | ghost | wireframe
  setDisplayStyle(s) { this.displayStyle = s; this.applyDisplayStyle(); }
  applyDisplayStyle() {
    this.invalidate(); const s = this.displayStyle; this.clearEdges();
    this.modelRoot.traverse(o => { if (!o.isMesh || !o.material) return; if (!o.userData._mat) o.userData._mat = o.material; const base = o.userData._mat;
      if (s === 'shaded' || s === 'shaded-edges') o.material = base; else if (s === 'ghost') o.material = o.userData._ghost || (o.userData._ghost = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.6 })); else if (s === 'wireframe') o.material = o.userData._wire || (o.userData._wire = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true }));
      if (s === 'shaded-edges' || s === 'ghost') { const eg = o.userData._edges || (o.userData._edges = new THREE.EdgesGeometry(o.geometry, 24)); const ln = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1f2937, transparent: true, opacity: s === 'ghost' ? 0.8 : 0.5 })); o.updateWorldMatrix(true, false); ln.matrixAutoUpdate = false; ln.matrix.copy(o.matrixWorld); this.edgeRoot.add(ln); } });
    this._applyClipping();
  }
  // ---- 断面（クリッピング）: axis 'x'|'y'|'z'、t ∈ [0,1]（モデル範囲内の位置）。null で解除 ----
  setSection(axis, t = 0.5) { this.invalidate(); if (!axis) { this.sectionPlane = null; this._applyClipping(); return; } const box = new THREE.Box3().setFromObject(this.modelRoot); if (box.isEmpty()) return; const n = { x: V3(-1, 0, 0), y: V3(0, -1, 0), z: V3(0, 0, -1) }[axis]; const pos = box.min[axis] + (box.max[axis] - box.min[axis]) * t; this.sectionPlane = new THREE.Plane(n, pos); this._applyClipping(); }
  _applyClipping() { const p = this.sectionPlane ? [this.sectionPlane] : null; const mats = new Set(); this.modelRoot.traverse(o => { if (o.isMesh && o.material) mats.add(o.material); }); this.edgeRoot.traverse(o => { if (o.material) mats.add(o.material); }); this.overlayRoot.traverse(o => { if (o.material) mats.add(o.material); }); for (const m of mats) { m.clippingPlanes = p; m.clipShadows = !!p; if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) m.side = p ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; } }

  // ---- 検査オーバーレイ ----
  clearOverlays() { this.invalidate(); while (this.overlayRoot.children.length) { const c = this.overlayRoot.children[0]; this.overlayRoot.remove(c); c.traverse?.(o => { if (o.element?.parentNode) o.element.parentNode.removeChild(o.element); }); } this.overlays = new Map(); }
  clearProbes() { this.invalidate(); while (this.probeRoot.children.length) { const c = this.probeRoot.children[0]; this.probeRoot.remove(c); c.traverse?.(o => { if (o.element?.parentNode) o.element.parentNode.removeChild(o.element); }); } }
  _mat(status, k = 0.45) { const m = new THREE.MeshBasicMaterial({ color: STATUS_HEX[status] || STATUS_HEX.na, transparent: true, opacity: k, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); return m; }
  _cylMesh(spec, side, status, axis = 'y') { const off = side === 'in' ? -0.12 : 0.12; const r = Math.max(0.2, spec.r + off); const seg = Math.max(32, Math.min(96, Math.round(r * 6))); const g = spec.arc ? new THREE.CylinderGeometry(r, r, spec.h, seg, 1, true, spec.arc[0] + Math.PI / 2, spec.arc[1] - spec.arc[0]) : new THREE.CylinderGeometry(r, r, spec.h, seg, 1, true); g.translate(0, spec.h / 2, 0); const ax = spec.axis || axis; if (ax === 'x') g.rotateZ(-Math.PI / 2); if (ax === 'z') g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, this._mat(status, side === 'in' ? 0.45 : 0.28)); m.position.copy(spec.c); return m; }
  _featureMesh(F, status) {
    const grp = new THREE.Group();
    if (F.kind === 'cyl') grp.add(this._cylMesh(F, F.side, status, F.axis));
    else if (F.kind === 'cyls') for (const it of F.items) grp.add(this._cylMesh({ ...it, arc: F.arc }, F.side, status, it.axis || F.axis));
    else if (F.kind === 'plane') { const n = F.n.clone().normalize(); const g = F.round ? new THREE.CircleGeometry(F.w / 2, 64) : new THREE.PlaneGeometry(F.w, F.h); const m = new THREE.Mesh(g, this._mat(status, 0.22)); const ax = Math.abs(n.y) > 0.9 ? 'y' : Math.abs(n.x) > 0.9 ? 'x' : 'z'; if (ax === 'y') m.rotation.x = -Math.PI / 2; else if (ax === 'x') m.rotation.y = Math.PI / 2; m.position.copy(F.c).addScaledVector(n, 0.12); grp.add(m); }
    else if (F.kind === 'dist') { const col = STATUS_HEX[status] || STATUS_HEX.na; const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95 }); const a = F.a, b = F.b; const dir = V3().subVectors(b, a).normalize(); const up = Math.abs(dir.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0); const t = V3().crossVectors(dir, up).normalize().multiplyScalar(1.2); const pts = [a, b, a.clone().add(t), a.clone().sub(t), b.clone().add(t), b.clone().sub(t)]; grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat)); for (const p of [a, b]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: col })); s.position.copy(p); grp.add(s); } }
    return grp;
  }
  // entries: [{ no, feature, status, text, selected }]
  showFeatures(entries, { labels = true } = {}) {
    this.clearOverlays(); for (const e of entries) { const F = e.feature; if (!F) continue; const g = this._featureMesh(F, e.selected ? 'sel' : e.status); g.userData.no = e.no; g.visible = !!(e.selected || e.showAll); this.overlayRoot.add(g);
      if (labels && e.label !== false) { const el = document.createElement('div'); el.className = `v-callout ${e.status}${e.selected ? ' sel' : ''}`; el.innerHTML = `<span class="no">${e.no}</span>${e.text ? `<span class="tx">${e.text}</span>` : ''}`; el.addEventListener('click', ev => { ev.stopPropagation(); this.onPick?.(e.no); }); el.addEventListener('pointerdown', ev => ev.stopPropagation()); el.style.pointerEvents = 'auto'; const o = new CSS2DObject(el); o.position.copy(F.label || F.c || F.a); o.userData.no = e.no; this.overlayRoot.add(o); }
      this.overlays.set(e.no, g); }
    this._applyClipping(); this.invalidate();
  }
  setLabelsVisible(on) { this.overlayRoot.traverse(o => { if (o.isCSS2DObject) o.visible = on; }); this.invalidate(); }
  emphasize(no) { for (const [k, g] of this.overlays) { const sel = k === no; g.traverse(o => { if (o.isMesh && o.material?.color) { } }); g.visible = sel || g.userData.showAll; } this.overlayRoot.traverse(o => { if (o.isCSS2DObject) o.element.classList.toggle('sel', o.userData.no === no); }); this.invalidate(); }
  focusFeature(F, { fill = 0.45, ms = 480 } = {}) { if (!F) return; const c = (F.c || F.a || F.label).clone(); let size = 30; if (F.kind === 'cyl') { size = Math.max(F.r * 2, F.h); c.add(F.axis === 'x' ? V3(F.h / 2, 0, 0) : F.axis === 'z' ? V3(0, 0, F.h / 2) : V3(0, F.h / 2, 0)); } else if (F.kind === 'cyls') { const b = new THREE.Box3(); for (const it of F.items) b.expandByPoint(it.c); c.copy(b.getCenter(V3())); size = Math.max(40, b.getSize(V3()).length()); } else if (F.kind === 'dist') { c.lerpVectors(F.a, F.b, 0.5); size = Math.max(30, F.a.distanceTo(F.b)); } else if (F.kind === 'plane') size = Math.max(F.w, F.h);
    const r = Math.max(size, 12) * 0.5 / fill; const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)); let dir = V3().subVectors(this.camera.position, this.controls.target).normalize(); if (F.kind === 'cyl' && F.side === 'in') { const ax = F.axis === 'x' ? V3(1, 0, 0) : F.axis === 'z' ? V3(0, 0, 1) : V3(0, 1, 0); dir = ax.clone().multiplyScalar(0.85).add(dir.multiplyScalar(0.5)).normalize(); } const p1 = c.clone().add(dir.multiplyScalar(dist)); this.animateTo(p1, c, { ms }); }
  // プローブ点 + 偏差ベクトル（誇張表示）: entries [{ feature, dev, status }]
  showProbes(entries, { exag = 200, maxLen = 12 } = {}) {
    this.clearProbes(); const sph = new THREE.SphereGeometry(0.55, 12, 8);
    for (const e of entries) { const F = e.feature; if (!F || e.dev == null) continue; const col = STATUS_HEX[e.status] || STATUS_HEX.na; const mat = new THREE.MeshBasicMaterial({ color: col }); const lmat = new THREE.LineBasicMaterial({ color: col });
      const cyls = F.kind === 'cyl' ? [F] : F.kind === 'cyls' ? F.items.map(it => ({ ...it, side: F.side, axis: it.axis || F.axis })) : [];
      for (const cy of cyls) { const ax = cy.axis === 'x' ? V3(1, 0, 0) : cy.axis === 'z' ? V3(0, 0, 1) : V3(0, 1, 0); const u = Math.abs(ax.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0); const v = V3().crossVectors(ax, u).normalize(); const n = cyls.length > 2 ? 4 : 8; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rad = V3().addScaledVector(u, Math.cos(a)).addScaledVector(v, Math.sin(a)); const p = cy.c.clone().addScaledVector(ax, cy.h * 0.5).addScaledVector(rad, cy.r); const s = new THREE.Mesh(sph, mat); s.position.copy(p); this.probeRoot.add(s); const len = Math.max(-maxLen, Math.min(maxLen, (e.dev / 2) * exag)); const q = p.clone().addScaledVector(rad, len); this.probeRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, q]), lmat)); } }
      if (F.kind === 'plane') { const n = F.n.clone().normalize(); const u = Math.abs(n.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0); const v = V3().crossVectors(n, u).normalize(); for (const [i, j] of [[0, 0], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35], [-0.35, -0.35]]) { const p = F.c.clone().addScaledVector(u, i * F.w).addScaledVector(v, j * F.h); const s = new THREE.Mesh(sph, mat); s.position.copy(p); this.probeRoot.add(s); const len = Math.max(-maxLen, Math.min(maxLen, e.dev * exag * (i === 0 && j === 0 ? 1 : 0.5))); this.probeRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, p.clone().addScaledVector(n, len)]), lmat)); } }
      if (F.kind === 'dist') { for (const p of [F.a, F.b]) { const s = new THREE.Mesh(sph, mat); s.position.copy(p); this.probeRoot.add(s); } } }
    this.invalidate();
  }
  setOverlaysVisible(on) { this.overlayRoot.visible = on; this.probeRoot.visible = on; this.invalidate(); }
  // ---- ピッキング: 近い特徴の吹き出しをクリック扱い ----
  _bindPointer() { const el = this.renderer.domElement; let down = null; el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; this._tween = null; }); el.addEventListener('pointerup', e => { if (!down) return; const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = null; if (dx * dx + dy * dy > 16) return; const hit = this.pick(e); if (this.onPickPoint) this.onPickPoint(hit, e); }); el.addEventListener('wheel', () => { this._tween = null; }, { passive: true }); }
  pick(e) { const r = this.renderer.domElement.getBoundingClientRect(); this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera); const hits = this.raycaster.intersectObjects(this.modelRoot.children, true); return hits.length ? hits[0] : null; }
  // 点に最も近い特徴（アンカー距離）
  nearestFeature(point, features) { let best = null, bd = Infinity; for (const [k, F] of Object.entries(features)) { const pts = F.kind === 'cyl' ? [F.c.clone().addScaledVector(F.axis === 'x' ? V3(1, 0, 0) : F.axis === 'z' ? V3(0, 0, 1) : V3(0, 1, 0), F.h / 2)] : F.kind === 'cyls' ? F.items.map(i => i.c.clone().addScaledVector(i.axis === 'x' ? V3(1, 0, 0) : V3(0, 1, 0), i.h / 2)) : F.kind === 'plane' ? [F.c] : [F.a, F.b]; for (const p of pts) { const d = p.distanceTo(point) - (F.kind === 'cyl' ? F.r : F.kind === 'cyls' ? F.items[0].r : 0); if (d < bd) { bd = d; best = k; } } } return best; }
}
