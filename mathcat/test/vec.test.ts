import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as vec2 from '../src/vec2.ts';
import * as vec3 from '../src/vec3.ts';

test('vec2 basic arithmetic', () => {
  const out = vec2.create();
  assert.deepEqual(vec2.add(out, [1, 2], [3, 4]), [4, 6]);
  assert.deepEqual(vec2.subtract(out, [3, 4], [1, 2]), [2, 2]);
  assert.deepEqual(vec2.scale(out, [1, -2], 3), [3, -6]);
  assert.equal(vec2.dot([1, 2], [3, 4]), 11);
  assert.equal(vec2.cross([1, 0], [0, 1]), 1);
});

test('vec2 rotate around an origin', () => {
  const out = vec2.create();
  vec2.rotate(out, [2, 1], [1, 1], Math.PI / 2);
  assert.ok(vec2.equals(out, [1, 2]));
});

test('vec2 out can alias an input', () => {
  const a = [1, 2];
  vec2.add(a, a, [10, 10]);
  assert.deepEqual(a, [11, 12]);
});

test('vec3 basic arithmetic', () => {
  const out = vec3.create();
  assert.deepEqual(vec3.add(out, [1, 2, 3], [4, 5, 6]), [5, 7, 9]);
  assert.deepEqual(vec3.scaleAndAdd(out, [1, 1, 1], [1, 2, 3], 2), [3, 5, 7]);
  assert.equal(vec3.dot([1, 2, 3], [4, 5, 6]), 32);
});

test('vec3 cross follows the right-hand rule', () => {
  const out = vec3.create();
  assert.deepEqual(vec3.cross(out, [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
});

test('vec3 normalize produces unit length, zero stays zero', () => {
  const out = vec3.create();
  vec3.normalize(out, [3, 0, 4]);
  assert.ok(Math.abs(vec3.length(out) - 1) < 1e-9);
  vec3.normalize(out, [0, 0, 0]);
  assert.deepEqual(out, [0, 0, 0]);
});

test('vec3 lerp endpoints and midpoint', () => {
  const out = vec3.create();
  assert.deepEqual(vec3.lerp(out, [0, 0, 0], [2, 4, 6], 0.5), [1, 2, 3]);
  assert.deepEqual(vec3.lerp(out, [1, 1, 1], [2, 2, 2], 0), [1, 1, 1]);
  assert.deepEqual(vec3.lerp(out, [1, 1, 1], [2, 2, 2], 1), [2, 2, 2]);
});

test('vec3 works with Float32Array', () => {
  const out = new Float32Array(3);
  vec3.add(out, new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6]));
  assert.deepEqual(Array.from(out), [5, 7, 9]);
});
