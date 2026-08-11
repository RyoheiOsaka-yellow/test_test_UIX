import * as THREE from 'three';

/**
 * The finishing pass: contrast, saturation, lift, vignette, a touch of lateral
 * chromatic aberration, an optional barrel distortion for the heavy casts, and
 * film grain to keep the gradients from banding on a dark stage.
 */
export const GradeShader = {
  name: 'GradeShader',

  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.12 },
    uLift: { value: -0.006 },
    uVignette: { value: 0.42 },
    uChromatic: { value: 0.0016 },
    uGrain: { value: 0.028 },
    uDistortion: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uLift;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uGrain;
    uniform float uDistortion;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centred = uv - 0.5;
      float r2 = dot(centred, centred);

      /* Barrel distortion — driven up by a heavy cast, zero at rest. */
      if (uDistortion != 0.0) {
        uv = 0.5 + centred * (1.0 + uDistortion * r2);
      }

      /* Lateral chromatic aberration, scaled by distance from the centre. */
      vec2 dir = centred * uChromatic * (0.4 + r2 * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      /* Contrast around 0.5, then saturation around luma. */
      col = (col - 0.5) * uContrast + 0.5 + uLift;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);

      /* Vignette. */
      col *= 1.0 - uVignette * smoothstep(0.18, 0.85, r2 * 1.9);

      /* Grain, animated so it never reads as a texture. */
      float g = hash12(gl_FragCoord.xy + fract(uTime) * 941.0) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
