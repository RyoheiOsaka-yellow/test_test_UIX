# The demand

Build an open-world game. Not a demo, not a scene, not a tech test — a place, and a game that
takes place in it.

You have a real engine (a browser with WebGL2, which ships every renderer, every input device
and every distribution channel you need), a real project, a shelf of production knowledge, tools
that let you see and play what you have made, and time. Nobody is going to review this, unblock
you, answer you, or tell you what is wrong with it. There is no reviewer, no product owner and
no finish line. Work until you are cut off.

Everything below is what "good" means. None of it is a task list, and none of it will be
checked off for you.

---

## Scope — this is a CITY, not a street

One coherent settlement with its surroundings: water or terrain that decided where it went,
districts that are different from each other because they do different things, a road network
with a hierarchy, and edges that go somewhere rather than stopping.

A single well-dressed street is the classic failure here. It is the thing that is easy to make
look good in a screenshot and impossible to stand inside. If your world can only be photographed
from one angle, you have built a film set.

### How big? Your call — but make it a world

Real reference points, so the decision is informed rather than arbitrary:

| | walkable extent | what fills it |
|---|---|---|
| a believable small city core | 1.5 × 1.5 km | 6–10 districts, 200–400 blocks |
| a large open-world map | 4 × 4 km and up | plus countryside, coast, industry, an airport |
| one dense block | 80 × 80 m | 6–20 parcels, 30+ ground-floor units |

Pick a size you can fill. An empty 8 km map is a worse result than a full 1 km one, and "I ran
out of time to fill it" is a decision you made at the start, not something that happened to you.

### Breadth first, then a quality gradient

This is how open worlds are actually built, and it is the only order that survives being cut off:

1. **The whole map, rough.** Terrain, water, the road network, district boundaries, block
   footprints, massing. Ugly is fine. Missing is not.
2. **Systems, thin.** Player, camera, traffic, pedestrians, day/night, the game's screens. All of
   them working badly beats one of them working beautifully.
3. **Quality, in a gradient.** Push the districts the player will be in most to a high bar, the
   next ring to a decent one, the far edge to "reads correctly from a distance". Uniform coverage
   is a failure, and so is one perfect corner in a grey city.

At every point, the whole thing should be shippable-shaped. Never leave the world in a state
where the answer to "what if this stopped now" is "there is nothing to look at".

---

## What you have

**The project.** `AgentCity/` — Vite, three.js, an empty stage, and a sensor contract in
`src/engine/harness.js`. Restructure it however you like. The one thing you must keep answering
is `window.__aaabench`: it is how anything outside the page can see what you built. Blind
sensors do not make a run look better; they make it unmeasurable, and an unmeasurable run is a
failed one. Extend it freely — a sensor for your own systems is a good idea, and a `describe()`
that reports your districts is a better idea than one that reports `Mesh: 40312`.

**The control surface** (MCP server `agentcity`, always available):

| tool | what it is for |
|---|---|
| `viewport_capture` | photograph the game from a named pose or an explicit camera; returns a **path** |
| `viewport_poses` | list poses, add your own — one per district, per landmark, per shot you keep re-checking |
| `scene_describe` | what is in the scene, how big it is, what systems are running |
| `perf_sample` | frame cost, draw calls, triangles, textures, heap, against the machine's baseline |
| `console_drain` | everything the page logged, including anything thrown during boot |
| `eval_js` | run code *inside* the running game — spawn, move, measure, delete, no reload |
| `play` | drive it with real input, capture as you go, and find out whether input does anything |
| `reload` | throw page state away and check a cold start still works |

**Command-line tools** (same capabilities, scriptable, for batches and for background work):

```
node tools/viewport.mjs shot night-market --pose street
node tools/viewport.mjs sweep after-lighting          # every pose, one file each
node tools/qa.mjs describe | tools/qa.mjs budget | tools/qa.mjs errors
node tools/play.mjs --seconds 30 --shots 6
python3 tools/refs.py grab "fish market" --n 4        # real photographs, licences printed
```

**The handbook** — `docs/`. Production workflow, the level pipeline, real-world dimensions,
system parameters with real numbers, how detail density actually works, the world inventory
(hundreds of kinds of thing a real map contains), asset sources and their licences, and how to
drive the control surface. Read what you need, when you need it.

**Skill packs** — `.claude/skills/`. Sixteen of them: scene graph and instancing, WebGL
performance, shaders, procedural generation, level design, game feel, crowds and AI, camera,
UI/UX, input, audio, dialogue, saves, physics, the asset pipeline, and reference images. Load the
one for the domain you are in before you invent an approach.

**Subagents.** A city is more than one context. Use them.

---

## Invent freely — but the world has to obey reality

Invent the city. Invent its name, its history, its industries, its politics, its brands, its
music, its slang, its weather. Do not reproduce a real city, and never reproduce a real company's
name, mark, slogan or livery, or anything from an existing game.

What you may not invent is how the world works. A port on a shallow bay, a rail line that ends in
a park, a financial district built on a flood plain with no defences, a market at the far end of
a cul-de-sac, a six-lane road with no junctions — these read as wrong to any stranger with no
expertise required, because they violate things everyone knows without being able to say why.

---

## Required content — a game, not a walking simulator

The world is the hard part. It is not the whole part.

- **A player.** A body with mass that collides with the world, a camera rig that does not clip
  through walls, and controls that feel like something. Third or first person, your call.
- **Traversal.** Walking is the floor. A vehicle, a bike, a boat, a train, a lift, a zipline —
  something that changes the scale at which the city can be read.
- **The game's own screens.** A title screen that is not the level with text over it. A HUD. A
  full-screen map with named districts and a player marker. A pause menu. Settings that do
  something. It has to open like a game.
- **Missions or objectives.** At least a handful with a beginning, a middle and an end, given by
  someone, taking place somewhere specific, with a reason to exist in that district.
- **A cast.** People with wants, contradictions and voices — not quest dispensers. Write them.
- **Dialogue.** Whatever form fits: barks, a conversation UI, radio, overheard lines on the
  street. Text is fine. Bad writing is not.
- **A save.** The world should survive a reload with the player where they left it.
- **Sound.** Ambience that changes by district and by time, footsteps that match the surface,
  traffic you can hear before you see. Silence reads as a bug.

---

## Never guess what something looks like — go and look

You have `tools/refs.py` and it needs no key.

```
python3 tools/refs.py find "cargo terminal"     # what exists, with licences
python3 tools/refs.py grab "fire escape" --n 4  # download the top N
```

Keep queries to **two or three words** — every term is ANDed, so a long sentence returns zero
results and looks like "there are no photographs of this".

The loop that works:

1. **Find** a photograph of the real thing.
2. **Download** it, and **Read** it. Actually look.
3. **Capture** your own version from the same angle, and Read that.
4. **Write down the gap** — in a file, with specifics. "The real one has six vents, a rust line
   at the base, cable trays on the outside, and nothing is the same grey." That list is the work.

The gap is never "it needs more detail". It is always specific, and it is usually something
structural that no amount of texture fixes.

---

## Anchor every district to a real place, then transform it

Pick a real place with the same job as your district — not the same look. A working fishing
harbour, a post-industrial riverside, a 1970s social housing estate, a container terminal, a
downtown built in an oil boom. Learn how it is arranged and why. Then change the geography, the
era, the materials and the names until it is yours.

Anchoring is what stops invention from producing a generic city. Transforming is what stops it
from producing a copy.

---

## Reason from how the real world actually works

Nothing may be placed because it looked good there. Every district, block and parcel has to be
derivable from something — geology, water, trade, money, law, time. A few of the mechanisms a
city is made of:

- **Deep water decides the port.** Not the pretty bay: the deep one, with land behind it for the
  yards and a road out that does not go through a residential street.
- **Industry follows the rail and the water,** and stays downwind and downstream of the money.
- **Money builds uphill and upwind,** and buys the view. Poverty gets the flood plain, the
  motorway edge, the flight path.
- **The old town is where the crossing was** — a ford, a bridge, a harbour mouth. Streets there
  are older, narrower and not on the grid, because they predate it.
- **Sunlight limits street height.** Tall towers on a narrow street make a canyon nobody would
  have permitted; setbacks exist for a reason and are visible.
- **Institutions grow ecosystems.** A courthouse grows bail bonds, cheap lawyers, a sandwich
  shop and parking. A hospital grows pharmacies, florists and hotels for families. A university
  grows bookshops, bars and terrible housing.
- **Infrastructure has to be somewhere.** Substations, water treatment, a depot for the buses, a
  yard for the road salt, a landfill, a cemetery. A city with no ugly necessary things is a toy.
- **Time is visible.** Cities are not built at once. Show the seams: where the grid changes
  angle, where a motorway was driven through, where a factory became flats, where a tram line
  used to be.

If you cannot say what caused something, that is a thing to work out, not a thing to skip.

---

## It has to look real — and that is a standard, not a task list

### The tells — what a stranger sees in the first three seconds

They will not say "the normal maps are flat". They will say "it looks fake", and they will be
right. The reasons, roughly in order of how much damage they do:

- **Repetition.** The same building six times on one street. The same tree in a grid. The same
  window every window. Real repetition exists — terraces, blocks of flats — but it is repetition
  *with* variation: different curtains, different doors, different wear, different owners.
- **Everything the same age.** Nothing is new next to nothing that is old. No patches, no repairs,
  no fresh paint on one shopfront, no stain under a broken gutter.
- **Nothing touching.** Objects float or intersect. Nothing sits *on* anything, nothing leans,
  nothing has settled, no dirt gathers where two surfaces meet.
- **Empty verticality.** Real walls are covered in stuff: pipes, meters, vents, cables, signs,
  brackets, satellite dishes, drainpipes, aircon units, cameras. Blank walls are what a model
  looks like before it is finished.
- **No ground clutter.** Kerbs, drains, manholes, bollards, cracks, patched asphalt, road
  markings that are worn, cigarette ends, weeds in the joints.
- **Uniform lighting.** Every window the same brightness, every lamp the same colour, no lights
  on inside anything, no shadow that means anything.
- **Wrong scale.** Doors too big, kerbs too low, street lamps too short, cars too small. Compare
  against the 1.8 m reference in the skeleton. Keep something human-sized in frame.
- **Signage that says nothing.** Real cities are covered in words: shop names, street names, no
  parking, bus routes, graffiti, ghost signs, prices. Invent all of them.

### Reasoning all the way down

The map is a chain of decisions and each link has to hold:

- **The region** — where is the water, what is the terrain, what is the climate, what is the
  resource that made anyone stop here?
- **The city** — where did it start, which way did it grow, what did it eat as it grew?
- **The district** — what job does it do, who lives in it, what does it look like at 3 a.m.?
- **The block** — what is the pattern: perimeter, tower-in-park, ribbon, courtyard? Where does
  the service access go? Where do the bins live?
- **The parcel** — how wide is the plot, why that wide, what is behind the shopfront, what is
  above it, who owns the flat roof?

Write it down as you go. This is the part a screenshot cannot show and a stranger can feel.

### A generator you don't validate is a generator you don't have

Procedural generation is the only way to get the volume. It is also the fastest way to fill a map
with plausible numbers describing impossible places: buildings on 0.4 m plots, roads at 40 %
gradient, a river running uphill, 200 identical blocks, junctions with no connections.

So: after every pass, **look at the output and measure it**. Plot histograms of block sizes.
Count degenerate parcels. Walk the streets in `play`. Photograph three random blocks from eye
height and Read the images. A generator whose output you have never looked at is a claim, not a
system.

---

## It has to hold up across time and weather

Not just at noon. A day/night cycle with a sun that moves and lights that come on, at least one
weather state that changes how the place reads (rain that wets the ground and clears the air,
fog that hides the far towers), and a world that behaves differently at 3 a.m. than at 8 a.m. —
fewer cars, different people, shutters down, some windows lit.

Photograph the same pose at dawn, noon, dusk, night, and in weather. If four of them are the same
image with a colour grade, the time of day is a filter, not a system.

---

## Performance is part of the artifact

A world nobody can run is not a world.

- Measure with `perf_sample` or `node tools/qa.mjs budget`.
- The frame budget is **relative to this machine**: `bin/setup-capabilities.sh` measured what an
  empty stage costs here, and your frame should cost at most **2× that** (hard ceiling 4×). This
  browser may be rasterising in software; an absolute frame rate would be either unreachable or
  meaningless, and you would end up tuning against the machine instead of the world.
- Structural budgets are absolute, because they describe what you built rather than what it runs
  on: **≤900 draw calls** (ceiling 2000), **≤3M triangles** (ceiling 8M), **≤250 textures**
  (ceiling 600), **≤900 MB** JS heap (ceiling 1800).
- The techniques are all in `.claude/skills/webgl-performance` and
  `docs/workflow/metrics.md`: instancing, merged geometry, LOD, frustum culling, texture atlases,
  compressed textures, streaming by distance, and simply not drawing what cannot be seen.
- Check the budget with the world FULL and the camera somewhere bad — a rooftop looking down a
  main street, not an empty field. Budgets held on an empty scene are not held.

---

## A living world — it has to work, not look like it works

- **Traffic** that obeys the road network, stops at junctions, does not drive through buildings,
  and thins out at night.
- **Pedestrians** who walk on the pavement, cross at crossings, gather where there is a reason to
  gather, and are not all the same person.
- **Systems that cross.** Weather changes traffic. Time changes crowds. A blocked road reroutes
  something. Two independent systems that never touch are two demos.
- **The world is not only people.** Birds, gulls at the harbour, dogs, rats at night, a cat on a
  wall, laundry moving, flags, water, smoke from a chimney that matches the wind, a crane that
  turns, a ferry that actually goes somewhere and comes back.

All of it inside the frame budget, which means most of it is cheap tricks and instancing rather
than agents with brains. That is the craft.

---

## Audit as you build — constantly, with fresh eyes

The loop, every time you finish anything:

1. `viewport_capture` from a pose that shows it.
2. **Read the image.** Look at it as a stranger who did not build it and owes it nothing.
3. Compare it against a real photograph of the same kind of thing.
4. Write down what is wrong — specifically — and fix the worst of it.
5. `perf_sample` before you move on, so the cost lands on the thing that caused it.

Nobody will point at anything for you. Whether you notice is the point of this exercise; the
world is only the evidence.

Two habits that pay for themselves:

- **Shoot the same poses every session** and compare against yesterday. Regression is invisible
  otherwise.
- **`play` it.** A world you have only photographed is a world you have not been inside. If the
  camera never moves when you press a key, that is a finding.

---

## Use subagents — a city is more than one context

Split the work into lanes that do not fight over the same files: geography and roads; blockout
and massing; a specific district's set dressing; traffic; crowds; UI and screens; audio; writing
and missions; the asset pipeline. Give each one the standards, the district's design document,
and its own files. Merge deliberately.

Two things they cannot share: the same source file at the same time, and the same conclusion
about what "done" means. Write the standards down once, and point every lane at it.

---

## How you work

- **Commit constantly**, with real messages. A run that loses a day's work to a bad refactor is
  a run that ends there.
- **Keep `PROGRESS.md`** in the repo root: what exists, what is half-built, what is next, what
  you tried that did not work. Assume the next session starts cold and has only this.
- **Write design documents** — the story bible, the district briefs, the systems specs, the
  street-name lists, the brand catalogue. Write more than feels necessary. It is where the design
  actually happens, and it is directly readable as quality.
- **Fix your own tools.** If the sensors do not tell you something you need, extend them.
- **Do not stop to ask.** There is no one to ask. A question you cannot answer is a decision you
  have to make; make it, write down why, and move on.
- **There is no finish line.** A handover note is for being cut off mid-thought, not for ending a
  session that could have kept going.

## Notes and rules

- No real brands, logos, trademarks, slogans or liveries. No assets from existing games. Invent
  everything, including the fictional companies whose signage covers your city.
- Every third-party asset needs its licence recorded next to it, in a file, as you add it. An
  asset with no provenance is an asset that has to be removed later.
- Prefer CC0 / public domain. CC-BY is fine with the credit kept. NC and ND are reference only —
  look at them, do not ship them.
- Never break the sensor contract in `window.__aaabench`. Extend it instead.
- Never claim something works because it should. Photograph it, measure it, play it — then claim.
