/* ============================================================
   MAIN — boot, loading, menus, frame loop

   The bake is a generator so the loading bar can actually move rather
   than the tab going white for four seconds. Everything after it is
   one ordered pass: input, simulate, place the camera, draw the world
   back to front, then hand the HUD the same state object.
   ============================================================ */

import { createContext } from './core/gl.js';
import { Engine, guessTier, TIERS } from './core/engine.js';
import { Input } from './core/input.js';
import { SolidRenderer } from './core/solid.js';
import { Audio } from './core/audio.js';
import { load as loadSave, save as writeSave, clear as clearSave } from './core/save.js';
import { Terrain } from './world/terrain.js';
import { Sky, cameraBasis } from './world/sky.js';
import { Props, siteLayout } from './world/props.js';
import { Dust } from './world/dust.js';
import { Rover } from './game/rover.js';
import { Camera, CAM_MODES } from './game/camera.js';
import { Gameplay } from './game/gameplay.js';
import { Hud } from './ui/hud.js';
import { v3, clamp, DEG } from './core/math.js';

const SEED = 20260812;
const AUTOSAVE = 20;

const canvas = document.getElementById('view');
const el = {
  boot: document.getElementById('boot'),
  bootFill: document.getElementById('bootFill'),
  bootPhase: document.getElementById('bootPhase'),
  bootSpec: document.getElementById('bootSpec'),
  title: document.getElementById('title'),
  start: document.getElementById('btnStart'),
  cont: document.getElementById('btnContinue')
};

let gl;
try {
  gl = createContext(canvas);
} catch (e) {
  el.bootPhase.textContent = e.message;
  el.bootPhase.style.color = '#ff6a5e';
  throw e;
}

const settings = {
  quality: guessTier(),
  bloom: 1, grain: 1,
  hudScale: 1, hudShow: true, units: 'metric',
  autoCentre: true, fov: 58, invertY: false,
  master: 0.75, motor: 0.9, radio: 0.8
};

const engine = new Engine(canvas, settings.quality);
engine.attach(gl);
engine.settings.bloom = settings.bloom;
engine.settings.grain = settings.grain;

const terrain = new Terrain(gl, {
  seed: SEED,
  tier: settings.quality === 'low' || settings.quality === 'medium' ? 'low' : 'high',
  sunAzimuth: 2.15,
  sunElevation: 21.4 * DEG
});

el.bootSpec.innerHTML = [
  `RENDER TIER ${TIERS[settings.quality].label} · ${(TIERS[settings.quality].pixels / 1e6).toFixed(1)} Mpx BUDGET`,
  `HEIGHT FIELD ${terrain.fineN}² AT ${terrain.fineCell} m · ±${terrain.fineHalf} m`,
  `SUN ${(terrain.sunEl / DEG).toFixed(1)}° ELEVATION · GRAVITY 1.62 m/s²`
].join('<br>');

/* ---------- bake ---------- */

const steps = terrain.bakeSteps();
function bakeChunk() {
  const t0 = performance.now();
  let r;
  // Yield the thread every 24 ms so the bar animates and the tab lives.
  do { r = steps.next(); } while (!r.done && performance.now() - t0 < 24);
  if (r.value) {
    el.bootFill.style.width = `${(r.value.t * 100).toFixed(1)}%`;
    el.bootPhase.textContent = r.value.phase;
  }
  if (r.done) showTitle(); else requestAnimationFrame(bakeChunk);
}
requestAnimationFrame(bakeChunk);

let saved = null;
function showTitle() {
  el.boot.classList.add('hidden');
  el.title.classList.remove('hidden');
  saved = loadSave();
  if (saved && saved.seed === SEED) el.cont.classList.remove('hidden');
  el.start.addEventListener('click', () => begin(false));
  el.cont.addEventListener('click', () => begin(true));
}

/* ---------- the game ---------- */

function begin(resume) {
  el.title.classList.add('hidden');

  const solid = new SolidRenderer(gl);
  const sky = new Sky(gl, { seed: SEED, sunDir: terrain.sunDir });
  const site = terrain.findLandingSite(0, 0, 120);
  const layout = siteLayout(site);
  const rover = new Rover(terrain);
  rover.buildMeshes(solid);
  rover.placeAt(site.x + 4.2, site.z + 3.0, 0.6);
  const props = new Props(gl, terrain, solid, layout, SEED);
  const dust = new Dust(gl, terrain, {
    budget: settings.quality === 'low' ? 700 : settings.quality === 'medium' ? 1200 : 2000,
    seed: SEED
  });
  const game = new Gameplay(terrain, rover, props, dust, layout, SEED);
  const cam = new Camera(terrain);
  cam.fov = settings.fov * DEG;
  cam.autoCentre = settings.autoCentre;
  const input = new Input(canvas);
  const audio = new Audio();

  if (resume && saved) game.restore(saved);

  const hud = new Hud(settings, {
    settingChanged: applySetting,
    save: () => writeSave(game.toJSON()),
    restart: () => { clearSave(); location.reload(); },
    pixelInfo: () => `${engine.width}×${engine.height}`,
    overlayChanged: (open) => {
      input.enabled = !open;
      if (open && document.pointerLockElement) document.exitPointerLock();
      paused = open;
    },
    drill: (on) => { if (on) startDrill(); else { /* drill runs to completion */ } }
  });
  hud.show(true);
  hud.mountTouch(input);
  hud.renderCodex(game.codex, game.codexNew);

  function applySetting(key, value) {
    if (key === 'quality') { engine.setTier(value); }
    else if (key === 'bloom') engine.settings.bloom = value;
    else if (key === 'grain') engine.settings.grain = value;
    else if (key === 'fov') cam.fov = value * DEG;
    else if (key === 'autoCentre') cam.autoCentre = value;
    else if (key === 'master' || key === 'motor' || key === 'radio') audio.setSetting(key, value);
  }

  /* Audio needs a gesture. Any of them will do. */
  const wake = () => { audio.start(); audio.setSetting('master', settings.master); };
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });

  let paused = false;
  let armOut = false, arrayOut = true;
  let last = performance.now();
  let saveTimer = 0;
  const basis = {};
  const ctx = {
    viewProj: null, camPos: v3(), sunColor: [1, 0.985, 0.955], exposure: 1,
    time: 0, headlights: false, lampPos: rover.lampPos, lampDir: rover.lampDir,
    shadowSpheres: rover.shadowSpheres, shadowCount: 0,
    radar: new Float32Array(4), focus: rover.pos, pixelScale: 1,
    relaysOnline: 0, camRight: null, camUp: null, camFwd: null,
    tanFovX: 1, tanFovY: 1
  };
  const hudState = {
    layout, wheels: rover.wheels, sampleSet: game.sampleSet, pos: rover.pos,
    trace: game.trace, traceKind: game.traceKind, beacons: props.beacons, bearings: []
  };

  function startDrill() {
    if (game.startDrill()) audio.drill(true);
  }

  function handleEvents() {
    for (const e of game.events) {
      if (e.type === 'banner') { hud.banner(e.text); audio.radio(true); }
      else if (e.type === 'ending') { hud.banner(e.text, 'END OF TRAVERSE'); audio.radio(true); }
      else if (e.type === 'deny') { hud.toast(e.text, 'warn'); audio.beep(220, 0.12, 0.07); }
      else if (e.type === 'radar') { hud.toast(e.text); audio.chirp(); }
      else { hud.toast(e.text, e.tone); audio.beep(760, 0.07, 0.05, 'sine'); }
      if (e.type === 'codex') hud.renderCodex(game.codex, game.codexNew);
    }
    game.events.length = 0;
  }

  function tick(dt) {
    input.begin();
    if (settings.invertY) input.lookY = -input.lookY;

    /* ---- discrete commands ---- */
    if (input.took('pause')) {
      if (hud.anyOverlay) { hud.toggleCodex(false); hud.toggleSystems(false); }
      else hud.toggleSystems(true);
    }
    if (input.took('codex')) {
      if (hud.codexOpen) hud.toggleCodex(false);
      else { hud.renderCodex(game.codex, game.codexNew); hud.toggleCodex(true); }
    }

    if (!paused) {
      if (input.took('radar')) { if (game.fireRadar()) audio.chirp(); }
      if (input.took('arm')) armOut = !armOut;
      if (input.took('array')) arrayOut = !arrayOut;
      if (input.took('lamp')) { rover.lamps = !rover.lamps; audio.beep(520, 0.05, 0.04); }
      if (input.took('beacon')) game.deployBeacon();
      if (input.took('camera')) cam.cycle();
      if (input.took('photo')) { cam.photo = !cam.photo; engine.settings.vignette = cam.photo ? 0.44 : 0.30; }
      if (input.took('hud')) { settings.hudShow = !settings.hudShow; hud.refreshOptions(); }
      if (input.took('right_self')) { if (rover.rightSelf()) audio.thud(1.4); }
      if (input.mouse.leftEdge && armOut) startDrill();

      const ctrl = {
        throttle: input.throttle, steer: input.steer,
        brake: !!input.down.brake, armOut, arrayOut,
        interact: !!input.down.interact
      };
      const wasDrilling = game.drill.active;
      rover.step(dt, ctrl);
      props.collide(rover);
      game.update(dt, ctrl);
      if (wasDrilling && !game.drill.active) audio.drill(false);
      terrain.update(dt);
      dust.emitFromWheels(rover, dt);
      dust.update(dt);
      sky.update(dt);
      handleEvents();

      if (rover.lastImpact > 1.2) { cam.shake = Math.min(3, rover.lastImpact); audio.thud(rover.lastImpact); }

      audio.update(dt, {
        wheelSpin: rover.wheels.reduce((a, w) => a + Math.abs(w.spin), 0) / 6,
        motorLoad: rover.motorLoad,
        speed: rover.speed,
        slip: rover.wheelSlipAvg
      });

      saveTimer += dt;
      if (saveTimer > AUTOSAVE) { saveTimer = 0; writeSave(game.toJSON()); }
    }

    /* ---- camera and frame context ---- */
    engine.resize();
    const aspect = engine.width / engine.height;
    const eye = cam.update(paused ? 0 : dt, rover, input, aspect);
    cameraBasis(cam.view, basis);

    ctx.viewProj = cam.viewProj;
    ctx.camPos = eye;
    ctx.time = performance.now() / 1000;
    ctx.headlights = rover.lamps;
    ctx.shadowCount = rover.shadowCount;
    ctx.relaysOnline = game.relaysOnline;
    ctx.camRight = basis.right; ctx.camUp = basis.up; ctx.camFwd = basis.fwd;
    ctx.tanFovY = Math.tan(cam.fov / 2);
    ctx.tanFovX = ctx.tanFovY * aspect;
    ctx.pixelScale = engine.scale;
    const r = game.radar;
    ctx.radar[0] = r.origin[0]; ctx.radar[1] = r.origin[1];
    ctx.radar[2] = r.r; ctx.radar[3] = r.active ? r.strength : 0;

    /* ---- draw ---- */
    engine.beginScene();
    sky.render(ctx);
    terrain.render(ctx);
    solid.beginFrame(solid.plain, ctx, terrain);
    rover.render(solid, ctx);
    props.render(solid, ctx);
    dust.render(ctx);

    // Where the sun lands on screen, for the veiling glare.
    const s = terrain.sunDir;
    const vp = cam.viewProj;
    const cw = vp[3] * (eye[0] + s[0] * 1e5) + vp[7] * (eye[1] + s[1] * 1e5) + vp[11] * (eye[2] + s[2] * 1e5) + vp[15];
    const cx = vp[0] * (eye[0] + s[0] * 1e5) + vp[4] * (eye[1] + s[1] * 1e5) + vp[8] * (eye[2] + s[2] * 1e5) + vp[12];
    const cy = vp[1] * (eye[0] + s[0] * 1e5) + vp[5] * (eye[1] + s[1] * 1e5) + vp[9] * (eye[2] + s[2] * 1e5) + vp[13];
    const facing = basis.fwd[0] * s[0] + basis.fwd[1] * s[1] + basis.fwd[2] * s[2];
    const sunNdc = cw > 0 ? [cx / cw, cy / cw] : [0, 0];
    engine.present(sunNdc, facing > 0.1 ? clamp((facing - 0.1) * 1.4, 0, 1) : 0, ctx.time);

    /* ---- instruments ---- */
    hudState.mission = game.mission;
    hudState.missionProgress = game.missionProgress();
    hudState.missionTime = game.missionTime;
    hudState.sol = game.sol + Math.floor(game.missionTime / 3600);
    hudState.odometer = rover.odometer;
    hudState.power = game.power;
    hudState.integrity = rover.integrity;
    hudState.thermal = game.thermal;
    hudState.speed = rover.speed;
    hudState.heading = rover.heading;
    hudState.lastReturn = game.lastReturn;
    hudState.radarActive = game.radar.active;
    hudState.radarR = game.radar.r;
    hudState.armOut = armOut && rover.arm.out > 0.5;
    hudState.arrayOut = arrayOut;
    hudState.lamps = rover.lamps;
    hudState.relaysOnline = game.relaysOnline;
    hudState.camMode = CAM_MODES[cam.mode];
    hudState.interact = game.interact;
    hudState.bearings = bearings(game, layout, rover);
    hud.update(dt, hudState);

    input.end();
  }

  function bearings(g, lay, rov) {
    const out = [];
    const push = (p, color) => {
      out.push({ bearing: Math.atan2(p[0] - rov.pos[0], p[1] - rov.pos[2]), color });
    };
    if (g.relaysOnline < 3) push(lay.relays[Math.min(2, g.relaysOnline)], 'rgba(126,224,164,0.95)');
    push(lay.sled, 'rgba(245,182,74,0.85)');
    if (g.missionIndex >= 3) push(lay.station, 'rgba(238,244,248,0.9)');
    return out;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tick(dt);
    engine.governorTick(performance.now() - now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => writeSave(game.toJSON()));

  /* The whole running app, plus a way to advance one frame by hand —
     which is how every screenshot in the README was taken. */
  window.REGOLITH = {
    terrain, rover, props, game, cam, engine, hud, audio, sky, dust, solid, gl, layout, settings,
    input,
    tick: (dt = 1 / 60) => tick(dt),
    pause: (v) => { paused = v; }
  };
}
