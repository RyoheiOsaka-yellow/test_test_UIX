import GUI from 'lil-gui';
import { abilityOrder, applyPatch, defaultSettings } from '../config/settings.js';

/**
 * The VFX editor.
 *
 * Rather than hand-authoring a control per parameter, the editor walks
 * `settings` and binds *everything* it finds: numbers become sliders, `#rrggbb`
 * strings become colour pickers, booleans become checkboxes. Adding a parameter
 * to the config is all it takes to get a slider for it.
 *
 * Ranges are inferred from the shipped value — a parameter authored at 0.3 gets
 * a range that lets you push it to about 1, not to 100 — with explicit
 * overrides for the handful where that guess would be wrong.
 */

/** Explicit ranges: [min, max, step]. Matched on the leaf key name. */
const RANGES = {
  exposure: [0.2, 3, 0.01],
  maxPixelRatio: [0.5, 3, 0.5],
  bloomStrength: [0, 3, 0.01],
  bloomRadius: [0, 2, 0.01],
  bloomThreshold: [0, 1, 0.005],
  contrast: [0.5, 2, 0.005],
  saturation: [0, 2.5, 0.005],
  lift: [-0.2, 0.2, 0.001],
  vignette: [0, 1.5, 0.005],
  chromatic: [0, 0.02, 0.0001],
  grain: [0, 0.2, 0.001],
  distortionAmount: [-0.3, 0.3, 0.001],

  fov: [20, 100, 0.5],
  distance: [4, 60, 0.1],
  azimuth: [-Math.PI, Math.PI, 0.01],
  polar: [0.05, 1.55, 0.005],
  damping: [0.5, 30, 0.1],

  fogNear: [0, 120, 0.5],
  fogFar: [1, 240, 0.5],
  size: [20, 400, 1],

  opacity: [0, 1, 0.005],
  roughness: [0, 1, 0.005],
  metalness: [0, 1, 0.005],
  refraction: [0, 1, 0.005],
  sparkle: [0, 2, 0.005],
  emissive: [0, 6, 0.01],

  range: [2, 40, 0.1],
  minRange: [0, 20, 0.1],
  radius: [0.2, 14, 0.05],
  cooldown: [0, 8, 0.01],
  castTime: [0, 2, 0.01],
  duration: [0.2, 14, 0.05],

  shake: [0, 3, 0.01],
  flash: [0, 1, 0.005],
  globalOpacity: [0, 2, 0.01],
  globalScale: [0.1, 4, 0.01],
  softness: [0, 1, 0.005],
  budget: [4000, 200000, 1000],
};

/** Keys that only make sense as whole numbers. */
const INTEGER = new Set([
  'count', 'shards', 'rings', 'segments', 'radial', 'filaments', 'octaves',
  'steps', 'chevrons', 'ticks', 'clusterCount', 'chunkCount', 'moteCount',
  'craterCount', 'fractureCount', 'detail', 'shatterRings', 'budget',
]);

/** Parameters the geometry is built from — changing them needs a reload. */
const REBUILD = new Set(['segments', 'radial', 'detail', 'budget']);

function rangeFor(key, value) {
  const explicit = RANGES[key];
  if (explicit) return explicit;

  const mag = Math.abs(value);
  if (mag === 0) return [0, 1, 0.001];

  const max = Math.pow(10, Math.ceil(Math.log10(mag))) * (mag > Math.pow(10, Math.floor(Math.log10(mag))) * 3 ? 1 : 0.5);
  const hi = Math.max(max, mag * 2.5);
  const lo = value < 0 ? -hi : 0;
  const step = INTEGER.has(key) ? 1 : Math.max((hi - lo) / 1000, 1e-4);
  return [lo, hi, step];
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

const TITLES = {
  frost: 'Q — Frost Lance',
  storm: 'E — Storm Lance',
  cinder: 'R — Cinder Fall',
  nova: 'F — Nova Beam',
  snare: 'V — Voltaic Snare',
  glacier: 'C — Glacier Crown',
};

export class Editor {
  constructor(settings, actions = {}) {
    this.settings = settings;
    this.actions = actions;
    this.count = 0;

    this.gui = new GUI({ title: 'VFX editor', width: 322 });
    this.gui.domElement.style.setProperty('--width', '322px');

    const stage = this.gui.addFolder('Stage').close();
    this._bindGroup(stage.addFolder('Renderer').close(), settings.renderer);
    this._bindGroup(stage.addFolder('Post').close(), settings.post);
    this._bindGroup(stage.addFolder('Camera').close(), settings.camera);
    this._bindGroup(stage.addFolder('Lighting').close(), settings.world);
    this._bindGroup(stage.addFolder('Ground').close(), settings.ground);
    this._bindGroup(stage.addFolder('Dust').close(), settings.dust);
    this._bindGroup(stage.addFolder('Caster').close(), settings.caster);

    const aim = this.gui.addFolder('Targeting').close();
    this._bindGroup(aim, settings.aim);

    const particles = this.gui.addFolder('Particles').close();
    this._bindGroup(particles, settings.particles);

    for (const key of abilityOrder) {
      const folder = this.gui.addFolder(TITLES[key] ?? key).close();
      this._bindGroup(folder, settings.abilities[key]);
    }

    const tools = this.gui.addFolder('Session');
    tools.add({ clear: () => actions.clear?.() }, 'clear').name('clear live effects  (X)');
    tools.add({ pause: () => actions.pause?.() }, 'pause').name('pause / resume  (P)');
    tools
      .add({ save: () => this.savePreset() }, 'save')
      .name('save preset to this browser');
    tools.add({ load: () => this.loadPreset() }, 'load').name('load saved preset');
    tools.add({ reset: () => this.reset() }, 'reset').name('reset everything');

    this.gui.title(`VFX editor — ${this.count} parameters`);
    this.visible = true;
  }

  /** Recursively bind an object, nesting a folder per sub-object. */
  _bindGroup(folder, object, depth = 0) {
    for (const key of Object.keys(object)) {
      const value = object[key];

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sub = folder.addFolder(prettify(key)).close();
        this._bindGroup(sub, value, depth + 1);
        continue;
      }

      if (isColor(value)) {
        folder.addColor(object, key).name(prettify(key));
        this.count++;
        continue;
      }

      if (typeof value === 'boolean') {
        folder.add(object, key).name(prettify(key));
        this.count++;
        continue;
      }

      if (typeof value === 'number') {
        const [lo, hi, step] = rangeFor(key, value);
        const ctrl = folder.add(object, key, lo, hi, step).name(prettify(key));
        if (REBUILD.has(key)) ctrl.name(`${prettify(key)} ⟳`);
        this.count++;
        continue;
      }

      // Strings that are not colours are labels (`label`, `key`, `aimMode`) and
      // are shown read-only so the folder still tells you what it controls.
      if (typeof value === 'string' && depth === 0) {
        folder.add(object, key).disable().name(prettify(key));
      }
    }
  }

  savePreset() {
    try {
      localStorage.setItem('elemental-sandbox:preset', JSON.stringify(this.settings));
      this.actions.notify?.('preset saved');
    } catch (err) {
      console.warn('[editor] could not save preset', err);
    }
  }

  loadPreset() {
    try {
      const raw = localStorage.getItem('elemental-sandbox:preset');
      if (!raw) return;
      applyPatch(this.settings, JSON.parse(raw));
      this.refresh();
      this.actions.notify?.('preset loaded');
    } catch (err) {
      console.warn('[editor] could not load preset', err);
    }
  }

  reset() {
    applyPatch(this.settings, defaultSettings);
    this.refresh();
  }

  refresh() {
    this.gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  toggle() {
    this.visible = !this.visible;
    this.gui.domElement.style.display = this.visible ? '' : 'none';
  }
}

function prettify(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
