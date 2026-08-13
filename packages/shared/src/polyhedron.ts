/**
 * Exact volume/centroid of a box cut by a plane.
 *
 * Used for the fluid inside a slack tank at an arbitrary attitude: the fluid
 * surface stays horizontal in the earth frame, so in ship coordinates it is an
 * inclined plane through the tank box. Rather than approximating the shifted
 * fluid wedge, the box is split into tetrahedra, each tetrahedron is clipped
 * exactly against the half-space, and volume/centroid are accumulated. The
 * result is exact for every attitude, including the degenerate cases (upright,
 * zero trim) where a closed-form box formula divides by zero.
 */

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface VolumeCentroid {
  volume: number;
  cx: number;
  cy: number;
  cz: number;
}

type Tet = [P3, P3, P3, P3];

const EPS = 1e-12;

const lerp = (a: P3, b: P3, t: number): P3 => ({
  x: a.x + t * (b.x - a.x),
  y: a.y + t * (b.y - a.y),
  z: a.z + t * (b.z - a.z),
});

function tetVolume(t: Tet): number {
  const [a, b, c, d] = t;
  const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z;
  const cx = c.x - a.x, cy = c.y - a.y, cz = c.z - a.z;
  const dx = d.x - a.x, dy = d.y - a.y, dz = d.z - a.z;
  const det =
    bx * (cy * dz - cz * dy) - by * (cx * dz - cz * dx) + bz * (cx * dy - cy * dx);
  return Math.abs(det) / 6;
}

/** Split an axis-aligned box into 6 tetrahedra sharing the main diagonal. */
export function boxTetrahedra(
  x0: number, x1: number,
  y0: number, y1: number,
  z0: number, z1: number,
): Tet[] {
  const v = (i: number, j: number, k: number): P3 => ({
    x: i ? x1 : x0,
    y: j ? y1 : y0,
    z: k ? z1 : z0,
  });
  const v000 = v(0, 0, 0), v111 = v(1, 1, 1);
  // the six tetrahedra of the Freudenthal (Kuhn) subdivision
  return [
    [v000, v(1, 0, 0), v(1, 1, 0), v111],
    [v000, v(1, 0, 0), v(1, 0, 1), v111],
    [v000, v(0, 1, 0), v(1, 1, 0), v111],
    [v000, v(0, 1, 0), v(0, 1, 1), v111],
    [v000, v(0, 0, 1), v(1, 0, 1), v111],
    [v000, v(0, 0, 1), v(0, 1, 1), v111],
  ];
}

/** Tetrahedra covering the part of `tet` where f(p) = n·p − c ≤ 0. */
function clipTet(tet: Tet, f: number[]): Tet[] {
  const inside: number[] = [];
  const outside: number[] = [];
  for (let i = 0; i < 4; i++) (f[i] <= 0 ? inside : outside).push(i);

  if (outside.length === 0) return [tet];
  if (inside.length === 0) return [];

  const cut = (i: number, o: number): P3 => lerp(tet[i], tet[o], f[i] / (f[i] - f[o]));

  if (inside.length === 1) {
    const [i0] = inside;
    const [o0, o1, o2] = outside;
    return [[tet[i0], cut(i0, o0), cut(i0, o1), cut(i0, o2)]];
  }

  if (inside.length === 3) {
    // whole tet minus the corner at the single outside vertex → a prism
    const [o0] = outside;
    const [a0, a1, a2] = inside;
    const b0 = cut(a0, o0), b1 = cut(a1, o0), b2 = cut(a2, o0);
    return prismTets(tet[a0], tet[a1], tet[a2], b0, b1, b2);
  }

  // two in, two out → a prism whose triangular ends are (i0, cuts) and (i1, cuts)
  const [i0, i1] = inside;
  const [o0, o1] = outside;
  return prismTets(
    tet[i0], cut(i0, o0), cut(i0, o1),
    tet[i1], cut(i1, o0), cut(i1, o1),
  );
}

/** Standard 3-tetrahedron split of the prism A0A1A2–B0B1B2 (Ai–Bi are the lateral edges). */
function prismTets(a0: P3, a1: P3, a2: P3, b0: P3, b1: P3, b2: P3): Tet[] {
  return [
    [a0, a1, a2, b0],
    [a1, a2, b0, b1],
    [a2, b0, b1, b2],
  ];
}

/**
 * Volume and centroid of the part of the box lying in the half-space
 * `n·p ≤ c`. Exact.
 */
export function boxBelowPlane(
  box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number },
  n: P3,
  c: number,
): VolumeCentroid {
  let volume = 0;
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (const tet of boxTetrahedra(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1)) {
    const f = tet.map((p) => n.x * p.x + n.y * p.y + n.z * p.z - c);
    for (const piece of clipTet(tet, f)) {
      const v = tetVolume(piece);
      if (v < EPS) continue;
      volume += v;
      mx += (v * (piece[0].x + piece[1].x + piece[2].x + piece[3].x)) / 4;
      my += (v * (piece[0].y + piece[1].y + piece[2].y + piece[3].y)) / 4;
      mz += (v * (piece[0].z + piece[1].z + piece[2].z + piece[3].z)) / 4;
    }
  }
  if (volume < EPS) {
    return { volume: 0, cx: 0, cy: 0, cz: 0 };
  }
  return { volume, cx: mx / volume, cy: my / volume, cz: mz / volume };
}
