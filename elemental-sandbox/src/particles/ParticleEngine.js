import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem.js';

/**
 * Owns the five particle systems the whole sandbox shares and hands out
 * emission. Because every physical constant is per particle, an ability picks a
 * system for its *look* (hard spark, soft glow, eroded smoke, lit chip) and
 * supplies its own gravity, drag and palette at emit time.
 */
export class ParticleEngine {
  constructor(scene, settings) {
    this.settings = settings;
    this.scene = scene;

    const budget = settings.particles.budget;
    const share = (f) => Math.max(512, Math.round(budget * f));

    this.systems = {
      /** Hot filaments that lie along their own velocity. */
      spark: new ParticleSystem({
        capacity: share(0.24),
        shape: 'spark',
        additive: true,
        stretch: true,
        intensity: 1.0,
        fadeIn: 0.02,
        fadeOut: 0.6,
        renderOrder: 12,
      }),
      /** Soft round glows — glitter, motes, spray. */
      glow: new ParticleSystem({
        capacity: share(0.24),
        shape: 'round',
        additive: true,
        intensity: 0.8,
        fadeIn: 0.06,
        fadeOut: 0.5,
        renderOrder: 11,
      }),
      /** Additive eroded puffs — flame, ionised air, rime vapour. */
      fire: new ParticleSystem({
        capacity: share(0.16),
        shape: 'smoke',
        additive: true,
        intensity: 0.9,
        turbScale: 0.5,
        turbSpeed: 1.1,
        fadeIn: 0.1,
        fadeOut: 0.62,
        renderOrder: 10,
      }),
      /** Alpha-blended banks of smoke and mist. */
      smoke: new ParticleSystem({
        capacity: share(0.2),
        shape: 'smoke',
        additive: false,
        intensity: 0.42,
        turbScale: 0.28,
        turbSpeed: 0.42,
        fadeIn: 0.16,
        fadeOut: 0.55,
        renderOrder: 9,
      }),
      /** Solid debris — ice chips, rock shards. */
      chip: new ParticleSystem({
        capacity: share(0.1),
        shape: 'chip',
        additive: false,
        intensity: 0.8,
        fadeIn: 0.02,
        fadeOut: 0.28,
        depthWrite: true,
        renderOrder: 8,
      }),
    };

    for (const s of Object.values(this.systems)) scene.add(s.mesh);

    this._rates = new Map();
  }

  /** One-shot burst. */
  emit(system, count, spec) {
    this.systems[system]?.emit(count, spec);
  }

  /**
   * Rate emission with a persistent accumulator, so a 3-particle-per-frame
   * stream stays a 3-particle-per-frame stream at any framerate.
   *
   * @param {string} id      stable key for this emitter instance
   * @param {number} perSec  particles per second
   */
  emitRate(id, system, perSec, dt, spec) {
    if (dt <= 0 || perSec <= 0) return;
    const acc = (this._rates.get(id) ?? 0) + perSec * dt;
    const n = Math.floor(acc);
    this._rates.set(id, acc - n);
    if (n > 0) this.systems[system]?.emit(n, spec);
  }

  dropRate(id) {
    this._rates.delete(id);
  }

  flush() {
    for (const s of Object.values(this.systems)) s.flush();
  }

  clear() {
    for (const s of Object.values(this.systems)) s.clear();
    this._rates.clear();
  }

  dispose() {
    for (const s of Object.values(this.systems)) {
      this.scene.remove(s.mesh);
      s.dispose();
    }
  }
}

/** Colour cache — lil-gui hands out hex strings, shaders want linear Colors. */
const _cache = new Map();
export function col(hex) {
  let c = _cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    _cache.set(hex, c);
  }
  return c;
}
