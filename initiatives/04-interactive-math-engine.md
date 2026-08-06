# Interactive Math Engine

**Status: Active**

**Lead: [@isaac_mason_](https://github.com/isaac-mason)**

## Motivation

Math is core to everything interactive — from geometry to collision to color —
yet JavaScript lacks a high-performance math kernel. Instead, libraries
reinvent math structures and transformations with varying success, and now
LLMs generate bespoke functions on a case-by-case basis. The problem is that
there are no principled guarantees for correctness or performance, leading to
degraded apps or difficult-to-read code.

We need a math engine that can be used to power all the cool projects people
want to make at scale — a common convention both agents and people can use to
be more consistent writing the math that powers inspiring apps on the web.

## Goals

- **Predictable performance.** Allocation-free operations and a documented
  usage contract designed to preserve monomorphic, optimizable call sites,
  validated through reproducible benchmarks.
- **Portable.** Efficiently interoperates with WebGL, WebGPU, Wasm, Three.js,
  etc., so that the handoff between math kernel and framework is simple.
- **Minimal.** A lean, tree-shakable kernel containing only the primitives
  needed to build interactive algorithms.
- **Data-oriented.** Operates on caller-owned data through data-in, data-out
  functions without owning the data lifecycle.
- **Readability.** It is important that the core math operations are readable,
  such that even if the code is not written by a person, they can reasonably
  review it.
- **Ecosystem foundations.** Establish a platform the ecosystem can build
  interactive mathematics on top of.

## Scope

**In scope:** vectors, rotations, matrices, computational geometry, noise
functions, color operations, randomization, timing/easing functions, and
visualizations.

**Out of scope:** non-generalizable mathematics, non-spatial data structures,
spatial traversal systems, and data management layers.

## Resources

- [mathcat](../mathcat) — the foundation this initiative starts from
- Prior art: gl-matrix, and lessons from navcat, crashcat, and gpucat
- Join the conversation on [Discord](https://discord.com/invite/poimandres)
