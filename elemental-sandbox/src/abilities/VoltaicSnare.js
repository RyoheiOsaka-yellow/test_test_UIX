import * as THREE from 'three';
import { Ability } from './Ability.js';
import { createRibbonBundle, createTubeGeometry } from '../assets/ProceduralGeometry.js';
import { createRibbonMaterial } from '../materials/LightningMaterial.js';
import { createTubeMaterial } from '../materials/BeamMaterial.js';
import { col } from '../particles/ParticleEngine.js';
import { clamp01, easeOutBack, rng } from '../utils/math.js';

const MAX_TENDRILS = 14;
const MAX_ARCS = 8;

/**
 * V — Voltaic Snare. The far cast.
 *
 * A leash of current is whipped out across the floor, and where it lands the
 * ring snaps open past its own radius and pulls back onto it: a violet column
 * tears up out of the middle, tendrils crawl outward to the boundary, arcs run
 * around the rim and the whole disc burns. It holds there re-striking and
 * hauling the air up into the pillar, then collapses to a thread.
 *
 * The circle you measured out before the click is exactly the circle you get —
 * the overshoot is transient, and the settled radius is the indicator's radius.
 */
export class VoltaicSnare extends Ability {
  constructor(context) {
    super(context, 'snare');
    this.maxInstances = 2;
    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
  }

  createInstance() {
    const s = this.s;

    const leashGeo = createRibbonBundle(s.leash.segments, 3);
    const leashMat = createRibbonMaterial({ path: 'bolt' });
    const leash = new THREE.Mesh(leashGeo, leashMat);
    leash.frustumCulled = false;
    leash.renderOrder = 16;
    leash.visible = false;
    this.scene.add(leash);

    const columnGeo = createTubeGeometry(s.column.segments, s.column.radial);
    const columnMat = createTubeMaterial({ profile: 'column', intensity: s.column.intensity });
    const column = new THREE.Mesh(columnGeo, columnMat);
    column.frustumCulled = false;
    column.renderOrder = 15;
    column.visible = false;
    this.scene.add(column);

    const tendrilGeo = createRibbonBundle(s.tendrils.segments, MAX_TENDRILS);
    const tendrilMat = createRibbonMaterial({ path: 'crawl' });
    const tendrils = new THREE.Mesh(tendrilGeo, tendrilMat);
    tendrils.frustumCulled = false;
    tendrils.renderOrder = 16;
    tendrils.visible = false;
    this.scene.add(tendrils);

    const arcGeo = createRibbonBundle(48, MAX_ARCS);
    const arcMat = createRibbonMaterial({ path: 'rim' });
    const arcs = new THREE.Mesh(arcGeo, arcMat);
    arcs.frustumCulled = false;
    arcs.renderOrder = 16;
    arcs.visible = false;
    this.scene.add(arcs);

    return {
      leash,
      leashU: leashMat.userData.uniforms,
      column,
      columnU: columnMat.uniforms,
      tendrils,
      tendrilU: tendrilMat.userData.uniforms,
      arcs,
      arcU: arcMat.userData.uniforms,
      disc: null,
      landed: false,
    };
  }

  begin(inst) {
    const s = this.s;
    inst.landed = false;
    inst.disc = null;
    inst.leash.visible = true;
    inst.column.visible = false;
    inst.tendrils.visible = false;
    inst.arcs.visible = false;
    inst.travel = Math.max(inst.distance / Math.max(s.leash.speed, 1), 0.05);

    const u = inst.leashU;
    u.uStart.value.copy(inst.origin);
    u.uEnd.value.copy(inst.point).setY(0.08);
    u.uSeed.value = inst.seed;
    u.uCount.value = 3;

    this.lights.spawn(inst.origin, {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity * 0.4,
      life: 0.3,
      distance: 12,
      flicker: 18,
    });
  }

  _land(inst) {
    const s = this.s;
    const now = this.time.sim;
    const point = this._q.copy(inst.point).setY(0);
    const radius = s.radius;

    inst.column.visible = true;
    inst.tendrils.visible = true;
    inst.arcs.visible = true;

    inst.disc = this.decals.spawn('snare', {
      position: point,
      size: radius * 2.6,
      color: s.disc.color,
      color2: s.disc.rimColor,
      opacity: s.disc.opacity,
      scale: s.disc.noiseScale,
      churn: s.disc.churn,
      width2: s.snap.rimWidth / (radius * 1.3),
      progress: 0,
      life: s.duration - inst.travel,
      fadeIn: 0.06,
      hold: (s.duration - inst.travel) * 0.6,
      seed: inst.seed,
    });

    this.bursts.spawn(point.clone().setY(0.5), {
      color: s.disc.rimColor,
      color2: s.column.colorMid,
      life: 0.45,
      from: 0.4,
      to: radius * 1.25,
      opacity: 0.35,
      thickness: 0.18,
      noise: 0.5,
      rings: 3,
      intensity: 1.4,
    });

    this.particles.emit('spark', 180, {
      position: point,
      positionRadius: radius * 0.6,
      direction: UP,
      spread: 1.5,
      speed: [3, s.fx.sparkSpeed * 2],
      life: [0.3, 0.8],
      size: [0.06, 0.16],
      sizeEnd: 0.25,
      colorA: col(s.disc.rimColor),
      colorB: col(s.column.colorMid),
      gravity: -9,
      drag: 1.3,
      turbulence: 0.6,
      tint: 0.18,
      birth: now,
    });

    this.lights.spawn(point.clone().setY(1.6), {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity,
      life: s.duration - inst.travel,
      decay: 0.3,
      distance: 26,
      flicker: 9,
    });

    this.ctx.shake(s.fx.shake);
    this.ctx.flash(s.fx.flash, s.column.colorMid);
  }

  step(inst, dt) {
    const s = this.s;
    const now = this.time.sim;
    const point = this._q.copy(inst.point).setY(0);

    // ------------------------------------------------------------- leash ----
    const travelT = clamp01(inst.age / inst.travel);
    const lu = inst.leashU;
    lu.uStart.value.copy(inst.origin);
    lu.uEnd.value.copy(point).setY(0.1);
    lu.uHead.value = travelT;
    lu.uTail.value = inst.landed ? clamp01((inst.age - inst.travel) / 0.22) : 0;
    lu.uWidth.value = s.leash.width;
    lu.uChaos.value = s.leash.chaos;
    lu.uChaosSpeed.value = s.leash.chaosSpeed;
    lu.uChaosScale.value = 1.4;
    lu.uTaper.value = 0.5;
    lu.uSag.value = 0.35;
    lu.uSpiral.value = 0.6;
    lu.uSpiralRadius.value = s.leash.width * 2.2;
    lu.uIntensity.value = s.leash.intensity;
    lu.uColorCore.value.set('#ffffff');
    lu.uColorMid.value.set(s.leash.color);
    lu.uColorEdge.value.set(s.column.colorEdge);
    inst.leash.visible = lu.uTail.value < 1;

    if (!inst.landed && travelT >= 1) {
      inst.landed = true;
      this._land(inst);
    }
    if (!inst.landed) return;

    const ht = inst.age - inst.travel;

    // ---------------------------------------------------- snap and settle ---
    // Past its own radius first, then pulled back onto it.
    let radius = s.radius;
    if (ht < s.snap.snapTime) {
      radius *= 1 + (s.snap.overshoot - 1) * Math.sin((ht / s.snap.snapTime) * Math.PI);
    } else if (ht < s.snap.snapTime + s.snap.settleTime) {
      const st = (ht - s.snap.snapTime) / s.snap.settleTime;
      radius *= 1 + (s.snap.overshoot - 1) * 0.18 * (1 - easeOutBack(st, 1.1));
    }

    // ------------------------------------------------------------- fade -----
    const holdEnd = s.duration - inst.travel - 0.85;
    let fade = 1;
    let collapse = 0;
    if (ht > holdEnd) {
      collapse = clamp01((ht - holdEnd) / 0.85);
      fade = 1 - collapse * collapse;
    }
    const thread = Math.pow(1 - collapse, 1.8) * 0.94 + 0.02;

    if (inst.disc) {
      inst.disc.uniforms.uProgress.value = (radius / (s.radius * 1.3)) * 1.0;
      inst.disc.uniforms.uWidth.value = s.snap.rimWidth / (s.radius * 1.3);
      inst.disc.uniforms.uChurn.value = s.disc.churn;
      inst.disc.uniforms.uColor.value.set(s.disc.color);
      inst.disc.uniforms.uColor2.value.set(s.disc.rimColor);
    }

    // ------------------------------------------------------------ column ----
    const c = s.column;
    const cu = inst.columnU;
    const grow = clamp01(ht / 0.22);
    cu.uStart.value.copy(point).setY(0.02);
    cu.uEnd.value.set(point.x, c.height * grow * thread + 0.05, point.z);
    cu.uRadius.value = c.radius * thread;
    cu.uHead.value = 1;
    cu.uFlare.value = c.flare;
    cu.uNoiseScale.value = c.noiseScale;
    cu.uFlowSpeed.value = c.flowSpeed;
    cu.uSwell.value = 0.18;
    cu.uSwellFreq.value = 2.4;
    cu.uOpacity.value = c.opacity * fade;
    cu.uIntensity.value = c.intensity;
    cu.uColorCore.value.set(c.colorCore);
    cu.uColorMid.value.set(c.colorMid);
    cu.uColorEdge.value.set(c.colorEdge);
    cu.uDiscCount.value = 4;
    cu.uDiscSpeed.value = -6;
    cu.uDiscThickness.value = 0.02;
    cu.uDiscSwell.value = 0.11;
    cu.uDiscColor.value.set(c.colorCore);
    cu.uDiscIntensity.value = 1.2;
    cu.uSeed.value = inst.seed;
    inst.column.visible = fade > 0.02;

    // ----------------------------------------------------------- tendrils ---
    const t = s.tendrils;
    const tu = inst.tendrilU;
    tu.uCentre.value.copy(point);
    tu.uRadius.value = radius;
    tu.uHead.value = clamp01(ht / Math.max(t.crawlTime, 1e-3));
    tu.uTail.value = 0;
    tu.uWidth.value = t.width * thread;
    tu.uWander.value = t.wander;
    tu.uLift.value = 0.16;
    tu.uCount.value = t.count;
    tu.uTaper.value = 0.35;
    tu.uPhase.value = inst.seed;
    tu.uOpacity.value = fade;
    tu.uIntensity.value = t.intensity;
    tu.uFlicker.value = 0.5;
    tu.uFlickerRate.value = t.restrike;
    tu.uColorCore.value.set('#ffffff');
    tu.uColorMid.value.set(t.color);
    tu.uColorEdge.value.set(c.colorEdge);
    tu.uSeed.value = inst.seed;
    inst.tendrils.geometry.instanceCount = Math.min(MAX_TENDRILS, Math.max(1, Math.round(t.count)));
    inst.tendrils.visible = fade > 0.02;

    // --------------------------------------------------------------- arcs ---
    const ar = s.arcs;
    const au = inst.arcU;
    au.uCentre.value.copy(point);
    au.uRadius.value = radius;
    au.uHead.value = 1;
    au.uTail.value = 0;
    au.uWidth.value = ar.width * thread;
    au.uLift.value = ar.lift;
    au.uArc.value = 1.5;
    au.uPhase.value = this.time.sim * ar.speed + inst.seed;
    au.uCount.value = ar.count;
    au.uTaper.value = 0.6;
    au.uOpacity.value = fade;
    au.uIntensity.value = ar.intensity;
    au.uFlicker.value = 0.45;
    au.uFlickerRate.value = 12;
    au.uColorCore.value.set('#ffffff');
    au.uColorMid.value.set(ar.color);
    au.uColorEdge.value.set(c.colorMid);
    au.uSeed.value = inst.seed;
    inst.arcs.geometry.instanceCount = Math.min(MAX_ARCS, Math.max(1, Math.round(ar.count)));
    inst.arcs.visible = fade > 0.02;

    // ------------------------------------------------------------ particles -
    if (fade > 0.1) {
      // Sparks skating around the boundary.
      const a = rng.next() * Math.PI * 2;
      this._p.set(point.x + Math.cos(a) * radius, 0.05, point.z + Math.sin(a) * radius);
      this.particles.emitRate(`snare-${inst.id}-rim`, 'spark', s.fx.sparkRate, dt, {
        position: this._p,
        positionRadius: 0.18,
        direction: UP,
        spread: 1.9,
        speed: [1, s.fx.sparkSpeed],
        life: [0.2, 0.55],
        size: [0.05, 0.12],
        sizeEnd: 0.25,
        colorA: col(s.disc.rimColor),
        colorB: col(c.colorMid),
        gravity: -8,
        drag: 1.6,
        turbulence: 0.5,
        tint: 0.16,
        birth: now,
      });

      // Air hauled up off the disc into the pillar.
      this.particles.emitRate(`snare-${inst.id}-haul`, 'glow', s.fx.haulRate, dt, {
        position: point,
        positionRadius: radius * 0.9,
        direction: UP,
        spread: 0.35,
        speed: [s.fx.haulSpeed * 0.4, s.fx.haulSpeed],
        life: [0.5, 1.1],
        size: [0.05, 0.14],
        sizeEnd: 0.4,
        colorA: col(c.colorCore),
        colorB: col(c.colorEdge),
        gravity: 3.5,
        drag: 1.1,
        turbulence: 0.45,
        tint: 0.14,
        birth: now,
      });
    }
  }

  end(inst) {
    inst.leash.visible = false;
    inst.column.visible = false;
    inst.tendrils.visible = false;
    inst.arcs.visible = false;
    inst.disc = null;
    this.particles.dropRate(`snare-${inst.id}-rim`);
    this.particles.dropRate(`snare-${inst.id}-haul`);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
