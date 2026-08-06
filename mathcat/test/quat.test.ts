import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as quat from '../src/quat.ts';
import * as vec3 from '../src/vec3.ts';

test('identity quaternion leaves vectors unchanged', () => {
  const out = vec3.create();
  vec3.transformQuat(out, [1, 2, 3], quat.create());
  assert.ok(vec3.equals(out, [1, 2, 3]));
});

test('90-degree rotation around Y maps +X to -Z', () => {
  const q = quat.create();
  quat.setAxisAngle(q, [0, 1, 0], Math.PI / 2);
  const out = vec3.create();
  vec3.transformQuat(out, [1, 0, 0], q);
  assert.ok(vec3.equals(out, [0, 0, -1]));
});

test('multiply composes rotations (b first, then a)', () => {
  const rotX = quat.setAxisAngle(quat.create(), [1, 0, 0], Math.PI / 2);
  const rotY = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 2);
  const combined = quat.multiply(quat.create(), rotY, rotX);

  // Applying rotX then rotY by hand must match the composed quaternion.
  const stepwise = vec3.create();
  vec3.transformQuat(stepwise, [0, 0, 1], rotX);
  vec3.transformQuat(stepwise, stepwise, rotY);

  const composed = vec3.create();
  vec3.transformQuat(composed, [0, 0, 1], combined);
  assert.ok(vec3.equals(stepwise, composed));
});

test('conjugate inverts a rotation', () => {
  const q = quat.setAxisAngle(quat.create(), [0, 0, 1], 1.234);
  const inv = quat.conjugate(quat.create(), q);
  const roundTrip = vec3.create();
  vec3.transformQuat(roundTrip, [1, 2, 3], q);
  vec3.transformQuat(roundTrip, roundTrip, inv);
  assert.ok(vec3.equals(roundTrip, [1, 2, 3]));
});

test('fromEuler matches axis-angle for a single axis', () => {
  const fromEuler = quat.fromEuler(quat.create(), 0, 0.7, 0);
  const fromAxis = quat.setAxisAngle(quat.create(), [0, 1, 0], 0.7);
  assert.ok(quat.equals(fromEuler, fromAxis));
});

test('slerp endpoints, midpoint, and shortest arc', () => {
  const a = quat.create();
  const b = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 2);
  const out = quat.create();

  quat.slerp(out, a, b, 0);
  assert.ok(quat.equals(out, a));
  quat.slerp(out, a, b, 1);
  assert.ok(quat.equals(out, b));

  // The midpoint of a 90-degree arc is a 45-degree rotation.
  quat.slerp(out, a, b, 0.5);
  const mid = quat.setAxisAngle(quat.create(), [0, 1, 0], Math.PI / 4);
  assert.ok(quat.equals(out, mid));

  // Slerping toward a negated quaternion still takes the short way around.
  const negB = quat.set(quat.create(), -b[0], -b[1], -b[2], -b[3]);
  quat.slerp(out, a, negB, 0.5);
  assert.ok(quat.equals(out, mid) || quat.equals(out, quat.set(quat.create(), -mid[0], -mid[1], -mid[2], -mid[3])));
});

test('normalize produces a unit quaternion', () => {
  const q = quat.normalize(quat.create(), [1, 2, 3, 4]);
  assert.ok(Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) < 1e-9);
});
