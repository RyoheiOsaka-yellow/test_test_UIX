# Lineworld

A dog searching for its owner in a forest made of lines.
**The world only exists where your lantern reaches.**

Follow the scent trails, dig up buried memories, bark at the red lights.
Someone you miss might answer.

No models. No textures. No audio samples. Every line, every pose, every sound
in this project is generated in code at runtime.

---

## Run it

**The short way:** open [`lineworld.html`](lineworld.html). It is the whole game
in one file — three.js, every module, the CSS and the markup are all inline, so
it plays from `file://` with no server and nothing to install. Download it,
double-click it, done.

**From source:** the game is plain ES modules with three.js vendored into the
repo, so there is still no build step — it just needs to be served over HTTP
(ES modules do not load from `file://`).

```bash
cd lineworld
python3 -m http.server 8080   # or: npm start
```

Then open <http://localhost:8080>.

To regenerate the single file after editing `src/`:

```bash
npm install   # esbuild, the only dependency, and only for this
npm run build
```

## Controls

| | |
|---|---|
| `W A S D` | move (camera-relative) |
| `Shift` | run |
| `Space` | jump |
| `Q` *(hold)* | smell — reveals the scent trail |
| `E` *(hold)* | dig, at a marked site |
| `F` | bark — a shockwave that flashes the world into view, and wakes the red lights |
| mouse drag / wheel | look around / zoom |

You never have to touch the keyboard. The same controls are on screen the whole
time you play — a direction pad at bottom left, the actions at bottom right —
and they work with the mouse exactly as they do with a finger: press and hold to
walk or to dig, tap to bark or jump. Each keyboard key is printed small on its
button, so the shortcuts are there when you want them.

A button lights up warm while it is doing something, and pulses on its own when
the game wants you to try it — so "dig here" and "bark at this" come from the
button rather than from a tutorial.

Stand still for a few seconds and the dog sits down on its own.
`日本語` in the top right switches the language.

## What happens

You wake in a clearing with your owner's lantern on your collar. Sniff, and a
ribbon of scent leads somewhere. Dig where the ground is marked and a memory
draws itself into the air — and the lantern reaches a little further afterwards.
Bark at a red light and something barks back, further off each time. Seven
beats later there is a light in the trees that is not yours.

## What is out there

The forest is not one texture repeated. A biome map decides what grows where,
and the rest follows from the terrain:

- **Three species of tree.** Broadleaf grown by recursive branching; conifers
  with a straight bole and eight whorls of drooping branches; birches, pale and
  bare until high up, with bark ticks down the trunk.
- **A stream** meandering across the whole world, cut into the hills by the same
  height function everything else reads. It is shallow enough to wade: step in
  and the footsteps become splashes, rings spread from your paws, and the water
  bed rises in the mix as you get near. Reeds line both banks.
- **Undergrowth** — shrubs, ferns, grass, fallen logs, rocks — and clusters of
  mushrooms that glow faintly blue in the dark, which are often the first thing
  you see of a place.
- **Mist** that pools over the stream and thins out to nothing on the high
  ground, **fireflies**, **leaves** coming down through the lantern light,
  **stars** and a low moon, and the **footprints** you leave behind, which fade
  after half a minute.
- **Birds.** Bark near a stand of trees and they clatter out of it.

## How it works

Everything hangs off one idea, in `src/render.js`: geometry has no colour until
light touches it. Each frame a handful of **lamps** (soft spheres) and **pulses**
(expanding shells — a bark, a monument waking up) are uploaded as uniforms, and
every fragment asks the field how much light reaches its world position. Below a
per-vertex threshold, a line is simply not drawn yet. Because that threshold
ramps outward along a tree's branches, a tree *sketches itself* trunk-first as
you walk towards it, and un-draws behind you.

| file | |
|---|---|
| `src/noise.js` | hash noise, fbm, the terrain height function, and the stream cut into it |
| `src/render.js` | the lantern field shader, line/glow materials, buffer helpers |
| `src/world.js` | ground grid, the stream surface, three species of tree, undergrowth, mushrooms, reeds, sky |
| `src/dog.js` | the dog: boxed spine, posed head, four two-bone IK legs, gait clock, the swinging lantern that *is* the light source |
| `src/scent.js` | the scent ribbon, only perceivable while sniffing |
| `src/props.js` | dig sites, the red lights, shockwaves, thrown dirt, dust |
| `src/ambience.js` | mist, fireflies, leaves, footprints, ripples, the startled birds |
| `src/memories.js` | the memory drawings and the stroke-by-stroke draw-in |
| `src/owner.js` | the person at the end of the walk |
| `src/audio.js` | the whole soundtrack: wind, water, crickets, an owl, barks, digging, bells, howls |
| `src/story.js` | the layout of the journey and every line of text (EN / JA) |
| `src/main.js` | glue: input, camera, the light field per frame, the story beats |
| `build.mjs` | bundles all of the above into the standalone `lineworld.html` |

A few notes on the parts that were more fun than expected:

- **The dog** is rebuilt from scratch every frame into one `LineSegments` buffer.
  Feet are placed on the terrain first, then a closed-form two-bone IK solve puts
  the knee where it belongs — front legs bend back, hind legs bend forward. Pose
  channels (head height, ear angle, tail wag, mouth) are damped towards per-state
  targets, so sitting, sniffing, digging and barking blend rather than snap.
- **Audio** is a small synth: brown-noise wind through an LFO'd bandpass, a
  detuned drone, and one-shots built per event. A bark is a sawtooth glide
  through a moving formant plus a noise transient plus a sub thump. The reverb is
  a convolver whose impulse response is decaying noise generated on startup.
- **The bark** is the only way to see far. It adds a pulse to the light field, so
  the shell of the wave lights whatever it passes through and then lets it go
  dark again.

Open the console and use `__LW` (`__LW.dog.pos.set(x, 0, z)`) to move around
while poking at it.

## Performance

The static world is about 310k line segments in six draw calls — ground, water,
forest, undergrowth, mushroom glow, sky — all animated in the vertex shader
rather than on the CPU. Everything that moves (the dog, mist, birds, footprints,
shockwaves, particles) is rebuilt into a handful of preallocated dynamic buffers
each frame. Building the world takes well under a second; after that it is
comfortable on a normal GPU. Software renderers (headless Chromium with
SwiftShader, for example) will crawl, which is expected rather than a bug.

## Credits

This is a reproduction, written from scratch, of the Lineworld prototype by
**Murat Kamci** ([lineworld.murat.works](http://lineworld.murat.works) ·
[github.com/muratkamci/Lineworld](http://github.com/muratkamci/Lineworld)) —
same premise, same controls, same rule of no assets; the code, the drawings, the
story beats and the layout here are original. That prototype was in turn sparked
by the wireframe forest on **Nicola Manzini**'s threejseval.

Built with [three.js](https://threejs.org) (MIT), vendored in `vendor/three/`.
