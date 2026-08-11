import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { clamp01 } from '../utils/math.js';

/**
 * The expanding shell.
 *
 * Storm Lance leaves one behind as ionised air, Cinder Fall throws one out as
 * the blast front, Nova Beam fires one at the muzzle. It is a sphere whose
 * surface is eaten away by noise and lit only by its own fresnel, so it reads as
 * a thin membrane of hot air rather than a ball.
 */
export class BurstSphere {
  constructor(scene, count = 8) {
    this.geometry = new THREE.IcosahedronGeometry(1, 4);
    this.pool = [];
    this.scene = scene;
    this.count = count;
  }

  _material() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: frame.uTime,
        uCameraPos: frame.uCameraPos,
        uColor: { value: new THREE.Color('#ffffff') },
        uColor2: { value: new THREE.Color('#88bbff') },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uThickness: { value: 0.3 },
        uNoise: { value: 0.45 },
        uRings: { value: 3 },
        uSeed: { value: 0 },
        uIntensity: { value: 1.6 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      toneMapped: true,
      vertexShader: /* glsl */ `
        ${noiseGLSL}
        uniform float uProgress;
        uniform float uNoise;
        uniform float uSeed;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying vec3 vLocal;

        void main() {
          vec3 p = normalize(position);
          /* The shell buckles as it expands — never a clean sphere. */
          float n = es_fbm3(p * 2.4 + uSeed, 4, 2.1, 0.55);
          float wobble = 1.0 + uNoise * (n - 0.5) * (0.4 + uProgress);
          vec3 pos = p * wobble;

          vLocal = p;
          vec4 world = modelMatrix * vec4(pos, 1.0);
          vWorld = world.xyz;
          vNormalW = normalize(mat3(modelMatrix) * p);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        ${noiseGLSL}
        ${commonGLSL}
        uniform float uTime;
        uniform vec3 uCameraPos;
        uniform vec3 uColor;
        uniform vec3 uColor2;
        uniform float uProgress;
        uniform float uOpacity;
        uniform float uThickness;
        uniform float uRings;
        uniform float uIntensity;
        uniform float uSeed;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying vec3 vLocal;

        void main() {
          vec3 viewDir = normalize(uCameraPos - vWorld);
          float facing = abs(dot(normalize(vNormalW), viewDir));

          /* Thin membrane: only the silhouette is dense. */
          float shell = pow(1.0 - facing, 1.0 / max(uThickness, 0.02));

          /* Break it into filaments so it reads as ionised air, not glass. */
          float n = es_fbm3(vLocal * 4.5 + uSeed + vec3(0.0, uTime * 0.8, 0.0), 4, 2.2, 0.55);
          float rings = pow(abs(sin(vLocal.y * uRings * ES_PI + uSeed)), 6.0);

          float body = shell * (0.35 + 1.1 * n) + rings * shell * 0.8;

          vec3 col = mix(uColor2, uColor, clamp(shell * 1.4, 0.0, 1.0));
          col += vec3(1.0) * pow(shell, 3.0) * 0.7;

          float a = body * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(col * uIntensity, clamp(a, 0.0, 1.0));
        }
      `,
    });
  }

  spawn(position, o) {
    let slot = this.pool.find((s) => s.age >= s.life);
    if (!slot && this.pool.length < this.count) {
      const material = this._material();
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 14;
      this.scene.add(mesh);
      slot = { mesh, material, age: 0, life: 0 };
      this.pool.push(slot);
    }
    if (!slot) slot = this.pool[0];

    slot.mesh.position.copy(position);
    slot.mesh.visible = true;
    slot.age = 0;
    slot.life = o.life ?? 0.5;
    slot.from = o.from ?? 0.2;
    slot.to = o.to ?? 2.0;
    slot.peak = o.opacity ?? 1;
    slot.ease = o.ease ?? 0.4;

    const u = slot.material.uniforms;
    u.uColor.value.set(o.color ?? '#ffffff');
    u.uColor2.value.set(o.color2 ?? o.color ?? '#88bbff');
    u.uThickness.value = o.thickness ?? 0.3;
    u.uNoise.value = o.noise ?? 0.45;
    u.uRings.value = o.rings ?? 3;
    u.uIntensity.value = o.intensity ?? 1.6;
    u.uSeed.value = Math.random() * 40;
    return slot;
  }

  update(dt) {
    for (const s of this.pool) {
      if (s.age >= s.life) {
        if (s.mesh.visible) s.mesh.visible = false;
        continue;
      }
      s.age += dt;
      const t = clamp01(s.age / s.life);
      // Fast out of the gate, coasting at the end.
      const eased = 1 - Math.pow(1 - t, 1 / Math.max(s.ease, 0.05));
      const radius = s.from + (s.to - s.from) * eased;
      s.mesh.scale.setScalar(radius);
      s.material.uniforms.uProgress.value = t;
      s.material.uniforms.uOpacity.value = s.peak * Math.pow(1 - t, 1.6);
    }
  }

  clear() {
    for (const s of this.pool) {
      s.age = s.life;
      s.mesh.visible = false;
    }
  }
}
