# Systems, with real parameters

"Add traffic" is not a specification. These are the numbers and the shapes that make each system
behave like the real thing, and the cheap way to get each one inside the frame budget.

## Traffic

Real densities, so a street reads correctly rather than as a parade:

| road | vehicles/km/lane, daytime | night |
|---|---|---|
| motorway, free flow | 15–25 | 4–8 |
| urban arterial | 30–50 | 8–15 |
| residential street | 2–8 | 0–3 |

- **Speeds**: 50 km/h urban (14 m/s), 30 km/h in a centre, 100+ on the motorway. Junction
  approach at 20–30 km/h.
- **Following distance**: two seconds. At 14 m/s that is 28 m — much larger than instinct suggests,
  and cars packed closer than this read as a car park.
- **Cheap model that works**: cars are points on a spline network with a speed and a leader.
  Follow the leader (IDM or a simple gap-keeping rule), obey a junction token, respawn out of
  sight. No physics, no pathfinding per frame; a route is chosen once at spawn.
- **Junctions**: a signal cycle of 60–90 s with 3–5 s of amber and a 2 s all-red. Or give-way
  rules with a reservation token. Either way, cars must *stop*, and the stopping is what makes a
  junction read as a junction.
- **Instancing**: one `InstancedMesh` per vehicle type, per-instance colour, matrices updated in a
  typed array. Thousands of vehicles is a few draw calls.
- **Culling**: simulate a radius around the player at full rate, a larger radius at 4 Hz, and
  nothing beyond it. Nobody can tell.

## Pedestrians

- **Density**: a busy high street pavement carries 0.3–1.0 people per m²; a residential street at
  night, effectively none. Crowd where there is a *reason* — transit, shops, a market, an
  entrance — and thin everywhere else. Uniform crowd density is the tell that it is a spawner.
- **Speed** 1.4 m/s, slower in a crowd, faster in the rain.
- **Model**: steering (seek + separation + wall avoidance) on a pavement graph, with crossings as
  gated edges. Flow fields are cheaper than per-agent pathfinding for large numbers and look
  identical in a city.
- **Variation** is the whole game: a handful of body meshes × colour ramps per garment × walk
  cycle offsets × speed jitter. Two identical people in one frame is worse than ten fewer people.
- **LOD**: full skinned animation near the camera, a cheap animated impostor or a simple
  bob-and-slide at distance.

## Day and night

- Sun elevation from a real solar model or a good approximation; what matters is that shadows are
  long at dawn, short at noon, and swing across the day.
- **A day in 20–40 minutes** of real time is the usual compromise. Faster than 10 and it reads as
  a light show.
- Lights on at dusk with jitter — not every window at once. 20–40 % of residential windows lit at
  9 p.m., 5–10 % at 3 a.m. Shops dark but signs lit. Street lamps all on, some broken.
- Traffic and crowd density curves by hour: a morning peak, a lunch bump, an evening peak, near
  nothing at 4 a.m.

## Weather

- At least one state that changes the *material* of the world, not just the colour: rain that
  darkens and wets surfaces (roughness down, a little reflection), puddles in the low points,
  spray behind cars, people with umbrellas, fewer of them.
- Fog states change draw distance, which is a performance lever as much as a mood one.
- Wind that moves the same things consistently — flags, laundry, trees, smoke, litter. Smoke that
  drifts against the flags is the kind of mistake nobody can name but everybody sees.
- Transitions over 30–120 s. An instant weather change reads as a bug.

## Economy and simulation

You do not need an economic model. You need *evidence* of one:

- Deliveries arrive at the backs of shops in the morning. Bins go out on a schedule. A market sets
  up and packs down. A ferry runs a timetable and is somewhere plausible when you look.
- Prices on signs, in a currency you invented, consistent between districts — cheaper by the
  motorway, dearer on the waterfront.
- Property follows the same logic as placement: the money is uphill, upwind, with the view.

If a player can predict what will happen at 7 a.m. and be right, the world has a clock. That is
worth more than a simulation nobody can see.

## Wanted level / consequence (if your game has one)

- Tiers of response with real radii: reported (200 m, one unit), searching (400 m, three units,
  2–3 minutes), pursuit (roadblocks on the primary network), lost after 40–90 s out of sight.
- The response has to use the same road network as the traffic, or it reads as teleportation.

## Audio

- Ambience beds per district, cross-faded by position, changed by hour and weather.
- Positional sources for anything visible: traffic on the arterial, gulls at the harbour, a
  generator behind the restaurant, the market.
- Footsteps by surface. Getting this right is worth more than a second music track.
- Web Audio: a handful of buses (ambience / world / UI / music), an `AudioListener` on the camera,
  and hard limits on concurrent voices. Autoplay is blocked until the first user gesture — the
  title screen exists partly to be that gesture.

## The rule that ties them together

Two systems that never touch are two demos. Weather changes traffic density and pedestrian
behaviour. Time changes both, and the lights. A blocked street reroutes cars. A siren makes
pedestrians turn. Each crossing is a few lines of code and is most of what makes a world feel
simulated rather than animated.
