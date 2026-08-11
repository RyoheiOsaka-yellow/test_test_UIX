/**
 * settings.js — the single source of truth.
 *
 * Nothing in the sandbox holds a hard-coded number that an artist would want to
 * push. Materials read these objects every frame through their uniform sync, so
 * a slider moved while the simulation is paused still repaints the frozen
 * frame. That is the whole point of the project.
 */

export const settings = {
  /* ------------------------------------------------------------ stage ---- */

  renderer: {
    exposure: 1.05,
    shadows: true,
    maxPixelRatio: 2,
    antialias: true,
  },

  post: {
    enabled: true,
    bloomStrength: 0.44,
    bloomRadius: 0.62,
    bloomThreshold: 0.82,
    grade: true,
    contrast: 1.06,
    saturation: 1.12,
    lift: -0.006,
    vignette: 0.42,
    chromatic: 0.0016,
    grain: 0.028,
    distortionAmount: 0.0,
  },

  camera: {
    fov: 46,
    distance: 20.5,
    height: 7.4,
    azimuth: 0.62,
    polar: 1.02,
    minPolar: 0.22,
    maxPolar: 1.46,
    minDistance: 6,
    maxDistance: 42,
    damping: 7.5,
    target: { x: 0, y: 1.6, z: 0 },
    orbitSpeed: 0.0042,
    zoomSpeed: 0.0016,
  },

  world: {
    fogColor: '#070a11',
    fogNear: 26,
    fogFar: 78,
    ambient: '#1a2740',
    ambientIntensity: 0.55,
    keyColor: '#9fc4ff',
    keyIntensity: 1.35,
    keyAngle: 2.35,
    keyHeight: 14,
    rimColor: '#4b7ac0',
    rimIntensity: 1.1,
    fillColor: '#2a3b5c',
    fillIntensity: 0.42,
  },

  ground: {
    size: 120,
    baseColor: '#0d131d',
    crackColor: '#060a10',
    grainColor: '#1b2739',
    tileScale: 0.42,
    grainScale: 6.2,
    roughness: 0.86,
    metalness: 0.02,
    gridStrength: 0.18,
    gridScale: 2.0,
    gridColor: '#1d3350',
    falloff: 0.6,
    reflect: 0.24,
  },

  dust: {
    enabled: true,
    count: 900,
    radius: 26,
    height: 9,
    size: 0.035,
    color: '#7fa8d8',
    opacity: 0.36,
    drift: 0.12,
    swirl: 0.09,
  },

  caster: {
    height: 1.82,
    color: '#101724',
    accent: '#5fd8ff',
    accentPower: 2.2,
    breathe: 0.035,
    breatheSpeed: 1.1,
    castLunge: 0.34,
    castWindup: 0.22,
    castRecover: 0.42,
    handHeight: 1.28,
    handForward: 0.55,
  },

  /* ------------------------------------------------------------- aim ---- */

  aim: {
    color: '#6fd6ff',
    invalidColor: '#ff5a52',
    width: 1.35,
    edgeWidth: 0.06,
    fill: 0.14,
    glow: 0.55,
    arrowLength: 2.1,
    arrowWidth: 1.9,
    chevrons: 6,
    chevronSpeed: 1.35,
    chevronSharpness: 5.0,
    pulseSpeed: 2.4,
    pulseDepth: 0.18,
    fadeIn: 0.09,
    height: 0.028,
    zone: {
      rimWidth: 0.34,
      rimGlow: 0.9,
      fill: 0.09,
      innerRing: 0.62,
      ticks: 48,
      tickLength: 0.22,
      spinSpeed: 0.35,
    },
  },

  /* -------------------------------------------------------- particles ---- */

  particles: {
    budget: 60000,
    softness: 0.55,
    globalScale: 1.0,
    globalOpacity: 1.0,
  },

  /* ------------------------------------------------------- abilities ---- */

  abilities: {
    /* ---------------------------------------------------- Q — Frost ---- */
    frost: {
      label: 'Frost Lance',
      key: 'Q',
      aimMode: 'line',
      range: 12.5,
      minRange: 2.2,
      cooldown: 0.85,
      castTime: 0.16,
      duration: 3.6,

      front: {
        speed: 26,
        width: 1.5,
        thickness: 0.4,
        glow: 1.5,
        color: '#cdf4ff',
      },

      crystals: {
        count: 96,
        spread: 0.62,
        spreadGrowth: 1.75,
        sizeNear: 0.34,
        sizeFar: 1.32,
        sizeJitter: 0.42,
        heightScale: 2.35,
        tilt: 0.42,
        riseTime: 0.19,
        overshoot: 2.1,
        holdTime: 1.5,
        sinkTime: 0.9,
        clusterCount: 22,
        clusterRadius: 1.9,
        clusterScale: 1.35,
        segments: 6,
      },

      ice: {
        colorDeep: '#0d4f74',
        colorMid: '#57c8ee',
        colorEdge: '#e7fbff',
        rimPower: 2.4,
        rimStrength: 1.55,
        interiorScale: 3.4,
        interiorStrength: 0.55,
        opacity: 0.9,
        refraction: 0.16,
        sparkle: 0.4,
        sparkleScale: 13.0,
        emissive: 0.62,
      },

      decal: {
        radius: 1.9,
        radiusFar: 3.1,
        color: '#9fe8ff',
        opacity: 0.72,
        growTime: 0.3,
        fade: 1.9,
        rimeScale: 3.4,
        rimeSharp: 1.9,
        crackStrength: 0.62,
      },

      fx: {
        mistCount: 4,
        mistSize: 1.1,
        chipCount: 2,
        chipSpeed: 6.4,
        glitterCount: 3,
        impactMist: 60,
        impactChips: 34,
        impactGlitter: 80,
        shake: 0.32,
        flash: 0.1,
        lightIntensity: 26,
        lightColor: '#8ddcff',
        lightDecay: 0.5,
      },
    },

    /* ---------------------------------------------------- E — Storm ---- */
    storm: {
      label: 'Storm Lance',
      key: 'E',
      aimMode: 'line',
      range: 13.5,
      minRange: 2.0,
      cooldown: 0.7,
      castTime: 0.1,
      duration: 1.55,

      front: {
        speed: 62,
        headSize: 0.95,
        headGlow: 2.6,
      },

      bolt: {
        filaments: 7,
        segments: 96,
        width: 0.17,
        widthJitter: 0.55,
        chaos: 0.52,
        chaosScale: 1.5,
        chaosDetail: 3.4,
        chaosSpeed: 14.0,
        sag: 0.22,
        spiral: 0.42,
        taper: 0.55,
        restrikeRate: 15.0,
        restrikeDepth: 0.68,
        holdTime: 0.34,
        blowout: 0.28,
        colorCore: '#ffffff',
        colorMid: '#a9c8ff',
        colorEdge: '#7b4dff',
        intensity: 1.45,
      },

      shell: {
        radius: 2.05,
        thickness: 0.28,
        color: '#b6d4ff',
        opacity: 0.3,
        life: 0.5,
        rings: 3,
        noise: 0.42,
      },

      decal: {
        radius: 2.6,
        burnColor: '#c9d8ff',
        scorchColor: '#08090d',
        opacity: 0.5,
        branchScale: 5.4,
        branchSharp: 24.0,
        flicker: 8.0,
        burnFade: 0.9,
        scorchFade: 5.5,
        trailWidth: 0.85,
      },

      fx: {
        sparkRate: 240,
        sparkSpeed: 9.5,
        sparkLife: 0.55,
        sparkSize: 0.11,
        impactSparks: 220,
        smokeCount: 26,
        shake: 0.55,
        flash: 0.3,
        lightIntensity: 60,
        lightColor: '#b9caff',
        lightFlicker: 24.0,
      },
    },

    /* --------------------------------------------------- R — Cinder ---- */
    cinder: {
      label: 'Cinder Fall',
      key: 'R',
      aimMode: 'line',
      range: 13.0,
      minRange: 3.5,
      cooldown: 1.3,
      castTime: 0.24,
      duration: 6.5,

      flight: {
        speed: 13.5,
        arc: 4.6,
        spin: 3.2,
        radius: 0.52,
        detail: 3,
        craterCount: 9,
        craterDepth: 0.3,
        fractureCount: 5,
        fractureDepth: 0.16,
      },

      rock: {
        colorCold: '#1b1310',
        colorHot: '#ff6a1e',
        colorCore: '#ffe6a3',
        seamScale: 3.1,
        seamWidth: 0.2,
        seamGrowth: 2.4,
        emissive: 2.6,
        roughness: 0.92,
        rimHeat: 0.75,
      },

      wake: {
        length: 3.4,
        radius: 0.95,
        steps: 24,
        density: 1.35,
        noiseScale: 1.9,
        noiseSpeed: 2.4,
        rise: 1.15,
        colorInner: '#fff0c0',
        colorMid: '#ff7a1c',
        colorOuter: '#5a1602',
        absorption: 1.45,
      },

      impact: {
        blastRadius: 4.6,
        blastSpeed: 12.0,
        blastThickness: 0.65,
        chunkCount: 34,
        chunkSpeed: 9.5,
        chunkSpin: 9.0,
        chunkSize: 0.34,
        chunkBounce: 0.34,
        craterRadius: 3.4,
        crackReach: 5.2,
        crackWidth: 0.055,
        crackScale: 1.35,
        crackColor: '#ff7420',
        crackCoreColor: '#ffe7b4',
        scorchColor: '#0a0705',
        glowFade: 4.6,
        scorchFade: 6.5,
      },

      fx: {
        trailEmbers: 150,
        trailSmoke: 42,
        impactEmbers: 320,
        impactSmoke: 90,
        emberSpeed: 7.5,
        emberLife: 1.9,
        smokeLife: 3.1,
        smokeSize: 2.6,
        shake: 0.95,
        flash: 0.45,
        lightIntensity: 90,
        lightColor: '#ff8a34',
        lightFade: 2.4,
      },
    },

    /* ----------------------------------------------------- F — Nova ---- */
    nova: {
      label: 'Nova Beam',
      key: 'F',
      aimMode: 'line',
      range: 15.0,
      minRange: 2.5,
      cooldown: 2.2,
      castTime: 0.62,
      duration: 4.4,

      windup: {
        time: 0.62,
        radius: 0.42,
        moteCount: 220,
        moteRadius: 3.2,
        moteSize: 0.09,
        coreColor: '#fff8e0',
        haloColor: '#8fe9ff',
        pulse: 9.0,
      },

      beam: {
        growTime: 0.14,
        holdTime: 1.35,
        collapseTime: 0.55,
        radiusCore: 0.16,
        radiusSheath: 0.38,
        radiusOuter: 0.7,
        segments: 128,
        radial: 24,
        swell: 0.38,
        swellFreq: 3.4,
        flowSpeed: 5.2,
        noiseScale: 2.2,
        colorCore: '#ffffff',
        colorSheath: '#6fe6ff',
        colorOuter: '#2b6cff',
        intensity: 0.85,
        sheathOpacity: 0.3,
        outerOpacity: 0.1,
      },

      ribbons: {
        count: 4,
        turns: 3.2,
        radius: 0.72,
        width: 0.11,
        speed: 2.4,
        color: '#ffd98a',
        intensity: 1.5,
        taper: 0.4,
      },

      discs: {
        count: 7,
        radius: 1.15,
        thickness: 0.11,
        speed: 11.0,
        color: '#dff6ff',
        intensity: 1.3,
      },

      decal: {
        width: 1.5,
        color: '#9ee9ff',
        coreColor: '#fffbe8',
        opacity: 0.45,
        fade: 2.6,
        scorchFade: 4.4,
        noiseScale: 2.8,
      },

      fx: {
        sprayRate: 260,
        spraySpeed: 8.0,
        sprayLife: 0.85,
        impactSpray: 260,
        shake: 0.6,
        flash: 0.55,
        lightIntensity: 120,
        lightColor: '#bff0ff',
      },
    },

    /* ---------------------------------------------------- V — Snare ---- */
    snare: {
      label: 'Voltaic Snare',
      key: 'V',
      aimMode: 'zone',
      range: 11.0,
      minRange: 0.0,
      radius: 3.6,
      cooldown: 1.6,
      castTime: 0.18,
      duration: 4.8,

      leash: {
        speed: 30.0,
        width: 0.13,
        chaos: 0.34,
        chaosSpeed: 12.0,
        segments: 72,
        color: '#c69bff',
        intensity: 1.4,
      },

      snap: {
        overshoot: 1.28,
        snapTime: 0.26,
        settleTime: 0.34,
        rimWidth: 0.2,
        rimIntensity: 2.6,
      },

      column: {
        radius: 0.85,
        height: 5.4,
        flare: 1.55,
        segments: 40,
        radial: 22,
        noiseScale: 2.6,
        flowSpeed: 3.4,
        colorCore: '#f0e2ff',
        colorMid: '#a45cff',
        colorEdge: '#3d17a8',
        intensity: 1.6,
        opacity: 0.5,
      },

      tendrils: {
        count: 9,
        segments: 48,
        width: 0.09,
        wander: 0.55,
        crawlTime: 0.42,
        restrike: 6.5,
        color: '#c9a2ff',
        intensity: 1.4,
      },

      arcs: {
        count: 5,
        width: 0.08,
        speed: 2.2,
        lift: 0.55,
        color: '#e2ccff',
        intensity: 1.6,
      },

      disc: {
        color: '#a05cff',
        rimColor: '#e8d6ff',
        opacity: 0.45,
        noiseScale: 3.2,
        churn: 1.4,
        fade: 1.1,
      },

      fx: {
        sparkRate: 190,
        sparkSpeed: 5.5,
        haulRate: 130,
        haulSpeed: 6.5,
        shake: 0.4,
        flash: 0.22,
        lightIntensity: 55,
        lightColor: '#b779ff',
      },
    },

    /* -------------------------------------------------- C — Glacier ---- */
    glacier: {
      label: 'Glacier Crown',
      key: 'C',
      aimMode: 'zone',
      range: 10.5,
      minRange: 0.0,
      radius: 4.2,
      cooldown: 2.6,
      castTime: 0.3,
      duration: 6.2,

      crown: {
        shards: 16,
        rings: 2,
        innerScale: 0.55,
        height: 4.6,
        heightJitter: 0.42,
        thickness: 0.62,
        lean: 0.34,
        twist: 0.28,
        riseTime: 0.42,
        riseStagger: 0.24,
        overshoot: 1.55,
        holdTime: 2.6,
        sinkTime: 1.3,
        segments: 7,
      },

      spire: {
        enabled: true,
        height: 6.8,
        radius: 1.05,
        riseTime: 0.55,
        overshoot: 1.25,
        twist: 0.55,
      },

      ice: {
        colorDeep: '#0a3f68',
        colorMid: '#4fbfe8',
        colorEdge: '#eafcff',
        rimPower: 2.6,
        rimStrength: 1.7,
        interiorScale: 2.4,
        interiorStrength: 0.62,
        opacity: 0.92,
        refraction: 0.18,
        sparkle: 0.45,
        sparkleScale: 11.0,
        emissive: 0.58,
      },

      shock: {
        speed: 9.0,
        width: 0.85,
        color: '#cdf2ff',
        intensity: 1.6,
      },

      decal: {
        color: '#a8ecff',
        opacity: 0.8,
        growTime: 0.45,
        fade: 3.2,
        rimeScale: 2.6,
        rimeSharp: 2.2,
        shatterRings: 3,
      },

      fx: {
        mistCount: 90,
        chipCount: 60,
        glitterCount: 120,
        mistSize: 1.4,
        chipSpeed: 8.5,
        shake: 0.72,
        flash: 0.26,
        lightIntensity: 48,
        lightColor: '#9fe4ff',
      },
    },
  },
};

/** Deep clone used by the editor's reset. */
export function cloneSettings(source = settings) {
  return structuredClone(source);
}

/** The pristine values, captured before any slider has been touched. */
export const defaultSettings = cloneSettings(settings);

/** Deep-assign `patch` into `target` in place, keeping object identity. */
export function applyPatch(target, patch) {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      applyPatch(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export const abilityOrder = ['frost', 'storm', 'cinder', 'nova', 'snare', 'glacier'];
