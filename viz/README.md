# Blast Radius Console

`blast-radius-console.html` — a live swarm-telemetry visualization: six agents
sharing one browser profile, one login, one credential set. Open the file
directly in a browser; it is self-contained, with no build step, no
dependencies, and no network access.

## Controls

| Input      | Effect                              |
| ---------- | ----------------------------------- |
| `Space`    | play / pause                        |
| `1 2 4 8`  | speed ×1 ×2 ×4 ×8 (default ×4)      |
| `R`        | reset the run                       |

Speed multiplies simulation steps per animation frame, so the whole console —
web churn, packets, run log, heat, throughput — accelerates together.

## The upper cluster's choreography

The upper cluster is a 3-D disc — thin in y, wide in x and z — carried through
three simultaneous rotations, all read straight off the tick counter:

| Motion  | Range              | Period at ×4 |
| ------- | ------------------ | ------------ |
| yaw     | full 360°          | ~5.8 s       |
| pitch   | ±60°               | ~10 s        |
| roll    | ±11°               | ~15 s        |

Pitch is the one that changes the silhouette: at 0° the disc is edge-on and reads
as the flat band, and near its extremes it opens into a full volume. Radii are
kept in `GW` units so rotation stays circular instead of skewing with the stage
aspect, and a perspective divide (`FOCAL / (FOCAL + z)`) makes the front of the
disc larger and brighter.

Strand count rides on that: an open face spreads the cloud and takes more ink to
read, an edge-on band concentrates it and takes less, and a slower independent
swell on top makes the growing and thinning legible in its own right. The
multiplier runs roughly ×0.7 – ×1.5 and is shown live in the top rail next to
`SPIN` and `TILT`.

Hubs, tags, and the halo stay pinned while the cloud tumbles around them — they
are named jobs and stage furniture, and their labels have to stay readable.

## How the picture is built

The graph is two canvases. An offscreen accumulation buffer receives ~330 fresh
quadratic strands per step under `lighter` compositing and fades by 2.2% per
step, so roughly 30 steps of traffic are on screen at once — that persistence,
not the per-frame stroke count, is where the density comes from. Strands are
batched into nine colour/weight buckets so each step costs nine `stroke()` calls
instead of hundreds. The visible canvas composites that buffer, then draws
packets, nodes, and labels on top.

## Determinism

No `Date.now()`, no `Math.random()`, no fetches. All randomness comes from a
seeded `mulberry32`, and all motion is driven by an integer tick counter, so a
fixed-fps renderer that calls `step()` a fixed number of times per frame
produces identical footage every run. `window.__blastRadius.seek(n)` jumps to
frame `n` from a clean state.

That makes it droppable into the HyperFrames pipeline in `promo/` for MP4
output: register a paused timeline, call `seek()` from the `hf-seek` event, and
give the wrapper element the usual `class="clip"` plus `data-start` /
`data-duration` / `data-track-index` attributes.
