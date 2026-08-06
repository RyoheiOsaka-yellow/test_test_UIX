import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as mat4 from '../src/mat4.ts';
import * as quat from '../src/quat.ts';
import * as vec3 from '../src/vec3.ts';

test('identity transforms nothing', () => {
  const out = vec3.create();
  vec3.transformMat4(out, [1, 2, 3], mat4.create());
  assert.ok(vec3.equals(out, [1, 2, 3]));
});

test('compose applies scale, then rotation, then translation', () => {
  const m = mat4.create();
  const rot = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 2);
  mat4.compose(m, [10, 0, 0], rot, [2, 2, 2]);

  // [1,0,0] scaled to [2,0,0], rotated to [0,0,-2], translated to [10,0,-2].
  const out = vec3.create();
  vec3.transformMat4(out, [1, 0, 0], m);
  assert.ok(vec3.equals(out, [10, 0, -2]));
});

test('invert undoes a transform', () => {
  const m = mat4.create();
  const rot = quat.fromEuler(quat.create(), 0.3, 0.5, 0.7);
  mat4.compose(m, [1, 2, 3], rot, [1, 2, 0.5]);

  const inv = mat4.invert(mat4.create(), m);
  const roundTrip = mat4.multiply(mat4.create(), inv, m);
  assert.ok(mat4.equals(roundTrip, mat4.create()));
});

test('invert of a singular matrix returns zeros', () => {
  const zero = new Array(16).fill(0);
  const out = mat4.invert(mat4.create(), zero);
  assert.deepEqual(out, zero);
});

test('multiply respects application order for column vectors', () => {
  const translate = mat4.compose(mat4.create(), [5, 0, 0], quat.create(), [1, 1, 1]);
  const scale = mat4.compose(mat4.create(), [0, 0, 0], quat.create(), [2, 2, 2]);

  // out = translate * scale means: scale first, then translate.
  const m = mat4.multiply(mat4.create(), translate, scale);
  const out = vec3.create();
  vec3.transformMat4(out, [1, 0, 0], m);
  assert.ok(vec3.equals(out, [7, 0, 0]));
});

test('lookAt places the eye at the origin of view space', () => {
  const view = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
  const out = vec3.create();
  vec3.transformMat4(out, [0, 0, 5], view);
  assert.ok(vec3.equals(out, [0, 0, 0]));
  // A point in front of the camera lands on the -Z axis.
  vec3.transformMat4(out, [0, 0, 0], view);
  assert.ok(vec3.equals(out, [0, 0, -5]));
});

test('perspective maps near and far planes to clip -1 and 1', () => {
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 100);
  const out = vec3.create();
  vec3.transformMat4(out, [0, 0, -1], proj);
  assert.ok(Math.abs(out[2] - -1) < 1e-6);
  vec3.transformMat4(out, [0, 0, -100], proj);
  assert.ok(Math.abs(out[2] - 1) < 1e-4);
});

test('transpose works out-of-place and in-place', () => {
  const m = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const expected = [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16];
  assert.deepEqual(mat4.transpose(mat4.create(), m), expected);
  mat4.transpose(m, m);
  assert.deepEqual(m, expected);
});
