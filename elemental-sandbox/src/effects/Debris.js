import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { createChunkGeometry } from '../assets/ProceduralGeometry.js';
import { rng } from '../utils/math.js';

/**
 * Shattered chunks thrown across the floor.
 *
 * Real geometry, but simulated exactly like the particles are: the CPU writes a
 * launch velocity and a birth time, and the vertex shader integrates the throw,
 * solves for the landing time in closed form, plants the chunk on the floor and
 * lets it slide to a stop. Spin is a per-instance axis rotation built in the
 * shader too, so nothing here needs a matrix update after it is fired.
 */
export class Debris {
  constructor(scene, { capacity = 160, colorCold = '#1b1310', colorHot = '#ff6a1e' } = {}) {
    this.capacity = capacity;
    this.cursor = 0;

    const geometry = new THREE.InstancedBufferGeometry();
    const base = createChunkGeometry(4);
    geometry.setAttribute('position', base.attributes.position);
    geometry.setAttribute('normal', base.attributes.normal);
    base.dispose();

    const attr = (n) =>
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(
        THREE.DynamicDrawUsage
      );

    this.a = {
      aOrigin: attr(3),
      aVelocity: attr(3),
      aSpin: attr(3),
      aBirth: attr(1),
      aLife: attr(1),
      aScale: attr(1),
      aSeed: attr(1),
    };
    for (const [k, v] of Object.entries(this.a)) geometry.setAttribute(k, v);
    this.a.aBirth.array.fill(-1e6);
    this.a.aLife.array.fill(0.0001);

    geometry.instanceCount = capacity;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);

    this.uniforms = {
      uSimTime: frame.uSimTime,
      uGravity: { value: 26 },
      uBounce: { value: 0.34 },
      uColorCold: { value: new THREE.Color(colorCold) },
      uColorHot: { value: new THREE.Color(colorHot) },
      uCool: { value: 1.6 },
      uEmissive: { value: 2.2 },
    };

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           ${commonGLSL}
           uniform float uSimTime;
           uniform float uGravity;
           uniform float uBounce;
           attribute vec3 aOrigin;
           attribute vec3 aVelocity;
           attribute vec3 aSpin;
           attribute float aBirth;
           attribute float aLife;
           attribute float aScale;
           attribute float aSeed;
           varying float vHeat;
           varying float vSeed;
           varying vec3 vLocal;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           float dAge = uSimTime - aBirth;
           float dT = dAge / max(aLife, 1e-4);
           mat3 dSpin = es_rotAxis(normalize(aSpin + vec3(1e-4)), length(aSpin) * dAge);
           objectNormal = dSpin * objectNormal;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           {
             if (dT < 0.0 || dT > 1.0) {
               transformed = vec3(0.0, -9999.0, 0.0);
             } else {
               float g = uGravity;
               float r = aScale * 0.5;

               /* Solve for the moment it reaches the floor. */
               float y0 = aOrigin.y - r;
               float disc = max(aVelocity.y * aVelocity.y + 2.0 * g * y0, 0.0);
               float tLand = (aVelocity.y + sqrt(disc)) / g;
               float tt = min(dAge, tLand);

               vec3 p = aOrigin + aVelocity * tt - vec3(0.0, 0.5 * g * tt * tt, 0.0);

               if (dAge > tLand) {
                 /* Landed: keep sliding, bleeding speed. */
                 float sd = dAge - tLand;
                 vec3 vh = vec3(aVelocity.x, 0.0, aVelocity.z) * uBounce;
                 p += vh * (1.0 - exp(-4.0 * sd)) / 4.0;
                 p.y = r;
               }

               /* Crumble away at the end of life instead of blinking out. */
               float shrink = 1.0 - smoothstep(0.78, 1.0, dT);
               transformed = dSpin * (transformed * aScale * shrink) + p;
             }
             vHeat = 1.0 - dT;
             vSeed = aSeed;
             vLocal = position;
           }`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           ${noiseGLSL}
           ${commonGLSL}
           uniform vec3 uColorCold;
           uniform vec3 uColorHot;
           uniform float uCool;
           uniform float uEmissive;
           varying float vHeat;
           varying float vSeed;
           varying vec3 vLocal;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           {
             float grain = es_fbm3(vLocal * 7.0 + vSeed * 11.0, 3, 2.1, 0.5);
             diffuseColor.rgb *= uColorCold * (0.5 + 1.0 * grain);
           }`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           {
             float cell = es_worley3(vLocal * 5.0 + vSeed * 9.0);
             float seam = 1.0 - smoothstep(0.0, 0.3, cell);
             float heat = pow(clamp(vHeat, 0.0, 1.0), uCool);
             totalEmissiveRadiance += uColorHot * seam * heat * uEmissive;
           }`
        );
    };
    this.material.customProgramCacheKey = () => 'es-debris';

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    // The throw lives in the vertex shader, which the depth pass knows nothing
    // about — a shadow here would be cast from wherever the chunk isn't.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
  }

  /**
   * @param {THREE.Vector3} position
   * @param {object} o { count, speed:[min,max], up, spread, size, life, birth }
   */
  burst(position, o) {
    const count = Math.min(o.count | 0, this.capacity);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      const a = rng.next() * Math.PI * 2;
      const pitch = (o.pitch ?? 0.9) * rng.next();
      const sp = o.speed[0] + (o.speed[1] - o.speed[0]) * rng.next();
      const horiz = Math.cos(pitch) * sp;

      const o3 = idx * 3;
      this.a.aOrigin.array[o3] = position.x + rng.spread(0.35);
      this.a.aOrigin.array[o3 + 1] = position.y + 0.25 + rng.next() * 0.5;
      this.a.aOrigin.array[o3 + 2] = position.z + rng.spread(0.35);

      this.a.aVelocity.array[o3] = Math.cos(a) * horiz;
      this.a.aVelocity.array[o3 + 1] = Math.sin(pitch) * sp;
      this.a.aVelocity.array[o3 + 2] = Math.sin(a) * horiz;

      const spin = o.spin ?? 8;
      this.a.aSpin.array[o3] = rng.spread(spin);
      this.a.aSpin.array[o3 + 1] = rng.spread(spin);
      this.a.aSpin.array[o3 + 2] = rng.spread(spin);

      this.a.aBirth.array[idx] = o.birth ?? 0;
      this.a.aLife.array[idx] = (o.life ?? 4) * (0.7 + rng.next() * 0.6);
      this.a.aScale.array[idx] = (o.size ?? 0.3) * (0.5 + rng.next());
      this.a.aSeed.array[idx] = rng.next();
    }
    for (const attr of Object.values(this.a)) attr.needsUpdate = true;
  }

  sync({ colorCold, colorHot, gravity, bounce } = {}) {
    if (colorCold) this.uniforms.uColorCold.value.set(colorCold);
    if (colorHot) this.uniforms.uColorHot.value.set(colorHot);
    if (gravity !== undefined) this.uniforms.uGravity.value = gravity;
    if (bounce !== undefined) this.uniforms.uBounce.value = bounce;
  }

  clear() {
    this.a.aBirth.array.fill(-1e6);
    this.a.aBirth.needsUpdate = true;
    this.cursor = 0;
  }
}
