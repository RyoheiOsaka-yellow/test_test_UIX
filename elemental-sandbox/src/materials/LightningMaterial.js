import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * The ribbon.
 *
 * One strip of quads, one shader, four parametric paths. The buffer carries no
 * positions at all — only `aT` along the strip, `aSide` across it and `aIndex`
 * saying which filament of the bundle this instance is. Everything else is
 * resolved here:
 *
 *   PATH 0  bolt    — a straight run from start to end, shattered by two
 *                     octaves of noise and wound with a slow spiral.
 *   PATH 1  helix   — a ribbon spiralling around the beam axis.
 *   PATH 2  crawl   — a tendril crawling out across the floor from a centre.
 *   PATH 3  rim     — an arc running around the boundary of a circle.
 *
 * The strip is widened in the plane perpendicular to both its own tangent and
 * the view vector, so it stays a solid stroke from every camera angle without a
 * single CPU-side vertex write.
 */

const PATHS = { bolt: 0, helix: 1, crawl: 2, rim: 3 };

export function createRibbonMaterial({
  path = 'bolt',
  blending = THREE.AdditiveBlending,
  depthWrite = false,
  extra = {},
} = {}) {
  const uniforms = {
    uTime: frame.uTime,
    uSimTime: frame.uSimTime,
    uCameraPos: frame.uCameraPos,

    uStart: { value: new THREE.Vector3() },
    uEnd: { value: new THREE.Vector3(0, 0, 1) },
    uCentre: { value: new THREE.Vector3() },
    uAxis: { value: new THREE.Vector3(0, 0, 1) },

    uHead: { value: 1 },
    uTail: { value: 0 },
    uWidth: { value: 0.12 },
    uWidthJitter: { value: 0.5 },
    uTaper: { value: 0.5 },
    uCount: { value: 6 },

    uChaos: { value: 0.5 },
    uChaosScale: { value: 1.5 },
    uChaosDetail: { value: 3.4 },
    uChaosSpeed: { value: 14 },
    uSag: { value: 0.2 },
    uSpiral: { value: 0.4 },
    uSpiralRadius: { value: 0.25 },

    uRadius: { value: 1 },
    uTurns: { value: 3 },
    uLift: { value: 0.4 },
    uArc: { value: 1.2 },
    uPhase: { value: 0 },
    uWander: { value: 0.5 },

    uColorCore: { value: new THREE.Color('#ffffff') },
    uColorMid: { value: new THREE.Color('#a9c8ff') },
    uColorEdge: { value: new THREE.Color('#7b4dff') },
    uIntensity: { value: 2.5 },
    uOpacity: { value: 1 },
    uFlicker: { value: 0.6 },
    uFlickerRate: { value: 15 },
    uSeed: { value: 0 },

    ...extra,
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: { ES_PATH: PATHS[path] ?? 0 },
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
      uniform vec3 uCentre;
      uniform vec3 uAxis;
      uniform float uHead;
      uniform float uTail;
      uniform float uWidth;
      uniform float uWidthJitter;
      uniform float uTaper;
      uniform float uCount;
      uniform float uChaos;
      uniform float uChaosScale;
      uniform float uChaosDetail;
      uniform float uChaosSpeed;
      uniform float uSag;
      uniform float uSpiral;
      uniform float uSpiralRadius;
      uniform float uRadius;
      uniform float uTurns;
      uniform float uLift;
      uniform float uArc;
      uniform float uPhase;
      uniform float uWander;
      uniform float uSeed;

      attribute float aT;
      attribute float aSide;
      attribute float aIndex;

      varying float vT;
      varying float vCross;
      varying float vFilament;
      varying float vAlive;

      /* Where filament fi is at parameter t. Every path lives in here. */
      vec3 pathPoint(float t, float fi) {
        float phase = fi * 7.31 + uSeed * 13.7;
        float ring = (fi + 1.0) / max(uCount, 1.0);

      #if ES_PATH == 0
        /* ---- bolt ---- */
        vec3 base = mix(uStart, uEnd, t);
        float len = max(distance(uStart, uEnd), 0.001);
        mat3 B = es_basis(uEnd - uStart);

        /* Pinned at both ends, loosest in the middle. */
        float env = sin(t * ES_PI);
        float amp = uChaos * env;

        float n1 = es_snoise(vec3(t * len * uChaosScale, phase, uTime * uChaosSpeed * 0.1));
        float n2 = es_snoise(vec3(t * len * uChaosScale * uChaosDetail + 31.0,
                                  phase + 5.0, uTime * uChaosSpeed * 0.17));
        float n3 = es_snoise(vec3(t * len * uChaosScale * 0.4 - 11.0,
                                  phase + 19.0, uTime * uChaosSpeed * 0.06));
        vec2 lateral = vec2(n1 + n3 * 0.6, n2 + n3 * 0.4) * amp;

        /* Filaments wound around the trunk so the bundle has volume. */
        float a = t * uSpiral * ES_TAU + phase;
        lateral += vec2(cos(a), sin(a)) * ring * uSpiralRadius * env;

        base += B * vec3(lateral, 0.0);
        base.y -= uSag * env;
        return base;

      #elif ES_PATH == 1
        /* ---- helix ---- */
        vec3 base = mix(uStart, uEnd, t);
        mat3 B = es_basis(uEnd - uStart);
        float a = t * uTurns * ES_TAU + phase + uPhase;
        float r = uRadius * (0.65 + 0.35 * sin(t * ES_PI));
        r *= 1.0 - uTaper * t;
        vec2 lateral = vec2(cos(a), sin(a)) * r;
        lateral += vec2(
          es_snoise(vec3(t * 6.0, phase, uTime * 1.4)),
          es_snoise(vec3(t * 6.0 + 9.0, phase, uTime * 1.4))
        ) * uChaos * 0.12;
        return base + B * vec3(lateral, 0.0);

      #elif ES_PATH == 2
        /* ---- crawl ---- : a tendril feeling its way out across the floor. */
        float a0 = (fi / max(uCount, 1.0)) * ES_TAU + uPhase;
        float wander = uWander * (
          es_snoise(vec3(t * 3.2, phase, uTime * 0.9)) * 0.7 +
          es_snoise(vec3(t * 9.0, phase + 4.0, uTime * 2.1)) * 0.3
        );
        float a = a0 + wander * (0.3 + t);
        float r = uRadius * t;
        vec3 p = uCentre + vec3(cos(a) * r, 0.0, sin(a) * r);
        /* Skips off the floor rather than sliding along it. */
        p.y += uLift * abs(sin(t * 9.0 + phase)) * (1.0 - t) + 0.03;
        return p;

      #else
        /* ---- rim ---- */
        float a = uPhase + phase + t * uArc;
        float r = uRadius * (1.0 + 0.05 * es_snoise(vec3(t * 5.0, phase, uTime * 2.0)));
        vec3 p = uCentre + vec3(cos(a) * r, 0.0, sin(a) * r);
        p.y += uLift * (0.35 + 0.65 * sin(t * ES_PI)) *
               (0.6 + 0.4 * es_snoise(vec3(t * 7.0, phase, uTime * 3.0)));
        return p;
      #endif
      }

      void main() {
        float fi = aIndex;
        float t = aT;

        /* The strike front and its tail. Outside the window the strip is
           collapsed to zero width instead of being drawn transparent. */
        float alive = step(uTail, t) * step(t, uHead);
        vAlive = alive;

        vec3 p0 = pathPoint(t, fi);
        vec3 p1 = pathPoint(min(t + 0.012, 1.0), fi);
        vec3 tangent = normalize(p1 - p0 + vec3(1e-5));
        vec3 toCam = normalize(uCameraPos - p0);
        vec3 side = normalize(cross(tangent, toCam) + vec3(1e-6));

        /* Taper toward both ends, plus a per-filament thickness scatter. */
        float taperT = pow(sin(clamp(t, 0.0, 1.0) * ES_PI), uTaper);
        float jitter = 1.0 + uWidthJitter * (es_hash11(fi * 3.17 + uSeed) - 0.5);
        float w = uWidth * mix(1.0, taperT, uTaper > 0.0 ? 1.0 : 0.0) * jitter * alive;

        vec3 world = p0 + side * (aSide * w);

        vT = t;
        vCross = aSide;
        vFilament = fi;

        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${noiseGLSL}
      ${commonGLSL}

      uniform float uTime;
      uniform vec3 uColorCore;
      uniform vec3 uColorMid;
      uniform vec3 uColorEdge;
      uniform float uIntensity;
      uniform float uOpacity;
      uniform float uFlicker;
      uniform float uFlickerRate;
      uniform float uHead;
      uniform float uSeed;

      varying float vT;
      varying float vCross;
      varying float vFilament;
      varying float vAlive;

      void main() {
        if (vAlive < 0.5) discard;

        /* Across the strip: a hot core inside a soft sheath. */
        float d = abs(vCross);
        float core = pow(1.0 - d, 6.0);
        float sheath = pow(1.0 - d, 1.6);

        vec3 col = es_ramp3(uColorCore, uColorMid, uColorEdge, d);
        col += uColorCore * core * 1.8;

        /* Gutter and re-strike: a fast flicker that walks along the strip so the
           whole filament never dies at once. */
        float f = es_noise2(vec2(vT * 9.0 + vFilament * 3.7, uTime * uFlickerRate));
        float flick = mix(1.0, 0.25 + 1.5 * f, uFlicker);

        /* Brightest right at the strike front. */
        float head = smoothstep(0.16, 0.0, uHead - vT);

        /* Flicker modulates opacity, not opacity *and* colour — doing both
           squares it, and seven overlapping filaments then clip to white. */
        float a = sheath * flick * uOpacity;
        a *= 0.65 + 0.6 * head;
        if (a < 0.006) discard;

        gl_FragColor = vec4(col * uIntensity * (0.8 + 0.45 * head), a);
      }
    `,
  });

  material.userData.uniforms = uniforms;
  return material;
}
