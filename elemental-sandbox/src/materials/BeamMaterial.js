import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * The parametric tube.
 *
 * Nova Beam draws this three times at three radii — white-hot core, cyan sheath,
 * wide outer envelope — and Voltaic Snare reuses it, flared, as the violet
 * column that tears out of the middle of the ring. The geometry is a blank
 * (t, angle) lattice; the vertex shader builds the surface of revolution around
 * whatever axis it is handed, swelling it where the shock discs are.
 *
 * The discs are not geometry either: they are bands in `t` that both swell the
 * radius in the vertex shader and brighten the surface in the fragment shader,
 * racing down the tube as `uTime` advances.
 */
export function createTubeMaterial({
  profile = 'beam', // 'beam' (spindle) | 'column' (flared at the base)
  intensity = 2.6,
  opacity = 1,
  blending = THREE.AdditiveBlending,
  depthWrite = false,
} = {}) {
  const uniforms = {
    uTime: frame.uTime,
    uSimTime: frame.uSimTime,
    uCameraPos: frame.uCameraPos,

    uStart: { value: new THREE.Vector3() },
    uEnd: { value: new THREE.Vector3(0, 1, 0) },

    uRadius: { value: 0.4 },
    uHead: { value: 1 },
    uTailFade: { value: 0.06 },
    uSwell: { value: 0.35 },
    uSwellFreq: { value: 3.4 },
    uFlare: { value: 1.4 },
    uNoiseScale: { value: 2.2 },
    uFlowSpeed: { value: 5.0 },
    uWobble: { value: 0.06 },

    uDiscCount: { value: 6 },
    uDiscSpeed: { value: 10 },
    uDiscThickness: { value: 0.05 },
    uDiscSwell: { value: 0.35 },
    uDiscColor: { value: new THREE.Color('#dff6ff') },
    uDiscIntensity: { value: 1.8 },

    uColorCore: { value: new THREE.Color('#ffffff') },
    uColorMid: { value: new THREE.Color('#6fe6ff') },
    uColorEdge: { value: new THREE.Color('#2b6cff') },
    uIntensity: { value: intensity },
    uOpacity: { value: opacity },
    uFresnel: { value: 1.8 },
    uSeed: { value: 0 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    defines: { ES_PROFILE: profile === 'column' ? 1 : 0 },
    transparent: true,
    depthWrite,
    depthTest: true,
    blending,
    side: THREE.DoubleSide,
    toneMapped: true,
    vertexShader: /* glsl */ `
      ${noiseGLSL}
      ${commonGLSL}

      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform vec3 uStart;
      uniform vec3 uEnd;
      uniform float uRadius;
      uniform float uHead;
      uniform float uSwell;
      uniform float uSwellFreq;
      uniform float uFlare;
      uniform float uFlowSpeed;
      uniform float uWobble;
      uniform float uDiscCount;
      uniform float uDiscSpeed;
      uniform float uDiscThickness;
      uniform float uDiscSwell;
      uniform float uSeed;

      attribute float aT;
      attribute float aAngle;

      varying float vT;
      varying float vAngle;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDisc;
      varying float vAlive;

      /* Sum of the shock-disc bands at parameter t. */
      float discBands(float t) {
        float sum = 0.0;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= uDiscCount) break;
          float phase = fract(uTime * uDiscSpeed * 0.1 + float(i) / max(uDiscCount, 1.0));
          sum += smoothstep(uDiscThickness, 0.0, abs(t - phase));
        }
        return sum;
      }

      void main() {
        float t = aT;
        vAlive = step(t, uHead);

        vec3 axis = uEnd - uStart;
        float len = max(length(axis), 1e-4);
        mat3 B = es_basis(axis);
        vec3 base = mix(uStart, uEnd, t);

      #if ES_PROFILE == 1
        /* Column: fat at the floor, drawn out and thinning as it climbs. */
        float shape = pow(1.0 - t, 0.55) * mix(1.0, uFlare, pow(1.0 - t, 2.5));
        shape *= 0.35 + 0.75 * smoothstep(0.0, 0.12, t);
      #else
        /* Beam: a spindle, pinched at the muzzle and again at the far end. */
        float shape = pow(sin(clamp(t, 0.0, 1.0) * ES_PI), 0.22);
        shape = mix(shape, 1.0, 0.55);
        shape *= smoothstep(0.0, 0.035, t);
      #endif

        float swell = 1.0 + uSwell * sin(t * uSwellFreq * ES_TAU - uTime * uFlowSpeed);
        float disc = discBands(t);
        float r = uRadius * shape * swell * (1.0 + disc * uDiscSwell);

        /* Never a perfect cylinder — the surface breathes along its length. */
        r *= 1.0 + uWobble * es_snoise(vec3(t * 7.0, aAngle, uTime * 2.0 + uSeed));

        vec2 ring = vec2(cos(aAngle), sin(aAngle));
        vec3 offset = B * vec3(ring * r, 0.0);
        vec3 world = base + offset;

        vT = t;
        vAngle = aAngle;
        vWorld = world;
        vNormalW = normalize(offset + vec3(1e-5));
        vDisc = disc;

        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGLSL}
      ${commonGLSL}

      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;
      uniform vec3 uDiscColor;
      uniform float uDiscIntensity;
      uniform float uIntensity;
      uniform float uOpacity;
      uniform float uFresnel;
      uniform float uNoiseScale;
      uniform float uFlowSpeed;
      uniform float uHead;
      uniform float uTailFade;
      uniform float uSeed;

      varying float vT;
      varying float vAngle;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying float vDisc;
      varying float vAlive;

      void main() {
        if (vAlive < 0.5) discard;

        vec3 viewDir = normalize(uCameraPos - vWorld);

        /* Rim-lit shell: a tube seen edge-on should be brighter at its silhouette
           because you are looking through more of it. */
        float facing = abs(dot(normalize(vNormalW), viewDir));
        float rim = pow(1.0 - facing, uFresnel);

        /* Plasma flowing down the tube. Sampled in a cylindrical frame so it
           travels along the axis instead of swimming through world space. */
        vec3 q = vec3(cos(vAngle), sin(vAngle), 0.0) * uNoiseScale
               + vec3(0.0, 0.0, vT * uNoiseScale * 6.0 - uTime * uFlowSpeed);
        float flow = es_fbm3(q + uSeed, 4, 2.1, 0.55);
        float ridge = es_ridged(q * 0.7 + 4.0, 3, 2.2, 0.5);

        vec3 col = es_ramp3(uColorCore, uColorMid, uColorEdge, clamp(rim * 1.35, 0.0, 1.0));
        col = mix(col, uColorCore, pow(1.0 - rim, 3.0) * 0.35);
        col *= 0.45 + 0.8 * flow;
        col += uColorMid * ridge * 0.35;

        /* Shock discs. */
        col += uDiscColor * vDisc * uDiscIntensity;

        /* Mostly silhouette: the tube is drawn double-sided and three times
           over, so a fat interior term stacks up to solid white. */
        float a = (0.06 + 0.5 * rim) * uOpacity;
        a *= 0.55 + 0.7 * flow;
        a += vDisc * 0.22;

        /* Soft ends so the tube dissolves rather than being cut off. */
        a *= smoothstep(0.0, uTailFade, vT);
        a *= smoothstep(uHead, uHead - 0.1, vT);

        if (a < 0.005) discard;
        gl_FragColor = vec4(col * uIntensity, clamp(a, 0.0, 1.0));
      }
    `,
  });
}
