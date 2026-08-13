# The level pipeline

Blockout → set dress → lighting → polish. The order is not a convention; each stage depends on
decisions the previous one locks down, and doing them out of order means doing them twice.

## Blockout

Grey boxes at correct dimensions. No textures, no detail, one material.

What you are deciding: street widths, block sizes, building footprints and heights, sightlines,
where the landmarks are, how long it takes to walk anywhere, where the player can and cannot go.

How to know it is right:

- Walk it in `play`. Distances feel wrong long before they measure wrong.
- Photograph the `street` pose and compare the *proportions* against a real photograph. Road
  width against building height is the ratio that makes a street feel like a canyon, a boulevard
  or a suburb.
- Look at the `aerial`. Can you tell the districts apart by their massing alone? If not, they are
  not different places yet — they are one place with different labels.

Do not dress anything until this survives all three.

## Set dressing

The pass that turns a blockout into somewhere. In rough order of how much each buys you:

1. **Façade variation.** Storey heights, window rhythms, materials, shopfronts, roof lines. The
   same base building with four roof types, six façade materials and eight shopfronts is 192
   buildings, and it costs almost nothing.
2. **The ground plane.** Kerbs, drains, manholes, road markings, patches, cracks, puddles, the
   line of dirt where the pavement meets the wall. Cities are mostly ground in every frame that
   matters, and untouched ground is the most common reason a street looks like a diorama.
3. **Street furniture.** Lamps, bins, bollards, benches, hydrants, post boxes, signs, poles,
   cabinets, cameras, bike racks, phone boxes, scaffolding. Placed by rule (spacing, alignment to
   the kerb, near what they serve), not scattered.
4. **Vertical clutter.** Pipes, cables, aircon units, satellite dishes, vents, fire escapes,
   awnings, brackets, wires across the street. This is the difference between a wall and a
   building.
5. **Signage and words.** Shop names, street signs, numbers, notices, prices, graffiti, ghost
   signs. Invent all of them; a city with no words is uninhabited.
6. **Vegetation.** Street trees in pits with grates, weeds in cracks, window boxes, an unkempt
   lot, moss on the north side.
7. **Evidence of people.** Parked cars at plausible angles, a bike chained to a rail, bins out on
   the right day, laundry, a chair on a balcony, a delivery half-unloaded.

Each of these should be a *system* with rules and randomness, not hand placement — except where
hand placement is better, which is at landmarks and anywhere the player is guaranteed to stand.

## Lighting

Lighting last, because it is the fastest way to make an unfinished thing look finished and
therefore the fastest way to stop noticing what is unfinished.

- One directional sun with shadows, tight cascade bounds, moving through the day.
- Sky and ambient that change with the sun; a hemisphere light or an environment map, not a flat
  ambient that kills every form.
- Fog with distance, tuned per weather state. Fog is also a performance tool: it justifies not
  drawing the far edge.
- Artificial light as *sources* — lit windows (emissive, varied, some off), lamps with pools on
  the ground, headlights, signs. Night without sources is a dark day.
- Emissive materials plus a cheap bloom sell light far better than more real lights, and cost a
  fraction as much.

## Polish

The loop, forever: sweep the poses, read them cold, find the worst thing, fix it, measure, commit.

A polish pass is finished when the next thing you would fix is smaller than the last thing you
fixed — not when the list is empty. The list is never empty.

## The trap in this order

Set dressing feels like progress and blockout does not, so the pull is always to dress the first
street before the map exists. Resist it. A dressed street on a map with no plan is the single most
common way this work fails, and it fails late, when the geography turns out to be wrong and the
dressing has to come off.
