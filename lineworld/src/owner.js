// The person at the end of the walk. Same rules as everything else: a handful
// of joints, a lantern, and no geometry that was not computed just now.

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import { DynamicLines, createLineMaterial } from './render.js';

const COL = new THREE.Color(1.0, 0.86, 0.62);
const DIM = new THREE.Color(0.62, 0.66, 0.74);

const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Owner {
  constructor(scene, x, z) {
    this.material = createLineMaterial();
    this.lines = new DynamicLines(160, this.material);
    this.root = new THREE.Object3D();
    this.root.position.set(x, terrainHeight(x, z), z);
    this.root.add(this.lines.mesh);
    this.root.visible = false;
    scene.add(this.root);

    this.pos = this.root.position.clone();
    this.kneel = 0;
    this.lanternWorld = new THREE.Vector3();
    this.handWorld = new THREE.Vector3();
    this.visible = false;
    this.time = 0;
  }

  reveal() {
    this.visible = true;
    this.root.visible = true;
  }

  lookAt(target) {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    const want = Math.atan2(dx, dz);
    let d = want - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * 0.06;
  }

  update(dt) {
    if (!this.visible) return;
    this.time += dt;
    this.root.updateMatrixWorld(true);

    const L = this.lines;
    L.reset();
    const k = this.kneel;
    const sway = Math.sin(this.time * 0.9) * 0.012;

    const hip = V(0, lerp(0.94, 0.62, k), lerp(0, 0.06, k));
    const sho = V(sway, lerp(1.50, 1.16, k), lerp(0, 0.02, k));
    const head = V(sway * 1.5, lerp(1.70, 1.36, k), lerp(0.01, 0.05, k));

    // legs
    for (const side of [-1, 1]) {
      const h = V(hip.x + side * 0.11, hip.y, hip.z);
      const knee = side > 0
        ? V(h.x, lerp(0.52, 0.34, k), lerp(0.05, 0.44, k))
        : V(h.x, lerp(0.52, 0.14, k), lerp(0.05, -0.10, k));
      const foot = side > 0
        ? V(h.x, 0.02, lerp(0.02, 0.46, k))
        : V(h.x, 0.02, lerp(0.02, -0.34, k));
      L.segment(h, knee, COL);
      L.segment(knee, foot, COL);
      L.segment(foot, V(foot.x, foot.y, foot.z + 0.14), DIM);
    }
    L.segment(V(hip.x - 0.11, hip.y, hip.z), V(hip.x + 0.11, hip.y, hip.z), COL);

    // torso: two rails plus rungs, so it reads as volume
    for (const side of [-1, 1]) {
      L.segment(V(hip.x + side * 0.10, hip.y, hip.z), V(sho.x + side * 0.19, sho.y, sho.z), COL);
    }
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const y = lerp(hip.y, sho.y, t);
      const w = lerp(0.10, 0.19, t);
      const z = lerp(hip.z, sho.z, t);
      L.segment(V(-w, y, z), V(w, y, z), DIM);
    }
    L.segment(V(sho.x - 0.19, sho.y, sho.z), V(sho.x + 0.19, sho.y, sho.z), COL);
    L.segment(sho, head, COL);

    // head: two rings
    const r = 0.115;
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2, a1 = ((i + 1) / 10) * Math.PI * 2;
      L.segment(
        V(head.x + Math.cos(a0) * r, head.y + Math.sin(a0) * r, head.z),
        V(head.x + Math.cos(a1) * r, head.y + Math.sin(a1) * r, head.z), COL);
      L.segment(
        V(head.x, head.y + Math.sin(a0) * r, head.z + Math.cos(a0) * r),
        V(head.x, head.y + Math.sin(a1) * r, head.z + Math.cos(a1) * r), DIM);
    }

    // arms -- the right one holds the lantern out, low
    const armReach = lerp(0.0, 0.26, k);
    for (const side of [-1, 1]) {
      const s = V(sho.x + side * 0.19, sho.y, sho.z);
      const elbow = V(s.x + side * 0.06, sho.y - 0.28, sho.z + 0.08 + armReach * 0.4);
      const hand = side > 0
        ? V(s.x + side * 0.02, sho.y - 0.50 - k * 0.06, sho.z + 0.16 + armReach)
        : V(s.x + side * 0.04, sho.y - 0.52, sho.z + 0.04);
      L.segment(s, elbow, COL);
      L.segment(elbow, hand, COL);
      if (side > 0) {
        const lc = V(hand.x, hand.y - 0.30, hand.z);
        L.segment(hand, lc, COL);
        // lantern cage
        const hx = 0.085, hy = 0.105, hz = 0.085;
        const c = [];
        for (let i = 0; i < 8; i++) {
          c.push(V(lc.x + (i & 1 ? hx : -hx), lc.y + (i & 2 ? hy : -hy), lc.z + (i & 4 ? hz : -hz)));
        }
        const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (const [a, b] of E) L.segment(c[a], c[b], COL);
        this.lanternWorld.copy(lc).applyMatrix4(this.root.matrixWorld);
        this.handWorld.copy(hand).applyMatrix4(this.root.matrixWorld);
      }
    }

    L.commit();
  }
}
