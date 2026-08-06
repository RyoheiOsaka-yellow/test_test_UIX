# mathcat

A lean, allocation-free, data-oriented math kernel for interactive apps on
the web. mathcat is the foundation of the pmndrs
[Interactive Math Engine initiative](../initiatives/04-interactive-math-engine.md).

Math is core to everything interactive — from geometry to collision to
color — yet JavaScript lacks a high-performance math kernel. mathcat is a
common convention both agents and people can use to write consistent,
reviewable, fast math.

## Goals

- **Predictable performance.** Allocation-free operations and a documented
  usage contract designed to preserve monomorphic, optimizable call sites,
  validated through reproducible benchmarks (`npm run bench`).
- **Portable.** Flat, column-major arrays interoperate directly with WebGL,
  WebGPU, Wasm, and Three.js — the handoff between kernel and framework is
  a plain buffer.
- **Minimal.** A tree-shakable kernel containing only the primitives needed
  to build interactive algorithms. Zero dependencies.
- **Data-oriented.** Operates on caller-owned data through data-in,
  data-out functions without owning the data lifecycle.
- **Readable.** Every operation is short, explicit, and reviewable — even
  when the calling code was not written by a person.

## The usage contract

Every function follows the same shape:

```ts
op(out, a, b) // writes into out, returns out for chaining
```

1. **The caller owns all data.** mathcat never allocates inside an
   operation; only each module's `create()` helper allocates, and it exists
   purely for convenience at setup time.
2. **`out` may alias an input.** `vec3.add(a, a, b)` accumulates in place.
3. **Inputs are otherwise never mutated.**
4. **Keep call sites monomorphic.** Plain arrays, `Float32Array`, and
   `Float64Array` all work, but mixing array types at one call site defeats
   the JIT. Pick one per code path.

## Usage

```ts
import { vec3, quat, mat4, easing } from 'mathcat'

// Setup: allocate once, own the lifecycle.
const position = new Float32Array(3)
const velocity = new Float32Array([0, 5, 0])
const rotation = quat.create()
const world = new Float32Array(16)

// Per frame: zero allocations.
const update = (dt: number, t: number) => {
  vec3.scaleAndAdd(position, position, velocity, dt)
  quat.setAxisAngle(rotation, UP, easing.cubicOut(t) * Math.PI)
  mat4.compose(world, position, rotation, SCALE)
}

// Handoff to the GPU is a plain buffer — no conversion layer.
gl.uniformMatrix4fv(location, false, world)
```

Import a single namespace to keep bundles lean:

```ts
import * as vec3 from 'mathcat/vec3'
```

## Modules

| Module   | Contents |
| -------- | -------- |
| `vec2`   | 2D vectors: arithmetic, dot/cross, length, normalize, lerp, rotate |
| `vec3`   | 3D vectors: arithmetic, cross, normalize, lerp, transform by quat/mat4 |
| `quat`   | rotations: axis-angle, euler, multiply, conjugate, normalize, slerp |
| `mat4`   | column-major 4x4: multiply, compose (TRS), invert, perspective, lookAt |
| `color`  | RGB in [0,1]: hex and HSL conversion, lerp, sRGB ⇄ linear |
| `random` | seedable mulberry32 RNG, ranges, points on/in circle and sphere |
| `easing` | timing functions, smoothstep, clamp, mix, remap |

## Porting — taking mathcat into another project

`npm run build` generates portable, dependency-free single files in `dist/`:

| File | Use it when |
| ---- | ----------- |
| `dist/mathcat.js` | Your project speaks ES modules — bundlers, Node.js, Deno, Bun, `<script type="module">`. `import { vec3, quat, mat4 } from './mathcat.js'` |
| `dist/mathcat.global.js` | You want a classic `<script src="mathcat.global.js">` tag with no build step. Exposes a frozen `mathcat` global: `mathcat.vec3.add(out, a, b)` |
| `dist/mathcat.d.ts` | TypeScript types for either build. Sits next to `mathcat.js` and is picked up automatically; works with `.js` usage too via `// @ts-check` |

All three are generated from `src/` (the build itself is zero-dependency —
Node's built-in type stripping does the work), so copy them anywhere: another
repo, a CDN, a `<script>` tag in a CodePen. Nothing else needs to come along.

For TypeScript-native runtimes you can instead vendor the `src/` folder
directly and import `src/index.ts` — the per-module entries
(`mathcat/vec3`, …) keep tree-shaking exact.

## Development

```sh
npm test        # correctness tests (node:test, zero dependencies)
npm run bench   # reproducible benchmarks with heap-growth reporting
```

Requires Node.js >= 22.18 (TypeScript type stripping).
