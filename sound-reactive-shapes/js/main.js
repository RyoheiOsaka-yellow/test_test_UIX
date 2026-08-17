import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { buildEnvMapTexture } from './oklch-envmap.js';
import { AudioEngine, HIST, BINS } from './audio.js';

// ── Shape catalogue ─────────────────────────────────────────────────────────

const SDF_SHAPES = [
  'Sphere', 'Box', 'Round box', 'Box frame', 'Torus', 'Capped torus', 'Link',
  'Infinite cylinder', 'Cone', 'Infinite cone', 'Hex prism', 'Capsule',
  'Vertical capsule', 'Capped cylinder', 'Arb. cylinder', 'Rounded cylinder',
  'Capped cone', 'Arb. capped cone', 'Solid angle', 'Cut sphere',
  'Cut hollow sphere', 'Death star', 'Round cone', 'Arb. round cone',
  'Vesica segment', 'Rhombus', 'Octahedron', 'Octahedron (fast)', 'Pyramid',
  'Ellipsoid', 'Triangular prism',
];

const PLATONIC_PAIRS = [
  'Cube / Octahedron', 'Tetrahedron / Tetrahedron', 'Dodecahedron / Icosahedron',
];

const SCALAR_SURFACES = [
  'Elliptic paraboloid', 'Hyperbolic paraboloid', 'Cone', 'Sphere', 'Torus',
  'Hyperboloid', 'Monkey saddle', 'Sinusoidal surface', 'Radial damped cosine',
  'Ellipsoid',
];

const MOVING_SHAPES = [
  'Traveling radial damped cosine', 'Pulsing torus', 'Traveling sinusoidal surface',
  'Oscillating spheroid', 'Pulsing saddle', 'Pulsing gyroid',
  'Oscillating Schwarz P', 'Pulsing lemniscate', 'Tilting ellipsoid',
  'Pulsing tanglecube', 'Pulsing Chmutov T₄', 'Traveling sinusoidal cone',
  'Pulsing Gaussian', 'Oscillating Schoen I-WP', 'Tilting saddle',
  'Rotating torus', 'Rotating harmonic sphere', 'Traveling hyperboloid',
  'Pulsing cyclic cubic', 'Rotating paraboloid',
];

const CATEGORY_SHAPES = {
  sdf: SDF_SHAPES, platonic: PLATONIC_PAIRS, scalar: SCALAR_SURFACES, moving: MOVING_SHAPES,
};

const FORM_MODES = [
  'Spectral fan', 'Interference rings', 'Spectrogram cylinder', 'Spectral tube',
  'Waveform sphere', 'Harmonic rings', 'Spectrogram cone', 'Spectral terrain',
  'Spectral helix', 'Spectral ribbon',
];

// Deformation modes grouped the way the source article groups them.
const SECTION_MODES = {
  amplitude: [
    { id: 1, name: 'Radial expansion' },
    { id: 2, name: 'Axial compression' },
    { id: 3, name: 'Normal extrusion' },
  ],
  history: [
    { id: 4, name: 'Radial displacement' },
    { id: 5, name: 'Banded displacement' },
    { id: 6, name: 'Axial rotation' },
  ],
  frequency: [
    { id: 7, name: 'Spectral displacement' },
    { id: 8, name: 'Spectral contours' },
    { id: 9, name: 'Spectral shear' },
  ],
};

// Which sliders each mode exposes, and the default each one starts at.
const MODE_PARAMS = {
  1: [['p1', 'Intensity', 0, 2, 0.01, 0.38]],
  2: [['p1', 'Width', 0, 4, 0.02, 0.38], ['p2', 'Height', 0, 4, 0.02, 0.55]],
  3: [['p1', 'Intensity', 0, 2, 0.01, 0.55]],
  4: [['p1', 'Intensity', 0, 2, 0.01, 0.60], ['dur', 'Duration', 0.05, 1, 0.01, 1.0],
      ['soft', 'Soften', 0, 1, 0.01, 0.0]],
  5: [['p1', 'Intensity', 0, 2, 0.01, 0.55], ['dur', 'Duration', 0.05, 1, 0.01, 1.0],
      ['soft', 'Soften', 0, 1, 0.01, 0.0]],
  6: [['p1', 'Angle', 0, 2, 0.01, 0.70], ['dur', 'Duration', 0.05, 1, 0.01, 1.0],
      ['soft', 'Soften', 0, 1, 0.01, 0.0], ['twx', 'Twist X', -1, 1, 0.01, 0.0],
      ['twz', 'Twist Z', -1, 1, 0.01, 0.0]],
  7: [['p1', 'Intensity', 0, 2, 0.01, 0.70]],
  8: [['p1', 'Intensity', 0, 2, 0.01, 0.55], ['ctrl', 'Bands', 2, 8, 1, 2]],
  9: [['p1', 'Intensity', 0, 3, 0.01, 1.20]],
  form: [['int', 'Intensity', 0, 3, 0.05, 1.0]],
};

const PARAM_UNIFORM = {
  p1: 'u_deformP1', p2: 'u_deformP2', dur: 'u_histDuration', soft: 'u_histSoften',
  twx: 'u_twistAxisX', twz: 'u_twistAxisZ', ctrl: 'u_ctrlN', int: 'u_intensity',
};

// ── Shader assembly ─────────────────────────────────────────────────────────

const SHADER_DIR = './shaders/';

// The single-file build (build.mjs) inlines every shader into this global, so the
// page can run straight off the filesystem. Served from a directory, the global
// is absent and the shaders are fetched as normal.
async function loadText(name) {
  const inlined = globalThis.__SHADER_SOURCES?.[name];
  if (inlined !== undefined) return inlined;
  const res = await fetch(SHADER_DIR + name);
  if (!res.ok) throw new Error(`could not load ${name}: ${res.status}`);
  return res.text();
}

function inject(template, parts) {
  let src = template;
  for (const [marker, body] of Object.entries(parts)) src = src.replace(marker, body);
  return src;
}

// ── App ─────────────────────────────────────────────────────────────────────

async function init() {
  const canvas = document.getElementById('canvas');
  const $ = (id) => document.getElementById(id);

  const [
    vertSrc, sdfFuncSrc, sdfMarcherSrc, scalarMarcherSrc, platonicFuncSrc,
    movingScalarSrc, rimLightSrc, lightingSrc, deformSrc,
    fragSdfTmpl, fragPlatonicTmpl, fragScalarTmpl, fragMovingTmpl, fragFormTmpl,
  ] = await Promise.all([
    'vertex.glsl', 'sdf-functions.glsl', 'sdf-marcher.glsl', 'scalar-marcher.glsl',
    'platonic-functions.glsl', 'moving-scalar-functions.glsl', 'rim-lighting.glsl',
    'lighting.glsl', 'deform.glsl', 'fragment-sdf.glsl', 'fragment-platonic.glsl',
    'fragment-scalar.glsl', 'fragment-moving.glsl', 'fragment-form.glsl',
  ].map(loadText));

  // The moving-scalar library and the fragment shader both want to own
  // `surfaceF`; rename the library's copy so the deformation wrapper can call it.
  const movingRenamed = movingScalarSrc.replace(/\bsurfaceF\b/g, 'baseScalarF');

  const fragSdf = inject(fragSdfTmpl, {
    '// INCLUDE_SDF_FUNCTIONS': sdfFuncSrc,
    '// INCLUDE_RIM_LIGHTING': rimLightSrc,
    '// INCLUDE_LIGHTING': lightingSrc,
    '// INCLUDE_SDF_MARCHER': sdfMarcherSrc,
    '// INCLUDE_DEFORM': deformSrc,
  });
  const fragPlatonic = inject(fragPlatonicTmpl, {
    '// INCLUDE_PLATONIC_FUNCTIONS': platonicFuncSrc,
    '// INCLUDE_RIM_LIGHTING': rimLightSrc,
    '// INCLUDE_LIGHTING': lightingSrc,
    '// INCLUDE_SDF_MARCHER': sdfMarcherSrc,
    '// INCLUDE_DEFORM': deformSrc,
  });
  const fragScalar = inject(fragScalarTmpl, {
    '// INCLUDE_RIM_LIGHTING': rimLightSrc,
    '// INCLUDE_LIGHTING': lightingSrc,
    '// INCLUDE_SCALAR_MARCHER': scalarMarcherSrc,
    '// INCLUDE_DEFORM': deformSrc,
  });
  const fragMoving = inject(fragMovingTmpl, {
    '// INCLUDE_RIM_LIGHTING': rimLightSrc,
    '// INCLUDE_LIGHTING': lightingSrc,
    '// INCLUDE_SCALAR_MARCHER': scalarMarcherSrc,
    '// INCLUDE_DEFORM': deformSrc,
    '// INCLUDE_MOVING_SCALAR_FUNCTIONS': movingRenamed,
  });
  const fragForm = inject(fragFormTmpl, {
    '// INCLUDE_RIM_LIGHTING': rimLightSrc,
    '// INCLUDE_LIGHTING': lightingSrc,
  });

  // ── Data textures ─────────────────────────────────────────────────────────
  // 1 × 256 amplitude history: r = L, g = R, b = mono. Row 0 is the current
  // frame and row 255 is ~4 s ago, so the shader reads v = 0 as "now".
  const histBuf = new Uint8Array(HIST * 4);
  const histTex = new THREE.DataTexture(histBuf, 1, HIST, THREE.RGBAFormat);
  histTex.magFilter = histTex.minFilter = THREE.LinearFilter;
  histTex.needsUpdate = true;

  // 128 × 1 current mel spectrum: r = mono, g = right channel.
  const fftBuf = new Uint8Array(BINS * 4);
  const fftTex = new THREE.DataTexture(fftBuf, BINS, 1, THREE.RGBAFormat);
  fftTex.magFilter = fftTex.minFilter = THREE.LinearFilter;
  fftTex.needsUpdate = true;

  // 128 × 256 spectrogram, written as a ring buffer. u_histHead tells the shader
  // where "now" currently sits, so no rows ever have to be shifted.
  const specBuf = new Uint8Array(BINS * HIST * 4);
  const specTex = new THREE.DataTexture(specBuf, BINS, HIST, THREE.RGBAFormat);
  specTex.magFilter = specTex.minFilter = THREE.LinearFilter;
  specTex.wrapS = THREE.ClampToEdgeWrapping;
  specTex.wrapT = THREE.RepeatWrapping;
  specTex.needsUpdate = true;

  const envTex = buildEnvMapTexture(THREE, 256, 128);

  // ── Renderer ──────────────────────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const shared = {
    iResolution: { value: new THREE.Vector2(1, 1) },
    iTime: { value: 0 },
    u_ampL: { value: 0 }, u_ampR: { value: 0 }, u_ampMono: { value: 0 },
    u_ssaa: { value: 0 },
    u_lighting: { value: 0 },
    u_deformMode: { value: 3 },
    u_histTex: { value: histTex },
    u_fftTex: { value: fftTex },
    u_envMap: { value: envTex },
    u_rimPow: { value: 3.0 },
    u_base: { value: 0.0 },
    u_sssDensity: { value: 2.5 },
    u_sssStr: { value: 0.3 },
    u_deformP1: { value: 0.55 },
    u_deformP2: { value: 0.55 },
    u_histDuration: { value: 1.0 },
    u_histSoften: { value: 0.0 },
    u_twistAxisX: { value: 0.0 },
    u_twistAxisZ: { value: 0.0 },
    u_ctrlN: { value: 2.0 },
  };

  const uniforms = {
    sdf:      { ...shared, u_shapeIndex: { value: 1 } },
    platonic: { ...shared, u_pair: { value: 2 }, u_t: { value: 0 } },
    scalar:   { ...shared, u_surfaceIndex: { value: 1 } },
    moving:   { ...shared, u_surfaceIndex: { value: 1 } },
    form:     { ...shared, u_mode: { value: 1 }, u_intensity: { value: 1.0 },
                u_specTex: { value: specTex }, u_histHead: { value: 0 } },
  };

  function makeScene(fragSrc, u) {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: vertSrc, fragmentShader: fragSrc }),
    ));
    return scene;
  }

  const scenes = {
    sdf: makeScene(fragSdf, uniforms.sdf),
    platonic: makeScene(fragPlatonic, uniforms.platonic),
    scalar: makeScene(fragScalar, uniforms.scalar),
    moving: makeScene(fragMoving, uniforms.moving),
    form: makeScene(fragForm, uniforms.form),
  };

  const renderPass = new RenderPass(scenes.platonic, cam);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.5, 0.1);
  const composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    // SSAA already costs 4 rays per pixel, so the backing store stays at 1× when
    // it is on and only takes the display's pixel ratio when it is off.
    const dpr = shared.u_ssaa.value ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    bloomPass.setSize(w * dpr, h * dpr);
    for (const u of Object.values(uniforms)) u.iResolution.value.set(w * dpr, h * dpr);
  }
  window.addEventListener('resize', resize);

  // ── State ─────────────────────────────────────────────────────────────────

  const state = {
    section: 'amplitude',   // amplitude | history | frequency | form
    category: 'platonic',   // sdf | platonic | scalar | moving
    shapeIndex: 2,          // index into the active category's list
    mode: 3,
    formMode: 1,
  };

  const audio = new AudioEngine();

  function activeKey() { return state.section === 'form' ? 'form' : state.category; }

  function syncScene() {
    renderPass.scene = scenes[activeKey()];
  }

  // Every uniform object shares the same value holders for the common uniforms,
  // so writing through one is enough — but shape indices are per-family.
  function applyShape(index) {
    if (state.category === 'sdf') uniforms.sdf.u_shapeIndex.value = index + 1;
    else if (state.category === 'platonic') uniforms.platonic.u_pair.value = index;
    else if (state.category === 'scalar') uniforms.scalar.u_surfaceIndex.value = index + 1;
    else uniforms.moving.u_surfaceIndex.value = index + 1;
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const sectionTabs = document.querySelectorAll('[data-section]');
  const categoryRow = $('category-row');
  const categorySel = $('category-select');
  const shapeSel = $('shape-select');
  const modeSel = $('mode-select');
  const lightingSel = $('lighting-select');
  const paramPanel = $('param-panel');

  function buildParamPanel() {
    const key = state.section === 'form' ? 'form' : state.mode;
    paramPanel.innerHTML = '';
    for (const [pid, label, min, max, step, def] of MODE_PARAMS[key]) {
      const row = document.createElement('div');
      row.className = 'param-row';

      const name = document.createElement('span');
      name.className = 'param-label';
      name.textContent = label;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = step; input.value = def;

      const val = document.createElement('span');
      val.className = 'param-val';

      const uniformName = PARAM_UNIFORM[pid];
      const write = () => {
        const v = parseFloat(input.value);
        val.textContent = step >= 1 ? v.toFixed(0) : v.toFixed(2);
        // u_intensity lives only on the form uniforms; the rest are shared.
        const target = uniformName === 'u_intensity' ? uniforms.form : uniforms.sdf;
        target[uniformName].value = v;
      };
      input.addEventListener('input', write);
      write();

      row.append(name, input, val);
      paramPanel.appendChild(row);
    }
  }

  function populateShapes() {
    const list = state.section === 'form' ? FORM_MODES : CATEGORY_SHAPES[state.category];
    shapeSel.innerHTML = '';
    list.forEach((label, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = label;
      shapeSel.appendChild(opt);
    });
  }

  function populateModes() {
    modeSel.innerHTML = '';
    if (state.section === 'form') return;
    for (const { id, name } of SECTION_MODES[state.section]) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      modeSel.appendChild(opt);
    }
    modeSel.value = String(state.mode);
  }

  function selectSection(section) {
    state.section = section;
    sectionTabs.forEach((el) => el.classList.toggle('active', el.dataset.section === section));

    const isForm = section === 'form';
    categoryRow.style.display = isForm ? 'none' : '';
    modeSel.parentElement.style.display = isForm ? 'none' : '';
    document.body.classList.toggle('form-section', isForm);

    if (!isForm) {
      // Keep the current deformation if it belongs to this section (so the
      // opening state survives), otherwise fall back to the section's first.
      const modes = SECTION_MODES[section];
      if (!modes.some((m) => m.id === state.mode)) state.mode = modes[0].id;
      shared.u_deformMode.value = state.mode;
    }

    populateShapes();
    populateModes();

    if (isForm) {
      shapeSel.value = String(state.formMode - 1);
      uniforms.form.u_mode.value = state.formMode;
    } else {
      // Amplitude, History and Frequency all deform the same catalogue, so
      // moving between them keeps whatever shape is already on screen.
      shapeSel.value = String(state.shapeIndex);
      applyShape(state.shapeIndex);
    }
    buildParamPanel();
    syncScene();
  }

  for (const tab of sectionTabs) {
    tab.addEventListener('click', () => selectSection(tab.dataset.section));
  }

  categorySel.addEventListener('change', () => {
    state.category = categorySel.value;
    // Shape indices are per-category, so a new catalogue starts from the top.
    state.shapeIndex = 0;
    populateShapes();
    shapeSel.value = '0';
    applyShape(0);
    syncScene();
  });

  shapeSel.addEventListener('change', () => {
    const i = parseInt(shapeSel.value, 10);
    if (state.section === 'form') {
      state.formMode = i + 1;
      uniforms.form.u_mode.value = state.formMode;
    } else {
      state.shapeIndex = i;
      applyShape(i);
    }
  });

  modeSel.addEventListener('change', () => {
    state.mode = parseInt(modeSel.value, 10);
    shared.u_deformMode.value = state.mode;
    buildParamPanel();
  });

  lightingSel.addEventListener('change', () => {
    shared.u_lighting.value = parseInt(lightingSel.value, 10);
  });

  // Bloom
  const bindBloom = (id, apply) => {
    const el = $(id);
    const out = $(id + '-val');
    const write = () => {
      const v = parseFloat(el.value);
      out.textContent = v.toFixed(2);
      apply(v);
    };
    el.addEventListener('input', write);
    write();
  };
  bindBloom('bloom-strength', (v) => { bloomPass.strength = v; });
  bindBloom('bloom-threshold', (v) => { bloomPass.threshold = v; });

  // Anti-aliasing
  const aaBtn = $('aa-btn');
  aaBtn.addEventListener('click', () => {
    shared.u_ssaa.value = shared.u_ssaa.value ? 0 : 1;
    aaBtn.classList.toggle('on', !!shared.u_ssaa.value);
    resize();
  });

  // ── Audio controls ────────────────────────────────────────────────────────

  const playBtn = $('play-btn');
  const status = $('audio-status');
  const PLAY = '<svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor"><polygon points="0,0 14,8 0,16"/></svg>';
  const PAUSE = '<svg width="12" height="14" viewBox="0 0 12 16" fill="currentColor"><rect x="0" width="4" height="16"/><rect x="8" width="4" height="16"/></svg>';

  function refreshTransport(label) {
    playBtn.innerHTML = audio.isPlaying ? PAUSE : PLAY;
    if (label) status.textContent = label;
  }

  playBtn.addEventListener('click', async () => {
    // Nothing is connected until the first gesture — browsers will not start an
    // AudioContext before one.
    if (audio.sourceKind === 'none') await audio.useDemo();
    else await audio.toggle();
    refreshTransport();
  });

  $('demo-btn').addEventListener('click', async () => {
    await audio.useDemo();
    refreshTransport('Generated track');
  });

  $('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await audio.useFile(file);
    refreshTransport(file.name);
  });

  $('mic-btn').addEventListener('click', async () => {
    try {
      await audio.useMic();
      refreshTransport('Microphone');
    } catch {
      status.textContent = 'Microphone unavailable';
    }
  });

  const gainInput = $('gain');
  const writeGain = () => {
    audio.gain = parseFloat(gainInput.value);
    $('gain-val').textContent = audio.gain.toFixed(1);
  };
  gainInput.addEventListener('input', writeGain);
  writeGain();

  // ── Texture upload ────────────────────────────────────────────────────────

  const toByte = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);

  function uploadTextures() {
    // Amplitude history, newest first.
    for (let row = 0; row < HIST; row++) {
      const o = row * 4;
      histBuf[o]     = toByte(audio.histAt(audio.histL, row));
      histBuf[o + 1] = toByte(audio.histAt(audio.histR, row));
      histBuf[o + 2] = toByte(audio.histAt(audio.histMono, row));
      histBuf[o + 3] = 255;
    }
    histTex.needsUpdate = true;

    for (let i = 0; i < BINS; i++) {
      const o = i * 4;
      fftBuf[o]     = toByte(audio.fftMono[i]);
      fftBuf[o + 1] = toByte(audio.fftR[i]);
      fftBuf[o + 2] = toByte(audio.fftL[i]);
      fftBuf[o + 3] = 255;
    }
    fftTex.needsUpdate = true;

    // Only the rows the engine wrote this tick need refreshing; the rest of the
    // ring buffer is still valid from previous frames. On a slow frame the
    // engine may have advanced several rows at once.
    for (let k = 0; k < audio.pushed; k++) {
      const row = (audio.head - 1 - k + HIST * 2) % HIST;
      const src = row * BINS;
      const dst = row * BINS * 4;
      for (let i = 0; i < BINS; i++) {
        const o = dst + i * 4;
        const v = toByte(audio.spec[src + i]);
        specBuf[o] = specBuf[o + 1] = specBuf[o + 2] = v;
        specBuf[o + 3] = 255;
      }
    }
    if (audio.pushed) specTex.needsUpdate = true;
    uniforms.form.u_histHead.value = audio.head / HIST;
  }

  // ── Frame loop ────────────────────────────────────────────────────────────

  const start = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);

    audio.update(now);
    uploadTextures();

    shared.iTime.value = (now - start) / 1000;
    shared.u_ampL.value = audio.ampL;
    shared.u_ampR.value = audio.ampR;
    shared.u_ampMono.value = audio.ampMono;

    // Platonic pairs cross-fade between a solid and its dual on a slow cycle.
    uniforms.platonic.u_t.value =
      0.5 - 0.5 * Math.cos((shared.iTime.value / 5.0) * Math.PI * 2);

    composer.render();
  }

  // Handle for the console: lets the visualisation be driven from a script, and
  // makes the live analysis values inspectable while tuning.
  window.soundReactiveShapes = { audio, uniforms, shared, state, scenes, composer };

  resize();
  categorySel.value = state.category;
  selectSection(state.section);
  refreshTransport('Press play for the generated track');
  document.body.classList.remove('loading');
  requestAnimationFrame(frame);
}

init().catch((err) => {
  console.error(err);
  const el = document.getElementById('audio-status');
  if (el) el.textContent = `Failed to start: ${err.message}`;
  document.body.classList.remove('loading');
});
