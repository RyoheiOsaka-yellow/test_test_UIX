// Rim (back) lighting with subsurface scattering — bright silhouette edges plus a
// thin-area glow. Injected into a fragment shader via the // INCLUDE_RIM_LIGHTING marker.
//
// Required uniforms (declared by the including shader):
//   uniform float u_rimPow;     — rim edge exponent      (default 3.0)
//   uniform float u_base;       — face-on ambient        (default 0.0)
//   uniform float u_sssDensity; — SSS thickness falloff  (default 2.5)
//   uniform float u_sssStr;     — SSS strength           (default 0.3)
//
// Usage: vec3 col = rimLight(pos, nor, rd, thickness);
//   nor       — normal facing the camera (flip two-sided normals before calling)
//   rd        — normalised ray direction, pointing away from the camera
//   thickness — distance through the interior to the back face. Pass a large value
//               (e.g. 100.0) on open surfaces to suppress SSS.
//
// Background is vec3(0.0). Gamma is applied by the caller.

vec3 rimLight(vec3 pos, vec3 nor, vec3 rd, float thickness) {
  float NdotV = abs(dot(nor, -rd));
  float rim   = pow(1.0 - NdotV, u_rimPow);
  float base  = NdotV * NdotV * u_base;
  float sss   = exp(-thickness * u_sssDensity);
  return vec3(base)
       + vec3(0.92, 0.96, 1.00) * rim
       + vec3(0.92, 0.96, 1.00) * sss * u_sssStr;
}
