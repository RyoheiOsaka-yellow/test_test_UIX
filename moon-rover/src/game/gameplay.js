/* ============================================================
   GAMEPLAY — the subsurface, radar, drill, power, missions

   The cyan wavefront on the ground is not a decal. It is a real query
   against the same subsurface field the drill pulls cores out of, run
   once per metre of expansion, and what the scope draws is what the
   query returned.
   ============================================================ */

import { CODEX, SAMPLES, buildMissions } from './lore.js';
import { fbm2, hash2 } from '../core/rng.js';
import { clamp, smoothstep, v3, v3dist } from '../core/math.js';

const RADAR_RANGE = 78;
const RADAR_SPEED = 34;          // m/s of wavefront expansion
const RADAR_COST = 0.06;         // fraction of the pack
const DRILL_COST = 0.09;
const DRILL_TIME = 2.6;
const PACK_WH = 1.0;             // normalised; the numbers people read are percentages
const LAMP_DRAIN = 1 / 150;      // pack fractions per second
const IDLE_DRAIN = 1 / 900;
const ARRAY_CHARGE = 1 / 220;

/* ---------- the subsurface ----------
   A field, not a list of pickups. Every point under the basin has a
   layer structure, and both the radar and the drill read it. */
export function makeSubsurface(seed, layout) {
  const [lx, lz] = layout.lattice;
  const [sx, sz] = layout.shaft;

  return function query(x, z) {
    // Depth to bedrock: the regolith blanket is thinner on crater rims.
    const blanket = 3.2 + fbm2(x * 0.006, z * 0.006, 3, seed + 5) * 2.4;

    // The lattice: a broad lobe centred on the anomaly, with a second
    // arm reaching toward the shaft. Coherent, hexagonal, and stacked.
    const dl = Math.hypot(x - lx, z - lz);
    const ds = Math.hypot(x - sx, z - sz);
    const arm = Math.abs((x - lx) * (sz - lz) - (z - lz) * (sx - lx)) /
      (Math.hypot(sx - lx, sz - lz) || 1);
    const along = clamp(((x - lx) * (sx - lx) + (z - lz) * (sz - lz)) /
      (Math.pow(sx - lx, 2) + Math.pow(sz - lz, 2) || 1), 0, 1);
    let lattice = Math.max(
      1 - smoothstep(24, 96, dl),
      (1 - smoothstep(10, 46, arm)) * (along > 0.02 && along < 0.98 ? 0.72 : 0),
      1 - smoothstep(10, 52, ds)
    );
    lattice *= 0.55 + 0.45 * fbm2(x * 0.05, z * 0.05, 3, seed + 71);

    // Buried blocks: hard single hyperbolas, the boring correct answer.
    const bx = Math.floor(x / 17), bz = Math.floor(z / 17);
    const hb = hash2(bx, bz, seed + 313);
    let block = 0, blockDepth = 0;
    if (hb < 0.22) {
      const cx = (bx + hash2(bx, bz, seed + 401)) * 17;
      const cz = (bz + hash2(bx, bz, seed + 409)) * 17;
      const rr = 1.2 + hash2(bx, bz, seed + 417) * 3.4;
      const d = Math.hypot(x - cx, z - cz);
      block = 1 - smoothstep(rr * 0.6, rr, d);
      blockDepth = 1.4 + hash2(bx, bz, seed + 421) * 3.2;
    }

    // Volatiles survive only where the sun has not been in a long time.
    const cold = fbm2(x * 0.004, z * 0.004, 2, seed + 611);

    return {
      blanket,
      lattice,
      latticeDepth: 4.1 - lattice * 1.1,
      block, blockDepth,
      cold
    };
  };
}

/* Which core comes up, given where you drilled. */
function pickSample(sub, terrain, x, z, seed) {
  if (sub.lattice > 0.42) return 'lattice';
  const shaded = terrain.sunLight(x, z) < 0.08 && sub.cold > 0.25;
  if (shaded) return 'volatile';
  if (sub.block > 0.55) return 'breccia';
  const h = hash2(Math.floor(x * 0.5), Math.floor(z * 0.5), seed + 77);
  const slope = 1 - terrain.normal(x, z)[1];
  if (slope > 0.20) return 'anorthosite';
  if (h < 0.16) return 'glass';
  if (h < 0.32) return 'ilmenite';
  if (h < 0.62) return 'agglutinate';
  return 'mare';
}

export class Gameplay {
  constructor(terrain, rover, props, dust, layout, seed) {
    this.terrain = terrain;
    this.rover = rover;
    this.props = props;
    this.dust = dust;
    this.layout = layout;
    this.seed = seed;
    this.sub = makeSubsurface(seed, layout);

    this.power = 1;
    this.thermal = -18;
    this.missionTime = 0;
    this.sol = 215;

    this.radar = { active: false, r: 0, origin: [0, 0], strength: 0, cooldown: 0 };
    this.trace = new Float32Array(96);     // depth of the strongest return per bin
    this.traceKind = new Uint8Array(96);   // 0 none, 1 block, 2 lattice, 3 ice
    this.lastReturn = 'NO RETURN';
    this.radarCount = 0;

    this.drill = { active: false, t: 0, x: 0, z: 0 };
    this.samples = [];                     // ids, in the order collected
    this.sampleSet = new Set();

    this.relaysOnline = 0;
    this.interact = { available: null, hold: 0 };

    this.codex = new Set(CODEX.filter((c) => c.start).map((c) => c.id));
    this.codexNew = new Set();
    this.missions = buildMissions(layout);
    this.missionIndex = 0;
    this.progress = { drive: 0, radar: 0, samples: 0, visited: new Set(), radarAt: new Set() };
    this.complete = false;

    this.events = [];                      // consumed by the HUD and audio
    this._lastOdo = 0;
  }

  emit(type, text, tone = '') { this.events.push({ type, text, tone }); }

  unlockCodex(ids) {
    for (const id of ids) {
      if (this.codex.has(id)) continue;
      this.codex.add(id);
      this.codexNew.add(id);
      const e = CODEX.find((c) => c.id === id);
      if (e) this.emit('codex', `CODEX · ${e.title}`, 'good');
    }
  }

  get mission() { return this.missions[this.missionIndex] || null; }

  /* ---------- actions ---------- */

  fireRadar() {
    if (this.radar.active || this.radar.cooldown > 0) return false;
    if (this.power < RADAR_COST) { this.emit('deny', 'PACK TOO LOW FOR GPR', 'warn'); return false; }
    this.power -= RADAR_COST;
    this.radar.active = true;
    this.radar.r = 0.5;
    this.radar.strength = 1;
    this.radar.origin = [this.rover.pos[0], this.rover.pos[2]];
    this.trace.fill(0);
    this.traceKind.fill(0);
    this.radarCount++;
    this.progress.radar++;
    this.emit('radar', 'GPR SWEEP · 400 MHz');
    return true;
  }

  startDrill() {
    const a = this.rover.arm;
    if (this.rover.arm.out < 0.7) { this.emit('deny', 'DEPLOY ARM FIRST (R)', 'warn'); return false; }
    if (this.drill.active) return false;
    if (this.power < DRILL_COST) { this.emit('deny', 'PACK TOO LOW FOR CORING', 'warn'); return false; }
    if (this.samples.length >= 9) { this.emit('deny', 'SAMPLE BAY FULL', 'warn'); return false; }
    this.drill.active = true;
    this.drill.t = 0;
    this.drill.x = a.aim[0];
    this.drill.z = a.aim[2];
    return true;
  }

  deployBeacon() {
    const r = this.rover;
    if (this.props.beacons.length >= 6) { this.emit('deny', 'NO BEACONS REMAINING', 'warn'); return; }
    const n = this.props.dropBeacon(r.pos[0] - r.forward[0] * 2.4, r.pos[2] - r.forward[2] * 2.4);
    this.emit('beacon', `BEACON ${n} DEPLOYED`, 'good');
  }

  /* ---------- per-frame ---------- */

  update(dt, ctrl) {
    const R = this.rover, T = this.terrain;
    this.missionTime += dt;

    /* power */
    const lit = T.sunLight(R.pos[0], R.pos[2]);
    const arrayUp = R.array.out > 0.8 ? 1 : R.array.out;
    this.power += lit * arrayUp * ARRAY_CHARGE * dt;
    this.power -= IDLE_DRAIN * dt;
    if (R.lamps) this.power -= LAMP_DRAIN * dt;
    this.power = clamp(this.power, 0, PACK_WH);
    // Thermal: sunlit and working runs hot, shadow runs cold.
    const target = -32 + lit * 46 + R.motorLoad * 22;
    this.thermal += (target - this.thermal) * (1 - Math.exp(-0.12 * dt));

    /* radar */
    const rad = this.radar;
    if (rad.cooldown > 0) rad.cooldown -= dt;
    if (rad.active) {
      const prev = rad.r;
      rad.r += RADAR_SPEED * dt;
      rad.strength = 1 - smoothstep(RADAR_RANGE * 0.6, RADAR_RANGE, rad.r);
      this._sampleRadar(prev, rad.r);
      if (rad.r >= RADAR_RANGE) {
        rad.active = false;
        rad.strength = 0;
        rad.cooldown = 1.4;
        this._reportRadar();
      }
    }

    /* drill */
    if (this.drill.active) {
      this.drill.t += dt;
      R.arm.drill = 0.6 + Math.sin(this.drill.t * 26) * 0.4;
      if (this.dust && Math.random() < 0.6) {
        this.dust.burst(this.drill.x, T.height(this.drill.x, this.drill.z), this.drill.z, 1, 1.1);
      }
      // The bit takes material out of the field it is standing in.
      T.excavate(this.drill.x, this.drill.z, 0.16, 0.10 * (this.drill.t / DRILL_TIME), 0.12 * dt);
      if (this.drill.t >= DRILL_TIME) {
        this.drill.active = false;
        R.arm.drill = 0;
        this.power -= DRILL_COST;
        this._collectSample(this.drill.x, this.drill.z);
      }
    }

    /* interaction targets */
    this._updateInteract(dt, ctrl);

    /* missions */
    this.progress.drive += Math.max(0, R.odometer - this._lastOdo);
    this._lastOdo = R.odometer;
    this._checkMission();
  }

  _sampleRadar(r0, r1) {
    // One query per metre of expansion, in eight directions. That is
    // enough to fill the scope and cheap enough to do every frame.
    const [ox, oz] = this.radar.origin;
    const step = 1.0;
    for (let r = Math.ceil(r0 / step) * step; r <= r1; r += step) {
      const bin = Math.min(this.trace.length - 1, Math.floor((r / RADAR_RANGE) * this.trace.length));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + r * 0.11;
        const s = this.sub(ox + Math.cos(a) * r, oz + Math.sin(a) * r);
        let depth = 0, kind = 0, str = 0;
        if (s.lattice > 0.3) { depth = s.latticeDepth; kind = 2; str = s.lattice; }
        if (s.block > 0.5 && s.block > str) { depth = s.blockDepth; kind = 1; str = s.block; }
        if (kind === 0 && s.cold > 0.34 && this.terrain.sunLight(ox + Math.cos(a) * r, oz + Math.sin(a) * r) < 0.1) {
          depth = 1.8; kind = 3; str = 0.5;
        }
        if (str > 0 && (this.traceKind[bin] === 0 || kind === 2)) {
          this.trace[bin] = depth;
          this.traceKind[bin] = kind;
        }
      }
    }
  }

  _reportRadar() {
    let lattice = 0, block = 0, ice = 0;
    for (let i = 0; i < this.traceKind.length; i++) {
      if (this.traceKind[i] === 2) lattice++;
      else if (this.traceKind[i] === 1) block++;
      else if (this.traceKind[i] === 3) ice++;
    }
    if (lattice > 6) {
      this.lastReturn = 'HEXAGONAL LATTICE · 4.1 m';
      this.emit('banner', 'COHERENT SUBSURFACE RETURN', 'good');
      this.unlockCodex(['first-return']);
      // Where you got it matters for the last mission.
      const [sx, sz] = this.layout.shaft;
      if (Math.hypot(this.radar.origin[0] - sx, this.radar.origin[1] - sz) < 60) {
        this.progress.radarAt.add('shaft');
      }
    } else if (ice > 4) this.lastReturn = 'LOW-VELOCITY SMEAR · 1.8 m';
    else if (block > 3) this.lastReturn = 'BURIED BLOCK · HYPERBOLA';
    else this.lastReturn = 'REGOLITH ONLY';
  }

  _collectSample(x, z) {
    const s = this.sub(x, z);
    const id = pickSample(s, this.terrain, x, z, this.seed);
    const def = SAMPLES.find((d) => d.id === id);
    this.samples.push(id);
    const isNew = !this.sampleSet.has(id);
    this.sampleSet.add(id);
    this.progress.samples++;
    if (id === 'lattice') {
      this.progress.latticeCore = true;
      this.unlockCodex(['lattice']);
      this.emit('banner', 'VITRIFIED LATTICE', 'good');
    } else {
      this.emit('sample', `CORE · ${def.name}${isNew ? ' (NEW)' : ''}`, 'good');
    }
    if (this.dust) this.dust.burst(x, this.terrain.height(x, z) + 0.1, z, 14, 1.6);
  }

  /* What is within reach, and what holding E would do about it. */
  _updateInteract(dt, ctrl) {
    const R = this.rover;
    let best = null, bestD = 6.5;
    for (let i = 0; i < this.layout.relays.length; i++) {
      if (i !== this.relaysOnline) continue;         // must be raised in order
      const [x, z] = this.layout.relays[i];
      const d = Math.hypot(R.pos[0] - x, R.pos[2] - z);
      if (d < bestD) { bestD = d; best = { kind: 'relay', index: i, label: `RAISE RELAY ${i + 1}` }; }
    }
    const [stx, stz] = this.layout.station;
    const dSt = Math.hypot(R.pos[0] - stx, R.pos[2] - stz);
    if (dSt < 14 && !this.progress.visited.has('station')) {
      best = { kind: 'station', label: 'SURVEY EXTERIOR' }; bestD = dSt;
    }
    const [shx, shz] = this.layout.shaft;
    const dSh = Math.hypot(R.pos[0] - shx, R.pos[2] - shz);
    if (dSh < 12 && !this.progress.visited.has('shaft')) {
      best = { kind: 'shaft', label: 'EXAMINE THE SHAFT' }; bestD = dSh;
    }

    this.interact.available = best;
    if (!best || !ctrl.interact || R.speed > 0.9) {
      this.interact.hold = Math.max(0, this.interact.hold - dt * 2.4);
      return;
    }
    this.interact.hold += dt / 1.6;
    if (this.interact.hold >= 1) {
      this.interact.hold = 0;
      this._doInteract(best);
    }
  }

  _doInteract(target) {
    if (target.kind === 'relay') {
      this.relaysOnline++;
      this.emit('relay', `RELAY ${target.index + 1} ONLINE`, 'good');
      if (this.relaysOnline === 3) this.emit('banner', 'LINK RESTORED', 'good');
    } else if (target.kind === 'station') {
      this.progress.visited.add('station');
      this.unlockCodex(['beacon9']);
      this.emit('banner', 'BEACON-9', 'good');
    } else if (target.kind === 'shaft') {
      this.progress.visited.add('shaft');
      this.unlockCodex(['shaft']);
      this.emit('banner', 'THE SHAFT', 'good');
    }
  }

  _checkMission() {
    const m = this.mission;
    if (!m) return;
    const g = m.goal;
    let ok = true;
    if (g.drive !== undefined && this.progress.drive < g.drive) ok = false;
    if (g.radar !== undefined && this.progress.radar < g.radar) ok = false;
    if (g.samples !== undefined && this.progress.samples < g.samples) ok = false;
    if (g.sampleAt && !this.progress.latticeCore) ok = false;
    if (g.relays !== undefined && this.relaysOnline < g.relays) ok = false;
    if (g.visit) {
      const key = m.id;
      const d = Math.hypot(this.rover.pos[0] - g.visit.pos[0], this.rover.pos[2] - g.visit.pos[1]);
      if (d < g.visit.radius) this.progress.visited.add(key);
      if (!this.progress.visited.has(key) && !this.progress.visited.has(m.id === 'station' ? 'station' : 'shaft')) ok = false;
    }
    if (g.radarAt && !this.progress.radarAt.has('shaft')) ok = false;
    if (!ok) return;

    this.unlockCodex(m.unlock || []);
    this.emit('banner', m.done, 'good');
    this.missionIndex++;
    if (m.final) {
      this.complete = true;
      this.emit('ending', 'THE SILENCE AT ANAXAGORAS');
    }
  }

  /* 0..1 for the objective bar. */
  missionProgress() {
    const m = this.mission;
    if (!m) return 1;
    const g = m.goal;
    const parts = [];
    if (g.drive !== undefined) parts.push(clamp(this.progress.drive / g.drive, 0, 1));
    if (g.radar !== undefined) parts.push(clamp(this.progress.radar / g.radar, 0, 1));
    if (g.samples !== undefined) parts.push(clamp(this.progress.samples / g.samples, 0, 1));
    if (g.sampleAt) parts.push(this.progress.latticeCore ? 1 : 0);
    if (g.relays !== undefined) parts.push(clamp(this.relaysOnline / g.relays, 0, 1));
    if (g.visit) parts.push(this.progress.visited.has(m.id === 'station' ? 'station' : 'shaft') ? 1 : 0);
    if (g.radarAt) parts.push(this.progress.radarAt.has('shaft') ? 1 : 0);
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  }

  toJSON() {
    return {
      seed: this.seed,
      pos: [this.rover.pos[0], this.rover.pos[2]],
      heading: this.rover.heading,
      odometer: this.rover.odometer,
      power: this.power,
      integrity: this.rover.integrity,
      missionTime: this.missionTime,
      missionIndex: this.missionIndex,
      relaysOnline: this.relaysOnline,
      samples: this.samples,
      codex: [...this.codex],
      beacons: this.props.beacons.map((b) => [b.x, b.z]),
      progress: {
        drive: this.progress.drive,
        radar: this.progress.radar,
        samples: this.progress.samples,
        latticeCore: !!this.progress.latticeCore,
        visited: [...this.progress.visited],
        radarAt: [...this.progress.radarAt]
      }
    };
  }

  restore(d) {
    if (!d || d.seed !== this.seed) return false;
    this.rover.placeAt(d.pos[0], d.pos[1], d.heading || 0);
    this.rover.odometer = d.odometer || 0;
    this.rover.integrity = d.integrity ?? 1;
    this.power = d.power ?? 1;
    this.missionTime = d.missionTime || 0;
    this.missionIndex = Math.min(d.missionIndex || 0, this.missions.length);
    this.relaysOnline = d.relaysOnline || 0;
    this.samples = d.samples || [];
    this.sampleSet = new Set(this.samples);
    this.codex = new Set(d.codex && d.codex.length ? d.codex : [...this.codex]);
    for (const [x, z] of d.beacons || []) this.props.dropBeacon(x, z);
    const p = d.progress || {};
    this.progress.drive = p.drive || 0;
    this.progress.radar = p.radar || 0;
    this.progress.samples = p.samples || 0;
    this.progress.latticeCore = !!p.latticeCore;
    this.progress.visited = new Set(p.visited || []);
    this.progress.radarAt = new Set(p.radarAt || []);
    this._lastOdo = this.rover.odometer;
    this.complete = this.missionIndex >= this.missions.length;
    return true;
  }
}

export { RADAR_RANGE, v3, v3dist };
