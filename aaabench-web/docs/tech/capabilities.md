# What this machine can actually do

Check rather than assume — versions move. `bin/setup-capabilities.sh` prints most of this on the
way past, and everything below can be verified in a shell in under a minute.

## The renderer

Chromium, headless, driven by Playwright. WebGL2 is available. **There may be no GPU**: on a
machine without one, ANGLE falls back to SwiftShader and everything rasterises on the CPU.

What that changes, and what it does not:

- **Fill rate is the scarce resource,** not vertex work. Full-screen effects, heavy fragment
  shaders, large transparent surfaces and overdraw cost far more than they would on a GPU.
- **Draw calls, triangle counts, texture counts and memory behave normally.** These are the
  numbers that describe your world rather than the machine, which is why they are the absolute
  half of the budget.
- **Frame cost is judged relative to an empty stage** (`.harness-baseline.json`, written by
  `node tools/qa.mjs calibrate`). Your frame may cost up to 2× that, ceiling 4×.
- Measure at the fixed 960×540 the tools use. A frame time compared across two resolutions is not
  a comparison.

Check what you actually got:

```bash
node tools/qa.mjs eval "(() => { const g = document.createElement('canvas').getContext('webgl2');
  const d = g.getExtension('WEBGL_debug_renderer_info');
  return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) })()"
```

## The engine

**three.js 0.180** with **Vite 7** and **Node 22**. three ships far more than the core: the
addons under `three/examples/jsm/` are part of what you have, and reaching for one is usually
better than writing your own.

Worth knowing exists, because rebuilding these by hand is a bad trade:

| area | addons |
|---|---|
| loading | `GLTFLoader`, `DRACOLoader`, `KTX2Loader`, `RGBELoader` (HDRI), `EXRLoader`, `FontLoader` |
| geometry | `BufferGeometryUtils` (merge, toTrianglesDrawMode), `SimplifyModifier`, `TextGeometry`, `mergeVertices` |
| controls | `OrbitControls`, `PointerLockControls`, `FirstPersonControls`, `TransformControls` |
| post | `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `SMAAPass`, `SSAOPass`, `OutputPass` |
| lighting | `LightProbeGenerator`, `RectAreaLightUniformsLib`, CSM (cascaded shadow maps) |
| misc | `Sky`, `Water`, `Lensflare`, `GPUComputationRenderer`, `Timer`, `Stats` |
| exporters | `GLTFExporter`, `OBJExporter`, `PLYExporter` — for baking generated geometry to disk |

`GPUComputationRenderer` is the cheap way to move thousands of agents (crowds, traffic, birds,
water) without a per-entity JavaScript update, though on a software rasteriser measure it against
a plain typed-array loop before committing.

## Node and npm

The registry is reachable — `npm install` works, in both the harness root and `AgentCity/`. Things
that are a good idea before writing your own: a noise library (`simplex-noise`), a physics engine
(`@dimforge/rapier3d-compat`), a pathfinder, a spatial index (`rbush`), a seeded RNG
(`seedrandom` — determinism matters for a generator you want to re-run), `three-mesh-bvh` for
fast raycasts against big meshes.

Adding a dependency is a decision to maintain it. Adding six is a decision to debug six.

## Python

Python 3.11, standard library, `requests`. **numpy, Pillow, scipy, shapely are not installed** —
`pip install` them if you want them, or do the work in Node, where the data already lives.

`tools/refs.py` uses only the standard library on purpose, so reference lookup never depends on a
successful install.

## Images

- **Reference photographs**: `tools/refs.py` (Openverse; licences printed with every result).
- **Image diffs**: `tools/viewport.mjs diff` uses ImageMagick if present, byte sizes if not.
- **Texture work in the browser** is a real option: draw into a `<canvas>` with the 2D API and
  upload it as a `CanvasTexture`. Procedural signage, posters, decals, number plates, graffiti,
  shop fronts, dirt masks and noise are all cheaper to make this way than to source, and they are
  unique per instance, which is exactly what kills repetition.
- No local image generator ships with this harness. If one is reachable in your environment, it is
  a capability you discovered, not one you were promised.

## The network

Outbound HTTPS works from this container (Openverse answers). Treat everything else as unknown
until you have tried it: some hosts are blocked, and a failed fetch is a fact to note in
`PROGRESS.md`, not a reason to stop. Everything that matters can be built without the network.

## Disk

Writable space is finite and is spent quickly by node_modules, downloaded assets and captures.
`/tmp/aaabench_qa/` grows every time you look at something — prune it. Generated assets belong in
`AgentCity/public/generated/` (already excluded from HMR watching, so writing them does not
reload the page mid-generation).
