import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * The burning rock.
 *
 * A standard PBR shell with the lava written into it: a worley cell field gives
 * the seam network, and `uHeat` — which climbs the whole way downrange — both
 * prises the seams wider and pushes their colour up the blackbody ramp, so the
 * rock visibly heats up in flight instead of arriving the same as it left.
 */
export function createMeteorMaterial(params) {
  const uniforms = {
    uTime: frame.uTime,
    uHeat: { value: 0 },
    uColorCold: { value: new THREE.Color(params.colorCold) },
    uColorHot: { value: new THREE.Color(params.colorHot) },
    uColorCore: { value: new THREE.Color(params.colorCore) },
    uSeamScale: { value: params.seamScale },
    uSeamWidth: { value: params.seamWidth },
    uSeamGrowth: { value: params.seamGrowth },
    uEmissive: { value: params.emissive },
    uRimHeat: { value: params.rimHeat },
  };

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: params.roughness,
    metalness: 0.08,
    envMapIntensity: 0.5,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n varying vec3 vLocal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n vLocal = position;`);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         ${noiseGLSL}
         ${commonGLSL}
         varying vec3 vLocal;
         uniform float uTime;
         uniform float uHeat;
         uniform vec3 uColorCold;
         uniform vec3 uColorHot;
         uniform vec3 uColorCore;
         uniform float uSeamScale;
         uniform float uSeamWidth;
         uniform float uSeamGrowth;
         uniform float uEmissive;
         uniform float uRimHeat;

         /* 0 outside a seam, 1 in the middle of one. */
         float seamField(vec3 p, float width) {
           float cell = es_worley3(p * uSeamScale);
           return 1.0 - smoothstep(0.0, max(width, 1e-3), cell);
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float grain = es_fbm3(vLocal * 9.0, 4, 2.1, 0.5);
           vec3 rock = uColorCold * (0.55 + 0.9 * grain);

           /* Seams open up as the rock heats. */
           float width = uSeamWidth * (0.35 + uSeamGrowth * uHeat);
           float seam = seamField(vLocal, width);

           /* Only the deepest part of a seam gets to the white core. */
           float depth = smoothstep(0.25, 1.0, seam);
           vec3 lava = mix(uColorHot, uColorCore, depth * (0.35 + 0.65 * uHeat));

           diffuseColor.rgb *= mix(rock, lava * 0.35, seam);
         }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         {
           float seam = seamField(vLocal, uSeamWidth * (0.35 + uSeamGrowth * uHeat));
           roughnessFactor *= mix(1.0, 0.55, seam);
         }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         {
           float width = uSeamWidth * (0.35 + uSeamGrowth * uHeat);
           float seam = seamField(vLocal, width);
           float depth = smoothstep(0.2, 1.0, seam);

           /* Flow inside the seam so the glow is not a static decal. */
           float churn = es_fbm3(vLocal * 5.0 + vec3(0.0, uTime * 0.9, 0.0), 3, 2.2, 0.5);
           float heat = clamp(uHeat * (0.45 + 0.85 * churn), 0.0, 1.4);

           vec3 glow = mix(uColorHot, uColorCore, depth * heat);
           totalEmissiveRadiance += glow * seam * uEmissive * (0.25 + 1.5 * uHeat);

           /* The leading face glows on its own once it is really moving. */
           float rim = es_fresnel(normal, normalize(vViewPosition), 2.2);
           totalEmissiveRadiance += uColorHot * rim * uRimHeat * uHeat;

           /* Whole-body warmth so even the cold rock reads as hot at distance. */
           totalEmissiveRadiance += uColorHot * 0.06 * uHeat;
         }`
      );
  };

  material.userData.uniforms = uniforms;
  material.customProgramCacheKey = () => 'es-meteor';
  return material;
}

export function syncMeteorMaterial(material, params) {
  const u = material.userData.uniforms;
  u.uColorCold.value.set(params.colorCold);
  u.uColorHot.value.set(params.colorHot);
  u.uColorCore.value.set(params.colorCore);
  u.uSeamScale.value = params.seamScale;
  u.uSeamWidth.value = params.seamWidth;
  u.uSeamGrowth.value = params.seamGrowth;
  u.uEmissive.value = params.emissive;
  u.uRimHeat.value = params.rimHeat;
  material.roughness = params.roughness;
}
