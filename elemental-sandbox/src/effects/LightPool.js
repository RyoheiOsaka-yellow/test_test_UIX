import * as THREE from 'three';

/**
 * A small pool of point lights. Every cast wants to throw real light on the
 * floor and on the caster, but a scene cannot afford an unbounded number of
 * them — so they are recycled, and the dimmest one is stolen when the pool is
 * exhausted rather than adding another uniform slot to every material.
 */
export class LightPool {
  constructor(scene, count = 6) {
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 40, 2);
      light.visible = false;
      scene.add(light);
      this.lights.push({ light, life: 0, age: 0, peak: 0, decay: 1, flicker: 0, seed: Math.random() * 100 });
    }
  }

  /**
   * @param {THREE.Vector3} position
   * @param {object} o  { color, intensity, distance, life, decay, flicker }
   * @returns {object}  the slot — move `slot.light.position` to make it follow
   */
  spawn(position, o) {
    let slot = this.lights.find((s) => s.age >= s.life);
    if (!slot) {
      slot = this.lights.reduce((a, b) => {
        const ia = a.peak * (1 - a.age / a.life);
        const ib = b.peak * (1 - b.age / b.life);
        return ia <= ib ? a : b;
      });
    }
    slot.light.position.copy(position);
    slot.light.color.set(o.color ?? '#ffffff');
    slot.light.distance = o.distance ?? 26;
    slot.light.decay = 2;
    slot.light.visible = true;
    slot.peak = o.intensity ?? 30;
    slot.life = o.life ?? 0.6;
    slot.decay = o.decay ?? 1;
    slot.flicker = o.flicker ?? 0;
    slot.age = 0;
    return slot;
  }

  update(dt, wallTime) {
    for (const s of this.lights) {
      if (s.age >= s.life) {
        if (s.light.visible) {
          s.light.visible = false;
          s.light.intensity = 0;
        }
        continue;
      }
      s.age += dt;
      const t = Math.min(s.age / s.life, 1);
      let v = s.peak * Math.pow(1 - t, Math.max(s.decay, 0.05) * 2);
      if (s.flicker > 0) {
        v *= 0.55 + 0.75 * Math.abs(Math.sin((wallTime + s.seed) * s.flicker));
      }
      s.light.intensity = v;
    }
  }

  clear() {
    for (const s of this.lights) {
      s.age = s.life;
      s.light.intensity = 0;
      s.light.visible = false;
    }
  }
}
