# Detail density — how "thousands of unique things" is actually done

Nobody models a thousand unique buildings. They build a combinatorial system and then hand-place
the few things the eye lands on.

## The maths that does the work

A building assembled from parts:

| slot | variants |
|---|---|
| footprint / massing | 8 |
| storey count | 6 |
| façade material | 6 |
| window rhythm | 5 |
| roof type | 5 |
| ground-floor unit | 10 |
| signage | 20 |
| wear / dirt level | 4 |

That is 8 × 6 × 6 × 5 × 5 × 10 = 72,000 distinct buildings before signage and wear, from maybe 40
meshes and 20 textures. The work is in the *rules* that keep the combinations plausible: a
Victorian façade does not get an aluminium shopfront in a district that never gentrified.

The same trick everywhere:

- **People**: 4 bodies × 6 tops × 6 bottoms × 8 colour ramps × 3 walk speeds.
- **Cars**: 8 shells × 20 paints × dirt × a few with damage, roof racks, taxi signs.
- **Shopfronts**: sign × awning × window display × security shutter × opening state.

## Per-block density targets

For a dense urban block, roughly what "finished" contains:

| | per 100 m of street frontage |
|---|---|
| ground-floor units / doors | 8–14 |
| windows | 60–120 |
| street lamps | 3–4 |
| bins, benches, bollards, hydrants, signs | 15–30 |
| parked vehicles | 12–18 (kerb both sides) |
| trees / planters | 4–8 |
| wall-mounted clutter (pipes, meters, aircon, cables, dishes) | 40–100 |
| words (signs, numbers, notices, graffiti) | 20–50 |

These are not a checklist to hit uniformly. They are the order of magnitude that separates "a
street" from "a model of a street", and most first attempts are 10× under on the last three rows.

## The eye-height pass

At 1.6 m, in a specific place, the things that actually read:

1. **Contact.** Everything sits *on* something: dirt where the wall meets the pavement, a shadow
   under every object, kerbs that the road surface meets rather than intersects.
2. **Wear where wear happens.** Rust under bolts, stains under gutters, polish on door handles and
   handrails, worn paint on the walking line, chipped kerbs at the corners where lorries cut in.
3. **Edges.** Real edges are never perfectly sharp: chamfers, damage, patched repairs, a different
   material where something was replaced.
4. **Verticality.** Look up. Cables, brackets, pipes, dishes, aerials, string lights, wires
   crossing the street.
5. **Interiors implied.** A window with nothing behind it is a sticker. Even a dark box with one
   shelf, one light and a curtain reads as a room.
6. **Ground.** Joints, drains, patches, tactile paving at crossings, painted lines that are worn
   where the tyres run.

## Where to spend it

The gradient, by how likely the player is to be within 5 m:

| ring | standard |
|---|---|
| the core streets, the missions, the spawn | everything above, hand-checked |
| the rest of the walkable core | systems only, no hand placement, spot-checked |
| drivable outer districts | façades and ground; clutter at half density |
| the far edge and skyline | massing and silhouette only |

Spending the same effort everywhere is how a run ends with 8 % of a city.

## How to check density honestly

Photograph a block at eye height. Photograph a real street of the same kind. Count things in both:
doors, signs, objects, words. The number, not the impression. First attempts are usually a factor
of three to ten short, and the count says so in a way that the eye — which built the thing and
knows what it means — will not.
