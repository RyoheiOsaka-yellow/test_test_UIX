import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * The raymarched wake.
 *
 * Cinder Fall drags a box behind it, oriented along its own velocity, and this
 * shader marches the camera ray through that box in object space. The medium is
 * an fbm field masked by a cone that opens out behind the rock; temperature is
 * read off how far forward the sample is, so the gas is white at the rock and
 * has cooled to soot by the tail. Front-to-back accumulation with Beer-Lambert
 * absorption gives it depth the moment two puffs overlap.
 */
export function createVolumetricFireMaterial(params) {
  const uniforms = {
    uTime: frame.uTime,
    uSimTime: frame.uSimTime,
    uCamObj: { value: new THREE.Vector3() },
    uSteps: { value: params.steps },
    uDensity: { value: params.density },
    uNoiseScale: { value: params.noiseScale },
    uNoiseSpeed: { value: params.noiseSpeed },
    uRise: { value: params.rise },
    uAbsorption: { value: params.absorption },
    uColorInner: { value: new THREE.Color(params.colorInner) },
    uColorMid: { value: new THREE.Color(params.colorMid) },
    uColorOuter: { value: new THREE.Color(params.colorOuter) },
    uIntensity: { value: 1 },
    uFade: { value: 1 },
    uSeed: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    toneMapped: true,
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      void main() {
        vObj = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGLSL}
      ${commonGLSL}

      uniform float uTime;
      uniform vec3 uCamObj;
      uniform float uSteps;
      uniform float uDensity;
      uniform float uNoiseScale;
      uniform float uNoiseSpeed;
      uniform float uRise;
      uniform float uAbsorption;
      uniform vec3 uColorInner;
      uniform vec3 uColorMid;
      uniform vec3 uColorOuter;
      uniform float uIntensity;
      uniform float uFade;
      uniform float uSeed;

      varying vec3 vObj;

      /* Slab intersection against the unit box the mesh is scaled from. */
      bool boxHit(vec3 ro, vec3 rd, out float t0, out float t1) {
        vec3 inv = 1.0 / (rd + vec3(1e-6));
        vec3 a = (vec3(-0.5) - ro) * inv;
        vec3 b = (vec3(0.5) - ro) * inv;
        vec3 lo = min(a, b);
        vec3 hi = max(a, b);
        t0 = max(max(lo.x, lo.y), lo.z);
        t1 = min(min(hi.x, hi.y), hi.z);
        return t1 > max(t0, 0.0);
      }

      /* Density at an object-space point. +Z is the direction of travel, so the
         rock sits at z = +0.5 and the plume trails toward z = -0.5. */
      float medium(vec3 p, out float temp) {
        float along = clamp(p.z + 0.5, 0.0, 1.0);   /* 0 tail .. 1 head */

        /* Hot gas rises as it falls behind. */
        vec3 q = p;
        q.y -= uRise * pow(1.0 - along, 2.0) * 0.5;

        /* Cone: tight at the rock, opening out down the wake. */
        float radius = mix(0.52, 0.1, along);
        float r = length(q.xy) / max(radius, 1e-3);
        float shell = 1.0 - smoothstep(0.35, 1.0, r);
        shell *= smoothstep(0.0, 0.14, along);       /* nothing past the tail */

        vec3 n = q * vec3(uNoiseScale * 2.2, uNoiseScale * 2.2, uNoiseScale)
               + vec3(0.0, -uTime * uNoiseSpeed, uTime * uNoiseSpeed * 0.6)
               + uSeed;
        float f = es_fbm3(n, 4, 2.15, 0.55);
        float ridge = es_ridged(n * 0.8, 3, 2.1, 0.5);
        f = mix(f, ridge, 0.35);

        /* Erode the cone with the field so the plume has tongues, not a taper. */
        float d = shell * smoothstep(0.34, 0.78, f * (0.55 + 0.8 * shell));

        temp = clamp(along * (0.55 + 0.75 * f), 0.0, 1.0);
        return d;
      }

      void main() {
        vec3 ro = uCamObj;
        vec3 rd = normalize(vObj - uCamObj);

        float t0, t1;
        if (!boxHit(ro, rd, t0, t1)) discard;
        t0 = max(t0, 0.0);

        int steps = int(clamp(uSteps, 4.0, 64.0));
        float dt = (t1 - t0) / float(steps);

        /* Dither the entry point so the slices do not band. */
        float jitter = es_hash12(gl_FragCoord.xy + uTime * 60.0);
        float t = t0 + dt * jitter;

        vec3 acc = vec3(0.0);
        float trans = 1.0;

        for (int i = 0; i < 64; i++) {
          if (i >= steps || trans < 0.02) break;
          vec3 p = ro + rd * t;
          float temp;
          float d = medium(p, temp) * uDensity * dt * 8.0;
          if (d > 0.001) {
            vec3 c = es_ramp3(uColorOuter, uColorMid, uColorInner, temp);
            c *= 0.35 + 2.2 * pow(temp, 1.6);
            acc += c * d * trans;
            trans *= exp(-d * uAbsorption);
          }
          t += dt;
        }

        float a = (1.0 - trans) * uFade;
        if (a < 0.004) discard;
        gl_FragColor = vec4(acc * uIntensity * uFade, a);
      }
    `,
  });

  material.userData.uniforms = uniforms;
  return material;
}

export function syncFireMaterial(material, params) {
  const u = material.userData.uniforms;
  u.uSteps.value = params.steps;
  u.uDensity.value = params.density;
  u.uNoiseScale.value = params.noiseScale;
  u.uNoiseSpeed.value = params.noiseSpeed;
  u.uRise.value = params.rise;
  u.uAbsorption.value = params.absorption;
  u.uColorInner.value.set(params.colorInner);
  u.uColorMid.value.set(params.colorMid);
  u.uColorOuter.value.set(params.colorOuter);
}
