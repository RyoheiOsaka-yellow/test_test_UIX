import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as color from '../src/color.ts';
import * as easing from '../src/easing.ts';
import * as random from '../src/random.ts';
import * as vec3 from '../src/vec3.ts';

test('color hex round-trips', () => {
  const c = color.create();
  color.fromHex(c, 0xff8800);
  assert.equal(color.toHex(c), 0xff8800);
  assert.ok(Math.abs(c[0] - 1) < 1e-9);
});

test('color fromHsl hits primaries and greys', () => {
  const c = color.create();
  assert.deepEqual(color.fromHsl(c, 0, 1, 0.5), [1, 0, 0]);
  assert.deepEqual(color.fromHsl(c, 0, 0, 0.25), [0.25, 0.25, 0.25]);
  color.fromHsl(c, 1 / 3, 1, 0.5);
  assert.ok(Math.abs(c[1] - 1) < 1e-9 && c[0] < 1e-9);
});

test('color sRGB/linear round-trips', () => {
  const c = color.set(color.create(), 0.2, 0.5, 0.9);
  const linear = color.srgbToLinear(color.create(), c);
  const back = color.linearToSrgb(color.create(), linear);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - c[i]) < 1e-9);
});

test('rng is deterministic per seed and uniform-ish', () => {
  const a = random.createRng(42);
  const b = random.createRng(42);
  const c = random.createRng(7);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, [c(), c(), c()]);

  const rng = random.createRng(1);
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
    sum += v;
  }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
});

test('random.onSphere points lie on the unit sphere', () => {
  const rng = random.createRng(3);
  const p = vec3.create();
  for (let i = 0; i < 100; i++) {
    random.onSphere(p, rng);
    assert.ok(Math.abs(vec3.length(p) - 1) < 1e-9);
  }
});

test('random.inSphere points lie inside the unit sphere', () => {
  const rng = random.createRng(4);
  const p = vec3.create();
  for (let i = 0; i < 100; i++) {
    random.inSphere(p, rng);
    assert.ok(vec3.length(p) <= 1 + 1e-9);
  }
});

test('random.intRange covers the inclusive range', () => {
  const rng = random.createRng(5);
  const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) {
    const v = random.intRange(rng, 1, 3);
    assert.ok(v >= 1 && v <= 3);
    seen.add(v);
  }
  assert.equal(seen.size, 3);
});

test('easings start at 0 and end at 1', () => {
  const fns = [
    easing.linear, easing.quadIn, easing.quadOut, easing.quadInOut,
    easing.cubicIn, easing.cubicOut, easing.cubicInOut,
    easing.expoOut, easing.elasticOut, easing.bounceOut,
  ];
  for (const fn of fns) {
    assert.ok(Math.abs(fn(0)) < 1e-9, `${fn.name}(0)`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9, `${fn.name}(1)`);
  }
});

test('scalar helpers', () => {
  assert.equal(easing.smoothstep(0, 1, 0.5), 0.5);
  assert.equal(easing.smoothstep(0, 1, -5), 0);
  assert.equal(easing.smoothstep(0, 1, 5), 1);
  assert.equal(easing.clamp(5, 0, 1), 1);
  assert.equal(easing.mix(0, 10, 0.3), 3);
  assert.equal(easing.remap(5, 0, 10, 0, 100), 50);
});
