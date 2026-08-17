// deform.glsl — audio-driven spatial deformation, shared by every shape family.
//
// Each sample point is displaced *before* the SDF or scalar field is evaluated, so
// normals are finite-differenced on the displaced geometry and interact directly
// with the lighting.
//
// Required uniforms (declared by the including fragment shader, not here):
//   uniform int       u_deformMode;
//   uniform float     u_deformP1, u_deformP2;
//   uniform float     u_histDuration;   // 0.05–1.0: fraction of the history window used
//   uniform float     u_histSoften;     // 0–1: Gaussian blur across history frames
//   uniform float     u_twistAxisX;     // X component of the twist axis (Y = 1 baseline)
//   uniform float     u_twistAxisZ;     // Z component of the twist axis
//   uniform float     u_ctrlN;          // 2–8: control points for the mode-8 spline
//   uniform float     u_ampL, u_ampR, u_ampMono;
//   uniform sampler2D u_histTex;        // 1×HIST   r=ampL g=ampR b=mono, v=0 is the newest frame
//   uniform sampler2D u_fftTex;         // 128×1    r=mono mel FFT, u=0 is sub-bass
//   uniform float     iTime;
//   const float       PI;
//
// u_deformP1 / u_deformP2 per mode:
//   1 radial expansion  p1 = intensity  (applied in sceneSDF/surfaceF, not here)
//   2 axial compression p1 = width X/Z, p2 = height Y
//   3 normal extrusion  p1 = intensity  (lit with the undeformed normal)
//   4 radial displ.     p1 = intensity
//   5 banded displ.     p1 = intensity
//   6 axial rotation    p1 = angle multiplier
//   7 spectral displ.   p1 = intensity
//   8 spectral contours p1 = intensity  (N-band Catmull-Rom spline over the FFT)
//   9 spectral shear    p1 = intensity

float _hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float _sampleHistL(float v) { return texture2D(u_histTex, vec2(0.5, v)).r; }
float _sampleFFT  (float u) { return texture2D(u_fftTex,  vec2(u,   0.5)).r; }

// History sample with duration scaling and 5-tap Gaussian softening.
// v = 0 is the current frame, v = 1 is ~4 seconds ago; scaling v by u_histDuration
// therefore compresses the timeline onto the most recent frames.
float _sampleHist(float rawV) {
  float v = rawV * u_histDuration;
  if (u_histSoften < 0.001) return _sampleHistL(v);
  float st = u_histSoften * 0.04;
  return _sampleHistL(clamp(v - st * 2.0, 0.0, 1.0)) * 0.0625
       + _sampleHistL(clamp(v - st,       0.0, 1.0)) * 0.25
       + _sampleHistL(v)                             * 0.375
       + _sampleHistL(clamp(v + st,       0.0, 1.0)) * 0.25
       + _sampleHistL(clamp(v + st * 2.0, 0.0, 1.0)) * 0.0625;
}

// FFT sampled at the i-th of n evenly-spaced control points
float _fftCtrl(int i, int n) {
  float u = float(i) / float(max(n - 1, 1));
  return _sampleFFT(clamp(u, 0.01, 0.99));
}

// Catmull-Rom spline through n FFT control points, evaluated at t in [0,1].
// C1-continuous, so the resulting deformation has no visible creases.
float spectralCurve(float t) {
  int n = max(int(u_ctrlN + 0.5), 2);
  float ft = clamp(t, 0.0, 1.0) * float(n - 1);
  int seg = int(ft);
  if (seg >= n - 1) seg = n - 2;
  float lt = ft - float(seg);
  float p0 = _fftCtrl(max(seg - 1, 0),    n);
  float p1 = _fftCtrl(seg,                n);
  float p2 = _fftCtrl(min(seg + 1, n - 1), n);
  float p3 = _fftCtrl(min(seg + 2, n - 1), n);
  float t2 = lt * lt, t3 = t2 * lt;
  return clamp(0.5 * ((2.0 * p1)
       + (-p0 + p2) * lt
       + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
       + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3), 0.0, 1.0);
}

vec3 deformP(vec3 rp) {

  // 0 = none. 1 = radial expansion, whose offset is applied to the field value
  // in sceneSDF/surfaceF rather than to the sample position.
  if (u_deformMode == 0 || u_deformMode == 1) return rp;

  // ── Amplitude: the current frame only ──────────────────────────────────────

  // 2 = axial compression. Left channel compresses Y, right expands X and Z.
  if (u_deformMode == 2) {
    float sx = 1.0 + u_ampR * u_deformP1;
    float sy = max(1.0 - u_ampL * u_deformP2, 0.05);
    return rp * vec3(sx, sy, sx);
  }

  // 3 = normal extrusion. A hash gives every surface point a fixed random
  // displacement; render3D overrides the normal with the undeformed one so the
  // rim term keeps tracking the clean silhouette.
  if (u_deformMode == 3) {
    vec3  n = normalize(rp + vec3(0.0001));
    float h = _hash3(n * 5.0) * 2.0 - 1.0;
    return rp - n * h * u_ampMono * u_deformP1;
  }

  // ── History: ~4 seconds of amplitude painted across the surface ────────────

  // 4 = radial displacement. The bottom of the shape samples the current frame,
  // the top the oldest, so pulses appear at the base and travel upward.
  if (u_deformMode == 4) {
    float v   = clamp((rp.y + 1.0) * 0.5, 0.01, 0.99);
    float h   = _sampleHist(v);
    float xzL = length(rp.xz);
    vec3  lat = xzL > 0.001 ? vec3(rp.x, 0.0, rp.z) / xzL : vec3(1.0, 0.0, 0.0);
    return rp - lat * h * u_deformP1;
  }

  // 5 = banded displacement. The centre samples the current amplitude and the
  // outer surface the oldest, so a beat spreads outward as a pressure wave.
  if (u_deformMode == 5) {
    float v = clamp(length(rp) / 1.2, 0.01, 0.99);
    float h = _sampleHist(v);
    vec3  n = normalize(rp + vec3(0.0001));
    return rp - n * h * u_deformP1;
  }

  // 6 = axial rotation. Each slice along the twist axis rotates by the amplitude
  // at the corresponding historical moment, producing a corkscrew.
  if (u_deformMode == 6) {
    vec3  axis  = normalize(vec3(u_twistAxisX, 1.0, u_twistAxisZ));
    float proj  = dot(rp, axis);
    float v     = clamp((proj + 1.0) * 0.5, 0.01, 0.99);
    float angle = _sampleHist(v) * PI * u_deformP1;
    float c = cos(angle), s = sin(angle);
    return rp * c - cross(axis, rp) * s + axis * dot(axis, rp) * (1.0 - c);
  }

  // ── Frequency: the current frame's 128-bin mel spectrum ────────────────────

  // 7 = spectral displacement. Height maps continuously to a frequency bin and
  // each level inflates laterally by that bin's energy — a 3D equaliser.
  if (u_deformMode == 7) {
    float u   = clamp((rp.y + 1.0) * 0.5, 0.01, 0.99);
    float f   = _sampleFFT(u);
    float xzL = length(rp.xz);
    vec3  lat = xzL > 0.001 ? vec3(rp.x, 0.0, rp.z) / xzL : vec3(1.0, 0.0, 0.0);
    return rp - lat * f * u_deformP1;
  }

  // 8 = spectral contours. N evenly-spaced bands are splined into a smooth curve
  // that drives displacement along the surface normal.
  if (u_deformMode == 8) {
    float t = clamp((rp.y + 1.0) * 0.5, 0.01, 0.99);
    float f = spectralCurve(t) * u_deformP1;
    vec3  n = normalize(rp + vec3(0.0001));
    return rp - n * f;
  }

  // 9 = spectral shear. Two pairs of bands drive opposing per-axis skew: a
  // low-heavy mix leans the shape one way, a high-heavy mix the other. The shear
  // axes rotate slowly so the lean direction keeps changing.
  if (u_deformMode == 9) {
    float xLo = _sampleFFT(0.08);
    float xHi = _sampleFFT(0.92);
    float zLo = _sampleFFT(0.25);
    float zHi = _sampleFFT(0.75);
    float dx  = (xLo - xHi) * rp.y;
    float dz  = (zLo - zHi) * rp.y;
    float rot = iTime * 0.12;
    float cr  = cos(rot), sr = sin(rot);
    return rp + vec3(cr * dx - sr * dz, 0.0, sr * dx + cr * dz) * u_deformP1;
  }

  return rp;
}
