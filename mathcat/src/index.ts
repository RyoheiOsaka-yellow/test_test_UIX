/**
 * mathcat — a lean, allocation-free, data-oriented math kernel for
 * interactive apps on the web.
 *
 * Import namespaces per primitive so bundlers can tree-shake what you
 * don't use:
 *
 *   import * as vec3 from 'mathcat/vec3'
 *
 * or pull everything from the root:
 *
 *   import { vec3, quat, mat4 } from 'mathcat'
 */
export * as vec2 from './vec2.ts';
export * as vec3 from './vec3.ts';
export * as quat from './quat.ts';
export * as mat4 from './mat4.ts';
export * as color from './color.ts';
export * as random from './random.ts';
export * as easing from './easing.ts';
export { EPSILON } from './types.ts';
export type { NumberArray, Vec2, Vec3, Quat, Mat4, Color } from './types.ts';
