// The lantern field.
//
// Everything in Lineworld is drawn with the same idea: geometry has no colour of
// its own until light touches it. A handful of "lamps" (soft spheres) and
// "pulses" (expanding shells, e.g. a bark) are uploaded as uniforms every frame,
// and each fragment asks how much light reaches it. Below a per-vertex threshold
// a line simply is not there yet -- which is what makes structures sketch
// themselves into existence as you walk towards them.

import * as THREE from 'three';

export const MAX_LAMPS = 8;
export const MAX_PULSES = 4;

const vec3Array = (n) => Array.from({ length: n }, () => new THREE.Vector3());
const colArray = (n) => Array.from({ length: n }, () => new THREE.Color(1, 1, 1));

export const uniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uFade: { value: 1 },
  uLampCount: { value: 0 },
  uLampPos: { value: vec3Array(MAX_LAMPS) },
  uLampParams: { value: vec3Array(MAX_LAMPS) }, // radius, intensity, inner ratio
  uLampColor: { value: colArray(MAX_LAMPS) },
  uPulseCount: { value: 0 },
  uPulsePos: { value: vec3Array(MAX_PULSES) },
  uPulseParams: { value: vec3Array(MAX_PULSES) }, // radius, width, intensity
  uPulseColor: { value: colArray(MAX_PULSES) },
};

let lampN = 0;
let pulseN = 0;

export function beginFrame(time) {
  uniforms.uTime.value = time;
  lampN = 0;
  pulseN = 0;
}

export function addLamp(pos, radius, intensity, color, inner = 0.22) {
  if (lampN >= MAX_LAMPS) return;
  uniforms.uLampPos.value[lampN].copy(pos);
  uniforms.uLampParams.value[lampN].set(radius, intensity, inner);
  uniforms.uLampColor.value[lampN].copy(color);
  lampN++;
}

export function addPulse(pos, radius, width, intensity, color) {
  if (pulseN >= MAX_PULSES) return;
  uniforms.uPulsePos.value[pulseN].copy(pos);
  uniforms.uPulseParams.value[pulseN].set(radius, width, intensity);
  uniforms.uPulseColor.value[pulseN].copy(color);
  pulseN++;
}

export function endFrame() {
  uniforms.uLampCount.value = lampN;
  uniforms.uPulseCount.value = pulseN;
}

// --------------------------------------------------------------------------

const FIELD_GLSL = /* glsl */ `
#define MAX_LAMPS ${MAX_LAMPS}
#define MAX_PULSES ${MAX_PULSES}

uniform int  uLampCount;
uniform vec3 uLampPos[MAX_LAMPS];
uniform vec3 uLampParams[MAX_LAMPS];
uniform vec3 uLampColor[MAX_LAMPS];
uniform int  uPulseCount;
uniform vec3 uPulsePos[MAX_PULSES];
uniform vec3 uPulseParams[MAX_PULSES];
uniform vec3 uPulseColor[MAX_PULSES];

float lightField(vec3 p, out vec3 tint) {
  float total = 0.0;
  vec3 col = vec3(0.0);

  for (int i = 0; i < MAX_LAMPS; i++) {
    if (i >= uLampCount) break;
    float d = distance(p, uLampPos[i]);
    float r = uLampParams[i].x;
    float a = 1.0 - smoothstep(r * uLampParams[i].z, r, d);
    a *= uLampParams[i].y;
    total += a;
    col += uLampColor[i] * a;
  }

  for (int i = 0; i < MAX_PULSES; i++) {
    if (i >= uPulseCount) break;
    float d = distance(p, uPulsePos[i]);
    float r = uPulseParams[i].x;
    float w = uPulseParams[i].y;
    float a = (1.0 - smoothstep(0.0, w, abs(d - r))) * uPulseParams[i].z;
    total += a;
    col += uPulseColor[i] * a;
  }

  tint = col / max(total, 0.0001);
  return total;
}
`;

const LINE_VERT = /* glsl */ `
attribute vec3  aColor;
attribute float aThresh;
attribute float aSway;
attribute float aSeed;

uniform float uTime;
uniform float uWind;

varying vec3  vWorld;
varying vec3  vColor;
varying float vThresh;

void main() {
  vec3 p = position;
  float t = uTime * 1.15 + aSeed * 6.2831853;
  float s = aSway * uWind;
  if (s > 0.0001) {
    float gust = 0.65 + 0.35 * sin(uTime * 0.31 + p.x * 0.02 + p.z * 0.017);
    p.x += sin(t + p.y * 0.42) * s * gust;
    p.z += cos(t * 0.83 + p.y * 0.37) * s * 0.75 * gust;
    // a little vertical lift too -- barely visible on grass, but it is what
    // makes the water surface read as moving
    p.y += sin(t * 1.6 + p.x * 0.7) * s * 0.30;
  }
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vColor = aColor;
  vThresh = aThresh;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
${FIELD_GLSL}
uniform float uFade;
uniform float uTime;

varying vec3  vWorld;
varying vec3  vColor;
varying float vThresh;

void main() {
  vec3 tint;
  float amt = lightField(vWorld, tint);
  // Below its personal threshold a line has not been drawn yet.
  float draw = smoothstep(vThresh, vThresh + 0.20, amt);
  float lit = clamp(amt, 0.0, 1.4);
  float a = pow(min(lit, 1.0), 0.72) * draw * uFade;
  if (a < 0.004) discard;
  vec3 c = mix(vColor, vColor * tint * 1.9, 0.62);
  gl_FragColor = vec4(c * (0.55 + 0.70 * lit), a);
}
`;

export function createLineMaterial(extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...extra,
  });
}

// --------------------------------------------------------------------------
// Glow points: soft additive blobs used for the lantern core, red lights,
// scent motes and thrown dirt. The sprite is generated in the fragment shader,
// so there is no texture file anywhere in this project.
// --------------------------------------------------------------------------

const GLOW_VERT = /* glsl */ `
attribute vec3  aColor;
attribute float aSize;
attribute float aAlpha;

// pixels-per-world-unit at one unit of depth, so aSize is a real diameter
uniform float uPPU;

varying vec3  vColor;
varying float vAlpha;
varying vec3  vWorld;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  vWorld = wp.xyz;
  vColor = aColor;
  vAlpha = aAlpha;
  gl_PointSize = clamp(aSize * uPPU / max(-mv.z, 0.05), 1.0, 420.0);
  gl_Position = projectionMatrix * mv;
}
`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
${FIELD_GLSL}
uniform float uFade;
uniform float uLit;

varying vec3  vColor;
varying float vAlpha;
varying vec3  vWorld;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float falloff = pow(1.0 - d, 2.6);
  float core = pow(1.0 - d, 12.0) * 0.55;
  float a = (falloff + core) * vAlpha * uFade;
  vec3 c = vColor;
  if (uLit > 0.5) {
    vec3 tint;
    float amt = clamp(lightField(vWorld, tint), 0.0, 1.4);
    a *= amt;
    c = mix(c, c * tint * 1.6, 0.5);
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(c * a, a);
}
`;

const glowMaterials = [];

export function createGlowMaterial({ lit = false } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uLit: { value: lit ? 1 : 0 },
      uPPU: { value: 600 },
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  glowMaterials.push(m);
  return m;
}

/** Call on start and on resize: keeps point sprites sized in world units. */
export function updateGlowProjection(renderer, camera) {
  const h = renderer.getContext().drawingBufferHeight;
  const ppu = (h * camera.projectionMatrix.elements[5]) / 2;
  for (const m of glowMaterials) m.uniforms.uPPU.value = ppu;
}

// --------------------------------------------------------------------------

/** Convenience builder for a static LineSegments soup. */
export class LineBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.thr = [];
    this.sway = [];
    this.seed = [];
  }

  /** a, b: THREE.Vector3-ish {x,y,z}; color: THREE.Color */
  segment(a, b, color, thresh = 0.06, swayA = 0, swayB = 0, seed = 0) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    this.col.push(color.r, color.g, color.b, color.r, color.g, color.b);
    this.thr.push(thresh, thresh);
    this.sway.push(swayA, swayB);
    this.seed.push(seed, seed);
  }

  get count() { return this.pos.length / 6; }

  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aThresh', new THREE.Float32BufferAttribute(this.thr, 1));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.seed, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.LineSegments(g, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}

/** Line segments rewritten from scratch every frame (dog, rings, debris). */
export class DynamicLines {
  constructor(capacity, material) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 6);
    this.color = new Float32Array(capacity * 6);
    this.thresh = new Float32Array(capacity * 2);
    this.sway = new Float32Array(capacity * 2);
    this.seed = new Float32Array(capacity * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.setAttribute('aThresh', new THREE.BufferAttribute(this.thresh, 1));
    g.setAttribute('aSway', new THREE.BufferAttribute(this.sway, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    g.setDrawRange(0, 0);
    this.geometry = g;
    this.mesh = new THREE.LineSegments(g, material);
    this.mesh.frustumCulled = false;
    this.n = 0;
  }

  reset() { this.n = 0; }

  segment(a, b, color, thresh = 0.01) {
    if (this.n >= this.capacity) return;
    const i = this.n;
    const p = this.position, c = this.color;
    p[i * 6] = a.x; p[i * 6 + 1] = a.y; p[i * 6 + 2] = a.z;
    p[i * 6 + 3] = b.x; p[i * 6 + 4] = b.y; p[i * 6 + 5] = b.z;
    c[i * 6] = color.r; c[i * 6 + 1] = color.g; c[i * 6 + 2] = color.b;
    c[i * 6 + 3] = color.r; c[i * 6 + 4] = color.g; c[i * 6 + 5] = color.b;
    this.thresh[i * 2] = thresh; this.thresh[i * 2 + 1] = thresh;
    this.n++;
  }

  commit() {
    this.geometry.setDrawRange(0, this.n * 2);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aThresh.needsUpdate = true;
  }
}

/** A points cloud whose attributes can be rewritten every frame. */
export class GlowPoints {
  constructor(capacity, material) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setDrawRange(0, 0);
    this.geometry = g;
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
    this.n = 0;
  }

  reset() { this.n = 0; }

  push(x, y, z, r, g, b, size, alpha) {
    if (this.n >= this.capacity) return;
    const i = this.n;
    this.position[i * 3] = x; this.position[i * 3 + 1] = y; this.position[i * 3 + 2] = z;
    this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b;
    this.size[i] = size;
    this.alpha[i] = alpha;
    this.n++;
  }

  commit() {
    this.geometry.setDrawRange(0, this.n);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}
