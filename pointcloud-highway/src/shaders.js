import * as THREE from 'three';
import { ROWS, LUT_ROWS } from './colormaps.js';

const VIS_GLSL = `
  uniform sampler2D uVis;
  float visOf(float id) { return texture2D(uVis, vec2((mod(id, 256.0) + 0.5) / 256.0, (floor(id / 256.0) + 0.5) / 256.0)).r; }
`;

/** 256×256 R8 texture: element id → visible (1) / hidden (0). Index 65535 = unassigned points. */
export function createVisibilityTexture() {
  const data = new Uint8Array(256 * 256).fill(255);
  const tex = new THREE.DataTexture(data, 256, 256, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return tex;
}

export function createPointMaterial(lut, visTex) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLut: { value: lut },
      uVis: { value: visTex },
      uMode: { value: 0 },          // 0 lidar(intensity×height) 1 elevation 2 intensity 3 class 4 deviation 5 realistic
      uRow: { value: 0 },           // colormap row for modes 0/1
      uSize: { value: 2.0 },
      uMinPx: { value: 1.8 },
      uMaxPx: { value: 5.0 },
      uHMin: { value: -2 },
      uHMax: { value: 40 },
      uHeightMix: { value: 0.3 },
      uGain: { value: 1.0 },
      uSelected: { value: -1 },
      uDevRange: { value: 50 },
      uViewportH: { value: 800 },
      uPixelRatio: { value: 1 },
      uClsMask: { value: new Float32Array(32).fill(1) },
      uSpacing: { value: new Float32Array(32).fill(0.5) }, // nominal sample spacing (m) per class → splat radius
      uTanHalfFov: { value: 0.4877 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float intensity;
      attribute float cls;
      attribute float dev;
      attribute float elem;
      uniform sampler2D uLut;
      uniform float uMode, uRow, uSize, uMinPx, uMaxPx, uHMin, uHMax, uHeightMix, uGain, uSelected, uDevRange, uViewportH, uPixelRatio;
      uniform float uClsMask[32];
      uniform float uSpacing[32];
      uniform float uTanHalfFov;
      varying vec3 vColor;
      varying float vSize;
      varying float vHide;
      #include <clipping_planes_pars_vertex>
      ${VIS_GLSL}
      vec3 lut(float row, float t) { return texture2D(uLut, vec2(clamp(t, 0.002, 0.998), (row + 0.5) / ${LUT_ROWS}.0)).rgb; }
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        int ci = int(cls + 0.5);
        vHide = (uClsMask[ci] < 0.5 || visOf(elem) < 0.5) ? 1.0 : 0.0;
        float hN = clamp((position.y - uHMin) / (uHMax - uHMin), 0.0, 1.0);
        float I = clamp(intensity * uGain, 0.0, 1.0);
        float devMm = dev * 255.0 - 128.0;
        vec3 c;
        if (uMode < 0.5) c = lut(uRow, 0.09 + 0.91 * clamp(mix(I, hN, uHeightMix) * 1.08, 0.0, 1.0));
        else if (uMode < 1.5) c = lut(uRow, 0.06 + 0.94 * hN);
        else if (uMode < 2.5) c = vec3(pow(I, 0.8));
        else if (uMode < 3.5) c = lut(${ROWS.classes}.0, (cls + 0.5) / 32.0) * (0.75 + 0.5 * I);
        else if (uMode < 4.5) {
          bool structural = ci == 17 || ci == 20 || ci == 21 || ci == 22 || ci == 23 || ci == 27 || ci == 29 || ci == 25;
          c = structural ? lut(${ROWS.deviation}.0, 0.5 + devMm / (2.0 * uDevRange)) : vec3(0.16, 0.17, 0.2);
        }
        else c = lut(${ROWS.realistic}.0, (cls + 0.5) / 32.0) * (0.55 + 0.9 * I);
        float sel = step(abs(elem - uSelected), 0.5);
        c = mix(c, vec3(1.0, 0.72, 0.18), sel * (uMode > 3.5 && uMode < 4.5 ? 0.0 : 0.9));
        vColor = c;
        float dist = max(1.0, -mvPosition.z);
        // distance-attenuated size, and a splat that covers the nominal sample spacing so surfaces close up
        float px = uSize * uViewportH / dist * 0.45;
        float splat = uSpacing[ci] * 0.95 * uViewportH / (2.0 * uTanHalfFov * dist) * uSize * 0.5;
        px = clamp(max(px, min(splat, uMaxPx * 2.6)), uMinPx, uMaxPx * 2.6) * (1.0 + sel * 0.8);
        vSize = px;
        gl_PointSize = px * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vSize;
      varying float vHide;
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        if (vHide > 0.5) discard;
        if (vSize > 2.5) {
          vec2 d = gl_PointCoord - 0.5;
          if (dot(d, d) > 0.25) discard;
        }
        gl_FragColor = vec4(vColor, uOpacity);
      }
    `,
    clipping: true,
    transparent: false,
    depthWrite: true,
  });
  return mat;
}

/** Translucent BIM faces with per-element sequence (4D) + selection support + flat derivative shading. */
export function createBimFaceMaterial(visTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uVis: { value: visTex },
      uTint: { value: new THREE.Color(0x5cc8ff) },
      uUseVertexColor: { value: 0 },
      uOpacity: { value: 0.14 },
      uSeqMax: { value: 1e9 },
      uSelected: { value: -1 },
      uHover: { value: -1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeq;
      attribute float aElem;
      varying vec3 vColor;
      varying float vSeq;
      varying float vElem;
      varying vec3 vViewPos;
      #include <clipping_planes_pars_vertex>
      ${VIS_GLSL}
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        vColor = color; vSeq = visOf(aElem) < 0.5 ? 1e12 : aSeq; vElem = aElem;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint; uniform float uUseVertexColor, uOpacity, uSeqMax, uSelected, uHover;
      varying vec3 vColor; varying float vSeq; varying float vElem; varying vec3 vViewPos;
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        if (vSeq > uSeqMax) discard;
        vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
        float shade = 0.55 + 0.45 * abs(n.z);
        vec3 c = mix(uTint, vColor, uUseVertexColor) * shade;
        float a = uOpacity;
        if (abs(vElem - uSelected) < 0.5) { c = vec3(1.0, 0.65, 0.15); a = 0.55; }
        else if (abs(vElem - uHover) < 0.5) { c = mix(c, vec3(1.0), 0.5); a = min(1.0, a + 0.2); }
        gl_FragColor = vec4(c, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    clipping: true,
  });
}

export function createBimEdgeMaterial(visTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uVis: { value: visTex },
      uTint: { value: new THREE.Color(0xbfefff) },
      uUseVertexColor: { value: 0 },
      uOpacity: { value: 0.75 },
      uSeqMax: { value: 1e9 },
      uSelected: { value: -1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeq; attribute float aElem;
      varying vec3 vColor; varying float vSeq; varying float vElem;
      #include <clipping_planes_pars_vertex>
      ${VIS_GLSL}
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
        vColor = color; vSeq = visOf(aElem) < 0.5 ? 1e12 : aSeq; vElem = aElem;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint; uniform float uUseVertexColor, uOpacity, uSeqMax, uSelected;
      varying vec3 vColor; varying float vSeq; varying float vElem;
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        if (vSeq > uSeqMax) discard;
        vec3 c = mix(uTint, vColor, uUseVertexColor);
        float a = uOpacity;
        if (abs(vElem - uSelected) < 0.5) { c = vec3(1.0, 0.8, 0.3); a = 1.0; }
        gl_FragColor = vec4(c, a);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    clipping: true,
  });
}
