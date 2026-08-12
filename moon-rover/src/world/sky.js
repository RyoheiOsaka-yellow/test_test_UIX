/* ============================================================
   SKY — stars, Milky Way, the sun, and Earth

   There is no atmosphere, so there is no sky: everything here is
   either a star, a 0.53° disc of plasma, or a 1.9° blue marble that
   never moves. At 73° north Earth sits 13°–16° above the horizon and
   stays there — that is the entire reason the relay mission exists.
   ============================================================ */

import { createProgram, buffer, vao } from '../core/gl.js';
import { makeRng, hash2 } from '../core/rng.js';
import { DEG, v3norm, v3cross, v3 } from '../core/math.js';

const SKY_R = 380000;      // where the sky geometry sits, in metres

/* ---------- background: Milky Way, zodiacal light, faint glow ---------- */

const BG_VS = `#version 300 es
precision highp float;
out vec2 vNdc;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vNdc = p * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 1.0, 1.0);
}`;

const BG_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform vec3 uRight, uUp, uFwd;
uniform vec2 uTanFov;
uniform float uExposure;
uniform mat3 uGalactic;
out vec4 fragColor;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 21.7;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                 mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                 mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p *= 2.11; a *= 0.5; }
  return s;
}

void main() {
  vec3 dir = normalize(uFwd + uRight * vNdc.x * uTanFov.x + uUp * vNdc.y * uTanFov.y);
  vec3 g = uGalactic * dir;

  // The band: a bright equatorial ridge with a dust lane cut through it.
  float lat = asin(clamp(g.y, -1.0, 1.0));
  float bl = lat / 0.20;
  float band = exp(-bl * bl);      // not pow(): lat goes negative
  float clump = fbm(g * 5.0) * 0.7 + fbm(g * 17.0) * 0.4;
  float dust = smoothstep(0.35, 0.72, fbm(g * 9.0 + 4.0));
  float mw = band * (0.35 + clump) * (1.0 - dust * 0.72);

  vec3 col = vec3(0.0022, 0.0026, 0.0042);            // the sky is not black
  col += vec3(0.34, 0.36, 0.46) * mw * 0.155;
  col += vec3(0.30, 0.26, 0.20) * band * dust * 0.022;

  // Zodiacal light along the ecliptic, faint and warm.
  float ey = (dir.y - 0.06) / 0.34;
  float ecl = exp(-ey * ey);
  col += vec3(0.05, 0.045, 0.038) * ecl * 0.055;

  fragColor = vec4(col * uExposure, 1.0);
}`;

/* ---------- stars ---------- */

const STAR_VS = `#version 300 es
precision highp float;
in vec3 aDir;
in vec2 aMag;      // brightness, colour index
uniform mat4 uViewProj;
uniform vec3 uCam;
uniform float uPointScale;
out float vBright;
out float vCi;
void main() {
  vec3 p = uCam + aDir * ${SKY_R}.0;
  gl_Position = uViewProj * vec4(p, 1.0);
  vBright = aMag.x;
  vCi = aMag.y;
  gl_PointSize = clamp(uPointScale * (0.55 + aMag.x * 2.3), 1.0, 7.0);
}`;

const STAR_FS = `#version 300 es
precision highp float;
in float vBright;
in float vCi;
uniform float uExposure;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  // A soft core rather than a square: no atmosphere to twinkle, but a
  // sensor still has a point spread function.
  float a = exp(-r2 * 22.0);
  vec3 warm = vec3(1.0, 0.80, 0.62);
  vec3 cool = vec3(0.72, 0.82, 1.0);
  vec3 c = mix(warm, cool, vCi);
  fragColor = vec4(c * a * vBright * 7.5 * uExposure, 1.0);
}`;

/* ---------- sun and Earth ---------- */

const BODY_VS = `#version 300 es
precision highp float;
in vec2 aCorner;
uniform mat4 uViewProj;
uniform vec3 uCam;
uniform vec3 uDir;
uniform float uAngularRadius;
out vec2 vUv;
void main() {
  vec3 f = normalize(uDir);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  float s = tan(uAngularRadius) * ${SKY_R}.0;
  vec3 p = uCam + f * ${SKY_R}.0 + r * aCorner.x * s + u * aCorner.y * s;
  vUv = aCorner;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

const SUN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uExposure;
out vec4 fragColor;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  // Limb darkening, and a value far above 1 so the bloom has something
  // real to work with.
  float mu = sqrt(max(1.0 - r * r, 0.0));
  float limb = 0.34 + 0.66 * mu;
  float edge = 1.0 - smoothstep(0.965, 1.0, r);
  fragColor = vec4(vec3(1.0, 0.985, 0.95) * 44.0 * limb * edge * uExposure, 1.0);
}`;

const EARTH_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uExposure;
uniform vec3 uSun;
uniform vec3 uDir;
uniform float uSpin;
out vec4 fragColor;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.31, 0.17, 0.53));
  p *= 19.19;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                 mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                 mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p *= 2.07; a *= 0.5; }
  return s;
}

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float z = sqrt(1.0 - r2);

  // Build the sphere's own frame so the terminator lands correctly.
  vec3 f = normalize(uDir);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 up = cross(f, rt);
  vec3 N = normalize(rt * vUv.x + up * vUv.y - f * z);

  // Continents from noise on the sphere. Not Earth's continents, but
  // at 1.9° across nobody has ever been able to tell me which ones.
  vec3 sp = N;
  float rot = uSpin;
  sp = vec3(sp.x * cos(rot) - sp.z * sin(rot), sp.y, sp.x * sin(rot) + sp.z * cos(rot));
  float land = fbm(sp * 2.4 + 3.1);
  float ice = smoothstep(0.72, 0.92, abs(sp.y));
  float isLand = smoothstep(0.50, 0.56, land);
  vec3 ocean = vec3(0.045, 0.105, 0.26);
  vec3 soil = mix(vec3(0.20, 0.20, 0.12), vec3(0.11, 0.17, 0.08), fbm(sp * 7.0));
  vec3 albedo = mix(ocean, soil, isLand);
  albedo = mix(albedo, vec3(0.86, 0.90, 0.94), ice);
  float cloud = smoothstep(0.48, 0.72, fbm(sp * 3.6 + vec3(11.0, 2.0, 5.0)));
  albedo = mix(albedo, vec3(0.92), cloud * 0.72);

  float lam = max(dot(N, uSun), 0.0);
  vec3 col = albedo * lam * 3.2;
  // Night side: cities are romantic but the far side of Earth from here
  // is mostly ocean, so a faint airglow rim is all that is honest.
  float rim = pow(1.0 - z, 3.0);
  col += vec3(0.05, 0.10, 0.20) * rim * 0.5;
  col += albedo * 0.010;

  float edge = 1.0 - smoothstep(0.985, 1.0, sqrt(r2));
  fragColor = vec4(col * edge * uExposure, 1.0);
}`;

export class Sky {
  constructor(gl, { seed = 1, sunDir = [0, 0.4, 1] } = {}) {
    this.gl = gl;
    this.sunDir = sunDir;
    this.spin = 0;

    // Earth: azimuth roughly south-east of the landing site, 14.6° up.
    const az = -0.62, el = 14.6 * DEG;
    this.earthDir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];

    this.bg = createProgram(gl, BG_VS, BG_FS, 'sky-bg');
    this.starProg = createProgram(gl, STAR_VS, STAR_FS, 'stars');
    this.sunProg = createProgram(gl, BODY_VS, SUN_FS, 'sun');
    this.earthProg = createProgram(gl, BODY_VS, EARTH_FS, 'earth');

    this.emptyVao = gl.createVertexArray();
    this._buildStars(seed);
    this._buildQuad();

    // Galactic pole, so the Milky Way crosses the sky at a believable
    // angle instead of lying along the horizon.
    const a = 1.05, b = 0.62;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    this.galactic = new Float32Array([
      ca, 0, -sa,
      sa * sb, cb, ca * sb,
      sa * cb, -sb, ca * cb
    ]);
  }

  _buildStars(seed) {
    const gl = this.gl;
    const N = 7400;
    const dirs = new Float32Array(N * 3);
    const mags = new Float32Array(N * 2);
    const rng = makeRng(seed ^ 0x51a2);
    for (let i = 0; i < N; i++) {
      // Two thirds uniform, one third crowded into the galactic band.
      let x, y, z;
      const u1 = rng(), u2 = rng();
      if (i % 3 === 0) {
        const lat = (rng() + rng() + rng() - 1.5) * 0.30;
        const lon = u2 * Math.PI * 2;
        const cl = Math.cos(lat);
        // In galactic coordinates, then rotated by the same matrix's inverse
        // shape — close enough for a backdrop.
        x = cl * Math.cos(lon); y = Math.sin(lat); z = cl * Math.sin(lon);
        const a = 1.05, b = -0.62;
        const nx = x * Math.cos(a) + z * Math.sin(a);
        const nz = -x * Math.sin(a) + z * Math.cos(a);
        const ny = y * Math.cos(b) - nz * Math.sin(b);
        const nz2 = y * Math.sin(b) + nz * Math.cos(b);
        x = nx; y = ny; z = nz2;
      } else {
        const zz = u1 * 2 - 1;
        const r = Math.sqrt(Math.max(0, 1 - zz * zz));
        const phi = u2 * Math.PI * 2;
        x = r * Math.cos(phi); y = zz; z = r * Math.sin(phi);
      }
      dirs[i * 3] = x; dirs[i * 3 + 1] = y; dirs[i * 3 + 2] = z;
      // Magnitude distribution: a great many faint, a handful bright.
      const m = Math.pow(rng(), 2.6);
      mags[i * 2] = 0.07 + m * 1.15;
      mags[i * 2 + 1] = hash2(i, 7, seed);
    }
    const db = buffer(gl, dirs);
    const mb = buffer(gl, mags);
    this.starVao = vao(gl, [
      { buffer: db, loc: this.starProg.a.aDir, size: 3 },
      { buffer: mb, loc: this.starProg.a.aMag, size: 2 }
    ]);
    this.starCount = N;
  }

  _buildQuad() {
    const gl = this.gl;
    const b = buffer(gl, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
    this.quadSun = vao(gl, [{ buffer: b, loc: this.sunProg.a.aCorner, size: 2 }]);
    this.quadEarth = vao(gl, [{ buffer: b, loc: this.earthProg.a.aCorner, size: 2 }]);
  }

  update(dt) { this.spin += dt * 0.004; }

  render(ctx) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    // The sun and Earth quads are built in a frame whose normal points
    // along the view direction, i.e. away from the camera. Nothing here
    // has a back to cull anyway.
    gl.disable(gl.CULL_FACE);

    // Background.
    const p = this.bg;
    p.use();
    gl.uniform3fv(p.u.uRight, ctx.camRight);
    gl.uniform3fv(p.u.uUp, ctx.camUp);
    gl.uniform3fv(p.u.uFwd, ctx.camFwd);
    gl.uniform2f(p.u.uTanFov, ctx.tanFovX, ctx.tanFovY);
    gl.uniform1f(p.u.uExposure, ctx.exposure);
    gl.uniformMatrix3fv(p.u.uGalactic, false, this.galactic);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Stars, additive so a dense patch of the band reads as a glow.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const s = this.starProg;
    s.use();
    gl.uniformMatrix4fv(s.u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(s.u.uCam, ctx.camPos);
    gl.uniform1f(s.u.uExposure, ctx.exposure);
    gl.uniform1f(s.u.uPointScale, ctx.pixelScale);
    gl.bindVertexArray(this.starVao);
    gl.drawArrays(gl.POINTS, 0, this.starCount);

    // Earth.
    const e = this.earthProg;
    e.use();
    gl.uniformMatrix4fv(e.u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(e.u.uCam, ctx.camPos);
    gl.uniform3fv(e.u.uDir, this.earthDir);
    gl.uniform3fv(e.u.uSun, this.sunDir);
    gl.uniform1f(e.u.uAngularRadius, 0.95 * DEG);
    gl.uniform1f(e.u.uExposure, ctx.exposure);
    gl.uniform1f(e.u.uSpin, this.spin);
    gl.bindVertexArray(this.quadEarth);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Sun.
    const su = this.sunProg;
    su.use();
    gl.uniformMatrix4fv(su.u.uViewProj, false, ctx.viewProj);
    gl.uniform3fv(su.u.uCam, ctx.camPos);
    gl.uniform3fv(su.u.uDir, this.sunDir);
    gl.uniform1f(su.u.uAngularRadius, 0.265 * DEG);
    gl.uniform1f(su.u.uExposure, ctx.exposure);
    gl.bindVertexArray(this.quadSun);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }
}

export function cameraBasis(view, out = {}) {
  // Rows of the view matrix's rotation are the camera axes in world space.
  out.right = out.right || v3();
  out.up = out.up || v3();
  out.fwd = out.fwd || v3();
  out.right[0] = view[0]; out.right[1] = view[4]; out.right[2] = view[8];
  out.up[0] = view[1]; out.up[1] = view[5]; out.up[2] = view[9];
  out.fwd[0] = -view[2]; out.fwd[1] = -view[6]; out.fwd[2] = -view[10];
  v3norm(out.right, out.right); v3norm(out.up, out.up); v3norm(out.fwd, out.fwd);
  void v3cross;
  return out;
}
