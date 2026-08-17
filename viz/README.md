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
