// Revit-style datum annotations: level planes with tags, structural grid bubbles at piers,
// and the section box outline.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export function buildLevels(layerHeight, maxLayer, size = [900, 780]) {
  const g = new THREE.Group();
  const mat = new THREE.LineDashedMaterial({ color: 0x6fb7ff, dashSize: 6, gapSize: 4, transparent: true, opacity: 0.55 });
  const levels = [['GL ±0', 0]];
  for (let l = 1; l <= maxLayer; l++) levels.push([`Deck L${l}`, l * layerHeight]);
  levels.forEach(([name, y], i) => {
    // each level outline is slightly smaller than the one below so the tags fan out instead of stacking
    const w = size[0] - i * 70, h = size[1] - i * 60;
    const pts = [new THREE.Vector3(-w / 2, y, -h / 2), new THREE.Vector3(w / 2, y, -h / 2), new THREE.Vector3(w / 2, y, h / 2), new THREE.Vector3(-w / 2, y, h / 2), new THREE.Vector3(-w / 2, y, -h / 2)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    line.computeLineDistances();
    g.add(line);
    const el = document.createElement('div');
    el.className = 'level-tag';
    el.innerHTML = `<span class="tri">▽</span>${name}<small>${y >= 0 ? '+' : ''}${y.toFixed(3)}</small>`;
    const lab = new CSS2DObject(el);
    lab.position.set(w / 2, y, h / 2);
    g.add(lab);
  });
  return g;
}

export function buildGridBubbles(elements) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.5 });
  for (const e of elements) {
    if (e.type !== 'column') continue;
    const top = e.yTop + 2.2 + 6;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.x, -1, e.z), new THREE.Vector3(e.x, top, e.z)]), mat);
    g.add(line);
    const el = document.createElement('div');
    el.className = 'grid-bubble';
    el.textContent = e.tag.replace('P-', 'P');
    const lab = new CSS2DObject(el);
    lab.position.set(e.x, top, e.z);
    g.add(lab);
  }
  return g;
}

export class SectionBox {
  constructor() {
    this.min = new THREE.Vector3(-400, -3, -350);
    this.max = new THREE.Vector3(400, 45, 350);
    this.planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
    ];
    this.outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff9f43, transparent: true, opacity: 0.9 }));
    this.outline.visible = false;
    this.update();
  }
  update() {
    const { min, max } = this;
    this.planes[0].constant = -min.x; this.planes[1].constant = max.x;
    this.planes[2].constant = -min.y; this.planes[3].constant = max.y;
    this.planes[4].constant = -min.z; this.planes[5].constant = max.z;
    const c = [[min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, min.y, max.z], [min.x, min.y, max.z], [min.x, max.y, min.z], [max.x, max.y, min.z], [max.x, max.y, max.z], [min.x, max.y, max.z]];
    const idx = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    this.outline.geometry.setFromPoints(idx.map((i) => new THREE.Vector3(...c[i])));
  }
}
