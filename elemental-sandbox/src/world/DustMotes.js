import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * Ambient motes hanging in the stage light. Positions are never written back to
 * the CPU: each point stores a home position and a phase, and the vertex shader
 * resolves where it actually is from wall time.
 */
export class DustMotes {
  constructor(scene, settings) {
    this.settings = settings;
    const d = settings.dust;

    const count = d.count;
    const home = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const scale = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * d.radius;
      const a = Math.random() * Math.PI * 2;
      home[i * 3 + 0] = Math.cos(a) * r;
      home[i * 3 + 1] = Math.pow(Math.random(), 1.6) * d.height + 0.15;
      home[i * 3 + 2] = Math.sin(a) * r;
      phase[i] = Math.random() * 100;
      scale[i] = 0.45 + Math.random() * 0.9;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(home, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), d.radius * 1.5);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: frame.uTime,
        uColor: { value: new THREE.Color(d.color) },
        uOpacity: { value: d.opacity },
        uSize: { value: d.size },
        uDrift: { value: d.drift },
        uSwirl: { value: d.swirl },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */ `
        ${noiseGLSL}
        uniform float uTime;
        uniform float uSize;
        uniform float uDrift;
        uniform float uSwirl;
        uniform float uPixelRatio;
        attribute float aPhase;
        attribute float aScale;
        varying float vFade;

        void main() {
          vec3 p = position;
          float t = uTime * uDrift + aPhase;

          /* Slow vertical bob plus a lazy horizontal orbit. */
          p.y += sin(t * 0.9) * 0.55;
          float orbit = uSwirl * uTime + aPhase;
          p.xz += vec2(cos(orbit), sin(orbit)) * 0.42;
          p += (es_hash33(vec3(aPhase)) - 0.5) * 0.6 * sin(t * 0.43);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aScale * uPixelRatio * 320.0 / max(-mv.z, 0.1);

          /* Twinkle, and drop out near the floor so nothing sits in the seam. */
          vFade = (0.45 + 0.55 * sin(t * 2.1 + aPhase)) * smoothstep(0.0, 1.2, p.y);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float a = smoothstep(1.0, 0.0, length(uv));
          a *= a;
          gl_FragColor = vec4(uColor, a * uOpacity * vFade);
          if (gl_FragColor.a < 0.004) discard;
        }
      `,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  sync() {
    const d = this.settings.dust;
    this.points.visible = d.enabled;
    this.material.uniforms.uColor.value.set(d.color);
    this.material.uniforms.uOpacity.value = d.opacity;
    this.material.uniforms.uSize.value = d.size;
    this.material.uniforms.uDrift.value = d.drift;
    this.material.uniforms.uSwirl.value = d.swirl;
  }
}
