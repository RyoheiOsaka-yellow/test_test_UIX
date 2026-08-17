precision highp float;

uniform vec2      iResolution;
uniform float     iTime;
uniform int       u_pair;        // 0 = cube/octahedron, 1 = tetrahedra, 2 = dodeca/icosa
uniform float     u_t;           // 0–1 morph position between the two duals
uniform int       u_lighting;
uniform int       u_deformMode;
uniform float     u_ampL;
uniform float     u_ampR;
uniform float     u_ampMono;
uniform sampler2D u_histTex;
uniform sampler2D u_fftTex;
uniform sampler2D u_envMap;
uniform int       u_ssaa;
uniform float     u_rimPow;
uniform float     u_base;
uniform float     u_sssDensity;
uniform float     u_sssStr;
uniform float     u_deformP1;
uniform float     u_deformP2;
uniform float     u_histDuration;
uniform float     u_histSoften;
uniform float     u_twistAxisX;
uniform float     u_twistAxisZ;
uniform float     u_ctrlN;

const float PI = 3.14159265359;

// INCLUDE_PLATONIC_FUNCTIONS
// INCLUDE_RIM_LIGHTING
// INCLUDE_LIGHTING

float sceneSDF(vec3 p);
// INCLUDE_SDF_MARCHER
// INCLUDE_DEFORM

// Each pair is a solid and its dual. Linear interpolation between the two
// distance fields sweeps continuously through the intermediate polyhedra —
// at t = 0.5 the cube/octahedron pair becomes a cuboctahedron.
float baseSDF(vec3 rp) {
  float s = 0.86;               // shared scale so the pairs sit in frame
  vec3 q = rp / s;
  float d;
  if (u_pair == 0) {
    d = mix(sdCube(q), sdOctahedronUnit(q), u_t);
  } else if (u_pair == 1) {
    d = mix(sdTetrahedron(q), sdDualTetrahedron(q), u_t);
  } else {
    d = mix(sdDodecahedron(q), sdIcosahedron(q), u_t);
  }
  return d * s;
}

float sceneSDF(vec3 p) {
  float a = iTime * 0.35;
  float ca = cos(a), sa = sin(a);
  vec3 rp = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  // Tilt slightly off-axis so the vertices and faces both stay readable
  rp = rotX(0.22) * rp;
  float d = baseSDF(deformP(rp));
  if (u_deformMode == 1) d -= u_ampMono * u_deformP1;
  return d;
}

float sceneSDFSmooth(vec3 p) {
  float a = iTime * 0.35;
  float ca = cos(a), sa = sin(a);
  vec3 rp = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  return baseSDF(rotX(0.22) * rp);
}

vec3 calcNormalSmooth(vec3 pos) {
  const float eps = 0.002;
  const vec2 h = vec2(1.0, -1.0);
  return normalize(h.xyy * sceneSDFSmooth(pos + h.xyy * eps) +
                   h.yyx * sceneSDFSmooth(pos + h.yyx * eps) +
                   h.yxy * sceneSDFSmooth(pos + h.yxy * eps) +
                   h.xxx * sceneSDFSmooth(pos + h.xxx * eps));
}

vec3 render3D(vec2 uv) {
  vec3 ro = vec3(0.0, 0.55, 3.5);
  vec3 ta = vec3(0.0, 0.08, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 3.0 * ww);

  float t; vec3 nor;
  if (!castRay(ro, rd, t, nor)) {
    return u_lighting == 2 ? envBackground(rd) : vec3(0.0);
  }
  if (dot(nor, -rd) < 0.0) nor = -nor;
  vec3 pos = ro + t * rd;
  if (u_deformMode == 3) nor = calcNormalSmooth(pos);

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
