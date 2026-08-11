import * as THREE from 'three';
import { clamp, damp, TAU } from '../utils/math.js';

/**
 * Orbit rig with additive trauma shake. The shake is applied after the smoothed
 * orbit so a hit never fights the damping, and it decays on wall time so a
 * paused frame stays perfectly still.
 */
export class CameraRig {
  constructor(settings) {
    this.settings = settings;
    const c = settings.camera;

    this.camera = new THREE.PerspectiveCamera(c.fov, 1, 0.1, 400);
    this.target = new THREE.Vector3(c.target.x, c.target.y, c.target.z);

    this.azimuth = c.azimuth;
    this.polar = c.polar;
    this.distance = c.distance;

    this._azimuth = this.azimuth;
    this._polar = this.polar;
    this._distance = this.distance;

    this.trauma = 0;
    this.traumaDecay = 1.5;
    this._shake = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._seed = Math.random() * 1000;
  }

  orbit(dx, dy) {
    const c = this.settings.camera;
    this.azimuth -= dx * c.orbitSpeed;
    this.polar = clamp(this.polar - dy * c.orbitSpeed, c.minPolar, c.maxPolar);
    if (this.azimuth > TAU) this.azimuth -= TAU;
    if (this.azimuth < -TAU) this.azimuth += TAU;
  }

  zoom(delta) {
    const c = this.settings.camera;
    this.distance = clamp(this.distance + delta * c.zoomSpeed * this.distance, c.minDistance, c.maxDistance);
  }

  /** `amount` is 0..1; trauma accumulates and is squared on read. */
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, wallTime) {
    const c = this.settings.camera;
    this.camera.fov = c.fov;

    this._azimuth = damp(this._azimuth, this.azimuth, c.damping, dt);
    this._polar = damp(this._polar, this.polar, c.damping, dt);
    this._distance = damp(this._distance, this.distance, c.damping, dt);

    const sinP = Math.sin(this._polar);
    this._offset.set(
      sinP * Math.sin(this._azimuth),
      Math.cos(this._polar),
      sinP * Math.cos(this._azimuth)
    ).multiplyScalar(this._distance);

    this.target.set(c.target.x, c.target.y, c.target.z);
    this.camera.position.copy(this.target).add(this._offset);

    // Trauma is squared so small hits stay subtle and big ones really land.
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    const s = this.trauma * this.trauma;
    if (s > 0.0001) {
      const t = (wallTime + this._seed) * 34;
      this._shake.set(
        Math.sin(t * 1.13) * Math.sin(t * 0.37),
        Math.sin(t * 1.71 + 1.4) * Math.sin(t * 0.53),
        Math.sin(t * 0.97 + 2.6) * Math.sin(t * 0.41)
      ).multiplyScalar(s * 0.42);
      this.camera.position.add(this._shake);
    }

    this.camera.lookAt(this.target);
    if (s > 0.0001) this.camera.rotateZ(Math.sin((wallTime + this._seed) * 26) * s * 0.035);

    this.camera.updateProjectionMatrix();
  }
}
