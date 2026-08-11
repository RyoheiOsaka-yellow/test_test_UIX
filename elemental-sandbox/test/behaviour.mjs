/**
 * Behaviour checks for the sandbox's interaction rules.
 *
 * No pixels are compared. This drives real keyboard and mouse events at the
 * running app and then asks it what state it is in, which is the only way to
 * test rules like "a cast inside minRange is refused" or "pausing freezes the
 * simulation but not the editor".
 *
 *   npm run build && npm run preview      # in one terminal
 *   npm run test:behaviour                # in another
 *
 * Set ES_URL to point at a different origin (defaults to the preview server)
 * and ES_CHROME to use a specific Chromium build.
 */
import { chromium } from 'playwright';

const URL = process.env.ES_URL || 'http://127.0.0.1:4173/';

const browser = await chromium.launch({
  ...(process.env.ES_CHROME ? { executablePath: process.env.ES_CHROME } : {}),
  // Software rendering, so this runs the same on a machine with no GPU. It is
  // slow: a frame can take 250 ms, which is why nothing here waits on wall time.
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 300)}`);
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);

const results = [];
const check = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `   ${detail}` : ''}`);

const q = (fn) => page.evaluate(fn);
const frames = (n = 3) =>
  page.evaluate(
    (k) =>
      new Promise((res) => {
        let i = 0;
        const step = () => (++i >= k ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n
  );

// ---------------------------------------------------------------- arming ---
await page.keyboard.press('KeyQ');
await frames();
let s = await q(() => ({
  armed: window.sandbox.abilities.armedKey,
  line: window.sandbox.aim.line.mesh.visible,
  zone: window.sandbox.aim.zone.mesh.visible,
}));
check('Q arms the line cast', s.armed === 'frost' && s.line && !s.zone, JSON.stringify(s));

await page.keyboard.press('KeyQ');
await frames();
s = await q(() => window.sandbox.abilities.armedKey);
check('Q again puts it away', s === null, `armed=${s}`);

await page.keyboard.press('KeyV');
await frames(5);
s = await q(() => ({
  armed: window.sandbox.abilities.armedKey,
  line: window.sandbox.aim.line.mesh.visible,
  zone: window.sandbox.aim.zone.mesh.visible,
}));
check('V arms the far cast circle', s.armed === 'snare' && s.zone && !s.line, JSON.stringify(s));

await page.keyboard.press('Escape');
await frames();
s = await q(() => window.sandbox.abilities.armedKey);
check('Esc cancels', s === null, `armed=${s}`);

// ----------------------------------------------------------- min range -----
// Frost ships minRange 2.2; aim at the caster's own feet and the cast must be
// refused, the indicator tinted, and no cooldown started.
await page.keyboard.press('KeyQ');
await q(() => {
  // Point the cursor essentially at the caster.
  const app = window.sandbox;
  app.aim.cursor.set(0.2, 0, 0.2);
  app.aim.resolveCursor = () => true; // hold the cursor where we put it
});
await frames(4);
s = await q(() => ({ valid: window.sandbox.aim.valid, dist: +window.sandbox.aim.cursor.length().toFixed(2) }));
check('aiming inside minRange is invalid', s.valid === false, JSON.stringify(s));

await page.mouse.move(500, 300);
await page.mouse.down();
await page.mouse.up();
await frames(4);
s = await q(() => ({
  live: window.sandbox.abilities.abilities.frost.instances.filter((i) => i.active).length,
  cd: +window.sandbox.abilities.cooldowns.frost.toFixed(2),
  armed: window.sandbox.abilities.armedKey,
}));
check('a refused cast fires nothing and burns no cooldown', s.live === 0 && s.cd === 0, JSON.stringify(s));
check('a refused cast stays armed', s.armed === 'frost', `armed=${s.armed}`);

// Restore normal cursor resolution.
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

// ------------------------------------------------------------ cooldowns ----
await page.keyboard.press('KeyQ');
await page.mouse.move(700, 380);
await frames(4);
await page.mouse.down();
await page.mouse.up();
await frames(4);
s = await q(() => ({
  live: window.sandbox.abilities.abilities.frost.instances.filter((i) => i.active).length,
  frost: +window.sandbox.abilities.cooldowns.frost.toFixed(2),
  storm: +window.sandbox.abilities.cooldowns.storm.toFixed(2),
  armed: window.sandbox.abilities.armedKey,
}));
check('a valid cast fires', s.live === 1, JSON.stringify(s));
check('casting starts that slot cooldown', s.frost > 0, `frost=${s.frost}`);
check('cooldowns are per ability', s.storm === 0, `storm=${s.storm}`);
check('firing puts the ability away', s.armed === null, `armed=${s.armed}`);

// Re-arm and try again while the slot is still cooling. The cooldown is held
// open explicitly: under software rendering a frame is ~250 ms, so a 0.85 s
// cooldown would otherwise expire between the arm and the click.
await page.keyboard.press('KeyQ');
await frames(2);
const before = await q(() => {
  window.sandbox.abilities.cooldowns.frost = 5;
  return window.sandbox.abilities.abilities.frost.instances.filter((i) => i.active).length;
});
await page.mouse.down();
await page.mouse.up();
await frames(3);
const after = await q(() => window.sandbox.abilities.abilities.frost.instances.filter((i) => i.active).length);
check('a slot on cooldown refuses to cast', after === before, `${before} -> ${after}`);
await q(() => {
  window.sandbox.abilities.cooldowns.frost = 0;
});

// The other slot is free.
await page.keyboard.press('KeyQ'); // disarm frost
await page.keyboard.press('KeyE');
await frames(2);
await page.mouse.down();
await page.mouse.up();
await frames(3);
s = await q(() => window.sandbox.abilities.abilities.storm.instances.filter((i) => i.active).length);
check('another slot casts while the first is cooling', s === 1, `storm live=${s}`);

// ---------------------------------------------------------------- pause ----
await page.keyboard.press('KeyP');
const t0 = await q(() => window.sandbox.time.sim);
await page.waitForTimeout(600);
const t1 = await q(() => ({ sim: window.sandbox.time.sim, wall: window.sandbox.time.wall }));
check('P freezes the sim clock', t1.sim === t0, `${t0} -> ${t1.sim}`);
check('the wall clock keeps running', t1.wall > 0, `wall=${t1.wall.toFixed(2)}`);

// The editor must still apply while paused — that is the whole point.
await q(() => {
  window.sandbox.settings.abilities.frost.ice.colorEdge = '#ff0000';
});
await frames(4);
s = await q(() => {
  const u = window.sandbox.abilities.abilities.frost.field.material.userData.uniforms;
  return [u.uColorEdge.value.r, u.uColorEdge.value.g, u.uColorEdge.value.b];
});
check('the editor keeps applying while paused', s[0] > 0.9 && s[1] < 0.05, JSON.stringify(s.map((v) => +v.toFixed(2))));
await q(() => {
  window.sandbox.settings.abilities.frost.ice.colorEdge = '#e7fbff';
});
await page.keyboard.press('KeyP');

// ---------------------------------------------------------------- clear ----
await page.keyboard.press('KeyX');
await frames(3);
s = await q(() => {
  const app = window.sandbox;
  const live = Object.values(app.abilities.abilities).reduce(
    (n, a) => n + a.instances.filter((i) => i.active).length,
    0
  );
  const decals = [...app.decals.pools.values()].reduce(
    (n, pool) => n + pool.filter((d) => d.active).length,
    0
  );
  return { live, decals };
});
check('X clears every live effect', s.live === 0 && s.decals === 0, JSON.stringify(s));

// -------------------------------------------------------------- presets ----
s = await q(() => {
  const app = window.sandbox;
  app.settings.abilities.cinder.impact.blastRadius = 9.25;
  app.editor.savePreset();
  app.settings.abilities.cinder.impact.blastRadius = 1;
  app.editor.loadPreset();
  return app.settings.abilities.cinder.impact.blastRadius;
});
check('presets round-trip through localStorage', s === 9.25, `blastRadius=${s}`);

s = await q(() => {
  const app = window.sandbox;
  app.editor.reset();
  return app.settings.abilities.cinder.impact.blastRadius;
});
check('reset restores the shipped value', s === 4.6, `blastRadius=${s}`);

// ------------------------------------------------------------- far cast ----
s = await q(() => {
  const app = window.sandbox;
  const s = app.settings.abilities.snare;
  app.abilities.arm('snare');
  // Ask for a point well beyond range; it must be clamped onto the disc.
  app.aim.cursor.set(200, 0, 0);
  app.aim.resolveCursor = () => true;
  app.aim.update(0.016, s, app.caster.root.position);
  return { d: +app.aim.point.length().toFixed(2), range: s.range };
});
check('the far cast clamps its circle to range', Math.abs(s.d - s.range) < 0.05, JSON.stringify(s));

// --------------------------------------------------------------- camera ----
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
const az0 = await q(() => window.sandbox.rig.azimuth);
await page.mouse.move(500, 300);
await page.mouse.down({ button: 'right' });
await page.mouse.move(620, 300, { steps: 6 });
await page.mouse.up({ button: 'right' });
await frames(3);
const az1 = await q(() => window.sandbox.rig.azimuth);
check('right-drag orbits', az1 !== az0, `${az0.toFixed(3)} -> ${az1.toFixed(3)}`);

const d0 = await q(() => window.sandbox.rig.distance);
await page.mouse.wheel(0, 400);
await frames(3);
const d1 = await q(() => window.sandbox.rig.distance);
check('scroll zooms', d1 !== d0, `${d0.toFixed(2)} -> ${d1.toFixed(2)}`);

// ---------------------------------------------------------------- output ---
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
console.log(errors.length ? `\nconsole:\n${errors.join('\n')}` : '\nconsole: clean');

await browser.close();
process.exit(failed ? 1 : 0);
