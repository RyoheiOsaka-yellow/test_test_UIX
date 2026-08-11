import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { rng, TAU } from '../utils/math.js';

/**
 * GPU-simulated instanced particles.
 *
 * The CPU only ever *spawns*: it writes an origin, a launch velocity and a set
 * of per-particle constants into a ring buffer and then forgets about them. The
 * vertex shader resolves where the particle is this frame by closed-form
 * integration of linear drag plus gravity
 *
 *     v(t) = (v0 + g/k)·e^(-kt) − g/k
 *     p(t) = p0 + (v0 + g/k)·(1 − e^(-kt))/k − (g/k)·t
 *
 * with a curl-noise field layered on top. Nothing is read back, no position
 * buffer is ever updated, and a paused simulation is simply a frozen uTime.
 *
 * Because drag, gravity, turbulence, colour and size are all *per particle*,
 * one system can be a shower of sparks and a rolling bank of mist at the same
 * time — the shape and blend mode are the only things a system fixes.
 */

const SHAPES = { round: 0, spark: 1, smoke: 2, chip: 3 };

const vertexShader = /* glsl */ `
${noiseGLSL}
${commonGLSL}

uniform float uSimTime;
uniform float uGlobalScale;
uniform float uGlobalOpacity;
uniform float uTurbScale;
uniform float uTurbSpeed;
uniform float uGroundY;
uniform float uFadeIn;
uniform float uFadeOut;
uniform float uStretch;

attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute vec3 aSeed;
attribute vec3 aColorA;
attribute vec3 aColorB;
attribute float aBirth;
attribute float aLife;
attribute vec2 aSize;
attribute float aGravity;
attribute float aDrag;
attribute float aTurb;
attribute float aSpin;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
varying float vSeed;
varying float vAge;

void main() {
  float age = uSimTime - aBirth;
  float t = age / max(aLife, 1e-4);

  /* Retired or not yet born: collapse the quad and let the rasteriser bin it. */
  if (t < 0.0 || t > 1.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 g = vec3(0.0, aGravity, 0.0);
  float k = aDrag;

  vec3 disp;
  vec3 vel;
  if (k > 1e-3) {
    float e = exp(-k * age);
    disp = (aVelocity + g / k) * (1.0 - e) / k - g * age / k;
    vel = (aVelocity + g / k) * e - g / k;
  } else {
    disp = aVelocity * age + 0.5 * g * age * age;
    vel = aVelocity + g * age;
  }

  vec3 pos = aOrigin + disp;

  /* Turbulence ramps in with age so nothing is shaken apart at the muzzle. */
  if (aTurb > 1e-4) {
    vec3 q = pos * uTurbScale + aSeed * 13.0 + vec3(0.0, uSimTime * uTurbSpeed, 0.0);
    pos += es_curl(q, 0.35) * aTurb * age;
  }

  /* Floor contact: settle rather than sink. */
  if (pos.y < uGroundY) {
    pos.y = uGroundY + (uGroundY - pos.y) * 0.12;
    pos.y = min(pos.y, uGroundY + 0.35);
  }

  float size = mix(aSize.x, aSize.y, es_ease(t)) * uGlobalScale;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec2 corner = position.xy * size;

#ifdef ES_STRETCH
  /* Sparks lie along their own velocity, in view space. */
  vec3 vView = (modelViewMatrix * vec4(vel, 0.0)).xyz;
  float speed = length(vView);
  vec2 dir = speed > 1e-4 ? normalize(vView.xy + vec2(1e-5)) : vec2(0.0, 1.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float stretch = 1.0 + uStretch * min(speed, 24.0);
  mv.xy += dir * (position.y * size * stretch) + perp * (position.x * size);
#else
  float ang = aSpin * age + aSeed.x * ES_TAU;
  mv.xy += es_rot2(ang) * corner;
#endif

  gl_Position = projectionMatrix * mv;

  float fadeIn = smoothstep(0.0, max(uFadeIn, 1e-4), t);
  float fadeOut = 1.0 - smoothstep(1.0 - max(uFadeOut, 1e-4), 1.0, t);
  vAlpha = fadeIn * fadeOut * uGlobalOpacity;

  vColor = mix(aColorA, aColorB, es_easeOutCubic(t));
  vUv = position.xy * 2.0;
  vSeed = aSeed.y;
  vAge = t;
}
`;

const fragmentShader = /* glsl */ `
${noiseGLSL}
${commonGLSL}

uniform float uSoftness;
uniform float uIntensity;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
varying float vSeed;
varying float vAge;

void main() {
  if (vAlpha <= 0.001) discard;

  float r = length(vUv);
  float a = 0.0;
  vec3 col = vColor;

#if ES_SHAPE == 0
  /* Round glow with a controllable core. */
  a = smoothstep(1.0, uSoftness * 0.9, r);
  a *= a;
  col += vColor * pow(max(1.0 - r, 0.0), 6.0) * 1.6;

#elif ES_SHAPE == 1
  /* Spark: a hot filament with a soft halo. */
  float core = smoothstep(0.55, 0.0, r);
  float halo = smoothstep(1.0, 0.25, r) * 0.4;
  a = core + halo;
  col += vec3(1.0) * core * core * 0.85;

#elif ES_SHAPE == 2
  /* Smoke / mist: erode a disc with fbm that drifts as the puff ages. */
  vec2 q = vUv * 1.15 + vec2(vSeed * 37.0, vSeed * 19.0);
  float n = es_fbm2(q * 1.6 + vec2(0.0, -vAge * 1.1), 4, 2.2, 0.55);
  float mask = smoothstep(1.0, 0.05, r);
  a = smoothstep(0.34, 0.86, mask * (0.55 + 0.9 * n));
  a *= mix(1.0, 0.55, vAge);
  /* Fake self-shadowing: the leading edge is brighter than the body. */
  col *= 0.72 + 0.7 * n;

#else
  /* Chip: a hard shard with a bevel, shaded by a fake normal. A shallow lobe
     amplitude keeps it an irregular pentagon; any more and it reads as a star. */
  float poly = r * (0.93 + 0.07 * cos(atan(vUv.y, vUv.x) * 5.0 + vSeed * 20.0));
  a = 1.0 - smoothstep(0.72, 0.8, poly);
  vec3 n = normalize(vec3(vUv * 0.9, sqrt(max(1.0 - r * r, 0.0))));
  float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.75, 0.5))), 0.0);
  col *= lit;
  col += vec3(1.0) * pow(max(dot(n, normalize(vec3(0.4, 0.75, 0.5))), 0.0), 24.0) * 0.6;
#endif

  a *= vAlpha;
  if (a < 0.004) discard;

  gl_FragColor = vec4(col * uIntensity, a);
}
`;

export class ParticleSystem {
  /**
   * @param {object} opts
   * @param {number} opts.capacity      ring-buffer size
   * @param {'round'|'spark'|'smoke'|'chip'} opts.shape
   * @param {boolean} opts.additive
   */
  constructor({
    capacity = 4096,
    shape = 'round',
    additive = true,
    stretch = false,
    intensity = 1,
    turbScale = 0.35,
    turbSpeed = 0.6,
    groundY = 0.02,
    fadeIn = 0.08,
    fadeOut = 0.42,
    stretchAmount = 0.055,
    depthWrite = false,
    renderOrder = 10,
  } = {}) {
    this.capacity = capacity;
    this.cursor = 0;
    this.live = 0;
    this._dirtyMin = Infinity;
    this._dirtyMax = -Infinity;

    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.attributes.position);
    quad.dispose();

    const attr = (size) =>
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(
        THREE.DynamicDrawUsage
      );

    this.a = {
      aOrigin: attr(3),
      aVelocity: attr(3),
      aSeed: attr(3),
      aColorA: attr(3),
      aColorB: attr(3),
      aBirth: attr(1),
      aLife: attr(1),
      aSize: attr(2),
      aGravity: attr(1),
      aDrag: attr(1),
      aTurb: attr(1),
      aSpin: attr(1),
    };
    for (const [name, a] of Object.entries(this.a)) geometry.setAttribute(name, a);

    // Everything starts dead: birth far in the past, zero life.
    this.a.aBirth.array.fill(-1e6);
    this.a.aLife.array.fill(0.0001);

    geometry.instanceCount = capacity;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 400);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      defines: {
        ES_SHAPE: SHAPES[shape] ?? 0,
        ...(stretch ? { ES_STRETCH: '' } : {}),
      },
      uniforms: {
        uSimTime: frame.uSimTime,
        uGlobalScale: frame.uParticleScale,
        uGlobalOpacity: frame.uParticleOpacity,
        uSoftness: frame.uSoftness,
        uTurbScale: { value: turbScale },
        uTurbSpeed: { value: turbSpeed },
        uGroundY: { value: groundY },
        uFadeIn: { value: fadeIn },
        uFadeOut: { value: fadeOut },
        uStretch: { value: stretchAmount },
        uIntensity: { value: intensity },
      },
      transparent: true,
      depthWrite,
      depthTest: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.geometry = geometry;
  }

  /**
   * Spawn `count` particles.
   *
   * @param {number} count
   * @param {object} s  emission spec (see ParticleEngine presets for examples)
   */
  emit(count, s) {
    count = Math.max(0, Math.min(count | 0, this.capacity));
    if (count === 0) return;

    const {
      position,
      positionRadius = 0,
      positionBox = null,
      direction = UP,
      spread = Math.PI,
      speed = [1, 2],
      bias = null,
      life = [0.5, 1],
      size = [0.1, 0.2],
      sizeEnd = 1,
      colorA = WHITE,
      colorB = WHITE,
      tint = 0,
      gravity = 0,
      drag = 0,
      turbulence = 0,
      spin = 0,
      birth = 0,
      radialSpeed = 0,
      centre = null,
    } = s;

    // Basis whose +Z is the emission direction.
    const dz = _v1.copy(direction).normalize();
    const up = Math.abs(dz.y) > 0.97 ? _AXIS_Z : _AXIS_Y;
    const dx = _v2.copy(up).cross(dz).normalize();
    const dy = _v3.copy(dz).cross(dx);

    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      this._dirtyMin = Math.min(this._dirtyMin, idx);
      this._dirtyMax = Math.max(this._dirtyMax, idx);

      // --- origin ---------------------------------------------------------
      let ox = position.x;
      let oy = position.y;
      let oz = position.z;
      if (positionBox) {
        ox += rng.spread(positionBox.x);
        oy += rng.spread(positionBox.y);
        oz += rng.spread(positionBox.z);
      } else if (positionRadius > 0) {
        const r = Math.cbrt(rng.next()) * positionRadius;
        const th = rng.next() * TAU;
        const ph = Math.acos(rng.next() * 2 - 1);
        const sp = Math.sin(ph);
        ox += r * sp * Math.cos(th);
        oy += r * Math.cos(ph);
        oz += r * sp * Math.sin(th);
      }

      // --- velocity -------------------------------------------------------
      const cone = rng.cone(spread, _cone);
      const sp = speed[0] + (speed[1] - speed[0]) * rng.next();
      let vx = (dx.x * cone.x + dy.x * cone.y + dz.x * cone.z) * sp;
      let vy = (dx.y * cone.x + dy.y * cone.y + dz.y * cone.z) * sp;
      let vz = (dx.z * cone.x + dy.z * cone.y + dz.z * cone.z) * sp;

      if (radialSpeed !== 0 && centre) {
        const rx = ox - centre.x;
        const ry = oy - centre.y;
        const rz = oz - centre.z;
        const rl = Math.hypot(rx, ry, rz) || 1;
        vx += (rx / rl) * radialSpeed;
        vy += (ry / rl) * radialSpeed;
        vz += (rz / rl) * radialSpeed;
      }

      if (bias) {
        vx += bias.x;
        vy += bias.y;
        vz += bias.z;
      }

      // --- write ----------------------------------------------------------
      const o3 = idx * 3;
      const o2 = idx * 2;
      const A = this.a;

      A.aOrigin.array[o3] = ox;
      A.aOrigin.array[o3 + 1] = oy;
      A.aOrigin.array[o3 + 2] = oz;

      A.aVelocity.array[o3] = vx;
      A.aVelocity.array[o3 + 1] = vy;
      A.aVelocity.array[o3 + 2] = vz;

      A.aSeed.array[o3] = rng.next();
      A.aSeed.array[o3 + 1] = rng.next();
      A.aSeed.array[o3 + 2] = rng.next();

      const jitter = tint > 0 ? 1 + rng.spread(tint) : 1;
      A.aColorA.array[o3] = colorA.r * jitter;
      A.aColorA.array[o3 + 1] = colorA.g * jitter;
      A.aColorA.array[o3 + 2] = colorA.b * jitter;
      A.aColorB.array[o3] = colorB.r * jitter;
      A.aColorB.array[o3 + 1] = colorB.g * jitter;
      A.aColorB.array[o3 + 2] = colorB.b * jitter;

      const sz = size[0] + (size[1] - size[0]) * rng.next();
      A.aSize.array[o2] = sz;
      A.aSize.array[o2 + 1] = sz * sizeEnd;

      A.aBirth.array[idx] = birth;
      A.aLife.array[idx] = life[0] + (life[1] - life[0]) * rng.next();
      A.aGravity.array[idx] = gravity;
      A.aDrag.array[idx] = drag;
      A.aTurb.array[idx] = turbulence;
      A.aSpin.array[idx] = spin === 0 ? 0 : rng.spread(spin);
    }

    this.live = Math.min(this.capacity, this.live + count);
  }

  /** Upload whatever changed this frame. One range covers any wrap. */
  flush() {
    if (this._dirtyMax < this._dirtyMin) return;
    const start = this._dirtyMin;
    const count = this._dirtyMax - this._dirtyMin + 1;
    for (const a of Object.values(this.a)) {
      a.addUpdateRange(start * a.itemSize, count * a.itemSize);
      a.needsUpdate = true;
    }
    this._dirtyMin = Infinity;
    this._dirtyMax = -Infinity;
  }

  /** Kill everything immediately. */
  clear() {
    this.a.aBirth.array.fill(-1e6);
    this.a.aLife.array.fill(0.0001);
    this.a.aBirth.needsUpdate = true;
    this.a.aLife.needsUpdate = true;
    this.cursor = 0;
    this.live = 0;
    this._dirtyMin = Infinity;
    this._dirtyMax = -Infinity;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(1, 1, 1);
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _AXIS_Z = new THREE.Vector3(0, 0, 1);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _cone = { x: 0, y: 0, z: 0 };
