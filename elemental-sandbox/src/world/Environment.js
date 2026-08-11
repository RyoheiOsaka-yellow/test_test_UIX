import * as THREE from 'three';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';

/**
 * Stage lighting and the reflection probe.
 *
 * The probe is not an HDR file — it is a shaded sphere rendered once into a
 * PMREM chain. That gives the ice something to reflect and the caster a soft
 * sky/ground split, with nothing on disk.
 */
export class Environment {
  constructor(scene, renderer, settings) {
    this.scene = scene;
    this.settings = settings;

    const w = settings.world;

    scene.fog = new THREE.Fog(new THREE.Color(w.fogColor), w.fogNear, w.fogFar);
    scene.background = new THREE.Color(w.fogColor);

    this.ambient = new THREE.AmbientLight(new THREE.Color(w.ambient), w.ambientIntensity);
    scene.add(this.ambient);

    this.key = new THREE.DirectionalLight(new THREE.Color(w.keyColor), w.keyIntensity);
    this.key.castShadow = settings.renderer.shadows;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 60;
    this.key.shadow.camera.left = -22;
    this.key.shadow.camera.right = 22;
    this.key.shadow.camera.top = 22;
    this.key.shadow.camera.bottom = -22;
    this.key.shadow.bias = -0.0012;
    this.key.shadow.normalBias = 0.035;
    scene.add(this.key);
    scene.add(this.key.target);

    this.rim = new THREE.DirectionalLight(new THREE.Color(w.rimColor), w.rimIntensity);
    scene.add(this.rim);

    this.fill = new THREE.HemisphereLight(new THREE.Color(w.fillColor), 0x05070b, w.fillIntensity);
    scene.add(this.fill);

    this.envTexture = this._buildProbe(renderer);
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.55;

    this.sync();
  }

  /** Render a gradient sky-dome into a PMREM chain — the whole "HDRI". */
  _buildProbe(renderer) {
    const probeScene = new THREE.Scene();

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(50, 48, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uSky: { value: new THREE.Color('#2d4f7a') },
          uHorizon: { value: new THREE.Color('#0d1622') },
          uGround: { value: new THREE.Color('#05070b') },
          uSunDir: { value: new THREE.Vector3(0.5, 0.55, -0.65).normalize() },
          uSunColor: { value: new THREE.Color('#ffe6c4') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          ${noiseGLSL}
          uniform vec3 uSky;
          uniform vec3 uHorizon;
          uniform vec3 uGround;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          varying vec3 vDir;

          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = h > 0.0
              ? mix(uHorizon, uSky, pow(clamp(h, 0.0, 1.0), 0.55))
              : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.35));

            /* A soft key so metal and ice get a highlight to catch. */
            float sun = pow(max(dot(d, normalize(uSunDir)), 0.0), 220.0);
            float bloom = pow(max(dot(d, normalize(uSunDir)), 0.0), 6.0);
            col += uSunColor * (sun * 9.0 + bloom * 0.35);

            /* Break the gradient up so reflections are not perfectly clean. */
            col *= 0.92 + 0.16 * es_fbm3(d * 4.0, 3, 2.1, 0.5);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    probeScene.add(dome);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromScene(probeScene, 0.04);
    pmrem.dispose();
    dome.geometry.dispose();
    dome.material.dispose();
    return target.texture;
  }

  /** Push slider values into the lights. Cheap enough to call every frame. */
  sync() {
    const w = this.settings.world;
    this.scene.fog.color.set(w.fogColor);
    this.scene.fog.near = w.fogNear;
    this.scene.fog.far = w.fogFar;
    this.scene.background.set(w.fogColor);

    this.ambient.color.set(w.ambient);
    this.ambient.intensity = w.ambientIntensity;

    this.key.color.set(w.keyColor);
    this.key.intensity = w.keyIntensity;
    this.key.position.set(
      Math.sin(w.keyAngle) * 16,
      w.keyHeight,
      Math.cos(w.keyAngle) * 16
    );
    this.key.target.position.set(0, 0, 0);

    this.rim.color.set(w.rimColor);
    this.rim.intensity = w.rimIntensity;
    this.rim.position.set(-Math.sin(w.keyAngle) * 14, 5.5, -Math.cos(w.keyAngle) * 14);

    this.fill.color.set(w.fillColor);
    this.fill.intensity = w.fillIntensity;
  }
}
