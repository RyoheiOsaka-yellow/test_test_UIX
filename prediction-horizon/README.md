# The Prediction Horizon

An interactive probabilistic state projection. `NOW` marks the present, branching
paths map possible futures, and the controls alter uncertainty, horizon and noise
as evidence reshapes the predictions.

Vanilla JavaScript + Canvas 2D. No dependencies, no build step, no network calls —
open `index.html` in a browser.

```bash
open prediction-horizon/index.html
# or serve it:  npx http-server prediction-horizon
```

## The model

36 sample paths (6 families × 6 members) are integrated across a log-scaled time
axis, so `T+01` sits close to `NOW` and `T+32` sits near the horizon.

Each path is the sum of three terms — a family drift, a per-member spread, and an
fBm noise term — widening as `tau^1.2` to form the classic diffusion cone. The
result is soft-saturated through `tanh` so no path can ever escape the plot,
however wide the cone gets.

- **Uncertainty** scales the whole cone.
- **Horizon** sets how far ahead the projection runs (T+8 … T+64), which re-spaces
  the time axis; ticks that would crowd are dropped.
- **Noise** drives the fBm jitter riding on each path.
- **Evidence** switches on the phase boundary: a Gaussian contraction that pinches
  the cone toward its mean at the boundary, after which variance re-widens.

Endpoint statistics feed the read-outs — a weighted histogram gives normalised
Shannon entropy (`ENT`), modal mass over three macro-bands gives `P`, and the
weighted mean gives `DELTA`. Entropy and variance stream into the history
sparklines, which auto-range to their own span.

## Panels

| Panel | Shows |
| --- | --- |
| Near-term branches | the first 13% of the cone, zoomed |
| Local sensitivity | perturbation response around the current state |
| Prediction memory | past projections decaying to the left |
| Family weight | the 6 family mixture weights — **drag to set** |
| Entropy / history | entropy and variance over time |
| Alt / coord phi | alternate coordinate projection |
| Density projection | `P(X,T)` as ridgelines over a perspective grid |

## Controls

| Input | Action |
| --- | --- |
| Sliders | uncertainty / horizon / noise (drag, or arrows · shift+arrows · home · end when focused) |
| `EVIDENCE` | toggle the phase boundary |
| `⇌` | resample — new seed, unlocks family weights |
| `PAUSE` / `Space` | freeze model time (the view stays interactive) |
| `E` / `R` | evidence / resample |
| Drag on plot | move the evidence boundary |
| Drag family weight | set that family's weight and lock it from auto-drift |
| `›` | collapse the control panel |

Layout is responsive: below ~940px wide the side panels and density projection
drop away, the header stacks, and the bottom strip is reserved for the controls.
