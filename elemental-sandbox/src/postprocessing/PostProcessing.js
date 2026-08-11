import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader } from './GradeShader.js';
import { damp } from '../utils/math.js';

/**
 * Render → bloom → grade → output.
 *
 * Bloom is what sells "this is emissive, not painted": every additive material
 * in the sandbox is authored expecting it. The grade pass carries a distortion
 * term that abilities push on impact and that decays on its own.
 */
export class PostProcessing {
  constructor(renderer, scene, camera, settings) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;

    const size = renderer.getSize(new THREE.Vector2());

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      settings.post.bloomStrength,
      settings.post.bloomRadius,
      settings.post.bloomThreshold
    );
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.distortion = 0;
  }

  /** Abilities call this to punch the lens on impact. */
  punch(amount) {
    this.distortion = Math.min(0.35, this.distortion + amount);
  }

  resize(width, height) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
    this.grade.uniforms.uResolution.value.set(width, height);
  }

  render(dt, wallTime) {
    const p = this.settings.post;

    this.bloom.strength = p.bloomStrength;
    this.bloom.radius = p.bloomRadius;
    this.bloom.threshold = p.bloomThreshold;

    this.distortion = damp(this.distortion, 0, 4.5, dt);

    const g = this.grade.uniforms;
    g.uTime.value = wallTime;
    g.uContrast.value = p.grade ? p.contrast : 1;
    g.uSaturation.value = p.grade ? p.saturation : 1;
    g.uLift.value = p.grade ? p.lift : 0;
    g.uVignette.value = p.grade ? p.vignette : 0;
    g.uChromatic.value = p.grade ? p.chromatic : 0;
    g.uGrain.value = p.grade ? p.grain : 0;
    g.uDistortion.value = p.distortionAmount + this.distortion;

    if (p.enabled) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
