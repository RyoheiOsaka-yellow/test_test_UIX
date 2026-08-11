import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';

/**
 * The floor. A single plane running a standard PBR material whose albedo,
 * roughness and normal are all evaluated in the fragment shader: worley slabs
 * for the flagstones, fbm for the grain, a faint survey grid on top, and a
 * radial falloff that eats the plane into the fog instead of ending it.
 */
export class Ground {
  constructor(scene, settings) {
    this.settings = settings;
    const g = settings.ground;

    const geometry = new THREE.PlaneGeometry(g.size, g.size, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    this.uniforms = {
      uBaseColor: { value: new THREE.Color(g.baseColor) },
      uCrackColor: { value: new THREE.Color(g.crackColor) },
      uGrainColor: { value: new THREE.Color(g.grainColor) },
      uGridColor: { value: new THREE.Color(g.gridColor) },
      uTileScale: { value: g.tileScale },
      uGrainScale: { value: g.grainScale },
      uGridStrength: { value: g.gridStrength },
      uGridScale: { value: g.gridScale },
      uFalloff: { value: g.falloff },
      uSize: { value: g.size },
    };

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: g.roughness,
      metalness: g.metalness,
      envMapIntensity: g.reflect,
      dithering: true,
    });

    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vGroundPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           ${noiseGLSL}
           ${commonGLSL}
           varying vec3 vGroundPos;
           uniform vec3 uBaseColor;
           uniform vec3 uCrackColor;
           uniform vec3 uGrainColor;
           uniform vec3 uGridColor;
           uniform float uTileScale;
           uniform float uGrainScale;
           uniform float uGridStrength;
           uniform float uGridScale;
           uniform float uFalloff;
           uniform float uSize;

           /* Height of the stone at p — shared by the albedo and the normal so
              the lit relief and the painted relief agree. */
           float groundHeight(vec2 p) {
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.09, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale, 4, 2.1, 0.5);
             return seam * 0.72 + grain * 0.28;
           }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           {
             vec2 p = vGroundPos.xz;
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.075, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale, 4, 2.1, 0.5);
             float coarse = es_fbm2(p * uGrainScale * 0.17, 3, 2.0, 0.55);

             vec3 albedo = mix(uCrackColor, uBaseColor, seam);
             albedo = mix(albedo, uGrainColor, grain * 0.38 * seam);
             albedo *= 0.72 + 0.56 * coarse;

             /* Survey grid — a lattice, not a texture. */
             vec2 gridUv = abs(fract(p / uGridScale) - 0.5);
             float line = 1.0 - smoothstep(0.0, 0.02, min(gridUv.x, gridUv.y));
             albedo = mix(albedo, uGridColor, line * uGridStrength);

             /* Chew the far edge of the plane into the fog. */
             float r = length(p) / (uSize * 0.5);
             albedo *= 1.0 - smoothstep(uFalloff, 1.0, r);

             diffuseColor.rgb *= albedo;
           }`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           {
             vec2 p = vGroundPos.xz;
             vec2 w = es_worley2(p * uTileScale);
             float seam = smoothstep(0.0, 0.075, w.y - w.x);
             float grain = es_fbm2(p * uGrainScale * 2.3, 3, 2.0, 0.5);
             /* Polished slab faces, rough grout. */
             roughnessFactor *= mix(1.12, 0.74, seam) * (0.86 + 0.28 * grain);
             roughnessFactor = clamp(roughnessFactor, 0.06, 1.0);
           }`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
           {
             vec2 p = vGroundPos.xz;
             float e = 0.035;
             float h = groundHeight(p);
             float hx = groundHeight(p + vec2(e, 0.0));
             float hz = groundHeight(p + vec2(0.0, e));
             vec3 bump = normalize(vec3((h - hx) / e, 1.0, (h - hz) / e));
             normal = normalize(mix(normal, bump, 0.55));
           }`
        );

      this._shader = shader;
    };

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';
    scene.add(this.mesh);

    /** Everything that raycasts against the floor uses this plane, not the mesh. */
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  sync() {
    const g = this.settings.ground;
    this.uniforms.uBaseColor.value.set(g.baseColor);
    this.uniforms.uCrackColor.value.set(g.crackColor);
    this.uniforms.uGrainColor.value.set(g.grainColor);
    this.uniforms.uGridColor.value.set(g.gridColor);
    this.uniforms.uTileScale.value = g.tileScale;
    this.uniforms.uGrainScale.value = g.grainScale;
    this.uniforms.uGridStrength.value = g.gridStrength;
    this.uniforms.uGridScale.value = g.gridScale;
    this.uniforms.uFalloff.value = g.falloff;
    this.material.roughness = g.roughness;
    this.material.metalness = g.metalness;
    this.material.envMapIntensity = g.reflect;
  }
}
