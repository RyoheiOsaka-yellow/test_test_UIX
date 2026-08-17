// Amplitude-driven lighting models shared by every fragment shader.
// Two orbiting key lights circle the shape at different rates; the left channel
// drives one and the right channel the other, so a stereo mix lights the shape
// from two independently moving directions. Both terms scale with amplitude²,
// which keeps quiet passages dark without crushing transients.
//
// Required uniforms: iTime, u_ampL, u_ampR, u_envMap, u_sssDensity, u_sssStr, PI.

vec3 sampleEnvMap(vec3 dir) {
  float u = atan(dir.z, dir.x) * (0.5 / PI) + 0.5 + iTime * 0.02;
  float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
  return texture2D(u_envMap, vec2(u, v)).rgb;
}

// Two-light rig evaluated against a material colour.
// spec is the specular weight: 0.45 for the flat flash material, 0.35 for env.
vec3 _twoLightRig(vec3 mat, vec3 nor, vec3 rd, float specWeight, float specTint) {
  float a1  = iTime * 3.5;
  vec3  ld1 = normalize(vec3(sin(a1), 0.35, cos(a1)));
  vec3  h1  = normalize(ld1 - rd);
  vec3  c1  = mat * max(dot(nor, ld1), 0.0) * 0.85
            + vec3(specTint) * pow(max(dot(nor, h1), 0.0), 56.0) * specWeight;

  float a2  = iTime * 2.1 + 1.9;
  vec3  ld2 = normalize(vec3(sin(a2), 0.20, cos(a2)));
  vec3  h2  = normalize(ld2 - rd);
  vec3  c2  = mat * max(dot(nor, ld2), 0.0) * 0.85
            + vec3(specTint) * pow(max(dot(nor, h2), 0.0), 56.0) * specWeight;

  float aL2 = u_ampL * u_ampL;
  float aR2 = u_ampR * u_ampR;
  // The floor on the left term keeps a faint reading of the shape during silence.
  return c1 * max(aL2, 0.015) + c2 * aR2;
}

// Flat white material — the shape reads as a lamp flashing on every transient.
vec3 flashLight(vec3 nor, vec3 rd) {
  return _twoLightRig(vec3(0.88), nor, rd, 0.45, 0.45);
}

// Environment-mapped material: the OKLCH sky colours the surface by normal
// direction, and a thickness-based SSS term lets thin areas glow through.
vec3 envLight(vec3 nor, vec3 rd, float thickness) {
  vec3  mat = sampleEnvMap(nor);
  vec3  lit = _twoLightRig(mat, nor, rd, 0.35, 0.50);
  float amp = max(u_ampL * u_ampL, 0.015) + u_ampR * u_ampR;
  return lit + mat * exp(-thickness * u_sssDensity) * u_sssStr * amp;
}

// Background for the environment mode — the same sky, dimmed by amplitude.
vec3 envBackground(vec3 rd) {
  float amp = (max(u_ampL * u_ampL, 0.015) + u_ampR * u_ampR) * 0.6;
  return sampleEnvMap(rd) * amp;
}
