import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** Two-click distance measurement rendered as a Revit-style dimension (ticks + mm label). */
export class Measure {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pending = null;
    this.mat = new THREE.LineBasicMaterial({ color: 0xffd54f, depthTest: false, transparent: true });
    this.markerGeo = new THREE.SphereGeometry(0.35, 10, 8);
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffd54f, depthTest: false });
    this.items = [];
  }
  addPoint(p) {
    const m = new THREE.Mesh(this.markerGeo, this.markerMat);
    m.position.copy(p); m.renderOrder = 10;
    this.group.add(m);
    if (!this.pending) { this.pending = { a: p.clone(), ma: m }; return null; }
    const a = this.pending.a, b = p.clone();
    const d = a.distanceTo(b), dh = Math.abs(b.y - a.y), dxy = Math.hypot(b.x - a.x, b.z - a.z);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, this.mat); line.renderOrder = 10;
    // tick marks perpendicular to the dimension line (horizontal)
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(0.8);
    if (side.lengthSq() < 1e-6) side.set(0.8, 0, 0);
    const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a.clone().sub(side), a.clone().add(side), b.clone().sub(side), b.clone().add(side)]), this.mat);
    ticks.renderOrder = 10;
    const el = document.createElement('div');
    el.className = 'dim-label';
    el.innerHTML = `<b>${Math.round(d * 1000).toLocaleString()}</b> mm<span>水平 ${dxy.toFixed(2)} m · 高低差 ${dh.toFixed(2)} m</span>`;
    const label = new CSS2DObject(el);
    label.position.copy(a).lerp(b, 0.5);
    this.group.add(line, ticks, label);
    this.items.push({ a, b, d, nodes: [this.pending.ma, m, line, ticks, label] });
    this.pending = null;
    return d;
  }
  clear() {
    while (this.group.children.length) { const c = this.group.children.pop(); if (c.element) c.element.remove(); this.group.remove(c); }
    this.pending = null; this.items = [];
  }
}
