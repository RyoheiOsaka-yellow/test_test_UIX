import * as THREE from 'three';
import { createCrystalGeometry, createShardGeometry } from '../assets/ProceduralGeometry.js';
import { createIceMaterial, syncIceMaterial } from '../materials/IceMaterial.js';

/**
 * A field of ice.
 *
 * One instanced draw call holds every crystal on screen. Placement goes into the
 * instance matrix once, at spawn; the *animation* — the tear out of the floor,
 * the overshoot, the hold and the sink — lives entirely in the vertex shader,
 * driven by a per-instance birth time and delay. After a cast is fired the CPU
 * never touches a crystal again.
 *
 * Frost Lance and Glacier Crown share this class; they differ only in which
 * geometry variant they ask for and what they write into the instance matrix.
 */
export class CrystalField {
  constructor(scene, { capacity = 320, variant = 'crystal', params, timing, seed = 1 }) {
    this.capacity = capacity;
    this.cursor = 0;

    const base =
      variant === 'shard'
        ? createShardGeometry({ seed })
        : createCrystalGeometry({ seed, sides: 6, rings: 5 });

    // A handful of distinct silhouettes, chosen per instance, so a dense field
    // never shows the same crystal twice side by side.
    this.variants = [];
    for (let i = 0; i < 4; i++) {
      this.variants.push(
        variant === 'shard'
          ? createShardGeometry({ seed: seed + i * 17, sides: 5 + (i % 2) })
          : createCrystalGeometry({
              seed: seed + i * 29,
              sides: 5 + (i % 3),
              taper: 1.8 + i * 0.32,
              jitter: 0.24 + i * 0.06,
              bend: 0.1 + i * 0.05,
            })
      );
    }
    base.dispose();

    this.material = createIceMaterial(params);
    this.timing = timing;

    // One instanced mesh per silhouette; they share the material and the
    // per-instance animation attributes are allocated round-robin across them.
    this.meshes = this.variants.map((geo) => {
      const geometry = geo;
      const mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      // The rise is a vertex-shader animation the shadow depth pass does not
      // share, so a crystal would cast its full-height shadow before it exists.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.count = capacity;

      const aBirth = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      const aDelay = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      const aSeed = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      const aHeight = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      aBirth.setUsage(THREE.DynamicDrawUsage);
      aDelay.setUsage(THREE.DynamicDrawUsage);
      aBirth.array.fill(-1e6);
      aHeight.array.fill(1);

      geometry.setAttribute('aBirth', aBirth);
      geometry.setAttribute('aDelay', aDelay);
      geometry.setAttribute('aSeed', aSeed);
      geometry.setAttribute('aHeight', aHeight);

      // Everything starts collapsed at the origin and invisible.
      const m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
      for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, m);
      mesh.instanceMatrix.needsUpdate = true;

      scene.add(mesh);
      return { mesh, geometry, aBirth, aDelay, aSeed, aHeight, cursor: 0 };
    });

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /**
   * Plant one crystal.
   *
   * @param {THREE.Vector3} position  where it comes out of the floor
   * @param {object} o  { scale, height, yaw, tilt, tiltDir, birth, delay }
   */
  plant(position, o) {
    const slot = this.meshes[this.cursor % this.meshes.length];
    this.cursor++;
    const i = slot.cursor % this.capacity;
    slot.cursor++;

    const scale = o.scale ?? 1;
    const tilt = o.tilt ?? 0;
    const tiltDir = o.tiltDir ?? Math.random() * Math.PI * 2;

    this._e.set(Math.cos(tiltDir) * tilt, o.yaw ?? 0, Math.sin(tiltDir) * tilt, 'YXZ');
    this._q.setFromEuler(this._e);
    this._p.copy(position);
    this._s.set(scale, scale, scale);
    this._m.compose(this._p, this._q, this._s);
    slot.mesh.setMatrixAt(i, this._m);
    slot.mesh.instanceMatrix.needsUpdate = true;

    slot.aBirth.array[i] = o.birth ?? 0;
    slot.aDelay.array[i] = o.delay ?? 0;
    slot.aSeed.array[i] = Math.random();
    slot.aHeight.array[i] = o.height ?? 1;
    slot.aBirth.needsUpdate = true;
    slot.aDelay.needsUpdate = true;
    slot.aSeed.needsUpdate = true;
    slot.aHeight.needsUpdate = true;
  }

  /** Push slider values into the shared ice material. */
  sync(params, timing) {
    syncIceMaterial(this.material, params, timing ?? this.timing);
  }

  clear() {
    for (const slot of this.meshes) {
      slot.aBirth.array.fill(-1e6);
      slot.aBirth.needsUpdate = true;
      slot.cursor = 0;
    }
    this.cursor = 0;
  }
}
