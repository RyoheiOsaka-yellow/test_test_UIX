import * as THREE from 'three';
import { AimIndicator, ZoneIndicator } from '../effects/AimIndicator.js';

/**
 * Both targeting shapes and the rules that gate them.
 *
 * The cursor is projected onto the floor plane, not onto the ground mesh, so
 * aiming past the edge of the stage still resolves. A line cast keeps the
 * caster's own position and takes only the *direction* from the cursor, clamped
 * to the ability's range; a far cast takes the point itself, clamped to a disc.
 *
 * `minRange` is what makes the indicator turn red and refuse: an ability with a
 * minimum is one you cannot drop on your own feet.
 */
export class AimController {
  constructor(scene, camera, settings) {
    this.camera = camera;
    this.settings = settings;

    this.line = new AimIndicator(scene, settings);
    this.zone = new ZoneIndicator(scene, settings);

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.origin = new THREE.Vector3();
    this.cursor = new THREE.Vector3(0, 0, 10);
    this.direction = new THREE.Vector3(0, 0, 1);
    this.point = new THREE.Vector3(0, 0, 10);
    this.distance = 10;
    this.valid = true;
    this.ability = null;

    this._pointer = new THREE.Vector2();
    this._hit = new THREE.Vector3();
  }

  setPointer(p) {
    this._pointer.set(p.x, p.y);
  }

  /** Project the cursor onto the floor. Returns false if it points at the sky. */
  resolveCursor() {
    this.raycaster.setFromCamera(this._pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this._hit);
    if (!hit) return false;
    this.cursor.copy(this._hit);
    return true;
  }

  /**
   * @param {object|null} ability  the armed ability's settings block, or null
   * @param {THREE.Vector3} origin the caster's foot position
   */
  update(dt, ability, origin) {
    this.ability = ability;
    this.origin.copy(origin);
    this.resolveCursor();

    const armed = !!ability;
    const isZone = armed && ability.aimMode === 'zone';

    this.line.show(armed && !isZone);
    this.zone.show(armed && isZone);

    if (armed) {
      if (isZone) {
        // Clamp the circle's centre into a disc around the caster.
        this.point.copy(this.cursor).setY(0);
        const offset = this.point.clone().sub(origin).setY(0);
        const dist = offset.length();
        if (dist > ability.range) {
          offset.multiplyScalar(ability.range / dist);
          this.point.copy(origin).add(offset);
        }
        this.distance = Math.min(dist, ability.range);
        this.direction.copy(offset).setY(0);
        if (this.direction.lengthSq() < 1e-6) this.direction.set(0, 0, 1);
        this.direction.normalize();

        this.valid = this.distance >= ability.minRange;
        this.zone.set(this.point, ability.radius ?? 3, this.valid);
      } else {
        this.direction.copy(this.cursor).sub(origin).setY(0);
        const dist = this.direction.length();
        if (dist < 1e-4) this.direction.set(0, 0, 1);
        else this.direction.divideScalar(dist);

        this.distance = ability.range;
        this.point.copy(origin).addScaledVector(this.direction, ability.range).setY(0);

        // Aiming inside minRange is refused, and the arrow says so.
        this.valid = dist >= ability.minRange;
        this.line.set(origin, this.direction, ability.range, ability, this.valid);
      }
    }

    this.line.update(dt);
    this.zone.update(dt);
  }
}
