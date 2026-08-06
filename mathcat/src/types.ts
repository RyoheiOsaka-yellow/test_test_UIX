/**
 * mathcat operates on caller-owned, flat numeric arrays.
 *
 * Every function follows the same data-in, data-out contract:
 *
 *   op(out, a, b) -> out
 *
 * - `out` is written in place and returned for chaining.
 * - Inputs are never mutated (unless also passed as `out`, which is allowed).
 * - No function allocates; the caller owns every array's lifecycle.
 * - Plain arrays, Float32Array, and Float64Array are all accepted, but for
 *   predictable performance keep each call site monomorphic: pick one array
 *   type per code path and stick with it.
 */
export type NumberArray = number[] | Float32Array | Float64Array;

/** A 2-component vector: [x, y] */
export type Vec2 = NumberArray;

/** A 3-component vector: [x, y, z] */
export type Vec3 = NumberArray;

/** A quaternion: [x, y, z, w] */
export type Quat = NumberArray;

/** A 4x4 matrix, column-major (WebGL/WebGPU convention), 16 elements */
export type Mat4 = NumberArray;

/** An RGB color with components in [0, 1]: [r, g, b] */
export type Color = NumberArray;

/** The tolerance used by approximate comparisons. */
export const EPSILON = 0.000001;
