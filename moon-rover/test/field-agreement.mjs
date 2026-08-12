/* ============================================================
   The tests that matter: the ones protecting the invariants the
   whole thing is built on.

     node test/field-agreement.mjs

   No framework. Runs headless on the CPU — the terrain bake and the
   rover physics never touch WebGL, which is exactly what makes them
   testable.
   ============================================================ */

import { Terrain } from '../src/world/terrain.js';
import { Rover } from '../src/game/rover.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}

/* The bake needs no GL until the upload step, so run the generator up
   to the point where it would talk to the driver and stop. */
const terrain = new Terrain(null, { tier: 'low' });
const steps = terrain.bakeSteps();
for (;;) {
  const r = steps.next();
  if (r.done || r.value.phase === 'Uploading fields') break;
}

/* 1. The height field has to be continuous.
   Every discontinuity is a cliff the suspension will find, and a crater
   profile that forgets to taper to zero at its cutoff is a step the
   height of a fifth of the crater's radius. */
{
  let worst = 0, at = 0;
  for (const z of [-140.5, 3.7, 88.25]) {
    for (let x = -220; x < 220; x += 0.05) {
      const d = Math.abs(terrain.height(x, z) - terrain.height(x + 0.05, z));
      if (d > worst) { worst = d; at = x; }
    }
  }
  check('height field is continuous', worst < 0.08,
    `largest 5 cm step ${worst.toFixed(4)} m at x=${at.toFixed(2)}`);
}

/* 2. Physics and pixels must read the same number.
   Terrain.height is what the wheels use. The shader's fetchBilinear is
   reimplemented here exactly as the GLSL does it. If these ever
   disagree the rover floats or sinks and no tuning fixes it. */
{
  const n = terrain.fineN, cell = terrain.fineCell, half = terrain.fineHalf;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const texel = (i, j) => terrain.fine[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
  const shaderSample = (x, z) => {
    const u = (x + half) / cell - 0.5, v = (z + half) / cell - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const fx = u - i0, fz = v - j0;
    const a = texel(i0, j0) + (texel(i0 + 1, j0) - texel(i0, j0)) * fx;
    const b = texel(i0, j0 + 1) + (texel(i0 + 1, j0 + 1) - texel(i0, j0 + 1)) * fx;
    return a + (b - a) * fz;
  };
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const x = ((i * 7.13) % 400) - 200, z = ((i * 11.71) % 400) - 200;
    worst = Math.max(worst, Math.abs(shaderSample(x, z) - terrain.height(x, z)));
  }
  check('CPU and shader filters agree exactly', worst === 0,
    `max error ${worst.toExponential(2)} m`);
}

/* 3. A landing site has to be flat enough to put a rover on. */
const site = terrain.findLandingSite(0, 0);
check('landing site is flat', site.relief < 0.35,
  `${site.relief.toFixed(3)} m of relief across 4.8 m at (${site.x.toFixed(1)}, ${site.z.toFixed(1)})`);

/* 4. Dropped on that site, the rover settles instead of launching.
   The bug this guards against: a bump stop stiff enough to be an
   impulse at the end of a one-metre lever puts a 900 kg vehicle on its
   roof within two seconds. */
const rover = new Rover(terrain);
rover.placeAt(site.x, site.z, 0.6);
const idle = { throttle: 0, steer: 0, brake: false, armOut: false, arrayOut: true };
for (let i = 0; i < 360; i++) rover.step(1 / 60, idle);
const load = rover.wheels.reduce((a, w) => a + w.load, 0);
check('rover settles upright', rover.up[1] > 0.999, `up.y = ${rover.up[1].toFixed(4)}`);
check('rover comes to rest', rover.speed < 0.05, `${rover.speed.toFixed(3)} m/s after 6 s`);
check('all six wheels in contact', rover.contacts === 6, `${rover.contacts}/6`);
check('suspension carries lunar weight', Math.abs(load - 900 * 1.62) < 220,
  `${load.toFixed(0)} N vs 1458 N`);

/* 5. Full throttle actually goes somewhere, and steering turns. */
{
  const before = rover.heading;
  for (let i = 0; i < 480; i++) rover.step(1 / 60, { ...idle, throttle: 1 });
  check('reaches a sensible top speed', rover.speed > 3.5 && rover.speed < 7,
    `${rover.speed.toFixed(2)} m/s after 8 s`);
  for (let i = 0; i < 240; i++) rover.step(1 / 60, { ...idle, throttle: 1, steer: 1 });
  const turned = Math.abs(rover.heading - before);
  check('steering turns the rover', turned > 0.3, `${((turned * 180) / Math.PI).toFixed(0)}° of heading change`);
  check('still upright after a turn', rover.up[1] > 0.9, `up.y = ${rover.up[1].toFixed(3)}`);
}

/* 6. Ruts converge instead of digging to the centre of the Moon. */
{
  const deepest = () => { let d = 0; for (let i = 0; i < terrain.cut.length; i++) if (terrain.cut[i] < d) d = terrain.cut[i]; return -d / 1000; };
  const cut = deepest();
  check('ruts are cut and bounded', cut > 0.004 && cut < 0.25, `deepest rut ${(cut * 100).toFixed(1)} cm`);
  let touched = 0;
  for (let i = 0; i < terrain.cut.length; i++) if (terrain.cut[i]) touched++;
  check('excavation touched the field', touched > 40, `${touched} texels displaced`);
}

/* 7. The sun mask is a mask, not a constant. */
{
  let lit = 0, dark = 0;
  for (let i = 0; i < terrain.fineMask.length; i += 37) {
    if (terrain.fineMask[i] > 200) lit++; else if (terrain.fineMask[i] < 40) dark++;
  }
  check('sun mask has both light and shadow', lit > 0 && dark > 0,
    `${lit} lit / ${dark} shadowed samples`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
