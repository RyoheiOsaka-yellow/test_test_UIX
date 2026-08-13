---
name: webgl-performance
description: Finding and fixing frame cost in a three.js world — draw calls, overdraw, shadows, textures, memory. Use when the budget check fails, when the frame gets slower after a change, or before adding anything that draws a lot of pixels.
---

# Performance

## Measure first, and measure the right thing

```bash
node tools/qa.mjs budget                    # verdict against the budget and the baseline
node tools/qa.mjs perf --seconds 8 --pose aerial
```

Structural numbers (draw calls, triangles, textures, heap) describe **your world** and are
absolute. Frame cost describes **this machine** and is judged against the empty-stage baseline in
`.harness-baseline.json`, because the browser here may be rasterising in software.

Measure with the camera somewhere expensive — a rooftop over a main street — and with the world
full. A budget held on an empty scene is not held. A budget report on a `FLAT` frame is a report
that nothing was drawn.

## The order things cost, on a software rasteriser

1. **Overdraw and fill rate.** Every pixel shaded more than once: large transparent quads, particle
   sprites, full-screen post-processing, glass, water covering the frame, fog volumes. This is the
   dominant cost here and the one that surprises people who have optimised on a GPU.
2. **Draw calls.** Each one is CPU-side setup. Hundreds are fine, thousands are the wall.
3. **Shadow maps.** A shadow-casting light re-renders the scene from the light. One light with
   tight bounds; everything else fakes it.
4. **Triangles.** Cheap by comparison, until they are not — a scanned prop at 200k triangles,
   placed 300 times, is 60M.
5. **Texture memory and uploads.** A stall on first sight of a new texture reads as a hitch.

## Fixes, in the order to try them

- **Instance everything repeated.** One `InstancedMesh` per repeated prop per district.
- **Merge static geometry per block** with `BufferGeometryUtils.mergeGeometries`. Per block, not
  per city, so frustum culling still works.
- **Share materials.** Two materials differing only in colour should be one with per-instance
  colour. Every unique material is a shader program and a state change.
- **Atlas textures.** Fewer, larger textures beat many small ones — and enable more merging,
  because merged geometry needs one material.
- **Cut resolution before you cut content.** `renderer.setPixelRatio(1)` is a free halving on a
  high-DPI display and nobody notices in motion.
- **Distance-cull whole districts.** `group.visible = false` is the cheapest optimisation there is.
- **LOD the silhouettes**, not the details: at 200 m a building is a box with a texture.
- **Kill overdraw**: no full-screen post unless it earns its cost; sort transparency down; small
  particle counts; fog to justify not drawing the distance at all.
- **Update on a budget.** Simulation does not need 60 Hz: full rate near the camera, 4 Hz in the
  mid ring, none beyond. Spread heavy work across frames rather than doing it all in one.

## Finding the actual cost

- Bisect: hide half the scene (`group.visible = false`) and measure. Two or three iterations finds
  the expensive half faster than any reasoning about it.
- `renderer.info` before and after adding a system tells you what it cost in draws and triangles.
- Watch `jsHeapMB` across a regeneration pass — a number that never returns to baseline is a leak,
  and a leak ends a long run.
- Time your own updates: `performance.now()` around a system's update, accumulated per frame,
  reported through the harness. A frame-time regression with no change in draw calls is JavaScript.

## What not to do

- Do not optimise before there is something to optimise. An empty world holds any budget.
- Do not chase the frame rate on a machine with no GPU. Chase the ratio against the baseline and
  the structural numbers; those are what transfer.
- Do not delete content to pass a budget check. The budget exists to make the world affordable,
  not smaller — instancing, LOD and culling buy back everything you would have deleted.
