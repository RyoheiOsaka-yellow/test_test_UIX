---
name: camera-systems
description: Third and first person camera rigs, collision, transitions, cinematic framing. Use when building the player camera, when the view clips through geometry, or when composing establishing shots and cutscenes.
---

# Cameras

## The rig

Never parent the camera directly to the player. Use a rig:

```
player (position, yaw)
  └─ pivot (yaw, pitch — damped, follows player yaw with lag)
       └─ boom (length, collides)
            └─ camera (fov, offset)
```

Each stage is separately dampable, which is what lets the camera lag the body without lagging the
aim, and lets you shorten the boom without moving the pivot.

## Damping that survives a frame-rate change

```js
const k = 1 - Math.exp(-rate * dt)      // rate ≈ 6 (loose) … 20 (tight)
current.lerp(target, k)
```

A raw `lerp(a, b, 0.1)` per frame is frame-rate dependent: it damps twice as fast at 120 fps as at
60. On a machine whose frame rate moves — which is this one — that reads as the camera changing
personality when the scene gets busy.

## Collision

Sphere-cast (or ray-cast a small fan) from the pivot to the desired camera position each frame;
if it hits, shorten the boom to the hit distance minus a margin. Return to full length slowly
(0.5–1.0 s) but retract **instantly** — a slow retraction means a frame inside a wall, and a frame
inside a wall shows the player the inside of the world.

`three-mesh-bvh` makes this affordable against a city's worth of geometry. Without it, raycasting
against everything each frame is a real cost.

## Field of view

- 60–75° third person, 75–90° first person.
- Widen 3–8° at speed, ease back over ~0.3 s.
- Never change FOV instantly except as a deliberate punch.
- Keep `camera.updateProjectionMatrix()` after every change, and remember the inspection camera in
  the harness is a *different* camera — check which one you are looking through when a shot
  surprises you (`stats().inspecting` says).

## Transitions

Cuts are free; blends are expensive to get right. A blend between two cameras should be short
(0.3–0.8 s), ease in and out, and never pass through geometry — sample the path first, and cut if
it would.

For getting into a vehicle: a short blend to the vehicle camera while the character animation
plays, not a teleport.

## Cinematic framing (for the shots you publish)

- Put the horizon off centre. Thirds, or lower for sky, higher for ground detail.
- Frame with something in the foreground — a railing, a wall edge, a lamp. Depth needs layers:
  foreground, subject, background.
- Low sun (10–20° elevation) makes long shadows that describe the geometry. Noon flattens
  everything, which is why noon screenshots always look worse.
- Keep something human-sized in shot; scale is unreadable without it.
- Register these as poses so tomorrow's version is comparable:

```js
viewport_poses({ add: { name: 'arrival', from: [-1400, 90, 900], to: [0, 40, 0], fov: 35,
                        note: 'the establishing shot from the water' } })
```

## The check

Run a `play` session and read the shots for: the camera inside geometry, the camera behind the
player's head, the horizon rolling, motion sickness from over-damping, and the near plane clipping
the player's own body. All five are common, and all five are invisible in a still taken from the
inspection camera.
