import * as THREE from 'three';
import { commonGLSL } from '../shaders/lib/common.glsl.js';
import { noiseGLSL } from '../shaders/lib/noise.glsl.js';
import { clamp01, damp, easeOutBack, easeOutCubic, lerp, smoothstep } from '../utils/math.js';
import { frame } from '../core/FrameUniforms.js';

/**
 * The caster.
 *
 * No FBX, no rig, no baked clips: the figure is a hierarchy of capsules and the
 * animation is a hand-written pose function evaluated every frame. Idle is a
 * breath cycle plus a weight shift; the cast is a three-beat curve — coil,
 * throw, recover — that the abilities read the hand position out of.
 */
export class Caster {
  constructor(scene, settings) {
    this.settings = settings;
    this.root = new THREE.Group();
    this.root.name = 'caster';
    scene.add(this.root);

    this.facing = 0;
    this._facing = 0;
    this.castT = -1;
    this.castStrength = 1;

    this.material = this._buildMaterial();
    this._buildSkeleton();

    this._handWorld = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  _buildMaterial() {
    const c = this.settings.caster;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(c.color),
      roughness: 0.52,
      metalness: 0.62,
      envMapIntensity: 0.9,
    });

    this.casterUniforms = {
      uAccent: { value: new THREE.Color(c.accent) },
      uAccentPower: { value: c.accentPower },
      uCharge: { value: 0 },
      uTime: frame.uTime,
    };

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.casterUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n varying vec3 vLocalPos;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vLocalPos = position;`);

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           ${noiseGLSL}
           ${commonGLSL}
           varying vec3 vLocalPos;
           uniform vec3 uAccent;
           uniform float uAccentPower;
           uniform float uCharge;
           uniform float uTime;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           {
             /* Seams that run around the shell, brightening as a cast charges. */
             float band = es_fbm3(vLocalPos * 5.5, 3, 2.1, 0.5);
             float seam = smoothstep(0.52, 0.58, band) * (1.0 - smoothstep(0.66, 0.74, band));
             float rim = es_fresnel(normal, normalize(vViewPosition), uAccentPower);
             float pulseAmt = 0.55 + 0.45 * sin(uTime * 2.2 + vLocalPos.y * 3.0);
             totalEmissiveRadiance +=
               uAccent * (seam * (0.35 + 2.6 * uCharge) * pulseAmt + rim * (0.28 + 1.6 * uCharge));
           }`
        );
    };

    return material;
  }

  _limb(radius, length) {
    const geo = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.01), 4, 10);
    geo.translate(0, -length * 0.5, 0); // pivot at the top of the limb
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true;
    return mesh;
  }

  _buildSkeleton() {
    const h = this.settings.caster.height;
    const s = h / 1.82; // every measurement below is authored against a 1.82 m figure

    const group = (parent, y = 0, z = 0, x = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    this.body = group(this.root);

    // --- spine -------------------------------------------------------------
    this.hips = group(this.body, 0.94 * s);
    const pelvis = this._limb(0.17 * s, 0.26 * s);
    pelvis.position.y = 0.1 * s;
    this.hips.add(pelvis);

    this.chest = group(this.hips, 0.1 * s);
    const torso = this._limb(0.2 * s, 0.56 * s);
    torso.position.y = 0.52 * s;
    torso.scale.set(1.05, 1, 0.78);
    this.chest.add(torso);

    this.neck = group(this.chest, 0.54 * s);
    this.head = group(this.neck, 0.06 * s);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.135 * s, 1), this.material);
    skull.position.y = 0.09 * s;
    skull.scale.set(0.92, 1.12, 1.0);
    skull.castShadow = true;
    this.head.add(skull);

    // A single lit eye-slit so the silhouette reads as facing somewhere.
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.17 * s, 0.022 * s, 0.02 * s),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(this.settings.caster.accent) })
    );
    visor.position.set(0, 0.09 * s, 0.125 * s);
    this.visorMaterial = visor.material;
    this.head.add(visor);

    // --- arms --------------------------------------------------------------
    const buildArm = (side) => {
      const shoulder = group(this.chest, 0.48 * s, 0, 0.22 * s * side);
      const upper = this._limb(0.072 * s, 0.3 * s);
      shoulder.add(upper);
      const elbow = group(shoulder, -0.3 * s);
      const fore = this._limb(0.058 * s, 0.28 * s);
      elbow.add(fore);
      const wrist = group(elbow, -0.28 * s);
      const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 * s, 0), this.material);
      hand.castShadow = true;
      wrist.add(hand);
      return { shoulder, elbow, wrist, hand };
    };

    this.armL = buildArm(1);
    this.armR = buildArm(-1);

    // --- legs --------------------------------------------------------------
    const buildLeg = (side) => {
      const hip = group(this.hips, 0, 0, 0.11 * s * side);
      const thigh = this._limb(0.095 * s, 0.46 * s);
      hip.add(thigh);
      const knee = group(hip, -0.46 * s);
      const shin = this._limb(0.075 * s, 0.44 * s);
      knee.add(shin);
      const ankle = group(knee, -0.44 * s);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.11 * s, 0.06 * s, 0.24 * s),
        this.material
      );
      foot.position.set(0, -0.03 * s, 0.05 * s);
      foot.castShadow = true;
      ankle.add(foot);
      return { hip, knee, ankle };
    };

    this.legL = buildLeg(1);
    this.legR = buildLeg(-1);

    // A hand-held anchor the abilities spawn from.
    this.castAnchor = new THREE.Object3D();
    this.armR.wrist.add(this.castAnchor);
  }

  /** Point the figure at a world-space direction (XZ only). */
  face(direction) {
    this.facing = Math.atan2(direction.x, direction.z);
  }

  /** Kick off the cast animation. `strength` scales the lunge. */
  playCast(strength = 1) {
    this.castT = 0;
    this.castStrength = strength;
  }

  /** World position of the throwing hand — where a bolt actually leaves from. */
  getHandPosition(out = new THREE.Vector3()) {
    this.armR.hand.getWorldPosition(out);
    return out;
  }

  update(dt, wallTime, charge = 0) {
    const c = this.settings.caster;

    // Yaw eases toward the aim so a fast mouse swing does not snap the model.
    let delta = this.facing - this._facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this._facing = damp(this._facing, this._facing + delta, 9, dt);
    this.root.rotation.y = this._facing;

    // --- idle --------------------------------------------------------------
    const b = wallTime * c.breatheSpeed;
    const breath = Math.sin(b) * c.breathe;
    const sway = Math.sin(b * 0.47) * 0.03;

    this.chest.rotation.set(breath * 0.5, sway * 0.5, 0);
    this.chest.scale.setScalar(1 + breath * 0.4);
    this.hips.position.y = 0.94 * (c.height / 1.82) + breath * 0.05;
    this.hips.rotation.z = sway * 0.4;
    this.neck.rotation.set(-breath * 0.4, -sway, 0);

    const armIdle = Math.sin(b * 0.9) * 0.06;
    const setArm = (arm, side, pitch, spread, elbow) => {
      arm.shoulder.rotation.set(pitch, 0, spread * side);
      arm.elbow.rotation.set(elbow, 0, 0);
    };
    setArm(this.armL, 1, armIdle * 0.4, -0.16 + armIdle * 0.2, -0.36 - armIdle * 0.3);
    setArm(this.armR, -1, armIdle * 0.4, -0.16 - armIdle * 0.2, -0.36 - armIdle * 0.3);

    const stance = 0.06;
    this.legL.hip.rotation.set(-stance, 0, -0.06);
    this.legR.hip.rotation.set(stance, 0, 0.06);
    this.legL.knee.rotation.x = 0.14;
    this.legR.knee.rotation.x = 0.1;

    // --- cast overlay ------------------------------------------------------
    if (this.castT >= 0) {
      const total = c.castWindup + c.castRecover;
      this.castT += dt;
      const t = this.castT;

      let coil = 0; // 0..1 pulling back
      let throwT = 0; // 0..1 driving forward
      if (t < c.castWindup) {
        coil = easeOutCubic(clamp01(t / c.castWindup));
      } else {
        coil = 1 - clamp01((t - c.castWindup) / 0.09);
        throwT = clamp01((t - c.castWindup) / c.castRecover);
      }

      const punch = throwT > 0 ? Math.max(0, easeOutBack(throwT, 1.4) * (1 - throwT * throwT)) : 0;
      const amount = this.castStrength;

      // Coil back, then drive the whole body through the throw.
      const lean = (-coil * 0.26 + punch * 0.34) * amount;
      this.chest.rotation.x += lean;
      this.hips.rotation.x = lean * 0.35;
      this.body.position.z = punch * c.castLunge * amount;
      this.neck.rotation.x -= lean * 0.4;

      // Right arm throws, left arm counterbalances.
      const shoulderPitch = (coil * 1.15 - punch * 1.95) * amount;
      this.armR.shoulder.rotation.x += shoulderPitch;
      this.armR.shoulder.rotation.z += (coil * 0.5 - punch * 0.2) * amount * -1;
      this.armR.elbow.rotation.x += (-coil * 1.5 + punch * 1.3) * amount;

      this.armL.shoulder.rotation.x += (coil * 0.5 - punch * 0.6) * amount;
      this.armL.shoulder.rotation.z += (coil * 0.4) * amount;
      this.armL.elbow.rotation.x += (-coil * 1.0 + punch * 0.5) * amount;

      // Weight transfers onto the front foot.
      this.legR.hip.rotation.x += (coil * 0.28 - punch * 0.5) * amount;
      this.legL.hip.rotation.x += (-coil * 0.22 + punch * 0.42) * amount;
      this.legL.knee.rotation.x += punch * 0.35 * amount;

      if (t > total) this.castT = -1;
    }

    // --- accents -----------------------------------------------------------
    const glow = Math.max(charge, this.castT >= 0 ? smoothstep(0, 0.2, this.castT) * 0.6 : 0);
    this.casterUniforms.uCharge.value = damp(
      this.casterUniforms.uCharge.value,
      glow,
      12,
      dt
    );
    this.casterUniforms.uAccent.value.set(c.accent);
    this.casterUniforms.uAccentPower.value = c.accentPower;
    this.visorMaterial.color.set(c.accent);
    this.material.color.set(c.color);
  }

  /** Where a line cast should start: chest height, a little in front. */
  getCastOrigin(direction, out = new THREE.Vector3()) {
    const c = this.settings.caster;
    this.getHandPosition(out);
    if (direction) {
      this._tmp.copy(direction).setY(0).normalize().multiplyScalar(c.handForward * 0.4);
      out.add(this._tmp);
    }
    out.y = lerp(out.y, c.handHeight, 0.35);
    return out;
  }
}
