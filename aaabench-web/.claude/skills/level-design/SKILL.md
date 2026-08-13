---
name: level-design
description: Making a place readable and worth moving through — landmarks, sightlines, districts that differ, pacing, and navigation without a minimap. Use when laying out the map, when a district feels generic, or when players (or you) get lost.
---

# Level design for an open world

## Legibility — the five elements

A city is navigable when it has all five (Lynch's vocabulary, still the best tool for this):

- **Paths** — the routes you move along. They should have a hierarchy you can feel: a main street
  is wider, straighter, busier, better lit.
- **Edges** — water, a railway, a motorway, a cliff. They tell you where one thing stops.
- **Districts** — areas with a character you can name. If a stranger cannot tell they have entered
  a different district without a UI label, it is not one.
- **Nodes** — squares, junctions, stations. Places where decisions happen and people gather.
- **Landmarks** — visible from far, unique, orienting. A city needs 3–7 of them, at different
  scales: one visible from anywhere, several per district, small ones per block.

Build all five deliberately. A map that has only paths and buildings is a maze.

## Sightlines and the reveal

- Put a landmark at the end of a long street. A street that terminates in a view is worth ten
  identical streets.
- Vary enclosure: a tight lane opening onto a square is a designed feeling, and it costs nothing
  but layout.
- Frame the arrival. The first view of the city — from the water, the ridge, the motorway — is
  the establishing shot; place a pose there and check it every session.
- Hide things. A place with no discovery is a diagram.

## Districts that actually differ

Vary all of these per district, or they will look like one city with different labels:

| | what to change |
|---|---|
| block size and street width | the old town's blocks are smaller and its streets crooked |
| plot width | 5 m terraces vs 30 m commercial frontages |
| height rule | uniform 4 storeys vs towers with setbacks vs sheds |
| material palette | brick / render / concrete / steel / timber |
| era and wear | which decade built it, and how it has been maintained |
| ground treatment | cobbles, asphalt, concrete slab, gravel, mud |
| clutter density and kind | market stalls vs pallets vs nothing but bins |
| light | lamp type, colour and spacing; how dark it gets |

## Pacing

Movement speed sets the grain. On foot, something interesting every 20–40 m. In a car, every
200–400 m. If the map supports both, it needs both scales of detail — which is why a walkable core
plus a drivable outer city is a common shape, and a good one.

Rhythm: dense → open → dense. A square, a park, a waterfront, an empty lot. Continuous density is
as fatiguing as continuous emptiness.

## Navigation without a minimap

Playable without the HUD is the test. It means:

- landmarks visible above the roofline from most places;
- a consistent logic (the water is always north, the ground rises toward the old town);
- streets that lead somewhere rather than terminating arbitrarily;
- distinct districts, so "where am I" is answerable by looking.

Then add the map screen — because the demand asks for one — and check that it agrees with the
world. A map that does not match what you can see is worse than no map.

## Where the player will be

Decide it early and let it drive the quality gradient: the spawn, the mission sites, the main
walking routes get everything; the outer ring gets systems only; the far edge reads from the air.
Uniform effort is how a run ends with a small finished thing and a large empty one.

## Checks

- Walk the main route in `play`, end to end, and time it.
- Photograph from each district's centre looking toward the core: is the landmark visible?
- Show yourself the `aerial` and ask whether you could describe the layout to someone in three
  sentences. If not, it is not legible yet.
