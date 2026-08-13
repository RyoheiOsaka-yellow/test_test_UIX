---
name: audio-design
description: Web Audio for a city — ambience beds, positional sources, footsteps, adaptive music, voice limits. Use when adding sound, when the world feels dead despite looking right, or when audio costs frame time.
---

# Audio

Silence reads as a bug. Ambience is the cheapest immersion in the entire project, and footsteps
are worth more than a second music track.

## The graph

```
AudioContext
 ├─ music      → gain → master
 ├─ ambience   → gain → master
 ├─ world      → gain → master   (positional sources)
 └─ ui         → gain → master
```

Four buses, four sliders in the settings screen, one master. Build it once, before there are
sounds, or you will retrofit it after there are two hundred.

three.js gives you `AudioListener` on the camera plus `PositionalAudio` on objects; that is enough
for most of a city. Reach for raw Web Audio when you need filtering, procedural sources, or
control over voice counts.

## Ambience

- One bed per district (harbour, high street, estate, industrial, park), cross-faded by the
  player's position. Fade over 1.5–3 s.
- Modulate by hour and weather: the same bed, filtered darker at night, with rain layered over it.
- Procedural beds cost no assets and never loop audibly: filtered noise for wind and rain,
  band-passed noise for distant traffic, sparse randomised one-shots (a gull, a door, a horn) on
  top. A loop that repeats every 30 s is noticed within two minutes.

## Positional sources

Anything visible that would make noise: traffic on the arterial, a generator, a market, a ferry,
an air-conditioning unit, a busker. `refDistance` in metres, `rolloffFactor` around 1, and a
`maxDistance` so distant sources stop costing anything.

Occlusion can be a cheap low-pass filter when a raycast to the listener hits geometry. Nobody will
know why it sounds right, but the difference between "inside" and "outside" is mostly this.

## Footsteps

Per surface — concrete, cobbles, gravel, metal grate, water, timber — chosen from the material
under the foot, with pitch and volume jitter (±5 % pitch, ±3 dB) and 3–5 variants each. Deadpan
identical footsteps are worse than none.

## Adaptive music

- Layers, not tracks: a bed that always plays plus stems that fade in with state. Cross-fading
  layers on a shared tempo is seamless; cross-fading whole tracks is not.
- Transition on musical boundaries (bar or beat), not on the event. Queue the change.
- Silence is a state. A city that is scored continuously has no dynamics; let the ambience carry
  long stretches and bring music in for arrival, chase, night.

## Costs and limits

- Decode once, keep the `AudioBuffer`, create cheap `BufferSourceNode`s per play.
- Cap concurrent voices (32–64 total, 4–8 per category) with a priority and a steal rule. A
  hundred simultaneous footsteps costs more than the crowd's geometry.
- Pool positional nodes; creating and connecting nodes per event is where the garbage comes from.
- `AudioContext` starts suspended until a user gesture — resume it on the title screen's first
  click, and check `context.state` rather than assuming.

## The check

Play with sound and no picture, in your head: could you tell where you are? Then look at what
makes noise in your world and what does not. A market with no sound, or a road with no traffic
noise, is a thing the player notices without being able to say why.
