---
name: reference-images
description: Finding and using real photographs — keyless search, download, and the compare-against-your-own-screenshot loop. Use before building any real-world thing, and whenever something you built looks wrong and you cannot say why.
---

# Reference images

Never guess what something looks like. You have a keyless search and a Read tool that sees images.

## The tool

```bash
python3 tools/refs.py find "harbour crane"        # results with licences
python3 tools/refs.py grab "fire escape" --n 4    # find + download
python3 tools/refs.py get <url> -o /tmp/aaabench_refs/thing.jpg
```

Downloads land in `/tmp/aaabench_refs/`. Then **Read the file** — the point is not to have the
photograph, it is to look at it.

## Searching

Openverse ANDs every term. This is the single most important thing to know about it:

| query | result |
|---|---|
| `miami south beach art deco hotel dusk` | zero |
| `art deco hotel` | hundreds |
| `fish market` | hundreds |
| `busy fish market morning stalls` | zero, or three bad ones |

Two or three words. If you need a specific angle or time of day, search the subject and browse,
rather than describing the shot.

Search for the **thing**, not the mood: `loading dock`, `fire escape`, `tenement window`,
`level crossing`, `bus shelter`, `pavement kerb`, `shop front shutter`.

## The loop that actually improves the world

1. `grab` three photographs of the real thing.
2. **Read** them. Look, do not skim.
3. `viewport_capture` your version from a comparable angle.
4. **Read** your capture.
5. Write down the differences — specifically, in a file:

> The real fire escape has: a counterweighted drop ladder, brackets bolted through the brick with
> stains under each bolt, a landing at every floor with a gate, rust concentrated at the joints,
> and it is *offset* from the windows, not centred. Mine has: a ladder, centred, one colour.

6. Fix the biggest one. Repeat.

The gap is never "needs more detail". It is always structural, and it is always nameable once the
two images are next to each other.

## Licences

Every result prints its licence. CC0 and public domain can be texture source material. CC-BY is
usable with the credit kept, and the credit must be recorded when you use it, not later. NC and ND
are **reference only** — look at them, never ship them.

Record what you used, where, in the asset manifest (see `asset-pipeline`).

## What to reference, that people forget to

Not just buildings. The things that make a place feel observed rather than imagined:

- how a kerb meets a driveway; what a drain looks like from above
- the back of a shop, the service alley, the bin store
- the underside of a bridge; the join where two eras of building meet
- what a wall is covered in: meters, pipes, brackets, cables, spikes, notices
- a street at night — where light actually comes from, and how much of it there is
- the same street in rain: what darkens, what reflects, where water gathers

## The honest use

The reference is not there to be copied. It is there so that when you look at your own screenshot,
you have something to compare it against other than your intention — which always looks correct.
