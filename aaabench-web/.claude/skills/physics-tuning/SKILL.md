---
name: physics-tuning
description: Collision and physics for a city — what needs a physics engine and what does not, fixed timesteps, character controllers, tunnelling, and vehicle handling. Use when adding collision, when objects jitter or fall through the world, or when physics costs frame time.
---

# Physics

## Do not simulate the city

A city does not need rigid-body physics. It needs:

- a **character controller** (capsule, gravity, step-up, slope limit) — kinematic, not dynamic;
- **collision queries** against static geometry — raycasts and sphere casts;
- **vehicles** with arcade handling — again kinematic, with a fake weight transfer;
- **a handful of dynamic props** where physics is the point (a knocked bin, debris, a swinging
  sign).

Everything else is animation. Simulating a thousand crates so that none of them is ever touched is
the classic way to spend the whole frame budget on nothing.

## If you use an engine

`@dimforge/rapier3d-compat` is the pragmatic choice in a browser: WASM, deterministic, fast. Give
it **only** the colliders it needs — static trimesh per block (or, better, boxes and heightfields),
kinematic bodies for the player and vehicles, dynamic for the few things that deserve it.

If you do not use an engine, a capsule-vs-AABB/heightfield controller plus `three-mesh-bvh`
raycasts is a few hundred lines and is entirely sufficient for a walkable city.

## Fixed timestep, always

```js
acc += Math.min(dt, 0.25)                    // clamp: a tab that was backgrounded must not explode
while (acc >= STEP) { physics.step(STEP); acc -= STEP }
const alpha = acc / STEP                     // interpolate rendering between the last two states
```

`STEP` = 1/60 s. Variable-timestep physics is non-deterministic, and on a machine whose frame rate
moves — this one — it means the player's jump height depends on how busy the scene is.

Interpolate the render transform between the previous and current physics state, or motion stutters
at every frame rate that is not an exact multiple of the step.

## Character controller numbers

| | value |
|---|---|
| capsule radius / height | 0.35 / 1.8 |
| step-up | 0.35–0.45 m — kerbs must not stop the player |
| slope limit | 45–50° |
| ground snap distance | 0.2 m (or the player leaves the ground on every downslope) |
| gravity | 14–20 m/s² (9.8 feels floaty) |
| skin width | 0.02–0.05 m to avoid re-penetration |

Depenetrate by moving out along the contact normal, then re-project the remaining motion along the
surface — that is what makes sliding along a wall feel smooth rather than sticky.

## Tunnelling

Fast things pass through thin things between steps. Fixes, cheapest first: make thin colliders
thicker than they look; sweep (shape-cast) rather than teleport for anything fast; enable CCD only
on the few bodies that need it. CCD on everything is expensive and usually unnecessary.

## Vehicles

Arcade, not simulation: forward speed with acceleration curves, grip that falls off with slip
angle, a yaw rate limited by speed, and a body that pitches 2–4° under braking and rolls 3–6° in a
turn. Four raycasts for suspension gives you ground following and a visible weight shift for
almost nothing.

Real vehicle simulation in a city is a month of work that makes the game harder to drive.

## Debugging

- Draw the colliders. Most "physics bugs" are a collider in the wrong place or at the wrong scale,
  and they are invisible until you render them.
- Jitter is almost always: two constraints fighting, a variable timestep, or a depenetration that
  overshoots.
- Falling through the world is almost always a missing collider, a trimesh with inverted winding,
  or a body that started inside geometry.
- Log the number of active bodies. A count that only ever grows is a leak, and it will end the run
  long before it looks like a physics problem.
