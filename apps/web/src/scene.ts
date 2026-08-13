import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  halfBreadthAt,
  verticalInShip,
  type Entity,
  type HullEntityData,
  type Station,
  type TankEntityData,
  type VesselEntityData,
} from '@dock/shared';
import { buildHullGeometry } from './geometry.js';

/** Box coordinates of a tank, in hull axes. */
export interface TankBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export type GizmoMode = 'off' | 'translate' | 'scale';

export type ViewPreset = 'iso' | 'side' | 'front' | 'top';

export interface LayerVisibility {
  hull: boolean;
  frames: boolean;
  tanks: boolean;
  labels: boolean;
  water: boolean;
}

/** Attitude of the free-surface plane, as solved by the L1 engine. */
export interface WaterAttitude {
  heelDeg: number;
  trimDeg: number;
  /** waterplane constant in hull coordinates: immersed where u·p ≤ c */
  waterlineConstant: number;
}

export const FLUID_COLORS: Record<string, number> = {
  ballast: 0x5b8def,
  fuel: 0xc58330,
  fresh: 0x2fa895,
  other: 0x8a93a6,
};

export function fluidKey(name: string): keyof typeof FLUID_COLORS {
  const n = name.toLowerCase();
  if (n.includes('ballast') || n.includes('sea')) return 'ballast';
  if (n.includes('fuel') || n.includes('oil') || n.includes('hfo')) return 'fuel';
  if (n.includes('fresh')) return 'fresh';
  return 'other';
}

const SELECT_COLOR = 0xf0f4fa;

interface TankVisual {
  group: THREE.Group;
  shell: THREE.Mesh;
  edges: THREE.LineSegments;
  fill: THREE.Mesh;
  data: TankEntityData;
}

export class DockScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private shipRoot = new THREE.Group();
  private hullGroup = new THREE.Group();
  private tankGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private water: THREE.Mesh | null = null;
  private waterGrid: THREE.GridHelper | null = null;
  private tanks = new Map<string, TankVisual>();
  private selectedId: string | null = null;
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private lpp = 100;
  private depth = 12;
  private beam = 20;
  private attitude: WaterAttitude = { heelDeg: 0, trimDeg: 0, waterlineConstant: 0 };
  private hullStations: Station[] = [];
  private layers: LayerVisibility = {
    hull: true,
    frames: true,
    tanks: true,
    labels: true,
    water: true,
  };
  private clipX: number | null = null;
  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private clippableMaterials: THREE.Material[] = [];
  private frameObjects: THREE.Object3D[] = [];
  private sectionOutline: THREE.Object3D | null = null;

  // --- drag editing ---
  private gizmo: TransformControls;
  private gizmoHelper: THREE.Object3D;
  private dragProxy = new THREE.Object3D();
  private gizmoMode: GizmoMode = 'off';
  private dragBase: TankBox | null = null;
  private dragging = false;

  onSelect: (id: string | null) => void = () => undefined;
  /** Fired continuously while dragging, so the panel can show live values. */
  onDragPreview: (id: string, box: TankBox) => void = () => undefined;
  /** Fired once when the drag ends, to turn the change into a transaction. */
  onDragCommit: (id: string, box: TankBox) => void = () => undefined;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0f1722);
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
    this.camera.position.set(-70, 55, 130);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    const hemi = new THREE.HemisphereLight(0xdce8ff, 0x1a2433, 0.9);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-80, 120, 90);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(120, 40, -80);
    this.scene.add(rim);

    // The ship hangs off a root group that carries the floating attitude, so
    // the sea stays level and the vessel heels — the way it looks from a quay,
    // rather than the ship-fixed frame the solver works in.
    this.shipRoot.add(this.hullGroup, this.tankGroup, this.ghostGroup, this.dragProxy);
    this.scene.add(this.shipRoot);
    this.scene.fog = new THREE.Fog(0x0f1722, 400, 1400);

    // Drag editing. The gizmo drives a proxy object; the tank box is derived
    // from the proxy's transform so the authoritative numbers stay in metres.
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setTranslationSnap(0.5);
    this.gizmo.setScaleSnap(0.05);
    this.gizmo.setSize(0.8);
    // local space keeps the handles on the ship's own axes when she is heeled
    this.gizmo.setSpace('local');
    this.gizmoHelper = this.gizmo.getHelper();
    this.gizmoHelper.visible = false;
    this.scene.add(this.gizmoHelper);

    this.gizmo.addEventListener('dragging-changed', (e) => {
      const active = Boolean((e as unknown as { value: boolean }).value);
      this.controls.enabled = !active;
      this.dragging = active;
      if (!active && this.selectedId && this.dragBase) {
        this.onDragCommit(this.selectedId, this.boxFromProxy());
      }
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (!this.selectedId || !this.dragBase) return;
      const box = this.boxFromProxy();
      this.setGhost({ ...this.tanks.get(this.selectedId)!.data, ...box });
      this.onDragPreview(this.selectedId, box);
    });

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      (this.renderer.domElement as HTMLElement).dataset.downAt = `${e.clientX},${e.clientY}`;
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const down = (this.renderer.domElement as HTMLElement).dataset.downAt;
      if (!down) return;
      const [dx, dy] = down.split(',').map(Number);
      if (Math.hypot(e.clientX - dx, e.clientY - dy) > 4) return; // it was a drag
      if (this.dragging || this.gizmo.axis) return; // the gizmo owns this click
      this.pick(e);
    });

    const loop = () => {
      if (this.disposed) return;
      requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    };
    this.resize();
    loop();
    window.addEventListener('resize', this.resize);
  }

  resize = (): void => {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }

  private pick(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const shells = [...this.tanks.values()].map((t) => t.shell);
    const hit = this.raycaster.intersectObjects(shells, false)[0];
    this.onSelect(hit ? (hit.object.userData.semanticId as string) : null);
  }

  /** CSS2D label DOM nodes are not removed by Group.clear() — do it explicitly. */
  private clearGroup(group: THREE.Group): void {
    group.traverse((o) => {
      const el = (o as Partial<CSS2DObject>).element;
      if (el instanceof HTMLElement) el.remove();
    });
    group.clear();
  }

  /** Rebuild the whole model from an entity snapshot. */
  setModel(entities: Entity[]): void {
    this.clearGroup(this.hullGroup);
    this.clearGroup(this.tankGroup);
    this.tanks.clear();
    this.clippableMaterials = [];
    this.frameObjects = [];

    const vessel = entities.find((e) => e.kind === 'vessel')?.data as VesselEntityData | undefined;
    const hull = entities.find((e) => e.kind === 'hull')?.data as HullEntityData | undefined;
    if (vessel) {
      this.lpp = vessel.principal.lpp;
      this.depth = vessel.principal.depth;
      this.beam = vessel.principal.beam;
    }
    this.hullStations = hull?.geometry.stations ?? [];

    if (hull) {
      const { surface, stationLines, deckLine } = buildHullGeometry(hull.geometry);
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0x39465c,
        metalness: 0.35,
        roughness: 0.45,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.clippableMaterials.push(shellMat);
      const mesh = new THREE.Mesh(surface, shellMat);
      mesh.renderOrder = 2;
      mesh.userData.layer = 'hull';
      this.hullGroup.add(mesh);

      const frameMat = new THREE.LineBasicMaterial({
        color: 0x5d6b82,
        transparent: true,
        opacity: 0.55,
      });
      this.clippableMaterials.push(frameMat);
      const frames = new THREE.LineSegments(stationLines, frameMat);
      this.frameObjects.push(frames);
      this.hullGroup.add(frames);

      const deckMat = new THREE.LineBasicMaterial({
        color: 0x9fb2cc,
        transparent: true,
        opacity: 0.9,
      });
      this.clippableMaterials.push(deckMat);
      const deck = new THREE.LineSegments(deckLine, deckMat);
      deck.userData.layer = 'hull';
      this.hullGroup.add(deck);

      // baseline + perpendicular ticks
      const marks = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(this.lpp, 0, 0),
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, this.depth + 2, 0),
        new THREE.Vector3(this.lpp, 0, 0), new THREE.Vector3(this.lpp, this.depth + 2, 0),
      ]);
      this.hullGroup.add(
        new THREE.LineSegments(
          marks,
          new THREE.LineBasicMaterial({ color: 0x44506a, transparent: true, opacity: 0.8 }),
        ),
      );
    }

    for (const e of entities) {
      if (e.kind !== 'tank') continue;
      this.addTank(e.id, e.data as TankEntityData);
    }

    this.buildWater();
    this.applySelection();
    this.syncGizmo();
    this.applyLayers();
    this.applyClip();
  }

  // -------------------------------------------------------------------------
  // Layers, clip section, view presets
  // -------------------------------------------------------------------------

  setVisibility(patch: Partial<LayerVisibility>): void {
    this.layers = { ...this.layers, ...patch };
    this.applyLayers();
  }

  private applyLayers(): void {
    for (const obj of this.hullGroup.children) {
      if (obj.userData.layer === 'hull') obj.visible = this.layers.hull;
    }
    for (const f of this.frameObjects) f.visible = this.layers.frames;
    this.tankGroup.visible = this.layers.tanks;
    this.labelRenderer.domElement.style.display = this.layers.labels ? '' : 'none';
    if (this.water) this.water.visible = this.layers.water;
    if (this.waterGrid) this.waterGrid.visible = this.layers.water;
  }

  /** Longitudinal clip: keep the part aft of x, and outline the cut section. */
  setClipX(x: number | null): void {
    this.clipX = x;
    this.applyClip();
  }

  private applyClip(): void {
    if (this.sectionOutline) {
      this.shipRoot.remove(this.sectionOutline);
      this.sectionOutline = null;
    }
    const x = this.clipX;
    if (x === null) {
      for (const m of this.clippableMaterials) m.clippingPlanes = null;
      return;
    }
    // the plane lives on the ship, so transform it with the ship's attitude
    this.clipPlane.set(new THREE.Vector3(-1, 0, 0), x);
    const world = this.clipPlane
      .clone()
      .applyMatrix4(this.shipRoot.matrixWorld);
    for (const m of this.clippableMaterials) m.clippingPlanes = [world];

    // exact section outline at the cut, sampled from the offsets table
    const st = this.hullStations;
    if (st.length >= 2 && x > st[0].x && x < st[st.length - 1].x) {
      let i = 0;
      while (i < st.length - 2 && st[i + 1].x < x) i++;
      const a = st[i];
      const b = st[i + 1];
      const t = (x - a.x) / (b.x - a.x);
      const zTop =
        a.offsets[a.offsets.length - 1].z * (1 - t) +
        b.offsets[b.offsets.length - 1].z * t;
      const pts: THREE.Vector3[] = [];
      const N = 32;
      for (let j = 0; j <= N; j++) {
        const z = (zTop * j) / N;
        const y = halfBreadthAt(a, z) * (1 - t) + halfBreadthAt(b, z) * t;
        pts.push(new THREE.Vector3(x, z, y));
      }
      for (let j = N; j >= 0; j--) {
        const p = pts[j];
        pts.push(new THREE.Vector3(x, p.y, -p.z));
      }
      const outline = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xf0f4fa }),
      );
      this.sectionOutline = outline;
      this.shipRoot.add(outline);
    }
  }

  /** Standard drafting views, framed on the vessel. */
  setView(view: ViewPreset): void {
    const q = this.shipRoot.quaternion;
    const target = new THREE.Vector3(this.lpp / 2, this.depth * 0.45, 0).applyQuaternion(q);
    const d = this.lpp * 1.05;
    const offsets: Record<ViewPreset, THREE.Vector3> = {
      iso: new THREE.Vector3(-this.lpp * 0.2, this.depth * 2.7, this.lpp * 0.62),
      side: new THREE.Vector3(0, this.depth * 0.4, d),
      front: new THREE.Vector3(d, this.depth * 0.6, 0),
      top: new THREE.Vector3(0.001, d, 0),
    };
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offsets[view]);
  }

  private addTank(id: string, t: TankEntityData): void {
    const group = new THREE.Group();
    const color = FLUID_COLORS[fluidKey(t.fluid.name)];

    const dims = { l: t.x1 - t.x0, b: t.y1 - t.y0, h: t.z1 - t.z0 };
    const cx = (t.x0 + t.x1) / 2;
    const cy = (t.y0 + t.y1) / 2;
    const cz = (t.z0 + t.z1) / 2;

    const shellGeom = new THREE.BoxGeometry(dims.l, dims.h, dims.b);
    const shellMat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.clippableMaterials.push(shellMat);
    const shell = new THREE.Mesh(shellGeom, shellMat);
    shell.position.set(cx, cz, cy);
    shell.userData.semanticId = id;
    shell.renderOrder = 1;

    const edgeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    this.clippableMaterials.push(edgeMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeom), edgeMat);
    edges.position.copy(shell.position);

    // fluid volume — box tank, so fill height is linear in fill percent
    const fillRatio = Math.min(100, Math.max(0, t.fillPercent)) / 100;
    const fillH = Math.max(dims.h * fillRatio, 0.02);
    const fillMat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      metalness: 0.1,
      roughness: 0.35,
    });
    this.clippableMaterials.push(fillMat);
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(dims.l * 0.985, fillH, dims.b * 0.985),
      fillMat,
    );
    fill.position.set(cx, t.z0 + fillH / 2, cy);
    fill.visible = fillRatio > 0.001;

    const labelEl = document.createElement('div');
    labelEl.className = 'tank-label';
    labelEl.textContent = `${id.replace(/^tank:/, '')} ${t.fillPercent}%`;
    const label = new CSS2DObject(labelEl);
    label.position.set(cx, t.z1 + 0.6, cy);
    group.add(shell, edges, fill, label);

    this.tankGroup.add(group);
    this.tanks.set(id, { group, shell, edges, fill, data: t });
  }

  private buildWater(): void {
    if (this.water) this.scene.remove(this.water);
    if (this.waterGrid) this.scene.remove(this.waterGrid);
    // Kept close to the hull: a sea that runs to the horizon pulls the eye off
    // the vessel, which is the subject.
    const w = this.lpp * 1.9;
    const d = this.lpp * 1.1;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x123a5e,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.water.renderOrder = 0;
    this.scene.add(this.water);

    this.waterGrid = new THREE.GridHelper(w, 19, 0x24405f, 0x18293c);
    (this.waterGrid.material as THREE.Material).transparent = true;
    (this.waterGrid.material as THREE.Material).opacity = 0.55;
    this.scene.add(this.waterGrid);
    this.setWaterAttitude(this.attitude);
  }

  /** Even-keel water surface at a given draft (the L0 view). */
  setDraft(draft: number): void {
    this.setWaterAttitude({ heelDeg: 0, trimDeg: 0, waterlineConstant: draft });
  }

  /**
   * Show the vessel at a solved floating attitude.
   *
   * The engine works in ship coordinates, where a point is immersed when
   * u·p ≤ c. Rotating the ship by the transform that carries u onto world "up"
   * turns that into the view from outside: the sea is a level plane at height
   * c, and the vessel sits in it at its true heel and trim.
   */
  setWaterAttitude(att: WaterAttitude): void {
    this.attitude = att;
    const u = verticalInShip((att.heelDeg * Math.PI) / 180, (att.trimDeg * Math.PI) / 180);
    // hull (x, y, z) → three (x, z, y)
    const n = new THREE.Vector3(u.x, u.z, u.y).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    this.shipRoot.quaternion.setFromUnitVectors(n, up);
    this.shipRoot.updateMatrixWorld(true);
    this.applyClip(); // the clip plane rides on the ship

    const centre = new THREE.Vector3(this.lpp / 2, 0, 0).applyQuaternion(
      this.shipRoot.quaternion,
    );
    if (this.water) {
      this.water.position.set(centre.x, att.waterlineConstant, centre.z);
      this.water.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    }
    if (this.waterGrid) {
      this.waterGrid.position.set(centre.x, att.waterlineConstant, centre.z);
      this.waterGrid.quaternion.identity();
    }
  }

  // -------------------------------------------------------------------------
  // Drag editing
  // -------------------------------------------------------------------------

  setGizmoMode(mode: GizmoMode): void {
    this.gizmoMode = mode;
    this.syncGizmo();
  }

  /** Snap the gizmo back to the committed geometry after a rejected drag. */
  resetDrag(): void {
    this.setGhost(null);
    this.syncGizmo();
  }

  /** Committed box of a tank, as currently projected. */
  tankBox(id: string): TankBox | null {
    const d = this.tanks.get(id)?.data;
    if (!d) return null;
    return { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, z0: d.z0, z1: d.z1 };
  }

  private syncGizmo(): void {
    const tank = this.selectedId ? this.tanks.get(this.selectedId) : undefined;
    if (!tank || this.gizmoMode === 'off') {
      this.gizmo.detach();
      this.gizmoHelper.visible = false;
      this.dragBase = null;
      return;
    }
    const d = tank.data;
    this.dragBase = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1, z0: d.z0, z1: d.z1 };
    this.dragProxy.position.set((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, (d.y0 + d.y1) / 2);
    this.dragProxy.scale.set(1, 1, 1);
    this.dragProxy.updateMatrixWorld();
    this.gizmo.attach(this.dragProxy);
    this.gizmo.setMode(this.gizmoMode);
    this.gizmoHelper.visible = true;
  }

  /** Tank box implied by the proxy's current position and scale. */
  private boxFromProxy(): TankBox {
    const b = this.dragBase!;
    const halfX = ((b.x1 - b.x0) / 2) * this.dragProxy.scale.x;
    const halfZ = ((b.z1 - b.z0) / 2) * this.dragProxy.scale.y;
    const halfY = ((b.y1 - b.y0) / 2) * this.dragProxy.scale.z;
    const cx = this.dragProxy.position.x;
    const cz = this.dragProxy.position.y;
    const cy = this.dragProxy.position.z;
    const min = 0.05;
    const hx = Math.max(min, halfX);
    const hy = Math.max(min, halfY);
    const hz = Math.max(min, halfZ);
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      x0: r(cx - hx), x1: r(cx + hx),
      y0: r(cy - hy), y1: r(cy + hy),
      z0: r(cz - hz), z1: r(cz + hz),
    };
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.applySelection();
    this.syncGizmo();
  }

  private applySelection(): void {
    for (const [id, t] of this.tanks) {
      const isSel = id === this.selectedId;
      (t.edges.material as THREE.LineBasicMaterial).color.set(
        isSel ? SELECT_COLOR : FLUID_COLORS[fluidKey(t.data.fluid.name)],
      );
      (t.shell.material as THREE.MeshStandardMaterial).opacity = isSel ? 0.22 : 0.12;
      (t.edges.material as THREE.LineBasicMaterial).opacity = isSel ? 1 : 0.9;
    }
  }

  /** Ghost box visualizing a previewed (uncommitted) tank change. */
  setGhost(tank: TankEntityData | null): void {
    this.ghostGroup.clear();
    if (!tank) return;
    const dims = { l: tank.x1 - tank.x0, b: tank.y1 - tank.y0, h: tank.z1 - tank.z0 };
    const geom = new THREE.BoxGeometry(dims.l, dims.h, dims.b);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineDashedMaterial({ color: 0xf0f4fa, dashSize: 1.2, gapSize: 0.8 }),
    );
    edges.computeLineDistances();
    edges.position.set((tank.x0 + tank.x1) / 2, (tank.z0 + tank.z1) / 2, (tank.y0 + tank.y1) / 2);
    const fillRatio = Math.min(100, Math.max(0, tank.fillPercent)) / 100;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(dims.l, Math.max(dims.h * fillRatio, 0.02), dims.b),
      new THREE.MeshBasicMaterial({ color: 0xf0f4fa, transparent: true, opacity: 0.18 }),
    );
    fill.position.set(
      (tank.x0 + tank.x1) / 2,
      tank.z0 + (dims.h * fillRatio) / 2,
      (tank.y0 + tank.y1) / 2,
    );
    this.ghostGroup.add(edges, fill);
  }

  focusTank(id: string): void {
    const t = this.tanks.get(id);
    if (!t) return;
    this.controls.target.copy(t.shell.getWorldPosition(new THREE.Vector3()));
  }

  setHome(): void {
    const target = new THREE.Vector3(this.lpp / 2, this.depth * 0.45, 0).applyQuaternion(
      this.shipRoot.quaternion,
    );
    this.controls.target.copy(target);
    this.camera.position
      .set(-this.lpp * 0.2, this.depth * 2.7, this.lpp * 0.62)
      .add(target)
      .sub(new THREE.Vector3(this.lpp / 2, this.depth * 0.45, 0));
  }
}
