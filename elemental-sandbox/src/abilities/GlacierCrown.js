import * as THREE from 'three';
import { Ability } from './Ability.js';
import { CrystalField } from '../effects/CrystalField.js';
import { col } from '../particles/ParticleEngine.js';
import { TAU, lerp, rng } from '../utils/math.js';

/**
 * C — Glacier Crown. The second far cast.
 *
 * The circle you place is the footprint of a ring of blades. They come up out of
 * the floor in staggered rings — outer first, leaning outward, then the inner
 * ring leaning in — with a single spire punched up through the middle a beat
 * later. A shock ring runs out under them, the whole disc rimes over, and the
 * crown stands for a few seconds before sinking back.
 *
 * Shares its instanced field and its ice shader with Frost Lance; the difference
 * is entirely in what gets written into the instance matrices.
 */
export class GlacierCrown extends Ability {
  constructor(context) {
    super(context, 'glacier');
    this.maxInstances = 2;

    this.field = new CrystalField(this.scene, {
      capacity: 160,
      variant: 'shard',
      params: this.s.ice,
      timing: this.s.crown,
      seed: 71,
    });

    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
  }

  createInstance() {
    return { shockDecal: null, shocked: false };
  }

  begin(inst) {
    const s = this.s;
    const c = s.crown;
    const now = this.time.sim;
    const point = this._q.copy(inst.point).setY(0);
    const radius = s.radius;

    // --- the crown -------------------------------------------------------
    for (let ring = 0; ring < c.rings; ring++) {
      // Outer ring first, inner ring a beat behind it.
      const ringT = c.rings > 1 ? ring / (c.rings - 1) : 0;
      const ringRadius = radius * lerp(1, c.innerScale, ringT);
      const shards = Math.max(3, Math.round(c.shards * lerp(1, 0.62, ringT)));
      const stagger = ringT * c.riseStagger;

      for (let i = 0; i < shards; i++) {
        const a = (i / shards) * TAU + c.twist * ringT + rng.spread(0.08);
        const r = ringRadius * (1 + rng.spread(0.06));
        this._p.set(point.x + Math.cos(a) * r, 0, point.z + Math.sin(a) * r);

        this.field.plant(this._p, {
          scale: c.thickness * (1 + rng.spread(0.28)),
          height: (c.height / c.thickness) * (1 + rng.spread(c.heightJitter)),
          // Blades stand along the tangent so the ring reads as a wall.
          yaw: -a + Math.PI / 2,
          // Outer ring leans out, inner ring leans in.
          tilt: c.lean * (ringT < 0.5 ? 1 : -0.7) * (0.7 + rng.next() * 0.6),
          tiltDir: a,
          birth: now,
          delay: stagger + rng.range(0, 0.12),
        });
      }
    }

    // --- the spire -------------------------------------------------------
    if (c.rings > 0 && s.spire.enabled) {
      this.field.plant(point, {
        scale: s.spire.radius,
        height: s.spire.height / s.spire.radius,
        yaw: rng.next() * TAU,
        tilt: 0.05,
        tiltDir: rng.next() * TAU,
        birth: now,
        delay: c.riseStagger * 1.4,
      });
    }

    // --- the floor -------------------------------------------------------
    this.decals.spawn('frost', {
      position: point,
      size: radius * 2.5,
      color: s.decal.color,
      color2: s.ice.colorMid,
      opacity: s.decal.opacity,
      scale: s.decal.rimeScale,
      progress: 1,
      life: s.decal.fade,
      fadeIn: s.decal.growTime,
      hold: s.decal.fade * 0.5,
      seed: inst.seed,
    });

    inst.shockDecal = this.decals.spawn('shock', {
      position: point,
      size: radius * 3.4,
      color: s.shock.color,
      color2: '#ffffff',
      opacity: s.shock.intensity * 0.6,
      scale: 3.0,
      width2: s.shock.width / (radius * 1.7),
      progress: 0,
      life: 0.85,
      fadeIn: 0.05,
      seed: inst.seed + 2,
    });
    inst.shocked = true;

    // --- fx ---------------------------------------------------------------
    const fx = s.fx;
    this.particles.emit('smoke', fx.mistCount, {
      position: point,
      positionRadius: radius * 0.9,
      direction: UP,
      spread: 1.5,
      speed: [1, 4],
      life: [1.1, 2.4],
      size: [fx.mistSize * 0.5, fx.mistSize * 1.2],
      sizeEnd: 1.7,
      colorA: col(s.decal.color),
      colorB: col(s.ice.colorDeep),
      gravity: 0.45,
      drag: 1.5,
      turbulence: 0.5,
      spin: 0.6,
      tint: 0.12,
      birth: now,
    });

    this.particles.emit('chip', fx.chipCount, {
      position: point,
      positionRadius: radius * 0.85,
      direction: UP,
      spread: 1.0,
      speed: [3, fx.chipSpeed],
      life: [0.9, 1.7],
      size: [0.11, 0.3],
      sizeEnd: 0.75,
      colorA: col(s.ice.colorEdge),
      colorB: col(s.ice.colorMid),
      gravity: -16,
      drag: 0.32,
      spin: 9,
      tint: 0.14,
      birth: now,
    });

    this.particles.emit('glow', fx.glitterCount, {
      position: point,
      positionRadius: radius,
      direction: UP,
      spread: 1.4,
      speed: [1.5, 7],
      life: [0.5, 1.3],
      size: [0.04, 0.13],
      sizeEnd: 0.12,
      colorA: col(s.ice.colorEdge),
      colorB: col(s.decal.color),
      gravity: -3,
      drag: 1.2,
      turbulence: 0.45,
      birth: now,
    });

    this.bursts.spawn(point.clone().setY(0.6), {
      color: s.decal.color,
      color2: s.ice.colorDeep,
      life: 0.5,
      from: 0.5,
      to: radius * 1.15,
      opacity: 0.22,
      thickness: 0.16,
      noise: 0.55,
      rings: 4,
      intensity: 1.4,
    });

    this.lights.spawn(point.clone().setY(2.2), {
      color: fx.lightColor,
      intensity: fx.lightIntensity,
      life: 1.2,
      decay: 0.55,
      distance: 28,
    });

    this.ctx.shake(fx.shake);
    this.ctx.flash(fx.flash, s.decal.color);
  }

  step(inst, dt) {
    const s = this.s;

    if (inst.shockDecal) {
      // The ring races out under the blades.
      const p = Math.min(1, (inst.age * s.shock.speed) / (s.radius * 1.7));
      inst.shockDecal.uniforms.uProgress.value = p;
      if (p >= 1) inst.shockDecal = null;
    }

    // A slow drift of vapour off the ice for as long as it stands.
    const standing = inst.age < s.crown.riseTime + s.crown.holdTime;
    if (standing) {
      this._p.copy(inst.point).setY(0.2);
      this.particles.emitRate(`glacier-${inst.id}-vapour`, 'smoke', 34, dt, {
        position: this._p,
        positionRadius: s.radius,
        direction: UP,
        spread: 1.2,
        speed: [0.2, 1.1],
        life: [1.2, 2.4],
        size: [0.7, 1.6],
        sizeEnd: 2.2,
        colorA: col(s.decal.color),
        colorB: col(s.ice.colorDeep),
        gravity: 0.28,
        drag: 1.7,
        turbulence: 0.4,
        spin: 0.4,
        tint: 0.1,
        birth: this.time.sim,
      });
    } else {
      this.particles.dropRate(`glacier-${inst.id}-vapour`);
    }
  }

  end(inst) {
    inst.shockDecal = null;
    this.particles.dropRate(`glacier-${inst.id}-vapour`);
  }

  sync() {
    this.field.sync(this.s.ice, this.s.crown);
  }

  clear() {
    super.clear();
    this.field.clear();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
