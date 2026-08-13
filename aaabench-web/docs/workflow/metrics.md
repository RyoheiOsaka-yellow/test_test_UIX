# Real-world dimensions, and the frame budget

Scale is the first thing that goes wrong and the last thing anyone checks. These are real numbers.
Use them, and keep the 1.8 m reference from the skeleton somewhere in frame while you build.

## People and doors

| | metres |
|---|---|
| adult height | 1.65–1.85 (use 1.75) |
| eye height, standing | 1.60 |
| shoulder width | 0.45–0.5 |
| walking speed | 1.4 m/s (5 km/h); running 4–6 m/s |
| door, residential | 0.9 × 2.05 |
| door, shop | 1.0–1.2 × 2.1 |
| ceiling, home | 2.4–2.6 |
| ceiling, shop / office | 3.0–4.0 |
| storey height, residential | 2.8–3.2 |
| storey height, ground-floor retail | 4.0–4.5 |
| storey height, office | 3.6–4.0 |

A ten-storey residential block is ~30 m, not 40. Getting this wrong makes every window look like a
doll's house window, and no amount of texture detail fixes it.

## Streets

| | metres |
|---|---|
| traffic lane | 3.0–3.7 (3.5 typical) |
| parking bay, parallel | 2.5 × 6.0 |
| parking bay, perpendicular | 2.5 × 5.0 |
| cycle lane | 1.5–2.0 |
| pavement, residential | 1.8–2.5 |
| pavement, high street | 3.5–6.0 |
| kerb height | 0.10–0.15 |
| residential street, kerb to kerb | 5.5–7.0 |
| two-lane street with parking both sides | 12–13 |
| four-lane avenue with median | 22–28 |
| motorway lane + hard shoulder | 3.65 + 3.0 |
| street lamp height | 5–6 residential, 8–12 arterial |
| lamp spacing | 25–40 |
| traffic light height | 3.0–3.5 to the lens |
| road sign, lower edge | 2.1 over pavement |
| bus stop shelter | 4.0 × 1.5 × 2.4 |
| pedestrian crossing stripes | 0.5 wide, 0.5 gap |

## Blocks and plots

| | metres |
|---|---|
| Manhattan block | 80 × 274 |
| European perimeter block | 60–100 square |
| suburban block | 100–200 × 300–500 |
| terraced house plot width | 4.5–6.5 |
| shop frontage, high street | 5–8 |
| supermarket | 40 × 60 plus car park |
| courtyard, perimeter block | 20–40 across |
| service alley | 3–5 |
| setback, tower over 8 storeys | 3–6 at street level |

Street-level frontage is the number that decides whether a street reads as alive. A 100 m block
face with three doors is a business park. The same face with 14 doors is a high street.

## Vehicles

| | metres |
|---|---|
| car | 4.4 × 1.8 × 1.5 |
| van | 5.5 × 2.0 × 2.3 |
| bus | 12.0 × 2.55 × 3.2 |
| articulated lorry | 16.5 × 2.55 × 4.0 |
| tram | 30 × 2.4 |
| shipping container | 12.2 × 2.44 × 2.6 (40 ft) |
| harbour gantry crane | 50–80 tall |

## The frame budget

Structural, absolute, because it describes what you built:

| | want | ceiling |
|---|---|---|
| draw calls | 900 | 2000 |
| triangles | 3M | 8M |
| textures | 250 | 600 |
| JS heap | 900 MB | 1800 MB |
| frame cost vs empty stage | 2.0× | 4.0× |

`node tools/qa.mjs budget` measures all of it and exits non-zero when over.

### Where it goes, and what to do

- **Draw calls** are the first wall. One `InstancedMesh` per repeated thing (windows, lamps,
  bollards, trees, parked cars) turns 4000 calls into 12. Merge static geometry per block with
  `BufferGeometryUtils.mergeGeometries`. Share materials — two materials that differ only in
  colour should be one material with per-instance colour.
- **Triangles** are cheaper than draw calls but not free. Buildings do not need geometry for
  window frames at 200 m; that is a texture. Keep an LOD per building class and swap on distance.
- **Textures** are memory and upload cost. Atlas the small ones. 512² is plenty for most props;
  2K is for hero surfaces only. Compressed (KTX2) where you can.
- **Overdraw** is the software-rasteriser killer specifically: large transparent quads, particle
  clouds, full-screen post, and glass everywhere. Measure before and after adding any of them.
- **Culling.** three.js frustum-culls per object, which is exactly why merging a whole district
  into one mesh can make things *worse* — merge per block, not per city.
- **Shadows** are a per-light full re-render. One shadow-casting light, tight bounds, cascades if
  you need range. Bake or fake everything else — a contact-shadow quad under a prop costs nothing
  and sells the contact better than a real shadow at that scale.

### How to read a budget failure

The budget is measured with the camera *somewhere bad* — a rooftop looking down a main street,
not an empty field. Budgets held on an empty scene are not held. And a budget report on a `FLAT`
frame is not a pass; it is a report that nothing was drawn.
