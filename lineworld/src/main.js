// Lineworld -- entry point.

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import * as field from './render.js';
import { GlowPoints, createGlowMaterial, updateGlowProjection } from './render.js';
import { buildWorld, resolveCollisions } from './world.js';
import { Dog } from './dog.js';
import { Scent } from './scent.js';
import { MemoryVision } from './memories.js';
import { DigSite, Monument, Effects } from './props.js';
import { Owner } from './owner.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { BEATS, SITES, MONUMENTS, OWNER } from './story.js';

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 900);

const ui = new UI();
const audio = new AudioEngine();

const keepOut = [
  ...SITES.map((s) => ({ x: s.x, z: s.z, r: 7 })),
  ...MONUMENTS.map((m) => ({ x: m.x, z: m.z, r: 9 })),
  { x: OWNER.x, z: OWNER.z, r: 16 },
];

const world = buildWorld(scene, { seed: 20260811, keepOut });
const dog = new Dog(scene);
const scent = new Scent(scene);
const effects = new Effects(scene);
const vision = new MemoryVision(scene);
const owner = new Owner(scene, OWNER.x, OWNER.z);

const sites = SITES.map((s, i) => new DigSite(scene, world.material, s.x, s.z, 900 + i * 37));
const monuments = MONUMENTS.map((m, i) => new Monument(scene, world.material, m.x, m.z, 300 + i * 53));

const beacons = new GlowPoints(96, createGlowMaterial({ lit: false }));
scene.add(beacons.points);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  phase: 'title',       // title | play | ending | done
  beat: 0,
  memories: 0,
  lanternR: 16.0,
  time: 0,
  arrived: false,
  digProgress: 0,
  digCue: 0,
  sniffCue: 0,
  hintShown: {},
  endT: -1,
};

const LANTERN_COL = new THREE.Color(1.0, 0.80, 0.50);
const PULSE_COL = new THREE.Color(0.72, 0.90, 1.0);
const WARM = new THREE.Color(1.0, 0.72, 0.34);
const tmp = new THREE.Vector3();

ui.buildDots(SITES.length);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = new Set();
const input = { move: new THREE.Vector2(), run: false, jump: false, sniff: false, dig: false, camYaw: 0 };
let jumpQueued = false;
const touch = { active: false, x: 0, y: 0, id: -1 };

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', ' ', 'q', 'e', 'f', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (keys.has(k)) return;
  keys.add(k);
  if (k === ' ') jumpQueued = true;
  if (k === 'f' && state.phase === 'play') doBark();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// camera orbit
const cam = { yaw: Math.PI, pitch: 0.20, dist: 7.0, curYaw: Math.PI, curPitch: 0.20, curDist: 7.0, idle: 0 };
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let dragging = false, lastX = 0, lastY = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - lastX) * 0.0055;
  cam.pitch = Math.max(-0.25, Math.min(1.05, cam.pitch + (e.clientY - lastY) * 0.0040));
  lastX = e.clientX; lastY = e.clientY;
  cam.idle = 0;
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = Math.max(3.2, Math.min(18, cam.dist + e.deltaY * 0.006));
}, { passive: false });

// touch controls
if (isTouch) {
  ui.showTouch();
  const stick = document.getElementById('stick');
  const knob = stick.querySelector('i');
  stick.addEventListener('pointerdown', (e) => {
    touch.active = true; touch.id = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    touch.ox = e.clientX; touch.oy = e.clientY;
  });
  stick.addEventListener('pointermove', (e) => {
    if (!touch.active || e.pointerId !== touch.id) return;
    const dx = Math.max(-52, Math.min(52, e.clientX - touch.ox));
    const dy = Math.max(-52, Math.min(52, e.clientY - touch.oy));
    touch.x = dx / 52; touch.y = -dy / 52;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const end = () => { touch.active = false; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);

  document.querySelectorAll('#tbtns button').forEach((b) => {
    const k = b.dataset.key;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      keys.add(k);
      if (k === 'f' && state.phase === 'play') doBark();
    });
    b.addEventListener('pointerup', () => keys.delete(k));
    b.addEventListener('pointercancel', () => keys.delete(k));
  });
}

function readInput() {
  const disabled = state.phase !== 'play';
  let x = 0, y = 0;
  if (!disabled) {
    if (keys.has('w') || keys.has('arrowup')) y += 1;
    if (keys.has('s') || keys.has('arrowdown')) y -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (touch.active) { x += touch.x; y += touch.y; }
  }
  input.move.set(x, y);
  if (input.move.lengthSq() > 1) input.move.normalize();
  input.run = !disabled && (keys.has('shift') || (touch.active && input.move.length() > 0.85));
  input.jump = !disabled && jumpQueued;
  input.sniff = !disabled && keys.has('q');
  input.dig = !disabled && keys.has('e');
  input.camYaw = cam.curYaw + Math.PI;
  jumpQueued = false;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function doBark() {
  dog.bark();
  audio.bark();
  effects.shockwave(dog.mouthWorld.clone().setY(dog.mouthWorld.y), {
    maxR: 40, speed: 30, color: PULSE_COL, width: 3.2, intensity: 1.0,
  });

  // does anything answer?
  for (let i = 0; i < monuments.length; i++) {
    const m = monuments[i];
    if (m.active) continue;
    if (m.pos.distanceTo(dog.pos) > 24) continue;
    m.activate();
    audio.resonance(88 + i * 11);
    audio.bark({ distant: true, delay: 0.9, pitch: 0.82 });
    effects.shockwave(m.lightPos, { maxR: 46, speed: 22, color: WARM, width: 4.0, intensity: 1.1 });

    const beat = BEATS[state.beat];
    if (beat && beat.kind === 'bark' && beat.target === i) {
      ui.say(beat.done, 6.5);
      if (state.beat === 5) setTimeout(() => audio.howl(true), 1600);
      advance();
    } else {
      ui.say('bonus', 4.5);
    }
    break;
  }
}

function advance() {
  state.beat++;
  state.arrived = false;
  state.digProgress = 0;
  const beat = BEATS[state.beat];
  if (!beat) return;
  ui.objective(beat.objective);
  buildScentPath();
  if (beat.kind === 'final') owner.reveal();
}

function beatTarget() {
  const beat = BEATS[state.beat];
  if (!beat) return null;
  if (beat.kind === 'dig') return sites[beat.target].pos;
  if (beat.kind === 'bark') return monuments[beat.target].pos;
  return owner.pos;
}

function buildScentPath() {
  const target = beatTarget();
  if (!target) { scent.clear(); return; }
  const from = dog.pos.clone();
  const pts = [from.clone()];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = from.clone().lerp(target, t);
    // wander, so the trail feels sniffed out rather than surveyed
    const s = Math.sin(t * Math.PI);
    p.x += Math.sin(t * 7.3 + state.beat * 2.1) * 9 * s;
    p.z += Math.cos(t * 5.1 + state.beat * 1.7) * 9 * s;
    pts.push(p);
  }
  pts.push(target.clone());
  for (const p of pts) p.y = terrainHeight(p.x, p.z);
  scent.setPath(pts);
}

function completeDig(beat) {
  const site = sites[beat.target];
  site.setDug();
  tmp.copy(site.pos).setY(site.pos.y + 2.3);
  vision.show(beat.memory, tmp, 1.7);
  audio.chime(state.memories * 2);
  audio.heartbeat();
  effects.shockwave(tmp, { maxR: 16, speed: 11, color: WARM, width: 3.0, intensity: 0.8 });
  effects.burstDirt(site.pos, dog.forward.clone(), 60);
  ui.setDot(state.memories);
  state.memories++;
  state.lanternR += 2.3;
  ui.say(beat.done, 7);
  ui.meter(null);
  advance();
}

// ---------------------------------------------------------------------------
// Timelines
// ---------------------------------------------------------------------------

let timeline = [];
let tlTime = 0;

function runTimeline(items) {
  timeline = items.map((i) => ({ ...i, fired: false }));
  tlTime = 0;
}

function tickTimeline(dt) {
  if (!timeline.length) return;
  tlTime += dt;
  for (const item of timeline) {
    if (!item.fired && tlTime >= item.t) { item.fired = true; item.fn(); }
  }
}

function beginGame() {
  audio.start();
  audio.resume();
  ui.hideTitle();
  ui.fade(0, 3200);
  state.phase = 'play';
  ui.objective(BEATS[0].objective);
  buildScentPath();
  runTimeline([
    { t: 1.2, fn: () => ui.say('intro_1', 5) },
    { t: 6.5, fn: () => ui.say('intro_2', 5) },
    { t: 12.0, fn: () => ui.say('intro_3', 5) },
    { t: 17.5, fn: () => { if (scent.amount < 0.15) ui.prompt('hint_sniff'); } },
    { t: 26.0, fn: () => { if (ui._prompt === 'hint_sniff') ui.prompt(null); } },
  ]);
}

function beginEnding() {
  state.phase = 'ending';
  ui.objective(null);
  ui.prompt(null);
  ui.meter(null);
  scent.clear();
  dog.idleTime = 12;
  audio.chime(3);

  runTimeline([
    { t: 0.2, fn: () => effects.shockwave(owner.lanternWorld, { maxR: 60, speed: 16, color: WARM, width: 6, intensity: 1.2 }) },
    { t: 1.6, fn: () => ui.say('ending_1', 7) },
    { t: 4.0, fn: () => { audio.heartbeat(); } },
    { t: 6.0, fn: () => { tmp.copy(owner.pos).lerp(dog.pos, 0.5).setY(owner.pos.y + 3.2); vision.show(4, tmp, 2.2); } },
    { t: 9.5, fn: () => ui.say('ending_2', 7) },
    { t: 13.0, fn: () => { audio.howl(false); effects.shockwave(owner.lanternWorld, { maxR: 220, speed: 42, color: PULSE_COL, width: 22, intensity: 1.3 }); } },
    { t: 15.5, fn: () => ui.say('ending_3', 8) },
    { t: 22.0, fn: () => { ui.fade(1, 6000); audio.fadeOut(7); } },
    { t: 28.0, fn: () => { ui.clearSay(); showEndCard(); } },
  ]);
}

function showEndCard() {
  state.phase = 'done';
  const t = ui.el.title;
  t.style.display = 'flex';
  t.querySelector('.tag').innerHTML = ui.t('ending_4');
  t.querySelector('#controls').innerHTML = '';
  t.querySelector('#start').textContent = ui.lang === 'ja' ? 'もういちど' : 'AGAIN';
  t.querySelector('#start').onclick = () => location.reload();
  requestAnimationFrame(() => t.classList.remove('gone'));
}

ui.el.start.addEventListener('click', () => { if (state.phase === 'title') beginGame(); });
addEventListener('keydown', (e) => {
  if (state.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) beginGame();
});

// ---------------------------------------------------------------------------
// Per-frame story logic
// ---------------------------------------------------------------------------

function updateStory(dt) {
  if (state.phase !== 'play') return;
  const beat = BEATS[state.beat];
  if (!beat) return;

  const target = beatTarget();
  const dist = target ? dog.pos.distanceTo(target) : Infinity;

  if (!state.arrived && dist < (beat.kind === 'bark' ? 26 : 9)) {
    state.arrived = true;
    ui.say(beat.arrive, 5.5);
  }

  let prompt = null;

  if (beat.kind === 'dig') {
    const site = sites[beat.target];
    if (!site.dug && dist < 3.0) {
      prompt = 'hint_dig';
      if (input.dig && dog.state === 'dig') {
        state.digProgress += dt / 2.6;
        ui.meter(Math.min(1, state.digProgress));
        state.digCue -= dt;
        if (state.digCue <= 0) {
          state.digCue = 0.19;
          audio.dig();
          effects.burstDirt(site.pos, dog.forward.clone(), 4);
        }
        if (state.digProgress >= 1) completeDig(beat);
      } else {
        state.digProgress = Math.max(0, state.digProgress - dt * 0.35);
        ui.meter(state.digProgress > 0.01 ? state.digProgress : null);
      }
    } else {
      ui.meter(null);
    }
  } else if (beat.kind === 'bark') {
    const m = monuments[beat.target];
    if (!m.active && dist < 24) prompt = 'hint_bark';
  } else if (beat.kind === 'final') {
    if (dist < 6.5) { beginEnding(); return; }
  }

  ui.prompt(prompt || (ui._prompt === 'hint_sniff' ? 'hint_sniff' : null));

  // the trail is re-sniffed from wherever you are, if you stray a long way
  if (scent.active && scent.samples.length) {
    const near = scent._nearestU(dog.pos);
    if (near.dist > 34) buildScentPath();
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function updateCamera(dt) {
  const damp = (a, b, l) => a + (b - a) * (1 - Math.exp(-l * dt));

  if (state.phase === 'ending') {
    cam.yaw += dt * 0.09;
    cam.pitch = damp(cam.pitch, 0.22, 0.6);
    cam.dist = damp(cam.dist, 11.5, 0.35);
    camTarget.copy(dog.pos).lerp(owner.pos, 0.45);
    camTarget.y = terrainHeight(camTarget.x, camTarget.z) + 1.3;
  } else {
    // ease the camera back behind the dog when you are moving and not dragging
    cam.idle += dt;
    if (!dragging && dog.speed > 1.4 && cam.idle > 0.8) {
      let want = dog.yaw + Math.PI;
      let d = want - cam.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      cam.yaw += d * Math.min(1, dt * 0.9 * Math.min(1, dog.speed / 5));
    }
    camTarget.copy(dog.pos);
    camTarget.y = dog.root.position.y + 0.95;
  }

  cam.curYaw = damp(cam.curYaw, cam.yaw, 7);
  cam.curPitch = damp(cam.curPitch, cam.pitch, 7);
  cam.curDist = damp(cam.curDist, cam.dist, 5);

  const cp = Math.cos(cam.curPitch), sp = Math.sin(cam.curPitch);
  camPos.set(
    camTarget.x + Math.sin(cam.curYaw) * cp * cam.curDist,
    camTarget.y + sp * cam.curDist + 1.1,
    camTarget.z + Math.cos(cam.curYaw) * cp * cam.curDist,
  );
  const floor = terrainHeight(camPos.x, camPos.z) + 0.9;
  if (camPos.y < floor) camPos.y = floor;

  camera.position.lerp(camPos, 1 - Math.exp(-9 * dt));
  camera.lookAt(camTarget);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.06) dt = 0.06;
  state.time += dt;
  const time = state.time;
  if (window.__LW) window.__LW.fps = Math.round(window.__LW.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1);

  readInput();
  tickTimeline(dt);

  // --- dog -------------------------------------------------------------
  dog.onStep = (s) => audio.step(s);
  dog.update(dt, input, world.trees, resolveCollisions);

  if (input.sniff) {
    state.sniffCue -= dt;
    if (state.sniffCue <= 0) { state.sniffCue = 0.42 + Math.random() * 0.3; audio.sniff(); }
  }

  updateStory(dt);
  scent.update(dt, dog.pos, input.sniff, time);
  vision.update(dt, camera);
  owner.update(dt);
  if (owner.visible) {
    owner.lookAt(dog.pos);
    if (state.phase === 'ending') owner.kneel = Math.min(1, owner.kneel + dt * 0.32);
  }
  for (const m of monuments) m.update(dt);

  // --- light field -----------------------------------------------------
  field.beginFrame(time);

  const flicker = 0.93 + 0.05 * Math.sin(time * 7.1) + 0.03 * Math.sin(time * 13.7 + 1.3);
  let lanternR = state.lanternR * flicker;
  if (state.phase === 'ending') lanternR += Math.min(70, Math.max(0, tlTime - 13) * 9);
  field.addLamp(dog.lanternWorld, lanternR, 1.0, LANTERN_COL, 0.18);
  field.addLamp(dog.headWorld || dog.pos, 3.6, 0.42, LANTERN_COL, 0.05);

  // nearest red lights light their own monuments
  const near = monuments
    .map((m) => ({ m, d: m.pos.distanceTo(dog.pos) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  for (const { m, d } of near) {
    if (d > 90) continue;
    const s = m.sample(time);
    field.addLamp(m.lightPos, 7 + m.flare * 26, 0.55 * s.pulse, s.col, 0.1);
  }

  if (vision.active && vision.mesh) {
    field.addLamp(vision.mesh.position, 11, 0.5, WARM, 0.05);
  }
  if (owner.visible) {
    field.addLamp(owner.lanternWorld, 15 + (state.phase === 'ending' ? tlTime * 1.4 : 0), 0.95, LANTERN_COL, 0.15);
  }

  effects.update(dt, time, dog.pos, field);
  field.endFrame();

  // --- beacons ---------------------------------------------------------
  beacons.reset();
  beacons.push(dog.lanternWorld.x, dog.lanternWorld.y, dog.lanternWorld.z,
    1.0, 0.80, 0.48, 1.55 * flicker, 0.85);
  beacons.push(dog.lanternWorld.x, dog.lanternWorld.y, dog.lanternWorld.z,
    1.0, 0.92, 0.72, 0.46, 1.0);
  if (dog.eyeL) {
    beacons.push(dog.eyeL.x, dog.eyeL.y, dog.eyeL.z, 0.75, 0.90, 1.0, 0.07, 0.85);
    beacons.push(dog.eyeR.x, dog.eyeR.y, dog.eyeR.z, 0.75, 0.90, 1.0, 0.07, 0.85);
  }
  for (const m of monuments) {
    const s = m.sample(time);
    const dist = m.pos.distanceTo(dog.pos);
    const vis = Math.max(0.15, 1 - dist / 170);
    beacons.push(m.lightPos.x, m.lightPos.y, m.lightPos.z, s.col.r, s.col.g, s.col.b, 1.9 * s.pulse, 0.85 * vis);
    beacons.push(m.lightPos.x, m.lightPos.y, m.lightPos.z, 1.0, 0.75, 0.7, 0.5 * s.pulse, 0.9 * vis);
  }
  for (const s of sites) {
    if (s.dug) continue;
    const beat = BEATS[state.beat];
    const isTarget = beat && beat.kind === 'dig' && sites[beat.target] === s;
    const a = (isTarget ? 0.55 : 0.22) * (0.6 + 0.4 * Math.sin(time * 1.9));
    beacons.push(s.pos.x, s.pos.y + 0.25, s.pos.z, 1.0, 0.82, 0.42, 1.3, a);
  }
  if (owner.visible) {
    beacons.push(owner.lanternWorld.x, owner.lanternWorld.y, owner.lanternWorld.z,
      1.0, 0.84, 0.55, 2.1, 1.0);
    beacons.push(owner.lanternWorld.x, owner.lanternWorld.y, owner.lanternWorld.z,
      1.0, 0.96, 0.85, 0.7, 1.0);
  }
  beacons.commit();

  // --- camera, audio, render -------------------------------------------
  updateCamera(dt);
  ui.update(dt);

  const tension = state.phase === 'ending' ? 1 : Math.min(1, state.memories / 4);
  audio.windAmount = 0.3 + 0.4 * Math.min(1, dog.speed / 7);
  audio.update(dt, { speed: dog.speed, tension });

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateGlowProjection(renderer, camera);
}
addEventListener('resize', onResize);
onResize();

// Place the dog on the ground before the first frame.
dog.pos.set(0, 0, 0);
dog.yaw = 0.6;

// Handy from the console: __LW.dog.pos.set(x, 0, z) to jump around.
window.__LW = { dog, state, scene, camera, world, sites, monuments, owner, scent, effects, audio, ui, fps: 0 };

requestAnimationFrame(frame);
