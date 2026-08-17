precision highp float;

// Form modes construct geometry directly from audio data instead of deforming a
// base shape: the spectrum and the spectrogram *are* the surface.

uniform vec2      iResolution;
uniform float     iTime;
uniform float     u_ampL;
uniform float     u_ampR;
uniform float     u_ampMono;
uniform int       u_ssaa;
uniform int       u_lighting;
uniform int       u_mode;
uniform float     u_intensity;
uniform sampler2D u_histTex;
uniform sampler2D u_fftTex;
uniform sampler2D u_specTex;
uniform float     u_histHead;   // write head of the spectrogram ring buffer, in [0,1)
uniform sampler2D u_envMap;
uniform float     u_rimPow;
uniform float     u_base;
uniform float     u_sssDensity;
uniform float     u_sssStr;

const float PI        = 3.14159265359;
const int   MAX_STEPS = 128;
const float MAX_DIST  = 5.0;
const float SURF_DIST = 0.002;

// INCLUDE_RIM_LIGHTING
// INCLUDE_LIGHTING

float sampleFFT (float u) { return texture2D(u_fftTex, vec2(clamp(u, 0.01, 0.99), 0.5)).r; }
float sampleFFTR(float u) { return texture2D(u_fftTex, vec2(clamp(u, 0.01, 0.99), 0.5)).g; }
float sampleHist (float v) { return texture2D(u_histTex, vec2(0.5, clamp(v, 0.01, 0.99))).r; }
float sampleHistR(float v) { return texture2D(u_histTex, vec2(0.5, clamp(v, 0.01, 0.99))).g; }

// The spectrogram is a ring buffer, so an age in frames has to be resolved
// against the current write head.
float sampleSpec(float freq, float ageFrames) {
  float y = fract(u_histHead - (ageFrames + 1.0) / 256.0 + 2.0);
  return texture2D(u_specTex, vec2(clamp(freq, 0.01, 0.99), y)).r;
}

// ── Mode 1: Spectral fan ─────────────────────────────────────────────────────
// A cylinder whose cross-section at every height is the spectrum in polar form:
// azimuth maps to an FFT bin, radius to that bin's energy. A gentle X-axis swing
// periodically reveals the caps.
float spectralFanSDF(vec3 p) {
  float tilt = sin(iTime * 0.35) * 0.22;
  float ct = cos(tilt), st = sin(tilt);
  vec3  q  = vec3(p.x, ct * p.y - st * p.z, st * p.y + ct * p.z);
  float phi  = atan(q.z, q.x) / (2.0 * PI) + 0.5;
  float r    = 0.28 + 0.55 * sampleFFT(phi) * u_intensity;
  float dCyl = (length(q.xz) - r) / 2.0;   // divided down: radius varies with angle,
  return max(dCyl, abs(q.y) - 0.52);       // so the field is not Lipschitz-1
}

// ── Mode 2: Interference rings ───────────────────────────────────────────────
// Eight FFT bands each weight a standing wave along a distinct 3D direction,
// spread by a golden-angle spiral. The shape is the isosurface of their sum.
float interferenceRingsSDF(vec3 p) {
  float field = 0.0;
  float lip   = 0.01;    // running Lipschitz bound, used to rescale the result
  for (int i = 0; i < 8; i++) {
    float fi    = float(i);
    float amp   = 0.10 + sampleFFT((fi + 0.5) / 8.0) * u_intensity * 0.45;
    float freq  = (fi + 1.0) * 1.7;
    float angle = fi * 2.39996323;                    // golden angle
    float cosT  = 1.0 - 2.0 * (fi + 0.5) / 8.0;
    float sinT  = sqrt(max(1.0 - cosT * cosT, 0.0));
    vec3  dir   = vec3(sinT * cos(angle), cosT, sinT * sin(angle));
    field += amp * cos(freq * dot(p, dir));
    lip   += amp * freq;
  }
  float thresh = 0.25 + 0.65 * u_ampMono * u_intensity;
  return (thresh - field) / lip;
}

// ── Mode 3: Spectrogram cylinder ─────────────────────────────────────────────
// Horizontal cylinder: position along the long axis is frequency, azimuth around
// the cross-section is time, so the full 2D spectrogram wraps the drum.
float spectrogramCylinderSDF(vec3 p) {
  float a  = iTime * 0.14;
  float ca = cos(a), sa = sin(a);
  vec3  q  = vec3(p.x, ca * p.y - sa * p.z, sa * p.y + ca * p.z);
  float phi  = atan(q.y, q.z) / (2.0 * PI) + 0.5;
  float freq = clamp((q.x + 1.0) * 0.5, 0.01, 0.99);
  float spec = sampleSpec(freq, (1.0 - phi) * 128.0);
  float r    = 0.22 + 0.68 * spec * u_intensity;
  return max((length(q.yz) - r) / 3.0, abs(q.x) - 1.06);
}

// ── Mode 4: Spectral tube ────────────────────────────────────────────────────
// Two vertical tubes: left carries the L-channel FFT, right the R-channel.
float spectralTubeSDF(vec3 p) {
  float freq = clamp((p.y + 1.0) * 0.5, 0.01, 0.99);
  float rL = 0.08 + 0.52 * sampleFFT(freq)  * u_intensity;
  float rR = 0.08 + 0.52 * sampleFFTR(freq) * u_intensity;
  float dL = (length(vec2(p.x + 0.52, p.z)) - rL) / 3.0;
  float dR = (length(vec2(p.x - 0.52, p.z)) - rR) / 3.0;
  return max(min(dL, dR), abs(p.y) - 1.04);
}

// ── Mode 5: Waveform sphere ──────────────────────────────────────────────────
// Two surfaces of revolution driven by the per-channel amplitude history.
// Height encodes time, so a beat imprints a bulge that travels upward.
float waveformSphereSDF(vec3 p) {
  float v  = clamp((p.y + 1.0) * 0.5, 0.01, 0.99);
  float rL = 0.08 + 0.62 * sampleHist(v)  * u_intensity;
  float rR = 0.08 + 0.62 * sampleHistR(v) * u_intensity;
  float dL = (length(vec2(p.x + 0.52, p.z)) - rL) / 3.0;
  float dR = (length(vec2(p.x - 0.52, p.z)) - rR) / 3.0;
  return max(min(dL, dR), abs(p.y) - 1.04);
}

// ── Mode 6: Harmonic rings ───────────────────────────────────────────────────
// Seven tori along X, each tuned to one mel band; the major radius scales with
// that band's energy.
float harmonicRingsSDF(vec3 p) {
  float a  = iTime * 0.18;
  float ca = cos(a), sa = sin(a);
  vec3  q  = vec3(p.x, ca * p.y - sa * p.z, sa * p.y + ca * p.z);
  float d  = 1e9;
  for (int i = 0; i < 7; i++) {
    float fi  = float(i);
    float R   = 0.15 + 0.65 * sampleFFT((fi + 0.5) / 7.0) * u_intensity;
    float x0  = (fi / 6.0) * 2.0 - 1.0;
    float yzl = length(q.yz) - R;
    d = min(d, length(vec2(yzl, q.x - x0)) - 0.035);
  }
  return d;
}

// ── Mode 7: Spectrogram cone ─────────────────────────────────────────────────
// Tip toward the camera, widening toward the back. Azimuth encodes frequency and
// position along the axis encodes time; a slow bilateral wiggle reveals
// different azimuthal slices.
float spectrogramConeSDF(vec3 p) {
  float wH = sin(iTime * 0.25) * 0.45;
  float cH = cos(wH), sH = sin(wH);
  vec3  r1 = vec3(cH * p.x + sH * p.z, p.y, -sH * p.x + cH * p.z);
  float wV = sin(iTime * 0.31) * 0.21;
  float cV = cos(wV), sV = sin(wV);
  vec3  q  = vec3(r1.x, cV * r1.y - sV * r1.z, sV * r1.y + cV * r1.z);
  float phi  = atan(q.y, q.x) / (2.0 * PI) + 0.5;
  float zN   = clamp((q.z + 1.0) * 0.5, 0.0, 1.0);
  float spec = sampleSpec(phi, (1.0 - zN) * 128.0);
  float r    = (1.0 - zN) * (0.25 + 0.65 * spec * u_intensity);
  return max((length(q.xy) - r) / 3.0, abs(q.z) - 1.04);
}

// ── Mode 8: Spectral terrain ─────────────────────────────────────────────────
// A height map tilted 35° toward the camera: X is frequency, Y is time, and
// depth is spectral amplitude.
float spectralTerrainSDF(vec3 p) {
  float cx = 0.8192, sx = 0.5736;   // cos/sin 35°
  vec3  q  = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float freq = clamp(q.x * 0.33 + 0.5, 0.01, 0.99);
  float spec = sampleSpec(freq, clamp(0.5 - q.y * 0.55, 0.0, 1.0) * 128.0);
  return (q.z - (-0.3 + spec * u_intensity * 0.8)) / 3.0;
}

// ── Mode 9: Spectral helix ───────────────────────────────────────────────────
// A four-coil helix whose tube radius at each segment is the FFT amplitude at the
// corresponding frequency. Constant rotation gives the barber-pole illusion of a
// signal climbing endlessly upward.
float spectralHelixSDF(vec3 p) {
  float a  = iTime * 1.5;
  float ca = cos(a), sa = sin(a);
  vec3  q  = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  float d  = 1e9;
  const float R = 0.42;
  for (int k = 0; k < 48; k++) {
    float t   = float(k) / 48.0;
    float ang = t * 8.0 * PI;
    float r   = 0.025 + 0.10 * sampleFFT(t) * u_intensity;
    vec3  c   = vec3(R * cos(ang), t * 2.0 - 1.0, R * sin(ang));
    d = min(d, length(q - c) - r);
  }
  return d;
}

// ── Mode 10: Spectral ribbon ─────────────────────────────────────────────────
// An elongated box whose shell thickness at each position is the magnitude of
// spectral change between now and 48 frames ago — the frequencies that shifted
// most protrude furthest.
float spectralRibbonSDF(vec3 p) {
  float sw = sin(iTime * 0.20) * 0.26;
  float cs = cos(sw), ss = sin(sw);
  vec3  p2 = vec3(cs * p.x + ss * p.z, p.y, -ss * p.x + cs * p.z);
  float freq   = clamp(p2.x * 0.33 + 0.5, 0.01, 0.99);
  float fNow   = sampleFFT(freq);
  float fOld   = sampleSpec(freq, 48.0);
  float rOuter = 0.03 + max(fNow, fOld) * 0.30 * u_intensity;
  float rInner = 0.03 + min(fNow, fOld) * 0.30 * u_intensity;
  vec3  q      = abs(p2) - vec3(1.1, 0.28, 0.28);
  float dBox   = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  return max(dBox - rOuter, rInner - dBox) / 2.5;
}

float sceneSDF(vec3 p) {
  float a  = iTime * 0.22;
  float ca = cos(a), sa = sin(a);
  vec3  rp = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  // Modes that already carry their own axis motion are fed the unrotated point.
  if (u_mode == 1)  return spectralFanSDF(rp);
  if (u_mode == 2)  return interferenceRingsSDF(rp);
  if (u_mode == 3)  return spectrogramCylinderSDF(p);
  if (u_mode == 4)  return spectralTubeSDF(p);
  if (u_mode == 5)  return waveformSphereSDF(p);
  if (u_mode == 6)  return harmonicRingsSDF(p);
  if (u_mode == 7)  return spectrogramConeSDF(p);
  if (u_mode == 8)  return spectralTerrainSDF(p);
  if (u_mode == 9)  return spectralHelixSDF(p);
  return spectralRibbonSDF(p);
}

vec3 calcNormal(vec3 pos) {
  const float eps = 0.003;
  const vec2  h   = vec2(1.0, -1.0);
  return normalize(h.xyy * sceneSDF(pos + h.xyy * eps) +
                   h.yyx * sceneSDF(pos + h.yyx * eps) +
                   h.yxy * sceneSDF(pos + h.yxy * eps) +
                   h.xxx * sceneSDF(pos + h.xxx * eps));
}

vec3 render3D(vec2 uv) {
  vec3 ro = vec3(0.0, 0.0, 2.5);
  vec3 rd = normalize(vec3(uv / 3.0, -1.0));

  float t   = 0.01;
  bool  hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    float d = sceneSDF(ro + t * rd);
    if (d < SURF_DIST) { hit = true; break; }
    if (t > MAX_DIST)  break;
    t += max(d, SURF_DIST);
  }
  if (!hit) {
    return u_lighting == 2 ? envBackground(rd) : vec3(0.0);
  }

  vec3 pos = ro + t * rd;
  vec3 nor = calcNormal(pos);
  if (dot(nor, rd) > 0.0) nor = -nor;

  if (u_lighting == 1) return flashLight(nor, rd);

  float tb = t + 0.005;
  for (int i = 0; i < 48; i++) {
    float d = sceneSDF(ro + rd * tb);
    if (d > 0.0) break;
    tb += max(-d, 0.005);
  }
  if (u_lighting == 2) return envLight(nor, rd, tb - t);
  return rimLight(pos, nor, rd, tb - t);
}

void main() {
  vec3 col;
  if (u_ssaa == 1) {
    col  = render3D(((gl_FragCoord.xy + vec2(-0.25, -0.25)) * 2.0 - iResolution.xy) / iResolution.y);
    col += render3D(((gl_FragCoord.xy + vec2( 0.25, -0.25)) * 2.0 - iResolution.xy) / iResolution.y);
    col += render3D(((gl_FragCoord.xy + vec2(-0.25,  0.25)) * 2.0 - iResolution.xy) / iResolution.y);
    col += render3D(((gl_FragCoord.xy + vec2( 0.25,  0.25)) * 2.0 - iResolution.xy) / iResolution.y);
    col *= 0.25;
  } else {
    col = render3D((gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y);
  }
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}
