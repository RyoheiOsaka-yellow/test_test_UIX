/* ============================================================
   PROPS — boulders, the descent sled, Beacon-9, the relay chain

   The boulder field is one instanced draw of three base shapes with
   per-instance rotation, scale and tint; the triplanar shader in
   solid.js does the rest. Everything is placed from the seed, so the
   same basin comes back from a save file that stores one number.
   ============================================================ */

import { MeshBuilder } from '../core/mesh.js';
import { makeRng, fbm3, hash2 } from '../core/rng.js';
import {
  m4, m4compose, qt, qFromAxisAngle, qMul, qNorm, v3, clamp, DEG
} from '../core/math.js';

/* Where things are. All positions are relative to the landing site so
   the mission still makes sense whatever the flat patch turns out to be. */
export function siteLayout(landing) {
  const L = [landing.x, landing.z];
  return {
    landing: L,
    sled: [L[0] - 3.4, L[1] - 2.2],
    station: [L[0] - 168, L[1] + 132],
    // Three relay positions, chosen to climb out of the basin toward Earth.
    relays: [
      [L[0] + 74, L[1] - 96],
      [L[0] - 46, L[1] - 188],
      [L[0] - 212, L[1] - 96]
    ],
    // The anomaly: where the subsurface lattice comes closest to the surface.
    lattice: [L[0] - 96, L[1] + 42],
    shaft: [L[0] - 176, L[1] + 150]
  };
}

function boulderShape(seed, lumps) {
  const b = new MeshBuilder();
  b.mat([0.195, 0.190, 0.182], 0.72, 1.0);
  // A sphere pushed around by 3D noise — few large lumps rather than
  // many small ones, because nothing out here has ever been rolled by
  // water and a cauliflower is not a rock.
  b.sphere(1, 18, 12, (nx, ny, nz) => {
    let r = 1 + fbm3(nx * lumps, ny * lumps, nz * lumps, 3, seed) * 0.30;
    r += fbm3(nx * lumps * 2.6, ny * lumps * 2.6, nz * lumps * 2.6, 2, seed + 7) * 0.10;
    // Flatten the base: a boulder is half buried in its own ejecta.
    if (ny < -0.35) r *= 1 + (ny + 0.35) * 0.55;
    return r * 0.72;
  });
  return b.build();
}

export class Props {
  constructor(gl, terrain, solid, layout, seed) {
    this.gl = gl;
    this.terrain = terrain;
    this.solid = solid;
    this.layout = layout;
    this.seed = seed;
    this.boulders = [];          // { x, z, y, r } for collision
    this.beacons = [];           // player-deployed
    this._m = m4();
    this._build();
  }

  _build() {
    const T = this.terrain, L = this.layout;
    const rng = makeRng(this.seed ^ 0x2b17);

    /* ---- boulder field ---- */
    const shapes = [boulderShape(this.seed, 1.7), boulderShape(this.seed + 91, 2.6),
      boulderShape(this.seed + 313, 3.4)];
    const per = [[], [], []];
    const N = 2600;
    const reach = T.fineHalf - 12;
    for (let i = 0; i < N; i++) {
      // Clustered: rocks come from craters, so they arrive in fields.
      const cluster = hash2(i, 3, this.seed) < 0.55;
      let x, z;
      if (cluster) {
        const c = (i / 17) | 0;
        const cx = (hash2(c, 11, this.seed) * 2 - 1) * reach;
        const cz = (hash2(c, 29, this.seed) * 2 - 1) * reach;
        const spread = 7 + hash2(c, 41, this.seed) * 22;
        x = cx + (rng() * 2 - 1) * spread;
        z = cz + (rng() * 2 - 1) * spread;
      } else {
        x = (rng() * 2 - 1) * reach;
        z = (rng() * 2 - 1) * reach;
      }
      if (Math.abs(x) > reach || Math.abs(z) > reach) continue;
      // Keep the landing pad and the station apron clear.
      if (Math.hypot(x - L.landing[0], z - L.landing[1]) < 11) continue;
      if (Math.hypot(x - L.station[0], z - L.station[1]) < 16) continue;

      const u = rng();
      const r = 0.16 * Math.pow(15, u * u * u);      // many pebbles, few monoliths
      const y = T.height(x, z) + r * 0.42;           // partly buried
      const shape = r < 0.45 ? 0 : (r < 1.1 ? 1 : 2);
      const q = qt();
      qFromAxisAngle(q, 0, 1, 0, rng() * Math.PI * 2);
      const tilt = qt();
      qFromAxisAngle(tilt, rng() - 0.5, 0, rng() - 0.5, rng() * 0.7);
      qMul(q, tilt, q); qNorm(q);
      const tint = 0.86 + rng() * 0.30;
      per[shape].push({ x, y, z, r, q, tint });
      if (r > 0.5) this.boulders.push({ x, z, r: r * 0.72 });
    }

    this.rockMeshes = shapes.map((data, i) => {
      const list = per[i];
      const rot = new Float32Array(list.length * 4);
      const posScale = new Float32Array(list.length * 4);
      const tint = new Float32Array(list.length * 3);
      list.forEach((b, k) => {
        rot.set(b.q, k * 4);
        posScale[k * 4] = b.x; posScale[k * 4 + 1] = b.y;
        posScale[k * 4 + 2] = b.z; posScale[k * 4 + 3] = b.r;
        const t = b.tint;
        tint[k * 3] = t; tint[k * 3 + 1] = t * 0.99; tint[k * 3 + 2] = t * 0.96;
      });
      return this.solid.instancedMesh(data, { rot, posScale, tint, count: list.length });
    });

    /* ---- the descent sled ---- */
    const s = new MeshBuilder();
    s.mat([0.62, 0.50, 0.20], 0.35, 0.7).box(3.0, 0.18, 3.0, 0, 0, 0);
    s.mat([0.30, 0.31, 0.34], 0.5, 0.6).box(3.2, 0.10, 0.16, 0, 0.12, 1.5);
    s.box(3.2, 0.10, 0.16, 0, 0.12, -1.5);
    s.mat([0.72, 0.73, 0.76], 0.4, 0.5);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        s.strut([sx * 1.35, 0, sz * 1.35], [sx * 2.15, -1.05, sz * 2.15], 0.055, 7);
        s.translate(sx * 2.15, -1.05, sz * 2.15).scale(1, 0.35, 1).sphere(0.34, 12, 7).pop().pop();
      }
    }
    // Spent descent tanks and a folded ramp.
    s.mat([0.86, 0.87, 0.90], 0.25, 0.4);
    for (const sx of [-0.85, 0.85]) s.translate(sx, 0.45, -0.6).cylinder(0.30, 0.72, 16).pop();
    s.mat([0.55, 0.56, 0.60], 0.4, 0.6)
      .translate(0, -0.30, 2.05).rotate(1, 0, 0, 0.42).box(1.6, 0.06, 1.5).pop().pop();
    this.mSled = this.solid.mesh(s.build());
    this.sledPos = [L.sled[0], T.height(L.sled[0], L.sled[1]) + 1.05, L.sled[1]];
    this.sledYaw = 0.4;

    /* ---- Beacon-9 ---- */
    const st = new MeshBuilder();
    const PALE = [0.78, 0.77, 0.74];
    st.mat(PALE, 0.45, 0.85);
    // Two habitat cylinders on a berm, connected by a tunnel.
    st.translate(-3.0, 1.5, 0).rotate(0, 0, 1, Math.PI / 2).cylinder(1.5, 6.4, 22).pop().pop();
    st.translate(4.2, 1.35, 2.6).rotate(1, 0, 0, Math.PI / 2).cylinder(1.35, 5.0, 20).pop().pop();
    st.mat([0.55, 0.56, 0.58], 0.4, 0.7)
      .translate(1.4, 1.2, 1.1).rotate(0, 1, 0, -0.9).rotate(1, 0, 0, Math.PI / 2)
      .cylinder(0.62, 3.2, 14).pop().pop().pop();
    // Airlock, ladder, and the covered regolith shielding.
    st.mat([0.32, 0.33, 0.36], 0.4, 0.6).box(1.5, 2.0, 1.4, -6.4, 1.0, 0);
    st.mat([0.10, 0.11, 0.13], 0.3, 0.2).box(0.9, 1.4, 0.08, -7.18, 0.9, 0);
    st.mat([0.62, 0.63, 0.66], 0.35, 0.4);
    for (let i = 0; i < 5; i++) st.box(0.7, 0.04, 0.04, -7.6, 0.3 + i * 0.32, 0);
    // The collapsed high-gain mast — the reason nobody has heard anything.
    st.mat([0.70, 0.71, 0.74], 0.3, 0.5);
    st.strut([2.0, 0.2, -3.0], [8.6, 0.9, -7.4], 0.10, 8);
    st.translate(8.9, 1.0, -7.7).rotate(0, 0, 1, 1.35).scale(1, 0.22, 1).sphere(1.5, 20, 9).pop().pop().pop();
    // Solar farm, half buried by two hundred days of nothing at all.
    st.mat([0.09, 0.13, 0.30], 0.18, 0.9);
    for (let i = 0; i < 4; i++) {
      st.translate(-2.5 + i * 2.6, 0.55, 7.2).rotate(1, 0, 0, -0.5).box(2.2, 0.04, 1.6).pop().pop();
    }
    st.mat([0.55, 0.56, 0.6], 0.4, 0.6);
    for (let i = 0; i < 4; i++) st.strut([-2.5 + i * 2.6, 0, 7.2], [-2.5 + i * 2.6, 0.55, 7.2], 0.05, 6);
    this.mStation = this.solid.mesh(st.build());
    this.stationPos = [L.station[0], T.height(L.station[0], L.station[1]), L.station[1]];
    this.stationYaw = 0.9;

    /* ---- relay mast, one mesh reused three times ---- */
    const rl = new MeshBuilder();
    rl.mat([0.30, 0.31, 0.34], 0.5, 0.7).box(1.1, 0.10, 1.1, 0, 0.05, 0);
    rl.mat([0.80, 0.81, 0.84], 0.3, 0.4).strut([0, 0.05, 0], [0, 2.6, 0], 0.045, 8);
    for (let i = 0; i < 3; i++) {
      const y = 0.5 + i * 0.75;
      rl.strut([0, y, 0], [Math.cos(i * 2.1) * 0.42, y + 0.34, Math.sin(i * 2.1) * 0.42], 0.020, 5);
    }
    rl.mat([0.90, 0.90, 0.92], 0.2, 0.3)
      .translate(0, 2.7, 0).rotate(1, 0, 0, -1.05).scale(1, 0.25, 1).sphere(0.46, 18, 8).pop().pop().pop();
    rl.mat([0.09, 0.13, 0.30], 0.18, 0.5).box(0.72, 0.03, 0.52, 0, 1.35, 0.34);
    this.mRelay = this.solid.mesh(rl.build());

    /* ---- the player's deployable beacon ---- */
    const bc = new MeshBuilder();
    bc.mat([0.28, 0.29, 0.32], 0.5, 0.6).box(0.44, 0.07, 0.44, 0, 0.035, 0);
    bc.mat([0.85, 0.86, 0.88], 0.3, 0.3).strut([0, 0.05, 0], [0, 1.15, 0], 0.026, 7);
    bc.mat([0.16, 0.62, 0.72], 0.2, 0.1).translate(0, 1.22, 0).sphere(0.075, 12, 7).pop();
    this.mBeacon = this.solid.mesh(bc.build());
  }

  /* Boulders are solid. Not a physics body — a radial push on the
     chassis, which is enough to stop you driving through a two metre
     rock and cheap enough to run against every rock every frame. */
  collide(rover) {
    const px = rover.pos[0], pz = rover.pos[2];
    for (const b of this.boulders) {
      const dx = px - b.x, dz = pz - b.z;
      const d2 = dx * dx + dz * dz;
      const rad = b.r + 1.15;
      if (d2 > rad * rad || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const pen = rad - d;
      const nx = dx / d, nz = dz / d;
      rover.pos[0] += nx * pen;
      rover.pos[2] += nz * pen;
      const vn = rover.vel[0] * nx + rover.vel[2] * nz;
      if (vn < 0) {
        rover.vel[0] -= nx * vn * 1.25;
        rover.vel[2] -= nz * vn * 1.25;
        rover.lastImpact = Math.max(rover.lastImpact, -vn);
      }
    }
  }

  dropBeacon(x, z) {
    const y = this.terrain.height(x, z);
    this.beacons.push({ x, y, z, t: 0 });
    return this.beacons.length;
  }

  render(solid, ctx) {
    const gl = this.gl;
    const T = this.terrain;

    // Rocks first: their own program, one draw per base shape.
    solid.beginFrame(solid.rock, ctx, T);
    for (const m of this.rockMeshes) solid.drawInstanced(m);

    solid.beginFrame(solid.plain, ctx, T);
    const M = this._m, q = qt();

    qFromAxisAngle(q, 0, 1, 0, this.sledYaw);
    m4compose(M, this.sledPos, q);
    solid.draw(this.mSled, M);

    qFromAxisAngle(q, 0, 1, 0, this.stationYaw);
    m4compose(M, this.stationPos, q);
    solid.draw(this.mStation, M);

    for (let i = 0; i < this.layout.relays.length; i++) {
      const [x, z] = this.layout.relays[i];
      qFromAxisAngle(q, 0, 1, 0, i * 1.3);
      m4compose(M, [x, T.height(x, z), z], q);
      const live = ctx.relaysOnline > i;
      solid.draw(this.mRelay, M, {
        emissive: live ? 0.9 + Math.sin(ctx.time * 3 + i) * 0.25 : 0,
        emissiveColor: [0.05, 0.30, 0.36]
      });
    }

    qFromAxisAngle(q, 0, 1, 0, 0);
    for (const b of this.beacons) {
      m4compose(M, [b.x, b.y, b.z], q);
      solid.draw(this.mBeacon, M, {
        emissive: 0.7 + Math.sin(ctx.time * 4 + b.x) * 0.3,
        emissiveColor: [0.06, 0.34, 0.40]
      });
    }
    void gl; void clamp; void v3; void DEG;
  }
}
