# How to see it

Self-verification is the capability being measured. This is the mechanics of it.

## Poses, not free-hand cameras

A pose is a fixed camera you can return to. Two shots of the same pose are comparable; two
free-hand shots are two different pictures of two different things, and "did that get better?"
becomes unanswerable.

Four ship with the skeleton — `aerial`, `establishing`, `street`, `horizon` — and they follow the
world's bounds as it grows. Add your own, one per district and per landmark:

```js
viewport_poses({ add: { name: 'harbour-crane', from: [820, 40, -310], to: [700, 25, -260],
                        fov: 45, note: 'the crane against the far bank — silhouette check' } })
```

Then sweep them every session: `node tools/viewport.mjs sweep 2026-03-14-morning`. A sweep before
a big change and a sweep after it is the cheapest regression test you will ever build.

## Reading your own screenshot

The hard part is not capturing. It is looking at your own work as somebody who did not make it.

Three things that help:

1. **Read the file.** Not the numbers, not the description you wrote of what it should be. Open
   the image.
2. **Put a real photograph next to it.** `python3 tools/refs.py grab "container terminal" --n 3`
   and Read both. Judgement is comparative; without the reference, everything you built looks
   like what you meant.
3. **Say what a stranger would say, in one sentence, before you defend it.** "It looks like a
   model of a city, not a city." Then work out why that sentence is true. The reasons are in
   `../../PROMPT.md` under the tells, and they are almost never "more polygons".

## The flat-frame check

Every capture reports the frame's mean luminance, its standard deviation, and how many distinct
colours it contains. The verdicts:

- `FLAT — one colour` — nothing drawn, camera inside geometry, material failed to compile, or the
  scene is behind the near plane. **Not** something to file away for later.
- `NEARLY FLAT` — fog too dense, an unlit scene, empty sky, or a camera pointed at nothing.
- `has content` — worth reading. Not "correct".

The check exists because a screenshot of nothing has the same file extension as a screenshot of a
city, and an hour spent building on top of a broken render is an hour lost.

## Before and after

```bash
node tools/viewport.mjs shot lighting-before --pose street
# … change the lighting …
node tools/viewport.mjs shot lighting-after  --pose street
node tools/viewport.mjs diff /tmp/aaabench_qa/lighting-before.png /tmp/aaabench_qa/lighting-after.png
```

RMSE (if ImageMagick is installed) tells you *how much* changed, which is how you catch a change
that did nothing at all, and a change that did far more than you intended.

## Playing it

```bash
node tools/play.mjs --seconds 30 --shots 6
node tools/play.mjs --script '[{"shot":"title"},{"click":[640,420]},{"wait":2},{"shot":"after-start"},
                               {"key":"w","hold":6},{"mouse":[500,0]},{"shot":"walked"}]'
```

A play session reports three things a screenshot cannot:

- **whether input moved anything** — camera position and forward delta over the session;
- **whether the frame changed while you played** — via the per-shot frame stats;
- **what the page logged while you were inside it** — errors that only happen under input.

`camera moved 0.0m and turned 0.000` on a session where you held W for six seconds is a finding
about the build, not a quirk of the tool.

## Time of day and weather

Shoot the same pose across the states you claim to support:

```bash
node tools/qa.mjs eval "window.city.setTime(6.5)"   # your own hook
node tools/viewport.mjs shot main-street-dawn --pose main-street
```

If dawn, noon and dusk are the same image with a colour grade, the cycle is a filter. Sun
elevation changes shadow length and direction; a night shot needs *sources* — windows, lamps,
headlights, signs — or it is just a dark day.

## What to write down

A screenshot you looked at and did not write about is a screenshot you will look at again next
week. Keep a running audit file: the pose, the date, the sentence a stranger would say, the
specific causes, and which one you fixed. It is also the only honest way to answer "is this
better than yesterday" three weeks in.
