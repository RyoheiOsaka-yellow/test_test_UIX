import * as THREE from 'three';
import { FrostLance } from './FrostLance.js';
import { StormLance } from './StormLance.js';
import { CinderFall } from './CinderFall.js';
import { NovaBeam } from './NovaBeam.js';
import { VoltaicSnare } from './VoltaicSnare.js';
import { GlacierCrown } from './GlacierCrown.js';
import { abilityOrder } from '../config/settings.js';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * Arming, cooldowns and dispatch.
 *
 * Cooldowns are per ability, so spending one slot never locks another out, and
 * `minRange` is enforced here rather than in the indicator — the arrow turning
 * red and the cast being refused are the same rule read twice.
 */
export class AbilityManager extends EventEmitter {
  constructor(context) {
    super();
    this.ctx = context;
    this.settings = context.settings;

    this.abilities = {
      frost: new FrostLance(context),
      storm: new StormLance(context),
      cinder: new CinderFall(context),
      nova: new NovaBeam(context),
      snare: new VoltaicSnare(context),
      glacier: new GlacierCrown(context),
    };

    this.order = abilityOrder;
    this.armedKey = null;
    this.cooldowns = Object.fromEntries(this.order.map((k) => [k, 0]));

    this._origin = new THREE.Vector3();
    this._shot = {
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      point: new THREE.Vector3(),
      distance: 0,
    };
  }

  /** The armed ability's settings block, or null. */
  get armed() {
    return this.armedKey ? this.settings.abilities[this.armedKey] : null;
  }

  keyFor(code) {
    // Both the letter and the slot number arm a slot.
    const letters = { KeyQ: 'frost', KeyE: 'storm', KeyR: 'cinder', KeyF: 'nova', KeyV: 'snare', KeyC: 'glacier' };
    if (letters[code]) return letters[code];
    const digit = /^Digit([1-6])$/.exec(code);
    if (digit) return this.order[Number(digit[1]) - 1];
    return null;
  }

  arm(key) {
    if (!key || !this.abilities[key]) return;
    this.armedKey = this.armedKey === key ? null : key;
    this.emit('armed', this.armedKey);
  }

  cancel() {
    if (!this.armedKey) return;
    this.armedKey = null;
    this.emit('armed', null);
  }

  ready(key) {
    return (this.cooldowns[key] ?? 0) <= 0;
  }

  /**
   * @param {AimController} aim
   * @returns {boolean} whether a cast actually went out
   */
  tryCast(aim) {
    const key = this.armedKey;
    if (!key) return false;
    if (!this.ready(key)) return false;
    if (!aim.valid) return false;

    const ability = this.abilities[key];
    const s = this.settings.abilities[key];
    const caster = this.ctx.caster;

    caster.face(aim.direction);
    caster.playCast(1);

    // The eased yaw is applied in update(), which has not run for this frame
    // yet. Snap it so the shot actually leaves the hand it looks like it does.
    caster.root.rotation.y = caster.facing;
    caster.root.updateMatrixWorld(true);
    caster.getCastOrigin(aim.direction, this._shot.origin);
    this._shot.direction.copy(aim.direction);
    this._shot.point.copy(aim.point);
    this._shot.distance =
      s.aimMode === 'zone'
        ? Math.max(aim.distance, 0.001)
        : s.range;

    // The visual shot starts at the hand, so its length is measured from there.
    if (s.aimMode !== 'zone') {
      this._shot.point
        .copy(this._shot.origin)
        .addScaledVector(this._shot.direction, s.range)
        .setY(0);
      this._shot.distance = s.range;
    }

    ability.cast(this._shot);
    this.cooldowns[key] = s.cooldown;
    this.emit('cast', key);

    // Firing puts the ability away, the way a skillshot does.
    this.armedKey = null;
    this.emit('armed', null);
    return true;
  }

  update(dt, wallDt) {
    for (const key of this.order) {
      if (this.cooldowns[key] > 0) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - wallDt);
      this.abilities[key].update(dt);
    }
  }

  sync() {
    for (const key of this.order) this.abilities[key].sync();
  }

  clear() {
    for (const key of this.order) this.abilities[key].clear();
  }
}
