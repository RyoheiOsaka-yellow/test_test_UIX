import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { createGroundQuad } from '../assets/ProceduralGeometry.js';
import { clamp01 } from '../utils/math.js';

/**
 * Everything the floor remembers.
 *
 * One quad, one shader, seven looks. The rime, the scorch, the branching
 * electric burn, the molten crack network, the beam scar, the snare disc and
 * the shock ring are all signed-distance and noise fields evaluated per pixel —
 * there is not a texture anywhere in this file.
 *
 * Decals are pooled per type. A caller gets the live object back so it can keep
 * driving `uProgress` (a burn spreading with a travelling front, say) while the
 * pool handles ageing, fading and recycling.
 */

const TYPES = {
  frost: 0,
  scorch: 1,
  electric: 2,
  molten: 3,
  beam: 4,
  snare: 5,
  shock: 6,
};

const ADDITIVE = new Set(['frost', 'electric', 'molten', 'beam', 'snare', 'shock']);

function createDecalMaterial(type) {
  return new THREE.ShaderMaterial({
    defines: { ES_DECAL: TYPES[type] },
    uniforms: {
      uTime: frame.uTime,
      uSimTime: frame.uSimTime,
      uAge: { value: 0 },
      uProgress: { value: 1 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color('#ffffff') },
      uColor2: { value: new THREE.Color('#000000') },
      uSeed: { value: 0 },
      uScale: { value: 3 },
      uSharp: { value: 2 },
      uWidth: { value: 0.06 },
      uChurn: { value: 1 },
      uFlicker: { value: 6 },
      uAspect: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: ADDITIVE.has(type) ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    toneMapped: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGLSL}
      ${commonGLSL}

      uniform float uTime;
      uniform float uAge;
      uniform float uProgress;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      uniform float uSeed;
      uniform float uScale;
      uniform float uSharp;
      uniform float uWidth;
      uniform float uChurn;
      uniform float uFlicker;
      uniform float uAspect;

      varying vec2 vUv;

      /* Warp the sample point before a worley lookup. Straight voronoi is a
         honeycomb — regular cells with even spacing — which reads as tiling on
         a floor. Pushing the lookup around with low-frequency fbm first breaks
         the lattice up into something that looks fractured. */
      vec2 es_warp(vec2 p, float scale, float amount, float seed) {
        vec2 q = vec2(
          es_fbm2(p * scale + seed, 3, 2.1, 0.5),
          es_fbm2(p * scale + seed + 37.0, 3, 2.1, 0.5)
        );
        return p + (q - 0.5) * amount;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        vec3 col = vec3(0.0);
        float a = 0.0;

      #if ES_DECAL == 0
        /* ---------------------------------------------------------- rime --- */
        float n = es_fbm2(p * uScale + uSeed * 31.0, 4, 2.2, 0.55);
        float edge = uProgress * 1.05;
        /* The frost front is the circle, roughened by noise. */
        float front = r + (n - 0.5) * 0.55;
        float mask = smoothstep(edge, edge - 0.34, front);

        /* Needles growing inward from the front. */
        vec2 w = es_worley2(es_warp(p, uScale * 0.6, 0.85, uSeed * 3.0) * uScale * 3.0 + uSeed * 7.0);
        float veins = smoothstep(0.1, 0.0, w.y - w.x);
        float feather = pow(clamp(1.0 - abs(front - edge) * 3.2, 0.0, 1.0), 2.0);

        col = uColor * (0.16 + 0.25 * veins + 0.9 * feather);
        col += uColor2 * veins * 0.14;
        a = mask * (0.18 + 0.42 * n + 0.15 * veins) * uOpacity;

      #elif ES_DECAL == 1
        /* -------------------------------------------------------- scorch --- */
        float n = es_fbm2(p * uScale + uSeed * 13.0, 4, 2.1, 0.55);
        float mask = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.7);
        col = uColor * (0.4 + 0.6 * n);
        a = mask * uOpacity * (0.55 + 0.5 * n);

      #elif ES_DECAL == 2
        /* ------------------------------------------------------ electric --- */
        /* Ridged noise stacked and sharpened until only the filaments survive. */
        float b = es_ridged(vec3(p * uScale, uSeed * 5.0), 5, 2.3, 0.55);
        float lines = pow(clamp(b, 0.0, 1.0), uSharp);
        float radial = smoothstep(1.0, 0.05, r);

        /* Branches crawl outward as the burn spreads. */
        float reach = smoothstep(uProgress + 0.12, uProgress - 0.25, r);
        float flick = 0.55 + 0.85 * es_noise2(vec2(uSeed * 9.0, uTime * uFlicker));

        col = mix(uColor2, uColor, clamp(lines * 2.4, 0.0, 1.0));
        col += vec3(1.0) * pow(lines, 2.0) * 1.6;
        a = lines * radial * reach * flick * uOpacity;

      #elif ES_DECAL == 3
        /* --------------------------------------------------------- molten --- */
        vec2 w = es_worley2(es_warp(p, uScale * 0.22, 1.1, uSeed) * uScale + uSeed * 23.0);
        float gap = w.y - w.x;
        /* Seams open and close along their length instead of running at one
           constant width the whole way round a cell. */
        float vary = 0.45 + 1.25 * es_fbm2(p * uScale * 0.55 + uSeed * 5.0, 3, 2.2, 0.5);
        float crack = smoothstep(uWidth * 2.6 * vary, uWidth * 0.2 * vary, gap);
        float core = smoothstep(uWidth * 1.1 * vary, 0.0, gap);

        /* The network only reaches as far as the blast did. */
        float reach = smoothstep(uProgress + 0.1, uProgress - 0.45, r);

        /* Convection inside the crack. */
        float churn = es_fbm2(p * uScale * 0.8 + vec2(0.0, -uTime * uChurn * 0.35), 3, 2.1, 0.5);
        float heat = (0.45 + 0.9 * churn);

        col = uColor * crack * heat;
        col += uColor2 * core * heat * 1.15;
        a = clamp(crack * reach * heat, 0.0, 1.0) * uOpacity;

      #elif ES_DECAL == 4
        /* ----------------------------------------------------------- beam --- */
        float along = vUv.x;
        float across = (vUv.y * 2.0 - 1.0);
        float mask = smoothstep(uProgress, uProgress - 0.05, along);
        float n = es_fbm2(vec2(along * uScale * 3.0, across * uScale) + uSeed * 17.0, 4, 2.1, 0.55);

        float bar = smoothstep(1.0, 0.05, abs(across) + (n - 0.5) * 0.55);
        float core = pow(clamp(1.0 - abs(across) * 2.2, 0.0, 1.0), 3.0);

        col = uColor * bar * (0.3 + 0.7 * n);
        col += uColor2 * core * 1.1;
        /* Ends never quite reach the geometry edge. */
        mask *= smoothstep(0.0, 0.04, along) * smoothstep(1.0, 0.94, along);
        a = (bar * 0.5 + core * 0.7) * mask * uOpacity;

      #elif ES_DECAL == 5
        /* ---------------------------------------------------------- snare --- */
        float churn = es_fbm2(p * uScale + vec2(uTime * uChurn * 0.25, uSeed * 11.0), 4, 2.2, 0.55);
        float body = smoothstep(1.0, 0.55, r) * (0.12 + 0.5 * churn);

        /* The boundary is the promise the targeting circle made. */
        float rim = smoothstep(uWidth, 0.0, abs(r - uProgress));
        float inner = smoothstep(uWidth * 0.6, 0.0, abs(r - uProgress * 0.62));

        /* Arcs chasing each other around the rim. */
        float ang = atan(p.y, p.x);
        float chase = pow(0.5 + 0.5 * sin(ang * 6.0 - uTime * 3.4 + uSeed * 6.0), 6.0);

        col = uColor * body;
        col += uColor2 * (rim * (1.2 + 1.8 * chase) + inner * 0.55);
        a = clamp(body * 0.45 + rim * 1.0 + inner * 0.35, 0.0, 1.0) * uOpacity;

      #else
        /* ---------------------------------------------------------- shock --- */
        float n = es_fbm2(p * uScale + uSeed * 3.0, 3, 2.2, 0.5);
        float ring = smoothstep(uWidth, 0.0, abs(r - uProgress) + (n - 0.5) * 0.12);
        col = uColor * (0.6 + 0.9 * n);
        col += uColor2 * pow(ring, 3.0);
        a = ring * uOpacity;
      #endif

        /* Circular decals never square off at the quad edge. */
      #if ES_DECAL != 4
        a *= smoothstep(1.0, 0.9, r);
      #endif

        if (a < 0.004) discard;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
  });
}

class Decal {
  constructor(type, geometry) {
    this.type = type;
    this.material = createDecalMaterial(type);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 3 + TYPES[type];
    this.mesh.frustumCulled = false;
    this.uniforms = this.material.uniforms;
    this.age = 0;
    this.life = 1;
    this.fadeIn = 0.05;
    this.peak = 1;
    this.active = false;
  }
}

export class GroundDecals {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.geometry = createGroundQuad();
    this.pools = new Map();
  }

  _acquire(type) {
    let pool = this.pools.get(type);
    if (!pool) {
      pool = [];
      this.pools.set(type, pool);
    }
    let decal = pool.find((d) => !d.active);
    if (!decal) {
      decal = new Decal(type, this.geometry);
      this.scene.add(decal.mesh);
      pool.push(decal);
    }
    return decal;
  }

  /**
   * @param {string} type   frost | scorch | electric | molten | beam | snare | shock
   * @param {object} o      placement + look
   * @returns {Decal}       live handle — keep driving `uniforms.uProgress` if you like
   */
  spawn(type, o) {
    const d = this._acquire(type);
    const u = d.uniforms;

    d.mesh.position.set(o.position.x, o.y ?? 0.02 + TYPES[type] * 0.004, o.position.z);
    d.mesh.rotation.y = o.rotation ?? 0;
    d.mesh.scale.set(o.width ?? o.size ?? 1, 1, o.length ?? o.size ?? 1);
    d.mesh.visible = true;

    u.uColor.value.set(o.color ?? '#ffffff');
    u.uColor2.value.set(o.color2 ?? o.color ?? '#ffffff');
    u.uSeed.value = o.seed ?? Math.random() * 100;
    u.uScale.value = o.scale ?? 3;
    u.uSharp.value = o.sharp ?? 2;
    u.uWidth.value = o.width2 ?? 0.06;
    u.uChurn.value = o.churn ?? 1;
    u.uFlicker.value = o.flicker ?? 6;
    u.uProgress.value = o.progress ?? 1;
    u.uOpacity.value = 0;
    u.uAge.value = 0;

    d.age = 0;
    d.life = o.life ?? 2;
    d.fadeIn = o.fadeIn ?? 0.06;
    d.peak = o.opacity ?? 1;
    d.hold = o.hold ?? 0;
    d.active = true;
    return d;
  }

  update(dt) {
    for (const pool of this.pools.values()) {
      for (const d of pool) {
        if (!d.active) continue;
        d.age += dt;
        const t = d.age / d.life;
        if (t >= 1) {
          d.active = false;
          d.mesh.visible = false;
          continue;
        }
        const fadeIn = clamp01(d.age / Math.max(d.fadeIn, 1e-3));
        const holdT = clamp01((d.age - d.hold) / Math.max(d.life - d.hold, 1e-3));
        const fadeOut = 1 - holdT * holdT;
        d.uniforms.uOpacity.value = d.peak * fadeIn * fadeOut;
        d.uniforms.uAge.value = t;
      }
    }
  }

  clear() {
    for (const pool of this.pools.values()) {
      for (const d of pool) {
        d.active = false;
        d.mesh.visible = false;
      }
    }
  }
}
