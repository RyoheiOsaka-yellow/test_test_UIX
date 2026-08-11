// The forest. Every tree is grown from a recursive branching rule, every blade
// of grass is three line segments, and the ground is a wireframe grid displaced
// by the same noise the rest of the game reads for height. Nothing is loaded.

import * as THREE from 'three';
import { makeRng, terrainHeight, fbm2, WORLD_HALF } from './noise.js';
import { LineBuilder, createLineMaterial } from './render.js';

const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();

const GROUND_COL = new THREE.Color(0.16, 0.30, 0.34);
const GROUND_COL_HI = new THREE.Color(0.30, 0.42, 0.40);
const TRUNK_COL = new THREE.Color(0.52, 0.60, 0.68);
const TWIG_COL = new THREE.Color(0.34, 0.62, 0.60);
const GRASS_COL = new THREE.Color(0.18, 0.46, 0.36);
const ROCK_COL = new THREE.Color(0.40, 0.42, 0.52);

/**
 * Recursive line tree. Returns segments appended into `lb`.
 * The threshold ramps with depth so a tree draws itself trunk-first as the
 * lantern gets close, then throws out its branches.
 */
function growBranch(lb, origin, dir, len, depth, maxDepth, rng, opts) {
  const end = TMP_A.copy(dir).multiplyScalar(len).add(origin);
  const t = depth / maxDepth;
  const color = TMP_COL.copy(TRUNK_COL).lerp(TWIG_COL, t);
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
    // tilt away from the parent direction, then spin around it
    const axis = TMP_B.set(Math.cos(yaw), 0, Math.sin(yaw)).cross(nd).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    nd.applyAxisAngle(axis, spread);
    nd.y += opts.upBias * (0.5 - rng() * 0.3);
    nd.normalize();
    growBranch(lb, endCopy, nd, len * (0.66 + rng() * 0.14), depth + 1, maxDepth, rng, opts);
  }
}
const TMP_COL = new THREE.Color();

function addTree(lb, x, z, rng, scale = 1) {
  const base = new THREE.Vector3(x, terrainHeight(x, z) - 0.15, z);
  const dir = new THREE.Vector3((rng() - 0.5) * 0.14, 1, (rng() - 0.5) * 0.14).normalize();
  const maxDepth = 5 + (rng() < 0.45 ? 1 : 0);
  growBranch(lb, base, dir, (1.9 + rng() * 1.2) * scale, 0, maxDepth, rng, {
    spread: 0.62 + rng() * 0.34,
    upBias: 0.06,
    sway: 0.20 * scale,
  });
  // A few root lines so trunks meet the ground instead of hovering.
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.6 + rng() * 1.1;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    TMP_A.set(px, terrainHeight(px, pz) - 0.05, pz);
    lb.segment(base, TMP_A, TRUNK_COL, 0.05, 0, 0, rng());
  }
}

function addRock(lb, x, z, rng) {
  const s = 0.5 + rng() * 1.4;
  const y = terrainHeight(x, z);
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
    pts.push(new THREE.Vector3(
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
      ring.push(new THREE.Vector3(
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
    const p0 = new THREE.Vector3(ox, oy, oz);
    const p1 = new THREE.Vector3(ox + lean * 0.3, oy + h * 0.55, oz + leanZ * 0.3);
    const p2 = new THREE.Vector3(ox + lean, oy + h, oz + leanZ);
    const c = TMP_COL.copy(GRASS_COL).multiplyScalar(0.7 + rng() * 0.6);
    lb.segment(p0, p1, c, 0.04, 0, 0.06, seed);
    lb.segment(p1, p2, c, 0.05, 0.06, 0.16, seed);
  }
}

export function buildWorld(scene, opts = {}) {
  const rng = makeRng(opts.seed ?? 20260811);
  const material = createLineMaterial();
  const objects = [];

  // ---- ground grid --------------------------------------------------------
  {
    const lb = new LineBuilder();
    const step = 2.2;
    const n = Math.floor((WORLD_HALF * 2) / step);
    const c = new THREE.Color();
    const heightAt = (x, z) => terrainHeight(x, z);
    const put = (x0, z0, x1, z1) => {
      const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1);
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

  // ---- trees, rocks, logs -------------------------------------------------
  const trees = [];
  {
    const lb = new LineBuilder();
    const keepOut = opts.keepOut || [];
    const isClear = (x, z, r) => {
      for (const k of keepOut) {
        if ((x - k.x) ** 2 + (z - k.z) ** 2 < (k.r + r) ** 2) return false;
      }
      return true;
    };

    let placed = 0, guard = 0;
    while (placed < 700 && guard < 90000) {
      guard++;
      const x = (rng() * 2 - 1) * (WORLD_HALF - 8);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 8);
      const d = Math.hypot(x, z);
      // density mask -- clearings and thickets rather than an even scatter
      const density = fbm2(x * 0.017, z * 0.017, 3, 5);
      if (rng() > density * 1.7) continue;
      if (d < 10) continue;                       // the waking clearing
      if (!isClear(x, z, 6)) continue;
      let tooClose = false;
      for (const t of trees) {
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < 30) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const scale = 0.7 + rng() * 0.8;
      addTree(lb, x, z, rng, scale);
      trees.push({ x, z, r: 1.1 * scale });
      placed++;
    }

    // A ring of denser, taller trees at the boundary: the forest closes in.
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * Math.PI * 2 + rng() * 0.04;
      const r = WORLD_HALF - 4 - rng() * 10;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      addTree(lb, x, z, rng, 1.2 + rng() * 0.5);
      trees.push({ x, z, r: 1.5 });
    }

    for (let i = 0; i < 90; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 10);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 10);
      if (Math.hypot(x, z) < 10 || !isClear(x, z, 4)) continue;
      addRock(lb, x, z, rng);
    }
    for (let i = 0; i < 26; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 14);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 14);
      if (Math.hypot(x, z) < 12 || !isClear(x, z, 6)) continue;
      addLog(lb, x, z, rng);
    }

    const forest = lb.build(material);
    scene.add(forest);
    objects.push(forest);
  }

  // ---- grass --------------------------------------------------------------
  {
    const lb = new LineBuilder();
    for (let i = 0; i < 7000; i++) {
      const x = (rng() * 2 - 1) * (WORLD_HALF - 3);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 3);
      const density = fbm2(x * 0.03 + 40, z * 0.03 - 12, 2, 91);
      if (rng() > density * 1.5) continue;
      addGrassTuft(lb, x, z, rng);
    }
    const grass = lb.build(material);
    scene.add(grass);
    objects.push(grass);
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
