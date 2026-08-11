/**
 * The noise bench. Hashes, value/gradient noise, fbm, worley and a curl field —
 * every texture in this sandbox comes out of these functions, so they are kept
 * cheap enough to run per-pixel and per-particle-vertex.
 */
export const noiseGLSL = /* glsl */ `
#ifndef ES_NOISE_INCLUDED
#define ES_NOISE_INCLUDED

float es_hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float es_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float es_hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec2 es_hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 es_hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

/* ------------------------------------------------------------- value ---- */

float es_noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = es_hash12(i);
  float b = es_hash12(i + vec2(1.0, 0.0));
  float c = es_hash12(i + vec2(0.0, 1.0));
  float d = es_hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float es_noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = es_hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = es_hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = es_hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = es_hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = es_hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = es_hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = es_hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = es_hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

/* --------------------------------------------------------- simplex-ish ---- */

/* Gradient noise on a simplex lattice — smoother than value noise where the
   surface is lit, which matters for the ice and the meteor. */
float es_snoise(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - 2.0 * K2);
  vec3 d3 = d0 - (1.0 - 3.0 * K2);
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, es_hash33(i) - 0.5),
    dot(d1, es_hash33(i + i1) - 0.5),
    dot(d2, es_hash33(i + i2) - 0.5),
    dot(d3, es_hash33(i + 1.0) - 0.5)
  );
  return dot(vec4(31.316), n);
}

/* ---------------------------------------------------------------- fbm ---- */

float es_fbm2(vec2 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * es_noise2(p);
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

float es_fbm3(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * es_noise3(p);
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

/* Ridged fbm — the shape that reads as fracture, crack and flame tongue. */
float es_ridged(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(es_snoise(p) * 2.0);
    sum += amp * n * n;
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return sum / max(norm, 1e-4);
}

/* -------------------------------------------------------------- worley ---- */

/* Returns (nearest, second nearest). The gap between them is the crack. */
vec2 es_worley2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = es_hash22(i + g);
      float d = length(g + o - f);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec2(d1, d2);
}

float es_worley3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = es_hash33(i + g);
        d1 = min(d1, length(g + o - f));
      }
    }
  }
  return d1;
}

/* ---------------------------------------------------------------- curl ---- */

/* Cheap curl of a value-noise field. Used to push particles around without
   ever writing a position back to the CPU. */
vec3 es_curl(vec3 p, float eps) {
  float n1 = es_noise3(p + vec3(0.0, eps, 0.0));
  float n2 = es_noise3(p - vec3(0.0, eps, 0.0));
  float n3 = es_noise3(p + vec3(0.0, 0.0, eps));
  float n4 = es_noise3(p - vec3(0.0, 0.0, eps));
  float n5 = es_noise3(p + vec3(eps, 0.0, 0.0));
  float n6 = es_noise3(p - vec3(eps, 0.0, 0.0));
  float x = (n3 - n4) - (n1 - n2);
  float y = (n5 - n6) - (n3 - n4);
  float z = (n1 - n2) - (n5 - n6);
  return normalize(vec3(x, y, z) + 1e-6) * (0.5 / eps);
}

#endif
`;
