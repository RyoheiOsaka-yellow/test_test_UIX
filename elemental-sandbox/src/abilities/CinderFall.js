import * as THREE from 'three';
import { Ability } from './Ability.js';
import { createAsteroidGeometry, createBillboardBox } from '../assets/ProceduralGeometry.js';
import { createMeteorMaterial, syncMeteorMaterial } from '../materials/MeteorMaterial.js';
import {
  createVolumetricFireMaterial,
  syncFireMaterial,
} from '../materials/VolumetricFireMaterial.js';
import { Debris } from '../effects/Debris.js';
import { col } from '../particles/ParticleEngine.js';
import { clamp01, rng } from '../utils/math.js';

/**
 * R — Cinder Fall.
 *
 * A burning rock is lobbed downrange on an arc, trailing a raymarched wake of
 * burning gas and heating up the whole way: the lava seams splitting its surface
 * prise wider and brighter as it comes in. It detonates on arrival, throws its
 * own shattered chunks across the floor, and tears the ground open into a
 * network of molten cracks that keep glowing while the crater burns out.
 */
export class CinderFall extends Ability {
  constructor(context) {
    super(context, 'cinder');
    this.maxInstances = 3;

    this.debris = new Debris(this.scene, {
      capacity: 180,
      colorCold: this.s.rock.colorCold,
      colorHot: this.s.rock.colorHot,
    });

    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
    this._vel = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this._camObj = new THREE.Vector3();
  }

  createInstance() {
    const f = this.s.flight;

    const rock = new THREE.Mesh(
      createAsteroidGeometry({
        radius: f.radius,
        detail: f.detail,
        craters: f.craterCount,
        craterDepth: f.craterDepth,
        fractures: f.fractureCount,
        fractureDepth: f.fractureDepth,
        seed: 3 + Math.floor(Math.random() * 90),
      }),
      createMeteorMaterial(this.s.rock)
    );
    rock.castShadow = true;
    rock.frustumCulled = false;
    rock.visible = false;
    this.scene.add(rock);

    const wake = new THREE.Mesh(
      createBillboardBox(),
      createVolumetricFireMaterial(this.s.wake)
    );
    wake.frustumCulled = false;
    wake.renderOrder = 13;
    wake.visible = false;
    this.scene.add(wake);

    return { rock, wake, impacted: false, crackDecal: null, flightTime: 1, spin: new THREE.Vector3() };
  }

  begin(inst) {
    const s = this.s;
    inst.impacted = false;
    inst.rock.visible = true;
    inst.wake.visible = true;
    inst.flightTime = Math.max(inst.distance / Math.max(s.flight.speed, 0.5), 0.15);
    inst.spin.set(rng.spread(s.flight.spin), rng.spread(s.flight.spin), rng.spread(s.flight.spin));
    inst.wake.material.userData.uniforms.uSeed.value = inst.seed;

    this.lights.spawn(inst.origin, {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity * 0.35,
      life: 0.3,
      distance: 12,
    });

    // The launch itself: a puff of embers off the caster's hand.
    this.particles.emit('spark', 40, {
      position: inst.origin,
      positionRadius: 0.25,
      direction: inst.direction,
      spread: 1.1,
      speed: [2, 7],
      life: [0.3, 0.7],
      size: [0.07, 0.16],
      sizeEnd: 0.2,
      colorA: col(s.rock.colorCore),
      colorB: col(s.rock.colorHot),
      gravity: -6,
      drag: 1.5,
      birth: this.time.sim,
    });
  }

  /** Ballistic arc from origin to the target point. */
  _position(inst, t, out) {
    out.copy(inst.origin).lerp(inst.point, t);
    out.y = inst.origin.y * (1 - t) + s_arc(t) * this.s.flight.arc * (inst.distance / 14);
    return out;
  }

  _detonate(inst) {
    const s = this.s;
    const im = s.impact;
    const now = this.time.sim;
    const point = this._q.copy(inst.point).setY(0);

    inst.rock.visible = false;
    inst.wake.visible = false;

    // --- the blast front ---------------------------------------------------
    this.bursts.spawn(point.clone().setY(0.6), {
      color: s.rock.colorCore,
      color2: s.rock.colorHot,
      life: 0.55,
      from: 0.5,
      to: im.blastRadius,
      opacity: 0.5,
      thickness: im.blastThickness,
      noise: 0.55,
      rings: 3,
      intensity: 1.6,
    });

    // --- the ground tears open --------------------------------------------
    this.decals.spawn('scorch', {
      position: point,
      size: im.craterRadius * 2.2,
      color: im.scorchColor,
      opacity: 0.92,
      scale: 2.2,
      life: im.scorchFade,
      fadeIn: 0.05,
      hold: im.scorchFade * 0.55,
      seed: inst.seed,
    });

    inst.crackDecal = this.decals.spawn('molten', {
      position: point,
      size: im.crackReach * 2.2,
      color: im.crackColor,
      color2: im.crackCoreColor,
      opacity: 1,
      scale: im.crackScale * 3.2,
      width2: im.crackWidth,
      churn: 1.4,
      progress: 0,
      life: im.glowFade,
      fadeIn: 0.08,
      hold: im.glowFade * 0.35,
      seed: inst.seed + 5,
    });

    // --- its own shattered chunks -----------------------------------------
    this.debris.burst(point, {
      count: im.chunkCount,
      speed: [im.chunkSpeed * 0.4, im.chunkSpeed],
      pitch: 1.0,
      spin: im.chunkSpin,
      size: im.chunkSize,
      life: 4.5,
      birth: now,
    });

    // --- fire and smoke -----------------------------------------------------
    this.particles.emit('fire', s.fx.impactEmbers * 0.5, {
      position: point,
      positionRadius: 1.1,
      direction: UP,
      spread: 1.35,
      speed: [2, 9],
      life: [0.5, 1.3],
      size: [0.9, 2.4],
      sizeEnd: 2.0,
      colorA: col(s.rock.colorCore),
      colorB: col(s.wake.colorOuter),
      gravity: 2.2,
      drag: 2.4,
      turbulence: 0.7,
      spin: 1.2,
      tint: 0.15,
      birth: now,
    });

    this.particles.emit('spark', s.fx.impactEmbers, {
      position: point,
      positionRadius: 0.6,
      direction: UP,
      spread: 1.45,
      speed: [3, s.fx.emberSpeed * 2.4],
      life: [0.6, s.fx.emberLife * 1.5],
      size: [0.05, 0.16],
      sizeEnd: 0.25,
      colorA: col(s.rock.colorCore),
      colorB: col(s.rock.colorHot),
      gravity: -13,
      drag: 0.9,
      turbulence: 0.8,
      tint: 0.22,
      birth: now,
    });

    this.particles.emit('smoke', s.fx.impactSmoke, {
      position: point,
      positionRadius: 1.6,
      direction: UP,
      spread: 1.5,
      speed: [1.2, 4.5],
      life: [1.8, s.fx.smokeLife * 1.6],
      size: [s.fx.smokeSize * 0.6, s.fx.smokeSize * 1.5],
      sizeEnd: 2.6,
      colorA: col('#3a3028'),
      colorB: col('#0b0908'),
      gravity: 0.9,
      drag: 1.3,
      turbulence: 0.55,
      spin: 0.6,
      tint: 0.12,
      birth: now,
    });

    this.lights.spawn(point.clone().setY(1.6), {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity,
      life: s.fx.lightFade,
      decay: 0.7,
      distance: 34,
    });

    this.ctx.shake(s.fx.shake);
    this.ctx.flash(s.fx.flash, s.rock.colorHot);
  }

  step(inst, dt) {
    const s = this.s;
    const now = this.time.sim;

    if (!inst.impacted) {
      const t = clamp01(inst.age / inst.flightTime);
      this._prev.copy(inst.rock.position);
      this._position(inst, t, this._p);
      inst.rock.position.copy(this._p);

      // Heat climbs the whole way down.
      const heat = Math.pow(t, 0.7);
      const u = inst.rock.material.userData.uniforms;
      u.uHeat.value = heat;

      inst.rock.rotation.x += inst.spin.x * dt;
      inst.rock.rotation.y += inst.spin.y * dt;
      inst.rock.rotation.z += inst.spin.z * dt;
      inst.rock.scale.setScalar(1);

      // --- the wake --------------------------------------------------------
      this._vel.copy(this._p).sub(this._prev);
      if (this._vel.lengthSq() < 1e-8) this._vel.copy(inst.direction);
      this._vel.normalize();

      const wk = s.wake;
      const length = wk.length * (0.45 + 0.75 * heat);
      // The box hangs behind the rock, +Z pointing the way it is travelling.
      inst.wake.position.copy(this._p).addScaledVector(this._vel, -length * 0.5 + s.flight.radius);
      inst.wake.quaternion.setFromUnitVectors(FORWARD, this._vel);
      inst.wake.scale.set(wk.radius * 2, wk.radius * 2, length);
      inst.wake.updateMatrixWorld();

      const wu = inst.wake.material.userData.uniforms;
      inst.wake.worldToLocal(this._camObj.copy(this.ctx.camera.position));
      wu.uCamObj.value.copy(this._camObj);
      wu.uIntensity.value = 0.6 + 1.1 * heat;
      wu.uFade.value = 1;

      // --- trail -------------------------------------------------------------
      this.particles.emitRate(`cinder-${inst.id}-ember`, 'spark', s.fx.trailEmbers, dt, {
        position: this._p,
        positionRadius: s.flight.radius * 1.2,
        direction: this._vel.clone().negate(),
        spread: 0.9,
        speed: [1, s.fx.emberSpeed],
        life: [0.35, s.fx.emberLife],
        size: [0.05, 0.14],
        sizeEnd: 0.2,
        colorA: col(s.rock.colorCore),
        colorB: col(s.rock.colorHot),
        gravity: -4.5,
        drag: 1.6,
        turbulence: 0.8,
        tint: 0.2,
        birth: now,
      });

      this.particles.emitRate(`cinder-${inst.id}-smoke`, 'smoke', s.fx.trailSmoke, dt, {
        position: this._p,
        positionRadius: s.flight.radius,
        direction: UP,
        spread: 1.5,
        speed: [0.4, 1.6],
        life: [1.0, s.fx.smokeLife],
        size: [s.fx.smokeSize * 0.35, s.fx.smokeSize * 0.8],
        sizeEnd: 2.4,
        colorA: col('#4a3a2e'),
        colorB: col('#0c0a08'),
        gravity: 0.75,
        drag: 1.4,
        turbulence: 0.5,
        spin: 0.5,
        birth: now,
      });

      if (t >= 1) {
        inst.impacted = true;
        this.particles.dropRate(`cinder-${inst.id}-ember`);
        this.particles.dropRate(`cinder-${inst.id}-smoke`);
        this._detonate(inst);
      }
    } else if (inst.crackDecal) {
      // The crack network keeps opening after the blast has gone.
      const since = inst.age - inst.flightTime;
      const spread = clamp01(since * s.impact.blastSpeed * 0.32);
      inst.crackDecal.uniforms.uProgress.value = spread;
      inst.crackDecal.uniforms.uChurn.value = 1.4;

      // The crater keeps breathing embers while it burns out.
      this._q.copy(inst.point).setY(0.1);
      this.particles.emitRate(`cinder-${inst.id}-burn`, 'fire', 26, dt, {
        position: this._q,
        positionRadius: s.impact.craterRadius * 0.7,
        direction: UP,
        spread: 0.5,
        speed: [0.5, 2.2],
        life: [0.7, 1.6],
        size: [0.5, 1.3],
        sizeEnd: 2.2,
        colorA: col(s.rock.colorHot),
        colorB: col(s.wake.colorOuter),
        gravity: 2.6,
        drag: 2.2,
        turbulence: 0.6,
        tint: 0.18,
        birth: now,
      });
    }
  }

  end(inst) {
    inst.rock.visible = false;
    inst.wake.visible = false;
    inst.crackDecal = null;
    this.particles.dropRate(`cinder-${inst.id}-ember`);
    this.particles.dropRate(`cinder-${inst.id}-smoke`);
    this.particles.dropRate(`cinder-${inst.id}-burn`);
  }

  sync() {
    for (const inst of this.instances) {
      syncMeteorMaterial(inst.rock.material, this.s.rock);
      syncFireMaterial(inst.wake.material, this.s.wake);
    }
    this.debris.sync({
      colorCold: this.s.rock.colorCold,
      colorHot: this.s.rock.colorHot,
      bounce: this.s.impact.chunkBounce,
    });
  }

  clear() {
    super.clear();
    this.debris.clear();
  }
}

/** Height profile of the lob: up fast, over the top, down onto the target. */
function s_arc(t) {
  return Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)) * 1.0;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
