import * as THREE from 'three';
import { Ability } from './Ability.js';
import { CrystalField } from '../effects/CrystalField.js';
import { col } from '../particles/ParticleEngine.js';
import { lerp, rng } from '../utils/math.js';

/**
 * Q — Frost Lance.
 *
 * A fracture front races out along the line while a field of ice crystals tears
 * up out of the floor behind it: small and dense at the caster's feet, opening
 * into a wall of blades at the far end, with a cluster thrown up around the
 * impact point.
 *
 * The crystals are planted *as the front passes them*, each with its own birth
 * time, so the eruption is a wave rather than a single pop. Once planted, the
 * vertex shader owns them.
 */
export class FrostLance extends Ability {
  constructor(context) {
    super(context, 'frost');
    this.maxInstances = 4;

    this.field = new CrystalField(this.scene, {
      capacity: 420,
      variant: 'crystal',
      params: this.s.ice,
      timing: this.s.crystals,
      seed: 11,
    });

    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
    this._side = new THREE.Vector3();
  }

  createInstance() {
    return { planted: 0, decalDist: 0, impacted: false };
  }

  begin(inst) {
    const s = this.s;
    inst.planted = 0;
    inst.decalDist = 0;
    inst.impacted = false;

    // The caster's own hand frosts over before the front leaves.
    this.particles.emit('glow', 26, {
      position: inst.origin,
      positionRadius: 0.3,
      direction: inst.direction,
      spread: 1.2,
      speed: [1.5, 4],
      life: [0.25, 0.5],
      size: [0.05, 0.13],
      sizeEnd: 0.1,
      colorA: col(s.ice.colorEdge),
      colorB: col(s.ice.colorMid),
      gravity: -1.5,
      drag: 3.5,
      birth: this.time.sim,
    });

    this.lights.spawn(inst.origin, {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity * 0.5,
      life: 0.35,
      distance: 12,
    });
  }

  /** One crystal at distance `d` down the line, offset across it. */
  _plant(inst, d, birth) {
    const s = this.s;
    const c = s.crystals;
    const u = d / Math.max(inst.distance, 1e-3);

    // The field opens out as it goes: narrow at the feet, a wall at the end.
    const spread = c.spread * (1 + c.spreadGrowth * u);
    const lateral = rng.spread(spread);

    this._side.set(inst.direction.z, 0, -inst.direction.x);
    this._p
      .copy(inst.origin)
      .addScaledVector(inst.direction, d + rng.spread(0.35))
      .addScaledVector(this._side, lateral);
    this._p.y = 0;

    const size = lerp(c.sizeNear, c.sizeFar, u) * (1 + rng.spread(c.sizeJitter));

    this.field.plant(this._p, {
      scale: size,
      height: c.heightScale * (1 + rng.spread(0.3)),
      yaw: rng.next() * Math.PI * 2,
      // Blades lean away from the line, so the wall opens toward the camera.
      tilt: c.tilt * (0.4 + rng.next()),
      tiltDir: Math.atan2(lateral, 0.35) + rng.spread(0.8),
      birth,
      delay: rng.range(0, 0.05),
    });
  }

  _impact(inst) {
    const s = this.s;
    const c = s.crystals;
    const fx = s.fx;
    const point = this._q.copy(inst.origin).addScaledVector(inst.direction, inst.distance);
    point.y = 0;

    // A cluster thrown up around the point of impact.
    for (let i = 0; i < c.clusterCount; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * c.clusterRadius;
      this._p.set(point.x + Math.cos(a) * r, 0, point.z + Math.sin(a) * r);
      this.field.plant(this._p, {
        scale: c.sizeFar * c.clusterScale * (1 + rng.spread(0.4)),
        height: c.heightScale * (1 + rng.spread(0.35)),
        yaw: rng.next() * Math.PI * 2,
        tilt: c.tilt * 1.5 * rng.next(),
        tiltDir: a,
        birth: this.time.sim,
        delay: rng.range(0, 0.12),
      });
    }

    this.decals.spawn('frost', {
      position: point,
      size: s.decal.radiusFar * 2.4,
      color: s.decal.color,
      color2: s.ice.colorMid,
      opacity: s.decal.opacity,
      scale: s.decal.rimeScale,
      progress: 1,
      life: s.decal.fade * 1.6,
      fadeIn: s.decal.growTime,
      hold: s.decal.fade * 0.4,
      seed: inst.seed,
    });

    const now = this.time.sim;
    this.particles.emit('smoke', fx.impactMist, {
      position: point,
      positionRadius: 1.2,
      direction: UP,
      spread: 1.5,
      speed: [1.2, 4.5],
      life: [0.9, 1.9],
      size: [fx.mistSize * 0.6, fx.mistSize * 1.4],
      sizeEnd: 1.8,
      colorA: col(s.decal.color),
      colorB: col(s.ice.colorDeep),
      gravity: 0.5,
      drag: 1.6,
      turbulence: 0.55,
      spin: 0.7,
      tint: 0.12,
      birth: now,
    });

    this.particles.emit('chip', fx.impactChips, {
      position: point,
      positionRadius: 0.6,
      direction: UP,
      spread: 1.15,
      speed: [3, fx.chipSpeed * 1.6],
      life: [0.8, 1.6],
      size: [0.1, 0.26],
      sizeEnd: 0.8,
      colorA: col(s.ice.colorEdge),
      colorB: col(s.ice.colorMid),
      gravity: -16,
      drag: 0.35,
      spin: 9,
      tint: 0.15,
      birth: now,
    });

    this.particles.emit('glow', fx.impactGlitter, {
      position: point,
      positionRadius: 1.0,
      direction: UP,
      spread: 1.4,
      speed: [2, 8],
      life: [0.5, 1.1],
      size: [0.04, 0.13],
      sizeEnd: 0.1,
      colorA: col(s.ice.colorEdge),
      colorB: col(s.decal.color),
      gravity: -3,
      drag: 1.1,
      turbulence: 0.4,
      birth: now,
    });

    this.bursts.spawn(point.clone().setY(0.4), {
      color: s.decal.color,
      color2: s.ice.colorDeep,
      life: 0.42,
      from: 0.4,
      to: 3.0,
      opacity: 0.24,
      thickness: 0.16,
      noise: 0.6,
      rings: 4,
      intensity: 1.3,
    });

    this.lights.spawn(point.clone().setY(1.2), {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity,
      life: 0.7,
      decay: s.fx.lightDecay,
      distance: 22,
    });

    this.ctx.shake(fx.shake);
    this.ctx.flash(fx.flash, s.decal.color);
  }

  step(inst, dt) {
    const s = this.s;
    const front = Math.min(inst.distance, s.front.speed * inst.age);
    const progress = front / Math.max(inst.distance, 1e-3);
    const now = this.time.sim;

    // --- plant the wave --------------------------------------------------
    const total = s.crystals.count;
    const want = Math.floor(progress * total);
    let guard = 0;
    while (inst.planted < want && guard++ < 40) {
      const d = ((inst.planted + 0.5) / total) * inst.distance;
      this._plant(inst, d, now);
      inst.planted++;
    }

    // --- rime laid down under the wave -----------------------------------
    const spacing = 3.2;
    while (inst.decalDist < front - spacing * 0.5 && inst.decalDist < inst.distance) {
      inst.decalDist += spacing;
      const u = inst.decalDist / Math.max(inst.distance, 1e-3);
      this._p
        .copy(inst.origin)
        .addScaledVector(inst.direction, inst.decalDist)
        .setY(0);
      this.decals.spawn('frost', {
        position: this._p,
        size: lerp(s.decal.radius, s.decal.radiusFar, u) * 2,
        color: s.decal.color,
        color2: s.ice.colorMid,
        opacity: s.decal.opacity * 0.5,
        scale: s.decal.rimeScale,
        life: s.decal.fade,
        fadeIn: s.decal.growTime,
        hold: s.decal.fade * 0.35,
        seed: rng.next() * 100,
      });
    }

    // --- the front itself -------------------------------------------------
    if (front < inst.distance) {
      this._p.copy(inst.origin).addScaledVector(inst.direction, front).setY(0.15);
      const fx = s.fx;

      this.particles.emitRate(`frost-${inst.id}-mist`, 'smoke', fx.mistCount * 30, dt, {
        position: this._p,
        positionRadius: 0.55,
        direction: UP,
        spread: 1.4,
        speed: [0.8, 2.6],
        life: [0.7, 1.4],
        size: [fx.mistSize * 0.5, fx.mistSize],
        sizeEnd: 2.1,
        colorA: col(s.decal.color),
        colorB: col(s.ice.colorDeep),
        gravity: 0.4,
        drag: 1.8,
        turbulence: 0.5,
        spin: 0.6,
        tint: 0.1,
        birth: now,
      });

      this.particles.emitRate(`frost-${inst.id}-chip`, 'chip', fx.chipCount * 30, dt, {
        position: this._p,
        positionRadius: 0.4,
        direction: UP,
        spread: 0.9,
        speed: [2, fx.chipSpeed],
        life: [0.5, 1.1],
        size: [0.09, 0.2],
        sizeEnd: 0.7,
        colorA: col(s.ice.colorEdge),
        colorB: col(s.ice.colorMid),
        gravity: -15,
        drag: 0.3,
        spin: 8,
        birth: now,
      });

      this.particles.emitRate(`frost-${inst.id}-glit`, 'glow', fx.glitterCount * 30, dt, {
        position: this._p,
        positionRadius: 0.7,
        direction: UP,
        spread: 1.3,
        speed: [1.5, 5],
        life: [0.35, 0.8],
        size: [0.03, 0.1],
        sizeEnd: 0.1,
        colorA: col(s.ice.colorEdge),
        colorB: col(s.decal.color),
        gravity: -2.5,
        drag: 1.4,
        birth: now,
      });
    }

    if (!inst.impacted && front >= inst.distance - 1e-3) {
      inst.impacted = true;
      this._impact(inst);
    }
  }

  end(inst) {
    this.particles.dropRate(`frost-${inst.id}-mist`);
    this.particles.dropRate(`frost-${inst.id}-chip`);
    this.particles.dropRate(`frost-${inst.id}-glit`);
  }

  sync() {
    this.field.sync(this.s.ice, this.s.crystals);
  }

  clear() {
    super.clear();
    this.field.clear();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
