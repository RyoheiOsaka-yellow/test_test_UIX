import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * Ice.
 *
 * A physical material carrying two hand-written injections:
 *
 *  - the *vertex* half owns the eruption. Each instance stores a birth time and
 *    a delay; the shader turns that into an overshooting rise, a hold and a
 *    sink, and scales the crystal in its own local space before the instance
 *    matrix places it. No CPU touches a crystal after it is spawned.
 *
 *  - the *fragment* half owns the look: a deep-to-edge ramp driven by how far
 *    through the body you are looking, an internal fracture field, a fresnel
 *    rim and a view-dependent sparkle that only fires on a few facets at once.
 */
export function createIceMaterial(params) {
  const uniforms = {
    uSimTime: frame.uSimTime,
    uColorDeep: { value: new THREE.Color(params.colorDeep) },
    uColorMid: { value: new THREE.Color(params.colorMid) },
    uColorEdge: { value: new THREE.Color(params.colorEdge) },
    uRimPower: { value: params.rimPower },
    uRimStrength: { value: params.rimStrength },
    uInteriorScale: { value: params.interiorScale },
    uInteriorStrength: { value: params.interiorStrength },
    uSparkle: { value: params.sparkle },
    uSparkleScale: { value: params.sparkleScale },
    uEmissive: { value: params.emissive },
    uRiseTime: { value: 0.2 },
    uOvershoot: { value: 2.0 },
    uHoldTime: { value: 1.5 },
    uSinkTime: { value: 0.9 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.14,
    metalness: 0.0,
    transmission: params.refraction,
    thickness: 0.6,
    ior: 1.31,
    transparent: true,
    opacity: params.opacity,
    envMapIntensity: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         ${commonGLSL}
         uniform float uSimTime;
         uniform float uRiseTime;
         uniform float uOvershoot;
         uniform float uHoldTime;
         uniform float uSinkTime;
         attribute float aBirth;
         attribute float aDelay;
         attribute float aSeed;
         attribute float aHeight;
         varying float vSeed;
         varying float vHeightT;
         varying vec3 vLocal;
         varying float vLife;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float age = uSimTime - aBirth - aDelay;
           float rise = 0.0;

           if (age > 0.0) {
             if (age < uRiseTime) {
               /* Punch out of the floor and overshoot past the resting size. */
               rise = es_easeOutBack(age / uRiseTime, uOvershoot);
             } else if (age < uRiseTime + uHoldTime) {
               rise = 1.0;
             } else {
               float s = (age - uRiseTime - uHoldTime) / max(uSinkTime, 1e-3);
               rise = 1.0 - es_easeInCubic(clamp(s, 0.0, 1.0));
             }
           }
           rise = max(rise, 0.0);
           vLife = rise;

           /* Tear upward out of the ground: the body scales along its own axis
              and the whole crystal is pushed under the floor until it is out. */
           transformed.y *= rise * aHeight;
           transformed.xz *= mix(0.55, 1.0, clamp(rise, 0.0, 1.0));
           transformed.y -= (1.0 - clamp(rise, 0.0, 1.0)) * 0.35;

           /* A little shiver while it is still coming up. */
           float shiver = (1.0 - smoothstep(0.0, uRiseTime * 1.6, age)) * 0.035;
           transformed.xz += vec2(
             sin(uSimTime * 44.0 + aSeed * 30.0),
             cos(uSimTime * 39.0 + aSeed * 21.0)
           ) * shiver;

           vSeed = aSeed;
           vHeightT = clamp(position.y, 0.0, 1.0);
           vLocal = transformed;
         }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         ${noiseGLSL}
         ${commonGLSL}
         uniform float uSimTime;
         uniform vec3 uColorDeep;
         uniform vec3 uColorMid;
         uniform vec3 uColorEdge;
         uniform float uRimPower;
         uniform float uRimStrength;
         uniform float uInteriorScale;
         uniform float uInteriorStrength;
         uniform float uSparkle;
         uniform float uSparkleScale;
         uniform float uEmissive;
         varying float vSeed;
         varying float vHeightT;
         varying vec3 vLocal;
         varying float vLife;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           /* <color_fragment> runs before <normal_fragment_begin>, so the only
              normal available here is the interpolated vertex one. */
           vec3 viewDir = normalize(vViewPosition);
           float facing = clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0);

           /* Deep where you look through a lot of ice, bright at a grazing
              angle — the cheapest honest stand-in for absorption. */
           float depth = 1.0 - facing;
           vec3 body = es_ramp3(uColorDeep, uColorMid, uColorEdge, depth * 0.9 + vHeightT * 0.22);

           /* Internal fractures. Sampled in local space so they travel with the
              crystal instead of swimming when the camera moves. */
           float frac = es_worley3(vLocal * uInteriorScale + vSeed * 17.0);
           float veins = smoothstep(0.34, 0.0, frac);
           body = mix(body, uColorEdge, veins * uInteriorStrength);

           float cloud = es_fbm3(vLocal * uInteriorScale * 0.6 + vSeed * 5.0, 3, 2.2, 0.5);
           body *= 0.78 + 0.5 * cloud;

           diffuseColor.rgb *= body;
           diffuseColor.a *= smoothstep(0.0, 0.25, vLife);
         }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         {
           vec3 viewDir = normalize(vViewPosition);
           float rim = es_fresnel(normal, viewDir, uRimPower);
           totalEmissiveRadiance += uColorEdge * rim * uRimStrength * uEmissive;

           /* Sparkle: a high-frequency field gated on the view vector, so only a
              handful of facets fire at any one camera position. */
           float glint = es_hash13(floor(vLocal * uSparkleScale) + vSeed * 31.0);
           float gate = pow(max(dot(normalize(normal), viewDir), 0.0), 3.0);
           float twinkle = step(0.988, glint) * gate;
           totalEmissiveRadiance += vec3(1.0) * twinkle * uSparkle * 3.0;

           /* Faint glow up out of the base, so the field reads at distance. */
           totalEmissiveRadiance += uColorMid * (1.0 - vHeightT) * 0.22 * uEmissive;
         }`
      );
  };

  material.userData.uniforms = uniforms;
  material.customProgramCacheKey = () => 'es-ice';
  return material;
}

/** Push slider values back into a live ice material. */
export function syncIceMaterial(material, params, timing) {
  const u = material.userData.uniforms;
  u.uColorDeep.value.set(params.colorDeep);
  u.uColorMid.value.set(params.colorMid);
  u.uColorEdge.value.set(params.colorEdge);
  u.uRimPower.value = params.rimPower;
  u.uRimStrength.value = params.rimStrength;
  u.uInteriorScale.value = params.interiorScale;
  u.uInteriorStrength.value = params.interiorStrength;
  u.uSparkle.value = params.sparkle;
  u.uSparkleScale.value = params.sparkleScale;
  u.uEmissive.value = params.emissive;
  material.opacity = params.opacity;
  material.transmission = params.refraction;

  if (timing) {
    u.uRiseTime.value = timing.riseTime;
    u.uOvershoot.value = timing.overshoot;
    u.uHoldTime.value = timing.holdTime;
    u.uSinkTime.value = timing.sinkTime;
  }
}
