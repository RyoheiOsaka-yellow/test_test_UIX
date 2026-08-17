precision highp float;

uniform vec2      iResolution;
uniform float     iTime;
uniform int       u_surfaceIndex;
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

// INCLUDE_RIM_LIGHTING
// INCLUDE_LIGHTING

float surfaceF(vec3 p);
// INCLUDE_SCALAR_MARCHER
// INCLUDE_DEFORM

// Implicit surfaces F(x, y, z) = 0. Unlike SDFs these are not distance functions,
// so the marcher bisects sign changes rather than sphere-tracing.
float baseScalarF(vec3 p) {
  float a  = iTime * 0.28;
  float ca = cos(a), sa = sin(a);
  vec3  q  = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  float x  = q.x, y = q.y, z = q.z;

  if (u_surfaceIndex == 1)  return y - x * x - z * z + 0.40;             // elliptic paraboloid
  if (u_surfaceIndex == 2)  return y - 0.85 * (x * x - z * z);           // hyperbolic paraboloid
  if (u_surfaceIndex == 3)  return x * x + z * z - y * y;                // cone
  if (u_surfaceIndex == 4)  return x * x + y * y + z * z - 0.81;         // sphere
  if (u_surfaceIndex == 5) {                                            // torus
    float r = sqrt(x * x + z * z) - 0.65;
    return r * r + y * y - 0.100;
  }
  if (u_surfaceIndex == 6)  return x * x + z * z - y * y - 0.45;         // hyperboloid
  if (u_surfaceIndex == 7)  return y - 0.55 * (x*x*x - 3.0 * x * z * z); // monkey saddle
  if (u_surfaceIndex == 8)  return y - 0.40 * sin(2.2 * x) * cos(2.2 * z);
  if (u_surfaceIndex == 9) {                                            // radial damped cosine
    float r = length(q.xz);
    return y - 0.38 * exp(-r * 0.9) * cos(4.5 * r);
  }
  if (u_surfaceIndex == 10) return x*x / 0.81 + y*y / 0.36 + z*z / 0.5625 - 1.0;
  return 1e10;
}

float surfaceF(vec3 p) {
  float f = baseScalarF(deformP(p));
  // Radial expansion shifts the threshold: the marcher renders a different
  // isosurface of the same field. On open surfaces this translates the sheet
  // along the field gradient rather than inflating it.
  if (u_deformMode == 1) f -= u_ampMono * u_deformP1;
  return f;
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
  vec3 pos = ro + t * rd;

  if (u_lighting == 1) return flashLight(nor, rd);
  // These surfaces are open sheets with no meaningful interior, so SSS is
  // suppressed by passing an effectively infinite thickness.
  if (u_lighting == 2) return envLight(nor, rd, 100.0);
  return rimLight(pos, nor, rd, 100.0);
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
