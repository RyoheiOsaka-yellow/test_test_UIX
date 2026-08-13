import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type {
  Entity,
  HullEntityData,
  TankEntityData,
  VesselEntityData,
} from '@dock/shared';
import { buildHullGeometry } from './geometry.js';

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

  onSelect: (id: string | null) => void = () => undefined;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0f1722);
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

    this.scene.add(this.hullGroup, this.tankGroup, this.ghostGroup);
    this.scene.fog = new THREE.Fog(0x0f1722, 400, 1400);

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      (this.renderer.domElement as HTMLElement).dataset.downAt = `${e.clientX},${e.clientY}`;
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const down = (this.renderer.domElement as HTMLElement).dataset.downAt;
      if (!down) return;
      const [dx, dy] = down.split(',').map(Number);
      if (Math.hypot(e.clientX - dx, e.clientY - dy) > 4) return; // it was a drag
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

    const vessel = entities.find((e) => e.kind === 'vessel')?.data as VesselEntityData | undefined;
    const hull = entities.find((e) => e.kind === 'hull')?.data as HullEntityData | undefined;
    if (vessel) {
      this.lpp = vessel.principal.lpp;
      this.depth = vessel.principal.depth;
    }

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
      const mesh = new THREE.Mesh(surface, shellMat);
      mesh.renderOrder = 2;
      this.hullGroup.add(mesh);

      this.hullGroup.add(
        new THREE.LineSegments(
          stationLines,
          new THREE.LineBasicMaterial({ color: 0x5d6b82, transparent: true, opacity: 0.55 }),
        ),
      );
      this.hullGroup.add(
        new THREE.LineSegments(
          deckLine,
          new THREE.LineBasicMaterial({ color: 0x9fb2cc, transparent: true, opacity: 0.9 }),
        ),
      );

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
  }

  private addTank(id: string, t: TankEntityData): void {
    const group = new THREE.Group();
    const color = FLUID_COLORS[fluidKey(t.fluid.name)];

    const dims = { l: t.x1 - t.x0, b: t.y1 - t.y0, h: t.z1 - t.z0 };
    const cx = (t.x0 + t.x1) / 2;
    const cy = (t.y0 + t.y1) / 2;
    const cz = (t.z0 + t.z1) / 2;

    const shellGeom = new THREE.BoxGeometry(dims.l, dims.h, dims.b);
    const shell = new THREE.Mesh(
      shellGeom,
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    shell.position.set(cx, cz, cy);
    shell.userData.semanticId = id;
    shell.renderOrder = 1;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeom),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    edges.position.copy(shell.position);

    // fluid volume — box tank, so fill height is linear in fill percent
    const fillRatio = Math.min(100, Math.max(0, t.fillPercent)) / 100;
    const fillH = Math.max(dims.h * fillRatio, 0.02);
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(dims.l * 0.985, fillH, dims.b * 0.985),
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        metalness: 0.1,
        roughness: 0.35,
      }),
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
    const w = this.lpp * 3.2;
    const d = this.lpp * 1.8;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: 0x123a5e,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(this.lpp / 2, 0, 0);
    this.water.renderOrder = 0;
    this.scene.add(this.water);

    this.waterGrid = new THREE.GridHelper(w, 32, 0x2a4d74, 0x1c3352);
    this.scene.add(this.waterGrid);
  }

  setDraft(draft: number): void {
    if (this.water) this.water.position.y = draft;
    if (this.waterGrid) this.waterGrid.position.y = draft;
    if (this.waterGrid) this.waterGrid.position.x = this.lpp / 2;
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.applySelection();
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
    const p = t.shell.position;
    this.controls.target.lerp(new THREE.Vector3(p.x, p.y, p.z), 1);
  }

  setHome(): void {
    this.controls.target.set(this.lpp / 2, this.depth / 2, 0);
    this.camera.position.set(-this.lpp * 0.55, this.depth * 4.5, this.lpp * 1.1);
  }
}
