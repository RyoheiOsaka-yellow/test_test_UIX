import * as THREE from 'three';
import { settings } from '../config/settings.js';
import { createRenderer } from './Renderer.js';
import { CameraRig } from './CameraRig.js';
import { Time } from './Time.js';
import { frame, updateFrameUniforms } from './FrameUniforms.js';

import { Environment } from '../world/Environment.js';
import { Ground } from '../world/Ground.js';
import { DustMotes } from '../world/DustMotes.js';
import { Caster } from '../world/Caster.js';

import { ParticleEngine } from '../particles/ParticleEngine.js';
import { GroundDecals } from '../effects/GroundDecals.js';
import { LightPool } from '../effects/LightPool.js';
import { BurstSphere } from '../effects/BurstSphere.js';

import { InputManager } from '../input/InputManager.js';
import { AimController } from '../input/AimController.js';
import { AbilityManager } from '../abilities/AbilityManager.js';
import { PostProcessing } from '../postprocessing/PostProcessing.js';
import { HUD } from '../ui/HUD.js';
import { Editor } from '../ui/Editor.js';

/**
 * Wiring and the frame loop.
 *
 * Two clocks run side by side. The wall clock drives the camera, the UI, the
 * targeting indicator and the editor; the sim clock drives every effect. Hitting
 * P stops the sim clock only — the eruption freezes mid-air, and the sliders
 * keep repainting the frozen frame, which is the whole reason the project
 * exists.
 */
export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = settings;
    this.time = new Time();

    this.renderer = createRenderer(canvas, settings);
    this.scene = new THREE.Scene();

    this.rig = new CameraRig(settings);
    this.camera = this.rig.camera;

    this.environment = new Environment(this.scene, this.renderer, settings);
    this.ground = new Ground(this.scene, settings);
    this.dust = new DustMotes(this.scene, settings);
    this.caster = new Caster(this.scene, settings);

    this.particles = new ParticleEngine(this.scene, settings);
    this.decals = new GroundDecals(this.scene, settings);
    this.lights = new LightPool(this.scene, 7);
    this.bursts = new BurstSphere(this.scene, 10);

    this.post = new PostProcessing(this.renderer, this.scene, this.camera, settings);

    // The shared surface every ability is handed.
    this.context = {
      scene: this.scene,
      settings,
      time: this.time,
      camera: this.camera,
      caster: this.caster,
      particles: this.particles,
      decals: this.decals,
      lights: this.lights,
      bursts: this.bursts,
      shake: (amount) => {
        this.rig.shake(amount);
        this.post.punch(amount * 0.09);
      },
      flash: (amount, color) => this.hud?.punch(amount, color),
    };

    this.abilities = new AbilityManager(this.context);
    this.aim = new AimController(this.scene, this.camera, settings);
    this.input = new InputManager(canvas);
    this.hud = new HUD(this.abilities, settings);

    this.editor = new Editor(settings, {
      clear: () => this.clear(),
      pause: () => this.time.togglePause(),
    });

    this._origin = new THREE.Vector3();
    this._wireInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this._frames = 0;
    this._raf = 0;
  }

  _wireInput() {
    const input = this.input;

    input.on('pointer', (p) => this.aim.setPointer(p));
    input.on('orbit', ({ dx, dy }) => this.rig.orbit(dx, dy));
    input.on('zoom', (delta) => this.rig.zoom(delta));
    input.on('cancel', () => this.abilities.cancel());
    input.on('cast', () => {
      if (this.input.dragging) return;
      this.abilities.tryCast(this.aim);
    });

    input.on('key', (code) => {
      const slot = this.abilities.keyFor(code);
      if (slot) {
        this.abilities.arm(slot);
        return;
      }
      switch (code) {
        case 'KeyG':
          this.editor.toggle();
          break;
        case 'KeyP':
          this.time.togglePause();
          break;
        case 'KeyX':
          this.clear();
          break;
        case 'KeyH':
          this.hud.toggleHelp();
          break;
        default:
          break;
      }
    });
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.settings.renderer.maxPixelRatio)
    );
    this.renderer.setSize(width, height);
    this.rig.resize(width, height);
    this.post.resize(width, height);
  }

  clear() {
    this.abilities.clear();
    this.particles.clear();
    this.decals.clear();
    this.bursts.clear();
    this.lights.clear();
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  frame() {
    const time = this.time;
    time.tick();
    const dt = time.simDelta;
    const wallDt = time.delta;

    // Sliders are read every frame, so the editor keeps applying while paused.
    this.renderer.toneMappingExposure = this.settings.renderer.exposure;
    this.environment.sync();
    this.ground.sync();
    this.dust.sync();
    this.abilities.sync();

    updateFrameUniforms(time, this.camera, this.renderer.getSize(_size), this.settings);

    // The caster looks where you are aiming, whether or not anything is armed.
    if (this.abilities.armed) this.caster.face(this.aim.direction);
    const charge = this.abilities.armedKey ? 0.35 : 0;
    this.caster.update(wallDt, time.wall, charge);

    this._origin.copy(this.caster.root.position);
    this.aim.update(wallDt, this.abilities.armed, this._origin);

    this.abilities.update(dt, wallDt);
    this.decals.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt, time.wall);
    this.particles.flush();

    this.rig.update(wallDt, time.wall);
    this.hud.update(wallDt);

    this.post.render(wallDt, time.wall);

    if (this._frames < 3) {
      this._frames++;
      if (this._frames === 3) document.getElementById('boot')?.classList.add('boot--done');
    }
  }
}

const _size = new THREE.Vector2();
export { frame };
