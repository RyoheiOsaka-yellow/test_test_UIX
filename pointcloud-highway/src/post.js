// Render pipeline:
//   solid mode       : scene (points + overlays, depth) → Eye-Dome Lighting → LDR
//   accumulation mode: points only, additive into a half-float target → density tone map → LDR,
//                      then overlays (BIM, annotations) drawn on top
//   both             : bloom (3 mip levels of a thresholded blur) + vignette → screen
// Points live on layer 2, everything else on layer 0.
import * as THREE from 'three';

export const POINT_LAYER = 2;

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Post {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera;
    this.enabled = true;       // EDL on/off (solid mode)
    this.strength = 0.35; this.radius = 1.2;
    this.accumulate = false; this.exposure = 1.0;
    this.bloom = 0.3; this.vignette = 0.35;
    const gl = renderer.getContext();
    this.canFloat = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x, h = size.y;
    this.sceneT = new THREE.WebGLRenderTarget(w, h, { depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    this.accT = new THREE.WebGLRenderTarget(w, h, { type: this.canFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false });
    this.ldrT = new THREE.WebGLRenderTarget(w, h, {});
    this.blurT = [];
    for (let i = 0; i < 3; i++) { const d = 2 << i; this.blurT.push([new THREE.WebGLRenderTarget(Math.max(1, w / d | 0), Math.max(1, h / d | 0), { depthBuffer: false }), new THREE.WebGLRenderTarget(Math.max(1, w / d | 0), Math.max(1, h / d | 0), { depthBuffer: false })]); }
    const mk = (uniforms, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false });
    this.edlMat = mk({ tColor: { value: this.sceneT.texture }, tDepth: { value: this.sceneT.depthTexture }, uNear: { value: camera.near }, uFar: { value: camera.far }, uStrength: { value: this.strength }, uRadius: { value: this.radius }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uOn: { value: 1 } }, /* glsl */ `
      uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uStrength, uRadius, uOn; uniform vec2 uTexel;
      varying vec2 vUv;
      float linDepth(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        if (d >= 0.99999) return uFar * 4.0;
        float z = d * 2.0 - 1.0;
        return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
      }
      void main() {
        vec4 col = texture2D(tColor, vUv);
        if (uOn < 0.5) { gl_FragColor = col; return; }
        float dc = log2(linDepth(vUv));
        float resp = 0.0;
        vec2 o[8];
        o[0] = vec2(1,0); o[1] = vec2(-1,0); o[2] = vec2(0,1); o[3] = vec2(0,-1);
        o[4] = vec2(0.707,0.707); o[5] = vec2(-0.707,0.707); o[6] = vec2(0.707,-0.707); o[7] = vec2(-0.707,-0.707);
        for (int i = 0; i < 8; i++) resp += max(0.0, dc - log2(linDepth(vUv + o[i] * uTexel * uRadius)));
        gl_FragColor = vec4(col.rgb * exp(-resp / 8.0 * 300.0 * uStrength), col.a);
      }`);
    // density tone map: average colour of the accumulated splats, brightness 1 - exp(-weight × exposure);
    // very dense overlap warms slightly towards white so hot spots glow
    this.toneMat = mk({ tAcc: { value: this.accT.texture }, uExposure: { value: 1 }, uFloat: { value: this.canFloat ? 1 : 0 } }, /* glsl */ `
      uniform sampler2D tAcc; uniform float uExposure, uFloat; varying vec2 vUv;
      void main() {
        vec4 acc = texture2D(tAcc, vUv);
        float w = acc.a;
        vec3 avg = pow(max(acc.rgb / max(w, 1e-5), 0.0), vec3(1.0 / 2.2)); // the LUT is decoded to linear when sampled: show its true colours
        float b = 1.0 - exp(-w * uExposure * 1.6);            // one fully opaque layer (w = 1) → 80 %
        avg = mix(avg, vec3(1.0), 0.12 * smoothstep(10.0, 60.0, w * uExposure));
        gl_FragColor = vec4(avg * b, 1.0);
      }`);
    this.brightMat = mk({ tColor: { value: null }, uThreshold: { value: 0.62 }, uTexel: { value: new THREE.Vector2() } }, /* glsl */ `
      uniform sampler2D tColor; uniform float uThreshold; uniform vec2 uTexel; varying vec2 vUv;
      void main() {
        vec3 c = 0.25 * (texture2D(tColor, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tColor, vUv + uTexel * vec2(0.5, -0.5)).rgb + texture2D(tColor, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tColor, vUv + uTexel * vec2(0.5, 0.5)).rgb);
        float l = max(c.r, max(c.g, c.b));
        gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.35, l), 1.0);
      }`);
    this.blurMat = mk({ tColor: { value: null }, uDir: { value: new THREE.Vector2() } }, /* glsl */ `
      uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tColor, vUv).rgb * 0.227027;
        c += (texture2D(tColor, vUv + uDir * 1.3846).rgb + texture2D(tColor, vUv - uDir * 1.3846).rgb) * 0.316216;
        c += (texture2D(tColor, vUv + uDir * 3.2308).rgb + texture2D(tColor, vUv - uDir * 3.2308).rgb) * 0.070270;
        gl_FragColor = vec4(c, 1.0);
      }`);
    this.finalMat = mk({ tColor: { value: this.ldrT.texture }, tB0: { value: this.blurT[0][0].texture }, tB1: { value: this.blurT[1][0].texture }, tB2: { value: this.blurT[2][0].texture }, uBloom: { value: this.bloom }, uVignette: { value: this.vignette } }, /* glsl */ `
      uniform sampler2D tColor, tB0, tB1, tB2; uniform float uBloom, uVignette; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tColor, vUv).rgb;
        vec3 b = texture2D(tB0, vUv).rgb * 0.5 + texture2D(tB1, vUv).rgb * 0.8 + texture2D(tB2, vUv).rgb * 1.0;
        c += b * uBloom;
        vec2 q = vUv - 0.5;
        c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q) * 1.25);
        gl_FragColor = vec4(c, 1.0);
      }`);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.edlMat);
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) {
    this.sceneT.setSize(w, h); this.accT.setSize(w, h); this.ldrT.setSize(w, h);
    this.blurT.forEach((pair, i) => { const d = 2 << i; pair.forEach((t) => t.setSize(Math.max(1, w / d | 0), Math.max(1, h / d | 0))); });
    this.edlMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.quadScene, this.ortho); }
  render(scene) {
    const r = this.renderer, cam = this.camera;
    const accum = this.accumulate && this.canFloat;
    if (accum) {
      cam.layers.set(POINT_LAYER);
      r.setRenderTarget(this.accT); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
      r.setClearColor(0x000000, 1);
      this.toneMat.uniforms.uExposure.value = this.exposure;
      this.pass(this.toneMat, this.ldrT);
      cam.layers.set(0);
      const ac = r.autoClear; r.autoClear = false;
      r.setRenderTarget(this.ldrT); r.clearDepth(); r.render(scene, cam);
      r.autoClear = ac;
    } else {
      cam.layers.set(0); cam.layers.enable(POINT_LAYER);
      r.setRenderTarget(this.sceneT); r.render(scene, cam);
      const u = this.edlMat.uniforms;
      u.uOn.value = this.enabled ? 1 : 0; u.uStrength.value = this.strength; u.uRadius.value = this.radius; u.uNear.value = cam.near; u.uFar.value = cam.far;
      this.pass(this.edlMat, this.ldrT);
    }
    cam.layers.set(0); cam.layers.enable(POINT_LAYER);
    // bloom: threshold + downsample, then separable blur at 1/2, 1/4, 1/8
    if (this.bloom > 0.001) {
      let src = this.ldrT;
      for (let i = 0; i < 3; i++) {
        const [a, b] = this.blurT[i];
        if (i === 0) { this.brightMat.uniforms.tColor.value = src.texture; this.brightMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); this.pass(this.brightMat, a); }
        else { this.blurMat.uniforms.tColor.value = src.texture; this.blurMat.uniforms.uDir.value.set(0, 0); this.pass(this.blurMat, a); }
        this.blurMat.uniforms.tColor.value = a.texture; this.blurMat.uniforms.uDir.value.set(1 / a.width, 0); this.pass(this.blurMat, b);
        this.blurMat.uniforms.tColor.value = b.texture; this.blurMat.uniforms.uDir.value.set(0, 1 / a.height); this.pass(this.blurMat, a);
        src = a;
      }
    }
    this.finalMat.uniforms.uBloom.value = this.bloom; this.finalMat.uniforms.uVignette.value = this.vignette;
    this.pass(this.finalMat, null);
  }
}
