import * as THREE from 'three';
import { Rng, TAU, clamp01, lerp } from '../utils/math.js';

/**
 * Every mesh in the sandbox is built here at boot. Nothing is loaded from disk.
 *
 * The crystals are lathed prisms with a jittered radial profile, the meteor is
 * an icosphere cratered and then sliced by fracture planes, and the ribbon and
 * tube are *blank* topologies: they carry a parameterisation (t along, side or
 * angle around) and no useful positions at all, because the vertex shader is
 * what puts them in the world.
 */

/* -------------------------------------------------------------- CPU noise -- */

function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const n = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return lerp(
    lerp(lerp(n(0, 0, 0), n(1, 0, 0), u), lerp(n(0, 1, 0), n(1, 1, 0), u), v),
    lerp(lerp(n(0, 0, 1), n(1, 0, 1), u), lerp(n(0, 1, 1), n(1, 1, 1), u), v),
    w
  );
}

function fbm3(x, y, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x, y, z);
    norm += amp;
    x *= 2.03;
    y *= 2.01;
    z *= 1.98;
    amp *= 0.5;
  }
  return sum / norm;
}

/* --------------------------------------------------------------- crystal -- */

/**
 * A single ice crystal: a tapered prism, unit height, standing on the origin.
 * `sides` controls how faceted it reads; the radial jitter is what stops a
 * field of them from looking like a field of identical cones.
 */
export function createCrystalGeometry({
  sides = 6,
  rings = 5,
  radius = 0.22,
  taper = 2.2,
  jitter = 0.3,
  bend = 0.14,
  seed = 1,
} = {}) {
  const rng = new Rng(seed >>> 0 || 1);
  const positions = [];

  // Radial profile, with a per-side jitter that persists up the crystal so the
  // facets stay straight rather than turning into a wobbly lump.
  const sideJitter = [];
  for (let s = 0; s < sides; s++) sideJitter.push(1 + rng.spread(jitter));

  const bendX = rng.spread(bend);
  const bendZ = rng.spread(bend);

  const ringRadius = (t) => radius * Math.pow(1 - t, taper * 0.42) * (1 - t * 0.08);
  const ringOffset = (t) => [bendX * t * t, bendZ * t * t];

  const vertex = (ring, side) => {
    const t = ring / rings;
    const r = ringRadius(t) * sideJitter[side % sides];
    const a = (side / sides) * TAU;
    const [ox, oz] = ringOffset(t);
    return [Math.cos(a) * r + ox, t, Math.sin(a) * r + oz];
  };

  const tip = [bendX, 1, bendZ];

  for (let ring = 0; ring < rings; ring++) {
    for (let s = 0; s < sides; s++) {
      const a = vertex(ring, s);
      const b = vertex(ring, s + 1);
      const c = vertex(ring + 1, s);
      const d = vertex(ring + 1, s + 1);
      if (ring === rings - 1) {
        // Converge the last ring on the tip.
        positions.push(...a, ...b, ...tip);
      } else {
        positions.push(...a, ...b, ...d);
        positions.push(...a, ...d, ...c);
      }
    }
  }

  // Base cap, so the crystal is closed when it is caught mid-rise.
  for (let s = 0; s < sides; s++) {
    const a = vertex(0, s);
    const b = vertex(0, s + 1);
    positions.push(0, 0, 0, ...b, ...a);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non-indexed -> flat facets
  geometry.computeBoundingSphere();
  return geometry;
}

/** A wide, thin blade — the Glacier Crown's ring pieces. */
export function createShardGeometry({ seed = 7, sides = 5, rings = 6 } = {}) {
  const geo = createCrystalGeometry({
    sides,
    rings,
    radius: 0.38,
    taper: 1.5,
    jitter: 0.34,
    bend: 0.22,
    seed,
  });
  geo.scale(1, 1, 0.42); // flatten into a blade
  return geo;
}

/* ---------------------------------------------------------------- meteor -- */

/**
 * Icosphere, displaced by fbm, then dented by N spherical craters and sliced by
 * M fracture planes. The slicing is what gives it flat faces to catch a rim
 * light, which a purely noisy blob never does.
 */
export function createAsteroidGeometry({
  radius = 0.5,
  detail = 3,
  craters = 8,
  craterDepth = 0.28,
  fractures = 4,
  fractureDepth = 0.16,
  seed = 3,
} = {}) {
  const rng = new Rng(seed >>> 0 || 1);
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geometry.attributes.position;

  const craterList = [];
  for (let i = 0; i < craters; i++) {
    const th = rng.next() * TAU;
    const ph = Math.acos(rng.next() * 2 - 1);
    craterList.push({
      dir: new THREE.Vector3(
        Math.sin(ph) * Math.cos(th),
        Math.cos(ph),
        Math.sin(ph) * Math.sin(th)
      ),
      size: rng.range(0.22, 0.6),
      depth: rng.range(0.4, 1) * craterDepth,
    });
  }

  const planes = [];
  for (let i = 0; i < fractures; i++) {
    const th = rng.next() * TAU;
    const ph = Math.acos(rng.next() * 2 - 1);
    planes.push({
      n: new THREE.Vector3(
        Math.sin(ph) * Math.cos(th),
        Math.cos(ph),
        Math.sin(ph) * Math.sin(th)
      ),
      d: rng.range(0.55, 0.88),
    });
  }

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // Base lumpiness.
    let r = radius * (0.82 + 0.36 * fbm3(dir.x * 2.1 + 11, dir.y * 2.1 + 5, dir.z * 2.1 + 2, 4));

    // Craters: a smooth bowl wherever the surface faces one.
    for (const c of craterList) {
      const d = dir.dot(c.dir);
      const t = clamp01((d - (1 - c.size)) / c.size);
      const bowl = t * t * (3 - 2 * t);
      r -= radius * c.depth * bowl * (1 - 0.55 * bowl);
    }

    // Fracture planes: clip the radius to a flat face.
    for (const p of planes) {
      const proj = dir.dot(p.n);
      if (proj > 0) {
        const limit = (radius * p.d) / Math.max(proj, 1e-3);
        if (limit < r) r = lerp(r, limit, 1 - fractureDepth * 0.5);
      }
    }

    v.copy(dir).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  /* PolyhedronGeometry is already non-indexed, so the facets come for free. */
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Small irregular debris, reused for both rock chunks and ice blocks. */
export function createChunkGeometry(seed = 5) {
  const rng = new Rng(seed >>> 0 || 1);
  const geometry = new THREE.IcosahedronGeometry(0.5, 0);
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(rng.range(0.55, 1.35));
    v.x *= 1.2;
    v.z *= 0.8;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------------------------------------------------------------- ribbon -- */

/**
 * A flat strip of `segments` quads carrying only `aT` (0..1 along the strip),
 * `aSide` (-1 / +1 across it) and `aIndex` (which filament this is, when the
 * strip is instanced). The positions in the buffer are all zero: the vertex
 * shader is the only thing that decides where a bolt actually goes.
 */
export function createRibbonGeometry(segments = 64) {
  const count = segments + 1;
  const positions = new Float32Array(count * 2 * 3);
  const aT = new Float32Array(count * 2);
  const aSide = new Float32Array(count * 2);
  const indices = [];

  for (let i = 0; i < count; i++) {
    const t = i / segments;
    aT[i * 2 + 0] = t;
    aT[i * 2 + 1] = t;
    aSide[i * 2 + 0] = -1;
    aSide[i * 2 + 1] = 1;
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geometry;
}

/** Instanced version of the above — `count` filaments sharing one draw call. */
export function createRibbonBundle(segments = 64, count = 6) {
  const base = createRibbonGeometry(segments);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.attributes.position);
  geometry.setAttribute('aT', base.attributes.aT);
  geometry.setAttribute('aSide', base.attributes.aSide);

  const idx = new Float32Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  geometry.setAttribute('aIndex', new THREE.InstancedBufferAttribute(idx, 1));
  geometry.instanceCount = count;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geometry;
}

/* ------------------------------------------------------------------ tube -- */

/**
 * Parametric tube: `segments` rings of `radial` vertices, again carrying only
 * the parameterisation. The beam draws this same geometry three times at three
 * radii to build its core, sheath and outer envelope.
 */
export function createTubeGeometry(segments = 96, radial = 20) {
  const rows = segments + 1;
  const cols = radial + 1;
  const positions = new Float32Array(rows * cols * 3);
  const aT = new Float32Array(rows * cols);
  const aAngle = new Float32Array(rows * cols);
  const indices = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      aT[i] = r / segments;
      aAngle[i] = (c / radial) * TAU;
    }
  }

  for (let r = 0; r < segments; r++) {
    for (let c = 0; c < radial; c++) {
      const a = r * cols + c;
      const b = a + cols;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geometry;
}

/** Flat annulus lying in XZ, used for shock discs and every ground ring. */
export function createRingGeometry(radial = 64) {
  const positions = [];
  const aSide = [];
  const aAngle = [];
  const indices = [];

  for (let i = 0; i <= radial; i++) {
    const a = (i / radial) * TAU;
    positions.push(0, 0, 0, 0, 0, 0);
    aSide.push(-1, 1);
    aAngle.push(a, a);
  }
  for (let i = 0; i < radial; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  geometry.setAttribute('aAngle', new THREE.Float32BufferAttribute(aAngle, 1));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geometry;
}

/** Unit quad lying flat in XZ, centred on the origin — every ground decal. */
export function createGroundQuad() {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** A camera-facing card used by the raymarched volumes. */
export function createBillboardBox() {
  return new THREE.BoxGeometry(1, 1, 1);
}
