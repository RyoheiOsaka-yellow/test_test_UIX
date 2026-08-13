/**
 * Transverse-section geometry used by the L1 (free-trim, large-angle) engine.
 *
 * A station is turned into a closed polygon in the (y, z) plane. Immersion at
 * an arbitrary attitude is then a half-plane clip of that polygon, and the
 * immersed area and its centroid follow from the shoelace formulas. Because
 * the clip is exact for a piecewise-linear section, the only approximation
 * left in the L1 engine is the integration along the ship's length.
 */

import type { Station } from './types.js';

export interface P2 {
  y: number;
  z: number;
}

export interface AreaCentroid {
  /** Immersed area of the section [m²] */
  area: number;
  /** Transverse centroid [m] */
  cy: number;
  /** Vertical centroid above baseline [m] */
  cz: number;
}

const EPS = 1e-12;

/**
 * Closed section polygon: up the starboard side, across the deck, down the
 * port side. The closing edge (port keel → starboard keel) forms the bottom,
 * which is what gives flat-bottomed sections their area.
 */
export function stationPolygon(station: Station): P2[] {
  const offs = station.offsets;
  const pts: P2[] = [];
  for (const o of offs) pts.push({ y: o.y, z: o.z });
  for (let i = offs.length - 1; i >= 0; i--) pts.push({ y: -offs[i].y, z: offs[i].z });
  return dedupe(pts);
}

/** Axis-aligned rectangle as a polygon (used for box tanks). */
export function rectPolygon(y0: number, y1: number, z0: number, z1: number): P2[] {
  return [
    { y: y0, z: z0 },
    { y: y1, z: z0 },
    { y: y1, z: z1 },
    { y: y0, z: z1 },
  ];
}

function dedupe(pts: P2[]): P2[] {
  const out: P2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - p.y) < 1e-12 && Math.abs(last.z - p.z) < 1e-12) continue;
    out.push(p);
  }
  while (
    out.length > 1 &&
    Math.abs(out[0].y - out[out.length - 1].y) < 1e-12 &&
    Math.abs(out[0].z - out[out.length - 1].z) < 1e-12
  ) {
    out.pop();
  }
  return out;
}

/**
 * Sutherland–Hodgman clip keeping the half-plane `a·y + b·z ≤ c`.
 * Convexity of the clip region guarantees a single output polygon; hull
 * sections are not required to be convex.
 */
export function clipHalfPlane(poly: P2[], a: number, b: number, c: number): P2[] {
  const n = poly.length;
  if (n < 3) return [];
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % n];
    const fc = a * cur.y + b * cur.z - c;
    const fn = a * nxt.y + b * nxt.z - c;
    if (fc <= 0) out.push(cur);
    if ((fc < -EPS && fn > EPS) || (fc > EPS && fn < -EPS)) {
      const t = fc / (fc - fn);
      out.push({ y: cur.y + t * (nxt.y - cur.y), z: cur.z + t * (nxt.z - cur.z) });
    }
  }
  return out;
}

/** Shoelace area and centroid. Returns zero area for degenerate polygons. */
export function polygonAreaCentroid(poly: P2[]): AreaCentroid {
  const n = poly.length;
  if (n < 3) return { area: 0, cy: 0, cz: 0 };
  let a2 = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const cross = p.y * q.z - q.y * p.z;
    a2 += cross;
    cy += (p.y + q.y) * cross;
    cz += (p.z + q.z) * cross;
  }
  if (Math.abs(a2) < EPS) return { area: 0, cy: 0, cz: 0 };
  // signed-area terms cancel, so the centroid is correct for either winding
  return { area: Math.abs(a2) / 2, cy: cy / (3 * a2), cz: cz / (3 * a2) };
}

/**
 * Immersed properties of a section under an arbitrary attitude.
 *
 * `u` is the earth-vertical direction expressed in ship coordinates and
 * `cAtStation` the water-plane constant already reduced for this station's x
 * (see `waterPlaneNormal` / `planeConstantAt`).
 */
export function immersedSection(
  poly: P2[],
  uy: number,
  uz: number,
  cAtStation: number,
): AreaCentroid {
  return polygonAreaCentroid(clipHalfPlane(poly, uy, uz, cAtStation));
}
