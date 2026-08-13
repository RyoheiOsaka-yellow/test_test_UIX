---
name: procedural-gen
description: Generating terrain, road networks, blocks, parcels and buildings — and validating the output so it describes a possible place. Use when building any generator, when a generated area looks uniform or impossible, or before running a generation pass over the whole map.
---

# Procedural generation

Generation is the only way to get the volume. It is also the fastest way to fill a map with
plausible numbers describing impossible places.

## Determinism is not optional

Seed everything (`seedrandom`, or a small xorshift you own). A generator you cannot re-run
identically is one you cannot debug, cannot regression-test, and cannot fix — because every run
produces a different city and yesterday's problem is gone without being solved.

Derive sub-seeds from a hash of the identity: `seed('harbour/block-14/parcel-3')`. Then
regenerating one parcel does not move the rest of the city.

## Terrain

- Layered value/simplex noise: a low-frequency continent shape, mid-frequency hills, high-frequency
  detail, multiplied by a mask rather than added, or everything ends up the same lumpy texture.
- Real terrain has **erosion**: valleys widen downstream, ridges are sharp, slopes are concave near
  the bottom. A single noise field has none of that and reads as a bad golf course. Even a cheap
  hydraulic pass over a coarse grid changes the character completely.
- Water first: decide sea level and rivers, then flatten what has to be flat. A city needs a
  buildable area, and "the geography made this hard" is a fact you decide in advance, not one you
  discover after placing 400 buildings.

## Road networks

Build a graph, not a picture:

1. **Primaries** connect the reasons to travel: the port, the crossing, the station, the exit from
   the region. They follow contours and cross water where it is narrow.
2. **Secondaries** subdivide the areas between primaries, at 200–600 m spacing.
3. **Local streets** fill blocks at 60–150 m spacing, in the pattern of their era: irregular in the
   old town, grid in the planned district, cul-de-sacs in the suburb, superblocks in the estate.
4. **Junctions** are nodes with a type. Not every crossing is a crossroads.

Gradients matter: 8 % is steep for a street, 12 % is exceptional, 15 % needs steps. A generator
that ignores the terrain draws roads no one could drive.

## Blocks and parcels

- Cut blocks from the road graph as faces of the planar graph — not as rectangles laid over it.
- Subdivide each block into parcels by frontage: a strip along each street edge, split at plot
  widths appropriate to the district (4.5–6.5 m terraced, 15–30 m commercial). What remains in the
  middle is a courtyard, a car park, a service yard, or infill — all of which are real.
- **Reject the degenerate.** Parcels under ~30 m², slivers thinner than 3 m, parcels with no
  frontage, blocks with fewer than three edges. Count what you rejected and log it: a rejection
  rate over ~10 % means the subdivision rule is wrong, not that the world is awkward.

## Buildings

Assemble rather than model: footprint → storey count → façade grammar → roof → ground-floor unit →
signage → wear. See `docs/workflow/detail-density.md` for the combinatorics that turn 40 meshes
into tens of thousands of buildings.

Height should come from something: land value, district rule, era, distance from the centre, a
plot's frontage width. Random heights read as random.

## Validate, always

After every pass, before building on top of it:

```js
// the shape of the distribution, not one example
const areas = parcels.map(p => p.area).sort((a, b) => a - b)
return { n: areas.length, p5: areas[areas.length * 0.05 | 0], median: areas[areas.length / 2 | 0],
         p95: areas[areas.length * 0.95 | 0], degenerate: areas.filter(a => a < 30).length }
```

- Histogram block sizes, parcel areas, building heights, street lengths, junction degrees.
- Check connectivity: is the road graph one component? Can you reach the port from the estate?
- Then **look**: photograph three random blocks at eye height and Read the images. A generator
  whose output you have never looked at is a claim, not a system.

## The failure that repeats

Uniformity. A generator applied evenly produces a city where every district is the same city.
Vary the *rules* per district — block size, plot width, height rule, setback, material palette,
clutter density — and vary them at the seams, where two eras meet. That seam is the most
interesting thing a generated city can have.
