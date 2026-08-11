/**
 * Shared GLSL: signed distance primitives, rotations, easings and the colour
 * ramp helpers. Included by nearly every material in the sandbox.
 */
export const commonGLSL = /* glsl */ `
#ifndef ES_COMMON_INCLUDED
#define ES_COMMON_INCLUDED

#define ES_TAU 6.28318530718
#define ES_PI  3.14159265359

/* ----------------------------------------------------------- rotation ---- */

mat2 es_rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

mat3 es_rotAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float t = 1.0 - c;
  vec3 a = normalize(axis);
  return mat3(
    t * a.x * a.x + c,       t * a.x * a.y - s * a.z, t * a.x * a.z + s * a.y,
    t * a.x * a.y + s * a.z, t * a.y * a.y + c,       t * a.y * a.z - s * a.x,
    t * a.x * a.z - s * a.y, t * a.y * a.z + s * a.x, t * a.z * a.z + c
  );
}

/* Build an orthonormal basis whose +Z is dir. Used everywhere a cast has to
   be laid out along its own direction without a CPU-side matrix. */
mat3 es_basis(vec3 dir) {
  vec3 f = normalize(dir);
  vec3 up = abs(f.y) > 0.97 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 r = normalize(cross(up, f));
  vec3 u = cross(f, r);
  return mat3(r, u, f);
}

/* --------------------------------------------------------------- sdf ---- */

float es_sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float es_sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float es_sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float es_sdTriangleIso(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
               vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

float es_opRound(float d, float r) {
  return d - r;
}

/* ------------------------------------------------------------ easings ---- */

float es_ease(float t) {
  return t * t * (3.0 - 2.0 * t);
}

float es_easeOutCubic(float t) {
  float p = 1.0 - t;
  return 1.0 - p * p * p;
}

float es_easeInCubic(float t) {
  return t * t * t;
}

float es_easeOutQuint(float t) {
  float p = 1.0 - t;
  return 1.0 - p * p * p * p * p;
}

float es_easeOutBack(float t, float overshoot) {
  float c = overshoot + 1.0;
  float p = t - 1.0;
  return 1.0 + c * p * p * p + overshoot * p * p;
}

/* Rise over up, hold, fall over down — the envelope for every burst. */
float es_pulse(float t, float up, float down) {
  if (t <= 0.0 || t >= 1.0) return 0.0;
  float rise = es_easeOutCubic(clamp(t / max(up, 1e-4), 0.0, 1.0));
  float fall = 1.0 - es_easeInCubic(clamp((t - (1.0 - down)) / max(down, 1e-4), 0.0, 1.0));
  return min(rise, fall);
}

/* Band-limited stripe. Positive inside the band, 0 outside, soft soft-edges. */
float es_band(float x, float centre, float halfWidth, float soft) {
  return smoothstep(halfWidth + soft, halfWidth - soft, abs(x - centre));
}

/* -------------------------------------------------------------- colour ---- */

/* Three-stop ramp: core -> mid -> edge. Cheaper and more art-directable than a
   LUT, and it stays a live slider. */
vec3 es_ramp3(vec3 a, vec3 b, vec3 c, float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

vec3 es_blackbody(float t) {
  /* Cheap approximation of a heated body from dull red to blue-white. */
  t = clamp(t, 0.0, 1.0);
  vec3 c = vec3(0.0);
  c.r = smoothstep(0.0, 0.35, t);
  c.g = smoothstep(0.25, 0.85, t);
  c.b = smoothstep(0.62, 1.0, t);
  return c * (0.35 + 1.35 * t);
}

float es_luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/* Fresnel term with a controllable falloff. */
float es_fresnel(vec3 normal, vec3 viewDir, float power) {
  return pow(1.0 - clamp(dot(normalize(normal), normalize(viewDir)), 0.0, 1.0), power);
}

/* ------------------------------------------------------------- shapes ---- */

/* Soft radial sprite with a controllable core. */
float es_sprite(vec2 uv, float core, float soft) {
  float r = length(uv);
  return smoothstep(1.0, core, r) * soft;
}

/* Distance to the boundary of an annulus. */
float es_ring(float r, float radius, float width) {
  return abs(r - radius) - width * 0.5;
}

#endif
`;
