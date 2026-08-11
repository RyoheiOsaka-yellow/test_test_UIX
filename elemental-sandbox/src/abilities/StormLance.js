import * as THREE from 'three';
import { Ability } from './Ability.js';
import { createRibbonBundle } from '../assets/ProceduralGeometry.js';
import { createRibbonMaterial } from '../materials/LightningMaterial.js';
import { col } from '../particles/ParticleEngine.js';
import { clamp01, rng } from '../utils/math.js';

const MAX_FILAMENTS = 12;

/**
 * E — Storm Lance.
 *
 * A bolt leaves the caster's hand and a bundle of lightning filaments is drawn
 * out behind the strike front. It holds while it gutters and re-strikes, then
 * blows out. Sparks come off it the whole way, the floor underneath takes a
 * branching electric burn and a dark scorch, and the far end gets a shell of
 * ionised air.
 *
 * The bundle is one instanced ribbon: twelve filaments, one draw call, and not a
 * single vertex position in the buffer — the shader shatters a straight line
 * with two octaves of noise and winds the filaments around it.
 */
export class StormLance extends Ability {
  constructor(context) {
    super(context, 'storm');
    this.maxInstances = 3;
    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
  }

  createInstance() {
    const geometry = createRibbonBundle(this.s.bolt.segments, MAX_FILAMENTS);
    const material = createRibbonMaterial({ path: 'bolt' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 16;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, material, geometry, u: material.userData.uniforms, decalDist: 0, impacted: false };
  }

  begin(inst) {
    const s = this.s;
    const b = s.bolt;

    inst.decalDist = 0;
    inst.impacted = false;
    inst.mesh.visible = true;

    this._q.copy(inst.origin).addScaledVector(inst.direction, inst.distance).setY(0.06);

    const u = inst.u;
    u.uStart.value.copy(inst.origin);
    u.uEnd.value.copy(this._q);
    u.uSeed.value = inst.seed;
    u.uCount.value = b.filaments;
    inst.geometry.instanceCount = Math.min(MAX_FILAMENTS, Math.max(1, Math.round(b.filaments)));

    // A dark scorch under the whole line, laid before the burn.
    const mid = this._p.copy(inst.origin).addScaledVector(inst.direction, inst.distance * 0.5);
    mid.y = 0;
    this.decals.spawn('scorch', {
      position: mid,
      size: Math.max(inst.distance * 1.1, 2),
      color: s.decal.scorchColor,
      opacity: 0.55,
      scale: 1.6,
      life: s.decal.scorchFade,
      fadeIn: 0.08,
      hold: s.decal.scorchFade * 0.4,
      seed: inst.seed,
    });

    this.lights.spawn(inst.origin, {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity * 0.5,
      life: 0.25,
      distance: 14,
      flicker: s.fx.lightFlicker,
    });

    this.ctx.flash(s.fx.flash * 0.4, s.bolt.colorMid);
  }

  _impact(inst) {
    const s = this.s;
    const now = this.time.sim;
    const point = this._q.copy(inst.origin).addScaledVector(inst.direction, inst.distance);
    point.y = 0;

    // Shell of ionised air.
    this.bursts.spawn(point.clone().setY(s.shell.radius * 0.55), {
      color: s.shell.color,
      color2: s.bolt.colorEdge,
      life: s.shell.life,
      from: 0.3,
      to: s.shell.radius,
      opacity: s.shell.opacity,
      thickness: s.shell.thickness,
      noise: s.shell.noise,
      rings: s.shell.rings,
      intensity: 1.3,
    });

    this.particles.emit('spark', s.fx.impactSparks, {
      position: point,
      positionRadius: 0.35,
      direction: UP,
      spread: 1.5,
      speed: [4, s.fx.sparkSpeed * 2.2],
      life: [0.25, s.fx.sparkLife * 1.6],
      size: [s.fx.sparkSize * 0.7, s.fx.sparkSize * 1.8],
      sizeEnd: 0.2,
      colorA: col(s.bolt.colorCore),
      colorB: col(s.bolt.colorEdge),
      gravity: -14,
      drag: 1.2,
      turbulence: 0.5,
      tint: 0.2,
      birth: now,
    });

    this.particles.emit('smoke', s.fx.smokeCount, {
      position: point,
      positionRadius: 0.7,
      direction: UP,
      spread: 1.4,
      speed: [0.8, 2.6],
      life: [1.1, 2.2],
      size: [1.0, 2.2],
      sizeEnd: 2.2,
      colorA: col('#2a3346'),
      colorB: col('#0a0d14'),
      gravity: 0.55,
      drag: 1.5,
      turbulence: 0.4,
      spin: 0.5,
      birth: now,
    });

    // The branching burn, radiating from where it landed.
    this.decals.spawn('electric', {
      position: point,
      size: s.decal.radius * 2.4,
      color: s.decal.burnColor,
      color2: s.bolt.colorEdge,
      opacity: s.decal.opacity,
      scale: s.decal.branchScale,
      sharp: s.decal.branchSharp,
      flicker: s.decal.flicker,
      progress: 1,
      life: s.decal.burnFade,
      fadeIn: 0.04,
      seed: inst.seed + 3,
    });

    this.decals.spawn('scorch', {
      position: point,
      size: s.decal.radius * 1.8,
      color: s.decal.scorchColor,
      opacity: 0.85,
      scale: 2.4,
      life: s.decal.scorchFade,
      fadeIn: 0.06,
      hold: s.decal.scorchFade * 0.5,
      seed: inst.seed + 9,
    });

    this.lights.spawn(point.clone().setY(1.4), {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity,
      life: 0.5,
      distance: 26,
      flicker: s.fx.lightFlicker,
      decay: 0.8,
    });

    this.ctx.shake(s.fx.shake);
    this.ctx.flash(s.fx.flash, s.bolt.colorMid);
  }

  step(inst, dt) {
    const s = this.s;
    const b = s.bolt;
    const u = inst.u;
    const now = this.time.sim;

    const travelTime = inst.distance / Math.max(b.chaosSpeed * 0 + s.front.speed, 1e-3);
    const head = clamp01(inst.age / Math.max(travelTime, 1e-4));

    // Three beats: strike out, hold and gutter, blow out from the tail.
    const holdEnd = travelTime + b.holdTime;
    let tail = 0;
    let opacity = 1;
    if (inst.age > holdEnd) {
      const bt = clamp01((inst.age - holdEnd) / Math.max(b.blowout, 1e-3));
      tail = bt;
      opacity = 1 - bt * bt;
    }

    u.uHead.value = head;
    u.uTail.value = tail;
    u.uOpacity.value = opacity;
    u.uWidth.value = b.width;
    u.uWidthJitter.value = b.widthJitter;
    u.uTaper.value = b.taper;
    u.uChaos.value = b.chaos;
    u.uChaosScale.value = b.chaosScale;
    u.uChaosDetail.value = b.chaosDetail;
    u.uChaosSpeed.value = b.chaosSpeed;
    u.uSag.value = b.sag;
    u.uSpiral.value = b.spiral;
    u.uSpiralRadius.value = b.width * 2.4;
    u.uCount.value = b.filaments;
    u.uIntensity.value = b.intensity;
    u.uFlicker.value = b.restrikeDepth;
    u.uFlickerRate.value = b.restrikeRate;
    u.uColorCore.value.set(b.colorCore);
    u.uColorMid.value.set(b.colorMid);
    u.uColorEdge.value.set(b.colorEdge);
    inst.geometry.instanceCount = Math.min(MAX_FILAMENTS, Math.max(1, Math.round(b.filaments)));

    inst.mesh.visible = opacity > 0.01;

    // --- the burn crawling along under the bolt ---------------------------
    const frontDist = head * inst.distance;
    const spacing = 2.6;
    while (inst.decalDist < frontDist - spacing * 0.5 && inst.decalDist < inst.distance) {
      inst.decalDist += spacing;
      this._p.copy(inst.origin).addScaledVector(inst.direction, inst.decalDist).setY(0);
      this.decals.spawn('electric', {
        position: this._p,
        size: s.decal.trailWidth * 3.2,
        color: s.decal.burnColor,
        color2: s.bolt.colorEdge,
        opacity: s.decal.opacity * 0.7,
        scale: s.decal.branchScale * 1.4,
        sharp: s.decal.branchSharp,
        flicker: s.decal.flicker,
        progress: 1,
        life: s.decal.burnFade * 0.8,
        fadeIn: 0.03,
        seed: rng.next() * 100,
      });
    }

    // --- sparks shed the whole way ---------------------------------------
    if (opacity > 0.05) {
      const along = rng.next();
      this._p
        .copy(inst.origin)
        .addScaledVector(inst.direction, along * frontDist)
        .setY(0.05 + (inst.origin.y - 0.05) * (1 - along));

      this.particles.emitRate(`storm-${inst.id}-spark`, 'spark', s.fx.sparkRate, dt, {
        position: this._p,
        positionRadius: b.chaos * 0.55,
        direction: UP,
        spread: 2.2,
        speed: [1.5, s.fx.sparkSpeed],
        life: [0.15, s.fx.sparkLife],
        size: [s.fx.sparkSize * 0.6, s.fx.sparkSize * 1.4],
        sizeEnd: 0.25,
        colorA: col(b.colorCore),
        colorB: col(b.colorEdge),
        gravity: -11,
        drag: 1.4,
        turbulence: 0.6,
        tint: 0.18,
        birth: now,
      });
    }

    if (!inst.impacted && head >= 1) {
      inst.impacted = true;
      this._impact(inst);
    }
  }

  end(inst) {
    inst.mesh.visible = false;
    this.particles.dropRate(`storm-${inst.id}-spark`);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
