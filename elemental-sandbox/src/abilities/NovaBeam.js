import * as THREE from 'three';
import { Ability } from './Ability.js';
import { createTubeGeometry, createRibbonBundle } from '../assets/ProceduralGeometry.js';
import { createTubeMaterial } from '../materials/BeamMaterial.js';
import { createRibbonMaterial } from '../materials/LightningMaterial.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { frame } from '../core/FrameUniforms.js';
import { col } from '../particles/ParticleEngine.js';
import { clamp01, easeOutCubic, rng } from '../utils/math.js';

const MAX_RIBBONS = 8;

/**
 * F — Nova Beam.
 *
 * The caster winds a ball of light up in both hands, pulling motes in out of the
 * air, then lets a column of it out along the line — white-hot core, cyan
 * sheath, gold ribbons spiralling around it and shock discs racing down it. It
 * *holds* there, burning into the floor and throwing spray back up the beam,
 * before collapsing to a thread and blinking out.
 *
 * The only cast in the sandbox that is still happening a second after it landed.
 */
export class NovaBeam extends Ability {
  constructor(context) {
    super(context, 'nova');
    this.maxInstances = 2;
    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
    this._end = new THREE.Vector3();
  }

  _orbMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: frame.uTime,
        uCameraPos: frame.uCameraPos,
        uCore: { value: new THREE.Color(this.s.windup.coreColor) },
        uHalo: { value: new THREE.Color(this.s.windup.haloColor) },
        uCharge: { value: 0 },
        uPulse: { value: 9 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      toneMapped: true,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        ${noiseGLSL}
        ${commonGLSL}
        uniform float uTime;
        uniform vec3 uCameraPos;
        uniform vec3 uCore;
        uniform vec3 uHalo;
        uniform float uCharge;
        uniform float uPulse;
        varying vec3 vN;
        varying vec3 vW;

        void main() {
          vec3 v = normalize(uCameraPos - vW);
          float facing = abs(dot(normalize(vN), v));
          float rim = pow(1.0 - facing, 1.6);
          float churn = es_fbm3(normalize(vN) * 4.0 + vec3(0.0, uTime * 2.2, 0.0), 4, 2.1, 0.55);
          float beat = 0.75 + 0.35 * sin(uTime * uPulse);

          vec3 col = mix(uCore, uHalo, rim);
          col *= (0.5 + 1.4 * churn) * beat;
          col += uCore * pow(facing, 3.0) * 2.2;

          float a = (0.35 + 0.9 * rim + 0.5 * churn) * uCharge;
          if (a < 0.005) discard;
          gl_FragColor = vec4(col * (1.0 + 2.0 * uCharge), clamp(a, 0.0, 1.0));
        }
      `,
    });
  }

  createInstance() {
    const b = this.s.beam;
    const geometry = createTubeGeometry(b.segments, b.radial);

    const layer = (profileOpacity, intensity) => {
      const material = createTubeMaterial({ profile: 'beam', intensity, opacity: profileOpacity });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 15;
      mesh.visible = false;
      this.scene.add(mesh);
      return { mesh, u: material.uniforms };
    };

    const core = layer(1.0, b.intensity);
    const sheath = layer(b.sheathOpacity, b.intensity * 0.8);
    const outer = layer(b.outerOpacity, b.intensity * 0.55);

    const ribbonGeo = createRibbonBundle(96, MAX_RIBBONS);
    const ribbonMat = createRibbonMaterial({ path: 'helix' });
    const ribbons = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbons.frustumCulled = false;
    ribbons.renderOrder = 17;
    ribbons.visible = false;
    this.scene.add(ribbons);

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), this._orbMaterial());
    orb.frustumCulled = false;
    orb.renderOrder = 18;
    orb.visible = false;
    this.scene.add(orb);

    return {
      geometry,
      core,
      sheath,
      outer,
      ribbons,
      ribbonU: ribbonMat.userData.uniforms,
      orb,
      orbU: orb.material.uniforms,
      burn: null,
      fired: false,
    };
  }

  begin(inst) {
    inst.fired = false;
    inst.burn = null;
    inst.orb.visible = true;
    inst.core.mesh.visible = false;
    inst.sheath.mesh.visible = false;
    inst.outer.mesh.visible = false;
    inst.ribbons.visible = false;

    this._end.copy(inst.origin).addScaledVector(inst.direction, inst.distance);
    this._end.y = Math.max(0.35, inst.origin.y * 0.42);
    inst.end = (inst.end ?? new THREE.Vector3()).copy(this._end);

    this.lights.spawn(inst.origin, {
      color: this.s.fx.lightColor,
      intensity: this.s.fx.lightIntensity * 0.2,
      life: this.s.windup.time,
      decay: 0.2,
      distance: 14,
    });
  }

  _fire(inst) {
    const s = this.s;
    const now = this.time.sim;

    inst.core.mesh.visible = true;
    inst.sheath.mesh.visible = true;
    inst.outer.mesh.visible = true;
    inst.ribbons.visible = true;

    // The scar the beam burns into the floor, laid along the shot.
    const mid = this._q.copy(inst.origin).addScaledVector(inst.direction, inst.distance * 0.5);
    mid.y = 0;
    const d = inst.direction;
    inst.burn = this.decals.spawn('beam', {
      position: mid,
      // The beam decal reads `uv.x` as "along", so the quad's +X is the shot.
      rotation: Math.atan2(-d.z, d.x),
      width: inst.distance,
      length: s.decal.width * 2,
      color: s.decal.color,
      color2: s.decal.coreColor,
      opacity: s.decal.opacity,
      scale: s.decal.noiseScale,
      progress: 0,
      life: s.decal.fade + s.beam.holdTime,
      fadeIn: 0.05,
      hold: (s.decal.fade + s.beam.holdTime) * 0.45,
      seed: inst.seed,
    });

    this.bursts.spawn(inst.origin.clone(), {
      color: s.beam.colorCore,
      color2: s.beam.colorSheath,
      life: 0.4,
      from: 0.3,
      to: 2.6,
      opacity: 0.45,
      thickness: 0.2,
      noise: 0.4,
      rings: 2,
      intensity: 1.6,
    });

    this.particles.emit('glow', s.fx.impactSpray, {
      position: inst.end,
      positionRadius: 0.5,
      direction: inst.direction.clone().negate(),
      spread: 1.1,
      speed: [4, s.fx.spraySpeed * 2],
      life: [0.35, s.fx.sprayLife * 1.5],
      size: [0.06, 0.2],
      sizeEnd: 0.3,
      colorA: col(s.beam.colorCore),
      colorB: col(s.beam.colorOuter),
      gravity: -5,
      drag: 1.4,
      turbulence: 0.5,
      tint: 0.15,
      birth: now,
    });

    this.lights.spawn(inst.end.clone().setY(1.2), {
      color: s.fx.lightColor,
      intensity: s.fx.lightIntensity,
      life: s.beam.holdTime + 0.6,
      decay: 0.35,
      distance: 30,
    });

    this.ctx.shake(s.fx.shake);
    this.ctx.flash(s.fx.flash, s.beam.colorSheath);
  }

  step(inst, dt) {
    const s = this.s;
    const w = s.windup;
    const b = s.beam;
    const now = this.time.sim;

    const orbPos = this._p.copy(inst.origin);

    // ------------------------------------------------------------- windup --
    if (inst.age < w.time) {
      const charge = clamp01(inst.age / w.time);
      inst.orb.visible = true;
      inst.orb.position.copy(orbPos);
      inst.orb.scale.setScalar(w.radius * (0.35 + 0.9 * easeOutCubic(charge)));
      inst.orbU.uCharge.value = charge;
      inst.orbU.uCore.value.set(w.coreColor);
      inst.orbU.uHalo.value.set(w.haloColor);
      inst.orbU.uPulse.value = w.pulse;

      // Motes pulled in out of the air. Launched outward-in with heavy drag, so
      // the closed-form solution lands them on the orb exactly.
      const k = 4.0;
      this.particles.emitRate(`nova-${inst.id}-mote`, 'glow', w.moteCount * 1.6, dt, {
        position: orbPos,
        positionRadius: w.moteRadius,
        direction: UP,
        spread: 0,
        speed: [0, 0],
        centre: orbPos,
        radialSpeed: -w.moteRadius * k * 0.85,
        life: [0.5, 0.9],
        size: [w.moteSize * 0.5, w.moteSize * 1.4],
        sizeEnd: 0.15,
        colorA: col(w.haloColor),
        colorB: col(w.coreColor),
        drag: k,
        gravity: 0,
        tint: 0.12,
        birth: now,
      });
      return;
    }

    if (!inst.fired) {
      inst.fired = true;
      this.particles.dropRate(`nova-${inst.id}-mote`);
      this._fire(inst);
    }

    const bt = inst.age - w.time;

    // ------------------------------------------------------- beam envelope --
    let head = clamp01(bt / Math.max(b.growTime, 1e-3));
    let radiusScale = 1;
    let fade = 1;

    const collapseStart = b.growTime + b.holdTime;
    if (bt > collapseStart) {
      const ct = clamp01((bt - collapseStart) / Math.max(b.collapseTime, 1e-3));
      // Down to a thread first, then out.
      radiusScale = Math.pow(1 - ct, 2.2) * 0.92 + 0.02;
      fade = 1 - ct * ct;
    }

    // The orb is drawn into the beam as it fires.
    inst.orb.visible = bt < 0.25;
    if (inst.orb.visible) {
      inst.orb.position.copy(orbPos);
      inst.orb.scale.setScalar(w.radius * (1 - bt / 0.25) * 1.3);
      inst.orbU.uCharge.value = 1 - bt / 0.25;
    }

    const setLayer = (layer, radius, opacity, intensity, isCore) => {
      const u = layer.u;
      u.uStart.value.copy(inst.origin);
      u.uEnd.value.copy(inst.end);
      u.uRadius.value = radius * radiusScale;
      u.uHead.value = head;
      u.uSwell.value = b.swell * (isCore ? 0.6 : 1);
      u.uSwellFreq.value = b.swellFreq;
      u.uNoiseScale.value = b.noiseScale;
      u.uFlowSpeed.value = b.flowSpeed;
      u.uOpacity.value = opacity * fade;
      u.uIntensity.value = intensity;
      u.uColorCore.value.set(b.colorCore);
      u.uColorMid.value.set(b.colorSheath);
      u.uColorEdge.value.set(b.colorOuter);
      u.uDiscCount.value = isCore ? 0 : s.discs.count;
      u.uDiscSpeed.value = s.discs.speed;
      u.uDiscThickness.value = s.discs.thickness * 0.1;
      u.uDiscSwell.value = isCore ? 0 : (s.discs.radius - 1) * 0.35;
      u.uDiscColor.value.set(s.discs.color);
      u.uDiscIntensity.value = s.discs.intensity;
      u.uSeed.value = inst.seed;
      layer.mesh.visible = fade > 0.02;
    };

    setLayer(inst.core, b.radiusCore, 1.0, b.intensity * 1.15, true);
    setLayer(inst.sheath, b.radiusSheath, b.sheathOpacity, b.intensity, false);
    setLayer(inst.outer, b.radiusOuter, b.outerOpacity, b.intensity * 0.6, false);

    // --------------------------------------------------------- gold ribbons --
    const r = s.ribbons;
    const ru = inst.ribbonU;
    ru.uStart.value.copy(inst.origin);
    ru.uEnd.value.copy(inst.end);
    ru.uHead.value = head;
    ru.uTail.value = 0;
    ru.uRadius.value = r.radius * radiusScale;
    ru.uTurns.value = r.turns;
    ru.uWidth.value = r.width * radiusScale;
    ru.uWidthJitter.value = 0.3;
    ru.uTaper.value = r.taper;
    ru.uCount.value = r.count;
    ru.uPhase.value = this.time.sim * r.speed;
    ru.uChaos.value = 0.6;
    ru.uOpacity.value = fade;
    ru.uIntensity.value = r.intensity;
    ru.uFlicker.value = 0.25;
    ru.uFlickerRate.value = 6;
    ru.uColorCore.value.set('#fffdf2');
    ru.uColorMid.value.set(r.color);
    ru.uColorEdge.value.set(r.color);
    ru.uSeed.value = inst.seed;
    inst.ribbons.geometry.instanceCount = Math.min(MAX_RIBBONS, Math.max(1, Math.round(r.count)));
    inst.ribbons.visible = fade > 0.02;

    if (inst.burn) inst.burn.uniforms.uProgress.value = head;

    // ------------------------------------------------------------- spray ----
    if (fade > 0.15) {
      this.particles.emitRate(`nova-${inst.id}-spray`, 'glow', s.fx.sprayRate, dt, {
        position: inst.end,
        positionRadius: 0.4,
        direction: inst.direction.clone().negate().setY(0.65).normalize(),
        spread: 0.85,
        speed: [2, s.fx.spraySpeed],
        life: [0.3, s.fx.sprayLife],
        size: [0.05, 0.15],
        sizeEnd: 0.3,
        colorA: col(b.colorCore),
        colorB: col(b.colorOuter),
        gravity: -4.5,
        drag: 1.5,
        turbulence: 0.6,
        tint: 0.14,
        birth: now,
      });

      // Motes falling back into the beam along its whole length.
      const along = rng.next();
      this._q.copy(inst.origin).lerp(inst.end, along);
      this.particles.emitRate(`nova-${inst.id}-drip`, 'glow', 60, dt, {
        position: this._q,
        positionRadius: b.radiusOuter * 1.2,
        direction: UP,
        spread: 1.6,
        speed: [0.5, 2.5],
        life: [0.3, 0.7],
        size: [0.03, 0.09],
        sizeEnd: 0.2,
        colorA: col(b.colorSheath),
        colorB: col(b.colorOuter),
        gravity: -2,
        drag: 2.2,
        birth: now,
      });
    }
  }

  end(inst) {
    inst.orb.visible = false;
    inst.core.mesh.visible = false;
    inst.sheath.mesh.visible = false;
    inst.outer.mesh.visible = false;
    inst.ribbons.visible = false;
    inst.burn = null;
    this.particles.dropRate(`nova-${inst.id}-mote`);
    this.particles.dropRate(`nova-${inst.id}-spray`);
    this.particles.dropRate(`nova-${inst.id}-drip`);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
