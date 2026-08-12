/* ============================================================
   SOLID — the one shader every non-terrain surface goes through

   Two programs compiled from the same source: one for single meshes
   with a model matrix, one instanced for the boulder field. Both use
   the same lighting as the ground, including the baked sun-occlusion
   mask, so a rock and the regolith under it agree about where the
   shadow line is.
   ============================================================ */

import { createProgram, buffer, vao } from './gl.js';
import { STRIDE } from './mesh.js';

const COMMON = `
precision highp float;
precision highp sampler2D;
`;

const VS = (instanced) => `#version 300 es
${COMMON}
in vec3 aPos;
in vec3 aNrm;
in vec3 aCol;
in vec2 aAux;
${instanced ? `
in vec4 aIRot;      // quaternion
in vec4 aIPosScale; // xyz position, w uniform scale
in vec3 aITint;
` : ''}

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vWorld;
out vec3 vNrm;
out vec3 vCol;
out vec2 vAux;

vec3 qrot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

void main() {
${instanced ? `
  vec3 p = qrot(aIRot, aPos * aIPosScale.w) + aIPosScale.xyz;
  vec3 n = qrot(aIRot, aNrm);
  vCol = aCol * aITint;
` : `
  vec3 p = (uModel * vec4(aPos, 1.0)).xyz;
  vec3 n = mat3(uModel) * aNrm;
  vCol = aCol;
`}
  vWorld = p;
  vNrm = normalize(n);
  vAux = aAux;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

const FS = (procedural) => `#version 300 es
${COMMON}
in vec3 vWorld;
in vec3 vNrm;
in vec3 vCol;
in vec2 vAux;

uniform vec3 uCam;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uExposure;
uniform float uEmissive;
uniform vec3 uEmissiveColor;
uniform sampler2D uFineMask;
uniform sampler2D uCoarseMask;
uniform vec4 uFineInfo;
uniform vec4 uCoarseInfo;
uniform int uHeadlights;
uniform vec3 uLampPos;
uniform vec3 uLampDir;
uniform float uOcclude;   // extra ambient occlusion multiplier for cavities

out vec4 fragColor;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i), n100 = hash31(i + vec3(1, 0, 0));
  float n010 = hash31(i + vec3(0, 1, 0)), n110 = hash31(i + vec3(1, 1, 0));
  float n001 = hash31(i + vec3(0, 0, 1)), n101 = hash31(i + vec3(1, 0, 1));
  float n011 = hash31(i + vec3(0, 1, 1)), n111 = hash31(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += vnoise3(p) * a; p *= 2.03; a *= 0.5; }
  return s;
}

float sunMask(vec2 p) {
  float halfFine = -uFineInfo.x;
  float edge = max(abs(p.x), abs(p.y));
  vec2 cu = (p - uCoarseInfo.xy) / (uCoarseInfo.z * uCoarseInfo.w);
  float mc = texture(uCoarseMask, cu).r;
  if (edge > halfFine - 10.0) return mc;
  vec2 fu = (p - uFineInfo.xy) / (uFineInfo.z * uFineInfo.w);
  return mix(mc, texture(uFineMask, fu).r,
             1.0 - smoothstep(halfFine - 46.0, halfFine - 10.0, edge));
}

void main() {
  vec3 N = normalize(vNrm);
  vec3 V = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);
  vec3 albedo = vCol;
  float rough = vAux.x;
  float dusty = vAux.y;

${procedural ? `
  /* Triplanar plagioclase. The chipping normals fade with distance so
     a pebble at 200 m does not turn into a field of noise. */
  float det = clamp(1.0 - dist / 120.0, 0.0, 1.0);
  vec3 wp = vWorld * 3.4;
  float m = fbm3(wp * 0.9);
  float chips = fbm3(wp * 6.0);
  albedo *= 0.80 + m * 0.45;
  albedo = mix(albedo, albedo * vec3(1.10, 1.04, 0.95), step(0.62, m));
  if (det > 0.001) {
    vec3 g = vec3(
      fbm3(wp * 6.0 + vec3(0.15, 0.0, 0.0)) - chips,
      fbm3(wp * 6.0 + vec3(0.0, 0.15, 0.0)) - chips,
      fbm3(wp * 6.0 + vec3(0.0, 0.0, 0.15)) - chips);
    N = normalize(N + g * 2.6 * det);
  }
  // Regolith settles on every up-face out here; nothing washes it off.
  float up = clamp(N.y, 0.0, 1.0);
  albedo = mix(albedo, vec3(0.115, 0.110, 0.103), up * up * 0.62 * dusty);
` : `
  // Dust accumulates on horizontal surfaces of the machine too, and the
  // rover has been on the surface for a while.
  float up = clamp(N.y, 0.0, 1.0);
  albedo = mix(albedo, vec3(0.16, 0.152, 0.14), up * up * dusty);
`}

  float mu0 = max(dot(N, uSun), 0.0);
  float mu = max(dot(N, V), 0.0);
  float ls = mu0 / (mu0 + mu + 1e-3);

  float shadow = sunMask(vWorld.xz);
  vec3 col = albedo * ls * 1.55 * uSunColor * shadow;

  // A tight specular lobe. Out here it is the only thing that says
  // "painted metal" rather than "grey card".
  if (mu0 > 0.0) {
    vec3 H = normalize(uSun + V);
    float a = max(rough * rough, 0.004);
    float ndh = max(dot(N, H), 0.0);
    float d = exp((ndh * ndh - 1.0) / (a * ndh * ndh)) / (3.14159 * a * ndh * ndh * ndh * ndh + 1e-4);
    col += uSunColor * shadow * min(d, 60.0) * (1.0 - rough) * 0.16 * mu0;
  }

  col += vec3(0.030, 0.038, 0.058) * albedo * (0.30 + 0.70 * (N.y * 0.5 + 0.5)) * uOcclude;

  if (uHeadlights == 1) {
    vec3 toL = uLampPos - vWorld;
    float ld = length(toL);
    vec3 Ld = toL / max(ld, 1e-3);
    float cone = smoothstep(0.80, 0.955, dot(-Ld, normalize(uLampDir)));
    float atten = 1.0 / (1.0 + ld * ld * 0.010);
    col += vec3(0.95, 0.96, 1.0) * albedo * max(dot(N, Ld), 0.0) * cone * atten * 4.0;
  }

  col += uEmissiveColor * uEmissive;

  fragColor = vec4(col * uExposure, 1.0);
}`;

export class SolidRenderer {
  constructor(gl) {
    this.gl = gl;
    this.plain = createProgram(gl, VS(false), FS(false), 'solid');
    this.rock = createProgram(gl, VS(true), FS(true), 'solid-rock');
  }

  mesh(data, program = this.plain) {
    const gl = this.gl;
    const vb = buffer(gl, data.vertices);
    const ib = buffer(gl, data.indices, gl.ELEMENT_ARRAY_BUFFER);
    const s = STRIDE * 4;
    const a = program.a;
    const v = vao(gl, [
      { buffer: vb, loc: a.aPos, size: 3, stride: s, offset: 0 },
      { buffer: vb, loc: a.aNrm, size: 3, stride: s, offset: 12 },
      { buffer: vb, loc: a.aCol, size: 3, stride: s, offset: 24 },
      { buffer: vb, loc: a.aAux, size: 2, stride: s, offset: 36 }
    ], ib);
    return {
      vao: v, count: data.count,
      type: data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      vb, ib
    };
  }

  /* Instanced variant: the same geometry with per-instance rotation,
     position+scale and tint. Used for the boulder field. */
  instancedMesh(data, instances) {
    const gl = this.gl;
    const base = this.mesh(data, this.rock);
    const rotBuf = buffer(gl, instances.rot);
    const posBuf = buffer(gl, instances.posScale);
    const tintBuf = buffer(gl, instances.tint);
    const a = this.rock.a;
    const s = STRIDE * 4;
    base.vao = vao(gl, [
      { buffer: base.vb, loc: a.aPos, size: 3, stride: s, offset: 0 },
      { buffer: base.vb, loc: a.aNrm, size: 3, stride: s, offset: 12 },
      { buffer: base.vb, loc: a.aCol, size: 3, stride: s, offset: 24 },
      { buffer: base.vb, loc: a.aAux, size: 2, stride: s, offset: 36 },
      { buffer: rotBuf, loc: a.aIRot, size: 4, divisor: 1 },
      { buffer: posBuf, loc: a.aIPosScale, size: 4, divisor: 1 },
      { buffer: tintBuf, loc: a.aITint, size: 3, divisor: 1 }
    ], base.ib);
    base.instances = instances.count;
    return base;
  }

  /* Bind the frame-constant state once per program per frame. */
  beginFrame(program, ctx, terrain) {
    const gl = this.gl;
    program.use();
    const u = program.u;
    gl.uniformMatrix4fv(u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(u.uCam, ctx.camPos);
    gl.uniform3fv(u.uSun, terrain.sunDir);
    gl.uniform3fv(u.uSunColor, ctx.sunColor);
    gl.uniform1f(u.uExposure, ctx.exposure);
    gl.uniform1f(u.uEmissive, 0);
    gl.uniform3f(u.uEmissiveColor, 0, 0, 0);
    gl.uniform1f(u.uOcclude, 1);
    gl.uniform1i(u.uHeadlights, ctx.headlights ? 1 : 0);
    gl.uniform3fv(u.uLampPos, ctx.lampPos);
    gl.uniform3fv(u.uLampDir, ctx.lampDir);
    gl.uniform4fv(u.uFineInfo, [-terrain.fineHalf, -terrain.fineHalf, terrain.fineCell, terrain.fineN]);
    gl.uniform4fv(u.uCoarseInfo, [-terrain.coarseHalf, -terrain.coarseHalf, terrain.coarseCell, terrain.coarseN]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, terrain.fineMaskTex);
    gl.uniform1i(u.uFineMask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, terrain.coarseMaskTex);
    gl.uniform1i(u.uCoarseMask, 1);
  }

  draw(mesh, model, { emissive = 0, emissiveColor = [0, 0, 0], occlude = 1 } = {}) {
    const gl = this.gl, u = this.plain.u;
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniform1f(u.uEmissive, emissive);
    gl.uniform3fv(u.uEmissiveColor, emissiveColor);
    gl.uniform1f(u.uOcclude, occlude);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
  }

  drawInstanced(mesh, count = mesh.instances) {
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.type, 0, count);
  }
}
