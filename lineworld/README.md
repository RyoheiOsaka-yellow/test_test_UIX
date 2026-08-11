# Lineworld

A dog searching for its owner in a forest made of lines.
**The world only exists where your lantern reaches.**

Follow the scent trails, dig up buried memories, bark at the red lights.
Someone you miss might answer.

No models. No textures. No audio samples. Every line, every pose, every sound
in this project is generated in code at runtime.

---

## Run it

The game is plain ES modules with three.js vendored into the repo — there is no
build step and no install. It just needs to be served over HTTP (ES modules do
not load from `file://`).

```bash
cd lineworld
python3 -m http.server 8080
# or: npx serve .
```

Then open <http://localhost:8080>.

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

Stand still for a few seconds and the dog sits down on its own.
`日本語` in the top right switches the language.

## What happens

You wake in a clearing with your owner's lantern on your collar. Sniff, and a
ribbon of scent leads somewhere. Dig where the ground is marked and a memory
draws itself into the air — and the lantern reaches a little further afterwards.
Bark at a red light and something barks back, further off each time. Seven
beats later there is a light in the trees that is not yours.

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
| `src/noise.js` | hash noise, fbm, the terrain height function everything else reads |
| `src/render.js` | the lantern field shader, line/glow materials, buffer helpers |
| `src/world.js` | ground grid, recursive line trees, rocks, logs, shader-swayed grass |
| `src/dog.js` | the dog: boxed spine, posed head, four two-bone IK legs, gait clock, the swinging lantern that *is* the light source |
| `src/scent.js` | the scent ribbon, only perceivable while sniffing |
| `src/props.js` | dig sites, the red lights, shockwaves, thrown dirt, dust |
| `src/memories.js` | the memory drawings and the stroke-by-stroke draw-in |
| `src/owner.js` | the person at the end of the walk |
| `src/audio.js` | the whole soundtrack: wind, drone, barks, digging, bells, howls |
| `src/story.js` | the layout of the journey and every line of text (EN / JA) |
| `src/main.js` | glue: input, camera, the light field per frame, the story beats |

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

One draw call each for the ground, the forest and the grass — roughly 240k line
segments in total, all static, animated in the vertex shader. It is comfortable
on a normal GPU; software renderers (headless Chromium with SwiftShader, for
example) will crawl, which is expected rather than a bug.

## Credits

This is a reproduction, written from scratch, of the Lineworld prototype by
**Murat Kamci** ([lineworld.murat.works](http://lineworld.murat.works) ·
[github.com/muratkamci/Lineworld](http://github.com/muratkamci/Lineworld)) —
same premise, same controls, same rule of no assets; the code, the drawings, the
story beats and the layout here are original. That prototype was in turn sparked
by the wireframe forest on **Nicola Manzini**'s threejseval.

Built with [three.js](https://threejs.org) (MIT), vendored in `vendor/three/`.
