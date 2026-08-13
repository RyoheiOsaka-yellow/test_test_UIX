---
name: game-feel
description: Making movement and interaction feel good — acceleration curves, camera response, feedback, timing numbers. Use when the player controller feels floaty, sluggish or weightless, or when actions have no impact.
---

# Game feel

Feel is timing plus feedback. Both are numbers, and here are the numbers.

## Movement

| | value |
|---|---|
| walk speed | 1.4–2.0 m/s |
| run speed | 4–6 m/s |
| acceleration to full speed | 0.10–0.20 s |
| deceleration to stop | 0.08–0.15 s |
| turn rate, walking | 360–540 °/s |
| air control | 20–40 % of ground acceleration |
| gravity | 9.8 m/s² feels floaty in games; 14–20 is normal |
| jump apex | 0.30–0.45 s |
| step-up height | 0.3–0.45 m (kerbs must not stop you) |
| coyote time | 80–120 ms |
| input buffer | 100–150 ms |

Two of these matter more than the rest: **step-up height** (a player who trips on a kerb feels
broken) and **input buffer** (a jump pressed 80 ms early must still fire).

Model movement as velocity with acceleration toward a desired velocity, not position teleporting.
Then everything else — slopes, knockback, wind, vehicles — composes with it.

## Camera

- Follow with a spring, not a rigid parent: position lerp `1 - exp(-k * dt)` (frame-rate
  independent; a raw `lerp(a, b, 0.1)` is not).
- Look ahead in the direction of travel, and lead slightly when running.
- Collide the camera with the world and pull in on contact; never let it clip through a wall.
- Widen the FOV a few degrees at speed and pull it back when stopping. It is the single cheapest
  sensation of speed there is.
- Damp the vertical axis harder than the horizontal — stairs and kerbs otherwise bounce the frame.

## Feedback

Every action needs an immediate, visible, audible response, and "immediate" means the same frame:

- Sound first. A footstep, a click, a thud sells impact more than any visual.
- Then a visual: a small camera kick (2–5 °, decaying over 100–200 ms), a particle, a decal, a
  flash of contrast.
- Then the state change. If the state change is slow, show the *start* of it instantly.

Timing: under 100 ms reads as instant, 100–200 ms as responsive, over 300 ms as laggy. Anything
the player initiates should begin inside 100 ms even if it completes later.

## Weight

- Heavier things accelerate slower and stop slower, and their camera lags further behind.
- Anticipation and follow-through: a tiny wind-up before a heavy action, a settle after it.
- Screen shake in proportion, and always decaying — constant shake is nausea, one-shot decay is
  impact.
- Contact matters: dust at the feet, a sound matched to the surface, a small stumble on landing.

## Vehicles

- Arcade handling beats simulation for a city: speed-dependent grip, a slip angle you fake, a
  weight transfer that pitches the body 2–4 ° under braking.
- Camera further back and lower with speed; FOV up; motion cues on the ground plane.
- Entering and leaving a vehicle is a transition to design, not a teleport.

## How to test it

`node tools/play.mjs --seconds 30 --shots 6` and watch the shots in order. Then, honestly:

- Does starting to move feel like starting, or like being dragged?
- Can you stop precisely on a mark?
- Does the camera ever show you the inside of a wall?
- Does anything happen when you press a key that should do nothing? (It should not.)

If the play session reports `camera moved 0.0m`, none of the above is relevant yet.
