// Eye-Dome Lighting post-process (Potree style) — adds depth-based shading so dense point
// clouds read as surfaces instead of a flat speckle.
import * as THREE from 'three';

export class EDL {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = true;
    this.strength = 0.45;
    this.radius = 1.2;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType) });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uStrength: { value: this.strength },
        uRadius: { value: this.radius },
        uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uStrength, uRadius; uniform vec2 uTexel;
        varying vec2 vUv;
        float linDepth(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          if (d >= 0.99999) return uFar * 4.0;
          float z = d * 2.0 - 1.0;
          return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
        }
        void main() {
          vec4 col = texture2D(tColor, vUv);
          float dc = log2(linDepth(vUv));
          float resp = 0.0;
          vec2 o[8];
          o[0] = vec2(1,0); o[1] = vec2(-1,0); o[2] = vec2(0,1); o[3] = vec2(0,-1);
          o[4] = vec2(0.707,0.707); o[5] = vec2(-0.707,0.707); o[6] = vec2(0.707,-0.707); o[7] = vec2(-0.707,-0.707);
          for (int i = 0; i < 8; i++) {
            float dn = log2(linDepth(vUv + o[i] * uTexel * uRadius));
            resp += max(0.0, dc - dn);
          }
          resp /= 8.0;
          float shade = exp(-resp * 300.0 * uStrength);
          gl_FragColor = vec4(col.rgb * shade, col.a);
        }
      `,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) {
    this.target.setSize(w, h);
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
  }
  render(scene) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, this.camera); return; }
    this.material.uniforms.uStrength.value = this.strength;
    this.material.uniforms.uRadius.value = this.radius;
    this.material.uniforms.uNear.value = this.camera.near;
    this.material.uniforms.uFar.value = this.camera.far;
    r.setRenderTarget(this.target);
    r.render(scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.ortho);
  }
}
