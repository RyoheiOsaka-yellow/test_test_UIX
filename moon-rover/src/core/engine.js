/* ============================================================
   ENGINE — framebuffer sizing, HDR target, bloom, output pass

   The image is treated as what it is in fiction: a camera bolted to a
   rover. Linear HDR through the chain, ACES at the end, sensor noise
   that rises in shadow, and a veiling glare toward the sun.
   ============================================================ */

import { createProgram, createTarget, pixelScale, FULLSCREEN_VS } from './gl.js';
import { clamp } from './math.js';

export const TIERS = {
  low: { pixels: 900e3, maxDpr: 1.0, bloomLevels: 2, label: 'LOW' },
  medium: { pixels: 1.5e6, maxDpr: 1.5, bloomLevels: 3, label: 'MEDIUM' },
  high: { pixels: 2.4e6, maxDpr: 2.0, bloomLevels: 4, label: 'HIGH' },
  ultra: { pixels: 4.2e6, maxDpr: 2.0, bloomLevels: 4, label: 'ULTRA' }
};

export function guessTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && (mem <= 4 || cores <= 4)) return 'low';
  if (coarse) return 'medium';
  if (mem >= 8 && cores >= 8) return 'high';
  return 'medium';
}

const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform float uThreshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  fragColor = vec4(c * k, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uDir;
out vec4 fragColor;
void main() {
  // Nine taps folded into five by exploiting bilinear sampling.
  vec3 c = texture(uSrc, vUv).rgb * 0.227027;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  c += (texture(uSrc, vUv + o1).rgb + texture(uSrc, vUv - o1).rgb) * 0.3162162162;
  c += (texture(uSrc, vUv + o2).rgb + texture(uSrc, vUv - o2).rgb) * 0.0702702703;
  fragColor = vec4(c, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uAdd;
out vec4 fragColor;
void main() {
  fragColor = vec4(texture(uSrc, vUv).rgb + texture(uAdd, vUv).rgb, 1.0);
}`;

const OUT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmount;
uniform float uGrain;
uniform float uTime;
uniform vec2 uSunNdc;      // sun position in NDC, w<0 if behind
uniform float uSunVisible;
uniform float uVignette;
uniform float uFade;
out vec4 fragColor;

/* ACES filmic, Narkowicz's fit. Cheap, and it keeps the sun-lit
   regolith from clipping to a flat white sheet. */
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

/* Integer-bit hash. The sin(dot(...)) trick has visible diagonal
   structure at 1440p, and structure in the grain reads as a dirty
   sensor rather than as noise. */
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967296.0);
}

void main() {
  vec3 col = texture(uScene, vUv).rgb;
  col += texture(uBloom, vUv).rgb * uBloomAmount;

  // Veiling glare: light scattering inside the lens stack, not in air.
  if (uSunVisible > 0.0) {
    vec2 d = (vUv * 2.0 - 1.0) - uSunNdc;
    float r = length(d * vec2(1.0, 0.62));
    col += vec3(1.0, 0.96, 0.88) * uSunVisible * 0.055 / (1.0 + r * r * 34.0);
    // One lazy ghost across the optical axis.
    vec2 gh = (vUv * 2.0 - 1.0) + uSunNdc * 0.62;
    col += vec3(0.35, 0.55, 0.9) * uSunVisible * 0.012 / (1.0 + dot(gh, gh) * 90.0);
  }

  col = aces(col);

  /* Sensor noise rises where the signal is low, which is the character
     of a shadow shot on a cold CMOS. It also has to have a ceiling:
     1/(0.1 + l) with l near zero is a wall of static, and the shadows
     out here are near zero over half the frame. */
  if (uGrain > 0.0) {
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float n = hash(vUv * 1024.0 + fract(uTime) * 37.0) - 0.5;
    col += n * uGrain * 0.030 * (0.18 + 0.82 * exp(-l * 7.0));
  }

  float v = 1.0 - uVignette * pow(length(vUv - 0.5) * 1.34, 2.6);
  col *= clamp(v, 0.0, 1.0);

  // Gamma. Everything above this line is linear.
  col = pow(max(col, 0.0), vec3(1.0 / 2.2)) * uFade;
  fragColor = vec4(col, 1.0);
}`;

export class Engine {
  constructor(canvas, tier = 'high') {
    this.canvas = canvas;
    this.tier = tier;
    this.settings = {
      bloom: 1,
      grain: 1,
      vignette: 0.30,
      exposure: 1.0
    };
    this.gl = null;
    this.scale = 1;
    this.governor = 1;
    this._ftAvg = 16;
    this.fade = 1;
  }

  attach(gl) {
    this.gl = gl;
    this.bright = createProgram(gl, FULLSCREEN_VS, BRIGHT_FS, 'bright');
    this.blur = createProgram(gl, FULLSCREEN_VS, BLUR_FS, 'blur');
    this.up = createProgram(gl, FULLSCREEN_VS, UP_FS, 'bloom-up');
    this.out = createProgram(gl, FULLSCREEN_VS, OUT_FS, 'output');
    this.emptyVao = gl.createVertexArray();
    this.targets = [];
    this.resize(true);
  }

  setTier(tier) { this.tier = tier; this.resize(true); }

  resize(force = false) {
    const gl = this.gl;
    const q = TIERS[this.tier];
    const cssW = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.max(240, this.canvas.clientHeight || window.innerHeight);
    const px = pixelScale(cssW, cssH, q.pixels, q.maxDpr) * this.governor;
    const w = Math.max(320, Math.round(cssW * px));
    const h = Math.max(240, Math.round(cssH * px));
    if (!force && w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.cssWidth = cssW; this.cssHeight = cssH;
    this.scale = px;
    this.canvas.width = w;
    this.canvas.height = h;

    for (const t of this.targets) t.dispose();
    this.targets = [];
    this.scene = createTarget(gl, w, h, { float: true, depth: true });
    this.targets.push(this.scene);
    this.chain = [];
    let bw = w, bh = h;
    for (let i = 0; i < q.bloomLevels; i++) {
      bw = Math.max(4, bw >> 1); bh = Math.max(4, bh >> 1);
      const a = createTarget(gl, bw, bh, { float: true, depth: false });
      const b = createTarget(gl, bw, bh, { float: true, depth: false });
      this.chain.push({ a, b, w: bw, h: bh });
      this.targets.push(a, b);
    }
  }

  /* A rolling frame time trades resolution for smoothness between 100%
     and 62% before you notice, and gives it back when there is room. */
  governorTick(frameMs) {
    this._ftAvg = this._ftAvg * 0.92 + frameMs * 0.08;
    const before = this.governor;
    if (this._ftAvg > 23 && this.governor > 0.62) this.governor = Math.max(0.62, this.governor - 0.02);
    else if (this._ftAvg < 13.5 && this.governor < 1) this.governor = Math.min(1, this.governor + 0.01);
    if (Math.abs(this.governor - before) > 0.0005) this.resize();
  }

  beginScene() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  _pass(prog, target, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.width : this.width, target ? target.height : this.height);
    prog.use();
    setup(prog.u);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  present(sunNdc, sunVisible, time) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const amount = this.settings.bloom;
    if (amount > 0 && this.chain.length) {
      // Bright pass into the first (half-res) level.
      this._pass(this.bright, this.chain[0].a, (u) => {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
        gl.uniform1i(u.uSrc, 0);
        gl.uniform1f(u.uThreshold, 1.05);
      });
      // Downsample the chain.
      for (let i = 1; i < this.chain.length; i++) {
        this._pass(this.bright, this.chain[i].a, (u) => {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.chain[i - 1].a.color);
          gl.uniform1i(u.uSrc, 0);
          gl.uniform1f(u.uThreshold, 0.0);
        });
      }
      // Blur each level, then add it back up the chain.
      for (let i = this.chain.length - 1; i >= 0; i--) {
        const lv = this.chain[i];
        this._pass(this.blur, lv.b, (u) => {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lv.a.color);
          gl.uniform1i(u.uSrc, 0);
          gl.uniform2f(u.uDir, 1 / lv.w, 0);
        });
        this._pass(this.blur, lv.a, (u) => {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lv.b.color);
          gl.uniform1i(u.uSrc, 0);
          gl.uniform2f(u.uDir, 0, 1 / lv.h);
        });
        if (i > 0) {
          this._pass(this.up, this.chain[i - 1].b, (u) => {
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.chain[i - 1].a.color);
            gl.uniform1i(u.uSrc, 0);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lv.a.color);
            gl.uniform1i(u.uAdd, 1);
          });
          const t = this.chain[i - 1].a;
          this.chain[i - 1].a = this.chain[i - 1].b;
          this.chain[i - 1].b = t;
        }
      }
    }

    this._pass(this.out, null, (u) => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.color);
      gl.uniform1i(u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.chain.length ? this.chain[0].a.color : this.scene.color);
      gl.uniform1i(u.uBloom, 1);
      gl.uniform1f(u.uBloomAmount, this.chain.length ? amount * 0.55 : 0);
      gl.uniform1f(u.uGrain, this.settings.grain);
      gl.uniform1f(u.uTime, time);
      gl.uniform2fv(u.uSunNdc, sunNdc);
      gl.uniform1f(u.uSunVisible, sunVisible);
      gl.uniform1f(u.uVignette, this.settings.vignette);
      gl.uniform1f(u.uFade, clamp(this.fade, 0, 1));
    });
    gl.bindVertexArray(null);
  }
}
