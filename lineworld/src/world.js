// The forest.
//
// Three species of tree grown from recursive or whorled rules, undergrowth,
// glowing mushrooms, a stream cut through the hills with reeds along its banks,
// and a sky. Everything here is generated from the same seeded noise; nothing
// is loaded.

import * as THREE from 'three';
import {
  makeRng, terrainHeight, fbm2, WORLD_HALF,
  streamCenterZ, streamDist, waterLevel, CHANNEL_W,
} from './noise.js';
import { LineBuilder, GlowPoints, createLineMaterial, createGlowMaterial } from './render.js';

const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_COL = new THREE.Color();

const GROUND_COL = new THREE.Color(0.16, 0.30, 0.34);
const GROUND_COL_HI = new THREE.Color(0.30, 0.42, 0.40);
const TRUNK_COL = new THREE.Color(0.52, 0.60, 0.68);
const TWIG_COL = new THREE.Color(0.34, 0.62, 0.60);
const CONIFER_COL = new THREE.Color(0.30, 0.52, 0.62);
const NEEDLE_COL = new THREE.Color(0.22, 0.58, 0.52);
const BIRCH_COL = new THREE.Color(0.80, 0.86, 0.92);
const BIRCH_LEAF = new THREE.Color(0.52, 0.72, 0.66);
const GRASS_COL = new THREE.Color(0.18, 0.46, 0.36);
const BUSH_COL = new THREE.Color(0.20, 0.42, 0.32);
const ROCK_COL = new THREE.Color(0.40, 0.42, 0.52);
const WATER_COL = new THREE.Color(0.26, 0.66, 0.80);
const REED_COL = new THREE.Color(0.34, 0.58, 0.46);
const CAP_COL = new THREE.Color(0.55, 0.80, 0.95);

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

/** Broadleaf: recursive branching. Thresholds ramp with depth, so a tree
 *  sketches itself trunk-first as the lantern gets close. */
function growBranch(lb, origin, dir, len, depth, maxDepth, rng, opts) {
  const end = TMP_A.copy(dir).multiplyScalar(len).add(origin);
  const t = depth / maxDepth;
  const color = TMP_COL.copy(opts.trunk).lerp(opts.twig, t);
  const thresh = 0.04 + t * 0.20 + rng() * 0.05;
  const sway = opts.sway * Math.pow(t, 1.7);
  const seed = rng();
  lb.segment(origin, end, color, thresh, opts.sway * Math.pow(Math.max(0, t - 0.12), 1.7), sway, seed);

  if (depth >= maxDepth || len < 0.20) return;

  const children = depth === 0 ? 2 + (rng() < 0.6 ? 1 : 0) : (rng() < 0.34 ? 3 : 2);
  const endCopy = end.clone();
  for (let i = 0; i < children; i++) {
    const spread = opts.spread * (0.6 + rng() * 0.8) * (depth === 0 ? 0.5 : 1 + depth * 0.12);
    const yaw = (i / children) * Math.PI * 2 + rng() * 1.9 + depth * 1.3;
    const nd = dir.clone();
    const axis = TMP_B.set(Math.cos(yaw), 0, Math.sin(yaw)).cross(nd).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    nd.applyAxisAngle(axis, spread);
    nd.y += opts.upBias * (0.5 - rng() * 0.3);
    nd.normalize();
    growBranch(lb, endCopy, nd, len * (0.66 + rng() * 0.14), depth + 1, maxDepth, rng, opts);
  }
}

function addRoots(lb, base, x, z, rng, color, n = 3) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.6 + rng() * 1.1;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    TMP_A.set(px, terrainHeight(px, pz) - 0.05, pz);
    lb.segment(base, TMP_A, color, 0.05, 0, 0, rng());
  }
}

function addBroadleaf(lb, x, z, rng, scale = 1) {
  const base = V(x, terrainHeight(x, z) - 0.15, z);
  const dir = V((rng() - 0.5) * 0.14, 1, (rng() - 0.5) * 0.14).normalize();
  growBranch(lb, base, dir, (1.9 + rng() * 1.2) * scale, 0, 5 + (rng() < 0.45 ? 1 : 0), rng, {
    spread: 0.62 + rng() * 0.34,
    upBias: 0.06,
    sway: 0.20 * scale,
    trunk: TRUNK_COL,
    twig: TWIG_COL,
  });
  addRoots(lb, base, x, z, rng, TRUNK_COL);
  return 1.1 * scale;
}

/** Conifer: a straight bole with whorls of drooping branches. */
function addConifer(lb, x, z, rng, scale = 1) {
  const ground = terrainHeight(x, z);
  const h = (7.5 + rng() * 4.5) * scale;
  const lean = (rng() - 0.5) * 0.5;
  const segs = 9;
  let prev = V(x, ground - 0.15, z);
  const axis = (t) => V(x + lean * t * t, ground + h * t, z + lean * 0.6 * t * t);

  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = axis(t);
    lb.segment(prev, p, CONIFER_COL, 0.04 + t * 0.16, 0, 0.05 * t * scale, rng());
    prev = p;
  }
  addRoots(lb, V(x, ground - 0.15, z), x, z, rng, CONIFER_COL);

  const whorls = 8;
  for (let w = 0; w < whorls; w++) {
    const t = 0.22 + (w / whorls) * 0.76;
    const c = axis(t);
    const len = (2.5 * scale) * (1.05 - t) + 0.25;
    const n = 5 + ((rng() * 4) | 0);
    const thresh = 0.05 + t * 0.17 + rng() * 0.04;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.8 + w;
      const cos = Math.cos(a), sin = Math.sin(a);
      const mid = V(c.x + cos * len * 0.5, c.y - len * 0.09, c.z + sin * len * 0.5);
      const tip = V(c.x + cos * len, c.y - len * 0.40, c.z + sin * len);
      const sway = 0.06 * scale;
      lb.segment(c, mid, CONIFER_COL, thresh, 0, sway * 0.5, rng());
      lb.segment(mid, tip, NEEDLE_COL, thresh + 0.02, sway * 0.5, sway, rng());
      // a couple of needle sprays off the branch
      for (let s = 0; s < 2; s++) {
        const u = 0.45 + s * 0.32;
        const bp = V(c.x + cos * len * u, c.y - len * 0.09 - len * 0.31 * u, c.z + sin * len * u);
        const off = (rng() - 0.5) * 1.4;
        lb.segment(bp, V(
          bp.x + cos * 0.18 - sin * off * 0.35,
          bp.y - 0.28 * scale,
          bp.z + sin * 0.18 + cos * off * 0.35,
        ), NEEDLE_COL, thresh + 0.05, sway, sway, rng());
      }
    }
  }
  return 0.9 * scale;
}

/** Birch: pale, thin, bare until high up, with bark ticks down the trunk. */
function addBirch(lb, x, z, rng, scale = 1) {
  const ground = terrainHeight(x, z);
  const h = (6.5 + rng() * 3.5) * scale;
  const lean = (rng() - 0.5) * 1.3;
  const axis = (t) => V(x + lean * t * t, ground + h * t, z + lean * 0.5 * t * t);
  const segs = 10;
  let prev = V(x, ground - 0.15, z);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const p = axis(t);
    lb.segment(prev, p, BIRCH_COL, 0.03 + t * 0.14, 0, 0.06 * t * scale, rng());
    // bark ticks
    if (i < segs && rng() < 0.75) {
      const w = 0.10 * scale * (1 - t * 0.5);
      const a = rng() * Math.PI;
      lb.segment(
        V(p.x - Math.cos(a) * w, p.y - 0.1, p.z - Math.sin(a) * w),
        V(p.x + Math.cos(a) * w, p.y - 0.1, p.z + Math.sin(a) * w),
        BIRCH_COL, 0.04 + t * 0.14, 0, 0, rng(),
      );
    }
    prev = p;
  }
  addRoots(lb, V(x, ground - 0.15, z), x, z, rng, BIRCH_COL, 2);

  const crown = 4 + ((rng() * 3) | 0);
  for (let b = 0; b < crown; b++) {
    const t = 0.62 + rng() * 0.36;
    const c = axis(t);
    const a = rng() * Math.PI * 2;
    const len = (1.6 + rng() * 1.4) * scale;
    const dir = V(Math.cos(a) * 0.75, 0.5 + rng() * 0.5, Math.sin(a) * 0.75).normalize();
    growBranch(lb, c, dir, len, 2, 5, rng, {
      spread: 0.7, upBias: 0.12, sway: 0.24 * scale,
      trunk: BIRCH_COL, twig: BIRCH_LEAF,
    });
  }
  return 0.7 * scale;
}

// ---------------------------------------------------------------------------
// Undergrowth and props
// ---------------------------------------------------------------------------

function addRock(lb, x, z, rng) {
  const s = 0.5 + rng() * 1.4;
  const y = terrainHeight(x, z);
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
    pts.push(V(
      x + Math.sin(b) * Math.cos(a) * s,
      y + Math.abs(Math.cos(b)) * s * 0.7,
      z + Math.sin(b) * Math.sin(a) * s,
    ));
  }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (rng() < 0.45) lb.segment(pts[i], pts[j], ROCK_COL, 0.05 + rng() * 0.1, 0, 0, rng());
    }
  }
}

function addLog(lb, x, z, rng) {
  const a = rng() * Math.PI * 2;
  const len = 3 + rng() * 4;
  const rad = 0.28 + rng() * 0.22;
  const dx = Math.cos(a), dz = Math.sin(a);
  const rings = 5;
  const prev = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const px = x + dx * (t - 0.5) * len;
    const pz = z + dz * (t - 0.5) * len;
    const py = terrainHeight(px, pz) + rad;
    const ring = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      ring.push(V(
        px + -dz * Math.cos(ang) * rad,
        py + Math.sin(ang) * rad,
        pz + dx * Math.cos(ang) * rad,
      ));
    }
    for (let k = 0; k < 6; k++) lb.segment(ring[k], ring[(k + 1) % 6], TRUNK_COL, 0.06, 0, 0, rng());
    if (prev.length) for (let k = 0; k < 6; k++) lb.segment(prev[k], ring[k], TRUNK_COL, 0.06, 0, 0, rng());
    prev.length = 0; prev.push(...ring);
  }
}

function addGrassTuft(lb, x, z, rng) {
  const blades = 3 + ((rng() * 3) | 0);
  for (let b = 0; b < blades; b++) {
    const ox = x + (rng() - 0.5) * 1.1;
    const oz = z + (rng() - 0.5) * 1.1;
    const oy = terrainHeight(ox, oz);
    const h = 0.35 + rng() * 0.65;
    const lean = (rng() - 0.5) * 0.5;
    const leanZ = (rng() - 0.5) * 0.5;
    const seed = rng();
    const c = TMP_COL.copy(GRASS_COL).multiplyScalar(0.7 + rng() * 0.6);
    lb.segment(V(ox, oy, oz), V(ox + lean * 0.3, oy + h * 0.55, oz + leanZ * 0.3), c, 0.04, 0, 0.06, seed);
    lb.segment(V(ox + lean * 0.3, oy + h * 0.55, oz + leanZ * 0.3), V(ox + lean, oy + h, oz + leanZ), c, 0.05, 0.06, 0.16, seed);
  }
}

/** A low shrub: a fan of arcing stems. Fern variant adds side ticks. */
function addBush(lb, x, z, rng, fern = false) {
  const base = V(x, terrainHeight(x, z), z);
  const stems = fern ? 5 + ((rng() * 3) | 0) : 9 + ((rng() * 7) | 0);
  const size = (fern ? 1.0 : 0.7) * (0.7 + rng() * 0.8);
  for (let i = 0; i < stems; i++) {
    const a = rng() * Math.PI * 2;
    const len = size * (0.8 + rng() * 0.7);
    const rise = fern ? 0.45 : 0.85;
    const seed = rng();
    const mid = V(base.x + Math.cos(a) * len * 0.45, base.y + len * rise * 0.75, base.z + Math.sin(a) * len * 0.45);
    const tip = V(base.x + Math.cos(a) * len, base.y + len * rise, base.z + Math.sin(a) * len);
    lb.segment(base, mid, BUSH_COL, 0.05, 0, 0.07, seed);
    lb.segment(mid, tip, BUSH_COL, 0.06, 0.07, 0.17, seed);
    if (fern) {
      for (let k = 1; k <= 3; k++) {
        const u = k / 4;
        const p = mid.clone().lerp(tip, u);
        const side = (k % 2 ? 1 : -1) * 0.22 * size;
        lb.segment(p, V(p.x - Math.sin(a) * side, p.y + 0.06, p.z + Math.cos(a) * side),
          BUSH_COL, 0.07, 0.10, 0.16, seed);
      }
    }
  }
}

/** Glowing mushrooms. Returns their light positions for the glow pass. */
function addMushrooms(lb, x, z, rng, out) {
  const n = 3 + ((rng() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const px = x + (rng() - 0.5) * 1.6;
    const pz = z + (rng() - 0.5) * 1.6;
    const py = terrainHeight(px, pz);
    const h = 0.14 + rng() * 0.30;
    const r = 0.07 + rng() * 0.13;
    const top = V(px, py + h, pz);
    lb.segment(V(px, py, pz), top, CAP_COL, 0.03, 0, 0, rng());
    let prev = null;
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      const p = V(px + Math.cos(a) * r, py + h + Math.sin(a) * r * 0.5, pz);
      if (prev) lb.segment(prev, p, CAP_COL, 0.03, 0, 0, rng());
      prev = p;
    }
    prev = null;
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      const p = V(px, py + h + Math.sin(a) * r * 0.5, pz + Math.cos(a) * r);
      if (prev) lb.segment(prev, p, CAP_COL, 0.03, 0, 0, rng());
      prev = p;
    }
    out.push({ x: px, y: py + h + r * 0.3, z: pz, s: 0.18 + rng() * 0.22, p: rng() * 6.28 });
  }
}

function addReed(lb, x, z, rng) {
  const y = terrainHeight(x, z);
  const n = 2 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const ox = x + (rng() - 0.5) * 0.9, oz = z + (rng() - 0.5) * 0.9;
    const oy = terrainHeight(ox, oz);
    const h = 1.1 + rng() * 1.5;
    const lean = (rng() - 0.5) * 0.6;
    const seed = rng();
    const a = V(ox, oy, oz);
    const b = V(ox + lean * 0.3, oy + h * 0.6, oz + lean * 0.2);
    const c = V(ox + lean, oy + h, oz + lean * 0.7);
    lb.segment(a, b, REED_COL, 0.04, 0, 0.10, seed);
    lb.segment(b, c, REED_COL, 0.05, 0.10, 0.26, seed);
  }
  void y;
}

// ---------------------------------------------------------------------------

export function buildWorld(scene, opts = {}) {
  const rng = makeRng(opts.seed ?? 20260811);
  const material = createLineMaterial();
  const objects = [];
  const keepOut = opts.keepOut || [];
  const isClear = (x, z, r) => {
    for (const k of keepOut) {
      if ((x - k.x) ** 2 + (z - k.z) ** 2 < (k.r + r) ** 2) return false;
    }
    return true;
  };

  // ---- ground grid --------------------------------------------------------
  {
    const lb = new LineBuilder();
    const step = 2.2;
    const n = Math.floor((WORLD_HALF * 2) / step);
    const c = new THREE.Color();
    const put = (x0, z0, x1, z1) => {
      const y0 = terrainHeight(x0, z0), y1 = terrainHeight(x1, z1);
      TMP_A.set(x0, y0, z0); TMP_B.set(x1, y1, z1);
      const slope = Math.min(1, Math.abs(y1 - y0) / step * 1.6);
      c.copy(GROUND_COL).lerp(GROUND_COL_HI, slope);
      lb.segment(TMP_A, TMP_B, c, 0.03 + rng() * 0.05, 0, 0, 0);
    };
    for (let i = 0; i <= n; i++) {
      const x = -WORLD_HALF + i * step;
      for (let j = 0; j < n; j++) {
        const z0 = -WORLD_HALF + j * step;
        put(x, z0, x, z0 + step);
        put(z0, x, z0 + step, x);
      }
    }
    const ground = lb.build(material);
    ground.renderOrder = -1;
    scene.add(ground);
    objects.push(ground);
  }

  // ---- the stream ---------------------------------------------------------
  {
    const lb = new LineBuilder();
    const lanes = 13;
    const step = 2.0;
    const cols = Math.floor((WORLD_HALF * 2) / step);
    let prevCol = null;
    for (let ci = 0; ci <= cols; ci++) {
      const x = -WORLD_HALF + ci * step;
      const cz = streamCenterZ(x);
      const wl = waterLevel(x);
      const col = [];
      for (let li = 0; li < lanes; li++) {
        const off = (li / (lanes - 1) - 0.5) * 2 * CHANNEL_W * 0.94;
        const z = cz + off + Math.sin(x * 0.29 + li * 1.7) * 0.35;
        col.push(terrainHeight(x, z) < wl - 0.04
          ? V(x, wl + Math.sin(x * 0.6 + li) * 0.02, z)
          : null);
      }
      // along the flow, and across it: a surface rather than a bundle of lines
      for (let li = 0; li < lanes; li++) {
        const sway = 0.16 + 0.10 * Math.sin(li * 1.3);
        const seed = (li * 13 + ci) * 0.017;
        if (col[li] && col[li + 1]) lb.segment(col[li], col[li + 1], WATER_COL, 0.03, sway, sway, seed);
        if (prevCol && prevCol[li] && col[li]) lb.segment(prevCol[li], col[li], WATER_COL, 0.03, sway, sway, seed);
      }
      // a few brighter ripple dashes riding on top
      if (rng() < 0.5) {
        const li = 1 + ((rng() * (lanes - 2)) | 0);
        if (col[li] && col[li + 1]) {
          const a = col[li].clone(); a.y += 0.05;
          const b = col[li + 1].clone(); b.y += 0.05;
          lb.segment(a, b, WATER_COL, 0.03, 0.30, 0.30, rng());
        }
      }
      prevCol = col;
    }
    const water = lb.build(material);
    scene.add(water);
    objects.push(water);
  }

  // ---- trees --------------------------------------------------------------
  const trees = [];
  {
    const lb = new LineBuilder();
    const plant = (x, z, scale) => {
      // biome map: conifer stands, birch groves, broadleaf everywhere else
      const b = fbm2(x * 0.0062 + 13, z * 0.0062 - 7, 2, 777);
      let r;
      if (b < 0.40) r = addConifer(lb, x, z, rng, scale * 1.05);
      else if (b > 0.66) r = addBirch(lb, x, z, rng, scale);
      else r = addBroadleaf(lb, x, z, rng, scale);
      trees.push({ x, z, r });
    };

    let placed = 0, guard = 0;
    while (placed < 760 && guard < 90000) {
      guard++;
      const x = (rng() * 2 - 1) * (WORLD_HALF - 8);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 8);
      const d = Math.hypot(x, z);
      const density = fbm2(x * 0.017, z * 0.017, 3, 5);
      if (rng() > density * 1.7) continue;
      if (d < 10) continue;                            // the waking clearing
      if (streamDist(x, z) < CHANNEL_W * 1.25) continue; // not in the water
      if (!isClear(x, z, 6)) continue;
      let tooClose = false;
      for (const t of trees) {
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < 30) { tooClose = true; break; }
      }
      if (tooClose) continue;
      plant(x, z, 0.7 + rng() * 0.8);
      placed++;
    }

    // the boundary closes in
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2 + rng() * 0.04;
      const r = WORLD_HALF - 4 - rng() * 10;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (streamDist(x, z) < CHANNEL_W * 1.2) continue;
      plant(x, z, 1.2 + rng() * 0.5);
    }

    for (let i = 0; i < 110; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 10);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 10);
      if (Math.hypot(x, z) < 10 || !isClear(x, z, 4)) continue;
      // rocks like the water's edge
      if (streamDist(x, z) < CHANNEL_W * 0.9 && rng() < 0.7) continue;
      addRock(lb, x, z, rng);
    }
    for (let i = 0; i < 30; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 14);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 14);
      if (Math.hypot(x, z) < 12 || !isClear(x, z, 6)) continue;
      if (streamDist(x, z) < CHANNEL_W) continue;
      addLog(lb, x, z, rng);
    }

    const forest = lb.build(material);
    scene.add(forest);
    objects.push(forest);
  }

  // ---- undergrowth --------------------------------------------------------
  const mushroomLights = [];
  {
    const lb = new LineBuilder();

    for (let i = 0; i < 7000; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 3);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 3);
      if (streamDist(x, z) < CHANNEL_W * 0.85) continue;
      const density = fbm2(x * 0.03 + 40, z * 0.03 - 12, 2, 91);
      if (rng() > density * 1.5) continue;
      addGrassTuft(lb, x, z, rng);
    }

    // shrubs and ferns, thickest near the trees
    for (let i = 0; i < 900; i++) {
      const t = trees[(rng() * trees.length) | 0];
      if (!t) break;
      const a = rng() * Math.PI * 2;
      const r = 1.6 + rng() * 5.5;
      const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      if (Math.abs(x) > WORLD_HALF - 4 || Math.abs(z) > WORLD_HALF - 4) continue;
      if (streamDist(x, z) < CHANNEL_W * 0.95) continue;
      addBush(lb, x, z, rng, rng() < 0.4);
    }

    // mushrooms, in damp places: near logs, near the water, in the deep shade
    for (let i = 0; i < 260; i++) {
      const t = trees[(rng() * trees.length) | 0];
      if (!t) break;
      const a = rng() * Math.PI * 2;
      const r = 1.2 + rng() * 3.2;
      const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      if (streamDist(x, z) < CHANNEL_W * 0.9) continue;
      addMushrooms(lb, x, z, rng, mushroomLights);
    }

    // reeds along both banks
    for (let x = -WORLD_HALF; x <= WORLD_HALF; x += 1.4) {
      const cz = streamCenterZ(x);
      for (const side of [-1, 1]) {
        if (rng() < 0.45) continue;
        const z = cz + side * (CHANNEL_W * (0.75 + rng() * 0.5));
        addReed(lb, x + (rng() - 0.5), z, rng);
      }
    }

    const under = lb.build(material);
    scene.add(under);
    objects.push(under);
  }

  // ---- mushroom glow ------------------------------------------------------
  {
    const pts = new GlowPoints(Math.max(1, mushroomLights.length), createGlowMaterial({ lit: false }));
    for (const m of mushroomLights) {
      pts.push(m.x, m.y, m.z, 0.35, 0.75, 0.95, m.s, 0.30);
    }
    pts.commit();
    scene.add(pts.points);
    objects.push(pts.points);
  }

  // ---- sky ----------------------------------------------------------------
  {
    const R = 620;
    const stars = new GlowPoints(760, createGlowMaterial({ lit: false }));
    for (let i = 0; i < 750; i++) {
      const a = rng() * Math.PI * 2;
      const y = Math.pow(rng(), 0.7);
      const r = Math.sqrt(1 - y * y);
      const warm = rng();
      stars.push(
        Math.cos(a) * r * R, y * R + 40, Math.sin(a) * r * R,
        0.75 + warm * 0.25, 0.80 + warm * 0.12, 1.0,
        2.2 + rng() * 5.5, 0.05 + rng() * 0.16,
      );
    }
    // one pale moon, low over the trees, so the sky has a direction
    stars.push(-0.42 * R, 0.36 * R, 0.82 * R, 0.86, 0.90, 1.0, 26, 0.30);
    stars.commit();
    stars.points.renderOrder = -2;
    scene.add(stars.points);
    objects.push(stars.points);
  }

  return { objects, material, trees };
}

/** Cheap circle-vs-trunk collision so you cannot walk through a tree. */
export function resolveCollisions(trees, pos, radius = 0.55) {
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const dx = pos.x - t.x, dz = pos.z - t.z;
    const min = t.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = t.x + (dx / d) * min;
      pos.z = t.z + (dz / d) * min;
    }
  }
  const lim = WORLD_HALF - 6;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}
