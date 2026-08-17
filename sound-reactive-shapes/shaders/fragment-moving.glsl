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

// The moving-scalar library defines surfaceF(); the loader renames it to
// baseScalarF() so the deformation pass below can wrap it.
// INCLUDE_MOVING_SCALAR_FUNCTIONS

float surfaceF(vec3 p) {
  float f = baseScalarF(deformP(p));
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
