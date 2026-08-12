# Log-Polar Raymarch

A single-file WebGL2 player for a golfed fragment shader written in
[Twigl](https://twigl.app)'s `geekest (300 es)` dialect. No build step, no
dependencies — `shader/index.html` is the whole thing.

## Run it

```bash
npx serve .          # then open http://localhost:3000/shader/
```

Opening `shader/index.html` straight from disk works too; there is nothing to
fetch.

### Controls

| Key         | Action                                    |
| ----------- | ----------------------------------------- |
| `space`     | pause / resume                            |
| `←` `→`     | scrub time by 0.1s (hold `shift` for 1s)  |
| `0`         | restart from `t = 0`                      |
| `-` `+`     | render resolution down / up               |
| `s`         | save the current frame as PNG             |
| `h`         | hide the HUD                              |

The HUD fades out after a couple of seconds of no input.

The shader costs roughly 1000 loop iterations per pixel, so it is fill-rate
bound: it starts at 1.0× CSS pixels rather than full device pixel ratio. If the
fps readout is unhappy, press `-`; on a fast GPU, `+` supersamples.

## What the shader does

```glsl
float i,e,R,s;
vec3 q,p,d=vec3((FC.xy-.5*r)/r.y+vec2(cos(t)*.04,1),.5);
for(q.yz--;i++<99.;){
  o+=min(e*s,.8-e)/50.;
  s=1.;
  p=q+=d*e*R*.4-e;
  p=vec3(log(R=length(p))-t,exp(-p.z/R+.6),abs(atan(p.x,p.y)));
  for(e=--p.y;s<9e2;s+=s)
    e+=.06-abs(dot(cos(p.zzx*s),.3-cos(p*s)))/s*.3;
}
```

- **Camera.** `d` is the ray direction: pixel coordinates normalised by height,
  aimed down +y, with `cos(t)*.04` adding a slow lateral sway. The ray starts at
  `q = (0,-1,-1)` via the `q.yz--` in the loop initialiser.
- **March.** 99 steps of `q += d*e*R*.4 - e`. The step scales with both the
  distance estimate `e` and the radius `R`, which is what makes the detail hold
  up as the geometry recedes.
- **Domain warp.** Each sample is remapped into a log-polar frame:
  `x = log(R) - t` (subtracting time gives the endless zoom), `y` an exponential
  of the elevation ratio `p.z/R`, and `z = abs(atan(p.x,p.y))` — the `abs` folds
  the azimuth and is the reason the image is bilaterally symmetric.
- **Surface.** The inner loop is a ten-octave `1/f` sum (`s` doubles from 1 to
  512) of `abs(dot(cos(p.zzx*s), .3-cos(p*s)))`. Multiplying two decorrelated
  cosine fields and folding with `abs` gives the eroded, ridged look; the running
  total is the distance estimate for the next march step.
- **Shading.** There is none, in the lighting sense. `o += min(e*s, .8-e)/50.`
  accumulates density along the ray, so the image is greyscale by construction,
  and the bright regions clip to white on purpose.

## The wrapper

Twigl supplies the uniforms implicitly; `index.html` declares them explicitly so
the same body runs unmodified:

| Name | Meaning                        |
| ---- | ------------------------------ |
| `r`  | drawing buffer size, in pixels |
| `t`  | time, in seconds               |
| `m`  | pointer position, `0..1`       |
| `f`  | frame index                    |
| `o`  | output colour                  |
| `FC` | `gl_FragCoord`                 |

The geometry is a single `gl_VertexID`-derived triangle, so no vertex buffers
are bound.

One deliberate change to the body: `i`, `e`, `R`, `s`, `q` and `p` are
explicitly zero-initialised. The original relies on locals starting at zero,
which GLSL does not guarantee — it is merely what the drivers Twigl runs on
happen to do. Everything else is verbatim.

## Verified

Compiled and rendered headlessly (Chromium + SwiftShader): no compile or link
errors, no console errors, and the frame changes with `t`.
