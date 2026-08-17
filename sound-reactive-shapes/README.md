# Sound-reactive shapes

A reproduction of the *Sound-reactive shapes* chapter of Kenichi Yoneda's **Geom**
(<https://www.kynd.info/geom/sound-reactive-shapes/>): raymarched shapes that are
deformed — or built outright — by audio, in real time.

Everything is rendered in a single fullscreen fragment shader. There is no
polygonal geometry anywhere; each frame the shader marches rays into a signed
distance field or an implicit scalar field, and the audio moves the sample points
before the field is evaluated. Because of that, normals are finite-differenced on
the *deformed* geometry, so the deformation interacts with the lighting rather
than sliding underneath it.

## Running it

**Just open `sound-reactive-shapes.html`.** It is a single self-contained file
with every shader, style and script inlined — double-click it, no server needed.

To work on the sources instead, serve the directory. `index.html` loads the
shaders with `fetch`, so it does need a server:

```bash
cd sound-reactive-shapes
python3 -m http.server 8000
# then open http://localhost:8000/
```

After editing anything under `js/`, `css/` or `shaders/`, regenerate the
single-file build:

```bash
node build.mjs          # → sound-reactive-shapes.html
```

`build.mjs` takes the page shell from `index.html` and swaps the external
references for inlined equivalents, so the two versions cannot drift apart. It
has no dependencies.

Requires WebGL2 and a network connection on first load — three.js r169 comes from
jsDelivr via an import map, which works over `file://` too because jsDelivr sends
`Access-Control-Allow-Origin: *`.

## Audio

The original demos replay a pre-baked binary of per-frame analysis alongside an
mp3. This version runs the same analysis live in the browser instead, so it works
with whatever you give it:

| Source | Notes |
| --- | --- |
| **Generated** | A built-in four-bar loop — kick, hat, snare, bass and a drifting pad. Deliberately wide-band so every frequency mode has something to chew on. |
| **Audio file** | Any file the browser can decode. Loops. |
| **Mic** | Analysis only — the input is never routed to the speakers. |

Browsers will not start an `AudioContext` without a gesture, so nothing plays
until you press play or pick a source. The **Gain** slider scales the measured
RMS; turn it down for hot masters and up for quiet material. The shape stays
visible in silence — rim lighting does not depend on amplitude.

Per frame the analyser produces:

- `ampL` / `ampR` / `ampMono` — RMS amplitude per channel
- a 128-bin **mel-scale** spectrum per channel (mel spacing packs resolution into
  the low end, matching how the ear reads a spectrum)
- a **256-frame ring buffer** (~4 s at 60 fps) of amplitude
- a **128 × 256 spectrogram** ring buffer

These reach the shader as three data textures: `u_histTex` (1 × 256, newest row
first), `u_fftTex` (128 × 1) and `u_specTex` (128 × 256, addressed through
`u_histHead` so no rows ever have to be shifted).

The ring buffers advance on a fixed 60 Hz clock rather than once per rendered
frame, so the history window stays ~4 seconds of *audio* whatever the frame rate.
Tying it to rendering would mean a machine drawing at 20 fps spread 13 seconds of
sound across the same geometry.

## The four sections

### Amplitude

Reads only the current frame, so the reaction is immediate and tight on transients.

- **Radial expansion** — amplitude shifts the scalar threshold, so the marcher
  renders a different isosurface of the same field. Closed shapes inflate; open
  sheets translate along the field gradient instead.
- **Axial compression** — the left channel compresses Y while the right expands X
  and Z, each on its own slider.
- **Normal extrusion** — a hash gives every surface point a fixed random
  displacement. Lighting deliberately uses the *undeformed* normal, so the rim
  term keeps tracking the clean silhouette while the spiky geometry defines the edge.

### History

Keeps about four seconds of amplitude and paints it across the surface, so recent
past and present are visible at once. **Duration** narrows the window onto the most
recent frames; **Soften** runs a 5-tap Gaussian across adjacent history frames.

- **Radial displacement** — the bottom samples the current frame and the top the
  oldest, so pulses appear at the base and travel upward.
- **Banded displacement** — the centre samples now, the outer surface the oldest;
  a beat inflates the middle and spreads outward as a concentric wave.
- **Axial rotation** — each slice rotates by the amplitude at the corresponding
  historical moment. The twist axis defaults to vertical and can be tilted in X
  and Z, turning the corkscrew into a side-roll.

### Frequency

Driven by the current frame's 128-bin mel spectrum.

- **Spectral displacement** — height maps continuously to a frequency bin and each
  level inflates laterally by that bin's energy: a 3D equaliser.
- **Spectral contours** — 2–8 evenly-spaced bands are joined by a Catmull-Rom
  spline, giving a C1-continuous curve that drives displacement along the normal.
- **Spectral shear** — two pairs of bands drive opposing per-axis skew. A
  low-heavy mix leans the shape one way, a high-heavy mix the other; the shear
  axes rotate slowly so the lean direction keeps changing.

### Form

Instead of deforming a base shape, these build geometry directly out of audio:
spectral fan, interference rings, spectrogram cylinder, spectral tube, waveform
sphere, harmonic rings, spectrogram cone, spectral terrain, spectral helix and
spectral ribbon.

## Shape families

The first three sections can deform any shape from four families:

- **SDF shapes** — 31 exact distance primitives, sphere-traced.
- **Platonic** — the three dual pairs, cross-faded through their intermediate
  polyhedra (the cube/octahedron pair passes through a cuboctahedron at t = 0.5).
- **Scalar fields** — ten implicit surfaces `F(x,y,z) = 0`. These are not distance
  functions, so the marcher steps at a fixed rate and bisects sign changes.
- **Moving scalar** — twenty time-varying fields (gyroid, Schwarz P, Chmutov T₄ and
  friends) that animate on their own before any audio touches them.

## Lighting

- **Rim lighting** — bright silhouette edges plus a thickness-based subsurface
  term, found by continuing the march through the interior to the back face.
- **Amplitude flash** — two orbiting key lights on a flat white material, one per
  channel, both scaled by amplitude².
- **Environment map** — an OKLCH sky where azimuth is hue and elevation is
  lightness, with the maximum in-gamut chroma at every cell.

All three are gamma-encoded in the shader and then passed through an
`UnrealBloomPass`.

## Layout

```
sound-reactive-shapes.html   single-file build — open this one
build.mjs                    generates it from the sources below
index.html            page and overlay controls
css/ui.css            overlay chrome
js/main.js            scene setup, shader assembly, UI
js/audio.js           Web Audio analysis and the generated track
js/oklch-envmap.js    OKLCH environment map generator
shaders/
  vertex.glsl                    fullscreen pass-through
  fragment-{sdf,platonic,scalar,moving,form}.glsl
  sdf-functions.glsl             distance primitives
  platonic-functions.glsl        the five solids at unit circumradius
  moving-scalar-functions.glsl   time-varying scalar fields
  sdf-marcher.glsl               sphere tracer
  scalar-marcher.glsl            fixed-step marcher with bisection
  deform.glsl                    the nine audio deformations
  lighting.glsl                  flash and environment lighting
  rim-lighting.glsl              rim + SSS
```

The fragment shaders are templates: `js/main.js` splices the shared libraries into
`// INCLUDE_*` markers at load time, which is why `deform.glsl` can be written once
and used by every family.

`window.soundReactiveShapes` exposes `{ audio, uniforms, shared, state, scenes,
composer }` for driving the page from the console.

## Credits

The design, the shape catalogue and the deformation and lighting maths are from
**Geom** by Kenichi Yoneda (Kynd) — <https://www.kynd.info/geom/> — used under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), which this
reproduction is likewise licensed under.

The distance primitives are Inigo Quilez's — <https://iquilezles.org/articles/distfunctions/>.

No audio from the original site is redistributed here; the sound files on Geom are
by Yaporigami (Yu Miyashita) under CC BY-NC-SA 4.0.
