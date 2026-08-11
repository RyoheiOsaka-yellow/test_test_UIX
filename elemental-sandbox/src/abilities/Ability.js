import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';

/**
 * Base class for a cast.
 *
 * An ability owns a small pool of *instances*. Firing acquires one, hands it the
 * geometry of the shot (origin, direction, the point on the floor) and lets it
 * run on its own clock until its duration is up. Nothing is allocated after the
 * first few casts, so holding the fire button does not stutter.
 *
 * Subclasses implement four hooks:
 *   createInstance()             build the meshes this cast needs, once
 *   begin(instance, shot)        place them and start the clock
 *   step(instance, dt)           advance one frame
 *   end(instance)                hide everything
 */
export class Ability {
  constructor(context, key) {
    this.ctx = context;
    this.key = key;
    this.instances = [];
    this.maxInstances = 3;
    this._nextId = 0;
  }

  /** Live settings block — read it every frame, never cache the numbers. */
  get s() {
    return this.ctx.settings.abilities[this.key];
  }

  get scene() {
    return this.ctx.scene;
  }

  get particles() {
    return this.ctx.particles;
  }

  get decals() {
    return this.ctx.decals;
  }

  get lights() {
    return this.ctx.lights;
  }

  get bursts() {
    return this.ctx.bursts;
  }

  get time() {
    return this.ctx.time;
  }

  createInstance() {
    return {};
  }

  begin() {}
  step() {}
  end() {}
  sync() {}

  /**
   * @param {object} shot { origin: Vector3, direction: Vector3, point: Vector3, distance }
   */
  cast(shot) {
    let inst = this.instances.find((i) => !i.active);
    if (!inst) {
      if (this.instances.length >= this.maxInstances) {
        // Oldest cast gives up its slot rather than dropping the input.
        inst = this.instances.reduce((a, b) => (a.age > b.age ? a : b));
        this.end(inst);
      } else {
        inst = this.createInstance();
        inst.active = false;
        inst.age = 0;
        this.instances.push(inst);
      }
    }

    inst.id = this._nextId++;
    inst.active = true;
    inst.age = 0;
    inst.birth = this.time.sim;
    inst.origin = (inst.origin ?? new THREE.Vector3()).copy(shot.origin);
    inst.direction = (inst.direction ?? new THREE.Vector3()).copy(shot.direction).normalize();
    inst.point = (inst.point ?? new THREE.Vector3()).copy(shot.point);
    inst.distance = shot.distance;
    inst.seed = Math.random() * 100;

    this.begin(inst, shot);
    return inst;
  }

  update(dt) {
    const duration = this.s.duration;
    for (const inst of this.instances) {
      if (!inst.active) continue;
      inst.age += dt;
      inst.t = clamp01(inst.age / duration);
      this.step(inst, dt);
      if (inst.age >= duration) {
        inst.active = false;
        this.end(inst);
      }
    }
  }

  clear() {
    for (const inst of this.instances) {
      if (!inst.active) continue;
      inst.active = false;
      this.end(inst);
    }
  }

  /** Where the travelling front is, along the shot, at time `age`. */
  frontDistance(inst, speed) {
    return Math.min(inst.distance, speed * inst.age);
  }

  frontPoint(inst, speed, out = new THREE.Vector3()) {
    return out.copy(inst.origin).addScaledVector(inst.direction, this.frontDistance(inst, speed));
  }
}
